import { useMemo, useState } from "react";

const brl = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const pct = (value: number) => `${value.toFixed(1)}%`;

const months = ["Dez/25", "Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26"];
const revenue = [67200, 71400, 79600, 82300, 71200, 84320];

const channels = [
  { name: "WhatsApp Orgânico", value: 31200, tone: "bg-emerald-500", text: "text-emerald-300" },
  { name: "Meta Ads", value: 22800, tone: "bg-blue-500", text: "text-blue-300" },
  { name: "Indicação", value: 14700, tone: "bg-violet-500", text: "text-violet-300" },
  { name: "Instagram", value: 9100, tone: "bg-amber-500", text: "text-amber-300" },
  { name: "Cold Call", value: 4820, tone: "bg-cyan-500", text: "text-cyan-300" },
  { name: "Email Mkt", value: 1700, tone: "bg-red-500", text: "text-red-300" },
];

const lossReasons = [
  { name: "Preço alto", value: 21, tone: "bg-red-500", text: "text-red-300" },
  { name: "Sem urgência", value: 16, tone: "bg-amber-500", text: "text-amber-300" },
  { name: "Concorrente", value: 11, tone: "bg-orange-500", text: "text-orange-300" },
  { name: "Sem orçamento", value: 8, tone: "bg-violet-500", text: "text-violet-300" },
  { name: "Não atendeu", value: 5, tone: "bg-slate-500", text: "text-slate-300" },
];

const funnel = [
  { label: "Leads Novos", qty: 583, tone: "bg-indigo-500", text: "text-indigo-300" },
  { label: "Agendados", qty: 210, tone: "bg-blue-500", text: "text-blue-300" },
  { label: "Compareceram", qty: 112, tone: "bg-amber-500", text: "text-amber-300" },
  { label: "Propostas", qty: 78, tone: "bg-violet-500", text: "text-violet-300" },
  { label: "Fechados", qty: 47, tone: "bg-emerald-500", text: "text-emerald-300" },
];

const sellers = [
  { name: "Marcos Silva", initials: "MS", tone: "bg-indigo-500", revenue: 43200, wins: 24, conv: 35.3, goal: 50000 },
  { name: "Juliana Ramos", initials: "JR", tone: "bg-emerald-500", revenue: 28900, wins: 17, conv: 31.5, goal: 40000 },
  { name: "Rafael Nunes", initials: "RN", tone: "bg-amber-500", revenue: 12220, wins: 6, conv: 15.8, goal: 30000 },
  { name: "Camila Torres", initials: "CT", tone: "bg-violet-500", revenue: 0, wins: 0, conv: 0, goal: 25000 },
];

const trends = [
  { name: "Win Rate", values: [27, 28, 26, 29, 31, 30, 32, 31], unit: "%", text: "text-emerald-300", stroke: "#4ade80" },
  { name: "Ticket Médio", values: [1520, 1580, 1610, 1640, 1720, 1700, 1780, 1794], unit: "R$", text: "text-blue-300", stroke: "#60a5fa" },
  { name: "No-shows", values: [18, 15, 20, 14, 12, 16, 10, 8], unit: "", text: "text-red-300", stroke: "#f87171" },
  { name: "Novos Leads/sem", values: [62, 58, 71, 75, 80, 68, 88, 92], unit: "", text: "text-violet-300", stroke: "#c084fc" },
  { name: "Follow-ups feitos", values: [120, 140, 135, 158, 170, 148, 190, 204], unit: "", text: "text-amber-300", stroke: "#fbbf24" },
];

