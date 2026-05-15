import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { WMIScore } from "@/hooks/useWMI";

export function RadarPilares({ score }: { score: WMIScore }) {
  const p = score.pillars as any;
  const data = [
    { pilar: "Processos", value: p.processos?.score ?? 0, fullMark: 20 },
    { pilar: "Prospecção", value: p.prospeccao?.score ?? 0, fullMark: 20 },
    { pilar: "Gestão", value: p.gestao?.score ?? 0, fullMark: 20 },
    { pilar: "Automação", value: p.automacao?.score ?? 0, fullMark: 20 },
    { pilar: "Pessoas", value: p.pessoas?.score ?? 0, fullMark: 20 },
    { pilar: "Aquisição", value: p.aquisicao?.score ?? 0, fullMark: 20 },
    { pilar: "Social", value: p.social?.score ?? 0, fullMark: 20 },
    { pilar: "Dependência", value: p.dependencia?.score ?? 0, fullMark: 20 },
    { pilar: "Crescimento", value: p.crescimento?.score ?? 0, fullMark: 20 },
  ];
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="pilar" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 20]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
        <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
