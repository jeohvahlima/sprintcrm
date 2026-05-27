import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function parseResponseSafely(response: Response) {
  const text = await response.text();

  try {
    return { data: text ? JSON.parse(text) : null, text };
  } catch {
    return { data: { raw: text.substring(0, 500) }, text };
  }
}

async function callEvolution(baseUrl: string, instanceName: string, apiKey: string, path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown) {
  const response = await fetch(`${baseUrl}${path}/${instanceName}`, {
    method,
    headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const parsed = await parseResponseSafely(response);
  return { response, ...parsed };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { instanceName } = await req.json();

    if (!instanceName) {
      return new Response(JSON.stringify({ error: 'instanceName é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: conn, error: connErr } = await supabase
      .from('whatsapp_connections')
      .select('evolution_api_url, evolution_api_key, instance_name')
      .eq('instance_name', instanceName)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: 'Conexão não encontrada', details: connErr }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const baseUrl = (conn.evolution_api_url || Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const configuredApiKey = conn.evolution_api_key || '';
    const globalApiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const apiKeys = [configuredApiKey, globalApiKey].filter((value, index, list) => !!value && list.indexOf(value) === index);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-conversas?instance=${instanceName}`;

    if (!baseUrl || apiKeys.length === 0) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada corretamente' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔗 [CONFIGURE-WEBHOOK] Base URL:', baseUrl);
    console.log('🔗 [CONFIGURE-WEBHOOK] Webhook URL:', webhookUrl);

    let currentWebhook = null;
    let activeApiKey = apiKeys[0];

    for (const candidateKey of apiKeys) {
      const currentAttempt = await callEvolution(baseUrl, instanceName, candidateKey, '/webhook/find', 'GET');
      currentWebhook = currentAttempt.data;

      if (currentAttempt.response.ok || currentAttempt.response.status !== 401) {
        activeApiKey = candidateKey;
        break;
      }
    }

    const ALL_EVENTS = [
      'APPLICATION_STARTUP',
      'CALL',
      'CHATS_DELETE',
      'CHATS_SET',
      'CHATS_UPDATE',
      'CHATS_UPSERT',
      'CONNECTION_UPDATE',
      'CONTACTS_SET',
      'CONTACTS_UPDATE',
      'CONTACTS_UPSERT',
      'GROUP_PARTICIPANTS_UPDATE',
      'GROUP_UPDATE',
      'GROUPS_UPSERT',
      'LABELS_ASSOCIATION',
      'LABELS_EDIT',
      'LOGOUT_INSTANCE',
      'MESSAGES_DELETE',
      'MESSAGES_SET',
      'MESSAGES_UPDATE',
      'MESSAGES_UPSERT',
      'PRESENCE_UPDATE',
      'QRCODE_UPDATED',
      'REMOVE_INSTANCE',
      'SEND_MESSAGE',
      'TYPEBOT_CHANGE_STATUS',
      'TYPEBOT_START',
    ];

    const webhookPayload = {
      webhook: {
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: ALL_EVENTS,
        enabled: true,
      }
    };

    console.log('📤 [CONFIGURE-WEBHOOK] Enviando config:', JSON.stringify(webhookPayload));

    let setAttempt = await callEvolution(baseUrl, instanceName, activeApiKey, '/webhook/set', 'POST', webhookPayload);

    if (!setAttempt.response.ok) {
      console.log('🔄 [CONFIGURE-WEBHOOK] Tentando formato alternativo...');
      setAttempt = await callEvolution(baseUrl, instanceName, activeApiKey, '/webhook/set', 'PUT', webhookPayload);
    }

    let verifyWebhook = null;
    try {
      const verifyAttempt = await callEvolution(baseUrl, instanceName, activeApiKey, '/webhook/find', 'GET');
      verifyWebhook = verifyAttempt.data;
    } catch (error) {
      console.warn('⚠️ [CONFIGURE-WEBHOOK] Erro na verificação:', error);
    }

    return new Response(JSON.stringify({
      success: setAttempt.response.ok,
      currentWebhook,
      setResult: setAttempt.data,
      verifyWebhook,
      webhookUrl,
      usedGlobalApiKeyFallback: activeApiKey === globalApiKey && globalApiKey !== configuredApiKey,
      status: setAttempt.response.status,
    }), {
      status: setAttempt.response.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ [CONFIGURE-WEBHOOK] Erro:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});