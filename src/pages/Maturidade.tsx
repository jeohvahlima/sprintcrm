import { useNavigate } from "react-router-dom";
import { useWMIScore, useWMIHistory } from "@/hooks/useWMI";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadarPilares } from "@/components/wmi/RadarPilares";
import { WMIAlertsPanel } from "@/components/wmi/WMIAlertsPanel";
import { SegmentBenchmarkCard } from "@/components/wmi/SegmentBenchmarkCard";
import { GrowSegmentBenchmarkCard } from "@/components/wmi/GrowSegmentBenchmarkCard";
import { PillarEvolutionChart } from "@/components/wmi/PillarEvolutionChart";
import { Diagnostico360 } from "@/components/wmi/Diagnostico360";
import { GrowSalesIntelligence } from "@/components/wmi/GrowSalesIntelligence";
import { CRMMaturityCheck } from "@/components/wmi/CRMMaturityCheck";
import { CommercialHRPanel } from "@/components/wmi/CommercialHRPanel";
import { BusinessPhaseCard } from "@/components/wmi/BusinessPhaseCard";
import { GrowScoreHero } from "@/components/wmi/GrowScoreHero";
import { NorthMetricsPanel } from "@/components/wmi/NorthMetricsPanel";
import { RhythmTemplatesPanel } from "@/components/wmi/RhythmTemplatesPanel";
import { Onboarding7Days } from "@/components/wmi/Onboarding7Days";
import {
  Activity, Trophy, Sparkles, ArrowRight, GraduationCap, AlertTriangle,
  TrendingUp, Target, FileText, BarChart3, Bot, Users, ClipboardCheck, Calculator,
  Database, Heart, Rocket, Compass, Calendar as CalendarIcon, Zap,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";

const CLASS_STYLE: Record<string, { color: string; emoji: string; desc: string }> = {
  "Escalável": { color: "from-amber-500 to-yellow-400", emoji: "🚀", desc: "Operação previsível e escalável. Top 5% do mercado." },
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

export default function Maturidade() {
  const navigate = useNavigate();
  const { data: score, isLoading } = useWMIScore();
  const { data: history } = useWMIHistory();

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
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">GMI · GROW Maturity Index</Badge>
          <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs">GROW OS</Badge>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          Maturidade Comercial
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Diagnóstico estratégico 360° + plano de ação executivo gerado pela IA com base nos 5 pilares do GROW OS.
        </p>
      </div>

      {/* GROW SCORE CONSOLIDADO (selo da metodologia) */}
      <GrowScoreHero />

      {/* SCORE PRINCIPAL + RADAR + GARGALOS */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="overflow-hidden border-2 lg:col-span-2">
          <div className={`h-2 bg-gradient-to-r ${cls.color}`} />
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Seu GMI Score</div>
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

      {/* Alertas Inteligentes */}
      <WMIAlertsPanel />

      {/* TABS UNIFICADAS */}
      <Tabs defaultValue="onboarding" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="onboarding" className="gap-2">
            <Zap className="h-4 w-4" /> Onboarding 7 Dias
          </TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2">
            <Sparkles className="h-4 w-4" /> Diagnóstico 360° + Plano de Ação IA
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-2">
            <Calculator className="h-4 w-4" /> Grow Sales Intelligence
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="gap-2">
            <Calculator className="h-4 w-4" /> Grow Sales Intelligence
          </TabsTrigger>
          <TabsTrigger value="pilares" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Pilares & Evolução
          </TabsTrigger>
          <TabsTrigger value="crm-maturity" className="gap-2">
            <Database className="h-4 w-4" /> Maturidade CRM
          </TabsTrigger>
          <TabsTrigger value="rh" className="gap-2">
            <Heart className="h-4 w-4" /> RH Comercial
          </TabsTrigger>
          <TabsTrigger value="fase" className="gap-2">
            <Rocket className="h-4 w-4" /> Fase do Negócio
          </TabsTrigger>
          <TabsTrigger value="norte" className="gap-2">
            <Compass className="h-4 w-4" /> Métricas Norte
          </TabsTrigger>
          <TabsTrigger value="ritmos" className="gap-2">
            <CalendarIcon className="h-4 w-4" /> Ritmos GROW
          </TabsTrigger>
        </TabsList>

        <TabsContent value="onboarding">
          <Onboarding7Days />
        </TabsContent>

        <TabsContent value="diagnostico">
          <Diagnostico360 />
        </TabsContent>

        <TabsContent value="intelligence">
          <GrowSalesIntelligence />
        </TabsContent>

        <TabsContent value="crm-maturity">
          <CRMMaturityCheck />
        </TabsContent>

        <TabsContent value="rh">
          <CommercialHRPanel />
        </TabsContent>

        <TabsContent value="fase">
          <BusinessPhaseCard />
        </TabsContent>

        <TabsContent value="norte" className="space-y-4">
          <NorthMetricsPanel />
          <GrowSegmentBenchmarkCard />
        </TabsContent>

        <TabsContent value="ritmos">
          <RhythmTemplatesPanel />
        </TabsContent>

        {/* PILARES + EVOLUÇÃO */}
        <TabsContent value="pilares" className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do GMI Score</CardTitle>
              <CardDescription>Histórico de avaliações geradas.</CardDescription>
            </CardHeader>
            <CardContent>
              {!history?.length ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Gere seu primeiro plano para registrar o histórico.
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

          <div className="grid lg:grid-cols-2 gap-4">
            <PillarEvolutionChart />
            <SegmentBenchmarkCard
              currentMetrics={{
                win_rate: (score.pillars.gestao?.metrics as any)?.win_rate,
                cycle_days: (score.pillars.gestao?.metrics as any)?.cycle_days,
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* UPSELL MENTORIA — oculto enquanto o módulo Advisory estiver indisponível para subcontas */}
    </div>
  );
}
