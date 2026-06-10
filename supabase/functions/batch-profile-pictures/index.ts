import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar se URL do WhatsApp expirou
function isWhatsAppUrlExpired(url: string): boolean {
  if (!url || !url.includes('pps.whatsapp.net')) return false;
  try {
    const oeMatch = url.match(/[?&]oe=([0-9a-fA-F]+)/);
    if (oeMatch) {
      const expiryTimestamp = parseInt(oeMatch[1], 16);
      const now = Math.floor(Date.now() / 1000);
      return expiryTimestamp < now + 3600;
    }
  } catch { /* ignore */ }
  return false;
}

async function fetchProfilePicViaEvolution(
  apiUrl: string, instanceName: string, apiKey: string, phoneNumber: string
): Promise<string | null> {
  const cleanNumber = String(phoneNumber).replace(/\D/g, '');
  const variations = [
    cleanNumber,
    `55${cleanNumber.replace(/^55/, '')}`,
    cleanNumber.replace(/^55/, ''),
    cleanNumber.slice(-11),
    cleanNumber.slice(-10),
  ].filter((v, i, arr) => v.length >= 8 && arr.indexOf(v) === i);

  for (const num of variations) {
    try {
      const resp = await fetch(`${apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ number: num }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const url = data.profilePictureUrl || data.url || data.profilePicture || data.picture || data.imgUrl || data.profileUrl;
        if (url && typeof url === 'string' && url.startsWith('http')) return url;
      }
    } catch { /* next variation */ }
  }
  return null;
}

async function fetchProfilePicViaMeta(
  accessToken: string, phoneNumberId: string, contactPhone: string
): Promise<string | null> {
  try {
    const cleanNumber = String(contactPhone).replace(/\D/g, '');
    const intlNumber = cleanNumber.startsWith('55') ? `+${cleanNumber}` : `+55${cleanNumber}`;
    
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ blocking: 'wait', contacts: [intlNumber], force_check: true }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const contact = data?.contacts?.[0];
      if (contact?.status === 'valid' && contact.wa_id) {
        const profileResp = await fetch(`https://graph.facebook.com/v21.0/${contact.wa_id}/profile_picture`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (profileResp.ok) {
          const profileData = await profileResp.json();
          if (profileData?.data?.url) return profileData.data.url;
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ⚡ CORREÇÃO: Buscar leads SEM foto E leads com foto EXPIRADA
    const { data: leadsWithout, error: leadsError1 } = await supabase
      .from('leads')
      .select('id, phone, telefone, name, profile_picture_url')
      .eq('company_id', company_id)
      .is('profile_picture_url', null)
      .limit(25);

    const { data: leadsWithPhoto, error: leadsError2 } = await supabase
      .from('leads')
      .select('id, phone, telefone, name, profile_picture_url')
      .eq('company_id', company_id)
      .not('profile_picture_url', 'is', null)
      .limit(50);

    if (leadsError1 || leadsError2) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar leads', details: leadsError1 || leadsError2 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Filtrar leads com URLs expiradas
    const leadsWithExpiredUrl = (leadsWithPhoto || []).filter(lead => 
      lead.profile_picture_url && isWhatsAppUrlExpired(lead.profile_picture_url)
    );

    const leads = [...(leadsWithout || []), ...leadsWithExpiredUrl].slice(0, 100);

    console.log(`📊 [BATCH] ${leadsWithout?.length || 0} sem foto, ${leadsWithExpiredUrl.length} com foto expirada, processando ${leads.length}`);

    if (leads.length === 0) {
      return new Response(JSON.stringify({ updated: 0, failed: 0, total: 0, message: 'Todos os leads já possuem foto válida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar credenciais
    const { data: conn } = await supabase
      .from('whatsapp_connections')
      .select('instance_name, evolution_api_key, evolution_api_url, api_provider, meta_access_token, meta_phone_number_id')
      .eq('company_id', company_id)
      .maybeSingle();

    const hasEvolution = conn?.instance_name && conn?.evolution_api_key && conn?.evolution_api_url;
    const hasMeta = conn?.meta_access_token && conn?.meta_phone_number_id;

    if (!hasEvolution && !hasMeta) {
      return new Response(JSON.stringify({ error: 'Nenhuma API disponível para buscar fotos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let updated = 0;
    let failed = 0;

    for (const lead of leads) {
      const phone = lead.phone || lead.telefone;
      if (!phone) { failed++; continue; }

      let pictureUrl: string | null = null;

      // Tentar Evolution diretamente
      if (hasEvolution) {
        pictureUrl = await fetchProfilePicViaEvolution(
          conn!.evolution_api_url.replace(/\/$/, ''),
          conn!.instance_name,
          conn!.evolution_api_key,
          phone
        );
      }

      // Fallback Meta
      if (!pictureUrl && hasMeta) {
        pictureUrl = await fetchProfilePicViaMeta(
          conn!.meta_access_token,
          conn!.meta_phone_number_id,
          phone
        );
      }

      if (pictureUrl) {
        await supabase
          .from('leads')
          .update({ profile_picture_url: pictureUrl })
          .eq('id', lead.id);
        updated++;
        console.log(`✅ [BATCH] Foto atualizada: ${lead.name || phone}`);
      } else {
        // Se tinha URL expirada e não encontrou nova, limpar
        if (lead.profile_picture_url) {
          await supabase
            .from('leads')
            .update({ profile_picture_url: null })
            .eq('id', lead.id);
          console.log(`🗑️ [BATCH] URL expirada removida: ${lead.name || phone}`);
        }
        failed++;
      }

      // Throttle: 500ms entre cada busca
      await delay(500);
    }

    console.log(`📊 [BATCH] Resultado: ${updated} atualizados, ${failed} sem foto, ${leads.length} total`);

    return new Response(
      JSON.stringify({ updated, failed, total: leads.length, expired_cleaned: leadsWithExpiredUrl.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('❌ [BATCH] Erro:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: err instanceof Error ? err.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
