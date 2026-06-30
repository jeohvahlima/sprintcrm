import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Compass, ArrowRight, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNorthMetrics } from "@/hooks/useEstruturacao";
import { useBusinessContext, BUSINESS_PHASES } from "@/hooks/useEstruturacao";

const MODULO_ROUTE: Record<string, string> = {
  prospeccao: "/prospeccao",
  funil: "/kanban",
  analytics: "/analytics",
  rh: "/rh-comercial",
  processos: "/processos",
  discador: "/discador",
};

export function NorthMetricsPanel() {
  const navigate = useNavigate();
  const { data: bizCtx } = useBusinessContext();
  const fase = bizCtx?.fase as string | undefined;
  const { data: metrics = [], isLoading } = useNorthMetrics(fase);
  const faseMeta = BUSINESS_PHASES.find((p) => p.key === fase);

  if (!fase) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <Compass className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Defina a <strong>Fase do Negócio</strong> primeiro para ver suas métricas-norte.
          </p>
          <Button variant="outline" onClick={() => navigate("/maturidade")}>Ir para Fase do Negócio</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Métricas Norte — Fase {faseMeta?.label}</CardTitle>
              <CardDescription>
                KPIs estratégicos definidos pela metodologia GROW para sua fase atual.
              </CardDescription>
            </div>
            {faseMeta && (
              <Badge className={`bg-gradient-to-r ${faseMeta.color} text-white border-0`}>
                {faseMeta.emoji} {faseMeta.label}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {isLoading && <Skeleton className="h-40 w-full" />}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const route = m.modulo_origem ? MODULO_ROUTE[m.modulo_origem] : null;
          return (
            <Card key={m.id} className="border-l-4 border-l-primary/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.descricao}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs pt-1">
                  <Badge variant="outline" className="text-[10px]">Mín: {m.meta_min} {m.unidade}</Badge>
                  <Badge variant="secondary" className="text-[10px]">Ideal: {m.meta_ideal} {m.unidade}</Badge>
                </div>
                {route && (
                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 text-xs"
                    onClick={() => navigate(route)}>
                    Medir em {m.modulo_origem} <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isLoading && metrics.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma métrica cadastrada para esta fase.
        </p>
      )}
    </div>
  );
}
