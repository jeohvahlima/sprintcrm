import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";
import type { GoalPeriod } from "./useCommercialGoals";

export function useTeamPerformance(period: GoalPeriod = "daily") {
  const { companyId } = usePlayerProfile();
  return useQuery({
    queryKey: ["team-performance", companyId, period],
    enabled: !!companyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_performance", {
        p_company_id: companyId!,
        p_period: period,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
