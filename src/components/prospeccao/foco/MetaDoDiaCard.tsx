import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame } from "lucide-react";
import type { DailyFocus } from "@/hooks/useDailyFocus";

interface Props {
  focus: DailyFocus;
}

export function MetaDoDiaCard({ focus }: Props) {
  const empty = focus.metrics.length === 0;

  return (
    <Card className="relative overflow-hidden p-5 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-3">
        <Flame className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Meta do Dia</h3>
        {focus.fonte === "diagnostico" && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Sugerida
          </span>
        )}
      </div>

      {empty ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma meta diária configurada.
          <br />
          <span className="text-xs">
            Configure em Diagnóstico ou Configurações Comerciais.
          </span>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5 mb-4">
            {focus.metrics.slice(0, 4).map((m) => (
              <li key={m.metric} className="flex items-center justify-between text-sm">
                <span className="text-foreground/90">
                  {m.emoji} {m.target} {m.label.toLowerCase()}
                </span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    m.progress_pct >= 100
                      ? "text-primary"
                      : m.progress_pct >= 50
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {m.current}/{m.target} · {m.progress_pct}%
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground uppercase tracking-wider">Progresso geral</span>
              <span className="font-bold text-foreground tabular-nums">
                {focus.overall_progress_pct}%
              </span>
            </div>
            <Progress value={focus.overall_progress_pct} className="h-2" />
          </div>
        </>
      )}
    </Card>
  );
}
