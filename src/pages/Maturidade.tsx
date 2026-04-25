import { useNavigate } from "react-router-dom";
import { useMaturityScore } from "@/hooks/useMaturityScore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Target, FileText, PhoneCall, Bot, TrendingUp,
  Sparkles, ArrowRight, GraduationCap, Trophy
} from "lucide-react";

const LEVEL_COLORS: Record<string, string> = {
  "Elite": "from-amber-500 to-yellow-400",
  "Maduro": "from-emerald-500 to-green-400",
  "Em Estruturação": "from-blue-500 to-cyan-400",
  "Iniciante": "from-orange-500 to-amber-400",
  "Não Estruturado": "from-rose-500 to-red-400",
};

const LEVEL_DESC: Record<string, string> = {
  "Elite": "Sua operação comercial está no top 5%. Foque em otimização fina e escala.",
  "Maduro": "Operação sólida. Pequenos ajustes destravam o próximo nível.",
  "Em Estruturação": "Você já tem fundação. Hora de aprofundar processos e automação.",
  "Iniciante": "Caminho promissor. Estruture os 4 pilares para ganhar previsibilidade.",
  "Não Estruturado": "Maior oportunidade de crescimento. Comece pelos pilares essenciais.",
};

interface PillarCardProps {
  icon: React.ElementType;
  title: string;
  score: number;
  max: number;
  metrics: { label: string; value: number }[];
  cta: { label: string; route: string };
  color: string;
}

function PillarCard({ icon: Icon, title, score, max, metrics, cta, color, navigate }: PillarCardProps & { navigate: (r: string) => void }) {
  const pct = Math.round((score / max) * 100);
  return (
    <Card className="overflow-hidden border-2 hover:border-primary/40 transition-all">
      <div className={`h-1.5 bg-gradient-to-r ${color}`} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white`}>
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono">{score}/{max}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2" />
        <div className="space-y-1.5 pt-1">
          {metrics.map((m) => (
            <div key={m.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium">{m.value}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => navigate(cta.route)}>
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Maturidade() {
  const navigate = useNavigate();
  const { data, isLoading } = useMaturityScore();

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const { total_score, level, pillars } = data;
  const levelColor = LEVEL_COLORS[level] || LEVEL_COLORS["Iniciante"];
  const showUpsell = total_score < 70;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          Maturidade Comercial
        </h1>
        <p className="text-muted-foreground mt-1">
          Score 0–100 baseado nos 4 pilares: Prospecção, Processos, Discador e Automação/IA
        </p>
      </div>

      {/* Score principal */}
      <Card className="overflow-hidden border-2">
        <div className={`h-2 bg-gradient-to-r ${levelColor}`} />
        <CardContent className="p-8">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className="text-center md:text-left">
              <div className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Sua pontuação</div>
              <div className="flex items-baseline gap-2 justify-center md:justify-start mt-1">
                <span className={`text-7xl font-bold bg-gradient-to-br ${levelColor} bg-clip-text text-transparent`}>
                  {total_score}
                </span>
                <span className="text-2xl text-muted-foreground">/100</span>
              </div>
              <Badge className={`mt-3 bg-gradient-to-r ${levelColor} text-white border-0`}>
                <Trophy className="h-3 w-3 mr-1" /> Nível {level}
              </Badge>
            </div>
            <div className="md:col-span-2 space-y-3">
              <p className="text-base">{LEVEL_DESC[level]}</p>
              <Progress value={total_score} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0 — Não estruturado</span>
                <span>40 — Em estruturação</span>
                <span>80 — Elite</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pilares */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Os 4 Pilares
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PillarCard
            navigate={navigate}
            icon={Target}
            title="Prospecção"
            score={pillars.prospeccao.score}
            max={pillars.prospeccao.max}
            color="from-blue-500 to-cyan-400"
            metrics={[
              { label: "Interações (30d)", value: pillars.prospeccao.metrics.interactions_30d },
              { label: "Filas ativas", value: pillars.prospeccao.metrics.queues },
            ]}
            cta={{ label: "Ir para Prospecção", route: "/prospeccao" }}
          />
          <PillarCard
            navigate={navigate}
            icon={FileText}
            title="Processos Comerciais"
            score={pillars.processos.score}
            max={pillars.processos.max}
            color="from-purple-500 to-fuchsia-400"
            metrics={[
              { label: "Playbooks", value: pillars.processos.metrics.playbooks },
              { label: "Rotinas", value: pillars.processos.metrics.rotinas },
              { label: "Páginas", value: pillars.processos.metrics.pages },
            ]}
            cta={{ label: "Estruturar Processos", route: "/processos" }}
          />
          <PillarCard
            navigate={navigate}
            icon={PhoneCall}
            title="Discador"
            score={pillars.discador.score}
            max={pillars.discador.max}
            color="from-emerald-500 to-green-400"
            metrics={[
              { label: "Chamadas (30d)", value: pillars.discador.metrics.calls_30d },
              { label: "Operadores ativos", value: pillars.discador.metrics.users },
            ]}
            cta={{ label: "Abrir Discador", route: "/discador" }}
          />
          <PillarCard
            navigate={navigate}
            icon={Bot}
            title="Automação & IA"
            score={pillars.automacao.score}
            max={pillars.automacao.max}
            color="from-amber-500 to-orange-400"
            metrics={[
              { label: "Fluxos ativos", value: pillars.automacao.metrics.flows },
              { label: "Agentes IA", value: pillars.automacao.metrics.ia_agents },
              { label: "Scripts", value: pillars.automacao.metrics.scripts },
            ]}
            cta={{ label: "Configurar IA", route: "/ia" }}
          />
        </div>
      </div>

      {/* Upsell mentoria */}
      {showUpsell && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  Acelere para o nível Elite com Mentoria 1:1
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Mentores Waze ajudam você a destravar os pilares com menor pontuação. Sessões mensais
                  + comunidade + biblioteca de gravações.
                </p>
              </div>
              <Button onClick={() => navigate("/mentoria")} className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Conhecer Mentoria
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
