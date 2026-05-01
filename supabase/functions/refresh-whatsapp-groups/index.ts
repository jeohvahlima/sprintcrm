// Edge Function: Refresh WhatsApp group subjects
// Atualiza nome_contato + group_subject de conversas em grupo
// usando dados da Evolution API. Útil para corrigir conversas antigas
// onde o nome do remetente foi salvo no lugar do nome do grupo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { company_id } = await req.json().catch(() => ({}));

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔄 [REFRESH-GROUPS] Iniciando para company:", company_id);

    // Buscar conexão da empresa
    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("instance_name, evolution_api_key, evolution_api_url")
      .eq("company_id", company_id)
      .limit(1)
      .maybeSingle();

    const evolutionUrl = connection?.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
    const apiKey = connection?.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");
    const instanceName = connection?.instance_name || Deno.env.get("EVOLUTION_INSTANCE");

    if (!evolutionUrl || !apiKey || !instanceName) {
      return new Response(
        JSON.stringify({ error: "Configuração WhatsApp incompleta para esta empresa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar TODOS os grupos da Evolution
    const r = await fetch(
      `${evolutionUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
      { method: "GET", headers: { apikey: apiKey, "Content-Type": "application/json" } }
    );

    if (!r.ok) {
      const errText = await r.text();
      console.error("❌ Evolution API erro:", r.status, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao consultar grupos na Evolution API", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groups = await r.json();
    if (!Array.isArray(groups)) {
      return new Response(
        JSON.stringify({ error: "Resposta inesperada da Evolution API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 [REFRESH-GROUPS] ${groups.length} grupos encontrados na Evolution`);

    let updated = 0;
    let cached = 0;

    for (const g of groups) {
      const jid = g.id || g.remoteJid;
      const subject = g.subject || g.name;
      if (!jid || !subject) continue;

      // Atualizar cache
      await supabase.from("whatsapp_groups_cache").upsert(
        {
          company_id,
          group_jid: jid,
          group_subject: subject,
          picture_url: g.pictureUrl || null,
          participants_count: g.size || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,group_jid" }
      );
      cached++;

      // Atualizar todas as conversas desse grupo para essa company
      const { error: updErr, count } = await supabase
        .from("conversas")
        .update({
          group_subject: subject,
          nome_contato: subject,
        }, { count: "exact" })
        .eq("company_id", company_id)
        .eq("is_group", true)
        .eq("numero", jid);

      if (updErr) {
        console.error("⚠️ Erro ao atualizar conversas do grupo:", jid, updErr);
      } else if (count) {
        updated += count;
      }
    }

    console.log("✅ [REFRESH-GROUPS] Concluído:", { cached, updated });

    return new Response(
      JSON.stringify({
        success: true,
        groups_processed: groups.length,
        cached,
        conversations_updated: updated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ [REFRESH-GROUPS] Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
