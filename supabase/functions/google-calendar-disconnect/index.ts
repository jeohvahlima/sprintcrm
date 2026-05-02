// Revoga o acesso e remove a integração Google Calendar do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { data: integration } = await supabase
      .from("google_calendar_integrations")
      .select("refresh_token")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (integration?.refresh_token) {
      // Best-effort revoke
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${integration.refresh_token}`, {
          method: "POST",
        });
      } catch (e) {
        console.warn("[gcal-disconnect] revoke failed", e);
      }
    }

    await supabase
      .from("google_calendar_integrations")
      .delete()
      .eq("user_id", userData.user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[gcal-disconnect]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
