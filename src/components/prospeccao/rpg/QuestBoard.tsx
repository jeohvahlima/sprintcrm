import { ActiveQuest, useActiveQuests } from "@/hooks/useActiveQuests";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Phone, MessageCircle, Calendar, Search, Trophy, Coins, Target, CheckCircle2 } from "lucide-react";

interface Props {
  userId: string | null;
  companyId: string | null;
}

const ICONS: Record<string, any> = {
  crosshair: Phone,
  "message-circle": MessageCircle,
  calendar: Calendar,
  radar: Search,
  trophy: Trophy,
  gem: Coins,
  target: Target,
};

const TYPE_LABEL: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  special: "Especial",
};

const TYPE_BADGE: Record<string, string> = {
  daily: "bg-primary/10 text-primary border-primary/30",
  weekly: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  monthly: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  special: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30",
};

export function QuestBoard({ userId, companyId }: Props) {
  const { data: quests = [], isLoading, claim } = useActiveQuests(userId, companyId);

  const sorted = [...quests].sort((a, b) => {
    const aClaim = a.completed_at && !a.claimed_at ? 0 : !a.completed_at ? 1 : 2;
    const bClaim = b.completed_at && !b.claimed_at ? 0 : !b.completed_at ? 1 : 2;
    return aClaim - bClaim;
  });

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Metas e Desafios</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma meta ativa.</p>
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
    <div className={`p-2.5 rounded-md border bg-background/40 ${claimed ? "opacity-50" : ""} ${claimable ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1 truncate">{q.name}</span>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${TYPE_BADGE[q.type]}`}>
          {TYPE_LABEL[q.type]}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {Math.floor(q.current_value).toLocaleString()}/{q.goal_value.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">+{q.xp_reward} pts · +{q.coin_reward} moedas</span>
        {claimable ? (
          <Button size="sm" onClick={onClaim} className="h-6 px-2 text-[10px]">
            Resgatar
          </Button>
        ) : claimed ? (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Resgatada</span>
        ) : null}
      </div>
    </div>
  );
}
