// v2 - redeploy para limpar BOOT_ERROR
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verificar assinatura do webhook do Meta
async function verifyWebhookSignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature || !appSecret) {
    console.warn('Assinatura ou App Secret não fornecidos');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const computedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}

// Construir JSON estruturado para mídia Meta API
function buildMetaMediaJson(mediaId: string, mimeType?: string, sha256?: string, fileName?: string, fileSize?: number) {
  return JSON.stringify({
    media_id: mediaId,
    source: 'meta',
    mimetype: mimeType || null,
    sha256: sha256 || null,
    file_name: fileName || null,
    file_size: fileSize || null, // Tamanho do arquivo em bytes (se disponível)
  });
}

function mapMetaDeliveryStatusToConversationUpdate(status: any) {
  const normalizedStatus = String(status?.status || '').toLowerCase();
  const baseUpdate = {
    updated_at: new Date().toISOString(),
  };

  switch (normalizedStatus) {
    case 'sent':
      return { ...baseUpdate, status: 'Processando', delivered: false, read: false };
    case 'delivered':
      return { ...baseUpdate, status: 'Entregue', delivered: true, read: false };
    case 'read':
      return { ...baseUpdate, status: 'Lida', delivered: true, read: true };
    case 'failed':
      return { ...baseUpdate, status: 'Falhou', delivered: false, read: false };
    default:
      return { ...baseUpdate, status: normalizedStatus || 'Processando' };
  }
}

// Buscar e reconstruir o texto completo do template
async function getTemplateContent(
  supabase: any, 
  templateName: string, 
  templateComponents: any[], 
  companyId?: string
): Promise<string> {
  try {
    // Buscar definição do template no banco de dados
    let query = supabase
      .from('whatsapp_templates')
      .select('name, components, status')
      .eq('name', templateName);
    
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    
    const { data: templates } = await query.limit(1);
    
    if (!templates || templates.length === 0) {
      console.log('⚠️ Template não encontrado no banco:', templateName);
      // Fallback: usar os parâmetros disponíveis
      return buildTemplateContentFromParams(templateName, templateComponents);
    }
    
    const templateDef = templates[0];
    const components = templateDef.components || [];
    
    // Extrair parâmetros enviados
    const bodyParams: string[] = [];
    const headerParams: string[] = [];
    
    for (const comp of templateComponents || []) {
      if (comp.type === 'body' && comp.parameters) {
        comp.parameters.forEach((p: any) => bodyParams.push(p.text || ''));
      }
      if (comp.type === 'header' && comp.parameters) {
        comp.parameters.forEach((p: any) => headerParams.push(p.text || ''));
      }
    }
    
    let fullText = '';
    
    // Processar HEADER
    const headerDef = components.find((c: any) => c.type === 'HEADER');
    if (headerDef?.text) {
      let headerText = headerDef.text;
      headerParams.forEach((val, idx) => {
        headerText = headerText.replace(`{{${idx + 1}}}`, val);
      });
      fullText += `*${headerText}*\n\n`;
    }
    
    // Processar BODY
    const bodyDef = components.find((c: any) => c.type === 'BODY');
    if (bodyDef?.text) {
      let bodyText = bodyDef.text;
      bodyParams.forEach((val, idx) => {
        bodyText = bodyText.replace(`{{${idx + 1}}}`, val);
      });
      fullText += bodyText;
    }
    
    // Processar FOOTER
    const footerDef = components.find((c: any) => c.type === 'FOOTER');
    if (footerDef?.text) {
      fullText += `\n\n_${footerDef.text}_`;
    }
    
    // Processar BUTTONS
    const buttonsDef = components.find((c: any) => c.type === 'BUTTONS');
    if (buttonsDef?.buttons && buttonsDef.buttons.length > 0) {
      fullText += '\n\n';
      buttonsDef.buttons.forEach((btn: any) => {
        fullText += `↪ ${btn.text}\n`;
      });
    }
    
    return fullText.trim() || `[Template: ${templateName}]`;
  } catch (error) {
    console.error('❌ Erro ao buscar template:', error);
    return buildTemplateContentFromParams(templateName, templateComponents);
  }
}

// Fallback: construir conteúdo a partir dos parâmetros
function buildTemplateContentFromParams(templateName: string, templateComponents: any[]): string {
  let content = '';
  for (const comp of templateComponents || []) {
    if (comp.type === 'body' && comp.parameters) {
      const texts = comp.parameters.map((p: any) => p.text || '').filter(Boolean);
      if (texts.length > 0) {
        content = texts.join(' ');
      }
    }
    if (comp.type === 'header' && comp.parameters) {
      const texts = comp.parameters.map((p: any) => p.text || '').filter(Boolean);
      if (texts.length > 0) {
        content = `*${texts.join(' ')}*\n\n` + content;
      }
    }
  }
  return content || `[Template: ${templateName}]`;
}

