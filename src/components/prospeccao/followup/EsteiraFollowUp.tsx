import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Zap, Star, Snowflake, MailQuestion, Hand, Phone, Mail, MessageCircle, Instagram } from "lucide-react";
import { useFollowUpEsteira, FollowUpEntry } from "@/hooks/useFollowUpEsteira";
import { ExecutarFollowDialog } from "./ExecutarFollowDialog";
import { AddToEsteiraDialog } from "./AddToEsteiraDialog";

const sourceMeta: Record<FollowUpEntry["source"], { label: string; icon: any; cls: string }> = {
  favorite: { label: "Favorito", icon: Star, cls: "bg-amber-500/10 text-amber-500" },
  no_response: { label: "Sem resposta", icon: MailQuestion, cls: "bg-orange-500/10 text-orange-500" },
  cold_lead: { label: "Frio", icon: Snowflake, cls: "bg-blue-500/10 text-blue-500" },
  manual: { label: "Manual", icon: Hand, cls: "bg-muted text-muted-foreground" },
};

function daysSince(iso: string | null) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function isOverdue(entry: FollowUpEntry) {
  return new Date(entry.next_due_at).getTime() <= Date.now();
}

function EntryCard({ entry, onExecute, onRemove }: { entry: FollowUpEntry; onExecute: () => void; onRemove: () => void }) {
  const SrcIcon = sourceMeta[entry.source].icon;
  const overdue = isOverdue(entry) && entry.status === "active";
  const ageDays = daysSince(entry.last_executed_at || entry.created_at);

  return (
    <div className={`group rounded-lg border bg-card p-3 space-y-2 transition hover:border-primary/50 ${overdue ? "border-destructive/50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{entry.contact_name || "Sem nome"}</p>
          {entry.contact_phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {entry.contact_phone}
            </p>
          )}
          {entry.contact_email && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" /> {entry.contact_email}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className={`text-[10px] ${sourceMeta[entry.source].cls}`}>
          <SrcIcon className="h-3 w-3 mr-1" />
          {sourceMeta[entry.source].label}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          F{entry.current_step} • {ageDays}d
        </Badge>
        {overdue && <Badge className="bg-destructive text-destructive-foreground text-[10px]">vencido</Badge>}
      </div>

      {entry.status === "active" && (
        <Button size="sm" className="w-full h-7 text-xs" onClick={onExecute}>
          <Zap className="h-3 w-3 mr-1" /> Executar follow
        </Button>
      )}
      {entry.status !== "active" && (
        <Badge variant="outline" className="w-full justify-center text-[10px]">
          {entry.status === "completed" ? "✓ Concluído" : entry.status === "lost" ? "Perdido" : entry.status === "cooled" ? "Esfriou" : "Pausado"}
          {entry.outcome ? ` • ${entry.outcome}` : ""}
        </Badge>
      )}
    </div>
  );
}

export function EsteiraFollowUp() {
  const { entries, cadence, isLoading, executeFollow, removeEntry } = useFollowUpEsteira();
  const [executingEntry, setExecutingEntry] = useState<FollowUpEntry | null>(null);

  const overdueEntries = useMemo(
    () => entries.filter((e) => e.status === "active" && isOverdue(e)),
    [entries]
  );

  const byStep = useMemo(() => {
    const map = new Map<number, FollowUpEntry[]>();
    cadence.forEach((c) => map.set(c.step_number, []));
    entries
      .filter((e) => e.status === "active" && !isOverdue(e))
      .forEach((e) => {
        const arr = map.get(e.current_step) || [];
        arr.push(e);
        map.set(e.current_step, arr);
      });
    return map;
  }, [entries, cadence]);

  const concluded = useMemo(
    () => entries.filter((e) => e.status !== "active").slice(0, 30),
    [entries]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Esteira de Follow-up
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Cadência: {cadence.map((c) => `F${c.step_number} D+${c.days_offset}`).join(" → ")}
          </p>
        </div>
        <AddToEsteiraDialog />
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {/* A executar (vencidos) */}
            <div className="w-64 flex-shrink-0">
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 mb-2">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <Zap className="h-3 w-3" /> A EXECUTAR HOJE
                </p>
                <p className="text-2xl font-bold text-destructive">{overdueEntries.length}</p>
              </div>
              <div className="space-y-2">
                {overdueEntries.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    onExecute={() => setExecutingEntry(e)}
                    onRemove={() => removeEntry.mutate(e.id)}
                  />
                ))}
                {!overdueEntries.length && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum follow vencido 🎉</p>
                )}
              </div>
            </div>

            {/* Colunas por etapa */}
            {cadence.map((step) => {
              const list = byStep.get(step.step_number) || [];
              return (
                <div key={step.id} className="w-64 flex-shrink-0">
                  <div className="rounded-md bg-muted/50 px-3 py-2 mb-2">
                    <p className="text-xs font-semibold">{step.label}</p>
                    <p className="text-2xl font-bold">{list.length}</p>
                  </div>
                  <div className="space-y-2">
                    {list.map((e) => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        onExecute={() => setExecutingEntry(e)}
                        onRemove={() => removeEntry.mutate(e.id)}
                      />
                    ))}
                    {!list.length && (
                      <p className="text-xs text-muted-foreground text-center py-4">—</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Concluídos */}
            <div className="w-64 flex-shrink-0">
              <div className="rounded-md bg-primary/10 border border-primary/30 px-3 py-2 mb-2">
                <p className="text-xs font-semibold text-primary">CONCLUÍDOS / FINALIZADOS</p>
                <p className="text-2xl font-bold text-primary">{concluded.length}</p>
              </div>
              <div className="space-y-2">
                {concluded.map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    onExecute={() => {}}
                    onRemove={() => removeEntry.mutate(e.id)}
                  />
                ))}
                {!concluded.length && (
                  <p className="text-xs text-muted-foreground text-center py-4">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <ExecutarFollowDialog
        open={!!executingEntry}
        onOpenChange={(v) => !v && setExecutingEntry(null)}
        entry={executingEntry}
      />
    </Card>
  );
}
