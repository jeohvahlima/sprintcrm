import { useState, useEffect } from "react";
import { Pencil, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  responsavel_id?: string;
  disponibilidade: {
    dias: string[];
    horario_inicio: string;
    horario_fim: string;
  };
}

interface Compromisso {
  id: string;
  agenda_id?: string;
  lead_id?: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  observacoes?: string;
  custo_estimado?: number;
  status: string;
  usuario_responsavel_id?: string;
}

interface Lead {
  id: string;
  name: string;
  phone?: string;
  telefone?: string;
  tags?: string[];
}

interface EditarCompromissoDialogProps {
  compromisso: Compromisso;
  onCompromissoUpdated: () => void;
}

export function EditarCompromissoDialog({
  compromisso,
  onCompromissoUpdated,
}: EditarCompromissoDialogProps) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadName, setSelectedLeadName] = useState("");
  
  const [leadId, setLeadId] = useState(compromisso.lead_id || "none");
  const [agendaId, setAgendaId] = useState(compromisso.agenda_id || "");
  const [data, setData] = useState<Date>(parseISO(compromisso.data_hora_inicio));
  const [horaInicio, setHoraInicio] = useState(
    format(parseISO(compromisso.data_hora_inicio), "HH:mm")
  );
  
  // Calcular duração em minutos baseada no compromisso existente
  const calcularDuracao = () => {
    const inicio = parseISO(compromisso.data_hora_inicio);
    const fim = parseISO(compromisso.data_hora_fim);
    const duracaoEmMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
    return duracaoEmMinutos.toString();
  };
  
  const [duracaoMinutos, setDuracaoMinutos] = useState(calcularDuracao());
  const [tipoServico, setTipoServico] = useState(compromisso.tipo_servico);
  const [observacoes, setObservacoes] = useState(compromisso.observacoes || "");
  const [custoEstimado, setCustoEstimado] = useState(
    compromisso.custo_estimado?.toString() || ""
  );

  useEffect(() => {
    if (open) {
      loadLeads();
      loadAgendas();
      resetForm();
    }
  }, [open, compromisso]);

  const resetForm = () => {
    setLeadId(compromisso.lead_id || "none");
    setAgendaId(compromisso.agenda_id || "");
    setData(parseISO(compromisso.data_hora_inicio));
    setHoraInicio(format(parseISO(compromisso.data_hora_inicio), "HH:mm"));
    setDuracaoMinutos(calcularDuracao());
    setTipoServico(compromisso.tipo_servico);
    setObservacoes(compromisso.observacoes || "");
    setCustoEstimado(compromisso.custo_estimado?.toString() || "");
    setErrors({});
    setLeadSearch("");
    setSelectedLeadName("");
  };

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, tags")
        .order("name");

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    }
  };

  const loadAgendas = async () => {
    try {
      const { data, error } = await supabase
        .from("agendas")
        .select("*")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      setAgendas((data || []) as unknown as Agenda[]);
    } catch (error) {
      console.error("Erro ao carregar agendas:", error);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!leadSearch.trim()) return true;
    const search = leadSearch.toLowerCase();
    const name = lead.name?.toLowerCase() || "";
    const phone = lead.phone?.toLowerCase() || "";
    const telefone = lead.telefone?.toLowerCase() || "";
    const tags = (lead.tags || []).join(" ").toLowerCase();
    return name.includes(search) || phone.includes(search) || telefone.includes(search) || tags.includes(search);
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validar data
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataSelecionada = new Date(data);
    dataSelecionada.setHours(0, 0, 0, 0);

    if (dataSelecionada < hoje && compromisso.status === 'agendado') {
      newErrors.data = "A data não pode ser no passado para compromissos agendados";
    }

    // Validar duração
    const duracao = parseInt(duracaoMinutos) || 0;
    if (duracao < 15) {
      newErrors.duracao = "Compromisso deve ter no mínimo 15 minutos";
    }

    // Validar tipo de serviço
    if (!tipoServico.trim()) {
      newErrors.tipoServico = "Tipo de serviço é obrigatório";
    }

    // Validar observações
    if (observacoes.length > 500) {
      newErrors.observacoes = "Observações devem ter no máximo 500 caracteres";
    }

    // Validar custo
    if (custoEstimado && parseFloat(custoEstimado) < 0) {
      newErrors.custoEstimado = "Valor não pode ser negativo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    console.log('🚀 [DEBUG] Iniciando atualização de compromisso...');
    
    if (!validateForm()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    try {
      console.log('✅ [DEBUG] Validação do formulário passou');
      const dataFormatada = format(data, "yyyy-MM-dd");
      // Garantir que o horário tenha formato completo (HH:mm:00)
      const horaInicioCompleta = horaInicio.includes(':') && horaInicio.split(':').length === 2 
        ? `${horaInicio}:00` 
        : horaInicio;
      
      const dataHoraInicio = new Date(`${dataFormatada}T${horaInicioCompleta}`);
      
      // Calcular data/hora fim baseada na duração
      const duracao = parseInt(duracaoMinutos) || 30;
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60000);
      
      // Validar se as datas são válidas
      if (isNaN(dataHoraInicio.getTime())) {
        toast.error("Data/horário de início inválido");
        return;
      }
      
      if (isNaN(dataHoraFim.getTime())) {
        toast.error("Data/horário de fim inválido");
        return;
      }
      
      // Validar se hora fim é depois da hora início
      if (dataHoraFim <= dataHoraInicio) {
        toast.error("O horário de término deve ser após o horário de início");
        return;
      }
      
      // Validar duração mínima (15 minutos) - já calculado, apenas verificar
      const duracaoCalculada = (dataHoraFim.getTime() - dataHoraInicio.getTime()) / (1000 * 60);
      if (duracaoCalculada < 15) {
        toast.error("O compromisso deve ter no mínimo 15 minutos de duração");
        return;
      }

      // Validar agenda se selecionada
      if (agendaId) {
        const agendaSelecionada = agendas.find(a => a.id === agendaId);
        
        if (!agendaSelecionada) {
          toast.error("Agenda selecionada não encontrada");
          return;
        }

        // Validar disponibilidade - dia da semana
        // Suporta ambos formatos: 'dias_funcionamento' (novo) e 'dias' (antigo)
        // Também suporta formato completo ('segunda', 'terca') e abreviado ('seg', 'ter')
        const diasSemanaCompleto = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const diasSemanaAbreviado = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const indiceDia = dataHoraInicio.getDay();
        const diaSemanaCompleto = diasSemanaCompleto[indiceDia];
        const diaSemanaAbreviado = diasSemanaAbreviado[indiceDia];
        
        // Verificar em ambos campos e formatos
        const disp: any = agendaSelecionada.disponibilidade || {};
        const diasConfig = disp.dias_funcionamento || disp.dias;
        
        const diaValido = !diasConfig || // Se não tem config, aceita qualquer dia
                          diasConfig.includes(diaSemanaCompleto) || 
                          diasConfig.includes(diaSemanaAbreviado);
        
        if (!diaValido) {
          toast.error(`A agenda "${agendaSelecionada.nome}" não está disponível neste dia da semana`);
          return;
        }

        // Validar disponibilidade - horário
        // Suporta formato novo (periodos) e antigo (horario_inicio/horario_fim)
        let horarioInicioStr = "08:00";
        let horarioFimStr = "18:00";
        
        if (disp.periodos) {
          // Formato novo - calcular horário de início e fim baseado nos períodos ativos
          const periodos = disp.periodos;
          const horariosAtivos: string[] = [];
          
          if (periodos.manha?.ativo) {
            horariosAtivos.push(periodos.manha.inicio, periodos.manha.fim);
          }
          if (periodos.tarde?.ativo) {
            horariosAtivos.push(periodos.tarde.inicio, periodos.tarde.fim);
          }
          if (periodos.noite?.ativo) {
            horariosAtivos.push(periodos.noite.inicio, periodos.noite.fim);
          }
          
          if (horariosAtivos.length > 0) {
            horariosAtivos.sort();
            horarioInicioStr = horariosAtivos[0];
            horarioFimStr = horariosAtivos[horariosAtivos.length - 1];
          }
        } else if (disp.horario_inicio && disp.horario_fim) {
          // Formato antigo
          horarioInicioStr = disp.horario_inicio;
          horarioFimStr = disp.horario_fim;
        }
        
        const [horaInicioDisponivel, minutoInicioDisponivel] = horarioInicioStr.split(':').map(Number);
        const [horaFimDisponivel, minutoFimDisponivel] = horarioFimStr.split(':').map(Number);
        const inicioDisponivel = horaInicioDisponivel * 60 + minutoInicioDisponivel;
        const fimDisponivel = horaFimDisponivel * 60 + minutoFimDisponivel;
        
        const [horaInicioNum, minutoInicioNum] = horaInicio.split(':').map(Number);
        const inicioSolicitado = horaInicioNum * 60 + minutoInicioNum;
        const duracaoMin = parseInt(duracaoMinutos) || 30;
        const fimSolicitado = inicioSolicitado + duracaoMin;

        if (inicioSolicitado < inicioDisponivel || fimSolicitado > fimDisponivel) {
          toast.error(`O horário está fora do horário de funcionamento da agenda (${horarioInicioStr} - ${horarioFimStr})`);
          return;
        }

        // Validar capacidade simultânea (excluindo o próprio compromisso)
        const { data: compromissosAgenda, error: capacidadeError } = await supabase
          .from("compromissos")
          .select("id")
          .eq("agenda_id", agendaId)
          .eq("status", "agendado")
          .neq("id", compromisso.id)
          .lt("data_hora_inicio", dataHoraFim.toISOString())
          .gt("data_hora_fim", dataHoraInicio.toISOString());

        if (capacidadeError) {
          console.error("❌ [DEBUG] Erro ao verificar capacidade:");
          console.error("  Mensagem:", capacidadeError.message || "(vazia)");
          console.error("  Código:", capacidadeError.code || "(vazio)");
          console.error("  Detalhes:", capacidadeError.details || "(vazio)");
          // Não bloquear atualização por erro na verificação de capacidade, apenas logar
          console.warn("⚠️ [DEBUG] Continuando apesar do erro na verificação de capacidade");
        } else {
          const ocupacaoAtual = compromissosAgenda?.length || 0;
          if (ocupacaoAtual >= agendaSelecionada.capacidade_simultanea) {
            toast.error(`A agenda "${agendaSelecionada.nome}" já está com capacidade máxima (${agendaSelecionada.capacidade_simultanea} compromissos simultâneos)`);
            return;
          }
        }
      }

      // Checar conflito de horários
      const conflitosQuery = supabase
        .from("compromissos")
        .select("id, data_hora_inicio, data_hora_fim")
        .eq("status", "agendado")
        .neq("id", compromisso.id)
        .lt("data_hora_inicio", dataHoraFim.toISOString())
        .gt("data_hora_fim", dataHoraInicio.toISOString());

      if (agendaId) {
        conflitosQuery.eq("agenda_id", agendaId);
      } else if (compromisso.usuario_responsavel_id) {
        conflitosQuery.eq("usuario_responsavel_id", compromisso.usuario_responsavel_id);
      }

      const { data: conflitos, error: confErr } = await conflitosQuery;

      if (confErr) {
        console.error('❌ [DEBUG] Erro ao verificar conflitos:', {
          message: confErr.message,
          code: confErr.code,
          details: confErr.details,
          hint: confErr.hint
        });
        // Não bloquear atualização por erro na verificação de conflitos, apenas logar
        console.warn('⚠️ [DEBUG] Continuando apesar do erro na verificação de conflitos');
      } else {
        if (conflitos && conflitos.length > 0) {
          const mensagem = agendaId 
            ? "Conflito de horário: já existe um compromisso nessa agenda nesse intervalo"
            : "Conflito de horário: já existe um compromisso nesse intervalo";
          toast.error(mensagem);
          return;
        }
      }

      // Detectar alterações para notificação
      const dataOriginal = parseISO(compromisso.data_hora_inicio);
      const horaInicioOriginal = format(dataOriginal, "HH:mm");
      const dataFimOriginal = parseISO(compromisso.data_hora_fim);
      const horaFimOriginal = format(dataFimOriginal, "HH:mm");
      const dataOriginalFormatada = format(dataOriginal, "yyyy-MM-dd");
      
      const dataAlterada = dataFormatada !== dataOriginalFormatada;
      const horaFimNova = format(dataHoraFim, "HH:mm");
      const horarioAlterado = horaInicio !== horaInicioOriginal || horaFimNova !== horaFimOriginal;
      const houveAlteracao = dataAlterada || horarioAlterado;

      // Verificar autenticação e permissões antes de atualizar
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para atualizar um compromisso");
        return;
      }

      console.log('🔐 [DEBUG] Usuário autenticado:', user.id);
      console.log('📋 [DEBUG] Compromisso atual - usuario_responsavel_id:', compromisso.usuario_responsavel_id);

      // Preparar dados de atualização
      // Buscar dados do lead selecionado para preencher paciente e telefone
      const leadSelecionadoData = leadId && leadId !== 'none' ? leads.find(l => l.id === leadId) : null;
      const tipoServicoFinal = tipoServico.trim() || 'outro';
      
      const updateData: any = {
        agenda_id: agendaId && agendaId.trim() ? agendaId.trim() : null,
        lead_id: leadId === 'none' ? null : (leadId && leadId.trim() ? leadId.trim() : null),
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        tipo_servico: tipoServicoFinal,
        observacoes: observacoes && observacoes.trim() ? observacoes.trim() : null,
        custo_estimado: custoEstimado && custoEstimado.trim() ? parseFloat(custoEstimado) : null,
        // Preencher titulo com tipo_servico formatado
        titulo: tipoServicoFinal.charAt(0).toUpperCase() + tipoServicoFinal.slice(1),
      };

      // IMPORTANTE: Se uma agenda foi selecionada, definir o profissional_id 
      // baseado no responsavel_id da agenda para sincronização com app Waze Agenda
      const agendaSelecionadaParaProf = agendaId ? agendas.find(a => a.id === agendaId) : null;
      if (agendaSelecionadaParaProf?.responsavel_id) {
        updateData.profissional_id = agendaSelecionadaParaProf.responsavel_id;
        console.log('📅 [Agenda] Definindo profissional_id baseado na agenda:', agendaSelecionadaParaProf.responsavel_id);
      } else {
        updateData.profissional_id = null;
      }

      // Preencher paciente e telefone com dados do lead para compatibilidade com app Waze Agenda
      if (leadSelecionadoData) {
        updateData.paciente = leadSelecionadoData.name;
        const telefoneDoLead = leadSelecionadoData.phone || leadSelecionadoData.telefone;
        if (telefoneDoLead) {
          updateData.telefone = telefoneDoLead;
        }
      } else {
        // Se não tem lead, limpar paciente e telefone
        updateData.paciente = null;
        updateData.telefone = null;
      }

      // Log dos dados antes de atualizar para debug
      console.log('📤 [DEBUG] Dados que serão atualizados:');
      console.log('  - agenda_id:', updateData.agenda_id);
      console.log('  - lead_id:', updateData.lead_id);
      console.log('  - data_hora_inicio:', updateData.data_hora_inicio);
      console.log('  - data_hora_fim:', updateData.data_hora_fim);
      console.log('  - tipo_servico:', updateData.tipo_servico);
      console.log('  - observacoes:', updateData.observacoes);
      console.log('  - custo_estimado:', updateData.custo_estimado);
      console.log('  - titulo:', updateData.titulo);
      console.log('  - paciente:', updateData.paciente);
      console.log('  - telefone:', updateData.telefone);
      console.log('📋 [DEBUG] ID do compromisso:', compromisso.id);
      console.log('📋 [DEBUG] Dados completos (JSON):', JSON.stringify(updateData, null, 2));

      // Tentar atualizar
      console.log('🔄 [DEBUG] Tentando atualizar compromisso...');
      const { data: updatedData, error } = await supabase
        .from("compromissos")
        .update(updateData)
        .eq("id", compromisso.id)
        .select()
        .single();

      if (error) {
        console.error('❌ [DEBUG] Erro retornado pelo Supabase:');
        console.error('  Mensagem:', error.message || '(vazia)');
        console.error('  Código:', error.code || '(vazio)');
        console.error('  Detalhes:', error.details || '(vazio)');
        console.error('  Hint:', error.hint || '(vazio)');
        console.error('  Erro completo:', JSON.stringify({
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }, null, 2));
        
        // Se for erro de permissão (RLS), tentar verificar se o usuário tem acesso
        if (error.code === '42501' || error.message?.toLowerCase().includes('permission') || error.message?.toLowerCase().includes('policy')) {
          console.error('🔒 [DEBUG] Possível erro de permissão RLS');
          console.error('  Verificando se o usuário tem acesso ao compromisso...');
          
          // Verificar se consegue ler o compromisso
          const { data: compromissoCheck, error: checkError } = await supabase
            .from("compromissos")
            .select("id, owner_id, usuario_responsavel_id, company_id")
            .eq("id", compromisso.id)
            .single();
          
          if (checkError) {
            console.error('  ❌ Não consegue ler o compromisso:', checkError.message);
            toast.error("Erro de permissão: Você não tem acesso a este compromisso.");
          } else {
            console.log('  ✅ Consegue ler o compromisso:', compromissoCheck);
            console.log('  - owner_id:', compromissoCheck?.owner_id);
            console.log('  - usuario_responsavel_id:', compromissoCheck?.usuario_responsavel_id);
            console.log('  - company_id:', compromissoCheck?.company_id);
            toast.error("Erro de permissão ao atualizar. Verifique se você tem acesso a este compromisso.");
          }
        }
        
        throw error;
      }
      
      console.log('✅ [DEBUG] Compromisso atualizado com sucesso:', updatedData?.id);

      // Enviar notificação de alteração se houver mudança de data/horário e se tiver lead
      if (houveAlteracao && leadId && leadId !== 'none') {
        try {
          const { data: leadData } = await supabase
            .from("leads")
            .select("name, phone, telefone")
            .eq("id", leadId)
            .single();

          if (leadData && (leadData.phone || leadData.telefone)) {
            const telefone = leadData.phone || leadData.telefone;
            if (telefone) {
              // Normalizar telefone (função similar à do Agenda.tsx)
              const normalizePhoneBR = (phone: string) => {
                const cleaned = phone.replace(/\D/g, '');
                if (cleaned.length === 10 || cleaned.length === 11) {
                  return cleaned.length === 10 ? `55${cleaned}` : `55${cleaned}`;
                }
                return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
              };

              const telefoneNormalizado = normalizePhoneBR(telefone);
              const tipoServicoFormatado = tipoServico.charAt(0).toUpperCase() + tipoServico.slice(1);
              
              let mensagemAlteracao = `🔄 *Alteração no Compromisso*\n\n`;
              mensagemAlteracao += `Olá ${leadData.name}! Seu compromisso foi alterado.\n\n`;
              
              if (dataAlterada) {
                mensagemAlteracao += `📅 *Nova Data:* ${format(dataHoraInicio, "dd/MM/yyyy", { locale: ptBR })}\n`;
                mensagemAlteracao += `📅 *Data Anterior:* ${format(dataOriginal, "dd/MM/yyyy", { locale: ptBR })}\n`;
              }
              
              if (horarioAlterado) {
                mensagemAlteracao += `🕐 *Novo Horário:* ${format(dataHoraInicio, "HH:mm", { locale: ptBR })} às ${format(dataHoraFim, "HH:mm", { locale: ptBR })}\n`;
                mensagemAlteracao += `🕐 *Horário Anterior:* ${horaInicioOriginal} às ${horaFimOriginal}\n`;
              }
              
              mensagemAlteracao += `📋 *Tipo:* ${tipoServicoFormatado}\n`;
              mensagemAlteracao += `\n✅ *Status:* Agendado\n\n`;
              mensagemAlteracao += `Por favor, anote o novo dia e horário!\n\n`;
              mensagemAlteracao += `_Esta é uma notificação automática de alteração._`;

              // Obter company_id do usuário
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: userRole } = await supabase
                  .from('user_roles')
                  .select('company_id')
                  .eq('user_id', user.id)
                  .single();

                if (userRole?.company_id) {
                  const { error: envioError } = await supabase.functions.invoke('enviar-whatsapp', {
                    body: {
                      numero: telefoneNormalizado,
                      mensagem: mensagemAlteracao,
                      company_id: userRole.company_id
                    }
                  });

                  // Salvar mensagem no CRM para ficar visível
                  if (!envioError) {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      const { data: userProfile } = user ? await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', user.id)
                        .single() : { data: null };
                      
                      await supabase.from('conversas').insert({
                        numero: telefoneNormalizado,
                        telefone_formatado: telefoneNormalizado,
                        mensagem: mensagemAlteracao,
                        origem: 'WhatsApp',
                        status: 'Enviada',
                        tipo_mensagem: 'text',
                        nome_contato: leadData.name,
                        company_id: userRole.company_id,
                        owner_id: user?.id,
                        sent_by: userProfile?.full_name || userProfile?.email || 'Você',
                        fromme: true,
                        created_at: new Date().toISOString()
                      });
                      console.log('✅ Mensagem de atualização salva no CRM');
                    } catch (dbError) {
                      console.error('❌ Erro ao salvar mensagem de atualização no CRM:', dbError);
                      // Não bloquear o processo se falhar ao salvar no CRM
                    }
                  }
                }
              }
            }
          }
        } catch (notifError) {
          console.error("Erro ao enviar notificação de alteração:", notifError);
          // Não bloquear a atualização se a notificação falhar
        }
      }

      // 🗓️ Sincronizar com Google Calendar (atualiza evento existente ou cria se ainda não existe)
      supabase.functions
        .invoke("google-calendar-event", { body: { action: "update", compromisso_id: compromisso.id } })
        .catch((e) => console.warn("[gcal] update skipped:", e?.message));

      toast.success("Compromisso atualizado com sucesso!");
      setOpen(false);
      setErrors({});
      onCompromissoUpdated();
    } catch (error: any) {
      // Log completo do erro de forma legível - PRIMEIRO LOG
      console.error("=".repeat(50));
      console.error("❌ [ERRO CRÍTICO] Erro ao atualizar compromisso:");
      console.error("=".repeat(50));
      
      // Log direto do objeto primeiro para garantir que vemos algo
      console.error("📦 Erro (objeto direto):", error);
      
      // Depois logar detalhes
      console.error("  Mensagem:", error?.message || "(vazia)");
      console.error("  Código:", error?.code || "(vazio)");
      console.error("  Detalhes:", error?.details || "(vazio)");
      console.error("  Hint:", error?.hint || "(vazio)");
      console.error("  Name:", error?.name || "(vazio)");
      
      // Tentar serializar o erro completo
      try {
        const errorObj = {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          name: error?.name,
          stack: error?.stack
        };
        console.error("  Erro completo (serializado):", JSON.stringify(errorObj, null, 2));
      } catch (e) {
        console.error("  Erro ao serializar:", e);
        console.error("  Erro original (objeto):", error);
      }
      
      console.error("=".repeat(50));
      
      // Mensagens de erro mais específicas
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      
      if (errorCode === '23503') {
        // Foreign key violation
        if (errorMessage.includes('agenda_id')) {
          toast.error("Erro: Agenda selecionada não encontrada.");
        } else if (errorMessage.includes('lead_id')) {
          toast.error("Erro: Lead selecionado não encontrado.");
        } else {
          toast.error("Erro: Referência inválida. Verifique os dados selecionados.");
        }
      } else if (errorCode === '23514') {
        toast.error("Erro: Os dados fornecidos não atendem aos requisitos.");
      } else if (errorMessage.toLowerCase().includes('titulo') || errorCode === 'PGRST204') {
        toast.error("Erro: Problema com a estrutura do banco de dados.");
      } else if (errorMessage.includes('null value') || errorMessage.includes('NOT NULL')) {
        toast.error("Erro: Campos obrigatórios não preenchidos.");
      } else {
        toast.error(`Erro ao atualizar compromisso: ${errorMessage || errorCode || 'Erro desconhecido'}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Compromisso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Campo título removido - coluna não existe no banco de dados */}
          <div className="space-y-2">
            <Label>Agenda (Opcional)</Label>
            <Select value={agendaId || "none"} onValueChange={(value) => setAgendaId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma agenda ou deixe vazio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma agenda</SelectItem>
                {agendas.map((agenda) => (
                  <SelectItem key={agenda.id} value={agenda.id}>
                    {agenda.nome} ({agenda.tipo}) - {agenda.disponibilidade?.horario_inicio} às {agenda.disponibilidade?.horario_fim}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agendaId && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const agenda = agendas.find(a => a.id === agendaId);
                  return agenda ? `Capacidade: ${agenda.capacidade_simultanea} simultâneos | Dias: ${agenda.disponibilidade?.dias?.join(', ')}` : '';
                })()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cliente / Lead</Label>
            <Input
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou tag..."
            />
            {leadSearch && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setLeadId(lead.id);
                        setSelectedLeadName(lead.name);
                        setLeadSearch("");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                    >
                      <div className="font-medium">{lead.name}</div>
                      {(lead.phone || lead.telefone) && (
                        <div className="text-xs text-muted-foreground">
                          {lead.phone || lead.telefone}
                        </div>
                      )}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {lead.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum lead encontrado
                  </div>
                )}
              </div>
            )}
            {selectedLeadName && (
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                <span className="text-sm font-medium">{selectedLeadName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLeadId("none");
                    setSelectedLeadName("");
                  }}
                  className="h-6 px-2"
                >
                  Remover
                </Button>
              </div>
            )}
            {!leadSearch && !selectedLeadName && (
              <p className="text-xs text-muted-foreground">
                Digite para buscar um lead ou deixe vazio para nenhum
              </p>
            )}
          </div>

          <div>
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !data && "text-muted-foreground",
                    errors.data && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(newDate) => {
                    if (newDate) {
                      setData(newDate);
                      if (errors.data) setErrors({ ...errors, data: "" });
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {errors.data && (
              <p className="text-xs text-destructive mt-1">{errors.data}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horário de início *</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => {
                  setHoraInicio(e.target.value);
                  if (errors.horaInicio) setErrors({ ...errors, horaInicio: "" });
                }}
                className={errors.horaInicio ? "border-destructive" : ""}
              />
              {errors.horaInicio && (
                <p className="text-xs text-destructive mt-1">{errors.horaInicio}</p>
              )}
            </div>
            <div>
              <Label>Duração *</Label>
              <Select
                value={duracaoMinutos}
                onValueChange={(value) => {
                  setDuracaoMinutos(value);
                  if (errors.duracao) setErrors({ ...errors, duracao: "" });
                }}
              >
                <SelectTrigger className={errors.duracao ? "border-destructive" : ""}>
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
              {errors.duracao && (
                <p className="text-xs text-destructive mt-1">{errors.duracao}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Tipo de serviço *</Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger className={errors.tipoServico ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="consultoria">Consultoria</SelectItem>
                <SelectItem value="atendimento">Atendimento</SelectItem>
                <SelectItem value="visita">Visita</SelectItem>
                <SelectItem value="apresentacao">Apresentação</SelectItem>
                <SelectItem value="retorno">Retorno</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipoServico && (
              <p className="text-xs text-destructive mt-1">{errors.tipoServico}</p>
            )}
          </div>

          <div>
            <Label>Valor estimado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={custoEstimado}
              onChange={(e) => {
                setCustoEstimado(e.target.value);
                if (errors.custoEstimado) setErrors({ ...errors, custoEstimado: "" });
              }}
              className={errors.custoEstimado ? "border-destructive" : ""}
            />
            {errors.custoEstimado && (
              <p className="text-xs text-destructive mt-1">{errors.custoEstimado}</p>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações internas sobre o compromisso..."
              value={observacoes}
              onChange={(e) => {
                setObservacoes(e.target.value);
                if (errors.observacoes) setErrors({ ...errors, observacoes: "" });
              }}
              rows={3}
              className={errors.observacoes ? "border-destructive" : ""}
            />
            {errors.observacoes && (
              <p className="text-xs text-destructive mt-1">{errors.observacoes}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {observacoes.length}/500 caracteres
            </p>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
