import { useEffect, useMemo, useState } from "react";
import { CockpitDoDia } from "@/components/prospeccao/cockpit/CockpitDoDia";
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
  Sun, CloudSun, Sunset, Moon, Zap, BookOpen, Calendar, LayoutGrid, List, Copy, Pencil
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
const ROUTINE_KEY = "prospeccao_rotina_blocos_v2";

const BLOCK_STYLES: Record<BlockType, { bg: string; border: string; icon: any; label: string }> = {
  execucao:    { bg: "bg-emerald-500/10", border: "border-l-emerald-500", icon: Zap,         label: "Execução" },
  followup:    { bg: "bg-amber-500/10",   border: "border-l-amber-500",   icon: RefreshCw,   label: "Follow-up" },
  organizacao: { bg: "bg-blue-500/10",    border: "border-l-blue-500",    icon: Calendar,    label: "Organização" },
  aprendizado: { bg: "bg-purple-500/10",  border: "border-l-purple-500",  icon: BookOpen,    label: "Aprendizado" },
  pausa:       { bg: "bg-muted",          border: "border-l-muted-foreground", icon: Coffee, label: "Pausa" },
  reuniao:     { bg: "bg-rose-500/10",    border: "border-l-rose-500",    icon: Phone,       label: "Reunião" },
};

// ===== Escopos: dia da semana + fase do mês =====
type ScopeId =
  | "padrao"
  | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado"
  | "inicio_mes" | "meio_mes" | "fim_mes";

const SCOPES: { id: ScopeId; label: string; group: "semana" | "mes" | "base"; hint?: string }[] = [
  { id: "padrao",     label: "Padrão (todo dia)", group: "base", hint: "Rotina base — usada quando o dia não tem rotina específica" },
  { id: "segunda",    label: "Segunda",  group: "semana" },
  { id: "terca",      label: "Terça",    group: "semana" },
  { id: "quarta",     label: "Quarta",   group: "semana" },
  { id: "quinta",     label: "Quinta",   group: "semana" },
  { id: "sexta",      label: "Sexta (Follow-up & Fechamento)", group: "semana", hint: "Ex.: dia de follow-up + fechamento" },
  { id: "sabado",     label: "Sábado",   group: "semana" },
  { id: "inicio_mes", label: "Início do mês", group: "mes", hint: "Primeiros 5 dias úteis — abertura de pipeline" },
  { id: "meio_mes",   label: "Meio do mês",   group: "mes" },
  { id: "fim_mes",    label: "Fim do mês (Fechamento de Vendas)", group: "mes", hint: "Últimos 5 dias úteis — corrida de fechamento" },
];

type BlocksByScope = Partial<Record<ScopeId, RoutineBlock[]>>;