const alerts = [
  { type: "danger", icon: "⚠️", title: "19 leads sem primeira resposta", desc: "Leads sem contato em >24h perdem 80% da chance de conversão. Acione automação de 1ª mensagem agora." },
  { type: "danger", icon: "🔥", title: "Gargalo: apenas 53% comparecem", desc: "De 210 agendamentos, 98 não apareceram. Implemente lembrete 24h + 2h antes via WhatsApp." },
  { type: "warning", icon: "💡", title: "Camila Torres: 0 fechamentos no mês", desc: "Pipeline parado. Revisar scripts, objeções e agenda de reuniões com gestor." },
  { type: "warning", icon: "📉", title: "Meta de equipe: 70.3% — faltam 12 dias", desc: "Ainda é recuperável. Foque em 3–4 deals quentes no pipeline com probabilidade >60%." },
  { type: "success", icon: "🚀", title: "Win Rate subiu 15.8% — replique o que funciona", desc: "Analise os deals ganhos: padrão de objeção, canal, perfil de cliente e script." },
  { type: "success", icon: "✅", title: "LTV/CAC saudável: 4.2x", desc: "Unidade econômica positiva. Seguro escalar investimento em aquisição." },
];

const heatmap = [1, 3, 4, 2, 3, 1, 0, 0, 2, 4, 4, 3, 2, 0, 1, 3, 2, 4, 4, 3, 1, 0, 1, 3, 4, 2, 4, 1, 0, 2, 4, 3, 1, 0, 0];

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

function ReportCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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

