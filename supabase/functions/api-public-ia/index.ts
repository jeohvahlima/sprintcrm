import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ============================================
// API PÚBLICA DE IA - CHAT WIDGET
// Endpoint para integrar IA no site institucional
// Conecta com ia-atendimento e ia-agendamento
// ============================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInput {
  message: string;
  session_id?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  company_slug?: string;
  context?: 'atendimento' | 'agendamento' | 'auto';
  history?: ChatMessage[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'chat';
    const companySlug = url.searchParams.get('company') || url.searchParams.get('company_slug');

    // Buscar empresa
    let companyId: string | null = null;
    let companyName: string = 'EAZE';
    let ownerId: string | null = null;

    if (companySlug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, owner_user_id')
        .or(`domain.eq.${companySlug},name.ilike.%${companySlug}%`)
        .limit(1)
        .single();

      if (company) {
        companyId = company.id;
        companyName = company.name;
        ownerId = company.owner_user_id;
      }
    }

    // Se não encontrou, usar empresa master
    if (!companyId) {
      const { data: masterCompany } = await supabase
        .from('companies')
        .select('id, name, owner_user_id')
        .eq('is_master_account', true)
        .limit(1)
        .single();

      if (masterCompany) {
        companyId = masterCompany.id;
        companyName = masterCompany.name;
        ownerId = masterCompany.owner_user_id;
      }
    }

    // ============================================
    // POST: Chat com IA
    // ============================================
    if (req.method === 'POST' && action === 'chat') {
      const startTime = Date.now();
      const body: ChatInput = await req.json();

      if (!body.message || body.message.trim().length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mensagem é obrigatória' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Detectar contexto automático
      let context = body.context || 'auto';
      const mensagemLower = body.message.toLowerCase();
      
      if (context === 'auto') {
        // Palavras-chave para agendamento
        const palavrasAgendamento = ['agendar', 'marcar', 'horário', 'horario', 'agenda', 'consulta', 'atendimento', 'visita', 'reunião', 'reuniao', 'disponível', 'disponivel', 'vaga'];
        const ehAgendamento = palavrasAgendamento.some(p => mensagemLower.includes(p));
        
        context = ehAgendamento ? 'agendamento' : 'atendimento';
      }

      console.log(`[api-public-ia] Contexto detectado: ${context}, Mensagem: ${body.message.substring(0, 50)}...`);

      // Buscar prompt personalizado da empresa
      let promptPersonalizado = '';
      if (companyId) {
        const { data: iaConfig } = await supabase
          .from('ia_configurations')
          .select('custom_prompts')
          .eq('company_id', companyId)
          .single();

        if (iaConfig?.custom_prompts) {
          const customPrompts = iaConfig.custom_prompts as any;
          promptPersonalizado = context === 'agendamento' 
            ? (customPrompts.agendamento || '') 
            : (customPrompts.atendimento || customPrompts.default || '');
        }
      }

      // Construir contexto do visitante
      let visitorContext = '';
      if (body.nome || body.telefone || body.email) {
        visitorContext = `
DADOS DO VISITANTE:
- Nome: ${body.nome || 'Não informado'}
- Telefone: ${body.telefone || 'Não informado'}
- Email: ${body.email || 'Não informado'}
`;
      }

      // Se for agendamento, buscar horários disponíveis
      let horariosContext = '';
      if (context === 'agendamento') {
        const hoje = new Date().toISOString().split('T')[0];
        const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        
        // Buscar horários
        const dataInicio = `${hoje}T00:00:00`;
        const dataFim = `${amanha}T23:59:59`;
        
        const { data: compromissos } = await supabase
          .from('compromissos')
          .select('data_hora_inicio')
          .eq('company_id', companyId)
          .gte('data_hora_inicio', dataInicio)
          .lte('data_hora_inicio', dataFim)
          .neq('status', 'cancelado');

        const horariosBase = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
        const horariosOcupados = (compromissos || []).map((c: any) => {
          return new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        });
        
        const horariosLivresHoje = horariosBase.filter(h => !horariosOcupados.includes(h));
        
        horariosContext = `
HORÁRIOS DISPONÍVEIS:
- Hoje (${hoje}): ${horariosLivresHoje.length > 0 ? horariosLivresHoje.join(', ') : 'Sem horários'}
- Amanhã: Consulte disponibilidade

Para agendar, o visitante precisa informar:
1. Nome completo
2. Telefone ou WhatsApp
3. Data e horário desejado
4. Tipo de serviço/consulta
`;
      }

      // Construir system prompt
      let systemPrompt = '';

      if (promptPersonalizado) {
        systemPrompt = `${promptPersonalizado}

${visitorContext}
${horariosContext}

REGRAS:
- Você está no site institucional da ${companyName}
- Seja cordial, profissional e objetivo
- Se o visitante quiser agendar, colete os dados necessários
- Se não souber algo, ofereça contato com um atendente humano
- Mantenha respostas curtas e claras (máximo 3 parágrafos)`;
      } else {
        // Prompt padrão
        systemPrompt = `Você é a assistente virtual da ${companyName}, presente no site institucional.

${visitorContext}
${horariosContext}

SUAS CAPACIDADES:
1. Responder dúvidas sobre a empresa e serviços
2. Ajudar a agendar consultas/reuniões
3. Coletar informações de contato de interessados
4. Direcionar para atendimento humano quando necessário

REGRAS:
- Seja cordial, profissional e objetivo
- Mantenha respostas curtas (máximo 3 parágrafos)
- Se o visitante quiser agendar, colete: nome, telefone, data/horário preferido e tipo de serviço
- Se não souber algo, ofereça contato com atendente humano
- Não invente informações sobre preços ou serviços específicos

AÇÕES (inclua no final da resposta se aplicável):
- [COLETAR_LEAD:nome=X,telefone=Y,email=Z] - quando coletar dados do visitante
- [MOSTRAR_HORARIOS:data=YYYY-MM-DD] - mostrar slots de horário disponíveis em cards clicáveis
- [AGENDAR:data=YYYY-MM-DD,horario=HH:MM,servico=X] - confirmar agendamento (cria lead + compromisso + envia WhatsApp)
- [TRANSFERIR_HUMANO] - quando precisar de atendente humano

IMPORTANTE: Se o visitante quiser agendar, primeiro use MOSTRAR_HORARIOS para mostrar slots, ou colete nome+telefone+data+serviço e use AGENDAR diretamente.`;
      }

      // Construir histórico de mensagens
      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Adicionar histórico se fornecido
      if (body.history && Array.isArray(body.history)) {
        body.history.forEach((msg: ChatMessage) => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      // Adicionar mensagem atual
      messages.push({ role: 'user', content: body.message });

      // Chamar IA
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Muitas requisições. Aguarde alguns segundos.',
              response: 'Estou um pouco sobrecarregada no momento. Por favor, tente novamente em alguns segundos! 😊'
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Serviço temporariamente indisponível.',
              response: 'Desculpe, estou temporariamente indisponível. Por favor, entre em contato por telefone ou WhatsApp.'
            }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Erro da IA: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // Extrair ações da resposta
      const actionPattern = /\[(COLETAR_LEAD|AGENDAR|TRANSFERIR_HUMANO)(:([^\]]+))?\]/g;
      const actions: any[] = [];
      let match;
      
      while ((match = actionPattern.exec(aiResponse)) !== null) {
        const actionType = match[1];
        const actionParams = match[3];
        
        actions.push({
          type: actionType,
          params: actionParams
        });

        // Executar ação de coleta de lead
        if (actionType === 'COLETAR_LEAD' && actionParams && companyId) {
          try {
            const params: Record<string, string> = {};
            actionParams.split(',').forEach((p: string) => {
              const [key, value] = p.split('=');
              if (key && value) params[key.trim()] = value.trim();
            });

            if (params.nome || params.telefone || params.email) {
              // Verificar se já existe
              const telefoneNorm = params.telefone?.replace(/\D/g, '');
              let leadExiste = false;

              if (telefoneNorm) {
                const { data: existe } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', companyId)
                  .or(`telefone.eq.${telefoneNorm},phone.eq.${telefoneNorm}`)
                  .limit(1)
                  .single();
                leadExiste = !!existe;
              }

              if (!leadExiste && params.email) {
                const { data: existe } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', companyId)
                  .eq('email', params.email.toLowerCase())
                  .limit(1)
                  .single();
                leadExiste = !!existe;
              }

              if (!leadExiste) {
                await supabase.from('leads').insert({
                  name: params.nome || 'Visitante Site',
                  telefone: telefoneNorm,
                  phone: telefoneNorm,
                  email: params.email?.toLowerCase(),
                  company_id: companyId,
                  owner_id: ownerId,
                  source: 'chat-ia-site',
                  status: 'novo',
                  tags: ['chat-ia', 'site-institucional'],
                  notes: `Lead captado via chat IA do site em ${new Date().toLocaleString('pt-BR')}`
                });
                console.log('[api-public-ia] Lead criado via chat:', params.nome);
              }
            }
          } catch (e) {
            console.warn('[api-public-ia] Erro ao criar lead:', e);
          }
        }

        // Buscar horários para mostrar em cards
        if (actionType === 'MOSTRAR_HORARIOS' && actionParams && companyId) {
          try {
            const params: Record<string, string> = {};
            actionParams.split(',').forEach((p: string) => {
              const [key, value] = p.split('=');
              if (key && value) params[key.trim()] = value.trim();
            });
            if (params.data) {
              const horRes = await fetch(
                `${supabaseUrl}/functions/v1/api-public-agenda?action=horarios&data=${params.data}&company=${companySlug || ''}`
              );
              const horData = await horRes.json();
              if (horData.success) {
                actions[actions.length - 1].horarios = horData.horarios?.filter((h: any) => h.disponivel) || [];
                actions[actions.length - 1].data = params.data;
              }
            }
          } catch (e) {
            console.warn('[api-public-ia] Erro ao buscar horários:', e);
          }
        }

        // Executar ação de agendamento via api-public-agenda (lead + compromisso + WhatsApp + notifica profissional)
        if (actionType === 'AGENDAR' && actionParams && companyId) {
          try {
            const params: Record<string, string> = {};
            actionParams.split(',').forEach((p: string) => {
              const [key, value] = p.split('=');
              if (key && value) params[key.trim()] = value.trim();
            });

            const nomeFinal = body.nome || params.nome;
            const telFinal = body.telefone || params.telefone;

            if (params.data && params.horario && nomeFinal && telFinal) {
              const agRes = await fetch(
                `${supabaseUrl}/functions/v1/api-public-agenda?action=agendar&company=${companySlug || ''}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nome: nomeFinal,
                    telefone: telFinal,
                    email: body.email || params.email,
                    data: params.data,
                    horario: params.horario,
                    tipo_servico: params.servico || 'Consulta',
                    observacoes: 'Agendado pela IA do chat do site',
                    profissional_id: params.profissional_id,
                    origem: 'ia-chat',
                  }),
                }
              );
              const agData = await agRes.json();
              actions[actions.length - 1].agendamento = agData;
              console.log('[api-public-ia] Agendamento via api-public-agenda:', agData.success);
            }
          } catch (e) {
            console.warn('[api-public-ia] Erro ao agendar via API:', e);
          }
        }
      }

      // Limpar ações da resposta
      const cleanResponse = aiResponse.replace(actionPattern, '').trim();

      const executionTime = Date.now() - startTime;
      console.log(`[api-public-ia] Resposta em ${executionTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          response: cleanResponse,
          context,
          actions: actions.length > 0 ? actions : undefined,
          session_id: body.session_id || crypto.randomUUID(),
          execution_time: executionTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GET: Status da API
    // ============================================
    if (req.method === 'GET' && action === 'status') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'online',
          version: '1.0.0',
          company: companyName,
          endpoints: {
            chat: 'POST /?action=chat',
            status: 'GET /?action=status'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GET: Widget embed code
    // ============================================
    if (req.method === 'GET' && action === 'widget') {
      const embedCode = `
<!-- EAZE Chat Widget -->
<script>
(function() {
  var w = window;
  var d = document;
  var EAZE_CONFIG = {
    apiUrl: '${supabaseUrl}/functions/v1/api-public-ia',
    company: '${companySlug || 'default'}',
    position: 'bottom-right',
    primaryColor: '#8B5CF6',
    title: 'Chat com ${companyName}'
  };
  var s = d.createElement('script');
  s.src = 'https://cdn.eazeplataforma.com/widget.js';
  s.async = true;
  s.onload = function() { w.EAZEChat && w.EAZEChat.init(EAZE_CONFIG); };
  d.head.appendChild(s);
})();
</script>
<!-- End EAZE Chat Widget -->
`;

      return new Response(
        JSON.stringify({
          success: true,
          embed_code: embedCode,
          instructions: 'Cole este código antes do </body> do seu site'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota não encontrada
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Rota não encontrada',
        available_actions: ['chat', 'status', 'widget']
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-public-ia] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno',
        response: 'Desculpe, tive um problema técnico. Por favor, tente novamente ou entre em contato por telefone.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
