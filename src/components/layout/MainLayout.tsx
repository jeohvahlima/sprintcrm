import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { GlobalCallListenerV2 } from "@/components/meetings/GlobalCallListenerV2";
import { useIsMobile } from "@/hooks/use-mobile";
import { SystemUpdatesModal } from "@/components/updates/SystemUpdatesModal";
import { useSystemUpdates } from "@/hooks/useSystemUpdates";
import { FloatingChatButton } from "@/components/internal-chat";
import { FloatingDialerButton } from "@/components/discador/FloatingDialerButton";
import { FloatingSupportButton } from "@/components/support-chat/FloatingSupportButton";
import { useFloatingButtonsVisibility } from "@/hooks/useFloatingButtonsVisibility";

export function MainLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const { chatVisible, dialerVisible, supportVisible } = useFloatingButtonsVisibility();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const isSupabaseConfigured = supabaseUrl && supabaseKey && 
    supabaseUrl !== "http://localhost:54321" && 
    supabaseKey !== "anon-key";
  const bypassAuth = (import.meta.env.VITE_BYPASS_AUTH === '1') || 
                     (import.meta.env.DEV === true) ||
                     !isSupabaseConfigured;
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  // Controle de sidebar aberta em mobile (drawer)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Sistema de atualizações
  const { unreadUpdates, isSuperAdmin } = useSystemUpdates();
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  
  // Mostrar modal de atualizações automaticamente para subcontas
  useEffect(() => {
    // Só mostra automaticamente se não for super admin e tiver atualizações não lidas
    if (!loading && session && !isSuperAdmin && unreadUpdates.length > 0) {
      // Verificar se já mostrou o modal nesta sessão
      const shownUpdates = sessionStorage.getItem('shown_updates_modal');
      if (!shownUpdates) {
        setShowUpdatesModal(true);
        sessionStorage.setItem('shown_updates_modal', 'true');
      }
    }
  }, [loading, session, isSuperAdmin, unreadUpdates.length]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    let subscription: { unsubscribe: () => void } | null = null;
    
    const initAuth = async () => {
      try {
        console.log("🔐 Inicializando autenticação...");
        
        if (!isSupabaseConfigured) {
          console.log("⚠️ Supabase não configurado - modo desenvolvimento sem autenticação");
          setLoading(false);
          return;
        }

        localStorage.removeItem('offline_mode');
        localStorage.removeItem('offline_session');
        localStorage.removeItem('is_super_admin');
        localStorage.removeItem('super_admin_email');

        timeoutId = setTimeout(() => {
          console.warn("⚠️ Timeout na verificação de autenticação - liberando interface");
          setLoading(false);
        }, 5000);

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        
        if (error) {
          console.error("❌ Erro ao verificar sessão:", error);
          if (bypassAuth) {
            setSession(null);
          } else {
            localStorage.clear();
            sessionStorage.clear();
            setSession(null);
          }
        } else if (!session) {
          console.log("⚠️ Nenhuma sessão ativa encontrada");
          if (bypassAuth) {
            setSession(null);
          } else {
            localStorage.clear();
            sessionStorage.clear();
            setSession(null);
          }
        } else {
          console.log("✅ Sessão ativa encontrada:", session.user.email);
          setSession(session);
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        console.error("❌ Erro fatal ao inicializar auth:", error);
        if (!bypassAuth) {
          localStorage.clear();
          sessionStorage.clear();
        }
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    if (isSupabaseConfigured) {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        console.log("🔐 Auth state changed:", _event, session?.user?.email || "sem usuário");
        
        if (_event === 'SIGNED_OUT' || !session) {
          if (!bypassAuth) {
            console.log("🚪 Limpando dados após logout/sem sessão");
            localStorage.clear();
            sessionStorage.clear();
          }
          setSession(null);
        } else {
          console.log("✅ Sessão atualizada:", session.user.email);
          setSession(session);
        }
      });

      subscription = authSubscription;
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [isSupabaseConfigured, bypassAuth]);

  // Fechar sidebar quando mudar para mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session && !bypassAuth) {
    return <Navigate to="/auth" replace />;
  }

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => {
        const newValue = !prev;
        localStorage.setItem('sidebar-collapsed', String(newValue));
        return newValue;
      });
    }
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const isEmbed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";

  if (isEmbed) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <main className="h-full overflow-y-auto p-2 md:p-4">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Backdrop para mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar - escondida em mobile, drawer quando aberta */}
      <div className={`
        ${isMobile 
          ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : ''
        }
      `}>
        <Sidebar collapsed={!isMobile && sidebarCollapsed} onNavigate={closeSidebar} />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          onToggleSidebar={toggleSidebar} 
          sidebarCollapsed={isMobile ? !sidebarOpen : sidebarCollapsed} 
        />
        <main className="flex-1 overflow-y-auto p-2 md:p-6">
          <Outlet />
        </main>
      </div>
      
      {/* Global call listener V2 - works on any page */}
      <GlobalCallListenerV2 />
      
      {/* Modal de atualizações do sistema */}
      <SystemUpdatesModal 
        open={showUpdatesModal} 
        onOpenChange={setShowUpdatesModal} 
      />
      
      {/* Botão flutuante do chat interno */}
      {chatVisible && <FloatingChatButton />}
      
      {/* Botão flutuante do discador */}
      {dialerVisible && <FloatingDialerButton />}
      
      {/* Botão flutuante do suporte técnico */}
      {supportVisible && <FloatingSupportButton />}
    </div>
  );
}
