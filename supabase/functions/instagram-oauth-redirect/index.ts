import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const INSTAGRAM_APP_ID = '1353481286527361';
const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || '';
const DEFAULT_RETURN_URL = 'https://app.wazecrm.online/configuracoes';

function htmlRedirect(url: string, message: string) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Conectando Instagram...</title><meta http-equiv="refresh" content="2;url=${url}"><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;text-align:center}div{max-width:520px;padding:24px}a{color:#60a5fa}</style></head><body><div><h2>${message}</h2><p>Redirecionando para <a href="${url}">${url}</a>...</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code')?.replace(/#_$/, '').trim();
  const stateRaw = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const redirectUri = `${url.origin}${url.pathname}`;

  let companyId: string | null = null;
  let returnUrl = DEFAULT_RETURN_URL;

  if (stateRaw) {
    try {
      const decoded = JSON.parse(atob(stateRaw));
      companyId = decoded.companyId || null;
      returnUrl = decoded.returnUrl || DEFAULT_RETURN_URL;
    } catch (error) {
      console.error('[instagram-oauth-redirect] invalid state:', error);
      return htmlRedirect(`${DEFAULT_RETURN_URL}?instagram_error=invalid_state`, 'Estado inválido');
    }
  }

  if (errorParam) {
    return htmlRedirect(
      `${returnUrl}?instagram_error=${encodeURIComponent(errorDescription || errorParam)}`,
      'Conexão cancelada ou negada'
    );
  }

  if (!code || !companyId) {
    return htmlRedirect(
      `${returnUrl}?instagram_error=missing_code_or_company`,
      'Parâmetros ausentes para concluir a conexão'
    );
  }

  if (!INSTAGRAM_APP_SECRET) {
    return htmlRedirect(
      `${returnUrl}?instagram_error=app_not_configured`,
      'App do Instagram não configurado'
    );
  }

  try {
    const formData = new FormData();
    formData.append('client_id', INSTAGRAM_APP_ID);
    formData.append('client_secret', INSTAGRAM_APP_SECRET);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', redirectUri);
    formData.append('code', code);

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: formData,
    });

    const tokenText = await tokenResponse.text();
    const tokenData = JSON.parse(tokenText);

    if (!tokenResponse.ok || tokenData.error_type || tokenData.error) {
      console.error('[instagram-oauth-redirect] token exchange failed:', tokenText);
      return htmlRedirect(
        `${returnUrl}?instagram_error=${encodeURIComponent(tokenData.error_message || tokenData.error?.message || 'token_exchange_failed')}`,
        'Falha ao trocar o código por token'
      );
    }

    let accessToken = '';
    let instagramUserId = '';

    if (tokenData.data && Array.isArray(tokenData.data) && tokenData.data.length > 0) {
      accessToken = tokenData.data[0].access_token;
      instagramUserId = tokenData.data[0].user_id;
    } else {
      accessToken = tokenData.access_token;
      instagramUserId = tokenData.user_id;
    }

    let expiresIn = 3600;
    try {
      const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${accessToken}`;
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedData = await longLivedResponse.json();

      if (longLivedResponse.ok && longLivedData.access_token) {
        accessToken = longLivedData.access_token;
        expiresIn = longLivedData.expires_in || 5184000;
      }
    } catch (error) {
      console.warn('[instagram-oauth-redirect] long-lived exchange failed:', error);
    }

    let username = '';
    try {
      const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
      const profileData = await profileResponse.json();
      username = profileData.username || '';
    } catch (error) {
      console.warn('[instagram-oauth-redirect] profile fetch failed:', error);
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const integrationData = {
      instagram_ig_id: instagramUserId,
      instagram_username: username,
      instagram_status: 'connected',
      meta_access_token: accessToken,
      meta_token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    };

    const { data: existingIntegration } = await supabase
      .from('tenant_integrations')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingIntegration) {
      await supabase
        .from('tenant_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id);
    } else {
      await supabase
        .from('tenant_integrations')
        .insert({ company_id: companyId, ...integrationData });
    }

    const connectionData = {
      instagram_account_id: instagramUserId,
      instagram_access_token: accessToken,
    };

    const { data: existingConnection } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingConnection) {
      await supabase
        .from('whatsapp_connections')
        .update(connectionData)
        .eq('id', existingConnection.id);
    } else {
      await supabase
        .from('whatsapp_connections')
        .insert({
          company_id: companyId,
          instance_name: `INSTAGRAM_${companyId.slice(0, 8).toUpperCase()}`,
          api_provider: 'meta',
          status: 'connected',
          ...connectionData,
        });
    }

    return htmlRedirect(
      `${returnUrl}?instagram_connected=1&username=${encodeURIComponent(username)}`,
      '✅ Instagram conectado com sucesso!'
    );
  } catch (error: any) {
    console.error('[instagram-oauth-redirect] fatal:', error);
    return htmlRedirect(
      `${returnUrl}?instagram_error=${encodeURIComponent(error.message || 'unknown')}`,
      'Erro ao processar conexão do Instagram'
    );
  }
});