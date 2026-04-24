import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderEntry {
  user_id: string;
  full_name: string;
  level: number;
  xp_total: number;
  streak_days: number;
  coins: number;
}

export function useLeaderboard(companyId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["leaderboard", companyId, limit],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("prospecting_player_profile")
        .select("user_id, level, xp_total, streak_days, coins")
        .eq("company_id", companyId!)
        .order("xp_total", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const ids = (profiles || []).map((p: any) => p.user_id);
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: pr } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        names = Object.fromEntries((pr || []).map((p: any) => [p.id, p.full_name || "Operador"]));
      }
      return (profiles || []).map((p: any) => ({
        ...p,
        full_name: names[p.user_id] || "Operador",
      })) as LeaderEntry[];
    },
  });
}
