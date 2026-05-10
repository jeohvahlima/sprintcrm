import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Sparkles } from "lucide-react";
import { useGrowScore, GROW_SELO_META } from "@/hooks/useEstruturacao";

export function GrowScoreHero() {
  const { data, isLoading } = useGrowScore();

  if (isLoading) return <Skeleton className="h-44 w-full" />;
  if (!data) return null;

  const meta = GROW_SELO_META[data.selo];
  const pillars: { key: keyof typeof data.pillars; label: string }[] = [
    { key: "prospeccao", label: "Prospecção" },
    { key: "processos",  label: "Processos" },
    { key: "discador",   label: "Discador" },
    { key: "automacao",  label: "Automação" },
    { key: "crm",        label: "CRM" },
    { key: "ia",         label: "IA" },
    { key: "playbook",   label: "Playbook" },
  ];

  return (
    <Card className="overflow-hidden border-2 border-primary/30">
      <div className={`h-2 bg-gradient-to-r ${meta.color}`} />
      <CardContent className="p-6">
        <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
              <Badge className="bg-primary/15 text-primary border-primary/30">
                <Sparkles className="h-3 w-3 mr-1" /> GROW Score
              </Badge>
              <Badge variant="outline" className="text-[10px]">Selo Grow Sales Intelligence</Badge>
            </div>
            <div className="flex items-baseline gap-2 justify-center md:justify-start">
              <span className={`text-7xl font-bold bg-gradient-to-br ${meta.color} bg-clip-text text-transparent`}>
                {data.grow_score}
              </span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <Badge className={`mt-2 bg-gradient-to-r ${meta.color} text-white border-0`}>
              <Trophy className="h-3.5 w-3.5 mr-1" /> {meta.emoji} {meta.label}
            </Badge>
            <p className="text-sm mt-2 text-muted-foreground max-w-xs">{meta.desc}</p>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Composição (ponderada)
            </div>
            {pillars.map((p) => {
              const v = data.pillars[p.key] ?? 0;
              // Pilares originais são 0-25 (escala 4x), outros são 0-100
              const isOriginal = ["prospeccao","processos","discador","automacao"].includes(p.key);
              const pct = isOriginal ? (v / 25) * 100 : v;
              return (
                <div key={p.key} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">{p.label}</span>
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono w-12 text-right">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
