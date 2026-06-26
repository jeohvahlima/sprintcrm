// follow-abandono-scan — roda a cada 1h
// Atualiza cache da IA Coach para leads em risco com cache expirado.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const summary = { analisados: 0, caches_atualizados: 0, erros: 0 };

  try {
    const { data: leads } = await admin
      .from("leads")
      .select(
        "id, name, company_id, telefone, phone, responsavel_id, last_interaction_at, last_lead_reply_at, last_movement_at, follow_step, etapa_id",
      )
      .not("etapa_id", "is", null)
      .order("last_interaction_at", { ascending: true, nullsFirst: true })
      .limit(50);

    for (const lead of leads ?? []) {
      summary.analisados++;

      const { data: cache } = await admin
        .from("lead_coach_cache")
        .select("expires_at")
        .eq("lead_id", lead.id)
        .maybeSingle();

      const cacheExpirado = !cache || new Date(cache.expires_at) < new Date();
      const horasSemResposta = lead.last_lead_reply_at
        ? (Date.now() - new Date(lead.last_lead_reply_at).getTime()) / 3_600_000
        : 9999;

      if (!cacheExpirado || horasSemResposta < 24) continue;

      try {
        const { data: analise } = await admin.functions.invoke("lead-coach-analyze", {
          body: { lead_id: lead.id, company_id: lead.company_id },
        });
        if (analise?.report) summary.caches_atualizados++;
      } catch (e: any) {
        summary.erros++;
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
