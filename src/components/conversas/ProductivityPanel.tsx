import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import "@/styles/productivity-panel.css";

interface ProductivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface LeadActivity {
  leadId: string;
  leadName: string;
  compromissos: number;
  lembretes: number;
  tarefas: number;
  prontuarios: number;
  mensagensAgendadas: number;
}

interface ProductivityData {
  compromissos: number;
  lembretes: number;
  tarefas: number;
  prontuarios: number;
  mensagensAgendadas: number;
}

interface UserProductivity {
  userId: string;
  userName: string;
  email?: string;
  data: ProductivityData;
  leadsWorked: LeadActivity[];
}

type PeriodType = "today" | "week" | "month";
type TabType = "resumo" | "ranking";

const initials = (name: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const computeScore = (d: ProductivityData, oport: number) =>
  oport * 5 + d.compromissos * 3 + d.prontuarios * 2 + d.tarefas * 2 + d.mensagensAgendadas * 1 + d.lembretes * 1;

const scorePillClass = (s: number) => (s >= 70 ? "high" : s >= 40 ? "mid" : "low");

export function ProductivityPanel({ open, onOpenChange, companyId }: ProductivityPanelProps) {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [tab, setTab] = useState<TabType>("resumo");
  const [loading, setLoading] = useState(false);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [totals, setTotals] = useState<ProductivityData>({
    compromissos: 0, lembretes: 0, tarefas: 0, prontuarios: 0, mensagensAgendadas: 0,
  });
  const [userProductivity, setUserProductivity] = useState<UserProductivity[]>([]);

  const { members } = useTeamMembers();

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  const periodLabel = period === "today" ? "Hoje" : period === "week" ? "Esta Semana" : "Este Mês";

  useEffect(() => {
    if (open && companyId) fetchProductivityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId, dateRange, selectedUserId]);

  const fetchProductivityData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();
      const [compromissosRes, lembretesRes, tarefasRes, prontuariosRes, mensagensRes, leadsRes] = await Promise.all([
        supabase.from("compromissos").select("id, owner_id, lead_id").eq("company_id", companyId).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("lembretes").select("id, created_by").eq("company_id", companyId).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("tasks").select("id, owner_id, lead_id").eq("company_id", companyId).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("lead_attachments").select("id, uploaded_by, lead_id").eq("company_id", companyId).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("scheduled_whatsapp_messages").select("id, owner_id").eq("company_id", companyId).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("leads").select("id, name").eq("company_id", companyId),
      ]);

      const compromissos = compromissosRes.data || [];
      const lembretes = lembretesRes.data || [];
      const tarefas = tarefasRes.data || [];
      const prontuarios = prontuariosRes.data || [];
      const mensagens = mensagensRes.data || [];
      const leads = leadsRes.data || [];

      const leadNameMap = new Map<string, string>();
      leads.forEach((l) => leadNameMap.set(l.id, l.name || "Lead sem nome"));

      const filterByUser = (items: any[], userField: string) =>
        selectedUserId === "all" ? items : items.filter((i) => i[userField] === selectedUserId);

      const fComp = filterByUser(compromissos, "owner_id");
      const fLem = filterByUser(lembretes, "created_by");
      const fTar = filterByUser(tarefas, "owner_id");
      const fPro = filterByUser(prontuarios, "uploaded_by");
      const fMsg = filterByUser(mensagens, "owner_id");

      setTotals({
        compromissos: fComp.length,
        lembretes: fLem.length,
        tarefas: fTar.length,
        prontuarios: fPro.length,
        mensagensAgendadas: fMsg.length,
      });

      const userMap = new Map<string, { data: ProductivityData; leadActivities: Map<string, LeadActivity> }>();
      members.forEach((m) => {
        userMap.set(m.id, {
          data: { compromissos: 0, lembretes: 0, tarefas: 0, prontuarios: 0, mensagensAgendadas: 0 },
          leadActivities: new Map(),
        });
      });

      const track = (userId: string | null, leadId: string | null, k: keyof ProductivityData) => {
        if (!userId || !userMap.has(userId)) return;
        const u = userMap.get(userId)!;
        u.data[k]++;
        if (leadId) {
          if (!u.leadActivities.has(leadId)) {
            u.leadActivities.set(leadId, {
              leadId, leadName: leadNameMap.get(leadId) || "Lead desconhecido",
              compromissos: 0, lembretes: 0, tarefas: 0, prontuarios: 0, mensagensAgendadas: 0,
            });
          }
          u.leadActivities.get(leadId)![k]++;
        }
      };

      compromissos.forEach((i) => track(i.owner_id, i.lead_id, "compromissos"));
      lembretes.forEach((i) => track(i.created_by, null, "lembretes"));
      tarefas.forEach((i) => track(i.owner_id, i.lead_id, "tarefas"));
      prontuarios.forEach((i) => track(i.uploaded_by, i.lead_id, "prontuarios"));
      mensagens.forEach((i) => track(i.owner_id, null, "mensagensAgendadas"));

      const list: UserProductivity[] = [];
      userMap.forEach((u, userId) => {
        const m = members.find((mm) => mm.id === userId);
        if (!m) return;
        const leadsWorked = Array.from(u.leadActivities.values()).sort((a, b) => {
          const ta = a.compromissos + a.lembretes + a.tarefas + a.prontuarios + a.mensagensAgendadas;
          const tb = b.compromissos + b.lembretes + b.tarefas + b.prontuarios + b.mensagensAgendadas;
          return tb - ta;
        });
        list.push({
          userId,
          userName: m.full_name || m.email || "Usuário",
          email: m.email,
          data: u.data,
          leadsWorked,
        });
      });

      list.sort((a, b) => {
        const sa = computeScore(a.data, a.leadsWorked.length);
        const sb = computeScore(b.data, b.leadsWorked.length);
        return sb - sa;
      });

      setUserProductivity(selectedUserId !== "all" ? list.filter((u) => u.userId === selectedUserId) : list);
    } catch (e) {
      console.error("Erro ao carregar dados de produtividade:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (id: string) => {
    setOpenCards((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const totalActivities = totals.compromissos + totals.lembretes + totals.tarefas + totals.prontuarios + totals.mensagensAgendadas;
  const totalLeadsWorked = userProductivity.reduce((s, u) => s + u.leadsWorked.length, 0);
  const totalScore = userProductivity.reduce((s, u) => s + computeScore(u.data, u.leadsWorked.length), 0);
  const activeUsers = userProductivity.filter((u) => computeScore(u.data, u.leadsWorked.length) > 0).length;

  const ranked = useMemo(
    () => [...userProductivity].sort((a, b) => computeScore(b.data, b.leadsWorked.length) - computeScore(a.data, a.leadsWorked.length)),
    [userProductivity]
  );
  const maxScore = ranked.length ? Math.max(1, computeScore(ranked[0].data, ranked[0].leadsWorked.length)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gos-productivity-dialog max-w-[1100px] max-h-[92vh] overflow-y-auto p-0 border">
        <div className="gos-productivity">
          {/* HEADER */}
          <div className="header">
            <div className="header-left">
              <div className="logo-icon">📊</div>
              <div className="title-block">
                <h1>Visão Geral — Time Comercial</h1>
                <p>Acompanhe em tempo real o desempenho de cada vendedor</p>
              </div>
              <div className="live-badge"><span className="live-dot"></span>AO VIVO</div>
            </div>
            <div className="header-right">
              <button className="gbtn gbtn-icon" title="Atualizar" onClick={fetchProductivityData}>⟳</button>
            </div>
          </div>

          {/* FILTERS */}
          <div className="filters">
            <span className="filter-label">Período:</span>
            <div className="period-group">
              <button className={`period-btn ${period === "today" ? "active" : ""}`} onClick={() => setPeriod("today")}>Hoje</button>
              <button className={`period-btn ${period === "week" ? "active" : ""}`} onClick={() => setPeriod("week")}>Esta Semana</button>
              <button className={`period-btn ${period === "month" ? "active" : ""}`} onClick={() => setPeriod("month")}>Este Mês</button>
            </div>
            <div className="filter-sep"></div>
            <span className="filter-label">Usuário:</span>
            <select className="user-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="all">Todos os usuários</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#5a7190" }} />
            </div>
          ) : (
            <>
              {/* KPI PRINCIPAL */}
              <div className="kpi-grid">
                <div className="kpi-card green" style={{ animationDelay: ".05s" }}>
                  <div className="kpi-icon">📈</div>
                  <div className="kpi-val">{totalLeadsWorked}</div>
                  <div className="kpi-label">Oportunidades Trabalhadas</div>
                  <div className="kpi-sub">{periodLabel}</div>
                </div>
                <div className="kpi-card blue" style={{ animationDelay: ".1s" }}>
                  <div className="kpi-icon">💬</div>
                  <div className="kpi-val">{totalActivities}</div>
                  <div className="kpi-label">Atividades Totais</div>
                  <div className="kpi-sub">Período atual</div>
                </div>
                <div className="kpi-card amber" style={{ animationDelay: ".15s" }}>
                  <div className="kpi-icon">👥</div>
                  <div className="kpi-val">
                    {activeUsers}<span style={{ fontSize: ".9rem", fontWeight: 400, color: "#5a7190" }}>/{members.length}</span>
                  </div>
                  <div className="kpi-label">Usuários Ativos</div>
                  <div className="kpi-sub">{members.length - activeUsers} sem atividade</div>
                </div>
                <div className="kpi-card purple" style={{ animationDelay: ".2s" }}>
                  <div className="kpi-icon">⚡</div>
                  <div className="kpi-val">{totalScore}</div>
                  <div className="kpi-label">Score Total do Time</div>
                  <div className="kpi-sub">Pontuação acumulada</div>
                </div>
              </div>

              {/* SECONDARY KPI */}
              <div className="sec-grid">
                <div className="sec-card" style={{ animationDelay: ".25s" }}>
                  <span className="sec-icon">📅</span>
                  <div><div className="sec-val">{totals.compromissos}</div><div className="sec-label">Compromissos</div></div>
                </div>
                <div className="sec-card" style={{ animationDelay: ".28s" }}>
                  <span className="sec-icon">🔔</span>
                  <div><div className="sec-val">{totals.lembretes}</div><div className="sec-label">Lembretes</div></div>
                </div>
                <div className="sec-card" style={{ animationDelay: ".31s" }}>
                  <span className="sec-icon">✅</span>
                  <div><div className="sec-val">{totals.tarefas}</div><div className="sec-label">Tarefas</div></div>
                </div>
                <div className="sec-card" style={{ animationDelay: ".34s" }}>
                  <span className="sec-icon">📋</span>
                  <div><div className="sec-val">{totals.prontuarios}</div><div className="sec-label">Prontuários</div></div>
                </div>
                <div className="sec-card" style={{ animationDelay: ".37s" }}>
                  <span className="sec-icon">📤</span>
                  <div><div className="sec-val">{totals.mensagensAgendadas}</div><div className="sec-label">Msgs Agendadas</div></div>
                </div>
              </div>

              {/* TABS */}
              <div className="tabs-nav">
                <button className={`tab-btn ${tab === "resumo" ? "active" : ""}`} onClick={() => setTab("resumo")}>📊 Resumo</button>
                <button className={`tab-btn ${tab === "ranking" ? "active" : ""}`} onClick={() => setTab("ranking")}>🏆 Ranking</button>
              </div>

              {tab === "resumo" && (
                <div className="tab-pane">
                  <div className="sec-hdr">
                    <h2>DETALHAMENTO POR USUÁRIO</h2>
                    <span>{userProductivity.filter((u) => computeScore(u.data, u.leadsWorked.length) > 0).length} ativos</span>
                  </div>
                  {userProductivity.length === 0 || activeUsers === 0 ? (
                    <div className="empty">
                      <div className="ico">📭</div>
                      Nenhuma atividade registrada no período selecionado.
                    </div>
                  ) : (
                    <div className="user-list">
                      {userProductivity.map((u) => {
                        const score = computeScore(u.data, u.leadsWorked.length);
                        if (score === 0) return null;
                        const isOpen = openCards.has(u.userId);
                        return (
                          <div key={u.userId} className={`user-card ${isOpen ? "open" : ""}`}>
                            <div className="user-header" onClick={() => toggleCard(u.userId)}>
                              <div className="avatar">
                                <span>{initials(u.userName)}</span>
                                <span className="online-dot on"></span>
                              </div>
                              <div className="user-info">
                                <div className="user-name">
                                  {u.userName}
                                  {u.leadsWorked.length > 0 && (
                                    <span className="atend-badge">{u.leadsWorked.length} leads</span>
                                  )}
                                </div>
                                <div className="user-metrics">
                                  <span className="metric green">📈 <span className="val">{u.leadsWorked.length}</span> oport.</span>
                                  <span className="metric">📅 <span className="val">{u.data.compromissos}</span> comp.</span>
                                  <span className="metric">✅ <span className="val">{u.data.tarefas}</span> tarefas</span>
                                  <span className="metric">📋 <span className="val">{u.data.prontuarios}</span> pront.</span>
                                  <span className="metric">📤 <span className="val">{u.data.mensagensAgendadas}</span> msgs</span>
                                  <span className="metric">🔔 <span className="val">{u.data.lembretes}</span> lemb.</span>
                                </div>
                              </div>
                              <div className="user-right">
                                <div className={`score-pill ${scorePillClass(score)}`}>⚡ {score} pts</div>
                                <span className="chevron">▾</span>
                              </div>
                            </div>
                            <div className="leads-expand">
                              <div className="leads-title">👥 Leads Trabalhados ({u.leadsWorked.length})</div>
                              {u.leadsWorked.length === 0 ? (
                                <div style={{ fontSize: ".75rem", color: "#5a7190" }}>Nenhum lead vinculado a estas atividades.</div>
                              ) : (
                                <div className="leads-grid">
                                  {u.leadsWorked.map((l) => (
                                    <div key={l.leadId} className="lead-row">
                                      <span className="lead-name">{l.leadName}</span>
                                      <div className="lead-acts">
                                        {l.compromissos > 0 && <span className="act-chip c">📅 {l.compromissos}</span>}
                                        {l.tarefas > 0 && <span className="act-chip t">✅ {l.tarefas}</span>}
                                        {l.prontuarios > 0 && <span className="act-chip p">📋 {l.prontuarios}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "ranking" && (
                <div className="tab-pane">
                  <div className="formula-note">
                    📐 Score = Oportunidades×5 + Compromissos×3 + Prontuários×2 + Tarefas×2 + Msgs×1 + Lembretes×1
                  </div>
                  {ranked.filter((u) => computeScore(u.data, u.leadsWorked.length) > 0).length === 0 ? (
                    <div className="empty">
                      <div className="ico">🏆</div>
                      Sem dados para ranquear neste período.
                    </div>
                  ) : (
                    <div className="rank-list">
                      {ranked.map((u, idx) => {
                        const score = computeScore(u.data, u.leadsWorked.length);
                        if (score === 0) return null;
                        const pct = Math.max(8, Math.round((score / maxScore) * 100));
                        const medalCls = idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "";
                        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                        return (
                          <div key={u.userId} className={`rank-card ${medalCls}`}>
                            <div className="rank-top">
                              {medal ? <span className="medal">{medal}</span> : <span className="rank-pos">{idx + 1}º</span>}
                              <div className="rank-info">
                                <div className="rank-name">{u.userName}</div>
                                <div className="rank-email">{u.email || ""}</div>
                              </div>
                              <div className={`rank-score-big ${medalCls}`}>
                                {score}
                                <div className="pts">pontos</div>
                              </div>
                            </div>
                            <div className="progress-wrap">
                              <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
                            </div>
                            <div className="rank-breakdown">
                              <div className="breakdown-cell"><div className="bc-val g">{u.leadsWorked.length}</div><div className="bc-lbl">Oport.</div></div>
                              <div className="breakdown-cell"><div className="bc-val b">{u.data.compromissos}</div><div className="bc-lbl">Comp.</div></div>
                              <div className="breakdown-cell"><div className="bc-val">{u.data.tarefas}</div><div className="bc-lbl">Tarefas</div></div>
                              <div className="breakdown-cell"><div className="bc-val">{u.data.prontuarios}</div><div className="bc-lbl">Pront.</div></div>
                              <div className="breakdown-cell"><div className="bc-val a">{u.data.mensagensAgendadas}</div><div className="bc-lbl">Msgs</div></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="bottom-bar">
                <p>Atualizado agora · {periodLabel}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
