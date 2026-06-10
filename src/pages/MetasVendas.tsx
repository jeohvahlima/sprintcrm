import { useEffect, useState } from "react";
import IndividualGoalsManager from "@/components/metas/IndividualGoalsManager";
import { DEFAULT_DIAGNOSTICO, detectGargalos, type DiagnosticoMaquina, useDiagnostico } from "@/hooks/useSalesMachineWizard";
import { toast } from "sonner";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR");
const fmtR = (v: number) => "R$ " + fmt(Math.round(v));

/* ─────────────────────────── COLORS ─────────────────────────── */
const C = {
  green: "#22C55E",
  greenDark: "#16A34A",
  greenBg: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red: "#EF4444",
  redBg: "#FEF2F2",
  amber: "#F59E0B",
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  purple: "#8B5CF6",
  purpleBg: "#F5F3FF",
  gray: "#6B7280",
  grayBg: "#F9FAFB",
  border: "#E5E7EB",
  white: "#FFFFFF",
  text: "#111827",
  textSub: "#6B7280",
};

/* ─────────────────────────── KPI TOP ─────────────────────────── */
function KpiTop() {
  const metas: Array<[string, number, number]> = [
    ["🎯 200 prospecções", 0, 200],
    ["📅 40 reuniões", 0, 40],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
      <div style={{ background: C.white, border: `1.5px solid ${C.greenBorder}`, borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.greenDark, display: "flex", alignItems: "center", gap: 5 }}>🎯 META DO DIA</span>
          <span style={{ background: C.greenBg, color: C.greenDark, fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>Sugerida</span>
        </div>
        {metas.map(([label, val, max]) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSub, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span>{val}/{max} · 0%</span>
            </div>
            <div style={{ background: C.border, borderRadius: 99, height: 6 }}>
              <div style={{ width: "0%", height: "100%", background: C.green, borderRadius: 99 }} />
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: C.text, marginTop: 4 }}>
          <span>PROGRESSO GERAL</span><span>0%</span>
        </div>
      </div>

      <div style={{ background: C.redBg, border: `1.5px solid #FECACA`, borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>⚠️ PERDA ESTIMADA</div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>Você executou apenas <b>0%</b> da rotina hoje.</div>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: C.textSub, marginBottom: 4 }}>Receita não gerada hoje</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.red, marginBottom: 12 }}>R$ 159.960</div>
        <button style={{ background: C.red, color: "#fff", border: "none", borderRadius: 10, padding: "9px 0", width: "100%", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Recuperar agora →
        </button>
      </div>

      <div style={{ background: `linear-gradient(135deg,#FFFBEB,#FEF3C7)`, border: `1.5px solid ${C.amberBorder}`, borderRadius: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>🏆 SUA POSIÇÃO</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 900, color: C.text, lineHeight: 1 }}>#2</span>
          <span style={{ fontSize: 14, color: C.textSub }}>de 3</span>
        </div>
        <div style={{ fontSize: 13, color: C.greenDark, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>📈 Faltam 1115 XP</div>
        <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
          para ultrapassar <b>Jeohvah Lima</b> e subir para #1
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── MÁQUINA ─────────────────────────── */
const STEPS = [
  { id: 1, icon: "🩺", label: "Diagnóstico" },
  { id: 2, icon: "🎯", label: "Meta & Prazo" },
  { id: 3, icon: "🚀", label: "Plano de Ação" },
  { id: 4, icon: "📋", label: "Acompanhamento" },
  { id: 5, icon: "🏆", label: "Performance" },
];

const ACTIVITIES = [
  { key: "cold_call", icon: "📞", label: "Cold Call" },
  { key: "cold_email", icon: "📧", label: "Cold E-mail" },
  { key: "social_selling", icon: "💼", label: "Social Selling" },
  { key: "followup", icon: "🔁", label: "Follow-up" },
  { key: "indicacao", icon: "🤝", label: "Indicação" },
  { key: "inbound", icon: "📣", label: "Inbound" },
  { key: "evento", icon: "🎪", label: "Eventos" },
  { key: "whatsapp", icon: "💬", label: "WhatsApp" },
];

type DiagKey = "fat" | "meses" | "sdrs" | "closers" | "ticket" | "lead2reu" | "showup" | "winrate";
type CheckinKey = "leads" | "respostas" | "oportunidades" | "reuAg" | "reuNoShow" | "reuReal" | "negociacoes" | "vendasPerdidas" | "vendas" | "fupRecuperadas" | "fupOportunidade" | "followups" | "ticket" | "fat";

function Maquina() {
  const [step, setStep] = useState(1);
  const { data: diagDb, upsert } = useDiagnostico();
  const [acts, setActs] = useState<number[]>([0, 3, 7]);
  const [diag, setDiag] = useState<Record<DiagKey, number>>({ fat: 3000, meses: 6, sdrs: 2, closers: 1, ticket: 3999, lead2reu: 30, showup: 30, winrate: 38 });
  const [meta, setMeta] = useState({ metaFat: 60000, prazo: 1, manterEstrutura: true });
  const [plano, setPlano] = useState({ modelo: "B2B Consultivo (SDR + Closer)" });
  const [offers, setOffers] = useState<Array<{ nome: string; ticket: number; qtd: number }>>([]);
  const [newOffer, setNewOffer] = useState<{ nome: string; ticket: number; qtd: number } | null>(null);
  const [progressoSemana, setProgressoSemana] = useState(0);
  const [realizadoMes, setRealizadoMes] = useState<Record<number, number>>({});
  const [checkin, setCheckin] = useState<Record<CheckinKey, number> & { obs: string; script: string }>({ leads: 0, respostas: 0, oportunidades: 0, reuAg: 0, reuNoShow: 0, reuReal: 0, negociacoes: 0, vendasPerdidas: 0, vendas: 0, fupRecuperadas: 0, fupOportunidade: 0, followups: 0, ticket: 0, fat: 0, obs: "", script: "" });

  useEffect(() => {
    if (!diagDb) return;
    setDiag({
      fat: diagDb.faturamento_atual ?? 0,
      meses: diagDb.meses_travado ?? 0,
      sdrs: diagDb.sdrs_atual ?? 0,
      closers: diagDb.closers_atual ?? 0,
      ticket: diagDb.ticket_medio_atual ?? 0,
      lead2reu: diagDb.taxa_lead_reuniao_atual ?? 0,
      showup: diagDb.taxa_show_atual ?? 0,
      winrate: diagDb.taxa_win_atual ?? 0,
    });
    setMeta({
      metaFat: diagDb.meta_faturamento ?? 0,
      prazo: diagDb.prazo_meses ?? 1,
      manterEstrutura: diagDb.manter_estrutura ?? true,
    });
    setActs(ACTIVITIES.reduce<number[]>((acc, activity, index) => {
      if (diagDb.atividades?.[activity.key]) acc.push(index);
      return acc;
    }, []));
  }, [diagDb]);

  const toggleAct = (i: number) => setActs((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);

  const handleSaveMeta = async () => {
    try {
      const atividades = ACTIVITIES.reduce<Record<string, boolean>>((acc, activity, index) => {
        acc[activity.key] = acts.includes(index);
        return acc;
      }, {});
      const payload: DiagnosticoMaquina = {
        ...(diagDb || DEFAULT_DIAGNOSTICO),
        faturamento_atual: diag.fat,
        meses_travado: diag.meses,
        sdrs_atual: diag.sdrs,
        closers_atual: diag.closers,
        ticket_medio_atual: diag.ticket,
        taxa_lead_reuniao_atual: diag.lead2reu,
        taxa_show_atual: diag.showup,
        taxa_win_atual: diag.winrate,
        meta_faturamento: meta.metaFat,
        prazo_meses: meta.prazo,
        manter_estrutura: meta.manterEstrutura,
        atividades,
      };
      await upsert.mutateAsync({ ...payload, gargalos_auto: detectGargalos(payload) });
      toast.success("Meta salva com sucesso");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Tente novamente.";
      toast.error("Erro ao salvar meta", { description: message });
    }
  };

  const gap = meta.metaFat - diag.fat;
  const cresc = diag.fat > 0 ? Math.round(gap / diag.fat * 100) : 0;
  const crescMes = meta.prazo > 0 ? Math.round(cresc / meta.prazo) : cresc;

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5, display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: C.white, color: C.text, outline: "none" };
  const sectionTitle = (icon: string, txt: string) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, marginTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
      {icon} {txt}
    </div>
  );

  const metricas: Array<[string, DiagKey]> = [
    ["Ticket médio (R$)", "ticket"],
    ["Lead → Reunião (%)", "lead2reu"],
    ["Show-up (%)", "showup"],
    ["Win rate (%)", "winrate"],
  ];

  const checkinFields: Array<[string, CheckinKey]> = [
    ["Leads prospectados (Ligações/Mensagens)", "leads"],
    ["Respostas", "respostas"],
    ["Oportunidades criadas", "oportunidades"],
    ["Reuniões agendadas", "reuAg"],
    ["Reuniões sem comparecimento", "reuNoShow"],
    ["Reuniões realizadas", "reuReal"],
    ["Negociações", "negociacoes"],
    ["Vendas perdidas", "vendasPerdidas"],
    ["Vendas fechadas", "vendas"],
    ["Follow-ups (vendas recuperadas)", "fupRecuperadas"],
    ["Follow-ups (oportunidade)", "fupOportunidade"],
    ["Follow-ups", "followups"],
    ["Ticket médio (R$)", "ticket"],
    ["Faturamento bruto (R$)", "fat"],
  ];

  const summaryCards = [
    { label: "Gap a fechar", value: fmtR(gap), sub: "por mês", color: C.red },
    { label: "Crescimento total", value: cresc + "%", sub: "sobre o atual", color: C.green },
    { label: "Crescimento mensal médio", value: crescMes + "%", sub: "ao mês", color: C.purple },
  ];




  const teamStats: Array<[string, number]> = [["Leads", 100], ["Ligações", 80], ["Reuniões ag.", 4], ["Vendas", 1]];

  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>🏭 Construção da Máquina de Vendas</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 3 }}>
            Diagnóstico → Meta & Prazo → Plano de Ação → Acompanhamento → Performance Hub
          </div>
        </div>
        <span style={{ background: "rgba(255,255,255,.2)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 99 }}>Fase {step} de 5</span>
      </div>

      <div style={{ height: 5, background: "#E9D8FD" }}>
        <div style={{ height: "100%", width: `${step * 20}%`, background: "linear-gradient(90deg,#667EEA,#764BA2)", transition: "width .4s" }} />
      </div>

      <div style={{ display: "flex", borderBottom: `1.5px solid ${C.border}` }}>
        {STEPS.map((s) => (
          <button key={s.id} onClick={() => setStep(s.id)} style={{
            flex: 1, padding: "12px 6px", border: "none", borderBottom: step === s.id ? "3px solid #764BA2" : "3px solid transparent",
            background: step === s.id ? C.purpleBg : "transparent",
            color: step === s.id ? "#764BA2" : s.id < step ? C.green : C.textSub,
            fontWeight: step === s.id ? 700 : 500, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all .15s"
          }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <span>{s.label}</span>
            {s.id < step && <span style={{ fontSize: 10, color: C.green }}>✓ Feito</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px" }}>
        {step === 1 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>📍 Onde a empresa está hoje?</div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>Situação financeira, estrutura comercial e métricas da esteira.</div>

            {sectionTitle("💰", "Financeiro atual")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <div><label style={labelStyle}>Faturamento mensal (R$)</label><input style={inputStyle} value={diag.fat} onChange={(e) => setDiag({ ...diag, fat: +e.target.value })} /></div>
              <div><label style={labelStyle}>Meses nesse faturamento</label><input style={inputStyle} value={diag.meses} onChange={(e) => setDiag({ ...diag, meses: +e.target.value })} /></div>
            </div>

            {sectionTitle("👥", "Estrutura comercial")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <div><label style={labelStyle}>SDRs / Atendentes</label><input style={inputStyle} value={diag.sdrs} onChange={(e) => setDiag({ ...diag, sdrs: +e.target.value })} /></div>
              <div><label style={labelStyle}>Closers / Vendedores</label><input style={inputStyle} value={diag.closers} onChange={(e) => setDiag({ ...diag, closers: +e.target.value })} /></div>
            </div>

            {sectionTitle("📊", "Métricas da esteira")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              {metricas.map(([lbl, key]) => (
                <div key={key}><label style={labelStyle}>{lbl}</label><input style={inputStyle} value={diag[key]} onChange={(e) => setDiag({ ...diag, [key]: +e.target.value })} /></div>
              ))}
            </div>

            {sectionTitle("⚡", "Atividades praticadas")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
              {ACTIVITIES.map((a, i) => (
                <div key={i} onClick={() => toggleAct(i)} style={{
                  padding: "10px 8px", borderRadius: 12, border: `1.5px solid ${acts.includes(i) ? C.green : C.border}`,
                  background: acts.includes(i) ? C.greenBg : C.white, cursor: "pointer", textAlign: "center",
                  fontSize: 12, fontWeight: 600, color: acts.includes(i) ? C.greenDark : C.textSub, transition: "all .15s"
                }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{a.icon}</div>
                  {a.label}
                </div>
              ))}
            </div>

            <div style={{ background: C.amberBg, border: `1.5px solid ${C.amberBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>⚠️ Gargalos identificados automaticamente</div>
              <ul style={{ paddingLeft: 16, color: "#92400E", fontSize: 12 }}>
                <li style={{ marginBottom: 4 }}>No-show acima de 50% — falta de confirmação/lembretes antes da reunião.</li>
                <li>Faturamento travado há mais de 6 meses — sinal forte de teto operacional.</li>
              </ul>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Observações adicionais</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Dificuldades, contexto, mercado..." />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(2)} style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                Próxima fase: Meta & Prazo →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>🎯 Para onde a empresa quer ir?</div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>Defina a meta de faturamento e o prazo para atingir.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Faturamento atual (R$)</label>
                <input style={{ ...inputStyle, opacity: .6 }} value={diag.fat} disabled />
                <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>Vem da Fase 1</div>
              </div>
              <div>
                <label style={labelStyle}>Meta de faturamento (R$)</label>
                <input style={inputStyle} value={meta.metaFat} onChange={(e) => setMeta({ ...meta, metaFat: +e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Em quantos meses?</label>
                <input style={inputStyle} value={meta.prazo} onChange={(e) => setMeta({ ...meta, prazo: +e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {summaryCards.map((c) => (
                <div key={c.label} style={{ background: C.grayBg, borderRadius: 14, padding: "16px 18px", border: `1.5px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.textSub, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{c.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: C.textSub }}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: C.grayBg, border: `1.5px solid ${C.border}`, borderRadius: 12, marginBottom: 14 }}>
              <input type="checkbox" checked={meta.manterEstrutura} onChange={(e) => setMeta({ ...meta, manterEstrutura: e.target.checked })}
                style={{ width: 40, height: 22, accentColor: C.green, cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Manter a mesma estrutura comercial atual?</div>
                <div style={{ fontSize: 12, color: C.textSub }}>
                  {meta.manterEstrutura
                    ? `Operação fica com ${diag.sdrs} SDR(s) e ${diag.closers} Closer(s).`
                    : "Estrutura liberada para edição abaixo — redimensione o time."}
                </div>
              </div>
            </div>

            {!meta.manterEstrutura && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, padding: 14, border: `1.5px dashed ${C.green}`, borderRadius: 12, background: C.greenBg }}>
                <div>
                  <label style={labelStyle}>Novos SDRs / Atendentes</label>
                  <input style={inputStyle} type="number" min={0} value={diag.sdrs} onChange={(e) => setDiag({ ...diag, sdrs: +e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Novos Closers / Vendedores</label>
                  <input style={inputStyle} type="number" min={0} value={diag.closers} onChange={(e) => setDiag({ ...diag, closers: +e.target.value })} />
                </div>
              </div>
            )}

            {/* Detalhamento da meta + evolução */}
            {meta.metaFat > 0 && (
              <div style={{ border: `1.5px solid ${C.greenBorder}`, background: C.greenBg, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.greenDark, marginBottom: 10 }}>📈 Detalhamento da meta e evolução</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
                  {[
                    ["Meta total no prazo", fmtR(meta.metaFat * meta.prazo)],
                    ["Meta mensal", fmtR(meta.metaFat)],
                    ["Meta semanal", fmtR(meta.metaFat / 4.33)],
                    ["Meta diária (22 dias úteis)", fmtR(meta.metaFat / 22)],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ background: C.white, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.greenBorder}` }}>
                      <div style={{ fontSize: 10, color: C.textSub, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>{lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.greenDark, marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Progresso da semana</span>
                  <span style={{ fontWeight: 700, color: C.greenDark }}>{fmtR(progressoSemana)} / {fmtR(meta.metaFat / 4.33)}</span>
                </div>
                <div style={{ background: C.greenBorder, borderRadius: 99, height: 10, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${Math.min(100, (progressoSemana / (meta.metaFat / 4.33 || 1)) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.green}, ${C.greenDark})`, transition: "width .4s" }} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" min={0} value={progressoSemana} onChange={(e) => setProgressoSemana(+e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} placeholder="Faturamento já realizado na semana" />
                  <span style={{ fontSize: 11, color: C.textSub }}>Atualize conforme as vendas forem entrando.</span>
                </div>
              </div>
            )}

            {/* Plano mensal de crescimento — mês a mês até atingir a meta */}
            {meta.metaFat > 0 && meta.prazo > 0 && diag.fat >= 0 && (() => {
              const meses = Math.max(1, Math.min(60, meta.prazo));
              const inicio = diag.fat;
              const fim = meta.metaFat;
              // crescimento linear mês a mês entre faturamento atual e meta
              const linhas = Array.from({ length: meses }, (_, i) => {
                const metaMes = meses === 1 ? fim : Math.round(inicio + ((fim - inicio) * (i + 1)) / meses);
                const realizado = realizadoMes[i] ?? 0;
                const atingPct = metaMes > 0 ? (realizado / metaMes) * 100 : 0;
                const anterior = i === 0 ? inicio : (realizadoMes[i - 1] ?? 0);
                const variacao = anterior > 0 ? ((realizado - anterior) / anterior) * 100 : (realizado > 0 ? 100 : 0);
                let status: { txt: string; bg: string; cor: string };
                if (realizado === 0) status = { txt: "—", bg: C.grayBg, cor: C.textSub };
                else if (variacao > 5) status = { txt: "📈 Escalando", bg: C.greenBg, cor: C.greenDark };
                else if (variacao < -5) status = { txt: "📉 Caindo", bg: C.redBg, cor: C.red };
                else status = { txt: "➖ Estagnado", bg: C.amberBg, cor: "#92400E" };
                return { i, metaMes, realizado, atingPct, variacao, status };
              });
              const totalEsperado = linhas.reduce((s, l) => s + l.metaMes, 0);
              const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
              return (
                <div style={{ border: `1.5px solid ${C.purple}`, background: C.purpleBg, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.purple }}>📅 Plano mensal de crescimento</div>
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
                        Meta destrinchada mês a mês. Preencha o realizado para ver se está escalando ou estagnado.
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textSub, textAlign: "right" }}>
                      Acumulado esperado: <b style={{ color: C.purple }}>{fmtR(totalEsperado)}</b><br/>
                      Acumulado realizado: <b style={{ color: C.greenDark }}>{fmtR(totalRealizado)}</b>
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.white }}>
                    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 130px", padding: "8px 12px", background: C.grayBg, fontSize: 10, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: ".4px", gap: 8 }}>
                      <span>Mês</span><span>Meta esperada</span><span>Realizado</span><span>Atingimento</span><span>Variação</span><span>Status</span>
                    </div>
                    {linhas.map((l) => (
                      <div key={l.i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 130px", padding: "8px 12px", borderTop: `1px solid ${C.border}`, gap: 8, alignItems: "center", fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: C.purple }}>M{l.i + 1}</span>
                        <span style={{ fontWeight: 600, color: C.text }}>{fmtR(l.metaMes)}</span>
                        <input
                          type="number"
                          min={0}
                          value={l.realizado}
                          onChange={(e) => setRealizadoMes({ ...realizadoMes, [l.i]: +e.target.value })}
                          style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", background: C.white, outline: "none" }}
                          placeholder="0"
                        />
                        <div>
                          <div style={{ fontSize: 11, color: l.atingPct >= 100 ? C.greenDark : l.atingPct >= 70 ? "#92400E" : C.red, fontWeight: 700 }}>{Math.round(l.atingPct)}%</div>
                          <div style={{ background: C.border, borderRadius: 99, height: 4, marginTop: 2 }}>
                            <div style={{ width: `${Math.min(100, l.atingPct)}%`, height: "100%", background: l.atingPct >= 100 ? C.green : l.atingPct >= 70 ? C.amber : C.red, borderRadius: 99 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: l.variacao > 0 ? C.greenDark : l.variacao < 0 ? C.red : C.textSub }}>
                          {l.realizado === 0 ? "—" : `${l.variacao > 0 ? "+" : ""}${Math.round(l.variacao)}%`}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: l.status.cor, background: l.status.bg, padding: "3px 8px", borderRadius: 99, textAlign: "center" }}>
                          {l.status.txt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <button onClick={() => setStep(1)} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: C.textSub, fontFamily: "inherit" }}>← Voltar</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleSaveMeta} disabled={upsert.isPending} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 800, fontSize: 14, cursor: upsert.isPending ? "not-allowed" : "pointer", opacity: upsert.isPending ? .7 : 1, fontFamily: "inherit" }}>
                  {upsert.isPending ? "Salvando..." : "💾 Salvar meta"}
                </button>
                <button onClick={async () => { await handleSaveMeta(); setStep(3); }} disabled={upsert.isPending} style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: upsert.isPending ? "not-allowed" : "pointer", opacity: upsert.isPending ? .7 : 1, fontFamily: "inherit" }}>Salvar e ir para Plano de Ação →</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>🚀 Como vamos chegar lá?</div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>Motor de receita e ações concretas para dimensionar o time.</div>

            <div style={{ background: C.blueBg, border: `1.5px solid #BFDBFE`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF", marginBottom: 8 }}>💡 Recomendações com base no diagnóstico</div>
              <ul style={{ paddingLeft: 16, color: "#1E40AF", fontSize: 12 }}>
                <li style={{ marginBottom: 4 }}>Crescimento de {cresc}% é muito agressivo — considere expandir o time comercial.</li>
                <li style={{ marginBottom: 4 }}>Contratar +1 Closer para absorver as reuniões geradas.</li>
                <li>Prazo curto + meta agressiva: reforce inbound pago para acelerar.</li>
              </ul>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Modelo de negócio</label>
                <select style={inputStyle} value={plano.modelo} onChange={(e) => setPlano({ ...plano, modelo: e.target.value })}>
                  {["B2B Consultivo (SDR + Closer)", "B2C Direto", "SaaS Self-serve"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Meta de receita mensal (R$)</label>
                <input style={inputStyle} type="number" value={meta.metaFat} onChange={(e) => setMeta({ ...meta, metaFat: +e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>SDRs no time</label>
                <input style={inputStyle} type="number" min={0} value={diag.sdrs} onChange={(e) => setDiag({ ...diag, sdrs: +e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Closers / Vendedores</label>
                <input style={inputStyle} type="number" min={0} value={diag.closers} onChange={(e) => setDiag({ ...diag, closers: +e.target.value })} />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📦 Portfólio de Ofertas</span>
              {offers.length > 0 && (
                <span style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>
                  Receita potencial: <b style={{ color: C.greenDark }}>{fmtR(offers.reduce((s, o) => s + o.ticket * o.qtd, 0))}</b>
                </span>
              )}
            </div>

            {offers.length > 0 && (
              <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 40px", gap: 8, padding: "10px 14px", background: C.grayBg, fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: ".4px" }}>
                  <span>Oferta</span><span>Ticket</span><span>Qtd/mês</span><span>Receita</span><span></span>
                </div>
                {offers.map((o, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 40px", gap: 8, padding: "10px 14px", borderTop: `1px solid ${C.border}`, fontSize: 13, alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{o.nome}</span>
                    <span>{fmtR(o.ticket)}</span>
                    <span>{o.qtd}</span>
                    <span style={{ fontWeight: 700, color: C.greenDark }}>{fmtR(o.ticket * o.qtd)}</span>
                    <button onClick={() => setOffers(offers.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {newOffer ? (
              <div style={{ border: `2px solid ${C.green}`, borderRadius: 14, padding: 14, marginBottom: 20, background: C.greenBg }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.greenDark, marginBottom: 10 }}>Nova oferta</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><label style={labelStyle}>Nome</label><input style={inputStyle} value={newOffer.nome} onChange={(e) => setNewOffer({ ...newOffer, nome: e.target.value })} placeholder="Ex: Consultoria mensal" /></div>
                  <div><label style={labelStyle}>Ticket (R$)</label><input style={inputStyle} type="number" min={0} value={newOffer.ticket} onChange={(e) => setNewOffer({ ...newOffer, ticket: +e.target.value })} /></div>
                  <div><label style={labelStyle}>Qtd/mês</label><input style={inputStyle} type="number" min={0} value={newOffer.qtd} onChange={(e) => setNewOffer({ ...newOffer, qtd: +e.target.value })} /></div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setNewOffer(null)} style={{ background: C.white, color: C.textSub, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "7px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  <button
                    onClick={() => {
                      if (!newOffer.nome.trim()) { toast.error("Informe o nome da oferta"); return; }
                      setOffers([...offers, newOffer]);
                      setNewOffer(null);
                    }}
                    style={{ background: C.green, color: "#fff", border: "none", borderRadius: 10, padding: "7px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                  >Salvar oferta</button>
                </div>
              </div>
            ) : (
              <div style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: offers.length > 0 ? "16px 20px" : "28px 20px", textAlign: "center", color: C.textSub, fontSize: 13, marginBottom: 20 }}>
                {offers.length === 0 && (<><div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>Nenhuma oferta cadastrada.<div style={{ height: 10 }} /></>)}
                <button onClick={() => setNewOffer({ nome: "", ticket: 0, qtd: 0 })} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Adicionar Oferta</button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(2)} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: C.textSub, fontFamily: "inherit" }}>← Voltar</button>
              <button onClick={() => setStep(4)} style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Próxima fase: Acompanhamento →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>📋 Check-in de hoje <span style={{ fontSize: 13, fontWeight: 400, color: C.textSub }}>30/05/2026</span></div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>Registre suas atividades do dia. Leva 30 segundos.</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["SDR", "Closer", "Híbrido"].map((r) => (
                <button key={r} style={{ padding: "7px 18px", borderRadius: 99, border: `1.5px solid ${r === "Closer" ? C.green : C.border}`, background: r === "Closer" ? C.green : C.white, color: r === "Closer" ? "#fff" : C.textSub, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
              {checkinFields.map(([lbl, key]) => (
                <div key={key} style={{ background: C.grayBg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: C.textSub, marginBottom: 6, fontWeight: 600 }}>{lbl}</div>
                  <input type="number" value={checkin[key]} min={0}
                    onChange={(e) => setCheckin({ ...checkin, [key]: +e.target.value })}
                    style={{ width: "100%", border: "none", background: "transparent", fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "inherit", outline: "none" }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Script usado</label>
              <input style={inputStyle} placeholder="Nome ou versão do script utilizado nas abordagens" value={checkin.script} onChange={(e) => setCheckin({ ...checkin, script: e.target.value })} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Observações do dia</label>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder="Vitórias, perdas, aprendizados, bloqueios..." value={checkin.obs} onChange={(e) => setCheckin({ ...checkin, obs: e.target.value })} />
            </div>

            <button style={{ background: C.green, color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", width: "100%", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 24, fontFamily: "inherit" }}>
              💾 Salvar check-in de hoje
            </button>

            <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.greenDark, marginBottom: 12 }}>🏆 Desempenho do time — semana</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>Faturamento semana <span style={{ float: "right", fontWeight: 700, color: C.greenDark }}>28.9% da meta</span></div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.greenDark, marginBottom: 8 }}>R$ 3.999 <span style={{ fontSize: 14, fontWeight: 400, color: C.textSub }}>/ R$ 13.857</span></div>
              <div style={{ background: C.greenBorder, borderRadius: 99, height: 8, marginBottom: 16 }}>
                <div style={{ width: "29%", height: "100%", background: C.green, borderRadius: 99 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {teamStats.map(([lbl, val]) => (
                  <div key={lbl} style={{ textAlign: "center", background: C.white, borderRadius: 10, padding: "10px 8px" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.greenDark }}>{val}</div>
                    <div style={{ fontSize: 11, color: C.textSub }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setStep(3)} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: C.textSub, fontFamily: "inherit" }}>← Voltar</button>
              <button onClick={() => setStep(5)} style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Próxima fase: Performance Hub →</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>🏆 Performance Hub</div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>Ranking e evolução do time comercial.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div style={{ background: C.amberBg, border: `1.5px solid ${C.amberBorder}`, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>🥇 TOP SDR</div>
                <div style={{ fontSize: 13, color: C.textSub }}>Sem dados de SDR no período.</div>
              </div>
              <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.greenDark, marginBottom: 6 }}>🏆 TOP VENDEDOR (CLOSER)</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Jeohvah Lima</div>
                <div style={{ fontSize: 13, color: C.greenDark, fontWeight: 700 }}>R$ 3.999 · 1 venda</div>
              </div>
            </div>

            <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 70px 80px 80px 100px", padding: "10px 16px", background: C.grayBg, fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: ".4px", gap: 8 }}>
                <span>#</span><span>Vendedor</span><span>Leads</span><span>Reuniões</span><span>Vendas</span><span style={{ textAlign: "right" }}>Faturamento</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 70px 80px 80px 100px", padding: "14px 16px", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>🥇</span>
                <div><div style={{ fontWeight: 700, color: C.text }}>Jeohvah Lima</div><div style={{ fontSize: 11, color: C.textSub }}>Closer</div></div>
                <span>100</span><span>3</span><span>1</span>
                <span style={{ textAlign: "right", color: C.greenDark, fontWeight: 800 }}>R$ 3.999</span>
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "20px", color: C.textSub, fontSize: 13 }}>
              Adicione mais membros para ver o ranking completo.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setStep(4)} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "11px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: C.textSub, fontFamily: "inherit" }}>← Voltar</button>
              <span style={{ fontSize: 13, color: C.greenDark, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>✅ Máquina de Vendas configurada!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── OTE ─────────────────────────── */
function OTE() {
  const [ote, setOte] = useState({ nome: "Plano SDR Padrão", cargo: "SDR", salBase: 1000, oteAnual: 120000, percVar: 30, metaMensal: 300000, percComissao: 0.1, aceleraPct: 100, multiplicador: 1 });
  const [sim, setSim] = useState({ ating: 100, valorVendido: 300000 });

  const comissao = Math.round(sim.valorVendido * ote.percComissao / 100);
  const acel = sim.ating >= 100 ? Math.round(comissao * (ote.multiplicador - 1 + 0.5)) : 0;
  const total = ote.salBase + comissao + acel;

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5, display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: C.white, color: C.text, outline: "none" };

  const stepBadge = (n: number, txt: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 20 }}>
      <span style={{ background: "linear-gradient(135deg,#667EEA,#764BA2)", color: "#fff", width: 26, height: 26, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{n}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{txt}</div>
      </div>
    </div>
  );

  const breakdown: Array<[string, string, string]> = [
    ["Salário base", fmtR(ote.salBase), C.text],
    ["Comissão", fmtR(comissao), C.amber],
    ["Acelerador", fmtR(acel), C.green],
  ];

  return (
    <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 20, overflow: "hidden" }}>
      <div style={{ background: "linear-gradient(135deg,#F59E0B,#EF4444)", padding: "20px 24px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>💰 Plano de Comissionamento (OTE)</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.8)", marginTop: 3 }}>
          Configure remuneração variável, meta e aceleradores — e simule ganhos no mês.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 0 }}>
        <div style={{ padding: 24, borderRight: `1.5px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Nome do plano</label><input style={inputStyle} value={ote.nome} onChange={(e) => setOte({ ...ote, nome: e.target.value })} /></div>
            <div><label style={labelStyle}>Cargo</label>
              <select style={{ ...inputStyle }} value={ote.cargo} onChange={(e) => setOte({ ...ote, cargo: e.target.value })}>
                <option>SDR</option><option>Closer</option><option>Híbrido</option>
              </select>
            </div>
          </div>

          {stepBadge(1, "Remuneração base e OTE")}
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>Salário fixo e ganho total esperado no ano.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Salário base (mês)</label><input style={inputStyle} value={ote.salBase} onChange={(e) => setOte({ ...ote, salBase: +e.target.value })} /></div>
            <div><label style={labelStyle}>OTE anual</label><input style={inputStyle} value={ote.oteAnual} onChange={(e) => setOte({ ...ote, oteAnual: +e.target.value })} /></div>
            <div><label style={labelStyle}>% Variável</label><input style={inputStyle} value={ote.percVar} onChange={(e) => setOte({ ...ote, percVar: +e.target.value })} /></div>
          </div>

          {stepBadge(2, "Meta e comissão")}
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>Quanto vender e quanto ganhar por venda.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Meta mensal (R$)</label><input style={inputStyle} value={ote.metaMensal} onChange={(e) => setOte({ ...ote, metaMensal: +e.target.value })} /></div>
            <div><label style={labelStyle}>% Comissão sobre vendas</label><input style={inputStyle} value={ote.percComissao} onChange={(e) => setOte({ ...ote, percComissao: +e.target.value })} /></div>
          </div>

          {stepBadge(3, "Acelerador (super meta)")}
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>Multiplicador para quem ultrapassa a meta.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div><label style={labelStyle}>Acelera a partir de (%)</label><input style={inputStyle} value={ote.aceleraPct} onChange={(e) => setOte({ ...ote, aceleraPct: +e.target.value })} /></div>
            <div><label style={labelStyle}>Multiplicador</label><input style={inputStyle} value={ote.multiplicador} onChange={(e) => setOte({ ...ote, multiplicador: +e.target.value })} /></div>
          </div>

          <button style={{ background: C.text, color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", width: "100%", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            💾 Salvar plano
          </button>
        </div>

        <div style={{ padding: 24, background: C.grayBg }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>🎮 Simulador</div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>Ajuste para simular ganhos no mês.</div>

          <label style={labelStyle}>Atingimento da meta</label>
          <input type="range" min={0} max={200} step={1} value={sim.ating}
            onChange={(e) => setSim({ ...sim, ating: +e.target.value })}
            style={{ width: "100%", accentColor: C.green, marginBottom: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSub, marginBottom: 12 }}>
            <span>0%</span>
            <span style={{ fontWeight: 800, color: sim.ating >= 100 ? C.green : C.amber }}>{sim.ating}%</span>
            <span>200%</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Valor vendido no mês (R$)</label>
            <input style={inputStyle} value={sim.valorVendido} onChange={(e) => setSim({ ...sim, valorVendido: +e.target.value })} />
          </div>

          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            {breakdown.map(([lbl, val, color]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.textSub }}>{lbl}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
            <div style={{ padding: "16px", background: C.greenBg }}>
              <div style={{ fontSize: 11, color: C.greenDark, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>Ganho total no mês</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.greenDark }}>{fmtR(total)}</div>
              <div style={{ fontSize: 11, color: C.green, marginTop: 3 }}>Base: {fmtR(ote.salBase)} · Variável: {fmtR(comissao + acel)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── PAGE ─────────────────────────── */
export default function MetasVendas() {
  const [tab, setTab] = useState<"maquina" | "ote" | "individual">("maquina");

  const tabs: Array<["maquina" | "ote" | "individual", string, string]> = [
    ["maquina", "🏭", "Máquina"],
    ["ote", "💰", "OTE"],
    ["individual", "👥", "Individuais"],
  ];

  return (
    <div style={{ fontFamily: "'Inter', 'Nunito', system-ui, sans-serif", background: "#F8FAFC", minHeight: "100vh", padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>💲 Metas & Vendas</h1>
          <p style={{ fontSize: 13, color: C.textSub, margin: "4px 0 0" }}>
            Estratégia: meta, ticket, conversão e projeção automática da operação comercial
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            ✨ Estratégia
          </button>
          <button style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>👤</button>
          <button style={{ background: C.red, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🔴</button>
        </div>
      </div>

      <KpiTop />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ background: C.green, color: "#fff", fontSize: 11, padding: "4px 12px", borderRadius: 99, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>⚡ Sales Intelligence</span>
        <span style={{ fontSize: 13, color: C.textSub }}>Camada de inteligência embutida na Prospecção</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 5, width: "fit-content" }}>
        {tabs.map(([key, icon, lbl]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "10px 28px", borderRadius: 10, border: "none",
            background: tab === key ? "linear-gradient(135deg,#667EEA,#764BA2)" : "transparent",
            color: tab === key ? "#fff" : C.textSub,
            fontWeight: tab === key ? 700 : 500, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 7, transition: "all .2s"
          }}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {tab === "maquina" && <Maquina />}
      {tab === "ote" && <OTE />}
      {tab === "individual" && <IndividualGoalsManager />}
    </div>
  );
}
