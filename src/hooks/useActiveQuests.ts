import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ActiveQuest {
  progress_id: string | null;
  quest_id: string;
  name: string;
  description: string | null;
  type: "daily" | "weekly" | "monthly" | "special";
  goal_metric: string;
  goal_value: number;
  xp_reward: number;
  coin_reward: number;
  icon: string | null;
  current_value: number;
  completed_at: string | null;
  claimed_at: string | null;
  period_start: string;
}

function periodStart(type: string): string {
  const d = new Date();
  if (type === "daily") return d.toISOString().slice(0, 10);
  if (type === "weekly") {
    const day = d.getDay() || 7; // monday=1
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  }
  if (type === "monthly") {
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function useActiveQuests(userId: string | null, companyId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["active-quests", userId, companyId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      // Ensure progress is up-to-date
      await supabase.rpc("recalc_quest_progress", {
        p_user_id: userId!,
        p_company_id: companyId!,
      });

      // Get quests (templates + company-specific)
      const { data: quests, error: qErr } = await supabase
        .from("prospecting_quests")
        .select("*")
        .eq("active", true)
        .or(`company_id.eq.${companyId},company_id.is.null`);
      if (qErr) throw qErr;

      // Get progress
      const { data: progress, error: pErr } = await supabase
        .from("prospecting_quest_progress")
        .select("*")
        .eq("user_id", userId!);
      if (pErr) throw pErr;

      const result: ActiveQuest[] = (quests || []).map((q: any) => {
        const ps = periodStart(q.type);
        const pr = progress?.find(
          (p: any) => p.quest_id === q.id && p.period_start === ps
        );
        return {
          progress_id: pr?.id ?? null,
          quest_id: q.id,
          name: q.name,
          description: q.description,
          type: q.type,
          goal_metric: q.goal_metric,
          goal_value: Number(q.goal_value),
          xp_reward: q.xp_reward,
          coin_reward: q.coin_reward,
          icon: q.icon,
          current_value: Number(pr?.current_value ?? 0),
          completed_at: pr?.completed_at ?? null,
          claimed_at: pr?.claimed_at ?? null,
          period_start: ps,
        };
      });
      return result;
    },
  });

  const claim = useMutation({
    mutationFn: async (progress_id: string) => {
      const { data, error } = await supabase.rpc("claim_quest_reward", {
        p_progress_id: progress_id,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`+${data?.xp || 0} XP · +${data?.coins || 0} 💎`, {
        description: "Recompensa resgatada!",
      });
      qc.invalidateQueries({ queryKey: ["active-quests"] });
      qc.invalidateQueries({ queryKey: ["player-profile"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao resgatar"),
  });

  return { ...query, claim };
}
