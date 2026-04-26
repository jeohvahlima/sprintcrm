import { useNavigate } from "react-router-dom";
import { useWMIScore, useWMIBenchmarks, useWMIRoadmap, useGenerateRoadmap, useUpdateRoadmapItem, useWMIHistory } from "@/hooks/useWMI";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadarPilares } from "@/components/wmi/RadarPilares";
import { AdvisorChat } from "@/components/wmi/AdvisorChat";
import { Diagnostico360 } from "@/components/wmi/Diagnostico360";
import { Activity, Trophy, Sparkles, ArrowRight, GraduationCap, Loader2, CheckCircle2, Circle, AlertTriangle, TrendingUp, TrendingDown, Minus, Target, FileText, BarChart3, Bot, Users, Zap, ClipboardCheck } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CLASS_STYLE: Record<string, { color: string; emoji: string; desc: string }> = {
  "Escalável": { color: "from-amber-500 to-yellow-400", emoji: "🚀", desc: "Operação previsível e escalável. Top 5% do mercado. Foco em otimização e expansão." },
  "Previsível": { color: "from-emerald-500 to-green-400", emoji: "📈", desc: "Você já tem previsibilidade. Refine processos para escalar." },
  "Estruturando": { color: "from-blue-500 to-cyan-400", emoji: "🏗️", desc: "Fundação em construção. Continue investindo nos pilares fracos." },
  "Inicial": { color: "from-rose-500 to-orange-400", emoji: "🌱", desc: "Maior oportunidade de crescimento. Comece pelos processos básicos." },
};

const PILLAR_META: Record<string, { label: string; icon: any; color: string; route: string }> = {
  processos: { label: "Processos Comerciais", icon: FileText, color: "from-purple-500 to-fuchsia-400", route: "/processos" },
  prospeccao: { label: "Prospecção", icon: Target, color: "from-blue-500 to-cyan-400", route: "/prospeccao" },
  gestao: { label: "Gestão Comercial", icon: BarChart3, color: "from-emerald-500 to-green-400", route: "/analytics" },
  automacao: { label: "Automação & IA", icon: Bot, color: "from-amber-500 to-orange-400", route: "/ia" },
  pessoas: { label: "Pessoas & Performance", icon: Users, color: "from-pink-500 to-rose-400", route: "/configuracoes/gamificacao" },
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  medium: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  low: "bg-muted text-muted-foreground",
};

