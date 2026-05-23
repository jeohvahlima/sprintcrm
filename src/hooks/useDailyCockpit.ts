import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";
import { toast } from "sonner";

export type Shift = "manha" | "tarde" | "noite";
export type EnergyLevel = "alta" | "media" | "baixa";

export interface DailyMission {
  id: string;
  title: string;
  description: string | null;
  role_target: string | null;
  shift: Shift;
  weekday: number | null;
  xp_reward: number;
  icon: string | null;
  active: boolean;
}

export interface MissionProgress {
  id: string;
  mission_id: string;
  status: "pending" | "done" | "skipped";
  completed_at: string | null;
  xp_awarded: number;
}

export interface MissionWithProgress extends DailyMission {
  progress?: MissionProgress;
}

const today = () => new Date().toISOString().slice(0, 10);

export function currentShift(): Shift {
  const h = new Date().getHours();
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

export function useDailyMissions() {
  const { userId, companyId } = usePlayerProfile();
  const qc = useQueryClient();

  const missionsQuery = useQuery({
    queryKey: ["daily-missions", companyId, userId],
    enabled: !!userId && !!companyId,
    queryFn: async (): Promise<MissionWithProgress[]> => {
      const weekday = new Date().getDay();
      const { data: missions, error: e1 } = await supabase
        .from("daily_missions")
        .select("*")
        .eq("company_id", companyId!)
        .eq("active", true)
        .or(`weekday.is.null,weekday.eq.${weekday}`)
        .order("shift", { ascending: true });
      if (e1) throw e1;

      const { data: progress, error: e2 } = await supabase
        .from("daily_mission_progress")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today());
      if (e2) throw e2;

      const map = new Map((progress || []).map((p: any) => [p.mission_id, p]));
      return (missions || []).map((m: any) => ({
        ...m,
        progress: map.get(m.id) as MissionProgress | undefined,
      }));
    },
  });

  const complete = useMutation({
    mutationFn: async (missionId: string) => {
      if (!userId || !companyId) throw new Error("no auth");
      const { error } = await supabase
        .from("daily_mission_progress")
        .upsert(
          {
            mission_id: missionId,
            user_id: userId,
            company_id: companyId,
            log_date: today(),
            status: "done",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "mission_id,user_id,log_date" }
        );
      if (error) throw error;
    },
    onSuccess: (_, missionId) => {
      const mission = missionsQuery.data?.find((m) => m.id === missionId);
      toast.success(`✅ Missão concluída`, {
        description: mission ? `+${mission.xp_reward} XP — ${mission.title}` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["daily-missions"] });
      qc.invalidateQueries({ queryKey: ["player-profile"] });
    },
  });

  const reopen = useMutation({
    mutationFn: async (missionId: string) => {
      if (!userId) throw new Error("no auth");
      const { error } = await supabase
        .from("daily_mission_progress")
        .update({ status: "pending", completed_at: null })
        .eq("mission_id", missionId)
        .eq("user_id", userId)
        .eq("log_date", today());
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-missions"] }),
  });

  return { ...missionsQuery, complete, reopen };
}

export function useDailyEnergy() {
  const { userId, companyId } = usePlayerProfile();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["daily-energy", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_energy_log")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today())
        .maybeSingle();
      if (error) throw error;
      return (data?.energy_level as EnergyLevel) || null;
    },
  });

  const setEnergy = useMutation({
    mutationFn: async (level: EnergyLevel) => {
      if (!userId || !companyId) throw new Error("no auth");
      const { error } = await supabase
        .from("daily_energy_log")
        .upsert(
          { user_id: userId, company_id: companyId, log_date: today(), energy_level: level },
          { onConflict: "user_id,log_date" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-energy"] }),
  });

  return { energy: query.data, setEnergy };
}

export function useEndOfDayReview() {
  const { userId, companyId } = usePlayerProfile();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["eod-review", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("end_of_day_reviews")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async (payload: {
      focus_score: number;
      objections_count: number;
      meetings_count: number;
      biggest_difficulty?: string;
      wins?: string;
      notes?: string;
    }) => {
      if (!userId || !companyId) throw new Error("no auth");
      const { error } = await supabase
        .from("end_of_day_reviews")
        .upsert(
          { user_id: userId, company_id: companyId, log_date: today(), ...payload },
          { onConflict: "user_id,log_date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review do dia salvo");
      qc.invalidateQueries({ queryKey: ["eod-review"] });
    },
  });

  return { review: query.data, submit };
}
