import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DndContext, DragEndEvent, closestCenter, DragStartEvent, DragOverEvent, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection, CollisionDetection, getFirstCollision } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Wifi, WifiOff, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LeadCard } from "@/components/funil/LeadCard";
import { DroppableColumn } from "@/components/funil/DroppableColumn";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { AdicionarLeadExistenteDialog } from "@/components/funil/AdicionarLeadExistenteDialog";
import { NovoFunilDialog } from "@/components/funil/NovoFunilDialog";
import { EditarFunilDialog } from "@/components/funil/EditarFunilDialog";
import { AdicionarEtapaDialog } from "@/components/funil/AdicionarEtapaDialog";
import { toast } from "sonner";
import { CriarTarefaAoMoverDialog } from "@/components/funil/CriarTarefaAoMoverDialog";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { usePermissions } from "@/hooks/usePermissions";
import { FunilFiltrosResponsaveis, type ViewMode } from "@/components/funil/FunilFiltrosResponsaveis";

interface Lead {
  id: string;
  nome: string;
  name: string;
  company?: string;
  value?: number;
  telefone?: string;
  email?: string;
  cpf?: string;
  source?: string;
  notes?: string;
  etapa_id?: string;
  funil_id?: string;
  created_at?: string;
  updated_at?: string;
  title?: string | null; // Título da negociação/oportunidade
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  funil_id: string;
}

interface Funil {
  id: string;
  nome: string;
  descricao?: string;
}

// Componente para coluna ordenável
/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01
 * IMPORTANTE: Deve ter data: { type: 'etapa' } no useSortable para identificar drag de etapas
 * Se retroceder, verificar se tem data: { type: 'etapa' }
 */
function SortableColumn({
  id,
  children,
  isDragging
}: {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id, data: { type: 'etapa' } }); // ✅ CRÍTICO: data: { type: 'etapa' } para identificar drag de etapas

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: (sortableIsDragging || isDragging) ? 0.6 : 1,
    scale: (sortableIsDragging || isDragging) ? 0.95 : 1,
    boxShadow: (sortableIsDragging || isDragging) ? '0 10px 30px rgba(0,0,0,0.2)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} className="min-w-[280px] md:min-w-[320px] flex-1 flex-shrink-0 relative group">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-2 -left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="bg-background border rounded-full p-1 shadow-md">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {children}
    </div>
  );
}