// Transformar payload do WhatsApp Meta para formato interno
function transformWhatsAppPayload(entry: any) {
  const messages: any[] = [];
  
  for (const change of entry.changes || []) {
    const value = change.value;
    const metadata = value.metadata;
    const phoneNumberId = metadata?.phone_number_id;
    const displayPhoneNumber = metadata?.display_phone_number;
    
    // Processar mensagens recebidas (field = messages)
    if (change.field === 'messages') {
      for (const message of value.messages || []) {
        const contact = value.contacts?.find((c: any) => c.wa_id === message.from);
        
        // Capturar foto de perfil do contato (Meta API envia no webhook)
        const profilePictureUrl = contact?.profile?.picture || null;
        
        // 🔥 CAPTURAR DADOS DE REFERRAL (Click-to-WhatsApp Ads)
        const referral = message.referral || null;
        let adData = null;
        if (referral) {
          console.log('🎯 [REFERRAL] Mensagem veio de anúncio:', JSON.stringify(referral, null, 2));
          adData = {
            source_type: referral.source_type, // "ad"
            source_id: referral.source_id,     // ID do anúncio
            source_url: referral.source_url,
            headline: referral.headline,
            body: referral.body,
            ctwa_clid: referral.ctwa_clid,     // Click ID para atribuição
            media_type: referral.media_type,
            image_url: referral.image_url,
            video_url: referral.video_url,
            thumbnail_url: referral.thumbnail_url,
          };
        }
        
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        let fileName = '';
        
        switch (message.type) {
          case 'text':
            messageType = 'text';
            messageContent = message.text?.body || '';
            break;
          case 'image':
            messageType = 'image';
            messageContent = message.image?.caption || '[Imagem]';
            mediaUrl = buildMetaMediaJson(
              message.image?.id,
              message.image?.mime_type,
              message.image?.sha256,
              undefined,
              message.image?.file_size // Tamanho se disponível
            );
            break;
          case 'video':
            messageType = 'video';
            messageContent = message.video?.caption || '[Vídeo]';
            mediaUrl = buildMetaMediaJson(
              message.video?.id,
              message.video?.mime_type,
              message.video?.sha256,
              undefined,
              message.video?.file_size // Tamanho se disponível
            );
            break;
          case 'audio':
            messageType = 'audio';
            messageContent = '[Áudio]';
            mediaUrl = buildMetaMediaJson(
              message.audio?.id,
              message.audio?.mime_type || 'audio/ogg; codecs=opus',
              message.audio?.sha256,
              undefined,
              message.audio?.file_size // Tamanho se disponível
            );
            break;
          case 'document':
            messageType = 'document';
            fileName = message.document?.filename || 'documento';
            messageContent = message.document?.caption || fileName || '[Documento]';
            mediaUrl = buildMetaMediaJson(
              message.document?.id,
              message.document?.mime_type,
              message.document?.sha256,
              fileName,
              message.document?.file_size // Tamanho se disponível
            );
            break;
          case 'sticker':
            messageType = 'image';
            messageContent = '[Sticker]';
            mediaUrl = buildMetaMediaJson(
              message.sticker?.id,
              message.sticker?.mime_type || 'image/webp',
              message.sticker?.sha256
            );
            break;
          case 'location':
            messageType = 'text';
            messageContent = `📍 Localização: ${message.location?.latitude}, ${message.location?.longitude}`;
            break;
          case 'contacts':
            messageType = 'contact';
            if (message.contacts?.length === 1) {
              const c = message.contacts[0];
              const cName = c.name?.formatted_name || c.name?.first_name || 'Contato';
              const cPhone = c.phones?.[0]?.phone || c.phones?.[0]?.wa_id || '';
              messageContent = JSON.stringify({ type: 'contact', name: cName, phone: cPhone.replace(/[^0-9+]/g, '') });
            } else {
              const parsedContacts = (message.contacts || []).map((c: any) => ({
                name: c.name?.formatted_name || c.name?.first_name || 'Contato',
                phone: (c.phones?.[0]?.phone || c.phones?.[0]?.wa_id || '').replace(/[^0-9+]/g, '')
              }));
              messageContent = JSON.stringify({ type: 'contacts', contacts: parsedContacts });
            }
            break;
          case 'button':
            messageType = 'text';
            messageContent = message.button?.text || '[Botão]';
            break;
          case 'interactive':
            messageType = 'text';
            messageContent = message.interactive?.button_reply?.title || 
                            message.interactive?.list_reply?.title || 
                            '[Resposta interativa]';
            break;
          case 'template':
            messageType = 'template';
            messageContent = '[Template WhatsApp recebido]';
            break;
          default:
            messageType = 'text';
            messageContent = `[${message.type}]`;
        }

        messages.push({
          message_id: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: messageType,
          content: messageContent,
          media_url: mediaUrl,
          file_name: fileName,
          contact_name: contact?.profile?.name || contact?.wa_id || message.from,
          profile_picture_url: profilePictureUrl,
          phone_number_id: phoneNumberId,
          display_phone_number: displayPhoneNumber,
          context: message.context,
          is_from_me: false,
          source: 'whatsapp',
          referral: adData, // 🔥 Dados do anúncio Click-to-WhatsApp
        });
      }
      
      // Processar status de mensagens
      for (const status of value.statuses || []) {
        console.log('📊 Status de mensagem WhatsApp:', JSON.stringify(status, null, 2));
      }
    }
    
    // Processar message_echoes (mensagens enviadas pelo CRM/Templates)
    if (change.field === 'message_echoes') {
      console.log('📤 [MESSAGE_ECHOES] Processando mensagens enviadas:', JSON.stringify(value, null, 2));
      
      for (const message of value.messages || []) {
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        let fileName = '';
        
        // Destino da mensagem (para quem foi enviada)
        const recipientWaId = message.to;
        
        switch (message.type) {
          case 'text':
            messageType = 'text';
            messageContent = message.text?.body || '';
            break;
          case 'template':
            messageType = 'template';
            // Extrair conteúdo do template usando função helper
            const echoTemplateName = message.template?.name || 'template';
            const echoTemplateComponents = message.template?.components || [];
            messageContent = buildTemplateContentFromParams(echoTemplateName, echoTemplateComponents);
            break;
          case 'image':
            messageType = 'image';
            messageContent = message.image?.caption || '[Imagem enviada]';
            if (message.image?.id) {
              mediaUrl = buildMetaMediaJson(message.image.id, message.image.mime_type);
            }
            break;
          case 'video':
            messageType = 'video';
            messageContent = message.video?.caption || '[Vídeo enviado]';
            if (message.video?.id) {
              mediaUrl = buildMetaMediaJson(message.video.id, message.video.mime_type);
            }
            break;
          case 'audio':
            messageType = 'audio';
            messageContent = '[Áudio enviado]';
            if (message.audio?.id) {
              mediaUrl = buildMetaMediaJson(message.audio.id, message.audio.mime_type);
            }
            break;
          case 'document':
            messageType = 'document';
            fileName = message.document?.filename || 'documento';
            messageContent = message.document?.caption || fileName;
            if (message.document?.id) {
              mediaUrl = buildMetaMediaJson(message.document.id, message.document.mime_type, undefined, fileName);
            }
            break;
          default:
            messageType = 'text';
            messageContent = `[${message.type} enviado]`;
        }

        messages.push({
          message_id: message.id,
          from: recipientWaId,
          timestamp: message.timestamp,
          type: messageType,
          content: messageContent,
          media_url: mediaUrl,
          file_name: fileName,
          contact_name: recipientWaId,
          phone_number_id: phoneNumberId,
          display_phone_number: displayPhoneNumber,
          context: message.context,
          is_from_me: true,
          source: 'whatsapp',
        });
      }
    }
    
    // Processar message_template_status_update
    if (change.field === 'message_template_status_update') {
      console.log('📋 [TEMPLATE_STATUS] Status de template:', JSON.stringify(value, null, 2));
      // Apenas log por enquanto - não cria mensagem
    }
  }
  
  return messages;
}

