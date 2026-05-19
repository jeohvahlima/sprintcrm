import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  MessageSquare, 
  Calendar, 
  CheckSquare,
  Eye,
  Edit,
  Trash2,
  Phone,
  Trophy,
  XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FinalizarNegociacaoDialog } from "./FinalizarNegociacaoDialog";
import { safeFormatPhoneNumber } from "@/utils/phoneFormatter";

interface LeadQuickActionsProps {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadValue?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenConversa?: () => void;
  onOpenAgenda?: () => void;
  onOpenTarefa?: () => void;
  onLeadUpdated?: () => void;
}

export function LeadQuickActions({ 
  leadId, 
  leadName, 
  leadPhone,
  leadValue,
  onEdit, 
  onDelete,
  onOpenConversa,
  onOpenAgenda,
  onOpenTarefa,
  onLeadUpdated
}: LeadQuickActionsProps) {
  const navigate = useNavigate();
  const [finalizarDialogOpen, setFinalizarDialogOpen] = useState(false);
  const [finalizarDefaultAction, setFinalizarDefaultAction] = useState<'ganho' | 'perdido'>('ganho');

  const abrirConversa = () => {
    if (onOpenConversa) {
      onOpenConversa();
    } else {
      navigate('/conversas', { state: { leadId } });
    }
  };

  const criarAgendamento = () => {
    if (onOpenAgenda) {
      onOpenAgenda();
    } else {
      navigate('/agenda', { state: { leadId, leadName } });
      toast.success("Criar novo agendamento");
    }
  };

  const criarTarefa = () => {
    if (onOpenTarefa) {
      onOpenTarefa();
    } else {
      navigate('/tarefas', { state: { leadId, leadName } });
      toast.success("Criar nova tarefa");
    }
  };

  const ligarWhatsApp = () => {
    if (leadPhone) {
      const numero = safeFormatPhoneNumber(leadPhone);
      if (!numero) {
        toast.error("Telefone inválido");
        return;
      }
      window.open(`https://wa.me/${numero}`, "_blank");
    } else {
      toast.error("Lead não possui telefone cadastrado");
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={abrirConversa}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Abrir Conversa
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={ligarWhatsApp} disabled={!leadPhone}>
          <Phone className="h-4 w-4 mr-2" />
          Ligar no WhatsApp
        </DropdownMenuItem>
        
        {(onEdit || onDelete) && <DropdownMenuSeparator />}
        
        <DropdownMenuItem onClick={criarAgendamento}>
          <Calendar className="h-4 w-4 mr-2" />
          Criar Agendamento
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={criarTarefa}>
          <CheckSquare className="h-4 w-4 mr-2" />
          Criar Tarefa
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => { setFinalizarDefaultAction('ganho'); setFinalizarDialogOpen(true); }}
          className="text-green-600 focus:text-green-600"
        >
          <Trophy className="h-4 w-4 mr-2" />
          Marcar como Ganho
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => { setFinalizarDefaultAction('perdido'); setFinalizarDialogOpen(true); }}
          className="text-red-600 focus:text-red-600"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Marcar como Perdido
        </DropdownMenuItem>
        
        {onEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Lead
            </DropdownMenuItem>
          </>
        )}
        
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Lead
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <FinalizarNegociacaoDialog
      lead={{ id: leadId, name: leadName, value: leadValue }}
      open={finalizarDialogOpen}
      onOpenChange={setFinalizarDialogOpen}
      onUpdated={() => {
        onLeadUpdated?.();
      }}
      defaultAction={finalizarDefaultAction}
    />
    </>
  );
}