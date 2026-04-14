// v2 - redeploy para limpar BOOT_ERROR
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Meta API Configuration
const META_API_VERSION = 'v18.0';
const META_API_BASE_URL = 'https://graph.facebook.com';

// ⚡ Sanitize Evolution API URL - prevent corrupted/malformed URLs
function sanitizeEvolutionUrl(url: string): string {
  if (!url) return '';
  let clean = url.trim();
  // Remove trailing slashes and path suffixes like /manager, /api, etc.
  clean = clean.replace(/\/(manager|api|v1|v2)?\/?$/i, '').replace(/\/+$/, '');
  // Validate it looks like a proper URL
  try {
    const parsed = new URL(clean);
    // Ensure it uses https or http
    if (!parsed.protocol.startsWith('http')) {
      console.error('⚠️ URL Evolution inválida (protocolo):', clean);
      return '';
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    console.error('⚠️ URL Evolution malformada, ignorando:', clean);
    return '';
  }
}

function stringifyProviderError(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(' | ');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.message ?? obj.error ?? obj.details ?? obj.reason;

    if (typeof nested === 'string') return nested;
    if (Array.isArray(nested)) {
      return nested
        .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join(' | ');
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function isEvolutionDisconnectedError(message: string): boolean {
  if (!message) return false;

  return [
    /connection closed/i,
    /inst[aâ]ncia desconectada/i,
    /instance.*disconnected/i,
    /session.*closed/i,
    /not connected/i,
    /reconnect via qr code/i,
    /scan.*qr/i,
  ].some((pattern) => pattern.test(message));
}

// Input validation schema
const enviarWhatsAppSchema = z.object({
  numero: z.string().refine((val) => {
    const isDigits = /^[0-9]{10,15}$/.test(val);
    const isGroupJid = /@g\.us$/.test(val);
    const isContactJid = /@s\.whatsapp\.net$/.test(val);
    return isDigits || isGroupJid || isContactJid;
  }, 'Informe dígitos (10-15), JID de contato @s.whatsapp.net ou grupo @g.us'),
  mensagem: z.string().max(65536, 'Mensagem muito longa').optional(),
  tipo_mensagem: z.enum(['text', 'texto', 'image', 'audio', 'video', 'document', 'pdf', 'template', 'interactive_buttons', 'interactive_list']).optional(),
  interactive: z.any().optional(),
  mediaUrl: z.string().url('URL de mídia inválida').optional(),
  mediaBase64: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  company_id: z.string().uuid('Company ID deve ser UUID válido').optional(),
  quoted: z.object({
    key: z.object({ id: z.string() }),
    message: z.object({ conversation: z.string() })
  }).optional(),
  quotedMessageId: z.string().optional(),
  force_provider: z.enum(['evolution', 'meta']).optional(),
  // Template support for Meta API (required for first message / mass dispatch)
  template_name: z.string().optional(),
  template_language: z.string().optional(),
  template_components: z.array(z.any()).optional(),
}).refine(data => data.mensagem || data.mediaUrl || data.mediaBase64 || data.template_name, {
  message: 'Mensagem, mídia URL, mídia Base64 ou template é obrigatório'
});

function normalizeMimeType(mimeType?: string): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

function isMetaSupportedAudioMime(mimeType: string): boolean {
  return ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/opus'].includes(mimeType);
}

function isLikelyOggAudioBase64(base64Data: string): boolean {
  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const header = atob(cleanBase64.slice(0, 24));
    return header.startsWith('OggS');
  } catch {
    return false;
  }
}

// Sanitize template components - remove invalid entries that would cause Meta API errors
function sanitizeTemplateComponents(components?: any[]): any[] | undefined {
  if (!components || components.length === 0) return undefined;
  
  const validTypes = ['header', 'body', 'button'];
  const validButtonSubTypes = ['quick_reply', 'url', 'copy_code', 'flow'];
  
  const sanitized = components.filter((comp: any) => {
    if (!comp || !comp.type) return false;
    const compType = comp.type.toLowerCase();
    
    if (!validTypes.includes(compType)) {
      console.warn("⚠️ Removendo componente com tipo inválido:", comp.type);
      return false;
    }
    
    // Button components MUST have sub_type
    if (compType === 'button') {
      if (!comp.sub_type || !validButtonSubTypes.includes(comp.sub_type)) {
        console.warn("⚠️ Removendo componente button com sub_type inválido:", comp.sub_type);
        return false;
      }
      // Button must have index
      if (comp.index === undefined || comp.index === null) {
        console.warn("⚠️ Removendo componente button sem index");
        return false;
      }
    }
    
    // Header and body must have parameters
    if ((compType === 'header' || compType === 'body') && (!comp.parameters || comp.parameters.length === 0)) {
      console.warn("⚠️ Removendo componente sem parameters:", compType);
      return false;
    }
    
    return true;
  });
  
  return sanitized.length > 0 ? sanitized : undefined;
}

// Fetch template structure from Meta API to auto-build required button and header components
async function fetchTemplateAutoComponents(
  wabaId: string,
  accessToken: string,
  templateName: string
): Promise<{ buttons: any[] | null; header: any | null }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${wabaId}/message_templates?name=${templateName}&limit=1`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.warn("⚠️ Não foi possível buscar template da Meta:", response.status);
      return { buttons: null, header: null };
    }
    const data = await response.json();
    const template = data.data?.[0];
    console.log("📋 Template encontrado:", template?.name, "- Componentes:", JSON.stringify(template?.components?.map((c: any) => c.type)));
    if (!template?.components) return { buttons: null, header: null };

    // === AUTO-GENERATE HEADER COMPONENT (for video/image/document) ===
    let headerComponent: any | null = null;
    const headerComp = template.components.find((c: any) => c.type === "HEADER");
    if (headerComp?.format && headerComp.format !== "TEXT") {
      const mediaFormat = headerComp.format.toLowerCase(); // video, image, document
      const handleValue = headerComp.example?.header_handle?.[0];
      if (handleValue) {
        const isUrl = handleValue.startsWith('http://') || handleValue.startsWith('https://');
        const mediaRef = isUrl ? { link: handleValue } : { id: handleValue };
        headerComponent = {
          type: "header",
          parameters: [{ type: mediaFormat, [mediaFormat]: mediaRef }],
        };
        console.log(`🎬 Auto-gerado header ${mediaFormat} com ${isUrl ? 'link' : 'id'}:`, handleValue.substring(0, 80));
      }
    }

    // === AUTO-GENERATE BUTTON COMPONENTS ===
    const buttonsComp = template.components.find((c: any) => c.type === "BUTTONS");
    let buttonComponents: any[] | null = null;
    if (buttonsComp?.buttons?.length) {
      console.log("🔘 Botões encontrados:", JSON.stringify(buttonsComp.buttons.map((b: any) => ({ type: b.type, text: b.text }))));
      const btns: any[] = [];
      buttonsComp.buttons.forEach((btn: any, index: number) => {
        if (btn.type === "QUICK_REPLY") {
          btns.push({
            type: "button",
            sub_type: "quick_reply",
            index: String(index),
            parameters: [{ type: "payload", payload: btn.text || `btn_${index}` }],
          });
        } else if (btn.type === "FLOW") {
          btns.push({
            type: "button",
            sub_type: "flow",
            index: String(index),
            parameters: [],
          });
        } else if (btn.type === "URL" && btn.url?.includes("{{")) {
          btns.push({
            type: "button",
            sub_type: "url",
            index: String(index),
            parameters: [{ type: "text", text: "" }],
          });
        }
      });
      console.log("✅ Componentes de botão gerados:", btns.length);
      buttonComponents = btns.length > 0 ? btns : null;
    }

    return { buttons: buttonComponents, header: headerComponent };
  } catch (e) {
    console.warn("⚠️ Erro ao buscar template auto-components:", e);
    return { buttons: null, header: null };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getTemplateHeaderFallbackMimeType(mediaType: 'image' | 'video' | 'document'): string {
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'image') return 'image/jpeg';
  return 'application/pdf';
}

function getTemplateHeaderFileName(mediaLink: string, mediaType: 'image' | 'video' | 'document', templateName: string, mimeType: string): string {
  try {
    const pathname = new URL(mediaLink).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop();

    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // ignore URL parsing and fallback to generated filename
  }

  const fallbackExtension = mimeType.includes('video')
    ? 'mp4'
    : mimeType.includes('image')
      ? 'jpg'
      : 'pdf';

  return `${templateName}.${fallbackExtension}`;
}

function normalizeTemplateName(templateName: string): string {
  return templateName.trim().toLowerCase();
}

async function uploadTemplateHeaderMediaByLink(
  phoneNumberId: string,
  accessToken: string,
  templateName: string,
  mediaType: 'image' | 'video' | 'document',
  mediaLink: string,
): Promise<{ success: boolean; media_id?: string; error?: string }> {
  try {
    console.log(`⬇️ Baixando mídia do header do template (${mediaType}) para upload próprio...`);

    const mediaResponse = await fetch(mediaLink);
    if (!mediaResponse.ok) {
      return {
        success: false,
        error: `Falha ao baixar mídia do template (${mediaResponse.status})`,
      };
    }

    const mimeType = normalizeMimeType(mediaResponse.headers.get('content-type') || '') || getTemplateHeaderFallbackMimeType(mediaType);
    const fileName = getTemplateHeaderFileName(mediaLink, mediaType, templateName, mimeType);
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const mediaBase64 = arrayBufferToBase64(mediaBuffer);

    console.log(`📤 Convertendo header do template para media_id: ${fileName} (${mimeType})`);

    return await uploadMetaMedia(
      phoneNumberId,
      accessToken,
      mediaBase64,
      mimeType,
      fileName,
    );
  } catch (error) {
    console.error('❌ Erro ao preparar mídia do header do template:', error);
    return { success: false, error: String(error) };
  }
}

async function ensureTemplateHeaderMediaIds(
  phoneNumberId: string,
  accessToken: string,
  templateName: string,
  components?: any[],
): Promise<any[] | undefined> {
  if (!components?.length) return components;

  const updatedComponents: any[] = [];

  for (const component of components) {
    const componentType = component?.type?.toLowerCase?.();
    if (componentType !== 'header' || !Array.isArray(component?.parameters)) {
      updatedComponents.push(component);
      continue;
    }

    const nextComponent = JSON.parse(JSON.stringify(component));

    for (const parameter of nextComponent.parameters) {
      const mediaType = parameter?.type?.toLowerCase?.();
      if (!mediaType || !['image', 'video', 'document'].includes(mediaType)) {
        continue;
      }

      const mediaPayload = parameter?.[mediaType];
      const mediaLink = mediaPayload?.link;
      if (!mediaLink || mediaPayload?.id) {
        continue;
      }

      const uploadResult = await uploadTemplateHeaderMediaByLink(
        phoneNumberId,
        accessToken,
        templateName,
        mediaType as 'image' | 'video' | 'document',
        mediaLink,
      );

      if (uploadResult.success && uploadResult.media_id) {
        parameter[mediaType] = { id: uploadResult.media_id };
        console.log(`✅ Header ${mediaType} do template convertido para media_id`);
      } else {
        console.warn(`⚠️ Não foi possível converter link do header ${mediaType} para media_id. Mantendo link original.`, uploadResult.error);
      }
    }

    updatedComponents.push(nextComponent);
  }

  return updatedComponents;
}

// Lookup the correct template language from Meta API (auto-correction)
async function lookupTemplateLanguage(
  wabaId: string,
  accessToken: string,
  templateName: string,
  fallbackLanguage: string
): Promise<string> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}&limit=10`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.warn("⚠️ Não foi possível buscar idioma do template:", response.status);
      return fallbackLanguage;
    }
    const data = await response.json();
    const templates = data.data || [];
    if (templates.length === 0) {
      console.warn(`⚠️ Template '${templateName}' não encontrado na Meta API`);
      return fallbackLanguage;
    }
    // Try exact match first, then first approved, then first available
    const exactMatch = templates.find((t: any) => t.language === fallbackLanguage && t.status === 'APPROVED');
    if (exactMatch) return exactMatch.language;
    const approvedMatch = templates.find((t: any) => t.status === 'APPROVED');
    if (approvedMatch) {
      console.log(`🔄 Auto-corrigindo idioma do template '${templateName}': ${fallbackLanguage} → ${approvedMatch.language}`);
      return approvedMatch.language;
    }
    return templates[0]?.language || fallbackLanguage;
  } catch (e) {
    console.warn("⚠️ Erro ao buscar idioma do template:", e);
    return fallbackLanguage;
  }
}

