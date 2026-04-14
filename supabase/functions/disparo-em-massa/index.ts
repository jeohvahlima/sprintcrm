import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_DELAY_SECONDS = 7;
const MIN_DELAY_SECONDS = 1;
const MAX_DELAY_SECONDS = 300;
const MAX_WAIT_PER_INVOCATION_SECONDS = 60;
const SEND_TIMEOUT_MS = 20000;

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned.startsWith('55') && cleaned.length >= 10) {
    cleaned = `55${cleaned}`;
  }
  return cleaned;
}

function getSafeDelaySeconds(delayBetweenMessages: number | null | undefined): number {
  const parsed = Number(delayBetweenMessages);
  if (!Number.isFinite(parsed)) return DEFAULT_DELAY_SECONDS;
  return Math.max(MIN_DELAY_SECONDS, Math.min(MAX_DELAY_SECONDS, Math.floor(parsed)));
}

function getSafeQueueWaitSeconds(waitSeconds: number | null | undefined): number {
  const parsed = Number(waitSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.max(0, Math.floor(parsed));
}

async function sendWhatsAppWithTimeout(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: Record<string, unknown>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/enviar-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha no enviar-whatsapp (${response.status}): ${errorText}`);
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Timeout no enviar-whatsapp após ${Math.round(SEND_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleNextBatch(selfUrl: string, serviceRoleKey: string, campaignId: string, waitSeconds: number) {
  const nextBatchPromise = (async () => {
    const response = await fetch(selfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ campaign_id: campaignId, wait_seconds: waitSeconds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao auto-invocar próximo lote (${response.status}): ${errorText}`);
      return;
    }

    console.log(`✅ Próximo lote da campanha ${campaignId} agendado (espera ${waitSeconds}s)`);
  })().catch((err) => {
    console.error('❌ Erro ao auto-invocar próximo lote:', err.message);
  });

  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(nextBatchPromise);
    return;
  }

  void nextBatchPromise;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { campaign_id, wait_seconds } = body;
    const selfUrl = `${supabaseUrl}/functions/v1/disparo-em-massa`;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestedWaitSeconds = getSafeQueueWaitSeconds(wait_seconds);
    if (requestedWaitSeconds > 0) {
      const waitChunkSeconds = Math.min(requestedWaitSeconds, MAX_WAIT_PER_INVOCATION_SECONDS);
      console.log(`⏳ Aguardando ${waitChunkSeconds}s antes de processar campanha ${campaign_id}`);
      await new Promise((resolve) => setTimeout(resolve, waitChunkSeconds * 1000));

      const remainingWaitSeconds = requestedWaitSeconds - waitChunkSeconds;
      if (remainingWaitSeconds > 0) {
        console.log(`⏱️ Espera longa detectada, reagendando restante (${remainingWaitSeconds}s)`);
        scheduleNextBatch(selfUrl, supabaseServiceKey, campaign_id, remainingWaitSeconds);

        return new Response(JSON.stringify({
          success: true,
          waiting: true,
          remaining_wait_seconds: remainingWaitSeconds,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch campaign
    const { data: campaign, error: fetchErr } = await supabase
      .from('disparo_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (fetchErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Campaign already finished', status: campaign.status }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as sending if not already
    if (campaign.status !== 'sending') {
      await supabase.from('disparo_campaigns').update({
        status: 'sending',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);
    }

    const leads = Array.isArray(campaign.leads_data) ? campaign.leads_data as any[] : [];
    let sentCount = campaign.sent_count || 0;
    let errorCount = campaign.error_count || 0;
    const errorDetails: any[] = campaign.error_details || [];
    const startIndex = sentCount + errorCount;
    const safeDelaySeconds = getSafeDelaySeconds(campaign.delay_between_messages);

    if (startIndex >= leads.length) {
      await supabase.from('disparo_campaigns').update({
        status: 'completed',
        sent_count: sentCount,
        error_count: errorCount,
        error_details: errorDetails,
        is_paused: false,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);

      return new Response(JSON.stringify({
        success: true,
        sent: sentCount,
        errors: errorCount,
        hasMore: false,
        totalProcessed: startIndex,
        total: leads.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🚀 Processando lead ${startIndex + 1}/${leads.length} (campanha: ${campaign.campaign_name}, delay: ${safeDelaySeconds}s)`);

    const lead = leads[startIndex];
    const phone = lead?.telefone || lead?.phone;

    if (!phone) {
      errorCount++;
      errorDetails.push({ lead_id: lead?.id, name: lead?.name, error: 'Sem telefone' });
    } else {
      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone.length < 12) {
        errorCount++;
        errorDetails.push({ lead_id: lead?.id, name: lead?.name, error: 'Telefone inválido' });
      } else {
        try {
          const payload: any = {
            numero: formattedPhone,
            company_id: campaign.company_id,
          };

          if (campaign.message_type === 'text') {
            payload.mensagem = campaign.message_content || '';
            payload.tipo_mensagem = 'text';
          } else if (campaign.message_type === 'template') {
            payload.template_name = campaign.template_name;
            payload.template_language = campaign.template_language;
            payload.template_components = campaign.template_components;
            payload.tipo_mensagem = 'template';
            payload.mensagem = `[Template: ${campaign.template_name}]`;
          } else if (campaign.message_type === 'image' || campaign.message_type === 'video') {
            payload.mensagem = campaign.message_content || '';
            payload.caption = campaign.message_content || '';
            payload.tipo_mensagem = campaign.message_type;
            if (campaign.media_storage_url) {
              payload.mediaUrl = campaign.media_storage_url;
            }
          }

          await sendWhatsAppWithTimeout(supabaseUrl, supabaseServiceKey, payload);

          sentCount++;

          let mensagemConteudo = campaign.message_content || '';
          if (campaign.message_type === 'template') {
            // Fetch actual template body text from DB
            const { data: templateData } = await supabase
              .from('whatsapp_templates')
              .select('components')
              .eq('name', campaign.template_name)
              .eq('company_id', campaign.company_id)
              .limit(1)
              .maybeSingle();

            const bodyComponent = templateData?.components?.find?.((c: any) => c.type === 'BODY');
            const footerComponent = templateData?.components?.find?.((c: any) => c.type === 'FOOTER');
            const buttonsComponent = templateData?.components?.find?.((c: any) => c.type === 'BUTTONS');

            if (bodyComponent?.text) {
              mensagemConteudo = bodyComponent.text;
              if (footerComponent?.text) {
                mensagemConteudo += `\n\n_${footerComponent.text}_`;
              }
              if (buttonsComponent?.buttons?.length) {
                for (const btn of buttonsComponent.buttons) {
                  mensagemConteudo += `\n↪ ${btn.text}`;
                }
              }
            } else {
              mensagemConteudo = `[Template: ${campaign.template_name}]`;
            }
          } else if (campaign.message_type === 'image' && !mensagemConteudo) {
            mensagemConteudo = '[Imagem]';
          } else if (campaign.message_type === 'video' && !mensagemConteudo) {
            mensagemConteudo = '[Vídeo]';
          }

          const conversaData: any = {
            numero: formattedPhone,
            telefone_formatado: formattedPhone,
            mensagem: mensagemConteudo,
            origem: 'WhatsApp',
            status: 'Enviada',
            tipo_mensagem: campaign.message_type,
            nome_contato: lead.name || 'Lead',
            company_id: campaign.company_id,
            lead_id: lead.id,
            campanha_nome: campaign.campaign_name,
            campanha_id: campaign_id,
            fromme: true,
            delivered: true,
            is_group: false,
          };

          if (campaign.media_storage_url && campaign.message_type !== 'text') {
            conversaData.midia_url = campaign.media_storage_url;
          }

          await supabase.from('conversas').insert([conversaData]);

        } catch (error: any) {
          console.error(`❌ Erro ao enviar para ${lead?.name || 'lead'}:`, error.message);
          errorCount++;
          errorDetails.push({ lead_id: lead?.id, name: lead?.name, error: error.message });
        }
      }
    }

    await updateProgress(supabase, campaign_id, sentCount, errorCount, errorDetails);

    const totalProcessed = sentCount + errorCount;
    const hasMore = totalProcessed < leads.length;

    if (hasMore) {
      const pauseAfter = Math.max(0, Number(campaign.pause_after_messages) || 0);
      const pauseDur = Math.max(0, Number(campaign.pause_duration) || 0);

      let nextDelaySeconds = safeDelaySeconds;
      let isPaused = false;

      if (pauseAfter > 0 && totalProcessed % pauseAfter === 0) {
        isPaused = pauseDur > 0;
        nextDelaySeconds += pauseDur;
        if (isPaused) {
          console.log(`⏸️ Pausa automática: ${pauseDur}s após ${totalProcessed} mensagens`);
        }
      }

      await supabase.from('disparo_campaigns').update({
        is_paused: isPaused,
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);

      console.log(`🔄 Invocando próximo lote a partir do index ${totalProcessed} em ${nextDelaySeconds}s...`);

      scheduleNextBatch(selfUrl, supabaseServiceKey, campaign_id, nextDelaySeconds);

    } else {
      // All done - mark completed
      await supabase.from('disparo_campaigns').update({
        status: 'completed',
        sent_count: sentCount,
        error_count: errorCount,
        error_details: errorDetails,
        is_paused: false,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaign_id);

      console.log(`✅ Disparo concluído: ${sentCount} enviados, ${errorCount} erros`);
    }

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      errors: errorCount,
      hasMore,
      totalProcessed,
      total: leads.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erro no disparo em massa:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateProgress(
  supabase: any,
  campaignId: string,
  sentCount: number,
  errorCount: number,
  errorDetails: any[],
) {
  await supabase.from('disparo_campaigns').update({
    sent_count: sentCount,
    error_count: errorCount,
    error_details: errorDetails,
    status: 'sending',
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId);
}
