import { useMemo, useState } from "react";
import { useGrowSalesBI, formatBRL } from "@/hooks/useGrowSalesBI";

const BRL = formatBRL;

/* ─────────────────────────── COMPONENT ─────────────────────────── */
export default function GrowSalesBI() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d");
  const [spin, setSpin] = useState(false);
  const { data, isFetching, refetch } = useGrowSalesBI(range);

  const refresh = async () => {
    setSpin(true);
    await refetch();
    setSpin(false);
  };

  const summary = data ?? {
    receita: { bruto: 0, ticketMedio: 0, ltv: 0, deals: 0, porCanal: [], porVendedor: [], porMes: [] },
    funil: { leadsNovos: 0, agendados: 0, compareceram: 0, fechados: 0, perdidos: 0, convAgenda: 0, convCompareceu: 0, convFechamento: 0, gargalo: "—" },
    perdas: { noShow: { qty: 0, valor: 0 }, leadSemResposta: { qty: 0, valor: 0 }, semFollowUp: { qty: 0, valor: 0 }, perdidos: { qty: 0, valor: 0 }, total: 0 },
    forecast: { pipelineAberto: 0, forecast30d: 0, forecast60d: 0, forecast90d: 0, metaAtual: 0, realizadoAtual: 0, pctMeta: 0 },
    capacidade: { utilizada: 0, abertosPorVendedor: 0, vendedoresAtivos: 0 },
    performance: { sdrs: [], closers: [] },
    growthScore: { total: 0, classificacao: "—", breakdown: [] },
    insights: [],
    cohorts: [],
    investimentoMidia: 0,
    cpl: null,
    cac: null,
    roas: null,
    ltvCac: null,
    paybackMeses: null,
    winRate: 0,
    cicloMedioDias: 0,
    salesVelocity: 0,
    concentracaoTop3: 0,
    previous: { receita: 0, ticketMedio: 0, deals: 0, winRate: 0, cicloMedioDias: 0 },
    generatedAt: new Date().toISOString(),
  };

  const funilData = [
    { label: "Leads Novos", qty: summary.funil.leadsNovos, color: "#6366f1" },
    { label: "Agendados", qty: summary.funil.agendados, color: "#3b82f6" },
    { label: "Compareceram", qty: summary.funil.compareceram, color: "#f59e0b" },
    { label: "Fechados", qty: summary.funil.fechados, color: "#22c55e" },
  ];

  const canaisData = summary.receita.porCanal.slice(0, 6).map((c, idx) => ({
    canal: c.canal,
    valor: c.valor,
    color: ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#06b6d4", "#ef4444"][idx] || "#64748b",
  }));

  const sdrs = summary.performance.sdrs;
  const closers = summary.performance.closers;

  const pillars = [
    {
      name: "Aquisição & Mkt",
      icon: "📢",
      score: summary.roas ? Math.min(100, Math.round(summary.roas * 20)) : 50,
      color: "#3b82f6",
      rows: [
        ["Investimento mídia", BRL(summary.investimentoMidia)],
        ["ROAS", summary.roas ? `${summary.roas.toFixed(1)}x` : "—"],
        ["CPL", summary.cpl ? BRL(summary.cpl) : "—"],
        ["CAC", summary.cac ? BRL(summary.cac) : "—"],
        ["Conc. top 3 canais", `${summary.concentracaoTop3.toFixed(0)}%`],
      ],
      alert: summary.concentracaoTop3 > 65 ? "Alta dependência em 3 canais — diversifique para reduzir risco." : null,
    },
    {
      name: "Processos Comerciais",
      icon: "⚙️",
      score: Math.min(100, Math.round(summary.winRate * 1.5)),
      color: "#6366f1",
      rows: [
        ["Win Rate", `${summary.winRate.toFixed(1)}%`],
        ["Ciclo médio", `${Math.round(summary.cicloMedioDias)} dias`],
        ["Sales Velocity/dia", BRL(summary.salesVelocity)],
        ["Gargalo", summary.funil.gargalo || "—"],
        ["Conv. comparec.", `${summary.funil.convCompareceu.toFixed(1)}%`],
      ],
      alert: summary.funil.convCompareceu < 60 ? "Comparecimento preocupa: lembretes e fluxos de presença são prioritários." : null,
    },
    {
      name: "Gestão Comercial",
      icon: "🎯",
      score: Math.min(100, Math.round(summary.forecast.pctMeta)),
      color: "#f59e0b",
      rows: [
        ["Realizado", BRL(summary.forecast.realizadoAtual)],
        ["Meta", BRL(summary.forecast.metaAtual)],
        ["% da meta", `${summary.forecast.pctMeta.toFixed(1)}%`],
        ["Forecast 30d", BRL(summary.forecast.forecast30d)],
        ["Pipeline aberto", BRL(summary.forecast.pipelineAberto)],
      ],
      alert: summary.forecast.pctMeta < 80 ? `Faltam ${BRL(Math.max(summary.forecast.metaAtual - summary.forecast.realizadoAtual, 0))} para a meta.` : null,
    },
    {
      name: "Automação & Resposta",
      icon: "⚡",
      score: summary.perdas.leadSemResposta.qty > 10 || summary.perdas.semFollowUp.qty > 10 ? 45 : 70,
      color: "#ef4444",
      rows: [
        ["Sem 1ª resposta", `${summary.perdas.leadSemResposta.qty} leads · ${BRL(summary.perdas.leadSemResposta.valor)}`],
        ["Sem follow-up", `${summary.perdas.semFollowUp.qty} leads · ${BRL(summary.perdas.semFollowUp.valor)}`],
        ["No-shows", `${summary.perdas.noShow.qty} · ${BRL(summary.perdas.noShow.valor)}`],
        ["Recuperável 30d", BRL(summary.recuperavel30d)],
        ["Perda total", BRL(summary.perdas.total)],
      ],
      alert: summary.perdas.total > 0 ? "Implemente follow-up e recuperação de no-show para reduzir perdas." : null,
    },
    {
      name: "Pessoas & Performance",
      icon: "👥",
      score: Math.min(100, Math.round(summary.capacidade.utilizada)),
      color: "#22c55e",
      rows: [
        ["Vendedores ativos", `${summary.capacidade.vendedoresAtivos}`],
        ["Oport./vendedor", `${summary.capacidade.abertosPorVendedor.toFixed(1)}`],
        ["Capacidade", `${summary.capacidade.utilizada.toFixed(0)}%`],
        ["Top closer", closers[0]?.user || "—"],
        ["Receita top closer", closers[0] ? BRL(closers[0].receita || 0) : "—"],
      ],
      alert: summary.capacidade.utilizada > 80 ? "Fila próxima ao limite — priorize triagem de oportunidades quentes." : null,
    },
    {
      name: "Crescimento & LTV",
      icon: "📈",
      score: summary.ltvCac ? Math.min(100, Math.round(Math.min(summary.ltvCac * 10, 100))) : 60,
      color: "#a855f7",
      rows: [
        ["LTV proxy", BRL(summary.receita.ltv)],
        ["LTV/CAC", summary.ltvCac ? `${summary.ltvCac.toFixed(1)}x` : "—"],
        ["Payback CAC", summary.paybackMeses ? `${summary.paybackMeses.toFixed(1)} meses` : "—"],
        ["Receita atual", BRL(summary.receita.bruto)],
        ["Win Rate", `${summary.winRate.toFixed(1)}%`],
      ],
      alert: summary.ltvCac && summary.ltvCac < 3 ? "LTV/CAC baixo — avalie retenção ou ticket médio." : null,
    },
  ];

  const scoreDims = [...summary.growthScore.breakdown];

  const lastUpdated = summary.generatedAt ? new Date(summary.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Agora";

  return (
    <div style={{ background: "#0b0f14", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Sora', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');`}</style>

      {/* TOPBAR */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #161b22", padding: ".75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-.03em", display: "flex", alignItems: "center", gap: ".4rem" }}>
            ✦ <span style={{ color: "#22c55e" }}>GROWSOS</span>
            <span style={{ fontSize: ".55rem", fontWeight: 700, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", padding: ".2rem .55rem", borderRadius: 9999, textTransform: "uppercase", letterSpacing: ".1em" }}>BI Estratégico</span>
          </div>
          <div style={{ fontSize: ".62rem", color: "#334155" }}>Atualizado {isFetching ? "..." : lastUpdated}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <div style={{ display: "flex", background: "#161b22", border: "1px solid #21262d", borderRadius: ".6rem", padding: ".2rem", gap: ".15rem" }}>
            {(["7d", "30d", "90d", "ytd"] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                fontSize: ".72rem", fontWeight: 700, padding: ".3rem .75rem", borderRadius: ".45rem", cursor: "pointer", border: "none",
                background: range === r ? "#22c55e" : "transparent",
                color: range === r ? "#fff" : "#64748b",
                boxShadow: range === r ? "0 2px 8px rgba(34,197,94,.4)" : "none",
                transition: "all .15s",
              }}>{r.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={refresh} style={{ display: "flex", alignItems: "center", gap: ".4rem", background: "#161b22", border: "1px solid #21262d", color: "#64748b", padding: ".4rem .85rem", borderRadius: ".6rem", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}>
            <span style={{ display: "inline-block", transition: "transform .2s", animation: spin ? "spin 0.9s linear" : "none" }}>↻</span> Atualizar
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 1600, margin: "0 auto" }}>

        {/* 1. KPI HEROES */}
        <Section icon="💰" title="Resultado Financeiro" iconBg="rgba(34,197,94,.1)" iconColor="#22c55e" badge={{ text: range.toUpperCase(), color: "#22c55e", border: "rgba(34,197,94,.3)", bg: "rgba(34,197,94,.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: ".85rem" }}>
            <KpiCard
              variant="receita"
              label="Receita Bruta"
              value={BRL(summary.receita.bruto)}
              sub={`${summary.receita.deals} deals fechados`}
              delta={`▲ ${((summary.receita.bruto - summary.previous.receita) / Math.max(summary.previous.receita || 1, 1) * 100).toFixed(1)}% vs período anterior`}
              deltaUp={summary.receita.bruto >= summary.previous.receita}
            />
            <KpiCard
              variant="ticket"
              label="Ticket Médio"
              value={BRL(summary.receita.ticketMedio)}
              sub={summary.previous.ticketMedio ? `vs ${BRL(summary.previous.ticketMedio)} anterior` : "Sem histórico anterior"}
              delta={`▲ ${((summary.receita.ticketMedio - summary.previous.ticketMedio) / Math.max(summary.previous.ticketMedio || 1, 1) * 100).toFixed(1)}%`}
              deltaUp={summary.receita.ticketMedio >= summary.previous.ticketMedio}
            />
            <KpiCard
              variant="ltv"
              label="LTV / CAC"
              value={summary.ltvCac ? `${summary.ltvCac.toFixed(1)}x` : "—"}
              sub={`LTV ${BRL(summary.receita.ltv)} · CAC ${summary.cac ? BRL(summary.cac) : "—"}`}
              delta={summary.ltvCac ? `✓ ${summary.ltvCac >= 3 ? "Saudável" : "Atenção"}` : "Sem dados"}
              deltaUp={!!summary.ltvCac}
            />
            <KpiCard
              variant="velocity"
              label="Sales Velocity / dia"
              value={BRL(summary.salesVelocity)}
              sub={`Ciclo médio ${Math.round(summary.cicloMedioDias)} dias`}
              delta={summary.salesVelocity > 0 ? `▲ ${summary.salesVelocity.toFixed(0)}` : "Sem dados"}
              deltaUp={summary.salesVelocity > 0}
            />
          </div>
        </Section>

        {/* 2. PERDA BANNER */}
        <div style={{ background: "linear-gradient(135deg,rgba(239,68,68,.12),rgba(220,38,38,.06))", border: "1px solid rgba(239,68,68,.3)", borderRadius: "1rem", padding: "1.1rem 1.4rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: "#f87171", textTransform: "uppercase", letterSpacing: ".08em" }}>⚠️ Você está deixando de faturar</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f87171", letterSpacing: "-.04em" }}>{BRL(summary.perdas.total)}</div>
            <div style={{ fontSize: ".7rem", color: "#94a3b8" }}>estimativa de receita perdida nos últimos {range === "7d" ? "7 dias" : range === "30d" ? "30 dias" : range === "90d" ? "90 dias" : "12 meses"}</div>
          </div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginLeft: "auto" }}>
            <PerdaChip val={BRL(summary.perdas.noShow.valor)} lbl="No-shows" sub={`${summary.perdas.noShow.qty} compromissos`} />
            <PerdaChip val={BRL(summary.perdas.leadSemResposta.valor)} lbl="Sem 1ª resposta" sub={`${summary.perdas.leadSemResposta.qty} leads parados`} />
            <PerdaChip val={BRL(summary.perdas.semFollowUp.valor)} lbl="Sem follow-up" sub={`${summary.perdas.semFollowUp.qty} leads`} />
            <PerdaChip val={BRL(summary.perdas.perdidos.valor)} lbl="Perdidos" sub={`${summary.perdas.perdidos.qty} oportunidades`} />
            <PerdaChip val={BRL(summary.recuperavel30d)} lbl="Recuperável" sub="em 30 dias ✓" recuperavel />
          </div>
        </div>

        {/* 3. META + CAPACIDADE */}
        <Section icon="🎯" title="Metas & Previsibilidade" iconBg="rgba(59,130,246,.1)" iconColor="#60a5fa">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            {/* Meta vs Realizado */}
            <Card title="🏁 Meta vs Realizado" headRight={<span style={{ fontSize: ".65rem", color: "#f59e0b", fontWeight: 700 }}>{summary.forecast.metaAtual > 0 ? `Meta ${BRL(summary.forecast.metaAtual)}` : "Meta não configurada"}</span>}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-.04em", lineHeight: 1 }}>{BRL(summary.forecast.realizadoAtual)}</div>
                  <div style={{ fontSize: ".85rem", color: "#64748b", marginTop: ".15rem" }}>Meta: {summary.forecast.metaAtual > 0 ? BRL(summary.forecast.metaAtual) : "—"}</div>
                  <div style={{ fontSize: ".75rem", color: "#f59e0b", marginTop: ".1rem", fontWeight: 600 }}>{summary.forecast.metaAtual > 0 ? `Faltam ${BRL(Math.max(summary.forecast.metaAtual - summary.forecast.realizadoAtual, 0))}` : "Meta não configurada"}</div>
                </div>
                <div style={{ flex: 2, minWidth: 220 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: ".4rem" }}>
                    <span style={{ fontSize: ".65rem", color: "#64748b" }}>Progresso</span>
                    <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f59e0b" }}>{summary.forecast.pctMeta.toFixed(1)}%</span>
                  </div>
                  <div style={{ background: "#161b22", borderRadius: 9999, height: ".75rem", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, summary.forecast.pctMeta))}%`, height: "100%", borderRadius: 9999, background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: ".4rem", fontSize: ".62rem", color: "#475569" }}>
                    <span>R$ 0</span><span>{BRL(summary.forecast.metaAtual / 2)}</span><span>{BRL(summary.forecast.metaAtual)}</span>
                  </div>
                  <div style={{ marginTop: ".85rem", display: "flex", flexDirection: "column", gap: ".35rem" }}>
                    <div style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#334155", marginBottom: ".2rem" }}>Forecast ponderado</div>
                    <div style={{ display: "flex", gap: ".5rem" }}>
                      <ForecastCol label="30 dias" val={BRL(summary.forecast.forecast30d)} sub="Pipeline aberto" />
                      <ForecastCol label="60 dias" val={BRL(summary.forecast.forecast60d)} sub="Probabilidade 60%" />
                      <ForecastCol label="90 dias" val={BRL(summary.forecast.forecast90d)} sub="Probabilidade 40%" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Capacidade */}
            <Card title="⚡ Capacidade & Aquisição">
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem", marginBottom: ".25rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-.04em", color: "#f59e0b" }}>{summary.capacidade.utilizada.toFixed(0)}%</span>
                  <span style={{ fontSize: ".72rem", color: "#64748b" }}>capacidade utilizada</span>
                  <span style={{ marginLeft: "auto", fontSize: ".68rem", color: "#94a3b8" }}>{summary.capacidade.vendedoresAtivos} vendedores · {summary.capacidade.abertosPorVendedor.toFixed(1)} oport/vendor</span>
                </div>
                <div style={{ background: "#161b22", borderRadius: 9999, height: "1rem", overflow: "hidden", margin: ".6rem 0 .35rem" }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, summary.capacidade.utilizada))}%`, height: "100%", borderRadius: 9999, background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
                </div>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: "#f59e0b" }}>{summary.capacidade.utilizada > 80 ? "⚠️ Atenção: próximo do limite — monitore a fila" : "Capacidade dentro da faixa recomendada"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: ".65rem" }}>
                <Mini label="ROAS" val={summary.roas ? `${summary.roas.toFixed(1)}x` : "—"} valColor="#22c55e" hint={`Inv. ${BRL(summary.investimentoMidia)}`} />
                <Mini label="CAC" val={summary.cac ? BRL(summary.cac) : "—"} valColor="#60a5fa" hint={summary.paybackMeses ? `${summary.paybackMeses.toFixed(1)} meses` : "—"} />
                <Mini label="CPL" val={summary.cpl ? BRL(summary.cpl) : "—"} valColor="#c084fc" hint="Leads pagos" />
                <Mini label="Win Rate" val={`${summary.winRate.toFixed(1)}%`} valColor="#22c55e" hint={summary.previous.winRate ? `vs ${summary.previous.winRate.toFixed(1)}% anterior` : "Sem histórico"} />
              </div>
            </Card>
          </div>
        </Section>

        {/* 4. FUNIL + CANAIS */}
        <Section icon="🔀" title="Funil Comercial & Canais" iconBg="rgba(168,85,247,.1)" iconColor="#c084fc" badge={{ text: `Gargalo: ${summary.funil.gargalo}`, color: "#ef4444", border: "rgba(239,68,68,.3)", bg: "rgba(239,68,68,.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            <Card title="📊 Funil do Período">
              <Funil data={funilData} />
            </Card>
            <Card title="📡 Receita por Canal" headRight={<span style={{ fontSize: ".62rem", color: "#f59e0b", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", padding: ".15rem .5rem", borderRadius: ".4rem", fontWeight: 700 }}>{summary.concentracaoTop3.toFixed(0)}% top 3</span>}>
              <Canais data={canaisData} />
            </Card>
          </div>
        </Section>

        {/* 5. EQUIPE */}
        <Section icon="👥" title="Performance da Equipe" iconBg="rgba(6,182,212,.1)" iconColor="#22d3ee">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            <Card title="📞 SDRs — Geração de Oportunidades" noPadding>
              <table style={tableStyle}>
                <thead><tr><Th>SDR</Th><Th right>Leads</Th><Th right>Agendou</Th><Th right>Conversão</Th></tr></thead>
                <tbody>
                  {sdrs.map((s: any) => {
                    const cls = s.conv >= 35 ? { bg: "rgba(34,197,94,.12)", c: "#22c55e" } : s.conv >= 28 ? { bg: "rgba(245,158,11,.12)", c: "#f59e0b" } : { bg: "rgba(239,68,68,.12)", c: "#ef4444" };
                    return (
                      <tr key={s.user}>
                        <Td>{s.user}</Td><Td right>{s.leads}</Td><Td right>{s.agendados}</Td>
                        <Td right><span style={{ display: "inline-flex", fontSize: ".6rem", fontWeight: 700, padding: ".15rem .45rem", borderRadius: ".35rem", background: cls.bg, color: cls.c }}>{s.conv.toFixed(1)}%</span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Card title="💼 Closers — Fechamento de Receita" noPadding>
              <table style={tableStyle}>
                <thead><tr><Th>Closer</Th><Th right>Oport.</Th><Th right>Ganhos</Th><Th right>Receita</Th></tr></thead>
                <tbody>
                  {closers.map((c: any) => (
                    <tr key={c.user}>
                      <Td>{c.user}</Td><Td right>{c.oportunidades ?? c.oport ?? 0}</Td><Td right>{c.ganhos}</Td>
                      <Td right><span style={{ color: "#22c55e", fontWeight: 700 }}>{BRL(c.receita)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </Section>

        {/* 6. PILARES GROW */}
        <Section icon="🧭" title="GROW Financeiro — 6 Pilares Estratégicos" iconBg="rgba(245,158,11,.1)" iconColor="#fbbf24">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: ".75rem" }}>
            {pillars.map(p => {
              const tone = p.score >= 70 ? "#22c55e" : p.score >= 45 ? "#f59e0b" : "#ef4444";
              return (
                <div key={p.name} style={{ background: "#161b22", border: "1px solid #1e293b", borderRadius: ".9rem", padding: ".9rem 1rem", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: p.color }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".5rem" }}>
                    <div style={{ fontSize: ".7rem", fontWeight: 700, color: "#94a3b8", display: "flex", alignItems: "center", gap: ".35rem" }}>{p.icon} {p.name}</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: tone }}>{p.score}</div>
                  </div>
                  <div style={{ background: "#0d1117", borderRadius: 9999, height: ".35rem", overflow: "hidden", marginBottom: ".65rem" }}>
                    <div style={{ height: "100%", borderRadius: 9999, width: `${p.score}%`, background: tone }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
                    {p.rows.map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: ".65rem" }}>
                        <span style={{ color: "#475569" }}>{k}</span>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {p.alert && (
                    <div style={{ marginTop: ".6rem", fontSize: ".62rem", padding: ".4rem .6rem", borderLeft: "2px solid #f59e0b", background: "rgba(245,158,11,.06)", color: "#fbbf24", borderRadius: "0 .35rem .35rem 0" }}>{p.alert}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* 7. GROW SCORE + INSIGHTS */}
        <Section icon="🏆" title="Grow Score & Inteligência Estratégica" iconBg="rgba(34,197,94,.1)" iconColor="#22c55e">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            <Card title="🏆 Grow Score — Saúde da Operação">
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
                  <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#161b22" strokeWidth="10" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(summary.growthScore.total / 100) * 228.7} 326.7`} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-.06em", lineHeight: 1 }}>{summary.growthScore.total}</div>
                    <div style={{ fontSize: ".55rem", textTransform: "uppercase", letterSpacing: ".12em", color: "#475569", fontWeight: 700 }}>Grow Score</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: ".85rem", fontWeight: 800, color: "#22c55e", marginBottom: ".25rem" }}>{summary.growthScore.classificacao}</div>
                  <div style={{ fontSize: ".7rem", color: "#64748b", lineHeight: 1.6, maxWidth: 240 }}>{summary.insights[0]?.desc || "Saúde geral e recomendações baseadas nos dados atuais."}</div>
                </div>
              </div>
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>
                {scoreDims.map((d: any) => {
                  const tone = d.nota >= 70 ? "#22c55e" : d.nota >= 45 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={d.dimensao} style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                      <div style={{ fontSize: ".65rem", color: "#64748b", width: 130, flexShrink: 0 }}>{d.dimensao}</div>
                      <div style={{ flex: 1, background: "#161b22", borderRadius: 9999, height: ".45rem", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 9999, width: `${d.nota}%`, background: tone }} />
                      </div>
                      <div style={{ fontSize: ".65rem", fontWeight: 700, color: tone, width: 30, textAlign: "right" }}>{d.nota}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="🤖 IA Insights — Alertas & Oportunidades">
              {summary.insights.map((i: any, idx: number) => {
                const styles = i.tipo === "alerta" ? { bg: "rgba(239,68,68,.06)", border: "rgba(239,68,68,.25)", icon: "⚠️" }
                  : i.tipo === "oportunidade" ? { bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.25)", icon: "💡" }
                    : { bg: "rgba(34,197,94,.06)", border: "rgba(34,197,94,.25)", icon: "✅" };
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", padding: ".75rem", borderRadius: ".75rem", border: `1px solid ${styles.border}`, background: styles.bg, marginBottom: ".5rem" }}>
                    <div style={{ width: "1.6rem", height: "1.6rem", borderRadius: ".4rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", flexShrink: 0, marginTop: ".1rem" }}>{styles.icon}</div>
                    <div>
                      <div style={{ fontSize: ".8rem", fontWeight: 700, marginBottom: ".2rem" }}>{i.titulo}</div>
                      <div style={{ fontSize: ".7rem", color: "#64748b", lineHeight: 1.5 }}>{i.descricao || i.desc}</div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </Section>

        {/* 8. COHORT */}
        <Section icon="📅" title="Cohort — Qualidade dos Leads por Mês de Entrada" iconBg="rgba(6,182,212,.1)" iconColor="#22d3ee">
          <Card noPadding>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <Th>Mês Entrada</Th>
                    <Th right>Entrados</Th><Th right>Fechados</Th><Th right>Conversão</Th><Th right>Receita</Th><Th right>Ticket Médio</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.cohorts.map(c => {
                    const cls = c.conv >= 25 ? "#22c55e" : c.conv >= 15 ? "#f59e0b" : "#ef4444";
                    const ticket = c.fechados > 0 ? Math.round(c.receita / c.fechados) : 0;
                    return (
                      <tr key={c.mes}>
                        <Td><strong style={{ color: "#e2e8f0" }}>{c.mes}</strong></Td>
                        <Td right>{c.entrados}</Td>
                        <Td right>{c.fechados}</Td>
                        <Td right><span style={{ color: cls, fontWeight: 700 }}>{c.conv.toFixed(1)}%</span></Td>
                        <Td right><span style={{ color: "#22c55e", fontWeight: 700 }}>{BRL(c.receita)}</span></Td>
                        <Td right>{BRL(ticket)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

      </div>
    </div>
  );
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

function Section({ icon, title, iconBg, iconColor, badge, children }: any) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".75rem" }}>
        <div style={{ width: "1.8rem", height: "1.8rem", borderRadius: ".5rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", flexShrink: 0, background: iconBg, color: iconColor }}>{icon}</div>
        <div style={{ fontSize: ".72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: "#94a3b8" }}>{title}</div>
        <div style={{ flex: 1, height: 1, background: "#161b22" }} />
        {badge && <div style={{ fontSize: ".6rem", fontWeight: 700, padding: ".15rem .55rem", borderRadius: 9999, border: `1px solid ${badge.border}`, color: badge.color, background: badge.bg }}>{badge.text}</div>}
      </div>
      {children}
    </div>
  );
}

function Card({ title, headRight, noPadding, children }: any) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #161b22", borderRadius: "1rem", overflow: "hidden" }}>
      {title && (
        <div style={{ padding: ".85rem 1.1rem", borderBottom: "1px solid #161b22", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: ".78rem", fontWeight: 700, color: "#94a3b8", display: "flex", alignItems: "center", gap: ".4rem" }}>{title}</div>
          {headRight}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : "1rem 1.1rem" }}>{children}</div>
    </div>
  );
}

function KpiCard({ variant, label, value, sub, delta, deltaUp }: any) {
  const styles: Record<string, any> = {
    receita: { bg: "linear-gradient(135deg,rgba(34,197,94,.1),rgba(16,163,74,.05))", border: "rgba(34,197,94,.25)", glow: "#22c55e", val: "#4ade80" },
    ticket: { bg: "linear-gradient(135deg,rgba(59,130,246,.1),rgba(29,78,216,.05))", border: "rgba(59,130,246,.25)", glow: "#3b82f6", val: "#60a5fa" },
    ltv: { bg: "linear-gradient(135deg,rgba(168,85,247,.1),rgba(126,34,206,.05))", border: "rgba(168,85,247,.25)", glow: "#a855f7", val: "#c084fc" },
    velocity: { bg: "linear-gradient(135deg,rgba(245,158,11,.1),rgba(180,83,9,.05))", border: "rgba(245,158,11,.25)", glow: "#f59e0b", val: "#fbbf24" },
  };
  const s = styles[variant];
  return (
    <div style={{ borderRadius: "1rem", padding: "1.1rem 1.2rem", border: `1px solid ${s.border}`, background: s.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 90, height: 90, borderRadius: "50%", opacity: 0.08, filter: "blur(20px)", background: s.glow }} />
      <div style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", opacity: 0.7, marginBottom: ".3rem" }}>{label}</div>
      <div style={{ fontSize: "1.65rem", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, color: s.val }}>{value}</div>
      <div style={{ fontSize: ".65rem", marginTop: ".3rem", opacity: 0.6 }}>{sub}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: ".25rem", fontSize: ".65rem", fontWeight: 700, padding: ".15rem .45rem", borderRadius: ".35rem", marginTop: ".4rem", background: deltaUp ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", color: deltaUp ? "#22c55e" : "#ef4444" }}>{delta}</div>
    </div>
  );
}

function PerdaChip({ val, lbl, sub, recuperavel }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: recuperavel ? "rgba(34,197,94,.08)" : "#0d1117", border: `1px solid ${recuperavel ? "rgba(34,197,94,.25)" : "#21262d"}`, borderRadius: ".65rem", padding: ".55rem .9rem", minWidth: 90 }}>
      <div style={{ fontSize: ".9rem", fontWeight: 800, color: recuperavel ? "#22c55e" : "#f87171" }}>{val}</div>
      <div style={{ fontSize: ".58rem", color: "#64748b", marginTop: ".1rem", textAlign: "center" }}>{lbl}<br />{sub}</div>
    </div>
  );
}

function ForecastCol({ label, val, sub }: any) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: ".75rem", background: "#161b22", borderRadius: ".75rem", border: "1px solid #1e293b" }}>
      <div style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#475569", marginBottom: ".3rem" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#60a5fa" }}>{val}</div>
      <div style={{ fontSize: ".6rem", color: "#334155", marginTop: ".15rem" }}>{sub}</div>
    </div>
  );
}

