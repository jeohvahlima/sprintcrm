import { PlayerProfile, xpNeededForLevel, getRankByLevel } from "@/hooks/usePlayerProfile";
import { Flame, Gem, Zap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  profile: PlayerProfile | null | undefined;
  onShowAchievements: () => void;
  onShowRanks: () => void;
}

const CLASSES: Record<string, string> = {
  hunter: "HUNTER",
  closer: "CLOSER",
  farmer: "FARMER",
  ranger: "RANGER",
};

export function PlayerHeaderCard({ profile, onShowAchievements, onShowRanks }: Props) {
  if (!profile) {
    return (
      <div className="rpg-card rounded-lg p-6 rpg-grid-bg animate-pulse h-32" />
    );
  }
  const needed = xpNeededForLevel(profile.level);
  const pct = Math.min(100, Math.round((profile.xp_current / needed) * 100));
  const rank = getRankByLevel(profile.level);

  return (
    <div className="rpg-card rounded-lg p-5 rpg-grid-bg relative overflow-hidden rpg-scanline">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
        {/* Avatar + level */}
        <div className="relative">
          <div className={`w-20 h-20 rounded-lg border-2 ${rank.className} flex items-center justify-center bg-background/40 rpg-glow-cyan rpg-text-mono text-3xl font-bold`}>
            {profile.level}
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] rpg-text-mono uppercase tracking-wider rounded border ${rank.className} bg-background`}>
            {rank.name}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="rpg-neon-cyan rpg-text-mono text-xs uppercase tracking-widest">
              [ {CLASSES[profile.class] || "OPERADOR"} ]
            </span>
            <h2 className="text-xl font-bold text-foreground">
              {profile.title || "Iniciado"}
            </h2>
          </div>

          {/* XP bar */}
          <div className="mt-3">
            <div className="flex justify-between rpg-text-mono text-xs mb-1">
              <span className="rpg-neon-cyan">XP</span>
              <span className="text-muted-foreground">
                {profile.xp_current.toLocaleString()} / {needed.toLocaleString()}
              </span>
            </div>
            <div className="h-3 rounded bg-background/60 border border-border overflow-hidden">
              <div className="rpg-xp-bar h-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap rpg-text-mono text-sm">
            <Stat icon={<Zap className="w-4 h-4" />} label="XP TOTAL" value={profile.xp_total.toLocaleString()} color="rpg-neon-cyan" />
            <Stat icon={<Flame className="w-4 h-4" />} label="STREAK" value={`${profile.streak_days}d`} color="text-orange-400" />
            <Stat icon={<Gem className="w-4 h-4" />} label="MOEDAS" value={profile.coins.toLocaleString()} color="rpg-neon-magenta" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex md:flex-col gap-2">
          <Button size="sm" variant="outline" onClick={onShowAchievements} className="border-cyan-500/50 hover:bg-cyan-500/10">
            <Trophy className="w-4 h-4 mr-1" /> Conquistas
          </Button>
          <Button size="sm" variant="outline" onClick={onShowRanks} className="border-fuchsia-500/50 hover:bg-fuchsia-500/10">
            Ranks
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
