import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Loader2 } from "lucide-react";

type Metric = "gross_value" | "sales_closed" | "calls" | "meetings_scheduled" | "leads_prospected";
type Period = "daily" | "weekly" | "monthly";
type GoalKey = `${Period}:${Metric}`;

interface Goal {
  id: string;
  metric: Metric;
  period: Period;
  target_value: number;
}

const PERIOD_LABEL: Record<Period, { title: string; caption: string }> = {
  daily: { title: "Hoje", caption: "meta diária" },
  weekly: { title: "Semana", caption: "meta semanal" },
  monthly: { title: "Mês", caption: "meta mensal" },
};

const META_LABEL: Record<Metric, { icon: string; label: string; isCurrency?: boolean }> = {
  gross_value: { icon: "💰", label: "Faturamento", isCurrency: true },
  sales_closed: { icon: "🏆", label: "Vendas fechadas" },
  calls: { icon: "📞", label: "Ligações" },
  meetings_scheduled: { icon: "📅", label: "Reuniões agendadas" },
  leads_prospected: { icon: "🎯", label: "Leads prospectados" },
};

const fmt = (v: number, currency?: boolean) =>
  currency
    ? "R$ " + Math.round(v).toLocaleString("pt-BR")
    : Math.round(v).toLocaleString("pt-BR");

const goalKey = (period: Period, metric: Metric): GoalKey => `${period}:${metric}`;

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getPeriodRange = (period: Period) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
  }

  if (period === "monthly") {
    start.setDate(1);
  }

  const end = new Date(start);
  if (period === "daily") end.setDate(start.getDate() + 1);
  if (period === "weekly") end.setDate(start.getDate() + 7);
  if (period === "monthly") end.setMonth(start.getMonth() + 1);

  const logEnd = new Date(end);
  logEnd.setDate(logEnd.getDate() - 1);

  return {
    start,
    end,
    logStart: formatDate(start),
    logEnd: formatDate(logEnd),
  };
};

export default function MyGoalsPanel() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [realizado, setRealizado] = useState<Partial<Record<GoalKey, number>>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: gData } = await supabase
          .from("commercial_goals")
          .select("id, metric, period, target_value")
          .eq("user_id", user.id)
          .eq("scope", "user")
          .eq("active", true);

        const gs = (gData || []) as Goal[];
        setGoals(gs);

        const progress: Partial<Record<GoalKey, number>> = {};
        await Promise.all((["daily", "weekly", "monthly"] as Period[]).map(async (period) => {
          const range = getPeriodRange(period);
          const [logsResult, callsResult, salesResult] = await Promise.all([
            supabase
              .from("prospecting_daily_logs")
              .select("leads_prospected, meetings_scheduled, sales_closed, gross_value")
              .eq("user_id", user.id)
              .gte("log_date", range.logStart)
              .lte("log_date", range.logEnd)
              .range(0, 9999),
            supabase
              .from("prospecting_interactions")
              .select("id")
              .eq("user_id", user.id)
              .eq("channel", "cold_call")
              .gte("interaction_date", range.logStart)
              .lte("interaction_date", range.logEnd)
              .range(0, 9999),
            supabase
              .from("customer_sales")
              .select("valor_final, status, finalized_at, responsavel_id")
              .eq("responsavel_id", user.id)
              .in("status", ["ganho", "finalizada"])
              .gte("finalized_at", range.start.toISOString())
              .lt("finalized_at", range.end.toISOString())
              .range(0, 9999),
          ]);

          const logs = logsResult.data || [];
          const sales = salesResult.data || [];
          const logSalesClosed = logs.reduce((sum, row: any) => sum + Number(row.sales_closed || 0), 0);
          const logGrossValue = logs.reduce((sum, row: any) => sum + Number(row.gross_value || 0), 0);
          const salesClosed = sales.length;
          const grossValue = sales.reduce((sum, row: any) => sum + Number(row.valor_final || 0), 0);

          progress[goalKey(period, "leads_prospected")] = logs.reduce((sum, row: any) => sum + Number(row.leads_prospected || 0), 0);
          progress[goalKey(period, "meetings_scheduled")] = logs.reduce((sum, row: any) => sum + Number(row.meetings_scheduled || 0), 0);
          progress[goalKey(period, "calls")] = (callsResult.data || []).length;
          progress[goalKey(period, "sales_closed")] = Math.max(logSalesClosed, salesClosed);
          progress[goalKey(period, "gross_value")] = Math.max(logGrossValue, grossValue);
        }));

        setRealizado(progress);
      } catch (e) {
        console.error("MyGoalsPanel error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mb-6 bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando suas metas…
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="mb-6 bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Minha Meta</div>
            <div className="text-xs text-slate-400">Nenhuma meta individual definida ainda. Peça ao gestor para configurar em <b>Metas &amp; Vendas → Individuais</b>.</div>
          </div>
        </div>
      </div>
    );
  }

  const byPeriod = (["daily", "weekly", "monthly"] as Period[]).map((period) => ({
    period,
    goals: goals.filter((g) => g.period === period),
  })).filter((group) => group.goals.length > 0);
  const reachedCount = goals.filter((g) => {
    const real = realizado[goalKey(g.period, g.metric)] ?? 0;
    return g.target_value > 0 && real >= g.target_value;
  }).length;

  return (
    <div className="mb-6 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-700/30 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Target className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            Minha Meta
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-bold">individual</span>
          </div>
          <div className="text-xs text-slate-400">{reachedCount}/{goals.length} metas batidas no período atual</div>
        </div>
      </div>

      <div className="space-y-4">
        {byPeriod.map(({ period, goals: periodGoals }) => (
          <div key={period}>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {PERIOD_LABEL[period].title}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {periodGoals.map((g) => {
                const info = META_LABEL[g.metric];
                const real = realizado[goalKey(g.period, g.metric)] ?? 0;
                const pct = g.target_value > 0 ? Math.min(100, Math.round((real / g.target_value) * 100)) : 0;
                return (
                  <div key={g.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300">{info.icon} {info.label}</span>
                      <span className="text-[11px] font-bold text-emerald-400">{pct}%</span>
                    </div>
                    <div className="text-lg font-black text-white">
                      {fmt(real, info.isCurrency)} <span className="text-xs font-medium text-slate-500">/ {fmt(g.target_value, info.isCurrency)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{PERIOD_LABEL[period].caption}</div>
                    <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