export default function KanbanPage() {
  const { canManageStructure, isAdmin, isGestor, currentUserId, currentCompanyId, hasPermission } = usePermissions();
  const [canCreateFunil, setCanCreateFunil] = useState(true); // Padrão: permitir (comportamento atual)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [tarefaDialogData, setTarefaDialogData] = useState<{ open: boolean; leadId: string; leadName: string; etapaDestino: string }>({ open: false, leadId: "", leadName: "", etapaDestino: "" });
  
  // 🎯 Configurar sensores para melhor detecção de drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Exige 8px de movimento antes de iniciar o drag
    },
  });
  const sensors = useSensors(pointerSensor);

  // 🎯 Função de colisão customizada que prioriza droppables sobre draggables
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // Primeiro, tentar encontrar colisões com pointerWithin (mais preciso para áreas)
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      // Priorizar colisões com etapas (droppables) sobre leads
      const etapaCollision = pointerCollisions.find(
        collision => collision.data?.droppableContainer?.data?.current?.type === 'etapa'
      );
      if (etapaCollision) {
        return [etapaCollision];
      }
      return pointerCollisions;
    }

    // Fallback para rectIntersection se pointerWithin não encontrou nada
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      // Também priorizar etapas
      const etapaCollision = rectCollisions.find(
        collision => collision.data?.droppableContainer?.data?.current?.type === 'etapa'
      );
      if (etapaCollision) {
        return [etapaCollision];
      }
      return rectCollisions;
    }

    // Último fallback para closestCenter
    return closestCenter(args);
  }, []);
  
  // Verificar permissão de criar funil
  useEffect(() => {
    const checkPermission = async () => {
      if (isAdmin) {
        setCanCreateFunil(true);
        return;
      }
      const canCreate = await hasPermission('funil.create') || await hasPermission('funil.manage');
      setCanCreateFunil(canCreate);
    };
    checkPermission();
  }, [isAdmin, hasPermission]);
  const [dragOperation, setDragOperation] = useState<{
    isDragging: boolean;
    leadId: string | null;
    sourceEtapa: string | null;
  }>({
    isDragging: false,
    leadId: null,
    sourceEtapa: null,
  });
  const [leadsPerEtapa, setLeadsPerEtapa] = useState<Record<string, number>>({});
  const [activeColumn, setActiveColumn] = useState<Etapa | null>(null);
  const LEADS_PER_PAGE = 10;
  const isMovingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Verificar se Supabase está configurado
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
        const isSupabaseConfigured = supabaseUrl && supabaseKey && 
          supabaseUrl !== "http://localhost:54321" && 
          supabaseKey !== "anon-key";

        if (!isSupabaseConfigured) {
          console.log("⚠️ Supabase não configurado - modo desenvolvimento");
          if (mounted) {
            setFunis([]);
            setEtapas([]);
            setLeads([]);
            setLoading(false);
          }
          return;
        }

        // Carregar funis
        const { data: funisData, error: funisError } = await supabase
          .from("funis")
          .select("*")
          .order("criado_em");

        if (funisError) throw funisError;

        if (!mounted) return;

        // Atualizar funis
        const loadedFunis = funisData || [];
        setFunis(loadedFunis);

        // Selecionar funil via URL (?funil=ID ou ?funil_nome=Nome) ou primeiro
        if (loadedFunis.length > 0 && !selectedFunil) {
          const params = new URLSearchParams(window.location.search);
          const funilParamId = params.get("funil");
          const funilParamNome = params.get("funil_nome");
          let escolhido: string | undefined;
          if (funilParamId && loadedFunis.find((f: any) => f.id === funilParamId)) {
            escolhido = funilParamId;
          } else if (funilParamNome) {
            const match = loadedFunis.find((f: any) =>
              (f.nome || "").toLowerCase() === funilParamNome.toLowerCase()
            );
            escolhido = match?.id;
          }
          setSelectedFunil(escolhido || loadedFunis[0].id);
        }

        // Carregar etapas
        const { data: etapasData, error: etapasError } = await supabase
          .from("etapas")
          .select("*")
          .order("posicao");

        if (etapasError) throw etapasError;
        if (!mounted) return;

        setEtapas(etapasData || []);

        // Carregar leads
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (leadsError) throw leadsError;
        if (!mounted) return;

        setLeads((leadsData || []).map(lead => ({
          ...lead,
          nome: lead.name || "",
          name: lead.name || ""
        })));

      } catch (err: any) {
        // Ignore AbortError from auth lock contention - just retry silently
        if (err?.name === 'AbortError' || err?.message?.includes('Lock broken')) {
          console.debug("Kanban: auth lock contention, retrying...");
          if (mounted) {
            setTimeout(() => loadData(), 1000);
          }
          return;
        }
        console.error("Erro ao carregar dados:", err);
        if (mounted) {
          setError(err.message || "Erro ao carregar dados");
          toast.error("Erro ao carregar funil de vendas");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [selectedFunil]);

  // Atualiza apenas os leads sem recarregar a página
  const refreshLeads = async () => {
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (leadsError) throw leadsError;
      setLeads((leadsData || []).map(lead => ({
        ...lead,
        nome: lead.name || "",
        name: lead.name || ""
      })));
    } catch (err) {
      console.error("Erro ao atualizar leads:", err);
    }
  };

  // Atualiza funis
  const refreshFunis = async () => {
    try {
      const { data: funisData, error } = await supabase.from('funis').select('*').order('criado_em');
      if (error) throw error;
      const loaded = funisData || [];
      setFunis(loaded);
      if (!selectedFunil && loaded.length > 0) setSelectedFunil(loaded[0].id);
      if (selectedFunil && !loaded.find(f => f.id === selectedFunil) && loaded.length > 0) {
        setSelectedFunil(loaded[0].id);
      }
    } catch (err) {
      console.error('Erro ao atualizar funis:', err);
    }
  };

  // Atualiza etapas
  const refreshEtapas = async () => {
    try {
      const { data: etapasData, error } = await supabase.from('etapas').select('*').order('posicao');
      if (error) throw error;
      setEtapas(etapasData || []);
    } catch (err) {
      console.error('Erro ao atualizar etapas:', err);
    }
  };

  // Carregar mais leads para uma etapa específica
  const loadMoreLeads = useCallback(async (etapaId: string) => {
    const currentCount = leadsPerEtapa[etapaId] || LEADS_PER_PAGE;
    const newCount = currentCount + LEADS_PER_PAGE;

    setLeadsPerEtapa(prev => ({
      ...prev,
      [etapaId]: newCount
    }));
  }, [leadsPerEtapa, LEADS_PER_PAGE]);

  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restaurada");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Sem conexão com a internet");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // useLeadsSync removido aqui para evitar duplicidade com o canal consolidado abaixo

  // Sistema de eventos globais para comunicação entre módulos
  const { emitGlobalEvent } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: (data) => {
        console.log('🌍 [Kanban] Lead atualizado via evento global:', data);
        // Atualizar lead se estiver presente no funil atual
        setLeads(prev => prev.map(lead => {
          if (lead.id === data.id) {
            const formattedLead = { ...data, nome: data.name || '', name: data.name || '' };
            return formattedLead;
          }
          return lead;
        }));
      },
      onTaskCreated: (data) => {
        console.log('🌍 [Kanban] Nova tarefa criada, verificar se afeta lead:', data);
        // Se a tarefa estiver vinculada a um lead no funil, podemos atualizar status
        if (data.lead_id) {
          // Opcional: marcar lead como tendo tarefas pendentes
        }
      },
      onMeetingScheduled: (data) => {
        console.log('🌍 [Kanban] Reunião agendada, verificar se afeta lead:', data);
        // Se a reunião estiver vinculada a um lead, podemos atualizar atividade
        if (data.lead_id) {
          // Opcional: marcar lead como tendo reunião agendada
        }
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // 🎯 Realtime consolidado com gerenciamento robusto
  useEffect(() => {
    let realtimeChannel: any = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const formatLead = (lead: any): Lead => ({
      ...lead,
      nome: lead.name || '',
      name: lead.name || ''
    });

    const setupRealtimeChannel = () => {
      console.log('🔄 [REALTIME] Configurando canal consolidado...');

      // Canal único para consolidar realtime
      realtimeChannel = supabase
        .channel('kanban_realtime_consolidated')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload: any) => {
          console.log('📡 [REALTIME] Leads:', payload.eventType, payload.new?.id || payload.old?.id);
          
          // Evitar atualizar durante operações de drag
          if (isMovingRef.current) {
            console.log('⏸️ [REALTIME] Ignorando atualização durante drag');
            return;
          }

          if (payload.eventType === 'INSERT') {
            setLeads(prev => {
              // Evitar duplicatas
              if (prev.some(l => l.id === payload.new.id)) return prev;
              return [formatLead(payload.new), ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.id === payload.new.id ? formatLead(payload.new) : l));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'etapas' }, (payload: any) => {
          console.log('📡 [REALTIME] Etapas:', payload.eventType);

          // Não ignorar mudanças de posição durante operação de drag
          if (isMovingRef.current && payload.eventType === 'UPDATE') {
            console.log('⏸️ [REALTIME] Ignorando atualização durante operação de drag');
            return;
          }

          // Atualizar etapas quando houver mudanças
          if (payload.eventType === 'INSERT') {
            setEtapas(prev => {
              // Evitar duplicatas
              if (prev.some(e => e.id === payload.new.id)) return prev;
              return [...prev, payload.new].sort((a, b) => a.posicao - b.posicao);
            });
          } else if (payload.eventType === 'UPDATE') {
            setEtapas(prev => prev.map(e => e.id === payload.new.id ? payload.new : e).sort((a, b) => a.posicao - b.posicao));
          } else if (payload.eventType === 'DELETE') {
            setEtapas(prev => prev.filter(e => e.id !== payload.old.id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'funis' }, () => {
          console.log('📡 [REALTIME] Funis atualizados');
          refreshFunis();
        })
        .subscribe((status) => {
          console.log('🔌 [REALTIME] Status:', status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ [REALTIME] Canal conectado com sucesso');
            setIsOnline(true);
            reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [REALTIME] Erro no canal');
            setIsOnline(false);

            // Tentar reconectar automaticamente
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Backoff exponencial
              
              console.log(`🔄 [REALTIME] Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
              
              reconnectTimeout = setTimeout(() => {
                if (realtimeChannel) {
                  supabase.removeChannel(realtimeChannel);
                }
                setupRealtimeChannel();
              }, delay);
            } else {
              toast.error('Erro na conexão em tempo real', {
                description: 'Recarregue a página para restaurar'
              });
            }
          } else if (status === 'CLOSED') {
            console.log('🔌 [REALTIME] Canal fechado');
            setIsOnline(false);
          }
        });
    };

    setupRealtimeChannel();

    return () => {
      console.log('🧹 [REALTIME] Limpando canal...');
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [selectedFunil]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const leadId = active.id as string;
    const lead = leads.find(l => l.id === leadId);

    setDragOperation({
      isDragging: true,
      leadId,
      sourceEtapa: lead?.etapa_id || null,
    });

    console.log('[DRAG START] Iniciando drag:', { leadId, sourceEtapa: lead?.etapa_id });
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Pode ser usado para feedback visual durante o drag
    const { over } = event;
    if (over) {
      console.log('[DRAG OVER] Hover sobre:', over.id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    console.log('[DRAG END] 🎯 Iniciando operação de drag:', { 
      activeId: active.id, 
      overId: over?.id,
      activeType: active.data.current?.type,
      overType: over?.data.current?.type 
    });

    // 🔒 Prevenir operações concorrentes de drag
    if (isMovingRef.current) {
      console.warn('[DRAG END] ⚠️ Operação de drag já em andamento - bloqueado');
      toast.warning("Aguarde a operação anterior finalizar");
      return;
    }

    try {
      // 🧹 Reset drag states
      setDragOperation({
        isDragging: false,
        leadId: null,
        sourceEtapa: null,
      });
      setActiveColumn(null);

      // ✅ Validação básica - sem destino
      if (!over) {
        console.log('[DRAG END] ❌ Drag cancelado - nenhum destino válido');
        return;
      }

      // ✅ Validação de conectividade
      if (!isOnline) {
        console.error('[DRAG END] 🌐 Sem conexão com internet');
        toast.error("Sem conexão - operação não pode ser realizada", {
          description: "Verifique sua conexão e tente novamente"
        });
        return;
      }

      const activeData = active.data.current;
      const overData = over.data.current;

      // 🔀 FLUXO 1: Reordenação de etapas (drag horizontal)
      if (activeData?.type === 'etapa') {
        console.log('[DRAG END] 🔄 Detectado drag de etapa - reordenação');
        await handleEtapaReorder(active.id as string, over.id as string);
        return;
      }

      // 🎯 FLUXO 2: Movimentação de lead entre etapas
      const leadId = active.id as string;

      // 🔍 Determinar etapa de destino com lógica clara
      let newEtapaId: string | null = null;
      
      // Primeiro, verificar se o over.id é uma etapa diretamente
      const isOverEtapa = etapas.some(e => e.id === over.id);
      
      if (isOverEtapa) {
        // Drop direto na área da coluna (droppable)
        newEtapaId = over.id as string;
        console.log('[DRAG END] 📍 Destino detectado: coluna droppable', newEtapaId);
      } else if (overData?.type === 'etapa') {
        // Drop na área marcada como etapa
        newEtapaId = over.id as string;
        console.log('[DRAG END] 📍 Destino detectado: área tipo etapa', newEtapaId);
      } else if (overData?.etapaId) {
        // Drop sobre um lead (pegar etapa desse lead)
        newEtapaId = overData.etapaId as string;
        console.log('[DRAG END] 📍 Destino detectado: lead com etapaId', newEtapaId);
      } else if (overData?.type === 'lead' && overData?.lead?.etapa_id) {
        // Drop sobre lead com etapa definida
        newEtapaId = overData.lead.etapa_id;
        console.log('[DRAG END] 📍 Destino detectado: lead.etapa_id', newEtapaId);
      }

      // ✅ Validar etapa de destino
      if (!newEtapaId) {
        console.error('[DRAG END] ❌ Etapa de destino não identificada:', { 
          overData, 
          overId: over.id 
        });
        toast.error("Não foi possível identificar a etapa de destino");
        return;
      }

      // ✅ Validar se o lead existe no estado
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        console.error('[DRAG END] ❌ Lead não encontrado no estado local:', leadId);
        toast.error("Lead não encontrado");
        return;
      }

      // ✅ Validar se a etapa de destino existe
      const etapaDestino = etapas.find(e => e.id === newEtapaId);
      if (!etapaDestino) {
        console.error('[DRAG END] ❌ Etapa de destino não existe:', newEtapaId);
        toast.error("Etapa de destino não existe");
        return;
      }

      // ✅ Validar se está tentando mover entre funis diferentes
      if (etapaDestino.funil_id !== selectedFunil) {
        console.error('[DRAG END] ⚠️ Tentativa de mover entre funis diferentes:', {
          etapaFunilId: etapaDestino.funil_id,
          funilSelecionado: selectedFunil
        });
        toast.error("Não é possível mover leads entre funis diferentes", {
          description: "Use a opção 'Mover para outro funil' no menu do lead"
        });
        return;
      }

      // ✅ Verificar se já está na mesma etapa (movimento desnecessário)
      if (lead.etapa_id === newEtapaId) {
        console.log('[DRAG END] ℹ️ Lead já está na etapa destino - ignorando');
        return;
      }

      // 💾 Guardar estado original para rollback em caso de erro
      const originalEtapaId = lead.etapa_id;
      const originalFunilId = lead.funil_id;
      const etapaOrigem = etapas.find(e => e.id === originalEtapaId);

      console.log('[DRAG END] ✅ Validações OK - iniciando movimentação:', {
        leadId,
        leadNome: lead.name,
        de: etapaOrigem?.nome || 'sem etapa',
        para: etapaDestino.nome,
        funilId: etapaDestino.funil_id
      });

      // 🎨 Atualizar UI imediatamente (otimistic update)
      setLeads(currentLeads =>
        currentLeads.map(l =>
          l.id === leadId
            ? { ...l, etapa_id: newEtapaId, funil_id: etapaDestino.funil_id }
            : l
        )
      );

      // 🔒 Bloquear novas operações
      isMovingRef.current = true;

      // 💾 Atualizar no banco de dados
      const { error } = await supabase
        .from("leads")
        .update({
          etapa_id: newEtapaId,
          funil_id: etapaDestino.funil_id,
          stage: etapaDestino.nome.toLowerCase(),
          updated_at: new Date().toISOString()
        })
        .eq("id", leadId);

      if (error) {
        console.error('[DRAG END] ❌ Erro na atualização do banco:', error);
        throw error;
      }

      console.log('[DRAG END] ✅ Lead movido com sucesso no banco');
      toast.success(`Lead movido para "${etapaDestino.nome}"`, {
        description: `${lead.name} foi movido com sucesso`
      });

      // 🎯 Abrir popup para criar tarefa somente na coluna Ganho/Fechado
      const nomeDestinoLower = etapaDestino.nome?.toLowerCase().trim() || '';
      const isGanhoFechado = ['ganho', 'fechado', 'ganha', 'fechada', 'ganho/fechado', 'ganha/fechada'].some(
        keyword => nomeDestinoLower.includes(keyword)
      );
      if (isGanhoFechado) {
        setTarefaDialogData({
          open: true,
          leadId: leadId,
          leadName: lead.name || lead.nome,
          etapaDestino: etapaDestino.nome,
        });
      }

      // 🌍 Emitir evento global para sincronização com outros módulos
      emitGlobalEvent({
        type: 'funnel-stage-changed',
        data: {
          leadId: leadId,
          leadName: lead.name,
          oldStage: etapaOrigem?.nome || 'sem etapa',
          newStage: etapaDestino.nome,
          funilId: etapaDestino.funil_id,
          etapaId: newEtapaId
        },
        source: 'Funil'
      });

    } catch (error: any) {
      console.error('[DRAG END] ❌ Erro crítico ao mover lead:', error);

      // 🎯 Determinar mensagem de erro específica e útil
      let errorTitle = "Erro ao mover lead";
      let errorDescription = "Tente novamente";

      if (error?.code === 'PGRST116') {
        errorTitle = "Lead não encontrado no servidor";
        errorDescription = "O lead pode ter sido deletado";
      } else if (error?.code === '23503') {
        errorTitle = "Erro de referência";
        errorDescription = "Etapa ou funil inválido";
      } else if (error?.message?.includes('network') || !navigator.onLine) {
        errorTitle = "Erro de conexão";
        errorDescription = "Verifique sua internet";
      } else if (error?.message) {
        errorDescription = error.message;
      }

      toast.error(errorTitle, { description: errorDescription });

      // 🔄 Reverter mudança local (rollback)
      const leadId = event.active.id as string;
      const lead = leads.find(l => l.id === leadId);
      
      if (lead) {
        const originalEtapaId = dragOperation.sourceEtapa;
        const originalFunilId = lead.funil_id;

        console.log('[DRAG END] 🔄 Revertendo mudança local:', {
          leadId,
          revertendoPara: originalEtapaId
        });

        setLeads(currentLeads =>
          currentLeads.map(l =>
            l.id === leadId
              ? { ...l, etapa_id: originalEtapaId, funil_id: originalFunilId }
              : l
          )
        );
      }
    } finally {
      // 🔓 Liberar bloqueio de operações
      isMovingRef.current = false;
    }
  };

  // 🎯 Calcular dados das etapas com useMemo para otimização
  const etapasFiltradas = useMemo(() =>
    etapas.filter((etapa) => etapa.funil_id === selectedFunil),
    [etapas, selectedFunil]
  );

  // 🎯 Pré-calcular totais e métricas avançadas de todas as etapas de uma vez (mais eficiente)
  const etapaStats = useMemo(() => {
    const stats: Record<string, { 
      total: number; 
      count: number; 
      leads: Lead[];
      valorMedio: number;
      taxaConversao: number;
      tempoMedio: number;
    }> = {};
    
    etapasFiltradas.forEach((etapa, index) => {
      const leadsNaEtapa = leads.filter(l => l.etapa_id === etapa.id);
      const total = leadsNaEtapa.reduce((sum, lead) => sum + (lead.value || 0), 0);
      const count = leadsNaEtapa.length;
      
      // 📊 Valor médio por lead
      const valorMedio = count > 0 ? total / count : 0;
      
      // 📈 Taxa de conversão (quantos leads avançaram para próxima etapa)
      let taxaConversao = 0;
      if (index < etapasFiltradas.length - 1) {
        const proximaEtapa = etapasFiltradas[index + 1];
        const leadsProximaEtapa = leads.filter(l => l.etapa_id === proximaEtapa.id).length;
        taxaConversao = count > 0 ? (leadsProximaEtapa / count) * 100 : 0;
      }
      
      // ⏱️ Tempo médio na etapa (simulado - em produção viria do histórico)
      // Por enquanto, vamos calcular com base na idade dos leads
      const tempoMedio = leadsNaEtapa.length > 0
        ? leadsNaEtapa.reduce((sum, lead) => {
            const createdAt = new Date(lead.created_at || Date.now());
            const now = new Date();
            const dias = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            return sum + dias;
          }, 0) / leadsNaEtapa.length
        : 0;
      
      stats[etapa.id] = {
        total,
        count,
        leads: leadsNaEtapa,
        valorMedio,
        taxaConversao,
        tempoMedio
      };
    });
    
    return stats;
  }, [etapasFiltradas, leads]);

  // 🎯 Função otimizada para obter total de uma etapa
  const calcularTotalEtapa = useCallback((etapaId: string) => {
    return etapaStats[etapaId]?.total || 0;
  }, [etapaStats]);

  // 🎯 Função otimizada para obter quantidade de leads em uma etapa
  const getQuantidadeLeads = useCallback((etapaId: string) => {
    return etapaStats[etapaId]?.count || 0;
  }, [etapaStats]);

  // 🎯 Função otimizada para obter leads de uma etapa
  const getLeadsEtapa = useCallback((etapaId: string) => {
    return etapaStats[etapaId]?.leads || [];
  }, [etapaStats]);

  // 🎯 Navegação horizontal suave
  const scrollHorizontal = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = 340; // Largura da coluna + gap
    const targetScroll = direction === 'left' 
      ? container.scrollLeft - scrollAmount 
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }, []);

  // Função para reordenar etapas
  const handleEtapaReorder = useCallback(async (activeId: string, overId: string) => {
    if (activeId === overId) return;

    console.log('[REORDER] 🔄 Iniciando reordenação de etapas');

    const activeIndex = etapasFiltradas.findIndex(etapa => etapa.id === activeId);
    const overIndex = etapasFiltradas.findIndex(etapa => etapa.id === overId);

    if (activeIndex === -1 || overIndex === -1) {
      console.error('[REORDER] ❌ Índices não encontrados:', { activeIndex, overIndex });
      return;
    }

    // Criar nova ordem das etapas
    const reorderedEtapas = [...etapasFiltradas];
    const [movedEtapa] = reorderedEtapas.splice(activeIndex, 1);
    reorderedEtapas.splice(overIndex, 0, movedEtapa);

    console.log('[REORDER] 📋 Nova ordem:', reorderedEtapas.map((e, i) => `${i + 1}. ${e.nome}`));

    // Atualizar posições
    const updatedEtapas = reorderedEtapas.map((etapa, index) => ({
      ...etapa,
      posicao: index + 1
    }));

    try {
      // 🔒 Bloquear realtime durante reordenação
      isMovingRef.current = true;

      // 🎨 Atualizar UI imediatamente (optimistic update)
      setEtapas(prev =>
        prev.map(etapa =>
          etapa.funil_id === selectedFunil
            ? updatedEtapas.find(e => e.id === etapa.id) || etapa
            : etapa
        )
      );

      // 💾 Atualizar no banco de dados
      console.log('[REORDER] 💾 Atualizando posições no banco...');

      // Tentar usar RPC primeiro (mais eficiente e atômico)
      try {
        const { error: rpcError } = await supabase.rpc('reorder_etapas', {
          p_funil_id: selectedFunil,
          p_order: updatedEtapas.map(etapa => etapa.id)
        });

        if (!rpcError) {
          console.log('[REORDER] ✅ Etapas reordenadas com sucesso via RPC');
          toast.success('Ordem das etapas atualizada');
          return;
        }

        console.warn('[REORDER] ⚠️ RPC falhou, usando método alternativo:', rpcError);
      } catch (rpcErr) {
        console.warn('[REORDER] ⚠️ RPC não disponível, usando método alternativo');
      }

      // Fallback: atualizar cada etapa individualmente
      const updatePromises = updatedEtapas.map(etapa =>
        supabase
          .from('etapas')
          .update({ posicao: etapa.posicao })
          .eq('id', etapa.id)
      );

      const results = await Promise.all(updatePromises);

      // Verificar erros
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error('[REORDER] ❌ Erros nas atualizações:', errors);
        throw new Error('Erro ao atualizar posições das etapas');
      }

      console.log('[REORDER] ✅ Etapas reordenadas com sucesso');
      toast.success('Ordem das etapas atualizada');

    } catch (error) {
      console.error('[REORDER] ❌ Erro ao reordenar etapas:', error);
      toast.error('Erro ao reordenar etapas');

      // 🔄 Reverter mudanças locais
      console.log('[REORDER] 🔄 Revertendo mudanças...');
      await refreshEtapas();
    } finally {
      // 🔓 Desbloquear realtime após pequeno delay
      setTimeout(() => {
        isMovingRef.current = false;
      }, 500);
    }
  }, [etapasFiltradas, selectedFunil]);

  const funilSelecionado = funis.find(f => f.id === selectedFunil);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando funil de vendas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!funis || funis.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
          {canCreateFunil && <NovoFunilDialog onFunilCreated={() => window.location.reload()} />}
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhum funil criado ainda</p>
          {canCreateFunil ? (
            <NovoFunilDialog onFunilCreated={() => window.location.reload()} />
          ) : (
            <p className="text-sm text-muted-foreground">Entre em contato com o administrador para criar funis</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-0 py-6">
      {/* Header com indicador de conexão */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Funil de Vendas
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus leads por etapas • {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateFunil && (
            <NovoFunilDialog onFunilCreated={async () => { await refreshFunis(); await refreshEtapas(); }} />
          )}
          <NovoLeadDialog
            onLeadCreated={refreshLeads}
            triggerButton={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
              </Button>
            }
          />
          {funilSelecionado && etapasFiltradas.length > 0 && (
            <AdicionarLeadExistenteDialog
              funilId={funilSelecionado.id}
              etapaInicial={{ id: etapasFiltradas[0].id, nome: etapasFiltradas[0].nome }}
              onLeadAdded={refreshLeads}
            />
          )}
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <Label>Funil</Label>
          <select
            value={selectedFunil}
            onChange={(e) => setSelectedFunil(e.target.value)}
            className="w-full p-2 border rounded-md mt-2"
          >
            {funis.map((funil) => (
              <option key={funil.id} value={funil.id}>{funil.nome}</option>
            ))}
          </select>
        </div>
        {funilSelecionado && canCreateFunil && (
          <div className="mt-6 flex gap-2">
            <AdicionarEtapaDialog
              funilId={funilSelecionado.id}
              onEtapaAdded={async () => { await refreshEtapas(); }}
            />
            <EditarFunilDialog
              funilId={funilSelecionado.id}
              funilNome={funilSelecionado.nome}
              onFunilUpdated={async () => { await refreshFunis(); await refreshEtapas(); }}
            />
          </div>
        )}
        {/* 🎯 Botões de navegação horizontal */}
        {etapasFiltradas.length > 3 && (
          <div className="mt-6 flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scrollHorizontal('left')}
              title="Rolar para esquerda"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scrollHorizontal('right')}
              title="Rolar para direita"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={(event) => {
          const { active } = event;
          const activeData = active.data.current;

          // Verificar se estamos arrastando uma etapa
          if (activeData?.type === 'etapa') {
            const etapa = etapasFiltradas.find(e => e.id === active.id);
            setActiveColumn(etapa || null);
          } else {
            handleDragStart(event);
          }
        }}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={etapasFiltradas.map(e => e.id)} strategy={horizontalListSortingStrategy}>
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-4 pb-4 min-h-[600px] scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-muted/20 hover:scrollbar-thumb-primary/50 snap-x snap-mandatory scroll-smooth"
          >
            {etapasFiltradas.map((etapa, index) => {
            // 🎯 Usar funções otimizadas pré-calculadas
            const totalEtapa = calcularTotalEtapa(etapa.id);
            const quantidadeLeads = getQuantidadeLeads(etapa.id);
            const leadsNaEtapa = getLeadsEtapa(etapa.id);
            const maxLeadsToShow = leadsPerEtapa[etapa.id] || LEADS_PER_PAGE;
            const leadsToShow = leadsNaEtapa.slice(0, maxLeadsToShow);
            const hasMoreLeads = leadsNaEtapa.length > maxLeadsToShow;

            return (
                <React.Fragment key={etapa.id}>
                  <SortableColumn
                    id={etapa.id}
                    isDragging={activeColumn?.id === etapa.id}
                  >
                <DroppableColumn
                  id={etapa.id}
                  cor={etapa.cor}
                  nome={etapa.nome}
                  quantidadeLeads={quantidadeLeads}
                  totalEtapa={totalEtapa}
                  valorMedio={etapaStats[etapa.id]?.valorMedio || 0}
                  taxaConversao={etapaStats[etapa.id]?.taxaConversao || 0}
                  tempoMedio={etapaStats[etapa.id]?.tempoMedio || 0}
                  onEtapaUpdated={async () => { await refreshEtapas(); await refreshLeads(); }}
                  isDraggingOver={dragOperation.isDragging && dragOperation.sourceEtapa !== etapa.id}
                >
                  {leadsToShow.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      etapas={etapasFiltradas}
                      onDelete={async (id) => {
                        try {
                          // Remover do funil sem deletar o lead (evita falha por relacionamentos)
                          const { error } = await supabase
                            .from("leads")
                            .update({ funil_id: null, etapa_id: null })
                            .eq("id", id);
                          if (error) throw error;

                          setLeads(current => current.filter(l => l.id !== id));
                          toast.success("Lead removido do funil");
                        } catch (error) {
                          console.error("Erro ao remover do funil:", error);
                          toast.error("Erro ao remover do funil");
                        }
                      }}
                      onLeadMoved={refreshLeads}
                      isDragging={dragOperation.isDragging && dragOperation.leadId === lead.id}
                    />
                  ))}

                  {hasMoreLeads && (
                    <div className="text-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadMoreLeads(etapa.id)}
                        className="text-xs"
                      >
                        Carregar mais leads ({leadsNaEtapa.length - maxLeadsToShow} restantes)
                      </Button>
                    </div>
                  )}

                  {leadsNaEtapa.length === 0 && (
                    <div className={`text-center py-8 text-muted-foreground text-sm transition-all duration-200 ${
                      dragOperation.isDragging ? 'bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg' : ''
                    }`}>
                      {dragOperation.isDragging ? 'Solte aqui para mover' : 'Arraste leads para cá'}
                    </div>
                  )}
                  </DroppableColumn>
                  </SortableColumn>
                </React.Fragment>
            );
          })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeColumn ? (
            <div className="min-w-[320px] opacity-90 rotate-3 scale-105">
              <DroppableColumn
                id={activeColumn.id}
                cor={activeColumn.cor}
                nome={activeColumn.nome}
                quantidadeLeads={leads.filter(l => l.etapa_id === activeColumn.id).length}
                totalEtapa={calcularTotalEtapa(activeColumn.id)}
                onEtapaUpdated={() => {}}
                isDraggingOver={false}
              >
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Movendo etapa...
                </div>
              </DroppableColumn>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CriarTarefaAoMoverDialog
        open={tarefaDialogData.open}
        onOpenChange={(open) => setTarefaDialogData(prev => ({ ...prev, open }))}
        leadId={tarefaDialogData.leadId}
        leadName={tarefaDialogData.leadName}
        etapaDestino={tarefaDialogData.etapaDestino}
      />
    </div>
  );
}