async function resolveMetaTemplateNameAndLanguage(
  wabaId: string,
  accessToken: string,
  templateName: string,
  fallbackLanguage: string,
): Promise<{ exists: boolean; name: string; language: string; error?: string }> {
  const normalizedTemplateName = normalizeTemplateName(templateName);

  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${wabaId}/message_templates?fields=id,name,status,language&name=${encodeURIComponent(normalizedTemplateName)}&limit=50`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn("⚠️ Não foi possível validar o nome do template na Meta:", response.status);
      return {
        exists: true,
        name: normalizedTemplateName,
        language: fallbackLanguage,
      };
    }

    const data = await response.json();
    const templates = Array.isArray(data.data) ? data.data : [];

    if (templates.length === 0) {
      return {
        exists: false,
        name: normalizedTemplateName,
        language: fallbackLanguage,
        error: `Template '${templateName}' não existe mais na Meta. Atualize a sincronização dos templates e tente novamente.`,
      };
    }

    const sameNameTemplates = templates.filter((template: any) => normalizeTemplateName(template.name || '') === normalizedTemplateName);
    const exactApprovedMatch = sameNameTemplates.find((template: any) => template.language === fallbackLanguage && template.status === 'APPROVED');
    const approvedMatch = sameNameTemplates.find((template: any) => template.status === 'APPROVED');
    const fallbackMatch = sameNameTemplates[0] || templates[0];
    const resolvedTemplate = exactApprovedMatch || approvedMatch || fallbackMatch;

    if (!resolvedTemplate) {
      return {
        exists: false,
        name: normalizedTemplateName,
        language: fallbackLanguage,
        error: `Template '${templateName}' não foi localizado na Meta.`,
      };
    }

    const resolvedLanguage = resolvedTemplate.language || fallbackLanguage;

    if (resolvedTemplate.name && resolvedTemplate.name !== templateName) {
      console.log(`🔄 Auto-corrigindo nome do template '${templateName}': ${resolvedTemplate.name}`);
    }

    if (resolvedLanguage !== fallbackLanguage) {
      console.log(`🔄 Auto-corrigindo idioma do template '${templateName}': ${fallbackLanguage} → ${resolvedLanguage}`);
    }

    return {
      exists: true,
      name: resolvedTemplate.name || normalizedTemplateName,
      language: resolvedLanguage,
    };
  } catch (error) {
    console.warn("⚠️ Erro ao validar template na Meta:", error);
    return {
      exists: true,
      name: normalizedTemplateName,
      language: fallbackLanguage,
    };
  }
}

// Send template message via Meta API
async function sendMetaTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string = 'pt_BR',
  components?: any[],
  wabaId?: string
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;

    // Auto-correct language if WABA ID is available
    let resolvedLanguage = language;
    let resolvedTemplateName = normalizeTemplateName(templateName);
    if (wabaId) {
      const resolvedTemplate = await resolveMetaTemplateNameAndLanguage(
        wabaId,
        accessToken,
        templateName,
        language,
      );

      if (!resolvedTemplate.exists) {
        return {
          success: false,
          provider: 'meta',
          error: resolvedTemplate.error,
        };
      }

      resolvedTemplateName = resolvedTemplate.name;
      resolvedLanguage = resolvedTemplate.language;
    }
    
    // Sanitize components to prevent Meta API errors
    let sanitizedComponents = sanitizeTemplateComponents(components);
    
    // Auto-fetch missing components (header media + buttons) from template structure
    const hasHeaderComponent = sanitizedComponents?.some((c: any) => c.type === 'header');
    const hasButtonComponents = sanitizedComponents?.some((c: any) => c.type === 'button');
    if ((!hasHeaderComponent || !hasButtonComponents) && wabaId) {
      console.log("🔍 Auto-buscando componentes do template na Meta API...");
      const autoComponents = await fetchTemplateAutoComponents(wabaId, accessToken, resolvedTemplateName);
      
      if (!hasHeaderComponent && autoComponents.header) {
        console.log(`✅ Auto-adicionando header de mídia ao template`);
        sanitizedComponents = [autoComponents.header, ...(sanitizedComponents || [])];
      }
      if (!hasButtonComponents && autoComponents.buttons) {
        console.log(`✅ Auto-adicionando ${autoComponents.buttons.length} botões ao template`);
        sanitizedComponents = [...(sanitizedComponents || []), ...autoComponents.buttons];
      }
    }

    sanitizedComponents = await ensureTemplateHeaderMediaIds(
      phoneNumberId,
      accessToken,
      resolvedTemplateName,
      sanitizedComponents,
    );
    
    const templatePayload: any = {
      name: resolvedTemplateName,
      language: { code: resolvedLanguage },
    };
    
    if (sanitizedComponents && sanitizedComponents.length > 0) {
      templatePayload.components = sanitizedComponents;
    }

    const fullPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: templatePayload
    };

    console.log("📤 Meta API - Enviando template:", resolvedTemplateName);
    console.log("📦 Template payload:", JSON.stringify(fullPayload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Template Error:', data);
      const metaErrorMessage = data.error?.message || 'Erro ao enviar template Meta API';

      if (data.error?.code === 132001 || /Template name does not exist in the translation/i.test(metaErrorMessage)) {
        return {
          success: false,
          provider: 'meta',
          error: `Template '${resolvedTemplateName}' não existe na tradução ${resolvedLanguage} da Meta. Recarregue os templates sincronizados antes de enviar.`,
        };
      }

      return { success: false, provider: 'meta', error: metaErrorMessage };
    }

    console.log("✅ Meta API - Template enviado:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Template Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

// ============= META API FUNCTIONS =============
async function sendMetaTextMessage(
  phoneNumberId: string, 
  accessToken: string, 
  to: string, 
  text: string
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
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
      return { success: false, provider: 'meta', error: data.error?.message || 'Erro Meta API' };
    }

    console.log("✅ Meta API - Mensagem enviada:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

// Upload media to Meta API and get media_id
async function uploadMetaMedia(
  phoneNumberId: string,
  accessToken: string,
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<{ success: boolean; media_id?: string; error?: string }> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Sanitize mimeType: Meta API rejects parameters like "; codecs=opus"
    const cleanMimeType = normalizeMimeType(mimeType);
    
    // Convert base64 to binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create form data for upload
    const formData = new FormData();
    const blob = new Blob([bytes], { type: cleanMimeType });
    formData.append('file', blob, fileName);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', cleanMimeType);
    
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/media`;
    
    console.log("📤 Meta API - Uploading media:", fileName, cleanMimeType);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Upload Error:', data);
      return { success: false, error: data.error?.message || 'Erro upload mídia Meta API' };
    }

    console.log("✅ Meta API - Media uploaded:", data.id);
    return { success: true, media_id: data.id };
  } catch (error) {
    console.error('Meta API Upload Exception:', error);
    return { success: false, error: String(error) };
  }
}

