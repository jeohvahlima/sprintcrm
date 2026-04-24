import { ActiveQuest, useActiveQuests } from "@/hooks/useActiveQuests";
import { Button } from "@/components/ui/button";
import { Crosshair, MessageCircle, Calendar, Radar, Trophy, Gem, Target, Sparkles } from "lucide-react";

interface Props {
  userId: string | null;
  companyId: string | null;
}

const ICONS: Record<string, any> = {
  crosshair: Crosshair,
  "message-circle": MessageCircle,
  calendar: Calendar,
  radar: Radar,
  trophy: Trophy,
  gem: Gem,
  target: Target,
};

const TYPE_LABEL: Record<string, string> = {
  daily: "DIÁRIA",
  weekly: "SEMANAL",
  monthly: "MENSAL",
  special: "ESPECIAL",
};

const TYPE_COLOR: Record<string, string> = {
  daily: "rpg-neon-cyan border-cyan-500/40",
  weekly: "rpg-neon-violet border-violet-500/40",
  monthly: "rpg-neon-magenta border-fuchsia-500/40",
  special: "text-amber-400 border-amber-500/40",
};

export function QuestBoard({ userId, companyId }: Props) {
  const { data: quests = [], isLoading, claim } = useActiveQuests(userId, companyId);

  // Group: claimable first, then in-progress, then completed-claimed
  const sorted = [...quests].sort((a, b) => {
    const aClaim = a.completed_at && !a.claimed_at ? 0 : !a.completed_at ? 1 : 2;
    const bClaim = b.completed_at && !b.claimed_at ? 0 : !b.completed_at ? 1 : 2;
    return aClaim - bClaim;
  });

  return (
    <div className="rpg-card rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 rpg-neon-cyan" />
        <h3 className="rpg-text-mono text-sm uppercase tracking-wider rpg-neon-cyan">Missões Ativas</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground rpg-text-mono">Nenhuma missão ativa.</p>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {sorted.map((q) => <QuestRow key={q.quest_id + q.period_start} q={q} onClaim={() => claim.mutate(q.progress_id!)} />)}
        </div>
      )}
    </div>
  );
}

function QuestRow({ q, onClaim }: { q: ActiveQuest; onClaim: () => void }) {
  const Icon = ICONS[q.icon || "target"] || Target;
  const pct = Math.min(100, Math.round((q.current_value / q.goal_value) * 100));
  const claimable = !!q.completed_at && !q.claimed_at;
  const claimed = !!q.claimed_at;

  return (
    <div className={`p-2.5 rounded border bg-background/40 ${claimed ? "opacity-50" : ""} ${claimable ? "border-cyan-400 rpg-pulse" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 rpg-neon-cyan shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{q.name}</span>
        <span className={`rpg-text-mono text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[q.type]}`}>
          {TYPE_LABEL[q.type]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-background border border-border rounded overflow-hidden">
          <div className={`h-full ${claimable ? "rpg-xp-bar" : "bg-cyan-500/60"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="rpg-text-mono text-[10px] text-muted-foreground tabular-nums">
          {Math.floor(q.current_value).toLocaleString()}/{q.goal_value.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="rpg-text-mono text-[10px] rpg-neon-cyan">+{q.xp_reward} XP · +{q.coin_reward} 💎</span>
        {claimable ? (
          <Button size="sm" onClick={onClaim} className="h-6 px-2 text-[10px] rpg-text-mono bg-cyan-500 hover:bg-cyan-400 text-background rpg-glow-cyan">
            RESGATAR
          </Button>
        ) : claimed ? (
          <span className="text-[10px] rpg-text-mono text-emerald-400">✓ RESGATADA</span>
        ) : null}
      </div>
    </div>
  );
}
