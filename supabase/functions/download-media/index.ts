import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Baixar mídia da Meta API
async function downloadMetaMedia(mediaId: string, accessToken: string, mimetype?: string) {
  console.log('🔓 [DOWNLOAD-MEDIA] Baixando mídia via Meta API');
  console.log('📡 [DOWNLOAD-MEDIA] Media ID:', mediaId);
  
  // Passo 1: Obter URL temporária da mídia
  const metaApiUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
  console.log('📞 [DOWNLOAD-MEDIA] Obtendo URL temporária:', metaApiUrl);
  
  const urlResponse = await fetch(metaApiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!urlResponse.ok) {
    const errorText = await urlResponse.text();
    console.error('❌ [DOWNLOAD-MEDIA] Erro ao obter URL Meta:', urlResponse.status, errorText);
    
    // Verificar se mídia expirou
    if (urlResponse.status === 400 || urlResponse.status === 404) {
      return {
        error: 'media_expired',
        message: 'Mídia expirada ou indisponível. Mídias do WhatsApp expiram após alguns dias.'
      };
    }
    throw new Error(`Erro ao obter URL da Meta API: ${urlResponse.status}`);
  }
  
  const urlData = await urlResponse.json();
  const mediaUrl = urlData.url;
  const mediaMimetype = urlData.mime_type || mimetype || 'application/octet-stream';
  
  console.log('✅ [DOWNLOAD-MEDIA] URL temporária obtida:', mediaUrl?.substring(0, 50) + '...');
  console.log('📋 [DOWNLOAD-MEDIA] MIME type:', mediaMimetype);
  
  if (!mediaUrl) {
    throw new Error('URL da mídia não retornada pela Meta API');
  }
  
  // Passo 2: Baixar o arquivo binário da URL temporária
  console.log('📥 [DOWNLOAD-MEDIA] Baixando arquivo binário...');
  
  const mediaResponse = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (!mediaResponse.ok) {
    const errorText = await mediaResponse.text();
    console.error('❌ [DOWNLOAD-MEDIA] Erro ao baixar mídia:', mediaResponse.status, errorText);
    throw new Error(`Erro ao baixar mídia da Meta: ${mediaResponse.status}`);
  }
  
  const arrayBuffer = await mediaResponse.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Converter para base64
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  console.log('✅ [DOWNLOAD-MEDIA] Mídia Meta baixada com sucesso, tamanho:', bytes.byteLength);
  
  return {
    base64: base64,
    mimetype: mediaMimetype,
  };
}

