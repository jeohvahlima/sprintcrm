import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ProspectingQueue {
  id: string;
  name: string;
  channel: string;
  description: string | null;
  color: string | null;
  active: boolean;
  assigned_user_ids: string[] | null;
  created_at: string;
}

export interface QueueLead {
  queue_lead_id: string;
  lead_id: string;
  queue_position: number;
  attempts: number;
  notes: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_tags: string[] | null;
  lead_stage: string | null;
  lead_value: number | null;
  lead_email: string | null;
}

export function useProspectingQueues(companyId?: string | null) {
  return useQuery({
    queryKey: ["prospecting-queues", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_queues")
        .select("*")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProspectingQueue[];
    },
  });
}

export function useQueueStats(queueId?: string | null, userId?: string | null) {
  return useQuery({
    queryKey: ["queue-stats", queueId, userId],
    enabled: !!queueId,
    refetchInterval: 15000,
    queryFn: async () => {
      const base = supabase
        .from("prospecting_queue_leads")
        .select("status", { count: "exact", head: false })
        .eq("queue_id", queueId!);

      const [pendingMine, pendingAll, inProgress, done] = await Promise.all([
        userId
          ? supabase.from("prospecting_queue_leads").select("id", { count: "exact", head: true })
              .eq("queue_id", queueId!).eq("status", "pending").eq("assigned_user_id", userId)
          : Promise.resolve({ count: 0 } as any),
        supabase.from("prospecting_queue_leads").select("id", { count: "exact", head: true })
          .eq("queue_id", queueId!).eq("status", "pending"),
        supabase.from("prospecting_queue_leads").select("id", { count: "exact", head: true })
          .eq("queue_id", queueId!).eq("status", "in_progress"),
        supabase.from("prospecting_queue_leads").select("id", { count: "exact", head: true })
          .eq("queue_id", queueId!).in("status", ["contacted", "qualified", "done"]),
      ]);

      return {
        pendingMine: pendingMine?.count || 0,
        pendingAll: pendingAll?.count || 0,
        inProgress: inProgress?.count || 0,
        done: done?.count || 0,
      };
    },
  });
}

export function useClaimNextLead() {
  return useMutation({
    mutationFn: async ({ queueId, userId }: { queueId: string; userId: string }) => {
      const { data, error } = await supabase.rpc("claim_next_queue_lead" as any, {
        _queue_id: queueId,
        _user_id: userId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row || null) as QueueLead | null;
    },
  });
}

export function useUpdateQueueLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      queueLeadId,
      status,
      outcome,
      notes,
    }: {
      queueLeadId: string;
      status?: string;
      outcome?: string;
      notes?: string;
    }) => {
      const patch: any = { updated_at: new Date().toISOString() };
      if (status) patch.status = status;
      if (outcome) patch.outcome = outcome;
      if (notes !== undefined) patch.notes = notes;
      const { error } = await supabase
        .from("prospecting_queue_leads")
        .update(patch)
        .eq("id", queueLeadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue-stats"] });
    },
  });
}

export function useCreateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      created_by: string;
      name: string;
      channel: string;
      description?: string;
      color?: string;
      assigned_user_ids?: string[];
    }) => {
      const { data, error } = await supabase
        .from("prospecting_queues")
        .insert({
          company_id: input.company_id,
          created_by: input.created_by,
          name: input.name,
          channel: input.channel,
          description: input.description || null,
          color: input.color || null,
          assigned_user_ids: input.assigned_user_ids || [],
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fila criada" });
      qc.invalidateQueries({ queryKey: ["prospecting-queues"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useAddLeadsToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      queueId,
      companyId,
      leadIds,
    }: {
      queueId: string;
      companyId: string;
      leadIds: string[];
    }) => {
      if (leadIds.length === 0) return 0;
      const rows = leadIds.map((lid, i) => ({
        queue_id: queueId,
        company_id: companyId,
        lead_id: lid,
        position: i,
        status: "pending",
      }));
      const { error } = await supabase.from("prospecting_queue_leads").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} leads adicionados à fila` });
      qc.invalidateQueries({ queryKey: ["queue-stats"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useRedistributeQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (queueId: string) => {
      const { data, error } = await supabase.rpc("distribute_queue_leads" as any, {
        _queue_id: queueId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast({ title: `Distribuição aplicada`, description: `${n} leads redistribuídos` });
      qc.invalidateQueries({ queryKey: ["queue-stats"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}
