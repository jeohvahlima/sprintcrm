import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HorarioSeletor } from "./HorarioSeletor";
import { HorarioComercial, criarHorarioPadrao } from "./HorarioComercialConfig";
import { ProfissionalSelector } from "./ProfissionalSelector";

interface AgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    nome: string;
    telefone?: string;
  };
  onAgendamentoCriado?: () => void;
}

export function AgendaModal({ open, onOpenChange, lead, onAgendamentoCriado }: AgendaModalProps) {
  const [loading, setLoading] = useState(false);
  const [horarioComercial, setHorarioComercial] = useState<HorarioComercial>(criarHorarioPadrao());
  const [compromissosExistentes, setCompromissosExistentes] = useState<any[]>([]);
  const [agendaSelecionada, setAgendaSelecionada] = useState<any>(null);
  const [todasAgendas, setTodasAgendas] = useState<any[]>([]);
  const [agendaIdSelecionada, setAgendaIdSelecionada] = useState<string>("");
  
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [profissionalId, setProfissionalId] = useState<string>("");

  const [formData, setFormData] = useState({
    descricao: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora_inicio: "",
    tipo_servico: "reuniao",
    observacoes: "",
    custo_estimado: "",
    duracao_minutos: "30",
    enviar_confirmacao: false,
    notificar_responsavel: true,
    enviar_lembrete: true,
    horas_antecedencia: "",
    horas_antecedencia_horas: "1",
    horas_antecedencia_minutos: "0",
    destinatario_lembrete: "lead" as "lead" | "responsavel" | "ambos",
    lembrete_whatsapp_24h: false,
    lembrete_email_24h: false,
    convidar_lead_email: false,
    email_convidado: "",
  });

  // Buscar email do lead ao abrir
  useEffect(() => {
    if (!open || !lead?.id) return;
    (async () => {
      const { data } = await supabase.from("leads").select("email").eq("id", lead.id).maybeSingle();
      setLeadEmail((data as any)?.email || null);
    })();
  }, [open, lead?.id]);

  // Carregar todas as agendas quando o modal abrir
  useEffect(() => {
    if (open) {
      carregarTodasAgendas();
    }
  }, [open]);

  // Carregar horário comercial e compromissos quando a data ou agenda mudar
  useEffect(() => {
    if (formData.data && agendaIdSelecionada) {
      carregarHorarioComercialPorAgenda(agendaIdSelecionada);
      carregarCompromissosPorAgenda(agendaIdSelecionada);
    }
  }, [formData.data, agendaIdSelecionada]);

  const carregarTodasAgendas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Buscar todas as agendas da empresa
      const { data: agendas, error } = await supabase
        .from("agendas")
        .select("id, nome, tipo, responsavel_id, tempo_medio_servico, disponibilidade, permite_simultaneo, capacidade_simultanea")
        .eq("company_id", userRole.company_id)
        .order("tipo", { ascending: false }) // Principal primeiro
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao carregar agendas:", error);
        return;
      }

      console.log('📅 [AgendaModal] Agendas carregadas:', agendas?.length || 0);
      setTodasAgendas(agendas || []);

      // Selecionar agenda principal por padrão
      const agendaPrincipal = agendas?.find(a => a.tipo === 'principal');
      if (agendaPrincipal) {
        setAgendaIdSelecionada(agendaPrincipal.id);
      } else if (agendas && agendas.length > 0) {
        setAgendaIdSelecionada(agendas[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar agendas:", error);
    }
  };

  const carregarHorarioComercialPorAgenda = async (agendaId: string) => {
    try {
      const agenda = todasAgendas.find(a => a.id === agendaId);
      
      if (!agenda) {
        // Se não encontrar na lista, buscar do banco
        const { data: agendaDB } = await supabase
          .from("agendas")
          .select("*")
          .eq("id", agendaId)
          .single();
        
        if (agendaDB) {
          processarAgenda(agendaDB);
        }
        return;
      }

      processarAgenda(agenda);
    } catch (error) {
      console.error("Erro ao carregar horário comercial:", error);
    }
  };

  const processarAgenda = (agenda: any) => {
    setAgendaSelecionada(agenda);
    
    // Atualizar duração do compromisso com o tempo_medio_servico configurado
    if (agenda.tempo_medio_servico && agenda.tempo_medio_servico > 0) {
      setFormData(prev => ({
        ...prev,
        duracao_minutos: agenda.tempo_medio_servico.toString()
      }));
      console.log('✅ [AgendaModal] Duração atualizada para:', agenda.tempo_medio_servico, 'minutos');
    }

    if (agenda.disponibilidade && typeof agenda.disponibilidade === 'object') {
      const disp = agenda.disponibilidade as any;
      const periodos = disp.periodos || disp;
      
      if (periodos.manha && periodos.tarde) {
        setHorarioComercial({
          manha: {
            inicio: periodos.manha.inicio || "08:00",
            fim: periodos.manha.fim || "12:00",
            ativo: periodos.manha.ativo !== false,
          },
          tarde: {
            inicio: periodos.tarde.inicio || "14:00",
            fim: periodos.tarde.fim || "18:00",
            ativo: periodos.tarde.ativo !== false,
          },
          noite: {
            inicio: periodos.noite?.inicio || "19:00",
            fim: periodos.noite?.fim || "23:00",
            ativo: periodos.noite?.ativo === true,
          },
          intervalo_almoco: {
            inicio: periodos.intervalo_almoco?.inicio || "12:00",
            fim: periodos.intervalo_almoco?.fim || "14:00",
            ativo: periodos.intervalo_almoco?.ativo !== false,
          },
        });
      } else {
        setHorarioComercial({
          manha: {
            inicio: disp.horario_inicio || "08:00",
            fim: "12:00",
            ativo: true,
          },
          tarde: {
            inicio: "14:00",
            fim: disp.horario_fim || "18:00",
            ativo: true,
          },
          noite: {
            inicio: "19:00",
            fim: "23:00",
            ativo: false,
          },
          intervalo_almoco: {
            inicio: "12:00",
            fim: "14:00",
            ativo: true,
          },
        });
      }
    }
  };

  const carregarCompromissosPorAgenda = async (agendaId: string) => {
    try {
      const dataInicio = new Date(formData.data + "T00:00:00");
      const dataFim = new Date(formData.data + "T23:59:59");

      const { data: compromissos } = await supabase
        .from("compromissos")
        .select("id, data_hora_inicio, data_hora_fim, agenda_id")
        .gte("data_hora_inicio", dataInicio.toISOString())
        .lte("data_hora_inicio", dataFim.toISOString())
        .or(`agenda_id.eq.${agendaId},agenda_id.is.null`);
      
      console.log('📅 [AgendaModal] Compromissos carregados para agenda:', agendaId, compromissos?.length || 0);
      setCompromissosExistentes(compromissos || []);
    } catch (error) {
      console.error("Erro ao carregar compromissos:", error);
    }
  };

  const handleSelecionarHorario = (horario: string) => {
    setFormData(prev => ({ ...prev, hora_inicio: horario }));
  };

  // Função para normalizar telefone brasileiro
  const normalizePhoneBR = (phone: string): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return null;
    if (cleaned.length === 10) return `55${cleaned}`;
    if (cleaned.length === 11) return `55${cleaned}`;
    if (cleaned.startsWith("55") && cleaned.length === 13) return cleaned;
    if (cleaned.startsWith("55") && cleaned.length === 12) return cleaned;
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tipo_servico.trim()) {
      toast.error("Selecione o tipo de serviço");
      return;
    }

    if (!formData.data || !formData.hora_inicio) {
      toast.error("Selecione a data e horário do compromisso");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Construir data/hora completa
      const dataHoraInicio = parse(
        `${formData.data} ${formData.hora_inicio}`,
        "yyyy-MM-dd HH:mm",
        new Date()
      );

      // Calcular data/hora fim baseada na duração
      const duracaoMin = parseInt(formData.duracao_minutos) || 30;
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracaoMin * 60000);

      const inicioISO = dataHoraInicio.toISOString();
      const fimISO = dataHoraFim.toISOString();

      // Buscar company_id do usuário via user_roles
      const { data: userRole, error: userError } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', session.user.id)
        .single();

      if (userError) {
        throw new Error(`Erro ao buscar company_id: ${userError.message}`);
      }

      const companyId = userRole?.company_id;

      // Profissional efetivo: explícito > responsável da agenda
      const profEfetivo = profissionalId || agendaSelecionada?.responsavel_id || null;
      const emailConvidadoFinal = (formData.email_convidado?.trim() || leadEmail || "").trim();

      // Criar compromisso no banco de dados
      const { data: compromisso, error: compromissoError } = await supabase
        .from("compromissos")
        .insert([
          {
            company_id: companyId,
            lead_id: lead.id,
            usuario_responsavel_id: session.user.id,
            owner_id: session.user.id,
            agenda_id: agendaIdSelecionada || null,
            profissional_id: profEfetivo,
            data_hora_inicio: inicioISO,
            data_hora_fim: fimISO,
            tipo_servico: formData.tipo_servico,
            observacoes: formData.observacoes,
            custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : 0,
            convidar_lead_email: !!formData.convidar_lead_email,
            email_convidado: formData.convidar_lead_email && emailConvidadoFinal ? emailConvidadoFinal : null,
          } as any,
        ])
        .select()
        .single();

      if (compromissoError) {
        throw new Error(`Erro ao criar compromisso: ${compromissoError.message}`);
      }

      // Criar lembrete(s) se solicitado
      if (formData.enviar_lembrete) {
        const horasAntecedenciaTotal =
          parseInt(formData.horas_antecedencia_horas || "0") +
          parseInt(formData.horas_antecedencia_minutos || "0") / 60;

        const dataLembrete = new Date(dataHoraInicio.getTime() - horasAntecedenciaTotal * 3600000);

        if (dataLembrete > new Date()) {
          const dataLembreteISO = dataLembrete.toISOString();

          const mensagemLembrete = `⏰ *Lembrete de Compromisso!*\\\\n\\\\n` +
            `Olá ${lead.nome}! Este é um lembrete do seu compromisso agendado.\\\\n\\\\n` +
            `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", { locale: ptBR })}\\\\n` +
            `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", { locale: ptBR })} às ${format(dataHoraFim, "HH:mm", { locale: ptBR })} \\\\n` +
            (formData.descricao || formData.observacoes ? `\\\\n💬 *Detalhes:*\\\\n${formData.descricao || ''}${formData.descricao && formData.observacoes ? '\\\\n' : ''}${formData.observacoes || ''}\\\\n` : '') +
            `\\\\nPor favor, confirme sua presença!`;

          // CORREÇÃO: Criar lembretes separados para evitar duplicação
          // Se destinatario = 'ambos', criar dois lembretes separados
          const destinatariosParaCriar: Array<{ tipo: string; telefone: string | null }> = [];
          
          if (formData.destinatario_lembrete === 'ambos') {
            // Criar lembrete para o lead
            if (lead.telefone) {
              destinatariosParaCriar.push({
                tipo: 'lead',
                telefone: normalizePhoneBR(lead.telefone)
              });
            }
            // Criar lembrete para o responsável (buscar telefone do profissional)
            // Por enquanto usar o telefone do lead como fallback
            destinatariosParaCriar.push({
              tipo: 'responsavel',
              telefone: lead.telefone ? normalizePhoneBR(lead.telefone) : null
            });
          } else {
            // Criar apenas um lembrete com o destinatário selecionado
            destinatariosParaCriar.push({
              tipo: formData.destinatario_lembrete,
              telefone: lead.telefone ? normalizePhoneBR(lead.telefone) : null
            });
          }

          // Inserir cada lembrete separadamente
          let lembreteErro = false;
          for (const dest of destinatariosParaCriar) {
            if (!dest.telefone) {
              console.warn(`⚠️ Telefone não disponível para destinatário ${dest.tipo}`);
              continue;
            }
            
            const { error: lembreteError } = await supabase
              .from("lembretes")
              .insert([
                {
                  company_id: companyId,
                  compromisso_id: compromisso.id,
                  canal: "whatsapp",
                  data_envio: dataLembreteISO,
                  destinatario: dest.tipo,
                  mensagem: mensagemLembrete,
                  status_envio: "pendente",
                  horas_antecedencia: horasAntecedenciaTotal,
                  telefone_responsavel: dest.telefone,
                },
              ]);

            if (lembreteError) {
              console.error(`Erro ao criar lembrete para ${dest.tipo}:`, lembreteError);
              lembreteErro = true;
            } else {
              console.log(`✅ Lembrete criado para ${dest.tipo} - telefone: ${dest.telefone}`);
            }
          }

          if (lembreteErro) {
            toast.warning("Compromisso criado, mas houve um erro ao agendar alguns lembretes.");
          }
        } else {
          toast.warning("Não foi possível agendar o lembrete, pois a data é retroativa.");
        }
      }

      // 🔁 Lembretes ADICIONAIS — WhatsApp 24h e/ou E-mail 24h antes
      try {
        const dataEnvio24h = new Date(dataHoraInicio.getTime() - 24 * 3600000);
        if (dataEnvio24h > new Date()) {
          const baseMsg = `Olá ${lead.nome}! Lembrete: você tem ${formData.tipo_servico} agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`;
          const extras: any[] = [];
          if (formData.lembrete_whatsapp_24h && lead.telefone) {
            extras.push({
              compromisso_id: compromisso.id,
              canal: "whatsapp",
              horas_antecedencia: 24,
              mensagem: baseMsg,
              status_envio: "pendente",
              data_envio: dataEnvio24h.toISOString(),
              destinatario: "lead",
              telefone_responsavel: normalizePhoneBR(lead.telefone),
              company_id: companyId,
            });
          }
          if (formData.lembrete_email_24h && leadEmail) {
            extras.push({
              compromisso_id: compromisso.id,
              canal: "email",
              horas_antecedencia: 24,
              mensagem: baseMsg,
              status_envio: "pendente",
              data_envio: dataEnvio24h.toISOString(),
              destinatario: "lead",
              company_id: companyId,
            });
          }
          if (extras.length > 0) {
            const { error: extrasErr } = await supabase.from("lembretes").insert(extras);
            if (extrasErr) console.warn("⚠️ [LEMBRETE] Falha ao criar lembretes 24h:", extrasErr);
          }
        }
      } catch (err) {
        console.warn("⚠️ [LEMBRETE] Erro ao criar lembretes adicionais:", err);
      }

      // 📧 Convite Google Calendar para o lead
      if (formData.convidar_lead_email && emailConvidadoFinal) {
        try {
          await supabase.functions.invoke("google-calendar-event", {
            body: { action: "create", compromisso_id: compromisso.id },
          });
        } catch (err) {
          console.warn("⚠️ [GCAL] Falha ao enviar convite Google Calendar:", err);
        }
      }

      // Enviar mensagem de confirmação imediata se solicitado
      if (formData.enviar_confirmacao && lead.telefone) {
        console.log('📱 [AgendaModal] Iniciando envio de confirmação...');
        try {
          const telefone = normalizePhoneBR(lead.telefone);
          if (telefone) {
            const tipoServicoFormatado = formData.tipo_servico?.trim()
              ? formData.tipo_servico.charAt(0).toUpperCase() + formData.tipo_servico.slice(1)
              : null;
            const mensagemConfirmacao = `✅ *Compromisso Confirmado!*\\\\n\\\\n` +
              `Olá ${lead.nome}! Seu compromisso foi agendado com sucesso.\\\\n\\\\n` +
              `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", { locale: ptBR })}\\\\n` +
              `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", { locale: ptBR })} às ${format(dataHoraFim, "HH:mm", { locale: ptBR })}\\\\n` +
              (tipoServicoFormatado ? `📋 *Tipo:* ${tipoServicoFormatado}\\\\n` : '') +
              (formData.descricao || formData.observacoes ? `\\\\n💬 *Observações:*\\\\n${formData.descricao || ''}${formData.descricao && formData.observacoes ? '\\\\n' : ''}${formData.observacoes || ''}\\\\n` : '') +
              `\\\\n✅ *Status:* Agendado\\\\n\\\\n` +
              `Aguardamos você no dia e horário agendados!\\\\n\\\\n` +
              `_Esta é uma confirmação automática do seu agendamento._`;

            // Enviar confirmação via WhatsApp
            const { data: whatsappResponse, error: whatsappError } = await supabase.functions.invoke('enviar-whatsapp', {
              body: {
                telefone: telefone,
                mensagem: mensagemConfirmacao,
              },
            });

            if (whatsappError) {
              console.error('❌ [WHATSAPP] Erro ao enviar WhatsApp:', whatsappError);
              toast.warning("Compromisso criado, mas houve um erro ao enviar o WhatsApp.");
            } else {
              console.log('✅ [WHATSAPP] WhatsApp enviado com sucesso:', whatsappResponse);
            }
          }
        } catch (error) {
          console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', error);
          toast.warning("Compromisso criado, mas houve erro ao enviar a confirmação.");
        }
      }

      // Enviar notificação push para o responsável se solicitado - já usa dataHoraInicio corretamente
      if (formData.notificar_responsavel) {
        console.log('🔔 [AgendaModal] Iniciando envio de notificação push...');
        try {
          const mensagemNotificacao = `Novo compromisso agendado para ${lead.nome} em ${format(dataHoraInicio, "dd/MM/yyyy HH:mm", { locale: ptBR })}`;

          const { data: pushResponse, error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: session.user.id,
              message: mensagemNotificacao,
            },
          });

          if (pushError) {
            console.error('❌ [PUSH] Erro ao enviar notificação push:', pushError);
            toast.warning("Compromisso criado, mas houve um erro ao enviar a notificação push.");
          } else {
            console.log('✅ [PUSH] Notificação push enviada com sucesso:', pushResponse);
          }
        } catch (error) {
          console.error('❌ [NOTIFICAÇÃO] Erro ao enviar notificação push:', error);
          toast.warning("Compromisso criado, mas houve um erro ao enviar a notificação.");
        }
      }

      // Mensagem de sucesso mais informativa
      if (formData.enviar_confirmacao && formData.notificar_responsavel) {
        toast.success("Compromisso criado! Confirmação enviada e você foi notificado.");
      } else if (formData.enviar_confirmacao) {
        toast.success("Compromisso criado e confirmação enviada ao cliente!");
      } else if (formData.notificar_responsavel) {
        toast.success("Compromisso criado e você foi notificado!");
      } else {
        toast.success("Compromisso agendado com sucesso!");
      }

      onOpenChange(false);
      onAgendamentoCriado?.();

      // Limpar formulário
      setFormData({
        descricao: "",
        data: format(new Date(), "yyyy-MM-dd"),
        hora_inicio: "",
        tipo_servico: "reuniao",
        observacoes: "",
        custo_estimado: "",
        duracao_minutos: agendaSelecionada?.tempo_medio_servico?.toString() || "30",
        enviar_confirmacao: false,
        notificar_responsavel: true,
        enviar_lembrete: true,
        horas_antecedencia: "",
        horas_antecedencia_horas: "1",
        horas_antecedencia_minutos: "0",
        destinatario_lembrete: "lead",
        lembrete_whatsapp_24h: false,
        lembrete_email_24h: false,
        convidar_lead_email: false,
        email_convidado: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar compromisso:", error);
      toast.error(error?.message || "Erro ao agendar compromisso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto !z-[300]">
        <DialogHeader className="pb-3">
          <DialogTitle>Agendar Compromisso - {lead.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seletor de Agenda */}
          {todasAgendas.length > 1 && (
            <div>
              <Label htmlFor="agenda" className="text-sm">Agenda *</Label>
              <Select
                value={agendaIdSelecionada}
                onValueChange={(value) => {
                  setAgendaIdSelecionada(value);
                  setFormData(prev => ({ ...prev, hora_inicio: "" })); // Limpar horário ao trocar agenda
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione uma agenda" />
                </SelectTrigger>
                <SelectContent className="z-[400]">
                  {todasAgendas.map((agenda) => (
                    <SelectItem key={agenda.id} value={agenda.id}>
                      {agenda.nome} {agenda.tipo === 'principal' ? '(Principal)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Profissional Responsável */}
          <ProfissionalSelector
            value={profissionalId}
            onChange={setProfissionalId}
            agendaId={agendaIdSelecionada}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tipo_servico" className="text-sm">Tipo de Serviço *</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(value) => setFormData({ ...formData, tipo_servico: value })}
                required
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="z-[400]">
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="apresentacao">Apresentação</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custo_estimado" className="text-sm">Custo Estimado (R$)</Label>
              <Input
                id="custo_estimado"
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => setFormData({ ...formData, custo_estimado: e.target.value })}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="descricao" className="text-sm">Descrição</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Apresentação do produto para cliente"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data" className="text-sm">Data do Compromisso *</Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                required
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="duracao" className="text-sm">Duração (min)</Label>
              <Select
                value={formData.duracao_minutos}
                onValueChange={(value) => setFormData({ ...formData, duracao_minutos: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[400]">
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

          {/* Seletor de Horários Disponíveis */}
          <div>
            <Label className="text-sm mb-2 block">Selecione o Horário *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Duração do compromisso: <strong>{formData.duracao_minutos} minutos</strong> (configurado nas configurações)
            </p>
            <HorarioSeletor
              data={formData.data}
              horarioComercial={horarioComercial}
              compromissosExistentes={compromissosExistentes}
              horarioSelecionado={formData.hora_inicio}
              duracaoMinutos={parseInt(formData.duracao_minutos) || 30}
              permitirSimultaneo={agendaSelecionada?.permite_simultaneo || false}
              capacidadeSimultanea={agendaSelecionada?.capacidade_simultanea || 1}
              onSelecionarHorario={handleSelecionarHorario}
            />
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-sm">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Opções de Notificação */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Opções de Notificação</Label>

            <div className="flex items-center space-x-2">
              <Switch
                id="enviar_confirmacao"
                checked={formData.enviar_confirmacao}
                onCheckedChange={(checked) => setFormData({ ...formData, enviar_confirmacao: checked })}
              />
              <Label htmlFor="enviar_confirmacao" className="text-sm">Enviar Confirmação para o Cliente</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="notificar_responsavel"
                checked={formData.notificar_responsavel}
                onCheckedChange={(checked) => setFormData({ ...formData, notificar_responsavel: checked })}
              />
              <Label htmlFor="notificar_responsavel" className="text-sm">Notificar Responsável</Label>
            </div>

            <div className="flex items-start space-x-2">
              <Switch
                id="enviar_lembrete"
                checked={formData.enviar_lembrete}
                onCheckedChange={(checked) => setFormData({ ...formData, enviar_lembrete: checked })}
              />
              <Label htmlFor="enviar_lembrete" className="text-sm">Enviar Lembrete</Label>
            </div>

            {formData.enviar_lembrete && (
              <div className="pl-6 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="horas_antecedencia_horas" className="text-sm">
                      Horas de Antecedência
                    </Label>
                    <Select
                      value={formData.horas_antecedencia_horas}
                      onValueChange={(value) => setFormData({ ...formData, horas_antecedencia_horas: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Horas" />
                      </SelectTrigger>
                      <SelectContent className="z-[400]">
                        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                          <SelectItem key={hour} value={hour.toString()}>
                            {hour} hora(s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="horas_antecedencia_minutos" className="text-sm">
                      Minutos de Antecedência
                    </Label>
                    <Select
                      value={formData.horas_antecedencia_minutos}
                      onValueChange={(value) => setFormData({ ...formData, horas_antecedencia_minutos: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Minutos" />
                      </SelectTrigger>
                      <SelectContent className="z-[400]">
                        {["0", "15", "30", "45"].map((minute) => (
                          <SelectItem key={minute} value={minute}>
                            {minute} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="destinatario_lembrete" className="text-sm">Destinatário do Lembrete</Label>
                  <Select
                    value={formData.destinatario_lembrete}
                    onValueChange={(value) => setFormData({ ...formData, destinatario_lembrete: value as "lead" | "responsavel" | "ambos" })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="z-[400]">
                      <SelectItem value="lead">Cliente</SelectItem>
                      <SelectItem value="responsavel">Responsável</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Lembretes adicionais 24h + Convite Google Calendar */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Label htmlFor="lembrete_wa_24h" className="text-sm">
                Lembrete WhatsApp 24h antes
                {!lead.telefone && <span className="block text-[10px] text-muted-foreground">Lead sem telefone</span>}
              </Label>
              <Switch
                id="lembrete_wa_24h"
                checked={formData.lembrete_whatsapp_24h && !!lead.telefone}
                disabled={!lead.telefone}
                onCheckedChange={(c) => setFormData({ ...formData, lembrete_whatsapp_24h: c })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="lembrete_email_24h" className="text-sm">
                Lembrete por e-mail 24h antes
                <span className="block text-[10px] text-muted-foreground">
                  {leadEmail ? `Será enviado para ${leadEmail}` : "Lead sem e-mail cadastrado"}
                </span>
              </Label>
              <Switch
                id="lembrete_email_24h"
                checked={formData.lembrete_email_24h && !!leadEmail}
                disabled={!leadEmail}
                onCheckedChange={(c) => setFormData({ ...formData, lembrete_email_24h: c })}
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="convidar_email" className="text-sm">
                  Convidar por e-mail (Google Agenda)
                  <span className="block text-[10px] text-muted-foreground">Convite nativo do Google Calendar</span>
                </Label>
                <Switch
                  id="convidar_email"
                  checked={formData.convidar_lead_email}
                  onCheckedChange={(c) =>
                    setFormData({
                      ...formData,
                      convidar_lead_email: c,
                      email_convidado: c && !formData.email_convidado && leadEmail ? leadEmail : formData.email_convidado,
                    })
                  }
                />
              </div>
              {formData.convidar_lead_email && (
                <Input
                  type="email"
                  placeholder={leadEmail || "exemplo@email.com"}
                  value={formData.email_convidado}
                  onChange={(e) => setFormData({ ...formData, email_convidado: e.target.value })}
                  className="h-9"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="sm"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
