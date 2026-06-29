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
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { BaseConhecimentoIA } from "@/components/ia/BaseConhecimentoIA";
import { SiteInstitucionalConfig } from "@/components/ia/SiteInstitucionalConfig";
import DisparoEmMassaWhatsAppNormal from "@/components/campanhas/DisparoEmMassaWhatsAppNormal";
import { supabase } from "@/integrations/supabase/client";

type OverlayModule = "fluxos" | "base" | "site" | "disparo-nao-oficial" | null;

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
          if (data.module === "fluxos" || data.module === "base" || data.module === "site" || data.module === "disparo-nao-oficial") {
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

  const overlayTitle = overlay === "fluxos" ? "Fluxos de Automação" : overlay === "base" ? "Base de Conhecimento" : "Site Institucional";

  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        ref={iframeRef}
        src="/automacao.html"
        title="Automação & IA"
        className="w-full h-full border-0 block"
      />

      <Dialog open={overlay !== null} onOpenChange={(o) => { if (!o) { setOverlay(null); sendSiteInfo(); } }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{overlayTitle}</DialogTitle>
          </DialogHeader>
          {overlay === "fluxos" && <FluxoAutomacaoBuilder />}
          {overlay === "base" && <BaseConhecimentoIA />}
          {overlay === "site" && companyId && <SiteInstitucionalConfig companyId={companyId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
