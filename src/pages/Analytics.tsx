import { useState } from "react";

/* ───────────────────────── DATA (mockup estático) ───────────────────────── */
const DATA = {
  funil: [
    { label: "Leads Novos", qty: 583, color: "#6366f1" },
    { label: "Agendados", qty: 210, color: "#3b82f6" },
    { label: "Compareceram", qty: 112, color: "#f59e0b" },
    { label: "Fechados", qty: 47, color: "#22c55e" },
  ],
  canais: [
    { canal: "WhatsApp Orgânico", valor: 31200, color: "#22c55e" },
    { canal: "Meta Ads", valor: 22800, color: "#3b82f6" },
    { canal: "Indicação", valor: 14700, color: "#a855f7" },
    { canal: "Instagram Direct", valor: 9100, color: "#f59e0b" },
    { canal: "Cold Call", valor: 4820, color: "#06b6d4" },
    { canal: "Email Mkt", valor: 1700, color: "#ef4444" },
  ],
  sdrs: [
    { user: "Carlos Lima", leads: 142, agendados: 54, conv: 38.0 },
    { user: "Ana Souza", leads: 118, agendados: 40, conv: 33.9 },
    { user: "Pedro Alves", leads: 97, agendados: 29, conv: 29.9 },
    { user: "Fernanda Costa", leads: 88, agendados: 24, conv: 27.3 },
  ],
  closers: [
    { user: "Marcos Silva", oport: 68, ganhos: 24, receita: 43200 },
    { user: "Juliana Ramos", oport: 54, ganhos: 17, receita: 28900 },
    { user: "Rafael Nunes", oport: 38, ganhos: 6, receita: 12220 },
  ],
  pilares: [
    { name: "Aquisição & Mkt", icon: "📢", score: 78, color: "#3b82f6", rows: [["Investimento mídia", "R$ 22.200"], ["ROAS", "3.8x"], ["CPL", "R$ 38"], ["CAC", "R$ 1.281"], ["Conc. top 3 canais", "71%"]], alert: "Alta dependência em 3 canais — diversifique para reduzir risco." },
    { name: "Gestão de Processos", icon: "⚙️", score: 62, color: "#6366f1", rows: [["Win Rate", "31.4%"], ["Ciclo médio", "16 dias"], ["Sales Velocity/dia", "R$ 2.810"], ["Gargalo", "Comparecimento"], ["Conv. comparec.", "53.3%"]], alert: "53% de comparecimento — lembretes automáticos podem recuperar +R$ 8k/mês." },
    { name: "Gestão Comercial", icon: "🎯", score: 70, color: "#f59e0b", rows: [["Realizado", "R$ 84.320"], ["Meta", "R$ 120.000"], ["% da meta", "70.3%"], ["Forecast 30d", "R$ 32.000"], ["Pipeline aberto", "R$ 186.400"]], alert: "Faltam R$ 35.680 em 12 dias — priorize deals quentes no pipeline." },
    { name: "Automação & Resposta", icon: "⚡", score: 48, color: "#ef4444", rows: [["Sem 1ª resposta", "19 leads · R$ 15.200"], ["Sem follow-up", "14 leads · R$ 7.840"], ["No-shows", "8 · R$ 12.400"], ["Recuperável 30d", "R$ 11.628"], ["Perda total", "R$ 38.760"]], alert: "Automatize 1ª resposta em <5min e recupere R$ 11.628 sem investir em ads." },
    { name: "Pessoas & Performance", icon: "👥", score: 74, color: "#22c55e", rows: [["Vendedores ativos", "5"], ["Oport./vendedor", "3.2"], ["Capacidade", "74%"], ["Top closer", "Marcos Silva"], ["Receita top closer", "R$ 43.200"]], alert: null as string | null },
    { name: "Crescimento & LTV", icon: "📈", score: 82, color: "#a855f7", rows: [["LTV proxy", "R$ 5.382"], ["LTV/CAC", "4.2x"], ["Payback CAC", "2.3 meses"], ["Δ Receita", "▲ 18.4%"], ["Δ Win Rate", "▲ 15.8%"]], alert: null as string | null },
  ],
  scoreDims: [
    { name: "Aquisição", nota: 78 },
    { name: "Processos", nota: 62 },
    { name: "Gestão de Metas", nota: 70 },
    { name: "Automação", nota: 48 },
    { name: "Pessoas", nota: 74 },
    { name: "LTV/Crescimento", nota: 82 },
    { name: "Saúde Financeira", nota: 71 },
  ],
  insights: [
    { tipo: "alerta", titulo: "Gargalo crítico: só 53% comparecem", desc: "De 210 agendados, apenas 112 apareceram. Implemente lembretes automáticos 24h e 2h antes para recuperar ~30 presentes/mês." },
    { tipo: "alerta", titulo: "19 leads sem 1ª resposta — R$ 15.200 em risco", desc: "Leads que não recebem resposta em 5 min têm 80% menos chance de avançar. Configure automação imediata." },
    { tipo: "oportunidade", titulo: "Win Rate subiu 15.8% — escale o que funciona", desc: "De 27.1% para 31.4%. Identifique os scripts e perfis dos 24 deals ganhos e replique para toda a equipe." },
    { tipo: "oportunidade", titulo: "Recuperável: R$ 11.628 sem investir em ads", desc: "Retomada de no-shows + follow-ups atrasados = 30% da perda estimada. ROI infinito." },
    { tipo: "ok", titulo: "LTV/CAC de 4.2x — unidade econômica saudável", desc: "Acima de 3x, o negócio é escalável. Cada R$ 1 investido em aquisição retorna R$ 4.20 em receita de vida útil." },
  ],
  cohorts: [
    { mes: "Dez/2025", entrados: 312, fechados: 87, conv: 27.9, receita: 156600 },
    { mes: "Jan/2026", entrados: 298, fechados: 79, conv: 26.5, receita: 141820 },
    { mes: "Fev/2026", entrados: 341, fechados: 98, conv: 28.7, receita: 175840 },
    { mes: "Mar/2026", entrados: 388, fechados: 118, conv: 30.4, receita: 211640 },
    { mes: "Abr/2026", entrados: 421, fechados: 134, conv: 31.8, receita: 240180 },
    { mes: "Mai/2026", entrados: 583, fechados: 47, conv: 8.1, receita: 84320 },
  ],
};

