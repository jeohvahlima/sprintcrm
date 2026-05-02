// Recebe o code do OAuth, troca por tokens e salva em google_calendar_integrations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("Google OAuth not configured");

    const { code, redirect_uri, state } = await req.json();
    if (!code || !redirect_uri) throw new Error("code and redirect_uri required");

    // Validar usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    // Trocar code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[oauth-callback] token error", tokens);
      throw new Error(tokens.error_description || tokens.error || "Failed to exchange code");
    }

    // Buscar info do usuário Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    // company_id
    const { data: ur } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    // Upsert
    const { error: upsertErr } = await supabase
      .from("google_calendar_integrations")
      .upsert(
        {
          user_id: userId,
          company_id: ur?.company_id ?? null,
          google_email: userInfo.email,
          google_user_id: userInfo.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token, // só vem com prompt=consent
          token_expires_at: expiresAt,
          scope: tokens.scope,
          calendar_id: "primary",
          active: true,
        },
        { onConflict: "user_id" }
      );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ success: true, email: userInfo.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[gcal-oauth-callback]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
