import { useMemo } from "react";
import { format, parseISO, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, User } from "lucide-react";

interface Compromisso {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  titulo?: string;
  paciente?: string;
  observacoes?: string;
  lead?: { name: string; phone?: string };
  agenda?: { nome: string; tipo: string };
  profissional?: { nome: string; especialidade?: string };
}

interface AgendaDayViewProps {
  selectedDate: Date;
  compromissos: Compromisso[];
  onSelectCompromisso?: (compromisso: Compromisso) => void;
}

const HOUR_HEIGHT = 80;
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  agendado: { bg: "bg-blue-500/15", border: "border-l-blue-500", text: "text-blue-900 dark:text-blue-200", badge: "bg-blue-500" },
  concluido: { bg: "bg-green-500/15", border: "border-l-green-500", text: "text-green-900 dark:text-green-200", badge: "bg-green-500" },
  cancelado: { bg: "bg-red-500/15", border: "border-l-red-500", text: "text-red-900 dark:text-red-200", badge: "bg-red-500" },
  confirmado: { bg: "bg-emerald-500/15", border: "border-l-emerald-500", text: "text-emerald-900 dark:text-emerald-200", badge: "bg-emerald-500" },
};

const STATUS_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  agendado: { icon: <Clock className="h-3 w-3" />, label: "Agendado" },
  concluido: { icon: <CheckCircle2 className="h-3 w-3" />, label: "Concluído" },
  cancelado: { icon: <XCircle className="h-3 w-3" />, label: "Cancelado" },
};

/** Assign side-by-side columns to overlapping events */
function layoutEvents(events: Compromisso[]) {
  const sorted = [...events].sort((a, b) => {
    const diff = parseISO(a.data_hora_inicio).getTime() - parseISO(b.data_hora_inicio).getTime();
    if (diff !== 0) return diff;
    return parseISO(b.data_hora_fim).getTime() - parseISO(a.data_hora_fim).getTime();
  });

  type LayoutItem = { comp: Compromisso; col: number; numCols: number };
  const result: LayoutItem[] = [];
  const clusters: LayoutItem[][] = [];

  sorted.forEach(comp => {
    const s = parseISO(comp.data_hora_inicio).getTime();
    const e = parseISO(comp.data_hora_fim).getTime();

    // Find existing cluster that overlaps
    let addedToCluster = false;
    for (const cluster of clusters) {
      const clusterOverlaps = cluster.some(item => {
        const is = parseISO(item.comp.data_hora_inicio).getTime();
        const ie = parseISO(item.comp.data_hora_fim).getTime();
        return s < ie && e > is;
      });
      if (clusterOverlaps) {
        // Find available column in this cluster
        const usedCols = new Set(cluster.map(i => i.col));
        let col = 0;
        while (usedCols.has(col)) col++;
        const item = { comp, col, numCols: 0 };
        cluster.push(item);
        result.push(item);
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      const item = { comp, col: 0, numCols: 0 };
      clusters.push([item]);
      result.push(item);
    }
  });

  // Set numCols for each cluster
  clusters.forEach(cluster => {
    const maxCol = Math.max(...cluster.map(i => i.col)) + 1;
    cluster.forEach(item => { item.numCols = maxCol; });
  });

  return result;
}

export function AgendaDayView({ selectedDate, compromissos, onSelectCompromisso }: AgendaDayViewProps) {
  const dayCompromissos = useMemo(() => {
    return compromissos.filter(c => isSameDay(parseISO(c.data_hora_inicio), selectedDate));
  }, [compromissos, selectedDate]);

  const layoutItems = useMemo(() => layoutEvents(dayCompromissos), [dayCompromissos]);

  const now = new Date();
  const showTimeLine = isToday(selectedDate);
  const currentTimeTop = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours < START_HOUR || hours >= END_HOUR) return null;
    return (hours - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  }, []);

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b p-3">
          <div className={`text-lg font-semibold ${isToday(selectedDate) ? "text-primary" : ""}`}>
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="text-sm text-muted-foreground">
            {dayCompromissos.length} {dayCompromissos.length === 1 ? "compromisso" : "compromissos"}
          </div>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-[70px_1fr] relative">
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="border-b border-border/50 text-xs text-muted-foreground text-right pr-3 flex items-start justify-end"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="mt-[-8px]">{`${hour}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="relative border-l border-border/30">
            {/* Hour grid lines */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="border-b border-border/30"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Current time indicator */}
            {showTimeLine && currentTimeTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              </div>
            )}

            {/* Appointment blocks */}
            {layoutItems.map(({ comp, col, numCols }) => {
              const start = parseISO(comp.data_hora_inicio);
              const end = parseISO(comp.data_hora_fim);
              const startHour = start.getHours() + start.getMinutes() / 60;
              const endHour = end.getHours() + end.getMinutes() / 60;
              const top = Math.max(0, (startHour - START_HOUR) * HOUR_HEIGHT);
              const height = Math.max(30, (endHour - startHour) * HOUR_HEIGHT);
              const colors = STATUS_COLORS[comp.status] || STATUS_COLORS.agendado;
              const statusInfo = STATUS_LABELS[comp.status] || STATUS_LABELS.agendado;
              const title = comp.titulo || comp.tipo_servico;
              const clientName = comp.lead?.name || comp.paciente || "";

              const colWidth = 100 / numCols;
              const leftPct = col * colWidth;
              const gap = numCols > 1 ? 2 : 1;

              return (
                <div
                  key={comp.id}
                  className={`absolute rounded-lg border-l-4 px-3 py-2 cursor-pointer 
                    hover:shadow-lg transition-all overflow-hidden z-10 ${colors.bg} ${colors.border} ${colors.text}`}
                  style={{
                    top,
                    height: Math.min(height, (END_HOUR - START_HOUR) * HOUR_HEIGHT - top),
                    left: `calc(${leftPct}% + ${gap}px)`,
                    width: `calc(${colWidth}% - ${gap * 2}px)`,
                  }}
                  onClick={() => onSelectCompromisso?.(comp)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{title}</div>
                      <div className="text-xs opacity-80 mt-0.5">
                        {format(start, "HH:mm")} - {format(end, "HH:mm")}
                      </div>
                    </div>
                    <Badge className={`${colors.badge} text-white text-[10px] h-5 shrink-0`}>
                      {statusInfo.icon}
                      <span className="ml-1">{statusInfo.label}</span>
                    </Badge>
                  </div>
                  {height > 60 && (
                    <div className="mt-1.5 space-y-1">
                      {clientName && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="h-3 w-3 opacity-70" />
                          <span className="truncate">{clientName}</span>
                        </div>
                      )}
                      {comp.profissional && (
                        <div className="text-xs opacity-70 truncate">
                          Profissional: {comp.profissional.nome}
                        </div>
                      )}
                      {comp.observacoes && height > 90 && (
                        <div className="text-xs opacity-60 truncate">{comp.observacoes}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
