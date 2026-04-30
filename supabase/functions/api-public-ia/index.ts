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

    let companySegmento: string | null = null;

    if (companySlug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, owner_user_id, segmento, capture_page_config')
        .or(`domain.eq.${companySlug},name.ilike.%${companySlug}%`)
        .limit(1)
        .single();

      if (company) {
        companyId = company.id;
        companyName = company.name;
        ownerId = company.owner_user_id;
        companySegmento = (company as any).segmento || null;
        (globalThis as any).__captureCfg = (company as any).capture_page_config || {};
      }
    }

    // Se não encontrou, usar empresa master
    if (!companyId) {
      const { data: masterCompany } = await supabase
        .from('companies')
        .select('id, name, owner_user_id, segmento, capture_page_config')
        .eq('is_master_account', true)
        .limit(1)
        .single();

      if (masterCompany) {
        companyId = masterCompany.id;
        companyName = masterCompany.name;
        ownerId = masterCompany.owner_user_id;
        companySegmento = (masterCompany as any).segmento || null;
        (globalThis as any).__captureCfg = (masterCompany as any).capture_page_config || {};
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
      // ============================================
      // QUALIFICAÇÃO POR SEGMENTO
      // ============================================
      const QUALIFICACAO_POR_SEGMENTO: Record<string, { contexto: string; perguntas: string[]; criterios: string }> = {
        clinica_medica: {
          contexto: 'Você atende uma clínica médica. Sua função é triar pacientes, identificar urgência e qualificar interesse real.',
          perguntas: [
            'Qual especialidade médica você procura?',
            'É a primeira consulta ou já é paciente?',
            'Qual o sintoma ou motivo da consulta? (sem entrar em detalhes pessoais)',
            'Tem convênio ou seria particular?',
            'Quando gostaria de ser atendido?',
          ],
          criterios: 'QUALIFICADO: descreve sintoma específico, indica urgência, informa convênio/forma de pagamento e prazo. CURIOSO: só quer saber preços/horários sem motivo concreto.',
        },
        clinica_odontologica: {
          contexto: 'Você atende uma clínica odontológica. Triagem por procedimento e urgência.',
          perguntas: [
            'Qual procedimento você procura? (limpeza, ortodontia, implante, estética, urgência)',
            'É um problema agudo (dor) ou tratamento planejado?',
            'Tem convênio ou seria particular?',
            'Já fez avaliação anterior?',
          ],
          criterios: 'QUALIFICADO: procedimento claro + prazo + forma de pagamento. CURIOSO: pesquisa de preço genérica.',
        },
        clinica_estetica: {
          contexto: 'Clínica de estética. Triar interesse em procedimentos.',
          perguntas: [
            'Qual procedimento te interessa? (botox, preenchimento, harmonização, corporal)',
            'Já realizou esse procedimento antes?',
            'Tem prazo definido (evento, viagem)?',
            'Qual sua faixa de investimento?',
          ],
          criterios: 'QUALIFICADO: procedimento específico + prazo + orçamento. CURIOSO: só pede tabela.',
        },
        advocacia: {
          contexto: 'Você atende um escritório de advocacia. Faça triagem jurídica preliminar SEM dar parecer legal.',
          perguntas: [
            'Em qual área do direito você precisa de ajuda? (trabalhista, cível, família, criminal, previdenciário, empresarial)',
            'O caso é urgente ou já tem processo aberto?',
            'Pode descrever brevemente a situação? (sem dados sensíveis)',
            'Você é a parte interessada ou está consultando para terceiros?',
            'Tem prazo legal correndo (audiência, intimação)?',
          ],
          criterios: 'QUALIFICADO: descreve caso concreto + área específica + tem prazo/processo + é a parte. CURIOSO: pergunta abstrata sobre lei sem caso real.',
        },
        contabilidade: {
          contexto: 'Escritório de contabilidade. Triagem por porte e necessidade.',
          perguntas: [
            'É pessoa física, MEI, ME ou empresa de maior porte?',
            'Qual serviço busca? (abertura, troca de contador, declarações, consultoria fiscal)',
            'Quantos funcionários e qual faturamento aproximado?',
            'Tem urgência ou prazo fiscal correndo?',
          ],
          criterios: 'QUALIFICADO: porte definido + serviço específico + prazo. CURIOSO: só compara honorários.',
        },
        imobiliaria: {
          contexto: 'Imobiliária. Triagem por intenção (comprar/alugar/vender) e capacidade.',
          perguntas: [
            'Você quer comprar, alugar ou vender?',
            'Que tipo de imóvel? (casa, apartamento, comercial, terreno)',
            'Qual região e faixa de valor?',
            'Tem prazo para mudança/decisão?',
            'Compra à vista, financiamento ou FGTS?',
          ],
          criterios: 'QUALIFICADO: intenção clara + região + faixa de valor + forma de pagamento + prazo. CURIOSO: só navega.',
        },
        correspondente_bancario: {
          contexto: 'Correspondente bancário. Qualificar por crédito buscado e perfil financeiro.',
          perguntas: [
            'Qual tipo de crédito busca? (consignado, FGTS, pessoal, imobiliário, veicular)',
            'É aposentado/pensionista, servidor, CLT ou autônomo?',
            'Qual valor aproximado precisa?',
            'Já tem outros empréstimos ativos?',
            'Tem alguma restrição no nome?',
          ],
          criterios: 'QUALIFICADO: tipo de crédito + perfil + valor + sem restrição grave. CURIOSO: só simula sem dar dados.',
        },
        consorcio: {
          contexto: 'Consórcio. Qualificar por bem desejado e capacidade de parcela.',
          perguntas: [
            'Você quer consórcio de imóvel, veículo, serviços ou outros?',
            'Qual valor da carta de crédito desejada?',
            'Quanto pode pagar por mês de parcela?',
            'Tem urgência em ter o bem ou pode aguardar contemplação?',
          ],
          criterios: 'QUALIFICADO: bem definido + valor + parcela cabível + entende prazo. CURIOSO: confunde com financiamento.',
        },
        corretora_seguros: {
          contexto: 'Corretora de seguros. Qualificar por tipo de seguro e perfil.',
          perguntas: [
            'Que tipo de seguro? (auto, vida, residencial, empresarial, saúde)',
            'É renovação ou primeiro seguro?',
            'Pode informar dados básicos do bem ou perfil a ser segurado?',
            'Quando precisa da apólice ativa?',
          ],
          criterios: 'QUALIFICADO: tipo definido + dados do bem/perfil + prazo. CURIOSO: só cota genérica.',
        },
        educacao: {
          contexto: 'Instituição de educação/cursos. Qualificar por curso e intenção.',
          perguntas: [
            'Qual curso te interessa?',
            'É para você ou outra pessoa?',
            'Tem objetivo específico (carreira, certificação, hobby)?',
            'Quando pretende começar?',
          ],
          criterios: 'QUALIFICADO: curso específico + objetivo + prazo. CURIOSO: só pesquisa preço.',
        },
        tecnologia: {
          contexto: 'Empresa de tecnologia/SaaS. Qualificar B2B.',
          perguntas: [
            'Qual o tamanho da sua empresa (funcionários)?',
            'Qual problema/dor está tentando resolver?',
            'Já usa alguma solução hoje?',
            'Você é o decisor ou ajuda a decidir?',
            'Tem prazo para implementação?',
          ],
          criterios: 'QUALIFICADO: empresa definida + dor clara + decisor/influenciador + prazo. CURIOSO: estudante/pesquisador.',
        },
      };

      const qualifConfig = companySegmento ? QUALIFICACAO_POR_SEGMENTO[companySegmento] : null;

      // ============================================
      // Configurações personalizadas do Bot IA do Site
      // ============================================
      const captureCfg: any = (globalThis as any).__captureCfg || {};
      const botCfg: any = captureCfg.bot_ia_site || {};

      // Verificar se está dentro do horário de funcionamento
      let foraDoHorario = false;
      if (botCfg.horario_funcionamento?.ativo) {
        const agora = new Date();
        const diaAtual = agora.getDay();
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const dias = botCfg.horario_funcionamento.dias || [1,2,3,4,5];
        const [hi, mi] = (botCfg.horario_funcionamento.inicio || '08:00').split(':').map(Number);
        const [hf, mf] = (botCfg.horario_funcionamento.fim || '18:00').split(':').map(Number);
        const inicio = hi * 60 + mi;
        const fim = hf * 60 + mf;
        if (!dias.includes(diaAtual) || horaAtual < inicio || horaAtual > fim) {
          foraDoHorario = true;
        }
      }

      const tomMap: Record<string, string> = {
        amigavel: 'Tom AMIGÁVEL: próximo, caloroso, use "você", emojis pontuais (🙂 ✨), como uma recepcionista querida.',
        consultivo: 'Tom CONSULTIVO: postura de especialista que orienta, traz dados, faz perguntas estratégicas. Sem emojis demais.',
        formal: 'Tom FORMAL: profissional, respeitoso, tratamento por "senhor(a)" no início. Sem gírias nem emojis.',
        descontraido: 'Tom DESCONTRAÍDO: leve, criativo, usa emojis (😄 🚀 💡), linguagem casual sem perder credibilidade.',
        empatico: 'Tom EMPÁTICO: acolhedor, validando sentimentos. Ideal para saúde, jurídico, situações sensíveis.',
      };

      const personaBlock = botCfg.persona
        ? `\n\n=== PERSONA ===\n${botCfg.persona}`
        : '';

      const tomBlock = botCfg.tom_de_voz
        ? `\n\n=== TOM DE VOZ ===\n${tomMap[botCfg.tom_de_voz] || tomMap.amigavel}`
        : '';

      const conhecimentoBlock = botCfg.base_conhecimento
        ? `\n\n=== BASE DE CONHECIMENTO DA EMPRESA ===\n${botCfg.base_conhecimento}\n\nUse essas informações como verdade absoluta. Se a pergunta não estiver coberta, ofereça transferir para humano.`
        : '';

      const perguntasExtrasBlock = botCfg.perguntas_extras?.length
        ? `\n\n=== PERGUNTAS EXTRAS DESTE NEGÓCIO ===\nAlém das do segmento, encaixe naturalmente:\n${botCfg.perguntas_extras.map((p: any, i: number) => `${i + 1}. ${p.pergunta}${p.obrigatoria ? ' [OBRIGATÓRIA]' : ''}`).join('\n')}`
        : '';

      const bloqueioBlock = botCfg.bloquear_topicos?.length
        ? `\n\n=== TÓPICOS PROIBIDOS ===\nNUNCA fale sobre: ${botCfg.bloquear_topicos.join(', ')}. Se perguntarem, redirecione gentilmente para outro assunto.`
        : '';

      const offlineBlock = foraDoHorario
        ? `\n\n=== ATENÇÃO: FORA DO HORÁRIO ===\nO atendimento humano está fora do expediente. ${botCfg.mensagem_offline || 'Avise que retornaremos em breve e capture nome + WhatsApp para que o time entre em contato no próximo expediente.'} NÃO prometa retorno imediato.`
        : '';

      const scoreMin = botCfg.score_minimo_qualificado ?? 60;
      const acaoQuente = botCfg.acao_lead_quente || 'criar_lead';
      const permitirAgendamento = botCfg.permitir_agendamento !== false;
      const permitirTransferencia = botCfg.permitir_transferencia_humana !== false;

      const nomeBot = botCfg.nome_bot || 'assistente virtual';

      const blocoQualificacao = qualifConfig
        ? `\n\n=== TRIAGEM E QUALIFICAÇÃO INTELIGENTE ===\n${qualifConfig.contexto}\n\nPERGUNTAS-BASE DO SEGMENTO (faça 1 por mensagem, naturalmente):\n${qualifConfig.perguntas.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nCRITÉRIOS:\n${qualifConfig.criterios}\n\nREGRA: Não dispare todas as perguntas de uma vez. Faça uma, escute, e a próxima conforme o contexto. Sempre peça nome e WhatsApp em algum momento (não no início — depois de criar conexão).${perguntasExtrasBlock}\n\nSCORE MÍNIMO PARA QUALIFICAR: ${scoreMin}. Lead com score >= ${scoreMin} = QUALIFICADO.`
        : `\n\n=== QUALIFICAÇÃO ===\nFaça perguntas naturais para entender: o que a pessoa busca, urgência, capacidade de decisão, prazo. Colete nome e WhatsApp em momento oportuno (não logo no início).${perguntasExtrasBlock}\n\nSCORE MÍNIMO PARA QUALIFICAR: ${scoreMin}.`;

      let systemPrompt = '';

      if (promptPersonalizado) {
        systemPrompt = `${promptPersonalizado}
${personaBlock}
${tomBlock}
${conhecimentoBlock}
${bloqueioBlock}
${offlineBlock}
${visitorContext}
${horariosContext}
${blocoQualificacao}

REGRAS:
- Você é ${nomeBot}, no site institucional da ${companyName}
- Seja cordial, profissional e objetivo
- ${permitirAgendamento ? 'Se o visitante quiser agendar, colete os dados necessários' : 'NÃO ofereça agendamento direto — direcione para o time humano'}
- ${permitirTransferencia ? 'Quando lead estiver qualificado, transfira para humano' : 'Não transfira para humano automaticamente'}
- Mantenha respostas curtas e claras (1-2 parágrafos curtos)`;
      } else {
        // Prompt padrão (humanizado)
        systemPrompt = `Você é ${nomeBot}, ${botCfg.persona ? '' : 'a assistente virtual humanizada'} da ${companyName}${companySegmento ? ` (segmento: ${companySegmento})` : ''}, presente no site institucional.
${personaBlock}
${tomBlock}
${conhecimentoBlock}
${bloqueioBlock}
${offlineBlock}
${visitorContext}
${horariosContext}
${blocoQualificacao}

SUAS CAPACIDADES:
1. Responder dúvidas sobre a empresa e serviços (use a base de conhecimento)
${permitirAgendamento ? '2. Ajudar a agendar consultas/reuniões' : ''}
3. Qualificar interessados conversando NATURALMENTE (não em formulário)
${permitirTransferencia ? '4. Direcionar para atendimento humano quando necessário' : ''}

REGRAS DE HUMANIZAÇÃO (CRÍTICAS):
- NUNCA dispare múltiplas perguntas em uma só mensagem
- Reaja ao que a pessoa disse antes de fazer próxima pergunta ("Entendi…", "Faz sentido…", "Imagino que…")
- Use o nome dela depois que souber
- Adapte o ritmo: quem responde rápido recebe respostas curtas, quem responde longo recebe acolhimento maior
- Se a pessoa estiver hesitante, NÃO empurre — pergunte o que ela precisa saber para decidir
- Demonstre conhecimento real do negócio (use a base de conhecimento)
- Mantenha respostas em 1-3 parágrafos curtos
- Se não souber algo, seja honesta e ofereça contato com humano
- Não invente preços nem serviços não listados

AÇÕES (inclua no final da resposta se aplicável):
- [COLETAR_LEAD:nome=X,telefone=Y,email=Z,interesse=descrição] - quando coletar dados do visitante
${permitirAgendamento ? '- [MOSTRAR_HORARIOS:data=YYYY-MM-DD] - mostrar slots de horário disponíveis em cards clicáveis\n- [AGENDAR:data=YYYY-MM-DD,horario=HH:MM,servico=X] - confirmar agendamento' : ''}
${permitirTransferencia ? '- [TRANSFERIR_HUMANO:motivo=X] - quando o lead estiver QUALIFICADO (score >= ' + scoreMin + ') e pronto para o time comercial' : ''}
- [QUALIFICAR_LEAD:score=0-100,classificacao=quente|morno|frio|curioso,resumo=texto curto,interesse=produto/serviço] - SEMPRE inclua isso quando tiver coletado informações suficientes para julgar (após 3-5 trocas). Use score:
   * 80-100 = QUENTE (decisor, prazo curto, dor clara, dados completos)
   * 50-79 = MORNO (interesse real mas algo falta — prazo longo, sem urgência ou sem todos dados)
   * 20-49 = FRIO (curioso interessado mas sem prazo nem decisão)
   * 0-19 = CURIOSO (só pesquisa, estudante, concorrente, sem dor real)

IMPORTANTE: ${permitirAgendamento ? 'Se o visitante quiser agendar, primeiro use MOSTRAR_HORARIOS, depois AGENDAR. ' : ''}Quando classificar com score >= ${scoreMin}, ${permitirTransferencia ? 'também emita TRANSFERIR_HUMANO.' : 'apenas registre a qualificação.'}
AÇÃO CONFIGURADA AO QUALIFICAR LEAD QUENTE: ${acaoQuente}.`;
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
          model: botCfg.modelo || 'google/gemini-2.5-flash',
          messages,
          max_tokens: 600,
          temperature: typeof botCfg.criatividade === 'number' ? Math.max(0, Math.min(1, botCfg.criatividade / 100)) : 0.7,
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
      const actionPattern = /\[(COLETAR_LEAD|AGENDAR|TRANSFERIR_HUMANO|MOSTRAR_HORARIOS|QUALIFICAR_LEAD)(:([^\]]+))?\]/g;
      const actions: any[] = [];
      let match;

      // Estado de qualificação acumulado nesta resposta
      let qualificacaoAtual: { score?: number; classificacao?: string; resumo?: string; interesse?: string } | null = null;
      let transferirHumano = false;
      let motivoTransferencia: string | undefined;

      while ((match = actionPattern.exec(aiResponse)) !== null) {
        const actionType = match[1];
        const actionParams = match[3];

        const parseParams = (raw?: string): Record<string, string> => {
          const p: Record<string, string> = {};
          if (!raw) return p;
          raw.split(',').forEach((piece: string) => {
            const idx = piece.indexOf('=');
            if (idx > -1) {
              const k = piece.slice(0, idx).trim();
              const v = piece.slice(idx + 1).trim();
              if (k) p[k] = v;
            }
          });
          return p;
        };

        actions.push({ type: actionType, params: actionParams });

        // QUALIFICAR_LEAD: armazena estado para aplicar no lead
        if (actionType === 'QUALIFICAR_LEAD' && actionParams) {
          const p = parseParams(actionParams);
          const scoreNum = p.score ? parseInt(p.score, 10) : undefined;
          qualificacaoAtual = {
            score: Number.isFinite(scoreNum) ? scoreNum : undefined,
            classificacao: p.classificacao?.toLowerCase(),
            resumo: p.resumo,
            interesse: p.interesse,
          };
          actions[actions.length - 1].qualificacao = qualificacaoAtual;
        }

        if (actionType === 'TRANSFERIR_HUMANO') {
          transferirHumano = true;
          motivoTransferencia = actionParams ? parseParams(actionParams).motivo : undefined;
        }

        // Executar ação de coleta de lead
        if (actionType === 'COLETAR_LEAD' && actionParams && companyId) {
          try {
            const params = parseParams(actionParams);

            if (params.nome || params.telefone || params.email) {
              // Verificar se já existe
              const telefoneNorm = params.telefone?.replace(/\D/g, '');
              let leadExisteId: string | null = null;

              if (telefoneNorm) {
                const { data: existe } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', companyId)
                  .or(`telefone.eq.${telefoneNorm},phone.eq.${telefoneNorm}`)
                  .limit(1)
                  .single();
                if (existe) leadExisteId = (existe as any).id;
              }

              if (!leadExisteId && params.email) {
                const { data: existe } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('company_id', companyId)
                  .eq('email', params.email.toLowerCase())
                  .limit(1)
                  .single();
                if (existe) leadExisteId = (existe as any).id;
              }

              // Tags + status baseados na qualificação atual
              const classif = qualificacaoAtual?.classificacao;
              const tags = ['chat-ia', 'site-institucional'];
              if (classif) tags.push(`lead-${classif}`);
              if (companySegmento) tags.push(`segmento-${companySegmento}`);

              const status = classif === 'quente' ? 'qualificado'
                : classif === 'morno' ? 'em_qualificacao'
                : classif === 'curioso' ? 'descartado'
                : 'novo';

              const notesParts = [
                `Lead captado via chat IA do site em ${new Date().toLocaleString('pt-BR')}`,
                params.interesse ? `Interesse: ${params.interesse}` : '',
                qualificacaoAtual?.resumo ? `Resumo IA: ${qualificacaoAtual.resumo}` : '',
                qualificacaoAtual?.score != null ? `Score: ${qualificacaoAtual.score}/100 (${classif || 'n/a'})` : '',
              ].filter(Boolean).join('\n');

              if (!leadExisteId) {
                const { data: novoLead } = await supabase.from('leads').insert({
                  name: params.nome || 'Visitante Site',
                  telefone: telefoneNorm,
                  phone: telefoneNorm,
                  email: params.email?.toLowerCase(),
                  company_id: companyId,
                  owner_id: ownerId,
                  source: 'chat-ia-site',
                  status,
                  tags,
                  notes: notesParts,
                }).select('id').single();
                if (novoLead) leadExisteId = (novoLead as any).id;
                console.log('[api-public-ia] Lead criado via chat:', params.nome, 'classif:', classif);
              } else {
                // Atualizar lead existente com nova qualificação
                await supabase.from('leads').update({
                  status,
                  tags,
                  notes: notesParts,
                  updated_at: new Date().toISOString(),
                }).eq('id', leadExisteId);
              }

              actions[actions.length - 1].lead_id = leadExisteId;
              actions[actions.length - 1].classificacao = classif;
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
          qualificacao: qualificacaoAtual,
          transferir_humano: transferirHumano,
          motivo_transferencia: motivoTransferencia,
          segmento: companySegmento,
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
