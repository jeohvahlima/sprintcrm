import { useMemo, useState } from "react";
import { Briefcase, Trophy, Timer, Wallet } from "lucide-react";

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
const PERIOD_LABEL: Record<Period, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", ytd: "Ano" };
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90, ytd: 365 };

const STATUS_GANHO = ["ganho", "won", "fechado", "concluido", "concluído"];
const STATUS_PERDIDO = ["perdido", "lost", "cancelado", "descartado"];

function classifyStatus(status?: string | null): "ganho" | "perdido" | "ativo" {
  const s = (status || "").toLowerCase().trim();
  if (STATUS_GANHO.includes(s)) return "ganho";
  if (STATUS_PERDIDO.includes(s)) return "perdido";
  return "ativo";
}

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}k`;
  return `R$${Math.round(v)}`;
};

export function ResultadoComercialDashboard({ leads, etapas, funilNome }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const stats = useMemo(() => {
    const now = Date.now();
    const days = PERIOD_DAYS[period];
    const cutoff = period === "ytd"
      ? new Date(new Date().getFullYear(), 0, 1).getTime()
      : now - days * 86400000;
    const prevCutoff = cutoff - days * 86400000;

    const inPeriod = (iso?: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= cutoff && t <= now;
    };
    const inPrev = (iso?: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= prevCutoff && t < cutoff;
    };

    const ativos: Lead[] = [];
    const ganhos: Lead[] = [];
    const perdidos: Lead[] = [];
    const ganhosPrev: Lead[] = [];

    let totalCount = 0;

    leads.forEach((l) => {
      const tipo = classifyStatus(l.status);
      if (tipo === "ativo") {
        ativos.push(l);
        totalCount++;
      } else if (tipo === "ganho") {
        const d = l.won_at || l.updated_at;
        if (inPeriod(d)) { ganhos.push(l); totalCount++; }
        else if (inPrev(d)) ganhosPrev.push(l);
      } else {
        const d = l.lost_at || l.updated_at;
        if (inPeriod(d)) { perdidos.push(l); totalCount++; }
      }
    });

    const pipeline = ativos.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const finalizados = ganhos.length + perdidos.length;
    const winRate = finalizados > 0 ? (ganhos.length / finalizados) * 100 : 0;

    let cicloSoma = 0, cicloN = 0;
    ganhos.forEach((l) => {
      const ini = l.created_at ? new Date(l.created_at).getTime() : 0;
      const fim = l.won_at ? new Date(l.won_at).getTime() : 0;
      if (ini && fim && fim > ini) { cicloSoma += (fim - ini) / 86400000; cicloN++; }
    });
    const ciclo = cicloN > 0 ? cicloSoma / cicloN : 0;

    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

    return {
      totalCount,
      ativosCount: ativos.length,
      ganhosCount: ganhos.length,
      perdidosCount: perdidos.length,
      pipeline,
      winRate,
      ciclo,
      deltaGanhos: pct(ganhos.length, ganhosPrev.length),
    };
  }, [leads, period]);

  type Card = {
    label: string;
    value: string;
    icon: any;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    delta: string;
    deltaColor: string;
  };

  const cards: Card[] = [
    {
      label: "TOTAL DE LEADS",
      value: stats.totalCount.toLocaleString("pt-BR"),
      icon: Briefcase,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
      delta: `${stats.ativosCount} ativos no funil`,
      deltaColor: "text-emerald-600",
    },
    {
      label: "PIPELINE TOTAL",
      value: fmtCompact(stats.pipeline),
      icon: Wallet,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-blue-600",
      delta: "Oportunidades em aberto",
      deltaColor: "text-blue-600",
    },
    {
      label: "WIN RATE",
      value: `${stats.winRate.toFixed(1)}%`,
      icon: Trophy,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      valueColor: "text-violet-600",
      delta: stats.deltaGanhos !== 0 && isFinite(stats.deltaGanhos)
        ? `${stats.deltaGanhos > 0 ? "▲" : "▼"} ${Math.abs(stats.deltaGanhos).toFixed(1)}% vs período ant.`
        : `${stats.ganhosCount} ganhos · ${stats.perdidosCount} perdidos`,
      deltaColor: stats.deltaGanhos >= 0 ? "text-emerald-600" : "text-rose-600",
    },
    {
      label: "CICLO MÉDIO",
      value: `${Math.round(stats.ciclo)} dias`,
      icon: Timer,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      valueColor: "text-orange-600",
      delta: `Baseado em ${stats.ganhosCount} ganhos`,
      deltaColor: "text-orange-600",
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {funilNome ? `Funil: ${funilNome} · ` : ""}
          {stats.ativosCount} ativos · {stats.ganhosCount} ganhos · {stats.perdidosCount} perdidos
        </p>
        <div className="inline-flex gap-1 rounded-full bg-muted/60 border border-border p-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-full transition font-medium ${
                period === p
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-2xl bg-card border border-border p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition"
            >
              <div className={`h-11 w-11 rounded-xl ${c.iconBg} ${c.iconColor} grid place-items-center shrink-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-2xl font-extrabold leading-tight ${c.valueColor}`}>{c.value}</div>
                <div className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground mt-0.5">
                  {c.label}
                </div>
                <div className={`text-[11px] font-semibold mt-1 ${c.deltaColor}`}>{c.delta}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
