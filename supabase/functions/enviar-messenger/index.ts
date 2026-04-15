import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, company_id, media_url, media_type } = await req.json();

    if (!to || !company_id) {
      return new Response(JSON.stringify({ error: 'to and company_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📘 [MESSENGER-SEND] Enviando para:', to, 'company:', company_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar Page Access Token da tenant_integrations
    const { data: tenantConfig } = await supabase
      .from('tenant_integrations')
      .select('messenger_page_id, messenger_page_access_token')
      .eq('company_id', company_id)
      .single();

    if (!tenantConfig?.messenger_page_access_token) {
      console.error('❌ [MESSENGER-SEND] Token não encontrado para company:', company_id);
      return new Response(JSON.stringify({ error: 'Messenger not configured for this company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pageAccessToken = tenantConfig.messenger_page_access_token;
    const pageId = tenantConfig.messenger_page_id;

    // Construir payload de mensagem
    let messagePayload: any = {
      recipient: { id: to },
      messaging_type: 'RESPONSE',
    };

    if (media_url && media_type) {
      // Enviar mídia
      const fbMediaType = media_type === 'image' ? 'image' 
        : media_type === 'video' ? 'video'
        : media_type === 'audio' ? 'audio'
        : 'file';
      
      messagePayload.message = {
        attachment: {
          type: fbMediaType,
          payload: { url: media_url, is_reusable: true }
        }
      };
    } else {
      // Enviar texto
      messagePayload.message = { text: message };
    }

    console.log('📘 [MESSENGER-SEND] Payload:', JSON.stringify(messagePayload));

    // Enviar via Graph API
    const sendUrl = `https://graph.facebook.com/v23.0/${pageId}/messages?access_token=${pageAccessToken}`;
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [MESSENGER-SEND] Erro da API:', result);
      return new Response(JSON.stringify({ error: 'Failed to send message', details: result }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [MESSENGER-SEND] Mensagem enviada:', result.message_id);

    // Salvar mensagem enviada na tabela conversas
    const { data: savedMsg, error: saveError } = await supabase
      .from('conversas')
      .insert({
        numero: to,
        telefone_formatado: to,
        mensagem: message || '[mídia]',
        tipo_mensagem: media_type || 'text',
        midia_url: media_url || null,
        fromme: true,
        status: 'sent',
        origem: 'Messenger',
        origem_api: 'meta',
        company_id: company_id,
        whatsapp_message_id: result.message_id || null,
        read: true,
        delivered: false,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('❌ [MESSENGER-SEND] Erro ao salvar:', saveError);
    } else {
      console.log('✅ [MESSENGER-SEND] Salvo no banco:', savedMsg.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: result.message_id,
      db_id: savedMsg?.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [MESSENGER-SEND] Erro:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
