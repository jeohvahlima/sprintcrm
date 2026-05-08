import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp, Crown } from "lucide-react";
import type { DailyFocus } from "@/hooks/useDailyFocus";

interface Props {
  focus: DailyFocus;
}

export function PosicaoHojeCard({ focus }: Props) {
  const { posicao, total_jogadores, xp_para_subir, proximo_acima } = focus;
  const isTop1 = posicao === 1;
  const semDado = posicao === null;

  return (
    <Card className="relative overflow-hidden p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Sua Posição
        </h3>
      </div>

      {semDado ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sem ranking nesta empresa ainda.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-4xl font-bold text-foreground tabular-nums">
              #{posicao}
            </span>
            <span className="text-sm text-muted-foreground">
              de {total_jogadores}
            </span>
            {isTop1 && <Crown className="h-6 w-6 text-amber-500 ml-auto" />}
          </div>

          {isTop1 ? (
            <div className="text-sm">
              <div className="font-semibold text-amber-500 mb-1">👑 Você é o TOP 1</div>
              <p className="text-xs text-muted-foreground">
                Mantenha o ritmo para não perder o topo.
              </p>
            </div>
          ) : (
            <div className="text-sm">
              <div className="flex items-center gap-1 text-primary mb-1.5">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">Faltam {xp_para_subir} XP</span>
              </div>
              <p className="text-xs text-muted-foreground">
                para ultrapassar{" "}
                <span className="font-semibold text-foreground">
                  {proximo_acima?.full_name || "o próximo"}
                </span>{" "}
                e subir para #{(posicao || 2) - 1}.
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
