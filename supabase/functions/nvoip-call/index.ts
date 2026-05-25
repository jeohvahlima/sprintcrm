import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NVOIP_BASE = "https://api.nvoip.com.br/v2";
const NVOIP_BASIC_AUTH = "Basic TnZvaXBBcGlWMjpUblp2YVhCQmNHbFdNakl3TWpFPQ==";

// Cache token per (NumberSIP + User Token) combo
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessTokenFor(username: string, password: string): Promise<string> {
  const key = `${username}:${password}`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&grant_type=password`;
  const res = await fetch(`${NVOIP_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": NVOIP_BASIC_AUTH,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth Nvoip falhou (${res.status}): verifique o NumberSIP e o User Token da sua conta Nvoip. Detalhe: ${text}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth: resposta sem access_token: ${JSON.stringify(data)}`);
  }
  const ttl = Math.max(60, (Number(data.expires_in) || 3600) - 60);
  tokenCache.set(key, {
    token: data.access_token,
    expiresAt: Date.now() + ttl * 1000,
  });
  return data.access_token;
}

async function resolveCreds(supabase: any, companyId: string) {
  const { data: cfg } = await supabase
    .from("nvoip_config")
    .select("number_sip, user_token, napikey, login_email, caller_number")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  const numberSip = cfg?.number_sip || Deno.env.get("NVOIP_NUMBER_SIP") || "137715001";
  const userToken = cfg?.user_token || Deno.env.get("NVOIP_USER_TOKEN");
  const napikey = cfg?.napikey || Deno.env.get("NVOIP_NAPIKEY");
  const loginEmail = cfg?.login_email || Deno.env.get("NVOIP_LOGIN_EMAIL");
  const callerNumber = cfg?.caller_number || Deno.env.get("NVOIP_CALLER_NUMBER");
  if (!numberSip || !userToken) {
    throw new Error("Conta Nvoip não conectada. Configure NumberSIP e User Token em Call Center → Conta Telefônica.");
  }
  return { numberSip, userToken, napikey, loginEmail, callerNumber };
}

async function getAccessToken(supabase?: any, companyId?: string): Promise<{ token: string; napikey?: string }> {
  if (supabase && companyId) {
    const { numberSip, userToken, napikey } = await resolveCreds(supabase, companyId);
    return { token: await getAccessTokenFor(numberSip, userToken), napikey };
  }
  const userToken = Deno.env.get("NVOIP_USER_TOKEN");
  const numberSip = Deno.env.get("NVOIP_NUMBER_SIP");
  if (!userToken || !numberSip) throw new Error("NVOIP_NUMBER_SIP/NVOIP_USER_TOKEN not configured");
  return { token: await getAccessTokenFor(numberSip, userToken), napikey: Deno.env.get("NVOIP_NAPIKEY") };
}

async function makeCall(caller: string, called: string, supabase: any, companyId: string): Promise<any> {
  const { token, napikey } = await getAccessToken(supabase, companyId);
  const res = await fetch(`${NVOIP_BASE}/calls/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ caller, called, napikey }),
  });
  if (!res.ok) throw new Error(`make-call failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

async function checkCall(callId: string, supabase: any, companyId: string): Promise<any> {
  const { token } = await getAccessToken(supabase, companyId);
  const res = await fetch(`${NVOIP_BASE}/calls?callId=${callId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`check-call failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

async function endCallApi(callId: string, supabase: any, companyId: string): Promise<any> {
  const { token } = await getAccessToken(supabase, companyId);
  const res = await fetch(`${NVOIP_BASE}/endcall?callId=${callId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`end-call failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Resolve company_id once
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = userRole?.company_id;
    if (!companyId) throw new Error("Company not found");

    // Admin client for writes (bypass RLS recursion edge cases)
    const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, adminKey);

    let result: any;

    switch (action) {
      case "make-call": {
        const { caller, called } = body;
        if (!caller || !called) throw new Error("caller and called are required");
        result = await makeCall(caller, called, supabase, companyId);
        break;
      }
      case "check-call": {
        const { callId } = body;
        if (!callId) throw new Error("callId is required");
        result = await checkCall(callId, supabase, companyId);
        break;
      }
      case "end-call": {
        const { callId } = body;
        if (!callId) throw new Error("callId is required");
        result = await endCallApi(callId, supabase, companyId);
        break;
      }
      case "get-config": {
        const { data: config } = await supabase
          .from("nvoip_config")
          .select("id, number_sip, napikey, login_email, is_active, user_token")
          .eq("company_id", companyId)
          .maybeSingle();
        // Mask token in response
        const safe = config ? { ...config, user_token: config.user_token ? "••••••••" : null, has_token: !!config.user_token } : null;
        result = { config: safe, company_id: companyId };
        break;
      }
      case "save-config": {
        const { number_sip, user_token, napikey, login_email } = body;
        if (!number_sip) throw new Error("number_sip é obrigatório");
        if (!user_token || user_token === "••••••••") {
          const { userToken } = await resolveCreds(supabase, companyId);
          if (!userToken) throw new Error("User Token da conta Nvoip é obrigatório");
        } else {
          await getAccessTokenFor(number_sip, user_token);
        }

        const payload: any = {
          company_id: companyId,
          number_sip,
          napikey: napikey ?? null,
          login_email: login_email ?? null,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        // Only overwrite token if a new one was provided
        if (user_token && user_token !== "••••••••") payload.user_token = user_token;

        const { error: upErr } = await admin
          .from("nvoip_config")
          .upsert(payload, { onConflict: "company_id" });
        if (upErr) throw upErr;
        result = { success: true };
        break;
      }
      case "test-connection": {
        const { numberSip, userToken } = await resolveCreds(supabase, companyId);
        await getAccessTokenFor(numberSip, userToken);
        result = { success: true, numberSip };
        break;
      }
      case "account-info": {
        const { numberSip } = await resolveCreds(supabase, companyId);
        const { token } = await getAccessToken(supabase, companyId);
        // Buscar saldo da conta (endpoint público da API v2)
        let balance: any = null;
        let balanceError: string | null = null;
        try {
          const balRes = await fetch(`${NVOIP_BASE}/balance`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (balRes.ok) {
            balance = await balRes.json();
          } else {
            balanceError = `HTTP ${balRes.status}`;
          }
        } catch (e: any) {
          balanceError = e.message;
        }
        result = {
          success: true,
          connected: true,
          numberSip,
          balance,
          balanceError,
          tokenIssuedAt: new Date().toISOString(),
        };
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("nvoip-call error:", error);
    const message = error.message || "Internal error";
    const isExpectedNvoipError =
      message.includes("OAuth Nvoip falhou") ||
      message.includes("Conta Nvoip") ||
      message.includes("NumberSIP") ||
      message.includes("obrigatór");

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: isExpectedNvoipError ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
