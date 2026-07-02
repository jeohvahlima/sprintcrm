import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NvoipAccountPanel from "@/components/discador/NvoipAccountPanel";
import { useWebphone } from "@/components/discador/WebphoneProvider";
import { Button } from "@/components/ui/button";
import { Delete, Mic, MicOff, Phone, PhoneCall, PhoneOff, Radio } from "lucide-react";
import { toast } from "sonner";

interface CallCenterLead {
  id: string;
  name: string | null;
  phone: string | null;
  telefone: string | null;
  email: string | null;
  stage: string | null;
  source: string | null;
  tags: string[] | null;
  value: number | null;
  coldCallState?: ColdCallState | null;
}

type AttemptType =
  | "primeiro_contato" | "nao_atendeu" | "caixa_postal" | "ocupado"
  | "numero_invalido" | "follow_up" | "whatsapp_enviado" | "retornar_depois";

type Outcome =
  | "pendente" | "prospectado" | "sem_resposta" | "oportunidade"
  | "agendamento" | "follow_up" | "ganho" | "descartado";

interface ColdCallAttempt {
  at: string;
  type: AttemptType;
  user_id?: string | null;
  user_name?: string | null;
}

interface ColdCallState {
  attempts: ColdCallAttempt[];
  outcome: Outcome | string | null;
}

type HunterStage =
  | "novo"
  | "tentativa_contato"
  | "follow_up"
  | "contato_realizado"
  | "buscando_decisor"
  | "conversa_decisor"
  | "oportunidade"
  | "descartado";

interface PipelineItem {
  id: string;
  lead_id: string | null;
  stage: HunterStage;
  substatus: string | null;
  attempts: number;
  last_action_at: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_company: string | null;
}

const ATTEMPT_LABELS: Record<AttemptType, string> = {
  primeiro_contato: "Primeiro contato",
  nao_atendeu: "Não atendeu",
  caixa_postal: "Caixa postal",
  ocupado: "Ocupado",
  numero_invalido: "Número inválido",
  follow_up: "Follow-up",
  whatsapp_enviado: "WhatsApp enviado",
  retornar_depois: "Retornar depois",
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  pendente: "Pendente",
  prospectado: "Prospectado",
  sem_resposta: "Sem resposta",
  oportunidade: "Oportunidade",
  agendamento: "Retornar / Responsável",
  follow_up: "Follow-up",
  ganho: "Ganho",
  descartado: "Descartado",
};

const nvoipDialogTheme = {
  "--background": "225 28% 7%",
  "--foreground": "210 40% 96%",
  "--card": "224 24% 11%",
  "--card-foreground": "210 40% 96%",
  "--popover": "224 24% 11%",
  "--popover-foreground": "210 40% 96%",
  "--muted": "224 20% 16%",
  "--muted-foreground": "218 16% 68%",
  "--border": "220 18% 24%",
  "--input": "220 18% 24%",
  "--primary": "160 84% 39%",
  "--primary-foreground": "160 45% 8%",
  "--destructive": "0 72% 51%",
} as CSSProperties;

const dialerKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

type ApiCallRef = {
  callId: string | null;
  recordId: string | null;
  startedAt: string | null;
};

function normalizePhoneForNvoip(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  const map: Record<string, string> = {
    admin: "Administrador",
    manager: "Gestor",
    gestor: "Gestor",
    user: "Usuário",
    sdr: "SDR",
    hunter: "Hunter SDR",
    vendedor: "Vendedor",
    owner: "Proprietário",
  };
  return map[role.toLowerCase()] || role;
}

