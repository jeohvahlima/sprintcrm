import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useWMIBenchmarkBySegment } from "@/hooks/useMaturityIntel";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";

interface Props {
  /** Métricas atuais da empresa para comparar (mesmas keys do benchmark) */
  currentMetrics?: Record<string, number>;
}

export function SegmentBenchmarkCard({ currentMetrics = {} }: Props) {
  const { segmento } = useCompanySegmento();
  const seg = segmento || "geral";
  const { data, isLoading } = useWMIBenchmarkBySegment(seg);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" /> Benchmark por Segmento
          <Badge variant="outline" className="ml-auto capitalize">{seg}</Badge>
        </CardTitle>
        <CardDescription>Compare sua performance com a média do seu segmento.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sem dados de benchmark para o segmento "{seg}". Em breve.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((b: any) => {
              const current = currentMetrics[b.metric_key];
              const hasCurrent = typeof current === "number";
              const diff = hasCurrent ? current - Number(b.market_average) : 0;
              // win_rate: maior é melhor / cycle_days: menor é melhor
              const isPositive = b.metric_key === "cycle_days" ? diff < 0 : diff > 0;
              const Icon = !hasCurrent ? Minus : isPositive ? TrendingUp : TrendingDown;
              return (
                <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{b.metric_label}</p>
                    <p className="text-xs text-muted-foreground">
                      Mercado: <span className="font-mono">{b.market_average}{b.unit}</span>
                      {hasCurrent && <> · Você: <span className="font-mono font-semibold">{current}{b.unit}</span></>}
                    </p>
                  </div>
                  {hasCurrent && (
                    <Badge variant={isPositive ? "default" : "secondary"} className="gap-1 text-xs">
                      <Icon className="h-3 w-3" />
                      {Math.abs(diff).toFixed(1)}{b.unit}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
