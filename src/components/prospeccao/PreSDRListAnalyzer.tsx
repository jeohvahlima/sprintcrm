import { Fragment, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Phone, Upload, Loader2, Sparkles, FileSpreadsheet, Download, Trash2, Brain, ChevronDown, ChevronRight, PhoneCall, Check, CalendarClock, Flame, X, Trophy, Filter, MessageCircle, FileText, PhoneOff, Voicemail, RotateCcw, Plus, History } from "lucide-react";
import { ScriptViewerDialog } from "./ScriptViewerDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConversaPopup } from "@/components/leads/ConversaPopup";

type Outcome = "pendente" | "prospectado" | "sem_resposta" | "oportunidade" | "agendamento" | "follow_up" | "ganho" | "descartado";

type AttemptType =
  | "primeiro_contato"
  | "nao_atendeu"
  | "caixa_postal"
  | "ocupado"
  | "numero_invalido"
  | "follow_up"
  | "whatsapp_enviado"
  | "retornar_depois";

type Attempt = { at: string; type: AttemptType; note?: string; user_id?: string | null; user_name?: string | null };

const ATTEMPT_META: Record<AttemptType, { label: string; icon: any; className: string }> = {
  primeiro_contato: { label: "Primeiro contato", icon: PhoneCall, className: "text-cyan-600" },
  nao_atendeu: { label: "Não atendeu", icon: PhoneOff, className: "text-amber-600" },
  caixa_postal: { label: "Caixa postal", icon: Voicemail, className: "text-amber-700" },
  ocupado: { label: "Ocupado", icon: PhoneOff, className: "text-orange-600" },
  numero_invalido: { label: "Número inválido", icon: X, className: "text-rose-600" },
  follow_up: { label: "Follow-up", icon: RotateCcw, className: "text-indigo-600" },
  whatsapp_enviado: { label: "WhatsApp enviado", icon: MessageCircle, className: "text-emerald-600" },
  retornar_depois: { label: "Retornar depois", icon: CalendarClock, className: "text-purple-600" },
};

type Row = Record<string, any> & {
  __id: string;
  __rowKey?: string;
  __dbId?: string;
  __status: "idle" | "running" | "done" | "error";
  __brief?: any;
  __error?: string;
  __open?: boolean;
  __outcome?: Outcome;
  __leadId?: string | null;
  __importedAt?: string | null;
  __attempts?: Attempt[];
  __attemptsCount?: number;
  __lastAttemptAt?: string | null;
};

type SavedAnalysis = {
  id: string;
  row_key: string;
  raw_row: Record<string, any>;
  brief: any;
  status: "pending" | "running" | "done" | "error";
  error_message: string | null;
  outcome?: string | null;
  lead_id?: string | null;
  imported_to_coldcall_at?: string | null;
  attempts?: Attempt[] | null;
  attempts_count?: number | null;
  last_attempt_at?: string | null;
};

const OUTCOME_META: Record<Outcome, { label: string; className: string; icon?: any }> = {
  pendente: { label: "Pendente", className: "text-muted-foreground" },
  prospectado: { label: "Prospectado (OK)", className: "text-emerald-600", icon: Check },
  sem_resposta: { label: "Sem resposta", className: "text-slate-500", icon: X },
  oportunidade: { label: "Oportunidade", className: "text-amber-600", icon: Flame },
  agendamento: { label: "Agendamento", className: "text-purple-600", icon: CalendarClock },
  follow_up: { label: "Follow-up", className: "text-cyan-600", icon: PhoneCall },
  ganho: { label: "Ganho", className: "text-emerald-700", icon: Trophy },
  descartado: { label: "Descartado", className: "text-rose-600", icon: X },
};
const OUTCOME_ORDER: Outcome[] = ["pendente", "prospectado", "sem_resposta", "oportunidade", "agendamento", "follow_up", "ganho", "descartado"];

const COL_MAP: Record<string, string[]> = {
  razao: ["razao", "razão", "razao social", "razão social", "razaosocial"],
  fantasia: ["fantasia", "nome fantasia", "nomefantasia"],
  cnpj: ["cnpj"],
  telefone: ["telefone", "telefone 1", "telefone1", "fone", "tel", "celular", "whatsapp"],
  email: ["email", "e-mail", "e mail"],
  site: ["site", "website", "url"],
  cidade: ["cidade", "cidade/uf", "municipio", "município"],
  socios: ["socio", "socios", "sócios", "nome do sócio", "nome do socio"],
  observacoes: ["obs", "observacoes", "observações", "telefone 2"],
};

