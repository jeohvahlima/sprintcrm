import { useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useGrowSalesBI, formatBRL, formatPct, type BIRange } from "@/hooks/useGrowSalesBI";
import { useRelatoriosOperacional } from "@/hooks/useRelatoriosOperacional";

const brl = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const pct = (value: number) => `${value.toFixed(1)}%`;

const formatMesLabel = (mesKey: string) => {
  const [y, m] = mesKey.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1] || m}/${y?.slice(2) || ""}`;
};

const formatDelta = (current: number, prev: number) => {
  if (prev === 0 && current === 0) return "Sem movimento no período";
  if (prev === 0) return "▲ Novo vs período anterior";
  const ch = ((current - prev) / prev) * 100;
  return `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}% vs período anterior`;
};

const CHANNEL_TONES = [
  { tone: "bg-emerald-500", text: "text-emerald-300" },
  { tone: "bg-blue-500", text: "text-blue-300" },
  { tone: "bg-violet-500", text: "text-violet-300" },
  { tone: "bg-amber-500", text: "text-amber-300" },
  { tone: "bg-cyan-500", text: "text-cyan-300" },
  { tone: "bg-red-500", text: "text-red-300" },
];

function SectionHeader({ icon, title, tag, tone }: { icon: string; title: string; tag?: string; tone: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">{title}</div>
      <div className="h-px flex-1 bg-slate-800/80" />
      {tag && <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[0.58rem] font-black text-emerald-300">{tag}</div>}
    </div>
  );
}

function ReportCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1117] ${className}`}>{children}</div>;
}

