import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConversaPopup } from "@/components/leads/ConversaPopup";

interface WhatsAppPopupState {
  open: boolean;
  leadId: string;
  leadName: string;
  leadPhone?: string;
}

/**
 * Módulo Tarefas — Opção B
 * Mantém o visual 100% do mockup (public/tarefas.html) e injeta a sessão
 * via postMessage para o script do iframe se conectar ao Lovable Cloud.
 */
const Tarefas = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [whatsappPopup, setWhatsappPopup] = useState<WhatsAppPopupState>({
    open: false,
    leadId: "",
    leadName: "Contato",
  });

  useEffect(() => {
    const sendSession = async () => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) return;
      iframe.contentWindow.postMessage(
        {
          type: "tarefas-init",
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          accessToken: s.access_token,
          refreshToken: s.refresh_token,
          userId: s.user.id,
        },
        "*"
      );
    };

    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "tarefas-ready") sendSession();
      if (ev.data?.type === "tarefas-open-whatsapp") {
        void (async () => {
          const { phone, leadId, leadName } = ev.data;
          const cleanPhone = phone ? String(phone).replace(/\D/g, "") : "";
          if (!cleanPhone) return;

          let resolvedLeadId = leadId ? String(leadId) : "";
          if (!resolvedLeadId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: role } = await supabase
                .from("user_roles")
                .select("company_id")
                .eq("user_id", user.id)
                .maybeSingle();
              if (role?.company_id) {
                const tail = cleanPhone.slice(-9);
                const { data: rows } = await supabase
                  .from("leads")
                  .select("id")
                  .eq("company_id", role.company_id)
                  .or(`phone.ilike.%${tail}%,telefone.ilike.%${tail}%`)
                  .limit(1);
                if (rows?.[0]?.id) resolvedLeadId = rows[0].id;
              }
            }
          }

          setWhatsappPopup({
            open: true,
            leadId: resolvedLeadId,
            leadName: leadName ? String(leadName) : "Contato",
            leadPhone: cleanPhone,
          });
        })();
      }
    };
    window.addEventListener("message", onMsg);

    const iframe = iframeRef.current;
    iframe?.addEventListener("load", sendSession);
    return () => {
      window.removeEventListener("message", onMsg);
      iframe?.removeEventListener("load", sendSession);
    };
  }, []);

  return (
    <div className="h-full w-full min-h-screen bg-background flex flex-col">
      <iframe
        ref={iframeRef}
        src="/tarefas.html"
        title="Tarefas"
        style={{
          width: "100%",
          minHeight: "calc(100vh - 80px)",
          border: 0,
          background: "#0b0e14",
        }}
      />
      <ConversaPopup
        open={whatsappPopup.open}
        onOpenChange={(open) => setWhatsappPopup((prev) => ({ ...prev, open }))}
        leadId={whatsappPopup.leadId}
        leadName={whatsappPopup.leadName}
        leadPhone={whatsappPopup.leadPhone}
        key={`${whatsappPopup.leadId}-${whatsappPopup.leadPhone}-${whatsappPopup.open}`}
      />
    </div>
  );
};

export default Tarefas;