const CallCenterPreview = () => {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const companyIdRef = useRef<string | null>(null);
  const apiCallRef = useRef<ApiCallRef>({ callId: null, recordId: null, startedAt: null });
  const prevCallStateRef = useRef<string>("idle");
  const [nvoipOpen, setNvoipOpen] = useState(false);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerNumber, setDialerNumber] = useState("");
  const [callSessionOpen, setCallSessionOpen] = useState(false);
  const webphone = useWebphone();
  const webphoneRef = useRef(webphone);
  webphoneRef.current = webphone;

  const webphoneReady = webphone.isWebphoneReady();
  const webphoneCallOpen = callSessionOpen;
  const webphoneStatusLabel = webphoneReady ? "Pronto" : webphone.regStatus === "connecting" ? "Conectando" : "Offline";

  const notifyCallEnded = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "call-center-call-ended" }, "*");
  }, []);

  const postRegistrationResult = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "call-center-registration-result", ...payload }, "*");
  }, []);

  const postPipelineData = useCallback((items: PipelineItem[]) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "call-center-pipeline-data", items }, "*");
  }, []);

  const postPipelineMoveResult = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "call-center-pipeline-move-result", ...payload }, "*");
  }, []);

  const loadHunterPipeline = useCallback(async (companyId: string): Promise<PipelineItem[]> => {
    const all: PipelineItem[] = [];
    const PAGE = 500;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("hunter_pipeline_leads" as any)
        .select("id, lead_id, stage, substatus, attempts, last_action_at, lead:lead_id(name, phone, company)")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data?.length) break;

      data.forEach((row: any) => {
        all.push({
          id: row.id,
          lead_id: row.lead_id,
          stage: row.stage,
          substatus: row.substatus,
          attempts: row.attempts ?? 0,
          last_action_at: row.last_action_at,
          lead_name: row.lead?.name ?? null,
          lead_phone: row.lead?.phone ?? null,
          lead_company: row.lead?.company ?? null,
        });
      });

      if (data.length < PAGE) break;
      from += PAGE;
    }

    return all;
  }, []);

  const syncPipelineLeads = useCallback(async (companyId: string) => {
    const existing = await loadHunterPipeline(companyId);
    const existingIds = new Set(existing.map((item) => item.lead_id).filter(Boolean));

    const { data: candidates, error } = await supabase
      .from("leads")
      .select("id")
      .eq("company_id", companyId)
      .not("phone", "is", null)
      .limit(300);

    if (error) throw error;

    const toImport = (candidates || []).filter((lead: any) => !existingIds.has(lead.id));
    if (!toImport.length) return existing;

    const { data: { user } } = await supabase.auth.getUser();
    const rows = toImport.map((lead: any) => ({
      company_id: companyId,
      lead_id: lead.id,
      assigned_to: user?.id ?? null,
      stage: "novo" as HunterStage,
    }));

    const { error: upsertError } = await supabase
      .from("hunter_pipeline_leads" as any)
      .upsert(rows, { onConflict: "company_id,lead_id", ignoreDuplicates: true });

    if (upsertError) throw upsertError;
    return loadHunterPipeline(companyId);
  }, [loadHunterPipeline]);

  const sendPipelineData = useCallback(async (sync = false) => {
    const companyId = companyIdRef.current;
    if (!companyId) return;

    try {
      const items = sync ? await syncPipelineLeads(companyId) : await loadHunterPipeline(companyId);
      postPipelineData(items);
      if (sync) {
        toast.success(items.length ? `${items.length} lead(s) no pipeline` : "Pipeline atualizado");
      }
    } catch (error: any) {
      console.error("Erro ao carregar pipeline:", error);
      toast.error(error?.message || "Erro ao carregar pipeline");
      postPipelineData([]);
    }
  }, [loadHunterPipeline, postPipelineData, syncPipelineLeads]);

  const movePipelineStage = useCallback(async (pipelineId: string, toStage: HunterStage) => {
    const { data: current, error: fetchError } = await supabase
      .from("hunter_pipeline_leads" as any)
      .select("id, company_id, stage")
      .eq("id", pipelineId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new Error("Lead do pipeline não encontrado");

    const fromStage = (current as any).stage as HunterStage;
    if (fromStage === toStage) return;

    const { error } = await supabase
      .from("hunter_pipeline_leads" as any)
      .update({
        stage: toStage,
        last_action_at: new Date().toISOString(),
      })
      .eq("id", pipelineId);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    let eventType = "stage_moved";
    if (toStage === "contato_realizado") eventType = "contact_made";
    else if (toStage === "conversa_decisor") eventType = "reached_decisor";
    else if (toStage === "oportunidade") eventType = "opportunity";

    await supabase.from("hunter_pipeline_events" as any).insert({
      company_id: (current as any).company_id,
      lead_pipeline_id: pipelineId,
      user_id: user?.id ?? null,
      event_type: eventType,
      from_stage: fromStage,
      to_stage: toStage,
      payload: {},
    });
  }, []);

  const resolveRowKey = useCallback(async (companyId: string, leadId: string) => {
    const { data } = await supabase
      .from("pre_sdr_analyses" as any)
      .select("row_key")
      .eq("company_id", companyId)
      .eq("lead_id", leadId)
      .order("last_attempt_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as any)?.row_key || `lead:${leadId}`;
  }, []);

  const ensureColdCallRow = useCallback(async (
    companyId: string,
    userId: string,
    leadId: string,
    leadName: string,
    phone: string,
    rowKey: string,
  ) => {
    await supabase.from("pre_sdr_analyses" as any).upsert({
      company_id: companyId,
      row_key: rowKey,
      empresa_nome: leadName || null,
      telefone: phone || null,
      raw_row: { lead_id: leadId, name: leadName, telefone: phone },
      lead_id: leadId,
      status: "done",
      user_id: userId,
    } as any, { onConflict: "company_id,row_key" });
  }, []);

  const loadColdCallStates = useCallback(async (companyId: string, leadIds: string[]) => {
    const map = new Map<string, ColdCallState>();
    if (!leadIds.length) return map;

    const chunkSize = 200;
    for (let i = 0; i < leadIds.length; i += chunkSize) {
      const chunk = leadIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("pre_sdr_analyses" as any)
        .select("lead_id, attempts, outcome")
        .eq("company_id", companyId)
        .in("lead_id", chunk);

      if (error) {
        console.error("Erro ao carregar tentativas do Call Center:", error);
        continue;
      }

      (data || []).forEach((row: any) => {
        if (!row.lead_id) return;
        const attempts = Array.isArray(row.attempts) ? row.attempts : [];
        const existing = map.get(row.lead_id);
        if (!existing || attempts.length >= existing.attempts.length) {
          map.set(row.lead_id, {
            attempts,
            outcome: row.outcome || "pendente",
          });
        }
      });
    }

    return map;
  }, []);

  const registerAttempt = useCallback(async (
    leadId: string,
    attemptType: AttemptType,
    leadName?: string,
    phone?: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!role?.company_id) throw new Error("Empresa não encontrada.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const rowKey = await resolveRowKey(role.company_id, leadId);
    await ensureColdCallRow(
      role.company_id,
      user.id,
      leadId,
      leadName || "Contato",
      phone || "",
      rowKey,
    );

    const { data: current } = await supabase
      .from("pre_sdr_analyses" as any)
      .select("attempts")
      .eq("company_id", role.company_id)
      .eq("row_key", rowKey)
      .maybeSingle();

    const attempts = Array.isArray((current as any)?.attempts) ? (current as any).attempts : [];
    const at = new Date().toISOString();
    const nextAttempt: ColdCallAttempt = {
      at,
      type: attemptType,
      user_id: user.id,
      user_name: (profile as any)?.full_name || user.email?.split("@")[0] || "Usuário",
    };
    const newAttempts = [...attempts, nextAttempt];

    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({
        attempts: newAttempts,
        attempts_count: newAttempts.length,
        last_attempt_at: at,
      } as any)
      .eq("company_id", role.company_id)
      .eq("row_key", rowKey);

    if (error) throw error;

    const { data: rowAfter } = await supabase
      .from("pre_sdr_analyses" as any)
      .select("attempts, outcome")
      .eq("company_id", role.company_id)
      .eq("row_key", rowKey)
      .maybeSingle();

    return {
      attempts: Array.isArray((rowAfter as any)?.attempts) ? (rowAfter as any).attempts : newAttempts,
      outcome: ((rowAfter as any)?.outcome as Outcome) || "pendente",
      label: ATTEMPT_LABELS[attemptType],
    };
  }, [ensureColdCallRow, resolveRowKey]);

  const registerOutcome = useCallback(async (
    leadId: string,
    outcome: Outcome,
    leadName?: string,
    phone?: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!role?.company_id) throw new Error("Empresa não encontrada.");

    const rowKey = await resolveRowKey(role.company_id, leadId);
    await ensureColdCallRow(
      role.company_id,
      user.id,
      leadId,
      leadName || "Contato",
      phone || "",
      rowKey,
    );

    const { error } = await supabase
      .from("pre_sdr_analyses" as any)
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
      } as any)
      .eq("company_id", role.company_id)
      .eq("row_key", rowKey);

    if (error) throw error;

    const { data: rowAfter } = await supabase
      .from("pre_sdr_analyses" as any)
      .select("attempts, outcome")
      .eq("company_id", role.company_id)
      .eq("row_key", rowKey)
      .maybeSingle();

    return {
      attempts: Array.isArray((rowAfter as any)?.attempts) ? (rowAfter as any).attempts : [],
      outcome,
      label: OUTCOME_LABELS[outcome],
    };
  }, [ensureColdCallRow, resolveRowKey]);

  const closeCallSession = useCallback(() => {
    setCallSessionOpen(false);
    webphoneRef.current.resetCall();
    notifyCallEnded();
  }, [notifyCallEnded]);

  const sendLeads = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();

    const roleKey = role?.role || profile?.role || null;
    iframe.contentWindow.postMessage({
      type: "call-center-user",
      user: {
        name: profile?.full_name || user.email || "Usuário",
        avatarUrl: profile?.avatar_url || null,
        role: roleKey,
        roleLabel: formatRoleLabel(roleKey),
      },
    }, "*");

    if (!role?.company_id) return;
    companyIdRef.current = role.company_id;

    const pageSize = 1000;
    let from = 0;
    const allLeads: CallCenterLead[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, email, stage, source, tags, value")
        .eq("company_id", role.company_id)
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Erro ao carregar contatos do Call Center:", error);
        return;
      }

      if (!data?.length) break;
      allLeads.push(...(data as CallCenterLead[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const leads = allLeads.filter((lead) => lead.phone || lead.telefone);
    const leadIds = leads.map((lead) => lead.id);
    const coldCallMap = await loadColdCallStates(role.company_id, leadIds);
    const leadsWithState = leads.map((lead) => ({
      ...lead,
      coldCallState: coldCallMap.get(lead.id) || { attempts: [], outcome: "pendente" },
    }));

    iframe.contentWindow.postMessage({ type: "call-center-leads", leads: leadsWithState }, "*");
  }, [loadColdCallStates]);

  const startNvoipApiCall = useCallback(async (rawNumber: string, leadName: string, leadId?: string | null) => {
    const cleanPhone = normalizePhoneForNvoip(rawNumber);
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      throw new Error("Numero invalido para ligacao. Use DDD + numero do contato.");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario nao autenticado.");

    const { data: role } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!role?.company_id) throw new Error("Empresa nao encontrada.");

    const { data: callRecord, error: recordError } = await supabase
      .from("call_history")
      .insert({
        company_id: role.company_id,
        lead_id: leadId || null,
        user_id: user.id,
        phone_number: cleanPhone,
        lead_name: leadName,
        status: "iniciando",
      })
      .select("id")
      .single();

    if (recordError) throw recordError;

    const { data, error } = await supabase.functions.invoke("nvoip-call", {
      body: { action: "make-call", called: cleanPhone },
    });

    if (error) throw new Error(error.message || "Erro na Nvoip");
    if (data?.success === false || data?.error) throw new Error(data?.error || "A Nvoip recusou a ligacao.");

    const callId = data?.callId || data?.id || data?.data?.callId || null;
    apiCallRef.current = {
      callId,
      recordId: callRecord?.id || null,
      startedAt: new Date().toISOString(),
    };

    if (callRecord?.id) {
      await supabase
        .from("call_history")
        .update({ nvoip_call_id: callId, status: "chamando" })
        .eq("id", callRecord.id);
    }

    toast.success("Ligacao iniciada pela Nvoip.");
  }, []);

  const placeCall = useCallback(async (rawNumber: string, leadName: string, leadId?: string | null) => {
    const wp = webphoneRef.current;
    const cleanPhone = normalizePhoneForNvoip(rawNumber);
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      throw new Error("Numero invalido para ligacao. Use DDD + numero do contato.");
    }

    if (!wp.isWebphoneReady()) {
      await wp.reload(wp.regStatus === "error");
      const registered = await wp.waitUntilRegistered();
      if (registered) {
        await wp.call(cleanPhone, leadName);
        return "webphone" as const;
      }
      await startNvoipApiCall(cleanPhone, leadName, leadId || null);
      return "api" as const;
    }

    await wp.call(cleanPhone, leadName);
    return "webphone" as const;
  }, [startNvoipApiCall]);

  const finishNvoipApiCall = useCallback(async () => {
    const current = apiCallRef.current;
    apiCallRef.current = { callId: null, recordId: null, startedAt: null };

    if (current.callId) {
      try {
        await supabase.functions.invoke("nvoip-call", {
          body: { action: "end-call", callId: current.callId },
        });
      } catch (error) {
        console.error("Erro ao encerrar chamada Nvoip:", error);
      }
    }

    if (current.recordId) {
      const duration = current.startedAt
        ? Math.max(0, Math.round((Date.now() - new Date(current.startedAt).getTime()) / 1000))
        : 0;
      await supabase
        .from("call_history")
        .update({
          status: "finalizado",
          call_end: new Date().toISOString(),
          duration_seconds: duration,
          call_result: duration > 0 ? "encerrada" : "nao_atendida",
        })
        .eq("id", current.recordId);
    }
  }, []);

  useEffect(() => {
    const onMsg = async (event: MessageEvent) => {
      if (event.data?.type === "call-center-ready") sendLeads();
      if (event.data?.type === "call-center-navigate") {
        const path = event.data?.path;
        if (typeof path === "string" && path.startsWith("/")) navigate(path);
      }
      if (event.data?.type === "call-center-open-nvoip") setNvoipOpen(true);
      if (event.data?.type === "call-center-open-dialer") setDialerOpen(true);
      if (event.data?.type === "call-center-start-call") {
        const { leadId, leadName, phone } = event.data;
        const number = phone ? String(phone) : "";
        const name = leadName ? String(leadName) : "Contato";
        let ok = false;

        try {
          const mode = await placeCall(number, name, leadId || null);
          if (mode === "webphone") setCallSessionOpen(true);
          ok = true;
        } catch (error: any) {
          const message = error?.message || "Nao foi possivel iniciar a ligacao pela Nvoip.";
          toast.error(message);
          if (/Conta Nvoip|NumberSIP|User Token|configur/i.test(message)) {
            setNvoipOpen(true);
          }
        }

        iframeRef.current?.contentWindow?.postMessage({
          type: ok ? "call-center-call-started" : "call-center-call-failed",
          leadId,
          leadName,
          phone,
        }, "*");
      }
      if (event.data?.type === "call-center-end-call") {
        webphoneRef.current.hangup();
        await finishNvoipApiCall();
        closeCallSession();
      }
      if (event.data?.type === "call-center-register-attempt") {
        const { leadId, leadName, phone, key } = event.data;
        if (!leadId || !key) return;
        try {
          const result = await registerAttempt(String(leadId), key as AttemptType, String(leadName || ""), String(phone || ""));
          toast.success(`Tentativa registrada: ${result.label}`, {
            description: `Total: ${result.attempts.length}`,
          });
          postRegistrationResult({
            ok: true,
            leadId,
            kind: "attempt",
            label: result.label,
            attempts: result.attempts,
            outcome: result.outcome,
          });
        } catch (error: any) {
          const message = error?.message || "Não foi possível registrar a tentativa.";
          toast.error(message);
          postRegistrationResult({ ok: false, leadId, error: message });
        }
      }
      if (event.data?.type === "call-center-register-outcome") {
        const { leadId, leadName, phone, key } = event.data;
        if (!leadId || !key) return;
        try {
          const result = await registerOutcome(String(leadId), key as Outcome, String(leadName || ""), String(phone || ""));
          toast.success(`Resultado salvo: ${result.label}`);
          postRegistrationResult({
            ok: true,
            leadId,
            kind: "outcome",
            label: result.label,
            attempts: result.attempts,
            outcome: result.outcome,
          });
        } catch (error: any) {
          const message = error?.message || "Não foi possível salvar o resultado.";
          toast.error(message);
          postRegistrationResult({ ok: false, leadId, error: message });
        }
      }
      if (event.data?.type === "call-center-pipeline-request") {
        await sendPipelineData(false);
      }
      if (event.data?.type === "call-center-pipeline-sync") {
        await sendPipelineData(true);
      }
      if (event.data?.type === "call-center-pipeline-move") {
        const { pipelineId, toStage } = event.data;
        if (!pipelineId || !toStage) return;
        try {
          await movePipelineStage(String(pipelineId), toStage as HunterStage);
          toast.success("Lead movido no pipeline");
          postPipelineMoveResult({ ok: true, pipelineId, toStage });
        } catch (error: any) {
          const message = error?.message || "Não foi possível mover o lead.";
          toast.error(message);
          postPipelineMoveResult({ ok: false, pipelineId, error: message });
        }
      }
    };

    window.addEventListener("message", onMsg);

    const iframe = iframeRef.current;
    iframe?.addEventListener("load", sendLeads);
    return () => {
      window.removeEventListener("message", onMsg);
      iframe?.removeEventListener("load", sendLeads);
    };
  }, [closeCallSession, finishNvoipApiCall, movePipelineStage, navigate, placeCall, postPipelineMoveResult, postRegistrationResult, registerAttempt, registerOutcome, sendLeads, sendPipelineData]);

  useEffect(() => {
    sendLeads();
  }, [sendLeads]);

  useEffect(() => {
    const prev = prevCallStateRef.current;
    prevCallStateRef.current = webphone.callState;
    const wasLive = ["outgoing", "ringing", "active", "incoming"].includes(prev);
    const endedNow = ["ended", "failed"].includes(webphone.callState);

    if (!callSessionOpen || !wasLive || !endedNow) return;

    if (webphone.callState === "failed") {
      toast.error(webphone.callError || "Ligacao encerrada antes de conectar. Verifique microfone e credenciais SIP.");
    }

    const delay = webphone.duration > 0 ? 400 : 1800;
    const timer = window.setTimeout(() => {
      closeCallSession();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [callSessionOpen, closeCallSession, webphone.callError, webphone.callState, webphone.duration]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const webphoneStatusText = (() => {
    if (webphone.callState === "failed") {
      return webphone.callError ? `Falha: ${webphone.callError}` : "Falha na ligação";
    }
    if (webphone.callState === "active") return `Conectado - ${formatDuration(webphone.duration)}`;
    if (webphone.callState === "ringing" || webphone.callState === "outgoing") return "☎ Tocando...";
    if (webphone.callState === "ended") return "Ligação encerrada";
    return "☎ Chamando...";
  })();

  const handleDialerCall = async () => {
    const number = dialerNumber.replace(/\D/g, "");
    if (number.length < 10) {
      toast.error("Informe DDD + numero para realizar a ligacao.");
      return;
    }

    try {
      const mode = await placeCall(number, number, null);
      if (mode === "webphone") setCallSessionOpen(true);
      setDialerOpen(false);
    } catch (error: any) {
      const message = error?.message || "Nao foi possivel iniciar a ligacao pela Nvoip.";
      toast.error(message);
      if (/Conta Nvoip|NumberSIP|User Token|configur/i.test(message)) {
        setDialerOpen(false);
        setNvoipOpen(true);
      }
    }
  };

  return (
    <div className="h-full w-full min-h-screen bg-background flex flex-col">
      <iframe
        ref={iframeRef}
        title="Call Center Preview"
        src="/call-center.html"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 80px)",
          height: "100%",
          border: "0",
          background: "#0a0c0f",
        }}
      />
      <Dialog open={nvoipOpen} onOpenChange={setNvoipOpen}>
        <DialogContent
          className="w-[min(960px,calc(100vw-40px))] max-w-none max-h-[88vh] overflow-y-auto border-emerald-500/20 bg-background p-0 text-foreground shadow-2xl shadow-black/70"
          style={nvoipDialogTheme}
        >
          <DialogHeader className="border-b border-border bg-card/70 px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Credenciais da Conta Nvoip
            </DialogTitle>
          </DialogHeader>
          <div className="bg-background px-6 py-5">
            <NvoipAccountPanel />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={dialerOpen} onOpenChange={setDialerOpen}>
        <DialogContent className="w-[min(530px,calc(100vw-24px))] max-w-none gap-0 overflow-hidden rounded-xl border-slate-200 bg-slate-50 p-0 text-slate-950 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-950">
              <PhoneCall className="h-7 w-7 text-emerald-500" />
              Call Center
            </DialogTitle>
            <p className="text-sm font-normal text-slate-500">Softphone WebRTC — ligações diretas no navegador</p>
          </DialogHeader>

          <div className="border-b border-slate-200 bg-[#0f4445] px-4 py-3 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-300" />
                <span className="font-semibold">Webphone NVOIP</span>
                {webphone.sipNumber ? <span className="truncate text-sm text-slate-300">— {webphone.sipNumber}</span> : null}
              </div>
              <span className={`rounded-md px-3 py-1 text-xs font-semibold ${webphoneReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                ● {webphoneStatusLabel}
              </span>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <input
                value={dialerNumber}
                onChange={(event) => setDialerNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleDialerCall();
                }}
                placeholder="DDD + número"
                className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <Button
                className="h-10 w-12 bg-emerald-300 text-emerald-900 hover:bg-emerald-400"
                onClick={handleDialerCall}
                disabled={!dialerNumber.trim()}
                aria-label="Ligar"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {dialerKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="h-10 rounded-md border border-slate-200 bg-white text-base font-medium text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50"
                  onClick={() => setDialerNumber((current) => current + key)}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className={`text-sm ${webphoneReady ? "text-emerald-600" : "text-amber-600"}`}>
                {webphoneReady ? "✓ Pronto — WSS registrado. Ligações saem direto pelo navegador." : "Aguardando registro WSS do Webphone."}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-900"
                onClick={() => setDialerNumber((current) => current.slice(0, -1))}
                disabled={!dialerNumber}
              >
                <Delete className="mr-1 h-4 w-4" />
                Apagar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>›_ Diagnóstico SIP <span className={webphoneReady ? "text-emerald-500" : "text-red-500"}>●</span></span>
            <span>⌃</span>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={webphoneCallOpen} onOpenChange={() => {}}>
        <DialogContent
          className="w-[min(472px,calc(100vw-24px))] max-w-none rounded-lg border-0 bg-[#111827] p-5 text-slate-50 shadow-2xl shadow-black/70 [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle className="text-center">Ligação em andamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600">
              <Phone className="h-8 w-8 text-blue-100" />
            </div>
            <div className="space-y-1 text-center">
              <div className="text-xl font-bold tracking-wide">{webphone.remoteNumber || "Contato"}</div>
              <div className="text-xs text-slate-400">↗ Saída — WebRTC</div>
              <div className="hidden text-sm font-medium text-blue-300">
                {webphone.callState === "active" && `Conectado · ${formatDuration(webphone.duration)}`}
              </div>
              <div className={`text-sm font-medium ${webphone.callState === "failed" ? "text-red-400" : "text-blue-300"}`}>
                {webphoneStatusText}
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 pt-1">
              <Button
                variant={webphone.muted ? "default" : "outline"}
                className="h-9 border-slate-600 bg-transparent text-slate-50 hover:bg-slate-800"
                onClick={() => webphone.toggleMute()}
                disabled={webphone.callState !== "active"}
              >
                {webphone.muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {webphone.muted ? "Silenciado" : "Microfone"}
              </Button>
              <Button
                className="h-9 bg-red-600 text-white hover:bg-red-700"
                onClick={() => {
                  webphone.hangup();
                  finishNvoipApiCall();
                  closeCallSession();
                }}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Encerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallCenterPreview;
