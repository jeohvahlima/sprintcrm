// Importa eventos do Google Calendar do usuário autenticado para a tabela `compromissos`.
// Suporta sync incremental via syncToken.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidAccessToken, listCalendarEvents } from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    const { data: integration } = await supabase
      .from("google_calendar_integrations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!integration) throw new Error("Not connected");

    const { data: ur } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    const company_id = ur?.company_id;

    const { access_token, calendar_id, integration_id } = await getValidAccessToken(supabase, userId);

    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let imported = 0, updated = 0, deleted = 0;

    const listParams: any = integration.sync_token
      ? { syncToken: integration.sync_token }
      : {
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          timeMax: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        };

    do {
      const data: any = await listCalendarEvents(access_token, calendar_id, {
        ...listParams,
        pageToken,
      });

      for (const ev of (data.items || [])) {
        if (ev.status === "cancelled") {
          // Remover do CRM se vinha do Google
          await supabase
            .from("compromissos")
            .delete()
            .eq("google_event_id", ev.id)
            .eq("google_sync_source", "google");
          deleted++;
          continue;
        }
        if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // ignora all-day

        // Já existe?
        const { data: existing } = await supabase
          .from("compromissos")
          .select("id, google_sync_source")
          .eq("google_event_id", ev.id)
          .maybeSingle();

        if (existing) {
          // Só atualiza se origem é Google (evita sobrescrever editado pelo CRM)
          if (existing.google_sync_source === "google") {
            await supabase
              .from("compromissos")
              .update({
                titulo: ev.summary || "Sem título",
                tipo_servico: ev.summary || "Evento",
                observacoes: ev.description || null,
                data_hora_inicio: ev.start.dateTime,
                data_hora_fim: ev.end.dateTime,
                google_calendar_synced_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            updated++;
          }
        } else {
          await supabase.from("compromissos").insert({
            company_id,
            usuario_responsavel_id: userId,
            owner_id: userId,
            titulo: ev.summary || "Sem título",
            tipo_servico: ev.summary || "Evento",
            observacoes: ev.description || null,
            data_hora_inicio: ev.start.dateTime,
            data_hora_fim: ev.end.dateTime,
            status: "agendado",
            google_event_id: ev.id,
            google_sync_source: "google",
            google_calendar_synced_at: new Date().toISOString(),
          });
          imported++;
        }
      }

      pageToken = data.nextPageToken;
      if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
    } while (pageToken);

    // Salvar novo syncToken
    await supabase
      .from("google_calendar_integrations")
      .update({
        sync_token: nextSyncToken ?? integration.sync_token,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", integration_id);

    return new Response(
      JSON.stringify({ success: true, imported, updated, deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[gcal-sync]", e);
    // Se syncToken expirou (410 Gone), limpar para próxima rodada fazer full sync
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("410")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
        );
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await supabase.from("google_calendar_integrations")
            .update({ sync_token: null }).eq("user_id", userData.user.id);
        }
      } catch {}
    }
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
