import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, MessageSquare, Calendar, Bot, Settings, LogOut, Video, PhoneCall, Target, Lock, X, Brain, DollarSign, GraduationCap, Activity, Sparkles, Scale, Rocket, ChevronDown, ChevronRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useInternalChatNotifications } from "@/hooks/useInternalChatNotifications";
import { useConversasNotifications } from "@/hooks/useConversasNotifications";
import { useTarefasNotifications } from "@/hooks/useTarefasNotifications";
import { useAgendaNotifications } from "@/hooks/useAgendaNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompanySegmento } from "@/hooks/useCompanySegmento";

type NavItem = {
  name: string;
  href: string;
  icon: any;
  menuKey: string;
  showConversasBadge?: boolean;
  showAgendaBadge?: boolean;
  showTarefasBadge?: boolean;
  showAIBadge?: boolean;
  masterOnly?: boolean;
  juridicoOnly?: boolean;
  clinicaOnly?: boolean;
  hideForClinica?: boolean;
  clinicaLabel?: string;
  clinicaHref?: string;
  clinicaIcon?: any;
};

type NavGroup = {
  type: "group";
  key: string;
  label: string;
  icon: any;
  items: NavItem[];
};

type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => (e as NavGroup).type === "group";

const navigation: NavEntry[] = [
  {
    type: "group",
    key: "crm",
    label: "CRM",
    items: [
      { name: "Relatórios", href: "/relatorios", icon: LayoutDashboard, menuKey: "analytics", clinicaLabel: "Painel Clínico" },
      { name: "Contatos", href: "/leads", icon: Users, menuKey: "leads", clinicaLabel: "Pacientes" },
      { name: "Funil de Vendas", href: "/kanban", icon: LayoutDashboard, menuKey: "funil", clinicaLabel: "Jornada do Paciente" },
      { name: "Bate-Papo", href: "/conversas", icon: MessageSquare, menuKey: "conversas", showConversasBadge: true, clinicaLabel: "Atendimento" },
      { name: "Agenda", href: "/agenda", icon: Calendar, menuKey: "agenda", showAgendaBadge: true },
      { name: "Gestão de Tarefas", href: "/tarefas", icon: Calendar, menuKey: "tarefas", showTarefasBadge: true },
      { name: "Fluxos e Automação", href: "/ia", icon: Bot, menuKey: "automacao" },
    ],
    icon: LayoutDashboard,
  },
  {
    type: "group",
    key: "grow",
    label: "BPO Comercial",
    icon: Rocket,
    items: [
      { name: "Planejamento de Faturamento", href: "/metas-vendas", icon: DollarSign, menuKey: "prospeccao", clinicaLabel: "Metas da Clínica" },
      { name: "Rotina Inteligente", href: "/rotina", icon: Brain, menuKey: "prospeccao", clinicaLabel: "Rotina Clínica" },
      // "Gestão de Processos" é exclusivamente comercial — oculto para clínicas
      // Módulo "Máquina de Vendas" removido — substituído pelo Call Center
      { name: "Maturidade Comercial", href: "/maturidade", icon: Activity, menuKey: "maturidade", hideForClinica: true } as any,
      { name: "Gestão de Processos", href: "/processos", icon: Target, menuKey: "processos", showAIBadge: true, hideForClinica: true } as any,
      { name: "Call Center", href: "/discador", icon: PhoneCall, menuKey: "discador" },
      { name: "Business Intelligence (BI)", href: "/financeiro", icon: DollarSign, menuKey: "financeiro", clinicaLabel: "BI Clínico", clinicaHref: "/bi-clinico", clinicaIcon: Stethoscope },
      { name: "Treinamento Comerciais", href: "/treinamento", icon: GraduationCap, menuKey: "treinamento", clinicaLabel: "Treinamentos" },
    ],
  },
  { name: "Configurações", href: "/configuracoes", icon: Settings, menuKey: "configuracoes" },
];

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const { canAccessModule, loading: moduleLoading, isMasterAccount } = useModuleAccess();
  const { unreadCount: totalUnread } = useInternalChatNotifications();
  const { unreadCount: conversasUnread } = useConversasNotifications();
  const { alertCount: tarefasAlert } = useTarefasNotifications();
  const { todayCount: agendaToday } = useAgendaNotifications();
  const { isJuridico, isClinica, isMasterAccount: isMasterFromSegmento, loading: segmentoLoading } = useCompanySegmento();

  const [aiInsightsCount, setAiInsightsCount] = useState(0);

  // Group expand state, persisted to localStorage
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return { crm: true, grow: true };
    try {
      const saved = localStorage.getItem("sidebar:groups");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { crm: true, grow: true };
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar:groups", JSON.stringify(openGroups)); } catch {}
  }, [openGroups]);

  const toggleGroup = (key: string) =>
    setOpenGroups((s) => ({ ...s, [key]: !s[key] }));

  // Auto-open the group containing current route
  useEffect(() => {
    const path = location.pathname;
    for (const entry of navigation) {
      if (isGroup(entry) && entry.items.some((it) => path.startsWith(it.href))) {
        setOpenGroups((s) => (s[entry.key] ? s : { ...s, [entry.key]: true }));
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const loadAIInsights = async () => {
      const { data } = await supabase.rpc('get_my_company_id');
      if (data) {
        const { count } = await supabase
          .from('ai_process_suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', data)
          .eq('status', 'pending');
        setAiInsightsCount(count || 0);
      }
    };
    loadAIInsights();
    const channel = supabase
      .channel('sidebar-ai-suggestions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_process_suggestions' }, loadAIInsights)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const premiumModules = ['automacao', 'chat-equipe', 'discador', 'processos'];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Erro ao sair", description: error.message });
    } else {
      navigate("/auth");
    }
  };

  const handleNavClick = () => {
    if (isMobile && onNavigate) onNavigate();
  };

  const effectiveCollapsed = isMobile ? false : collapsed;

  // Visibility logic per item
  const isItemVisible = (item: NavItem): boolean => {
    if (permissionsLoading || moduleLoading) return true;
    if (item.menuKey === 'configuracoes') return true;
    if (item.masterOnly && !isMasterAccount) return false;
    if (item.masterOnly && isMasterAccount) return true;
    if (item.juridicoOnly) {
      const isMaster = isMasterAccount || isMasterFromSegmento;
      if (isMaster) return true;
      if (segmentoLoading) return true;
      if (!isJuridico) return false;
    }
    if (item.clinicaOnly) {
      if (segmentoLoading) return true;
      if (!isClinica && !isMasterAccount) return false;
    }
    if (item.hideForClinica && isClinica) return false;
    const isPremiumModule = premiumModules.includes(item.menuKey);
    if (isPremiumModule && !isMasterAccount) {
      return canAccessModule(item.menuKey);
    }
    return canAccess(item.menuKey || '');
  };

  // Renders a single nav item link
  const renderItem = (rawItem: NavItem, indented: boolean = false) => {
    const item: NavItem = isClinica
      ? {
          ...rawItem,
          name: rawItem.clinicaLabel ?? rawItem.name,
          href: rawItem.clinicaHref ?? rawItem.href,
          icon: rawItem.clinicaIcon ?? rawItem.icon,
        }
      : rawItem;
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
                  variant: "destructive",
                });
              } else {
                handleNavClick();
              }
            }}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl ${indented && !effectiveCollapsed ? "pl-6 pr-3" : "px-3"} py-2.5 text-sm font-medium transition-all duration-200 ${
                isLocked
                  ? "text-sidebar-foreground/40 cursor-not-allowed"
                  : isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"
              } ${effectiveCollapsed ? "justify-center" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1.5 rounded-lg transition-colors relative ${
                    isLocked
                      ? "bg-sidebar-accent/20"
                      : isActive
                      ? "bg-white/20"
                      : "bg-sidebar-accent/30 group-hover:bg-sidebar-accent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {isLocked && !effectiveCollapsed && (
                    <Lock className="h-3 w-3 absolute -top-1 -right-1 text-muted-foreground" />
                  )}
                  {item.showConversasBadge && conversasUnread > 0 && effectiveCollapsed && !isLocked && (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-green-500 text-white">
                      {conversasUnread > 99 ? '99+' : conversasUnread}
                    </Badge>
                  )}
                  {item.showAgendaBadge && agendaToday > 0 && effectiveCollapsed && !isLocked && (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-blue-500 text-white">
                      {agendaToday > 99 ? '99+' : agendaToday}
                    </Badge>
                  )}
                  {item.showTarefasBadge && tarefasAlert > 0 && effectiveCollapsed && !isLocked && (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-yellow-500 text-white">
                      {tarefasAlert > 99 ? '99+' : tarefasAlert}
                    </Badge>
                  )}
                  {item.showAIBadge && aiInsightsCount > 0 && effectiveCollapsed && !isLocked && (
                    <Badge className="absolute -top-2 -right-2 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-orange-500 text-white">
                      {aiInsightsCount > 99 ? '99+' : aiInsightsCount}
                    </Badge>
                  )}
                </div>
                {!effectiveCollapsed && (
                  <span className={`flex-1 flex ${item.name === "Gestão de Processos" ? "flex-col items-start gap-0" : "items-center justify-between"}`}>
                    <span className="leading-tight">{item.name}</span>
                    {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {item.showConversasBadge && conversasUnread > 0 && !isLocked && (
                      <Badge className="ml-2 text-xs bg-green-500 hover:bg-green-600 text-white">
                        {conversasUnread > 99 ? '99+' : conversasUnread}
                      </Badge>
                    )}
                    {item.showAgendaBadge && agendaToday > 0 && !isLocked && (
                      <Badge className="ml-2 text-xs bg-blue-500 hover:bg-blue-600 text-white">
                        {agendaToday > 99 ? '99+' : agendaToday}
                      </Badge>
                    )}
                    {item.showTarefasBadge && tarefasAlert > 0 && !isLocked && (
                      <Badge className="ml-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-white">
                        {tarefasAlert > 99 ? '99+' : tarefasAlert}
                      </Badge>
                    )}
                    {item.showAIBadge && aiInsightsCount > 0 && !isLocked && (
                      <Badge className={`${item.name === "Gestão de Processos" ? "mt-1" : "ml-2"} text-[10px] bg-orange-500 hover:bg-orange-600 text-white gap-1 px-1.5 h-4`}>
                        <Brain className="h-2.5 w-2.5" />
                        {aiInsightsCount}
                      </Badge>
                    )}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </TooltipTrigger>
        {effectiveCollapsed && (
          <TooltipContent side="right" className="font-medium">
            {item.name} {isLocked ? "(Bloqueado)" : ""}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  // Render group header (collapsible) — when expanded, items render below; when collapsed sidebar, popover with subitems
  const renderGroup = (group: NavGroup) => {
    const visibleItems = group.items.filter(isItemVisible);
    if (visibleItems.length === 0) return null;
    const isOpen = openGroups[group.key] ?? true;
    const Icon = group.icon;

    if (effectiveCollapsed) {
      // Icon-only mode: popover on hover/click
      return (
        <Popover key={group.key}>
          <PopoverTrigger asChild>
            <button
              className="group flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
              title={group.label}
            >
              <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-sidebar-accent">
                <Icon className="h-4 w-4" />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="p-2 w-56">
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">
              {group.label}
            </div>
            <div className="space-y-1 mt-1">
              {visibleItems.map((it) => renderItem(it, false))}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div key={group.key} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.key)}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
        >
          <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-sidebar-accent">
            <Icon className="h-4 w-4" />
          </div>
          <span className="flex-1 text-left">{group.label}</span>
          {isOpen ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />}
        </button>
        {isOpen && (
          <div className="space-y-1 border-l border-sidebar-border/40 ml-5 pl-1">
            {visibleItems.map((it) => renderItem(it, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex h-screen flex-col bg-sidebar border-r border-sidebar-border shadow-xl transition-all duration-300 ease-in-out ${effectiveCollapsed ? "w-20" : "w-64"}`}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-sidebar-border/50">
        {effectiveCollapsed ? (
          <img src="/logo-waze.png" alt="GROW OS" className="h-10 w-10 object-contain mx-auto" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <img src="/logo-waze.png" alt="GROW OS" className="h-10 w-10 object-contain" />
              <div>
                <span className="text-sidebar-foreground font-bold text-lg block leading-tight">GROW OS </span>
                <span className="text-sidebar-foreground/60 text-xs">sistema operacional de crescimento comercial</span>
              </div>
            </div>
            {isMobile && onNavigate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNavigate}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((entry) => {
            if (isGroup(entry)) return renderGroup(entry);
            if (!isItemVisible(entry)) return null;
            return renderItem(entry, false);
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
                onClick={handleLogout}
              >
                <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-destructive/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                {!effectiveCollapsed && <span className="font-medium ml-3">Sair do Sistema</span>}
              </Button>
            </TooltipTrigger>
            {effectiveCollapsed && (
              <TooltipContent side="right" className="font-medium">
                Sair do Sistema
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
