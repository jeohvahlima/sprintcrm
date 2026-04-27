import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { useFullWMIHistory } from "@/hooks/useMaturityIntel";
import { TrendingUp } from "lucide-react";

const PILLARS = [
  { key: "pillar_processos", label: "Processos", color: "#a855f7" },
  { key: "pillar_prospeccao", label: "Prospecção", color: "#3b82f6" },
  { key: "pillar_gestao", label: "Gestão", color: "#10b981" },
  { key: "pillar_automacao", label: "Automação", color: "#f59e0b" },
  { key: "pillar_pessoas", label: "Pessoas", color: "#ec4899" },
];

export function PillarEvolutionChart() {
  const { data, isLoading } = useFullWMIHistory();

  if (isLoading) return <Skeleton className="h-72" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" /> Evolução por Pilar
        </CardTitle>
        <CardDescription>Linha do tempo de cada pilar ao longo dos diagnósticos.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data || data.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Gere ao menos 2 diagnósticos para visualizar a evolução por pilar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.map((h: any) => ({
              date: format(new Date(h.created_at), "dd/MM"),
              ...PILLARS.reduce((a, p) => ({ ...a, [p.label]: h[p.key] }), {}),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis domain={[0, 20]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {PILLARS.map((p) => (
                <Line key={p.key} type="monotone" dataKey={p.label} stroke={p.color} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
