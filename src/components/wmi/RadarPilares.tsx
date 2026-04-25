import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { WMIScore } from "@/hooks/useWMI";

export function RadarPilares({ score }: { score: WMIScore }) {
  const data = [
    { pilar: "Processos", value: score.pillars.processos.score, fullMark: 20 },
    { pilar: "Prospecção", value: score.pillars.prospeccao.score, fullMark: 20 },
    { pilar: "Gestão", value: score.pillars.gestao.score, fullMark: 20 },
    { pilar: "Automação", value: score.pillars.automacao.score, fullMark: 20 },
    { pilar: "Pessoas", value: score.pillars.pessoas.score, fullMark: 20 },
  ];
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="pilar" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 20]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
        <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
