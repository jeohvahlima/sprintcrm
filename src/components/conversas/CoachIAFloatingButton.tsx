import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, X, Loader2, Copy, Check, RefreshCw, Send, Shuffle,
  Zap, Tag as TagIcon, BarChart3, CalendarCheck, Phone, BookOpen,
  Search, Plus, ChevronRight, Play, CheckCircle2, Clock, UserPlus, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoachIAFloatingButtonProps {
  contactPhone?: string;
  companyId?: string;
  leadId?: string;
  contactName?: string;
  leadName?: string;
  onSendSuggested?: (text: string) => void;
}

interface CoachReport {
  resumo_interacao: string;
  estagio_percebido: string;
  temperatura: "quente" | "morno" | "frio";
  pontos_fortes: string[];
  erros_e_perdas: string[];
  abordagem_ideal: string;
  comunicacao_mais_assertiva: string;
  objecoes_detectadas?: string[];
  proximos_passos: string[];
  mensagem_sugerida: string;
  risco_de_perda: number;
}

type TabKey = "now" | "cadencia" | "naofechou" | "acoes" | "analise" | "kb";
interface FunilRow { id: string; nome: string }
interface EtapaRow { id: string; nome: string; funil_id: string; posicao: number | null }
interface UserRow { id: string; full_name: string | null; email: string | null }

interface KBItem { id: string; title: string; excerpt: string; tags: string[] }

const tempTag: Record<string, { label: string; cls: string; icon: string }> = {
  quente: { label: "Lead quente", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: "🔥" },
  morno:  { label: "Lead morno",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: "🌡" },
  frio:   { label: "Lead frio",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: "❄" },
};

const DEFAULT_KB: KBItem[] = [
  { id: "kb1", title: 'Objeção: "Está muito caro"', excerpt: "Compare o custo de um vendedor CLT vs serviço terceirizado. Mostre ROI por mês e tempo de payback.", tags: ["Objeção","Preço","Script"] },
  { id: "kb2", title: 'Objeção: "Preciso falar com meu sócio"', excerpt: 'Ofereça um resumo executivo de 1 página com números e ROI esperado. "Quer que eu envie?"', tags: ["Objeção","Decisor","Script"] },
  { id: "kb3", title: "Case de ROI — empresa similar", excerpt: "Empresa B2B pequena: 0 → 40 leads/mês qualificados, 3 contratos no 1º mês. ROI 380% em 60 dias.", tags: ["Case","ROI"] },
  { id: "kb4", title: "Processo de onboarding — 30 dias", excerpt: "S1 diagnóstico · S2 playbook · S3-4 treinamento e ativação. Primeiros leads em 3 semanas.", tags: ["Processo","Onboarding"] },
];

