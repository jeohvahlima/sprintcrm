import { useMemo, useState } from "react";

interface Lead {
  id: string;
  value?: number | null;
  etapa_id?: string | null;
  funil_id?: string | null;
  status?: string | null;
  source?: string | null;
  expected_close_date?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
}

interface Props {
  leads: Lead[];
  etapas: Etapa[];
  funilNome?: string;
}

type Period = "7d" | "30d" | "90d" | "ytd";

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "ytd": "Ano",
};

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, "ytd": 365 };

const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const STATUS_GANHO = ["ganho", "won", "fechado", "concluido", "concluído"];
const STATUS_PERDIDO = ["perdido", "lost", "cancelado", "descartado"];

function classifyStatus(status?: string | null): "ganho" | "perdido" | "ativo" {
  const s = (status || "").toLowerCase().trim();
  if (STATUS_GANHO.includes(s)) return "ganho";
  if (STATUS_PERDIDO.includes(s)) return "perdido";
  return "ativo";
}

export function ResultadoComercialDashboard({ leads, etapas, funilNome }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const stats = useMemo(() => {
    const now = Date.now();
    const days = PERIOD_DAYS[period];
    const cutoff =
      period === "ytd"
        ? new Date(new Date().getFullYear(), 0, 1).getTime()
        : now - days * 24 * 60 * 60 * 1000;
    const prevCutoff = cutoff - days * 24 * 60 * 60 * 1000;

    const inPeriod = (iso?: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= cutoff && t <= now;
    };
    const inPrevPeriod = (iso?: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= prevCutoff && t < cutoff;
    };

    // Estado bruto do funil (todos os leads do funil — fonte única de verdade)
    let ativos: Lead[] = [];
    let ganhosPeriodo: Lead[] = [];
    let perdidosPeriodo: Lead[] = [];
    let ganhosPrev: Lead[] = [];
    let perdidosPrev: Lead[] = [];

    leads.forEach((l) => {
      const tipo = classifyStatus(l.status);
      if (tipo === "ativo") {
        ativos.push(l);
      } else if (tipo === "ganho") {
        const wonDate = l.won_at || l.updated_at;
        if (inPeriod(wonDate)) ganhosPeriodo.push(l);
        else if (inPrevPeriod(wonDate)) ganhosPrev.push(l);
      } else {
        const lostDate = l.lost_at || l.updated_at;
        if (inPeriod(lostDate)) perdidosPeriodo.push(l);
        else if (inPrevPeriod(lostDate)) perdidosPrev.push(l);
      }
    });

    const valorPipeline = ativos.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const valorGanho = ganhosPeriodo.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const valorGanhoPrev = ganhosPrev.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const valorPerdido = perdidosPeriodo.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

    // Próximos a fechar: data prevista nos próximos 30 dias OU etapa nas 2 últimas posições ativas
    const limite = now + 30 * 24 * 60 * 60 * 1000;
    const ativasOrd = [...etapas]
      .filter((e) => {
        const n = (e.nome || "").toLowerCase();
        return !STATUS_GANHO.some((g) => n.includes(g)) && !STATUS_PERDIDO.some((p) => n.includes(p));
      })
      .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0));
    const maxPos = ativasOrd.length > 0 ? ativasOrd[ativasOrd.length - 1].posicao ?? 0 : 0;
    const proximosFechar = ativos.filter((l) => {
      if (l.expected_close_date) {
        const t = new Date(l.expected_close_date).getTime();
        if (t >= now && t <= limite) return true;
      }
      const et = etapas.find((e) => e.id === l.etapa_id);
      if (et && maxPos > 0 && (et.posicao ?? 0) >= maxPos - 1) return true;
      return false;
    }).length;

    const finalizados = ganhosPeriodo.length + perdidosPeriodo.length;
    const finalizadosPrev = ganhosPrev.length + perdidosPrev.length;
    const taxaConv = finalizados > 0 ? (ganhosPeriodo.length / finalizados) * 100 : 0;
    const taxaConvPrev = finalizadosPrev > 0 ? (ganhosPrev.length / finalizadosPrev) * 100 : 0;
    const ticket = ganhosPeriodo.length > 0 ? valorGanho / ganhosPeriodo.length : 0;
    const ticketPrev = ganhosPrev.length > 0 ? valorGanhoPrev / ganhosPrev.length : 0;

    // Ciclo médio (dias) — apenas para ganhos do período
    let cicloSoma = 0;
    let cicloN = 0;
    ganhosPeriodo.forEach((l) => {
      const inicio = l.created_at ? new Date(l.created_at).getTime() : 0;
      const fim = l.won_at ? new Date(l.won_at).getTime() : l.updated_at ? new Date(l.updated_at).getTime() : 0;
      if (inicio && fim && fim > inicio) {
        cicloSoma += (fim - inicio) / (1000 * 60 * 60 * 24);
        cicloN += 1;
      }
    });
    const cicloMedio = cicloN > 0 ? cicloSoma / cicloN : 0;

    // Distribuição por etapa (ativos)
    const porEtapa: Record<string, number> = {};
    ativos.forEach((l) => {
      if (l.etapa_id) porEtapa[l.etapa_id] = (porEtapa[l.etapa_id] || 0) + 1;
    });

    // Forecast = pipeline * (taxa de conversão atual)
    const forecast = valorPipeline * (taxaConv > 0 ? taxaConv / 100 : 0.2);

    // Motivos de perda
    const motivosPerda: Record<string, number> = {};
    perdidosPeriodo.forEach((l) => {
      const r = ((l as any).loss_reason as string) || "Não informado";
      motivosPerda[r] = (motivosPerda[r] || 0) + 1;
    });
    const topMotivo = Object.entries(motivosPerda).sort((a, b) => b[1] - a[1])[0];

    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

    return {
      ativosCount: ativos.length,
      valorPipeline,
      forecast,
      proximosFechar,
      ganhosCount: ganhosPeriodo.length,
      valorGanho,
      perdidosCount: perdidosPeriodo.length,
      valorPerdido,
      taxaConv,
      ticket,
      cicloMedio,
      finalizados,
      porEtapa,
      topMotivoPerda: topMotivo ? `${topMotivo[0]} (${topMotivo[1]})` : null,
      deltaGanhos: pct(ganhosPeriodo.length, ganhosPrev.length),
      deltaTaxa: pct(taxaConv, taxaConvPrev),
      deltaTicket: pct(ticket, ticketPrev),
    };
  }, [leads, etapas, period]);

  const distribuicao = useMemo(() => {
    const arr = Object.entries(stats.porEtapa)
      .map(([id, n]) => ({ nome: etapas.find((e) => e.id === id)?.nome || "?", n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
    return arr.map((x) => `${x.nome.toLowerCase()} ${x.n}`).join(" • ") || "Sem leads ativos";
  }, [stats.porEtapa, etapas]);

  const delta = (v: number, invert = false) => {
    if (!isFinite(v) || v === 0) return null;
    const positivo = invert ? v < 0 : v > 0;
    return (
      <span className={positivo ? "text-emerald-400" : "text-rose-400"}>
        {positivo ? "▲" : "▼"} {Math.abs(v).toFixed(1)}% vs período anterior
      </span>
    );
  };

  type Card = {
    label: string;
    value: string;
    sub: string;
    badge: React.ReactNode;
    tooltip: string;
    accent: string;
  };

  const cards: Card[] = [
    {
      label: "VALOR EM PIPELINE",
      value: fmtBRL(stats.valorPipeline),
      sub: "Oportunidades em aberto neste funil",
      badge: <>Forecast estimado: {fmtBRL(stats.forecast)}</>,
      tooltip: "Soma do valor dos leads ativos (exclui ganho/perdido).",
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "NEGOCIAÇÕES ATIVAS",
      value: stats.ativosCount.toLocaleString("pt-BR"),
      sub: distribuicao,
      badge: <>Apenas leads em etapas intermediárias</>,
      tooltip: "Leads com status ≠ ganho e ≠ perdido neste funil.",
      accent: "from-sky-500/15 to-sky-500/0 border-sky-500/30 text-sky-300",
    },
    {
      label: "PRÓXIMOS A FECHAR",
      value: stats.proximosFechar.toLocaleString("pt-BR"),
      sub: "Data prevista em 30d ou etapa final",
      badge: <>Foco do time comercial</>,
      tooltip: "Leads com expected_close_date nos próximos 30 dias ou nas 2 últimas etapas ativas.",
      accent: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-300",
    },
    {
      label: "GANHOS",
      value: stats.ganhosCount.toLocaleString("pt-BR"),
      sub: `${fmtBRL(stats.valorGanho)} · ${stats.ganhosCount} negócios`,
      badge: delta(stats.deltaGanhos) || <>Sem comparação anterior</>,
      tooltip: "Leads com status = ganho dentro do período (por won_at).",
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "PERDIDOS",
      value: stats.perdidosCount.toLocaleString("pt-BR"),
      sub: `${fmtBRL(stats.valorPerdido)} · ${stats.perdidosCount} oportunidades`,
      badge: stats.topMotivoPerda ? <>Top motivo: {stats.topMotivoPerda}</> : <>Sem motivos registrados</>,
      tooltip: "Leads com status = perdido dentro do período (por lost_at).",
      accent: "from-rose-500/15 to-rose-500/0 border-rose-500/30 text-rose-300",
    },
    {
      label: "RESGATADOS",
      value: "0",
      sub: "Voltaram para o funil após perda",
      badge: <>Requer histórico de status</>,
      tooltip: "Leads que tiveram status = perdido e voltaram a uma etapa ativa.",
      accent: "from-violet-500/15 to-violet-500/0 border-violet-500/30 text-violet-300",
    },
    {
      label: "TAXA DE CONVERSÃO",
      value: `${stats.taxaConv.toFixed(1)}%`,
      sub: `${stats.finalizados} leads finalizados (ganho + perdido)`,
      badge: delta(stats.deltaTaxa) || <>Sem comparação anterior</>,
      tooltip: "ganhos ÷ (ganhos + perdidos) no período.",
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "TICKET MÉDIO",
      value: fmtBRL(stats.ticket),
      sub: "Valor médio por venda ganha",
      badge: delta(stats.deltaTicket) || <>Sem comparação anterior</>,
      tooltip: "Soma do valor dos ganhos ÷ quantidade de ganhos.",
      accent: "from-fuchsia-500/15 to-fuchsia-500/0 border-fuchsia-500/30 text-fuchsia-300",
    },
    {
      label: "CICLO MÉDIO DE VENDAS",
      value: `${stats.cicloMedio.toFixed(0)} dias`,
      sub: "Da entrada no funil até o ganho",
      badge: <>Baseado em {stats.ganhosCount} ganhos</>,
      tooltip: "Média de (won_at − created_at) para ganhos do período.",
      accent: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-300",
    },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-950/80 to-slate-950/40 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 grid place-items-center text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
            📊
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-[0.18em] text-emerald-300">
              RESULTADO COMERCIAL
            </h2>
            <p className="text-xs text-slate-400">
              {funilNome ? `Funil: ${funilNome} · ` : ""}
              dados exclusivos deste funil ({stats.ativosCount} ativos · {stats.ganhosCount} ganhos · {stats.perdidosCount} perdidos)
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-900/70 border border-slate-800 p-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                period === p
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            title={c.tooltip}
            className={`rounded-xl border bg-gradient-to-br ${c.accent} p-4 backdrop-blur-sm relative overflow-hidden cursor-help`}
          >
            <div className="text-[10px] font-bold tracking-[0.15em] opacity-80 mb-2">
              {c.label}
            </div>
            <div className="text-3xl font-extrabold text-white mb-1 leading-tight">
              {c.value}
            </div>
            <div className="text-xs text-slate-300/80 mb-3 line-clamp-2">{c.sub}</div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/30 border border-white/5 text-[11px]">
              {c.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
