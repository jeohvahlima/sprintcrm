import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_APP_ID = Deno.env.get('META_APP_ID') || '';
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';

// URL pública pra onde o usuário volta depois da troca do token
const APP_RETURN_URL = 'https://app.wazecrm.online/configuracoes';

function htmlRedirect(url: string, message: string) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectando...</title>
     <meta http-equiv="refresh" content="2;url=${url}">
     <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center}div{max-width:500px;padding:24px}</style>
     </head><body><div><h2>${message}</h2><p>Redirecionando para <a href="${url}" style="color:#60a5fa">${url}</a>...</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // URL exata usada na autorização (precisa bater com a registrada no Meta)
  const REDIRECT_URI = `${url.origin}${url.pathname}`;

  console.log('[meta-oauth-callback] redirect_uri:', REDIRECT_URI);
  console.log('[meta-oauth-callback] has code:', !!code, 'state:', stateRaw);

  if (errorParam) {
    return htmlRedirect(
      `${APP_RETURN_URL}?meta_error=${encodeURIComponent(errorDescription || errorParam)}`,
      'Conexão cancelada ou negada'
    );
  }

  if (!code || !stateRaw) {
    return htmlRedirect(
      `${APP_RETURN_URL}?meta_error=missing_code_or_state`,
      'Parâmetros ausentes'
    );
  }

  let companyId: string | null = null;
  let scope: string = 'all';
  try {
    const decoded = JSON.parse(atob(stateRaw));
    companyId = decoded.companyId;
    scope = decoded.scope || 'all';
  } catch (e) {
    console.error('[meta-oauth-callback] invalid state:', e);
    return htmlRedirect(`${APP_RETURN_URL}?meta_error=invalid_state`, 'Estado inválido');
  }

  if (!companyId) {
    return htmlRedirect(`${APP_RETURN_URL}?meta_error=no_company`, 'Empresa não identificada');
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    console.error('[meta-oauth-callback] missing META_APP_ID/META_APP_SECRET');
    return htmlRedirect(`${APP_RETURN_URL}?meta_error=app_not_configured`, 'App Meta não configurado');
  }

  try {
    // 1) Trocar code por short-lived token (Facebook Login)
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${META_APP_ID}` +
      `&client_secret=${META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&code=${encodeURIComponent(code)}`;

    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();
    console.log('[meta-oauth-callback] token status:', tokenResp.status);

    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('[meta-oauth-callback] token error:', JSON.stringify(tokenData));
      return htmlRedirect(
        `${APP_RETURN_URL}?meta_error=${encodeURIComponent(tokenData.error?.message || 'token_exchange_failed')}`,
        'Falha ao obter token'
      );
    }

    let accessToken = tokenData.access_token as string;
    let expiresIn = tokenData.expires_in || 3600;

    // 2) Trocar por long-lived token (60 dias)
    try {
      const llUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${accessToken}`;
      const llResp = await fetch(llUrl);
      const llData = await llResp.json();
      if (llResp.ok && llData.access_token) {
        accessToken = llData.access_token;
        expiresIn = llData.expires_in || 5184000;
      }
    } catch (e) {
      console.warn('[meta-oauth-callback] long-lived exchange failed:', e);
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3) Buscar informações básicas do usuário e páginas
    let pages: any[] = [];
    try {
      const pagesResp = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
      );
      const pagesData = await pagesResp.json();
      pages = pagesData.data || [];
      console.log('[meta-oauth-callback] pages found:', pages.length);
    } catch (e) {
      console.warn('[meta-oauth-callback] pages fetch failed:', e);
    }

    const firstPage = pages[0];
    const igAccount = firstPage?.instagram_business_account;

    // 4) Salvar em tenant_integrations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const integrationData: Record<string, any> = {
      meta_access_token: accessToken,
      meta_token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    };

    if (firstPage) {
      integrationData.messenger_page_id = firstPage.id;
      integrationData.messenger_page_name = firstPage.name;
      integrationData.messenger_page_access_token = firstPage.access_token;
      integrationData.messenger_status = 'connected';
    }

    if (igAccount) {
      integrationData.instagram_ig_id = igAccount.id;
      integrationData.instagram_username = igAccount.username;
      integrationData.instagram_status = 'connected';
    }

    const { data: existing } = await supabase
      .from('tenant_integrations')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existing) {
      await supabase.from('tenant_integrations').update(integrationData).eq('id', existing.id);
    } else {
      await supabase.from('tenant_integrations').insert({ company_id: companyId, ...integrationData });
    }

    return htmlRedirect(
      `${APP_RETURN_URL}?meta_connected=1&scope=${encodeURIComponent(scope)}`,
      '✅ Conectado com sucesso!'
    );
  } catch (err: any) {
    console.error('[meta-oauth-callback] fatal:', err);
    return htmlRedirect(
      `${APP_RETURN_URL}?meta_error=${encodeURIComponent(err.message || 'unknown')}`,
      'Erro ao processar conexão'
    );
  }
});