const BRL = (v: number) => "R$ " + v.toLocaleString("pt-BR");

/* ─────────────────────────── COMPONENT ─────────────────────────── */
export default function Analytics() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "ytd">("30d");
  const [spin, setSpin] = useState(false);

  const refresh = () => {
    setSpin(true);
    setTimeout(() => setSpin(false), 900);
  };

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
          <div style={{ fontSize: ".62rem", color: "#334155" }}>Atualizado agora há 3 min</div>
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
        <Section icon="💰" title="Resultado Financeiro" iconBg="rgba(34,197,94,.1)" iconColor="#22c55e" badge={{ text: "30 dias", color: "#22c55e", border: "rgba(34,197,94,.3)", bg: "rgba(34,197,94,.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: ".85rem" }}>
            <KpiCard variant="receita" label="Receita Bruta" value="R$ 84.320" sub="47 deals fechados" delta="▲ 18.4% vs mês anterior" deltaUp />
            <KpiCard variant="ticket" label="Ticket Médio" value="R$ 1.794" sub="vs R$ 1.620 anterior" delta="▲ 10.7%" deltaUp />
            <KpiCard variant="ltv" label="LTV / CAC" value="4.2x" sub="LTV R$ 5.382 · CAC R$ 1.281" delta="✓ Saudável ≥ 3x" deltaUp />
            <KpiCard variant="velocity" label="Sales Velocity / dia" value="R$ 2.810" sub="Ciclo médio 16 dias" delta="▲ 8.2%" deltaUp />
          </div>
        </Section>

        {/* 2. PERDA BANNER */}
        <div style={{ background: "linear-gradient(135deg,rgba(239,68,68,.12),rgba(220,38,38,.06))", border: "1px solid rgba(239,68,68,.3)", borderRadius: "1rem", padding: "1.1rem 1.4rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".7rem", fontWeight: 600, color: "#f87171", textTransform: "uppercase", letterSpacing: ".08em" }}>⚠️ Você está deixando de faturar</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f87171", letterSpacing: "-.04em" }}>R$ 38.760</div>
            <div style={{ fontSize: ".7rem", color: "#94a3b8" }}>estimativa de receita perdida nos últimos 30 dias</div>
          </div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginLeft: "auto" }}>
            <PerdaChip val="R$ 12.400" lbl="No-shows" sub="8 compromissos" />
            <PerdaChip val="R$ 15.200" lbl="Sem 1ª resposta" sub="19 leads parados" />
            <PerdaChip val="R$ 7.840" lbl="Sem follow-up" sub="14 esfriando" />
            <PerdaChip val="R$ 3.320" lbl="Perdidos" sub="6 oportunidades" />
            <PerdaChip val="R$ 11.628" lbl="Recuperável" sub="em 30 dias ✓" recuperavel />
          </div>
        </div>

        {/* 3. META + CAPACIDADE */}
        <Section icon="🎯" title="Metas & Previsibilidade" iconBg="rgba(59,130,246,.1)" iconColor="#60a5fa">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            {/* Meta vs Realizado */}
            <Card title="🏁 Meta vs Realizado — Mai/2026" headRight={<span style={{ fontSize: ".65rem", color: "#f59e0b", fontWeight: 700 }}>Faltam 12 dias</span>}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-.04em", lineHeight: 1 }}>R$ 84.320</div>
                  <div style={{ fontSize: ".85rem", color: "#64748b", marginTop: ".15rem" }}>Meta: R$ 120.000</div>
                  <div style={{ fontSize: ".75rem", color: "#f59e0b", marginTop: ".1rem", fontWeight: 600 }}>Faltam R$ 35.680 para bater</div>
                </div>
                <div style={{ flex: 2, minWidth: 220 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: ".4rem" }}>
                    <span style={{ fontSize: ".65rem", color: "#64748b" }}>Progresso</span>
                    <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f59e0b" }}>70.3%</span>
                  </div>
                  <div style={{ background: "#161b22", borderRadius: 9999, height: ".75rem", overflow: "hidden" }}>
                    <div style={{ width: "70.3%", height: "100%", borderRadius: 9999, background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: ".4rem", fontSize: ".62rem", color: "#475569" }}>
                    <span>R$ 0</span><span>R$ 60k</span><span>R$ 120k</span>
                  </div>
                  <div style={{ marginTop: ".85rem", display: "flex", flexDirection: "column", gap: ".35rem" }}>
                    <div style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#334155", marginBottom: ".2rem" }}>Forecast ponderado</div>
                    <div style={{ display: "flex", gap: ".5rem" }}>
                      <ForecastCol label="30 dias" val="R$ 32k" sub="Pipeline aberto" />
                      <ForecastCol label="60 dias" val="R$ 58k" sub="Probabilidade 60%" />
                      <ForecastCol label="90 dias" val="R$ 94k" sub="Probabilidade 40%" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Capacidade */}
            <Card title="⚡ Capacidade & Aquisição">
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem", marginBottom: ".25rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-.04em", color: "#f59e0b" }}>74%</span>
                  <span style={{ fontSize: ".72rem", color: "#64748b" }}>capacidade utilizada</span>
                  <span style={{ marginLeft: "auto", fontSize: ".68rem", color: "#94a3b8" }}>5 vendedores · 3.2 oport/vendor</span>
                </div>
                <div style={{ background: "#161b22", borderRadius: 9999, height: "1rem", overflow: "hidden", margin: ".6rem 0 .35rem" }}>
                  <div style={{ width: "74%", height: "100%", borderRadius: 9999, background: "linear-gradient(90deg,#f59e0b,#fbbf24)" }} />
                </div>
                <div style={{ fontSize: ".7rem", fontWeight: 600, color: "#f59e0b" }}>⚠️ Atenção: próximo do limite — monitore a fila</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: ".65rem" }}>
                <Mini label="ROAS" val="3.8x" valColor="#22c55e" hint="Inv. R$ 22.200" />
                <Mini label="CAC" val="R$ 1.281" valColor="#60a5fa" hint="Payback 2.3 meses" />
                <Mini label="CPL" val="R$ 38" valColor="#c084fc" hint="Mídia + outbound" />
                <Mini label="Win Rate" val="31.4%" valColor="#22c55e" hint="vs 27.1% anterior" />
              </div>
            </Card>
          </div>
        </Section>

        {/* 4. FUNIL + CANAIS */}
        <Section icon="🔀" title="Funil Comercial & Canais" iconBg="rgba(168,85,247,.1)" iconColor="#c084fc" badge={{ text: "Gargalo: Comparecimento", color: "#ef4444", border: "rgba(239,68,68,.3)", bg: "rgba(239,68,68,.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
            <Card title="📊 Funil do Período">
              <Funil />
            </Card>
            <Card title="📡 Receita por Canal" headRight={<span style={{ fontSize: ".62rem", color: "#f59e0b", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", padding: ".15rem .5rem", borderRadius: ".4rem", fontWeight: 700 }}>Alta dependência 71%</span>}>
              <Canais />
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
                  {DATA.sdrs.map(s => {
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
                  {DATA.closers.map(c => (
                    <tr key={c.user}>
                      <Td>{c.user}</Td><Td right>{c.oport}</Td><Td right>{c.ganhos}</Td>
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
            {DATA.pilares.map(p => {
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
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" strokeDasharray="228.7 326.7" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-.06em", lineHeight: 1 }}>70</div>
                    <div style={{ fontSize: ".55rem", textTransform: "uppercase", letterSpacing: ".12em", color: "#475569", fontWeight: 700 }}>Grow Score</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: ".85rem", fontWeight: 800, color: "#22c55e", marginBottom: ".25rem" }}>🟢 Operação em Crescimento</div>
                  <div style={{ fontSize: ".7rem", color: "#64748b", lineHeight: 1.6, maxWidth: 240 }}>Bom momentum geral. Foco em comparecimento e automação de follow-up para escalar sem aumentar CAC.</div>
                </div>
              </div>
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>
                {DATA.scoreDims.map(d => {
                  const tone = d.nota >= 70 ? "#22c55e" : d.nota >= 45 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                      <div style={{ fontSize: ".65rem", color: "#64748b", width: 130, flexShrink: 0 }}>{d.name}</div>
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
              {DATA.insights.map((i, idx) => {
                const styles = i.tipo === "alerta" ? { bg: "rgba(239,68,68,.06)", border: "rgba(239,68,68,.25)", icon: "⚠️" }
                  : i.tipo === "oportunidade" ? { bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.25)", icon: "💡" }
                    : { bg: "rgba(34,197,94,.06)", border: "rgba(34,197,94,.25)", icon: "✅" };
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", padding: ".75rem", borderRadius: ".75rem", border: `1px solid ${styles.border}`, background: styles.bg, marginBottom: ".5rem" }}>
                    <div style={{ width: "1.6rem", height: "1.6rem", borderRadius: ".4rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", flexShrink: 0, marginTop: ".1rem" }}>{styles.icon}</div>
                    <div>
                      <div style={{ fontSize: ".8rem", fontWeight: 700, marginBottom: ".2rem" }}>{i.titulo}</div>
                      <div style={{ fontSize: ".7rem", color: "#64748b", lineHeight: 1.5 }}>{i.desc}</div>
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
                  {DATA.cohorts.map(c => {
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

function Funil() {
  const max = DATA.funil[0].qty;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
      {DATA.funil.map((s, i) => {
        const pct = (s.qty / max) * 100;
        const conv = i > 0 ? ((s.qty / DATA.funil[i - 1].qty) * 100).toFixed(0) : null;
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

function Canais() {
  const total = DATA.canais.reduce((s, c) => s + c.valor, 0);
  return (
    <div>
      {DATA.canais.map((c, i) => {
        const pct = (c.valor / total) * 100;
        return (
          <div key={c.canal} style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".5rem 0", borderBottom: i < DATA.canais.length - 1 ? "1px solid #161b22" : "none" }}>
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
