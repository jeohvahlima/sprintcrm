import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck, ChevronLeft, ChevronRight, Sparkles, Loader2, Trophy,
  AlertTriangle, RotateCcw, Target, TrendingUp, TrendingDown, Heart, Users, BarChart3,
  FileText, Bot, Zap, CheckCircle2, Circle, ArrowRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useAlavancas, usePerguntas, useUltimoDiagnostico, useSalvarDiagnostico, CLASSIFICACOES,
} from "@/hooks/useDiagnostico360";
import { useWMIScore, useWMIBenchmarks, useWMIRoadmap, useGenerateRoadmap, useUpdateRoadmapItem, type WMIScore } from "@/hooks/useWMI";
import { AdvisorChat } from "@/components/wmi/AdvisorChat";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const ICON_MAP: Record<string, any> = { Target, TrendingUp, Heart, Users, BarChart3 };

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  medium: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  low: "bg-muted text-muted-foreground",
};

export function PlanoComercialCompleto({ score }: { score?: WMIScore }) {
  const navigate = useNavigate();
  const { data: alavancas, isLoading: loadAlav } = useAlavancas();
  const { data: perguntas, isLoading: loadPerg } = usePerguntas();
  const { data: ultimo } = useUltimoDiagnostico();
  const { data: benchmarks } = useWMIBenchmarks();
  const { data: roadmap } = useWMIRoadmap();
  const salvar = useSalvarDiagnostico();
  const genRoadmap = useGenerateRoadmap();
  const updateItem = useUpdateRoadmapItem();

  const [step, setStep] = useState<"intro" | "form" | "result">(ultimo ? "result" : "intro");
  const [respostasMap, setRespostasMap] = useState<Record<string, boolean>>({});
  const [currentAlav, setCurrentAlav] = useState(0);

  const pontuacoes: Record<string, number> = {};
  if (alavancas && perguntas) {
    alavancas.forEach((a) => {
      const pAlav = perguntas.filter((p) => p.alavanca_id === a.id);
      const marcadas = pAlav.filter((p) => respostasMap[p.id]).length;
      pontuacoes[a.id] = pAlav.length > 0 ? Math.round((marcadas / pAlav.length) * 10) : 0;
    });
  }

  if (loadAlav || loadPerg) return <Skeleton className="h-96 w-full" />;

  // ============ INTRO ============
  if (step === "intro") {
    return (
      <Card className="border-2">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <ClipboardCheck className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <Badge variant="outline" className="mb-2">Plano Comercial 360 · Metodologia GROW</Badge>
              <h2 className="text-2xl font-bold">Diagnóstico → Plano de Ação Pronto</h2>
              <p className="text-muted-foreground mt-2 max-w-3xl">
                Em ~5 minutos: responda o diagnóstico das 5 alavancas, e a IA entrega um <strong>plano comercial executivo completo</strong> — processos comerciais, atendimento, vendas, playbooks, metas, KPIs, benchmark e roadmap evolutivo de 90 dias.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {alavancas?.map((a) => {
              const Icon = ICON_MAP[a.icon] || Target;
              return (
                <div key={a.id} className="border rounded-lg p-3 hover:border-primary/40 transition">
                  <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${a.cor} text-white mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-semibold">{a.nome}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {perguntas?.filter((p) => p.alavanca_id === a.id).length} perguntas
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-4 gap-2 text-center">
            {(["A", "B", "C", "D"] as const).map((n) => {
              const c = CLASSIFICACOES[n];
              return (
                <div key={n} className={`border rounded-lg p-3 bg-gradient-to-br ${c.cor} bg-opacity-10`}>
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="text-xs font-bold mt-1">Nota {n}</div>
                  <div className="text-[10px] text-muted-foreground">{c.range}</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button size="lg" className="gap-2 flex-1" onClick={() => {
              setRespostasMap({}); setCurrentAlav(0); setStep("form");
            }}>
              <Sparkles className="h-4 w-4" />
              {ultimo ? "Refazer diagnóstico" : "Iniciar diagnóstico"}
            </Button>
            {ultimo && (
              <Button size="lg" variant="outline" onClick={() => setStep("result")}>
                Ver plano atual
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ FORM ============
  if (step === "form" && alavancas && perguntas) {
    const alav = alavancas[currentAlav];
    const pAlav = perguntas.filter((p) => p.alavanca_id === alav.id);
    const Icon = ICON_MAP[alav.icon] || Target;
    const isLast = currentAlav === alavancas.length - 1;

    return (
      <Card className="border-2">
        <div className={`h-2 bg-gradient-to-r ${alav.cor}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-gradient-to-br ${alav.cor} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <Badge variant="outline" className="mb-1 text-xs">
                  Alavanca {alav.numero} de {alavancas.length}
                </Badge>
                <CardTitle className="text-lg">{alav.nome}</CardTitle>
                <CardDescription className="text-xs">{alav.foco}</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="font-mono">{pontuacoes[alav.id] || 0}/10</Badge>
          </div>
          <Progress value={((currentAlav + 1) / alavancas.length) * 100} className="h-1.5 mt-3" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Marque apenas o que sua empresa <strong>realmente faz hoje</strong>. A pontuação é automática.
          </p>
          {pAlav.map((p) => (
            <label key={p.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition cursor-pointer">
              <Checkbox
                checked={!!respostasMap[p.id]}
                onCheckedChange={(v) => setRespostasMap((m) => ({ ...m, [p.id]: !!v }))}
                className="mt-0.5"
              />
              <span className="text-sm flex-1">{p.pergunta}</span>
            </label>
          ))}
          <div className="flex justify-between pt-4 gap-2">
            <Button variant="outline" onClick={() => {
              if (currentAlav === 0) setStep("intro");
              else setCurrentAlav((i) => i - 1);
            }} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            {!isLast ? (
              <Button onClick={() => setCurrentAlav((i) => i + 1)} className="gap-2">
                Próxima alavanca <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={salvar.isPending} className="gap-2" onClick={() => {
                salvar.mutate(
                  { pontuacoes, respostas_perguntas: respostasMap },
                  {
                    onSuccess: async () => {
                      toast.success("Diagnóstico salvo! Gerando plano completo...");
                      // Também dispara o roadmap automático com base no WMI
                      try {
                        if (score) await genRoadmap.mutateAsync();
                      } catch (e: any) {
                        console.warn("Roadmap automático falhou:", e?.message);
                      }
                      setStep("result");
                    },
                    onError: (e: any) => toast.error(e.message),
                  }
                );
              }}>
                {salvar.isPending || genRoadmap.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                Finalizar e gerar Plano Comercial Completo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ RESULT ============
  if (!ultimo) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum diagnóstico realizado.</p>
          <Button onClick={() => setStep("intro")} className="mt-4">Iniciar diagnóstico</Button>
        </CardContent>
      </Card>
    );
  }

  const c = CLASSIFICACOES[ultimo.nota];

  return (
    <div className="space-y-4">
      {/* Header resultado */}
      <Card className="border-2 overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${c.cor}`} />
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-3">
              <Badge variant="outline" className="text-xs">
                Diagnóstico de {format(new Date(ultimo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </Badge>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="text-3xl">{c.emoji}</span>{c.titulo}
              </h3>
              <p className="text-sm text-muted-foreground">{c.cenario}</p>
              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">📌 RECOMENDAÇÃO</div>
                <p className="text-sm">{c.recomendacao}</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Sua nota</div>
              <div className={`text-7xl font-bold bg-gradient-to-br ${c.cor} bg-clip-text text-transparent`}>
                {ultimo.nota}
              </div>
              <Badge className={`bg-gradient-to-r ${c.cor} text-white border-0`}>
                <Trophy className="h-3 w-3 mr-1" />
                {ultimo.percentual}% — {ultimo.total_score}/{(alavancas?.length || 0) * 10}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards alavancas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        {alavancas?.map((a) => {
          const Icon = ICON_MAP[a.icon] || Target;
          const sc = ultimo.pontuacoes[a.id] || 0;
          const fraca = sc < 5;
          return (
            <Card key={a.id} className={fraca ? "border-rose-500/40" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded bg-gradient-to-br ${a.cor} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {fraca && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                </div>
                <div className="text-xs font-semibold leading-tight">{a.nome}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{sc}</span>
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
                <Progress value={(sc / 10) * 100} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sub-tabs do plano */}
      <Tabs defaultValue="plano" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="plano" className="gap-2"><FileText className="h-4 w-4" /> Plano de Ação IA</TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-2"><Zap className="h-4 w-4" /> Roadmap 90 dias</TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-2"><BarChart3 className="h-4 w-4" /> Benchmark</TabsTrigger>
          <TabsTrigger value="advisor" className="gap-2"><Bot className="h-4 w-4" /> Advisor IA</TabsTrigger>
        </TabsList>

        {/* PLANO IA */}
        <TabsContent value="plano">
          {ultimo.diagnostico_ia ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Plano Comercial Executivo · GROW Advisor IA
                </CardTitle>
                <CardDescription>
                  Processos · Atendimento · Vendas · Playbooks · Metas · KPIs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{ultimo.diagnostico_ia}</ReactMarkdown>
                </div>
                <div className="flex gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" size="sm" onClick={() => {
                    setRespostasMap({}); setCurrentAlav(0); setStep("form");
                  }} className="gap-2">
                    <RotateCcw className="h-3.5 w-3.5" /> Refazer diagnóstico
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/processos")} className="gap-2">
                    Ir para Processos Comerciais <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Plano sendo gerado pela IA…</p>
                <Button variant="outline" size="sm" onClick={() => {
                  salvar.mutate({ pontuacoes: ultimo.pontuacoes, respostas_perguntas: ultimo.respostas_perguntas });
                }}>
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ROADMAP */}
        <TabsContent value="roadmap" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => genRoadmap.mutate(undefined, {
              onSuccess: (r) => toast.success(`Roadmap atualizado: ${r.items.length} ações`),
              onError: (e: any) => toast.error(e.message),
            })} disabled={genRoadmap.isPending} className="gap-2">
              {genRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerar Roadmap
            </Button>
          </div>
          {!roadmap?.length ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <Sparkles className="h-12 w-12 mx-auto text-primary/40" />
                <p className="text-muted-foreground">Nenhum roadmap gerado ainda.</p>
                <Button onClick={() => genRoadmap.mutate()} disabled={genRoadmap.isPending} className="gap-2">
                  {genRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            [1, 2, 3].map((week) => {
              const items = roadmap.filter((r: any) => r.week === week);
              if (!items.length) return null;
              return (
                <Card key={week}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{week}</div>
                      Semana {week}
                      <Badge variant="outline" className="ml-2">{items.length} ações</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((it: any) => (
                      <div key={it.id} className="border rounded-lg p-3 hover:bg-muted/30 transition flex gap-3">
                        <button onClick={() => updateItem.mutate({ id: it.id, status: it.status === "done" ? "pending" : "done" })} className="mt-0.5 shrink-0">
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
                              <Badge variant="outline" className={`text-xs ${PRIORITY_STYLE[it.priority]}`}>{it.priority}</Badge>
                              <Badge variant="outline" className="text-xs capitalize">{it.pillar}</Badge>
                            </div>
                          </div>
                          {it.description && <p className="text-xs text-muted-foreground mt-1">{it.description}</p>}
                          {it.expected_impact && (
                            <p className="text-xs mt-1.5 text-emerald-600 dark:text-emerald-400">💎 {it.expected_impact}</p>
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
              {!benchmarks?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sem benchmarks disponíveis.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {benchmarks.map((b: any) => {
                    const own = score ? pickOwnMetric(score, b.metric_key) : 0;
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVISOR */}
        <TabsContent value="advisor">
          <AdvisorChat score={score} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function pickOwnMetric(score: any, key: string): number {
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