// Send media using media_id (uploaded) or URL
async function sendMetaMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaUrlOrId: string,
  mediaType: 'image' | 'video' | 'audio' | 'document',
  caption?: string,
  isMediaId: boolean = false
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
    
    // Use 'id' for uploaded media or 'link' for URL
    const mediaPayload: any = isMediaId ? { id: mediaUrlOrId } : { link: mediaUrlOrId };
    if (caption && ['image', 'video', 'document'].includes(mediaType)) {
      mediaPayload.caption = caption;
    }
    // For audio, add filename if document
    if (mediaType === 'document' && !mediaPayload.filename) {
      mediaPayload.filename = 'documento';
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
      return { success: false, provider: 'meta', error: data.error?.message || 'Erro Meta API Media' };
    }

    console.log("✅ Meta API - Mídia enviada:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Media Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

// ============= EVOLUTION CONNECTION STATE CHECK =============
async function checkEvolutionConnectionState(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<boolean> {
  try {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/instance/connectionState/${instanceName}`;
    console.log("🔍 Verificando estado real da conexão Evolution:", url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'apikey': apiKey },
    });
    
    if (!response.ok) {
      console.warn("⚠️ Falha ao verificar estado Evolution:", response.status);
      // Se não conseguir verificar, assumir conectado para não bloquear envio
      // O envio em si falhará se realmente desconectado
      return true;
    }
    
    const data = await response.json();
    console.log("📡 Resposta completa connectionState:", JSON.stringify(data));
    
    // Verificar múltiplos formatos de resposta da Evolution API
    const state = (
      data?.instance?.state || 
      data?.state || 
      data?.instance?.connectionStatus || 
      data?.connectionStatus ||
      data?.instance?.status ||
      ''
    ).toLowerCase();
    
    console.log("📡 Estado real Evolution:", state);
    
    // Aceitar variações de estado conectado
    const connectedStates = ['open', 'connected', 'online', 'syncing'];
    return connectedStates.includes(state);
  } catch (error) {
    console.error("❌ Erro ao verificar estado Evolution:", error);
    // Em caso de erro de rede na verificação, tentar enviar mesmo assim
    return true;
  }
}

// ============= META FALLBACK HELPER =============
async function sendMetaFallback(
  connection: any,
  formattedNumber: string,
  validatedData: any
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  console.log("🔄 Meta API fallback ativado...");
  
  if (validatedData.template_name) {
    return await sendMetaTemplateMessage(
      connection.meta_phone_number_id,
      connection.meta_access_token,
      formattedNumber,
      validatedData.template_name,
      validatedData.template_language || 'pt_BR',
      validatedData.template_components,
      connection.meta_business_account_id
    );
  }
  
  if (validatedData.mediaBase64) {
    let mimeType = validatedData.mimeType || 'application/octet-stream';
    const fileName = validatedData.fileName || 'arquivo';
    let mediaType = validatedData.tipo_mensagem || 'document';
    if (mediaType === 'texto') mediaType = 'text';
    if (mediaType === 'pdf') mediaType = 'document';

    let uploadMime = normalizeMimeType(mimeType) || 'application/octet-stream';
    let uploadFileName = fileName;

    // ⚡ Para áudio: só enviar como áudio se MIME + payload forem realmente compatíveis
    if (mediaType === 'audio') {
      const cleanMime = normalizeMimeType(mimeType);
      const isOggPayload = isLikelyOggAudioBase64(validatedData.mediaBase64);

      if (cleanMime === 'audio/ogg' && isOggPayload) {
        uploadMime = 'audio/ogg';
        uploadFileName = 'audio.ogg';
      } else if (isMetaSupportedAudioMime(cleanMime)) {
        uploadMime = cleanMime;
      } else if (isOggPayload) {
        uploadMime = 'audio/ogg';
        uploadFileName = 'audio.ogg';
      } else {
        const reason = `MIME não suportado pela Meta (${cleanMime || 'desconhecido'})`;
        console.warn(`⚠️ [MetaFallback] Áudio incompatível com Meta API (${reason})`);
        return {
          success: false,
          provider: 'meta',
          error: `Áudio incompatível com API oficial (${reason}). Grave novamente e envie em MP3/OGG válido.`
        };
      }
    }

    const uploadResult = await uploadMetaMedia(
      connection.meta_phone_number_id,
      connection.meta_access_token,
      validatedData.mediaBase64,
      uploadMime,
      uploadFileName
    );

    if (uploadResult.success && uploadResult.media_id) {
      return await sendMetaMediaMessage(
        connection.meta_phone_number_id,
        connection.meta_access_token,
        formattedNumber,
        uploadResult.media_id,
        mediaType as 'image' | 'video' | 'audio' | 'document',
        mediaType === 'audio' ? undefined : (validatedData.mensagem || validatedData.caption),
        true
      );
    }
  }
  
  if (validatedData.mediaUrl) {
    let mediaType = validatedData.tipo_mensagem || 'image';
    if (mediaType === 'texto') mediaType = 'text';
    if (mediaType === 'pdf') mediaType = 'document';
    return await sendMetaMediaMessage(
      connection.meta_phone_number_id,
      connection.meta_access_token,
      formattedNumber,
      validatedData.mediaUrl,
      mediaType as 'image' | 'video' | 'audio' | 'document',
      validatedData.mensagem || validatedData.caption,
      false
    );
  }
  
  if (validatedData.mensagem) {
    const result = await sendMetaTextMessage(
      connection.meta_phone_number_id,
      connection.meta_access_token,
      formattedNumber,
      validatedData.mensagem
    );
    if (!result.success && (result.error?.includes('Re-engagement message') || result.error?.includes('outside the allowed window'))) {
      result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
    }
    return result;
  }
  
  return { success: false, provider: 'meta', error: 'Nenhum conteúdo válido para enviar via Meta API' };
}

// ============= EVOLUTION API FUNCTIONS =============

// Tentar reconectar instância Evolution API - OTIMIZADO para falhar rápido (max ~6s)
async function tryReconnectInstance(baseUrl: string, instanceName: string, apiKey: string): Promise<boolean> {
  try {
    console.log(`🔄 Tentando reconectar instância ${instanceName}...`);
    
    async function checkState(): Promise<string> {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
          method: "GET",
          headers: { "apikey": apiKey },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          return (data?.instance?.state || data?.state || '').toLowerCase();
        }
      } catch (_e) { /* ignore */ }
      return '';
    }
    
    const connectedStates = ['open', 'connected'];
    
    // 1. Verificar estado atual
    const currentState = await checkState();
    console.log(`📡 Estado atual da instância ${instanceName}: ${currentState}`);
    
    if (connectedStates.includes(currentState)) {
      console.log(`✅ Instância ${instanceName} já está conectada!`);
      return true;
    }
    
    // 2. Tentar restart (POST primeiro, depois PUT) - sem polling longo
    for (const method of ['POST', 'PUT']) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const restartRes = await fetch(`${baseUrl}/instance/restart/${instanceName}`, {
          method,
          headers: { "apikey": apiKey, "Content-Type": "application/json" },
          signal: controller.signal,
        });
        
        if (restartRes.ok) {
          console.log(`✅ Restart (${method}) solicitado para ${instanceName}`);
          // Esperar 3 segundos e verificar UMA vez
          await new Promise(resolve => setTimeout(resolve, 3000));
          const state = await checkState();
          console.log(`📡 Estado após restart: ${state}`);
          if (connectedStates.includes(state)) return true;
          break; // Restart funcionou mas não conectou, não tentar outro método
        }
      } catch (_e) { /* ignore */ }
    }
    
    // 3. Tentar connect como fallback rápido
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const connectRes = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: { "apikey": apiKey },
        signal: controller.signal,
      });
      
      if (connectRes.ok) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const state = await checkState();
        console.log(`📡 Estado após connect: ${state}`);
        if (connectedStates.includes(state)) return true;
      }
    } catch (_e) { /* ignore */ }
    
    console.log(`❌ Reconexão falhou para ${instanceName}`);
    return false;
  } catch (error) {
    console.error(`❌ Erro ao tentar reconectar ${instanceName}:`, error);
    return false;
  }
}

async function sendEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  target: string,
  isGroup: boolean,
  validatedData: any,
  _retryAttempt: number = 0
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    let evolutionUrl: string;
    let bodyPayload: any;
    const targetNumber = isGroup ? target : target.replace(/[^0-9]/g, '');
    const globalEvolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const canRetryWithGlobalKey = _retryAttempt === 0 && !!globalEvolutionKey && globalEvolutionKey !== apiKey;

    if (validatedData.mediaBase64) {
      let mediaType = validatedData.tipo_mensagem || 'document';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';

      if (mediaType === 'audio') {
        evolutionUrl = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`;
        bodyPayload = {
          number: targetNumber,
          audio: validatedData.mediaBase64,
          delay: 1200,
        };
      } else {
        evolutionUrl = `${baseUrl}/message/sendMedia/${instanceName}`;

        let mimeType = validatedData.mimeType;
        if (!mimeType) {
          const fileName = validatedData.fileName?.toLowerCase() || '';
          if (mediaType === 'image') {
            mimeType = fileName.endsWith('.png') ? 'image/png' : 
                      fileName.endsWith('.gif') ? 'image/gif' : 
                      fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          } else if (mediaType === 'video') {
            mimeType = 'video/mp4';
          } else {
            mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
          }
        }

        bodyPayload = {
          number: targetNumber,
          mediatype: mediaType,
          mimetype: mimeType,
          caption: validatedData.caption || validatedData.mensagem || '',
          fileName: validatedData.fileName || 'arquivo',
          media: validatedData.mediaBase64,
        };
      }
    } else if (validatedData.mediaUrl) {
      evolutionUrl = `${baseUrl}/message/sendMedia/${instanceName}`;
      let mediaType = validatedData.tipo_mensagem || 'image';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';

      bodyPayload = {
        number: targetNumber,
        mediatype: mediaType,
        media: validatedData.mediaUrl,
        caption: validatedData.mensagem || validatedData.caption || ""
      };
    } else {
      evolutionUrl = `${baseUrl}/message/sendText/${instanceName}`;
      bodyPayload = {
        number: targetNumber,
        text: validatedData.mensagem,
        ...(validatedData.quoted ? { options: { quoted: validatedData.quoted } } : {}),
      };
    }

    console.log("📤 Evolution API - Enviando para:", evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(bodyPayload),
    });

    const responseText = await response.text();
    let data: any = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (_parseError) {
      console.error("❌ Evolution API retornou resposta não-JSON:", responseText.substring(0, 200));

      if (response.status === 401 && canRetryWithGlobalKey) {
        console.warn("🔑 Chave da conexão falhou com 401; tentando chave global da Evolution...");
        return sendEvolutionMessage(baseUrl, instanceName, globalEvolutionKey, target, isGroup, validatedData, 1);
      }

      if (_retryAttempt === 0) {
        console.log("🔄 Servidor instável - tentando reconectar...");
        const reconnected = await tryReconnectInstance(baseUrl, instanceName, apiKey);
        if (reconnected) {
          return sendEvolutionMessage(baseUrl, instanceName, apiKey, target, isGroup, validatedData, 1);
        }
      }

      return {
        success: false,
        provider: 'evolution',
        error: 'Servidor Evolution API instável. Tentamos reconectar automaticamente.'
      };
    }

    if (!response.ok) {
      console.error("Evolution API Error:", data);
      const rawError = data?.response?.message?.[0] ?? data?.response?.message ?? data?.message ?? data?.error ?? data;
      const errorMsg = stringifyProviderError(rawError) || 'Falha na Evolution API';

      if (response.status === 401 && canRetryWithGlobalKey) {
        console.warn("🔑 Evolution retornou 401 com a chave da conexão; tentando chave global...");
        return sendEvolutionMessage(baseUrl, instanceName, globalEvolutionKey, target, isGroup, validatedData, 1);
      }

      const isDisconnected = isEvolutionDisconnectedError(errorMsg);

      if (isDisconnected) {
        console.warn("⚠️ Instância WhatsApp com erro de conexão:", errorMsg);

        const stillConnected = await checkEvolutionConnectionState(baseUrl, instanceName, apiKey);
        if (stillConnected) {
          console.warn("⚠️ [EVOLUTION] Instância segue conectada. Retornando erro temporário sem marcar desconexão.");
          return {
            success: false,
            provider: 'evolution',
            error: `Falha temporária da Evolution API: ${errorMsg}`
          };
        }

        if (_retryAttempt === 0) {
          console.log("🔄 Tentando auto-reconexão antes de desistir...");
          const reconnected = await tryReconnectInstance(baseUrl, instanceName, apiKey);

          if (reconnected) {
            console.log("✅ Reconexão bem-sucedida! Reenviando mensagem...");
            return sendEvolutionMessage(baseUrl, instanceName, apiKey, target, isGroup, validatedData, 1);
          } else {
            console.warn("❌ Auto-reconexão falhou. A instância pode precisar de QR Code.");
          }
        }

        return {
          success: false,
          provider: 'evolution',
          error: 'Instância desconectada. Tentamos reconectar automaticamente mas falhou. Reconecte via QR Code nas Configurações.'
        };
      }

      return { success: false, provider: 'evolution', error: errorMsg };
    }

    console.log("✅ Evolution API - Mensagem enviada");
    return { success: true, provider: 'evolution', data };
  } catch (error) {
    const errorStr = String(error);
    console.error('Evolution API Exception:', errorStr);

    if (errorStr.includes('Connection closed') || errorStr.includes('connection reset') || errorStr.includes('ECONNREFUSED')) {
      return {
        success: false,
        provider: 'evolution',
        error: 'Servidor Evolution API não está respondendo. Verifique se o servidor está online.'
      };
    }

    return { success: false, provider: 'evolution', error: errorStr };
  }
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate input
    let validatedData;
    try {
      validatedData = enviarWhatsAppSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Dados inválidos:", error.errors);
        return new Response(
          JSON.stringify({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: error.errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    console.log("📨 Pedido de envio validado para:", validatedData.numero);

    // Environment variables
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar conexão WhatsApp da company
    if (!validatedData.company_id) {
      return new Response(
        JSON.stringify({ error: "company_id é obrigatório", code: "NO_COMPANY_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão mais recente da empresa (evita usar registro antigo/stale)
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('company_id', validatedData.company_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError || !connection) {
      console.error("❌ Conexão não encontrada:", connError);
      return new Response(
        JSON.stringify({ error: "Nenhuma conexão WhatsApp ativa", code: "NO_WHATSAPP_CONNECTION" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ⚡ Centralizar resolução de URL Evolution - sanitizar UMA vez
    const resolvedEvolutionUrl = sanitizeEvolutionUrl(connection.evolution_api_url || EVOLUTION_API_URL);
    const resolvedEvolutionKey = connection.evolution_api_key || EVOLUTION_API_KEY;
    
    console.log("🔗 Evolution URL resolvida:", resolvedEvolutionUrl || "(vazio)");

    // Verificar se há pelo menos uma API disponível
    const hasMetaCredentials = !!(connection.meta_phone_number_id && connection.meta_access_token);
    const hasEvolutionConfig = !!(resolvedEvolutionUrl && resolvedEvolutionKey && connection.instance_name);
    const evolutionConnected = ['connected', 'open'].includes(String(connection.status || '').toLowerCase());

    // Se não tem nenhuma API configurada OU (Evolution desconectado E não tem Meta)
    if (!hasMetaCredentials && !hasEvolutionConfig) {
      console.error("❌ Nenhuma API WhatsApp configurada");
      return new Response(
        JSON.stringify({ error: "Nenhuma conexão WhatsApp configurada", code: "NO_WHATSAPP_CONFIG" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // ⚡ CORREÇÃO: NÃO bloquear envio baseado no status do banco de dados.
    // O status pode estar desatualizado. Tentar enviar diretamente e deixar
    // a Evolution API retornar erro se realmente desconectada.
    // Se falhar, o handler de erro já atualiza o status no banco.
    if (!hasMetaCredentials && hasEvolutionConfig && !evolutionConnected) {
      console.warn("⚠️ Evolution API com status 'desconectado' no banco, mas tentando enviar mesmo assim (status pode estar desatualizado)");
    }

    console.log("🔗 Conexão encontrada:", {
      instanceName: connection.instance_name,
      apiProvider: connection.api_provider,
      status: connection.status,
      hasEvolution: hasEvolutionConfig,
      evolutionConnected,
      hasMeta: hasMetaCredentials
    });

    // Determinar provider a usar
    // 🔥 CORREÇÃO CRÍTICA: Quando 'both', respeitar force_provider para manter consistência do canal
    // Se force_provider foi passado (origemApi da conversa), usar essa API específica
    const apiProvider = validatedData.force_provider || connection.api_provider || 'evolution';
    const isGroup = /@g\.us$/.test(validatedData.numero);
    
    console.log("🎯 Provider selecionado:", { 
      force_provider: validatedData.force_provider, 
      connection_api_provider: connection.api_provider,
      final_provider: apiProvider 
    });
    
    // Formatar número para Meta API (adicionar código do país se necessário)
    let formattedNumber = validatedData.numero.replace(/[^0-9]/g, '');
    
    // Se o número não começa com 55 e tem 10 ou 11 dígitos, adicionar código do país
    if (!formattedNumber.startsWith('55') && (formattedNumber.length === 10 || formattedNumber.length === 11)) {
      formattedNumber = '55' + formattedNumber;
    }
    
    // Se já tem 55 no início, garantir que o formato está correto
    // Números brasileiros: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos total
    if (formattedNumber.startsWith('55') && formattedNumber.length < 12) {
      console.warn("⚠️ Número pode estar incompleto:", formattedNumber, "length:", formattedNumber.length);
    }

    console.log("🔀 Router - Provider:", apiProvider, "| Grupo:", isGroup, "| Número formatado:", formattedNumber);

    // ============= INTERACTIVE MESSAGE HANDLING =============
    // Convert interactive_buttons/interactive_list to native interactive messages
    if (validatedData.tipo_mensagem === 'interactive_buttons' || validatedData.tipo_mensagem === 'interactive_list') {
      const interactive = (body as any).interactive;
      console.log("🔘 Mensagem interativa detectada:", validatedData.tipo_mensagem);
      
      // IMPORTANT: Evolution API v2.3.x has a confirmed bug where sendButtons wraps
      // messages in viewOnceMessage, making buttons non-clickable (GitHub issues #2028, #2390, #2404).
      // Therefore, ALWAYS prefer Meta API for interactive messages when available.
      if (hasMetaCredentials) {
        try {
          const url = `${META_API_BASE_URL}/${META_API_VERSION}/${connection.meta_phone_number_id}/messages`;
          const interactivePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedNumber,
            type: 'interactive',
            interactive: interactive,
          };
          
          console.log("📘 Meta API - Forçando envio interativo via Meta (Evolution não suporta botões clicáveis)...");
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.meta_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(interactivePayload),
          });
          
          const data = await response.json();
          if (response.ok) {
            console.log("✅ Meta API - Mensagem interativa com botões clicáveis enviada:", data.messages?.[0]?.id);
            return new Response(
              JSON.stringify({ success: true, provider: 'meta', message_id: data.messages?.[0]?.id, data }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.error("❌ Meta API Interactive Error:", data);
            // Fall through to Evolution text fallback
          }
        } catch (e) {
          console.error("❌ Meta Interactive Exception:", e);
        }
      }
      
      // For Evolution API: send interactive buttons/lists as text with numbered options
      // NOTE: /message/sendButtons/ in Evolution API v2.x wraps in viewOnceMessage which is broken
      // Using formatted text with numbered options as reliable fallback
      if ((apiProvider === 'evolution' || apiProvider === 'both') && hasEvolutionConfig) {
        try {
          const baseUrl = resolvedEvolutionUrl;
          const apiKey = resolvedEvolutionKey;
          const targetNumber = formattedNumber;
          
          const bodyText = interactive?.body?.text || validatedData.mensagem || '';
          
          // Build a well-formatted text message with numbered options
          let formattedMessage = bodyText;
          
          if (interactive?.type === 'button' && interactive?.action?.buttons) {
            const buttons = interactive.action.buttons;
            formattedMessage += '\n';
            buttons.forEach((btn: any, i: number) => {
              const label = btn.reply?.title || `Opção ${i + 1}`;
              formattedMessage += `\n${i + 1}️⃣ ${label}`;
            });
          } else if (interactive?.type === 'list' && interactive?.action?.sections) {
            formattedMessage += '\n';
            let optionIndex = 1;
            for (const section of interactive.action.sections) {
              if (section.title) {
                formattedMessage += `\n*${section.title}*`;
              }
              for (const row of (section.rows || [])) {
                const label = row.title || `Opção ${optionIndex}`;
                formattedMessage += `\n${optionIndex}️⃣ ${label}`;
                if (row.description) {
                  formattedMessage += ` - ${row.description}`;
                }
                optionIndex++;
              }
            }
          }
          
          const sendTextUrl = `${baseUrl}/message/sendText/${connection.instance_name}`;
          console.log("📱 Evolution API - Enviando menu como texto formatado:", sendTextUrl);
          
          const response = await fetch(sendTextUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              number: targetNumber,
              text: formattedMessage,
            }),
          });
          
          const data = await response.json();
          if (response.ok) {
            console.log("✅ Evolution API - Menu interativo enviado como texto!");
            return new Response(
              JSON.stringify({ success: true, provider: 'evolution', data }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            console.error("❌ Evolution API sendText (interactive fallback) Error:", data);
            // Fall through to text fallback below
          }
        } catch (e) {
          console.error("❌ Evolution API Interactive Exception:", e);
        }
      }
      
      // Final Fallback: convert to numbered text menu
      console.log("⚠️ Fallback: convertendo interativo para texto simples");
      if (interactive?.body?.text && interactive?.action) {
        let textMenu = interactive.body.text + "\n\n";
        if (interactive.type === 'button' && interactive.action.buttons) {
          interactive.action.buttons.forEach((btn: any, i: number) => {
            textMenu += `${i + 1}️⃣ ${btn.reply?.title || `Opção ${i + 1}`}\n`;
          });
        } else if (interactive.type === 'list' && interactive.action.sections) {
          for (const section of interactive.action.sections) {
            for (const row of (section.rows || [])) {
              textMenu += `▪️ ${row.title}\n`;
            }
          }
        }
        validatedData.mensagem = textMenu.trim();
        validatedData.tipo_mensagem = 'text';
        console.log("📝 Convertido para texto:", validatedData.mensagem);
      } else {
        // Just use the original message text
        validatedData.tipo_mensagem = 'text';
      }
    }

    // ============= ROTEAMENTO DE MENSAGENS =============
    let result: { success: boolean; provider: string; data?: any; error?: string };

    // Meta API não suporta grupos - usar Evolution automaticamente
    if (isGroup) {
      console.log("📱 Grupo detectado - Usando Evolution API (Meta não suporta grupos)");
      // Sanitizar URL removendo paths extras como /manager/, /api/, etc.
      const baseUrl = resolvedEvolutionUrl;
      const apiKey = resolvedEvolutionKey;
      
      if (!baseUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "Evolution API não configurada para grupos", code: "NO_EVOLUTION_CONFIG" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      result = await sendEvolutionMessage(
        baseUrl,
        connection.instance_name,
        apiKey,
        validatedData.numero,
        true,
        validatedData
      );
    }
    // Meta API (apenas quando provider é explicitamente "meta")
    // Quando "both", usar Evolution como principal (mais estável para envio direto)
    else if (apiProvider === 'meta') {
      const hasMetaCredentials = connection.meta_phone_number_id && connection.meta_access_token;
      const hasEvolutionConfig = (connection.evolution_api_url || EVOLUTION_API_URL) && 
                                  (connection.evolution_api_key || EVOLUTION_API_KEY);
      
      // ⚠️ Meta API com base64 - tentar upload para Meta, fallback para Evolution
      if (validatedData.mediaBase64 && hasMetaCredentials) {
        console.log("📤 Base64 detectado - Tentando upload para Meta API...");
        
        let mediaType = validatedData.tipo_mensagem || 'document';
        if (mediaType === 'texto') mediaType = 'text';
        if (mediaType === 'pdf') mediaType = 'document';
        
        const mimeType = validatedData.mimeType || 'application/octet-stream';
        const cleanMimeType = normalizeMimeType(mimeType) || 'application/octet-stream';
        const fileName = validatedData.fileName || 'arquivo';

        const isAudioMessage = mediaType === 'audio';
        const isSupportedAudioMime = !isAudioMessage || isMetaSupportedAudioMime(cleanMimeType);
        const isValidOggPayload = !isAudioMessage || cleanMimeType !== 'audio/ogg' || isLikelyOggAudioBase64(validatedData.mediaBase64);

        if (isAudioMessage && (!isSupportedAudioMime || !isValidOggPayload)) {
          const reason = !isSupportedAudioMime
            ? `MIME não suportado pela Meta (${cleanMimeType})`
            : 'conteúdo não corresponde a áudio OGG válido';
          console.warn(`⚠️ Áudio incompatível com Meta API (${reason})`);

          // Se o payload for OGG real, corrigir só o MIME e enviar como áudio
          const isActuallyOgg = isLikelyOggAudioBase64(validatedData.mediaBase64);
          if (isActuallyOgg) {
            console.log('🔄 Conteúdo é OGG válido, reenviando com MIME correto (audio/ogg)...');
            const uploadOgg = await uploadMetaMedia(
              connection.meta_phone_number_id,
              connection.meta_access_token,
              validatedData.mediaBase64,
              'audio/ogg',
              'audio.ogg'
            );

            if (uploadOgg.success && uploadOgg.media_id) {
              result = await sendMetaMediaMessage(
                connection.meta_phone_number_id,
                connection.meta_access_token,
                formattedNumber,
                uploadOgg.media_id,
                'audio',
                undefined,
                true
              );
            }
          }

          // Sem fallback para Evolution nesse cenário para não gerar falso positivo de entrega.
          if (!result?.success) {
            result = {
              success: false,
              provider: 'meta',
              error: `Áudio incompatível com API oficial (${reason}). Grave novamente e envie em MP3/OGG válido.`
            };
          }
        } else {
          // Upload media to Meta
          const uploadResult = await uploadMetaMedia(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            validatedData.mediaBase64,
            cleanMimeType,
            fileName
          );

          if (uploadResult.success && uploadResult.media_id) {
            // Send message with uploaded media_id
            result = await sendMetaMediaMessage(
              connection.meta_phone_number_id,
              connection.meta_access_token,
              formattedNumber,
              uploadResult.media_id,
              mediaType as 'image' | 'video' | 'audio' | 'document',
              validatedData.mensagem || validatedData.caption,
              true // isMediaId = true
            );
          } else {
            console.log("⚠️ Upload Meta falhou:", uploadResult.error);

            // Para áudio na API oficial, não fazer fallback para Evolution (evita comportamento inconsistente)
            if (mediaType === 'audio') {
              result = { success: false, provider: 'meta', error: uploadResult.error || 'Falha no upload de áudio na API oficial' };
            }
            // Para os demais tipos, manter fallback para Evolution se disponível
            else if (hasEvolutionConfig) {
              console.log("🔄 Tentando Evolution como fallback...");
              const baseUrl = resolvedEvolutionUrl;
              const apiKey = resolvedEvolutionKey;

              result = await sendEvolutionMessage(
                baseUrl,
                connection.instance_name,
                apiKey,
                validatedData.numero,
                false,
                validatedData
              );
            } else {
              result = { success: false, provider: 'meta', error: uploadResult.error || 'Falha no upload de mídia' };
            }
          }
        }
      }
      // Base64 sem credenciais Meta - usar Evolution direto
      else if (validatedData.mediaBase64 && hasEvolutionConfig) {
        console.log("📤 Base64 sem Meta - usando Evolution API...");
        const baseUrl = resolvedEvolutionUrl;
        const apiKey = resolvedEvolutionKey;
        
        result = await sendEvolutionMessage(
          baseUrl,
          connection.instance_name,
          apiKey,
          validatedData.numero,
          false,
          validatedData
        );
      }
      // Template message (para primeira mensagem / disparo em massa)
      else if (hasMetaCredentials && validatedData.template_name) {
        console.log("📘 Tentando Meta API com template:", validatedData.template_name);
        result = await sendMetaTemplateMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.template_name,
          validatedData.template_language || 'pt_BR',
          validatedData.template_components,
          connection.meta_business_account_id
        );
        
        // Fallback para Evolution se Meta falhar e provider for "both"
        if (!result.success && apiProvider === 'both' && hasEvolutionConfig) {
          console.log("🔄 Template Meta falhou, tentando Evolution como fallback...");
          const baseUrl = resolvedEvolutionUrl;
          const apiKey = resolvedEvolutionKey;
          
          result = await sendEvolutionMessage(
            baseUrl,
            connection.instance_name,
            apiKey,
            validatedData.numero,
            false,
            validatedData
          );
        }
      }
      else if (hasMetaCredentials && validatedData.mediaUrl) {
        console.log("📘 Tentando Meta API com URL de mídia...");
        
        let mediaType = validatedData.tipo_mensagem || 'image';
        if (mediaType === 'texto') mediaType = 'text';
        if (mediaType === 'pdf') mediaType = 'document';
        
        result = await sendMetaMediaMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.mediaUrl,
          mediaType as 'image' | 'video' | 'audio' | 'document',
          validatedData.mensagem || validatedData.caption,
          false // isMediaId = false (using URL)
        );
        
        // Detectar erro de janela de 24h e sugerir template
        if (!result.success && result.error?.includes('Re-engagement message')) {
          console.log("⚠️ Janela de 24h expirada - necessário usar template");
          result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
        }
      } else if (hasMetaCredentials && validatedData.mensagem) {
        console.log("📘 Tentando Meta API com texto...");
        result = await sendMetaTextMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.mensagem
        );

        // Detectar erro de janela de 24h e sugerir template
        if (!result.success && (result.error?.includes('Re-engagement message') || result.error?.includes('outside the allowed window'))) {
          console.log("⚠️ Janela de 24h expirada - necessário usar template");
          result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
        }

        // Fallback para Evolution se Meta falhar e provider for "both"
        if (!result.success && apiProvider === 'both' && hasEvolutionConfig) {
          console.log("🔄 Meta falhou, tentando Evolution como fallback...");
          const baseUrl = resolvedEvolutionUrl;
          const apiKey = resolvedEvolutionKey;
          
          result = await sendEvolutionMessage(
            baseUrl,
            connection.instance_name,
            apiKey,
            validatedData.numero,
            false,
            validatedData
          );
        }
      } else if (hasEvolutionConfig) {
        // Sem credenciais Meta mas Evolution disponível - usar Evolution
        console.log("⚠️ Sem credenciais Meta - usando Evolution");
        const baseUrl = resolvedEvolutionUrl;
        const apiKey = resolvedEvolutionKey;
        
        result = await sendEvolutionMessage(
          baseUrl,
          connection.instance_name,
          apiKey,
          validatedData.numero,
          false,
          validatedData
        );
      } else {
        // Sem mensagem nem mídia válida e sem Evolution
        console.log("⚠️ Sem mensagem/mídia válida e sem Evolution");
        result = { success: false, provider: 'meta', error: 'Mensagem, mídia, template ou Evolution API é obrigatória' };
      }
    }
    // Both APIs - NOVA LÓGICA: Respeitar canal de origem para manter consistência
    // Se force_provider está definido (vem da origemApi da conversa), já foi tratado acima
    // Se chegou aqui com 'both', usar Evolution como principal (se conectado), Meta como fallback
    else if (apiProvider === 'both') {
      console.log("📗📘 Provider 'both' - Usando lógica de fallback (sem force_provider)");
      const baseUrl = resolvedEvolutionUrl;
      const apiKey = resolvedEvolutionKey;
      
      // Se Evolution está desconectada, ir direto para Meta
      if (!evolutionConnected) {
        console.log("📘 Evolution desconectada - Usando Meta API diretamente...");
        
        // Template message - prioridade máxima para disparo em massa
        if (hasMetaCredentials && validatedData.template_name) {
          console.log("📘 Enviando template via Meta API:", validatedData.template_name);
          result = await sendMetaTemplateMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            validatedData.template_name,
            validatedData.template_language || 'pt_BR',
            validatedData.template_components,
            connection.meta_business_account_id
          );
        } else if (hasMetaCredentials && validatedData.mediaBase64) {
          // Importante: quando provider é 'both' e Evolution está desconectada,
          // ainda precisamos tratar base64 (especialmente áudio) via Meta.
          result = await sendMetaFallback(connection, formattedNumber, validatedData);
        } else if (hasMetaCredentials && validatedData.mensagem) {
          result = await sendMetaTextMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            validatedData.mensagem
          );
          
          // Detectar erro de janela de 24h
          if (!result.success && (result.error?.includes('Re-engagement message') || result.error?.includes('outside the allowed window'))) {
            console.log("⚠️ Janela de 24h expirada - necessário usar template");
            result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
          }
        } else if (hasMetaCredentials && validatedData.mediaUrl) {
          let mediaType = validatedData.tipo_mensagem || 'image';
          if (mediaType === 'texto') mediaType = 'text';
          if (mediaType === 'pdf') mediaType = 'document';
          if (mediaType === 'template') mediaType = 'document'; // Fallback
          
          result = await sendMetaMediaMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            validatedData.mediaUrl,
            mediaType as 'image' | 'video' | 'audio' | 'document',
            validatedData.mensagem || validatedData.caption,
            false
          );
        } else if (!hasMetaCredentials) {
          return new Response(
            JSON.stringify({ error: "WhatsApp Evolution desconectado e Meta API não configurada. Reconecte sua instância.", code: "ALL_APIS_UNAVAILABLE" }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          result = { success: false, provider: 'meta', error: 'Mensagem, mídia ou template é obrigatório' };
        }
      }
      // Evolution está conectada (DB) - enviar direto sem pre-check
      else {
        if (!baseUrl || !apiKey) {
          if (hasMetaCredentials) {
            console.log("⚠️ Evolution não configurada, tentando Meta...");
            result = await sendMetaFallback(connection, formattedNumber, validatedData);
          } else {
            return new Response(
              JSON.stringify({ error: "Nenhuma API configurada corretamente", code: "NO_API_CONFIG" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
            // ⚡ ENVIO DIRETO - sem pre-check de conexão. sendEvolutionMessage já tem retry interno.
            result = await sendEvolutionMessage(baseUrl, connection.instance_name, apiKey, validatedData.numero, false, validatedData);
            
            // Se Evolution falhou, tentar Meta como fallback
            if (!result.success && hasMetaCredentials) {
              console.log("🔄 Evolution falhou (" + result.error + "), tentando Meta como fallback...");
              result = await sendMetaFallback(connection, formattedNumber, validatedData);
            }
        }
      }
    }
    // Evolution API only
    else {
      console.log("📗 Usando Evolution API...");
      const baseUrl = resolvedEvolutionUrl;
      const apiKey = resolvedEvolutionKey;
      
      if (!baseUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "Evolution API não configurada", code: "NO_EVOLUTION_CONFIG" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ⚡ ENVIO DIRETO - sem pre-check. Se falhar, o handler de erro em sendEvolutionMessage
      // já tenta reconectar automaticamente (1 retry). Isso elimina o delay de 6-10s do pre-check.
      result = await sendEvolutionMessage(baseUrl, connection.instance_name, apiKey, validatedData.numero, false, validatedData);
      
      // Se Evolution falhou, tentar Meta como fallback (sem marcar disconnected no banco)
      if (!result.success) {
        console.warn("⚠️ Evolution falhou:", result.error);
        if (hasMetaCredentials) {
          console.log("🔄 Tentando Meta como fallback...");
          result = await sendMetaFallback(connection, formattedNumber, validatedData);
        }
      }
    }

    // ============= RESPOSTA =============
    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          provider: result.provider,
          message_id: result.data?.messages?.[0]?.id || result.data?.key?.id,
          data: result.data 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorText = result.error || "Falha ao enviar mensagem";
      const isDisconnected = /Instância desconectada|Reconecte via QR Code/i.test(errorText);
      const errorCode = isDisconnected ? "INSTANCE_DISCONNECTED" : "SEND_FAILED";

      // Return 200 with success:false to prevent frontend FunctionsHttpError crash
      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorText,
          provider: result.provider,
          code: errorCode
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});