import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, MessageSquare, Calendar, Bot, Settings, LogOut, MessagesSquare, Video, PhoneCall, Target, Lock, X, Brain, DollarSign, GraduationCap, Activity, Sparkles, Scale, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useInternalChatNotifications } from "@/hooks/useInternalChatNotifications";
import { useConversasNotifications } from "@/hooks/useConversasNotifications";
import { useTarefasNotifications } from "@/hooks/useTarefasNotifications";
import { useAgendaNotifications } from "@/hooks/useAgendaNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";

const navigation = [{
  name: "Relatórios",
  href: "/analytics",
  icon: LayoutDashboard,
  menuKey: "analytics"
}, {
  name: "Contatos",
  href: "/leads",
  icon: Users,
  menuKey: "leads"
}, {
  name: "Funil de Vendas",
  href: "/kanban",
  icon: LayoutDashboard,
  menuKey: "funil"
}, {
  name: "Bate-Papo",
  href: "/conversas",
  icon: MessageSquare,
  menuKey: "conversas",
  showConversasBadge: true
}, {
  name: "Agenda",
  href: "/agenda",
  icon: Calendar,
  menuKey: "agenda",
  showAgendaBadge: true
}, {
  name: "Tarefas",
  href: "/tarefas",
  icon: Calendar,
  menuKey: "tarefas",
  showTarefasBadge: true
}, {
  name: "Fluxos e Automação",
  href: "/ia",
  icon: Bot,
  menuKey: "automacao"
}, {
  name: "Discador",
  href: "/discador",
  icon: PhoneCall,
  menuKey: "discador"
}, {
  name: "Processos Comerciais",
  href: "/processos",
  icon: Target,
  menuKey: "processos",
  showAIBadge: true
}, {
  name: "Prospecção",
  href: "/prospeccao",
  icon: Target,
  menuKey: "prospeccao"
}, {
  name: "Maturidade",
  href: "/maturidade",
  icon: Activity,
  menuKey: "maturidade"
}, {
  name: "Jurídico",
  href: "/juridico",
  icon: Scale,
  menuKey: "juridico",
  juridicoOnly: true
}, {
  name: "Mentoria",
  href: "/mentoria",
  icon: Sparkles,
  menuKey: "mentoria",
  masterOnly: true
}, {
  name: "Financeiro",
  href: "/financeiro",
  icon: DollarSign,
  menuKey: "financeiro",
  masterOnly: true
}, {
  name: "Treinamento",
  href: "/treinamento",
  icon: GraduationCap,
  menuKey: "treinamento" // Central de vídeos do YouTube
}, {
  name: "Configurações",
  href: "/configuracoes",
  icon: Settings,
  menuKey: "configuracoes"
}];

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  collapsed = false,
  onNavigate
}: SidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    canAccess,
    loading: permissionsLoading
  } = usePermissions();
  const {
    canAccessModule,
    loading: moduleLoading,
    isMasterAccount
  } = useModuleAccess();
  const { unreadCount: totalUnread } = useInternalChatNotifications();
  const { unreadCount: conversasUnread } = useConversasNotifications();
  const { alertCount: tarefasAlert } = useTarefasNotifications();
  const { todayCount: agendaToday } = useAgendaNotifications();
  const { isJuridico, isMasterAccount: isMasterFromSegmento, loading: segmentoLoading } = useCompanySegmento();

  // AI Insights count from database
  const [aiInsightsCount, setAiInsightsCount] = useState(0);

  useEffect(() => {
    const loadAIInsights = async () => {
      const { data } = await supabase.rpc('get_my_company_id');
      if (data) {
        const { count } = await supabase.
        from('ai_process_suggestions').
        select('id', { count: 'exact', head: true }).
        eq('company_id', data).
        eq('status', 'pending');
        setAiInsightsCount(count || 0);
      }
    };

    loadAIInsights();

    // Refresh on changes
    const channel = supabase.
    channel('sidebar-ai-suggestions').
    on('postgres_changes', { event: '*', schema: 'public', table: 'ai_process_suggestions' }, loadAIInsights).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Módulos premium que requerem liberação
  const premiumModules = ['automacao', 'chat-equipe', 'discador', 'processos'];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message
      });
    } else {
      navigate("/auth");
    }
  };

  const handleNavClick = () => {
    // Fechar sidebar em mobile após navegação
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  // Em mobile, nunca colapsa (sempre mostra texto)
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <div className={`flex h-screen flex-col bg-sidebar border-r border-sidebar-border shadow-xl transition-all duration-300 ease-in-out ${effectiveCollapsed ? "w-20" : "w-64"}`}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-sidebar-border/50">
        {effectiveCollapsed ?
        <img src="/logo-waze.png" alt="GROW OS" className="h-10 w-10 object-contain mx-auto" /> :

        <>
            <div className="flex items-center gap-3">
              <img src="/logo-waze.png" alt="GROW OS" className="h-10 w-10 object-contain" />
              <div>
                <span className="text-sidebar-foreground font-bold text-lg block leading-tight">GROW OS </span>
                <span className="text-sidebar-foreground/60 text-xs">sistema operacional de crescimento comercial</span>
              </div>
            </div>
            {/* Botão fechar apenas em mobile */}
            {isMobile && onNavigate &&
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigate}
            className="text-sidebar-foreground hover:bg-sidebar-accent">
            
                <X className="h-5 w-5" />
              </Button>
          }
          </>
        }
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.filter((item) => {
            if (permissionsLoading || moduleLoading) return true;
            if (item.menuKey === 'configuracoes') return true; // Always show config

            // Financeiro só aparece para master accounts
            if ((item as any).masterOnly && !isMasterAccount) {
              return false;
            }

            // Jurídico aparece para contas master OU com segmento de advocacia
            if ((item as any).juridicoOnly) {
              const isMaster = isMasterAccount || isMasterFromSegmento;
              if (isMaster) return true; // master sempre vê
              if (segmentoLoading) return true; // mostra enquanto carrega
              if (!isJuridico) return false;
            }

            // Verificar se é módulo premium
            const isPremiumModule = premiumModules.includes(item.menuKey);
            if (isPremiumModule && !isMasterAccount) {
              // Verificar se tem acesso ao módulo
              return canAccessModule(item.menuKey);
            }

            return canAccess(item.menuKey || '');
          }).map((item) => {
            const isPremiumModule = premiumModules.includes(item.menuKey);
            const hasModuleAccess = isMasterAccount || canAccessModule(item.menuKey);
            const isLocked = isPremiumModule && !hasModuleAccess && !moduleLoading;

            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={isLocked ? "#" : item.href}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        toast({
                          title: "Módulo Premium",
                          description: `O módulo ${item.name} requer ativação. Entre em contato com o administrador.`,
                          variant: "destructive"
                        });
                      } else {
                        handleNavClick();
                      }
                    }}
                    className={({
                      isActive
                    }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    isLocked ?
                    "text-sidebar-foreground/40 cursor-not-allowed" :
                    isActive ?
                    "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20" :
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"} ${
                    effectiveCollapsed ? "justify-center" : ""}`}>
                    
                    {({
                      isActive
                    }) => <>
                        <div className={`p-1.5 rounded-lg transition-colors relative ${
                      isLocked ?
                      "bg-sidebar-accent/20" :
                      isActive ?
                      "bg-white/20" :
                      "bg-sidebar-accent/30 group-hover:bg-sidebar-accent"}`
                      }>
                          <item.icon className="h-4 w-4" />
                          {isLocked && !effectiveCollapsed &&
                        <Lock className="h-3 w-3 absolute -top-1 -right-1 text-muted-foreground" />
                        }
                          {false &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
                              {totalUnread > 99 ? '99+' : totalUnread}
                            </Badge>
                        }
                          {item.showConversasBadge && conversasUnread > 0 && effectiveCollapsed && !isLocked &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-green-500 text-white">
                              {conversasUnread > 99 ? '99+' : conversasUnread}
                            </Badge>
                        }
                          {item.showAgendaBadge && agendaToday > 0 && effectiveCollapsed && !isLocked &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-blue-500 text-white">
                              {agendaToday > 99 ? '99+' : agendaToday}
                            </Badge>
                        }
                          {item.showTarefasBadge && tarefasAlert > 0 && effectiveCollapsed && !isLocked &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-yellow-500 text-white">
                              {tarefasAlert > 99 ? '99+' : tarefasAlert}
                            </Badge>
                        }
                          {item.showAIBadge && aiInsightsCount > 0 && effectiveCollapsed && !isLocked &&
                        <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-orange-500 text-white">
                              {aiInsightsCount > 99 ? '99+' : aiInsightsCount}
                            </Badge>
                        }
                        </div>
                        {!effectiveCollapsed &&
                      <span className="flex-1 flex items-center justify-between">
                            {item.name}
                            {isLocked &&
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        }
                            {false &&
                        <Badge variant="destructive" className="ml-2 text-xs">
                                {totalUnread > 99 ? '99+' : totalUnread}
                              </Badge>
                        }
                            {item.showConversasBadge && conversasUnread > 0 && !isLocked &&
                        <Badge className="ml-2 text-xs bg-green-500 hover:bg-green-600 text-white">
                                {conversasUnread > 99 ? '99+' : conversasUnread}
                              </Badge>
                        }
                            {item.showAgendaBadge && agendaToday > 0 && !isLocked &&
                        <Badge className="ml-2 text-xs bg-blue-500 hover:bg-blue-600 text-white">
                                {agendaToday > 99 ? '99+' : agendaToday}
                              </Badge>
                        }
                            {item.showTarefasBadge && tarefasAlert > 0 && !isLocked &&
                        <Badge className="ml-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white">
                                {tarefasAlert > 99 ? '99+' : tarefasAlert}
                              </Badge>
                        }
                            {item.showAIBadge && aiInsightsCount > 0 && !isLocked &&
                        <Badge className="ml-2 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1">
                                <Brain className="h-3 w-3" />
                                {aiInsightsCount}
                              </Badge>
                        }
                          </span>
                      }
                      </>
                    }
                  </NavLink>
                </TooltipTrigger>
                {effectiveCollapsed &&
                <TooltipContent side="right" className="font-medium">
                    {item.name} {isLocked ? "(Bloqueado)" : item.showConversasBadge && conversasUnread > 0 ? `(${conversasUnread})` : item.showAgendaBadge && agendaToday > 0 ? `(${agendaToday})` : item.showTarefasBadge && tarefasAlert > 0 ? `(${tarefasAlert})` : item.showAIBadge && aiInsightsCount > 0 ? `(${aiInsightsCount} IA)` : ""}
                  </TooltipContent>
                }
              </Tooltip>);

          })}
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="border-t border-sidebar-border/50 p-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-all duration-200 group ${effectiveCollapsed ? "justify-center px-0" : "justify-start"}`}
                onClick={handleLogout}>
                
                <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-destructive/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                {!effectiveCollapsed && <span className="font-medium ml-3">Sair do Sistema</span>}
              </Button>
            </TooltipTrigger>
            {effectiveCollapsed &&
            <TooltipContent side="right" className="font-medium">
                Sair do Sistema
              </TooltipContent>
            }
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>);

}