function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/90 px-5 py-3">
      <div className="text-xs font-bold text-slate-400">{title}</div>
      {aside}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  variant,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  delta: string;
  variant: "green" | "red" | "blue" | "violet" | "amber" | "cyan";
  loading?: boolean;
}) {
  const styles = {
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  }[variant];

  if (loading) {
    return (
      <div className={`animate-pulse rounded-2xl border p-5 ${styles}`}>
        <div className="h-3 w-24 rounded bg-slate-700/80" />
        <div className="mt-3 h-8 w-20 rounded bg-slate-700/80" />
        <div className="mt-3 h-3 w-full rounded bg-slate-800/80" />
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-background/50 ${styles}`}>
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-10 blur-2xl" />
      <div className="text-[0.58rem] font-black uppercase tracking-[0.12em] opacity-60">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-normal text-current">{value}</div>
      <div className="mt-2 text-[0.64rem] leading-relaxed text-slate-500">{sub}</div>
      <div className={`mt-3 inline-flex rounded-md px-2 py-1 text-[0.62rem] font-black ${delta.includes("▼") ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{delta}</div>
    </div>
  );
}

function LineChart({ months, revenue }: { months: string[]; revenue: number[] }) {
  if (revenue.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Sem receita fechada no período selecionado.</p>;
  }

  const max = Math.max(...revenue, 1) * 1.1;
  const width = 560;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const xs = months.map((_, i) => pad.left + (i / Math.max(months.length - 1, 1)) * (width - pad.left - pad.right));
  const ys = revenue.map((value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom));
  const linePath = `M${xs.map((x, i) => `${x},${ys[i]}`).join(" L")}`;
  const areaPath = `M${xs[0]},${height - pad.bottom} ${xs.map((x, i) => `L${x},${ys[i]}`).join(" ")} L${xs[xs.length - 1]},${height - pad.bottom} Z`;
  const maxRev = Math.max(...revenue, 1);

  return (
    <>
      <svg width="100%" height="200" viewBox="0 0 560 200" preserveAspectRatio="none" className="block">
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((factor) => {
          const y = height - pad.bottom - factor * (height - pad.top - pad.bottom);
          const value = Math.round(factor * max);
          return (
            <g key={factor}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#161b22" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 4} fill="#334155" fontSize="9" textAnchor="end">{Math.round(value / 1000)}k</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#revenueGrad)" />
        <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <g key={months[i]}>
            <circle cx={x} cy={ys[i]} r="4" fill="#22c55e" stroke="#0d1117" strokeWidth="2" />
            <title>{`${months[i]} · ${brl(revenue[i])}`}</title>
            <text x={x} y={height - 8} fill="#334155" fontSize="9" textAnchor="middle">{months[i]}</text>
          </g>
        ))}
      </svg>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {revenue.map((value, index) => {
          const heightPct = (value / maxRev) * 100;
          const active = index === revenue.length - 1;
          return (
            <div key={months[index]} className="text-center">
              <div className={`mb-1 text-[0.62rem] font-black ${active ? "text-emerald-300" : "text-slate-600"}`}>{Math.round(value / 1000)}k</div>
              <div className="relative h-8 overflow-hidden rounded-t bg-slate-800/80">
                <div className={`absolute inset-x-0 bottom-0 rounded-t ${active ? "bg-emerald-500" : "bg-slate-700"}`} style={{ height: `${heightPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FunnelChart({ funnel, convAgenda, convCompareceu, convFechamento, gargalo }: {
  funnel: { label: string; qty: number; tone: string; text: string }[];
  convAgenda: number;
  convCompareceu: number;
  convFechamento: number;
  gargalo: string;
}) {
  if (funnel[0]?.qty === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Sem leads no período para montar o funil.</p>;
  }

  const max = funnel[0].qty;

  return (
    <div className="space-y-1">
      {funnel.map((item, index) => {
        const width = (item.qty / max) * 100;
        const conversion = index > 0 && funnel[index - 1].qty > 0 ? Math.round((item.qty / funnel[index - 1].qty) * 100) : null;
        return (
          <div key={item.label}>
            {conversion !== null && <div className="py-1 pl-[116px] text-[0.58rem] text-slate-700">↓ {conversion}% conv.</div>}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right text-[0.65rem] font-bold text-slate-500">{item.label}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-800/80">
                <div className={`flex h-full items-center rounded-full px-3 ${item.tone}`} style={{ width: `${Math.max(width, 4)}%` }}>
                  <span className="text-[0.62rem] font-black text-white">{item.qty}</span>
                </div>
              </div>
              <div className={`w-10 shrink-0 text-right text-[0.62rem] font-black ${item.text}`}>{Math.round(width)}%</div>
            </div>
          </div>
        );
      })}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Lead → Agenda", value: convAgenda, text: "text-blue-300" },
          { label: "Agenda → Comparec.", value: convCompareceu, text: "text-amber-300" },
          { label: "Comparec. → Fechou", value: convFechamento, text: "text-emerald-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-3 text-center">
            <div className={`text-base font-black ${item.text}`}>{item.value.toFixed(1)}%</div>
            <div className="mt-1 text-[0.58rem] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
      {gargalo && gargalo !== "—" && (
        <p className="mt-3 text-center text-[0.62rem] text-red-300">Gargalo: {gargalo}</p>
      )}
    </div>
  );
}

function BarList({ data, money = false }: { data: { name: string; value: number; tone: string; text: string }[]; money?: boolean }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">Sem dados no período.</p>;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = (item.value / max) * 100;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-24 shrink-0 truncate text-right text-[0.68rem] font-bold text-slate-400">{item.name}</div>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
              <div className={`flex h-full items-center rounded-full px-2 ${item.tone}`} style={{ width: `${Math.max(width, 6)}%` }}>
                <span className="text-[0.62rem] font-black text-white">{money ? brl(item.value) : item.value}</span>
              </div>
            </div>
            <div className={`w-20 shrink-0 text-right text-[0.68rem] font-black ${item.text}`}>{money ? brl(item.value) : item.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ ganhos, perdidos, emAndamento }: { ganhos: number; perdidos: number; emAndamento: number }) {
  const items = [
    { name: "Ganhos", value: ganhos, color: "#22c55e" },
    { name: "Perdidos", value: perdidos, color: "#ef4444" },
    { name: "Em andamento", value: emAndamento, color: "#f59e0b" },
  ].filter((i) => i.value > 0);

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhum lead no período.</p>;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;
  const segments = items.map((item) => {
    const slice = (item.value / total) * 360;
    const start = (angle * Math.PI) / 180;
    const end = ((angle + slice) * Math.PI) / 180;
    const cx = 65, cy = 65, r = 48, thickness = 14, inner = r - thickness;
    const large = slice > 180 ? 1 : 0;
    const path = `M${cx + r * Math.cos(start)},${cy + r * Math.sin(start)} A${r},${r} 0 ${large},1 ${cx + r * Math.cos(end)},${cy + r * Math.sin(end)} L${cx + inner * Math.cos(end)},${cy + inner * Math.sin(end)} A${inner},${inner} 0 ${large},0 ${cx + inner * Math.cos(start)},${cy + inner * Math.sin(start)} Z`;
    angle += slice;
    return { ...item, path };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="130" height="130" viewBox="0 0 130 130" className="shrink-0">
        {segments.map((item) => <path key={item.name} d={item.path} fill={item.color} opacity="0.9" />)}
        <text x="65" y="61" fill="#e2e8f0" fontSize="14" fontWeight="900" textAnchor="middle">{total}</text>
        <text x="65" y="75" fill="#475569" fontSize="8" textAnchor="middle">leads total</text>
      </svg>
      <div className="min-w-32 flex-1 space-y-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <div className="flex-1 font-medium text-slate-400">{item.name}</div>
            <div className="font-bold text-slate-200">{item.value}</div>
            <div className="text-[0.62rem] text-slate-600">{pct((item.value / total) * 100)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [range, setRange] = useState<BIRange>("30d");
  const { data: bi, isLoading, isFetching, refetch, dataUpdatedAt } = useGrowSalesBI(range);
  const { data: ops, isLoading: opsLoading } = useRelatoriosOperacional(range);

  const loading = isLoading || opsLoading;

  const rangeLabel = useMemo(
    () => ({ "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", ytd: "Ano atual" }[range]),
    [range]
  );

  const updatedLabel = useMemo(() => {
    if (!dataUpdatedAt) return "";
    const mins = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 60000));
    return mins < 1 ? "Atualizado agora" : `Atualizado há ${mins} min`;
  }, [dataUpdatedAt]);

  const chartMonths = useMemo(
    () => (bi?.receita.porMes || []).map((m) => formatMesLabel(m.mes)),
    [bi?.receita.porMes]
  );
  const chartRevenue = useMemo(() => (bi?.receita.porMes || []).map((m) => m.valor), [bi?.receita.porMes]);

  const funnelData = useMemo(() => {
    if (!bi) return [];
    return [
      { label: "Leads Novos", qty: bi.funil.leadsNovos, tone: "bg-indigo-500", text: "text-indigo-300" },
      { label: "Agendados", qty: bi.funil.agendados, tone: "bg-blue-500", text: "text-blue-300" },
      { label: "Compareceram", qty: bi.funil.compareceram, tone: "bg-amber-500", text: "text-amber-300" },
      { label: "Fechados", qty: bi.funil.fechados, tone: "bg-emerald-500", text: "text-emerald-300" },
    ];
  }, [bi]);

  const channelBars = useMemo(() => {
    return (bi?.receita.porCanal || []).slice(0, 6).map((c, i) => ({
      name: c.canal,
      value: c.valor,
      ...CHANNEL_TONES[i % CHANNEL_TONES.length],
    }));
  }, [bi?.receita.porCanal]);

  const lossBars = useMemo(() => {
    return (ops?.lossReasons || []).map((r, i) => ({
      name: r.name,
      value: r.value,
      ...CHANNEL_TONES[i % CHANNEL_TONES.length],
    }));
  }, [ops?.lossReasons]);

  const campanhaBars = useMemo(() => {
    return (bi?.campanhas.porCampanha || [])
      .filter((c) => c.campanha !== "Sem campanha")
      .slice(0, 8)
      .map((c, i) => ({
        name: c.campanha.length > 22 ? `${c.campanha.slice(0, 22)}…` : c.campanha,
        value: c.leads,
        ...CHANNEL_TONES[i % CHANNEL_TONES.length],
      }));
  }, [bi?.campanhas.porCampanha]);

  const sellers = bi?.performance.closers || [];
  const maxSellerRevenue = Math.max(...sellers.map((s) => s.receita), 1);

  const emAndamento = useMemo(() => {
    if (!bi) return 0;
    const trabalhados = bi.funil.fechados + bi.funil.perdidos;
    return Math.max(bi.funil.leadsNovos - trabalhados, 0);
  }, [bi]);

  const receitaDelta = bi ? formatDelta(bi.receita.bruto, bi.previous.receita) : "";
  const dealsDelta = bi ? formatDelta(bi.receita.deals, bi.previous.deals) : "";
  const ticketDelta = bi ? formatDelta(bi.receita.ticketMedio, bi.previous.ticketMedio) : "";
  const winDelta = bi ? formatDelta(bi.winRate, bi.previous.winRate) : "";
  const cicloDelta = bi
    ? bi.previous.cicloMedioDias > 0
      ? bi.cicloMedioDias < bi.previous.cicloMedioDias
        ? `▲ Reduziu ${Math.round(bi.previous.cicloMedioDias - bi.cicloMedioDias)} dias`
        : `▼ Aumentou ${Math.round(bi.cicloMedioDias - bi.previous.cicloMedioDias)} dias`
      : "Ciclo do período atual"
    : "";

  const trabalhados = (bi?.funil.fechados || 0) + (bi?.funil.perdidos || 0);

  const topCampanha = bi?.campanhas.porCampanha.find((c) => c.campanha !== "Sem campanha");

  return (
    <div className="min-h-full overflow-hidden rounded-2xl bg-[#0b0f14] font-[Sora,system-ui,sans-serif] text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 bg-[#0d1117] px-7 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-black tracking-normal text-slate-100">
              📊 Relatórios <span className="text-emerald-400">Comerciais</span>
            </h1>
            <p className="mt-1 text-[0.7rem] text-slate-600">
              Dados reais do CRM · {updatedLabel || "carregando…"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
            {(["7d", "30d", "90d", "ytd"] as BIRange[]).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-black uppercase transition ${range === item ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-500 hover:bg-slate-800 hover:text-slate-100"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-[0.7rem] font-bold text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-7 py-5">
        <section>
          <SectionHeader icon="⚙️" title="Pipeline & Operação" tag={rangeLabel} tone="bg-cyan-500/10 text-cyan-300" />
          <p className="-mt-1 mb-3 text-[0.65rem] text-slate-600">
            Métricas ligadas aos módulos do CRM: Agenda, Tarefas, Funil, Site e IA.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              loading={loading}
              label="Agendamentos"
              value={ops ? String(ops.agendamentos) : "—"}
              sub="Módulo Agenda · compromissos no período"
              delta={bi ? `${bi.funil.compareceram} compareceram` : ""}
              variant="cyan"
            />
            <KpiCard
              loading={loading}
              label="Tarefas"
              value={ops ? String(ops.tarefas) : "—"}
              sub={ops ? `${ops.tarefasPendentes} pendentes no quadro` : "Módulo Tarefas"}
              delta="Total cadastrado no CRM"
              variant="violet"
            />
            <KpiCard
              loading={loading}
              label="Leads — Tráfego Pago"
              value={ops ? String(ops.leadsTrafego) : "—"}
              sub="Meta Ads, Google e UTMs pagas"
              delta={topCampanha ? `Top: ${topCampanha.campanha.slice(0, 22)}` : "Sem campanha rastreada"}
              variant="amber"
            />
            <KpiCard
              loading={loading}
              label="Site"
              value={ops ? String(ops.leadsSite) : "—"}
              sub="Leads do site, pixel e formulários"
              delta="Chat IA, agendamento e institucional"
              variant="blue"
            />
            <KpiCard
              loading={loading}
              label="Funil de Vendas"
              value={ops ? String(ops.leadsNoFunil) : "—"}
              sub={ops ? `${ops.leadsFunilAtivos} ativos no funil agora` : "Módulo Funil de Vendas"}
              delta={ops?.funilPrincipal ? `Principal: ${ops.funilPrincipal}` : "Sem funil atribuído"}
              variant="green"
            />
            <KpiCard
              loading={loading}
              label="Atendido IA"
              value={ops ? String(ops.atendimentosIA) : "—"}
              sub={ops ? `${ops.leadsAtendidosIA} leads com resposta da IA` : "Automação e chat IA"}
              delta="Interações registradas no período"
              variant="cyan"
            />
          </div>
        </section>

        <section>
          <SectionHeader icon="📊" title="Resultado Comercial" tag={rangeLabel} tone="bg-emerald-500/10 text-emerald-300" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              loading={loading}
              label="Valor em Pipeline"
              value={bi ? brl(bi.forecast.pipelineAberto) : "—"}
              sub={bi ? "Oportunidades em aberto" : ""}
              delta={bi ? `Forecast 30d: ${brl(bi.forecast.forecast30d)}` : ""}
              variant="green"
            />
            <KpiCard
              loading={loading}
              label="Ganhos"
              value={bi ? String(bi.funil.fechados) : "—"}
              sub={bi ? `${formatBRL(bi.receita.bruto)} · ${bi.receita.deals} negócio${bi.receita.deals === 1 ? "" : "s"}` : ""}
              delta={receitaDelta}
              variant="green"
            />
            <KpiCard
              loading={loading}
              label="Perdidos"
              value={bi ? String(bi.funil.perdidos) : "—"}
              sub={bi ? `${formatBRL(bi.perdas.perdidos.valor)} · ${bi.perdas.perdidos.qty} com valor` : ""}
              delta={bi ? `${bi.perdas.perdidos.qty} oportunidade${bi.perdas.perdidos.qty === 1 ? "" : "s"} perdida${bi.perdas.perdidos.qty === 1 ? "" : "s"}` : ""}
              variant="red"
            />
            <KpiCard loading={loading} label="Taxa de Conversão" value={bi ? formatPct(bi.winRate) : "—"} sub={bi ? `${trabalhados} leads finalizados (ganho + perdido)` : ""} delta={winDelta} variant="blue" />
            <KpiCard loading={loading} label="Ticket Médio" value={bi ? brl(bi.receita.ticketMedio) : "—"} sub={bi && bi.previous.ticketMedio > 0 ? `vs ${brl(bi.previous.ticketMedio)} período anterior` : "Por venda fechada"} delta={ticketDelta} variant="violet" />
            <KpiCard loading={loading} label="Ciclo Médio" value={bi ? `${Math.round(bi.cicloMedioDias)} dias` : "—"} sub="Do lead ao fechamento (ganhos)" delta={cicloDelta} variant="amber" />
          </div>
        </section>

        <section>
          <SectionHeader icon="📈" title="Receita & Funil de Conversão" tone="bg-blue-500/10 text-blue-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <ReportCard>
              <CardHead title="📈 Receita Mensal — últimos meses com fechamento" aside={bi && bi.previous.receita > 0 ? <span className="text-[0.62rem] font-bold text-emerald-300">{receitaDelta}</span> : undefined} />
              <div className="p-5">
                {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-800/80" /> : <LineChart months={chartMonths} revenue={chartRevenue} />}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead
                title="🔀 Funil do Período"
                aside={bi?.funil.gargalo && bi.funil.gargalo !== "—" ? (
                  <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-1 text-[0.6rem] font-bold text-red-300">Gargalo: {bi.funil.gargalo}</span>
                ) : undefined}
              />
              <div className="p-5">
                {loading ? <div className="h-48 animate-pulse rounded-xl bg-slate-800/80" /> : (
                  <FunnelChart
                    funnel={funnelData}
                    convAgenda={bi?.funil.convAgenda || 0}
                    convCompareceu={bi?.funil.convCompareceu || 0}
                    convFechamento={bi?.funil.convFechamento || 0}
                    gargalo={bi?.funil.gargalo || ""}
                  />
                )}
              </div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="📢" title="Campanhas de Tráfego Pago" tone="bg-amber-500/10 text-amber-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportCard>
              <CardHead title="📡 Leads por campanha (UTM / ad_id)" />
              <div className="p-5">{loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/80" /> : <BarList data={campanhaBars} />}</div>
            </ReportCard>
            <ReportCard>
              <CardHead title="💰 Receita por fonte de aquisição" />
              <div className="p-5">{loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/80" /> : <BarList data={channelBars} money />}</div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="⚖️" title="Ganhos vs Perdidos — Análise Detalhada" tone="bg-red-500/10 text-red-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ReportCard>
              <CardHead title="🥧 Distribuição de Resultados" />
              <div className="p-5">
                {loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-800/80" /> : (
                  <DonutChart ganhos={bi?.funil.fechados || 0} perdidos={bi?.funil.perdidos || 0} emAndamento={emAndamento} />
                )}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead title="📡 Receita por Canal" />
              <div className="p-5">{loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-800/80" /> : <BarList data={channelBars} money />}</div>
            </ReportCard>
            <ReportCard>
              <CardHead title="❌ Principais Motivos de Perda" />
              <div className="p-5">{loading ? <div className="h-40 animate-pulse rounded-xl bg-slate-800/80" /> : <BarList data={lossBars} />}</div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="🏆" title="Ranking de Vendedores" tone="bg-amber-500/10 text-amber-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
            <ReportCard>
              <CardHead title="🏆 Top closers — receita no período" aside={<span className="text-[0.62rem] font-semibold text-amber-300">{rangeLabel}</span>} />
              <div>
                {loading && <p className="p-4 text-sm text-slate-500">Carregando…</p>}
                {!loading && sellers.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum fechamento no período.</p>}
                {sellers.map((seller, index) => (
                  <div key={seller.user} className="flex items-center gap-3 border-b border-slate-950 px-4 py-3 transition hover:bg-slate-800/60">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${index === 0 ? "bg-amber-400 text-slate-950" : index === 1 ? "bg-slate-400 text-slate-950" : index === 2 ? "bg-orange-700 text-white" : "bg-slate-800 text-slate-500"}`}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-200">{seller.user}</div>
                      <div className="mt-0.5 text-[0.6rem] text-slate-600">
                        {seller.ganhos} ganhos ·{" "}
                        <span className={`rounded-full px-2 py-0.5 font-bold ${seller.conv >= 30 ? "bg-emerald-500/10 text-emerald-300" : seller.conv >= 15 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"}`}>
                          {pct(seller.conv)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-950">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(seller.receita / maxSellerRevenue) * 100}%` }} />
                    </div>
                    <div className={`w-20 text-right text-xs font-black ${seller.receita ? "text-emerald-300" : "text-slate-600"}`}>{seller.receita ? brl(seller.receita) : "—"}</div>
                  </div>
                ))}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead title="📋 Leads por responsável (closers)" />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-[0.6rem] uppercase tracking-widest text-slate-700">
                      <th className="px-4 py-3 text-left">Vendedor</th>
                      <th className="px-4 py-3 text-right">Oportunidades</th>
                      <th className="px-4 py-3 text-right">Ganhos</th>
                      <th className="px-4 py-3 text-right">Conv.</th>
                      <th className="px-4 py-3 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller) => (
                      <tr key={seller.user} className="border-b border-slate-950 text-slate-400 transition hover:bg-slate-800/70">
                        <td className="px-4 py-3 font-bold text-slate-100">{seller.user}</td>
                        <td className="px-4 py-3 text-right">{seller.oportunidades}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-300">{seller.ganhos}</td>
                        <td className={`px-4 py-3 text-right font-bold ${seller.conv >= 30 ? "text-emerald-300" : seller.conv >= 15 ? "text-amber-300" : "text-red-300"}`}>{pct(seller.conv)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-300">{seller.receita ? brl(seller.receita) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </div>
        </section>

        {bi && bi.insights.length > 0 && (
          <section>
            <SectionHeader icon="⚠️" title="Alertas do CRM (baseados nos seus dados)" tone="bg-red-500/10 text-red-300" />
            <ReportCard>
              <CardHead title="🤖 Inteligência — Alertas & Ações" />
              <div className="space-y-2 p-5">
                {bi.insights.map((alert) => (
                  <div
                    key={alert.titulo}
                    className={`flex gap-3 rounded-xl border p-3 transition hover:translate-x-1 ${alert.tipo === "alerta" ? "border-red-500/20 bg-red-500/5" : alert.tipo === "oportunidade" ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm">
                      {alert.tipo === "alerta" ? "⚠️" : alert.tipo === "oportunidade" ? "💡" : "✅"}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{alert.titulo}</div>
                      <div className="mt-1 text-[0.65rem] leading-relaxed text-slate-500">{alert.descricao}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ReportCard>
          </section>
        )}
      </main>
    </div>
  );
}
