import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FollowUpEntry {
  id: string;
  company_id: string;
  lead_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  source: "favorite" | "no_response" | "cold_lead" | "manual";
  current_step: number;
  next_due_at: string;
  status: "active" | "completed" | "cooled" | "paused" | "lost";
  outcome: string | null;
  assigned_to: string | null;
  notes: string | null;
  last_executed_at: string | null;
  created_at: string;
}

export interface FollowUpCadenceStep {
  id: string;
  step_number: number;
  days_offset: number;
  label: string;
}

export type FollowChannel = "whatsapp" | "call" | "instagram" | "email" | "sms" | "other";
export type FollowOutcome = "no_response" | "responded" | "meeting" | "sale" | "lost";

export function useFollowUpEsteira() {
  const qc = useQueryClient();

  const cadenceQuery = useQuery({
    queryKey: ["follow-up-cadence"],
    queryFn: async (): Promise<FollowUpCadenceStep[]> => {
      const { data, error } = await (supabase as any)
        .from("follow_up_cadence")
        .select("id, step_number, days_offset, label")
        .order("step_number", { ascending: true });
      if (error) throw error;
      return (data || []) as FollowUpCadenceStep[];
    },
  });

  const entriesQuery = useQuery({
    queryKey: ["follow-up-entries"],
    queryFn: async (): Promise<FollowUpEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("follow_up_entries")
        .select("*")
        .order("next_due_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as FollowUpEntry[];
    },
    refetchInterval: 30000,
  });

  const addEntry = useMutation({
    mutationFn: async (payload: {
      lead_id?: string | null;
      contact_name?: string | null;
      contact_phone?: string | null;
      contact_email?: string | null;
      source: FollowUpEntry["source"];
      notes?: string | null;
    }) => {
      const { data: companyId } = await supabase.rpc("get_my_company_id" as any);
      if (!companyId) throw new Error("Empresa não encontrada");

      const cadence = cadenceQuery.data || [];
      const firstStep = cadence[0];
      if (!firstStep) throw new Error("Cadência não configurada");

      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + firstStep.days_offset);

      const { data: user } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("follow_up_entries").insert({
        company_id: companyId,
        lead_id: payload.lead_id ?? null,
        contact_name: payload.contact_name ?? null,
        contact_phone: payload.contact_phone ?? null,
        contact_email: payload.contact_email ?? null,
        source: payload.source,
        current_step: firstStep.step_number,
        next_due_at: nextDue.toISOString(),
        status: "active",
        assigned_to: user?.user?.id ?? null,
        notes: payload.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-up-entries"] });
      toast.success("Adicionado à esteira de follow-up");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar"),
  });

  const executeFollow = useMutation({
    mutationFn: async (payload: {
      entry_id: string;
      channel: FollowChannel;
      outcome: FollowOutcome;
      notes?: string;
      script?: string;
    }) => {
      const { data, error } = await supabase.rpc("advance_follow_up_entry" as any, {
        p_entry_id: payload.entry_id,
        p_channel: payload.channel,
        p_outcome: payload.outcome,
        p_notes: payload.notes ?? null,
        p_script: payload.script ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-up-entries"] });
      toast.success("Follow-up registrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("follow_up_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-up-entries"] });
      toast.success("Removido");
    },
  });

  return {
    cadence: cadenceQuery.data || [],
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading || cadenceQuery.isLoading,
    addEntry,
    executeFollow,
    removeEntry,
    refetch: () => {
      entriesQuery.refetch();
      cadenceQuery.refetch();
    },
  };
}