export default function Maturidade() {
  const navigate = useNavigate();
  const { data: score, isLoading } = useWMIScore();
  const { data: benchmarks } = useWMIBenchmarks();
  const { data: roadmap } = useWMIRoadmap();
  const { data: history } = useWMIHistory();
  const genRoadmap = useGenerateRoadmap();
  const updateItem = useUpdateRoadmapItem();

  if (isLoading || !score) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-64" /><Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const cls = CLASS_STYLE[score.classification] || CLASS_STYLE["Inicial"];
  const bottlenecks = Object.entries(score.pillars)
    .map(([k, p]) => ({ key: k, ...p, pct: (p.score / p.max) * 100 }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">WMI · Waze Maturity Index</Badge>
            <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs">Sales OS</Badge>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            Maturidade Comercial
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Diagnóstico estratégico 360° baseado em 5 pilares · gere seu roadmap evolutivo automático com Advisor IA.
          </p>
        </div>
        <Button size="lg" onClick={() => genRoadmap.mutate(undefined, {
          onSuccess: (r) => toast.success(`Roadmap gerado: ${r.items.length} ações`),
          onError: (e: any) => toast.error(e.message),
        })} disabled={genRoadmap.isPending} className="gap-2 shadow-lg">
          {genRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Roadmap IA
        </Button>
      </div>

      {/* SCORE PRINCIPAL + RADAR */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="overflow-hidden border-2 lg:col-span-2">
          <div className={`h-2 bg-gradient-to-r ${cls.color}`} />
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Seu WMI Score</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-7xl font-bold bg-gradient-to-br ${cls.color} bg-clip-text text-transparent`}>
                    {score.total_score}
                  </span>
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <Badge className={`mt-3 bg-gradient-to-r ${cls.color} text-white border-0 text-sm`}>
                  <Trophy className="h-3.5 w-3.5 mr-1" /> {cls.emoji} {score.classification}
                </Badge>
                <p className="text-sm mt-3 text-muted-foreground">{cls.desc}</p>
                <Progress value={score.total_score} className="h-3 mt-4" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Inicial</span><span>Estruturando</span><span>Previsível</span><span>Escalável</span>
                </div>
              </div>
              <div>
                <RadarPilares score={score} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GARGALOS CRÍTICOS */}
        <Card className="border-2 border-rose-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Gargalos Críticos
            </CardTitle>
            <CardDescription>Pilares com menor score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bottlenecks.map((b) => {
              const meta = PILLAR_META[b.key];
              const Icon = meta.icon;
              return (
                <div key={b.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded bg-gradient-to-br ${meta.color} text-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-sm">{meta.label}</span>
                    <Badge variant="secondary" className="ml-auto font-mono text-xs">{b.score}/{b.max}</Badge>
                  </div>
                  <Progress value={b.pct} className="h-1.5" />
                  <Button size="sm" variant="ghost" className="w-full justify-between h-8 text-xs" onClick={() => navigate(meta.route)}>
                    Estruturar agora <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* TABS DETALHE */}
      <Tabs defaultValue="pilares" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pilares" className="gap-2"><Zap className="h-4 w-4" /> Pilares</TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2"><ClipboardCheck className="h-4 w-4" /> Diagnóstico 360</TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-2"><Sparkles className="h-4 w-4" /> Roadmap IA</TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-2"><BarChart3 className="h-4 w-4" /> Benchmark</TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-2"><TrendingUp className="h-4 w-4" /> Evolução</TabsTrigger>
          <TabsTrigger value="advisor" className="gap-2"><Bot className="h-4 w-4" /> Advisor IA</TabsTrigger>
        </TabsList>

        {/* PILARES */}
        <TabsContent value="pilares">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(score.pillars).map(([key, p]) => {
              const meta = PILLAR_META[key];
              const Icon = meta.icon;
              const pct = Math.round((p.score / p.max) * 100);
              return (
                <Card key={key} className="overflow-hidden hover:border-primary/40 transition">
                  <div className={`h-1.5 bg-gradient-to-r ${meta.color}`} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${meta.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base flex-1">{meta.label}</CardTitle>
                      <Badge variant="secondary" className="font-mono">{p.score}/{p.max}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={pct} className="h-2" />
                    <div className="space-y-1.5 pt-1">
                      {Object.entries(p.metrics).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="font-medium">{typeof v === "number" ? v.toLocaleString("pt-BR") : v}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => navigate(meta.route)}>
                      Ir para o módulo <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* DIAGNÓSTICO 360 */}
        <TabsContent value="diagnostico">
          <Diagnostico360 />
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-4">
          {!roadmap?.length ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <Sparkles className="h-12 w-12 mx-auto text-primary/40" />
                <p className="text-muted-foreground">Nenhum roadmap gerado ainda. Clique em "Gerar Roadmap IA" para começar.</p>
                <Button onClick={() => genRoadmap.mutate()} disabled={genRoadmap.isPending} className="gap-2">
                  {genRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            [1, 2, 3].map((week) => {
              const items = roadmap.filter((r) => r.week === week);
              if (!items.length) return null;
              return (
                <Card key={week}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {week}
                      </div>
                      Semana {week}
                      <Badge variant="outline" className="ml-2">{items.length} ações</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="border rounded-lg p-3 hover:bg-muted/30 transition flex gap-3">
                        <button onClick={() => updateItem.mutate({ id: it.id, status: it.status === "done" ? "pending" : "done" })}
                          className="mt-0.5 shrink-0">
                          {it.status === "done"
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <h4 className={`font-medium ${it.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                              {it.title}
                            </h4>
                            <div className="flex gap-1">
                              <Badge variant="outline" className={`text-xs ${PRIORITY_STYLE[it.priority]}`}>
                                {it.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">{it.pillar}</Badge>
                            </div>
                          </div>
                          {it.description && <p className="text-xs text-muted-foreground mt-1">{it.description}</p>}
                          {it.expected_impact && (
                            <p className="text-xs mt-1.5 text-emerald-600 dark:text-emerald-400">
                              💎 {it.expected_impact}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* BENCHMARK */}
        <TabsContent value="benchmark">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Benchmark de mercado
              </CardTitle>
              <CardDescription>Compare suas métricas com a média do segmento.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {(benchmarks || []).map((b: any) => {
                  // Sua métrica vem do score (estimativa simplificada)
                  const own = pickOwnMetric(score, b.metric_key);
                  const diff = own - b.market_average;
                  const positive = diff >= 0;
                  return (
                    <div key={b.id} className="border rounded-lg p-3">
                      <div className="text-sm font-medium">{b.metric_label}</div>
                      <div className="flex items-end justify-between mt-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Sua empresa</div>
                          <div className="text-2xl font-bold">{own.toFixed(0)}<span className="text-sm text-muted-foreground">{b.unit}</span></div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Mercado</div>
                          <div className="text-lg font-medium text-muted-foreground">{b.market_average}{b.unit}</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs mt-2 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {positive ? "+" : ""}{diff.toFixed(1)}{b.unit} vs mercado
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EVOLUÇÃO */}
        <TabsContent value="evolucao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do WMI Score</CardTitle>
              <CardDescription>Histórico de avaliações geradas.</CardDescription>
            </CardHeader>
            <CardContent>
              {!history?.length ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Gere seu primeiro roadmap para registrar o histórico.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={history.map((h: any) => ({
                    date: format(new Date(h.created_at), "dd/MM"),
                    score: h.total_score,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVISOR */}
        <TabsContent value="advisor">
          <AdvisorChat score={score} />
        </TabsContent>
      </Tabs>

      {/* UPSELL MENTORIA */}
      {score.total_score < 70 && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">Acelere para o nível Escalável com Waze Advisory</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mentores sêniores Waze ajudam você a destravar os pilares fracos. Sessões 1:1, trilhas, biblioteca de playbooks e máquina de vendas.
                </p>
              </div>
              <Button onClick={() => navigate("/mentoria")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Conhecer Advisory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function pickOwnMetric(score: any, key: string): number {
  // Heurística simples para benchmark visual
  const p = score.pillars;
  switch (key) {
    case "conversion_rate": {
      const w = p.gestao.metrics.wins_30d || 0;
      const l = p.gestao.metrics.perdidos_30d || 0;
      return w + l > 0 ? Math.round((w * 100) / (w + l)) : 0;
    }
    case "response_rate": return Math.min(40, (p.prospeccao.metrics.interacoes_30d ? 12 + p.prospeccao.score : 0));
    case "meeting_show_rate": return Math.min(95, 50 + p.gestao.score);
    case "sales_cycle_days": return Math.max(7, 60 - p.processos.score * 1.5);
    case "followup_speed_min": return Math.max(2, 30 - p.automacao.score);
    case "crm_adoption": return Math.min(100, p.pessoas.score * 5);
    case "automation_coverage": return Math.min(100, p.automacao.score * 5);
    case "playbook_coverage": return Math.min(100, p.processos.score * 5);
    default: return 0;
  }
}
