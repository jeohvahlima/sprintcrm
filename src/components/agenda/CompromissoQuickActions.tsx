/**
 * CompromissoQuickActions
 *
 * Botões rápidos exibidos no card do compromisso (AgendaDayView).
 * Visíveis APENAS para clínicas (gated pelo caller via isClinica).
 *
 * Ações:
 * - [Confirmar presença] → marca `status_confirmacao = 'confirmado'`
 * - [Marcar falta] → marca `status = 'cancelado'` e `status_confirmacao = 'recusado'`
 * - [Reagendar] → emite evento custom escutado pela página Agenda
 */
import { Button } from "@/components/ui/button";
import { Check, X, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  compromissoId: string;
  statusConfirmacao?: string;
  status?: string;
  onUpdated?: () => void;
  onReagendar?: () => void;
  compact?: boolean;
}

export function CompromissoQuickActions({
  compromissoId,
  statusConfirmacao,
  status,
  onUpdated,
  onReagendar,
  compact = false,
}: Props) {
  const jaConfirmado = statusConfirmacao === "confirmado";
  const jaFaltou = status === "cancelado" || statusConfirmacao === "recusado";

  const confirmar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("compromissos")
      .update({
        status_confirmacao: "confirmado",
        confirmado_em: new Date().toISOString(),
        confirmado_via: "manual",
      })
      .eq("id", compromissoId);
    if (error) {
      toast.error("Erro ao confirmar", { description: error.message });
    } else {
      toast.success("Presença confirmada");
      onUpdated?.();
    }
  };

  const marcarFalta = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("compromissos")
      .update({
        status: "cancelado",
        status_confirmacao: "recusado",
      })
      .eq("id", compromissoId);
    if (error) {
      toast.error("Erro ao marcar falta", { description: error.message });
    } else {
      toast.success("Marcado como faltou");
      onUpdated?.();
    }
  };

  const reagendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReagendar?.();
  };

  if (jaConfirmado && !jaFaltou) {
    return (
      <div className={`flex gap-1 ${compact ? "" : "mt-1"}`} onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={marcarFalta}>
          <X className="h-3 w-3 mr-1" />Marcar falta
        </Button>
      </div>
    );
  }

  if (jaFaltou) {
    return (
      <div className={`flex gap-1 ${compact ? "" : "mt-1"}`} onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={reagendar}>
          <CalendarClock className="h-3 w-3 mr-1" />Reagendar
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "" : "mt-1"}`} onClick={(e) => e.stopPropagation()}>
      <Button size="sm" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={confirmar}>
        <Check className="h-3 w-3 mr-1" />Confirmar
      </Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={marcarFalta}>
        <X className="h-3 w-3 mr-1" />Faltou
      </Button>
    </div>
  );
}
