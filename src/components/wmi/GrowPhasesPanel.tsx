import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Wrench, Cog, Trophy, CheckCircle2, ArrowRight } from "lucide-react";
import { useGrowScore, GrowSelo } from "@/hooks/useEstruturacao";

type PhaseKey = "garimpar" | "reestruturar" | "operar" | "winning";

interface Phase {
  key: PhaseKey;
  letter: string;
  label: string;
  tagline: string;
  desc: string;
  icon: any;
  color: string;
  outputs: string[];
}

const PHASES: Phase[] = [
  {
    key: "garimpar",
    letter: "G",
    label: "Garimpar",
    tagline: "Diagnóstico 360° + GMI Score",
    desc: "Mapeamos dores, gargalos e oportunidades reais da operação comercial. Ponto zero da metodologia.",
    icon: Search,
    color: "from-rose-500 to-orange-400",
    outputs: ["GMI Score", "Diagnóstico 360°", "Mapa de gargalos"],
  },
  {
    key: "reestruturar",
    letter: "R",
    label: "Reestruturar",
    tagline: "Processos, playbooks e CRM no padrão",
    desc: "Organizamos funil, scripts, automações, IA e times. Fundação para previsibilidade.",
    icon: Wrench,
    color: "from-blue-500 to-cyan-400",
    outputs: ["Funil padrão", "Playbooks", "CRM maduro", "IA configurada"],
  },
  {
    key: "operar",
    letter: "O",
    label: "Operar",
    tagline: "Ritmo D1/S1/M1/T1 + métricas-norte",
    desc: "Operação rodando com cadência, indicadores e gestão por dados. Previsibilidade ativa.",
    icon: Cog,
    color: "from-emerald-500 to-green-400",
    outputs: ["Ritmos GROW", "Métricas-norte", "Forecast confiável"],
  },
  {
    key: "winning",
    letter: "W",
    label: "Winning Cycle",
    tagline: "Escala, otimização contínua e benchmark",
    desc: "Ciclo de melhoria contínua, expansão e referência de mercado no segmento.",
    icon: Trophy,
    color: "from-amber-500 to-yellow-400",
    outputs: ["Escala previsível", "Benchmark segmento", "Otimização contínua"],
  },
];

const SELO_TO_PHASE: Record<GrowSelo, PhaseKey> = {
  iniciante: "garimpar",
  estruturado: "reestruturar",
  maduro: "operar",
  referencia: "winning",
};

export function GrowPhasesPanel() {
  const { data, isLoading } = useGrowScore();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const currentPhase: PhaseKey = data ? SELO_TO_PHASE[data.selo] : "garimpar";
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/15 text-primary border-primary/30">Metodologia G.R.O.W.</Badge>
          <Badge variant="outline" className="text-[10px]">4 Fases</Badge>
        </div>
        <CardTitle className="text-xl mt-1">Sua jornada na metodologia</CardTitle>
        <CardDescription>
          Toda empresa passa por 4 fases na G.R.O.W. Sua fase atual é destacada abaixo com base no seu GMI Score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trilha visual */}
        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-border -translate-y-1/2 hidden md:block" />
          <div
            className="absolute left-0 top-1/2 h-1 bg-gradient-to-r from-primary to-primary/40 -translate-y-1/2 hidden md:block transition-all"
            style={{ width: `${((currentIdx + 0.5) / PHASES.length) * 100}%` }}
          />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
            {PHASES.map((p, idx) => {
              const Icon = p.icon;
              const isCurrent = p.key === currentPhase;
              const isDone = idx < currentIdx;
              return (
                <div key={p.key} className="flex flex-col items-center text-center">
                  <div
                    className={`relative h-14 w-14 rounded-full flex items-center justify-center border-2 transition ${
                      isCurrent
                        ? `bg-gradient-to-br ${p.color} text-white border-white shadow-lg scale-110`
                        : isDone
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-6 w-6" /> : <span className="text-xl font-bold">{p.letter}</span>}
                    {isCurrent && (
                      <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0 bg-primary">
                        Você está aqui
                      </Badge>
                    )}
                  </div>
                  <div className={`mt-3 text-sm font-semibold ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                    {p.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground hidden md:block">{p.tagline}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cards detalhados */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {PHASES.map((p, idx) => {
            const Icon = p.icon;
            const isCurrent = p.key === currentPhase;
            const isDone = idx < currentIdx;
            const isFuture = idx > currentIdx;
            return (
              <Card
                key={p.key}
                className={`overflow-hidden transition ${
                  isCurrent ? "border-2 border-primary shadow-md" : isFuture ? "opacity-60" : ""
                }`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${p.color}`} />
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded bg-gradient-to-br ${p.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm">{p.letter} · {p.label}</span>
                    {isCurrent && (
                      <Badge className="ml-auto text-[9px] bg-primary">Atual</Badge>
                    )}
                    {isDone && (
                      <Badge variant="secondary" className="ml-auto text-[9px]">Concluída</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{p.desc}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.outputs.map((o) => (
                      <Badge key={o} variant="outline" className="text-[9px]">{o}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {data && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
            <ArrowRight className="h-3 w-3" />
            Próximo passo: {currentIdx < PHASES.length - 1
              ? <span className="font-medium text-foreground">avançar para <strong>{PHASES[currentIdx + 1].label}</strong> — {PHASES[currentIdx + 1].tagline}</span>
              : <span className="font-medium text-foreground">manter o ciclo de melhoria contínua e benchmark de mercado.</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
