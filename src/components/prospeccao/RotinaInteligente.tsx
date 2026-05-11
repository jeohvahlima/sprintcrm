import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Target, Phone, MessageCircle, Instagram, Mail, Coffee,
  TrendingUp, AlertTriangle, RefreshCw, Save, Plus, Trash2, GripVertical,
  Sun, CloudSun, Sunset, Moon, Zap, BookOpen, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { usePermissions } from "@/hooks/usePermissions";
import { Users, Sparkles } from "lucide-react";

type Role = "sdr" | "closer";
type Channel = "whatsapp" | "ligacao" | "instagram" | "email" | "linkedin";
type BlockType = "execucao" | "followup" | "organizacao" | "aprendizado" | "pausa" | "reuniao";

interface RoutineBlock {
  id: string;
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  title: string;
  type: BlockType;
  description: string;
  goal?: string;
}

interface Config {
  // Empresa
  metaFaturamento: number;
  ticketMedio: number;
  taxaConversao: number;     // % reunião → venda
  diasUteis: number;

  // SDR
  sdrCount: number;
  sdrHoras: number;
  sdrCanal: Channel;
  sdrNivel: "iniciante" | "intermediario" | "avancado";
  sdrInicio: string;         // HH:mm
  sdrAlmocoInicio: string;
  sdrAlmocoFim: string;
  taxaLeadResposta: number;  // %
  taxaRespostaReuniao: number; // %

  // Closer
  closerCount: number;
  closerHoras: number;
  closerInicio: string;
  closerAlmocoInicio: string;
  closerAlmocoFim: string;
  tempoReuniaoMin: number;   // min
  taxaFechamento: number;    // %

  // Distribuição
  pctExecucao: number;
  pctFollowup: number;
  pctOrganizacao: number;
  pctAprendizado: number;
}

const DEFAULT_CONFIG: Config = {
  metaFaturamento: 100000,
  ticketMedio: 5000,
  taxaConversao: 25,
  diasUteis: 22,

  sdrCount: 1,
  sdrHoras: 8,
  sdrCanal: "whatsapp",
  sdrNivel: "intermediario",
  sdrInicio: "09:00",
  sdrAlmocoInicio: "12:00",
  sdrAlmocoFim: "13:00",
  taxaLeadResposta: 20,
  taxaRespostaReuniao: 30,

  closerCount: 1,
  closerHoras: 8,
  closerInicio: "09:00",
  closerAlmocoInicio: "12:00",
  closerAlmocoFim: "13:00",
  tempoReuniaoMin: 45,
  taxaFechamento: 25,

  pctExecucao: 40,
  pctFollowup: 30,
  pctOrganizacao: 20,
  pctAprendizado: 10,
};

const STORAGE_KEY = "prospeccao_rotina_inteligente_v1";
const ROUTINE_KEY = "prospeccao_rotina_blocos_v1";

const BLOCK_STYLES: Record<BlockType, { bg: string; border: string; icon: any; label: string }> = {
  execucao:    { bg: "bg-emerald-500/10", border: "border-l-emerald-500", icon: Zap,         label: "Execução" },
  followup:    { bg: "bg-amber-500/10",   border: "border-l-amber-500",   icon: RefreshCw,   label: "Follow-up" },
  organizacao: { bg: "bg-blue-500/10",    border: "border-l-blue-500",    icon: Calendar,    label: "Organização" },
  aprendizado: { bg: "bg-purple-500/10",  border: "border-l-purple-500",  icon: BookOpen,    label: "Aprendizado" },
  pausa:       { bg: "bg-muted",          border: "border-l-muted-foreground", icon: Coffee, label: "Pausa" },
  reuniao:     { bg: "bg-rose-500/10",    border: "border-l-rose-500",    icon: Phone,       label: "Reunião" },
};

