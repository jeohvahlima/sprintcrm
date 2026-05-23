import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type HunterStage =
  | "novo"
  | "tentativa_contato"
  | "follow_up"
  | "contato_realizado"
  | "buscando_decisor"
  | "conversa_decisor"
  | "oportunidade"
  | "descartado";

export interface HunterLead {
  id: string;
  company_id: string;
  lead_id: string | null;
  assigned_to: string | null;
  stage: HunterStage;
  substatus: string | null;
  attempts: number;
  last_action_at: string | null;
  next_action_at: string | null;
  next_action_reason: string | null;
  contact_person_name: string | null;
  decisor_classificacao: "A" | "B" | "C" | null;
  dor_identificada: string | null;
  meeting_at: string | null;
  discard_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  lead_name?: string | null;
  lead_phone?: string | null;
  lead_company?: string | null;
}

export interface HunterEvent {
  id: string;
  company_id: string;
  lead_pipeline_id: string;
  user_id: string | null;
  event_type: string;
  from_stage: HunterStage | null;
  to_stage: HunterStage | null;
  payload: any;
  points: number;
  created_at: string;
}

export function useHunterPipeline() {
  const [leads, setLeads] = useState<HunterLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      const { data: { user } } = await supabase.auth.getUser();
      if (!cid) {
        setLeads([]);
        return;
      }
      setCompanyId(cid as string);
      setUserId(user?.id ?? null);

      const all: HunterLead[] = [];
      const PAGE = 500;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("hunter_pipeline_leads" as any)
          .select("*, lead:lead_id(name, phone, company)")
          .eq("company_id", cid as string)
          .order("updated_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((r: any) => {
          all.push({
            ...r,
            lead_name: r.lead?.name ?? null,
            lead_phone: r.lead?.phone ?? null,
            lead_company: r.lead?.company ?? null,
          });
        });
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setLeads(all);
    } catch (e: any) {
      console.error("[useHunterPipeline] load error", e);
      toast.error("Erro ao carregar Pipeline Hunter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`hunter-pipeline-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hunter_pipeline_leads", filter: `company_id=eq.${companyId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, load]);

  const moveStage = useCallback(async (
    pipelineId: string,
    toStage: HunterStage,
    patch: Partial<HunterLead> = {},
  ) => {
    const current = leads.find(l => l.id === pipelineId);
    if (!current) return;
    const fromStage = current.stage;

    // Optimistic
    setLeads(prev => prev.map(l => l.id === pipelineId ? { ...l, ...patch, stage: toStage } : l));

    const { error } = await supabase
      .from("hunter_pipeline_leads" as any)
      .update({ stage: toStage, ...patch })
      .eq("id", pipelineId);

    if (error) {
      toast.error("Erro ao mover lead");
      setLeads(prev => prev.map(l => l.id === pipelineId ? current : l));
      return;
    }

    // Event
    const { data: { user } } = await supabase.auth.getUser();
    let eventType = "stage_moved";
    if (toStage === "contato_realizado") eventType = "contact_made";
    else if (toStage === "conversa_decisor") eventType = "reached_decisor";
    else if (toStage === "oportunidade") eventType = "opportunity";

    await supabase.from("hunter_pipeline_events" as any).insert({
      company_id: current.company_id,
      lead_pipeline_id: pipelineId,
      user_id: user?.id ?? null,
      event_type: eventType,
      from_stage: fromStage,
      to_stage: toStage,
      payload: patch,
    });

    toast.success("Lead movido");
  }, [leads]);

  const logCallAttempt = useCallback(async (pipelineId: string, substatus: string) => {
    const current = leads.find(l => l.id === pipelineId);
    if (!current) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("hunter_pipeline_events" as any).insert({
      company_id: current.company_id,
      lead_pipeline_id: pipelineId,
      user_id: user?.id ?? null,
      event_type: "call_attempt",
      from_stage: current.stage,
      to_stage: current.stage,
      payload: { substatus },
    });
    // Garante estágio = tentativa_contato se ainda estiver em "novo"
    if (current.stage === "novo") {
      await supabase.from("hunter_pipeline_leads" as any)
        .update({ stage: "tentativa_contato", substatus })
        .eq("id", pipelineId);
    } else {
      await supabase.from("hunter_pipeline_leads" as any)
        .update({ substatus })
        .eq("id", pipelineId);
    }
    toast.success(`Tentativa registrada: ${substatus}`);
    load();
  }, [leads, load]);

  const createPipelineLead = useCallback(async (leadId: string, name?: string) => {
    if (!companyId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("hunter_pipeline_leads" as any).insert({
      company_id: companyId,
      lead_id: leadId,
      assigned_to: user?.id ?? null,
      stage: "novo",
    });
    if (error && !error.message.includes("duplicate")) {
      toast.error("Erro ao adicionar ao pipeline");
      return;
    }
    toast.success(`${name ?? "Lead"} adicionado ao pipeline`);
    load();
  }, [companyId, load]);

  const fetchEvents = useCallback(async (pipelineId: string): Promise<HunterEvent[]> => {
    const { data } = await supabase
      .from("hunter_pipeline_events" as any)
      .select("*")
      .eq("lead_pipeline_id", pipelineId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data as any) || [];
  }, []);

  return { leads, loading, companyId, userId, load, moveStage, logCallAttempt, createPipelineLead, fetchEvents };
}
