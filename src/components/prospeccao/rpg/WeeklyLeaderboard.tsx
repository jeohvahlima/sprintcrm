import { useLeaderboard } from "@/hooks/useLeaderboard";
import { Trophy, Flame } from "lucide-react";
import { getRankByLevel } from "@/hooks/usePlayerProfile";

interface Props {
  companyId: string | null;
  currentUserId: string | null;
}

const PODIUM_COLOR = ["rpg-rank-gold rpg-glow-gold", "rpg-rank-silver", "rpg-rank-bronze"];

export function WeeklyLeaderboard({ companyId, currentUserId }: Props) {
  const { data: rows = [], isLoading } = useLeaderboard(companyId, 10);

  return (
    <div className="rpg-card rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="rpg-text-mono text-sm uppercase tracking-wider text-amber-400">Arena · Top Operadores</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground rpg-text-mono">Nenhum jogador ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => {
            const rank = getRankByLevel(r.level);
            const isMe = r.user_id === currentUserId;
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-2 p-2 rounded border ${isMe ? "border-cyan-400 bg-cyan-500/5 rpg-glow-cyan" : "border-border bg-background/30"}`}
              >
                <div className={`w-7 h-7 rounded flex items-center justify-center rpg-text-mono text-xs font-bold border ${i < 3 ? PODIUM_COLOR[i] : "border-border text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.full_name} {isMe && <span className="rpg-neon-cyan text-[10px]">[VOCÊ]</span>}</div>
                  <div className="rpg-text-mono text-[10px] text-muted-foreground flex gap-2">
                    <span className={rank.className}>Nv {r.level}</span>
                    <span>·</span>
                    <span>{r.xp_total.toLocaleString()} XP</span>
                    {r.streak_days > 0 && <><span>·</span><span className="text-orange-400 flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" />{r.streak_days}</span></>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