// Transformar payload do Instagram para formato interno
function transformInstagramPayload(entry: any) {
  const messages: any[] = [];
  const instagramAccountId = entry.id;
  
  console.log('📸 [INSTAGRAM] Processando entry para account:', instagramAccountId);
  
  for (const change of entry.changes || []) {
    console.log('📸 [INSTAGRAM] Change field:', change.field);
    
    // Instagram mensagens chegam no field "messages"
    if (change.field === 'messages') {
      const value = change.value;
      console.log('📸 [INSTAGRAM] Mensagem value:', JSON.stringify(value, null, 2));
      
      // Estrutura do webhook Instagram Messaging
      const senderId = value.sender?.id;
      const recipientId = value.recipient?.id;
      const messageData = value.message;
      
      if (messageData) {
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        
        // Texto
        if (messageData.text) {
          messageType = 'text';
          messageContent = messageData.text;
        }
        // Imagem
        else if (messageData.attachments) {
          for (const attachment of messageData.attachments) {
            if (attachment.type === 'image') {
              messageType = 'image';
              messageContent = '[Imagem Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'video') {
              messageType = 'video';
              messageContent = '[Vídeo Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'audio') {
              messageType = 'audio';
              messageContent = '[Áudio Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'file') {
              messageType = 'document';
              messageContent = '[Arquivo Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'share') {
              messageType = 'text';
              messageContent = '[Post compartilhado]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'story_mention') {
              messageType = 'text';
              messageContent = '[Menção em Story]';
              mediaUrl = attachment.payload?.url || '';
            }
          }
        }
        // Story reply
        else if (messageData.reply_to?.story) {
          messageType = 'text';
          messageContent = `[Resposta ao Story] ${messageData.text || ''}`;
        }
        // Reação
        else if (messageData.reaction) {
          messageType = 'text';
          messageContent = `[Reação: ${messageData.reaction}]`;
        }
        
        // Detectar se é eco de mensagem enviada (pelo CRM ou pelo Instagram Direct)
        const isEcho = senderId === instagramAccountId || 
                       messageData.is_echo === true ||
                       recipientId === senderId;
        
        if (isEcho) {
          console.log('📸 [INSTAGRAM] Echo detectado - salvando como fromme=true (sender:', senderId, 'account:', instagramAccountId, 'is_echo:', messageData.is_echo, ')');
          // Salvar eco como mensagem enviada (fromme=true) para sincronizar Instagram Direct → CRM
          messages.push({
            message_id: messageData.mid || `ig_echo_${Date.now()}`,
            from: recipientId, // O destinatário é o contato
            timestamp: value.timestamp || Math.floor(Date.now() / 1000),
            type: messageType,
            content: messageContent || '[Mensagem Instagram]',
            media_id: mediaUrl,
            contact_name: recipientId,
            instagram_account_id: instagramAccountId,
            recipient_id: recipientId,
            is_from_me: true,
            source: 'instagram',
          });
        } else {
          messages.push({
            message_id: messageData.mid || `ig_${Date.now()}`,
            from: senderId,
            timestamp: value.timestamp || Math.floor(Date.now() / 1000),
            type: messageType,
            content: messageContent || '[Mensagem Instagram]',
            media_id: mediaUrl,
            contact_name: senderId,
            instagram_account_id: instagramAccountId,
            recipient_id: recipientId,
            is_from_me: false,
            source: 'instagram',
          });
        }
      }
    }
    
    // Comments (menções em comentários)
    if (change.field === 'comments') {
      const value = change.value;
      console.log('📸 [INSTAGRAM] Comentário:', JSON.stringify(value, null, 2));
      
      messages.push({
        message_id: value.id || `ig_comment_${Date.now()}`,
        from: value.from?.id || 'unknown',
        timestamp: value.created_time ? new Date(value.created_time).getTime() / 1000 : Math.floor(Date.now() / 1000),
        type: 'text',
        content: `[Comentário] ${value.text || ''}`,
        media_id: null,
        contact_name: value.from?.username || value.from?.id || 'Usuário Instagram',
        instagram_account_id: instagramAccountId,
        is_from_me: false,
        source: 'instagram_comment',
      });
    }
  }
  
  // Também processar messaging diretamente se existir (formato alternativo)
  for (const messaging of entry.messaging || []) {
    console.log('📸 [INSTAGRAM] Messaging direto:', JSON.stringify(messaging, null, 2));
    
    const senderId = messaging.sender?.id;
    const recipientId = messaging.recipient?.id;
    const messageData = messaging.message;
    
    if (messageData && senderId !== recipientId) {
      // Detectar eco de mensagem enviada (pelo CRM ou Instagram Direct)
      const isEcho = senderId === instagramAccountId || 
                     messageData.is_echo === true;
      
      if (isEcho) {
        console.log('📸 [INSTAGRAM] Echo em messaging direto - salvando como fromme=true (sender:', senderId, ')');
      }

      let messageType = 'text';
      let messageContent = '';
      let mediaUrl = '';
      
      if (messageData.text) {
        messageType = 'text';
        messageContent = messageData.text;
      } else if (messageData.attachments) {
        for (const attachment of messageData.attachments) {
          messageType = attachment.type || 'image';
          messageContent = `[${attachment.type || 'Anexo'} Instagram]`;
          mediaUrl = attachment.payload?.url || '';
        }
      }
      
      messages.push({
        message_id: messageData.mid || `ig_${Date.now()}`,
        from: isEcho ? recipientId : senderId,
        timestamp: messaging.timestamp || Math.floor(Date.now() / 1000),
        type: messageType,
        content: messageContent || '[Mensagem Instagram]',
        media_id: mediaUrl,
        contact_name: isEcho ? recipientId : senderId,
        instagram_account_id: instagramAccountId,
        recipient_id: recipientId,
        is_from_me: isEcho,
        source: 'instagram',
      });
    }
  }
  
  return messages;
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Verificação do webhook (GET request do Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    console.log('🔐 Meta Webhook Verification:', { mode, token, challenge });
    
    // Usar token master global para validação (SaaS multi-tenant)
    const MASTER_VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'wazecrm_master_2024';
    
    if (mode === 'subscribe' && token === MASTER_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado com sucesso usando token master global');
      return new Response(challenge, { status: 200 });
    }
    
    console.warn('❌ Falha na verificação do webhook - token inválido');
    console.warn('Token recebido:', token);
    console.warn('Token esperado: [MASTER_TOKEN]');
    return new Response('Forbidden', { status: 403 });
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST - Receber mensagens
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256');
      
      console.log('📨 Meta Webhook - Payload recebido');
      
      const body = JSON.parse(rawBody);
      console.log('📨 Meta Webhook - Object type:', body.object);
      console.log('📨 Meta Webhook - Entry count:', body.entry?.length);

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Processar WhatsApp Business
      if (body.object === 'whatsapp_business_account') {
        console.log('📱 Processando mensagens WhatsApp...');
        
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change?.value;

            if (change?.field !== 'messages' || !Array.isArray(value?.statuses) || value.statuses.length === 0) {
              continue;
            }

            for (const deliveryStatus of value.statuses) {
              const conversationUpdate = mapMetaDeliveryStatusToConversationUpdate(deliveryStatus);
              const errorInfo = deliveryStatus?.errors?.[0];

              // Retry logic to handle race condition: webhook may arrive before DB insert completes
              let updatedRows: any[] | null = null;
              let updateError: any = null;
              const maxRetries = 3;
              for (let attempt = 0; attempt < maxRetries; attempt++) {
                const result = await supabase
                  .from('conversas')
                  .update(conversationUpdate)
                  .eq('whatsapp_message_id', deliveryStatus.id)
                  .select('id');
                
                updatedRows = result.data;
                updateError = result.error;

                if (updateError) {
                  console.error('❌ [META-STATUS] Erro ao atualizar conversa pelo status:', updateError);
                  break;
                }

                if (updatedRows?.length) {
                  console.log(`✅ [META-STATUS] Conversa atualizada para status ${deliveryStatus.status}:`, deliveryStatus.id, attempt > 0 ? `(tentativa ${attempt + 1})` : '');
                  break;
                }

                // Record not found - wait and retry (race condition with DB insert)
                if (attempt < maxRetries - 1) {
                  console.log(`⏳ [META-STATUS] Registro não encontrado, aguardando retry ${attempt + 2}/${maxRetries} para:`, deliveryStatus.id);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                  console.warn('⚠️ [META-STATUS] Conversa não encontrada após retries para whatsapp_message_id:', deliveryStatus.id);
                }
              }

              // Atualizar/inserir whatsapp_message_logs (Dashboard WhatsApp Meta)
              try {
                const normalized = String(deliveryStatus?.status || '').toLowerCase();
                const logUpdate: Record<string, any> = { status: normalized };
                const ts = deliveryStatus?.timestamp
                  ? new Date(parseInt(deliveryStatus.timestamp) * 1000).toISOString()
                  : new Date().toISOString();
                if (normalized === 'sent') logUpdate.sent_at = ts;
                if (normalized === 'delivered') logUpdate.delivered_at = ts;
                if (normalized === 'read') {
                  logUpdate.read_at = ts;
                  // Se Meta confirmou leitura, garantir que delivered_at tb esteja preenchido
                  if (!logUpdate.delivered_at) logUpdate.delivered_at = ts;
                }
                if (normalized === 'failed') {
                  logUpdate.failed_at = ts;
                  logUpdate.error_code = errorInfo?.code ? String(errorInfo.code) : null;
                  logUpdate.error_message = errorInfo?.message || errorInfo?.title || null;
                }
                const { data: updatedLogs, error: logUpdateErr } = await supabase
                  .from('whatsapp_message_logs')
                  .update(logUpdate)
                  .eq('message_id_meta', deliveryStatus.id)
                  .select('id');

                if (logUpdateErr) {
                  console.error('⚠️ [META-STATUS] Erro UPDATE whatsapp_message_logs:', logUpdateErr);
                }

                // Se nenhum log existia para esse wamid, criar um (cobre disparos antigos sem log)
                if (!updatedLogs?.length) {
                  // Tentar achar conversa correspondente para puxar company_id, campanha, phone
                  const { data: convRow } = await supabase
                    .from('conversas')
                    .select('id, company_id, lead_id, telefone_formatado, numero, campanha_id, campanha_nome, tipo_mensagem')
                    .eq('whatsapp_message_id', deliveryStatus.id)
                    .maybeSingle();

                  // Fallback: localizar a conversa de campanha mais recente para esse recipient_id
                  let convForLog = convRow;
                  if (!convForLog && deliveryStatus?.recipient_id) {
                    const phone = String(deliveryStatus.recipient_id);
                    const { data: convByPhone } = await supabase
                      .from('conversas')
                      .select('id, company_id, lead_id, telefone_formatado, numero, campanha_id, campanha_nome, tipo_mensagem')
                      .eq('fromme', true)
                      .or(`telefone_formatado.eq.${phone},numero.eq.${phone}`)
                      .not('campanha_id', 'is', null)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    convForLog = convByPhone || null;

                    // Vincular wamid à conversa se ainda não tiver
                    if (convForLog && !(convForLog as any).whatsapp_message_id) {
                      await supabase
                        .from('conversas')
                        .update({ whatsapp_message_id: deliveryStatus.id, origem_api: 'meta' })
                        .eq('id', (convForLog as any).id);
                    }
                  }

                  const isTemplate = String((convForLog as any)?.tipo_mensagem || '').toLowerCase() === 'template';
                  const insertPayload: Record<string, any> = {
                    company_id: (convForLog as any)?.company_id || null,
                    conversation_id: (convForLog as any)?.id || null,
                    lead_id: (convForLog as any)?.lead_id || null,
                    message_id_meta: deliveryStatus.id,
                    provider: 'meta',
                    direction: 'outbound',
                    message_type: (convForLog as any)?.tipo_mensagem || 'text',
                    phone_number:
                      (convForLog as any)?.telefone_formatado ||
                      (convForLog as any)?.numero ||
                      deliveryStatus?.recipient_id ||
                      null,
                    status: normalized,
                    cost_category: isTemplate ? 'marketing' : 'service',
                    cost_estimate: isTemplate ? 0.05 : 0.005,
                    campaign_id: (convForLog as any)?.campanha_id || null,
                    campaign_name: (convForLog as any)?.campanha_nome || null,
                    sent_at: ts,
                    delivered_at: normalized === 'delivered' || normalized === 'read' ? ts : null,
                    read_at: normalized === 'read' ? ts : null,
                    failed_at: normalized === 'failed' ? ts : null,
                    error_code: normalized === 'failed' ? (errorInfo?.code ? String(errorInfo.code) : null) : null,
                    error_message: normalized === 'failed' ? (errorInfo?.message || errorInfo?.title || null) : null,
                  };

                  if (insertPayload.company_id) {
                    const { error: insErr } = await supabase
                      .from('whatsapp_message_logs')
                      .insert(insertPayload);
                    if (insErr) {
                      console.error('⚠️ [META-STATUS] Erro INSERT whatsapp_message_logs:', insErr);
                    } else {
                      console.log('✅ [META-STATUS] Log criado para wamid', deliveryStatus.id, 'status', normalized);
                    }
                  }
                }
              } catch (logErr) {
                console.error('⚠️ [META-STATUS] Falha ao atualizar whatsapp_message_logs:', logErr);
              }

              if (String(deliveryStatus?.status || '').toLowerCase() === 'failed') {
                console.error('❌ [META-STATUS] Falha de entrega confirmada pela Meta:', JSON.stringify({
                  message_id: deliveryStatus.id,
                  recipient_id: deliveryStatus.recipient_id,
                  code: errorInfo?.code,
                  title: errorInfo?.title,
                  message: errorInfo?.message,
                  details: errorInfo?.error_data?.details,
                }, null, 2));
              }
            }
          }

          const messages = transformWhatsAppPayload(entry);
          
          for (const msg of messages) {
            // Buscar conexão com api_provider para verificar se Meta está ativa
            const { data: connection } = await supabase
              .from('whatsapp_connections')
              .select('company_id, meta_access_token, api_provider')
              .eq('meta_phone_number_id', msg.phone_number_id)
              .single();
            
            if (!connection) {
              console.warn('❌ Conexão não encontrada para phone_number_id:', msg.phone_number_id);
              continue;
            }

            // 🔒 IMPORTANTE: Ignorar webhooks Meta se api_provider = 'evolution' (apenas API não oficial)
            if (connection.api_provider === 'evolution') {
              console.log('⚠️ [WEBHOOK-META] Ignorando mensagem - api_provider configurado como "evolution" apenas');
              console.log('📋 Company com Meta desativada, use Evolution API para este número');
              continue;
            }

            const company_id = connection.company_id;
            
            let formattedNumber = msg.from.replace(/[^0-9]/g, '');
            if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
              formattedNumber = '55' + formattedNumber;
            }

            const { data: existingLead } = await supabase
              .from('leads')
              .select('id, name, profile_picture_url, lead_source_type, tags')
              .eq('company_id', company_id)
              .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`)
              .limit(1)
              .single();

            // Se temos foto de perfil do webhook e o lead não tem, atualizar
            if (msg.profile_picture_url && existingLead?.id && !existingLead.profile_picture_url) {
              console.log('📷 Atualizando foto de perfil do lead:', existingLead.id);
              await supabase
                .from('leads')
                .update({ profile_picture_url: msg.profile_picture_url })
                .eq('id', existingLead.id);
            }

            // 🔥 PROCESSAR REFERRAL (Click-to-WhatsApp Ads)
            let leadId = existingLead?.id || null;
            const referral = msg.referral;
            
            if (referral) {
              console.log('🎯 [CTWA] Processando lead de anúncio Click-to-WhatsApp');
              
              // Se não existe lead, criar automaticamente
              if (!leadId) {
                const newLeadData = {
                  name: msg.contact_name || formattedNumber,
                  telefone: formattedNumber,
                  company_id: company_id,
                  lead_source_type: 'ctwa',
                  utm_source: 'facebook',
                  utm_medium: 'cpc',
                  utm_campaign: referral.headline || 'Click-to-WhatsApp',
                  ad_id: referral.source_id || null,
                  tags: ['Click-to-WhatsApp', 'Anúncio', 'Meta Ads'],
                  notes: `Lead gerado via anúncio: ${referral.headline || 'Click-to-WhatsApp'}`,
                  conversion_timestamp: new Date().toISOString(),
                };
                
                console.log('🆕 Criando novo lead de CTWA:', JSON.stringify(newLeadData, null, 2));
                
                const { data: newLead, error: leadError } = await supabase
                  .from('leads')
                  .insert(newLeadData)
                  .select('id')
                  .single();
                
                if (leadError) {
                  console.error('❌ Erro ao criar lead CTWA:', leadError);
                } else {
                  leadId = newLead?.id;
                  console.log('✅ Lead CTWA criado com sucesso:', leadId);
                }
              } else {
                // Lead existe - atualizar com dados do anúncio se não tiver
                const updateData: any = {};
                
                if (!existingLead?.lead_source_type) {
                  updateData.lead_source_type = 'ctwa';
                  updateData.utm_source = 'facebook';
                  updateData.utm_medium = 'cpc';
                  updateData.utm_campaign = referral.headline || 'Click-to-WhatsApp';
                  updateData.ad_id = referral.source_id || null;
                  updateData.conversion_timestamp = new Date().toISOString();
                  
                  // Adicionar tags sem sobrescrever existentes
                  const existingTags = existingLead?.tags || [];
                  const newTags = ['Click-to-WhatsApp', 'Anúncio', 'Meta Ads'];
                  updateData.tags = [...new Set([...existingTags, ...newTags])];
                }
                
                if (Object.keys(updateData).length > 0) {
                  console.log('📝 Atualizando lead existente com dados CTWA:', leadId);
                  await supabase
                    .from('leads')
                    .update(updateData)
                    .eq('id', leadId);
                }
              }
            }

            const conversaData: any = {
              numero: formattedNumber,
              telefone_formatado: formattedNumber,
              mensagem: msg.content,
              tipo_mensagem: msg.type,
              origem: 'WhatsApp Meta',
              status: msg.is_from_me ? 'Enviada' : 'Recebida',
              fromme: msg.is_from_me || false,
              company_id: company_id,
              lead_id: leadId,
              nome_contato: existingLead?.name || msg.contact_name || formattedNumber,
              midia_url: msg.media_url || null,
              arquivo_nome: msg.file_name || null,
              is_group: false,
              origem_api: 'meta',
            };
            
            // Adicionar dados de rastreamento de anúncio se existir referral
            if (referral) {
              conversaData.ad_source_type = referral.source_type || null;
              conversaData.ad_source_id = referral.source_id || null;
              conversaData.ad_headline = referral.headline || null;
              conversaData.ctwa_clid = referral.ctwa_clid || null;
              conversaData.campanha_id = referral.source_id || null;
              conversaData.campanha_nome = referral.headline || 'Click-to-WhatsApp';
            }

            console.log('💾 Inserindo conversa WhatsApp Meta:', JSON.stringify(conversaData, null, 2));

            const { error: insertError } = await supabase
              .from('conversas')
              .insert(conversaData);

            if (insertError) {
              console.error('❌ Erro ao inserir conversa WhatsApp:', insertError);
            } else {
              console.log('✅ Conversa WhatsApp inserida com sucesso');
            }
          }
        }
      }
      
      // Processar Instagram
      else if (body.object === 'instagram') {
        console.log('📸 Processando mensagens Instagram...');
        
        for (const entry of body.entry || []) {
          const messages = transformInstagramPayload(entry);
          console.log('📸 Mensagens Instagram transformadas:', messages.length);
          
          for (const msg of messages) {
            // Buscar conexão pelo instagram_account_id
            let connection = null;
            
            // Primeiro tentar pelo instagram_account_id exato
            if (msg.instagram_account_id) {
              const { data: conn } = await supabase
                .from('whatsapp_connections')
                .select('company_id, instagram_access_token, instagram_username, meta_access_token, instagram_account_id')
                .eq('instagram_account_id', msg.instagram_account_id)
                .single();
              
              connection = conn;
            }
            
            // ⚡ Fallback para subcontas: buscar por instagram_account_id parcial ou meta_access_token ativo
            if (!connection && msg.instagram_account_id) {
              const { data: conns } = await supabase
                .from('whatsapp_connections')
                .select('company_id, instagram_access_token, instagram_username, meta_access_token, instagram_account_id')
                .not('instagram_account_id', 'is', null)
                .not('meta_access_token', 'is', null);
              
              if (conns && conns.length > 0) {
                // Verificar se alguma conexão tem token válido para esta conta
                for (const c of conns) {
                  if (c.instagram_account_id === msg.instagram_account_id) {
                    connection = c;
                    break;
                  }
                }
              }
            }
            
            if (!connection) {
              console.warn('❌ Conexão Instagram não encontrada para account_id:', msg.instagram_account_id);
              continue;
            }

            const company_id = connection.company_id;
            
            // Usar o sender ID como número (Instagram não tem telefone)
            const instagramUserId = msg.from || 'instagram_user';
            
            // ⚡ CORREÇÃO: Segunda verificação de eco usando instagram_account_id do banco
            const storedIgAccountId = connection.instagram_account_id || msg.instagram_account_id;
            if (instagramUserId === storedIgAccountId && !msg.is_from_me) {
              console.log('📸 [INSTAGRAM] Ignorando eco (sender === stored instagram_account_id):', instagramUserId);
              continue;
            }

            // ⚡ CORREÇÃO: Verificar se a mensagem pertence a ESTA conta Instagram
            // Quando múltiplas contas estão conectadas, o webhook envia a mesma mensagem
            // para todas as entries. Devemos processar apenas na conta correta (recipient).
            // Para mensagens echo (fromme), o recipient_id é o contato, não a conta - pular esta verificação
            if (!msg.is_from_me && msg.recipient_id && storedIgAccountId && msg.recipient_id !== storedIgAccountId) {
              console.log('📸 [INSTAGRAM] Ignorando mensagem - destinatário', msg.recipient_id, 'não corresponde à conta', storedIgAccountId);
              continue;
            }

            // 📸 CORREÇÃO: Buscar username real do Instagram
            // IGSID (Instagram Scoped ID) NÃO funciona com /{id}?fields=username,name
            // Solução: usar /{ig-page-id}/conversations?user_id={igsid}&platform=instagram
            let instagramUsername = instagramUserId; // Default: ID numérico
            let instagramProfilePic: string | null = null;

            // ⚡ PRIORIZAR token IGAA (Instagram Business Login) de tenant_integrations.
            // O token EAA (Facebook user/page) NÃO funciona para lookup de IGSID.
            let igAccessToken: string | null = null;
            let igAccountId: string | null = connection.instagram_account_id || msg.instagram_account_id || null;
            let igTokenIsIgBusiness = false;
            try {
              const { data: tenantInt } = await supabase
                .from('tenant_integrations')
                .select('meta_access_token, instagram_ig_id')
                .eq('company_id', company_id)
                .maybeSingle();
              if (tenantInt?.meta_access_token && tenantInt.meta_access_token.startsWith('IGAA')) {
                igAccessToken = tenantInt.meta_access_token;
                igTokenIsIgBusiness = true;
                igAccountId = tenantInt.instagram_ig_id || igAccountId;
              }
            } catch (_) { /* ignore */ }
            if (!igAccessToken) {
              igAccessToken = connection.meta_access_token || connection.instagram_access_token;
              igTokenIsIgBusiness = !!igAccessToken && igAccessToken.startsWith('IGAA');
            }
            const igApiBase = igTokenIsIgBusiness
              ? 'https://graph.instagram.com/v23.0'
              : 'https://graph.facebook.com/v23.0';
            const igAccountRef = igTokenIsIgBusiness ? 'me' : igAccountId;
            
            // Método 0 (CACHE): Buscar nome de conversa anterior no banco
            // ⚡ CORREÇÃO: Rejeitar nomes fallback "Instagram XXXXXX" do cache
            try {
              const { data: prevConv } = await supabase
                .from('conversas')
                .select('nome_contato')
                .eq('company_id', company_id)
                .eq('telefone_formatado', instagramUserId)
                .not('nome_contato', 'eq', instagramUserId)
                .not('nome_contato', 'is', null)
                .limit(1)
                .single();
              
              if (prevConv?.nome_contato) {
                const isFallbackName = /^Instagram\s+\d+$/i.test(prevConv.nome_contato) || /^Contato\s+Instagram$/i.test(prevConv.nome_contato);
                if (!isFallbackName) {
                  instagramUsername = prevConv.nome_contato;
                  console.log('📸 [INSTAGRAM] Nome encontrado no cache (conversa anterior):', instagramUsername);
                } else {
                  console.log('📸 [INSTAGRAM] Cache rejeitado (nome é fallback):', prevConv.nome_contato);
                }
              }
            } catch (e) {
              // Sem cache, continuar para API
            }
            
            // Se não encontrou no cache, tentar via API
            if (instagramUsername === instagramUserId && igAccessToken && instagramUserId !== 'instagram_user' && igAccountRef) {
              try {
                console.log('📸 [INSTAGRAM] Buscando nome para IGSID:', instagramUserId, '| token:', igTokenIsIgBusiness ? 'IGAA' : 'EAA');
                
                // Método 1: Listar conversas e procurar o participante pelo ID
                const convUrl = `${igApiBase}/${igAccountRef}/conversations?platform=instagram&fields=participants&limit=100&access_token=${igAccessToken}`;
                const convRes = await fetch(convUrl);
                
                if (convRes.ok) {
                  const convData = await convRes.json();
                  // Procurar a conversa que contém o participant alvo
                  for (const conversation of convData.data ?? []) {
                    const participants = conversation.participants?.data ?? [];
                    const match = participants.find((p: any) => String(p.id) === String(instagramUserId));
                    if (match) {
                      instagramUsername = match.username || match.name || instagramUserId;
                      console.log('📸 [INSTAGRAM] Nome encontrado via conversations:', instagramUsername);
                      break;
                    }
                  }
                } else {
                  const errText = await convRes.text();
                  console.warn('⚠️ [INSTAGRAM] Conversations API falhou:', errText.substring(0, 300));
                }
                
                // Método 2 (fallback): lookup direto do IGSID
                if (instagramUsername === instagramUserId) {
                  try {
                    const userUrl = `${igApiBase}/${instagramUserId}?fields=name,username&access_token=${igAccessToken}`;
                    const userRes = await fetch(userUrl);
                    if (userRes.ok) {
                      const userData = await userRes.json();
                      console.log('📸 [INSTAGRAM] User data (fallback):', JSON.stringify(userData));
                      if (userData.username) instagramUsername = userData.username;
                      else if (userData.name) instagramUsername = userData.name;
                    } else {
                      const errText = await userRes.text();
                      console.warn('⚠️ [INSTAGRAM] User fallback falhou:', errText.substring(0, 200));
                    }
                  } catch (e) {
                    console.warn('⚠️ [INSTAGRAM] User fallback falhou:', e);
                  }
                }
                
                // Método 3 (fallback): Buscar do contact_name que veio no webhook
                if (instagramUsername === instagramUserId && msg.contact_name && msg.contact_name !== instagramUserId) {
                  instagramUsername = msg.contact_name;
                }
              } catch (userErr) {
                console.warn('⚠️ [INSTAGRAM] Erro ao buscar username:', userErr);
              }
            }
            
            console.log('📸 [INSTAGRAM] Nome final do contato:', instagramUsername, '| Foto:', instagramProfilePic ? 'SIM' : 'NÃO');

            // Buscar lead existente pelo Instagram ID ou criar identificador
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id, name, profile_picture_url')
              .eq('company_id', company_id)
              .or(`telefone.eq.${instagramUserId},phone.eq.${instagramUserId}`)
              .limit(1)
              .maybeSingle();

            let leadId = existingLead?.id || null;
            let leadName = existingLead?.name || instagramUsername;

            // ⚡ CORREÇÃO SUBCONTAS: Se o lead existe mas o nome é ruim (ID numérico OU fallback "Instagram XXXX"), atualizar
            if (leadId && existingLead?.name && instagramUsername !== instagramUserId) {
              const existingName = existingLead.name.trim();
              const isNumericName = /^\d{10,}$/.test(existingName);
              const isFallbackName = /^Instagram\s+\d+$/i.test(existingName) || /^Contato\s+Instagram$/i.test(existingName);
              if ((isNumericName || isFallbackName) && existingName !== instagramUsername) {
                try {
                  await supabase
                    .from('leads')
                    .update({ name: instagramUsername })
                    .eq('id', leadId);
                  leadName = instagramUsername;
                  console.log('📸 [INSTAGRAM] Nome do lead atualizado para:', instagramUsername);
                  
                  // Também atualizar TODAS conversas anteriores com nomes ruins
                  await supabase
                    .from('conversas')
                    .update({ nome_contato: instagramUsername })
                    .eq('company_id', company_id)
                    .eq('telefone_formatado', instagramUserId);
                  console.log('📸 [INSTAGRAM] Conversas anteriores atualizadas com nome correto');
                } catch (e) {
                  console.warn('⚠️ [INSTAGRAM] Erro ao atualizar nome do lead:', e);
                }
              }
            }

            // ⚡ AUTO-CREATE: Se não existe lead para este contato Instagram, criar automaticamente
            if (!leadId) {
              // Usar o melhor nome disponível (username real ou ID como fallback)
              const leadNameToCreate = instagramUsername !== instagramUserId ? instagramUsername : `Contato Instagram`;
              try {
                const { data: newLead, error: createErr } = await supabase
                  .from('leads')
                  .insert({
                    name: leadNameToCreate,
                    telefone: instagramUserId,
                    phone: instagramUserId,
                    company_id: company_id,
                    lead_source_type: 'instagram',
                    profile_picture_url: instagramProfilePic || null,
                    notes: `Lead criado automaticamente via Instagram DM`,
                  })
                  .select('id, name')
                  .single();
                if (!createErr && newLead) {
                  leadId = newLead.id;
                  leadName = newLead.name || leadNameToCreate;
                  console.log('✅ [INSTAGRAM] Lead criado automaticamente:', leadId, leadName);
                }
              } catch (e) {
                console.warn('⚠️ [INSTAGRAM] Erro ao criar lead automático:', e);
              }
            }

            // ⚡ Atualizar foto de perfil do lead existente se encontramos uma nova
            if (leadId && instagramProfilePic && (!existingLead?.profile_picture_url || existingLead.profile_picture_url !== instagramProfilePic)) {
              try {
                await supabase
                  .from('leads')
                  .update({ profile_picture_url: instagramProfilePic })
                  .eq('id', leadId);
                console.log('📸 [INSTAGRAM] Foto de perfil salva no lead:', leadId);
              } catch (e) {
                console.warn('⚠️ [INSTAGRAM] Erro ao salvar foto no lead:', e);
              }
            }

            // Helper: verificar se nome é genérico/ruim
            const isBadName = (n: string | null | undefined): boolean => {
              if (!n) return true;
              const t = n.trim();
              if (!t) return true;
              if (/^\d{10,}$/.test(t)) return true;
              if (/^Instagram\s+\d+$/i.test(t)) return true;
              if (/^Contato\s+Instagram$/i.test(t)) return true;
              if (t === instagramUserId) return true;
              return false;
            };

            // ⚡ Se ainda não temos um nome real, tentar resolve-instagram-name como último recurso
            if (isBadName(instagramUsername) && isBadName(leadName)) {
              try {
                const resolveUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/resolve-instagram-name`;
                const resolveRes = await fetch(resolveUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  },
                  body: JSON.stringify({ company_id, instagram_user_id: instagramUserId }),
                });
                if (resolveRes.ok) {
                  const resolveData = await resolveRes.json();
                  if (resolveData.name && !isBadName(resolveData.name)) {
                    instagramUsername = resolveData.name;
                    leadName = resolveData.name;
                    console.log('📸 [INSTAGRAM] Nome resolvido via resolve-instagram-name:', resolveData.name);
                    // Atualizar lead se existir
                    if (leadId) {
                      await supabase.from('leads').update({ name: resolveData.name }).eq('id', leadId);
                    }
                  }
                }
              } catch (e) {
                console.warn('⚠️ [INSTAGRAM] resolve-instagram-name falhou:', e);
              }
            }

            // ⚡ Garantir que nome_contato NUNCA seja o ID numérico ou fallback quando temos um nome real
            const finalContactName = (() => {
              if (!isBadName(existingLead?.name)) return existingLead!.name;
              if (!isBadName(leadName)) return leadName;
              if (!isBadName(instagramUsername)) return instagramUsername;
              // Último fallback: usar "Contato Instagram" temporário
              return `Contato Instagram`;
            })();

            const conversaData = {
              numero: instagramUserId,
              telefone_formatado: instagramUserId,
              mensagem: msg.content,
              tipo_mensagem: msg.type === 'text' ? 'texto' : msg.type,
              origem: 'Instagram',
              status: msg.is_from_me ? 'Enviada' : 'Recebida',
              fromme: msg.is_from_me || false,
              company_id: company_id,
              lead_id: leadId,
              nome_contato: finalContactName,
              midia_url: msg.media_id || null,
              is_group: false,
              origem_api: 'meta',
              whatsapp_message_id: msg.message_id || null,
            };

            // ⚡ CORREÇÃO ANTI-DUPLICAÇÃO: Múltiplas verificações
            // 1. Verificar por message_id (mid) do Meta
            if (msg.message_id) {
              const { data: existingMsg } = await supabase
                .from('conversas')
                .select('id')
                .eq('whatsapp_message_id', msg.message_id)
                .limit(1)
                .maybeSingle();
              
              if (existingMsg) {
                console.log('📸 [INSTAGRAM] Mensagem duplicada ignorada (mid já existe):', msg.message_id);
                continue;
              }
            }
            
            // 2. Verificar se já existe mensagem idêntica enviada pelo CRM nos últimos 30 segundos
            // (protege contra race condition onde o mid ainda não foi salvo)
            {
              const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
              const { data: recentDup } = await supabase
                .from('conversas')
                .select('id')
                .eq('company_id', company_id)
                .eq('mensagem', msg.content)
                .or(`numero.eq.${instagramUserId},telefone_formatado.eq.${instagramUserId}`)
                .gte('created_at', thirtySecsAgo)
                .limit(1)
                .maybeSingle();
              
              if (recentDup) {
                console.log('📸 [INSTAGRAM] Mensagem duplicada ignorada (conteúdo idêntico recente):', msg.content?.substring(0, 50));
                continue;
              }
            }

            console.log('💾 Inserindo conversa Instagram:', JSON.stringify(conversaData, null, 2));

            const { error: insertError } = await supabase
              .from('conversas')
              .insert(conversaData);

            if (insertError) {
              console.error('❌ Erro ao inserir conversa Instagram:', insertError);
            } else {
              console.log('✅ Conversa Instagram inserida com sucesso');
            }
          }
        }
      }
      
      // Processar Page (Facebook Messenger - para futuro)
      else if (body.object === 'page') {
        console.log('📘 Processando mensagens Facebook Messenger...');
        
        for (const entry of body.entry || []) {
          const pageId = entry.id;
          console.log('📘 [MESSENGER] Entry page_id:', pageId);
          
          // Buscar conexão pela tabela tenant_integrations usando messenger_page_id
          const { data: tenantConn } = await supabase
            .from('tenant_integrations')
            .select('company_id, messenger_page_id, messenger_page_access_token')
            .eq('messenger_page_id', pageId)
            .single();
          
          if (!tenantConn) {
            console.warn('❌ [MESSENGER] Conexão não encontrada para page_id:', pageId);
            continue;
          }
          
          const company_id = tenantConn.company_id;
          const pageAccessToken = tenantConn.messenger_page_access_token;
          console.log('📘 [MESSENGER] Company encontrada:', company_id);
          
          // Processar mensagens do Messenger
          for (const messagingEvent of entry.messaging || []) {
            const senderId = messagingEvent.sender?.id;
            const recipientId = messagingEvent.recipient?.id;
            const messageData = messagingEvent.message;
            const timestamp = messagingEvent.timestamp;
            
            console.log('📘 [MESSENGER] Evento:', JSON.stringify({ senderId, recipientId, hasMessage: !!messageData }));
            
            // Ignorar se não tem mensagem (pode ser delivery, read receipt, etc.)
            if (!messageData) {
              console.log('📘 [MESSENGER] Evento sem mensagem (delivery/read), ignorando');
              continue;
            }
            
            // Detectar se é echo (mensagem enviada pela própria página)
            const isEcho = messageData.is_echo === true || senderId === pageId;
            
            let messageType = 'text';
            let messageContent = '';
            let mediaUrl = '';
            let arquivoNome = '';
            
            // Texto
            if (messageData.text) {
              messageType = 'text';
              messageContent = messageData.text;
            }
            
            // Anexos (imagem, vídeo, áudio, arquivo)
            if (messageData.attachments && messageData.attachments.length > 0) {
              for (const attachment of messageData.attachments) {
                const type = attachment.type;
                const payloadUrl = attachment.payload?.url;
                
                if (type === 'image') {
                  messageType = 'image';
                  mediaUrl = payloadUrl || '';
                } else if (type === 'video') {
                  messageType = 'video';
                  mediaUrl = payloadUrl || '';
                } else if (type === 'audio') {
                  messageType = 'audio';
                  mediaUrl = payloadUrl || '';
                } else if (type === 'file') {
                  messageType = 'document';
                  mediaUrl = payloadUrl || '';
                  arquivoNome = attachment.payload?.title || 'arquivo';
                } else {
                  messageType = type || 'text';
                  mediaUrl = payloadUrl || '';
                }
                
                if (!messageContent && payloadUrl) {
                  messageContent = `[${type || 'anexo'}]`;
                }
              }
            }
            
            // Sticker
            if (messageData.sticker_id) {
              messageType = 'sticker';
              messageContent = messageContent || '[Sticker]';
            }
            
            // Contato do Messenger: usar o sender ID (PSID)
            const messengerUserId = isEcho ? recipientId : senderId;
            
            // Tentar buscar nome do contato via Graph API
            let contactName = '';
            if (pageAccessToken && messengerUserId) {
              try {
                const profileUrl = `https://graph.facebook.com/v23.0/${messengerUserId}?fields=first_name,last_name,name,profile_pic&access_token=${pageAccessToken}`;
                const profileResponse = await fetch(profileUrl);
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  contactName = profileData.name || `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                  console.log('📘 [MESSENGER] Nome do contato:', contactName);
                } else {
                  console.warn('📘 [MESSENGER] Erro ao buscar perfil:', await profileResponse.text());
                }
              } catch (e) {
                console.warn('📘 [MESSENGER] Erro ao buscar perfil:', e);
              }
            }
            
            if (!contactName) {
              contactName = `Messenger ${messengerUserId}`;
            }
            
            // Verificar duplicata pelo mid (message ID)
            const messageId = messageData.mid;
            if (messageId) {
              const { data: existingMsg } = await supabase
                .from('conversas')
                .select('id')
                .eq('whatsapp_message_id', messageId)
                .single();
              
              if (existingMsg) {
                console.log('📘 [MESSENGER] Mensagem duplicada, ignorando:', messageId);
                continue;
              }
            }
            
            // Salvar mensagem na tabela conversas
            const conversaData = {
              numero: messengerUserId,
              telefone_formatado: messengerUserId,
              mensagem: messageContent || '[mídia]',
              tipo_mensagem: messageType,
              midia_url: mediaUrl || null,
              arquivo_nome: arquivoNome || null,
              fromme: isEcho,
              status: isEcho ? 'sent' : 'received',
              origem: 'Messenger',
              origem_api: 'meta',
              nome_contato: contactName,
              company_id: company_id,
              whatsapp_message_id: messageId || null,
              read: isEcho,
              delivered: isEcho,
            };
            
            console.log('📘 [MESSENGER] Salvando mensagem:', JSON.stringify({ 
              from: messengerUserId, 
              isEcho, 
              type: messageType, 
              content: messageContent?.substring(0, 50) 
            }));
            
            const { data: inserted, error: insertError } = await supabase
              .from('conversas')
              .insert(conversaData)
              .select('id')
              .single();
            
            if (insertError) {
              console.error('❌ [MESSENGER] Erro ao salvar mensagem:', insertError);
            } else {
              console.log('✅ [MESSENGER] Mensagem salva:', inserted.id);
              
              // Vincular a lead se existir
              if (!isEcho && messengerUserId) {
                const { data: existingLead } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', company_id)
                  .or(`telefone.eq.${messengerUserId},phone.eq.${messengerUserId}`)
                  .limit(1)
                  .single();
                
                if (existingLead) {
                  await supabase
                    .from('conversas')
                    .update({ lead_id: existingLead.id })
                    .eq('id', inserted.id);
                  console.log('📘 [MESSENGER] Vinculado ao lead:', existingLead.id);
                }
              }
            }
          }
        }
      }
      
      else {
        console.log('⚠️ Tipo de objeto não reconhecido:', body.object);
        console.log('📨 Payload completo:', JSON.stringify(body, null, 2));
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
      
    } catch (error) {
      console.error('❌ Meta Webhook - Erro:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
