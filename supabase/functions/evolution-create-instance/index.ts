import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: servidor não respondeu em ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Extract QR code from various Evolution API response formats
function extractQR(data: any): { qrCodeBase64: string | null; pairingCode: string | null } {
  let qrCodeBase64 = null;
  let pairingCode = null;

  // Try all known QR fields
  if (data?.qrcode?.base64) qrCodeBase64 = data.qrcode.base64;
  else if (data?.base64) qrCodeBase64 = data.base64;
  else if (typeof data?.qrcode === 'string' && data.qrcode.length > 50) qrCodeBase64 = data.qrcode;
  else if (data?.code && typeof data.code === 'string' && data.code.length > 50) qrCodeBase64 = data.code;

  // Pairing code
  pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || null;

  return { qrCodeBase64, pairingCode };
}

// Resolve the best Evolution API URL and key for a company
async function resolveEvolutionCredentials(
  supabase: any,
  companyId: string | null,
  instanceName: string | null,
  globalUrl: string,
  globalKey: string
): Promise<{ url: string; key: string }> {
  // 1. Try instance-specific credentials
  if (instanceName) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('evolution_api_url, evolution_api_key')
      .eq('instance_name', instanceName)
      .single();
    if (data?.evolution_api_url && data?.evolution_api_key) {
      console.log('🔑 [RESOLVE] Usando credenciais da instância:', instanceName);
      return { url: data.evolution_api_url.replace(/\/+$/, ''), key: data.evolution_api_key };
    }
  }

  // 2. Try any connection from the same company
  if (companyId) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('evolution_api_url, evolution_api_key')
      .eq('company_id', companyId)
      .not('evolution_api_url', 'is', null)
      .limit(1)
      .single();
    if (data?.evolution_api_url && data?.evolution_api_key) {
      console.log('🔑 [RESOLVE] Usando credenciais da empresa:', companyId);
      return { url: data.evolution_api_url.replace(/\/+$/, ''), key: data.evolution_api_key };
    }
  }

  // 3. Try any connection from related companies (parent/children)
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('parent_company_id')
      .eq('id', companyId)
      .single();

    const parentId = company?.parent_company_id;
    // Get all related company IDs (parent + siblings + children)
    const relatedIds: string[] = [];
    if (parentId) relatedIds.push(parentId);
    
    // Children of current company
    const { data: children } = await supabase
      .from('companies')
      .select('id')
      .eq('parent_company_id', companyId);
    if (children) relatedIds.push(...children.map((c: any) => c.id));

    // Siblings (children of parent)
    if (parentId) {
      const { data: siblings } = await supabase
        .from('companies')
        .select('id')
        .eq('parent_company_id', parentId);
      if (siblings) relatedIds.push(...siblings.map((c: any) => c.id));
    }

    if (relatedIds.length > 0) {
      const { data } = await supabase
        .from('whatsapp_connections')
        .select('evolution_api_url, evolution_api_key')
        .in('company_id', relatedIds)
        .not('evolution_api_url', 'is', null)
        .limit(1)
        .single();
      if (data?.evolution_api_url && data?.evolution_api_key) {
        console.log('🔑 [RESOLVE] Usando credenciais de empresa relacionada');
        return { url: data.evolution_api_url.replace(/\/+$/, ''), key: data.evolution_api_key };
      }
    }
  }

  // 4. Fallback to global secrets
  console.log('🔑 [RESOLVE] Usando credenciais globais (fallback)');
  return { url: globalUrl.replace(/\/+$/, ''), key: globalKey };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') ?? '';
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? '';

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, instanceName, companyId } = body;

    console.log('📱 [EVOLUTION-CREATE] Action:', action, 'Instance:', instanceName);

    // ============ ACTION: create ============
    if (action === 'create') {
      if (!instanceName || !companyId) {
        return new Response(JSON.stringify({ error: 'instanceName e companyId são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Resolve correct URL and key from DB (related company connections)
      const resolved = await resolveEvolutionCredentials(
        supabase, companyId, null, EVOLUTION_API_URL, EVOLUTION_API_KEY
      );
      const baseUrl = resolved.url;

      if (!baseUrl) {
        return new Response(
          JSON.stringify({ error: 'URL da Evolution API não configurada. Verifique as configurações.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('🔧 [EVOLUTION] Criando instância:', instanceName, '| Host:', baseUrl.replace(/https?:\/\//, '').split('/')[0]);

      // Collect ALL unique API keys to try (from same host + global)
      const keysToTry: string[] = [];
      // 1. Resolved key first
      if (resolved.key) keysToTry.push(resolved.key);
      // 2. Global key
      if (EVOLUTION_API_KEY && !keysToTry.includes(EVOLUTION_API_KEY)) keysToTry.push(EVOLUTION_API_KEY);
      // 3. All other keys from connections on the same host
      const normalizedBase = baseUrl.replace(/\/+$/, '').toLowerCase();
      const { data: allConns } = await supabase
        .from('whatsapp_connections')
        .select('evolution_api_key, evolution_api_url')
        .not('evolution_api_key', 'is', null)
        .not('evolution_api_url', 'is', null);
      if (allConns) {
        for (const conn of allConns) {
          const connUrl = (conn.evolution_api_url || '').replace(/\/+$/, '').toLowerCase();
          if (connUrl === normalizedBase && conn.evolution_api_key && !keysToTry.includes(conn.evolution_api_key)) {
            keysToTry.push(conn.evolution_api_key);
          }
        }
      }

      console.log(`🔑 [EVOLUTION] ${keysToTry.length} keys disponíveis para tentar`);

      // 1. Create instance on Evolution API - try each key until one works
      let createData: any;
      let usedKey = '';
      let createSuccess = false;
      const createPayload = JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });

      try {
        for (const tryKey of keysToTry) {
          console.log(`🔑 [EVOLUTION] Tentando key: ${tryKey.substring(0, 8)}...`);
          const createRes = await fetchWithTimeout(`${baseUrl}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': tryKey },
            body: createPayload,
          }, 20000);

          createData = await createRes.json();
          console.log('📡 [EVOLUTION] Resposta create:', JSON.stringify(createData));

          if (createRes.ok) {
            usedKey = tryKey;
            createSuccess = true;
            console.log('✅ [EVOLUTION] Instância criada com sucesso!');
            break;
          }

          // Instance already exists - also treat as success
          if (createData?.response?.message?.includes?.('already') || createRes.status === 403) {
            usedKey = tryKey;
            createSuccess = true;
            console.log('⚠️ [EVOLUTION] Instância já existe, tentando conectar...');
            break;
          }

          // 401 = wrong key, try next
          if (createRes.status === 401) {
            console.log('🔄 [EVOLUTION] Key deu 401, tentando próxima...');
            continue;
          }

          // Other error - stop trying
          console.error('❌ [EVOLUTION] Erro não-auth:', createRes.status, JSON.stringify(createData));
          return new Response(JSON.stringify({ error: 'Erro ao criar instância na Evolution API', details: createData }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!createSuccess) {
          console.error('❌ [EVOLUTION] Todas as keys falharam com 401');
          return new Response(JSON.stringify({ 
            error: 'Nenhuma API Key tem permissão para criar instâncias neste servidor. Verifique a API Key global da Evolution API nas configurações.'
          }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (err: any) {
        console.error('❌ [EVOLUTION] Erro ao criar instância:', err.message);
        const isTimeout = err.message?.includes('Timeout') || err.message?.includes('timed out');
        return new Response(JSON.stringify({ 
          error: isTimeout 
            ? 'Servidor da Evolution API não respondeu. Verifique se o servidor está online.' 
            : `Erro de conexão com a Evolution API: ${err.message}`
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Configure webhook automatically
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const webhookUrl = `${supabaseUrl}/functions/v1/webhook-conversas?instance=${instanceName}`;
      console.log('🔗 [EVOLUTION] Configurando webhook:', webhookUrl);

      try {
        await fetchWithTimeout(`${baseUrl}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': usedKey },
          body: JSON.stringify({
            webhook: {
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: true,
              events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'CONTACTS_UPSERT'],
              enabled: true,
            }
          }),
        }, 10000);
        console.log('✅ [EVOLUTION] Webhook configurado');
      } catch (whErr) {
        console.error('⚠️ [EVOLUTION] Erro ao configurar webhook (não crítico):', whErr);
      }

      // 3. Extract QR code
      let { qrCodeBase64, pairingCode } = extractQR(createData);

      // If no QR from create, try connect endpoint
      if (!qrCodeBase64) {
        console.log('🔄 [EVOLUTION] Buscando QR via connect endpoint...');
        try {
          const connectRes = await fetchWithTimeout(`${baseUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'apikey': usedKey },
          }, 15000);
          const connectData = await connectRes.json();
          console.log('📡 [EVOLUTION] Resposta connect:', JSON.stringify(connectData));
          const extracted = extractQR(connectData);
          qrCodeBase64 = extracted.qrCodeBase64;
          pairingCode = pairingCode || extracted.pairingCode;
        } catch (err) {
          console.error('❌ [EVOLUTION] Erro ao buscar QR via connect:', err);
        }
      }

      // Log QR format for debugging
      if (qrCodeBase64) {
        const isDataUri = qrCodeBase64.startsWith('data:');
        const len = qrCodeBase64.length;
        console.log(`📊 [EVOLUTION] QR recebido: formato=${isDataUri ? 'data-uri' : 'base64'}, tamanho=${len}`);
      } else {
        console.log('⚠️ [EVOLUTION] Nenhum QR code retornado pela API');
      }

      // 4. Save connection in database
      const { data: conn, error: dbError } = await supabase
        .from('whatsapp_connections')
        .upsert({
          company_id: companyId,
          instance_name: instanceName,
          evolution_api_url: baseUrl,
          evolution_api_key: usedKey,
          status: 'connecting',
          qr_code_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        }, { onConflict: 'instance_name' })
        .select()
        .single();

      if (dbError) {
        console.error('❌ [DB] Erro ao salvar conexão:', dbError);
        return new Response(JSON.stringify({ error: 'Erro ao salvar conexão no banco', details: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        connection: conn,
        qrcode: qrCodeBase64,
        pairingCode,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ ACTION: refresh_qr ============
    if (action === 'refresh_qr') {
      if (!instanceName) {
        return new Response(JSON.stringify({ error: 'instanceName é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { url: instanceBaseUrl, key: instanceApiKey } = await resolveEvolutionCredentials(
        supabase, companyId || null, instanceName, EVOLUTION_API_URL, EVOLUTION_API_KEY
      );

      console.log('🔄 [EVOLUTION] Refresh QR para:', instanceName, '| Host:', instanceBaseUrl.replace(/https?:\/\//, '').split('/')[0]);

      try {
        const connectRes = await fetchWithTimeout(`${instanceBaseUrl}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'apikey': instanceApiKey },
        }, 15000);
        const connectData = await connectRes.json();
        console.log('📡 [EVOLUTION] Resposta refresh:', JSON.stringify(connectData));

        const { qrCodeBase64, pairingCode } = extractQR(connectData);

        if (!qrCodeBase64 && !pairingCode) {
          return new Response(JSON.stringify({
            success: false,
            error: 'A API não retornou QR Code. A instância pode já estar conectada ou o servidor está indisponível.',
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          qrcode: qrCodeBase64,
          pairingCode,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        console.error('❌ [EVOLUTION] Erro ao refresh QR:', err.message);
        return new Response(JSON.stringify({
          success: false,
          error: err.message?.includes('Timeout')
            ? 'Servidor da Evolution API não respondeu'
            : `Erro: ${err.message}`,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ============ ACTION: check_status ============
    if (action === 'check_status') {
      if (!instanceName && !companyId) {
        return new Response(JSON.stringify({ error: 'instanceName ou companyId é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const connQuery = instanceName
        ? supabase.from('whatsapp_connections').select('*').eq('instance_name', instanceName).single()
        : supabase.from('whatsapp_connections').select('*').eq('company_id', companyId).single();
      
      const { data: connData } = await connQuery;
      const apiProvider = connData?.api_provider || 'evolution';

      // ============ META API CHECK ============
      if (apiProvider === 'meta' || apiProvider === 'both') {
        const metaToken = connData?.meta_access_token;
        const metaPhoneId = connData?.meta_phone_number_id;

        if (!metaToken || !metaPhoneId) {
          if (apiProvider === 'meta') {
            return new Response(JSON.stringify({
              success: true, state: 'disconnected', isConnected: false, provider: 'meta',
              reason: 'Meta API não configurada',
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          try {
            const metaRes = await fetchWithTimeout(
              `https://graph.facebook.com/v18.0/${metaPhoneId}?fields=verified_name,quality_rating,display_phone_number&access_token=${metaToken}`,
              { method: 'GET' }, 10000
            );
            const metaData = await metaRes.json();
            
            if (metaRes.ok && metaData.verified_name) {
              await supabase.from('whatsapp_connections').update({
                status: 'connected', last_connected_at: new Date().toISOString(),
              }).eq('id', connData.id);

              return new Response(JSON.stringify({
                success: true, state: 'connected', isConnected: true, provider: 'meta',
                verified_name: metaData.verified_name, quality_rating: metaData.quality_rating,
                display_phone_number: metaData.display_phone_number,
              }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else if (apiProvider === 'meta') {
              await supabase.from('whatsapp_connections').update({ status: 'disconnected' }).eq('id', connData.id);
              return new Response(JSON.stringify({
                success: true, state: 'disconnected', isConnected: false, provider: 'meta',
                reason: metaData?.error?.message || 'Token Meta inválido',
              }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch (metaErr) {
            if (apiProvider === 'meta') {
              return new Response(JSON.stringify({
                success: true, state: 'error', isConnected: false, provider: 'meta', reason: String(metaErr),
              }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
        }
      }

      // ============ EVOLUTION API CHECK ============
      if (apiProvider === 'evolution' || apiProvider === 'both') {
        const instName = instanceName || connData?.instance_name;
        if (!instName) {
          return new Response(JSON.stringify({ error: 'instanceName é obrigatório para Evolution API' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { url: evoUrl, key: evoKey } = await resolveEvolutionCredentials(
          supabase, companyId || connData?.company_id, instName, EVOLUTION_API_URL, EVOLUTION_API_KEY
        );

        console.log('🔍 [EVOLUTION] Verificando status:', instName, '| Host:', evoUrl.replace(/https?:\/\//, '').split('/')[0]);

        try {
          const stateRes = await fetchWithTimeout(`${evoUrl}/instance/connectionState/${instName}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
          }, 10000);
          const stateData = await stateRes.json();
          console.log('📡 [EVOLUTION] Estado:', JSON.stringify(stateData));

          const state = stateData?.instance?.state || stateData?.state || 'unknown';
          const isConnected = state === 'open' || state === 'connected';

          if (isConnected && connData) {
            await supabase.from('whatsapp_connections').update({
              status: 'connected', last_connected_at: new Date().toISOString(),
            }).eq('id', connData.id);

            // Re-configure webhook
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const webhookUrl = `${supabaseUrl}/functions/v1/webhook-conversas?instance=${instName}`;
            try {
              await fetchWithTimeout(`${evoUrl}/webhook/set/${instName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
                body: JSON.stringify({
                  webhook: {
                    url: webhookUrl, webhookByEvents: false, webhookBase64: true,
                    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'CONTACTS_UPSERT'],
                    enabled: true,
                  }
                }),
              }, 10000);
            } catch (whErr) {
              console.error('⚠️ [EVOLUTION] Erro ao re-configurar webhook:', whErr);
            }
          }

          return new Response(JSON.stringify({
            success: true, state, isConnected, provider: 'evolution',
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (err: any) {
          console.error('❌ [EVOLUTION] Erro ao verificar status:', err.message);
          return new Response(JSON.stringify({
            success: true, state: 'error', isConnected: false, provider: 'evolution',
            reason: err.message?.includes('Timeout') ? 'Servidor não respondeu' : err.message,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({
        success: true, state: 'unknown', isConnected: false, reason: 'Nenhum provedor configurado',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use: create, refresh_qr, check_status' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [EVOLUTION-CREATE] Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
