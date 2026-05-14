import { Building2, PanelLeftClose, PanelLeft, MessageSquare, Instagram, Zap, Clock, Users, LogOut, Settings, Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  // Métricas rápidas para página de Conversas
  const conversationsMetrics = useMemo(() => {
    try {
      const raw = localStorage.getItem("continuum_conversations");
      const list = raw ? JSON.parse(raw) : [];
      const totalConversas = Array.isArray(list) ? list.length : 0;
      const ativas = Array.isArray(list) ? list.filter((c: any) => c.status !== 'resolved').length : 0;
      const whatsapp = Array.isArray(list) ? list.filter((c: any) => c.channel === 'whatsapp').length : 0;
      const instagram = Array.isArray(list) ? list.filter((c: any) => c.channel === 'instagram').length : 0;
      const telegram = Array.isArray(list) ? list.filter((c: any) => c.channel === 'telegram').length : 0;
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      let mensagensHoje = 0;
      if (Array.isArray(list)) {
        for (const conv of list) {
          const msgs = Array.isArray(conv.messages) ? conv.messages : [];
          for (const m of msgs) {
            const ts = m?.timestamp ? new Date(m.timestamp) : null;
            if (ts && ts >= today && ts < tomorrow) mensagensHoje++;
          }
        }
      }
      return { totalConversas, ativas, mensagensHoje, whatsapp, instagram, telegram };
    } catch {
      return { totalConversas: 0, ativas: 0, mensagensHoje: 0, whatsapp: 0, instagram: 0, telegram: 0 };
    }
  }, [location.pathname]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      console.log("🔍 Carregando dados do usuário...");
      
      // Verificar se Supabase está configurado
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const isSupabaseConfigured = supabaseUrl && supabaseKey && 
        supabaseUrl !== "http://localhost:54321" && 
        supabaseKey !== "anon-key";
      
      // Se Supabase não está configurado, usar dados mock
      if (!isSupabaseConfigured) {
        console.log("⚠️ Supabase não configurado - usando dados mock");
        setUserName("Usuário Dev");
        setUserRole("Desenvolvedor");
        setCompanyName("Ambiente Dev");
        setLoading(false);
        return;
      }
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("❌ Erro ao obter usuário:", userError);
        console.log("🚪 Forçando logout - usuário não encontrado");
        await handleLogout();
        return;
      }

      console.log("✅ Usuário autenticado:", user.email);

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (profileError) {
        console.error("❌ Erro ao obter profile:", profileError);
        console.log("🚪 Forçando logout - profile não encontrado");
        await handleLogout();
        return;
      }

      // Get company info and role using RPC to avoid RLS recursion
      const { data: userRoleData, error: roleError } = await supabase
        .rpc('get_my_user_role')
        .single();

      if (roleError || !userRoleData) {
        console.error("❌ Erro ao obter role:", roleError);
        console.log("🚪 Forçando logout - role não encontrada");
        await handleLogout();
        return;
      }

      // ✅ Só define os dados se tudo estiver OK
      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else {
        setUserName(user.email || "Usuário");
      }

      // Mapear role para português
      const roleMap: Record<string, string> = {
        'super_admin': 'Super Administrador',
        'admin': 'Administrador',
        'moderator': 'Moderador',
        'user': 'Usuário Padrão'
      };
      
      setUserRole(roleMap[userRoleData.role] || 'Usuário');
      
      if (userRoleData.company_name) {
        setCompanyName(userRoleData.company_name);
      }

      console.log("✅ Dados do usuário carregados:", {
        name: profile?.full_name || user.email,
        role: userRoleData.role,
        company: userRoleData.company_name
      });
    } catch (error) {
      console.error("❌ Erro fatal ao carregar dados do usuário:", error);
      console.log("🚪 Forçando logout - erro fatal");
      await handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("🚪 Iniciando logout...");
      
      // Limpar todos os dados locais
      localStorage.clear();
      sessionStorage.clear();
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("❌ Erro no logout:", error);
        toast({
          variant: "destructive",
          title: "Erro ao sair",
          description: error.message
        });
      } else {
        console.log("✅ Logout realizado com sucesso");
        toast({
          title: "Logout realizado",
          description: "Você foi desconectado com sucesso"
        });
      }
      
      // Redirecionar para auth sempre, mesmo com erro
      navigate("/auth", { replace: true });
      
      // Forçar reload da página para limpar qualquer estado residual
      setTimeout(() => {
        window.location.href = "/auth";
      }, 100);
    } catch (error) {
      console.error("❌ Erro fatal no logout:", error);
      // Mesmo com erro, limpar tudo e redirecionar
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth";
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-3 md:px-6">
        {/* Toggle Sidebar Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-muted group transition-all"
          title={isMobile ? "Abrir menu" : (sidebarCollapsed ? "Expandir menu" : "Recolher menu")}
        >
          {isMobile ? (
            <Menu className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : (
            <PanelLeftClose className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </Button>


        {/* Spacer para empurrar ações para direita */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-3">
          {/* Badge da empresa - esconder em mobile pequeno */}
          {!loading && companyName && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-2 text-xs md:text-sm">
              <Building2 className="h-3 w-3" />
              <span className="hidden md:inline">{companyName}</span>
              <span className="md:hidden">{companyName.substring(0, 10)}{companyName.length > 10 ? '...' : ''}</span>
            </Badge>
          )}

          {/* Theme Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9 hover:bg-muted transition-colors"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NotificationCenter />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-3 border-l border-border/40 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 md:p-2 transition-colors">
                {/* Nome/Role - apenas em telas maiores */}
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                </div>
                <Avatar className="h-8 w-8 md:h-9 md:w-9 ring-2 ring-primary/10 hover:ring-primary/30 transition-all">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs md:text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                  {companyName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {companyName}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
