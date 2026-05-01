import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isBadInstagramName = (value: string | null | undefined, instagramUserId?: string) => {
  const name = String(value ?? "").trim();
  if (!name) return true;
  if (/^Contato\s+Instagram$/i.test(name)) return true;
  if (/^Instagram\s+\d+$/i.test(name)) return true;
  if (/^\d{10,}$/.test(name.replace(/^ig_/, ""))) return true;
  if (instagramUserId && name === instagramUserId) return true;
  return false;
};

// Token starting with "IGAA" => Instagram Business Login (use graph.instagram.com)
// Token starting with "EAA"  => Facebook user/page token (use graph.facebook.com)
const isIgBusinessToken = (token: string | null | undefined) => !!token && token.startsWith("IGAA");

interface IgConn {
  company_id: string;
  access_token: string;
  ig_account_id: string | null;
  is_ig_token: boolean;
}

const collectIgConnections = async (
  supabase: ReturnType<typeof createClient>,
  companyIds: string[],
): Promise<IgConn[]> => {
  if (companyIds.length === 0) return [];
  const out: IgConn[] = [];

  // 1) tenant_integrations (preferred — usually contains IGAA token)
  const { data: tenants } = await supabase
    .from("tenant_integrations")
    .select("company_id, instagram_ig_id, meta_access_token")
    .in("company_id", companyIds);
  for (const t of tenants ?? []) {
    if (t.meta_access_token) {
      out.push({
        company_id: t.company_id,
        access_token: t.meta_access_token,
        ig_account_id: t.instagram_ig_id ?? null,
        is_ig_token: isIgBusinessToken(t.meta_access_token),
      });
    }
  }

  // 2) whatsapp_connections (fallback)
  const { data: conns } = await supabase
    .from("whatsapp_connections")
    .select("company_id, instagram_account_id, instagram_access_token, meta_access_token")
    .in("company_id", companyIds);
  for (const c of conns ?? []) {
    const token = c.instagram_access_token || c.meta_access_token;
    if (token && c.instagram_account_id) {
      out.push({
        company_id: c.company_id,
        access_token: token,
        ig_account_id: c.instagram_account_id,
        is_ig_token: isIgBusinessToken(token),
      });
    }
  }

  // sort: IGAA tokens first
  out.sort((a, b) => Number(b.is_ig_token) - Number(a.is_ig_token));
  return out;
};

const findInstagramConnections = async (
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<IgConn[]> => {
  const ids = new Set<string>([companyId]);

  const { data: subcompanies } = await supabase
    .from("companies")
    .select("id")
    .eq("parent_company_id", companyId);
  subcompanies?.forEach((s: any) => ids.add(s.id));

  const { data: currentCompany } = await supabase
    .from("companies")
    .select("parent_company_id")
    .eq("id", companyId)
    .maybeSingle();

  if (currentCompany?.parent_company_id) {
    ids.add(currentCompany.parent_company_id);
    const { data: siblings } = await supabase
      .from("companies")
      .select("id")
      .eq("parent_company_id", currentCompany.parent_company_id);
    siblings?.forEach((s: any) => ids.add(s.id));
  }

  return collectIgConnections(supabase, Array.from(ids));
};

const persistResolvedName = async (
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  instagramUserId: string,
  resolvedName: string | null,
) => {
  if (isBadInstagramName(resolvedName, instagramUserId)) return;

  await Promise.all([
    supabase
      .from("conversas")
      .update({ nome_contato: resolvedName })
      .eq("company_id", companyId)
      .eq("telefone_formatado", instagramUserId),
    supabase
      .from("leads")
      .update({ name: resolvedName })
      .eq("company_id", companyId)
      .or(`telefone.eq.${instagramUserId},phone.eq.${instagramUserId}`),
  ]);
};

const tryResolveViaConnection = async (
  conn: IgConn,
  igUserId: string,
): Promise<string | null> => {
  const apiBase = conn.is_ig_token
    ? "https://graph.instagram.com/v23.0"
    : "https://graph.facebook.com/v23.0";
  const accountRef = conn.is_ig_token ? "me" : conn.ig_account_id;

  // Method 1: list conversations and find the participant with matching id
  if (accountRef) {
    try {
      const url = `${apiBase}/${accountRef}/conversations?platform=instagram&fields=participants&limit=50&access_token=${conn.access_token}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        for (const conversation of json.data ?? []) {
          const parts = conversation.participants?.data ?? [];
          const match = parts.find((p: any) => String(p.id) === String(igUserId));
          if (match) {
            // Prefer @username (matches Instagram UI), fallback to name
            return match.username || match.name || null;
          }
        }
      } else {
        const txt = await res.text();
        console.warn(`[resolve-ig] conv list failed (${res.status}): ${txt.substring(0, 200)}`);
      }
    } catch (e) {
      console.warn("[resolve-ig] conversations fetch error:", e);
    }
  }

  // Method 2: direct user lookup
  try {
    const url = `${apiBase}/${igUserId}?fields=name,username&access_token=${conn.access_token}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.username || data.name || null;
    } else {
      const txt = await res.text();
      console.warn(`[resolve-ig] user lookup failed (${res.status}): ${txt.substring(0, 200)}`);
    }
  } catch (e) {
    console.warn("[resolve-ig] user lookup error:", e);
  }

  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_id, instagram_user_id } = await req.json();

    if (!company_id || !instagram_user_id) {
      return new Response(JSON.stringify({ error: "Missing company_id or instagram_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Cache: any prior good name in conversas
    const { data: prevConv } = await supabase
      .from("conversas")
      .select("nome_contato")
      .eq("company_id", company_id)
      .eq("telefone_formatado", instagram_user_id)
      .not("nome_contato", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const goodCached = prevConv?.find((c: any) => !isBadInstagramName(c.nome_contato?.trim(), instagram_user_id));
    if (goodCached?.nome_contato) {
      await persistResolvedName(supabase, company_id, instagram_user_id, goodCached.nome_contato);
      return new Response(JSON.stringify({ name: goodCached.nome_contato, source: "cache" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Lead-based name
    const { data: lead } = await supabase
      .from("leads")
      .select("name")
      .eq("company_id", company_id)
      .or(`telefone.eq.${instagram_user_id},phone.eq.${instagram_user_id}`)
      .limit(1)
      .maybeSingle();

    if (lead?.name && !isBadInstagramName(lead.name.trim(), instagram_user_id)) {
      const n = lead.name.trim();
      await persistResolvedName(supabase, company_id, instagram_user_id, n);
      return new Response(JSON.stringify({ name: n, source: "lead" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Try every available IG connection (IGAA tokens first)
    const connections = await findInstagramConnections(supabase, company_id);

    if (connections.length === 0) {
      return new Response(JSON.stringify({ name: null, error: "No Instagram connection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedName: string | null = null;
    for (const conn of connections) {
      resolvedName = await tryResolveViaConnection(conn, instagram_user_id);
      if (resolvedName && !isBadInstagramName(resolvedName, instagram_user_id)) break;
      resolvedName = null;
    }

    if (resolvedName) {
      await persistResolvedName(supabase, company_id, instagram_user_id, resolvedName);
    }

    return new Response(
      JSON.stringify({ name: resolvedName, source: resolvedName ? "api" : null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
