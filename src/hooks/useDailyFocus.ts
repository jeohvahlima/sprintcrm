import { useMemo } from "react";
import { useUserGoalProgress, type GoalProgress, type GoalMetric } from "./useCommercialGoals";
import { useUltimoDiagnostico } from "./useDiagnostico360";
import { useLeaderboard, type LeaderEntry } from "./useLeaderboard";
import { usePlayerProfile } from "./usePlayerProfile";

export interface FocusMetric {
  metric: GoalMetric | "prospections_fallback";
  label: string;
  emoji: string;
  target: number;
  current: number;
  progress_pct: number;
}

export interface DailyFocus {
  metrics: FocusMetric[];
  overall_progress_pct: number;
  /** Receita estimada não gerada hoje pelo gap de execução. */
  perda_estimada_hoje: number;
  /** % da rotina executada (0-100). */
  rotina_executada_pct: number;
  /** Posição do usuário no leaderboard semanal (1-based). null se não rankeado. */
  posicao: number | null;
  total_jogadores: number;
  /** Diferença em XP até o próximo colocado acima (positiva). 0 se já é #1. */
  xp_para_subir: number;
  proximo_acima: LeaderEntry | null;
  fonte: "goals" | "diagnostico" | "vazio";
  loading: boolean;
}

const METRIC_LABELS: Record<GoalMetric, { label: string; emoji: string }> = {
  leads_prospected: { label: "Prospecções", emoji: "🎯" },
  calls: { label: "Ligações", emoji: "📞" },
  responses: { label: "Respostas", emoji: "💬" },
  opportunities: { label: "Oportunidades", emoji: "✨" },
  meetings_scheduled: { label: "Reuniões", emoji: "🗓️" },
  sales_closed: { label: "Vendas", emoji: "🏆" },
  gross_value: { label: "Faturamento", emoji: "💰" },
};

export function useDailyFocus(): DailyFocus {
  const { companyId, userId } = usePlayerProfile();
  const { data: goalsRaw, isLoading: l1 } = useUserGoalProgress("daily");
  const { data: diag, isLoading: l2 } = useUltimoDiagnostico();
  const { data: leaderboard = [], isLoading: l3 } = useLeaderboard(companyId, 50);

  return useMemo<DailyFocus>(() => {
    const goals = (goalsRaw || []) as GoalProgress[];
    const ticket = Number(diag?.ticket_medio) || 0;
    const conv = (Number(diag?.taxa_conversao) || 0) / 100;

    let metrics: FocusMetric[] = [];
    let fonte: DailyFocus["fonte"] = "vazio";

    if (goals.length > 0) {
      fonte = "goals";
      metrics = goals.map((g) => {
        const meta = METRIC_LABELS[g.metric] || { label: g.metric, emoji: "•" };
        return {
          metric: g.metric,
          label: meta.label,
          emoji: meta.emoji,
          target: g.target_value,
          current: g.current_value,
          progress_pct: Math.min(100, Math.round(g.progress_pct || 0)),
        };
      });
    } else if (diag?.prospeccoes_dia_ideal && diag.prospeccoes_dia_ideal > 0) {
      fonte = "diagnostico";
      const targetProsp = Number(diag.prospeccoes_dia_ideal);
      metrics = [
        {
          metric: "prospections_fallback",
          label: "Prospecções",
          emoji: "🎯",
          target: targetProsp,
          current: 0,
          progress_pct: 0,
        },
      ];
      if (conv > 0) {
        const reunioes = Math.round(targetProsp * conv);
        metrics.push({
          metric: "meetings_scheduled",
          label: "Reuniões",
          emoji: "🗓️",
          target: reunioes,
          current: 0,
          progress_pct: 0,
        });
      }
    }

    const overall =
      metrics.length > 0
        ? Math.round(metrics.reduce((s, m) => s + m.progress_pct, 0) / metrics.length)
        : 0;

    // Perda estimada hoje: prospecções faltantes × conv × ticket
    const prospMetric = metrics.find(
      (m) => m.metric === "leads_prospected" || m.metric === "prospections_fallback"
    );
    const gapProsp = prospMetric ? Math.max(0, prospMetric.target - prospMetric.current) : 0;
    const perda = gapProsp * conv * ticket;

    // Posição no leaderboard
    const idx = leaderboard.findIndex((l) => l.user_id === userId);
    const posicao = idx >= 0 ? idx + 1 : null;
    const proximo = idx > 0 ? leaderboard[idx - 1] : null;
    const xp_para_subir = proximo && idx >= 0 ? Math.max(0, proximo.xp_total - leaderboard[idx].xp_total) : 0;

    return {
      metrics,
      overall_progress_pct: overall,
      perda_estimada_hoje: perda,
      rotina_executada_pct: overall,
      posicao,
      total_jogadores: leaderboard.length,
      xp_para_subir,
      proximo_acima: proximo,
      fonte,
      loading: l1 || l2 || l3,
    };
  }, [goalsRaw, diag, leaderboard, userId, l1, l2, l3]);
}
