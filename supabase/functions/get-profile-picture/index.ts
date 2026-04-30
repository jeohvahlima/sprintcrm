import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(`${apiUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({ number: num }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (resp.ok) {
        const data = await resp.json();
        const url = data.profilePictureUrl || data.url || data.profilePicture || data.picture || data.imgUrl || data.profileUrl;
        if (url && typeof url === 'string' && url.startsWith('http')) return url;
      }
    } catch { /* next variation */ }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { number, company_id, channel } = await req.json();
    if (!number || !company_id) {
      return new Response(JSON.stringify({ profilePictureUrl: null, error: 'number e company_id obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar cache no banco (lead com profile_picture_url ainda válida)
    const cleanNumber = String(number).replace(/\D/g, '');
    const { data: existingLead } = await supabase
      .from('leads')
      .select('profile_picture_url, profile_picture_updated_at')
      .eq('company_id', company_id)
      .or(`phone.eq.${cleanNumber},telefone.eq.${cleanNumber}`)
      .maybeSingle();

    if (existingLead?.profile_picture_url && !isWhatsAppUrlExpired(existingLead.profile_picture_url)) {
      // Cache válido - retorna sem hit na API externa
      return new Response(
        JSON.stringify({ profilePictureUrl: existingLead.profile_picture_url, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar config Evolution para a company (tabela whatsapp_connections)
    const { data: instance } = await supabase
      .from('whatsapp_connections')
      .select('instance_name, evolution_api_url, evolution_api_key, api_provider, status, last_connected_at')
      .eq('company_id', company_id)
      .eq('status', 'connected')
      .in('api_provider', ['evolution', 'both'])
      .order('last_connected_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let profilePictureUrl: string | null = null;

    if (instance && channel !== 'instagram') {
      const apiUrl = instance.evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
      const apiKey = instance.evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');
      if (apiUrl && apiKey && instance.instance_name) {
        profilePictureUrl = await fetchProfilePicViaEvolution(
          apiUrl, instance.instance_name, apiKey, cleanNumber
        );
      } else {
        console.log('[get-profile-picture] instância sem credenciais', {
          instance_name: instance.instance_name, hasUrl: !!apiUrl, hasKey: !!apiKey,
        });
      }
    } else if (!instance) {
      console.log('[get-profile-picture] nenhuma whatsapp_connection ativa para company', company_id);
    }

    // 3. Atualizar no DB se encontrou
    if (profilePictureUrl) {
      try {
        await supabase
          .from('leads')
          .update({
            profile_picture_url: profilePictureUrl,
            profile_picture_updated_at: new Date().toISOString(),
          })
          .eq('company_id', company_id)
          .or(`phone.eq.${cleanNumber},telefone.eq.${cleanNumber}`);
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({ profilePictureUrl, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[get-profile-picture] erro:', e);
    return new Response(
      JSON.stringify({ profilePictureUrl: null, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
