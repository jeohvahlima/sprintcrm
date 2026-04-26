import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Trophy,
  AlertTriangle,
  RotateCcw,
  Target,
  TrendingUp,
  Heart,
  Users,
  BarChart3,
} from "lucide-react";
import {
  useAlavancas,
  usePerguntas,
  useUltimoDiagnostico,
  useSalvarDiagnostico,
  CLASSIFICACOES,
} from "@/hooks/useDiagnostico360";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ICON_MAP: Record<string, any> = {
  Target,
  TrendingUp,
  Heart,
  Users,
  BarChart3,
};

export function Diagnostico360() {
  const { data: alavancas, isLoading: loadAlav } = useAlavancas();
  const { data: perguntas, isLoading: loadPerg } = usePerguntas();
  const { data: ultimo } = useUltimoDiagnostico();
  const salvar = useSalvarDiagnostico();

  const [step, setStep] = useState<"intro" | "form" | "result">(
    ultimo ? "result" : "intro"
  );
  const [respostasMap, setRespostasMap] = useState<Record<string, boolean>>({});
  const [currentAlavanca, setCurrentAlavanca] = useState(0);

  // Calcula pontuação automática baseada nas perguntas marcadas
  const pontuacoes = useMemo(() => {
    if (!alavancas || !perguntas) return {};
    const out: Record<string, number> = {};
    alavancas.forEach((a) => {
      const pAlav = perguntas.filter((p) => p.alavanca_id === a.id);
      const marcadas = pAlav.filter((p) => respostasMap[p.id]).length;
      out[a.id] = pAlav.length > 0 ? Math.round((marcadas / pAlav.length) * 10) : 0;
    });
    return out;
  }, [alavancas, perguntas, respostasMap]);

  const totalScore = Object.values(pontuacoes).reduce((a, b) => a + b, 0);
  const maxScore = (alavancas?.length || 0) * 10;
  const percentual = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  if (loadAlav || loadPerg) {
    return <Skeleton className="h-96 w-full" />;
  }

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
              <Badge variant="outline" className="mb-2">
                Avaliação 360° · Metodologia Waze
              </Badge>
              <h2 className="text-2xl font-bold">Diagnóstico Comercial 360</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Responda perguntas estratégicas sobre as 5 alavancas comerciais da sua
                empresa. Em 5 minutos você terá um diagnóstico executivo + plano de ação
                gerado por IA, identificando exatamente onde está o seu "balde furado".
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {alavancas?.map((a) => {
              const Icon = ICON_MAP[a.icon] || Target;
              return (
                <div
                  key={a.id}
                  className="border rounded-lg p-3 hover:border-primary/40 transition"
                >
                  <div
                    className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${a.cor} text-white mb-2`}
                  >
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
                <div
                  key={n}
                  className={`border rounded-lg p-3 bg-gradient-to-br ${c.cor} bg-opacity-10`}
                >
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="text-xs font-bold mt-1">Nota {n}</div>
                  <div className="text-[10px] text-muted-foreground">{c.range}</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              size="lg"
              className="gap-2 flex-1"
              onClick={() => {
                setRespostasMap({});
                setCurrentAlavanca(0);
                setStep("form");
              }}
            >
              <Sparkles className="h-4 w-4" />
              {ultimo ? "Refazer diagnóstico" : "Iniciar diagnóstico"}
            </Button>
            {ultimo && (
              <Button size="lg" variant="outline" onClick={() => setStep("result")}>
                Ver último resultado
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ FORMULÁRIO ============
  if (step === "form" && alavancas && perguntas) {
    const alav = alavancas[currentAlavanca];
    const pAlav = perguntas.filter((p) => p.alavanca_id === alav.id);
    const Icon = ICON_MAP[alav.icon] || Target;
    const isLast = currentAlavanca === alavancas.length - 1;
    const respondidasAlav = pAlav.filter((p) => respostasMap[p.id]).length;

    return (
      <Card className="border-2">
        <div className={`h-2 bg-gradient-to-r ${alav.cor}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg bg-gradient-to-br ${alav.cor} text-white`}
              >
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
            <Badge variant="secondary" className="font-mono">
              {pontuacoes[alav.id] || 0}/10
            </Badge>
          </div>
          <Progress
            value={((currentAlavanca + 1) / alavancas.length) * 100}
            className="h-1.5 mt-3"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Marque apenas o que sua empresa <strong>realmente faz hoje</strong>. A
            pontuação é calculada automaticamente.
          </p>
          {pAlav.map((p) => (
            <label
              key={p.id}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition cursor-pointer"
            >
              <Checkbox
                checked={!!respostasMap[p.id]}
                onCheckedChange={(v) =>
                  setRespostasMap((m) => ({ ...m, [p.id]: !!v }))
                }
                className="mt-0.5"
              />
              <span className="text-sm flex-1">{p.pergunta}</span>
            </label>
          ))}

          <div className="flex justify-between pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (currentAlavanca === 0) setStep("intro");
                else setCurrentAlavanca((i) => i - 1);
              }}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            {!isLast ? (
              <Button
                onClick={() => setCurrentAlavanca((i) => i + 1)}
                className="gap-2"
              >
                Próxima alavanca <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={salvar.isPending}
                className="gap-2"
                onClick={() => {
                  salvar.mutate(
                    { pontuacoes, respostas_perguntas: respostasMap },
                    {
                      onSuccess: () => {
                        toast.success("Diagnóstico salvo! Plano de ação gerado pela IA.");
                        setStep("result");
                      },
                      onError: (e: any) => toast.error(e.message),
                    }
                  );
                }}
              >
                {salvar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Finalizar e gerar plano IA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ RESULTADO ============
  const result = ultimo;
  if (!result) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-muted-foreground">Nenhum diagnóstico realizado.</p>
          <Button onClick={() => setStep("intro")} className="mt-4">
            Iniciar diagnóstico
          </Button>
        </CardContent>
      </Card>
    );
  }

  const c = CLASSIFICACOES[result.nota];

  return (
    <div className="space-y-4">
      {/* Header do resultado */}
      <Card className="border-2 overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${c.cor}`} />
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-3">
              <Badge variant="outline" className="text-xs">
                Diagnóstico de{" "}
                {format(new Date(result.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </Badge>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="text-3xl">{c.emoji}</span>
                {c.titulo}
              </h3>
              <p className="text-sm text-muted-foreground">{c.cenario}</p>
              <div className="p-3 rounded-lg bg-muted/40 border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  📌 RECOMENDAÇÃO
                </div>
                <p className="text-sm">{c.recomendacao}</p>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Sua nota
              </div>
              <div
                className={`text-7xl font-bold bg-gradient-to-br ${c.cor} bg-clip-text text-transparent`}
              >
                {result.nota}
              </div>
              <Badge className={`bg-gradient-to-r ${c.cor} text-white border-0`}>
                <Trophy className="h-3 w-3 mr-1" />
                {result.percentual}% — {result.total_score}/{(alavancas?.length || 0) * 10}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alavancas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        {alavancas?.map((a) => {
          const Icon = ICON_MAP[a.icon] || Target;
          const score = result.pontuacoes[a.id] || 0;
          const pct = (score / 10) * 100;
          const fraca = score < 5;
          return (
            <Card
              key={a.id}
              className={fraca ? "border-rose-500/40" : ""}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div
                    className={`p-1.5 rounded bg-gradient-to-br ${a.cor} text-white`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {fraca && (
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  )}
                </div>
                <div className="text-xs font-semibold leading-tight">{a.nome}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{score}</span>
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Plano IA */}
      {result.diagnostico_ia ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Plano de Ação gerado pelo Waze Advisor IA
            </CardTitle>
            <CardDescription>
              Estratégia personalizada para seus gargalos críticos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.diagnostico_ia}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Plano de ação sendo gerado pela IA…
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setRespostasMap({});
            setCurrentAlavanca(0);
            setStep("form");
          }}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" /> Refazer diagnóstico
        </Button>
      </div>
    </div>
  );
}
