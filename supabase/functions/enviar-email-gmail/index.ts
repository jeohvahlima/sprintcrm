import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para renovar token se necessário
async function refreshTokenIfNeeded(supabase: any, companyId: string, integration: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(integration.gmail_token_expires_at);
  
  // Se ainda tem mais de 5 minutos, usar token atual
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return integration.gmail_access_token;
  }

  console.log('🔄 [GMAIL-SEND] Renovando token...');

  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: integration.gmail_refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Falha ao renovar token do Gmail');
  }

  const tokens = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

  // Atualizar no banco
  await supabase
    .from('tenant_integrations')
    .update({
      gmail_access_token: tokens.access_token,
      gmail_token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);

  console.log('✅ [GMAIL-SEND] Token renovado');
  return tokens.access_token;
}

// Função para criar email no formato MIME
function createEmail(to: string, from: string, subject: string, body: string, isHtml: boolean = false, inReplyTo?: string, references?: string): string {
  const mimeType = isHtml ? 'text/html' : 'text/plain';
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('', btoa(unescape(encodeURIComponent(body))));
  const email = lines.join('\r\n');
  return btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, to, subject, body, is_html, lead_id } = await req.json();

    if (!company_id || !to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: company_id, to, subject, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar integração
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at, gmail_email, gmail_status')
      .eq('company_id', company_id)
      .single();

    if (integrationError || !integration) {
      console.error('❌ [GMAIL-SEND] Integração não encontrada:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integração Gmail não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (integration.gmail_status !== 'connected' || !integration.gmail_access_token) {
      return new Response(
        JSON.stringify({ error: 'Gmail não está conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 [GMAIL-SEND] Enviando email de:', integration.gmail_email, 'para:', to);

    // Obter token válido
    const accessToken = await refreshTokenIfNeeded(supabase, company_id, integration);

    // Criar e enviar email
    const rawEmail = createEmail(to, integration.gmail_email, subject, body, is_html);

    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEmail }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('❌ [GMAIL-SEND] Erro ao enviar:', errorText);
      
      // Se erro de autenticação, marcar como desconectado
      if (sendResponse.status === 401) {
        await supabase
          .from('tenant_integrations')
          .update({ gmail_status: 'error', updated_at: new Date().toISOString() })
          .eq('company_id', company_id);
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar email', details: errorText }),
        { status: sendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await sendResponse.json();
    console.log('✅ [GMAIL-SEND] Email enviado, message_id:', result.id);

    // Opcional: Salvar registro do email enviado como conversa
    if (lead_id) {
      await supabase.from('conversas').insert({
        company_id,
        lead_id,
        numero: to,
        mensagem: body,
        fromme: true,
        origem: 'email',
        status: 'sent',
        tipo_mensagem: 'text',
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.id,
        thread_id: result.threadId,
        message: 'Email enviado com sucesso!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ [GMAIL-SEND] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
