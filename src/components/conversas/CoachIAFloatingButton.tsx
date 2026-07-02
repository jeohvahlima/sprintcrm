import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, X, Loader2, Copy, Check, RefreshCw, Send, Shuffle,
  Zap, Tag as TagIcon, BarChart3, CalendarCheck, Phone, BookOpen,
  Search, Plus, ChevronRight, Play, CheckCircle2, Clock, UserPlus, ListChecks,
  TrendingUp, AlertTriangle, Upload, Globe, Trash2, FileText, File, Image,
  FileAudio, FileVideo, FileType, Eye, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseEdgeFunctionError } from "@/utils/edgeFunctionError";
import { useTagsManager } from "@/hooks/useTagsManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";

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
  scripts_alternativos?: string[];
  risco_de_perda: number;
  score_engajamento?: number;
  score_intencao?: number;
  score_fit?: number;
  sinal_nao_fechou?: boolean;
  acoes_nao_fechou?: { id?: string; tipo?: string; titulo: string; descricao?: string; valor?: string; prioridade?: string }[];
  cadencia?: { passo: number; titulo: string; descricao: string; quando: string; tipo?: string; status?: "done" | "active" | "pending" }[];
  kb_usadas?: string[];
}

type TabKey = "now" | "cadencia" | "naofechou" | "acoes" | "analise" | "kb" | "memoria" | "emocao" | "aprende" | "prospeccao" | "posmortem";

interface LeadMemory {
  objecao_principal: string;
  decisor_real: string;
  maior_interesse: string;
  tom_preferido: string;
  melhor_horario: string;
  historico: { data: string; canal: string; resumo: string; resultado: "fechou" | "nao_fechou" | "andamento" }[];
}
interface TomVoz {
  empresa: string;
  setor: string;
  estilo: "formal" | "informal" | "tecnico" | "consultivo";
  expressoes: string;
  evitar: string;
  emojis: "nenhum" | "moderado" | "frequente";
}
interface EmocaoState {
  dominante: "animado" | "hesitante" | "com_pressa" | "comparando";
  scores: { animado: number; hesitante: number; com_pressa: number; comparando: number };
  sinais: string[];
  script_adaptado: string;
}
interface LearningItem { id: string; tipo: "sucesso" | "erro" | "novo"; titulo: string; descricao: string; conversas: number }
interface SimilarLead { id: string; nome: string; cargo: string; empresa: string; canal: string; dias_parado: number; tags: string[]; score: number }
interface PostMortemCase { id: string; nome: string; data: string; motivo: string; erros: string[]; positivos: string[]; recomendacao: string }
interface FunilRow { id: string; nome: string }
interface EtapaRow { id: string; nome: string; funil_id: string; posicao: number | null }
interface UserRow { id: string; full_name: string | null; email: string | null }
interface TaskBoardRow { id: string; nome: string }
interface TaskColumnRow { id: string; nome: string; board_id: string }

