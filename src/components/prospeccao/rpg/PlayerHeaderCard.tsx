import { PlayerProfile, xpNeededForLevel, getRankByLevel } from "@/hooks/usePlayerProfile";
import { Flame, Coins, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ClassAvatar } from "./ClassAvatar";

interface Props {
  profile: PlayerProfile | null | undefined;
  onShowAchievements: () => void;
  onShowRanks: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  hunter: "SDR",
  closer: "Closer",
  farmer: "Farmer",
  ranger: "Account",
};

export function PlayerHeaderCard({ profile, onShowAchievements, onShowRanks }: Props) {
  if (!profile) {
    return <div className="bg-card border border-border rounded-lg p-6 animate-pulse h-32" />;
  }
  const needed = xpNeededForLevel(profile.level);
  const pct = Math.min(100, Math.round((profile.xp_current / needed) * 100));
  const rank = getRankByLevel(profile.level);

  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
        <div className="relative">
          <ClassAvatar
            name={profile.title || "Vendedor"}
            playerClass={profile.class}
            size="xl"
            level={profile.level}
            online
          />
          <div
            className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium rounded border ${rank.className} bg-background whitespace-nowrap`}
          >
            {rank.name}
          </div>
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-primary font-semibold">
              {ROLE_LABEL[profile.class] || "Vendedor"}
            </span>
            <h2 className="text-xl font-semibold text-foreground">
              {profile.title || "Iniciante"}
            </h2>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground font-medium">Progresso do Nível</span>
              <span className="text-muted-foreground tabular-nums">
                {profile.xp_current.toLocaleString()} / {needed.toLocaleString()} pts
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          <div className="flex items-center gap-5 mt-4 flex-wrap text-sm">
            <Stat icon={<TrendingUp className="w-4 h-4" />} label="Pontos totais" value={profile.xp_total.toLocaleString()} />
            <Stat icon={<Flame className="w-4 h-4 text-orange-500" />} label="Sequência" value={`${profile.streak_days}d`} />
            <Stat icon={<Coins className="w-4 h-4 text-amber-500" />} label="Moedas" value={profile.coins.toLocaleString()} />
          </div>
        </div>

        <div className="flex md:flex-col gap-2">
          <Button size="sm" variant="outline" onClick={onShowAchievements}>
            <Trophy className="w-4 h-4 mr-1" /> Conquistas
          </Button>
          <Button size="sm" variant="outline" onClick={onShowRanks}>
            Carreira
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
