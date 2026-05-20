// Cria/atualiza/remove evento do Google Calendar a partir de um compromisso do CRM.
// Body: { action: 'create'|'update'|'delete', compromisso_id: uuid }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getValidAccessToken,
  buildEventBody,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, compromisso_id } = await req.json();
    if (!action || !compromisso_id) throw new Error("action and compromisso_id required");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    // Cliente com service_role para bypassar RLS nos joins (lead/agenda/profissional)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar compromisso + lead + agenda + profissional
    const { data: comp, error: compErr } = await supabase
      .from("compromissos")
      .select(`
        *,
        lead:leads(name, email, phone, telefone),
        agenda:agendas(nome, tipo),
        profissional:profissionais(nome, email, especialidade)
      `)
      .eq("id", compromisso_id)
      .maybeSingle();
    if (compErr) {
      console.error("[gcal-event] compErr:", compErr);
      throw new Error(`Compromisso query failed: ${compErr.message}`);
    }
    if (!comp) throw new Error(`Compromisso not found (id=${compromisso_id})`);

    const { access_token, calendar_id } = await getValidAccessToken(supabase, userId);

    if (action === "delete") {
      if (!comp.google_event_id) {
        return new Response(JSON.stringify({ success: true, skipped: "no event id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await deleteCalendarEvent(access_token, calendar_id, comp.google_event_id);
      await supabase
        .from("compromissos")
        .update({ google_event_id: null, google_calendar_synced_at: new Date().toISOString() })
        .eq("id", compromisso_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convidados (opcional) - prioriza email_convidado manual, depois email do lead
    const attendees: string[] = [];
    if (comp.convidar_lead_email) {
      const emailManual = (comp.email_convidado || '').trim();
      const emailLead = (comp.lead?.email || '').trim();
      const emailFinal = emailManual || emailLead;
      if (emailFinal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFinal)) {
        attendees.push(emailFinal);
      }
    }

    // Título descritivo: "<Tipo de serviço> — <Nome do lead>"
    const tipoServ = (comp.tipo_servico || "Compromisso").charAt(0).toUpperCase() + (comp.tipo_servico || "Compromisso").slice(1);
    const summary = comp.lead?.name
      ? `${tipoServ} — ${comp.lead.name}`
      : (comp.titulo || tipoServ);

    // Descrição completa
    const fone = comp.lead?.phone || comp.lead?.telefone;
    const valor = comp.custo_estimado != null && Number(comp.custo_estimado) > 0
      ? Number(comp.custo_estimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;
    const descLines = [
      `📋 Tipo: ${tipoServ}`,
      comp.lead?.name ? `👤 Lead: ${comp.lead.name}` : null,
      fone ? `📞 Telefone: ${fone}` : null,
      comp.lead?.email ? `✉️ E-mail: ${comp.lead.email}` : null,
      comp.agenda?.nome ? `📅 Agenda: ${comp.agenda.nome}` : null,
      comp.profissional?.nome
        ? `👨‍💼 Profissional: ${comp.profissional.nome}${comp.profissional.especialidade ? ` (${comp.profissional.especialidade})` : ""}`
        : null,
      valor ? `💰 Valor estimado: ${valor}` : null,
      comp.observacoes ? `\n📝 Observações:\n${comp.observacoes}` : null,
      `\n— Sincronizado pelo Waze Sales OS`,
    ].filter(Boolean).join("\n");

    const body = buildEventBody({
      summary,
      description: descLines,
      start: comp.data_hora_inicio,
      end: comp.data_hora_fim,
      attendeeEmails: attendees,
      reminders: comp.lembretes_config || { popup: [10], email: [60, 1440] },
    });

    let event: any;
    if (action === "update" && comp.google_event_id) {
      event = await updateCalendarEvent(access_token, calendar_id, comp.google_event_id, body);
    } else {
      event = await createCalendarEvent(access_token, calendar_id, body);
    }

    await supabase
      .from("compromissos")
      .update({
        google_event_id: event.id,
        google_calendar_synced_at: new Date().toISOString(),
        google_sync_source: "crm",
      })
      .eq("id", compromisso_id);

    return new Response(
      JSON.stringify({ success: true, event_id: event.id, html_link: event.htmlLink }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[gcal-event]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
