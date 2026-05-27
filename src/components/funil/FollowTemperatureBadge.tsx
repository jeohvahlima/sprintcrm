import { Flame, AlertTriangle, Snowflake, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  lastInteractionAt?: string | null;
  lastMovementAt?: string | null;
  leadScore?: number;
  followCount?: number;
  temperature?: string | null;
}

function diffHuman(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d sem resposta`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h sem resposta`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}min sem resposta`;
}

function classifyTemp(ref: string | null | undefined): "quente" | "morno" | "frio" | null {
  if (!ref) return null;
  const days = (Date.now() - new Date(ref).getTime()) / 86_400_000;
  if (days < 1) return "quente";
  if (days < 5) return "morno";
  return "frio";
}

export function FollowTemperatureBadge({ lastInteractionAt, lastMovementAt, leadScore, followCount, temperature }: Props) {
  const ref = lastInteractionAt ?? lastMovementAt ?? null;
  const temp = (temperature as any) ?? classifyTemp(ref);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {temp === "quente" && (
        <Badge variant="secondary" className="gap-1 bg-red-500/15 text-red-600 border-red-500/30 px-1.5 py-0">
          <Flame className="h-3 w-3" /> Quente
        </Badge>
      )}
      {temp === "morno" && (
        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30 px-1.5 py-0">
          <AlertTriangle className="h-3 w-3" /> Morno
        </Badge>
      )}
      {temp === "frio" && (
        <Badge variant="secondary" className="gap-1 bg-sky-500/15 text-sky-600 border-sky-500/30 px-1.5 py-0">
          <Snowflake className="h-3 w-3" /> Frio
        </Badge>
      )}
      {ref && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> {diffHuman(ref)}
        </span>
      )}
      {typeof leadScore === "number" && leadScore !== 0 && (
        <span className="text-muted-foreground">• score {leadScore}</span>
      )}
      {typeof followCount === "number" && followCount > 0 && (
        <span className="text-muted-foreground">• {followCount} follow{followCount > 1 ? "s" : ""}</span>
      )}
    </div>
  );
}
