import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scale, Gavel, Calendar, DollarSign, User, GripVertical } from "lucide-react";

interface LegalProcess {
  id: string;
  numero_processo: string | null;
  tipo: string;
  status: string;
  parte_contraria: string | null;
  vara: string | null;
  comarca: string | null;
  valor_causa: number | null;
  data_audiencia: string | null;
  lead_id: string | null;
  lead_name?: string;
  prioridade: string | null;
}

const KANBAN_COLUMNS = [
  { id: "em_andamento", label: "Em Andamento", color: "hsl(210, 80%, 55%)", borderColor: "border-blue-500/30" },
  { id: "aguardando_audiencia", label: "Ag. Audiência", color: "hsl(40, 90%, 55%)", borderColor: "border-amber-500/30" },
  { id: "aguardando_pericia", label: "Ag. Perícia", color: "hsl(270, 60%, 55%)", borderColor: "border-purple-500/30" },
  { id: "suspenso", label: "Suspenso", color: "hsl(0, 0%, 60%)", borderColor: "border-gray-500/30" },
  { id: "ganho", label: "Ganho", color: "hsl(142, 70%, 45%)", borderColor: "border-green-500/30" },
  { id: "perdido", label: "Perdido", color: "hsl(0, 70%, 50%)", borderColor: "border-red-500/30" },
  { id: "arquivado", label: "Arquivado", color: "hsl(220, 10%, 70%)", borderColor: "border-gray-400/30" },
];

const TIPO_LABELS: Record<string, string> = {
  civil: "Civil",
  trabalhista: "Trabalhista",
  criminal: "Criminal",
  tributario: "Tributário",
  administrativo: "Administrativo",
  comercial: "Comercial / Empresarial",
  previdenciario: "Previdenciário",
  familia: "Família e Sucessões",
  consumidor: "Direito do Consumidor",
  imobiliario: "Imobiliário",
  contratual: "Contratual",
  bancario: "Bancário / Financeiro",
  ambiental: "Ambiental",
  eleitoral: "Eleitoral",
  juizado_especial: "Juizado Especial (JEC)",
  execucao_fiscal: "Execução Fiscal",
  recuperacao_judicial: "Recuperação Judicial / Falência",
  arbitragem: "Arbitragem",
  regulatorio: "Regulatório / Concorrencial",
  internacional: "Internacional",
  militar: "Militar",
  outro: "Outro",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-500/10 text-red-600 border-red-500/20",
  media: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  baixa: "bg-green-500/10 text-green-600 border-green-500/20",
};

// ── Droppable Column ──
function KanbanColumn({ column, processes, children }: {
  column: typeof KANBAN_COLUMNS[0];
  processes: LegalProcess[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] rounded-xl border bg-muted/30 transition-all ${
        isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
          <span className="text-sm font-semibold">{column.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">{processes.length}</Badge>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="p-2 space-y-2 min-h-[60px]">
          {children}
          {processes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum processo
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Draggable Card ──
function ProcessCard({ process, isDragging }: { process: LegalProcess; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: process.id,
    data: { process },
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    zIndex: 50,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border bg-card p-3 text-xs space-y-2 cursor-grab active:cursor-grabbing hover:border-primary/40 transition shadow-sm ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{process.numero_processo || "Sem nº"}</span>
        </div>
        {process.prioridade && (
          <Badge variant="outline" className={`text-[9px] px-1.5 ${PRIORIDADE_COLORS[process.prioridade] || ""}`}>
            {process.prioridade}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Gavel className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{TIPO_LABELS[process.tipo] || process.tipo}</span>
      </div>

      {process.parte_contraria && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">vs {process.parte_contraria}</span>
        </div>
      )}

      {process.lead_name && (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] truncate max-w-full">
            {process.lead_name}
          </Badge>
        </div>
      )}

      {process.data_audiencia && (
        <div className="flex items-center gap-1 text-amber-600">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>{format(new Date(process.data_audiencia), "dd/MM/yyyy", { locale: ptBR })}</span>
        </div>
      )}

      {process.valor_causa && Number(process.valor_causa) > 0 && (
        <div className="flex items-center gap-1 text-green-600">
          <DollarSign className="h-3 w-3 flex-shrink-0" />
          <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(process.valor_causa))}</span>
        </div>
      )}

      {process.vara && (
        <p className="text-[10px] text-muted-foreground truncate">🏛️ {process.vara}{process.comarca ? ` • ${process.comarca}` : ""}</p>
      )}
    </div>
  );
}

// ── Overlay Card (while dragging) ──
function ProcessCardOverlay({ process }: { process: LegalProcess }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-xs space-y-2 shadow-lg w-[260px] rotate-2">
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">{process.numero_processo || "Sem nº"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Gavel className="h-3 w-3" />
        <span>{TIPO_LABELS[process.tipo] || process.tipo}</span>
      </div>
    </div>
  );
}

// ── Main Kanban ──
export default function JuridicoKanban({ userCompanyId }: { userCompanyId: string | null }) {
  const [processes, setProcesses] = useState<LegalProcess[]>([]);
  const [activeProcess, setActiveProcess] = useState<LegalProcess | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchProcesses = useCallback(async () => {
    if (!userCompanyId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("legal_processes")
        .select("id, numero_processo, tipo, status, parte_contraria, vara, comarca, valor_causa, data_audiencia, lead_id, prioridade, lead:lead_id(name)")
        .eq("company_id", userCompanyId)
        .order("created_at", { ascending: false });

      const mapped = (data || []).map((p: any) => ({
        ...p,
        lead_name: p.lead?.name || null,
      }));
      setProcesses(mapped);
    } finally {
      setLoading(false);
    }
  }, [userCompanyId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const handleDragStart = (event: DragStartEvent) => {
    const proc = processes.find(p => p.id === event.active.id);
    setActiveProcess(proc || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveProcess(null);
    const { active, over } = event;
    if (!over) return;

    const processId = active.id as string;
    const newStatus = over.id as string;
    const process = processes.find(p => p.id === processId);
    if (!process || process.status === newStatus) return;

    // Optimistic update
    setProcesses(prev =>
      prev.map(p => p.id === processId ? { ...p, status: newStatus } : p)
    );

    const { error } = await supabase
      .from("legal_processes")
      .update({ status: newStatus })
      .eq("id", processId);

    if (error) {
      toast.error("Erro ao mover processo");
      // Revert
      setProcesses(prev =>
        prev.map(p => p.id === processId ? { ...p, status: process.status } : p)
      );
    } else {
      const colLabel = KANBAN_COLUMNS.find(c => c.id === newStatus)?.label || newStatus;
      toast.success(`Processo movido para "${colLabel}"`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Carregando quadro...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Gestão de Processos (Kanban)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="w-full">
            <div className="flex gap-3 px-4 pb-2 min-w-max">
              {KANBAN_COLUMNS.map(col => {
                const colProcesses = processes.filter(p => p.status === col.id);
                return (
                  <KanbanColumn key={col.id} column={col} processes={colProcesses}>
                    {colProcesses.map(proc => (
                      <ProcessCard
                        key={proc.id}
                        process={proc}
                        isDragging={activeProcess?.id === proc.id}
                      />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {activeProcess && <ProcessCardOverlay process={activeProcess} />}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}