function Mini({ label, val, valColor, hint }: any) {
  return (
    <div style={{ background: "#161b22", border: "1px solid #1e293b", borderRadius: ".75rem", padding: ".75rem .9rem" }}>
      <div style={{ fontSize: ".58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#475569", marginBottom: ".25rem" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-.03em", color: valColor }}>{val}</div>
      <div style={{ fontSize: ".6rem", color: "#334155", marginTop: ".15rem" }}>{hint}</div>
    </div>
  );
}

function Funil({ data }: any) {
  const max = data.length ? data[0].qty : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
      {data.map((s: any, i: number) => {
        const pct = max ? (s.qty / max) * 100 : 0;
        const conv = i > 0 && data[i - 1]?.qty ? ((s.qty / data[i - 1].qty) * 100).toFixed(0) : null;
        return (
          <div key={s.label}>
            {i > 0 && <div style={{ fontSize: ".6rem", color: "#334155", textAlign: "center", padding: ".1rem 0 .1rem 120px" }}>↓ {conv}% conversão</div>}
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, color: "#94a3b8", width: 110, flexShrink: 0, textAlign: "right" }}>{s.label}</div>
              <div style={{ flex: 1, background: "#161b22", borderRadius: 9999, height: "1.4rem", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 9999, display: "flex", alignItems: "center", paddingLeft: ".6rem", width: `${pct}%`, background: s.color }}>
                  <span style={{ fontSize: ".65rem", fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{s.qty.toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div style={{ fontSize: ".6rem", fontWeight: 700, width: 48, textAlign: "right", color: s.color }}>{pct.toFixed(0)}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Canais({ data }: any) {
  const total = data.reduce((s: number, c: any) => s + c.valor, 0);
  return (
    <div>
      {data.map((c: any, i: number) => {
        const pct = total ? (c.valor / total) * 100 : 0;
        return (
          <div key={c.canal} style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".5rem 0", borderBottom: i < data.length - 1 ? "1px solid #161b22" : "none" }}>
            <div style={{ width: ".5rem", height: ".5rem", borderRadius: "50%", flexShrink: 0, background: c.color }} />
            <div style={{ fontSize: ".75rem", fontWeight: 600, flex: 1 }}>{c.canal}</div>
            <div style={{ width: 120, background: "#161b22", borderRadius: 9999, height: ".4rem", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, background: c.color }} />
            </div>
            <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#22c55e", width: 80, textAlign: "right" }}>{BRL(c.valor)}</div>
            <div style={{ fontSize: ".62rem", color: "#475569", width: 40, textAlign: "right" }}>{pct.toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

const tableStyle: React.CSSProperties = { width: "100%", fontSize: ".75rem", borderCollapse: "collapse" };

function Th({ children, right }: any) {
  return <th style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#475569", padding: ".5rem .75rem", textAlign: right ? "right" : "left", borderBottom: "1px solid #161b22" }}>{children}</th>;
}

function Td({ children, right }: any) {
  return <td style={{ padding: ".55rem .75rem", borderBottom: "1px solid #0d1117", color: right ? "#94a3b8" : "#e2e8f0", fontWeight: 500, textAlign: right ? "right" : "left" }}>{children}</td>;
}