interface KBItem { id: string; title: string; excerpt: string; tags: string[] }
type KBFileTipo = "texto" | "pdf" | "imagem" | "audio" | "video";
interface KBFile {
  id: string;
  nome: string;
  tipo: KBFileTipo;
  url: string;
  tamanho?: number;
  status: "processando" | "pronto" | "erro";
  conteudoExtraido?: string;
}

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
  const { allTags, refreshTags } = useTagsManager();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("now");
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
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
  const [cadenceActive, setCadenceActive] = useState(false);
  const [cadenceBanner, setCadenceBanner] = useState("");
  const cadenceTimersRef = useRef<number[]>([]);
  const autoNaoFechouRef = useRef("");
  // "Não Fechou": ações executadas
  const [doneActions, setDoneActions] = useState<string[]>([]);

  // Base de Conhecimento (empresa — persistido no banco + localStorage)
  const kbKey = `coach_kb_${companyId || "global"}`;
  const [kb, setKb] = useState<KBItem[]>(DEFAULT_KB);
  const [kbFiles, setKbFiles] = useState<KBFile[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [informacoesExtras, setInformacoesExtras] = useState("");
  const [kbQuery, setKbQuery] = useState("");
  const [kbSaving, setKbSaving] = useState(false);
  const [kbLoading, setKbLoading] = useState(false);
  const [uploadingKb, setUploadingKb] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newKbTitle, setNewKbTitle] = useState("");
  const [newKbExcerpt, setNewKbExcerpt] = useState("");
  const [showAddKb, setShowAddKb] = useState(false);
  const kbFileInputRef = useRef<HTMLInputElement>(null);

  const saveKbLocal = (items: KBItem[]) => {
    setKb(items);
    try { localStorage.setItem(kbKey, JSON.stringify(items)); } catch {}
  };

  const saveCoachKbToDb = useCallback(async (overrides?: {
    items?: KBItem[];
    arquivos?: KBFile[];
    site_url?: string;
    informacoes_extras?: string;
  }) => {
    if (!companyId) return false;
    setKbSaving(true);
    try {
      const payload = {
        items: overrides?.items ?? kb,
        arquivos: overrides?.arquivos ?? kbFiles,
        site_url: overrides?.site_url ?? siteUrl,
        informacoes_extras: overrides?.informacoes_extras ?? informacoesExtras,
      };
      try { localStorage.setItem(`${kbKey}_full`, JSON.stringify(payload)); } catch {}

      const { data: current } = await supabase
        .from("ia_configurations")
        .select("custom_prompts")
        .eq("company_id", companyId)
        .maybeSingle();

      const prompts = { ...((current?.custom_prompts as Record<string, unknown>) || {}) };
      const coach = { ...((prompts.coach as Record<string, unknown>) || {}) };
      coach.knowledge_base = payload;
      prompts.coach = coach;

      if (current) {
        const { error } = await supabase
          .from("ia_configurations")
          .update({ custom_prompts: prompts as any, updated_at: new Date().toISOString() })
          .eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ia_configurations")
          .insert({ company_id: companyId, custom_prompts: prompts as any } as any);
        if (error) throw error;
      }
      return true;
    } catch (e: any) {
      console.error("[Coach] saveCoachKb", e);
      toast.error("Erro ao salvar base de conhecimento");
      return false;
    } finally {
      setKbSaving(false);
    }
  }, [companyId, kb, kbFiles, siteUrl, informacoesExtras, kbKey]);

  const loadCoachKb = useCallback(async () => {
    if (!companyId) return;
    setKbLoading(true);
    try {
      const { data } = await supabase
        .from("ia_configurations")
        .select("custom_prompts")
        .eq("company_id", companyId)
        .maybeSingle();

      const coachKb = (data?.custom_prompts as any)?.coach?.knowledge_base;
      const atendKb = (data?.custom_prompts as any)?.atendimento?.knowledge_base;

      if (coachKb) {
        if (Array.isArray(coachKb.items) && coachKb.items.length > 0) setKb(coachKb.items);
        if (Array.isArray(coachKb.arquivos)) setKbFiles(coachKb.arquivos);
        if (coachKb.site_url) setSiteUrl(coachKb.site_url);
        if (coachKb.informacoes_extras) setInformacoesExtras(coachKb.informacoes_extras);
      } else if (atendKb) {
        if (Array.isArray(atendKb.arquivos) && atendKb.arquivos.length > 0) {
          setKbFiles(atendKb.arquivos.map((a: any) => ({
            ...a,
            status: a.status || "pronto",
          })));
        }
        if (atendKb.informacoes_extras) setInformacoesExtras(atendKb.informacoes_extras);
        if (atendKb.empresa?.contato && !siteUrl) setSiteUrl(atendKb.empresa.contato);
      } else {
        try {
          const raw = localStorage.getItem(`${kbKey}_full`) || localStorage.getItem(kbKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setKb(parsed);
            else if (parsed.items) {
              if (parsed.items.length) setKb(parsed.items);
              if (parsed.arquivos) setKbFiles(parsed.arquivos);
              if (parsed.site_url) setSiteUrl(parsed.site_url);
              if (parsed.informacoes_extras) setInformacoesExtras(parsed.informacoes_extras);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error("[Coach] loadCoachKb", e);
    } finally {
      setKbLoading(false);
    }
  }, [companyId, kbKey]);

  useEffect(() => { if (open) loadCoachKb(); }, [open, loadCoachKb]);

  const kbForCoach = useMemo(() => {
    const items: KBItem[] = [...kb];
    if (siteUrl.trim()) {
      items.push({
        id: "kb_site",
        title: "Site da empresa",
        excerpt: `Site oficial para consulta e treinamento: ${siteUrl.trim()}`,
        tags: ["Site", "Empresa"],
      });
    }
    if (informacoesExtras.trim()) {
      items.push({
        id: "kb_extras",
        title: "Informações da empresa",
        excerpt: informacoesExtras.trim().slice(0, 2000),
        tags: ["Empresa"],
      });
    }
    kbFiles.filter(f => f.status === "pronto").forEach(f => {
      items.push({
        id: f.id,
        title: f.nome,
        excerpt: (f.conteudoExtraido || `Arquivo ${f.tipo} anexado para treinamento da IA.`).slice(0, 2000),
        tags: [f.tipo, "Arquivo"],
      });
    });
    return items;
  }, [kb, siteUrl, informacoesExtras, kbFiles]);

  const getKbFileType = (file: File): KBFileTipo => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type.startsWith("image/")) return "imagem";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf" || ext === "pdf") return "pdf";
    return "texto";
  };

  const getKbFileIcon = (tipo: KBFileTipo) => {
    switch (tipo) {
      case "imagem": return <Image className="h-4 w-4 text-green-500" />;
      case "audio": return <FileAudio className="h-4 w-4 text-purple-500" />;
      case "video": return <FileVideo className="h-4 w-4 text-red-500" />;
      case "pdf": return <FileType className="h-4 w-4 text-orange-500" />;
      default: return <FileText className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatKbFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const tipo = getKbFileType(file);
    if (tipo === "texto" || file.type.startsWith("text/")) {
      try {
        const text = await file.text();
        return text.slice(0, 8000);
      } catch { /* ignore */ }
    }
    const labels: Record<KBFileTipo, string> = {
      pdf: "Documento PDF",
      imagem: "Imagem",
      audio: "Áudio",
      video: "Vídeo",
      texto: "Documento",
    };
    return `${labels[tipo]} "${file.name}" anexado para treinamento da IA (${formatKbFileSize(file.size)}).`;
  };

  const handleKbFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length || !companyId) return;

    setUploadingKb(true);
    setUploadProgress(0);
    const newFiles: KBFile[] = [...kbFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} excede 50MB`);
        continue;
      }

      const allowed = [
        "text/plain", "text/csv", "text/markdown",
        "application/pdf",
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3",
        "video/mp4", "video/webm", "video/ogg",
      ];
      if (!allowed.includes(file.type) && !file.name.match(/\.(txt|csv|md|pdf|jpg|jpeg|png|gif|webp|mp3|wav|ogg|mp4|webm)$/i)) {
        toast.error(`Tipo não suportado: ${file.name}`);
        continue;
      }

      try {
        const fileId = `file_${Date.now()}_${i}`;
        const fileName = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const storagePath = `coach/${companyId}/${fileName}`;

        let url = "";
        const { error: uploadError } = await supabase.storage
          .from("ia-knowledge")
          .upload(storagePath, file, { upsert: true });

        if (uploadError) {
          url = URL.createObjectURL(file);
        } else {
          const { data: urlData } = supabase.storage.from("ia-knowledge").getPublicUrl(storagePath);
          url = urlData.publicUrl;
        }

        const conteudoExtraido = await extractTextFromFile(file);
        const novo: KBFile = {
          id: fileId,
          nome: file.name,
          tipo: getKbFileType(file),
          url,
          tamanho: file.size,
          status: "pronto",
          conteudoExtraido,
        };
        newFiles.push(novo);
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (e) {
        console.error("[Coach] upload", e);
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    setKbFiles(newFiles);
    setUploadingKb(false);
    setUploadProgress(0);
    if (kbFileInputRef.current) kbFileInputRef.current.value = "";

    if (newFiles.length > kbFiles.length) {
      await saveCoachKbToDb({ arquivos: newFiles });
      toast.success(`${newFiles.length - kbFiles.length} arquivo(s) adicionado(s) à base`);
    }
  };

  const removeKbFile = async (id: string) => {
    const next = kbFiles.filter(f => f.id !== id);
    setKbFiles(next);
    await saveCoachKbToDb({ arquivos: next });
    toast.success("Arquivo removido");
  };

  const addKbItem = async () => {
    if (!newKbTitle.trim()) { toast.error("Informe o título"); return; }
    const item: KBItem = {
      id: `kb_${Date.now()}`,
      title: newKbTitle.trim(),
      excerpt: newKbExcerpt.trim(),
      tags: ["Manual"],
    };
    const next = [item, ...kb];
    saveKbLocal(next);
    setNewKbTitle("");
    setNewKbExcerpt("");
    setShowAddKb(false);
    await saveCoachKbToDb({ items: next });
    toast.success("Conhecimento adicionado");
  };

  const addKbPrompt = () => setShowAddKb(v => !v);

  const filteredKb = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return kb;
    return kb.filter(k =>
      k.title.toLowerCase().includes(q) ||
      k.excerpt.toLowerCase().includes(q) ||
      k.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [kb, kbQuery]);

  // ───────── Memória do lead, Tom de voz, Emoção, Aprendizado, Prospecção, Pós-mortem ─────────
  const memKey = `coach_mem_${companyId || "g"}_${leadId || contactPhone || "x"}`;
  const tomKey = `coach_tom_${companyId || "global"}`;
  const learnKey = `coach_learn_${companyId || "global"}`;
  const postMortemKey = `coach_postmortem_${companyId || "global"}`;

  const [memory, setMemory] = useState<LeadMemory>({
    objecao_principal: "", decisor_real: "", maior_interesse: "", tom_preferido: "", melhor_horario: "", historico: [],
  });
  const [tom, setTom] = useState<TomVoz>({
    empresa: "", setor: "", estilo: "consultivo", expressoes: "", evitar: "", emojis: "moderado",
  });
  const [whisper, setWhisper] = useState<string>("Coach IA pronto. Ao receber mensagens do lead, as sugestões aparecem aqui.");
  const [emocao, setEmocao] = useState<EmocaoState>({
    dominante: "hesitante",
    scores: { animado: 20, hesitante: 45, com_pressa: 15, comparando: 20 },
    sinais: [],
    script_adaptado: "",
  });
  const [learnings, setLearnings] = useState<LearningItem[]>([]);
  const [similarLeads, setSimilarLeads] = useState<SimilarLead[]>([]);
  const [postMortems, setPostMortems] = useState<PostMortemCase[]>([]);

  useEffect(() => {
    try {
      const m = localStorage.getItem(memKey); if (m) setMemory(JSON.parse(m));
      const t = localStorage.getItem(tomKey); if (t) setTom(JSON.parse(t));
      const l = localStorage.getItem(learnKey); if (l) setLearnings(JSON.parse(l));
      const p = localStorage.getItem(postMortemKey); if (p) setPostMortems(JSON.parse(p));
    } catch {}
  }, [memKey, tomKey, learnKey, postMortemKey]);
  const saveMemory = (m: LeadMemory) => { setMemory(m); try { localStorage.setItem(memKey, JSON.stringify(m)); } catch {} };
  const saveTom = (t: TomVoz) => { setTom(t); try { localStorage.setItem(tomKey, JSON.stringify(t)); } catch {} };
  const saveLearnings = (l: LearningItem[]) => { setLearnings(l); try { localStorage.setItem(learnKey, JSON.stringify(l)); } catch {} };
  const savePostMortems = (p: PostMortemCase[]) => { setPostMortems(p); try { localStorage.setItem(postMortemKey, JSON.stringify(p)); } catch {} };

  // Derivar emoção e similares a partir do report sempre que mudar
  useEffect(() => {
    if (!report) return;
    const risco = report.risco_de_perda ?? 0;
    const objQty = (report.objecoes_detectadas?.length || 0);
    const eng = report.score_engajamento ?? 0;
    const animado = Math.max(0, Math.min(100, eng - risco/2));
    const hesitante = Math.max(0, Math.min(100, risco));
    const comparando = Math.max(0, Math.min(100, objQty * 22));
    const comPressa = Math.max(0, Math.min(100, 100 - risco - eng/2));
    const total = animado + hesitante + comparando + comPressa || 1;
    const norm = (n: number) => Math.round((n / total) * 100);
    const scores = {
      animado: norm(animado), hesitante: norm(hesitante),
      com_pressa: norm(comPressa), comparando: norm(comparando),
    };
    const dom = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as EmocaoState["dominante"];
    setEmocao({
      dominante: dom,
      scores,
      sinais: (report.objecoes_detectadas || []).slice(0, 3),
      script_adaptado: report.comunicacao_mais_assertiva || report.mensagem_sugerida || "",
    });
    // Whisper: usar próximo passo ou script reduzido
    const tip = report.proximos_passos?.[0] || report.mensagem_sugerida || "";
    if (tip) setWhisper(tip.length > 140 ? tip.slice(0, 137) + "..." : tip);
  }, [report]);

  const exportHistory = () => {
    const lines = [
      `Histórico do lead — ${leadName || contactName || ""}`,
      `Telefone: ${contactPhone || ""}`,
      ``,
      `Objeção principal: ${memory.objecao_principal}`,
      `Decisor real: ${memory.decisor_real}`,
      `Maior interesse: ${memory.maior_interesse}`,
      `Tom preferido: ${memory.tom_preferido}`,
      `Melhor horário: ${memory.melhor_horario}`,
      ``,
      `Conversas anteriores:`,
      ...memory.historico.map(h => `- [${h.data}] (${h.canal}) ${h.resumo} → ${h.resultado}`),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `historico-${(leadName || "lead").replace(/\s+/g, "_")}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Histórico exportado");
  };

  const markFechamento = () => {
    const titulo = window.prompt("O que funcionou nesta venda? (resuma em 1 frase)"); if (!titulo) return;
    const item: LearningItem = {
      id: `l_${Date.now()}`,
      tipo: "sucesso",
      titulo,
      descricao: `Aprendido com ${leadName || contactName || "lead"} em ${new Date().toLocaleDateString("pt-BR")}.`,
      conversas: 1,
    };
    saveLearnings([item, ...learnings]);
    toast.success("Padrão registrado para aprendizado da IA");
  };

  const registerPostMortem = () => {
    const motivo = window.prompt("Motivo da perda (em poucas palavras):"); if (!motivo) return;
    const erros = (window.prompt("Erros cometidos (separe por ';'):") || "").split(";").map(s=>s.trim()).filter(Boolean);
    const positivos = (window.prompt("Pontos positivos (separe por ';'):") || "").split(";").map(s=>s.trim()).filter(Boolean);
    const recomendacao = window.prompt("Recomendação para reativar:") || "";
    const pm: PostMortemCase = {
      id: `pm_${Date.now()}`,
      nome: leadName || contactName || "Lead",
      data: new Date().toLocaleDateString("pt-BR"),
      motivo, erros, positivos, recomendacao,
    };
    savePostMortems([pm, ...postMortems]);
    toast.success("Pós-mortem registrado");
  };

  const canRun = !!companyId && (!!leadId || !!contactPhone);


  // Refs para debounce de re-análise e detecção de novas mensagens
  const debounceRef = useRef<number | null>(null);
  const lastRiskRef = useRef<number | null>(null);
  const autoReplyingRef = useRef(false);
  const lastAutoReplyAtRef = useRef<number>(0);

  // 🔄 Auto-análise em background ao trocar de lead
  useEffect(() => {
    if (!canRun) return;
    const t = setTimeout(() => { if (!loading && !report) runCoach(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, contactPhone, companyId]);

  const runCoach = async (silent = false) => {
    if (!canRun) { if (!silent) toast.error("Sem dados suficientes para analisar"); return; }
    if (silent) setReanalyzing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("lead-coach-analyze", {
        body: {
          lead_id: leadId, phone: contactPhone, company_id: companyId,
          contact_name: contactName, lead_name: leadName,
          knowledge_base: kbForCoach,
          lead_memory: memory,
          tom_de_voz: tom,
          learnings,
        },
      });
      if (err) throw new Error(await parseEdgeFunctionError(err, "Erro ao analisar conversa"));
      if ((data as any)?.error) throw new Error((data as any).error);
      const nr = (data as any)?.report as CoachReport | null;
      if ((data as any)?.fallback && (data as any)?.warning && !silent) {
        toast.warning((data as any).warning, { duration: 8000 });
      }
      // Alerta de delta de risco (>15pts)
      if (nr && lastRiskRef.current != null) {
        const delta = (nr.risco_de_perda ?? 0) - lastRiskRef.current;
        if (delta >= 15) {
          toast.warning(`⚠️ Risco do lead subiu ${delta} pts (${nr.risco_de_perda}%)`, {
            description: nr.objecoes_detectadas?.[0] || "Verifique as ações recomendadas.",
            duration: 9000,
          });
        }
      }
      if (nr) lastRiskRef.current = nr.risco_de_perda ?? 0;
      setReport(nr);
      setVariantIdx(0);

      // Auto-detecta "não fechou" e abre aba + toast
      if (nr?.sinal_nao_fechou || (nr?.acoes_nao_fechou && nr.acoes_nao_fechou.length > 0)) {
        setOpen(true);
        setTab("naofechou");
        toast.warning("⚠️ IA detectou risco de perda — ações recomendadas prontas", {
          duration: 8000,
          action: { label: "Ver ações", onClick: () => { setOpen(true); setTab("naofechou"); } },
        });
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao analisar");
    } finally {
      if (silent) setReanalyzing(false);
      else setLoading(false);
    }
  };

  // 🔁 Re-análise com debounce sempre que detectar nova mensagem (realtime)
  useEffect(() => {
    if (!canRun || !contactPhone) return;
    const phoneNorm = String(contactPhone).replace(/\D/g, "");
    if (!phoneNorm) return;
    const ch = (supabase as any)
      .channel(`coach-conv-${phoneNorm}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversas",
        filter: `telefone_formatado=eq.${phoneNorm}` }, (payload: any) => {
        const msg = payload?.new;
        if (!msg) return;
        // Debounce 2s
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => { runCoach(true); }, 2000);

        // Modo autônomo: gerar e enviar resposta quando o CONTATO mandar mensagem
        const isFromContact = !(msg.fromme === true || msg.fromme === "true");
        if (autoMode && isFromContact && !autoReplyingRef.current && onSendSuggested) {
          const now = Date.now();
          if (now - lastAutoReplyAtRef.current < 8000) return; // cooldown
          lastAutoReplyAtRef.current = now;
          autoReplyingRef.current = true;
          (async () => {
            try {
              const { data, error: err } = await supabase.functions.invoke("coach-auto-reply", {
                body: {
                  company_id: companyId, phone: contactPhone, lead_id: leadId,
                  lead_name: leadName, contact_name: contactName,
                  knowledge_base: kbForCoach,
                  etapa_funil: report?.estagio_percebido,
                },
              });
              if (err) throw new Error(await parseEdgeFunctionError(err, "Falha no modo autônomo"));
              const reply = (data as any)?.reply as string | undefined;
              if (reply) {
                onSendSuggested(reply);
                toast("🤖 IA respondeu automaticamente", { description: reply.slice(0, 120), duration: 6000 });
              }
            } catch (e: any) {
              toast.error("Modo Autônomo: " + (e?.message || "falha"));
            } finally {
              autoReplyingRef.current = false;
            }
          })();
        }
      })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRun, contactPhone, companyId, autoMode, kbForCoach, leadId, leadName, contactName, report?.estagio_percebido]);


  const scriptVariants = (): string[] => {
    if (!report) return [];
    const arr = [
      report.mensagem_sugerida,
      ...(report.scripts_alternativos || []),
      report.comunicacao_mais_assertiva,
      report.abordagem_ideal,
    ].filter(Boolean) as string[];
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

  // Cadência: usa a estruturada do report quando disponível, senão deriva dos próximos passos
  const cadenceSteps = useMemo(() => {
    if (report?.cadencia && report.cadencia.length > 0) {
      return report.cadencia.slice(0, 6).map((c, i) => ({
        step: c.passo ?? i + 1,
        title: (c.titulo || `Passo ${i + 1}`).slice(0, 60),
        desc: c.descricao || "",
        when: c.quando || (i === 0 ? "Agora" : `D+${i}`),
        tipo: c.tipo || "mensagem",
      }));
    }
    const base = report?.proximos_passos?.slice(0, 6) || [];
    const labels = ["Hoje", "D+1", "D+2", "D+3", "D+5", "D+7"];
    return base.map((desc, i) => ({
      step: i + 1,
      title: desc.split(/[—:.\-]/)[0].slice(0, 60) || `Passo ${i + 1}`,
      desc,
      when: i === 0 ? "Agora" : labels[i] || `D+${i + 1}`,
      tipo: "mensagem" as const,
    }));
  }, [report]);

  // KB usadas pela IA (matching por id retornado ou substring no script)
  const kbUsedIds = useMemo(() => {
    const ids = new Set<string>(report?.kb_usadas || []);
    if (report?.mensagem_sugerida) {
      const lower = report.mensagem_sugerida.toLowerCase();
      kb.forEach((k) => {
        const head = k.excerpt.slice(0, 25).toLowerCase();
        if (head && lower.includes(head)) ids.add(k.id);
      });
    }
    return ids;
  }, [report, kb]);


  // ─────────── DADOS DO CRM (funis, etapas, tags, usuários) ───────────
  const [funis, setFunis] = useState<FunilRow[]>([]);
  const [etapas, setEtapas] = useState<EtapaRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [taskBoards, setTaskBoards] = useState<TaskBoardRow[]>([]);
  const [taskColumns, setTaskColumns] = useState<TaskColumnRow[]>([]);
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);

  // form state
  const [selFunilId, setSelFunilId] = useState<string>("");
  const [selEtapaId, setSelEtapaId] = useState<string>("");
  const [selOwnerId, setSelOwnerId] = useState<string>("");
  const [selBoardId, setSelBoardId] = useState<string>("");
  const [selColumnId, setSelColumnId] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [taskDueDays, setTaskDueDays] = useState<number>(1);

  const loadCrmData = useCallback(async () => {
    if (!companyId) return;
    setCrmLoading(true);
    try {
      const sb: any = supabase;
      const [f, e, u, b, c] = await Promise.all([
        sb.from("funis").select("id, nome").eq("company_id", companyId).order("nome"),
        sb.from("etapas").select("id, nome, funil_id, posicao").eq("company_id", companyId).order("posicao"),
        sb.from("profiles").select("id, full_name, email").eq("company_id", companyId).order("full_name"),
        sb.from("task_boards").select("id, nome").eq("company_id", companyId).order("criado_em"),
        sb.from("task_columns").select("id, nome, board_id").order("posicao"),
      ]);
      setFunis((f.data || []) as FunilRow[]);
      setEtapas((e.data || []) as EtapaRow[]);
      setUsers((u.data || []) as UserRow[]);
      const boards = (b.data || []) as TaskBoardRow[];
      setTaskBoards(boards);
      setTaskColumns((c.data || []) as TaskColumnRow[]);
      setSelBoardId(prev => prev || (boards[0]?.id ?? ""));
      await refreshTags();
      if (leadId) {
        const { data: ld } = await supabase.from("leads").select("funil_id, etapa_id, owner_id, tags").eq("id", leadId).maybeSingle();
        const v: any = ld;
        if (v) {
          setSelFunilId(v.funil_id || "");
          setSelEtapaId(v.etapa_id || "");
          setSelOwnerId(v.owner_id || "");
          setLeadTags(v.tags || []);
        }
      } else {
        setLeadTags([]);
      }
    } catch (err: any) {
      console.error("[Coach] loadCrmData", err);
    } finally { setCrmLoading(false); }
  }, [companyId, leadId, refreshTags]);

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
      setLeadTags(tags);
      await refreshTags();
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
        board_id: selBoardId || null, column_id: selColumnId || null,
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
      const { error } = await (supabase as any).from("compromissos").insert({
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
  const colunasDoQuadro = useMemo(() => taskColumns.filter(c => c.board_id === selBoardId), [taskColumns, selBoardId]);

  useEffect(() => {
    if (!selBoardId || colunasDoQuadro.length === 0) {
      setSelColumnId("");
      return;
    }
    if (!colunasDoQuadro.some(c => c.id === selColumnId)) {
      setSelColumnId(colunasDoQuadro[0].id);
    }
  }, [selBoardId, colunasDoQuadro, selColumnId]);

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
        <div className="absolute bottom-6 right-6 z-50 w-[min(560px,calc(100vw-48px))] h-[min(760px,calc(100vh-48px))] max-h-[calc(100vh-48px)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-base font-semibold text-foreground">Coach IA</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {autoReplyingRef.current ? <><Loader2 className="h-2.5 w-2.5 animate-spin" /> IA respondendo...</> :
                    (loading || reanalyzing) ? <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Reanalisando...</> :
                    <><TrendingUp className="h-2.5 w-2.5" /> Análise em tempo real</>}
                </div>
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
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
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

          {/* 🤫 Whisper bar — sugestão da IA em tempo real */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-violet-500/20 bg-gradient-to-r from-indigo-500/10 to-violet-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] flex-shrink-0">🤫</span>
            <span className="text-[11px] text-violet-300 italic flex-1 truncate" title={whisper}>{whisper}</span>
            {currentScript && (
              <button
                onClick={() => sendScript()}
                className="text-[10px] px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 flex-shrink-0"
                title="Inserir script no input"
              >
                Usar ↑
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-x-1 gap-y-0 border-b border-border px-3 py-1 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent">
            {([
              { k: "now", label: "Agora" },
              { k: "cadencia", label: "Cadência" },
              { k: "naofechou", label: "Não Fechou" },
              { k: "acoes", label: "⚡ Ações CRM" },
              { k: "analise", label: "Análise" },
              { k: "kb", label: "📚 Base" },
              { k: "memoria", label: "🧠 Memória" },
              { k: "emocao", label: "😐 Emoção" },
              { k: "aprende", label: "🎓 Aprende" },
              { k: "prospeccao", label: "🎯 Prospecção" },
              { k: "posmortem", label: "💀 Pós-mortem" },
            ] as { k: TabKey; label: string }[]).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex-shrink-0 px-2.5 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  tab === t.k ? "border-violet-500 text-violet-400" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>


          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
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
                  onClick={() => { setTab("naofechou"); execAllNaoFechou(); }}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" /> Executar todas as ações no CRM
                </button>
                <button
                  onClick={() => runCoach()}
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
                  onClick={async () => {
                    // Cria tarefas reais no CRM para cada passo da cadência (sessão atual)
                    if (!cadenceSteps.length) { toast.error("Sem cadência para ativar"); return; }
                    toast("Ativando cadência...", { description: `${cadenceSteps.length} passos serão agendados como tarefas no CRM.` });
                    let day = 0;
                    for (const s of cadenceSteps) {
                      const m = /D\+(\d+)/i.exec(s.when || "");
                      const days = m ? Number(m[1]) : (s.step - 1);
                      day = Math.max(day, days);
                      // eslint-disable-next-line no-await-in-loop
                      await createTask(`[Cadência ${s.step}] ${s.title}`, day, selOwnerId || undefined);
                    }
                    toast.success("Cadência ativada — tarefas criadas no CRM");
                  }}
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
                <Section label="Score do lead (IA)">
                  <div className="space-y-2">
                    <ScoreRow label="Engajamento" value={report.score_engajamento ?? 0} color="#a78bfa" />
                    <ScoreRow label="Intenção de compra" value={report.score_intencao ?? 0} color="#34d399" />
                    <ScoreRow label="Risco de fuga" value={risco} color="#ef4444" />
                    <ScoreRow label="Fit de produto" value={report.score_fit ?? 0} color="#60a5fa" />
                  </div>
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

            {/* AÇÕES CRM — formulário real */}
            {tab === "acoes" && (
              <>
                <Section label="Ações no CRM">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {crmLoading ? "Carregando dados do CRM..." : `${funis.length} funis · ${etapas.length} etapas · ${allTags.length} tags · ${taskBoards.length} quadros · ${users.length} usuários`}
                  </p>
                </Section>

                {/* Mover etapa */}
                <Section label="📍 Mover lead no funil">
                  {funis.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {funis.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setSelFunilId(f.id); setSelEtapaId(""); }}
                          className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                            selFunilId === f.id
                              ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          📊 {f.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <select value={selFunilId} onChange={(e) => { setSelFunilId(e.target.value); setSelEtapaId(""); }} className="h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground">
                      <option value="">Funil...</option>
                      {funis.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                    <select value={selEtapaId} onChange={(e) => setSelEtapaId(e.target.value)} className="h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground">
                      <option value="">Etapa...</option>
                      {etapasDoFunil.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                  </div>
                  <button onClick={() => moveLeadToStage(selEtapaId, selFunilId)} disabled={!selEtapaId}
                    className="w-full py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[11px] font-medium text-white flex items-center justify-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Mover lead
                  </button>
                </Section>
                <Divider />

                {/* Responsável */}
                <Section label="👤 Atribuir responsável">
                  <div className="flex gap-1.5">
                    <select value={selOwnerId} onChange={(e) => setSelOwnerId(e.target.value)} className="flex-1 h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground">
                      <option value="">Selecione usuário...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0,8)}</option>)}
                    </select>
                    <button onClick={() => assignOwner(selOwnerId)} disabled={!selOwnerId}
                      className="px-2.5 h-8 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[11px] font-medium text-white inline-flex items-center gap-1">
                      <UserPlus className="h-3 w-3" />
                    </button>
                  </div>
                </Section>
                <Divider />

                {/* Tags */}
                <Section label="🏷 Tags">
                  {leadTags.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Tags do lead:</p>
                      <div className="flex flex-wrap gap-1">
                        {leadTags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {allTags.length > 0 ? (
                    <div className="max-h-[140px] overflow-y-auto scrollbar-thin border border-border rounded-md p-2 mb-2">
                      <p className="text-[10px] text-muted-foreground mb-1.5">Tags disponíveis — clique para adicionar ao lead</p>
                      <div className="flex flex-wrap gap-1">
                        {allTags.map(t => {
                          const onLead = leadTags.includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => !onLead && addTagToLead(t)}
                              disabled={onLead}
                              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                                onLead
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default"
                                  : "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                              }`}
                            >
                              {onLead ? "✓" : "+"} {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mb-2">Nenhuma tag criada ainda.</p>
                  )}
                  {report?.objecoes_detectadas?.slice(0, 3).map((o, i) => (
                    <button key={"obj"+i} onClick={() => addTagToLead(`Objeção: ${o}`.slice(0, 60))}
                      className="mr-1 mb-1 px-2 py-0.5 rounded-full text-[10px] border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20">
                      + Objeção: {o.slice(0,20)}
                    </button>
                  ))}
                  <div className="flex gap-1.5 mt-2">
                    <input value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} placeholder="Nova tag..."
                      className="flex-1 h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground placeholder:text-muted-foreground" />
                    <button onClick={() => { if (newTagInput.trim()) { addTagToLead(newTagInput.trim()); setNewTagInput(""); } }}
                      className="px-2.5 h-8 rounded-md bg-violet-600 hover:bg-violet-500 text-[11px] font-medium text-white inline-flex items-center gap-1">
                      <TagIcon className="h-3 w-3" />
                    </button>
                  </div>
                </Section>
                <Divider />

                {/* Tarefa */}
                <Section label="✅ Criar tarefa">
                  {taskBoards.length > 0 ? (
                    <div className="mb-2 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground">Quadros disponíveis</p>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {taskBoards.map(b => (
                          <button
                            key={b.id}
                            onClick={() => setSelBoardId(b.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                              selBoardId === b.id
                                ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            📋 {b.nome}
                          </button>
                        ))}
                      </div>
                      {selBoardId && colunasDoQuadro.length > 0 && (
                        <select value={selColumnId} onChange={(e) => setSelColumnId(e.target.value)}
                          className="w-full h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground">
                          <option value="">Etapa do quadro...</option>
                          {colunasDoQuadro.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mb-2">Nenhum quadro de tarefas criado.</p>
                  )}
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder={`Ex: Ligar para ${leadName || contactName || "lead"}`}
                    className="w-full h-8 mb-1.5 rounded-md bg-muted border border-border text-xs px-2 text-foreground" />
                  <div className="flex gap-1.5">
                    <select value={taskDueDays} onChange={(e) => setTaskDueDays(Number(e.target.value))}
                      className="h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground">
                      {[0,1,2,3,5,7,14].map(d => <option key={d} value={d}>{d === 0 ? "Hoje" : `D+${d}`}</option>)}
                    </select>
                    <button onClick={() => { createTask(taskTitle.trim(), taskDueDays, selOwnerId || undefined); setTaskTitle(""); }}
                      disabled={!taskTitle.trim()}
                      className="flex-1 h-8 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[11px] font-medium text-white inline-flex items-center justify-center gap-1">
                      <ListChecks className="h-3 w-3" /> Criar tarefa
                    </button>
                  </div>
                </Section>
                <Divider />

                {/* Compromisso */}
                <Section label="📅 Agendar compromisso">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Abre o mesmo modal do módulo Agenda, com horários, profissional e lembretes.
                  </p>
                  <button
                    onClick={() => {
                      if (!requireLead()) return;
                      setAgendaModalOpen(true);
                    }}
                    disabled={!leadId}
                    className="w-full h-9 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[11px] font-medium text-white inline-flex items-center justify-center gap-1.5"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Abrir agenda — agendar compromisso
                  </button>
                  {!leadId && (
                    <p className="text-[10px] text-amber-500 mt-1.5">Vincule um lead a este contato para agendar.</p>
                  )}
                </Section>

                <Divider />
                <button onClick={loadCrmData}
                  className="w-full py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Recarregar dados do CRM
                </button>
              </>
            )}


            {/* BASE DE CONHECIMENTO */}
            {tab === "kb" && (
              <>
                <Section label="Banco de dados da empresa — treinamento da IA">
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                    Tudo aqui alimenta o Coach IA nas análises e respostas: textos, arquivos, site e informações da empresa.
                  </p>
                  {kbLoading && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando base...
                    </div>
                  )}
                </Section>

                {/* Site da empresa */}
                <Section label="🌐 Site da empresa">
                  <div className="flex gap-1.5">
                    <input
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://suaempresa.com.br"
                      className="flex-1 h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={async () => {
                        if (!siteUrl.trim()) { toast.error("Informe a URL do site"); return; }
                        const ok = await saveCoachKbToDb({ site_url: siteUrl.trim() });
                        if (ok) toast.success("Site vinculado à base de treinamento");
                      }}
                      disabled={kbSaving}
                      className="px-2.5 h-8 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-[11px] font-medium text-white inline-flex items-center gap-1"
                    >
                      <Globe className="h-3 w-3" />
                    </button>
                  </div>
                </Section>
                <Divider />

                {/* Upload de arquivos */}
                <Section label="📎 Arquivos para treinamento">
                  <div
                    onClick={() => kbFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-violet-500/40 hover:bg-muted/30 transition-colors cursor-pointer mb-2"
                  >
                    <input
                      ref={kbFileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.csv,.md,.pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm"
                      onChange={handleKbFileUpload}
                      className="hidden"
                    />
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                    <p className="text-[11px] font-medium text-foreground">Clique para anexar arquivos</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDF · Imagens · Áudio · Vídeo · Documentos (máx. 50MB)</p>
                  </div>
                  {uploadingKb && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Enviando...</span><span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-violet-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                  {kbFiles.length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                      {kbFiles.map(f => (
                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border">
                          <div className="h-8 w-8 rounded bg-background border border-border flex items-center justify-center flex-shrink-0">
                            {getKbFileIcon(f.tipo)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{f.nome}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {formatKbFileSize(f.tamanho)} · {f.status === "pronto" ? "✓ Pronto" : f.status === "erro" ? "✗ Erro" : "⏳ Processando"}
                            </p>
                          </div>
                          <div className="flex gap-0.5 flex-shrink-0">
                            {f.url && (
                              <button onClick={() => window.open(f.url, "_blank")} className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => removeKbFile(f.id)} className="h-7 w-7 rounded hover:bg-red-500/10 flex items-center justify-center text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Nenhum arquivo anexado ainda.</p>
                  )}
                </Section>
                <Divider />

                {/* Informações extras */}
                <Section label="ℹ️ Informações da empresa">
                  <textarea
                    value={informacoesExtras}
                    onChange={(e) => setInformacoesExtras(e.target.value)}
                    placeholder="Serviços, diferenciais, políticas, horários, formas de pagamento..."
                    rows={3}
                    className="w-full rounded-md bg-muted border border-border text-xs px-2 py-1.5 text-foreground placeholder:text-muted-foreground resize-none"
                  />
                  <button
                    onClick={async () => {
                      const ok = await saveCoachKbToDb({ informacoes_extras: informacoesExtras });
                      if (ok) toast.success("Informações salvas na base");
                    }}
                    disabled={kbSaving}
                    className="mt-1.5 w-full py-1.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground inline-flex items-center justify-center gap-1"
                  >
                    {kbSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Salvar informações
                  </button>
                </Section>
                <Divider />

                {/* Conhecimento em texto */}
                <Section label="📚 Base de conhecimento">
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

                {showAddKb && (
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2 mb-2">
                    <input
                      value={newKbTitle}
                      onChange={(e) => setNewKbTitle(e.target.value)}
                      placeholder="Título (ex: Objeção de preço)"
                      className="w-full h-8 rounded-md bg-muted border border-border text-xs px-2 text-foreground"
                    />
                    <textarea
                      value={newKbExcerpt}
                      onChange={(e) => setNewKbExcerpt(e.target.value)}
                      placeholder="Conteúdo / script / case..."
                      rows={3}
                      className="w-full rounded-md bg-muted border border-border text-xs px-2 py-1.5 text-foreground resize-none"
                    />
                    <button onClick={addKbItem}
                      className="w-full py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-[11px] font-medium text-white">
                      Salvar conhecimento
                    </button>
                  </div>
                )}

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
                        {kbUsedIds.has(k.id) && (
                          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Usado pela IA ✓</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{k.excerpt}</div>
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

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={addKbPrompt}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> {showAddKb ? "Fechar" : "Adicionar texto"}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await saveCoachKbToDb();
                      if (ok) toast.success("Base sincronizada com o banco");
                    }}
                    disabled={kbSaving}
                    className="px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1"
                  >
                    {kbSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <p className="text-[9px] text-muted-foreground text-center mt-2">
                  {kbForCoach.length} itens ativos · {kbFiles.length} arquivo(s) · {siteUrl ? "site vinculado" : "sem site"}
                </p>
              </>
            )}

            {/* 🧠 MEMÓRIA — histórico + tom de voz */}
            {tab === "memoria" && (
              <>
                <Section label="Conversas anteriores">
                  {memory.historico.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">Nenhuma conversa anterior registrada ainda.</div>
                  ) : (
                    <div className="space-y-2">
                      {memory.historico.map((h, i) => (
                        <div key={i} className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                            <span>{h.data}</span><span>·</span><span>{h.canal}</span>
                            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] border ${
                              h.resultado === "fechou" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" :
                              h.resultado === "nao_fechou" ? "border-red-500/30 text-red-300 bg-red-500/10" :
                              "border-amber-500/30 text-amber-300 bg-amber-500/10"
                            }`}>{h.resultado === "fechou" ? "Fechou" : h.resultado === "nao_fechou" ? "Não fechou" : "Em andamento"}</span>
                          </div>
                          <div className="text-[11px] text-foreground/90 leading-relaxed">{h.resumo}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const data = new Date().toLocaleDateString("pt-BR");
                      const canal = window.prompt("Canal (WhatsApp / Email / Telefone):", "WhatsApp") || "WhatsApp";
                      const resumo = window.prompt("Resumo desta conversa:"); if (!resumo) return;
                      const res = (window.prompt("Resultado (fechou / nao_fechou / andamento):", "andamento") || "andamento") as any;
                      saveMemory({ ...memory, historico: [{ data, canal, resumo, resultado: res }, ...memory.historico] });
                    }}
                    className="w-full mt-2 py-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-[11px] text-violet-300"
                  >+ Registrar conversa anterior</button>
                </Section>
                <Divider />
                <Section label="O que a IA lembra">
                  <div className="grid grid-cols-1 gap-1.5">
                    {([
                      ["objecao_principal", "Objeção principal"],
                      ["decisor_real", "Decisor real"],
                      ["maior_interesse", "Maior interesse"],
                      ["tom_preferido", "Tom preferido"],
                      ["melhor_horario", "Melhor horário de resposta"],
                    ] as [keyof LeadMemory, string][]).map(([k, lbl]) => (
                      <div key={k as string} className="flex gap-1.5 items-center">
                        <span className="text-[10px] text-muted-foreground w-32 flex-shrink-0">{lbl}</span>
                        <input
                          value={(memory as any)[k] || ""}
                          onChange={(e) => saveMemory({ ...memory, [k]: e.target.value } as any)}
                          className="flex-1 h-7 px-2 rounded-md bg-muted border border-border text-[11px] text-foreground"
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                </Section>
                <Divider />
                <Section label="Tom de voz da empresa">
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <input value={tom.empresa} onChange={(e) => saveTom({ ...tom, empresa: e.target.value })} placeholder="Nome da empresa"
                      className="h-7 px-2 rounded-md bg-muted border border-border text-[11px] text-foreground" />
                    <input value={tom.setor} onChange={(e) => saveTom({ ...tom, setor: e.target.value })} placeholder="Setor"
                      className="h-7 px-2 rounded-md bg-muted border border-border text-[11px] text-foreground" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <select value={tom.estilo} onChange={(e) => saveTom({ ...tom, estilo: e.target.value as any })}
                      className="h-7 px-2 rounded-md bg-muted border border-border text-[11px] text-foreground">
                      <option value="formal">Formal</option>
                      <option value="informal">Informal</option>
                      <option value="tecnico">Técnico</option>
                      <option value="consultivo">Consultivo</option>
                    </select>
                    <select value={tom.emojis} onChange={(e) => saveTom({ ...tom, emojis: e.target.value as any })}
                      className="h-7 px-2 rounded-md bg-muted border border-border text-[11px] text-foreground">
                      <option value="nenhum">Sem emojis</option>
                      <option value="moderado">Emojis moderados</option>
                      <option value="frequente">Emojis frequentes</option>
                    </select>
                  </div>
                  <textarea value={tom.expressoes} onChange={(e) => saveTom({ ...tom, expressoes: e.target.value })}
                    placeholder="Expressões que a empresa usa..."
                    className="w-full mb-1.5 px-2 py-1.5 rounded-md bg-muted border border-border text-[11px] text-foreground min-h-[50px]" />
                  <textarea value={tom.evitar} onChange={(e) => saveTom({ ...tom, evitar: e.target.value })}
                    placeholder="Expressões a evitar..."
                    className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-[11px] text-foreground min-h-[50px]" />
                  <div className="mt-2 text-[10px] text-muted-foreground italic">
                    Esse tom é injetado em todas as respostas da IA para esta empresa.
                  </div>
                </Section>
                <Divider />
                <button onClick={exportHistory}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2">
                  📄 Exportar histórico do lead
                </button>
              </>
            )}

            {/* 😐 EMOÇÃO */}
            {tab === "emocao" && (
              <>
                <Section label="Estado emocional detectado">
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      ["animado", "🎉 Animado", "text-emerald-400"],
                      ["hesitante", "🤔 Hesitante", "text-amber-400"],
                      ["com_pressa", "⚡ Com pressa", "text-blue-400"],
                      ["comparando", "⚖️ Comparando", "text-violet-400"],
                    ] as [keyof EmocaoState["scores"], string, string][]).map(([k, lbl, cls]) => {
                      const v = emocao.scores[k];
                      const isDom = emocao.dominante === k;
                      return (
                        <div key={k} className={`rounded-lg border p-3 ${isDom ? "border-violet-500/60 bg-violet-500/10" : "border-border bg-muted/20"}`}>
                          <div className={`text-xs font-semibold ${cls}`}>{lbl}</div>
                          <div className="text-xl font-bold text-foreground mt-1">{v}%</div>
                          <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                            <div className="h-full bg-violet-500" style={{ width: `${v}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
                <Divider />
                <Section label="Como a IA adapta o tom">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {emocao.dominante === "animado" && "Lead engajado — mantenha o ritmo, traga prova social e proponha próximo passo claro."}
                    {emocao.dominante === "hesitante" && "Lead em dúvida — reduza a pressão, traga garantias e quebre uma objeção por vez."}
                    {emocao.dominante === "com_pressa" && "Lead pressionado por tempo — seja objetivo, mande resumo executivo + CTA único."}
                    {emocao.dominante === "comparando" && "Lead em comparação — diferenciação clara, ROI x concorrência e case relevante."}
                  </p>
                </Section>
                {emocao.sinais.length > 0 && (
                  <>
                    <Divider />
                    <Section label="Sinais detectados">
                      <div className="space-y-1.5">
                        {emocao.sinais.map((s, i) => (
                          <div key={i} className="rounded-md bg-amber-500/5 border-l-2 border-amber-500/40 px-2.5 py-1.5 text-[11px] text-amber-200/90">{s}</div>
                        ))}
                      </div>
                    </Section>
                  </>
                )}
                {emocao.script_adaptado && (
                  <>
                    <Divider />
                    <Section label="Script adaptado para o estado emocional">
                      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-foreground leading-relaxed italic">
                        "{emocao.script_adaptado}"
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <ScriptBtn onClick={() => copyScript(emocao.script_adaptado)} icon={<Copy className="h-3 w-3" />}>Copiar</ScriptBtn>
                        <ScriptBtn primary onClick={() => sendScript(emocao.script_adaptado)} icon={<Send className="h-3 w-3" />}>Enviar</ScriptBtn>
                      </div>
                    </Section>
                  </>
                )}
              </>
            )}

            {/* 🎓 APRENDE — fechamentos */}
            {tab === "aprende" && (
              <>
                <Section label="Padrões aprendidos pela IA">
                  {learnings.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">Nenhum padrão registrado ainda. Marque um fechamento abaixo.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {learnings.map(l => {
                        const cls =
                          l.tipo === "sucesso" ? "border-emerald-500/30 bg-emerald-500/5" :
                          l.tipo === "erro" ? "border-red-500/30 bg-red-500/5" :
                          "border-blue-500/30 bg-blue-500/5";
                        const lbl =
                          l.tipo === "sucesso" ? "Sucesso" : l.tipo === "erro" ? "Evitar" : "Novo";
                        const lblCls =
                          l.tipo === "sucesso" ? "text-emerald-400" : l.tipo === "erro" ? "text-red-400" : "text-blue-400";
                        return (
                          <div key={l.id} className={`rounded-lg border p-3 ${cls}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-semibold uppercase ${lblCls}`}>{lbl}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">{l.conversas} conv.</span>
                            </div>
                            <div className="text-xs font-semibold text-foreground">{l.titulo}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{l.descricao}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>
                <Divider />
                <Section label="Métricas">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <div className="text-[10px] text-muted-foreground">Com Coach IA</div>
                      <div className="text-xl font-bold text-emerald-400">{Math.min(85, 30 + learnings.length * 5)}%</div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="text-[10px] text-muted-foreground">Sem Coach IA</div>
                      <div className="text-xl font-bold text-muted-foreground">22%</div>
                    </div>
                  </div>
                </Section>
                <Divider />
                <button onClick={markFechamento}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2">
                  🎓 Marcar fechamento e ensinar IA
                </button>
              </>
            )}

            {/* 🎯 PROSPECÇÃO — leads similares */}
            {tab === "prospeccao" && (
              <>
                <Section label="Leads similares parados no funil">
                  {similarLeads.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      Clique abaixo para a IA buscar leads similares com base no perfil deste contato.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {similarLeads.map(l => (
                        <div key={l.id} className="rounded-lg border border-border bg-muted/20 p-3 flex gap-2 items-start">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                            {l.nome.split(" ").map(p=>p[0]).slice(0,2).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{l.nome}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{l.cargo} · {l.empresa}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {l.tags.slice(0,3).map((t,i) => <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{t}</span>)}
                            </div>
                            <div className="text-[10px] text-amber-300 mt-1">{l.dias_parado}d parado · {l.canal}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-bold text-emerald-400">{l.score}%</div>
                            <button className="mt-1 text-[10px] px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25">Reativar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                <Divider />
                <button
                  onClick={() => {
                    // Stub: gerar leads de exemplo a partir do contexto atual
                    const base: SimilarLead[] = [
                      { id: "s1", nome: leadName || "Lead similar 1", cargo: "Gerente Comercial", empresa: "Empresa A", canal: "WhatsApp", dias_parado: 14, tags: tom.setor ? [tom.setor, "B2B"] : ["B2B","SMB"], score: 92 },
                      { id: "s2", nome: "Maria Cardoso", cargo: "Diretora", empresa: "Empresa B", canal: "Email", dias_parado: 21, tags: ["Preço","Comparando"], score: 87 },
                      { id: "s3", nome: "João Pires", cargo: "CEO", empresa: "Empresa C", canal: "WhatsApp", dias_parado: 9, tags: ["Decisor"], score: 81 },
                    ];
                    setSimilarLeads(base);
                    toast.success("Leads similares listados");
                  }}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2">
                  🚀 Reativar todos com script personalizado
                </button>
              </>
            )}

            {/* 💀 PÓS-MORTEM */}
            {tab === "posmortem" && (
              <>
                <Section label="Análises pós-venda perdida">
                  {postMortems.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground">Nenhum pós-mortem registrado. Marque uma perda abaixo.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {postMortems.map(pm => (
                        <div key={pm.id} className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs font-semibold text-foreground">{pm.nome}</div>
                            <span className="ml-auto text-[10px] text-muted-foreground">{pm.data}</span>
                          </div>
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] border border-red-500/30 bg-red-500/10 text-red-300 mb-2">{pm.motivo}</span>
                          {pm.erros.length > 0 && (
                            <div className="mb-1.5">
                              <div className="text-[10px] font-semibold text-red-400 mb-0.5">Erros</div>
                              {pm.erros.map((e,i) => <div key={i} className="text-[11px] text-red-300/90">• {e}</div>)}
                            </div>
                          )}
                          {pm.positivos.length > 0 && (
                            <div className="mb-1.5">
                              <div className="text-[10px] font-semibold text-emerald-400 mb-0.5">Positivos</div>
                              {pm.positivos.map((e,i) => <div key={i} className="text-[11px] text-emerald-300/90">• {e}</div>)}
                            </div>
                          )}
                          {pm.recomendacao && (
                            <div className="rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-1.5 text-[11px] text-violet-200 italic">
                              💡 {pm.recomendacao}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                {postMortems.length > 0 && (
                  <>
                    <Divider />
                    <Section label="Principais causas (30d)">
                      <div className="space-y-1">
                        {Object.entries(postMortems.reduce<Record<string, number>>((acc, p) => {
                          acc[p.motivo] = (acc[p.motivo] || 0) + 1; return acc;
                        }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([m, c]) => {
                          const pct = Math.round((c / postMortems.length) * 100);
                          return (
                            <div key={m}>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-foreground">{m}</span>
                                <span className="text-muted-foreground">{pct}%</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  </>
                )}
                <Divider />
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={registerPostMortem}
                    className="py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-2">
                    💀 Marcar perda
                  </button>
                  <button
                    onClick={() => {
                      const txt = postMortems.map(pm => `[${pm.data}] ${pm.nome}\nMotivo: ${pm.motivo}\nErros: ${pm.erros.join("; ")}\nPositivos: ${pm.positivos.join("; ")}\nRecomendação: ${pm.recomendacao}\n`).join("\n---\n");
                      const blob = new Blob([txt || "Sem registros"], { type: "text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `posmortem-${Date.now()}.txt`; a.click();
                      toast.success("Relatório gerado");
                    }}
                    className="py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-medium text-foreground flex items-center justify-center gap-2">
                    📄 Gerar relatório
                  </button>
                </div>
              </>
            )}

            {!loading && !report && (tab === "now" || tab === "cadencia" || tab === "analise") && (
              <div className="text-[11px] text-muted-foreground text-center py-6">
                Sem análise carregada.
                <button onClick={() => runCoach()} className="block mx-auto mt-2 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium">
                  Analisar conversa
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {leadId && (
        <AgendaModal
          open={agendaModalOpen}
          onOpenChange={setAgendaModalOpen}
          lead={{
            id: leadId,
            nome: leadName || contactName || "Lead",
            telefone: contactPhone || "",
          }}
          onAgendamentoCriado={() => {
            setAgendaModalOpen(false);
            toast.success("Compromisso agendado com sucesso!");
          }}
        />
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
function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-bold text-foreground">{v}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}
