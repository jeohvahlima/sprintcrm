// 🔒 LOCKED — Visual oficial do módulo Automação & IA (GROW OS).
// Layout 100% definido em /public/automacao.html (mockup growos-automacao-v2).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/automacao.html.
//
// Funcionalidade: o iframe envia postMessage({__growos:true, ...}) e este
// wrapper roteia para módulos React reais (Fluxos, Base, Diagnóstico) sem
// alterar o visual fixo.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { SiteInstitucionalConfig } from "@/components/ia/SiteInstitucionalConfig";
import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { supabase } from "@/integrations/supabase/client";

type OverlayModule = "fluxos" | "site" | "disparo-nao-oficial" | null;

export default function IA() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overlay, setOverlay] = useState<OverlayModule>(null);
  const [companyId, setCompanyId] = useState<string>("");

  const loadSiteInfo = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", uid)
      .not("company_id", "is", null)
      .limit(1);
    let cid = (roles as any)?.[0]?.company_id;
    if (!cid) {
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", uid).maybeSingle();
      cid = (prof as any)?.company_id;
    }
    if (!cid) return null;
    setCompanyId(cid);
    const { data: comp } = await supabase.from("companies").select("name, capture_page_config").eq("id", cid).single();
    const cfg: any = (comp as any)?.capture_page_config || {};
    const slug = typeof cfg.slug === "string" && cfg.slug.trim() ? cfg.slug.trim() : cid;
    const baseUrl = "https://app.growos.online";
    const url = `${baseUrl}/site/${slug}`;
    return { url, published: !!cfg.site_published };

  }, []);

  const sendSiteInfo = useCallback(async () => {
    const info = await loadSiteInfo();
    if (info) iframeRef.current?.contentWindow?.postMessage({ type: "growos-site-info", ...info }, "*");
  }, [loadSiteInfo]);

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
      sendSiteInfo();
    };

    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "growos-ready") sendSession();
      if (!data || typeof data !== "object" || !data.__growos) return;
      switch (data.type) {
        case "navigate":
          if (typeof data.path === "string") navigate(data.path);
          break;
        case "overlay":
          if (data.module === "fluxos" || data.module === "site" || data.module === "disparo-nao-oficial") {
            if (data.module === "site") await loadSiteInfo();
            setOverlay(data.module);
          }
          break;
        case "openSite": {
          const info = await loadSiteInfo();
          if (!info) { toast.error("Não foi possível localizar o site"); return; }
          const url = info.published ? info.url : info.url + "?preview=1";
          window.open(url, "_blank", "noopener");
          break;
        }
        case "requestSiteInfo":
          sendSiteInfo();
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
  }, [navigate, sendSiteInfo, loadSiteInfo]);

  const overlayTitle = overlay === "fluxos" ? "Fluxos de Automação" : overlay === "disparo-nao-oficial" ? "WhatsApp Não Oficial — Disparo em Massa" : "Site Institucional";

  if (overlay === "fluxos") {
    return (
      <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-y-auto rounded-lg border border-border bg-background">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOverlay(null);
              requestAnimationFrame(sendSiteInfo);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Fluxos de Automação</h1>
            <p className="text-sm text-muted-foreground">Crie fluxos visuais para automatizar atendimento e processos.</p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <FluxoAutomacaoBuilder />
        </div>
      </div>
    );
  }
  if (overlay === "disparo-nao-oficial") {
    return (
      <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-y-auto rounded-lg border border-border bg-background">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOverlay(null);
              requestAnimationFrame(sendSiteInfo);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">WhatsApp Não Oficial — Disparo em Massa</h1>
            <p className="text-sm text-muted-foreground">Selecione leads, configure timing e envie campanhas pela API não oficial.</p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <DisparoEmMassa />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/automacao.html"
        title="Automação & IA"
        className="w-full h-full border-0 block"
      />

      <Dialog open={overlay === "site"} onOpenChange={(o) => { if (!o) { setOverlay(null); sendSiteInfo(); } }}>
        <DialogContent className="max-w-[min(96vw,1400px)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{overlayTitle}</DialogTitle>
          </DialogHeader>
          {overlay === "site" && companyId && <SiteInstitucionalConfig companyId={companyId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
