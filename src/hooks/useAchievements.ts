import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Achievement {
  code: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
}

export const ALL_ACHIEVEMENTS: Omit<Achievement, "unlocked" | "unlocked_at">[] = [
  { code: "first_blood", name: "First Blood", description: "Sua primeira venda fechada", rarity: "rare", icon: "🩸" },
  { code: "velocista", name: "Velocista", description: "50 leads prospectados em 1 dia", rarity: "epic", icon: "⚡" },
  { code: "combo_x5", name: "Combo x5", description: "5 vendas no mesmo dia", rarity: "epic", icon: "🔥" },
  { code: "lobo_solitario", name: "Lobo Solitário", description: "7 dias seguidos ativo", rarity: "rare", icon: "🐺" },
  { code: "implacavel", name: "Implacável", description: "30 dias seguidos ativo", rarity: "legendary", icon: "👑" },
  { code: "diamante", name: "Diamante", description: "R$ 100k acumulado em vendas", rarity: "legendary", icon: "💎" },
  { code: "lenda", name: "Lenda", description: "Atingiu o nível 50", rarity: "legendary", icon: "🏆" },
  { code: "top_mensal", name: "Top do Mês", description: "Ficou em #1 do ranking mensal", rarity: "epic", icon: "🥇" },
  { code: "mestre_resposta", name: "Mestre da Resposta", description: "100 respostas em uma semana", rarity: "rare", icon: "💬" },
  { code: "marcador", name: "Marcador", description: "10 reuniões em uma semana", rarity: "rare", icon: "📅" },
];

export function useAchievements(userId: string | null) {
  return useQuery({
    queryKey: ["achievements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospecting_achievements")
        .select("achievement_code, unlocked_at, rarity")
        .eq("user_id", userId!);
      if (error) throw error;

      const unlocked = new Set((data || []).map((a: any) => a.achievement_code));
      const map = new Map((data || []).map((a: any) => [a.achievement_code, a.unlocked_at]));

      return ALL_ACHIEVEMENTS.map((a) => ({
        ...a,
        unlocked: unlocked.has(a.code),
        unlocked_at: map.get(a.code) as string | undefined,
      })) as Achievement[];
    },
  });
}
