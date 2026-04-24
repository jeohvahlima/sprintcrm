import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerProfile {
  id: string;
  user_id: string;
  company_id: string;
  level: number;
  xp_total: number;
  xp_current: number;
  class: string;
  title: string | null;
  streak_days: number;
  coins: number;
  avatar_frame: string | null;
  last_activity_date: string | null;
}

export function xpNeededForLevel(level: number) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function getRankByLevel(level: number) {
  if (level >= 100) return { name: "Mítico", className: "rpg-rank-mythic", min: 100 };
  if (level >= 75) return { name: "Diamante", className: "rpg-rank-diamond", min: 75 };
  if (level >= 50) return { name: "Platina", className: "rpg-rank-platinum", min: 50 };
  if (level >= 25) return { name: "Ouro", className: "rpg-rank-gold", min: 25 };
  if (level >= 10) return { name: "Prata", className: "rpg-rank-silver", min: 10 };
  return { name: "Bronze", className: "rpg-rank-bronze", min: 1 };
}

export function usePlayerProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
      const { data: c } = await supabase.rpc("get_my_company_id");
      if (c) setCompanyId(c as string);
    })();
  }, []);

  const query = useQuery({
    queryKey: ["player-profile", userId, companyId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      // Ensure profile exists
      await supabase.rpc("ensure_player_profile", {
        p_user_id: userId!,
        p_company_id: companyId!,
      });
      const { data, error } = await supabase
        .from("prospecting_player_profile")
        .select("*")
        .eq("user_id", userId!)
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as PlayerProfile;
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`player-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prospecting_player_profile",
          filter: `user_id=eq.${userId}`,
        },
        () => query.refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  return { ...query, userId, companyId };
}
