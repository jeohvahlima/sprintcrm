// v2 - redeploy para limpar BOOT_ERROR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_VERSION = 'v23.0';
const INSTAGRAM_API_BASE_URL = 'https://graph.instagram.com';
const META_API_BASE_URL = 'https://graph.facebook.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('📸 [INSTAGRAM-SEND] Payload recebido:', JSON.stringify({
      recipient_id: payload.recipient_id,
      company_id: payload.company_id,
      tipo: payload.tipo_mensagem || 'text',
      has_media_url: !!payload.media_url,
      has_mensagem: !!payload.mensagem,
    }));

    const { recipient_id, mensagem, company_id, tipo_mensagem, media_url } = payload;

    if (!recipient_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'recipient_id e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For text messages, mensagem is required. For media, media_url is required.
    const isMediaMessage = tipo_mensagem && tipo_mensagem !== 'text' && media_url;
    
    if (!mensagem && !isMediaMessage) {
      return new Response(
        JSON.stringify({ error: 'mensagem ou media_url é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configuração Instagram da empresa
    let { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('instagram_access_token, instagram_account_id, instagram_username, meta_access_token')
      .eq('company_id', company_id)
      .not('instagram_account_id', 'is', null)
      .limit(1)
      .maybeSingle();

    // Se não encontrou na empresa direta, buscar nas subcontas (empresa mãe usando token de subconta)
    if (!connection) {
      console.log('🔍 [INSTAGRAM-SEND] Conexão não encontrada na empresa direta, buscando nas subcontas...');
      const { data: subcontas } = await supabase
        .from('companies')
        .select('id')
        .eq('parent_company_id', company_id);

      if (subcontas && subcontas.length > 0) {
        const subIds = subcontas.map(s => s.id);
        const { data: subConnection } = await supabase
          .from('whatsapp_connections')
          .select('instagram_access_token, instagram_account_id, instagram_username, meta_access_token')
          .in('company_id', subIds)
          .not('instagram_account_id', 'is', null)
          .not('instagram_access_token', 'is', null)
          .limit(1)
          .maybeSingle();

        if (subConnection) {
          console.log('✅ [INSTAGRAM-SEND] Conexão Instagram encontrada via subconta');
          connection = subConnection;
        }
      }

      // Também tentar a empresa pai e empresas irmãs
      if (!connection) {
        const { data: parentCompany } = await supabase
          .from('companies')
          .select('parent_company_id')
          .eq('id', company_id)
          .maybeSingle();

        if (parentCompany?.parent_company_id) {
          // Tentar na empresa pai
          const { data: parentConnection } = await supabase
            .from('whatsapp_connections')
            .select('instagram_access_token, instagram_account_id, instagram_username, meta_access_token')
            .eq('company_id', parentCompany.parent_company_id)
            .not('instagram_account_id', 'is', null)
            .limit(1)
            .maybeSingle();

          if (parentConnection && (parentConnection.instagram_access_token || parentConnection.meta_access_token)) {
            console.log('✅ [INSTAGRAM-SEND] Conexão Instagram encontrada via empresa pai');
            connection = parentConnection;
          }

          // Se não encontrou no pai, buscar nas empresas irmãs (outras subcontas do mesmo pai)
          if (!connection) {
            const { data: siblings } = await supabase
              .from('companies')
              .select('id')
              .eq('parent_company_id', parentCompany.parent_company_id)
              .neq('id', company_id);

            if (siblings && siblings.length > 0) {
              const siblingIds = siblings.map(s => s.id);
              const { data: siblingConnection } = await supabase
                .from('whatsapp_connections')
                .select('instagram_access_token, instagram_account_id, instagram_username, meta_access_token')
                .in('company_id', siblingIds)
                .not('instagram_account_id', 'is', null)
                .limit(1)
                .maybeSingle();

              if (siblingConnection && (siblingConnection.instagram_access_token || siblingConnection.meta_access_token)) {
                console.log('✅ [INSTAGRAM-SEND] Conexão Instagram encontrada via empresa irmã');
                connection = siblingConnection;
              }
            }
          }
        }
      }
    }

    if (!connection) {
      console.error('❌ Conexão Instagram não encontrada em nenhuma empresa relacionada');
      return new Response(
        JSON.stringify({ error: 'Conexão Instagram não configurada para esta empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const igToken = connection.instagram_access_token;
    const metaToken = connection.meta_access_token;
    const accountId = connection.instagram_account_id;

    if (!igToken && !metaToken) {
      return new Response(
        JSON.stringify({ error: 'Token de acesso do Instagram não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📸 [INSTAGRAM-SEND] Enviando para:', recipient_id, 'account_id:', accountId, 'tipo:', tipo_mensagem || 'text');

    // Build message payload based on type
    let messagePayload: any;

    if (isMediaMessage) {
      // Instagram Messaging API supports: image, video, audio, file attachments
      // https://developers.facebook.com/docs/instagram-messaging/send-messages#send-attachments
      let attachmentType: string;
      
      switch (tipo_mensagem) {
        case 'image':
          attachmentType = 'image';
          break;
        case 'video':
          attachmentType = 'video';
          break;
        case 'audio':
          attachmentType = 'audio';
          break;
        case 'pdf':
        case 'document':
        default:
          attachmentType = 'file';
          break;
      }

      messagePayload = {
        recipient: { id: recipient_id },
        message: {
          attachment: {
            type: attachmentType,
            payload: {
              url: media_url,
              is_reusable: true,
            }
          }
        }
      };

      console.log('📎 [INSTAGRAM-SEND] Enviando mídia:', { attachmentType, media_url: media_url.substring(0, 80) });
    } else {
      // Text message
      messagePayload = {
        recipient: { id: recipient_id },
        message: { text: mensagem },
      };
    }

    const endpoints: Array<{ url: string; token: string; label: string }> = [];

    // Endpoint 1: Instagram Login API (graph.instagram.com) com IG User Access Token
    // Este é o endpoint OFICIAL para Instagram Messaging API (não-Facebook-linked)
    if (igToken && accountId) {
      endpoints.push({
        url: `${INSTAGRAM_API_BASE_URL}/${META_API_VERSION}/${accountId}/messages`,
        token: igToken,
        label: 'instagram-graph-with-account-id',
      });
    }
    if (igToken) {
      endpoints.push({
        url: `${INSTAGRAM_API_BASE_URL}/${META_API_VERSION}/me/messages`,
        token: igToken,
        label: 'instagram-graph-me',
      });
    }
    // Endpoint 2: Facebook Graph com Page Access Token (Instagram via Facebook Page)
    if (metaToken && accountId) {
      endpoints.push({
        url: `${META_API_BASE_URL}/${META_API_VERSION}/${accountId}/messages`,
        token: metaToken,
        label: 'facebook-graph-with-account-id',
      });
      endpoints.push({
        url: `${META_API_BASE_URL}/${META_API_VERSION}/me/messages`,
        token: metaToken,
        label: 'facebook-graph-me',
      });
    }

    let lastError: any = null;

    for (const ep of endpoints) {
      console.log('📸 [INSTAGRAM-SEND] Tentando endpoint:', ep.url);
      
      const response = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ep.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [INSTAGRAM-SEND] Mensagem enviada com sucesso via:', ep.url, data);
        
        // ⚡ CORREÇÃO ANTI-DUPLICAÇÃO: Salvar o message_id (mid) do Meta na mensagem do banco
        const messageId = data.message_id;
        const messageContent = mensagem || (tipo_mensagem === 'audio' ? '[Áudio]' : tipo_mensagem === 'image' ? '[Imagem]' : tipo_mensagem === 'video' ? '[Vídeo]' : '[Mídia]');
        
        if (messageId) {
          try {
            const { data: recentMsg, error: findErr } = await supabase
              .from('conversas')
              .select('id')
              .eq('company_id', company_id)
              .eq('fromme', true)
              .or(`numero.eq.${recipient_id},telefone_formatado.eq.${recipient_id}`)
              .is('whatsapp_message_id', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (recentMsg && !findErr) {
              await supabase
                .from('conversas')
                .update({ whatsapp_message_id: messageId })
                .eq('id', recentMsg.id);
              console.log('✅ [INSTAGRAM-SEND] whatsapp_message_id salvo:', messageId, 'para msg:', recentMsg.id);
            } else {
              console.log('⚠️ [INSTAGRAM-SEND] Não encontrou mensagem recente para vincular mid:', messageId);
            }
          } catch (updateErr) {
            console.error('⚠️ [INSTAGRAM-SEND] Erro ao salvar mid:', updateErr);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message_id: data.message_id,
            provider: 'instagram',
            data 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.warn('⚠️ [INSTAGRAM-SEND] Falha no endpoint:', ep.url, JSON.stringify(data));
      lastError = data;
    }

    console.error('❌ [INSTAGRAM-SEND] Todos os endpoints falharam. Último erro:', JSON.stringify(lastError));

    const errMsg = lastError?.error?.message || '';
    const errCode = lastError?.error?.code;
    const errSubcode = lastError?.error?.error_subcode;

    let userFriendly = 'Erro ao enviar mensagem via Instagram.';
    if (errCode === 100 && errSubcode === 33) {
      userFriendly = 'Token do Instagram inválido ou sem permissão para esta conta. Reconecte o Instagram nas configurações.';
    } else if (errCode === 3) {
      userFriendly = 'O app Meta não tem a capacidade "instagram_business_manage_messages" aprovada. Reconecte ou solicite a permissão no Meta Developer.';
    } else if (errSubcode === 2534014) {
      userFriendly = 'Destinatário não encontrado. A janela de 24h pode ter expirado ou o usuário não enviou mensagem recentemente.';
    } else if (errMsg) {
      userFriendly = errMsg;
    }

    return new Response(
      JSON.stringify({
        error: userFriendly,
        provider: 'instagram',
        needs_reconnect: errCode === 100 || errCode === 190 || errCode === 3,
        details: lastError,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Instagram Send - Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao enviar mensagem';
    return new Response(
      JSON.stringify({ error: errorMessage, provider: 'instagram' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
