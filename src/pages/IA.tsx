// 🔒 LOCKED — Visual oficial do módulo Automação & IA (GROW OS).
// Layout 100% definido em /public/automacao.html (mockup growos-automacao-v2).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/automacao.html.
//
// Funcionalidade: o iframe envia postMessage({__growos:true, ...}) e este
// wrapper roteia para módulos React reais (Fluxos, Base, Diagnóstico) sem
// alterar o visual fixo.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { BaseConhecimentoIA } from "@/components/ia/BaseConhecimentoIA";
import { supabase } from "@/integrations/supabase/client";

type OverlayModule = "fluxos" | "base" | null;

export default function IA() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overlay, setOverlay] = useState<OverlayModule>(null);

  useEffect(() => {
    const sendSession = async () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      iframe.contentWindow.postMessage({
        type: "growos-init",
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        userId: session.user.id,
      }, "*");
    };

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "growos-ready") sendSession();
      if (!data || typeof data !== "object" || !data.__growos) return;
      switch (data.type) {
        case "navigate":
          if (typeof data.path === "string") navigate(data.path);
          break;
        case "overlay":
          if (data.module === "fluxos" || data.module === "base") {
            setOverlay(data.module);
          }
          break;
        case "toast":
          toast(data.message || "Ação registrada");
          break;
      }
    };
    const iframe = iframeRef.current;
    window.addEventListener("message", handler);
    iframe?.addEventListener("load", sendSession);
    sendSession();
    return () => {
      window.removeEventListener("message", handler);
      iframe?.removeEventListener("load", sendSession);
    };
  }, [navigate]);

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/automacao.html"
        title="Automação & IA"
        className="w-full h-full border-0 block"
      />

      <Dialog open={overlay !== null} onOpenChange={(o) => !o && setOverlay(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {overlay === "fluxos" ? "Fluxos de Automação" : "Base de Conhecimento"}
            </DialogTitle>
          </DialogHeader>
          {overlay === "fluxos" && <FluxoAutomacaoBuilder />}
          {overlay === "base" && <BaseConhecimentoIA />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
