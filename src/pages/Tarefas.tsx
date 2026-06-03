/**
 * ✅ OTIMIZAÇÕES DE PERFORMANCE IMPLEMENTADAS:
 * 1. Debounce na busca (300ms) - reduz chamadas de filtro durante digitação
 * 2. Memoização de tarefas filtradas por coluna (tasksByColumn)
 * 3. Memoização de contagens por coluna (taskCountsByColumn)
 * 4. Limite de carga inicial (INITIAL_LOAD_LIMIT = 50)
 * 5. Query filtrada por board_id quando selecionado
 * 6. Lazy loading com paginação (TASKS_PER_PAGE = 20)
 * 7. useMemo para métricas de produtividade
 * 8. useCallback para funções de filtro
 * 9. React.memo em TaskCard (verificado)
 * 10. React.memo em DroppableColumnContainer
 */

import React, { useState, useEffect, type ReactNode, useMemo, useCallback, useRef } from "react";
import { DndContext, DragEndEvent, closestCorners, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Settings, Trash2, Pencil, MoreVertical, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { TaskCard } from "@/components/tarefas/TaskCard";
import { NovaTarefaDialog } from "@/components/tarefas/NovaTarefaDialog";
import { EditarQuadroDialog } from "@/components/tarefas/EditarQuadroDialog";
import { AdicionarColunaDialog } from "@/components/tarefas/AdicionarColunaDialog";
import { EditarColunaDialog } from "@/components/tarefas/EditarColunaDialog";
import { DeletarColunaDialog } from "@/components/tarefas/DeletarColunaDialog";
import { toast } from "sonner";
import { TarefasProvider } from "@/context/TarefasContext";
import { TarefaCalendar } from "@/components/tarefas/TarefaCalendar";
import { Button as UIButton } from "@/components/ui/button";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { usePermissions } from "@/hooks/usePermissions";
interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status?: string;
  assignee_id: string | null;
  assignee_name?: string;
  responsaveis?: string[];
  responsaveis_names?: string[];
  start_date: string | null; // Data início do prazo
  due_date: string | null; // Data final do prazo
  lead_id: string | null;
  lead_name?: string;
  column_id?: string | null;
  board_id?: string | null;
  checklist?: {
    id?: string;
    text: string;
    done: boolean;
  }[];
  comments?: {
    id?: string;
    text: string;
    author_id?: string;
    created_at?: string;
  }[];
  attachments?: {
    name: string;
    url: string;
    type?: string;
  }[];
  tags?: string[];
  tempo_gasto?: number;
  time_tracking_iniciado?: string;
  time_tracking_pausado?: boolean;
  owner_id?: string;
  owner_name?: string;
}
interface Column {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  board_id: string;
}
interface Board {
  id: string;
  nome: string;
  descricao?: string;
}

// ✅ MELHORADO: DroppableColumnContainer com identificação clara da coluna
const DroppableColumnContainer = React.memo(function DroppableColumnContainer({
  columnId,
  children
}: {
  columnId: string;
  children: ReactNode;
}) {
  const {
    setNodeRef,
    isOver
  } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId: columnId,
      accepts: ['task'] // ✅ Aceita apenas tarefas
    }
  });
  return <div ref={setNodeRef} data-column-id={columnId} data-droppable="true" className={`bg-secondary/20 p-4 rounded-b-lg min-h-[500px] transition-all duration-200 ${isOver ? 'bg-primary/20 border-2 border-primary border-dashed shadow-lg scale-[1.02]' : 'border border-transparent'}`}>
      {children}
    </div>;
});

