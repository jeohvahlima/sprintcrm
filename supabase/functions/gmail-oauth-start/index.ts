import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID') || Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    if (!clientId) throw new Error('Credenciais do Gmail não configuradas');

    const { company_id, redirect_uri } = await req.json();
    if (!company_id || !redirect_uri) throw new Error('company_id e redirect_uri são obrigatórios');

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('Usuário não autenticado');

    const { data: role, error: roleError } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', userData.user.id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (roleError || !role) throw new Error('Usuário sem permissão para esta empresa');

    const state = btoa(JSON.stringify({ company_id, uid: userData.user.id, ts: Date.now() }));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return new Response(JSON.stringify({ auth_url: url.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('❌ [GMAIL-OAUTH-START] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});