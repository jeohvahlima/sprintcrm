import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const targetCompanyId: string | undefined = body.company_id;

    let query = supabase
      .from("conversas")
      .select("company_id, telefone_formatado")
      .eq("origem", "Instagram")
      .not("telefone_formatado", "is", null);

    if (targetCompanyId) {
      query = query.eq("company_id", targetCompanyId);
    }

    const { data, error } = await query.limit(2000);
    if (error) throw error;

    // Filtrar apenas conversas com nome placeholder
    const { data: placeholders } = await supabase
      .from("conversas")
      .select("company_id, telefone_formatado, nome_contato")
      .eq("origem", "Instagram")
      .or("nome_contato.eq.Contato Instagram,nome_contato.like.Instagram %")
      .not("telefone_formatado", "is", null)
      .limit(2000);

    const seen = new Set<string>();
    const targets: Array<{ company_id: string; instagram_user_id: string }> = [];
    for (const row of placeholders || []) {
      const key = `${row.company_id}|${row.telefone_formatado}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (targetCompanyId && row.company_id !== targetCompanyId) continue;
      targets.push({
        company_id: row.company_id as string,
        instagram_user_id: row.telefone_formatado as string,
      });
    }

    const results: Array<{ id: string; resolved: string | null }> = [];
    const resolveUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/resolve-instagram-name`;
    const auth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

    // Processar em série para não estourar rate-limit do Graph API
    for (const t of targets) {
      try {
        const res = await fetch(resolveUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({
            company_id: t.company_id,
            instagram_user_id: t.instagram_user_id,
          }),
        });
        const json = await res.json();
        results.push({ id: t.instagram_user_id, resolved: json?.name ?? null });
      } catch (e) {
        results.push({ id: t.instagram_user_id, resolved: null });
      }
      // pequena pausa para evitar throttle
      await new Promise((r) => setTimeout(r, 120));
    }

    return new Response(
      JSON.stringify({
        processed: targets.length,
        resolved: results.filter((r) => r.resolved).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("backfill-instagram-names error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
