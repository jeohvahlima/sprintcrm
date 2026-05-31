import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Loader2 } from "lucide-react";

type Metric = "gross_value" | "sales_closed" | "calls" | "meetings_scheduled" | "leads_prospected";
type Period = "daily" | "monthly";

interface Goal {
  id: string;
  metric: Metric;
  period: Period;
  target_value: number;
}

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

export default function MyGoalsPanel() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [realizado, setRealizado] = useState<Partial<Record<Metric, number>>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: gData } = await supabase
          .from("commercial_goals")
          .select("id, metric, period, target_value")
          .eq("user_id", user.id)
          .eq("active", true);

        const gs = (gData || []) as Goal[];
        setGoals(gs);

        // Compute realizado for sales metrics from customer_sales (this month, status finalizada)
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: sales } = await supabase
          .from("customer_sales")
          .select("valor_final, finalized_at, status, responsavel_id")
          .eq("responsavel_id", user.id)
          .gte("finalized_at", startMonth)
          .eq("status", "finalizada");

        const totalValor = (sales || []).reduce((sum, s: any) => sum + Number(s.valor_final || 0), 0);
        const totalVendas = (sales || []).length;
        setRealizado({ gross_value: totalValor, sales_closed: totalVendas });
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

  const monthly = goals.filter((g) => g.period === "monthly");
  const daily = goals.filter((g) => g.period === "daily");

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
          <div className="text-xs text-slate-400">Acompanhe seu progresso em tempo real</div>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Mensal</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {monthly.map((g) => {
              const info = META_LABEL[g.metric];
              const real = realizado[g.metric] ?? 0;
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
      )}

      {daily.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Diário
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {daily.map((g) => {
              const info = META_LABEL[g.metric];
              return (
                <div key={g.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400 font-semibold">{info.icon} {info.label}</div>
                  <div className="text-base font-black text-white mt-1">{fmt(g.target_value)}</div>
                  <div className="text-[10px] text-slate-500">meta por dia</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