function pick(row: Record<string, any>, keys: string[]) {
  const norm = (s: string) => s.toLowerCase().trim();
  const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
  for (const k of keys) {
    const hit = map.get(norm(k));
    if (hit && row[hit] != null && row[hit] !== "") return row[hit];
  }
  return undefined;
}

function normalizeRow(raw: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, aliases] of Object.entries(COL_MAP)) out[k] = pick(raw, aliases);
  return out;
}

function rowKey(row: Record<string, any>) {
  const key = [row.cnpj, row.telefone, row.site, row.email, row.fantasia || row.razao]
    .map((v) => String(v || "").toLowerCase().replace(/\D/g, "").trim() || String(v || "").toLowerCase().trim())
    .filter(Boolean)
    .join("|");
  return key || `sem-chave-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toRowFromSaved(item: SavedAnalysis): Row {
  return {
    ...(item.raw_row || {}),
    __id: item.row_key,
    __rowKey: item.row_key,
    __dbId: item.id,
    __status: item.status === "pending" || item.status === "running" ? "idle" : item.status,
    __brief: item.brief || undefined,
    __error: item.error_message || undefined,
    __outcome: (item.outcome as Outcome) || "pendente",
    __leadId: item.lead_id || null,
    __importedAt: item.imported_to_coldcall_at || null,
    __attempts: Array.isArray(item.attempts) ? item.attempts : [],
    __attemptsCount: item.attempts_count ?? (Array.isArray(item.attempts) ? item.attempts.length : 0),
    __lastAttemptAt: item.last_attempt_at || null,
  };
}

function fallbackBrief(row: Row, produtos: any[], motivo: string) {
  const nome = row.fantasia || row.razao || "empresa";
  const decisor = String(row.socios || "").split(/[,;|\n•]+/).map((p) => p.trim()).filter(Boolean)[0] || "a confirmar";
  const fit = Math.min(82, 42 + (row.site ? 12 : 0) + (row.socios ? 16 : 0) + (row.telefone ? 10 : 0) + (row.email ? 6 : 0));
  return {
    empresa_resumo: `${nome} deve ser tratado como prospect B2B; confirme segmento, porte e momento comercial na abertura.`,
    site_resumo: row.site ? `Site informado: ${row.site}. Confirmar posicionamento e serviços antes da abordagem.` : "Site não informado; confirmar presença digital na ligação.",
    porte_estimado: "a confirmar",
    decisor_provavel: decisor,
    cargo_decisor: decisor === "a confirmar" ? "a confirmar" : "sócio / diretor provável",
    outros_decisores: [],
    gatekeeper_esperado: "recepção, atendimento ou administrativo",
    melhor_horario_ligar: "09h às 11h ou 14h às 17h",
    gancho_abertura: `Olá, falo com ${decisor}? Vi a ${nome} e queria entender rapidamente como vocês estruturam hoje a captação e atendimento comercial de novos clientes.`,
    perguntas_qualificacao: ["Vocês têm alguém dedicado à prospecção?", "Quais canais geram mais oportunidades hoje?", "Existe sistema para acompanhar retornos e propostas?", "Qual gargalo comercial mais incomoda hoje?"],
    dores_provaveis: ["perda de oportunidades por falta de follow-up", "baixa previsibilidade comercial", "atendimento descentralizado"],
    objecoes_provaveis: ["não é prioridade agora", "já usamos planilha ou sistema simples", "já temos indicações suficientes"],
    oferta_recomendada: produtos?.[0]?.nome ? `Iniciar por ${produtos[0].nome}, validando aderência na ligação.` : "Diagnóstico de estruturação comercial e implantação do sistema.",
    fit_score: fit,
    prioridade: fit >= 70 ? "alta" : fit >= 55 ? "média" : "baixa",
    risco_descarte: row.telefone ? [] : ["telefone não informado na lista"],
    observacoes: `Briefing básico gerado porque a IA não respondeu com estabilidade (${motivo}). Validar decisor e contexto na primeira ligação.`,
  };
}

export function PreSDRListAnalyzer() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [icp, setIcp] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const { segmento, companyId } = useCompanySegmento();
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | Outcome>("all");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [waRow, setWaRow] = useState<Row | null>(null);
  const [waLeadId, setWaLeadId] = useState<string | null>(null);
  const [waOpening, setWaOpening] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptRow, setScriptRow] = useState<Row | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentUser({
        id: user.id,
        name: (prof as any)?.full_name || user.email?.split("@")[0] || "Usuário",
      });
    })();
  }, []);

  async function openConversa(r: Row) {
    if (!r.telefone) return toast.error("Linha sem telefone para WhatsApp.");
    let leadId = r.__leadId || null;
    if (!leadId) {
      setWaOpening(r.__id);
      try {
        leadId = await importToColdCall(r);
      } finally {
        setWaOpening(null);
      }
      if (!leadId) return;
    }
    setWaRow(r);
    setWaLeadId(leadId);
    setWaOpen(true);
  }


  // carrega ICP IA salvo + produtos
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ data: icpRows }, { data: prods }] = await Promise.all([
        supabase.from("icp_profiles" as any)
          .select("niche, intelligence")
          .eq("company_id", companyId)
          .eq("source", "ai")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("produtos_servicos" as any)
          .select("nome, preco, descricao")
          .eq("company_id", companyId).eq("ativo", true).limit(15),
      ]);
      setIcp((icpRows as any)?.[0] || null);
      setProdutos((prods as any[]) || []);
    })();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const all: SavedAnalysis[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("pre_sdr_analyses" as any)
          .select("id,row_key,raw_row,brief,status,error_message,outcome,lead_id,imported_to_coldcall_at,attempts,attempts_count,last_attempt_at")
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false })
          .range(from, from + 999);
        if (error) break;
        all.push(...(((data as unknown as SavedAnalysis[]) || [])));
        if (!data || data.length < 1000) break;
      }
      if (all.length) setRows(all.map(toRowFromSaved));
    })();
  }, [companyId]);

  // Realtime: sincroniza tentativas/outcome entre todos os SDRs da empresa
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`pre_sdr_analyses:${companyId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pre_sdr_analyses", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const n: any = payload.new;
          if (!n) return;
          setRows((prev) => prev.map((r) => {
            if (r.__rowKey !== n.row_key && r.__dbId !== n.id) return r;
            return {
              ...r,
              __outcome: (n.outcome as Outcome) || r.__outcome,
              __leadId: n.lead_id ?? r.__leadId,
              __importedAt: n.imported_to_coldcall_at ?? r.__importedAt,
              __attempts: Array.isArray(n.attempts) ? n.attempts : r.__attempts,
              __attemptsCount: n.attempts_count ?? r.__attemptsCount,
              __lastAttemptAt: n.last_attempt_at ?? r.__lastAttemptAt,
            };
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pre_sdr_analyses", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const n: any = payload.new;
          if (!n) return;
          setRows((prev) => {
            if (prev.some((r) => r.__rowKey === n.row_key)) return prev;
            return [toRowFromSaved(n as SavedAnalysis), ...prev];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        const parsedBase = json.map((r) => normalizeRow(r));
        const parsed: Row[] = parsedBase.map((r, i) => {
          const key = rowKey(r);
          return { ...r, __id: `${key}_${i}`, __rowKey: key, __status: "idle" };
        });
        setRows((prev) => {
          const saved = new Map(prev.map((r) => [r.__rowKey || r.__id, r]));
          return parsed.map((r) => saved.has(r.__rowKey || r.__id) ? { ...r, ...saved.get(r.__rowKey || r.__id), __id: r.__id } : r);
        });
        toast.success(`${parsed.length} linha(s) carregada(s) de "${file.name}"`);
      } catch (err: any) {
        toast.error("Falha ao ler planilha", { description: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function analyzeOne(row: Row): Promise<Row> {
    if (!companyId) return { ...row, __status: "error", __error: "Empresa não identificada" };
    const key = row.__rowKey || rowKey(row);
    const payloadBase = {
      company_id: companyId,
      row_key: key,
      empresa_nome: row.fantasia || row.razao || null,
      telefone: row.telefone || null,
      cnpj: row.cnpj || null,
      site: row.site || null,
      raw_row: {
        razao: row.razao, fantasia: row.fantasia, cnpj: row.cnpj, telefone: row.telefone,
        email: row.email, site: row.site, cidade: row.cidade, socios: row.socios, observacoes: row.observacoes,
      },
    };
    await supabase.from("pre_sdr_analyses" as any).upsert({ ...payloadBase, status: "running", error_message: null } as any, { onConflict: "company_id,row_key" });
    const maxAttempts = 3;
    let lastErr = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("pre-sdr-analyze", {
          body: {
            empresa: {
              razao: row.razao, fantasia: row.fantasia, cnpj: row.cnpj,
              telefone: row.telefone, email: row.email, site: row.site,
              cidade: row.cidade, socios: row.socios, observacoes: row.observacoes,
            },
            icp: icp?.intelligence || null,
            segmento_vendedor: segmento,
            produtos,
          },
        });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
        if (!(data as any)?.brief) throw new Error("Sem briefing retornado");
        const brief = (data as any).brief;
        const { data: saved } = await supabase.from("pre_sdr_analyses" as any)
          .upsert({ ...payloadBase, brief, status: "done", error_message: null, analyzed_at: new Date().toISOString() } as any, { onConflict: "company_id,row_key" })
          .select("id")
          .single();
        return { ...row, __rowKey: key, __dbId: (saved as any)?.id || row.__dbId, __status: "done", __brief: brief, __error: undefined };
      } catch (e: any) {
        lastErr = e?.message || "Erro";
        // sem créditos: para imediatamente
        if (/sem créditos|402|payment/i.test(lastErr)) break;
        // backoff antes de retry
        if (attempt < maxAttempts) {
          const wait = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
    const brief = fallbackBrief(row, produtos, lastErr || "falha de comunicação");
    const { data: saved } = await supabase.from("pre_sdr_analyses" as any)
      .upsert({ ...payloadBase, brief, status: "done", error_message: null, analyzed_at: new Date().toISOString() } as any, { onConflict: "company_id,row_key" })
      .select("id")
      .single();
    return { ...row, __rowKey: key, __dbId: (saved as any)?.id || row.__dbId, __status: "done", __brief: brief, __error: undefined };
  }

  async function runAnalysis(targetIdxs: number[]) {
    if (!targetIdxs.length) return;
    cancelRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: targetIdxs.length });

    const concurrency = 1;
    let cursor = 0;
    let done = 0;

    const next = async () => {
      while (!cancelRef.current) {
        const i = cursor++;
        if (i >= targetIdxs.length) return;
        const idx = targetIdxs[i];
        setRows((prev) => prev.map((r, j) => (j === idx ? { ...r, __status: "running", __error: undefined } : r)));
        const result = await analyzeOne(rows[idx]);
        setRows((prev) => prev.map((r, j) => (j === idx ? result : r)));
        done++;
        setProgress({ done, total: targetIdxs.length });
        // respiro entre requests para evitar 429 e quedas por excesso de chamadas simultâneas
        await new Promise((r) => setTimeout(r, 900));
      }
    };
    await Promise.all(Array.from({ length: concurrency }, next));
    setRunning(false);
    if (cancelRef.current) toast.info("Análise interrompida");
    else toast.success("Análise concluída");
  }

  async function analyzeAll() {
    const idxs = rows.map((_, i) => i).filter((i) => rows[i].__status !== "done");
    if (!idxs.length) return toast.info("Nada novo para analisar");
    await runAnalysis(idxs);
  }

  async function retryErrors() {
    const idxs = rows.map((_, i) => i).filter((i) => rows[i].__status === "error");
    if (!idxs.length) return toast.info("Nenhum erro para reanalisar");
    await runAnalysis(idxs);
  }

  function exportCSV() {
    const enriched = rows.filter((r) => r.__brief);
    if (!enriched.length) return toast.error("Nada para exportar ainda");
    const headers = [
      "razao", "fantasia", "cnpj", "telefone", "email", "site", "cidade",
      "decisor_provavel", "cargo_decisor", "fit_score", "prioridade",
      "melhor_horario_ligar", "gancho_abertura", "oferta_recomendada",
      "perguntas_qualificacao", "dores_provaveis", "objecoes_provaveis", "site_resumo", "observacoes",
    ];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " | ")}"`;
    const lines = [headers.join(",")];
    for (const r of enriched) {
      const b = r.__brief || {};
      lines.push(headers.map((h) => {
        const fromRow = (r as any)[h];
        const fromBrief = (b as any)[h];
        const v = fromBrief !== undefined ? fromBrief : fromRow;
        return escape(Array.isArray(v) ? v.join(" • ") : v);
      }).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pre-sdr-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleOpen(id: string) {
    setRows((prev) => prev.map((r) => (r.__id === id ? { ...r, __open: !r.__open } : r)));
  }

  async function setOutcome(row: Row, outcome: Outcome) {
    if (!companyId) return;
    const key = row.__rowKey || rowKey(row);
    setRows((prev) => prev.map((r) => (r.__id === row.__id ? { ...r, __outcome: outcome } : r)));
    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({ outcome, outcome_at: new Date().toISOString() } as any)
      .eq("company_id", companyId)
      .eq("row_key", key);
    if (error) toast.error("Não foi possível salvar o status", { description: error.message });
  }

  async function addAttempt(row: Row, type: AttemptType, note?: string) {
    if (!companyId) return;
    const key = row.__rowKey || rowKey(row);
    const at = new Date().toISOString();
    const newAttempt: Attempt = { at, type, note, user_id: currentUser?.id || null, user_name: currentUser?.name || null };
    const prevAttempts = Array.isArray(row.__attempts) ? row.__attempts : [];
    const attempts = [...prevAttempts, newAttempt];
    const attempts_count = attempts.length;
    setRows((prev) => prev.map((r) =>
      r.__id === row.__id ? { ...r, __attempts: attempts, __attemptsCount: attempts_count, __lastAttemptAt: at } : r
    ));
    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({ attempts, attempts_count, last_attempt_at: at } as any)
      .eq("company_id", companyId)
      .eq("row_key", key);
    if (error) {
      toast.error("Não foi possível registrar a tentativa", { description: error.message });
    } else {
      toast.success(`Tentativa registrada: ${ATTEMPT_META[type].label}`, {
        description: `Total de abordagens: ${attempts_count}`,
      });
    }
  }

  async function removeLastAttempt(row: Row) {
    if (!companyId) return;
    const prevAttempts = Array.isArray(row.__attempts) ? row.__attempts : [];
    if (!prevAttempts.length) return;
    const key = row.__rowKey || rowKey(row);
    const attempts = prevAttempts.slice(0, -1);
    const attempts_count = attempts.length;
    const last_attempt_at = attempts.length ? attempts[attempts.length - 1].at : null;
    setRows((prev) => prev.map((r) =>
      r.__id === row.__id ? { ...r, __attempts: attempts, __attemptsCount: attempts_count, __lastAttemptAt: last_attempt_at } : r
    ));
    await supabase
      .from("pre_sdr_analyses" as any)
      .update({ attempts, attempts_count, last_attempt_at } as any)
      .eq("company_id", companyId)
      .eq("row_key", key);
  }

  async function importToColdCall(row: Row): Promise<string | null> {
    if (!companyId) return null;
    const phone = String(row.telefone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Linha sem telefone — não dá para importar para Cold Call."); return null; }
    if (row.__leadId) { toast.info("Esta empresa já foi importada."); return row.__leadId; }
    setImportingId(row.__id);
    try {
      const name = String(row.fantasia || row.razao || "Empresa sem nome").trim();
      const company = String(row.razao || row.fantasia || "").trim();
      const briefNote = row.__brief
        ? `Decisor provável: ${row.__brief.decisor_provavel || "—"}\nGancho: ${row.__brief.gancho_abertura || "—"}\nOferta sugerida: ${row.__brief.oferta_recomendada || "—"}\nFit: ${row.__brief.fit_score ?? "—"}`
        : null;
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          company_id: companyId,
          name,
          phone,
          telefone: phone,
          email: row.email || null,
          company: company || null,
          source: "pre_sdr",
          notes: briefNote,
          to_prospect: true,
          prospecting_priority: row.__brief?.fit_score ?? 1,
          stage: "prospeccao",
          status: "novo",
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const key = row.__rowKey || rowKey(row);
      const importedAt = new Date().toISOString();
      await supabase
        .from("pre_sdr_analyses" as any)
        .update({ lead_id: lead!.id, imported_to_coldcall_at: importedAt } as any)
        .eq("company_id", companyId)
        .eq("row_key", key);
      setRows((prev) => prev.map((r) => (r.__id === row.__id ? { ...r, __leadId: lead!.id, __importedAt: importedAt } : r)));
      toast.success("Importado para Cold Call", { description: `${name} já está disponível na fila.` });
      return lead!.id as string;
    } catch (e: any) {
      toast.error("Falha ao importar", { description: e?.message });
      return null;
    } finally {
      setImportingId(null);
    }
  }

  async function importSelectedToColdCall() {
    const candidates = visibleRows.filter((r) => !r.__leadId && (r.telefone || "").toString().replace(/\D/g, ""));
    if (!candidates.length) return toast.info("Nada para importar (filtre uma lista com telefone).");
    let ok = 0;
    for (const r of candidates) {
      // sequencial para não estourar rate limit
      // eslint-disable-next-line no-await-in-loop
      await importToColdCall(r);
      ok++;
    }
    toast.success(`${ok} contato(s) enviados para Cold Call.`);
  }

  const total = rows.length;
  const enriched = rows.filter((r) => r.__brief).length;
  const errors = rows.filter((r) => r.__status === "error").length;
  const outcomeCounts = OUTCOME_ORDER.reduce<Record<string, number>>((acc, o) => {
    acc[o] = rows.filter((r) => (r.__outcome || "pendente") === o).length;
    return acc;
  }, {});
  const visibleRows = outcomeFilter === "all" ? rows : rows.filter((r) => (r.__outcome || "pendente") === outcomeFilter);
  const importedCount = rows.filter((r) => r.__leadId).length;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-5 w-5 text-primary" /> Pré-SDR para Cold Call
          <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground gap-1">
            <Sparkles className="h-3 w-3" /> IA
          </Badge>
        </CardTitle>
        <CardDescription>
          Anexe sua lista de empresas (Econodata, EmpresaQui, etc.) e a IA gera um briefing pré-call para cada uma:
          decisor provável, gancho de abertura, perguntas de qualificação e fit com seu ICP.
          {icp ? <> Usando ICP atual: <strong>{(icp as any).niche}</strong>.</> : <> <span className="text-amber-600">Defina o ICP acima para análises mais precisas.</span></>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
            <Upload className="h-4 w-4" /> Anexar planilha (.xlsx/.csv)
          </Button>
          {total > 0 && (
            <>
              <Badge variant="secondary" className="gap-1"><FileSpreadsheet className="h-3 w-3" /> {total} contato(s)</Badge>
              {enriched > 0 && <Badge variant="outline" className="text-emerald-600">{enriched} analisado(s)</Badge>}
              {errors > 0 && <Badge variant="outline" className="text-rose-600">{errors} erro(s)</Badge>}

              {!running ? (
                <Button size="sm" onClick={analyzeAll} className="gap-1">
                  <Brain className="h-4 w-4" /> Analisar com IA
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => { cancelRef.current = true; }} className="gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" /> Parar
                </Button>
              )}
              {!running && errors > 0 && (
                <Button size="sm" variant="outline" onClick={retryErrors} className="gap-1 border-rose-300 text-rose-600 hover:bg-rose-50">
                  <Loader2 className="h-4 w-4" /> Reanalisar erros ({errors})
                </Button>
              )}
              {enriched > 0 && (
                <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1">
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={importSelectedToColdCall} className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <PhoneCall className="h-4 w-4" /> Enviar visíveis para Cold Call
              </Button>
              {importedCount > 0 && (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300">{importedCount} no Cold Call</Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => setRows([])} className="gap-1">
                <Trash2 className="h-4 w-4" /> Limpar
              </Button>
            </>
          )}
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Filtrar:</span>
            <button
              onClick={() => setOutcomeFilter("all")}
              className={`px-2 py-0.5 rounded-full border ${outcomeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              Todos ({total})
            </button>
            {OUTCOME_ORDER.map((o) => {
              const meta = OUTCOME_META[o];
              const count = outcomeCounts[o] || 0;
              if (count === 0 && o !== "pendente") return null;
              return (
                <button
                  key={o}
                  onClick={() => setOutcomeFilter(o)}
                  className={`px-2 py-0.5 rounded-full border ${outcomeFilter === o ? "bg-primary text-primary-foreground border-primary" : `border-border hover:bg-muted ${meta.className}`}`}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {running && (
          <div className="space-y-1">
            <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
            <p className="text-[11px] text-muted-foreground">{progress.done}/{progress.total} processado(s)…</p>
          </div>
        )}

        {!total && (
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
            Anexe uma planilha com colunas como <code>Razão</code>, <code>Fantasia</code>, <code>Telefone</code>, <code>Site</code>, <code>Nome do Sócio</code>.
            <br />
            Compatível com exportações de Econodata, EmpresaQui e similares.
          </div>
        )}

        {total > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 w-6"></th>
                    <th className="px-2 py-1.5">Empresa</th>
                    <th className="px-2 py-1.5">Telefone</th>
                    <th className="px-2 py-1.5">Decisor (IA)</th>
                    <th className="px-2 py-1.5">Fit</th>
                    <th className="px-2 py-1.5">IA</th>
                    <th className="px-2 py-1.5">Resultado da prospecção</th>
                    <th className="px-2 py-1.5">Abordagens</th>
                    <th className="px-2 py-1.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const b = r.__brief;
                    const fit = b?.fit_score;
                    const fitColor =
                      fit == null ? "" : fit >= 75 ? "text-emerald-600" : fit >= 50 ? "text-amber-600" : "text-rose-600";
                    const outcome = (r.__outcome || "pendente") as Outcome;
                    const oMeta = OUTCOME_META[outcome];
                    return (
                      <Fragment key={r.__id}>
                        <tr className="border-t hover:bg-muted/40">
                          <td className="px-2 py-1.5 cursor-pointer" onClick={() => b && toggleOpen(r.__id)}>
                            {b ? (r.__open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
                          </td>
                          <td className="px-2 py-1.5 cursor-pointer" onClick={() => b && toggleOpen(r.__id)}>
                            <div className="font-medium">{r.fantasia || r.razao || "—"}</div>
                            {r.razao && r.fantasia && <div className="text-[10px] text-muted-foreground">{r.razao}</div>}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.telefone || "—"}</td>
                          <td className="px-2 py-1.5">
                            {b ? <span><strong>{b.decisor_provavel}</strong>{b.cargo_decisor ? ` — ${b.cargo_decisor}` : ""}</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className={`px-2 py-1.5 font-semibold ${fitColor}`}>{fit ?? "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.__status === "running" && <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> analisando</Badge>}
                            {r.__status === "done" && <Badge variant="outline" className="text-emerald-600">pronto</Badge>}
                            {r.__status === "error" && <Badge variant="outline" className="text-rose-600" title={r.__error}>erro</Badge>}
                            {r.__status === "idle" && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={outcome} onValueChange={(v) => setOutcome(r, v as Outcome)}>
                              <SelectTrigger className={`h-7 w-[170px] text-xs ${oMeta.className}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOME_ORDER.map((o) => (
                                  <SelectItem key={o} value={o} className={OUTCOME_META[o].className}>
                                    {OUTCOME_META[o].label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            {(() => {
                              const attempts = r.__attempts || [];
                              const count = r.__attemptsCount ?? attempts.length;
                              const last = attempts[attempts.length - 1];
                              const lastMeta = last ? ATTEMPT_META[last.type] : null;
                              const nextNumber = count + 1;
                              return (
                                <div className="flex items-center gap-1">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 gap-1"
                                        title="Registrar nova abordagem / tentativa"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span className="text-[11px]">
                                          {count === 0 ? "Registrar" : `Tentativa ${nextNumber}`}
                                        </span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                      <DropdownMenuLabel>
                                        {count === 0 ? "Primeira abordagem" : `Registrar tentativa #${nextNumber}`}
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {(Object.keys(ATTEMPT_META) as AttemptType[]).map((t) => {
                                        const m = ATTEMPT_META[t];
                                        const Icon = m.icon;
                                        return (
                                          <DropdownMenuItem
                                            key={t}
                                            onClick={() => addAttempt(r, t)}
                                            className={`gap-2 ${m.className}`}
                                          >
                                            <Icon className="h-3.5 w-3.5" />
                                            <span>{m.label}</span>
                                          </DropdownMenuItem>
                                        );
                                      })}
                                      {count > 0 && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => removeLastAttempt(r)}
                                            className="gap-2 text-rose-600"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                            Desfazer última
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {count > 0 && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] ${lastMeta?.className || "text-muted-foreground"} hover:bg-muted`}
                                          title="Ver histórico de abordagens"
                                        >
                                          <History className="h-3 w-3" />
                                          <strong>{count}</strong>
                                          {lastMeta && <span className="hidden xl:inline">· {lastMeta.label}</span>}
                                          {last?.user_name && (
                                            <span className="hidden lg:inline text-[10px] opacity-80">· por {last.user_name.split(" ")[0]}</span>
                                          )}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent align="start" className="w-72 p-2">
                                        <p className="text-[11px] uppercase font-medium text-muted-foreground px-1 pb-1">
                                          Histórico ({count})
                                        </p>
                                        <ol className="space-y-1 max-h-60 overflow-y-auto">
                                          {attempts.slice().reverse().map((a, i) => {
                                            const m = ATTEMPT_META[a.type];
                                            const Icon = m?.icon || PhoneCall;
                                            const num = count - i;
                                            return (
                                              <li key={i} className="flex items-start gap-2 text-xs px-1 py-1 rounded hover:bg-muted">
                                                <Icon className={`h-3.5 w-3.5 mt-0.5 ${m?.className || ""}`} />
                                                <div className="flex-1">
                                                  <div className={`font-medium ${m?.className || ""}`}>
                                                    #{num} · {m?.label || a.type}
                                                  </div>
                                                  <div className="text-[10px] text-muted-foreground">
                                                    {new Date(a.at).toLocaleString("pt-BR")}
                                                    {a.user_name && <span className="ml-1">· por <strong>{a.user_name}</strong></span>}
                                                  </div>
                                                  {a.note && <div className="text-[11px] mt-0.5">{a.note}</div>}
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ol>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              {outcome !== "prospectado" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => setOutcome(r, "prospectado")}
                                  title="Marcar como prospectado"
                                >
                                  <Check className="h-3.5 w-3.5" /> OK
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                disabled={!r.telefone || waOpening === r.__id}
                                onClick={() => openConversa(r)}
                                title={r.telefone ? "Abrir conversa (popup do funil)" : "Sem telefone"}
                              >
                                {waOpening === r.__id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                                <span className="ml-1">Conversa</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-indigo-600 hover:bg-indigo-50"
                                onClick={() => { setScriptRow(r); setScriptOpen(true); }}
                                title="Abrir scripts do Workspace"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span className="ml-1">Script</span>
                              </Button>
                              {r.__leadId ? (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-300 gap-1">
                                  <PhoneCall className="h-3 w-3" /> Cold Call
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  disabled={importingId === r.__id || !r.telefone}
                                  onClick={() => importToColdCall(r)}
                                  title={r.telefone ? "Importar para a aba Cold Call" : "Sem telefone"}
                                >
                                  {importingId === r.__id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
                                  <span className="ml-1">Cold Call</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {r.__open && b && (
                          <tr className="bg-muted/20 border-t">
                            <td colSpan={9} className="px-3 py-3 space-y-2">
                              <div className="grid md:grid-cols-2 gap-3">
                                <Field k="Resumo da empresa" v={b.empresa_resumo} />
                                <Field k="Site" v={b.site_resumo} />
                                <Field k="Porte" v={b.porte_estimado} />
                                <Field k="Prioridade" v={b.prioridade} />
                                <Field k="Melhor horário" v={b.melhor_horario_ligar} />
                                <Field k="Gatekeeper" v={b.gatekeeper_esperado} />
                                <Field k="Outros decisores" v={b.outros_decisores} />
                                <Field k="Oferta recomendada" v={b.oferta_recomendada} />
                              </div>
                              <Field k="Gancho de abertura" v={b.gancho_abertura} highlight />
                              <Field k="Perguntas de qualificação" v={b.perguntas_qualificacao} />
                              <Field k="Dores prováveis" v={b.dores_provaveis} />
                              <Field k="Objeções prováveis" v={b.objecoes_provaveis} />
                              {b.risco_descarte?.length ? <Field k="Riscos / não-fit" v={b.risco_descarte} /> : null}
                              {b.observacoes ? <Field k="Observações" v={b.observacoes} /> : null}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      {waLeadId && (
        <ConversaPopup
          open={waOpen}
          onOpenChange={setWaOpen}
          leadId={waLeadId}
          leadName={waRow?.fantasia || waRow?.razao || "Lead"}
          leadPhone={String(waRow?.telefone ?? "")}
        />
      )}
      <ScriptViewerDialog
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        contactName={scriptRow?.fantasia || scriptRow?.razao}
      />
    </Card>
  );
}

function Field({ k, v, highlight }: { k: string; v: any; highlight?: boolean }) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  return (
    <div>
      <p className="text-[10px] uppercase font-medium text-muted-foreground">{k}</p>
      {Array.isArray(v) ? (
        <ul className="list-disc list-inside text-xs space-y-0.5">{v.map((it: string, i: number) => <li key={i}>{it}</li>)}</ul>
      ) : (
        <p className={`text-xs ${highlight ? "p-2 rounded bg-primary/10 border border-primary/30 whitespace-pre-line" : ""}`}>{String(v)}</p>
      )}
    </div>
  );
}
