import { useState, useMemo } from "react";
import { Target, TrendingUp, Loader2, CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react";
import { useMyGoals, type Period, type Metric, goalKey } from "@/hooks/useMyGoals";

const PERIOD_TABS: { key: Period; label: string; caption: string }[] = [
  { key: "daily", label: "Meta do Dia", caption: "meta diária" },
  { key: "weekly", label: "Meta da Semana", caption: "meta semanal" },
  { key: "monthly", label: "Meta do Mês", caption: "meta mensal" },
];

const META_LABEL: Record<Metric, { icon: string; label: string; isCurrency?: boolean }> = {
  gross_value: { icon: "💰", label: "Faturamento", isCurrency: true },
  sales_closed: { icon: "🏆", label: "Vendas fechadas" },
  calls: { icon: "📞", label: "Ligações" },
  meetings_scheduled: { icon: "📅", label: "Reuniões agendadas" },
  leads_prospected: { icon: "🎯", label: "Leads prospectados" },
};

const STATUS_CONFIG = {
  concluida:    { label: "Concluída",    cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", Icon: CheckCircle2, bar: "from-emerald-500 to-emerald-400" },
  em_andamento: { label: "Em andamento", cls: "bg-sky-500/20 text-sky-300 border-sky-500/40",             Icon: Clock,        bar: "from-sky-500 to-sky-400" },
  atrasada:     { label: "Atrasada",     cls: "bg-rose-500/20 text-rose-300 border-rose-500/40",          Icon: AlertTriangle, bar: "from-rose-500 to-rose-400" },
  nao_iniciada: { label: "Não iniciada", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40",       Icon: Circle,       bar: "from-slate-500 to-slate-400" },
};

const fmt = (v: number, currency?: boolean) =>
  currency ? "R$ " + Math.round(v).toLocaleString("pt-BR") : Math.round(v).toLocaleString("pt-BR");

export default function MyGoalsPanel() {
  const { loading, goals, getStatus } = useMyGoals();
  const [period, setPeriod] = useState<Period>("daily");

  const periodGoals = useMemo(() => goals.filter((g) => g.period === period), [goals, period]);

  const reachedCount = useMemo(() => periodGoals.filter((g) => {
    const { status } = getStatus(g.period, g.metric, g.target_value);
    return status === "concluida";
  }).length, [periodGoals, getStatus]);

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

  const currentTab = PERIOD_TABS.find((t) => t.key === period)!;

  return (
    <div className="mb-6 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-700/30 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Target className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            Minha Meta
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-bold">individual</span>
          </div>
          <div className="text-xs text-slate-400">{reachedCount}/{periodGoals.length} metas batidas — {currentTab.label}</div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PERIOD_TABS.map((t) => {
          const active = period === t.key;
          const count = goals.filter((g) => g.period === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                active
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-600/30"
                  : "bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-slate-700"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {periodGoals.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Nenhuma meta definida para este período.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {periodGoals.map((g) => {
            const info = META_LABEL[g.metric];
            const { status, pct, real, restante } = getStatus(g.period, g.metric, g.target_value);
            const st = STATUS_CONFIG[status];
            const StIcon = st.Icon;
            return (
              <div key={g.id} className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition-all">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-bold text-slate-300 truncate">{info.icon} {info.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${st.cls}`}>
                    <StIcon className="w-3 h-3" />
                    {st.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-lg font-black text-white">
                    {fmt(real, info.isCurrency)}
                    <span className="text-xs font-medium text-slate-500"> / {fmt(g.target_value, info.isCurrency)}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">{pct}%</span>
                </div>
                <div className="text-[10px] text-slate-500 mb-2">
                  {restante > 0
                    ? <>Faltam <span className="text-slate-300 font-semibold">{fmt(restante, info.isCurrency)}</span> · {currentTab.caption}</>
                    : <span className="text-emerald-400 font-semibold">Meta atingida! 🎉</span>}
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${st.bar} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
