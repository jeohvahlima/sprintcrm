import { useUserGoalProgress, type GoalMetric } from "@/hooks/useCommercialGoals";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Phone, MessageSquare, Sparkles, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const METRIC_LABEL: Record<GoalMetric, string> = {
  leads_prospected: "Prospeções",
  calls: "Ligações",
  responses: "Respostas",
  opportunities: "Oportunidades",
  meetings_scheduled: "Reuniões",
  sales_closed: "Vendas",
  gross_value: "Receita",
};

const METRIC_ICON: Record<GoalMetric, any> = {
  leads_prospected: Target,
  calls: Phone,
  responses: MessageSquare,
  opportunities: Sparkles,
  meetings_scheduled: Calendar,
  sales_closed: TrendingUp,
  gross_value: DollarSign,
};

interface Props {
  period?: "daily" | "weekly" | "monthly";
  compact?: boolean;
}

export function GoalProgressHUD({ period = "daily", compact = false }: Props) {
  const { data: goals = [], isLoading } = useUserGoalProgress(period);
  const periodLabel = period === "daily" ? "Hoje" : period === "weekly" ? "Semana" : "Mês";
  const progressGoal = goals.find((g) => g.metric === "leads_prospected") || goals[0];
  const meetingGoal = goals.find((g) => g.metric === "meetings_scheduled");
  const revenueGoal = goals.find((g) => g.metric === "gross_value");
  const recoveryHint = progressGoal ? Math.max(progressGoal.target_value - Number(progressGoal.current_value), 0) : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="animate-pulse h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (!progressGoal) {
    return (
      <Card className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Meta do dia</div>
            <div className="mt-2 text-lg text-slate-700">Nenhuma meta encontrada</div>
            <p className="text-sm text-slate-500 mt-1">Defina metas comerciais para acompanhar desempenho e receber recomendações.</p>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">{periodLabel}</div>
        </div>
      </Card>
    );
  }

  const pct = Math.min(Math.max(progressGoal.progress_pct, 0), 100);
  const isLow = pct < 40;

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white shadow-2xl">
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Top row: meta + status */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-blue-200">Meta do dia</div>
              <div className="mt-2 text-3xl font-black">{progressGoal.target_value.toLocaleString("pt-BR")} prospecções</div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur border border-white/10">
              <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", isLow ? "bg-amber-400" : "bg-emerald-400")} />
              {isLow ? "Atenção: ritmo abaixo" : "Operação no ritmo"}
            </div>
          </div>

          {/* Main progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest font-bold text-blue-200">Progresso</div>
                <div className="text-sm text-blue-100 mt-1">{progressGoal.current_value.toLocaleString("pt-BR")} / {progressGoal.target_value.toLocaleString("pt-BR")}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">{Math.round(pct)}%</div>
                <div className="text-xs text-blue-200">Faltam {recoveryHint.toLocaleString("pt-BR")}</div>
              </div>
            </div>
            <div className="h-4 rounded-full bg-white/15 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700 shadow-lg shadow-emerald-500/50"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur">
              <div className="text-xs uppercase tracking-widest font-bold text-blue-200">Reuniões</div>
              <div className="mt-2 text-2xl font-black">{meetingGoal ? `${Number(meetingGoal.current_value)}/${meetingGoal.target_value}` : "—"}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur">
              <div className="text-xs uppercase tracking-widest font-bold text-blue-200">Receita</div>
              <div className="mt-2 text-xl font-black">{revenueGoal ? `R$ ${(Number(revenueGoal.current_value) / 1000).toFixed(0)}k` : "—"}</div>
            </div>
            <div className="rounded-xl bg-red-500/15 p-4 border border-red-500/30 backdrop-blur">
              <div className="text-xs uppercase tracking-widest font-bold text-red-200">Perda estimada</div>
              <div className="mt-2 text-xl font-black text-red-200">R$ {(recoveryHint / 1000).toFixed(1)}k</div>
            </div>
          </div>

          {/* Action button */}
          <button className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm uppercase tracking-wide hover:shadow-lg hover:shadow-emerald-500/50 transition">
            🔥 Recuperar agora
          </button>
        </div>
      </div>
    </Card>
  );
}
