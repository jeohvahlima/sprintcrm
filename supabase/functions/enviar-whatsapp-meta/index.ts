import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_VERSION = 'v18.0';
const META_API_BASE_URL = 'https://graph.facebook.com';

interface MetaMessagePayload {
  numero: string;
  mensagem?: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  company_id: string;
  template_name?: string;
  template_language?: string;
  template_components?: any[];
}

async function sendTextMessage(
  phoneNumberId: string, 
  accessToken: string, 
  to: string, 
  text: string
) {
  const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text }
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Meta API Error:', data);
    throw new Error(data.error?.message || 'Erro ao enviar mensagem via Meta API');
  }

  return data;
}

async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'audio' | 'document',
  caption?: string
) {
  const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
  
  const mediaPayload: any = {
    link: mediaUrl,
  };
  
  if (caption && (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')) {
    mediaPayload.caption = caption;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: mediaType,
      [mediaType]: mediaPayload
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Meta API Media Error:', data);
    throw new Error(data.error?.message || 'Erro ao enviar mídia via Meta API');
  }

  return data;
}

async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string = 'pt_BR',
  components?: any[]
) {
  const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
  
  const templatePayload: any = {
    name: templateName,
    language: { code: language },
  };
  
  if (components && components.length > 0) {
    templatePayload.components = components;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: templatePayload
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Meta API Template Error:', data);
    throw new Error(data.error?.message || 'Erro ao enviar template via Meta API');
  }

  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: MetaMessagePayload = await req.json();
    console.log('Meta API - Payload recebido:', JSON.stringify(payload, null, 2));

    const { numero, mensagem, media_url, media_type, company_id, template_name, template_language, template_components } = payload;

    if (!numero || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Número e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração Meta da empresa
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('meta_phone_number_id, meta_access_token, api_provider')
      .eq('company_id', company_id)
      .in('api_provider', ['meta', 'both'])
      .single();

    if (connError || !connection) {
      console.error('Erro ao buscar conexão Meta:', connError);
      return new Response(
        JSON.stringify({ error: 'Conexão Meta não configurada para esta empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { meta_phone_number_id, meta_access_token } = connection;

    if (!meta_phone_number_id || !meta_access_token) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Meta incompletas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar número (remover caracteres especiais, adicionar código do país se necessário)
    let formattedNumber = numero.replace(/[^0-9]/g, '');
    if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
      formattedNumber = '55' + formattedNumber;
    }

    let result;

    // Enviar template se especificado
    if (template_name) {
      console.log('Meta API - Enviando template:', template_name);
      result = await sendTemplateMessage(
        meta_phone_number_id,
        meta_access_token,
        formattedNumber,
        template_name,
        template_language || 'pt_BR',
        template_components
      );
    }
    // Enviar mídia se especificado
    else if (media_url && media_type) {
      console.log('Meta API - Enviando mídia:', media_type);
      result = await sendMediaMessage(
        meta_phone_number_id,
        meta_access_token,
        formattedNumber,
        media_url,
        media_type,
        mensagem
      );
    }
    // Enviar texto
    else if (mensagem) {
      console.log('Meta API - Enviando texto');
      result = await sendTextMessage(
        meta_phone_number_id,
        meta_access_token,
        formattedNumber,
        mensagem
      );
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Mensagem, mídia ou template são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meta API - Resposta:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messages?.[0]?.id,
        provider: 'meta',
        data: result 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Meta API - Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao enviar mensagem';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        provider: 'meta'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
