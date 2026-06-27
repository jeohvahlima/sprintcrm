import { useState, useEffect } from "react";
import { RotateCcw, Calendar as CalendarIcon, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ProfissionalSelector } from "./ProfissionalSelector";

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  responsavel_id?: string;
}

interface Compromisso {
  id: string;
  agenda_id?: string;
  lead_id?: string;
  profissional_id?: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  paciente?: string;
  telefone?: string;
  lead?: {
    name: string;
    phone?: string;
  };
  agenda?: {
    nome: string;
    tipo: string;
  };
  profissional?: {
    nome: string;
    especialidade?: string;
  };
}

interface AgendarRetornoDialogProps {
  compromissoOriginal: Compromisso;
  onRetornoAgendado: () => void;
  trigger?: React.ReactNode;
}

const INTERVALOS_RETORNO = [
  { label: "7 dias", dias: 7 },
  { label: "15 dias", dias: 15 },
  { label: "30 dias", dias: 30 },
  { label: "60 dias", dias: 60 },
  { label: "90 dias", dias: 90 },
];

export function AgendarRetornoDialog({
  compromissoOriginal,
  onRetornoAgendado,
  trigger,
}: AgendarRetornoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agendas, setAgendas] = useState<Agenda[]>([]);

  // Estados do formulário
  const [intervaloSelecionado, setIntervaloSelecionado] = useState<number | null>(30);
  const [dataRetorno, setDataRetorno] = useState<Date>(addDays(new Date(), 30));
  const [horaRetorno, setHoraRetorno] = useState(
    format(parseISO(compromissoOriginal.data_hora_inicio), "HH:mm")
  );
  const [duracaoMinutos, setDuracaoMinutos] = useState("30");
  const [agendaId, setAgendaId] = useState(compromissoOriginal.agenda_id || "");
  const [profissionalId, setProfissionalId] = useState(compromissoOriginal.profissional_id || "");
  const [observacoes, setObservacoes] = useState("");
  const [notificarPaciente, setNotificarPaciente] = useState(true);

  // Dados do paciente (pré-preenchidos)
  const nomePaciente = compromissoOriginal.lead?.name || compromissoOriginal.paciente || "Paciente";
  const telefonePaciente = compromissoOriginal.lead?.phone || compromissoOriginal.telefone || "";

  useEffect(() => {
    if (open) {
      loadAgendas();
      // Calcular duração do compromisso original
      const inicio = parseISO(compromissoOriginal.data_hora_inicio);
      const fim = parseISO(compromissoOriginal.data_hora_fim);
      const duracaoCalculada = Math.round((fim.getTime() - inicio.getTime()) / 60000);
      setDuracaoMinutos(duracaoCalculada.toString());
    }
  }, [open]);

  const loadAgendas = async () => {
    try {
      const { data, error } = await supabase
        .from("agendas")
        .select("id, nome, tipo, responsavel_id")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      setAgendas((data || []) as Agenda[]);
    } catch (error) {
      console.error("Erro ao carregar agendas:", error);
    }
  };

  const handleIntervaloClick = (dias: number) => {
    setIntervaloSelecionado(dias);
    setDataRetorno(addDays(new Date(), dias));
  };

  const handleDataChange = (date: Date | undefined) => {
    if (date) {
      setDataRetorno(date);
      setIntervaloSelecionado(null); // Limpar intervalo pré-selecionado
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Validações
      if (!dataRetorno) {
        toast.error("Selecione uma data para o retorno");
        return;
      }

      // Obter usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      // Calcular data/hora de início e fim
      const dataFormatada = format(dataRetorno, "yyyy-MM-dd");
      const horaInicioCompleta = horaRetorno.includes(':') && horaRetorno.split(':').length === 2 
        ? `${horaRetorno}:00` 
        : horaRetorno;
      
      const dataHoraInicio = new Date(`${dataFormatada}T${horaInicioCompleta}`);
      const duracao = parseInt(duracaoMinutos) || 30;
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60000);

      if (isNaN(dataHoraInicio.getTime()) || dataHoraInicio < new Date()) {
        toast.error("Não é possível agendar retorno em data ou horário que já passou.");
        return;
      }

      // Preparar dados do novo compromisso
      const novoCompromisso = {
        agenda_id: agendaId || null,
        lead_id: compromissoOriginal.lead_id || null,
        profissional_id: profissionalId || null,
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        tipo_servico: "retorno",
        status: "agendado",
        observacoes: observacoes || `Retorno referente ao compromisso de ${format(parseISO(compromissoOriginal.data_hora_inicio), "dd/MM/yyyy", { locale: ptBR })}`,
        titulo: `Retorno - ${nomePaciente}`,
        paciente: compromissoOriginal.lead_id ? null : nomePaciente,
        telefone: compromissoOriginal.lead_id ? null : telefonePaciente,
        owner_id: user.id,
        usuario_responsavel_id: user.id,
        company_id: userRole.company_id,
        compromisso_origem_id: compromissoOriginal.id,
      };

      // Inserir compromisso de retorno
      const { data: compromissoCriado, error } = await supabase
        .from("compromissos")
        .insert(novoCompromisso)
        .select()
        .single();

      if (error) throw error;

      // Notificar paciente via WhatsApp se marcado
      if (notificarPaciente && telefonePaciente) {
        try {
          // Normalizar telefone
          const normalizePhoneBR = (phone: string) => {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 10 || cleaned.length === 11) {
              return cleaned.length === 10 ? `55${cleaned}` : `55${cleaned}`;
            }
            return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
          };

          const telefoneNormalizado = normalizePhoneBR(telefonePaciente);
          
          const mensagem = `📅 *Retorno Agendado*\n\n` +
            `Olá ${nomePaciente}! Seu retorno foi agendado.\n\n` +
            `📆 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", { locale: ptBR })}\n` +
            `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", { locale: ptBR })} às ${format(dataHoraFim, "HH:mm", { locale: ptBR })}\n` +
            `📋 *Tipo:* Retorno\n\n` +
            `Por favor, anote o dia e horário!\n\n` +
            `_Este é um agendamento automático de retorno._`;

          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              numero: telefoneNormalizado,
              mensagem,
              company_id: userRole.company_id
            }
          });

          // Verificar se houve erro no envio do WhatsApp
          if (whatsappError || whatsappResult?.error) {
            const errorMsg = whatsappResult?.error || whatsappError?.message || 'Erro desconhecido';
            console.error("Erro ao enviar WhatsApp:", errorMsg);
            
            // Verificar se é erro de conexão do WhatsApp
            if (errorMsg.includes('Connection Closed') || errorMsg.includes('SEND_FAILED')) {
              toast.warning("Retorno agendado! ⚠️ WhatsApp desconectado - reconecte sua instância.");
            } else {
              toast.warning(`Retorno agendado! (Falha no WhatsApp: ${errorMsg})`);
            }
          } else {
            // Salvar mensagem no CRM apenas se o envio foi bem sucedido
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', user.id)
              .single();

            await supabase.from('conversas').insert({
              numero: telefoneNormalizado,
              telefone_formatado: telefoneNormalizado,
              mensagem,
              origem: 'WhatsApp',
              status: 'Enviada',
              tipo_mensagem: 'text',
              nome_contato: nomePaciente,
              company_id: userRole.company_id,
              owner_id: user.id,
              sent_by: userProfile?.full_name || userProfile?.email || 'Sistema',
              fromme: true,
              created_at: new Date().toISOString()
            });

            toast.success("Retorno agendado e paciente notificado!");
          }
        } catch (notifError) {
          console.error("Erro ao notificar paciente:", notifError);
          toast.success("Retorno agendado! (Falha ao enviar notificação)");
        }
      } else {
        toast.success("Retorno agendado com sucesso!");
      }

      setOpen(false);
      onRetornoAgendado();
    } catch (error: any) {
      console.error("Erro ao agendar retorno:", error);
      toast.error(`Erro ao agendar retorno: ${error.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            className="h-8 gap-1"
            title="Agendar retorno"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Retorno</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Agendar Retorno - {nomePaciente}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados do paciente (somente leitura) */}
          <div className="p-3 bg-muted rounded-md space-y-1">
            <p className="text-sm">
              <strong>Paciente:</strong> {nomePaciente}
            </p>
            {telefonePaciente && (
              <p className="text-sm text-muted-foreground">
                <strong>Telefone:</strong> {telefonePaciente}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Compromisso original: {format(parseISO(compromissoOriginal.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Seleção rápida de intervalo */}
          <div className="space-y-2">
            <Label>Retorno em:</Label>
            <div className="flex flex-wrap gap-2">
              {INTERVALOS_RETORNO.map((intervalo) => (
                <Button
                  key={intervalo.dias}
                  type="button"
                  variant={intervaloSelecionado === intervalo.dias ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleIntervaloClick(intervalo.dias)}
                >
                  {intervalo.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Data customizada */}
          <div className="space-y-2">
            <Label>Ou selecione uma data:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataRetorno && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRetorno ? format(dataRetorno, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRetorno}
                  onSelect={handleDataChange}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                  disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Horário
              </Label>
              <Input
                type="time"
                value={horaRetorno}
                onChange={(e) => setHoraRetorno(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duracaoMinutos} onValueChange={setDuracaoMinutos}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h 30min</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <Label>Agenda</Label>
            <Select value={agendaId || "none"} onValueChange={(val) => setAgendaId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Mesma agenda</SelectItem>
                {agendas.map((agenda) => (
                  <SelectItem key={agenda.id} value={agenda.id}>
                    {agenda.nome} ({agenda.tipo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profissional */}
          <ProfissionalSelector
            value={profissionalId}
            onChange={setProfissionalId}
            agendaId={agendaId}
          />

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              placeholder="Observações adicionais sobre o retorno..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Notificar paciente */}
          {telefonePaciente && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notificar"
                checked={notificarPaciente}
                onCheckedChange={(checked) => setNotificarPaciente(!!checked)}
              />
              <label
                htmlFor="notificar"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
              >
                <MessageSquare className="h-4 w-4" />
                Notificar paciente via WhatsApp
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Agendando..." : "Agendar Retorno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
