import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Zap, Target, Calendar, MessageCircle } from "lucide-react";

interface FeedItem {
  id: string;
  icon: any;
  message: string;
  color: string;
  ts: number;
}

interface Props {
  companyId: string | null;
  enableSound?: boolean;
}

const ACTION_META: Record<string, { icon: any; verb: string; color: string; xp?: number }> = {
  sale_closed: { icon: Trophy, verb: "fechou venda", color: "text-amber-500", xp: 100 },
  meeting_scheduled: { icon: Calendar, verb: "agendou reunião", color: "text-primary", xp: 30 },
  proposal_sent: { icon: Target, verb: "enviou proposta", color: "text-purple-500", xp: 20 },
  response_received: { icon: MessageCircle, verb: "recebeu resposta", color: "text-emerald-500", xp: 5 },
  followup_sent: { icon: Zap, verb: "fez follow-up", color: "text-blue-500", xp: 2 },
};

function playBeep(freq = 800) {
  try {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function KillFeed({ companyId, enableSound = false }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const namesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`activity-feed-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prospecting_interactions",
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          const row: any = payload.new;
          if (!row || seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);

          const meta = ACTION_META[row.action_type as string];
          if (!meta) return;

          let name = namesRef.current[row.user_id];
          if (!name) {
            const { data } = await supabase.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
            name = (data as any)?.full_name || "Vendedor";
            namesRef.current[row.user_id] = name;
          }

          const xp = meta.xp ?? 0;
          const item: FeedItem = {
            id: row.id,
            icon: meta.icon,
            message: `${name} ${meta.verb}${xp ? ` · +${xp} pts` : ""}`,
            color: meta.color,
            ts: Date.now(),
          };
          setItems((prev) => [item, ...prev].slice(0, 5));
          if (enableSound) playBeep(row.action_type === "sale_closed" ? 1200 : 700);

          setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, enableSound]);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="rpg-killfeed bg-card border border-border rounded-md px-3 py-2 flex items-center gap-2 shadow-lg"
          >
            <Icon className={`w-4 h-4 ${item.color}`} />
            <span className="text-xs text-foreground">{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}