function KpiCard({ label, value, sub, delta, variant }: { label: string; value: string; sub: string; delta: string; variant: "green" | "red" | "blue" | "violet" | "amber" }) {
  const styles = {
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  }[variant];

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

function LineChart() {
  const max = Math.max(...revenue) * 1.1;
  const width = 560;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const xs = months.map((_, i) => pad.left + (i / (months.length - 1)) * (width - pad.left - pad.right));
  const ys = revenue.map((value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom));
  const linePath = `M${xs.map((x, i) => `${x},${ys[i]}`).join(" L")}`;
  const areaPath = `M${xs[0]},${height - pad.bottom} ${xs.map((x, i) => `L${x},${ys[i]}`).join(" ")} L${xs[xs.length - 1]},${height - pad.bottom} Z`;

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
      <div className="mt-3 grid grid-cols-6 gap-1">
        {revenue.map((value, index) => {
          const heightPct = (value / Math.max(...revenue)) * 100;
          const active = index === revenue.length - 1;
          return (
            <div key={months[index]} className="text-center">
              <div className={`mb-1 text-[0.62rem] font-black ${active ? "text-emerald-300" : "text-slate-600"}`}>{Math.round(value / 1000)}k</div>
              <div className="relative h-8 overflow-hidden rounded-t bg-slate-800/80">
                <div className={`absolute inset-x-0 bottom-0 rounded-t ${active ? "bg-emerald-500" : "bg-slate-700"}`} style={{ height: `${heightPct}%` }} />
              </div>
              <div className="mt-1 text-[0.55rem] text-slate-700">{months[index]}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FunnelChart() {
  const max = funnel[0].qty;
  return (
    <div className="space-y-1">
      {funnel.map((item, index) => {
        const width = (item.qty / max) * 100;
        const conversion = index > 0 ? Math.round((item.qty / funnel[index - 1].qty) * 100) : null;
        return (
          <div key={item.label}>
            {conversion && <div className="py-1 pl-[116px] text-[0.58rem] text-slate-700">↓ {conversion}% conv.</div>}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right text-[0.65rem] font-bold text-slate-500">{item.label}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-800/80">
                <div className={`flex h-full items-center rounded-full px-3 ${item.tone}`} style={{ width: `${width}%` }}>
                  <span className="text-[0.62rem] font-black text-white">{item.qty}</span>
                </div>
              </div>
              <div className={`w-10 shrink-0 text-right text-[0.62rem] font-black ${item.text}`}>{Math.round(width)}%</div>
            </div>
          </div>
        );
      })}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[{ label: "Lead → Agenda", value: 36, text: "text-blue-300" }, { label: "Agenda → Comparec.", value: 53.3, text: "text-amber-300" }, { label: "Comparec. → Fechou", value: 41.9, text: "text-emerald-300" }].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-700/70 bg-slate-800/70 p-3 text-center">
            <div className={`text-base font-black ${item.text}`}>{item.value}%</div>
            <div className="mt-1 text-[0.58rem] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ data, money = false }: { data: typeof channels; money?: boolean }) {
  const max = Math.max(...data.map((item) => item.value));
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = (item.value / max) * 100;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-24 shrink-0 truncate text-right text-[0.68rem] font-bold text-slate-400">{item.name}</div>
            <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
              <div className={`flex h-full items-center rounded-full px-2 ${item.tone}`} style={{ width: `${width}%` }}>
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

function DonutChart() {
  const items = [
    { name: "Ganhos", value: 47, color: "#22c55e" },
    { name: "Perdidos", value: 61, color: "#ef4444" },
    { name: "Em andamento", value: 93, color: "#f59e0b" },
    { name: "Sem contato", value: 19, color: "#334155" },
  ];
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

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = `M${values.map((value, index) => `${(index / (values.length - 1)) * 120},${32 - ((value - min) / range) * 30 - 2}`).join(" L")}`;
  const last = values[values.length - 1];
  const y = 32 - ((last - min) / range) * 30 - 2;
  return (
    <svg height="34" viewBox="0 0 120 34" preserveAspectRatio="none" className="flex-1">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="120" cy={y} r="3" fill={stroke} />
    </svg>
  );
}

export default function Relatorios() {
  const [range, setRange] = useState("30d");
  const maxSellerRevenue = Math.max(...sellers.map((seller) => seller.revenue), 1);
  const heatColors = ["bg-slate-800/40", "bg-emerald-950", "bg-emerald-800", "bg-emerald-600", "bg-emerald-500"];
  const rangeLabel = useMemo(() => ({ "7d": "Últimos 7 dias", "30d": "Mai/2026", "90d": "Últimos 90 dias", ytd: "Ano atual" }[range]), [range]);

  return (
    <div className="-m-6 min-h-screen bg-[#0b0f14] font-[Sora,system-ui,sans-serif] text-slate-200">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 bg-[#0d1117] px-7 py-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-black tracking-normal text-slate-100">📊 Relatórios <span className="text-emerald-400">Comerciais</span> <span className="rounded-full bg-emerald-500 px-2 py-1 text-[0.55rem] font-black uppercase tracking-widest text-white">Novo</span></h1>
            <p className="mt-1 text-[0.7rem] text-slate-600">Análises completas de desempenho, tendências e previsibilidade</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
            {["7d", "30d", "90d", "ytd"].map((item) => (
              <button key={item} onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-[0.7rem] font-black uppercase transition ${range === item ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-500 hover:bg-slate-800 hover:text-slate-100"}`}>{item}</button>
            ))}
          </div>
          <button className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-[0.7rem] font-bold text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300">📥 Exportar PDF</button>
          <button className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-[0.7rem] font-bold text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300">📊 Exportar Excel</button>
        </div>
      </div>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-7 py-5">
        <section>
          <SectionHeader icon="💰" title="Visão Geral do Período" tag={rangeLabel} tone="bg-emerald-500/10 text-emerald-300" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="Leads Ganhos" value="47" sub="R$ 84.320 em receita total" delta="▲ 23.7% vs mês anterior" variant="green" />
            <KpiCard label="Leads Perdidos" value="61" sub="R$ 109.380 em oportunidades perdidas" delta="▼ 8.2% vs mês anterior" variant="red" />
            <KpiCard label="Taxa de Conversão" value="43.5%" sub="108 leads trabalhados no total" delta="▲ 5.1pp vs anterior" variant="blue" />
            <KpiCard label="Ticket Médio" value="R$ 1.794" sub="vs R$ 1.620 mês anterior" delta="▲ 10.7%" variant="violet" />
            <KpiCard label="Ciclo Médio" value="16 dias" sub="Do lead ao fechamento" delta="▲ Reduziu 3 dias" variant="amber" />
          </div>
        </section>

        <section>
          <SectionHeader icon="📈" title="Receita & Funil de Conversão" tone="bg-blue-500/10 text-blue-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <ReportCard>
              <CardHead title="📈 Receita Mensal — Últimos 6 Meses" aside={<span className="text-[0.62rem] font-bold text-emerald-300">▲ +18.4% vs anterior</span>} />
              <div className="p-5"><LineChart /></div>
            </ReportCard>
            <ReportCard>
              <CardHead title="🔀 Funil do Período" aside={<span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-1 text-[0.6rem] font-bold text-red-300">Gargalo: Comparecimento</span>} />
              <div className="p-5"><FunnelChart /></div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="⚖️" title="Ganhos vs Perdidos — Análise Detalhada" tone="bg-red-500/10 text-red-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ReportCard><CardHead title="🥧 Distribuição de Resultados" /><div className="p-5"><DonutChart /></div></ReportCard>
            <ReportCard><CardHead title="📡 Receita por Canal de Aquisição" /><div className="p-5"><BarList data={channels} money /></div></ReportCard>
            <ReportCard><CardHead title="❌ Principais Motivos de Perda" /><div className="p-5"><BarList data={lossReasons} /></div></ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="🏆" title="Ranking de Vendedores & Metas" tone="bg-amber-500/10 text-amber-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
            <ReportCard>
              <CardHead title="🏆 Ranking — Top Closers do Período" aside={<span className="text-[0.62rem] font-semibold text-amber-300">Mai/2026</span>} />
              <div>
                {sellers.map((seller, index) => (
                  <div key={seller.name} className="flex items-center gap-3 border-b border-slate-950 px-4 py-3 transition hover:bg-slate-800/60">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${index === 0 ? "bg-amber-400 text-slate-950" : index === 1 ? "bg-slate-400 text-slate-950" : index === 2 ? "bg-orange-700 text-white" : "bg-slate-800 text-slate-500"}`}>{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}</div>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[0.7rem] font-black text-white ${seller.tone}`}>{seller.initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-200">{seller.name}</div>
                      <div className="mt-0.5 text-[0.6rem] text-slate-600">{seller.wins} ganhos · <span className={`rounded-full px-2 py-0.5 font-bold ${seller.conv >= 30 ? "bg-emerald-500/10 text-emerald-300" : seller.conv >= 15 ? "bg-amber-500/10 text-amber-300" : "bg-red-500/10 text-red-300"}`}>{pct(seller.conv)}</span></div>
                    </div>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-950"><div className={`h-full rounded-full ${seller.tone}`} style={{ width: `${(seller.revenue / maxSellerRevenue) * 100}%` }} /></div>
                    <div className={`w-20 text-right text-xs font-black ${seller.revenue ? "text-emerald-300" : "text-slate-600"}`}>{seller.revenue ? brl(seller.revenue) : "—"}</div>
                  </div>
                ))}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead title="🎯 Metas Individuais de Receita" />
              <div className="p-5">
                {sellers.map((seller) => {
                  const progress = seller.goal ? Math.min((seller.revenue / seller.goal) * 100, 100) : 0;
                  const tone = progress >= 80 ? "bg-emerald-500 text-emerald-300" : progress >= 50 ? "bg-amber-500 text-amber-300" : "bg-red-500 text-red-300";
                  return (
                    <div key={seller.name} className="flex items-center gap-4 border-b border-slate-800/80 py-3 last:border-0">
                      <div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-200">{seller.name}</div><div className="mt-1 text-[0.62rem] text-slate-600">{brl(seller.revenue)} / {brl(seller.goal)}</div></div>
                      <div className="h-2 w-40 shrink-0 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone.split(" ")[0]}`} style={{ width: `${progress}%` }} /></div>
                      <div className={`w-12 text-right text-xs font-black ${tone.split(" ")[1]}`}>{progress.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="📅" title="Tendências & Atividade da Equipe" tone="bg-cyan-500/10 text-cyan-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportCard>
              <CardHead title="📉 Tendência de KPIs — Últimas 8 semanas" />
              <div className="p-5">
                {trends.map((trend) => {
                  const last = trend.values[trend.values.length - 1];
                  const prev = trend.values[trend.values.length - 2];
                  const delta = ((last - prev) / prev) * 100;
                  const formatted = trend.unit === "R$" ? brl(last) : `${last}${trend.unit}`;
                  return (
                    <div key={trend.name} className="flex items-center gap-3 border-b border-slate-800/90 py-3 last:border-0">
                      <div className="w-32 shrink-0 text-xs font-bold text-slate-400">{trend.name}</div>
                      <Sparkline values={trend.values} stroke={trend.stroke} />
                      <div className={`w-20 text-right text-xs font-black ${trend.text}`}>{formatted}</div>
                      <div className={`w-14 text-right text-[0.6rem] font-black ${delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>{delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead title="🔥 Heatmap — Atividade Comercial por Dia" aside={<span className="text-[0.6rem] text-slate-600">Últimos 35 dias</span>} />
              <div className="p-5">
                <div className="mb-1 grid grid-cols-7 gap-1">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <div key={day} className="text-center text-[0.5rem] font-bold text-slate-700">{day}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">{heatmap.map((value, index) => <div key={index} title={`${value} atividades`} className={`aspect-square rounded transition hover:z-10 hover:scale-125 ${heatColors[value]}`} />)}</div>
                <div className="mt-4 flex items-center justify-end gap-2"><span className="text-[0.58rem] text-slate-700">Menos</span>{heatColors.map((color) => <div key={color} className={`h-3 w-3 rounded-sm ${color}`} />)}<span className="text-[0.58rem] text-slate-700">Mais</span></div>
              </div>
            </ReportCard>
          </div>
        </section>

        <section>
          <SectionHeader icon="⚠️" title="Alertas Estratégicos & Oportunidades" tone="bg-red-500/10 text-red-300" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportCard>
              <CardHead title="🤖 Inteligência — Alertas & Ações" />
              <div className="space-y-2 p-5">
                {alerts.map((alert) => (
                  <div key={alert.title} className={`flex gap-3 rounded-xl border p-3 transition hover:translate-x-1 ${alert.type === "danger" ? "border-red-500/20 bg-red-500/5" : alert.type === "warning" ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm">{alert.icon}</div>
                    <div><div className="text-xs font-bold text-slate-100">{alert.title}</div><div className="mt-1 text-[0.65rem] leading-relaxed text-slate-500">{alert.desc}</div></div>
                  </div>
                ))}
              </div>
            </ReportCard>
            <ReportCard>
              <CardHead title="📋 Leads por Status e Responsável" />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="border-b border-slate-800 bg-slate-950/50 text-[0.6rem] uppercase tracking-widest text-slate-700"><th className="px-4 py-3 text-left">Vendedor</th><th className="px-4 py-3 text-right">Em andamento</th><th className="px-4 py-3 text-right">Ganhos</th><th className="px-4 py-3 text-right">Perdidos</th><th className="px-4 py-3 text-right">Conv.</th><th className="px-4 py-3 text-right">Receita</th></tr></thead>
                  <tbody>
                    {sellers.map((seller) => {
                      const row = seller.name === "Marcos Silva" ? { andamento: 38, losses: 6 } : seller.name === "Juliana Ramos" ? { andamento: 21, losses: 16 } : seller.name === "Rafael Nunes" ? { andamento: 12, losses: 20 } : { andamento: 22, losses: 19 };
                      return <tr key={seller.name} className="border-b border-slate-950 text-slate-400 transition hover:bg-slate-800/70"><td className="px-4 py-3 font-bold text-slate-100">{seller.name}</td><td className="px-4 py-3 text-right">{row.andamento}</td><td className="px-4 py-3 text-right font-bold text-emerald-300">{seller.wins}</td><td className="px-4 py-3 text-right font-bold text-red-300">{row.losses}</td><td className={`px-4 py-3 text-right font-bold ${seller.conv >= 30 ? "text-emerald-300" : seller.conv >= 15 ? "text-amber-300" : "text-red-300"}`}>{pct(seller.conv)}</td><td className="px-4 py-3 text-right font-bold text-emerald-300">{seller.revenue ? brl(seller.revenue) : "—"}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </div>
        </section>
      </main>
    </div>
  );
}