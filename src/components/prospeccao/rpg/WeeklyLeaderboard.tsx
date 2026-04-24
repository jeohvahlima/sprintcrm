import { useLeaderboard } from "@/hooks/useLeaderboard";
import { Trophy, Flame } from "lucide-react";
import { getRankByLevel } from "@/hooks/usePlayerProfile";
import { ClassAvatar } from "./ClassAvatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  companyId: string | null;
  currentUserId: string | null;
}

const PODIUM_COLOR = ["rpg-rank-gold", "rpg-rank-silver", "rpg-rank-bronze"];

export function WeeklyLeaderboard({ companyId, currentUserId }: Props) {
  const { data: rows = [], isLoading } = useLeaderboard(companyId, 10);
  const [classes, setClasses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!companyId || rows.length === 0) return;
    (async () => {
      const ids = rows.map((r) => r.user_id);
      const { data } = await supabase
        .from("prospecting_player_profile")
        .select("user_id, class")
        .in("user_id", ids)
        .eq("company_id", companyId);
      if (data) setClasses(Object.fromEntries(data.map((d: any) => [d.user_id, d.class])));
    })();
  }, [companyId, rows.length]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Ranking da Equipe</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => {
            const rank = getRankByLevel(r.level);
            const isMe = r.user_id === currentUserId;
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-2 p-2 rounded-md border ${isMe ? "border-primary bg-primary/5" : "border-border bg-background/30"}`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border shrink-0 ${i < 3 ? PODIUM_COLOR[i] : "border-border text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <ClassAvatar name={r.full_name} playerClass={classes[r.user_id]} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.full_name} {isMe && <span className="text-primary text-[10px] font-medium">(você)</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    <span className={rank.className}>Nível {r.level}</span>
                    <span>·</span>
                    <span>{r.xp_total.toLocaleString()} pts</span>
                    {r.streak_days > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-orange-500 flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" />{r.streak_days}</span>
                      </>
                    )}
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
