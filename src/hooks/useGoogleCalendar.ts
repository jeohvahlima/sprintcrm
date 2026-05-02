import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GoogleCalendarIntegration {
  id: string;
  google_email: string | null;
  calendar_id: string;
  active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

const REDIRECT_PATH = "/google-calendar-callback";

export function useGoogleCalendar() {
  const [integration, setIntegration] = useState<GoogleCalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIntegration(null);
        return;
      }
      const { data } = await supabase
        .from("google_calendar_integrations")
        .select("id, google_email, calendar_id, active, last_sync_at, created_at")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      setIntegration(data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const redirect_uri = `${window.location.origin}${REDIRECT_PATH}`;
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth-start", {
        body: { redirect_uri },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error("Sem URL de autorização");
      window.location.href = data.auth_url;
    } catch (e: any) {
      toast.error("Falha ao iniciar conexão", { description: e.message });
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect", { body: {} });
      if (error) throw error;
      toast.success("Google Calendar desconectado");
      await load();
    } catch (e: any) {
      toast.error("Falha ao desconectar", { description: e.message });
    } finally {
      setBusy(false);
    }
  }, [load]);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", { body: {} });
      if (error) throw error;
      toast.success("Sincronizado", {
        description: `${data?.imported ?? 0} novos · ${data?.updated ?? 0} atualizados · ${data?.deleted ?? 0} removidos`,
      });
      await load();
    } catch (e: any) {
      toast.error("Falha ao sincronizar", { description: e.message });
    } finally {
      setBusy(false);
    }
  }, [load]);

  const pushCompromisso = useCallback(async (
    compromisso_id: string,
    action: "create" | "update" | "delete" = "create"
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-event", {
        body: { action, compromisso_id },
      });
      if (error) throw error;
      return data;
    } catch (e: any) {
      console.error("[pushCompromisso]", e);
      throw e;
    }
  }, []);

  return {
    integration,
    isConnected: !!integration?.active,
    loading,
    busy,
    connect,
    disconnect,
    sync,
    pushCompromisso,
    reload: load,
  };
}
