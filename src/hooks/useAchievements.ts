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
  { code: "first_blood", name: "Primeira Venda", description: "Fechou seu primeiro negócio na plataforma", rarity: "rare", icon: "🎯" },
  { code: "velocista", name: "Alta Cadência", description: "50 leads prospectados em um único dia", rarity: "epic", icon: "⚡" },
  { code: "combo_x5", name: "Closer do Dia", description: "5 vendas fechadas no mesmo dia", rarity: "epic", icon: "🏆" },
  { code: "lobo_solitario", name: "Consistência Semanal", description: "7 dias consecutivos com atividade comercial", rarity: "rare", icon: "📈" },
  { code: "implacavel", name: "Disciplina Total", description: "30 dias consecutivos batendo a rotina", rarity: "legendary", icon: "👑" },
  { code: "diamante", name: "Clube R$ 100k", description: "R$ 100 mil acumulados em vendas fechadas", rarity: "legendary", icon: "💼" },
  { code: "lenda", name: "Top Performer", description: "Atingiu o nível 50 da carreira comercial", rarity: "legendary", icon: "🌟" },
  { code: "top_mensal", name: "Vendedor do Mês", description: "Ficou em #1 do ranking mensal da equipe", rarity: "epic", icon: "🥇" },
  { code: "mestre_resposta", name: "Mestre do Engajamento", description: "100 respostas de leads em uma semana", rarity: "rare", icon: "💬" },
  { code: "marcador", name: "Máquina de Reuniões", description: "10 reuniões agendadas em uma semana", rarity: "rare", icon: "📅" },
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
