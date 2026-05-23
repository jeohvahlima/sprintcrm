import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Trophy,
  Zap,
  Battery,
  BatteryMedium,
  BatteryLow,
  ClipboardCheck,
  Target,
} from "lucide-react";
import { usePlayerProfile, xpNeededForLevel, getRankByLevel } from "@/hooks/usePlayerProfile";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { useDailyEnergy, type EnergyLevel } from "@/hooks/useDailyCockpit";
import { cn } from "@/lib/utils";
import { FimDeDiaDialog } from "./FimDeDiaDialog";

const energyOptions: { value: EnergyLevel; label: string; Icon: any; tint: string }[] = [
  { value: "alta", label: "Alta", Icon: Battery, tint: "text-primary" },
  { value: "media", label: "Média", Icon: BatteryMedium, tint: "text-amber-400" },
  { value: "baixa", label: "Baixa", Icon: BatteryLow, tint: "text-rose-400" },
];

export function CockpitHUD() {
  const { data: profile } = usePlayerProfile();
  const focus = useDailyFocus();
  const { energy, setEnergy } = useDailyEnergy();
  const [eodOpen, setEodOpen] = useState(false);

  const level = profile?.level ?? 1;
  const xpCurrent = profile?.xp_current ?? 0;
  const xpNeeded = xpNeededForLevel(level);
  const xpPct = Math.min(100, Math.round((xpCurrent / Math.max(1, xpNeeded)) * 100));
  const rank = getRankByLevel(level);
  const streak = profile?.streak_days ?? 0;

  return (
    <>
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-4 md:p-5">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* META DO DIA */}
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-primary" /> Meta do Dia
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {focus.overall_progress_pct}%
            </div>
            <Progress value={focus.overall_progress_pct} className="h-2" />
            <div className="text-[11px] text-muted-foreground">
              {focus.metrics.length > 0
                ? focus.metrics
                    .slice(0, 2)
                    .map((m) => `${m.current}/${m.target} ${m.label.toLowerCase()}`)
                    .join(" · ")
                : "Configure suas metas"}
            </div>
          </div>

          {/* XP / NÍVEL */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" /> Nível {level}
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {xpCurrent}
              <span className="text-xs font-normal text-muted-foreground"> / {xpNeeded} XP</span>
            </div>
            <Progress value={xpPct} className="h-2" />
            <div className="text-[11px] text-muted-foreground truncate">{rank.name}</div>
          </div>

          {/* STREAK */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-orange-400" /> Streak
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground flex items-baseline gap-1">
              {streak}
              <span className="text-xs font-normal text-muted-foreground">dias</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    i < Math.min(streak, 7) ? "bg-orange-400" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">Mantenha o ritmo</div>
          </div>

          {/* ENERGIA + RANKING */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              {focus.posicao ? `#${focus.posicao}` : "Sem rank"}
              {focus.proximo_acima && focus.xp_para_subir > 0 && (
                <span className="ml-auto text-muted-foreground/80">
                  -{focus.xp_para_subir} XP
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {energyOptions.map(({ value, label, Icon, tint }) => {
                const active = energy === value;
                return (
                  <Button
                    key={value}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => setEnergy.mutate(value)}
                    className={cn(
                      "flex-1 h-8 px-2 text-[11px] gap-1",
                      active && "ring-1 ring-primary/40"
                    )}
                    title={`Energia ${label}`}
                  >
                    <Icon className={cn("h-3.5 w-3.5", !active && tint)} />
                    {label}
                  </Button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEodOpen(true)}
              className="w-full h-7 text-[11px] gap-1"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Como foi meu dia?
            </Button>
          </div>
        </div>
      </Card>

      <FimDeDiaDialog open={eodOpen} onOpenChange={setEodOpen} />
    </>
  );
}