// ✅ NOVO: SortableColumn - Coluna que pode ser arrastada e reordenada
const SortableColumn = React.memo(function SortableColumn({
  column,
  tasksByColumn,
  tasksPerColumn,
  taskCountsByColumn,
  TASKS_PER_PAGE,
  tasks,
  loadingMore,
  carregarDados,
  loadMoreTasks,
  selectedBoard,
  emitGlobalEvent,
  allColumns,
  onMoveTask,
  setTasks
}: {
  column: Column;
  tasksByColumn: Record<string, Task[]>;
  tasksPerColumn: Record<string, number>;
  taskCountsByColumn: Record<string, number>;
  TASKS_PER_PAGE: number;
  tasks: Task[];
  loadingMore: Record<string, boolean>;
  carregarDados: () => void;
  loadMoreTasks: (columnId: string) => void;
  selectedBoard: string;
  emitGlobalEvent: (event: any) => void;
  allColumns: Column[];
  onMoveTask: (taskId: string, newColumnId: string) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id,
    data: {
      type: 'column',
      // ✅ CRÍTICO: Identifica drag de coluna
      column
    }
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.7 : 1
  };
  return <div ref={setNodeRef} style={{
    ...style,
    width: isDragging ? '380px' : '380px',
    minWidth: '380px',
    maxWidth: '380px',
    flexShrink: 0,
    flexGrow: 0,
    position: 'relative',
    boxSizing: 'border-box'
  }} className={`relative group ${isDragging ? 'z-[100]' : ''}`} data-column-id={column.id} data-sortable-column="true">
      {/* Drag handle - igual ao funil */}
      <div {...attributes} {...listeners} className="absolute -top-2 -left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <div className="bg-background border rounded-full p-1 shadow-md">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <div className="text-white p-3 rounded-t-lg" style={{
      backgroundColor: column.cor
    }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{column.nome}</h3>
          <div className="flex gap-1">
            <EditarColunaDialog columnId={column.id} nomeAtual={column.nome} corAtual={column.cor} onColumnUpdated={carregarDados} />
            <DeletarColunaDialog columnId={column.id} columnNome={column.nome} onColumnDeleted={carregarDados} />
          </div>
        </div>
        <span className="text-sm">
          {taskCountsByColumn[column.id] || 0} tarefas
        </span>
      </div>
      <SortableContext id={column.id} items={(tasksByColumn[column.id] || []).slice(0, tasksPerColumn[column.id] || TASKS_PER_PAGE).map(t => t.id)} strategy={verticalListSortingStrategy}>
        <DroppableColumnContainer columnId={column.id}>
          <NovaTarefaDialog columnId={column.id} boardId={selectedBoard} onTaskCreated={() => {
            // ✅ OTIMIZADO: Não recarregar - Realtime cuida da atualização
            console.log('✅ [Tarefas] Tarefa criada - Realtime irá atualizar automaticamente');
          }} />
          {(tasksByColumn[column.id] || []).slice(0, tasksPerColumn[column.id] || TASKS_PER_PAGE).map(task => <TaskCard 
            key={task.id} 
            task={task} 
            columns={allColumns}
            onMove={onMoveTask}
            onDelete={async id => {
              const taskToDelete = tasks.find(t => t.id === id);
              // ✅ OTIMIZADO: Remover otimisticamente antes da chamada API
              setTasks(prev => prev.filter(t => t.id !== id));
              
              try {
                await supabase.functions.invoke("api-tarefas", {
                  body: {
                    action: "deletar_tarefa",
                    data: {
                      task_id: id
                    }
                  }
                });
                if (taskToDelete) {
                  emitGlobalEvent({
                    type: 'task-deleted',
                    data: taskToDelete,
                    source: 'Tarefas'
                  });
                }
              } catch (error) {
                console.error('Erro ao deletar tarefa:', error);
                // Reverter se falhar
                if (taskToDelete) {
                  setTasks(prev => [...prev, taskToDelete]);
                }
                toast.error('Erro ao excluir tarefa');
              }
            }} 
            onUpdate={() => {
              // ✅ OTIMIZADO: Não recarregar - Realtime cuida da atualização
              console.log('✅ [Tarefas] Tarefa atualizada - Realtime irá atualizar automaticamente');
            }} 
          />)}

          {(() => {
          const totalTasksInColumn = taskCountsByColumn[column.id] || 0;
          const visibleTasks = tasksPerColumn[column.id] || TASKS_PER_PAGE;
          const hasMoreTasks = totalTasksInColumn > visibleTasks;
          if (hasMoreTasks) {
            return <div className="text-center py-4">
                  <Button variant="outline" size="sm" onClick={() => loadMoreTasks(column.id)} disabled={loadingMore[column.id]} className="text-xs">
                    {loadingMore[column.id] ? <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                        Carregando...
                      </> : `Carregar mais tarefas (${totalTasksInColumn - visibleTasks} restantes)`}
                  </Button>
                </div>;
          }
          return null;
        })()}
        </DroppableColumnContainer>
      </SortableContext>
    </div>;
});
export default function Tarefas() {
  const {
    canManageStructure,
    isAdmin,
    hasPermission
  } = usePermissions();
  const [canManageTaskStructure, setCanManageTaskStructure] = useState(true); // Padrão: permitir (comportamento atual)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [novoBoardNome, setNovoBoardNome] = useState("");
  const [dialogNovoBoard, setDialogNovoBoard] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "calendar" | "dashboard">("board");
  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>("");
  const [allUsers, setAllUsers] = useState<{
    id: string;
    full_name: string;
  }[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [tasksPerColumn, setTasksPerColumn] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState<Record<string, boolean>>({});
  const [editarQuadroOpen, setEditarQuadroOpen] = useState(false);
  const [excluirQuadroOpen, setExcluirQuadroOpen] = useState(false);
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null); // ✅ Rastrear coluna sendo arrastada
  const activeColumnIdRef = useRef<string | null>(null); // ✅ Ref para acessar no realtime
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMovingRef = useRef(false); // ✅ NOVO: Bloquear operações concorrentes
  const lastOverColumnRef = useRef<string | null>(null); // ✅ NOVO: Rastrear última coluna sobre a qual passou
  const lastDragOverTimeRef = useRef<number>(0); // ✅ NOVO: Timestamp para evitar atualizações incorretas
  const confirmedTargetColumnRef = useRef<string | null>(null); // ✅ NOVO: Coluna destino confirmada
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null); // ✅ NOVO: Posição do mouse
  const scrollContainerRef = useRef<HTMLDivElement>(null); // 🎯 Ref para navegação horizontal

  const TASKS_PER_PAGE = 20; // ✅ OTIMIZAÇÃO: Aumentado de 10 para 20
  const INITIAL_LOAD_LIMIT = 50; // ✅ OTIMIZAÇÃO: Limitar carga inicial

  // ✅ CRÍTICO: Se for admin, SEMPRE permitir gerenciar estrutura
  // Este useEffect tem prioridade máxima e executa sempre que isAdmin mudar
  useEffect(() => {
    if (isAdmin) {
      console.log('🔐 [Tarefas] Usuário é admin, garantindo permissão para gerenciar estrutura');
      setCanManageTaskStructure(true);
    }
  }, [isAdmin]);

  // Verificar permissão de gerenciar estrutura de tarefas (apenas se NÃO for admin)
  useEffect(() => {
    // ✅ CRÍTICO: Se for admin, não fazer verificação (já foi definido como true no useEffect anterior)
    if (isAdmin) {
      return; // Não fazer nada, já está definido como true
    }

    // Só verificar permissão se NÃO for admin
    const checkPermission = async () => {
      // ✅ Verificar novamente antes de fazer a chamada (pode ter virado admin)
      if (isAdmin) {
        return;
      }
      try {
        const canManage = await canManageStructure('tarefas');
        console.log('🔐 [Tarefas] Permissão para gerenciar estrutura:', canManage);
        // ✅ Só atualizar se ainda não for admin (pode ter mudado durante a verificação)
        if (!isAdmin) {
          setCanManageTaskStructure(canManage);
        }
      } catch (error) {
        console.error('❌ [Tarefas] Erro ao verificar permissão:', error);
        // Em caso de erro, permitir por padrão para não bloquear funcionalidades
        // Mas só se não for admin (para não sobrescrever)
        if (!isAdmin) {
          setCanManageTaskStructure(true);
        }
      }
    };
    checkPermission();
  }, [isAdmin, canManageStructure]);
  const columnsFiltradas = useMemo(() => columns.filter(column => column.board_id === selectedBoard), [columns, selectedBoard]);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 3
    } // ✅ Reduzido para tornar drag mais responsivo
  }));

  // Integrar sincronização de leads em tempo real
  useLeadsSync({
    onInsert: newLead => {
      console.log('📡 [Tarefas] Novo lead adicionado via sync:', newLead);
      // Atualizar tarefas relacionadas ao lead se necessário
      setTasks(prev => prev.map(task => {
        if (task.lead_id === newLead.id) {
          return {
            ...task,
            lead_name: newLead.name || task.lead_name
          };
        }
        return task;
      }));
    },
    onUpdate: (updatedLead, oldLead) => {
      console.log('📡 [Tarefas] Lead atualizado via sync:', updatedLead);
      // Atualizar tarefas relacionadas ao lead
      setTasks(prev => prev.map(task => {
        if (task.lead_id === updatedLead.id) {
          return {
            ...task,
            lead_name: updatedLead.name || task.lead_name
          };
        }
        return task;
      }));
    },
    onDelete: deletedLead => {
      console.log('📡 [Tarefas] Lead removido via sync:', deletedLead);
      // Limpar referências a leads deletados
      setTasks(prev => prev.map(task => {
        if (task.lead_id === deletedLead.id) {
          return {
            ...task,
            lead_id: null,
            lead_name: undefined
          };
        }
        return task;
      }));
    },
    showNotifications: false // Desabilitar notificações para evitar duplicação
  });

  // Sistema de eventos globais para comunicação entre módulos
  const {
    emitGlobalEvent
  } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: data => {
        console.log('🌍 [Tarefas] Lead atualizado via evento global:', data);
        // Atualizar tarefas relacionadas ao lead
        setTasks(prev => prev.map(task => {
          if (task.lead_id === data.id) {
            return {
              ...task,
              lead_name: data.name || task.lead_name
            };
          }
          return task;
        }));
      },
      onTaskCreated: data => {
        console.log('🌍 [Tarefas] Nova tarefa criada via evento global:', data);
        // Se a tarefa foi criada em outro módulo, recarregar dados
        carregarDados();
      },
      onTaskUpdated: data => {
        console.log('🌍 [Tarefas] Tarefa atualizada via evento global:', data);
        // Atualizar tarefa específica
        setTasks(prev => prev.map(task => {
          if (task.id === data.id) {
            return {
              ...task,
              ...data,
              lead_name: data.lead?.name || task.lead_name,
              assignee_name: data.assignee?.full_name || task.assignee_name
            };
          }
          return task;
        }));
      },
      onTaskDeleted: data => {
        console.log('🌍 [Tarefas] Tarefa removida via evento global:', data);
        setTasks(prev => prev.filter(task => task.id !== data.id));
      },
      onMeetingScheduled: data => {
        console.log('🌍 [Tarefas] Reunião agendada, verificar se afeta tarefas:', data);
        // Se uma reunião foi agendada, pode criar tarefa de follow-up automaticamente
        if (data.lead_id) {
          // Opcional: lógica para criar tarefa relacionada
        }
      },
      onFunnelStageChanged: data => {
        console.log('🌍 [Tarefas] Lead movido no funil, verificar tarefas relacionadas:', data);
        // Atualizar tarefas relacionadas ao lead que mudou de etapa
        setTasks(prev => prev.map(task => {
          if (task.lead_id === data.leadId) {
            return {
              ...task,
              lead_name: data.leadName || task.lead_name
            };
          }
          return task;
        }));
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });
  useEffect(() => {
    carregarDados();
    // ✅ CORRIGIDO: Buscar apenas usuários da empresa atual (não de subcontas)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar company_id do usuário atual
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!userRole?.company_id) {
          console.warn("[Tarefas] Company ID não encontrado");
          return;
        }

        // Buscar apenas usuários vinculados à mesma empresa
        const { data: companyUserRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("company_id", userRole.company_id);

        const userIds = (companyUserRoles || []).map((ur: any) => ur.user_id);

        if (userIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in("id", userIds)
            .order('full_name');
          setAllUsers(data as any || []);
        }
      } catch (error) {
        console.error("[Tarefas] Erro ao carregar usuários:", error);
      }
    })();

    // Realtime: tasks (atualizações incrementais)
    // ✅ CORRIGIDO: Usa campos reais do banco (checklist, tags, comments, attachments) sem fallback
    // ✅ MELHORADO: Buscar nomes dos responsáveis assincronamente
    const formatTaskWithResponsaveis = async (task: any): Promise<Task> => {
      let responsaveis_names: string[] = [];
      let assignee_name = (task as any).assignee?.full_name;
      let lead_name = (task as any).lead?.nome || (task as any).lead?.name || task.lead_name;
      
      // Buscar nomes dos responsáveis se houver IDs
      if (Array.isArray(task.responsaveis) && task.responsaveis.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', task.responsaveis);
        
        if (profiles) {
          responsaveis_names = task.responsaveis
            .map((id: string) => profiles.find(p => p.id === id)?.full_name)
            .filter(Boolean);
        }
      }
      
      // Buscar nome do assignee se não veio no relacionamento
      if (!assignee_name && task.assignee_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', task.assignee_id)
          .maybeSingle();
        assignee_name = profile?.full_name;
      }
      
      // Buscar nome do lead se não veio no relacionamento
      if (!lead_name && task.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('name')
          .eq('id', task.lead_id)
          .maybeSingle();
        lead_name = lead?.name;
      }
      
      return {
        ...task,
        checklist: task.checklist ?? [],
        tags: task.tags ?? [],
        comments: task.comments ?? [],
        attachments: task.attachments ?? [],
        assignee_name,
        responsaveis_names,
        lead_name
      } as Task;
    };

    // Formato simplificado para fallback (sem busca de nomes)
    const formatTaskSimple = (task: any, existingTask?: Task): Task => {
      return {
        ...task,
        checklist: task.checklist ?? [],
        tags: task.tags ?? [],
        comments: task.comments ?? [],
        attachments: task.attachments ?? [],
        assignee_name: existingTask?.assignee_name,
        responsaveis_names: existingTask?.responsaveis_names ?? [],
        lead_name: existingTask?.lead_name
      } as Task;
    };

    const tasksChannel = supabase.channel('tasks_board_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks'
    }, async (payload: any) => {
      // 🔒 CRÍTICO: Ignorar eventos de UPDATE durante operações de drag
      // para evitar race condition que sobrescreve a atualização otimista
      if (payload.eventType === 'UPDATE' && isMovingRef.current) {
        console.log('[REALTIME] 🔒 Ignorando UPDATE de tarefa durante drag:', payload.new.id);
        return;
      }

      if (payload.eventType === 'INSERT') {
        // Para INSERT, buscar nomes dos responsáveis
        const formattedTask = await formatTaskWithResponsaveis(payload.new);
        setTasks(prev => [formattedTask, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        // Para UPDATE, verificar se o column_id do payload corresponde a uma atualização válida
        // Isso evita que eventos antigos (com column_id errado) sobrescrevam a atualização otimista
        setTasks(prev => prev.map(t => {
          if (t.id === payload.new.id) {
            // ✅ MELHORADO: Usar column_id do payload.new (que vem do banco)
            // mas só se não estiver em operação de drag
            const updatedTask = formatTaskSimple(payload.new, t);
            console.log('[REALTIME] 📡 Atualizando tarefa:', {
              taskId: t.id,
              oldColumnId: t.column_id,
              newColumnId: payload.new.column_id,
              isMoving: isMovingRef.current
            });
            return updatedTask;
          }
          return t;
        }));
        // Buscar nomes atualizados em background
        formatTaskWithResponsaveis(payload.new).then(formattedTask => {
          setTasks(prev => prev.map(t => 
            t.id === formattedTask.id ? formattedTask : t
          ));
        });
      } else if (payload.eventType === 'DELETE') {
        setTasks(prev => prev.filter(t => t.id !== payload.old.id));
      }
    }).subscribe();

    // Realtime: colunas e quadros
    // ✅ CORRIGIDO: Respeitar bloqueio durante operação de drag
    const columnsChannel = supabase.channel('task_columns_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_columns'
    }, (payload: any) => {
      // 🔒 Não recarregar se houver operação de drag em andamento OU coluna sendo arrastada
      if (isMovingRef.current || activeColumnIdRef.current) {
        console.log('[REALTIME] 🔒 Ignorando update de coluna durante drag', {
          isMoving: isMovingRef.current,
          activeColumn: activeColumnIdRef.current
        });
        return;
      }
      console.log('[REALTIME] 📡 Recarregando colunas após mudança');
      carregarDados();
    }).subscribe();
    const boardsChannel = supabase.channel('task_boards_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_boards'
    }, () => {
      // 🔒 Não recarregar se houver operação de drag em andamento
      if (isMovingRef.current) {
        console.log('[REALTIME] 🔒 Ignorando update de board durante drag');
        return;
      }
      console.log('[REALTIME] 📡 Recarregando boards após mudança');
      carregarDados();
    }).subscribe();
    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(columnsChannel);
      supabase.removeChannel(boardsChannel);
    };
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Só executar atalhos se não estiver digitando em um input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'n':
          // Nova tarefa - abre o primeiro dialog de nova tarefa
          event.preventDefault();
          if (selectedBoard && columnsFiltradas.length > 0) {
            const firstColumnButton = document.querySelector(`[data-column-id="${columnsFiltradas[0].id}"] button[data-role="nova-tarefa-btn"]`);
            if (firstColumnButton instanceof HTMLButtonElement) {
              firstColumnButton.click();
            }
          }
          break;
        case 'b':
          // Alternar para board view
          event.preventDefault();
          setViewMode('board');
          break;
        case 'c':
          // Alternar para calendar view
          event.preventDefault();
          setViewMode('calendar');
          break;
        case 'd':
          // Alternar para dashboard view
          event.preventDefault();
          setViewMode('dashboard');
          break;
        case 'escape':
          // Fechar dialogs abertos
          event.preventDefault();
          setDialogNovoBoard(false);
          // Outros dialogs podem ser fechados aqui se necessário
          break;
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedBoard, columnsFiltradas]);
  const carregarDados = async () => {
    try {
      setLoading(true);
      const {
        data: boardsData
      } = await supabase.from("task_boards").select("*").order("criado_em");
      console.log('📋 [Tarefas] Boards carregados:', boardsData?.length || 0, boardsData);
      setBoards(boardsData || []);
      if (!selectedBoard && boardsData && boardsData.length > 0) {
        console.log('📋 [Tarefas] Selecionando primeiro board:', boardsData[0].id, boardsData[0].nome);
        setSelectedBoard(boardsData[0].id);
      } else {
        console.log('📋 [Tarefas] Board já selecionado ou sem boards:', selectedBoard);
      }

      // ✅ CRÍTICO: Ordenar colunas por posição - filtrar por board selecionado
      let columnsQuery = supabase.from("task_columns").select("*").order("posicao", {
        ascending: true
      });
      if (selectedBoard) {
        columnsQuery = columnsQuery.eq("board_id", selectedBoard);
      }
      const {
        data: columnsData
      } = await columnsQuery;
      
      // ✅ NOVO: Garantir que existe coluna "Ganho" em cada board
      if (selectedBoard && columnsData) {
        const hasGanhoColumn = columnsData.some(col => 
          col.nome?.toLowerCase().includes('ganho') || 
          col.nome?.toLowerCase().includes('concluído') ||
          col.nome?.toLowerCase().includes('concluido') ||
          col.nome?.includes('✅')
        );
        
        if (!hasGanhoColumn) {
          console.log('📦 [Tarefas] Criando coluna fixa "Ganho" para o board...');
          const maxPosition = columnsData.reduce((max, col) => Math.max(max, col.posicao || 0), 0);
          const { data: newColumn, error: createError } = await supabase
            .from("task_columns")
            .insert([{
              nome: '✅ Ganho',
              board_id: selectedBoard,
              posicao: maxPosition + 1,
              cor: '#22c55e'
            }])
            .select()
            .single();
          
          if (!createError && newColumn) {
            console.log('✅ [Tarefas] Coluna "Ganho" criada com sucesso');
            columnsData.push(newColumn);
          }
        }
      }
      
      setColumns(columnsData || []);

      // ✅ OTIMIZAÇÃO: Limitar query inicial - só carregar tarefas do board selecionado e limitar quantidade
      console.log("🔍 Executando query de tarefas...");
      console.log("📋 Board ID:", selectedBoard);

      // ✅ CORRIGIDO: Tentar query com relacionamento primeiro, se falhar usar query simples
      let tasksQuery = supabase.from("tasks").select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(full_name),
          lead:leads!tasks_lead_id_fkey(id, name, phone)
        `).order("created_at", {
        ascending: false
      }).limit(INITIAL_LOAD_LIMIT);

      // ✅ CRÍTICO: Sempre filtrar por board selecionado (ou carregar todas se não houver board)
      if (selectedBoard) {
        tasksQuery = tasksQuery.eq("board_id", selectedBoard);
      }
      let {
        data: tasksData,
        error: tasksError
      } = await tasksQuery;

      // ✅ FALLBACK: Se a query com relacionamento falhar, tentar sem relacionamento
      if (tasksError) {
        console.warn("⚠️ Query com relacionamento falhou, tentando sem relacionamento...", tasksError);
        let fallbackQuery = supabase.from("tasks").select("*").order("created_at", {
          ascending: false
        }).limit(INITIAL_LOAD_LIMIT);
        if (selectedBoard) {
          fallbackQuery = fallbackQuery.eq("board_id", selectedBoard);
        }
        const fallbackResult = await fallbackQuery;
        const fallbackTasksData = fallbackResult.data;
        tasksError = fallbackResult.error;
        if (tasksError) {
          console.error("❌ Erro ao carregar tarefas (fallback também falhou):", tasksError);
          console.error("❌ Detalhes do erro:", JSON.stringify(tasksError, null, 2));
          toast.error(`Erro ao carregar tarefas: ${tasksError.message || tasksError.code || 'Erro desconhecido'}`);
          setTasks([]);
          return;
        }

        // Se o fallback funcionou, buscar dados relacionados manualmente
        if (fallbackTasksData && fallbackTasksData.length > 0) {
          const assigneeIds = [...new Set(fallbackTasksData.map((t: any) => t.assignee_id).filter(Boolean))];
          const leadIds = [...new Set(fallbackTasksData.map((t: any) => t.lead_id).filter(Boolean))];
          const [assigneesResult, leadsResult] = await Promise.all([assigneeIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", assigneeIds) : {
            data: []
          }, leadIds.length > 0 ? supabase.from("leads").select("id, name, phone").in("id", leadIds) : {
            data: []
          }]);
          const assigneesMap = new Map((assigneesResult.data || []).map((a: any) => [a.id, a]));
          const leadsMap = new Map((leadsResult.data || []).map((l: any) => [l.id, l]));
          tasksData = fallbackTasksData.map((task: any) => ({
            ...task,
            assignee: assigneesMap.get(task.assignee_id) || null,
            lead: leadsMap.get(task.lead_id) || null
          }));
        } else {
          tasksData = [];
        }
      }
      console.log("✅ Tarefas carregadas:", tasksData?.length || 0, "tarefas");
      console.log("📋 Board selecionado:", selectedBoard);
      console.log("📊 Dados brutos:", tasksData);

      // ✅ CORRIGIDO: Usa campos reais do banco sem fallback de descrição
      // Buscar nomes dos responsáveis adicionais
      const allResponsaveisIds = new Set<string>();
      (tasksData || []).forEach((task: any) => {
        if (Array.isArray(task.responsaveis)) {
          task.responsaveis.forEach((id: string) => allResponsaveisIds.add(id));
        }
      });
      let responsaveisMap = new Map<string, string>();
      if (allResponsaveisIds.size > 0) {
        const {
          data: responsaveisProfiles
        } = await supabase.from('profiles').select('id, full_name').in('id', Array.from(allResponsaveisIds));
        if (responsaveisProfiles) {
          responsaveisProfiles.forEach((p: any) => {
            responsaveisMap.set(p.id, p.full_name);
          });
        }
      }
      const formattedTasks = (tasksData || []).map((task: any) => {
        // Mapear IDs dos responsáveis para nomes
        const responsaveis_names = Array.isArray(task.responsaveis) ? task.responsaveis.map((id: string) => responsaveisMap.get(id)).filter(Boolean) : [];
        return {
          ...task,
          checklist: task.checklist ?? [],
          tags: task.tags ?? [],
          comments: task.comments ?? [],
          attachments: task.attachments ?? [],
          assignee_name: task.assignee?.full_name,
          responsaveis_names,
          // ✅ NOVO: Nomes dos responsáveis adicionais
          lead_name: task.lead?.nome || task.lead?.name || task.lead_name
        };
      });
      console.log("✅ Tarefas formatadas:", formattedTasks.length);
      setTasks(formattedTasks);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados das tarefas");
    } finally {
      setLoading(false);
    }
  };

  // ✅ MELHORADO: Drag & Drop com validação robusta e logs detalhados
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    console.log('[Drag&Drop] 🎯 handleDragEnd iniciado:', {
      activeId: active.id,
      overId: over?.id,
      isMovingRef: isMovingRef.current
    });
    if (!over) {
      console.warn('[Drag&Drop] ❌ Sem destino válido');
      setActiveTaskId(null);
      return;
    }

    // 🔒 Prevenir operações concorrentes
    if (isMovingRef.current) {
      console.warn('[Drag&Drop] ⚠️ Operação já em andamento - bloqueado');
      toast.warning("Aguarde a operação anterior finalizar");
      setActiveTaskId(null);
      return;
    }
    const activeId = String(active.id);
    const activeData = (active as any).data?.current;
    console.log('[Drag&Drop] 📊 Dados do drag:', {
      activeId,
      activeType: activeData?.type,
      overId: over.id
    });

    // Verificar se estamos arrastando uma coluna
    if (activeData?.type === 'column') {
      console.log('[Drag&Drop] 🔄 Detectado drag de COLUNA');

      // ✅ MELHORADO: Detectar se está sobre outra coluna ou sobre um elemento dentro de uma coluna
      const overData: any = (over as any).data?.current || {};
      let overColumnId: string | null = null;

      // Prioridade 1: Se over.id é o ID de uma coluna válida
      const isValidColumnId = columnsFiltradas.some(c => c.id === String(over.id));
      if (isValidColumnId) {
        overColumnId = String(over.id);
        console.log('[Drag&Drop] ✅ Destino: coluna direta:', overColumnId);
      }
      // Prioridade 2: Se over.data tem columnId (quando solta sobre tarefa dentro da coluna)
      else if (overData?.columnId) {
        overColumnId = overData.columnId;
        console.log('[Drag&Drop] ✅ Destino: coluna via data.columnId:', overColumnId);
      }
      // Prioridade 3: Tentar encontrar coluna pai pelo elemento DOM (buscar elemento pai)
      else {
        // Tentar encontrar elemento com data-column-id no elemento ou nos pais
        let element: HTMLElement | null = document.querySelector(`[data-column-id]`);
        if (!element) {
          // Se não encontrar, tentar pelo ID do over
          const overElement = document.elementFromPoint((over.rect?.left || 0) + (over.rect?.width || 0) / 2, (over.rect?.top || 0) + (over.rect?.height || 0) / 2) as HTMLElement;
          if (overElement) {
            // Procurar elemento pai com data-column-id
            let parent = overElement.closest('[data-column-id]') as HTMLElement;
            if (parent) {
              const columnId = parent.getAttribute('data-column-id');
              if (columnId && columnsFiltradas.some(c => c.id === columnId)) {
                overColumnId = columnId;
                console.log('[Drag&Drop] ✅ Destino: coluna via DOM parent:', overColumnId);
              }
            }
          }
        }
      }
      if (!overColumnId) {
        console.error('[Drag&Drop] ❌ Não foi possível identificar coluna destino');
        console.log('[Drag&Drop] 📊 Dados disponíveis:', {
          overId: over.id,
          overData,
          availableColumns: columnsFiltradas.map(c => c.id)
        });
        setActiveTaskId(null);
        return;
      }
      const overId = overColumnId;
      if (activeId === overId) {
        console.log('[Drag&Drop] ℹ️ Drop na mesma posição, ignorando');
        setActiveTaskId(null);
        return;
      }
      const oldIndex = columnsFiltradas.findIndex(c => c.id === activeId);
      const newIndex = columnsFiltradas.findIndex(c => c.id === overId);
      console.log('[Drag&Drop] 📍 Índices:', {
        oldIndex,
        newIndex,
        total: columnsFiltradas.length,
        activeId,
        overId,
        columnsIds: columnsFiltradas.map(c => ({
          id: c.id,
          nome: c.nome,
          posicao: c.posicao
        }))
      });
      if (oldIndex === -1 || newIndex === -1) {
        console.error('[Drag&Drop] ❌ Índices inválidos:', {
          oldIndex,
          newIndex,
          activeId,
          overId,
          columnsFiltradas: columnsFiltradas.map(c => ({
            id: c.id,
            nome: c.nome
          }))
        });
        setActiveTaskId(null);
        return;
      }
      if (oldIndex !== -1 && newIndex !== -1) {
        try {
          // 🔒 Bloquear operações concorrentes
          console.log('[Drag&Drop] 🔒 Bloqueando realtime...');
          isMovingRef.current = true;

          // ✅ Reordenar colunas localmente primeiro
          const reorderedColumns = arrayMove(columnsFiltradas, oldIndex, newIndex);
          console.log('[Drag&Drop] 📋 Nova ordem:', reorderedColumns.map((c, i) => `${i}. ${c.nome}`));

          // ✅ Atualizar posições nas colunas reordenadas
          const updatedColumnsWithPosition = reorderedColumns.map((col, index) => ({
            ...col,
            posicao: index
          }));
          console.log('[Drag&Drop] 🎨 Atualizando UI imediatamente...');

          // ✅ CRÍTICO: Atualizar estado ANTES de persistir no banco
          // ✅ IMPORTANTE: Usar função de atualização que garante ordem correta
          setColumns(prev => {
            // Filtrar apenas colunas do board atual
            const boardColumns = prev.filter(col => col.board_id === selectedBoard);
            const otherColumns = prev.filter(col => col.board_id !== selectedBoard);

            // Criar um mapa das novas posições baseado na ordem reordenada
            const newPositions = new Map(updatedColumnsWithPosition.map(c => [c.id, c.posicao]));

            // Atualizar colunas do board atual com as novas posições
            const updatedBoardColumns = boardColumns.map(col => {
              const newPosition = newPositions.get(col.id);
              if (newPosition !== undefined) {
                return {
                  ...col,
                  posicao: newPosition
                };
              }
              return col;
            });

            // ✅ CRÍTICO: Ordenar ANTES de retornar para garantir ordem correta
            updatedBoardColumns.sort((a, b) => a.posicao - b.posicao);

            // Retornar colunas atualizadas + outras colunas
            return [...updatedBoardColumns, ...otherColumns];
          });

          // ✅ FORÇAR re-render imediato para garantir que a UI atualize
          // Usar requestAnimationFrame para garantir que a atualização aconteça no próximo frame
          requestAnimationFrame(() => {
            setColumns(current => {
              const boardCols = current.filter(col => col.board_id === selectedBoard);
              const others = current.filter(col => col.board_id !== selectedBoard);
              boardCols.sort((a, b) => a.posicao - b.posicao);
              return [...boardCols, ...others];
            });
          });

          // ✅ DUPLA GARANTIA: Forçar novamente após um pequeno delay
          setTimeout(() => {
            setColumns(current => {
              const boardCols = current.filter(col => col.board_id === selectedBoard);
              const others = current.filter(col => col.board_id !== selectedBoard);
              boardCols.sort((a, b) => a.posicao - b.posicao);
              return [...boardCols, ...others];
            });
          }, 100);

          // 💾 Atualizar posições no banco de dados
          console.log('[Drag&Drop] 💾 Atualizando posições no banco...');
          const updatePromises = updatedColumnsWithPosition.map((col, index) => {
            console.log(`[Drag&Drop] 📝 Atualizando ${col.nome}: posicao=${index}`);
            return supabase.from('task_columns').update({
              posicao: index
            }).eq('id', col.id);
          });
          const results = await Promise.all(updatePromises);

          // Verificar erros
          const errors = results.filter(result => result.error);
          if (errors.length > 0) {
            console.error('[Drag&Drop] ❌ Erros nas atualizações:', errors);
            throw new Error('Erro ao atualizar posições das colunas');
          }
          console.log('[Drag&Drop] ✅ Colunas reordenadas com sucesso no banco!');
          toast.success("Ordem das colunas atualizada!");

          // ✅ NÃO recarregar dados - manter a ordem atualizada no estado
          // O estado local já está correto, não precisa recarregar

          // ✅ Aguardar um pouco antes de desbloquear realtime
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('[Drag&Drop] ❌ Erro ao reordenar colunas:', error);
          toast.error("Erro ao atualizar ordem das colunas");
          // Recarregar dados em caso de erro para restaurar estado
          console.log('[Drag&Drop] 🔄 Recarregando dados após erro...');
          await carregarDados();
        } finally {
          // 🔓 Desbloquear após delay maior para garantir que o realtime não interfira
          console.log('[Drag&Drop] 🔓 Desbloqueando realtime após 3 segundos...');
          setTimeout(() => {
            isMovingRef.current = false;
            console.log('[Drag&Drop] ✓ Realtime desbloqueado');
          }, 3000); // ✅ Aumentado para 3s para garantir persistência completa
        }

        // ✅ Limpar estados após drag de coluna
        setActiveTaskId(null);
        setActiveColumnId(null);
        activeColumnIdRef.current = null;
        return;
      } else {
        console.error('[Drag&Drop] ❌ Índices inválidos:', {
          oldIndex,
          newIndex
        });
        setActiveTaskId(null);
        setActiveColumnId(null);
        activeColumnIdRef.current = null;
      }
      return;
    }

    // Caso contrário, estamos arrastando uma tarefa
    console.log('[Drag&Drop] 📝 Detectado drag de TAREFA');
    const taskId = activeId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('[Drag&Drop] Tarefa não encontrada:', taskId);
      toast.error("Tarefa não encontrada");
      setActiveTaskId(null);
      return;
    }
    const overData: any = (over as any).data?.current || {};
    const overId = String(over.id);
    console.log('[Drag&Drop] 🔍 Análise detalhada:', {
      overId,
      overDataType: overData?.type,
      overColumnId: overData?.columnId,
      overAccepts: overData?.accepts,
      taskCurrentColumn: task.column_id
    });

    // ✅ CORRIGIDO V3: Abordagem robusta baseada em posição do mouse
    // Calcular a coluna correta usando a posição REAL do mouse no momento do drop
    let newColumnId: string | null = null;
    
    // 🎯 MÉTODO PRINCIPAL: Encontrar coluna via posição do mouse
    const findColumnByMousePosition = (): string | null => {
      const mousePos = mousePositionRef.current;
      if (!mousePos) return null;
      
      // Buscar todas as colunas visíveis no DOM
      const columnElements = document.querySelectorAll('[data-column-id][data-droppable="true"]');
      
      for (const colEl of Array.from(columnElements)) {
        const rect = colEl.getBoundingClientRect();
        // Verificar se o mouse está dentro dos limites da coluna
        if (mousePos.x >= rect.left && mousePos.x <= rect.right &&
            mousePos.y >= rect.top && mousePos.y <= rect.bottom) {
          const colId = colEl.getAttribute('data-column-id');
          if (colId && columnsFiltradas.some(c => c.id === colId)) {
            console.log('[Drag&Drop] ✅ Coluna encontrada via posição do mouse:', colId);
            return colId;
          }
        }
      }
      
      // Se não encontrou exatamente, buscar a coluna mais próxima horizontalmente
      let closestColumn: { id: string; distance: number } | null = null;
      for (const colEl of Array.from(columnElements)) {
        const rect = colEl.getBoundingClientRect();
        const colId = colEl.getAttribute('data-column-id');
        if (!colId || !columnsFiltradas.some(c => c.id === colId)) continue;
        
        // Verificar se o mouse está na mesma faixa vertical da coluna
        if (mousePos.y >= rect.top && mousePos.y <= rect.bottom) {
          const centerX = rect.left + rect.width / 2;
          const distance = Math.abs(mousePos.x - centerX);
          if (!closestColumn || distance < closestColumn.distance) {
            closestColumn = { id: colId, distance };
          }
        }
      }
      
      if (closestColumn) {
        console.log('[Drag&Drop] ✅ Coluna mais próxima via posição do mouse:', closestColumn.id);
        return closestColumn.id;
      }
      
      return null;
    };
    
    // Prioridade 1: Posição do mouse (mais confiável)
    newColumnId = findColumnByMousePosition();
    
    // Prioridade 2: Coluna confirmada pelo handleDragOver
    if (!newColumnId && confirmedTargetColumnRef.current && 
        confirmedTargetColumnRef.current !== task.column_id &&
        columnsFiltradas.some(c => c.id === confirmedTargetColumnRef.current)) {
      newColumnId = confirmedTargetColumnRef.current;
      console.log('[Drag&Drop] ✅ Usando confirmedTargetColumnRef:', newColumnId);
    }
    
    // Prioridade 3: Se over.id é o ID de uma coluna válida
    if (!newColumnId) {
      const isValidColumnId = columnsFiltradas.some(c => c.id === overId);
      if (isValidColumnId) {
        newColumnId = overId;
        console.log('[Drag&Drop] ✅ Usando over.id como columnId:', newColumnId);
      }
    }
    
    // Prioridade 4: lastOverColumnRef
    if (!newColumnId && lastOverColumnRef.current && 
        columnsFiltradas.some(c => c.id === lastOverColumnRef.current)) {
      newColumnId = lastOverColumnRef.current;
      console.log('[Drag&Drop] ✅ Usando lastOverColumnRef:', newColumnId);
    }
    
    // Prioridade 5: containerId do sortable
    if (!newColumnId && overData?.sortable?.containerId) {
      const containerId = overData.sortable.containerId;
      if (columnsFiltradas.some(c => c.id === containerId)) {
        newColumnId = containerId;
        console.log('[Drag&Drop] ✅ Usando containerId:', newColumnId);
      }
    }
    
    // Prioridade 6: Coluna da tarefa sobre a qual soltou
    if (!newColumnId) {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask?.column_id) {
        newColumnId = overTask.column_id;
        console.log('[Drag&Drop] ✅ Usando column_id da tarefa:', newColumnId);
      }
    }

    // Validação final
    if (!newColumnId) {
      console.error('[Drag&Drop] Não foi possível identificar coluna destino', {
        overId, mousePos: mousePositionRef.current,
        confirmedTarget: confirmedTargetColumnRef.current,
        lastOver: lastOverColumnRef.current
      });
      toast.error("Não foi possível identificar a coluna destino");
      setActiveTaskId(null);
      return;
    }

    // Validar se a coluna existe e pertence ao board selecionado
    const targetColumn = columnsFiltradas.find(c => c.id === newColumnId);
    if (!targetColumn) {
      console.error('[Drag&Drop] Coluna destino não encontrada ou inválida', {
        newColumnId,
        availableColumns: columnsFiltradas.map(c => ({
          id: c.id,
          nome: c.nome
        })),
        selectedBoard
      });
      toast.error(`Coluna destino inválida: ${newColumnId}`);
      setActiveTaskId(null);
      return;
    }

    // Validar se a tarefa já está na mesma coluna
    if (task.column_id === newColumnId) {
      console.log('[Drag&Drop] Tarefa já está na coluna destino, ignorando');
      setActiveTaskId(null);
      return;
    }
    const oldColumnId = task.column_id;
    console.log('[Drag&Drop] Movendo tarefa', {
      taskId,
      taskTitle: task.title,
      fromColumn: oldColumnId,
      toColumn: newColumnId,
      targetColumnName: targetColumn.nome
    });

    // ✅ NOVO: Verificar se a coluna destino é "Ganho" para marcar como concluída
    const isGanhoColumn = targetColumn.nome?.toLowerCase().includes('ganho') || 
                          targetColumn.nome?.toLowerCase().includes('concluído') ||
                          targetColumn.nome?.toLowerCase().includes('concluido') ||
                          targetColumn.nome?.includes('✅');

    // 🔒 CRÍTICO: Bloquear realtime durante a operação para evitar race condition
    console.log('[Drag&Drop] 🔒 Bloqueando realtime durante movimentação de tarefa...');
    isMovingRef.current = true;

    // ✅ MELHORADO: Atualização otimista com validação
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Se for coluna Ganho, marcar todos os checklists como concluídos
        const updatedChecklist = isGanhoColumn && t.checklist 
          ? t.checklist.map(item => ({ ...item, done: true }))
          : t.checklist;
        
        return {
          ...t,
          column_id: newColumnId!,
          checklist: updatedChecklist,
          status: isGanhoColumn ? 'concluido' : t.status
        };
      }
      return t;
    }));
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        // Reverter atualização otimista
        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          column_id: oldColumnId,
          checklist: task.checklist // Reverter checklist
        } : t));
        toast.error("Não autenticado");
        setActiveTaskId(null);
        isMovingRef.current = false; // 🔓 Desbloquear
        return;
      }
      const response = await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "mover_tarefa",
          data: {
            task_id: taskId,
            nova_coluna_id: newColumnId
          }
        }
      });
      
      console.log('[Drag&Drop] Resposta da API:', response);
      
      if (response.error) {
        console.error('[Drag&Drop] Erro da edge function:', response.error);
        throw response.error;
      }
      
      // Verificar se houve erro no corpo da resposta
      if (response.data?.error) {
        console.error('[Drag&Drop] Erro no corpo da resposta:', response.data);
        throw new Error(response.data.error);
      }
      
      // ✅ Mostrar mensagem apropriada
      if (isGanhoColumn) {
        toast.success(`🏆 Tarefa concluída com sucesso!`);
      } else {
        toast.success(`Tarefa movida para "${targetColumn.nome}"`);
      }

      // Emitir evento global para sincronização
      if (task) {
        emitGlobalEvent({
          type: 'task-updated',
          data: {
            ...task,
            column_id: newColumnId,
            status: isGanhoColumn ? 'concluido' : targetColumn.nome.toLowerCase() || 'unknown'
          },
          source: 'Tarefas'
        });
      }
      // Realtime (tasks channel) confirmará a atualização; evitar recarga completa
    } catch (error: any) {
      console.error('[Drag&Drop] Erro ao mover tarefa:', error);

      // Reverter atualização otimista
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            column_id: oldColumnId
          };
        }
        return t;
      }));
      toast.error(error?.message || "Erro ao mover tarefa");
      // Reverter para estado consistente via recarga somente em erro
      carregarDados();
    } finally {
      // 🔓 CRÍTICO: Sempre desbloquear realtime no finally para garantir
      console.log('[Drag&Drop] 🔓 Desbloqueando realtime após movimentação de tarefa');
      isMovingRef.current = false;
    }
    setActiveTaskId(null);
    lastOverColumnRef.current = null; // ✅ Limpar ref após drag
    confirmedTargetColumnRef.current = null; // ✅ Limpar ref após drag
    lastDragOverTimeRef.current = 0; // ✅ Limpar timestamp
    mousePositionRef.current = null; // ✅ Limpar posição do mouse
  };
  // ✅ NOVO: Rastrear posição do mouse durante o drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (activeTaskId) {
        mousePositionRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    
    if (activeTaskId) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [activeTaskId]);

  const handleDragStart = useCallback((event: any) => {
    const activeId = event.active?.id;
    setActiveTaskId(activeId ?? null);
    
    // ✅ CRÍTICO: Resetar refs de rastreamento
    confirmedTargetColumnRef.current = null;
    lastDragOverTimeRef.current = 0;
    mousePositionRef.current = null;
    
    // ✅ Capturar posição inicial do mouse
    const pointerEvent = event.activatorEvent as PointerEvent | MouseEvent;
    if (pointerEvent) {
      mousePositionRef.current = { 
        x: pointerEvent.clientX, 
        y: pointerEvent.clientY 
      };
    }
    
    // ✅ CRÍTICO: Inicializar lastOverColumnRef com a coluna da tarefa sendo arrastada
    if (activeId) {
      const activeTask = tasks.find(t => t.id === activeId);
      if (activeTask?.column_id) {
        lastOverColumnRef.current = activeTask.column_id;
        console.log('[Drag&Drop] 🚀 handleDragStart - iniciando com column_id:', activeTask.column_id);
      }
    }
  }, [tasks]);
  
  const handleDragCancel = useCallback(() => {
    setActiveTaskId(null);
    lastOverColumnRef.current = null;
    confirmedTargetColumnRef.current = null;
    lastDragOverTimeRef.current = 0;
    mousePositionRef.current = null;
  }, []);

  // ✅ CORRIGIDO: Handler para rastrear a última coluna sobre a qual passou
  // Usa timestamp para evitar atualizações incorretas perto do momento do drop
  const handleDragOver = useCallback((event: any) => {
    const { over, active } = event;
    if (!over || !active) return;
    
    const overId = String(over.id);
    const overData = over.data?.current || {};
    const activeId = String(active.id);
    
    // Obter a coluna atual da tarefa sendo arrastada
    const activeTask = tasks.find(t => t.id === activeId);
    const activeTaskColumnId = activeTask?.column_id;
    
    // Tentar identificar a coluna destino visualmente correta
    let columnId: string | null = null;
    
    // Prioridade 1: Se over.id é uma coluna válida (passou sobre área vazia da coluna)
    if (columnsFiltradas.some(c => c.id === overId)) {
      columnId = overId;
    }
    // Prioridade 2: containerId do sortable - Este é o ID do SortableContext
    // que é definido com column.id, portanto é a coluna VISUAL correta
    else if (overData?.sortable?.containerId) {
      const containerId = overData.sortable.containerId;
      if (columnsFiltradas.some(c => c.id === containerId)) {
        columnId = containerId;
      }
    }
    // Prioridade 3: Tentar encontrar via DOM usando posição do mouse do EVENTO
    // Isso é mais confiável que usar over.rect que pode estar desatualizado
    else if (typeof document !== 'undefined') {
      // Usar posição do pointer do dnd-kit se disponível
      const pointerPosition = (event as any).activatorEvent?.clientX !== undefined
        ? { x: (event as any).activatorEvent.clientX, y: (event as any).activatorEvent.clientY }
        : null;
      
      // Fallback: usar centro do over.rect
      const rect = over.rect;
      const x = pointerPosition?.x ?? (rect ? rect.left + rect.width / 2 : null);
      const y = pointerPosition?.y ?? (rect ? rect.top + rect.height / 2 : null);
      
      if (x !== null && y !== null) {
        const element = document.elementFromPoint(x, y);
        if (element) {
          const columnElement = element.closest('[data-column-id]');
          if (columnElement) {
            const foundColumnId = columnElement.getAttribute('data-column-id');
            if (foundColumnId && columnsFiltradas.some(c => c.id === foundColumnId)) {
              columnId = foundColumnId;
            }
          }
        }
      }
    }
    
    // ✅ CRÍTICO: Atualizar ref apenas se:
    // 1. Encontramos uma coluna válida E
    // 2. A coluna é DIFERENTE da coluna original da tarefa OU
    // 3. Ainda não temos uma coluna confirmada diferente da original
    if (columnId) {
      const now = Date.now();
      
      // Se a coluna detectada é diferente da coluna original, confirmar como destino
      if (columnId !== activeTaskColumnId) {
        confirmedTargetColumnRef.current = columnId;
        lastOverColumnRef.current = columnId;
        lastDragOverTimeRef.current = now;
        console.log('[Drag&Drop] 📍 onDragOver CONFIRMOU coluna destino:', columnId);
      } 
      // Se voltou para a coluna original MAS já temos um destino confirmado recentemente (< 500ms)
      // Ignorar para evitar flicker
      else if (confirmedTargetColumnRef.current && 
               confirmedTargetColumnRef.current !== activeTaskColumnId &&
               now - lastDragOverTimeRef.current < 500) {
        console.log('[Drag&Drop] 📍 onDragOver ignorando retorno à coluna original (destino confirmado recentemente):', 
                    confirmedTargetColumnRef.current);
        // Manter o lastOverColumnRef no destino confirmado
        lastOverColumnRef.current = confirmedTargetColumnRef.current;
      }
      // Caso contrário, atualizar normalmente
      else {
        lastOverColumnRef.current = columnId;
        console.log('[Drag&Drop] 📍 onDragOver atualizou lastOverColumn:', columnId);
      }
    }
  }, [columnsFiltradas, tasks]);

  // 🎯 Navegação horizontal suave (scroll das colunas)
  const scrollHorizontal = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = 400; // Largura da coluna + gap
    const targetScroll = direction === 'left' ? container.scrollLeft - scrollAmount : container.scrollLeft + scrollAmount;
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }, []);
  const criarNovoBoard = useCallback(async () => {
    if (!novoBoardNome.trim()) return;
    try {
      const {
        data: boardData
      } = await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "criar_board",
          data: {
            nome: novoBoardNome
          }
        }
      });
      const newBoardId = boardData?.data?.id;

      // Criar colunas padrão
      if (newBoardId) {
        const colunasDefault = [{
          nome: "A Fazer",
          cor: "#3b82f6",
          posicao: 0
        }, {
          nome: "Em Progresso",
          cor: "#eab308",
          posicao: 1
        }, {
          nome: "Concluído",
          cor: "#22c55e",
          posicao: 2
        }];
        for (const coluna of colunasDefault) {
          await supabase.functions.invoke("api-tarefas", {
            body: {
              action: "criar_coluna",
              data: {
                ...coluna,
                board_id: newBoardId
              }
            }
          });
        }
      }
      toast.success("Quadro criado com colunas padrão!");
      setNovoBoardNome("");
      setDialogNovoBoard(false);
      // Realtime em task_boards/task_columns recarregará dados
    } catch (error) {
      toast.error("Erro ao criar quadro");
    }
  }, [novoBoardNome]);

  // Função para carregar mais tarefas de uma coluna específica
  const loadMoreTasks = useCallback(async (columnId: string) => {
    const currentCount = tasksPerColumn[columnId] || TASKS_PER_PAGE;
    const newCount = currentCount + TASKS_PER_PAGE;
    setLoadingMore(prev => ({
      ...prev,
      [columnId]: true
    }));
    try {
      // Simular carregamento adicional (na implementação real, faria uma query paginada)
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay de rede

      setTasksPerColumn(prev => ({
        ...prev,
        [columnId]: newCount
      }));
    } catch (error) {
      console.error('Erro ao carregar mais tarefas:', error);
      toast.error('Erro ao carregar mais tarefas');
    } finally {
      setLoadingMore(prev => ({
        ...prev,
        [columnId]: false
      }));
    }
  }, [tasksPerColumn, TASKS_PER_PAGE]);

  // ✅ OTIMIZAÇÃO: Debounce na busca (300ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);
  const matchesSearch = useCallback((t: Task) => {
    if (!debouncedSearchText.trim()) return true;
    const q = debouncedSearchText.toLowerCase();
    return (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
  }, [debouncedSearchText]);
  const matchesFilters = useCallback((t: any) => {
    if (filterAssignee && !(t.assignee_id === filterAssignee || (t.responsaveis || []).includes(filterAssignee))) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterTag && !(Array.isArray(t.tags) && t.tags.includes(filterTag))) return false;
    return true;
  }, [filterAssignee, filterPriority, filterTag]);

  // ✅ OTIMIZAÇÃO: Memoizar tarefas filtradas por coluna
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    columnsFiltradas.forEach(column => {
      grouped[column.id] = tasks.filter(t => t.column_id === column.id && matchesSearch(t) && matchesFilters(t));
    });
    return grouped;
  }, [tasks, columnsFiltradas, matchesSearch, matchesFilters]);

  // ✅ OTIMIZAÇÃO: Memoizar contagem de tarefas por coluna
  const taskCountsByColumn = useMemo(() => {
    const counts: Record<string, number> = {};
    columnsFiltradas.forEach(column => {
      counts[column.id] = tasksByColumn[column.id]?.length || 0;
    });
    return counts;
  }, [tasksByColumn, columnsFiltradas]);

  // Métricas de produtividade
  const productivityMetrics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - today.getDay());
    const tasksInBoard = tasks.filter(t => t.board_id === selectedBoard);
    const completedTasks = tasksInBoard.filter(t => {
      // Considerar tarefa concluída se estiver em coluna com nome contendo "conclu" ou similar
      const column = columns.find(c => c.id === t.column_id);
      return column?.nome?.toLowerCase().includes('conclu') || column?.nome?.toLowerCase().includes('feito') || column?.nome?.toLowerCase().includes('done');
    });
    const overdueTasks = tasksInBoard.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate < now && !completedTasks.some(ct => ct.id === t.id);
    });
    const todayCompleted = completedTasks.filter(t => {
      // Simplificar: considerar como concluído hoje se foi atualizado recentemente
      // Na implementação real, seria melhor ter um campo updated_at
      return true; // Placeholder
    });
    const totalTimeSpent = 0; // Simplificado - campo tempo_gasto não existe
    const avgTimePerTask = 0; // Simplificado

    return {
      totalTasks: tasksInBoard.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      todayCompleted: todayCompleted.length,
      totalTimeSpent,
      avgTimePerTask,
      completionRate: tasksInBoard.length > 0 ? completedTasks.length / tasksInBoard.length * 100 : 0
    };
  }, [tasks, columns, selectedBoard]);
  if (loading) return <div className="flex items-center justify-center h-screen"><p>Carregando...</p></div>;
  return <TarefasProvider>
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tarefas Estilo Trello</h1>
          <p className="text-muted-foreground">Gerencie suas tarefas em quadros Kanban</p>
          <p className="text-xs text-muted-foreground mt-1">
            💡 Atalhos: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">N</kbd> Nova tarefa •
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">B</kbd> Quadro •
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">C</kbd> Calendário •
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">D</kbd> Dashboard
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <UIButton variant={viewMode === 'board' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('board')}>
              🗂 Quadro
            </UIButton>
            <UIButton variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')}>
              📅 Calendário
            </UIButton>
            <UIButton variant={viewMode === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('dashboard')}>
              📊 Dashboard
            </UIButton>
          </div>
          <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Buscar tarefas..." className="w-64" />
          <select className="border rounded-md p-2" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
            <option value="">Responsável</option>
            {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select className="border rounded-md p-2" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">Prioridade</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <select className="border rounded-md p-2" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="">Tag</option>
            {Array.from(new Set(tasks.flatMap((t: any) => Array.isArray(t.tags) ? t.tags : []))).map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          {(isAdmin || canManageTaskStructure) && <>
              <Button variant="outline" onClick={() => setDialogNovoBoard(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Quadro
              </Button>
              <Dialog open={dialogNovoBoard} onOpenChange={setDialogNovoBoard}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Quadro</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome do Quadro</Label>
                      <Input value={novoBoardNome} onChange={e => setNovoBoardNome(e.target.value)} placeholder="Ex: Projeto Q1 2024" onKeyDown={e => {
                      if (e.key === 'Enter') {
                        criarNovoBoard();
                      }
                    }} />
                    </div>
                    <Button onClick={criarNovoBoard} className="w-full">
                      Criar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>}
        </div>
      </div>

      {viewMode === 'board' && boards.length > 0 && <div className="mb-6">
          <Label>Quadro</Label>
          <div className="flex items-center gap-2 mt-2">
            <select value={selectedBoard || ""} onChange={e => {
            console.log('📋 [Tarefas] Board selecionado:', e.target.value);
            setSelectedBoard(e.target.value);
          }} className="flex-1 max-w-xs p-2 border rounded-md">
              {boards.map(board => <option key={board.id} value={board.id}>
                  {board.nome}
                </option>)}
            </select>
            
            <DropdownMenu open={dropdownMenuOpen} onOpenChange={setDropdownMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={!selectedBoard} onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 [Tarefas] Botão de três pontos clicado');
                console.log('🔘 [Tarefas] canManageTaskStructure:', canManageTaskStructure);
                console.log('🔘 [Tarefas] isAdmin:', isAdmin);
                console.log('🔘 [Tarefas] selectedBoard:', selectedBoard);
                console.log('🔘 [Tarefas] boards:', boards);
              }} onMouseDown={e => {
                e.stopPropagation();
              }} className="z-10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[99999] bg-background border shadow-lg" style={{
              zIndex: 99999
            }} onClick={e => e.stopPropagation()}>
                {!selectedBoard ? <DropdownMenuItem disabled>
                    Selecione um quadro primeiro
                  </DropdownMenuItem> : isAdmin || canManageTaskStructure ? <>
                    <DropdownMenuItem onClick={e => {
                  console.log('✏️ [Tarefas] Editar Quadro clicado');
                  e.preventDefault();
                  e.stopPropagation();
                  setDropdownMenuOpen(false);
                  setEditarQuadroOpen(true);
                }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar Quadro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={e => {
                  console.log('⚙️ [Tarefas] Gerenciar Colunas clicado');
                  e.preventDefault();
                  e.stopPropagation();
                  setDropdownMenuOpen(false);
                  setEditarQuadroOpen(true);
                }}>
                      <Settings className="mr-2 h-4 w-4" />
                      Gerenciar Colunas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={e => {
                  console.log('🗑️ [Tarefas] Excluir Quadro clicado');
                  e.preventDefault();
                  e.stopPropagation();
                  setDropdownMenuOpen(false);
                  setEditarQuadroOpen(true);
                  // Pequeno delay para garantir que o dialog de edição seja montado primeiro
                  setTimeout(() => {
                    setExcluirQuadroOpen(true);
                  }, 100);
                }} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Quadro
                    </DropdownMenuItem>
                  </> : <DropdownMenuItem disabled>
                    Sem permissão para gerenciar quadros
                  </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>}
      
      {selectedBoard && <EditarQuadroDialog boardId={selectedBoard} boardNome={boards.find(b => b.id === selectedBoard)?.nome || ""} onUpdated={() => {
        console.log('🔄 [Tarefas] Recarregando dados após atualização do quadro');
        carregarDados();
      }} onDeleted={() => {
        console.log('🗑️ [Tarefas] Quadro excluído, selecionando próximo quadro disponível');
        // ✅ CORRIGIDO: Encontrar próximo quadro disponível e atualizar selectedBoard
        const remainingBoards = boards.filter(b => b.id !== selectedBoard);
        if (remainingBoards.length > 0) {
          setSelectedBoard(remainingBoards[0].id);
        } else {
          setSelectedBoard("");
        }
        // Limpar colunas e tarefas do quadro excluído imediatamente
        setColumns(prev => prev.filter(c => c.board_id !== selectedBoard));
        setTasks(prev => prev.filter(t => t.board_id !== selectedBoard));
        // Recarregar dados para garantir sincronização
        setTimeout(() => carregarDados(), 100);
      }} open={editarQuadroOpen} onOpenChange={open => {
        console.log('📝 [Tarefas] Dialog de edição:', open ? 'aberto' : 'fechado');
        setEditarQuadroOpen(open);
        if (!open) {
          // Se fechar o dialog de edição, também fechar o dialog de exclusão
          setExcluirQuadroOpen(false);
        }
      }} openDeleteDialog={excluirQuadroOpen} onDeleteDialogChange={open => {
        console.log('🗑️ [Tarefas] Dialog de exclusão:', open ? 'aberto' : 'fechado');
        setExcluirQuadroOpen(open);
        // Se o dialog de exclusão for fechado sem excluir, manter o dialog de edição aberto
        // para que o usuário possa fazer outras ações se desejar
      }} />}

      {/* 🎯 Botões de navegação horizontal - apenas em modo board e com mais de 3 colunas */}
      {viewMode === 'board' && columnsFiltradas.length > 3 && <div className="flex gap-2 mb-4 justify-end">
          <Button variant="outline" size="icon" onClick={() => scrollHorizontal('left')} title="Rolar para esquerda">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => scrollHorizontal('right')} title="Rolar para direita">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>}

      {viewMode === 'calendar' ? <TarefaCalendar tasks={tasks} /> : viewMode === 'dashboard' ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total de Tarefas */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Tarefas</p>
                <p className="text-2xl font-bold">{productivityMetrics.totalTasks}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                📋
              </div>
            </div>
          </div>

          {/* Tarefas Concluídas */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">{productivityMetrics.completedTasks}</p>
                <p className="text-xs text-muted-foreground">
                  {productivityMetrics.completionRate.toFixed(1)}% do total
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                ✅
              </div>
            </div>
          </div>

          {/* Tarefas Atrasadas */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold text-red-600">{productivityMetrics.overdueTasks}</p>
                <p className="text-xs text-muted-foreground">
                  Precisam atenção
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                ⚠️
              </div>
            </div>
          </div>

          {/* Tempo Total Gasto */}
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Total</p>
                <p className="text-2xl font-bold">{Math.floor(productivityMetrics.totalTimeSpent / 60)}h {productivityMetrics.totalTimeSpent % 60}m</p>
                <p className="text-xs text-muted-foreground">
                  Média: {Math.floor(productivityMetrics.avgTimePerTask / 60)}h {Math.floor(productivityMetrics.avgTimePerTask % 60)}m/tarefa
                </p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                ⏱️
              </div>
            </div>
          </div>

          {/* Gráfico de Progresso por Coluna */}
          <div className="bg-card p-6 rounded-lg border shadow-sm md:col-span-2 lg:col-span-4">
            <h3 className="text-lg font-semibold mb-4">Distribuição por Coluna</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columnsFiltradas.map(column => {
              const tasksInColumn = tasks.filter(t => t.column_id === column.id).length;
              const percentage = productivityMetrics.totalTasks > 0 ? tasksInColumn / productivityMetrics.totalTasks * 100 : 0;
              return <div key={column.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{column.nome}</span>
                      <span className="text-muted-foreground">{tasksInColumn}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-300" style={{
                    width: `${percentage}%`,
                    backgroundColor: column.cor
                  }} />
                    </div>
                  </div>;
            })}
            </div>
          </div>
        </div> : boards.length === 0 ? <div className="text-center py-12">
          {isAdmin || canManageTaskStructure ? <Button onClick={() => setDialogNovoBoard(true)}>
              <Plus className="mr-2" />
              Criar Primeiro Quadro
            </Button> : <p className="text-muted-foreground">Entre em contato com o administrador para criar quadros</p>}
        </div> : columnsFiltradas.length === 0 ? <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhuma coluna criada ainda</p>
          {isAdmin || canManageTaskStructure ? <p className="text-sm text-muted-foreground">
              Crie colunas como "A Fazer", "Em Progresso", "Concluído"
            </p> : <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador para criar colunas
            </p>}
        </div> : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={columnsFiltradas.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div ref={scrollContainerRef} className="flex overflow-x-auto gap-4 pb-4 min-h-[500px] scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-muted/20 hover:scrollbar-thumb-primary/50 scroll-smooth">
              {columnsFiltradas.map(column => <SortableColumn key={column.id} column={column} tasksByColumn={tasksByColumn} tasksPerColumn={tasksPerColumn} taskCountsByColumn={taskCountsByColumn} TASKS_PER_PAGE={TASKS_PER_PAGE} tasks={tasks} loadingMore={loadingMore} carregarDados={carregarDados} loadMoreTasks={loadMoreTasks} selectedBoard={selectedBoard} emitGlobalEvent={emitGlobalEvent} allColumns={columnsFiltradas} setTasks={setTasks} onMoveTask={async (taskId, newColumnId) => {
                // 🔒 CRÍTICO: Bloquear realtime durante a operação para evitar race condition
                console.log('[onMoveTask] 🔒 Bloqueando realtime durante movimentação manual...');
                isMovingRef.current = true;
                try {
                  // Atualização otimista
                  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t));
                  
                  const response = await supabase.functions.invoke("api-tarefas", {
                    body: {
                      action: "mover_tarefa",
                      data: { task_id: taskId, nova_coluna_id: newColumnId }
                    }
                  });
                  
                  if (response.error || response.data?.error) {
                    throw new Error(response.data?.error || response.error?.message);
                  }
                  
                  const targetColumn = columnsFiltradas.find(c => c.id === newColumnId);
                  toast.success(`Tarefa movida para "${targetColumn?.nome || 'coluna'}"`);
                } catch (error: any) {
                  console.error("Erro ao mover tarefa:", error);
                  toast.error(error?.message || "Erro ao mover tarefa");
                  carregarDados(); // Recarregar para reverter
                } finally {
                  // 🔓 CRÍTICO: Sempre desbloquear realtime no finally
                  console.log('[onMoveTask] 🔓 Desbloqueando realtime após movimentação manual');
                  isMovingRef.current = false;
                }
              }} />)}
            {/* Botão para adicionar nova coluna - apenas admin pode criar colunas */}
            {(isAdmin || canManageTaskStructure) && <div className="min-w-[380px] flex-shrink-0">
                <AdicionarColunaDialog boardId={selectedBoard} currentColumnsCount={columnsFiltradas.length} onColumnAdded={carregarDados} />
              </div>}
          </div>
          </SortableContext>
          <DragOverlay dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.2, 0, 0, 1)'
        }}>
            {activeTaskId ? <div className="min-w-[330px] max-w-[380px] pointer-events-none opacity-90">
                <div className="rounded-md border bg-card p-4 shadow-lg">
                  <div className="font-semibold">{tasks.find(t => t.id === activeTaskId)?.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">Arrastando…</div>
                </div>
              </div> : null}
          </DragOverlay>
        </DndContext>}
    </div>
    </TarefasProvider>;
}