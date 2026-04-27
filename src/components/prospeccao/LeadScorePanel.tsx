import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Thermometer, Snowflake, RefreshCw } from "lucide-react";
import { useLeadScores } from "@/hooks/useProspectingIntelligence";
import { Skeleton } from "@/components/ui/skeleton";

const TEMP_META: Record<string, { icon: any; color: string; label: string }> = {
  quente: { icon: Flame, color: "text-rose-500 bg-rose-500/10 border-rose-500/30", label: "Quente" },
  morno: { icon: Thermometer, color: "text-amber-500 bg-amber-500/10 border-amber-500/30", label: "Morno" },
  frio: { icon: Snowflake, color: "text-sky-500 bg-sky-500/10 border-sky-500/30", label: "Frio" },
};

export function LeadScorePanel() {
  const [filter, setFilter] = useState<"all" | "quente" | "morno" | "frio">("all");
  const { data, isLoading, refetch } = useLeadScores({
    temperature: filter === "all" ? undefined : filter,
    limit: 50,
  });

  const counts = (data || []).reduce((a: any, l: any) => {
    a[l.temperature] = (a[l.temperature] || 0) + 1;
    return a;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Priorização de Leads (IA)</CardTitle>
            <CardDescription>Leads classificados por ICP fit + engajamento.</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {(["all", "quente", "morno", "frio"] as const).map((t) => (
            <Button key={t} size="sm" variant={filter === t ? "default" : "outline"} onClick={() => setFilter(t)} className="h-7 text-xs">
              {t === "all" ? "Todos" : TEMP_META[t]?.label}
              {t !== "all" && counts[t] > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{counts[t]}</Badge>}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <p>Nenhum lead classificado ainda.</p>
            <p className="text-xs mt-1">Configure seu ICP para iniciar a priorização automática.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {data.map((s: any) => {
              const meta = TEMP_META[s.temperature] || TEMP_META.frio;
              const Icon = meta.icon;
              return (
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${meta.color}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.leads?.name || "Lead"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.leads?.email || s.leads?.phone || "—"} · ICP {s.icp_score} · Engajamento {s.engagement_score}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{s.total_score}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
