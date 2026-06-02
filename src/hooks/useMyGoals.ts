import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Metric = "gross_value" | "sales_closed" | "calls" | "meetings_scheduled" | "leads_prospected";
export type Period = "daily" | "weekly" | "monthly";
export type GoalKey = `${Period}:${Metric}`;

export interface Goal {
  id: string;
  metric: Metric;
  period: Period;
  target_value: number;
}

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getPeriodRange = (period: Period) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
  }
  if (period === "monthly") start.setDate(1);

  const end = new Date(start);
  if (period === "daily") end.setDate(start.getDate() + 1);
  if (period === "weekly") end.setDate(start.getDate() + 7);
  if (period === "monthly") end.setMonth(start.getMonth() + 1);

  const logEnd = new Date(end);
  logEnd.setDate(logEnd.getDate() - 1);

  return { start, end, logStart: formatDate(start), logEnd: formatDate(logEnd) };
};

export const goalKey = (period: Period, metric: Metric): GoalKey => `${period}:${metric}`;

export function useMyGoals() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [realizado, setRealizado] = useState<Partial<Record<GoalKey, number>>>({});

  const load = useCallback(async () => {
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
        const logSalesClosed = logs.reduce((s, r: any) => s + Number(r.sales_closed || 0), 0);
        const logGrossValue = logs.reduce((s, r: any) => s + Number(r.gross_value || 0), 0);
        const salesClosed = sales.length;
        const grossValue = sales.reduce((s, r: any) => s + Number(r.valor_final || 0), 0);

        progress[goalKey(period, "leads_prospected")] = logs.reduce((s, r: any) => s + Number(r.leads_prospected || 0), 0);
        progress[goalKey(period, "meetings_scheduled")] = logs.reduce((s, r: any) => s + Number(r.meetings_scheduled || 0), 0);
        progress[goalKey(period, "calls")] = (callsResult.data || []).length;
        progress[goalKey(period, "sales_closed")] = Math.max(logSalesClosed, salesClosed);
        progress[goalKey(period, "gross_value")] = Math.max(logGrossValue, grossValue);
      }));

      setRealizado(progress);
    } catch (e) {
      console.error("useMyGoals error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const getStatus = (period: Period, metric: Metric, target: number) => {
    const real = realizado[goalKey(period, metric)] ?? 0;
    if (target <= 0) return { status: "nao_iniciada" as const, pct: 0, real, restante: 0 };
    const pct = Math.round((real / target) * 100);
    const restante = Math.max(0, target - real);

    // "Atrasada": daily after 18h, weekly after Friday, monthly after day 25 — and not yet 100%
    let atrasada = false;
    const now = new Date();
    if (pct < 100) {
      if (period === "daily" && now.getHours() >= 18) atrasada = true;
      if (period === "weekly" && now.getDay() >= 5 && pct < 80) atrasada = true;
      if (period === "monthly" && now.getDate() >= 25 && pct < 80) atrasada = true;
    }

    let status: "concluida" | "em_andamento" | "nao_iniciada" | "atrasada";
    if (pct >= 100) status = "concluida";
    else if (atrasada) status = "atrasada";
    else if (real > 0) status = "em_andamento";
    else status = "nao_iniciada";

    return { status, pct: Math.min(100, pct), real, restante };
  };

  return { loading, goals, realizado, reload: load, getStatus };
}
