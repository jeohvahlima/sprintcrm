import { useMemo, useState } from "react";

interface Lead {
  id: string;
  value?: number;
  etapa_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
}

interface Props {
  leads: Lead[];
  etapas: Etapa[];
}

type Period = "7d" | "30d" | "90d" | "ytd";

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "ytd": "Ano atual",
};

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, "ytd": 365 };

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function classifyEtapa(nome: string): "ganho" | "perdido" | "ativo" {
  const n = (nome || "").toLowerCase();
  if (/(ganho|ganh|fech|won|conclu[ií]d)/.test(n)) return "ganho";
  if (/(perdid|perda|lost|cancel|descart)/.test(n)) return "perdido";
  return "ativo";
}

export function ResultadoComercialDashboard({ leads, etapas }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const stats = useMemo(() => {
    const now = Date.now();
    const days = PERIOD_DAYS[period];
    const cutoff =
      period === "ytd"
        ? new Date(new Date().getFullYear(), 0, 1).getTime()
        : now - days * 24 * 60 * 60 * 1000;
    const prevCutoff = cutoff - days * 24 * 60 * 60 * 1000;

    const etapaMap = new Map(etapas.map((e) => [e.id, e]));
    const tipoDe = (etapaId?: string) => {
      const et = etapaId ? etapaMap.get(etapaId) : undefined;
      return et ? classifyEtapa(et.nome) : "ativo";
    };

    let ativoCount = 0,
      ativoValor = 0,
      ganhoCount = 0,
      ganhoValor = 0,
      perdidoCount = 0,
      perdidoValor = 0,
      proximosFechar = 0,
      cicloDiasSoma = 0,
      cicloDiasN = 0;

    let prevGanhoCount = 0,
      prevGanhoValor = 0,
      prevPerdidoCount = 0;

    const porEtapa: Record<string, number> = {};

    leads.forEach((l) => {
      const tipo = tipoDe(l.etapa_id);
      const valor = Number(l.value) || 0;
      const updated = l.updated_at ? new Date(l.updated_at).getTime() : 0;
      const created = l.created_at ? new Date(l.created_at).getTime() : 0;

      if (tipo === "ativo") {
        ativoCount += 1;
        ativoValor += valor;
        if (l.etapa_id) porEtapa[l.etapa_id] = (porEtapa[l.etapa_id] || 0) + 1;
        // Próximos a fechar: etapa nas 2 últimas posições do funil ativo
        const et = l.etapa_id ? etapaMap.get(l.etapa_id) : undefined;
        if (et) {
          const ativas = etapas.filter((e) => classifyEtapa(e.nome) === "ativo");
          const maxPos = Math.max(...ativas.map((e) => e.posicao ?? 0));
          if ((et.posicao ?? 0) >= maxPos - 1 && maxPos > 0) proximosFechar += 1;
        }
      } else if (tipo === "ganho") {
        if (updated >= cutoff) {
          ganhoCount += 1;
          ganhoValor += valor;
          if (created) {
            cicloDiasSoma += (updated - created) / (1000 * 60 * 60 * 24);
            cicloDiasN += 1;
          }
        } else if (updated >= prevCutoff) {
          prevGanhoCount += 1;
          prevGanhoValor += valor;
        }
      } else if (tipo === "perdido") {
        if (updated >= cutoff) {
          perdidoCount += 1;
          perdidoValor += valor;
        } else if (updated >= prevCutoff) {
          prevPerdidoCount += 1;
        }
      }
    });

    const finalizados = ganhoCount + perdidoCount;
    const taxaConv = finalizados > 0 ? (ganhoCount / finalizados) * 100 : 0;
    const ticket = ganhoCount > 0 ? ganhoValor / ganhoCount : 0;
    const prevFinalizados = prevGanhoCount + prevPerdidoCount;
    const prevTaxa = prevFinalizados > 0 ? (prevGanhoCount / prevFinalizados) * 100 : 0;
    const prevTicket = prevGanhoCount > 0 ? prevGanhoValor / prevGanhoCount : 0;
    const cicloMedio = cicloDiasN > 0 ? cicloDiasSoma / cicloDiasN : 0;

    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

    return {
      ativoCount,
      ativoValor,
      ganhoCount,
      ganhoValor,
      perdidoCount,
      perdidoValor,
      proximosFechar,
      taxaConv,
      ticket,
      cicloMedio,
      finalizados,
      deltaGanhos: pct(ganhoCount, prevGanhoCount),
      deltaTaxa: pct(taxaConv, prevTaxa),
      deltaTicket: pct(ticket, prevTicket),
      porEtapa,
    };
  }, [leads, etapas, period]);

  // Distribuição por etapa (top 3)
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

  const cards: Array<{
    label: string;
    value: string;
    sub: string;
    badge: React.ReactNode;
    accent: string;
  }> = [
    {
      label: "VALOR EM PIPELINE",
      value: fmtBRL(stats.ativoValor),
      sub: "Oportunidades em aberto",
      badge: <>Forecast {period}: {fmtBRL(stats.ativoValor * 0.3)}</>,
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "NEGOCIAÇÕES ATIVAS",
      value: stats.ativoCount.toLocaleString("pt-BR"),
      sub: distribuicao,
      badge: <>Distribuição por etapa do funil</>,
      accent: "from-sky-500/15 to-sky-500/0 border-sky-500/30 text-sky-300",
    },
    {
      label: "PRÓXIMOS A FECHAR",
      value: stats.proximosFechar.toLocaleString("pt-BR"),
      sub: "Etapas finais do funil",
      badge: <>Probabilidade alta · etapa avançada</>,
      accent: "from-amber-500/15 to-amber-500/0 border-amber-500/30 text-amber-300",
    },
    {
      label: "GANHOS",
      value: stats.ganhoCount.toLocaleString("pt-BR"),
      sub: `${fmtBRL(stats.ganhoValor)} · ${stats.ganhoCount} negócios`,
      badge: delta(stats.deltaGanhos) || <>Sem comparação anterior</>,
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "PERDIDOS",
      value: stats.perdidoCount.toLocaleString("pt-BR"),
      sub: `${fmtBRL(stats.perdidoValor)} · ${stats.perdidoCount} oportunidades`,
      badge: <>Acompanhe motivos de perda</>,
      accent: "from-rose-500/15 to-rose-500/0 border-rose-500/30 text-rose-300",
    },
    {
      label: "RESGATADOS",
      value: "0",
      sub: "Voltaram para o funil",
      badge: <>Nenhuma reativação detectada</>,
      accent: "from-violet-500/15 to-violet-500/0 border-violet-500/30 text-violet-300",
    },
    {
      label: "TAXA DE CONVERSÃO",
      value: `${stats.taxaConv.toFixed(1)}%`,
      sub: `${stats.finalizados} leads finalizados (ganho + perdido)`,
      badge: delta(stats.deltaTaxa) || <>Sem comparação anterior</>,
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-300",
    },
    {
      label: "TICKET MÉDIO",
      value: fmtBRL(stats.ticket),
      sub: "Valor médio por venda ganha",
      badge: delta(stats.deltaTicket) || <>Sem comparação anterior</>,
      accent: "from-fuchsia-500/15 to-fuchsia-500/0 border-fuchsia-500/30 text-fuchsia-300",
    },
    {
      label: "CICLO MÉDIO DE VENDAS",
      value: `${stats.cicloMedio.toFixed(0)} dias`,
      sub: "Do lead ao fechamento (ganhos)",
      badge: <>Baseado em {stats.ganhoCount} ganhos</>,
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
              Indicadores de performance e eficiência do funil
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
            className={`rounded-xl border bg-gradient-to-br ${c.accent} p-4 backdrop-blur-sm relative overflow-hidden`}
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
