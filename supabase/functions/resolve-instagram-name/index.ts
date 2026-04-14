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

const loadConnectionForCompanyIds = async (
  supabase: ReturnType<typeof createClient>,
  companyIds: string[],
) => {
  if (companyIds.length === 0) return null;

  const { data } = await supabase
    .from("whatsapp_connections")
    .select("company_id, instagram_access_token, meta_access_token, instagram_account_id")
    .in("company_id", companyIds)
    .not("instagram_account_id", "is", null)
    .limit(Math.max(companyIds.length, 1));

  return data?.find((connection: any) => connection.instagram_account_id && (connection.instagram_access_token || connection.meta_access_token)) ?? null;
};

const findInstagramConnection = async (
  supabase: ReturnType<typeof createClient>,
  companyId: string,
) => {
  const directConnection = await loadConnectionForCompanyIds(supabase, [companyId]);
  if (directConnection) return directConnection;

  const { data: subcompanies } = await supabase
    .from("companies")
    .select("id")
    .eq("parent_company_id", companyId);

  const subcompanyConnection = await loadConnectionForCompanyIds(
    supabase,
    subcompanies?.map((company: any) => company.id) ?? [],
  );
  if (subcompanyConnection) return subcompanyConnection;

  const { data: currentCompany } = await supabase
    .from("companies")
    .select("parent_company_id")
    .eq("id", companyId)
    .maybeSingle();

  if (!currentCompany?.parent_company_id) return null;

  const parentConnection = await loadConnectionForCompanyIds(supabase, [currentCompany.parent_company_id]);
  if (parentConnection) return parentConnection;

  const { data: siblingCompanies } = await supabase
    .from("companies")
    .select("id")
    .eq("parent_company_id", currentCompany.parent_company_id)
    .neq("id", companyId);

  return await loadConnectionForCompanyIds(
    supabase,
    siblingCompanies?.map((company: any) => company.id) ?? [],
  );
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check if we already have a good name in conversas
    const { data: prevConv } = await supabase
      .from("conversas")
      .select("nome_contato")
      .eq("company_id", company_id)
      .eq("telefone_formatado", instagram_user_id)
      .not("nome_contato", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (prevConv) {
      const goodName = prevConv.find((c: any) => {
        const n = c.nome_contato?.trim();
        return !isBadInstagramName(n, instagram_user_id);
      });
      if (goodName) {
        await persistResolvedName(supabase, company_id, instagram_user_id, goodName.nome_contato);
        return new Response(JSON.stringify({ name: goodName.nome_contato, source: "cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Check lead name
    const { data: lead } = await supabase
      .from("leads")
      .select("name")
      .eq("company_id", company_id)
      .or(`telefone.eq.${instagram_user_id},phone.eq.${instagram_user_id}`)
      .limit(1)
      .maybeSingle();

    if (lead?.name) {
      const n = lead.name.trim();
      if (!isBadInstagramName(n, instagram_user_id)) {
        await persistResolvedName(supabase, company_id, instagram_user_id, n);
        return new Response(JSON.stringify({ name: n, source: "lead" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Try Instagram Graph API
    const connection = await findInstagramConnection(supabase, company_id);

    if (!connection) {
      return new Response(JSON.stringify({ name: null, error: "No Instagram connection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = connection.meta_access_token || connection.instagram_access_token;
    const igAccountId = connection.instagram_account_id;
    let resolvedName: string | null = null;

    // Method 1: Conversations API
    try {
      const convUrl = `https://graph.facebook.com/v23.0/${igAccountId}/conversations?user_id=${instagram_user_id}&platform=instagram&fields=participants,name&access_token=${accessToken}`;
      const convRes = await fetch(convUrl);
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.data?.length > 0) {
          const conversation = convData.data[0];
          const participants = conversation.participants?.data || [];
          const other = participants.find((p: any) => p.id !== igAccountId);
          if (other?.username) resolvedName = other.username;
          else if (other?.name) resolvedName = other.name;
          else if (conversation.name) resolvedName = conversation.name;
        }
      }
    } catch (e) {
      console.warn("Conversations API failed:", e);
    }

    // Method 2: Direct user lookup
    if (!resolvedName) {
      try {
        const userUrl = `https://graph.facebook.com/v23.0/${instagram_user_id}?fields=name,username&access_token=${accessToken}`;
        const userRes = await fetch(userUrl);
        if (userRes.ok) {
          const userData = await userRes.json();
          resolvedName = userData.name || userData.username || null;
        }
      } catch (e) {
        console.warn("User lookup failed:", e);
      }
    }

    // Update database if resolved
    if (!isBadInstagramName(resolvedName, instagram_user_id)) {
      await persistResolvedName(supabase, company_id, instagram_user_id, resolvedName);
    }

    return new Response(
      JSON.stringify({ name: isBadInstagramName(resolvedName, instagram_user_id) ? null : resolvedName, source: resolvedName ? "api" : null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
