import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Medal, Award, Crown, Flame, TrendingUp, Users, Phone, MessageSquare, Sparkles } from "lucide-react";
import { useTeamLogs } from "@/hooks/useSalesMachineWizard";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { useActiveQuests } from "@/hooks/useActiveQuests";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PerformanceRankBoard, type RankPlayer } from "./PerformanceRankBoard";

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  meta: number;
}

// Reconhecimentos por marcos de faturamento mensal individual
const TIERS = [
  { key: "diamante", label: "Diamante", min: 100000, color: "from-cyan-400 to-blue-600", icon: Crown },
  { key: "ouro", label: "Ouro", min: 50000, color: "from-amber-400 to-yellow-600", icon: Trophy },
  { key: "prata", label: "Prata", min: 20000, color: "from-slate-300 to-slate-500", icon: Medal },
  { key: "bronze", label: "Bronze", min: 5000, color: "from-orange-400 to-orange-700", icon: Award },
];

function tierFor(faturamento: number) {
  return TIERS.find((t) => faturamento >= t.min) || null;
}

// Missões por segmento — adaptam a linguagem ao ICP
function missionsForSegmento(seg: string | null): { title: string; metric: string; target: number; reward: string }[] {
  const s = (seg || "").toLowerCase();
  if (s.includes("clinica") || s.includes("medic") || s.includes("saude") || s.includes("odonto")) {
    return [
      { title: "Agendar 30 consultas no mês", metric: "consultas", target: 30, reward: "🏆 Ouro" },
      { title: "Confirmar 90% das consultas", metric: "show rate", target: 90, reward: "💎 Bônus" },
      { title: "Fechar 10 tratamentos", metric: "tratamentos", target: 10, reward: "👑 Diamante" },
    ];
  }
  if (s.includes("juri") || s.includes("advoc") || s.includes("legal")) {
    return [
      { title: "Captar 20 casos no mês", metric: "casos", target: 20, reward: "🏆 Ouro" },
      { title: "8 contratos assinados", metric: "contratos", target: 8, reward: "💎 Bônus" },
      { title: "Receita de R$ 80k", metric: "faturamento", target: 80000, reward: "👑 Diamante" },
    ];
  }
  if (s.includes("imov") || s.includes("imob")) {
    return [
      { title: "20 visitas agendadas", metric: "visitas", target: 20, reward: "🏆 Ouro" },
      { title: "5 propostas enviadas", metric: "propostas", target: 5, reward: "💎 Bônus" },
      { title: "2 vendas fechadas", metric: "vendas", target: 2, reward: "👑 Diamante" },
    ];
  }
  if (s.includes("financ") || s.includes("banc") || s.includes("credit")) {
    return [
      { title: "30 simulações enviadas", metric: "simulações", target: 30, reward: "🏆 Ouro" },
      { title: "10 propostas aprovadas", metric: "aprovadas", target: 10, reward: "💎 Bônus" },
      { title: "Volume R$ 500k captado", metric: "volume", target: 500000, reward: "👑 Diamante" },
    ];
  }
  return [
    { title: "Prospectar 100 leads", metric: "leads", target: 100, reward: "🏆 Ouro" },
    { title: "Agendar 20 reuniões", metric: "reuniões", target: 20, reward: "💎 Bônus" },
    { title: "Fechar 5 vendas", metric: "vendas", target: 5, reward: "👑 Diamante" },
  ];
}

