import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { useGrowScore, useGrowSegmentBenchmark } from "@/hooks/useEstruturacao";

export function GrowSegmentBenchmarkCard() {
  const { data: seg } = useCompanySegmento();
  const segmento = (seg as any)?.segmento || (seg as any)?.codigo || (typeof seg === "string" ? seg : null);
  const { data: bench, isLoading } = useGrowSegmentBenchmark(segmento);
  const { data: grow } = useGrowScore();

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const myScore = grow?.grow_score ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Benchmark Anônimo — {segmento || "Seu Segmento"}
        </CardTitle>
        <CardDescription>
          Como você está em relação a outras empresas do seu segmento usando o método GROW.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!bench ? (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ainda não há dados suficientes para o segmento <strong>{segmento || "—"}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              O benchmark é liberado quando há pelo menos 5 empresas comparáveis (totalmente anônimo).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Seu Score" value={myScore} highlight />
              <Stat label="Média Segmento" value={bench.avg_score} icon={
                myScore > bench.avg_score ? <TrendingUp className="h-3 w-3 text-emerald-500" /> :
                myScore < bench.avg_score ? <TrendingDown className="h-3 w-3 text-rose-500" /> :
                <Minus className="h-3 w-3 text-muted-foreground" />
              } />
              <Stat label="Top 10%" value={bench.top10_score} />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Amostra: <strong>{bench.sample_size}</strong> empresas · dados anônimos
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
              {myScore >= bench.top10_score ? (
                <>🏆 Você está no <strong>Top 10%</strong> do seu segmento. Mantenha o ritmo.</>
              ) : myScore >= bench.avg_score ? (
                <>📈 Você está <strong>acima da média</strong> do segmento. Faltam {Math.round(bench.top10_score - myScore)} pontos para o Top 10%.</>
              ) : (
                <>🎯 Você está <strong>abaixo da média</strong>. Foque nos pilares mais fracos — {Math.round(bench.avg_score - myScore)} pontos te colocam na média.</>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight, icon }: { label: string; value: number; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-primary/10 border border-primary/30" : "bg-muted/40"}`}>
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{Math.round(value)}</div>
    </div>
  );
}
