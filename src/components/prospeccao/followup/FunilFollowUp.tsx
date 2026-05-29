import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Filter, Phone, Mail } from "lucide-react";
import { useFollowUpEsteira, FollowUpEntry } from "@/hooks/useFollowUpEsteira";
import { useFollowUpFunnel, FollowUpStage } from "@/hooks/useFollowUpFunnel";
import { StageManagerDialog } from "./StageManagerDialog";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";
import { followUpFunnelLabel } from "@/lib/clinicaLabels";

function FunnelCard({ entry }: { entry: FollowUpEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id });

  const overdue =
    entry.status === "active" && new Date(entry.next_due_at).getTime() <= Date.now();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing transition ${
        isDragging ? "opacity-50" : "hover:border-primary/50"
      } ${overdue ? "border-destructive/50" : ""}`}
    >
      <p className="font-medium text-sm truncate">{entry.contact_name || "Sem nome"}</p>
      {entry.contact_phone && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <Phone className="h-3 w-3" /> {entry.contact_phone}
        </p>
      )}
      {entry.contact_email && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <Mail className="h-3 w-3" /> {entry.contact_email}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">F{entry.current_step}</Badge>
        {overdue && (
          <Badge className="bg-destructive text-destructive-foreground text-[10px]">vencido</Badge>
        )}
        {entry.status !== "active" && (
          <Badge variant="secondary" className="text-[10px]">
            {entry.status === "completed" ? "Ganho" : entry.status === "lost" ? "Perdido" : entry.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

function StageColumn({ stage, entries }: { stage: FollowUpStage; entries: FollowUpEntry[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="w-72 flex-shrink-0">
      <div
        className="rounded-md px-3 py-2 mb-2 border"
        style={{ backgroundColor: `${stage.color}20`, borderColor: `${stage.color}60` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <p className="text-sm font-semibold truncate">{stage.name}</p>
            {stage.is_terminal && (
              <Badge variant="outline" className="text-[9px]">terminal</Badge>
            )}
          </div>
          <span className="text-xs font-bold">{entries.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-md p-1 transition ${
          isOver ? "bg-primary/10 ring-2 ring-primary/30" : ""
        }`}
      >
        {entries.map((e) => (
          <FunnelCard key={e.id} entry={e} />
        ))}
        {!entries.length && (
          <p className="text-xs text-muted-foreground text-center py-6">—</p>
        )}
      </div>
    </div>
  );
}

export function FunilFollowUp() {
  const { entries, isLoading: loadingEntries } = useFollowUpEsteira();
  const { stages, isLoading: loadingFunnel, moveEntry } = useFollowUpFunnel();
  const { isClinica } = useCompanySegmento();
  const [managerOpen, setManagerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const stageEntries = useMemo(() => {
    const map = new Map<string | "unassigned", FollowUpEntry[]>();
    stages.forEach((s) => map.set(s.id, []));
    map.set("unassigned", []);
    const filtered = showOnlyOverdue
      ? entries.filter(
          (e) => e.status === "active" && new Date(e.next_due_at).getTime() <= Date.now()
        )
      : entries;
    filtered.forEach((e) => {
      const key = e.stage_id || "unassigned";
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [entries, stages, showOnlyOverdue]);

  const activeEntry = activeId ? entries.find((e) => e.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const entryId = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    if (!stageId) return;
    const entry = entries.find((x) => x.id === entryId);
    if (!entry || entry.stage_id === stageId) return;
    moveEntry.mutate({ entryId, stageId });
  };

  const unassigned = stageEntries.get("unassigned") || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {followUpFunnelLabel(isClinica)}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Arraste os cards entre as etapas. Mover para uma etapa terminal finaliza o {isClinica ? "pós-consulta" : "follow"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showOnlyOverdue ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyOverdue((v) => !v)}
          >
            <Filter className="h-3 w-3 mr-1" /> Só vencidos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
            <Settings className="h-3 w-3 mr-1" /> Etapas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(loadingEntries || loadingFunnel) && (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        )}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {unassigned.length > 0 && (
                <StageColumn
                  stage={{
                    id: "unassigned",
                    funnel_id: "",
                    company_id: "",
                    name: "Sem etapa",
                    color: "#64748B",
                    order_index: -1,
                    is_terminal: false,
                    terminal_status: null,
                  }}
                  entries={unassigned}
                />
              )}
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  entries={stageEntries.get(stage.id) || []}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeEntry ? <FunnelCard entry={activeEntry} /> : null}
          </DragOverlay>
        </DndContext>
      </CardContent>

      <StageManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </Card>
  );
}