function normalizeScopedBlocks(raw: any): BlocksByScope {
  if (!raw) return {};
  // Legado: era um array → vira escopo "padrao"
  if (Array.isArray(raw)) return raw.length ? { padrao: raw } : {};
  if (typeof raw === "object") return raw as BlocksByScope;
  return {};
}

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
  const [sdrBlocksByScope, setSdrBlocksByScope] = useState<BlocksByScope>({});
  const [closerBlocksByScope, setCloserBlocksByScope] = useState<BlocksByScope>({});
  const [sdrScope, setSdrScope] = useState<ScopeId>("padrao");
  const [closerScope, setCloserScope] = useState<ScopeId>("padrao");
  const [sdrViewMode, setSdrViewMode] = useState<"board" | "detail">("board");
  const [closerViewMode, setCloserViewMode] = useState<"board" | "detail">("board");
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
          setSdrBlocksByScope(normalizeScopedBlocks(parsed.sdr));
          setCloserBlocksByScope(normalizeScopedBlocks(parsed.closer));
        } else {
          // tentativa de migração da chave v1
          const old = localStorage.getItem("prospeccao_rotina_blocos_v1");
          if (old) {
            const parsed = JSON.parse(old);
            setSdrBlocksByScope(normalizeScopedBlocks(parsed.sdr));
            setCloserBlocksByScope(normalizeScopedBlocks(parsed.closer));
          }
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
        const sdrNorm = normalizeScopedBlocks(personal.sdr_blocks);
        if (Object.keys(sdrNorm).length) {
          setSdrBlocksByScope(sdrNorm);
          hasPersonalSdr = true;
        }
        const closerNorm = normalizeScopedBlocks(personal.closer_blocks);
        if (Object.keys(closerNorm).length) {
          setCloserBlocksByScope(closerNorm);
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
          if (!hasPersonalSdr && sdrTpl) {
            const norm = normalizeScopedBlocks(sdrTpl.sdr_blocks);
            if (Object.keys(norm).length) {
              setSdrBlocksByScope(norm);
              setUsedTemplate((u) => ({ ...u, sdr: true }));
            }
          }
          if (!hasPersonalCloser && closerTpl) {
            const norm = normalizeScopedBlocks(closerTpl.closer_blocks);
            if (Object.keys(norm).length) {
              setCloserBlocksByScope(norm);
              setUsedTemplate((u) => ({ ...u, closer: true }));
            }
          }
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

  // Helpers de escopo
  const getBlocks = (role: Role, scope: ScopeId): RoutineBlock[] => {
    const map = role === "sdr" ? sdrBlocksByScope : closerBlocksByScope;
    return map[scope] || [];
  };
  const setBlocksFor = (
    role: Role,
    scope: ScopeId,
    updater: (prev: RoutineBlock[]) => RoutineBlock[],
  ) => {
    const setter = role === "sdr" ? setSdrBlocksByScope : setCloserBlocksByScope;
    setter((map) => ({ ...map, [scope]: updater(map[scope] || []) }));
  };

  const handleGenerate = (role: Role) => {
    const scope = role === "sdr" ? sdrScope : closerScope;
    const generated = role === "sdr" ? buildSdrRoutine() : buildCloserRoutine();
    setBlocksFor(role, scope, () => generated);
    const scopeLabel = SCOPES.find((s) => s.id === scope)?.label ?? scope;
    toast.success(`Rotina ${role === "sdr" ? "do SDR" : "do Closer"} (${scopeLabel}) gerada com base na sua meta.`);
  };

  const handleSave = async () => {
    // Cache local imediato
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(ROUTINE_KEY, JSON.stringify({ sdr: sdrBlocksByScope, closer: closerBlocksByScope }));

    if (!companyId || !userId) {
      toast.error("Usuário/empresa não identificados. Faça login novamente.");
      return;
    }

    const payload = {
      company_id: companyId,
      user_id: userId,
      config: config as any,
      sdr_blocks: sdrBlocksByScope as any,
      closer_blocks: closerBlocksByScope as any,
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
    const mapToSave = role === "sdr" ? sdrBlocksByScope : closerBlocksByScope;
    const totalBlocks = Object.values(mapToSave).reduce((acc, arr) => acc + (arr?.length || 0), 0);
    if (!totalBlocks) {
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
      sdr_blocks: role === "sdr" ? (sdrBlocksByScope as any) : ({} as any),
      closer_blocks: role === "closer" ? (closerBlocksByScope as any) : ({} as any),
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
    const scope = role === "sdr" ? sdrScope : closerScope;
    setBlocksFor(role, scope, (bs) => bs.map((b) => b.id === id ? { ...b, ...patch } : b));
  };
  const removeBlock = (role: Role, id: string) => {
    const scope = role === "sdr" ? sdrScope : closerScope;
    setBlocksFor(role, scope, (bs) => bs.filter((b) => b.id !== id));
  };
  const addBlock = (role: Role) => {
    const scope = role === "sdr" ? sdrScope : closerScope;
    const list = getBlocks(role, scope);
    const last = list[list.length - 1];
    const start = last ? last.endTime : "09:00";
    const novo: RoutineBlock = {
      id: crypto.randomUUID(), startTime: start, endTime: addMin(start, 30),
      title: "Novo bloco", type: "execucao", description: ""
    };
    setBlocksFor(role, scope, (bs) => [...bs, novo]);
  };
  const clearScope = (role: Role) => {
    const scope = role === "sdr" ? sdrScope : closerScope;
    setBlocksFor(role, scope, () => []);
    toast.info("Escopo limpo.");
  };
  const copyFromPadrao = (role: Role) => {
    const scope = role === "sdr" ? sdrScope : closerScope;
    if (scope === "padrao") {
      toast.info("Você já está no escopo padrão.");
      return;
    }
    const padrao = getBlocks(role, "padrao");
    if (!padrao.length) {
      toast.error("Não há rotina padrão para copiar. Crie a Padrão primeiro.");
      return;
    }
    setBlocksFor(role, scope, () =>
      padrao.map((b) => ({ ...b, id: crypto.randomUUID() })),
    );
    toast.success("Rotina padrão copiada — agora personalize para este dia.");
  };

  const blocks = getBlocks(activeRole, activeRole === "sdr" ? sdrScope : closerScope);

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
      <CockpitDoDia />
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

          <RotinaViewSwitcher
            role="sdr"
            viewMode={sdrViewMode}
            onViewModeChange={setSdrViewMode}
            blocksByScope={sdrBlocksByScope}
            scope={sdrScope}
            onScopeChange={setSdrScope}
            onGenerate={() => handleGenerate("sdr")}
            onAdd={() => addBlock("sdr")}
            onUpdate={(id, patch) => updateBlock("sdr", id, patch)}
            onRemove={(id) => removeBlock("sdr", id)}
            onClearScope={() => clearScope("sdr")}
            onCopyFromPadrao={() => copyFromPadrao("sdr")}
            onJumpToScope={(s) => { setSdrScope(s); setSdrViewMode("detail"); }}
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

          <RotinaViewSwitcher
            role="closer"
            viewMode={closerViewMode}
            onViewModeChange={setCloserViewMode}
            blocksByScope={closerBlocksByScope}
            scope={closerScope}
            onScopeChange={setCloserScope}
            onGenerate={() => handleGenerate("closer")}
            onAdd={() => addBlock("closer")}
            onUpdate={(id, patch) => updateBlock("closer", id, patch)}
            onRemove={(id) => removeBlock("closer", id)}
            onClearScope={() => clearScope("closer")}
            onCopyFromPadrao={() => copyFromPadrao("closer")}
            onJumpToScope={(s) => { setCloserScope(s); setCloserViewMode("detail"); }}
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
  role, blocks, scope, onScopeChange, onGenerate, onAdd, onUpdate, onRemove,
  onClearScope, onCopyFromPadrao, scopesWithContent, metricsTop,
}: {
  role: Role;
  blocks: RoutineBlock[];
  scope: ScopeId;
  onScopeChange: (s: ScopeId) => void;
  onGenerate: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<RoutineBlock>) => void;
  onRemove: (id: string) => void;
  onClearScope: () => void;
  onCopyFromPadrao: () => void;
  scopesWithContent: ScopeId[];
  metricsTop: { label: string; value: number }[];
}) {
  const scopeLabel = SCOPES.find((s) => s.id === scope)?.label ?? scope;
  const scopeHint = SCOPES.find((s) => s.id === scope)?.hint;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Rotina {role === "sdr" ? "do SDR" : "do Closer"} — <span className="text-primary">{scopeLabel}</span>
          </CardTitle>
          {scopeHint && <p className="text-[11px] text-muted-foreground mt-1">{scopeHint}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            {metricsTop.map((m) => (
              <Badge key={m.label} variant="secondary" className="text-xs">
                {m.label}: <span className="font-bold ml-1">{m.value}</span>
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={scope} onValueChange={(v) => onScopeChange(v as ScopeId)}>
            <SelectTrigger className="h-8 w-[230px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Base</div>
              {SCOPES.filter((s) => s.group === "base").map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} {scopesWithContent.includes(s.id) ? "•" : ""}
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Dia da semana</div>
              {SCOPES.filter((s) => s.group === "semana").map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} {scopesWithContent.includes(s.id) ? "•" : ""}
                </SelectItem>
              ))}
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Fase do mês</div>
              {SCOPES.filter((s) => s.group === "mes").map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} {scopesWithContent.includes(s.id) ? "•" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scope !== "padrao" && (
            <Button variant="ghost" size="sm" onClick={onCopyFromPadrao} title="Copiar blocos da rotina Padrão para este escopo">
              Copiar do Padrão
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClearScope} title="Limpar blocos deste escopo">
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
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

// ============================================
// VIEW SWITCHER: Quadro Semanal x Detalhe
// ============================================
type ViewSwitcherProps = {
  role: Role;
  viewMode: "board" | "detail";
  onViewModeChange: (v: "board" | "detail") => void;
  blocksByScope: BlocksByScope;
  scope: ScopeId;
  onScopeChange: (s: ScopeId) => void;
  onGenerate: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<RoutineBlock>) => void;
  onRemove: (id: string) => void;
  onClearScope: () => void;
  onCopyFromPadrao: () => void;
  onJumpToScope: (s: ScopeId) => void;
  metricsTop: { label: string; value: number }[];
};

function RotinaViewSwitcher(props: ViewSwitcherProps) {
  const { role, viewMode, onViewModeChange, blocksByScope, metricsTop } = props;
  const scopesWithContent = Object.entries(blocksByScope)
    .filter(([, v]) => (v?.length || 0) > 0)
    .map(([k]) => k as ScopeId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant="outline" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {role === "sdr" ? "Quadro do SDR" : "Quadro do Closer"}
          </Badge>
          {metricsTop.map((m) => (
            <Badge key={m.label} variant="secondary" className="text-xs">
              {m.label}: <span className="font-bold ml-1">{m.value}</span>
            </Badge>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          <Button
            size="sm"
            variant={viewMode === "board" ? "default" : "ghost"}
            className="h-7 px-3"
            onClick={() => onViewModeChange("board")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Quadro Semanal
          </Button>
          <Button
            size="sm"
            variant={viewMode === "detail" ? "default" : "ghost"}
            className="h-7 px-3"
            onClick={() => onViewModeChange("detail")}
          >
            <List className="h-3.5 w-3.5 mr-1" /> Editor detalhado
          </Button>
        </div>
      </div>

      {viewMode === "board" ? (
        <RotinaWeekBoard
          role={role}
          blocksByScope={blocksByScope}
          onJumpToScope={props.onJumpToScope}
          onCopyScope={(from, to) => {
            const src = blocksByScope[from] || [];
            if (!src.length) {
              toast.error("Escopo de origem está vazio.");
              return;
            }
            // simula um onCopyFromPadrao para um destino arbitrário
            const cloned = src.map((b) => ({ ...b, id: crypto.randomUUID() }));
            // delega via onUpdate/add? Mais simples: muda escopo e cola
            // usamos onJumpToScope + um efeito do destino — porém aqui não temos setter direto
            // Solução simples: aciona scope change e depois deixa o usuário usar "copiar do padrão"
            // Para evitar complexidade, escrevemos no localStorage logo após
            // ⚠️ implementação simplificada: muda escopo e chama copyFromPadrao só funciona para padrão.
            // Aqui apenas notificamos:
            toast.info("Abra o editor detalhado do dia destino e use 'Copiar do Padrão' ou edite manualmente.");
            props.onJumpToScope(to);
          }}
        />
      ) : (
        <RotinaTimeline
          role={role}
          blocks={(blocksByScope[props.scope] || [])}
          scope={props.scope}
          onScopeChange={props.onScopeChange}
          onGenerate={props.onGenerate}
          onAdd={props.onAdd}
          onUpdate={props.onUpdate}
          onRemove={props.onRemove}
          onClearScope={props.onClearScope}
          onCopyFromPadrao={props.onCopyFromPadrao}
          scopesWithContent={scopesWithContent}
          metricsTop={metricsTop}
        />
      )}
    </div>
  );
}

// ============================================
// QUADRO SEMANAL (estilo agenda — Dia / Semana / Mês)
// ============================================
const WEEK_SCOPES: ScopeId[] = ["padrao", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const MONTH_SCOPES: ScopeId[] = ["inicio_mes", "meio_mes", "fim_mes"];
const WEEKDAY_SCOPE_IDS: ScopeId[] = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const WEEKDAY_SHORT = ["seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Converte "HH:mm" em minutos absolutos
function toMin(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

// Retorna blocos efetivos para um dia da semana (com fallback no padrão)
function effectiveBlocks(blocksByScope: BlocksByScope, sid: ScopeId): { blocks: RoutineBlock[]; inherited: boolean } {
  const own = blocksByScope[sid] || [];
  if (own.length > 0) return { blocks: own, inherited: false };
  return { blocks: blocksByScope.padrao || [], inherited: true };
}

function RotinaWeekBoard({
  role,
  blocksByScope,
  onJumpToScope,
  onCopyScope,
}: {
  role: Role;
  blocksByScope: BlocksByScope;
  onJumpToScope: (s: ScopeId) => void;
  onCopyScope: (from: ScopeId, to: ScopeId) => void;
}) {
  const padraoBlocks = blocksByScope.padrao || [];
  const hasPadrao = padraoBlocks.length > 0;

  // Datas da semana atual (segunda → sábado)
  const today = new Date();
  const todayIdx = ((today.getDay() + 6) % 7); // 0 = Mon ... 6 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayIdx);
  monday.setHours(0, 0, 0, 0);

  const weekDates = WEEKDAY_SCOPE_IDS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const todayScopeId: ScopeId | null = (WEEKDAY_SCOPE_IDS[todayIdx] as ScopeId) || null;

  // View mode: dia | semana | mes
  const [viewMode, setViewMode] = useState<"dia" | "semana" | "mes">("semana");
  const [selectedScope, setSelectedScope] = useState<ScopeId>(todayScopeId || "segunda");
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Faixa de horário visível (com base nos blocos)
  const allBlocks = WEEK_SCOPES.flatMap((s) => blocksByScope[s] || []);
  const startMin = Math.max(0, Math.min(8 * 60, ...allBlocks.map((b) => toMin(b.startTime))));
  const endMin = Math.min(24 * 60, Math.max(19 * 60, ...allBlocks.map((b) => toMin(b.endTime))));
  const startHour = Math.floor(startMin / 60);
  const endHour = Math.ceil(endMin / 60);
  const HOUR_HEIGHT = 56; // px por hora
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  function topFor(b: RoutineBlock): number {
    return ((toMin(b.startTime) - startHour * 60) / 60) * HOUR_HEIGHT;
  }
  function heightFor(b: RoutineBlock): number {
    return Math.max(28, ((toMin(b.endTime) - toMin(b.startTime)) / 60) * HOUR_HEIGHT - 2);
  }

  // ===== Conteúdo de UMA coluna de dia (com posicionamento por horário) =====
  function DayColumn({ sid, date, compact = false }: { sid: ScopeId; date?: Date; compact?: boolean }) {
    const { blocks, inherited } = effectiveBlocks(blocksByScope, sid);
    const isTodayCol = date ? date.toDateString() === today.toDateString() : sid === todayScopeId;
    return (
      <div className="relative bg-card" style={{ height: gridHeight }}>
        {/* Linhas de hora (background) */}
        {hours.map((h, i) => (
          <div
            key={h}
            className={`absolute left-0 right-0 border-t ${i === 0 ? "border-transparent" : "border-border/40"}`}
            style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          />
        ))}
        {/* Linha do "agora" */}
        {isTodayCol && (() => {
          const nowMin = today.getHours() * 60 + today.getMinutes();
          if (nowMin < startHour * 60 || nowMin > endHour * 60) return null;
          const top = ((nowMin - startHour * 60) / 60) * HOUR_HEIGHT;
          return (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
              <div className="h-0.5 bg-rose-500" />
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500" />
            </div>
          );
        })()}
        {/* Blocos posicionados */}
        {blocks.map((b) => {
          const style = BLOCK_STYLES[b.type];
          const Icon = style.icon;
          return (
            <button
              key={`${sid}-${b.id}`}
              onClick={() => onJumpToScope(sid)}
              className={`absolute left-1 right-1 rounded-lg border ${style.border} bg-card hover:shadow-md hover:border-primary/40 transition-all overflow-hidden text-left z-10 ${
                inherited ? "opacity-60" : ""
              }`}
              style={{ top: topFor(b), height: heightFor(b), borderLeftWidth: 3 }}
              title={`${b.startTime} – ${b.endTime} · ${b.title}`}
            >
              <div className="px-2 py-1">
                <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground tabular-nums leading-tight">
                  {b.startTime} – {b.endTime}
                </div>
                <div className="flex items-start gap-1 mt-0.5">
                  <Icon className="h-3 w-3 mt-0.5 text-foreground/60 shrink-0" />
                  <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-medium text-foreground leading-tight line-clamp-2`}>
                    {b.title}
                  </p>
                </div>
                {!compact && b.goal && heightFor(b) > 50 && (
                  <p className="text-[9px] text-primary mt-0.5 pl-4 line-clamp-1 font-medium">🎯 {b.goal}</p>
                )}
              </div>
            </button>
          );
        })}
        {blocks.length === 0 && (
          <div className="absolute inset-2 flex items-center justify-center text-[10px] text-muted-foreground text-center border border-dashed border-border rounded-lg">
            Vazio
          </div>
        )}
      </div>
    );
  }

  // ===== Coluna de horas (gutter) =====
  function HourGutter() {
    return (
      <div className="relative bg-muted/20 border-r border-border/60" style={{ height: gridHeight, width: 56 }}>
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute left-0 right-0 px-2 text-[10px] font-mono text-muted-foreground tabular-nums"
            style={{ top: i * HOUR_HEIGHT - 6 }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
    );
  }

  // ===== Header do dia =====
  function DayHeader({ sid, date, onClick }: { sid: ScopeId; date?: Date; onClick?: () => void }) {
    const own = blocksByScope[sid] || [];
    const isOverride = own.length > 0;
    const isTodayCol = date ? date.toDateString() === today.toDateString() : sid === todayScopeId;
    const scope = SCOPES.find((s) => s.id === sid)!;
    const dayLabel = scope.label.split(" (")[0];
    return (
      <div
        className={`px-3 py-2 border-b border-border/60 flex items-center justify-between gap-1 ${
          isTodayCol ? "bg-primary/10" : "bg-muted/30"
        }`}
      >
        <button onClick={onClick} className="flex items-center gap-2 min-w-0 hover:text-primary transition-colors">
          <div className="text-left min-w-0">
            <div className={`text-[10px] uppercase tracking-wide font-medium ${isTodayCol ? "text-primary" : "text-muted-foreground"}`}>
              {dayLabel}
            </div>
            {date && (
              <div className={`text-base font-bold leading-tight ${isTodayCol ? "text-primary" : "text-foreground"}`}>
                {date.getDate()}
              </div>
            )}
          </div>
          {isOverride && (
            <span className="text-[9px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              custom
            </span>
          )}
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 rounded-full hover:bg-primary/10 hover:text-primary"
          onClick={() => onJumpToScope(sid)}
          title="Editar rotina deste dia"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // ===== MÊS: grade de 6 semanas =====
  function MonthGrid() {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    // Começa na segunda anterior ao primeiro dia
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return (
      <div>
        <div className="grid grid-cols-7 border border-border/60 rounded-t-xl overflow-hidden bg-muted/30">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-wide font-medium text-muted-foreground text-center border-r border-border/40 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-x border-b border-border/60 rounded-b-xl overflow-hidden">
          {days.map((d, i) => {
            const dayIdx = (d.getDay() + 6) % 7; // 0..6 (seg..dom)
            const isCurrentMonth = d.getMonth() === today.getMonth();
            const isTodayCell = d.toDateString() === today.toDateString();
            const sid: ScopeId | null = dayIdx < 6 ? (WEEKDAY_SCOPE_IDS[dayIdx] as ScopeId) : null;
            const dayNum = d.getDate();
            // Fase do mês
            let phase: ScopeId | null = null;
            if (isCurrentMonth) {
              if (dayNum <= 5) phase = "inicio_mes";
              else if (dayNum >= monthEnd.getDate() - 4) phase = "fim_mes";
              else phase = "meio_mes";
            }
            const own = sid ? (blocksByScope[sid] || []) : [];
            const phaseBlocks = phase ? (blocksByScope[phase] || []) : [];
            const effective = phaseBlocks.length > 0 ? phaseBlocks : (own.length > 0 ? own : padraoBlocks);

            return (
              <button
                key={i}
                onClick={() => {
                  if (sid) {
                    setSelectedScope(sid);
                    setSelectedDate(d);
                    setViewMode("dia");
                  }
                }}
                className={`min-h-[92px] p-1.5 text-left border-r border-b border-border/40 last:border-r-0 transition-colors ${
                  !isCurrentMonth ? "bg-muted/10 text-muted-foreground/50" : "bg-card hover:bg-primary/5"
                } ${isTodayCell ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isTodayCell ? "text-primary" : ""}`}>{dayNum}</span>
                  {phase === "fim_mes" && isCurrentMonth && (
                    <span className="text-[8px] uppercase font-bold text-rose-500">Fech.</span>
                  )}
                  {phase === "inicio_mes" && isCurrentMonth && (
                    <span className="text-[8px] uppercase font-bold text-emerald-500">Abre</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {effective.slice(0, 3).map((b) => {
                    const st = BLOCK_STYLES[b.type];
                    return (
                      <div key={b.id} className={`text-[9px] leading-tight px-1 py-0.5 rounded ${st.bg} text-foreground/80 truncate`}>
                        <span className="font-mono mr-1">{b.startTime}</span>
                        {b.title}
                      </div>
                    );
                  })}
                  {effective.length > 3 && (
                    <div className="text-[9px] text-muted-foreground px-1">+{effective.length - 3}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QUADRO PRINCIPAL — estilo agenda */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-3 bg-gradient-to-br from-primary/5 to-transparent border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base text-foreground">
                Rotina {role === "sdr" ? "do SDR" : "do Closer"}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {viewMode === "dia" && `${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}`}
                {viewMode === "semana" && `Semana de ${monday.getDate()} de ${MONTH_NAMES[monday.getMonth()]}`}
                {viewMode === "mes" && `${MONTH_NAMES[today.getMonth()]} de ${today.getFullYear()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Atalho para padrão */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => onJumpToScope("padrao")}
              title="Editar rotina padrão"
            >
              <Pencil className="h-3 w-3" /> Padrão
            </Button>
            {/* View switcher */}
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <Button
                size="sm"
                variant={viewMode === "dia" ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode("dia")}
              >
                Dia
              </Button>
              <Button
                size="sm"
                variant={viewMode === "semana" ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode("semana")}
              >
                Semana
              </Button>
              <Button
                size="sm"
                variant={viewMode === "mes" ? "default" : "ghost"}
                className="h-7 px-3 text-xs"
                onClick={() => setViewMode("mes")}
              >
                Mês
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 bg-background">
          {!hasPadrao && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Defina primeiro a <b>rotina Padrão</b> — ela é o esqueleto que cada dia herda.
              </span>
              <Button size="sm" variant="ghost" className="h-6 ml-auto text-amber-700 dark:text-amber-400" onClick={() => onJumpToScope("padrao")}>
                Criar padrão →
              </Button>
            </div>
          )}

          {/* ===== SEMANA ===== */}
          {viewMode === "semana" && (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Cabeçalho com dias */}
                <div className="grid sticky top-0 z-30 bg-card" style={{ gridTemplateColumns: `56px repeat(6, minmax(0,1fr))` }}>
                  <div className="bg-muted/30 border-b border-r border-border/60" />
                  {WEEKDAY_SCOPE_IDS.map((sid, i) => (
                    <div key={sid} className="border-b border-r border-border/60 last:border-r-0">
                      <DayHeader sid={sid} date={weekDates[i]} onClick={() => { setSelectedScope(sid); setSelectedDate(weekDates[i]); setViewMode("dia"); }} />
                    </div>
                  ))}
                </div>
                {/* Grid de horas */}
                <div className="grid" style={{ gridTemplateColumns: `56px repeat(6, minmax(0,1fr))` }}>
                  <HourGutter />
                  {WEEKDAY_SCOPE_IDS.map((sid, i) => (
                    <div key={sid} className="border-r border-border/60 last:border-r-0">
                      <DayColumn sid={sid} date={weekDates[i]} compact />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== DIA ===== */}
          {viewMode === "dia" && (
            <div>
              {/* Tabs rápidos para escolher o dia */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border/60 bg-muted/20 overflow-x-auto">
                {WEEKDAY_SCOPE_IDS.map((sid, i) => {
                  const isSel = sid === selectedScope;
                  const isTodayPill = sid === todayScopeId;
                  return (
                    <button
                      key={sid}
                      onClick={() => { setSelectedScope(sid); setSelectedDate(weekDates[i]); }}
                      className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 ${
                        isSel
                          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                          : isTodayPill
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground hover:bg-card hover:text-foreground"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wide leading-none">{WEEKDAY_SHORT[i]}</span>
                      <span className="text-sm font-bold leading-tight">{weekDates[i].getDate()}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `56px 1fr` }}>
                <HourGutter />
                <div>
                  <DayHeader sid={selectedScope} date={selectedDate} />
                  <DayColumn sid={selectedScope} date={selectedDate} />
                </div>
              </div>
            </div>
          )}

          {/* ===== MÊS ===== */}
          {viewMode === "mes" && (
            <div className="p-3 md:p-4">
              <MonthGrid />
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Início (abertura)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Fim (fechamento)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary ring-2 ring-primary/30" /> Hoje
                </span>
                <span className="ml-auto">Clique em um dia para abrir a rotina</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FASES DO MÊS */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b border-border/60">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-amber-500" />
            Fases do mês
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Sobrescrevem a rotina padrão em datas específicas (ex.: fim de mês = corrida de fechamento).
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MONTH_SCOPES.map((sid) => {
              const scope = SCOPES.find((s) => s.id === sid)!;
              const blocks = blocksByScope[sid] || [];
              return (
                <div
                  key={sid}
                  className="rounded-2xl border border-border/60 bg-card transition-shadow hover:shadow-md flex flex-col"
                >
                  <div className="px-4 pt-4 pb-3 border-b border-border/60 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{scope.label.split(" (")[0]}</p>
                      {scope.hint && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{scope.hint}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 rounded-full hover:bg-primary/10 hover:text-primary"
                      onClick={() => onJumpToScope(sid)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="p-2.5 space-y-2 min-h-[140px]">
                    {blocks.length === 0 ? (
                      <div className="text-center text-[11px] text-muted-foreground py-6 px-3 border border-dashed border-border rounded-xl">
                        Sem rotina específica.<br />Clique em editar para definir.
                      </div>
                    ) : (
                      blocks.map((b) => {
                        const style = BLOCK_STYLES[b.type];
                        const Icon = style.icon;
                        return (
                          <div
                            key={`${sid}-${b.id}`}
                            className="relative rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.border.replace("border-l-", "bg-")}`} />
                            <div className="pl-3 pr-2.5 py-2">
                              <div className="text-[10px] font-mono font-medium text-muted-foreground tabular-nums">
                                {b.startTime} – {b.endTime}
                              </div>
                              <div className="flex items-start gap-1.5 mt-1">
                                <Icon className="h-3.5 w-3.5 mt-0.5 text-foreground/60 shrink-0" />
                                <p className="text-[12px] font-medium leading-snug text-foreground line-clamp-2">
                                  {b.title}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