// Baixar mídia da Evolution API
async function downloadEvolutionMedia(
  messageId: string, 
  instanceName: string, 
  evolutionUrl: string, 
  evolutionApiKey: string,
  mediaType?: string,
  mimetype?: string
) {
  console.log('🔓 [DOWNLOAD-MEDIA] Baixando mídia via Evolution API');
  console.log('📡 [DOWNLOAD-MEDIA] MessageID:', messageId);
  console.log('🏢 [DOWNLOAD-MEDIA] Instance:', instanceName);
  
  const endpoint = `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
  
  console.log('📞 [DOWNLOAD-MEDIA] Chamando Evolution API:', endpoint);
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': evolutionApiKey,
    },
    body: JSON.stringify({
      message: {
        key: {
          id: messageId
        }
      },
      convertToMp4: mediaType === 'video'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [DOWNLOAD-MEDIA] Erro Evolution API:', response.status, errorText);

    // Detectar mídia expirada: 400/404, ou erros típicos do Evolution/Baileys
    const expiredIndicators = [
      'Failed to fetch stream',
      'ephemeralMessage',
      'mmg.whatsapp.net',
      'media not found',
      'expired',
    ];
    const isExpired =
      response.status === 400 ||
      response.status === 404 ||
      response.status === 410 ||
      expiredIndicators.some((s) => errorText.toLowerCase().includes(s.toLowerCase()));

    if (isExpired) {
      return {
        error: 'media_expired',
        message: 'Mídia expirada ou indisponível. Mídias do WhatsApp expiram após alguns dias.'
      };
    }
    throw new Error(`Erro ao baixar mídia da Evolution API: ${response.status}`);
  }

  const mediaData = await response.json();
  console.log('✅ [DOWNLOAD-MEDIA] Resposta Evolution API recebida');

  if (mediaData.base64) {
    let detectedMimetype = 'application/octet-stream';
    if (mediaData.base64.startsWith('data:')) {
      const match = mediaData.base64.match(/data:([^;]+);/);
      if (match) detectedMimetype = match[1];
    } else {
      if (mimetype) {
        detectedMimetype = mimetype;
      } else if (mediaType === 'image') {
        detectedMimetype = 'image/jpeg';
      } else if (mediaType === 'video') {
        detectedMimetype = 'video/mp4';
      } else if (mediaType === 'audio') {
        detectedMimetype = 'audio/ogg; codecs=opus';
      } else if (mediaType === 'document') {
        detectedMimetype = 'application/pdf';
      }
    }
    
    return {
      base64: mediaData.base64.includes(',') ? mediaData.base64.split(',')[1] : mediaData.base64,
      mimetype: detectedMimetype,
    };
  }
  
  throw new Error('Mídia não retornada pela Evolution API');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 [DOWNLOAD-MEDIA] Iniciando download de mídia...');

    const body = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!body.company_id) {
      throw new Error('company_id é obrigatório');
    }

    console.log('🏢 [DOWNLOAD-MEDIA] CompanyID:', body.company_id);
    
    // Detectar se é mídia Meta ou Evolution
    const isMetaMedia = body.source === 'meta' || body.media_id;
    
    if (isMetaMedia && body.media_id) {
      // Mídia da Meta API
      console.log('📱 [DOWNLOAD-MEDIA] Fonte: Meta API');
      
      // Buscar access_token da Meta
      const { data: whatsappConfig, error: configError } = await supabase
        .from('whatsapp_connections')
        .select('meta_access_token')
        .eq('company_id', body.company_id)
        .not('meta_access_token', 'is', null)
        .single();

      if (configError || !whatsappConfig?.meta_access_token) {
        console.error('❌ [DOWNLOAD-MEDIA] Access token Meta não encontrado:', configError);
        throw new Error('Configuração Meta API não encontrada');
      }

      const result = await downloadMetaMedia(
        body.media_id,
        whatsappConfig.meta_access_token,
        body.mimetype
      );
      
      if (result.error) {
        // Retornar 200 com error no body para que o client SDK não lance FunctionsHttpError
        return new Response(
          JSON.stringify(result),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else if (body.messageId) {
      // Mídia da Evolution API
      console.log('📱 [DOWNLOAD-MEDIA] Fonte: Evolution API');
      
      const { data: whatsappConfig, error: configError } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, evolution_api_url, evolution_api_key')
        .eq('company_id', body.company_id)
        .not('evolution_api_url', 'is', null)
        .limit(1)
        .single();

      if (configError || !whatsappConfig) {
        console.error('❌ [DOWNLOAD-MEDIA] Instância Evolution não encontrada:', configError);
        throw new Error('Instância WhatsApp não configurada');
      }

      console.log('✅ [DOWNLOAD-MEDIA] Instância encontrada:', whatsappConfig.instance_name);
      
      const result = await downloadEvolutionMedia(
        body.messageId,
        whatsappConfig.instance_name,
        whatsappConfig.evolution_api_url,
        whatsappConfig.evolution_api_key,
        body.type,
        body.mimetype
      );
      
      if (result.error) {
        return new Response(
          JSON.stringify(result),
          { 
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else {
      throw new Error('Parâmetros insuficientes: forneça media_id (Meta) ou messageId (Evolution)');
    }

  } catch (error) {
    console.error('❌ [DOWNLOAD-MEDIA] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