export function PerformanceHubPanel({ meta }: Props) {
  const { data: teamLogs } = useTeamLogs(30);
  const { members } = useTeamMembers();
  const { companyId, userId } = usePlayerProfile();
  const { segmento } = useCompanySegmento();
  const { data: quests = [] } = useActiveQuests(userId, companyId);
  const { data: leaderboard = [] } = useLeaderboard(companyId, 5);

  // Top leads (por valor + última atividade)
  const { data: topLeads = [] } = useQuery({
    queryKey: ["perfhub-top-leads", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, value, source, status, stage, updated_at")
        .eq("company_id", companyId!)
        .order("value", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  // Agregação por usuário do time (últimos 30 dias)
  const ranking = useMemo(() => {
    const map = new Map<string, any>();
    (teamLogs || []).forEach((l: any) => {
      const uid = l.user_id || "—";
      const cur = map.get(uid) || {
        user_id: uid, role: l.role_type,
        leads: 0, ligacoes: 0, reunioes: 0, vendas: 0, faturamento: 0,
      };
      cur.leads += l.leads_prospectados || 0;
      cur.ligacoes += l.ligacoes_feitas || 0;
      cur.reunioes += l.reunioes_realizadas || 0;
      cur.vendas += l.vendas_fechadas || 0;
      cur.faturamento += Number(l.faturamento_gerado || 0);
      cur.role = l.role_type;
      map.set(uid, cur);
    });
    return Array.from(map.values());
  }, [teamLogs]);

  const sdrs = ranking.filter((r) => r.role === "sdr" || r.role === "hibrido")
    .sort((a, b) => (b.reunioes - a.reunioes) || (b.leads - a.leads));
  const closers = ranking.filter((r) => r.role === "closer" || r.role === "hibrido")
    .sort((a, b) => b.faturamento - a.faturamento);

  const totalFaturamento = ranking.reduce((s, r) => s + r.faturamento, 0);
  const progressoMeta = meta > 0 ? (totalFaturamento / meta) * 100 : 0;

  const memberName = (uid?: string) => {
    if (!uid) return "—";
    const m = members.find((x) => x.id === uid);
    return m?.full_name || m?.email || `Usuário ${uid.slice(0, 6)}`;
  };

  // Origem dos leads que mais performam
  const sourcePerf = useMemo(() => {
    const map = new Map<string, { source: string; count: number; totalValue: number }>();
    topLeads.forEach((l: any) => {
      const src = l.source || "Direto";
      const cur = map.get(src) || { source: src, count: 0, totalValue: 0 };
      cur.count++;
      cur.totalValue += Number(l.value || 0);
      map.set(src, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [topLeads]);

  const segMissions = missionsForSegmento(segmento);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/20 p-2.5">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Performance Hub</CardTitle>
                <CardDescription className="text-xs">
                  Centro de alta performance comercial — meta, ranking, missões e reconhecimentos do time.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px]">
              Segmento: <span className="ml-1 capitalize">{segmento || "geral"}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> Meta da empresa (mensal)
              </span>
              <span className="text-xs font-semibold">
                {money(totalFaturamento)} / {money(meta || 0)}
              </span>
            </div>
            <Progress value={Math.min(100, progressoMeta)} className="h-2.5" />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{progressoMeta.toFixed(1)}% atingido</span>
              <span>{ranking.length} pessoas ativas no período</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plano de Carreira — Funil de avanço SDR/Closer (drag-and-drop) */}
      <PerformanceRankBoard
        players={ranking.map<RankPlayer>((r) => ({
          user_id: r.user_id,
          name: memberName(r.user_id),
          role: r.role || "vendedor",
          faturamento: r.faturamento,
          vendas: r.vendas,
          reunioes: r.reunioes,
          leads: r.leads,
          meta: ranking.length > 0 ? Math.round((meta || 0) / ranking.length) : 0,
        }))}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Ranking SDR */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-blue-500" /> Ranking SDR (prospecção)
            </CardTitle>
            <CardDescription className="text-xs">Por reuniões realizadas e leads gerados (30 dias).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sdrs.length === 0 && <p className="text-xs text-muted-foreground">Sem dados de SDR no período.</p>}
            {sdrs.slice(0, 5).map((r, i) => {
              const tier = tierFor(r.faturamento);
              const Icon = tier?.icon || Users;
              return (
                <div key={r.user_id} className="flex items-center gap-3 p-2.5 rounded border bg-card">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-xs ${i === 0 ? "bg-amber-500/20 text-amber-600" : "bg-muted"}`}>
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{memberName(r.user_id)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.reunioes} reuniões · {r.leads} leads · {r.ligacoes} ligações
                    </div>
                  </div>
                  {tier && (
                    <Badge variant="outline" className={`bg-gradient-to-r ${tier.color} text-white border-0 text-[10px]`}>
                      <Icon className="h-3 w-3 mr-1" /> {tier.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Ranking Closer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-emerald-500" /> Ranking Closer (fechamento)
            </CardTitle>
            <CardDescription className="text-xs">Por faturamento gerado (30 dias).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {closers.length === 0 && <p className="text-xs text-muted-foreground">Sem dados de Closer no período.</p>}
            {closers.slice(0, 5).map((r, i) => {
              const tier = tierFor(r.faturamento);
              const Icon = tier?.icon || Users;
              return (
                <div key={r.user_id} className="flex items-center gap-3 p-2.5 rounded border bg-card">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-xs ${i === 0 ? "bg-emerald-500/20 text-emerald-600" : "bg-muted"}`}>
                    {i + 1}º
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{memberName(r.user_id)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {money(r.faturamento)} · {r.vendas} vendas
                    </div>
                  </div>
                  {tier && (
                    <Badge variant="outline" className={`bg-gradient-to-r ${tier.color} text-white border-0 text-[10px]`}>
                      <Icon className="h-3 w-3 mr-1" /> {tier.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Missões dinâmicas por segmento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" /> Missões para o seu segmento
            </CardTitle>
            <CardDescription className="text-xs">
              Desafios sugeridos com base no ICP do segmento de <strong className="capitalize">{segmento || "geral"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {segMissions.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded border bg-card">
                <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Meta: {m.target.toLocaleString("pt-BR")} {m.metric}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{m.reward}</Badge>
              </div>
            ))}
            {quests.length > 0 && (
              <>
                <div className="text-[11px] uppercase text-muted-foreground pt-2 mt-2 border-t">Suas missões ativas</div>
                {quests.slice(0, 3).map((q) => {
                  const pct = q.goal_value > 0 ? (q.current_value / q.goal_value) * 100 : 0;
                  return (
                    <div key={q.quest_id} className="p-2.5 rounded border bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{q.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {q.current_value}/{q.goal_value}
                        </span>
                      </div>
                      <Progress value={Math.min(100, pct)} className="h-1.5" />
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>

        {/* Reconhecimentos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-amber-500" /> Reconhecimentos
            </CardTitle>
            <CardDescription className="text-xs">Conquiste tiers de acordo com o faturamento gerado no mês.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {TIERS.slice().reverse().map((t) => {
              const Icon = t.icon;
              const myFat = ranking.find((r) => r.user_id === userId)?.faturamento || 0;
              const reached = myFat >= t.min;
              return (
                <div key={t.key} className={`p-3 rounded-lg border ${reached ? "bg-gradient-to-br " + t.color + " text-white border-0" : "bg-muted/30 opacity-60"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase">{t.label}</span>
                  </div>
                  <div className="text-[11px]">A partir de {money(t.min)}</div>
                  {reached && <div className="text-[10px] mt-1 font-semibold">✓ Conquistado</div>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Leads que mais performam */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Leads que mais performam
          </CardTitle>
          <CardDescription className="text-xs">Top oportunidades por valor e canais com maior retorno.</CardDescription>
        </CardHeader>
        <CardContent className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase text-muted-foreground">Top oportunidades</div>
            {topLeads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead com valor cadastrado.</p>}
            {topLeads.slice(0, 5).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-2 rounded border bg-card">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{l.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {l.source || "direto"} · {l.stage || l.status}
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">{money(Number(l.value || 0))}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[11px] uppercase text-muted-foreground">Canais que mais geram valor</div>
            {sourcePerf.length === 0 && <p className="text-xs text-muted-foreground">Sem dados de origem.</p>}
            {sourcePerf.map((s) => (
              <div key={s.source} className="flex items-center justify-between p-2 rounded border bg-card">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium capitalize">{s.source}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{money(s.totalValue)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.count} leads</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard XP/gamificação (se ativo) */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-amber-500" /> Top performers da semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {leaderboard.slice(0, 5).map((p: any, i: number) => (
              <div key={p.user_id} className="flex items-center gap-3 p-2 rounded border bg-card">
                <span className="text-xs font-bold w-6">{i + 1}º</span>
                <span className="flex-1 text-sm truncate">{memberName(p.user_id)}</span>
                <Badge variant="outline" className="text-[10px]">Nv {p.level || 1}</Badge>
                <span className="text-xs font-semibold text-amber-600">{p.xp || 0} pts</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
