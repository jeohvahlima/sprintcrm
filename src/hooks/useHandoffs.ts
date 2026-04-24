import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";

export function useMyHandoffsAsCloser() {
  const { userId, companyId } = usePlayerProfile();
  return useQuery({
    queryKey: ["handoffs-closer", userId],
    enabled: !!userId && !!companyId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sdr_closer_handoffs" as any)
        .select("*, lead:leads(id, name, phone, telefone, email, value, stage)")
        .eq("company_id", companyId!)
        .eq("closer_id", userId!)
        .in("status", ["pending", "accepted", "meeting_scheduled"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useMyHandoffsAsSDR() {
  const { userId, companyId } = usePlayerProfile();
  return useQuery({
    queryKey: ["handoffs-sdr", userId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sdr_closer_handoffs" as any)
        .select("*, lead:leads(id, name), closer:profiles!sdr_closer_handoffs_closer_id_fkey(id, full_name)")
        .eq("company_id", companyId!)
        .eq("sdr_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        // Fallback sem join se a FK não estiver registrada
        const { data: d2 } = await supabase
          .from("sdr_closer_handoffs" as any)
          .select("*")
          .eq("company_id", companyId!)
          .eq("sdr_id", userId!)
          .order("created_at", { ascending: false })
          .limit(50);
        return (d2 || []) as any[];
      }
      return (data || []) as any[];
    },
  });
}

export function useCreateHandoff() {
  const { userId, companyId } = usePlayerProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      lead_id: string;
      closer_id?: string | null;
      sdr_notes?: string;
      scheduled_meeting_at?: string | null;
      expected_value?: number;
      qualification_score?: number;
    }) => {
      const { error } = await supabase.from("sdr_closer_handoffs" as any).insert({
        company_id: companyId,
        sdr_id: userId,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handoffs-sdr"] });
      qc.invalidateQueries({ queryKey: ["handoffs-closer"] });
    },
  });
}

export function useUpdateHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("sdr_closer_handoffs" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handoffs-sdr"] });
      qc.invalidateQueries({ queryKey: ["handoffs-closer"] });
    },
  });
}

export function useCompanyClosers() {
  const { companyId } = usePlayerProfile();
  return useQuery({
    queryKey: ["company-closers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prospecting_player_profile")
        .select("user_id, commercial_role")
        .eq("company_id", companyId)
        .in("commercial_role", ["closer", "hybrid"]);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return (profiles || []) as any[];
    },
  });
}
