import { supabase } from "@/integrations/supabase/client";
import { ClassAvatar } from "./ClassAvatar";
import { Users, Flame, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Props {
  companyId: string | null;
  currentUserId: string | null;
}

interface Member {
  user_id: string;
  full_name: string;
  level: number;
  xp_total: number;
  streak_days: number;
  player_class: string;
  last_activity_date: string | null;
}

export function TeamLobbyPanel({ companyId, currentUserId }: Props) {
  const { data: members = [] } = useQuery({
    queryKey: ["team-lobby", companyId],
    enabled: !!companyId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("prospecting_player_profile")
        .select("user_id, level, xp_total, streak_days, class, last_activity_date")
        .eq("company_id", companyId!)
        .order("xp_total", { ascending: false });
      const ids = (profiles || []).map((p: any) => p.user_id);
      if (ids.length === 0) return [];
      const { data: pr } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const names = Object.fromEntries((pr || []).map((p: any) => [p.id, p.full_name || "Vendedor"]));
      return (profiles || []).map((p: any) => ({
        ...p,
        player_class: p.class,
        full_name: names[p.user_id] || "Vendedor",
      })) as Member[];
    },
  });

  const isOnline = (m: Member) => {
    if (!m.last_activity_date) return false;
    const last = new Date(m.last_activity_date);
    return Date.now() - last.getTime() < 24 * 60 * 60 * 1000;
  };

  const onlineCount = members.filter(isOnline).length;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Equipe</h3>
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 rpg-pulse-dot" />
          {onlineCount}/{members.length} ativos
        </div>
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum vendedor cadastrado.</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {members.map((m) => {
            const online = isOnline(m);
            const isMe = m.user_id === currentUserId;
            return (
              <div
                key={m.user_id}
                className={`flex items-center gap-2 p-2 rounded-md border ${isMe ? "border-primary bg-primary/5" : "border-border bg-background/40"} ${!online ? "opacity-60" : ""}`}
              >
                <ClassAvatar name={m.full_name} playerClass={m.player_class} size="sm" online={online} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate text-foreground">
                    {m.full_name} {isMe && <span className="text-primary text-[9px]">(você)</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-1.5 items-center">
                    <span className="text-primary">Nv {m.level}</span>
                    <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" />{m.xp_total.toLocaleString()}</span>
                    {m.streak_days > 0 && (
                      <span className="flex items-center gap-0.5 text-orange-500"><Flame className="w-2.5 h-2.5" />{m.streak_days}</span>
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
