import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";

export type GoalPeriod = "daily" | "weekly" | "monthly";
export type GoalMetric =
  | "leads_prospected"
  | "calls"
  | "responses"
  | "opportunities"
  | "meetings_scheduled"
  | "sales_closed"
  | "gross_value";

export interface GoalProgress {
  metric: GoalMetric;
  target_value: number;
  current_value: number;
  progress_pct: number;
  goal_id: string;
}

export function useUserGoalProgress(period: GoalPeriod = "daily") {
  const { userId } = usePlayerProfile();
  return useQuery({
    queryKey: ["user-goal-progress", userId, period],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_goal_progress", {
        p_user_id: userId!,
        p_period: period,
      });
      if (error) throw error;
      return (data || []) as GoalProgress[];
    },
  });
}

export function useCompanyGoals() {
  const { companyId } = usePlayerProfile();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["commercial-goals", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_goals" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("scope")
        .order("period");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("commercial_goals" as any).insert({
        ...payload,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commercial-goals", companyId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("commercial_goals" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commercial-goals", companyId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_goals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commercial-goals", companyId] }),
  });

  return { list, create, update, remove };
}