export function CoachIAFloatingButton({
  contactPhone, companyId, leadId, contactName, leadName, onSendSuggested,
}: CoachIAFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("now");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CoachReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [variantIdx, setVariantIdx] = useState(0);

  // Modo Autônomo (persistido por lead/phone)
  const autoKey = `coach_auto_${companyId || ""}_${leadId || contactPhone || ""}`;
  const [autoMode, setAutoMode] = useState<boolean>(false);
  useEffect(() => {
    try { setAutoMode(localStorage.getItem(autoKey) === "1"); } catch {}
  }, [autoKey]);
  const toggleAuto = () => {
    setAutoMode((v) => {
      const nv = !v;
      try { localStorage.setItem(autoKey, nv ? "1" : "0"); } catch {}
      toast.success(nv ? "Modo Autônomo ativado — IA conduzirá a conversa" : "Modo Autônomo pausado");
      return nv;
    });
  };

  // Cadência: ações concluídas (visual)
  const [cadenceDone, setCadenceDone] = useState<number>(1); // passo 1 já feito
  // "Não Fechou": ações executadas
  const [doneActions, setDoneActions] = useState<string[]>([]);

  // Base de Conhecimento (localStorage por company)
  const kbKey = `coach_kb_${companyId || "global"}`;
  const [kb, setKb] = useState<KBItem[]>(DEFAULT_KB);
  const [kbQuery, setKbQuery] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(kbKey);
      if (raw) setKb(JSON.parse(raw));
    } catch {}
  }, [kbKey]);
  const saveKb = (next: KBItem[]) => {
    setKb(next);
    try { localStorage.setItem(kbKey, JSON.stringify(next)); } catch {}
  };
  const addKbPrompt = () => {
    const title = window.prompt("Título do conhecimento:"); if (!title) return;
    const excerpt = window.prompt("Resumo / conteúdo:") || "";
    const tagsStr = window.prompt("Tags separadas por vírgula:", "Script") || "";
    const item: KBItem = {
      id: `kb_${Date.now()}`,
      title, excerpt,
      tags: tagsStr.split(",").map(t => t.trim()).filter(Boolean),
    };
    saveKb([item, ...kb]);
    toast.success("Adicionado à base de conhecimento");
  };
  const filteredKb = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return kb;
    return kb.filter(k =>
      k.title.toLowerCase().includes(q) ||
      k.excerpt.toLowerCase().includes(q) ||
      k.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [kb, kbQuery]);

  const canRun = !!companyId && (!!leadId || !!contactPhone);

  // 🔄 Auto-análise em background ao trocar de lead (para disparar notificações)
  useEffect(() => {
    if (!canRun) return;
    const t = setTimeout(() => { if (!loading && !report) runCoach(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, contactPhone, companyId]);

  const runCoach = async () => {
    if (!canRun) { toast.error("Sem dados suficientes para analisar"); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("lead-coach-analyze", {
        body: { lead_id: leadId, phone: contactPhone, company_id: companyId, contact_name: contactName, lead_name: leadName },
      });
      if (err) throw err;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport((data as any)?.report || null);
      setVariantIdx(0);
    } catch (e: any) {
      setError(e?.message || "Erro ao analisar");
    } finally { setLoading(false); }
  };

  const scriptVariants = (): string[] => {
    if (!report) return [];
    const arr = [report.mensagem_sugerida, report.comunicacao_mais_assertiva, report.abordagem_ideal].filter(Boolean) as string[];
    return arr.length ? arr : [report.mensagem_sugerida];
  };
  const currentScript = scriptVariants()[variantIdx] || report?.mensagem_sugerida || "";

  const copyScript = async (text?: string) => {
    const t = text ?? currentScript; if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true); toast.success("Mensagem copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Não foi possível copiar"); }
  };
  const sendScript = (text?: string) => {
    const t = text ?? currentScript; if (!t) return;
    if (onSendSuggested) { onSendSuggested(t); toast.success("Mensagem inserida no campo de envio"); }
    else copyScript(t);
  };
  const newScript = () => {
    const v = scriptVariants();
    if (v.length > 1) setVariantIdx(i => (i + 1) % v.length);
    else toast("Sem outra variação — clique em Reanalisar");
  };

  const handleOpen = () => { setOpen(true); if (!report && !loading) runCoach(); };

  // 🔔 Notificação automática quando Coach IA detecta objeção/dificuldade/ação
  const notifiedRef = useMemo(() => ({ key: "" }), []);
  useEffect(() => {
    if (!report) return;
    const objecoes = report.objecoes_detectadas || [];
    const erros = report.erros_e_perdas || [];
    const passos = report.proximos_passos || [];
    const sigKey = JSON.stringify({ o: objecoes, e: erros, p: passos.slice(0, 2), r: report.risco_de_perda });
    if (notifiedRef.key === sigKey) return;
    notifiedRef.key = sigKey;

    let titulo = "";
    let icone = "🎯";
    let descricao = "Script ideal + cadência de follow-up prontos.";
    if (objecoes.length > 0) {
      titulo = `Coach IA detectou objeção: ${objecoes[0]}`;
      icone = "🤖";
    } else if (erros.length > 0) {
      titulo = `Coach IA detectou dificuldade: ${erros[0]}`;
      icone = "⚠️";
    } else if ((report.risco_de_perda ?? 0) >= 50) {
      titulo = `Coach IA: alto risco de perda (${report.risco_de_perda}%)`;
      icone = "🔥";
      descricao = "Ação imediata recomendada.";
    } else if (passos.length > 0) {
      titulo = `Coach IA: ${passos.length} ações recomendadas`;
      icone = "✨";
      descricao = passos[0];
    } else {
      return;
    }

    toast(titulo, {
      icon: icone,
      description: descricao,
      duration: 8000,
      action: {
        label: "Ver",
        onClick: () => { setOpen(true); setTab(objecoes.length || erros.length ? "now" : "cadencia"); },
      },
      className: "border-violet-500/40 bg-gradient-to-br from-violet-950/90 to-purple-950/90",
    });
  }, [report, notifiedRef]);

  const temp = report ? tempTag[report.temperatura] : null;
  const stageLbl = report ? report.estagio_percebido.replace(/_/g, " ") : "";
  const risco = report?.risco_de_perda ?? 0;
  const riscoCls =
    risco >= 60 ? "bg-red-500/15 text-red-400 border-red-500/40" :
    risco >= 30 ? "bg-amber-500/15 text-amber-400 border-amber-500/40" :
                  "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";

  // Cadência derivada dos próximos passos do report
  const cadenceSteps = useMemo(() => {
    const base = report?.proximos_passos?.slice(0, 6) || [];
    const labels = ["Hoje","D+1","D+2","D+3","D+5","D+7"];
    return base.map((desc, i) => ({
      step: i + 1,
      title: desc.split(/[—:.\-]/)[0].slice(0, 60) || `Passo ${i+1}`,
      desc,
      when: i === 0 ? "Agora" : labels[i] || `D+${i+1}`,
    }));
  }, [report]);

  // ─────────── DADOS DO CRM (funis, etapas, tags, usuários) ───────────
  const [funis, setFunis] = useState<FunilRow[]>([]);
  const [etapas, setEtapas] = useState<EtapaRow[]>([]);
  const [companyTags, setCompanyTags] = useState<string[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // form state
  const [selFunilId, setSelFunilId] = useState<string>("");
  const [selEtapaId, setSelEtapaId] = useState<string>("");
  const [selOwnerId, setSelOwnerId] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [taskDueDays, setTaskDueDays] = useState<number>(1);
  const [apptTitle, setApptTitle] = useState<string>("");
  const [apptWhen, setApptWhen] = useState<string>(""); // datetime-local

  const loadCrmData = useCallback(async () => {
    if (!companyId) return;
    setCrmLoading(true);
    try {
      const sb: any = supabase;
      const [f, e, t, u] = await Promise.all([
        sb.from("funis").select("id, nome").eq("company_id", companyId).order("nome"),
        sb.from("etapas").select("id, nome, funil_id, posicao").eq("company_id", companyId).order("posicao"),
        sb.from("company_tags").select("tag_name").eq("company_id", companyId).order("tag_name"),
        sb.from("profiles").select("id, full_name, email").eq("company_id", companyId).order("full_name"),
      ]);
      setFunis((f.data || []) as FunilRow[]);
      setEtapas((e.data || []) as EtapaRow[]);
      setCompanyTags(((t.data || []) as any[]).map(x => x.tag_name).filter(Boolean));
      setUsers((u.data || []) as UserRow[]);
      if (leadId) {
        const { data: ld } = await supabase.from("leads").select("funil_id, etapa_id, owner_id").eq("id", leadId).maybeSingle();
        const v: any = ld;
        if (v) {
          setSelFunilId(v.funil_id || "");
          setSelEtapaId(v.etapa_id || "");
          setSelOwnerId(v.owner_id || "");
        }
      }
    } catch (err: any) {
      console.error("[Coach] loadCrmData", err);
    } finally { setCrmLoading(false); }
  }, [companyId, leadId]);

  useEffect(() => { if (open) loadCrmData(); }, [open, loadCrmData]);

  const requireLead = () => {
    if (!leadId) { toast.error("Nenhum lead vinculado a este contato"); return false; }
    return true;
  };

  // ─────────── AÇÕES REAIS NO CRM ───────────
  const addTagToLead = async (tag: string) => {
    if (!requireLead() || !companyId || !tag) return;
    try {
      // garante existência em company_tags
      await supabase.from("company_tags").upsert({ company_id: companyId, tag_name: tag }, { onConflict: "company_id,tag_name" });
      const { data: cur } = await supabase.from("leads").select("tags").eq("id", leadId!).maybeSingle();
      const tags = Array.from(new Set([...((cur as any)?.tags || []), tag]));
      const { error } = await supabase.from("leads").update({ tags }).eq("id", leadId!);
      if (error) throw error;
      await supabase.from("lead_tag_history").insert({ lead_id: leadId, company_id: companyId, tag_name: tag, action: "added" });
      setCompanyTags(prev => prev.includes(tag) ? prev : [...prev, tag].sort());
      toast.success(`Tag "${tag}" adicionada ao lead`);
    } catch (e: any) { toast.error("Erro ao adicionar tag: " + (e?.message || "")); }
  };

  const moveLeadToStage = async (etapaId: string, funilId?: string) => {
    if (!requireLead() || !etapaId) return;
    try {
      const payload: any = { etapa_id: etapaId };
      if (funilId) payload.funil_id = funilId;
      const { error } = await supabase.from("leads").update(payload).eq("id", leadId!);
      if (error) throw error;
      const et = etapas.find(x => x.id === etapaId);
      toast.success(`Lead movido para "${et?.nome || "nova etapa"}"`);
    } catch (e: any) { toast.error("Erro ao mover etapa: " + (e?.message || "")); }
  };

  const assignOwner = async (userId: string) => {
    if (!requireLead() || !userId) return;
    try {
      const { error } = await supabase.from("leads").update({ owner_id: userId }).eq("id", leadId!);
      if (error) throw error;
      const u = users.find(x => x.id === userId);
      toast.success(`Responsável atribuído: ${u?.full_name || u?.email || "usuário"}`);
    } catch (e: any) { toast.error("Erro ao atribuir responsável: " + (e?.message || "")); }
  };

  const createTask = async (title: string, dueDays: number, assignee?: string) => {
    if (!companyId || !title) { toast.error("Título obrigatório"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const due = new Date(); due.setDate(due.getDate() + (dueDays || 0));
      const { error } = await supabase.from("tasks").insert({
        title, description: report?.mensagem_sugerida?.slice(0, 500) || null,
        status: "todo", priority: "media",
        due_date: due.toISOString(),
        lead_id: leadId || null, company_id: companyId,
        owner_id: user?.id || null, assigned_to: assignee || user?.id || null,
      });
      if (error) throw error;
      toast.success(`Tarefa criada: "${title}" (vence em ${dueDays}d)`);
    } catch (e: any) { toast.error("Erro ao criar tarefa: " + (e?.message || "")); }
  };

  const createCompromisso = async (titulo: string, whenIso: string) => {
    if (!companyId || !titulo || !whenIso) { toast.error("Título e data obrigatórios"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const inicio = new Date(whenIso);
      const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
      const { error } = await supabase.from("compromissos").insert({
        titulo, observacoes: report?.mensagem_sugerida?.slice(0, 500) || null,
        data_hora_inicio: inicio.toISOString(), data_hora_fim: fim.toISOString(),
        duracao: 60, status: "agendado",
        lead_id: leadId || null, company_id: companyId,
        owner_id: user?.id || null, usuario_responsavel_id: selOwnerId || user?.id || null,
        telefone: contactPhone || null, paciente: leadName || contactName || null,
      });
      if (error) throw error;
      toast.success(`Compromisso agendado: ${inicio.toLocaleString("pt-BR")}`);
    } catch (e: any) { toast.error("Erro ao agendar compromisso: " + (e?.message || "")); }
  };

  // ─────────── ações rápidas "não fechou" (mapeadas para CRM) ───────────
  const execAction = async (id: string, label: string) => {
    if (doneActions.includes(id)) return;
    try {
      switch (id) {
        case "tag-followup":
          await addTagToLead("Follow-up");
          break;
        case "tag-objecao": {
          const obj = report?.objecoes_detectadas?.[0] || "Objeção";
          await addTagToLead(`Objeção: ${obj}`.slice(0, 60));
          break;
        }
        case "mover-funil": {
          // tenta achar etapa "Negociação" do funil atual; senão usa a primeira do mesmo funil
          const targetName = /negocia|propost/i;
          const candidata = etapas.find(e => targetName.test(e.nome) && (!selFunilId || e.funil_id === selFunilId))
            || etapas.find(e => targetName.test(e.nome));
          if (!candidata) { toast.error("Nenhuma etapa de Negociação encontrada nos seus funis"); return; }
          await moveLeadToStage(candidata.id, candidata.funil_id);
          break;
        }
        case "follow-d1":
          await createTask(`Follow-up D+1: ${leadName || contactName || "lead"}`, 1);
          break;
        case "follow-d3":
          await createTask(`Follow-up D+3: ${leadName || contactName || "lead"}`, 3);
          break;
        case "ligacao-socio": {
          const when = new Date(); when.setDate(when.getDate() + 1); when.setHours(10, 0, 0, 0);
          await createCompromisso(`Ligação com decisor — ${leadName || contactName || "lead"}`, when.toISOString());
          break;
        }
        case "script-reativacao":
          await createTask(`Enviar reativação D+7: ${leadName || contactName || "lead"}`, 7);
          break;
        default:
          toast.success(`"${label}" registrado`);
      }
      setDoneActions(prev => [...prev, id]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao executar ação");
    }
  };

  const execAllNaoFechou = async () => {
    const all = ["tag-followup","tag-objecao","mover-funil","follow-d1","follow-d3","ligacao-socio","script-reativacao"];
    toast("Executando todas as ações no CRM...", { description: "Atualizando lead, criando tarefas e compromisso." });
    for (const id of all) {
      // eslint-disable-next-line no-await-in-loop
      await execAction(id, id);
    }
  };

  const etapasDoFunil = useMemo(() => etapas.filter(e => !selFunilId || e.funil_id === selFunilId), [etapas, selFunilId]);

  return (
    <>
      {!open && (
        <button
          onClick={handleOpen}
          className="absolute bottom-24 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/40 flex items-center justify-center text-white hover:scale-110 transition-transform"
          title="Coach IA — Análise da conversa"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {open && (
        <div className="absolute bottom-6 right-6 z-50 w-[380px] max-h-[85vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Coach IA</div>
                <div className="text-[10px] text-muted-foreground">Análise em tempo real</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {report && (
                <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${riscoCls}`}>
                  {risco}% risco
                </span>
              )}
              <button onClick={() => setOpen(false)} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modo Autônomo */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
            <div className="flex-1">
              <div className="text-[11px] font-semibold text-foreground">Modo Autônomo</div>
              <div className="text-[10px] text-muted-foreground">IA conduz a conversa sozinha</div>
            </div>
            <button
              onClick={toggleAuto}
              role="switch"
              aria-checked={autoMode}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoMode ? "bg-gradient-to-r from-violet-600 to-purple-600" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoMode ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {autoMode && (
            <div className="px-3 py-1.5 text-[10px] text-violet-300 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              IA está conduzindo. Digite no campo para assumir o controle.
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border px-2 overflow-x-auto">
            {([
              { k: "now", label: "Agora" },
              { k: "cadencia", label: "Cadência" },
              { k: "naofechou", label: "Não Fechou" },
              { k: "analise", label: "Análise" },
              { k: "kb", label: "📚 Base" },
            ] as { k: TabKey; label: string }[]).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-2.5 py-2 text-[11px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  tab === t.k ? "border-violet-500 text-violet-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="text-xs">Analisando conversa...</div>
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">{error}</div>
            )}

            {/* AGORA */}
            {!loading && report && tab === "now" && (
              <>
                <Section label="Situação detectada">
                  <div className="flex flex-wrap gap-1.5">
                    {report.objecoes_detectadas?.slice(0, 1).map((o, i) => (
                      <Tag key={i} cls="bg-red-500/15 text-red-400 border-red-500/30">⚠ {o}</Tag>
                    ))}
                    {temp && <Tag cls={temp.cls}>{temp.icon} {temp.label}</Tag>}
                    {stageLbl && <Tag cls="bg-violet-500/15 text-violet-400 border-violet-500/30">📍 {stageLbl}</Tag>}
                  </div>
                </Section>
                <Divider />
                <Section label="Script ideal — responda agora">
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap mb-2 italic">
                    "{currentScript}"
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <ScriptBtn onClick={() => copyScript()} icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}>
                      {copied ? "Copiado" : "Copiar"}
                    </ScriptBtn>
                    <ScriptBtn primary onClick={() => sendScript()} icon={<Send className="h-3 w-3" />}>Enviar</ScriptBtn>
                    <ScriptBtn onClick={newScript} icon={<Shuffle className="h-3 w-3" />}>Outro</ScriptBtn>
                  </div>
                </Section>
                {report.proximos_passos?.length > 0 && (
                  <>
                    <Divider />
                    <Section label="Próximos passos imediatos">
                      <ul className="space-y-2">
                        {report.proximos_passos.map((p, i) => (
                          <li key={i} className="flex gap-2 text-xs text-foreground">
                            <span className="h-5 w-5 flex-shrink-0 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                            <span className="leading-relaxed">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </>
                )}
                <Divider />
                <button
                  onClick={() => toast.success("Executando todas as ações...", { description: "Coach IA está atualizando o CRM, criando follow-ups e avançando o funil." })}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" /> Executar todas as ações automaticamente
                </button>
                <button
                  onClick={runCoach}
                  className="w-full py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reanalisar agora
                </button>
              </>
            )}

            {/* CADÊNCIA */}
            {!loading && report && tab === "cadencia" && (
              <>
                <Section label={`Cadência ativa: ${stageLbl || "Lead atual"}`}>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cadência montada pela IA com base no histórico e estágio do funil.
                  </p>
                </Section>
                <div className="flex flex-col gap-1.5">
                  {cadenceSteps.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">Sem cadência sugerida ainda.</div>
                  )}
                  {cadenceSteps.map((s, i) => {
                    const status: "done" | "active" | "pending" =
                      i < cadenceDone ? "done" : i === cadenceDone ? "active" : "pending";
                    const accent =
                      status === "done" ? "bg-emerald-400" :
                      status === "active" ? "bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.5)]" :
                      "bg-muted";
                    const badge =
                      status === "done" ? <Tag cls="bg-emerald-500/15 text-emerald-400 border-emerald-500/25"><CheckCircle2 className="h-2.5 w-2.5 inline mr-1" />Feito</Tag> :
                      status === "active" ? <Tag cls="bg-violet-500/15 text-violet-300 border-violet-500/30"><Play className="h-2.5 w-2.5 inline mr-1" />Agora</Tag> :
                      <Tag cls="bg-muted text-muted-foreground border-border"><Clock className="h-2.5 w-2.5 inline mr-1" />{s.when}</Tag>;
                    return (
                      <div key={i} className="relative rounded-lg border border-border bg-muted/20 p-3 pl-4 overflow-hidden">
                        <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Passo {s.step}</span>
                          <span className="ml-auto">{badge}</span>
                        </div>
                        <div className="text-xs font-semibold text-foreground">{s.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</div>
                        {status === "active" && (
                          <button
                            onClick={() => { sendScript(); setCadenceDone(c => c + 1); }}
                            className="mt-2 w-full py-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-[11px] font-medium text-violet-300 flex items-center justify-center gap-1"
                          >
                            <Send className="h-3 w-3" /> Usar script do Coach
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => toast.success("Cadência ativada!", { description: "A IA vai executar cada passo no prazo certo." })}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" /> Ativar cadência automática
                </button>
              </>
            )}

            {/* NÃO FECHOU */}
            {!loading && tab === "naofechou" && (
              <>
                <Section label="Lead não fechou — ações da IA">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Clique em cada ação para executar ou deixe a IA executar tudo.
                  </p>
                </Section>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "tag-followup",   icon: <TagIcon className="h-3.5 w-3.5" />, color: "bg-amber-500/15 text-amber-400",   t: 'Adicionar tag "Follow-up"', s: "Marca o lead para acompanhamento especial." },
                    { id: "tag-objecao",    icon: <TagIcon className="h-3.5 w-3.5" />, color: "bg-red-500/15 text-red-400",       t: 'Adicionar tag "Objeção Preço"', s: "Sinaliza a principal barreira detectada." },
                    { id: "mover-funil",    icon: <BarChart3 className="h-3.5 w-3.5" />, color: "bg-violet-500/15 text-violet-300", t: 'Mover para "Negociação"', s: "Avança o lead na etapa correta do funil." },
                    { id: "follow-d1",      icon: <CalendarCheck className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-400", t: "Criar follow-up D+1", s: "Tarefa: enviar case ROI e confirmar reunião." },
                    { id: "follow-d3",      icon: <CalendarCheck className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-400", t: "Criar follow-up D+3", s: "Tarefa: reativação pós-reunião." },
                    { id: "ligacao-socio",  icon: <Phone className="h-3.5 w-3.5" />, color: "bg-blue-500/15 text-blue-400",     t: "Agendar ligação com o sócio", s: "Script de abordagem do decisor incluso." },
                    { id: "script-reativacao", icon: <Sparkles className="h-3.5 w-3.5" />, color: "bg-violet-500/15 text-violet-300", t: "Script de reativação", s: "Mensagem automática caso silêncio D+7." },
                  ].map(a => {
                    const done = doneActions.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => execAction(a.id, a.t)}
                        disabled={done}
                        className={`w-full flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                          done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20 hover:bg-muted/40"
                        }`}
                      >
                        <span className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${a.color}`}>{a.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-foreground">{a.t}</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.s}</span>
                        </span>
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={execAllNaoFechou}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" /> Executar todas as ações agora
                </button>
              </>
            )}

            {/* ANÁLISE */}
            {!loading && report && tab === "analise" && (
              <>
                <Section label="Resumo">
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.resumo_interacao}</p>
                </Section>
                <Divider />
                <Section label="Risco de perda">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Probabilidade de perder sem ação</span>
                    <span className="text-xs font-bold text-red-400">{risco}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${risco}%`, background: risco >= 60 ? "linear-gradient(90deg,#f87171,#ef4444)" : risco >= 30 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#34d399,#10b981)" }} />
                  </div>
                </Section>
                {report.pontos_fortes?.length > 0 && (
                  <Section label="✓ O que foi bem" labelClass="text-emerald-400">
                    <div className="space-y-1.5">
                      {report.pontos_fortes.map((g, i) => (
                        <div key={i} className="rounded-md bg-emerald-500/5 border-l-2 border-emerald-500/30 px-2.5 py-1.5 text-[11px] text-emerald-300/90">{g}</div>
                      ))}
                    </div>
                  </Section>
                )}
                {report.erros_e_perdas?.length > 0 && (
                  <Section label="✗ Onde perdeu terreno" labelClass="text-red-400">
                    <div className="space-y-1.5">
                      {report.erros_e_perdas.map((e, i) => (
                        <div key={i} className="rounded-md bg-red-500/5 border-l-2 border-red-500/30 px-2.5 py-1.5 text-[11px] text-red-300/90">{e}</div>
                      ))}
                    </div>
                  </Section>
                )}
                {report.objecoes_detectadas && report.objecoes_detectadas.length > 0 && (
                  <>
                    <Divider />
                    <Section label="Objeções detectadas">
                      <div className="flex flex-wrap gap-1.5">
                        {report.objecoes_detectadas.map((o, i) => (
                          <Tag key={i} cls="bg-amber-500/15 text-amber-400 border-amber-500/30">{o}</Tag>
                        ))}
                      </div>
                    </Section>
                  </>
                )}
              </>
            )}

            {/* BASE DE CONHECIMENTO */}
            {tab === "kb" && (
              <>
                <Section label="Base de conhecimento da empresa">
                  <div className="relative mb-2">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={kbQuery}
                      onChange={(e) => setKbQuery(e.target.value)}
                      placeholder="Buscar serviço, objeção, case..."
                      className="w-full h-8 pl-8 pr-2.5 rounded-md bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-violet-500/50"
                    />
                  </div>
                </Section>
                <div className="flex flex-col gap-1.5">
                  {filteredKb.length === 0 && (
                    <div className="text-[11px] text-muted-foreground text-center py-4">Nenhum item encontrado.</div>
                  )}
                  {filteredKb.map(k => (
                    <button
                      key={k.id}
                      onClick={() => { sendScript(k.excerpt); }}
                      className="text-left rounded-lg border border-border bg-muted/20 hover:bg-muted/40 p-3 transition-colors"
                    >
                      <div className="text-xs font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
                        <BookOpen className="h-3 w-3 text-violet-400" /> {k.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">{k.excerpt}</div>
                      {k.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {k.tags.map((t, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{t}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={addKbPrompt}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar ao conhecimento
                </button>
              </>
            )}

            {/* Fallback quando sem report nas abas que dependem dele */}
            {!loading && !report && (tab === "now" || tab === "cadencia" || tab === "analise") && (
              <div className="text-[11px] text-muted-foreground text-center py-6">
                Sem análise carregada.
                <button onClick={runCoach} className="block mx-auto mt-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium">
                  Analisar conversa
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ───────── helpers ───────── */
function Section({ label, labelClass, children }: { label: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold mb-2 ${labelClass || "text-muted-foreground"}`}>{label}</div>
      {children}
    </div>
  );
}
function Divider() { return <hr className="border-border/60" />; }
function Tag({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center ${cls}`}>{children}</span>;
}
function ScriptBtn({ onClick, icon, children, primary }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`py-1.5 rounded-md text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors ${
        primary ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-muted hover:bg-muted/70 text-foreground border border-border"
      }`}
    >
      {icon}{children}
    </button>
  );
}