function addMin(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
function diffMin(start: string, end: string): number {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

export function RotinaInteligente() {
  const { companyId, userId } = usePlayerProfile();
  const { isAdmin } = usePermissions();
  const [config, setConfig] = useState<Config>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG; }
    catch { return DEFAULT_CONFIG; }
  });
  const [activeRole, setActiveRole] = useState<Role>("sdr");
  const [sdrBlocks, setSdrBlocks] = useState<RoutineBlock[]>([]);
  const [closerBlocks, setCloserBlocks] = useState<RoutineBlock[]>([]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedTemplate, setUsedTemplate] = useState<{ sdr: boolean; closer: boolean }>({ sdr: false, closer: false });

  // Carregar do Supabase (rotina pessoal → fallback: template da empresa por papel)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fallback local imediato
      try {
        const s = localStorage.getItem(ROUTINE_KEY);
        if (s) {
          const parsed = JSON.parse(s);
          setSdrBlocks(parsed.sdr || []);
          setCloserBlocks(parsed.closer || []);
        }
      } catch {}

      if (!companyId || !userId) { setLoading(false); return; }

      // 1) rotina pessoal
      const { data: personal } = await supabase
        .from("prospeccao_smart_routines")
        .select("id, config, sdr_blocks, closer_blocks")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .eq("is_template", false)
        .maybeSingle();

      if (cancelled) return;

      let hasPersonalSdr = false;
      let hasPersonalCloser = false;

      if (personal) {
        setRecordId(personal.id);
        if (personal.config && Object.keys(personal.config as any).length) {
          setConfig({ ...DEFAULT_CONFIG, ...(personal.config as any) });
        }
        if (Array.isArray(personal.sdr_blocks) && (personal.sdr_blocks as any[]).length) {
          setSdrBlocks(personal.sdr_blocks as any);
          hasPersonalSdr = true;
        }
        if (Array.isArray(personal.closer_blocks) && (personal.closer_blocks as any[]).length) {
          setCloserBlocks(personal.closer_blocks as any);
          hasPersonalCloser = true;
        }
      } else {
        setRecordId(null);
      }

      // 2) fallback: templates da empresa por papel
      if (!hasPersonalSdr || !hasPersonalCloser) {
        const { data: tpls } = await supabase
          .from("prospeccao_smart_routines")
          .select("template_role, sdr_blocks, closer_blocks, config")
          .eq("company_id", companyId)
          .eq("is_template", true);

        if (cancelled) return;
        if (tpls && tpls.length) {
          const sdrTpl = tpls.find((t: any) => t.template_role === "sdr");
          const closerTpl = tpls.find((t: any) => t.template_role === "closer");
          if (!hasPersonalSdr && sdrTpl && Array.isArray(sdrTpl.sdr_blocks) && (sdrTpl.sdr_blocks as any[]).length) {
            setSdrBlocks(sdrTpl.sdr_blocks as any);
            setUsedTemplate((u) => ({ ...u, sdr: true }));
          }
          if (!hasPersonalCloser && closerTpl && Array.isArray(closerTpl.closer_blocks) && (closerTpl.closer_blocks as any[]).length) {
            setCloserBlocks(closerTpl.closer_blocks as any);
            setUsedTemplate((u) => ({ ...u, closer: true }));
          }
          // Se ainda não tem config pessoal, herda do template SDR (mais completo)
          if (!personal && sdrTpl?.config && Object.keys(sdrTpl.config as any).length) {
            setConfig({ ...DEFAULT_CONFIG, ...(sdrTpl.config as any) });
          }
        }
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId, userId]);

  const update = (k: keyof Config, v: any) => setConfig((c) => ({ ...c, [k]: v }));

  // ===== CÁLCULOS =====
  const metrics = useMemo(() => {
    const vendasMes = Math.ceil(config.metaFaturamento / Math.max(1, config.ticketMedio));
    const vendasDia = Math.ceil(vendasMes / Math.max(1, config.diasUteis));
    const reunioesMes = Math.ceil(vendasMes / Math.max(0.01, config.taxaConversao / 100));
    const reunioesDia = Math.ceil(reunioesMes / Math.max(1, config.diasUteis));
    const respostasDia = Math.ceil(reunioesDia / Math.max(0.01, config.taxaRespostaReuniao / 100));
    const leadsDia = Math.ceil(respostasDia / Math.max(0.01, config.taxaLeadResposta / 100));

    // Por SDR
    const leadsPorSdr = Math.ceil(leadsDia / Math.max(1, config.sdrCount));
    const reunioesPorCloser = Math.ceil(reunioesDia / Math.max(1, config.closerCount));

    // Capacidade Closer
    const minDisponiveis = config.closerHoras * 60 - 60; // -1h pausa
    const capacidadeReunioes = Math.floor(minDisponiveis / Math.max(15, config.tempoReuniaoMin));
    const sobrecarga = reunioesPorCloser > capacidadeReunioes;

    return { vendasMes, vendasDia, reunioesMes, reunioesDia, respostasDia, leadsDia, leadsPorSdr, reunioesPorCloser, capacidadeReunioes, sobrecarga };
  }, [config]);

  // ===== GERADOR DE ROTINA =====
  const buildSdrRoutine = (): RoutineBlock[] => {
    const blocks: RoutineBlock[] = [];
    const fim = addMin(config.sdrInicio, config.sdrHoras * 60);

    // KickStart 20min
    blocks.push({ id: crypto.randomUUID(), startTime: config.sdrInicio, endTime: addMin(config.sdrInicio, 20),
      title: "KickStart + Review", type: "organizacao",
      description: "Revisão de metas do dia, leads prioritários, ajuste de mindset.",
      goal: `Definir 3 objetivos do dia` });

    // Confirmação reuniões 20min
    let cursor = addMin(config.sdrInicio, 20);
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: addMin(cursor, 20),
      title: "Follow-up + Confirmação", type: "followup",
      description: "Confirmar reuniões agendadas e responder leads quentes." });
    cursor = addMin(cursor, 20);

    // Bloco Hora de Ouro 1 — até 11:40 ou pré-almoço
    const horaOuro1Fim = addMin(cursor, Math.max(60, diffMin(cursor, config.sdrAlmocoInicio) - 20));
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: horaOuro1Fim,
      title: "Prospectar (Hora de Ouro)", type: "execucao",
      description: `Abordagens via ${config.sdrCanal.toUpperCase()}. Foco em volume e qualidade.`,
      goal: `${Math.ceil(metrics.leadsPorSdr * 0.5)} leads abordados` });
    cursor = horaOuro1Fim;

    // Pesquisa ativação 20min antes do almoço
    if (diffMin(cursor, config.sdrAlmocoInicio) >= 20) {
      blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: config.sdrAlmocoInicio,
        title: "Pesquisa de Ativação", type: "organizacao",
        description: "Construção de lista, enriquecimento de leads, pesquisa de ICP." });
    }

    // Almoço
    blocks.push({ id: crypto.randomUUID(), startTime: config.sdrAlmocoInicio, endTime: config.sdrAlmocoFim,
      title: "Almoço", type: "pausa", description: "Reset mental. Saia da tela." });
    cursor = config.sdrAlmocoFim;

    // Treinamento/Role Play 30min
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: addMin(cursor, 30),
      title: "Treinamento / Role Play", type: "aprendizado",
      description: "Estudo de objeções, role play de abordagem, escuta de calls." });
    cursor = addMin(cursor, 30);

    // Pesquisa ativação 30min
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: addMin(cursor, 30),
      title: "Pesquisa de Ativação", type: "organizacao",
      description: "Atualizar CRM, segmentar leads para próxima janela." });
    cursor = addMin(cursor, 30);

    // Hora de Ouro 2 — até última hora
    const horaOuro2Fim = addMin(cursor, Math.max(60, diffMin(cursor, fim) - 60));
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: horaOuro2Fim,
      title: "Prospectar (Hora de Ouro)", type: "execucao",
      description: `Segundo bloco de prospecção via ${config.sdrCanal.toUpperCase()}.`,
      goal: `${Math.ceil(metrics.leadsPorSdr * 0.5)} leads abordados` });
    cursor = horaOuro2Fim;

    // Inteligência Comercial até o fim
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: fim,
      title: "Inteligência Comercial", type: "organizacao",
      description: "Análise de KPIs do dia, ajuste de ICP, planejamento de amanhã." });

    return blocks;
  };

  const buildCloserRoutine = (): RoutineBlock[] => {
    const blocks: RoutineBlock[] = [];
    const fim = addMin(config.closerInicio, config.closerHoras * 60);

    blocks.push({ id: crypto.randomUUID(), startTime: config.closerInicio, endTime: addMin(config.closerInicio, 20),
      title: "Pipeline Review", type: "organizacao",
      description: "Revisão de propostas abertas, prioridade do dia, scripts.",
      goal: `Mapear ${metrics.reunioesPorCloser} reuniões` });

    let cursor = addMin(config.closerInicio, 20);
    const reunioesManha = Math.ceil(metrics.reunioesPorCloser / 2);
    const blocoManhaMin = reunioesManha * config.tempoReuniaoMin;
    const fimManha = addMin(cursor, Math.min(blocoManhaMin, diffMin(cursor, config.closerAlmocoInicio)));
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: fimManha,
      title: "Reuniões da Manhã", type: "reuniao",
      description: "Discovery, demos e diagnósticos com leads qualificados.",
      goal: `${reunioesManha} reuniões` });
    cursor = fimManha;

    if (diffMin(cursor, config.closerAlmocoInicio) >= 15) {
      blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: config.closerAlmocoInicio,
        title: "Follow-up de Propostas", type: "followup",
        description: "Acionar decisores, enviar contratos, quebrar objeções por texto." });
    }

    blocks.push({ id: crypto.randomUUID(), startTime: config.closerAlmocoInicio, endTime: config.closerAlmocoFim,
      title: "Almoço", type: "pausa", description: "Reset mental e energia para a tarde." });
    cursor = config.closerAlmocoFim;

    const reunioesTarde = metrics.reunioesPorCloser - reunioesManha;
    const blocoTardeMin = reunioesTarde * config.tempoReuniaoMin;
    const fimTarde = addMin(cursor, Math.min(blocoTardeMin, diffMin(cursor, fim) - 60));
    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: fimTarde,
      title: "Reuniões da Tarde", type: "reuniao",
      description: "Negociação, fechamento, propostas em aberto.",
      goal: `${reunioesTarde} reuniões` });
    cursor = fimTarde;

    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: addMin(cursor, 30),
      title: "Negociação e Fechamento", type: "execucao",
      description: "Calls de fechamento, ajuste fino de propostas, cobrança de respostas." });
    cursor = addMin(cursor, 30);

    blocks.push({ id: crypto.randomUUID(), startTime: cursor, endTime: fim,
      title: "Atualização CRM + Pipeline", type: "organizacao",
      description: "Atualizar etapa, próximo passo e data de follow-up de cada deal." });

    return blocks;
  };

  const handleGenerate = (role: Role) => {
    if (role === "sdr") setSdrBlocks(buildSdrRoutine());
    else setCloserBlocks(buildCloserRoutine());
    toast.success(`Rotina ${role === "sdr" ? "do SDR" : "do Closer"} gerada com base na sua meta.`);
  };

  const handleSave = async () => {
    // Cache local imediato
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(ROUTINE_KEY, JSON.stringify({ sdr: sdrBlocks, closer: closerBlocks }));

    if (!companyId || !userId) {
      toast.error("Usuário/empresa não identificados. Faça login novamente.");
      return;
    }

    const payload = {
      company_id: companyId,
      user_id: userId,
      config: config as any,
      sdr_blocks: sdrBlocks as any,
      closer_blocks: closerBlocks as any,
    };

    const { data, error } = await supabase
      .from("prospeccao_smart_routines")
      .upsert(payload, { onConflict: "company_id,user_id" })
      .select("id")
      .single();

    if (error) {
      console.error("[RotinaInteligente] save error", error);
      toast.error("Erro ao salvar rotina: " + error.message);
      return;
    }
    if (data?.id) setRecordId(data.id);
    setUsedTemplate({ sdr: false, closer: false });
    toast.success("Configuração e rotinas salvas (pessoal).");
  };

  const handleSaveAsTemplate = async (role: Role) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem definir a rotina padrão da equipe.");
      return;
    }
    if (!companyId || !userId) {
      toast.error("Empresa não identificada.");
      return;
    }
    const blocksToSave = role === "sdr" ? sdrBlocks : closerBlocks;
    if (!blocksToSave.length) {
      toast.error("Gere ou adicione blocos antes de salvar o template.");
      return;
    }

    // upsert manual: busca existente do template, depois insere/atualiza
    const { data: existing } = await supabase
      .from("prospeccao_smart_routines")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_template", true)
      .eq("template_role", role)
      .maybeSingle();

    const payload: any = {
      company_id: companyId,
      user_id: userId,
      is_template: true,
      template_role: role,
      config: config as any,
      sdr_blocks: role === "sdr" ? (sdrBlocks as any) : ([] as any),
      closer_blocks: role === "closer" ? (closerBlocks as any) : ([] as any),
    };

    const { error } = existing
      ? await supabase.from("prospeccao_smart_routines").update(payload).eq("id", existing.id)
      : await supabase.from("prospeccao_smart_routines").insert(payload);

    if (error) {
      console.error("[RotinaInteligente] template save error", error);
      toast.error("Erro ao salvar template: " + error.message);
      return;
    }
    toast.success(`Template ${role === "sdr" ? "do SDR" : "do Closer"} salvo para toda a equipe.`);
  };

  const updateBlock = (role: Role, id: string, patch: Partial<RoutineBlock>) => {
    const setter = role === "sdr" ? setSdrBlocks : setCloserBlocks;
    setter((bs) => bs.map((b) => b.id === id ? { ...b, ...patch } : b));
  };
  const removeBlock = (role: Role, id: string) => {
    const setter = role === "sdr" ? setSdrBlocks : setCloserBlocks;
    setter((bs) => bs.filter((b) => b.id !== id));
  };
  const addBlock = (role: Role) => {
    const list = role === "sdr" ? sdrBlocks : closerBlocks;
    const last = list[list.length - 1];
    const start = last ? last.endTime : "09:00";
    const novo: RoutineBlock = {
      id: crypto.randomUUID(), startTime: start, endTime: addMin(start, 30),
      title: "Novo bloco", type: "execucao", description: ""
    };
    const setter = role === "sdr" ? setSdrBlocks : setCloserBlocks;
    setter((bs) => [...bs, novo]);
  };

  const blocks = activeRole === "sdr" ? sdrBlocks : closerBlocks;

  // Período do dia
  const periodOf = (time: string) => {
    const [h] = time.split(":").map(Number);
    if (h < 12) return { label: "Manhã", icon: Sun };
    if (h < 14) return { label: "Meio-dia", icon: CloudSun };
    if (h < 18) return { label: "Tarde", icon: Sunset };
    return { label: "Noite", icon: Moon };
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Brain className="h-6 w-6 text-primary" />
            Motor de Rotina Inteligente
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sistema de disciplina comercial — gera rotinas dinâmicas baseadas na sua meta, capacidade e canais.
            Não é agenda fixa: é máquina de previsibilidade.
          </p>
        </CardHeader>
      </Card>

      {/* INPUTS DA EMPRESA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-500" /> Configuração da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Meta de Faturamento (R$/mês)</Label>
            <Input type="number" value={config.metaFaturamento} onChange={(e) => update("metaFaturamento", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ticket Médio (R$)</Label>
            <Input type="number" value={config.ticketMedio} onChange={(e) => update("ticketMedio", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Taxa Conversão Reunião → Venda (%)</Label>
            <Input type="number" value={config.taxaConversao} onChange={(e) => update("taxaConversao", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dias úteis no mês</Label>
            <Input type="number" value={config.diasUteis} onChange={(e) => update("diasUteis", Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      {/* CÁLCULOS AUTOMÁTICOS */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" /> Cálculo Automático — O que sua meta exige
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Vendas/mês", value: metrics.vendasMes },
              { label: "Vendas/dia", value: metrics.vendasDia },
              { label: "Reuniões/dia", value: metrics.reunioesDia },
              { label: "Respostas/dia", value: metrics.respostasDia },
              { label: "Leads/dia (total)", value: metrics.leadsDia },
              { label: "Leads/SDR/dia", value: metrics.leadsPorSdr, highlight: true },
            ].map((m) => (
              <div key={m.label} className={`p-3 rounded-lg border ${m.highlight ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
          {metrics.sobrecarga && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">Sobrecarga detectada no Closer</p>
                <p className="text-muted-foreground">
                  Sua meta exige <b>{metrics.reunioesPorCloser} reuniões/closer/dia</b>, mas a capacidade real é <b>{metrics.capacidadeReunioes}</b>.
                  Aumente o time, reduza o tempo médio de reunião ou ajuste a meta.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso de escopo / fonte da rotina */}
      {(usedTemplate.sdr || usedTemplate.closer) && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span>
            Você está vendo a <b>rotina padrão da equipe</b>
            {usedTemplate.sdr && usedTemplate.closer ? " (SDR e Closer)"
              : usedTemplate.sdr ? " (SDR)" : " (Closer)"}.
            Edite e clique em <b>Salvar configuração</b> para criar a sua versão pessoal.
          </span>
        </div>
      )}

      {/* TABS SDR / CLOSER */}
      <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as Role)}>
        <TabsList>
          <TabsTrigger value="sdr">🎯 Rotina do SDR</TabsTrigger>
          <TabsTrigger value="closer">💼 Rotina do Closer</TabsTrigger>
        </TabsList>

        {/* SDR CONFIG */}
        <TabsContent value="sdr" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Parâmetros do SDR</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Nº de SDRs</Label>
                <Input type="number" value={config.sdrCount} onChange={(e) => update("sdrCount", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horas disponíveis/dia</Label>
                <Input type="number" value={config.sdrHoras} onChange={(e) => update("sdrHoras", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Canal Principal</Label>
                <Select value={config.sdrCanal} onValueChange={(v) => update("sdrCanal", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nível</Label>
                <Select value={config.sdrNivel} onValueChange={(v) => update("sdrNivel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iniciante">Iniciante</SelectItem>
                    <SelectItem value="intermediario">Intermediário</SelectItem>
                    <SelectItem value="avancado">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Início do expediente</Label>
                <Input type="time" value={config.sdrInicio} onChange={(e) => update("sdrInicio", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Almoço — início</Label>
                <Input type="time" value={config.sdrAlmocoInicio} onChange={(e) => update("sdrAlmocoInicio", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Almoço — fim</Label>
                <Input type="time" value={config.sdrAlmocoFim} onChange={(e) => update("sdrAlmocoFim", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa Lead → Resposta (%)</Label>
                <Input type="number" value={config.taxaLeadResposta} onChange={(e) => update("taxaLeadResposta", Number(e.target.value))} />
              </div>
            </CardContent>
          </Card>

          <RotinaTimeline
            role="sdr"
            blocks={sdrBlocks}
            onGenerate={() => handleGenerate("sdr")}
            onAdd={() => addBlock("sdr")}
            onUpdate={(id, patch) => updateBlock("sdr", id, patch)}
            onRemove={(id) => removeBlock("sdr", id)}
            metricsTop={[
              { label: "Leads/dia", value: metrics.leadsPorSdr },
              { label: "Abordagens/dia", value: metrics.leadsPorSdr },
              { label: "Reuniões/dia (time)", value: metrics.reunioesDia },
            ]}
          />
        </TabsContent>

        {/* CLOSER CONFIG */}
        <TabsContent value="closer" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Parâmetros do Closer</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Nº de Closers</Label>
                <Input type="number" value={config.closerCount} onChange={(e) => update("closerCount", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horas disponíveis/dia</Label>
                <Input type="number" value={config.closerHoras} onChange={(e) => update("closerHoras", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tempo médio de reunião (min)</Label>
                <Input type="number" value={config.tempoReuniaoMin} onChange={(e) => update("tempoReuniaoMin", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa de fechamento (%)</Label>
                <Input type="number" value={config.taxaFechamento} onChange={(e) => update("taxaFechamento", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Início do expediente</Label>
                <Input type="time" value={config.closerInicio} onChange={(e) => update("closerInicio", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Almoço — início</Label>
                <Input type="time" value={config.closerAlmocoInicio} onChange={(e) => update("closerAlmocoInicio", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Almoço — fim</Label>
                <Input type="time" value={config.closerAlmocoFim} onChange={(e) => update("closerAlmocoFim", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <RotinaTimeline
            role="closer"
            blocks={closerBlocks}
            onGenerate={() => handleGenerate("closer")}
            onAdd={() => addBlock("closer")}
            onUpdate={(id, patch) => updateBlock("closer", id, patch)}
            onRemove={(id) => removeBlock("closer", id)}
            metricsTop={[
              { label: "Reuniões/dia", value: metrics.reunioesPorCloser },
              { label: "Capacidade real", value: metrics.capacidadeReunioes },
              { label: "Vendas/dia (time)", value: metrics.vendasDia },
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* AÇÕES GLOBAIS */}
      <div className="flex justify-end gap-2 sticky bottom-2 flex-wrap">
        <Button variant="outline" onClick={() => { setConfig(DEFAULT_CONFIG); toast.info("Padrões restaurados."); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Restaurar padrões
        </Button>
        {isAdmin && (
          <>
            <Button
              variant="secondary"
              onClick={() => handleSaveAsTemplate("sdr")}
              title="Define a rotina padrão dos SDRs da empresa"
            >
              <Sparkles className="h-4 w-4 mr-1" /> Salvar como padrão SDR (equipe)
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSaveAsTemplate("closer")}
              title="Define a rotina padrão dos Closers da empresa"
            >
              <Sparkles className="h-4 w-4 mr-1" /> Salvar como padrão Closer (equipe)
            </Button>
          </>
        )}
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" /> Salvar minha rotina
        </Button>
      </div>

      {isAdmin && (
        <p className="text-[11px] text-muted-foreground -mt-3 text-right">
          Como admin, você pode salvar a rotina atual como <b>padrão da equipe</b> por papel (SDR/Closer). Cada usuário ainda pode personalizar a sua.
        </p>
      )}

      {/* FILOSOFIA */}
      <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-l-4 border-l-emerald-500">
        <CardContent className="p-4 text-sm text-muted-foreground italic">
          "Consistência gera previsibilidade. Sem volume, não existe venda. Esta rotina não é uma agenda — é o seu motor de execução."
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// TIMELINE COMPONENT
// ============================================
function RotinaTimeline({
  role, blocks, onGenerate, onAdd, onUpdate, onRemove, metricsTop
}: {
  role: Role;
  blocks: RoutineBlock[];
  onGenerate: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<RoutineBlock>) => void;
  onRemove: (id: string) => void;
  metricsTop: { label: string; value: number }[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Rotina {role === "sdr" ? "do SDR" : "do Closer"}
          </CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap">
            {metricsTop.map((m) => (
              <Badge key={m.label} variant="secondary" className="text-xs">
                {m.label}: <span className="font-bold ml-1">{m.value}</span>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" /> Bloco
          </Button>
          <Button size="sm" onClick={onGenerate}>
            <Brain className="h-4 w-4 mr-1" /> Gerar com IA da meta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum bloco ainda. Clique em <b>"Gerar com IA da meta"</b> para criar uma rotina inicial baseada nos seus inputs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((b) => {
              const style = BLOCK_STYLES[b.type];
              const Icon = style.icon;
              const dur = diffMin(b.startTime, b.endTime);
              return (
                <div key={b.id} className={`rounded-lg border-l-4 ${style.border} ${style.bg} p-3 flex gap-3`}>
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 flex-shrink-0" />
                  <div className="flex flex-col items-center gap-1 min-w-[80px] pt-1">
                    <Input type="time" value={b.startTime} onChange={(e) => onUpdate(b.id, { startTime: e.target.value })}
                      className="h-7 text-xs w-[80px]" />
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <Input type="time" value={b.endTime} onChange={(e) => onUpdate(b.id, { endTime: e.target.value })}
                      className="h-7 text-xs w-[80px]" />
                    <span className="text-[10px] text-muted-foreground">{dur}min</span>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <Input value={b.title} onChange={(e) => onUpdate(b.id, { title: e.target.value })}
                        className="h-7 font-semibold flex-1 min-w-[150px]" />
                      <Select value={b.type} onValueChange={(v) => onUpdate(b.id, { type: v as BlockType })}>
                        <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(BLOCK_STYLES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input value={b.description} onChange={(e) => onUpdate(b.id, { description: e.target.value })}
                      placeholder="Descrição da atividade..."
                      className="h-7 text-xs" />
                    {b.goal && (
                      <Badge variant="outline" className="text-xs">
                        <Target className="h-3 w-3 mr-1" /> Meta: {b.goal}
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {/* Resumo do dia */}
            <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                {Object.entries(BLOCK_STYLES).map(([k, v]) => {
                  const total = blocks.filter((b) => b.type === k).reduce((sum, b) => sum + diffMin(b.startTime, b.endTime), 0);
                  if (total === 0) return null;
                  return (
                    <div key={k}>
                      <p className="text-[10px] text-muted-foreground uppercase">{v.label}</p>
                      <p className="text-sm font-bold text-foreground">{Math.floor(total / 60)}h {total % 60}min</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
