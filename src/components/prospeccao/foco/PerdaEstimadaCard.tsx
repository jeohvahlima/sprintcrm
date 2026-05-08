import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { DailyFocus } from "@/hooks/useDailyFocus";

interface Props {
  focus: DailyFocus;
  onRecuperar?: () => void;
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);

export function PerdaEstimadaCard({ focus, onRecuperar }: Props) {
  const exec = focus.rotina_executada_pct;
  const perda = focus.perda_estimada_hoje;
  const semDado = perda <= 0 && exec >= 100;

  return (
    <Card className="relative overflow-hidden p-5 border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-destructive/20 blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Perda Estimada
        </h3>
      </div>

      {semDado ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          🎉 Meta batida! Nenhuma perda estimada hoje.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Você executou apenas{" "}
            <span className="font-bold text-foreground">{exec}%</span> da rotina hoje.
          </p>
          <div className="mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Receita não gerada hoje
            </div>
            <div className="text-3xl font-bold text-destructive tabular-nums">
              {money(perda)}
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={onRecuperar}
          >
            Recuperar agora <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}
    </Card>
  );
}
