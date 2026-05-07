import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { throttledProfilePicture } from "@/utils/profilePictureThrottle";
import { Calendar as CalendarIcon, Plus, Clock, User, Filter, Settings, Bell, CheckCircle2, XCircle, AlertCircle, Trash2, Search, CalendarDays, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { useNotifications } from "@/hooks/useNotifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { EditarCompromissoDialog } from "@/components/agenda/EditarCompromissoDialog";
import { AgendarRetornoDialog } from "@/components/agenda/AgendarRetornoDialog";
import { AgendaColaboradores } from "@/components/agenda/AgendaColaboradores";
import { HorarioComercialConfig, criarHorarioPadrao, converterHorarioAntigo, HorarioComercial } from "@/components/agenda/HorarioComercialConfig";
import { HorarioSeletor } from "@/components/agenda/HorarioSeletor";
import { AgendaWeekView } from "@/components/agenda/AgendaWeekView";
import { AgendaDayView } from "@/components/agenda/AgendaDayView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
interface Lembrete {
  id: string;
  compromisso_id: string;
  canal: string;
  status_envio: string;
  mensagem?: string;
  horas_antecedencia: number;
  data_envio?: string;
  created_at: string;
  destinatario?: string;
  telefone_responsavel?: string;
  tentativas?: number;
  proxima_tentativa?: string;
  recorrencia?: string | null;
  proxima_data_envio?: string | null;
  ativo?: boolean;
  compromisso?: {
    id?: string;
    lead_id?: string;
    titulo?: string;
    data_hora_inicio: string;
    tipo_servico: string;
    lead?: {
      name: string;
      phone?: string;
    };
  };
}
interface AgendaItem {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  tempo_medio_servico: number;
  disponibilidade: {
    dias: string[];
    horario_inicio: string;
    horario_fim: string;
  };
  responsavel_id?: string;
  permite_simultaneo?: boolean;
}
interface Compromisso {
  id: string;
  agenda_id?: string;
  lead_id?: string;
  profissional_id?: string;
  usuario_responsavel_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  custo_estimado?: number;
  lembrete_enviado: boolean;
  titulo?: string;
  paciente?: string;
  telefone?: string;
  lead?: {
    name: string;
    phone?: string;
    profile_picture_url?: string;
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
interface Lead {
  id: string;
  name: string;
  phone?: string;
  telefone?: string;
  email?: string;
  tags?: string[];
}
export default function Agenda() {
  console.log("🗓️ [Agenda] Componente iniciado!");

  // Hook de notificações para escutar lembretes enviados e enviar push notifications
  useNotifications();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [configuracoesOpen, setConfiguracoesOpen] = useState(false);
  const [horarioComercial, setHorarioComercial] = useState<HorarioComercial>(criarHorarioPadrao());
  const [tempoMedioPadrao, setTempoMedioPadrao] = useState<number>(30);
  const [canalLembretePadrao, setCanalLembretePadrao] = useState<string>("whatsapp");
  const [diasFuncionamento, setDiasFuncionamento] = useState<string[]>(["segunda", "terca", "quarta", "quinta", "sexta"]); // Dias da semana que a empresa funciona (padrão: seg-sex)
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [activeTab, setActiveTab] = useState<string>("agenda");
  const [activeMainTab, setActiveMainTab] = useState<string>("visao-geral");
  const [calendarViewMode, setCalendarViewMode] = useState<"day" | "week">("week");
  const [filtroStatusLembrete, setFiltroStatusLembrete] = useState<string>("all");
  const [filtroCanalLembrete, setFiltroCanalLembrete] = useState<string>("all");
  const [filtroRecorrencia, setFiltroRecorrencia] = useState<string>("all");
  const [buscaCompromissos, setBuscaCompromissos] = useState<string>("");
  const [filtroAgenda, setFiltroAgenda] = useState<string>("all");
  const [filtroTipoServico, setFiltroTipoServico] = useState<string>("all");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("all"); // all, hoje, semana, mes
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("all");

  // Cache de meses carregados para lazy loading
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());

  // Cache de avatares dos leads
  const [leadAvatars, setLeadAvatars] = useState<Record<string, string>>({});
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const avatarFetchingRef = useRef<Set<string>>(new Set());
  const companyIdRef = useRef<string | null>(null);

  // Sistema de eventos globais para comunicação entre módulos
  const {
    emitGlobalEvent
  } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: data => {
        console.log('🌍 [Agenda] Lead atualizado via evento global:', {
          id: data.id,
          name: data.name
        });

        // Validar se dados do lead são válidos
        if (!data || !data.id) {
          console.warn('⚠️ [Agenda] Evento global de lead inválido:', data);
          return;
        }

        // Atualizar lista de leads também
        setLeads(prev => prev.map(lead => {
          if (lead.id === data.id) {
            console.log('✅ [Agenda] Lead atualizado na lista via evento global:', data.id);
            return {
              ...lead,
              name: data.name || lead.name,
              phone: data.phone || lead.phone,
              email: data.email || lead.email
            };
          }
          return lead;
        }));

        // Atualizar compromissos relacionados ao lead - VALIDAÇÃO MELHORADA
        setCompromissos(prev => {
          let updated = false;
          const updatedComps = prev.map(comp => {
            // Validar se lead_id existe e corresponde ao lead atualizado
            if (comp.lead_id && comp.lead_id === data.id) {
              console.log('🔄 [Agenda] Atualizando compromisso via evento global:', comp.id, 'com novo lead:', data.name);

              // Criar objeto lead completo se não existir
              const leadData = {
                name: data.name || comp.lead?.name || '',
                phone: data.phone || comp.lead?.phone
              };
              updated = true;
              return {
                ...comp,
                lead: {
                  ...comp.lead,
                  ...leadData
                }
              };
            }
            return comp;
          });
          if (updated) {
            console.log('✅ [Agenda] Compromissos atualizados via evento global:', updatedComps.filter(c => c.lead_id === data.id).length);
          }
          return updatedComps;
        });
      },
      onTaskCreated: data => {
        console.log('🌍 [Agenda] Nova tarefa criada, verificar se afeta agenda:', data);
        // Se uma tarefa foi criada, pode afetar disponibilidade
      },
      onMeetingScheduled: data => {
        console.log('🌍 [Agenda] Reunião agendada via evento global:', data);
        // Adicionar reunião à lista se for relevante
        // Isso pode vir de outros módulos criando reuniões
      },
      onFunnelStageChanged: data => {
        console.log('🌍 [Agenda] Lead movido no funil, verificar compromissos:', data);
        // Atualizar compromissos relacionados ao lead que mudou de etapa
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // Integrar sincronização de leads em tempo real
  useLeadsSync({
    onInsert: newLead => {
      console.log('📡 [Agenda] Novo lead adicionado via sync:', {
        id: newLead.id,
        name: newLead.name
      });
      setLeads(prev => {
        // Verificar se lead já existe para evitar duplicatas
        const existingIndex = prev.findIndex(l => l.id === newLead.id);
        if (existingIndex >= 0) {
          console.log('⚠️ [Agenda] Lead já existe, atualizando:', newLead.id);
          const updated = [...prev];
          updated[existingIndex] = newLead;
          return updated;
        }
        return [newLead, ...prev];
      });
    },
    onUpdate: (updatedLead, oldLead) => {
      console.log('📡 [Agenda] Lead atualizado via sync:', {
        id: updatedLead.id,
        name: updatedLead.name,
        oldName: oldLead?.name,
        phone: updatedLead.phone
      });

      // Atualizar lista de leads
      setLeads(prev => prev.map(lead => {
        if (lead.id === updatedLead.id) {
          console.log('✅ [Agenda] Lead atualizado na lista:', updatedLead.id);
          return updatedLead;
        }
        return lead;
      }));

      // Atualizar compromissos relacionados - VALIDAÇÃO MELHORADA
      setCompromissos(prev => {
        let updated = false;
        const updatedComps = prev.map(comp => {
          // Validar se lead_id existe e corresponde ao lead atualizado
          if (comp.lead_id && comp.lead_id === updatedLead.id) {
            console.log('🔄 [Agenda] Atualizando compromisso:', comp.id, 'com novo lead:', updatedLead.name);

            // Criar objeto lead completo se não existir
            const leadData = {
              name: updatedLead.name,
              phone: updatedLead.phone || comp.lead?.phone
            };
            updated = true;
            return {
              ...comp,
              lead: {
                ...comp.lead,
                ...leadData
              }
            };
          }
          return comp;
        });
        if (updated) {
          console.log('✅ [Agenda] Compromissos atualizados:', updatedComps.filter(c => c.lead_id === updatedLead.id).length);
        }
        return updatedComps;
      });
    },
    onDelete: deletedLead => {
      console.log('📡 [Agenda] Lead removido via sync:', {
        id: deletedLead.id,
        name: deletedLead.name
      });

      // Remover da lista de leads
      setLeads(prev => {
        const filtered = prev.filter(lead => lead.id !== deletedLead.id);
        console.log(`✅ [Agenda] Lead removido da lista. Total antes: ${prev.length}, depois: ${filtered.length}`);
        return filtered;
      });

      // Limpar referências em compromissos - VALIDAÇÃO MELHORADA
      setCompromissos(prev => {
        let updated = false;
        const updatedComps = prev.map(comp => {
          // Validar se lead_id existe antes de limpar
          if (comp.lead_id && comp.lead_id === deletedLead.id) {
            console.log('🔄 [Agenda] Limpando referência ao lead no compromisso:', comp.id);
            updated = true;
            return {
              ...comp,
              lead_id: null,
              lead: undefined
            };
          }
          return comp;
        });
        if (updated) {
          console.log('✅ [Agenda] Referências ao lead removidas dos compromissos');
        }
        return updatedComps;
      });
    },
    showNotifications: false
  });

  // Form states para novo compromisso
  const [formData, setFormData] = useState({
    titulo: "",
    agenda_id: "",
    lead_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora_inicio: "09:00",
    duracao_minutos: "30",
    tipo_servico: "",
    // Opcional - pode ficar vazio
    observacoes: "",
    custo_estimado: "",
    enviar_lembrete: true,
    horas_antecedencia: "",
    horas_antecedencia_horas: "1",
    horas_antecedencia_minutos: "0",
    destinatario_lembrete: "lead",
    enviar_confirmacao: false,
    notificar_responsavel: true,
    convidar_lead_email: false, // Convida o lead como participante no Google Calendar
    email_convidado: "", // E-mail manual do convidado (usado se lead não tiver email)
    lembrete_email_24h: true, // Lembrete extra por e-mail 24h antes
    lembrete_whatsapp_24h: true, // Lembrete extra por WhatsApp 24h antes
  });
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadName, setSelectedLeadName] = useState("");

  // Estados para o seletor de horários do formulário (igual ao menu Conversas)
  const [formHorarioComercial, setFormHorarioComercial] = useState<HorarioComercial>({
    manha: {
      inicio: "08:00",
      fim: "12:00",
      ativo: true
    },
    tarde: {
      inicio: "14:00",
      fim: "18:00",
      ativo: true
    },
    noite: {
      inicio: "19:00",
      fim: "23:00",
      ativo: false
    },
    intervalo_almoco: {
      inicio: "12:00",
      fim: "14:00",
      ativo: true
    }
  });
  const [formCompromissosExistentes, setFormCompromissosExistentes] = useState<any[]>([]);
  const [formAgendaSelecionada, setFormAgendaSelecionada] = useState<any>(null);
  const [formDiasFuncionamento, setFormDiasFuncionamento] = useState<string[]>(["segunda", "terca", "quarta", "quinta", "sexta"]); // Dias de funcionamento da agenda selecionada no formulário

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const search = leadSearch.toLowerCase();
    return leads.filter(lead => {
      const name = lead.name?.toLowerCase() || "";
      const phone = lead.phone?.toLowerCase() || "";
      const telefone = lead.telefone?.toLowerCase() || "";
      const tags = (lead.tags || []).join(" ").toLowerCase();
      return name.includes(search) || phone.includes(search) || telefone.includes(search) || tags.includes(search);
    });
  }, [leads, leadSearch]);

  // Função otimizada para carregar compromissos com range de datas
  const carregarCompromissos = useCallback(async (startDate?: Date, endDate?: Date) => {
    try {
      let query = supabase.from('compromissos').select(`
          *,
          lead:leads(name, phone, profile_picture_url),
          agenda:agendas(nome, tipo),
          profissional:profissionais(nome, especialidade)
        `).order('data_hora_inicio', {
        ascending: true
      });

      // Se range de datas fornecido, filtrar
      if (startDate && endDate) {
        query = query.gte('data_hora_inicio', startDate.toISOString()).lte('data_hora_inicio', endDate.toISOString());
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      if (startDate && endDate) {
        // Lazy loading: adicionar ao cache existente, mas remover duplicatas e ordenar
        setCompromissos(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newCompromissos = (data || []).filter(c => !existingIds.has(c.id));
          const allCompromissos = [...prev, ...newCompromissos];
          // Ordenar por data
          return allCompromissos.sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime());
        });
      } else {
        // Carregamento inicial: substituir todos
        setCompromissos(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar compromissos:', error);
      toast.error("Erro ao carregar compromissos");
    }
  }, []);

  // Função para carregar compromissos do mês atual ou específico
  const carregarCompromissosDoMes = useCallback(async (month?: Date, forceReload: boolean = false) => {
    const targetMonth = month || selectedDate;
    const monthKey = format(targetMonth, 'yyyy-MM');

    // Se forçar recarregamento, remover do cache primeiro
    if (forceReload) {
      setLoadedMonths(prev => {
        const newSet = new Set(prev);
        newSet.delete(monthKey);
        return newSet;
      });
    }

    // Verificar se o mês já foi carregado usando função de setter
    setLoadedMonths(prev => {
      if (prev.has(monthKey) && !forceReload) {
        console.log(`📅 [Performance] Mês ${monthKey} já carregado, pulando...`);
        return prev; // Não atualizar se já existe e não forçar recarregamento
      }
      console.log(`📅 [Performance] Carregando compromissos do mês ${monthKey}...`);
      const inicio = startOfMonth(targetMonth);
      const fim = endOfMonth(targetMonth);

      // Carregar compromissos de forma assíncrona
      carregarCompromissos(inicio, fim).then(() => {
        // Marcar mês como carregado após carregar
        setLoadedMonths(current => new Set(current).add(monthKey));
      });
      return prev; // Retornar estado atual enquanto carrega
    });
  }, [selectedDate, carregarCompromissos]);

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

  // Função para buscar avatar do lead com cache
  const buscarAvatarLead = useCallback(async (lead: {
    id: string;
    name: string;
    phone?: string;
    telefone?: string;
  }) => {
    const telefone = lead.phone || lead.telefone;
    if (!telefone) {
      // Sem telefone, usar fallback
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
      setLeadAvatars(prev => ({
        ...prev,
        [lead.id]: fallbackUrl
      }));
      return fallbackUrl;
    }

    // Verificar cache em memória
    if (leadAvatars[lead.id]) return leadAvatars[lead.id];

    // Verificar cache do Map
    const cacheKey = `lead-${lead.id}`;
    if (avatarCacheRef.current.has(cacheKey)) {
      const cached = avatarCacheRef.current.get(cacheKey)!;
      setLeadAvatars(prev => ({
        ...prev,
        [lead.id]: cached
      }));
      return cached;
    }

    // Evitar múltiplos fetches simultâneos
    if (avatarFetchingRef.current.has(lead.id)) {
      return leadAvatars[lead.id] || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
    }
    avatarFetchingRef.current.add(lead.id);
    try {
      // Obter company_id se ainda não tiver
      if (!companyIdRef.current) {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          const {
            data: userRole
          } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
          companyIdRef.current = userRole?.company_id || null;
        }
      }
      const telefoneNormalizado = normalizePhoneBR(telefone);
      if (!telefoneNormalizado) {
        throw new Error('Telefone inválido');
      }

      // Buscar foto com timeout de 5s
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
      const fetchPromise = throttledProfilePicture(() => supabase.functions.invoke('get-profile-picture', {
        body: {
          number: telefoneNormalizado,
          company_id: companyIdRef.current
        }
      }));
      const {
        data,
        error
      } = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      if (!error && data?.profilePictureUrl) {
        const avatarUrl = data.profilePictureUrl;
        setLeadAvatars(prev => ({
          ...prev,
          [lead.id]: avatarUrl
        }));
        avatarCacheRef.current.set(cacheKey, avatarUrl);
        avatarFetchingRef.current.delete(lead.id);
        return avatarUrl;
      } else {
        throw new Error('Avatar não encontrado');
      }
    } catch (error) {
      // Fallback para avatar gerado
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
      setLeadAvatars(prev => ({
        ...prev,
        [lead.id]: fallbackUrl
      }));
      avatarCacheRef.current.set(cacheKey, fallbackUrl);
      avatarFetchingRef.current.delete(lead.id);
      return fallbackUrl;
    }
  }, [leadAvatars]);

  // Buscar avatares dos leads quando compromissos são carregados
  useEffect(() => {
    const buscarAvatares = async () => {
      const leadsComTelefone = compromissos.filter(c => c.lead_id && c.lead && c.lead.phone).map(c => ({
        id: c.lead_id!,
        name: c.lead!.name,
        phone: c.lead!.phone
      })).filter((lead, index, self) => index === self.findIndex(l => l.id === lead.id));
      for (const lead of leadsComTelefone) {
        const cacheKey = lead.id;
        if (!leadAvatars[cacheKey] && !avatarFetchingRef.current.has(cacheKey)) {
          buscarAvatarLead(lead);
        }
      }
    };
    if (compromissos.length > 0) {
      buscarAvatares();
    }
  }, [compromissos, buscarAvatarLead, leadAvatars]);

  // Buscar avatares dos leads quando lembretes são carregados
  useEffect(() => {
    const buscarAvataresLembretes = async () => {
      const leadsComTelefone = lembretes.filter(l => l.compromisso?.lead_id && l.compromisso?.lead && (l.compromisso.lead.phone || l.compromisso.lead.phone)).map(l => ({
        id: l.compromisso!.lead_id!,
        name: l.compromisso!.lead!.name,
        phone: l.compromisso!.lead!.phone
      })).filter((lead, index, self) => index === self.findIndex(l => l.id === lead.id));
      for (const lead of leadsComTelefone) {
        const cacheKey = lead.id;
        if (!leadAvatars[cacheKey] && !avatarFetchingRef.current.has(cacheKey)) {
          buscarAvatarLead(lead);
        }
      }
    };
    if (lembretes.length > 0) {
      buscarAvataresLembretes();
    }
  }, [lembretes, buscarAvatarLead, leadAvatars]);

  // Solicitar permissão de notificação ao carregar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Não solicitar automaticamente, apenas quando o usuário tentar usar
      console.log('🔔 [NOTIFICAÇÃO] Permissão de notificação disponível');
    }
  }, []);
  useEffect(() => {
    // Carregar apenas compromissos do mês atual inicialmente (otimização)
    carregarCompromissosDoMes();
    carregarLeads();
    carregarAgendas();
    carregarLembretes();
    carregarConfiguracoes(); // Carregar tempo médio padrão e outras configurações
    // eslint-disable-next-line react-hooks/exhaustive-deps

    // Subscrever para atualizações em tempo real
    const compromissosChannel = supabase.channel('compromissos_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'compromissos'
    }, () => {
      // Ao receber atualização em tempo real, recarregar apenas mês atual (forçar recarregamento)
      carregarCompromissosDoMes(undefined, true);
    }).subscribe();

    // Subscrever lembretes em tempo real
    const lembretesChannel = supabase.channel('lembretes_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'lembretes'
    }, () => {
      carregarLembretes();
    }).subscribe();
    return () => {
      supabase.removeChannel(compromissosChannel);
      supabase.removeChannel(lembretesChannel);
    };
  }, [carregarCompromissosDoMes]);

  // Efeito para carregar compromissos quando mudar de mês
  useEffect(() => {
    const currentMonth = format(selectedDate, 'yyyy-MM');
    const monthKey = format(startOfMonth(selectedDate), 'yyyy-MM');

    // Verificar se precisa carregar o mês atual
    if (!loadedMonths.has(monthKey)) {
      console.log(`📅 [Performance] Mês atual não carregado: ${monthKey}, carregando...`);
      carregarCompromissosDoMes(selectedDate);
    }
  }, [selectedDate, loadedMonths, carregarCompromissosDoMes]);
  const carregarLeads = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('leads').select('id, name, phone, telefone, email, tags').order('name');
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  // Carregar configurações da agenda quando abrir o diálogo
  const carregarConfiguracoes = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        console.log('📅 [Agenda] Usuário não encontrado para carregar configurações');
        return;
      }
      console.log('📅 [Agenda] Carregando configurações para usuário:', user.id);
      const {
        data: agenda,
        error
      } = await supabase.from('agendas').select('*').eq('owner_id', user.id).eq('tipo', 'principal').single();
      console.log('📅 [Agenda] Resultado da busca:', {
        agenda,
        error
      });
      if (agenda) {
        // Carregar horário comercial
        if ((agenda.disponibilidade as any)?.periodos) {
          setHorarioComercial((agenda.disponibilidade as any).periodos);
        } else if (agenda.disponibilidade) {
          // Converter formato antigo para novo
          setHorarioComercial(converterHorarioAntigo(agenda.disponibilidade));
        }

        // Carregar tempo médio - prioridade: campo direto > disponibilidade > padrão
        let tempoMedio = 30; // valor padrão

        if (agenda.tempo_medio_servico && agenda.tempo_medio_servico > 0) {
          tempoMedio = agenda.tempo_medio_servico;
          console.log('📅 [Agenda] Tempo médio do campo direto:', tempoMedio);
        } else if ((agenda.disponibilidade as any)?.tempo_medio_servico) {
          tempoMedio = (agenda.disponibilidade as any).tempo_medio_servico;
          console.log('📅 [Agenda] Tempo médio da disponibilidade:', tempoMedio);
        }
        setTempoMedioPadrao(tempoMedio);
        console.log('📅 [Agenda] ✅ Tempo médio padrão DEFINIDO:', tempoMedio);

        // Carregar canal de lembrete
        if ((agenda.disponibilidade as any)?.canal_lembrete_padrao) {
          setCanalLembretePadrao((agenda.disponibilidade as any).canal_lembrete_padrao);
        }

        // Carregar dias de funcionamento
        if ((agenda.disponibilidade as any)?.dias_funcionamento) {
          setDiasFuncionamento((agenda.disponibilidade as any).dias_funcionamento);
          console.log('📅 [Agenda] Dias de funcionamento carregados:', (agenda.disponibilidade as any).dias_funcionamento);
        }
      } else {
        console.log('📅 [Agenda] Nenhuma agenda encontrada, usando padrões');
        setTempoMedioPadrao(30);
        setDiasFuncionamento(["segunda", "terca", "quarta", "quinta", "sexta"]);
      }
    } catch (error) {
      console.error('❌ [Agenda] Erro ao carregar configurações:', error);
    }
  };
  const carregarAgendas = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('agendas').select('*').eq('status', 'ativo').order('nome');
      if (error) throw error;
      setAgendas((data || []) as any[]);
    } catch (error) {
      console.error('Erro ao carregar agendas:', error);
    }
  };
  const carregarLembretes = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('lembretes').select(`
          *,
          compromisso:compromissos(
            id,
            lead_id,
            data_hora_inicio,
            tipo_servico,
            lead:leads(name, phone)
          )
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setLembretes((data || []) as unknown as Lembrete[]);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
      toast.error("Erro ao carregar lembretes");
    }
  };

  // Carregar horário comercial para o seletor de horários do formulário
  // IMPORTANTE: Se uma agenda específica foi selecionada, usar os dados dessa agenda
  const carregarFormHorarioComercial = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      let agenda = null;

      // Se uma agenda específica foi selecionada, buscar os dados dela
      if (formData.agenda_id) {
        const {
          data: agendaSelecionada
        } = await supabase.from("agendas").select("*").eq("id", formData.agenda_id).single();
        agenda = agendaSelecionada;
        console.log('📅 [Agenda] Carregando horário da agenda selecionada:', agenda?.nome);
      } else {
        // Se não, buscar a agenda principal
        const {
          data: agendaPrincipal
        } = await supabase.from("agendas").select("*").eq("owner_id", user.id).eq("tipo", "principal").single();
        agenda = agendaPrincipal;
        console.log('📅 [Agenda] Carregando horário da agenda principal');
      }
      if (agenda && agenda.disponibilidade && typeof agenda.disponibilidade === 'object') {
        setFormAgendaSelecionada(agenda);
        const disp = agenda.disponibilidade as any;

        // Carregar dias de funcionamento da agenda selecionada
        // Suporta tanto 'dias_funcionamento' (novo) quanto 'dias' (antigo)
        const diasConfig = disp.dias_funcionamento || disp.dias;
        if (diasConfig && Array.isArray(diasConfig)) {
          setFormDiasFuncionamento(diasConfig);
          console.log('📅 [Agenda] Dias de funcionamento carregados:', diasConfig);
        } else {
          // Padrão: todos os dias para evitar bloqueio incorreto
          setFormDiasFuncionamento(["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"]);
          console.log('📅 [Agenda] Dias de funcionamento não encontrados, usando todos os dias');
        }

        // O horário comercial é salvo em disponibilidade.periodos
        const periodos = disp.periodos || disp;

        // Verificar se está no formato novo (com períodos manha, tarde, noite)
        if (periodos.manha && periodos.tarde) {
          // Formato novo - usar diretamente
          setFormHorarioComercial({
            manha: {
              inicio: periodos.manha.inicio || "08:00",
              fim: periodos.manha.fim || "12:00",
              ativo: periodos.manha.ativo !== false // default true
            },
            tarde: {
              inicio: periodos.tarde.inicio || "14:00",
              fim: periodos.tarde.fim || "18:00",
              ativo: periodos.tarde.ativo !== false // default true
            },
            noite: {
              inicio: periodos.noite?.inicio || "19:00",
              fim: periodos.noite?.fim || "23:00",
              ativo: periodos.noite?.ativo === true // default false - só ativa se explicitamente true
            },
            intervalo_almoco: {
              inicio: periodos.intervalo_almoco?.inicio || "12:00",
              fim: periodos.intervalo_almoco?.fim || "14:00",
              ativo: periodos.intervalo_almoco?.ativo !== false // default true
            }
          });
        } else {
          // Formato antigo - converter
          setFormHorarioComercial({
            manha: {
              inicio: disp.horario_inicio || "08:00",
              fim: "12:00",
              ativo: true
            },
            tarde: {
              inicio: "14:00",
              fim: disp.horario_fim || "18:00",
              ativo: true
            },
            noite: {
              inicio: "19:00",
              fim: "23:00",
              ativo: false
            },
            intervalo_almoco: {
              inicio: "12:00",
              fim: "14:00",
              ativo: true
            }
          });
        }
      } else if (!agenda) {
        // Se não encontrou nenhuma agenda, usar valores padrão (todos os dias para não bloquear)
        console.log('📅 [Agenda] Nenhuma agenda encontrada, usando valores padrão');
        setFormDiasFuncionamento(["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"]);
        setFormHorarioComercial(criarHorarioPadrao());
      }
    } catch (error) {
      console.error("Erro ao carregar horário comercial do formulário:", error);
    }
  };

  // Carregar compromissos existentes para o dia selecionado no formulário
  // IMPORTANTE: Filtra por agenda_id para garantir individualidade de cada agenda
  const carregarFormCompromissos = async () => {
    try {
      const dataInicio = new Date(formData.data + "T00:00:00");
      const dataFim = new Date(formData.data + "T23:59:59");
      let query = supabase.from("compromissos").select("id, data_hora_inicio, data_hora_fim, agenda_id, profissional_id").gte("data_hora_inicio", dataInicio.toISOString()).lte("data_hora_inicio", dataFim.toISOString());

      // Se uma agenda específica foi selecionada, filtrar por agenda_id OU profissional_id
      // Isso garante sincronização com compromissos criados tanto pelo CRM quanto pelo app Waze Agenda
      if (formData.agenda_id && formAgendaSelecionada) {
        const responsavelId = formAgendaSelecionada.responsavel_id;
        if (responsavelId) {
          // Filtrar por agenda_id OU profissional_id para capturar todos os compromissos do colaborador
          query = query.or(`agenda_id.eq.${formData.agenda_id},profissional_id.eq.${responsavelId}`);
          console.log('📅 [Agenda] Filtrando compromissos por agenda_id ou profissional_id:', formData.agenda_id, responsavelId);
        } else {
          query = query.eq("agenda_id", formData.agenda_id);
          console.log('📅 [Agenda] Filtrando compromissos por agenda_id:', formData.agenda_id);
        }
      } else if (formData.agenda_id) {
        query = query.eq("agenda_id", formData.agenda_id);
        console.log('📅 [Agenda] Filtrando compromissos por agenda_id:', formData.agenda_id);
      } else {
        // Se nenhuma agenda foi selecionada (agenda geral), buscar compromissos sem agenda_id
        // ou criar uma query para a agenda principal do usuário
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          const {
            data: agendaPrincipal
          } = await supabase.from("agendas").select("id, responsavel_id").eq("owner_id", user.id).eq("tipo", "principal").single();
          if (agendaPrincipal) {
            if (agendaPrincipal.responsavel_id) {
              // Buscar compromissos da agenda principal OU compromissos do profissional vinculado OU compromissos sem agenda
              query = query.or(`agenda_id.eq.${agendaPrincipal.id},profissional_id.eq.${agendaPrincipal.responsavel_id},agenda_id.is.null`);
            } else {
              // Buscar compromissos da agenda principal OU compromissos sem agenda
              query = query.or(`agenda_id.eq.${agendaPrincipal.id},agenda_id.is.null`);
            }
            console.log('📅 [Agenda] Filtrando compromissos da agenda principal:', agendaPrincipal.id);
          }
        }
      }
      const {
        data: compromissos
      } = await query;
      console.log('📅 [Agenda] Compromissos carregados para a agenda:', compromissos?.length || 0);
      setFormCompromissosExistentes(compromissos || []);
    } catch (error) {
      console.error("Erro ao carregar compromissos do formulário:", error);
    }
  };

  // Função para selecionar horário no formulário
  const handleSelecionarHorarioForm = (horario: string) => {
    setFormData(prev => ({
      ...prev,
      hora_inicio: horario
    }));
  };

  // Carregar horário comercial, compromissos e configurações quando a data, agenda ou dialog mudar
  useEffect(() => {
    if (formData.data && novoCompromissoOpen) {
      carregarFormHorarioComercial();
      carregarFormCompromissos();
      // Garantir que as configurações estão carregadas ao abrir o popup
      carregarConfiguracoes();
      console.log('📅 [Agenda] Popup aberto - tempoMedioPadrao atual:', tempoMedioPadrao, '- Agenda:', formData.agenda_id || 'principal');
    }
  }, [formData.data, formData.agenda_id, novoCompromissoOpen]); // Adicionado formData.agenda_id para recarregar ao mudar agenda

  const criarCompromisso = async () => {
    try {
      // === VALIDAÇÕES FRONTEND ===

      // 1. Validar data e horários
      if (!formData.data || !formData.hora_inicio) {
        toast.error("Por favor, preencha data, horário e duração");
        return;
      }
      const dataHoraInicio = new Date(`${formData.data}T${formData.hora_inicio}:00`);
      const duracaoMin = formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao;
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracaoMin * 60000);

      // 3. Validar se data/hora não está no passado (com margem de 1 minuto para evitar falsos positivos)
      const agora = new Date();
      const umMinutoAtras = new Date(agora.getTime() - 60000); // 1 minuto de margem

      if (dataHoraInicio < umMinutoAtras) {
        toast.error("Não é possível agendar compromissos no passado");
        return;
      }

      // 4. Validar se hora fim é depois da hora início
      if (dataHoraFim <= dataHoraInicio) {
        toast.error("O horário de término deve ser após o horário de início");
        return;
      }

      // 5. Validar duração mínima (15 minutos)
      const duracaoMinutos = (dataHoraFim.getTime() - dataHoraInicio.getTime()) / (1000 * 60);
      if (duracaoMinutos < 15) {
        toast.error("O compromisso deve ter no mínimo 15 minutos de duração");
        return;
      }

      // 6. Validar valor estimado se preenchido
      if (formData.custo_estimado && parseFloat(formData.custo_estimado) < 0) {
        toast.error("O valor estimado não pode ser negativo");
        return;
      }

      // === AUTENTICAÇÃO ===
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para criar um compromisso");
        throw new Error("Usuário não autenticado");
      }
      console.log('🔍 [DEBUG] Criando compromisso para usuário:', user.id);

      // Obter company_id do usuário ANTES de criar compromisso
      const {
        data: userRole,
        error: userRoleError
      } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
      if (userRoleError) {
        console.error('❌ [DEBUG] Erro ao buscar user_role:', userRoleError);
        throw new Error(`Erro ao obter informações da empresa: ${userRoleError.message}`);
      }
      if (!userRole || !userRole.company_id) {
        console.error('❌ [DEBUG] userRole ou company_id não encontrado:', {
          userRole
        });
        toast.error("Erro: Usuário não está associado a nenhuma empresa. Por favor, entre em contato com o administrador.");
        throw new Error("Usuário não está associado a nenhuma empresa. company_id é obrigatório.");
      }
      console.log('✅ [DEBUG] company_id obtido:', userRole.company_id);
      console.log('📋 [DEBUG] Dados do formulário:', {
        titulo: formData.titulo,
        tipo_servico: formData.tipo_servico,
        data: formData.data,
        hora_inicio: formData.hora_inicio,
        duracao_minutos: formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao,
        agenda_id: formData.agenda_id || 'nenhuma',
        lead_id: formData.lead_id || 'nenhum',
        custo_estimado: formData.custo_estimado || '0'
      });

      // Validar agenda se selecionada
      if (formData.agenda_id) {
        // Carregar agendas se ainda não foram carregadas
        let agendasDisponiveis = agendas;
        if (agendasDisponiveis.length === 0) {
          const {
            data: agendasData
          } = await supabase.from('agendas').select('*').eq('status', 'ativo');
          agendasDisponiveis = (agendasData || []) as any[];
        }
        const agendaSelecionada = agendasDisponiveis.find(a => a.id === formData.agenda_id);
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
        const diaValido = !diasConfig ||
        // Se não tem config, aceita qualquer dia
        diasConfig.includes(diaSemanaCompleto) || diasConfig.includes(diaSemanaAbreviado);
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
        const [horaInicio, minutoInicio] = formData.hora_inicio.split(':').map(Number);
        const duracaoMin = formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao;
        const inicioSolicitado = horaInicio * 60 + minutoInicio;
        const fimSolicitado = inicioSolicitado + duracaoMin;
        if (inicioSolicitado < inicioDisponivel || fimSolicitado > fimDisponivel) {
          toast.error(`O horário está fora do horário de funcionamento da agenda (${horarioInicioStr} - ${horarioFimStr})`);
          return;
        }

        // Validar capacidade simultânea
        const {
          data: compromissosAgenda,
          error: capacidadeError
        } = await supabase.from('compromissos').select('id').eq('agenda_id', formData.agenda_id).eq('status', 'agendado').lt('data_hora_inicio', dataHoraFim.toISOString()).gt('data_hora_fim', dataHoraInicio.toISOString());
        if (capacidadeError) {
          console.error('❌ [DEBUG] Erro ao verificar capacidade:', capacidadeError);
          throw capacidadeError;
        }
        const ocupacaoAtual = compromissosAgenda?.length || 0;
        if (ocupacaoAtual >= agendaSelecionada.capacidade_simultanea) {
          toast.error(`A agenda "${agendaSelecionada.nome}" já está com capacidade máxima (${agendaSelecionada.capacidade_simultanea} compromissos simultâneos)`);
          return;
        }
      }

      // Checar conflito de horários (por usuário responsável, status agendado)
      // Se agenda_id foi selecionado, também verificar conflitos na agenda
      console.log('🔍 [DEBUG] Verificando conflitos de horário...', {
        dataHoraInicio: dataHoraInicio.toISOString(),
        dataHoraFim: dataHoraFim.toISOString(),
        agenda_id: formData.agenda_id || 'nenhuma',
        usuario_id: user.id
      });
      const conflitosQuery = supabase.from('compromissos').select('id, data_hora_inicio, data_hora_fim').eq('status', 'agendado').lt('data_hora_inicio', dataHoraFim.toISOString()).gt('data_hora_fim', dataHoraInicio.toISOString());
      if (formData.agenda_id) {
        conflitosQuery.eq('agenda_id', formData.agenda_id);
      } else {
        conflitosQuery.eq('usuario_responsavel_id', user.id);
      }
      const {
        data: conflitos,
        error: conflitoError
      } = await conflitosQuery;
      if (conflitoError) {
        console.error('❌ [DEBUG] Erro ao verificar conflitos:', {
          message: conflitoError.message,
          code: (conflitoError as any).code,
          details: (conflitoError as any).details,
          hint: (conflitoError as any).hint
        });
        // Não bloquear criação por erro na verificação de conflitos, apenas logar
        console.warn('⚠️ [DEBUG] Continuando apesar do erro na verificação de conflitos');
      } else {
        console.log('✅ [DEBUG] Verificação de conflitos concluída. Encontrados:', conflitos?.length || 0);
      }
      if (conflitos && conflitos.length > 0) {
        console.warn('⚠️ [DEBUG] Conflitos encontrados:', conflitos);
        const mensagem = formData.agenda_id ? "Conflito de horário: já existe um compromisso nessa agenda nesse intervalo" : "Conflito de horário: já existe um compromisso nesse intervalo";
        toast.error(mensagem);
        return;
      }

      // Criar compromisso COM company_id e agenda_id
      // Garantir que tipo_servico não seja string vazia
      const tipoServicoFinal = formData.tipo_servico?.trim() || 'outro';

      // Buscar dados do lead selecionado para preencher paciente e telefone
      const leadSelecionadoData = formData.lead_id ? leads.find(l => l.id === formData.lead_id) : null;

      // Preparar dados do compromisso - APENAS campos obrigatórios e válidos
      const compromissoData: any = {
        // Campos obrigatórios (NOT NULL)
        usuario_responsavel_id: user.id,
        owner_id: user.id,
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        tipo_servico: tipoServicoFinal
      };

      // Adicionar campos opcionais apenas se tiverem valores válidos (não vazios)
      const agendaId = formData.agenda_id?.trim();
      if (agendaId && agendaId.length > 0) {
        compromissoData.agenda_id = agendaId;
        
        // IMPORTANTE: Se uma agenda foi selecionada, definir o profissional_id 
        // baseado no responsavel_id da agenda para sincronização com app Waze Agenda
        if (formAgendaSelecionada?.responsavel_id) {
          compromissoData.profissional_id = formAgendaSelecionada.responsavel_id;
          console.log('📅 [Agenda] Definindo profissional_id baseado na agenda:', formAgendaSelecionada.responsavel_id);
        }
      } else {
        compromissoData.agenda_id = null; // Explicitamente null se vazio
      }
      const leadId = formData.lead_id?.trim();
      if (leadId && leadId.length > 0) {
        compromissoData.lead_id = leadId;
      } else {
        compromissoData.lead_id = null; // Explicitamente null se vazio
      }

      // company_id é opcional mas recomendado
      if (userRole.company_id) {
        compromissoData.company_id = userRole.company_id;
      }

      // status tem default 'agendado', mas vamos definir explicitamente
      compromissoData.status = 'agendado';

      // Campos opcionais de texto
      if (formData.observacoes?.trim()) {
        compromissoData.observacoes = formData.observacoes.trim();
      }

      // Preencher titulo com tipo_servico formatado
      compromissoData.titulo = tipoServicoFinal.charAt(0).toUpperCase() + tipoServicoFinal.slice(1);

      // Convidar lead por e-mail no Google Calendar (opcional)
      compromissoData.convidar_lead_email = !!formData.convidar_lead_email;
      const emailConvidadoFinal = (formData.email_convidado?.trim() || leadSelecionadoData?.email || '').trim();
      if (formData.convidar_lead_email && emailConvidadoFinal) {
        compromissoData.email_convidado = emailConvidadoFinal;
      }

      // Preencher paciente e telefone com dados do lead para compatibilidade com app Waze Agenda
      if (leadSelecionadoData) {
        compromissoData.paciente = leadSelecionadoData.name;
        const telefoneDoLead = leadSelecionadoData.phone || leadSelecionadoData.telefone;
        if (telefoneDoLead) {
          compromissoData.telefone = telefoneDoLead;
        }
      }

      // Custo estimado - validar antes de adicionar
      if (formData.custo_estimado) {
        const custo = parseFloat(formData.custo_estimado);
        if (!isNaN(custo) && custo > 0) {
          compromissoData.custo_estimado = custo;
        }
      }

      // Log dos dados antes de inserir para debug
      console.log('📤 [DEBUG] Dados que serão inseridos:', JSON.stringify(compromissoData, null, 2));

      // Tentar inserir o compromisso
      let {
        data: compromisso,
        error
      } = await supabase.from('compromissos').insert(compromissoData).select().single();

      // Se houver erro, tentar identificar e corrigir
      if (error) {
        const errorMessage = error.message || '';
        const errorCode = (error as any).code || '';
        const errorDetails = (error as any).details || '';
        const errorHint = (error as any).hint || '';
        console.error('🔍 [DEBUG] Erro detalhado recebido:', {
          message: errorMessage,
          code: errorCode,
          details: errorDetails,
          hint: errorHint,
          fullError: error
        });

        // Tentar corrigir erros conhecidos
        let shouldRetry = false;
        const retryData = {
          ...compromissoData
        };

        // Erro de coluna não encontrada (titulo ou outros)
        if (errorCode === 'PGRST204' || errorMessage.toLowerCase().includes('column') || errorMessage.toLowerCase().includes('titulo')) {
          console.warn('⚠️ [DEBUG] Erro de coluna não encontrada, removendo campos problemáticos...');
          // Remover qualquer campo que possa não existir
          delete retryData.titulo;
          shouldRetry = true;
        }

        // Erro de foreign key - remover referências inválidas
        if (errorCode === '23503') {
          if (errorMessage.includes('agenda_id') && retryData.agenda_id) {
            console.warn('⚠️ [DEBUG] agenda_id inválido, removendo...');
            delete retryData.agenda_id;
            shouldRetry = true;
          }
          if (errorMessage.includes('lead_id') && retryData.lead_id) {
            console.warn('⚠️ [DEBUG] lead_id inválido, removendo...');
            delete retryData.lead_id;
            shouldRetry = true;
          }
          if (errorMessage.includes('company_id') && retryData.company_id) {
            console.warn('⚠️ [DEBUG] company_id inválido, removendo...');
            delete retryData.company_id;
            shouldRetry = true;
          }
        }

        // Tentar novamente se identificamos o problema
        if (shouldRetry) {
          console.log('🔄 [DEBUG] Tentando novamente com dados corrigidos:', JSON.stringify(retryData, null, 2));
          const retryResult = await supabase.from('compromissos').insert(retryData).select().single();
          compromisso = retryResult.data;
          error = retryResult.error;
          if (!error) {
            console.log('✅ [DEBUG] Compromisso criado com sucesso após correção!');
          }
        }
      }
      if (error) {
        const errorMessage = error.message || '';
        const errorCode = (error as any).code || '';
        const errorDetails = (error as any).details || '';
        const errorHint = (error as any).hint || '';

        // Log completo do erro de forma legível
        console.error('❌ [DEBUG] Erro ao criar compromisso:');
        console.error('  Mensagem:', errorMessage || '(vazia)');
        console.error('  Código:', errorCode || '(vazio)');
        console.error('  Detalhes:', errorDetails || '(vazio)');
        console.error('  Hint:', errorHint || '(vazio)');

        // Tentar serializar o erro completo
        try {
          const errorObj = {
            message: error.message,
            code: (error as any).code,
            details: (error as any).details,
            hint: (error as any).hint,
            name: error.name,
            stack: error.stack
          };
          console.error('  Erro completo (serializado):', JSON.stringify(errorObj, null, 2));
        } catch (e) {
          console.error('  Erro completo (objeto):', error);
        }
        console.error('  Dados tentados:', JSON.stringify(compromissoData, null, 2));

        // Mensagens de erro mais específicas baseadas no tipo de erro
        if (errorCode === '23503') {
          // Foreign key violation
          if (errorMessage.includes('company_id')) {
            toast.error("Erro: Empresa não identificada. Entre em contato com o suporte.");
          } else if (errorMessage.includes('usuario_responsavel_id') || errorMessage.includes('owner_id')) {
            toast.error("Erro: Usuário responsável não identificado.");
          } else if (errorMessage.includes('agenda_id')) {
            toast.error("Erro: Agenda selecionada não encontrada.");
          } else if (errorMessage.includes('lead_id')) {
            toast.error("Erro: Lead selecionado não encontrado.");
          } else {
            toast.error("Erro: Referência inválida. Verifique os dados selecionados.");
          }
        } else if (errorCode === '23505') {
          // Unique violation
          toast.error("Erro: Já existe um compromisso com esses dados.");
        } else if (errorCode === '23514') {
          // Check constraint violation
          toast.error("Erro: Os dados fornecidos não atendem aos requisitos.");
        } else if (errorCode === 'PGRST204' || errorMessage.toLowerCase().includes('titulo')) {
          toast.error("Erro: Problema com a estrutura do banco de dados. Tente novamente.");
        } else if (errorMessage.includes('null value') || errorMessage.includes('NOT NULL')) {
          toast.error("Erro: Campos obrigatórios não preenchidos. Verifique o formulário.");
        } else if (errorMessage.includes('violates check constraint')) {
          toast.error("Erro: Os dados fornecidos não atendem aos requisitos.");
        } else {
          toast.error(`Erro ao criar compromisso: ${errorMessage || errorCode || 'Erro desconhecido'}`);
        }
        throw error;
      }
      console.log('✅ [DEBUG] Compromisso criado com sucesso:', compromisso?.id);

      // 🗓️ Auto-push para Google Calendar (não-bloqueante, ignora erros)
      if (compromisso?.id) {
        supabase.functions
          .invoke("google-calendar-event", { body: { action: "create", compromisso_id: compromisso.id } })
          .then(({ error: gcalErr }) => {
            if (gcalErr) console.warn("[gcal] sync skipped:", gcalErr.message);
          })
          .catch((e) => console.warn("[gcal] sync skipped:", e?.message));
      }


      // ⚡ CRIAR LEMBRETE AUTOMATICAMENTE PARA TODO COMPROMISSO (OBRIGATÓRIO)
      if (compromisso) {
        console.log('📝 [LEMBRETE] Criando lembrete automaticamente para compromisso:', compromisso.id);
        try {
          // Validar que company_id existe
          if (!userRole.company_id) {
            console.error('❌ [LEMBRETE] company_id não disponível');
            toast.warning("Compromisso criado, mas lembrete não foi criado. Usuário não está associado a uma empresa.");
          } else {
            // Processar tempo de antecedência (usar valores do formulário ou padrão)
            let horas = parseInt(formData.horas_antecedencia_horas || "0", 10);
            let minutos = parseInt(formData.horas_antecedencia_minutos || "0", 10);

            // Se não informado ou inválido, usar valores padrão (1 hora antes)
            if (horas === 0 && minutos === 0) {
              console.log('ℹ️ [LEMBRETE] Usando valores padrão: 1 hora de antecedência');
              horas = 1;
              minutos = 0;
            }

            // Validar valores
            if (horas < 0) horas = 1;
            if (minutos < 0 || minutos >= 60) minutos = 0;

            // Converter horas e minutos para formato decimal (garantir precisão)
            const tempoAntecedenciaDecimal = parseFloat((horas + minutos / 60).toFixed(4));

            // Calcular data de envio do lembrete baseada na data do compromisso
            const dataEnvio = new Date(dataHoraInicio);
            dataEnvio.setTime(dataEnvio.getTime() - tempoAntecedenciaDecimal * 60 * 60 * 1000);

            // Buscar lead se houver para personalizar mensagem
            const leadSelecionado = leads.find(l => l.id === formData.lead_id);
            const leadNome = leadSelecionado?.name || 'Cliente';

            // Mensagem personalizada do lembrete
            const mensagemLembrete = `Olá ${leadNome}! Lembramos do seu compromisso agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR
            })}.`;

            // Preparar dados do lembrete - usar NUMERIC para horas_antecedencia
            const lembreteData = {
              compromisso_id: compromisso.id,
              canal: 'whatsapp',
              horas_antecedencia: tempoAntecedenciaDecimal,
              // NUMERIC aceita decimais
              mensagem: mensagemLembrete,
              status_envio: 'pendente',
              data_envio: dataEnvio.toISOString(),
              destinatario: formData.destinatario_lembrete || 'lead',
              telefone_responsavel: leadSelecionado?.phone || leadSelecionado?.telefone || null,
              company_id: userRole.company_id
            };
            console.log('📝 [LEMBRETE] Dados do lembrete:', {
              compromisso_id: lembreteData.compromisso_id,
              data_envio: lembreteData.data_envio,
              horas_antecedencia: lembreteData.horas_antecedencia,
              horas_antecedencia_tipo: typeof lembreteData.horas_antecedencia,
              destinatario: lembreteData.destinatario,
              data_compromisso: dataHoraInicio.toISOString()
            });

            // Criar lembrete de forma síncrona e garantida
            let lembreteCriado = null;
            let lembreteError = null;

            // Tentar inserir com valor decimal
            const resultado = await supabase.from('lembretes').insert(lembreteData).select().single();
            lembreteCriado = resultado.data;
            lembreteError = resultado.error;

            // Se erro for de tipo INTEGER, tentar novamente arredondando para inteiro (fallback temporário)
            if (lembreteError && (lembreteError.message?.includes('integer') || lembreteError.message?.includes('INTEGER'))) {
              console.warn('⚠️ [LEMBRETE] Erro de tipo INTEGER detectado, tentando com valor arredondado (fallback)...');

              // Criar novo objeto com valor arredondado para inteiro (horas completas)
              const lembreteDataFallback = {
                ...lembreteData,
                horas_antecedencia: Math.round(tempoAntecedenciaDecimal) || 1 // Arredondar para horas completas
              };

              // Recalcular data de envio com valor arredondado
              const dataEnvioFallback = new Date(dataHoraInicio);
              dataEnvioFallback.setTime(dataEnvioFallback.getTime() - lembreteDataFallback.horas_antecedencia * 60 * 60 * 1000);
              lembreteDataFallback.data_envio = dataEnvioFallback.toISOString();
              console.log('🔄 [LEMBRETE] Tentando novamente com valor arredondado:', lembreteDataFallback.horas_antecedencia);
              const retryResult = await supabase.from('lembretes').insert(lembreteDataFallback).select().single();
              lembreteCriado = retryResult.data;
              lembreteError = retryResult.error;
              if (!lembreteError) {
                console.log('✅ [LEMBRETE] Lembrete criado com valor arredondado (fallback temporário)');
                toast.warning(`Lembrete criado com ${lembreteDataFallback.horas_antecedencia} hora(s) de antecedência (arredondado). Para usar minutos, execute a migração SQL.`, {
                  duration: 8000
                });
              }
            }
            if (lembreteError) {
              console.error('❌ [LEMBRETE] Erro ao criar lembrete:', lembreteError);
              console.error('❌ [LEMBRETE] Dados que causaram erro:', {
                compromisso_id: lembreteData.compromisso_id,
                horas_antecedencia: lembreteData.horas_antecedencia,
                tipo_horas_antecedencia: typeof lembreteData.horas_antecedencia,
                data_envio: lembreteData.data_envio,
                erro_completo: JSON.stringify(lembreteError, null, 2)
              });
              toast.error(`Erro ao criar lembrete. Execute o SQL em APLICAR_MIGRACAO_LEMBRETES.sql no Supabase Dashboard para corrigir.`, {
                duration: 10000
              });
            } else {
              console.log('✅ [LEMBRETE] Lembrete criado automaticamente e sincronizado:', lembreteCriado?.id);
              console.log('📅 [LEMBRETE] Data de envio calculada:', dataEnvio.toISOString());
              console.log('📅 [LEMBRETE] Data do compromisso:', dataHoraInicio.toISOString());
              console.log('⏰ [LEMBRETE] Antecedência:', tempoAntecedenciaDecimal, 'horas');
              console.log('🔗 [LEMBRETE] Vinculado ao compromisso:', compromisso.id);
            }

            // 🔁 Lembretes ADICIONAIS — WhatsApp 24h antes + E-mail 24h antes
            const dataEnvio24h = new Date(dataHoraInicio.getTime() - 24 * 3600000);
            if (dataEnvio24h > new Date()) {
              const leadEmail = leadSelecionado?.email;
              const baseMsg = `Olá ${leadNome}! Lembrete: você tem ${tipoServicoFinal} agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`;
              const extras: any[] = [];
              if (formData.lembrete_whatsapp_24h && (leadSelecionado?.phone || leadSelecionado?.telefone)) {
                extras.push({
                  compromisso_id: compromisso.id,
                  canal: 'whatsapp',
                  horas_antecedencia: 24,
                  mensagem: baseMsg,
                  status_envio: 'pendente',
                  data_envio: dataEnvio24h.toISOString(),
                  destinatario: 'lead',
                  telefone_responsavel: leadSelecionado?.phone || leadSelecionado?.telefone || null,
                  company_id: userRole.company_id,
                });
              }
              if (formData.lembrete_email_24h && leadEmail) {
                extras.push({
                  compromisso_id: compromisso.id,
                  canal: 'email',
                  horas_antecedencia: 24,
                  mensagem: baseMsg,
                  status_envio: 'pendente',
                  data_envio: dataEnvio24h.toISOString(),
                  destinatario: 'lead',
                  company_id: userRole.company_id,
                });
              }
              if (extras.length > 0) {
                const { error: extrasErr } = await supabase.from('lembretes').insert(extras);
                if (extrasErr) console.warn('⚠️ [LEMBRETE] Falha ao criar lembretes 24h:', extrasErr);
                else console.log(`✅ [LEMBRETE] ${extras.length} lembrete(s) extras de 24h criado(s)`);
              }
            }
          }
        } catch (error: any) {
          console.error('❌ [LEMBRETE] Erro ao criar lembrete:', error);
          toast.error(`Erro ao criar lembrete: ${error?.message || 'Erro desconhecido'}`);
          // Não lançar erro para não impedir o compromisso
        }
      }

      // Enviar mensagem de confirmação imediata se solicitado
      if (formData.enviar_confirmacao && compromisso && formData.lead_id) {
        try {
          const leadSelecionado = leads.find(l => l.id === formData.lead_id);
          if (leadSelecionado && (leadSelecionado.phone || leadSelecionado.telefone)) {
            const telefone = normalizePhoneBR(leadSelecionado.phone || leadSelecionado.telefone || '');
            if (telefone) {
              // Mensagem de confirmação formatada e personalizada
              const tipoServicoFormatado = formData.tipo_servico?.trim() ? formData.tipo_servico.charAt(0).toUpperCase() + formData.tipo_servico.slice(1) : null;
              const mensagemConfirmacao = `✅ *Compromisso Confirmado!*\n\n` + `Olá ${leadSelecionado.name}! Seu compromisso foi agendado com sucesso.\n\n` + `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", {
                locale: ptBR
              })}\n` + `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", {
                locale: ptBR
              })} às ${format(dataHoraFim, "HH:mm", {
                locale: ptBR
              })}\n` + (tipoServicoFormatado ? `📋 *Tipo:* ${tipoServicoFormatado}\n` : '') + (
              // Título removido - coluna não existe no banco
              formData.observacoes ? `\n💬 *Observações:*\n${formData.observacoes}\n` : '') + `\n✅ *Status:* Agendado\n\n` + `Aguardamos você no dia e horário agendados!\n\n` + `_Esta é uma confirmação automática do seu agendamento._`;
              console.log('📱 [CONFIRMAÇÃO] Enviando mensagem de confirmação imediata...');
              const {
                error: confirmacaoError
              } = await supabase.functions.invoke('enviar-whatsapp', {
                body: {
                  numero: telefone,
                  mensagem: mensagemConfirmacao,
                  company_id: userRole.company_id
                }
              });
              if (confirmacaoError) {
                console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', confirmacaoError);
                toast.warning("Compromisso criado, mas não foi possível enviar a confirmação imediata.");
              } else {
                console.log('✅ [CONFIRMAÇÃO] Mensagem de confirmação enviada com sucesso!');

                // Salvar mensagem de confirmação na tabela conversas para ficar visível no CRM
                try {
                  const {
                    data: {
                      user
                    }
                  } = await supabase.auth.getUser();
                  const {
                    data: userProfile
                  } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : {
                    data: null
                  };
                  const {
                    error: dbError
                  } = await supabase.from('conversas').insert([{
                    numero: telefone,
                    telefone_formatado: telefone,
                    mensagem: mensagemConfirmacao,
                    origem: 'WhatsApp',
                    status: 'Enviada',
                    tipo_mensagem: 'text',
                    nome_contato: leadSelecionado.name,
                    company_id: userRole.company_id,
                    lead_id: formData.lead_id,
                    owner_id: user?.id,
                    sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
                    fromme: true,
                    delivered: true,
                    read: false
                  }]);
                  if (dbError) {
                    console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', dbError);
                  } else {
                    console.log('✅ [CONFIRMAÇÃO] Mensagem salva no banco de dados com sucesso!');
                  }
                } catch (saveError) {
                  console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', saveError);
                }
                toast.success("Compromisso criado e confirmação enviada ao cliente!");
              }
            }
          }
        } catch (error) {
          console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', error);
          toast.warning("Compromisso criado, mas houve erro ao enviar a confirmação.");
        }
      }

      // Enviar notificação push para o responsável se solicitado
      if (formData.notificar_responsavel && compromisso) {
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const tipoServicoNotif = formData.tipo_servico || 'Compromisso';
            const mensagemNotificacao = `Novo compromisso agendado: ${tipoServicoNotif}\n` + `${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR
            })}`;
            new Notification('Novo Compromisso Agendado', {
              body: mensagemNotificacao,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `compromisso-${compromisso.id}`,
              requireInteraction: false
            });
            console.log('🔔 [NOTIFICAÇÃO] Notificação push enviada ao responsável');
          } else if ('Notification' in window && Notification.permission !== 'denied') {
            // Solicitar permissão se ainda não foi solicitada
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const tipoServicoNotif = formData.tipo_servico || 'Compromisso';
              const mensagemNotificacao = `Novo compromisso agendado: ${tipoServicoNotif}\n` + `${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR
              })}`;
              new Notification('Novo Compromisso Agendado', {
                body: mensagemNotificacao,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `compromisso-${compromisso.id}`
              });
              console.log('🔔 [NOTIFICAÇÃO] Permissão concedida e notificação enviada');
            }
          }
        } catch (error) {
          console.error('❌ [NOTIFICAÇÃO] Erro ao enviar notificação push:', error);
          // Não mostrar erro ao usuário, pois é opcional
        }
      }

      // Lembrete já foi criado acima, logo após o compromisso

      // Mensagem de sucesso mais informativa
      if (formData.enviar_confirmacao && formData.notificar_responsavel) {
        toast.success("Compromisso criado! Confirmação enviada e você foi notificado.");
      } else if (formData.enviar_confirmacao) {
        toast.success("Compromisso criado e confirmação enviada ao cliente!");
      } else if (formData.notificar_responsavel) {
        toast.success("Compromisso criado e você foi notificado!");
      } else {
        toast.success("Compromisso criado com sucesso!");
      }

      // Emitir evento global para sincronização
      if (compromisso) {
        emitGlobalEvent({
          type: 'meeting-scheduled',
          data: {
            ...compromisso,
            lead_id: formData.lead_id,
            title: formData.tipo_servico,
            date: dataHoraInicio.toISOString(),
            duration: (dataHoraFim.getTime() - dataHoraInicio.getTime()) / (1000 * 60),
            // duração em minutos
            status: 'scheduled',
            description: formData.observacoes
          },
          source: 'Agenda'
        });
      }
      setNovoCompromissoOpen(false);
      limparFormulario();

      // Adicionar compromisso recém-criado diretamente à lista para aparecer instantaneamente
      if (compromisso) {
        // Buscar dados completos do compromisso com relacionamentos
        const {
          data: compromissoCompleto
        } = await supabase.from('compromissos').select(`
            *,
            lead:leads(name, phone),
            agenda:agendas(nome, tipo)
          `).eq('id', compromisso.id).single();
        if (compromissoCompleto) {
          setCompromissos(prev => {
            // Verificar se já existe para evitar duplicatas
            const exists = prev.some(c => c.id === compromissoCompleto.id);
            if (exists) return prev;
            // Adicionar ao início da lista
            return [compromissoCompleto, ...prev].sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime());
          });
        }
      }

      // Também recarregar o mês para garantir sincronização completa (forçar recarregamento)
      await carregarCompromissosDoMes(undefined, true);

      // Realtime também atualizará, mas garantimos atualização imediata
    } catch (error: any) {
      // Log completo do erro de forma legível no catch
      console.error('❌ [ERRO DETALHADO] Erro ao criar compromisso:');
      console.error('  Mensagem:', error?.message || '(vazia)');
      console.error('  Código:', error?.code || '(vazio)');
      console.error('  Detalhes:', error?.details || '(vazio)');
      console.error('  Hint:', error?.hint || '(vazio)');

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
        console.error('  Erro completo (serializado):', JSON.stringify(errorObj, null, 2));
      } catch (e) {
        console.error('  Erro completo (objeto):', error);
      }
      console.error('  FormData:', {
        tipo_servico: formData.tipo_servico,
        data: formData.data,
        horarios: `${formData.hora_inicio} + ${formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao}min`,
        agenda: formData.agenda_id || 'nenhuma',
        lead: formData.lead_id || 'nenhum'
      });

      // Se não mostrou mensagem específica antes, mostrar genérica
      // Verificar se já foi exibida uma mensagem de erro específica
      const errorMessage = error?.message || '';
      const errorCode = error?.code || '';
      const jaMostrouErro = errorMessage.includes('Erro:') || errorMessage.toLowerCase().includes('titulo') || errorCode === 'PGRST204';
      if (!jaMostrouErro) {
        toast.error("Erro ao criar compromisso. Verifique os campos e tente novamente.");
      }
    }
  };
  const atualizarStatus = async (id: string, novoStatus: string) => {
    try {
      // Buscar dados do compromisso antes de atualizar para notificação
      const compromissoAtual = compromissos.find(c => c.id === id);
      const {
        error
      } = await supabase.from('compromissos').update({
        status: novoStatus
      }).eq('id', id);
      if (error) throw error;

      // 🗓️ Sync para Google: delete se cancelado, update caso contrário
      supabase.functions.invoke("google-calendar-event", {
        body: { action: novoStatus === "cancelado" ? "delete" : "update", compromisso_id: id }
      }).catch((e) => console.warn("[gcal] sync skipped:", e?.message));


      // Enviar notificação de cancelamento se status mudou para 'cancelado' e tiver lead
      if (novoStatus === 'cancelado' && compromissoAtual?.lead_id) {
        try {
          const {
            data: leadData
          } = await supabase.from('leads').select('name, phone, telefone').eq('id', compromissoAtual.lead_id).single();
          if (leadData && (leadData.phone || leadData.telefone)) {
            const telefone = leadData.phone || leadData.telefone;
            if (telefone) {
              // Obter company_id do usuário
              const {
                data: {
                  user
                }
              } = await supabase.auth.getUser();
              if (user) {
                const {
                  data: userRole
                } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
                if (userRole?.company_id) {
                  const dataHoraInicio = new Date(compromissoAtual.data_hora_inicio);
                  const dataHoraFim = new Date(compromissoAtual.data_hora_fim);
                  const tipoServicoFormatado = compromissoAtual.tipo_servico ? compromissoAtual.tipo_servico.charAt(0).toUpperCase() + compromissoAtual.tipo_servico.slice(1) : 'Compromisso';
                  const mensagemCancelamento = `❌ *Compromisso Cancelado*\n\n` + `Olá ${leadData.name}! Infelizmente seu compromisso foi cancelado.\n\n` + `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", {
                    locale: ptBR
                  })}\n` + `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", {
                    locale: ptBR
                  })} às ${format(dataHoraFim, "HH:mm", {
                    locale: ptBR
                  })}\n` + `📋 *Tipo:* ${tipoServicoFormatado}\n` + `\n❌ *Status:* Cancelado\n\n` + `Entre em contato conosco se tiver dúvidas ou desejar reagendar.\n\n` + `_Esta é uma notificação automática de cancelamento._`;

                  // Normalizar telefone
                  const normalizePhoneBR = (phone: string) => {
                    const cleaned = phone.replace(/\D/g, '');
                    if (cleaned.length === 10 || cleaned.length === 11) {
                      return cleaned.length === 10 ? `55${cleaned}` : `55${cleaned}`;
                    }
                    return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                  };
                  const telefoneNormalizado = normalizePhoneBR(telefone);
                  const {
                    error: envioError
                  } = await supabase.functions.invoke('enviar-whatsapp', {
                    body: {
                      numero: telefoneNormalizado,
                      mensagem: mensagemCancelamento,
                      company_id: userRole.company_id
                    }
                  });

                  // Salvar mensagem no CRM para ficar visível
                  if (!envioError) {
                    try {
                      const {
                        data: {
                          user
                        }
                      } = await supabase.auth.getUser();
                      const {
                        data: userProfile
                      } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : {
                        data: null
                      };
                      await supabase.from('conversas').insert({
                        numero: telefoneNormalizado,
                        telefone_formatado: telefoneNormalizado,
                        mensagem: mensagemCancelamento,
                        origem: 'WhatsApp',
                        status: 'Enviada',
                        tipo_mensagem: 'text',
                        nome_contato: leadData.name,
                        company_id: userRole.company_id,
                        owner_id: user?.id,
                        sent_by: userProfile?.full_name || userProfile?.email || 'Equipe',
                        fromme: true,
                        created_at: new Date().toISOString(),
                        delivered: true,
                        read: false
                      });
                      console.log('✅ Mensagem de cancelamento salva no CRM');
                    } catch (dbError) {
                      console.error('❌ Erro ao salvar mensagem de cancelamento no CRM:', dbError);
                      // Não bloquear o processo se falhar ao salvar no CRM
                    }
                  }
                }
              }
            }
          }
        } catch (notifError) {
          console.error('Erro ao enviar notificação de cancelamento:', notifError);
          // Não bloquear a atualização se a notificação falhar
        }
      }
      toast.success("Status atualizado!");
      // Atualização otimista; realtime confirmará
      setCompromissos(prev => prev.map(c => c.id === id ? {
        ...c,
        status: novoStatus
      } : c));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error("Erro ao atualizar status");
    }
  };
  const deletarCompromisso = async (id: string) => {
    try {
      // 🗓️ Remover do Google Calendar antes de deletar
      supabase.functions.invoke("google-calendar-event", {
        body: { action: "delete", compromisso_id: id }
      }).catch((e) => console.warn("[gcal] delete skipped:", e?.message));

      // Primeiro deletar lembretes associados
      await supabase.from('lembretes').delete().eq('compromisso_id', id);

      // Depois deletar o compromisso
      const {
        error
      } = await supabase.from('compromissos').delete().eq('id', id);
      if (error) throw error;
      toast.success("Compromisso deletado com sucesso!");
      // Atualização otimista; realtime confirmará
      setCompromissos(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao deletar compromisso:', error);
      toast.error("Erro ao deletar compromisso");
    }
  };

  // Função para duplicar compromisso
  const duplicarCompromisso = async (compromisso: Compromisso) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      // Obter company_id
      const {
        data: userRole
      } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
      if (!userRole?.company_id) {
        toast.error("Erro: Empresa não identificada");
        return;
      }

      // Criar novo compromisso com dados do original
      // Adicionar 1 dia à data original para facilitar
      const dataOriginal = parseISO(compromisso.data_hora_inicio);
      const dataFimOriginal = parseISO(compromisso.data_hora_fim);
      const novaDataInicio = new Date(dataOriginal);
      novaDataInicio.setDate(novaDataInicio.getDate() + 1);
      const novaDataFim = new Date(dataFimOriginal);
      novaDataFim.setDate(novaDataFim.getDate() + 1);
      const novoCompromisso: any = {
        agenda_id: compromisso.agenda_id || null,
        lead_id: compromisso.lead_id || null,
        usuario_responsavel_id: user.id,
        owner_id: user.id,
        company_id: userRole.company_id,
        data_hora_inicio: novaDataInicio.toISOString(),
        data_hora_fim: novaDataFim.toISOString(),
        tipo_servico: compromisso.tipo_servico || 'outro',
        status: 'agendado',
        observacoes: compromisso.observacoes || null,
        custo_estimado: compromisso.custo_estimado || null
      };
      const {
        data: compromissoDuplicado,
        error
      } = await supabase.from('compromissos').insert(novoCompromisso).select().single();
      if (error) {
        console.error('Erro ao duplicar compromisso:', error);
        toast.error("Erro ao duplicar compromisso");
        return;
      }
      toast.success("Compromisso duplicado com sucesso!");
      // Recarregar compromissos
      await carregarCompromissos();
    } catch (error) {
      console.error('Erro ao duplicar compromisso:', error);
      toast.error("Erro ao duplicar compromisso");
    }
  };
  const limparFormulario = () => {
    console.log('🧹 [DEBUG] Limpando formulário de agendamento');
    setFormData({
      titulo: "",
      agenda_id: "",
      lead_id: "",
      data: format(new Date(), "yyyy-MM-dd"),
      hora_inicio: "09:00",
      duracao_minutos: tempoMedioPadrao.toString(),
      // Usar tempo médio configurado
      tipo_servico: "",
      // Limpar para forçar nova seleção
      observacoes: "",
      custo_estimado: "",
      enviar_lembrete: true,
      horas_antecedencia: "",
      horas_antecedencia_horas: "1",
      horas_antecedencia_minutos: "0",
      destinatario_lembrete: "lead",
      enviar_confirmacao: false,
      notificar_responsavel: true,
      convidar_lead_email: false,
      email_convidado: "",
      lembrete_email_24h: true,
      lembrete_whatsapp_24h: true,
    });
    setLeadSearch("");
    setSelectedLeadName("");
  };

  // Limpar formulário quando fechar o dialog
  useEffect(() => {
    if (!novoCompromissoOpen) {
      limparFormulario();
    }
  }, [novoCompromissoOpen]);

  // Memoizar compromissos do mês para evitar recálculos desnecessários
  const compromissosDoMes = useMemo(() => {
    const inicio = startOfMonth(selectedDate);
    const fim = endOfMonth(selectedDate);
    return compromissos.filter(c => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return dataCompromisso >= inicio && dataCompromisso <= fim;
    });
  }, [compromissos, selectedDate]);

  // Memoizar compromissos do dia com filtro de status
  const compromissosDoDia = useMemo(() => {
    return compromissos.filter(c => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return isSameDay(dataCompromisso, selectedDate);
    }).filter(c => {
      if (filterStatus === "all") return true;
      return c.status === filterStatus;
    });
  }, [compromissos, selectedDate, filterStatus]);

  // Memoizar compromissos filtrados para a lista
  const compromissosFiltrados = useMemo(() => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const fimHoje = new Date(hoje);
    fimHoje.setHours(23, 59, 59, 999);
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
    return compromissos.filter(c => {
      // Filtro de busca
      if (buscaCompromissos.trim()) {
        const busca = buscaCompromissos.toLowerCase();
        const tipoServico = (c.tipo_servico || "").toLowerCase();
        const nomeLead = (c.lead?.name || "").toLowerCase();
        const observacoes = (c.observacoes || "").toLowerCase();
        const nomeAgenda = (c.agenda?.nome || "").toLowerCase();
        if (!tipoServico.includes(busca) && !nomeLead.includes(busca) && !observacoes.includes(busca) && !nomeAgenda.includes(busca)) {
          return false;
        }
      }

      // Filtro de agenda
      if (filtroAgenda !== "all" && c.agenda_id !== filtroAgenda) {
        return false;
      }

      // Filtro de tipo de serviço
      if (filtroTipoServico !== "all" && c.tipo_servico !== filtroTipoServico) {
        return false;
      }

      // Filtro de período
      if (filtroPeriodo !== "all") {
        const dataCompromisso = parseISO(c.data_hora_inicio);
        if (filtroPeriodo === "hoje") {
          if (dataCompromisso < hoje || dataCompromisso > fimHoje) {
            return false;
          }
        } else if (filtroPeriodo === "semana") {
          if (dataCompromisso < inicioSemana || dataCompromisso > fimSemana) {
            return false;
          }
        } else if (filtroPeriodo === "mes") {
          if (dataCompromisso < inicioMes || dataCompromisso > fimMes) {
            return false;
          }
        }
      }

      // Filtro de responsável
      if (filtroResponsavel !== "all" && c.usuario_responsavel_id !== filtroResponsavel) {
        return false;
      }

      // Filtro de status
      if (filterStatus !== "all" && c.status !== filterStatus) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordenar por data/hora (mais recentes primeiro)
      return new Date(b.data_hora_inicio).getTime() - new Date(a.data_hora_inicio).getTime();
    });
  }, [compromissos, buscaCompromissos, filtroAgenda, filtroTipoServico, filtroPeriodo, filtroResponsavel, filterStatus]);

  // Obter lista de responsáveis únicos dos compromissos
  const responsaveisUnicos = useMemo(() => {
    const responsaveis = new Map<string, string>();
    compromissos.forEach(c => {
      if (c.usuario_responsavel_id && !responsaveis.has(c.usuario_responsavel_id)) {
        // Por enquanto usar o ID, depois pode buscar o nome do usuário
        responsaveis.set(c.usuario_responsavel_id, c.usuario_responsavel_id);
      }
    });
    return Array.from(responsaveis.entries()).map(([id, name]) => ({
      id,
      name
    }));
  }, [compromissos]);
  const getStatusBadge = (status: string) => {
    const badges = {
      agendado: <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>,
      concluido: <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>,
      cancelado: <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>
    };
    return badges[status] || badges.agendado;
  };
  const reenviarLembrete = async (lembreteId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('enviar-lembretes', {
        body: {
          lembrete_id: lembreteId,
          force: true
        }
      });
      if (error) throw error;
      toast.success("Lembrete reenviado com sucesso!");
      carregarLembretes();
    } catch (error) {
      console.error('Erro ao reenviar lembrete:', error);
      toast.error("Erro ao reenviar lembrete");
    }
  };
  const lembretesFiltrados = lembretes.filter(lembrete => {
    // Filtro especial "hoje" - lembretes para o dia atual
    if (filtroStatusLembrete === "hoje") {
      if (!lembrete.data_envio) return false;
      const dataEnvio = new Date(lembrete.data_envio);
      const hojeFilter = new Date();
      hojeFilter.setHours(0, 0, 0, 0);
      const amanhaFilter = new Date(hojeFilter);
      amanhaFilter.setDate(amanhaFilter.getDate() + 1);
      if (dataEnvio < hojeFilter || dataEnvio >= amanhaFilter) return false;
    } else if (filtroStatusLembrete !== "all" && lembrete.status_envio !== filtroStatusLembrete) {
      return false;
    }
    if (filtroCanalLembrete !== "all" && lembrete.canal !== filtroCanalLembrete) return false;
    if (filtroRecorrencia === "recorrente" && !lembrete.recorrencia) return false;
    if (filtroRecorrencia === "unico" && lembrete.recorrencia) return false;
    return true;
  });

  // Memoizar estatísticas para evitar recálculos
  const estatisticas = useMemo(() => ({
    total: compromissosDoMes.length,
    agendados: compromissosDoMes.filter(c => c.status === 'agendado').length,
    concluidos: compromissosDoMes.filter(c => c.status === 'concluido').length,
    cancelados: compromissosDoMes.filter(c => c.status === 'cancelado').length
  }), [compromissosDoMes]);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  
  const estatisticasLembretes = {
    total: lembretes.length,
    enviados: lembretes.filter(l => l.status_envio === 'enviado').length,
    pendentes: lembretes.filter(l => l.status_envio === 'pendente').length,
    recorrentes: lembretes.filter(l => l.recorrencia && l.ativo !== false).length,
    paraHoje: lembretes.filter(l => {
      if (!l.data_envio) return false;
      const dataEnvio = new Date(l.data_envio);
      return dataEnvio >= hoje && dataEnvio < amanha;
    }).length,
    taxaSucesso: lembretes.length > 0 ? Math.round(lembretes.filter(l => l.status_envio === 'enviado').length / lembretes.length * 100) : 0
  };
  return <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda Individual e Muti-Agendas</h1>
          <p className="text-muted-foreground">Gerencie seus compromissos e agendamentos</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={configuracoesOpen} onOpenChange={open => {
          setConfiguracoesOpen(open);
          if (open) {
            carregarConfiguracoes();
          }
        }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurações de Agenda</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Tempo médio padrão (minutos)</Label>
                  <Input type="number" min="5" max="480" step="1" value={tempoMedioPadrao} onChange={e => {
                  const valor = parseInt(e.target.value);
                  if (valor >= 5 && valor <= 480) {
                    setTempoMedioPadrao(valor);
                  }
                }} />
                  <p className="text-xs text-muted-foreground">
                    Duração média padrão para cada compromisso (mínimo 5 min, máximo 8 horas)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Dias de Funcionamento</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Selecione os dias da semana em que a empresa funciona.
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {[{
                    id: "domingo",
                    label: "Dom"
                  }, {
                    id: "segunda",
                    label: "Seg"
                  }, {
                    id: "terca",
                    label: "Ter"
                  }, {
                    id: "quarta",
                    label: "Qua"
                  }, {
                    id: "quinta",
                    label: "Qui"
                  }, {
                    id: "sexta",
                    label: "Sex"
                  }, {
                    id: "sabado",
                    label: "Sáb"
                  }].map(dia => <Button key={dia.id} type="button" variant={diasFuncionamento.includes(dia.id) ? "default" : "outline"} size="sm" className="h-10" onClick={() => {
                    if (diasFuncionamento.includes(dia.id)) {
                      setDiasFuncionamento(diasFuncionamento.filter(d => d !== dia.id));
                    } else {
                      setDiasFuncionamento([...diasFuncionamento, dia.id]);
                    }
                  }}>
                        {dia.label}
                      </Button>)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Horário Comercial</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Configure os períodos de atendimento. Cada empresa/profissional pode ter horários personalizados.
                  </p>
                  <HorarioComercialConfig horario={horarioComercial} onChange={setHorarioComercial} />
                </div>

                <div className="space-y-2">
                  <Label>Canal de lembrete padrão</Label>
                  <Select value={canalLembretePadrao} onValueChange={setCanalLembretePadrao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="push">Notificação Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" onClick={async () => {
                try {
                  const {
                    data: {
                      user
                    }
                  } = await supabase.auth.getUser();
                  if (!user) throw new Error("Usuário não autenticado");
                  const {
                    data: userRole
                  } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
                  if (!userRole?.company_id) throw new Error("Empresa não encontrada");

                  // Buscar ou criar agenda padrão
                  const {
                    data: agendaExistente
                  } = await supabase.from('agendas').select('id').eq('owner_id', user.id).eq('tipo', 'principal').single();
                  const disponibilidade = {
                    periodos: horarioComercial,
                    tempo_medio_servico: tempoMedioPadrao,
                    canal_lembrete_padrao: canalLembretePadrao,
                    dias_funcionamento: diasFuncionamento
                  };
                  console.log('💾 [Agenda] Salvando configurações:', {
                    tempoMedioPadrao,
                    diasFuncionamento,
                    disponibilidade,
                    agendaExistente: agendaExistente?.id
                  });
                  if (agendaExistente) {
                    // Atualizar agenda existente
                    const {
                      error,
                      data
                    } = await supabase.from('agendas').update({
                      disponibilidade: disponibilidade as any,
                      tempo_medio_servico: tempoMedioPadrao,
                      updated_at: new Date().toISOString()
                    }).eq('id', agendaExistente.id).select();
                    console.log('💾 [Agenda] Resultado update:', {
                      error,
                      data
                    });
                    if (error) throw error;
                  } else {
                    // Criar nova agenda
                    const {
                      error,
                      data
                    } = await supabase.from('agendas').insert({
                      nome: 'Agenda Principal',
                      tipo: 'principal',
                      owner_id: user.id,
                      company_id: userRole.company_id,
                      disponibilidade: disponibilidade as any,
                      tempo_medio_servico: tempoMedioPadrao,
                      capacidade_simultanea: 1,
                      status: 'ativo'
                    }).select();
                    console.log('💾 [Agenda] Resultado insert:', {
                      error,
                      data
                    });
                    if (error) throw error;
                  }

                  // Recarregar configurações para garantir que os valores estão atualizados
                  await carregarConfiguracoes();
                  toast.success(`Configurações salvas! Tempo: ${tempoMedioPadrao} minutos`);
                  setConfiguracoesOpen(false);
                } catch (error: any) {
                  console.error('Erro ao salvar configurações:', error);
                  toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
                }
              }}>
                  Salvar Configurações
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={novoCompromissoOpen} onOpenChange={setNovoCompromissoOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Campo título removido - coluna não existe no banco de dados */}
                <div className="space-y-2">
                  <Label>Agenda (Opcional)</Label>
                  <Select value={formData.agenda_id || "none"} onValueChange={value => setFormData({
                  ...formData,
                  agenda_id: value === "none" ? "" : value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma agenda ou deixe vazio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma agenda</SelectItem>
                      {agendas.map(agenda => <SelectItem key={agenda.id} value={agenda.id}>
                          {agenda.nome} ({agenda.tipo}) - {agenda.disponibilidade?.horario_inicio} às {agenda.disponibilidade?.horario_fim}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formData.agenda_id && <p className="text-xs text-muted-foreground">
                      {(() => {
                    const agenda = agendas.find(a => a.id === formData.agenda_id);
                    return agenda ? `Capacidade: ${agenda.capacidade_simultanea} simultâneos | Dias: ${agenda.disponibilidade?.dias?.join(', ')}` : '';
                  })()}
                    </p>}
                </div>

                <div className="space-y-2">
                  <Label>Cliente / Lead</Label>
                  <Input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Buscar por nome, telefone ou tag..." />
                  {leadSearch && <div className="border rounded-md max-h-40 overflow-y-auto">
                      {filteredLeads.length > 0 ? filteredLeads.map(lead => <button key={lead.id} type="button" onClick={() => {
                    setFormData({
                      ...formData,
                      lead_id: lead.id
                    });
                    setSelectedLeadName(lead.name);
                    setLeadSearch("");
                  }} className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm">
                            <div className="font-medium">{lead.name}</div>
                            {(lead.phone || lead.telefone) && <div className="text-xs text-muted-foreground">
                                {lead.phone || lead.telefone}
                              </div>}
                            {lead.tags && lead.tags.length > 0 && <div className="flex gap-1 mt-1">
                                {lead.tags.slice(0, 3).map((tag: string) => <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                    {tag}
                                  </span>)}
                              </div>}
                          </button>) : <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum lead encontrado
                        </div>}
                    </div>}
                  {selectedLeadName && <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                      <span className="text-sm font-medium">{selectedLeadName}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setFormData({
                      ...formData,
                      lead_id: ""
                    });
                    setSelectedLeadName("");
                  }} className="h-6 px-2">
                        Remover
                      </Button>
                    </div>}
                </div>

                <div className="space-y-2">
                  <Label>Data <span className="text-destructive">*</span></Label>
                  <Input type="date" value={formData.data} min={format(new Date(), "yyyy-MM-dd")} onChange={e => setFormData({
                  ...formData,
                  data: e.target.value
                })} className={!formData.data ? "border-amber-500" : ""} />
                </div>

                {/* Seletor de Horários Disponíveis - igual ao menu Conversas */}
                <div className="space-y-2">
                  <Label>Selecione o Horário <span className="text-destructive">*</span></Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Duração do compromisso: <strong>{formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao} minutos</strong> 
                    {formAgendaSelecionada?.permite_simultaneo && formAgendaSelecionada?.capacidade_simultanea > 1 && <> | Capacidade simultânea: <strong>{formAgendaSelecionada.capacidade_simultanea}</strong></>}
                  </p>
                  <HorarioSeletor data={formData.data} horarioComercial={formHorarioComercial} compromissosExistentes={formCompromissosExistentes} horarioSelecionado={formData.hora_inicio} duracaoMinutos={formAgendaSelecionada?.tempo_medio_servico || tempoMedioPadrao} permitirSimultaneo={formAgendaSelecionada?.permite_simultaneo || false} capacidadeSimultanea={formAgendaSelecionada?.capacidade_simultanea || 1} diasFuncionamento={formDiasFuncionamento} onSelecionarHorario={handleSelecionarHorarioForm} />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de serviço (Opcional)</Label>
                  <Select value={formData.tipo_servico || "none"} onValueChange={value => setFormData({
                  ...formData,
                  tipo_servico: value === "none" ? "" : value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="consultoria">Consultoria</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="visita">Visita</SelectItem>
                      <SelectItem value="apresentacao">Apresentação</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor estimado (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={formData.custo_estimado} onChange={e => setFormData({
                  ...formData,
                  custo_estimado: e.target.value
                })} />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea placeholder="Observações internas sobre o compromisso..." value={formData.observacoes} onChange={e => setFormData({
                  ...formData,
                  observacoes: e.target.value
                })} rows={3} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Enviar lembrete automático</Label>
                    <p className="text-xs text-muted-foreground">
                      O cliente receberá um lembrete via WhatsApp
                    </p>
                  </div>
                  <Switch checked={formData.enviar_lembrete} onCheckedChange={checked => setFormData({
                  ...formData,
                  enviar_lembrete: checked
                })} />
                </div>

                {/* Mensagem de Confirmação Imediata */}
                {formData.lead_id && <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="space-y-1">
                      <Label>Enviar confirmação imediata</Label>
                      <p className="text-xs text-muted-foreground">
                        O cliente receberá uma mensagem de confirmação via WhatsApp agora
                      </p>
                    </div>
                    <Switch checked={formData.enviar_confirmacao} onCheckedChange={checked => setFormData({
                  ...formData,
                  enviar_confirmacao: checked
                })} />
                  </div>}

                {/* Notificação Push para Responsável */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
                  <div className="space-y-1">
                    <Label>Notificar responsável</Label>
                    <p className="text-xs text-muted-foreground">
                      {'Notification' in window && Notification.permission === 'granted' ? 'Você receberá uma notificação push no navegador' : 'Você receberá uma notificação push (permissão será solicitada)'}
                    </p>
                    {'Notification' in window && Notification.permission === 'denied' && <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Notificações bloqueadas. Ative nas configurações do navegador.
                      </p>}
                  </div>
                  <Switch checked={formData.notificar_responsavel} onCheckedChange={checked => setFormData({
                  ...formData,
                  notificar_responsavel: checked
                })} disabled={'Notification' in window && Notification.permission === 'denied'} />
                </div>

                {formData.enviar_lembrete && <>
                    <div className="space-y-2">
                      <Label>Enviar lembrete para</Label>
                      <Select value={formData.destinatario_lembrete} onValueChange={value => setFormData({
                    ...formData,
                    destinatario_lembrete: value
                  })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Apenas o Lead</SelectItem>
                          <SelectItem value="responsavel">Apenas o Responsável</SelectItem>
                          <SelectItem value="ambos">Lead e Responsável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tempo de antecedência</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Horas</Label>
                          <Select value={formData.horas_antecedencia_horas} onValueChange={value => {
                        setFormData({
                          ...formData,
                          horas_antecedencia_horas: value
                        });
                      }}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({
                            length: 25
                          }, (_, i) => <SelectItem key={i} value={i.toString()}>
                                  {i} {i === 1 ? 'hora' : 'horas'}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Minutos</Label>
                          <Select value={formData.horas_antecedencia_minutos} onValueChange={value => {
                        setFormData({
                          ...formData,
                          horas_antecedencia_minutos: value
                        });
                      }}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 5, 10, 15, 20, 30, 45].map(min => <SelectItem key={min} value={min.toString()}>
                                  {min} {min === 1 ? 'minuto' : 'minutos'}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Selecione quantas horas e minutos antes do compromisso o lembrete deve ser enviado.
                      </p>
                    </div>
                  </>}

                {/* Lembretes adicionais e convite por e-mail */}
                {(() => {
                  const leadSel = formData.lead_id ? leads.find(l => l.id === formData.lead_id) : null;
                  const leadEmail = leadSel?.email;
                  const leadTel = leadSel?.phone || leadSel?.telefone;
                  return <>
                    {formData.lead_id && (<>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label>Lembrete WhatsApp 24h antes</Label>
                        <p className="text-xs text-muted-foreground">
                          {leadTel ? 'Lembrete adicional via WhatsApp 24h antes do compromisso' : 'Lead sem telefone cadastrado'}
                        </p>
                      </div>
                      <Switch checked={formData.lembrete_whatsapp_24h && !!leadTel} disabled={!leadTel} onCheckedChange={checked => setFormData({ ...formData, lembrete_whatsapp_24h: checked })} />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label>Lembrete por e-mail 24h antes</Label>
                        <p className="text-xs text-muted-foreground">
                          {leadEmail ? `Será enviado para ${leadEmail}` : 'Lead sem e-mail cadastrado — canal será ignorado'}
                        </p>
                      </div>
                      <Switch checked={formData.lembrete_email_24h && !!leadEmail} disabled={!leadEmail} onCheckedChange={checked => setFormData({ ...formData, lembrete_email_24h: checked })} />
                    </div>
                    </>)}

                    <div className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Convidar por e-mail (Google Agenda)</Label>
                          <p className="text-xs text-muted-foreground">
                            O convidado receberá o convite nativo do Google Calendar
                          </p>
                        </div>
                        <Switch
                          checked={formData.convidar_lead_email}
                          onCheckedChange={checked => setFormData({ ...formData, convidar_lead_email: checked, email_convidado: checked && !formData.email_convidado && leadEmail ? leadEmail : formData.email_convidado })}
                        />
                      </div>
                      {formData.convidar_lead_email && (
                        <div className="space-y-1">
                          <Label className="text-xs">E-mail do convidado</Label>
                          <Input
                            type="email"
                            placeholder={leadEmail || "exemplo@email.com"}
                            value={formData.email_convidado}
                            onChange={e => setFormData({ ...formData, email_convidado: e.target.value })}
                          />
                          {leadEmail && !formData.email_convidado && (
                            <p className="text-xs text-muted-foreground">Padrão: e-mail do lead ({leadEmail})</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>;
                })()}

                <Button className="w-full" onClick={criarCompromisso} disabled={!formData.data || !formData.hora_inicio}>
                  {!formData.data || !formData.hora_inicio ? "Preencha os campos obrigatórios (data, horário e duração)" : "Criar Agendamento"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  <span className="text-destructive">*</span> Campos obrigatórios
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas de Compromissos - Clicáveis para filtrar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => {
            setFilterStatus('all');
            setActiveMainTab('lista');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{estatisticas.total}</div>
            <p className="text-xs text-muted-foreground">Compromissos do mês</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'agendado' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => {
            setFilterStatus('agendado');
            setActiveMainTab('lista');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{estatisticas.agendados}</div>
            <p className="text-xs text-muted-foreground">Agendados</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'concluido' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => {
            setFilterStatus('concluido');
            setActiveMainTab('lista');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{estatisticas.concluidos}</div>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === 'cancelado' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => {
            setFilterStatus('cancelado');
            setActiveMainTab('lista');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{estatisticas.cancelados}</div>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas de Lembretes - Clicáveis para filtrar */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filtroStatusLembrete === 'all' && filtroRecorrencia === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => {
            setFiltroStatusLembrete('all');
            setFiltroRecorrencia('all');
            setActiveMainTab('lembretes');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{estatisticasLembretes.total}</div>
            <p className="text-xs text-muted-foreground">Total de lembretes</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filtroStatusLembrete === 'enviado' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => {
            setFiltroStatusLembrete('enviado');
            setFiltroRecorrencia('all');
            setActiveMainTab('lembretes');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{estatisticasLembretes.enviados}</div>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filtroStatusLembrete === 'pendente' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => {
            setFiltroStatusLembrete('pendente');
            setFiltroRecorrencia('all');
            setActiveMainTab('lembretes');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{estatisticasLembretes.pendentes}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filtroRecorrencia === 'recorrente' ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => {
            setFiltroStatusLembrete('all');
            setFiltroRecorrencia('recorrente');
            setActiveMainTab('lembretes');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{estatisticasLembretes.recorrentes}</div>
            <p className="text-xs text-muted-foreground">Recorrentes</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md`}
          onClick={() => {
            setFiltroStatusLembrete('hoje');
            setFiltroRecorrencia('all');
            setActiveMainTab('lembretes');
          }}
        >
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-cyan-600">{estatisticasLembretes.paraHoje}</div>
            <p className="text-xs text-muted-foreground">Para hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{estatisticasLembretes.taxaSucesso}%</div>
            <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="lista">Lista de Compromissos</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
          <TabsTrigger value="minhas-agendas">
            Minhas Agendas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar mode="single" selected={selectedDate} onSelect={date => {
                if (date) {
                  setSelectedDate(date);
                  // Lazy loading: carregar compromissos do mês quando mudar de data
                  const newMonth = format(date, 'yyyy-MM');
                  const currentMonth = format(selectedDate, 'yyyy-MM');
                  if (newMonth !== currentMonth) {
                    console.log(`📅 [Performance] Mudança de mês detectada: ${currentMonth} -> ${newMonth}`);
                    carregarCompromissosDoMes(date);
                  }
                }
              }} onMonthChange={date => {
                // Lazy loading: carregar compromissos quando usuário navegar para novo mês
                console.log(`📅 [Performance] Navegação para mês: ${format(date, 'yyyy-MM')}`);
                carregarCompromissosDoMes(date);
              }} locale={ptBR} className="rounded-md border" modifiers={{
                hasCompromissos: compromissosDoMes.filter(c => c.status === 'agendado').map(c => {
                  const date = parseISO(c.data_hora_inicio);
                  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                }),
                hasConcluidos: compromissosDoMes.filter(c => c.status === 'concluido').map(c => {
                  const date = parseISO(c.data_hora_inicio);
                  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                }),
                hasCancelados: compromissosDoMes.filter(c => c.status === 'cancelado').map(c => {
                  const date = parseISO(c.data_hora_inicio);
                  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                })
              }} modifiersClassNames={{
                hasCompromissos: "bg-blue-100 text-blue-900 font-semibold hover:bg-blue-200",
                hasConcluidos: "bg-green-100 text-green-900 hover:bg-green-200",
                hasCancelados: "bg-red-100 text-red-900 hover:bg-red-200"
              }} />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Agendado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Concluído</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Cancelado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vista de Compromissos - Day/Week Toggle */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {calendarViewMode === "day" 
                      ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                      : "Visão Semanal"
                    }
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <ToggleGroup type="single" value={calendarViewMode} onValueChange={(v) => v && setCalendarViewMode(v as "day" | "week")}>
                      <ToggleGroupItem value="day" className="text-xs px-3 h-8">Dia</ToggleGroupItem>
                      <ToggleGroupItem value="week" className="text-xs px-3 h-8">Semana</ToggleGroupItem>
                    </ToggleGroup>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="agendado">Agendados</SelectItem>
                        <SelectItem value="concluido">Concluídos</SelectItem>
                        <SelectItem value="cancelado">Cancelados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {calendarViewMode === "week" ? (
                  <AgendaWeekView
                    selectedDate={selectedDate}
                    compromissos={filterStatus === "all" ? compromissosDoMes : compromissosDoMes.filter(c => c.status === filterStatus)}
                    onSelectDate={setSelectedDate}
                    onSelectCompromisso={(comp) => {
                      // Set date to the compromisso's date for context
                      setSelectedDate(parseISO(comp.data_hora_inicio));
                      setCalendarViewMode("day");
                    }}
                  />
                ) : (
                  <AgendaDayView
                    selectedDate={selectedDate}
                    compromissos={filterStatus === "all" ? compromissos : compromissos.filter(c => c.status === filterStatus)}
                    onSelectCompromisso={(comp) => {
                      // Could open edit dialog in the future
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lista">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle>Todos os Compromissos</CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por título, tipo, lead, agenda..." value={buscaCompromissos} onChange={e => setBuscaCompromissos(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={filtroAgenda} onValueChange={setFiltroAgenda}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filtrar por agenda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as agendas</SelectItem>
                      {agendas.map(agenda => <SelectItem key={agenda.id} value={agenda.id}>
                          {agenda.nome}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroTipoServico} onValueChange={setFiltroTipoServico}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Tipo de serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="consultoria">Consultoria</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="visita">Visita</SelectItem>
                      <SelectItem value="apresentacao">Apresentação</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os períodos</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="semana">Esta semana</SelectItem>
                      <SelectItem value="mes">Este mês</SelectItem>
                    </SelectContent>
                  </Select>
                  {responsaveisUnicos.length > 0 && <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os responsáveis</SelectItem>
                        {responsaveisUnicos.map(resp => <SelectItem key={resp.id} value={resp.id}>
                            {resp.name.substring(0, 8)}...
                          </SelectItem>)}
                      </SelectContent>
                    </Select>}
                </div>
                {(buscaCompromissos || filtroAgenda !== "all" || filtroTipoServico !== "all" || filtroPeriodo !== "all" || filtroResponsavel !== "all") && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>
                      {compromissosFiltrados.length} de {compromissos.length} compromissos
                    </span>
                    {(buscaCompromissos || filtroAgenda !== "all" || filtroTipoServico !== "all" || filtroPeriodo !== "all" || filtroResponsavel !== "all") && <Button variant="ghost" size="sm" onClick={() => {
                  setBuscaCompromissos("");
                  setFiltroAgenda("all");
                  setFiltroTipoServico("all");
                  setFiltroPeriodo("all");
                  setFiltroResponsavel("all");
                }} className="h-6 px-2 text-xs">
                        Limpar filtros
                      </Button>}
                  </div>}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {compromissosFiltrados.length === 0 ? <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>
                        {compromissos.length === 0 ? "Nenhum compromisso cadastrado" : "Nenhum compromisso encontrado com os filtros aplicados"}
                      </p>
                    </div> : compromissosFiltrados.map(compromisso => <Card key={compromisso.id} className={`border-l-4 ${compromisso.status === 'agendado' ? 'border-l-blue-500' : compromisso.status === 'concluido' ? 'border-l-green-500' : 'border-l-red-500'} hover:shadow-md transition-shadow`}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-base">{compromisso.titulo || compromisso.tipo_servico}</span>
                                {getStatusBadge(compromisso.status)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CalendarDays className="h-4 w-4" />
                                <span>{format(parseISO(compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR
                            })}</span>
                                <span>•</span>
                                <Clock className="h-4 w-4" />
                                <span>
                                  {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                </span>
                              </div>
                              {compromisso.agenda && <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {compromisso.agenda.nome} ({compromisso.agenda.tipo})
                                </p>}
                              {/* Exibir lead ou paciente com foto */}
                              {compromisso.lead ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage 
                                      src={compromisso.lead.profile_picture_url || (compromisso.lead_id ? leadAvatars[compromisso.lead_id] : undefined)} 
                                      alt={compromisso.lead.name} 
                                      onError={e => {
                                        if (compromisso.lead_id && compromisso.lead) {
                                          buscarAvatarLead({
                                            id: compromisso.lead_id,
                                            name: compromisso.lead.name,
                                            phone: compromisso.lead.phone,
                                            telefone: compromisso.lead.phone
                                          });
                                        }
                                      }} 
                                    />
                                    <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                      {compromisso.lead.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{compromisso.lead.name}</span>
                                  {compromisso.lead.phone && (
                                    <span className="text-xs text-muted-foreground">({compromisso.lead.phone})</span>
                                  )}
                                </div>
                              ) : compromisso.paciente && (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                      {compromisso.paciente.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{compromisso.paciente}</span>
                                  {compromisso.telefone && (
                                    <span className="text-xs text-muted-foreground">({compromisso.telefone})</span>
                                  )}
                                </div>
                              )}
                              {/* Exibir profissional/colaborador */}
                              {compromisso.profissional && (
                                <div className="flex items-center gap-2 mt-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    Colaborador: <strong>{compromisso.profissional.nome}</strong>
                                    {compromisso.profissional.especialidade && ` (${compromisso.profissional.especialidade})`}
                                  </span>
                                </div>
                              )}
                              {compromisso.observacoes && <p className="text-xs text-muted-foreground mt-1">
                                  {compromisso.observacoes}
                                </p>}
                              {compromisso.custo_estimado && <p className="text-sm font-medium text-primary">
                                  R$ {compromisso.custo_estimado.toFixed(2)}
                                </p>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => duplicarCompromisso(compromisso)} title="Duplicar compromisso">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <EditarCompromissoDialog compromisso={compromisso} onCompromissoUpdated={carregarCompromissos} />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Deletar compromisso">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja deletar este compromisso? Esta ação não pode ser desfeita e todos os lembretes associados também serão removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletarCompromisso(compromisso.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lembretes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Histórico de Lembretes
              </CardTitle>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filtroStatusLembrete} onValueChange={setFiltroStatusLembrete}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="erro">Erro</SelectItem>
                      <SelectItem value="retry">Retry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={filtroCanalLembrete} onValueChange={setFiltroCanalLembrete}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={filtroRecorrencia} onValueChange={setFiltroRecorrencia}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unico">Único</SelectItem>
                      <SelectItem value="recorrente">Recorrente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {lembretesFiltrados.length === 0 ? <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{lembretes.length === 0 ? "Nenhum lembrete criado" : "Nenhum lembrete encontrado com os filtros aplicados"}</p>
                  </div> : <div className="space-y-3">
                    {lembretesFiltrados.map(lembrete => <Card key={lembrete.id} className={`border-l-4 ${lembrete.status_envio === 'enviado' ? 'border-l-green-500' : lembrete.status_envio === 'pendente' ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                                <div className="flex justify-between items-start">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {lembrete.compromisso?.titulo || lembrete.compromisso?.tipo_servico || 'Compromisso'}
                                  </span>
                                  <Badge variant={lembrete.status_envio === 'enviado' ? 'default' : lembrete.status_envio === 'pendente' ? 'secondary' : lembrete.status_envio === 'retry' ? 'outline' : 'destructive'}>
                                    {lembrete.status_envio === 'enviado' ? '✓ Enviado' : lembrete.status_envio === 'pendente' ? '⏳ Pendente' : lembrete.status_envio === 'retry' ? '🔄 Retry' : '✗ Erro'}
                                  </Badge>
                                  {lembrete.recorrencia && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                      🔄 {lembrete.recorrencia === 'semanal' ? 'Semanal' : lembrete.recorrencia === 'quinzenal' ? 'Quinzenal' : lembrete.recorrencia === 'mensal' ? 'Mensal' : 'Recorrente'}
                                    </Badge>}
                                  {(lembrete.status_envio === 'erro' || lembrete.status_envio === 'retry') && <Button size="sm" variant="outline" onClick={() => reenviarLembrete(lembrete.id)} className="h-6 px-2 text-xs">
                                      Reenviar
                                    </Button>}
                                </div>
                                {lembrete.compromisso?.lead && <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={lembrete.compromisso.lead_id ? leadAvatars[lembrete.compromisso.lead_id] : undefined} alt={lembrete.compromisso.lead.name} onError={e => {
                                if (lembrete.compromisso?.lead_id && lembrete.compromisso.lead) {
                                  buscarAvatarLead({
                                    id: lembrete.compromisso.lead_id,
                                    name: lembrete.compromisso.lead.name,
                                    phone: lembrete.compromisso.lead.phone,
                                    telefone: lembrete.compromisso.lead.phone
                                  });
                                }
                              }} />
                                      <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                        {lembrete.compromisso.lead.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-muted-foreground">{lembrete.compromisso.lead.name}</span>
                                  </div>}
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {lembrete.compromisso?.data_hora_inicio && format(parseISO(lembrete.compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR
                            })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Destinatário:</strong> {
                            // Se o destinatario contém nome e telefone (formato "Nome (telefone)")
                            lembrete.destinatario && lembrete.destinatario !== 'lead' && lembrete.destinatario !== 'responsavel' && lembrete.destinatario !== 'ambos' ? lembrete.destinatario : lembrete.destinatario === 'lead' ?
                            // Tentar pegar do lead vinculado ou do telefone_responsavel
                            lembrete.compromisso?.lead ? `${lembrete.compromisso.lead.name}${lembrete.compromisso.lead.phone ? ` (${lembrete.compromisso.lead.phone})` : lembrete.telefone_responsavel ? ` (${lembrete.telefone_responsavel})` : ''}` : lembrete.telefone_responsavel ? `Lead (${lembrete.telefone_responsavel})` : 'Lead' : lembrete.destinatario === 'responsavel' ? lembrete.telefone_responsavel ? `Responsável (${lembrete.telefone_responsavel})` : 'Responsável' : lembrete.destinatario === 'ambos' ? <>
                                        {lembrete.compromisso?.lead ? `${lembrete.compromisso.lead.name}${lembrete.compromisso.lead.phone ? ` (${lembrete.compromisso.lead.phone})` : ''}` : 'Lead'}
                                        {lembrete.telefone_responsavel && ` e Responsável (${lembrete.telefone_responsavel})`}
                                      </> : lembrete.telefone_responsavel ? `(${lembrete.telefone_responsavel})` : 'Lead'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Canal:</strong> {lembrete.canal.toUpperCase()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Antecedência:</strong> {lembrete.horas_antecedencia}h
                                </p>
                                {lembrete.recorrencia && <p className="text-sm text-blue-600">
                                    <strong>🔄 Recorrência:</strong> {lembrete.recorrencia === 'semanal' ? 'Semanal (toda semana)' : lembrete.recorrencia === 'quinzenal' ? 'Quinzenal (a cada 15 dias)' : lembrete.recorrencia === 'mensal' ? 'Mensal (todo mês)' : lembrete.recorrencia}
                                  </p>}
                                {lembrete.recorrencia && lembrete.proxima_data_envio && lembrete.status_envio === 'pendente' && <p className="text-sm text-green-600">
                                    <strong>Próximo envio:</strong> {format(parseISO(lembrete.proxima_data_envio), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR
                            })}
                                  </p>}
                                {lembrete.tentativas && lembrete.tentativas > 0 && <p className="text-sm text-muted-foreground">
                                    <strong>Tentativas:</strong> {lembrete.tentativas}/3
                                  </p>}
                                {lembrete.proxima_tentativa && lembrete.status_envio === 'retry' && <p className="text-sm text-orange-600">
                                    <strong>Próxima tentativa:</strong> {format(parseISO(lembrete.proxima_tentativa), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR
                            })}
                                  </p>}
                                {lembrete.data_envio && <p className="text-xs text-muted-foreground">
                                    {lembrete.status_envio === 'enviado' ? 'Enviado em: ' : 'Última tentativa: '}
                                    {format(parseISO(lembrete.data_envio), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR
                            })}
                                  </p>}
                                {lembrete.mensagem && <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                    {lembrete.mensagem}
                                  </p>}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="minhas-agendas">
          {(() => {
          console.log('📑 [Agenda] TabsContent minhas-agendas está sendo renderizado!');
          return null;
        })()}
          <div style={{
          border: '3px solid blue',
          padding: '10px',
          margin: '10px'
        }}>
            <p style={{
            color: 'blue',
            fontWeight: 'bold'
          }}>
          </p>
            <AgendaColaboradores />
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}