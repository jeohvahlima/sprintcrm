import { useUserGoalProgress, type GoalMetric } from "@/hooks/useCommercialGoals";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Target, Phone, MessageSquare, Sparkles, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const METRIC_LABEL: Record<GoalMetric, string> = {
  leads_prospected: "Leads",
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

  if (isLoading || goals.length === 0) return null;

  const periodLabel = period === "daily" ? "Hoje" : period === "weekly" ? "Semana" : "Mês";

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Minhas Metas · {periodLabel}
        </h3>
        <span className="text-xs text-muted-foreground">
          {goals.filter((g) => g.progress_pct >= 100).length}/{goals.length} batidas
        </span>
      </div>
      <div className={cn("grid gap-3", compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
        {goals.map((g) => {
          const Icon = METRIC_ICON[g.metric] || Target;
          const pct = Math.min(g.progress_pct, 100);
          const reached = g.progress_pct >= 100;
          const lowAlert = g.progress_pct < 50 && period === "daily";
          const isMoney = g.metric === "gross_value";
          return (
            <div
              key={g.goal_id}
              className={cn(
                "p-3 rounded-lg border bg-card transition-all",
                reached && "border-emerald-500/40 bg-emerald-500/5",
                lowAlert && !reached && "border-amber-500/40 bg-amber-500/5"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {METRIC_LABEL[g.metric]}
                </div>
                <span className={cn("text-xs font-bold", reached ? "text-emerald-500" : lowAlert ? "text-amber-500" : "text-foreground")}>
                  {Math.round(g.progress_pct)}%
                </span>
              </div>
              <div className="text-lg font-bold mb-1.5">
                {isMoney
                  ? `R$ ${Number(g.current_value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                  : Number(g.current_value).toLocaleString("pt-BR")}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  / {isMoney ? `R$ ${Number(g.target_value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : g.target_value}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
