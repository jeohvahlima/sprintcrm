import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  AlertTriangle,
  Users,
  Target,
  Megaphone,
  Brain,
  DollarSign,
  Activity,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Gauge,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useGrowSalesBI, formatBRL, formatPct, BIRange } from "@/hooks/useGrowSalesBI";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["hsl(var(--primary))", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#84cc16"];

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "border-primary/40 bg-primary/5"
      : tone === "warn"
      ? "border-orange-500/40 bg-orange-500/5"
      : tone === "bad"
      ? "border-destructive/40 bg-destructive/5"
      : "";
  return (
    <Card className={toneClass}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function GrowSalesBI() {
  const [range, setRange] = useState<BIRange>("30d");
  const { data, isLoading, refetch, isFetching } = useGrowSalesBI(range);

  const skeleton = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/40 via-primary/20 to-transparent ring-1 ring-primary/20 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)]">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            Revenue Intelligence BI
            <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-0">
              Grow Sales
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Transforme dados comerciais em previsibilidade de crescimento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-background p-1">
            {(["7d", "30d", "90d", "ytd"] as BIRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "ytd" ? "YTD" : r}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="receita" className="gap-2"><DollarSign className="h-4 w-4" /> Receita & Funil</TabsTrigger>
          <TabsTrigger value="perdas" className="gap-2"><AlertTriangle className="h-4 w-4" /> Perdas Ocultas</TabsTrigger>
          <TabsTrigger value="performance" className="gap-2"><Users className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2"><Target className="h-4 w-4" /> Forecast & Metas</TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2"><Megaphone className="h-4 w-4" /> Campanhas / ROI</TabsTrigger>
          <TabsTrigger value="score" className="gap-2"><Trophy className="h-4 w-4" /> Growth Score</TabsTrigger>
          <TabsTrigger value="insights" className="gap-2"><Brain className="h-4 w-4" /> IA Insights</TabsTrigger>
        </TabsList>

        {/* ===== VISÃO GERAL ===== */}
        <TabsContent value="overview" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon={DollarSign} label="Receita" value={formatBRL(data.receita.bruto)} hint={`${data.receita.deals} deals fechados`} tone="good" />
                <KpiCard icon={TrendingUp} label="Ticket Médio" value={formatBRL(data.receita.ticketMedio)} />
                <KpiCard icon={AlertTriangle} label="Perda Estimada" value={formatBRL(data.perdas.total)} hint={`${data.perdas.noShow.qty} no-shows`} tone="bad" />
                <KpiCard icon={Target} label="Pipeline Aberto" value={formatBRL(data.forecast.pipelineAberto)} hint={`Forecast 30d: ${formatBRL(data.forecast.forecast30d)}`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Funil do período</CardTitle>
                    <CardDescription>Gargalo: <strong>{data.funil.gargalo}</strong></CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={[
                        { etapa: "Leads", qty: data.funil.leadsNovos },
                        { etapa: "Agendados", qty: data.funil.agendados },
                        { etapa: "Compareceram", qty: data.funil.compareceram },
                        { etapa: "Fechados", qty: data.funil.fechados },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="etapa" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                      <div><div className="font-bold text-primary">{formatPct(data.funil.convAgenda)}</div><div className="text-muted-foreground">Lead → Agenda</div></div>
                      <div><div className="font-bold text-primary">{formatPct(data.funil.convCompareceu)}</div><div className="text-muted-foreground">Agenda → Compareceu</div></div>
                      <div><div className="font-bold text-primary">{formatPct(data.funil.convFechamento)}</div><div className="text-muted-foreground">Compareceu → Fechou</div></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Receita por mês</CardTitle>
                    <CardDescription>Tendência dos últimos 6 meses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.receita.porMes}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="mes" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => formatBRL(v)} />
                        <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Top insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.insights.slice(0, 3).map((i, idx) => (
                    <InsightRow key={idx} insight={i} />
                  ))}
                  {data.insights.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem alertas críticos no período. ✅</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== RECEITA & FUNIL ===== */}
        <TabsContent value="receita" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon={DollarSign} label="Receita bruta" value={formatBRL(data.receita.bruto)} tone="good" />
                <KpiCard icon={TrendingUp} label="Ticket médio" value={formatBRL(data.receita.ticketMedio)} />
                <KpiCard icon={Users} label="LTV (proxy)" value={formatBRL(data.receita.ltv)} />
                <KpiCard icon={CheckCircle2} label="Deals fechados" value={String(data.receita.deals)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Receita por canal</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={data.receita.porCanal.slice(0, 6)} dataKey="valor" nameKey="canal" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.canal}>
                          {data.receita.porCanal.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatBRL(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Receita por vendedor</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.receita.porVendedor.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="number" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="user" fontSize={11} width={110} />
                        <Tooltip formatter={(v: any) => formatBRL(v)} />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== PERDAS OCULTAS ===== */}
        <TabsContent value="perdas" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-destructive/40 bg-gradient-to-br from-destructive/10 to-transparent lg:col-span-2">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Você está deixando de faturar</p>
                        <p className="text-4xl font-black text-destructive mt-1">{formatBRL(data.perdas.total)}</p>
                        <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
                      </div>
                      <AlertTriangle className="h-12 w-12 text-destructive/40" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Recuperável em 30 dias</p>
                    <p className="text-3xl font-black text-primary mt-1">{formatBRL(data.recuperavel30d)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Estimativa com retomada de no-show, follow-up e atendimento.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={AlertTriangle} label="No-shows" value={formatBRL(data.perdas.noShow.valor)} hint={`${data.perdas.noShow.qty} compromissos`} tone="bad" />
                <KpiCard icon={AlertTriangle} label="Sem 1ª resposta" value={formatBRL(data.perdas.leadSemResposta.valor)} hint={`${data.perdas.leadSemResposta.qty} leads parados`} tone="bad" />
                <KpiCard icon={AlertTriangle} label="Sem follow-up" value={formatBRL(data.perdas.semFollowUp.valor)} hint={`${data.perdas.semFollowUp.qty} leads esfriando`} tone="warn" />
                <KpiCard icon={AlertTriangle} label="Perdidos" value={formatBRL(data.perdas.perdidos.valor)} hint={`${data.perdas.perdidos.qty} oportunidades`} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Composição da perda</CardTitle>
                  <CardDescription>Onde a receita está vazando</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={[
                      { tipo: "No-show", valor: data.perdas.noShow.valor },
                      { tipo: "Sem resposta", valor: data.perdas.leadSemResposta.valor },
                      { tipo: "Sem follow-up", valor: data.perdas.semFollowUp.valor },
                      { tipo: "Perdidos", valor: data.perdas.perdidos.valor },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="tipo" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => formatBRL(v)} />
                      <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== PERFORMANCE ===== */}
        <TabsContent value="performance" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Performance SDR</CardTitle><CardDescription>Top geradores de oportunidade</CardDescription></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-2">SDR</th><th className="text-right">Leads</th><th className="text-right">Agendou</th><th className="text-right">Conv</th></tr></thead>
                    <tbody>
                      {data.performance.sdrs.map((s, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{s.user}</td>
                          <td className="text-right">{s.leads}</td>
                          <td className="text-right">{s.agendados}</td>
                          <td className="text-right"><Badge variant={s.conv > 30 ? "default" : "secondary"}>{formatPct(s.conv)}</Badge></td>
                        </tr>
                      ))}
                      {data.performance.sdrs.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados no período</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Performance Closer</CardTitle><CardDescription>Top fechadores de receita</CardDescription></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-2">Closer</th><th className="text-right">Oport.</th><th className="text-right">Ganhos</th><th className="text-right">Receita</th></tr></thead>
                    <tbody>
                      {data.performance.closers.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.user}</td>
                          <td className="text-right">{c.oportunidades}</td>
                          <td className="text-right">{c.ganhos}</td>
                          <td className="text-right font-semibold text-primary">{formatBRL(c.receita)}</td>
                        </tr>
                      ))}
                      {data.performance.closers.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados no período</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ===== FORECAST ===== */}
        <TabsContent value="forecast" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon={Target} label="Pipeline aberto" value={formatBRL(data.forecast.pipelineAberto)} tone="good" />
                <KpiCard icon={TrendingUp} label="Forecast 30d" value={formatBRL(data.forecast.forecast30d)} hint="Ponderado por probabilidade" />
                <KpiCard icon={TrendingUp} label="Forecast 60d" value={formatBRL(data.forecast.forecast60d)} />
                <KpiCard icon={TrendingUp} label="Forecast 90d" value={formatBRL(data.forecast.forecast90d)} />
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Meta vs Realizado</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {data.forecast.metaAtual > 0 ? (
                    <>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-3xl font-bold text-primary">{formatBRL(data.forecast.realizadoAtual)}</div>
                          <div className="text-xs text-muted-foreground">Realizado</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold">{formatBRL(data.forecast.metaAtual)}</div>
                          <div className="text-xs text-muted-foreground">Meta</div>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                          style={{ width: `${Math.min(data.forecast.pctMeta, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{formatPct(data.forecast.pctMeta)} da meta</span>
                        <span className="font-medium">
                          Faltam {formatBRL(Math.max(data.forecast.metaAtual - data.forecast.realizadoAtual, 0))}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma meta de receita ativa. Configure em <strong>Configurações &rarr; Comercial</strong>.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== CAMPANHAS ===== */}
        <TabsContent value="campanhas" className="space-y-4">
          {isLoading || !data ? skeleton : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">ROI por campanha</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-2">Campanha</th><th className="text-right">Leads</th><th className="text-right">Ganhos</th><th className="text-right">Conv</th><th className="text-right">Receita</th></tr></thead>
                    <tbody>
                      {data.campanhas.porCampanha.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium truncate max-w-xs">{c.campanha}</td>
                          <td className="text-right">{c.leads}</td>
                          <td className="text-right">{c.ganhos}</td>
                          <td className="text-right">{formatPct(c.conv)}</td>
                          <td className="text-right font-semibold text-primary">{formatBRL(c.receita)}</td>
                        </tr>
                      ))}
                      {data.campanhas.porCampanha.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem campanhas com UTM no período</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Receita por fonte</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.campanhas.porFonte.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="fonte" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => formatBRL(v)} />
                      <Legend />
                      <Bar dataKey="receita" fill="hsl(var(--primary))" name="Receita" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== IA INSIGHTS ===== */}
        <TabsContent value="insights" className="space-y-3">
          {isLoading || !data ? skeleton : (
            data.insights.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-2" />
                Tudo sob controle no período selecionado.
              </CardContent></Card>
            ) : (
              data.insights.map((i, idx) => <InsightRow key={idx} insight={i} large />)
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InsightRow({ insight, large }: { insight: { tipo: "alerta" | "oportunidade" | "ok"; titulo: string; descricao: string }; large?: boolean }) {
  const styles = {
    alerta: { border: "border-destructive/40", bg: "bg-destructive/5", icon: AlertTriangle, color: "text-destructive" },
    oportunidade: { border: "border-orange-500/40", bg: "bg-orange-500/5", icon: TrendingUp, color: "text-orange-500" },
    ok: { border: "border-primary/40", bg: "bg-primary/5", icon: CheckCircle2, color: "text-primary" },
  }[insight.tipo];
  const Icon = styles.icon;
  return (
    <Card className={`${styles.border} ${styles.bg}`}>
      <CardContent className={large ? "p-5" : "p-4"}>
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${styles.color}`} />
          <div className="flex-1">
            <div className={`font-semibold ${large ? "text-base" : "text-sm"}`}>{insight.titulo}</div>
            <div className="text-sm text-muted-foreground mt-1">{insight.descricao}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}
