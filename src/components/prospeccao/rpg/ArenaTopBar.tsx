import { useLeaderboard } from "@/hooks/useLeaderboard";
import { Trophy, Crown, Medal, Award, Flame, TrendingUp } from "lucide-react";
import { ClassAvatar } from "./ClassAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface Props {
  companyId: string | null;
  currentUserId: string | null;
}

interface RowExt {
  user_id: string;
  full_name: string;
  level: number;
  xp_total: number;
  streak_days: number;
  coins: number;
  player_class?: string;
}

export function ArenaTopBar({ companyId, currentUserId }: Props) {
  const { data: rows = [], isLoading } = useLeaderboard(companyId, 50);
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

  const top3 = rows.slice(0, 3) as RowExt[];
  const myIndex = rows.findIndex((r) => r.user_id === currentUserId);
  const me = myIndex >= 0 ? rows[myIndex] : null;

  if (isLoading) return <div className="h-32 bg-card border border-border rounded-lg animate-pulse" />;
  if (top3.length === 0) return null;

  const PODIUM = [
    { icon: Crown, color: "text-amber-500", cls: "rpg-podium-1", label: "1º lugar" },
    { icon: Medal, color: "text-slate-400", cls: "rpg-podium-2", label: "2º lugar" },
    { icon: Award, color: "text-orange-700 dark:text-orange-400", cls: "rpg-podium-3", label: "3º lugar" },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Top Performers da Semana</h3>
        </div>
        {me && (
          <div className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/40">
            <span className="text-muted-foreground">Sua posição:</span>
            <span className="text-primary font-bold text-base">#{myIndex + 1}</span>
            <span className="text-muted-foreground">de {rows.length}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top3.map((r, i) => {
          const P = PODIUM[i];
          const Icon = P.icon;
          const isMe = r.user_id === currentUserId;
          return (
            <div
              key={r.user_id}
              className={`${P.cls} rounded-lg p-3 flex items-center gap-3 relative`}
            >
              <Icon className={`absolute top-2 right-2 w-4 h-4 ${P.color}`} />
              <ClassAvatar
                name={r.full_name}
                playerClass={classes[r.user_id]}
                size="lg"
                level={r.level}
                online
              />
              <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-semibold ${P.color}`}>{P.label}</span>
                  {isMe && <span className="text-[10px] text-primary font-medium">(você)</span>}
                </div>
                <div className="text-sm font-semibold truncate text-foreground">{r.full_name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {r.xp_total.toLocaleString()} pts
                  </span>
                  {r.streak_days > 0 && (
                    <span className="flex items-center gap-1 text-orange-500">
                      <Flame className="w-3 h-3" />
                      {r.streak_days}d
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
