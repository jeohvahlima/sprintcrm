import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// IA DE AGENDAMENTO - VERSÃO MELHORADA
// Com horários dinâmicos, multi-profissional e lembretes automáticos
// ========================

interface IATools {
  buscar_horarios_disponiveis: (params: { data: string; agenda_id?: string; profissional_id?: string; duracao_minutos?: number; company_id: string }) => Promise<any>;
  listar_profissionais: (params: { especialidade?: string; company_id: string }) => Promise<any>;
  listar_agendas: (params: { company_id: string }) => Promise<any>;
  criar_compromisso: (params: { lead_id: string; agenda_id?: string; profissional_id?: string; data_hora: string; tipo_servico: string; duracao_minutos?: number; observacoes?: string; company_id: string; owner_id: string; telefone?: string }) => Promise<any>;
  alterar_compromisso: (params: { compromisso_id: string; novos_dados: any }) => Promise<any>;
  cancelar_compromisso: (params: { compromisso_id: string; motivo?: string }) => Promise<any>;
  buscar_compromissos_lead: (params: { lead_id: string }) => Promise<any>;
}

async function createTools(supabase: any): Promise<IATools> {
  return {
    buscar_horarios_disponiveis: async ({ data, agenda_id, profissional_id, duracao_minutos = 30, company_id }) => {
      console.log('🔍 [TOOL] Buscando horários disponíveis:', { data, agenda_id, profissional_id, duracao_minutos });
      
      // Buscar configuração de horários da agenda
      let horariosBase = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ];
      
      // Tentar buscar horários personalizados da agenda
      if (agenda_id) {
        const { data: agenda } = await supabase
          .from('agendas')
          .select('disponibilidade, tempo_medio_servico')
          .eq('id', agenda_id)
          .single();
        
        if (agenda?.disponibilidade) {
          const diaSemana = new Date(data).toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
          const disponibilidadeDia = (agenda.disponibilidade as any)[diaSemana];
          
          if (disponibilidadeDia && disponibilidadeDia.ativo && disponibilidadeDia.horarios) {
            // Gerar horários baseados na configuração da agenda
            horariosBase = [];
            for (const periodo of disponibilidadeDia.horarios) {
              const [horaInicio] = periodo.inicio.split(':').map(Number);
              const [horaFim] = periodo.fim.split(':').map(Number);
              const intervalo = agenda.tempo_medio_servico || 30;
              
              for (let h = horaInicio; h < horaFim; h++) {
                for (let m = 0; m < 60; m += intervalo) {
                  if (h * 60 + m >= horaInicio * 60 && h * 60 + m < horaFim * 60) {
                    horariosBase.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  }
                }
              }
            }
          }
        }
      }
      
      // Verificar horário comercial padrão da empresa
      if (horariosBase.length === 0 || !agenda_id) {
        const { data: horarioComercial } = await supabase
          .from('horarios_comerciais')
          .select('*')
          .eq('company_id', company_id)
          .single();
        
        if (horarioComercial) {
          const diaSemana = new Date(data).getDay();
          const config = (horarioComercial.configuracao as any)?.[diaSemana];
          
          if (config && config.ativo) {
            horariosBase = [];
            const intervalo = 30;
            
            for (const periodo of (config.periodos || [])) {
              const [horaInicio, minInicio] = periodo.inicio.split(':').map(Number);
              const [horaFim, minFim] = periodo.fim.split(':').map(Number);
              
              let minutoAtual = horaInicio * 60 + minInicio;
              const minutoFim = horaFim * 60 + minFim;
              
              while (minutoAtual < minutoFim) {
                const hora = Math.floor(minutoAtual / 60);
                const minuto = minutoAtual % 60;
                horariosBase.push(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`);
                minutoAtual += intervalo;
              }
            }
          }
        }
      }
      
      const dataInicio = `${data}T00:00:00`;
      const dataFim = `${data}T23:59:59`;
      
      let query = supabase
        .from('compromissos')
        .select('data_hora_inicio, data_hora_fim, profissional_id, agenda_id')
        .gte('data_hora_inicio', dataInicio)
        .lte('data_hora_inicio', dataFim)
        .neq('status', 'cancelado');
      
      if (profissional_id) {
        query = query.eq('profissional_id', profissional_id);
      }
      if (agenda_id) {
        query = query.eq('agenda_id', agenda_id);
      }
      
      const { data: compromissosExistentes, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar compromissos:', error);
        return { error: 'Erro ao buscar horários' };
      }
      
      const horariosOcupados = (compromissosExistentes || []).map((c: any) => {
        const hora = new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
        return hora;
      });
      
      // Filtrar horários passados se for hoje
      const agora = new Date();
      const dataConsulta = new Date(data);
      const ehHoje = agora.toDateString() === dataConsulta.toDateString();
      
      let horariosDisponiveis = horariosBase.filter(h => {
        if (horariosOcupados.includes(h)) return false;
        
        if (ehHoje) {
          const [hora, minuto] = h.split(':').map(Number);
          const horarioEmMinutos = hora * 60 + minuto;
          const agoraEmMinutos = agora.getHours() * 60 + agora.getMinutes() + 30; // 30min de margem
          return horarioEmMinutos > agoraEmMinutos;
        }
        
        return true;
      });
      
      return {
        data,
        horarios_disponiveis: horariosDisponiveis,
        horarios_ocupados: horariosOcupados,
        total_disponiveis: horariosDisponiveis.length
      };
    },
    
    listar_profissionais: async ({ especialidade, company_id }) => {
      console.log('🔍 [TOOL] Listando profissionais:', { especialidade, company_id });
      
      let query = supabase
        .from('profissionais')
        .select('id, nome, especialidade, email, telefone, valor_consulta, duracao_consulta')
        .eq('company_id', company_id);
      
      if (especialidade) {
        query = query.ilike('especialidade', `%${especialidade}%`);
      }
      
      const { data: profissionais, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar profissionais:', error);
        return { error: 'Erro ao buscar profissionais' };
      }
      
      return {
        profissionais: profissionais || [],
        total: (profissionais || []).length
      };
    },
    
    listar_agendas: async ({ company_id }) => {
      console.log('🔍 [TOOL] Listando agendas:', { company_id });
      
      const { data: agendas, error } = await supabase
        .from('agendas')
        .select(`
          id, 
          nome, 
          tipo,
          tempo_medio_servico,
          profissionais:responsavel_id (id, nome)
        `)
        .eq('company_id', company_id)
        .eq('status', 'ativo');
      
      if (error) {
        console.error('Erro ao buscar agendas:', error);
        return { error: 'Erro ao buscar agendas' };
      }
      
      return {
        agendas: (agendas || []).map((a: any) => ({
          id: a.id,
          nome: a.nome,
          tipo: a.tipo,
          tempo_medio: a.tempo_medio_servico,
          profissional: a.profissionais?.nome
        })),
        total: (agendas || []).length
      };
    },
    
    criar_compromisso: async ({ lead_id, agenda_id, profissional_id, data_hora, tipo_servico, duracao_minutos = 30, observacoes, company_id, owner_id, telefone }) => {
      console.log('📅 [TOOL] Criando compromisso:', { lead_id, data_hora, tipo_servico });
      
      // Se houver profissional, usar a duração e valor cadastrados nele
      let duracaoFinal = duracao_minutos;
      let valorConsulta: number | null = null;
      if (profissional_id) {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('duracao_consulta, valor_consulta')
          .eq('id', profissional_id)
          .maybeSingle();
        if (prof?.duracao_consulta) duracaoFinal = prof.duracao_consulta;
        if (prof?.valor_consulta != null) valorConsulta = Number(prof.valor_consulta);
      }

      const dataHoraInicio = new Date(data_hora);
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracaoFinal * 60 * 1000);
      
      // Verificar conflitos
      let conflictQuery = supabase
        .from('compromissos')
        .select('id')
        .gte('data_hora_inicio', dataHoraInicio.toISOString())
        .lt('data_hora_inicio', dataHoraFim.toISOString())
        .neq('status', 'cancelado');
      
      if (agenda_id) conflictQuery = conflictQuery.eq('agenda_id', agenda_id);
      if (profissional_id) conflictQuery = conflictQuery.eq('profissional_id', profissional_id);
      
      const { data: conflitos } = await conflictQuery.limit(1);
      
      if (conflitos && conflitos.length > 0) {
        return { 
          success: false, 
          error: 'Já existe um compromisso neste horário',
          conflito: true
        };
      }
      
      // Buscar nome do lead para preencher paciente
      let nomePaciente = '';
      let telefonePaciente = telefone || '';
      
      if (lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('name, telefone, phone')
          .eq('id', lead_id)
          .single();
        
        if (lead) {
          nomePaciente = lead.name || '';
          telefonePaciente = telefonePaciente || lead.telefone || lead.phone || '';
        }
      }
      
      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          lead_id,
          agenda_id,
          profissional_id,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico,
          observacoes,
          status: 'agendado',
          company_id,
          owner_id,
          usuario_responsavel_id: owner_id,
          paciente: nomePaciente,
          telefone: telefonePaciente,
          duracao: duracaoFinal,
          custo_estimado: valorConsulta
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar compromisso:', error);
        return { success: false, error: 'Erro ao criar compromisso' };
      }
      
      // Criar lembretes automáticos (24h e 1h antes)
      const lembretes = [
        { horas_antecedencia: 24, mensagem: `Lembrete: Você tem um compromisso amanhã às ${dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` },
        { horas_antecedencia: 1, mensagem: `Lembrete: Seu compromisso é em 1 hora!` }
      ];
      
      for (const lembrete of lembretes) {
        const dataEnvio = new Date(dataHoraInicio.getTime() - lembrete.horas_antecedencia * 60 * 60 * 1000);
        
        if (dataEnvio > new Date()) {
          await supabase
            .from('lembretes')
            .insert({
              compromisso_id: compromisso.id,
              company_id,
              canal: 'whatsapp',
              destinatario: telefonePaciente,
              horas_antecedencia: lembrete.horas_antecedencia,
              mensagem: lembrete.mensagem,
              proxima_data_envio: dataEnvio.toISOString(),
              status_envio: 'pendente',
              ativo: true
            });
        }
      }
      
      return {
        success: true,
        compromisso_id: compromisso.id,
        data_hora_inicio: compromisso.data_hora_inicio,
        data_hora_fim: compromisso.data_hora_fim,
        lembretes_criados: lembretes.length,
        mensagem: `✅ Compromisso agendado para ${dataHoraInicio.toLocaleDateString('pt-BR')} às ${dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}!`
      };
    },
    
    alterar_compromisso: async ({ compromisso_id, novos_dados }) => {
      console.log('✏️ [TOOL] Alterando compromisso:', { compromisso_id, novos_dados });
      
      const { error } = await supabase
        .from('compromissos')
        .update({
          ...novos_dados,
          updated_at: new Date().toISOString()
        })
        .eq('id', compromisso_id);
      
      if (error) {
        console.error('Erro ao alterar compromisso:', error);
        return { success: false, error: 'Erro ao alterar compromisso' };
      }
      
      return { success: true, mensagem: 'Compromisso alterado com sucesso' };
    },
    
    cancelar_compromisso: async ({ compromisso_id, motivo }) => {
      console.log('❌ [TOOL] Cancelando compromisso:', { compromisso_id, motivo });
      
      const { error } = await supabase
        .from('compromissos')
        .update({
          status: 'cancelado',
          observacoes: motivo ? `Cancelado: ${motivo}` : 'Cancelado pelo cliente',
          updated_at: new Date().toISOString()
        })
        .eq('id', compromisso_id);
      
      if (error) {
        console.error('Erro ao cancelar compromisso:', error);
        return { success: false, error: 'Erro ao cancelar compromisso' };
      }
      
      // Desativar lembretes
      await supabase
        .from('lembretes')
        .update({ ativo: false })
        .eq('compromisso_id', compromisso_id);
      
      return { success: true, mensagem: 'Compromisso cancelado com sucesso' };
    },
    
    buscar_compromissos_lead: async ({ lead_id }) => {
      console.log('🔍 [TOOL] Buscando compromissos do lead:', { lead_id });
      
      const { data: compromissos, error } = await supabase
        .from('compromissos')
        .select(`
          *,
          profissional:profissional_id (nome),
          agenda:agenda_id (nome)
        `)
        .eq('lead_id', lead_id)
        .order('data_hora_inicio', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar compromissos:', error);
        return { error: 'Erro ao buscar compromissos' };
      }
      
      const agora = new Date();
      const futuros = (compromissos || []).filter((c: any) => new Date(c.data_hora_inicio) > agora && c.status !== 'cancelado');
      const passados = (compromissos || []).filter((c: any) => new Date(c.data_hora_inicio) <= agora);
      
      return {
        compromissos_futuros: futuros.map((c: any) => ({
          ...c,
          profissional_nome: c.profissional?.nome,
          agenda_nome: c.agenda?.nome
        })),
        compromissos_passados: passados,
        total: (compromissos || []).length
      };
    }
  };
}

// ========================
// FUNÇÃO PRINCIPAL
// ========================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { conversationId, message, leadData, companyId, action } = body;
    
    // Se for uma chamada direta de ferramenta
    if (action) {
      const tools = await createTools(supabase);
      
      switch (action) {
        case 'buscar_horarios':
          const horarios = await tools.buscar_horarios_disponiveis({ ...body, company_id: companyId });
          return new Response(JSON.stringify(horarios), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'listar_profissionais':
          const profissionais = await tools.listar_profissionais({ ...body, company_id: companyId });
          return new Response(JSON.stringify(profissionais), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'listar_agendas':
          const agendas = await tools.listar_agendas({ company_id: companyId });
          return new Response(JSON.stringify(agendas), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'criar_compromisso':
          const novoCompromisso = await tools.criar_compromisso({ ...body, company_id: companyId });
          return new Response(JSON.stringify(novoCompromisso), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        default:
          break;
      }
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // ========================================
    // BUSCAR CONFIGURAÇÕES
    // ========================================
    let promptPersonalizado = null;
    let agendasSelecionadas: string[] = [];
    let knowledgeBase: any = null;
    
    if (companyId) {
      const { data: iaConfig } = await supabase
        .from('ia_configurations')
        .select('custom_prompts')
        .eq('company_id', companyId)
        .single();
      
      if (iaConfig?.custom_prompts) {
        const customPrompts = iaConfig.custom_prompts as any;
        const agendamentoConfig = customPrompts.agendamento;
        
        if (typeof agendamentoConfig === 'string') {
          promptPersonalizado = agendamentoConfig;
        } else if (agendamentoConfig?.prompt) {
          promptPersonalizado = agendamentoConfig.prompt;
          knowledgeBase = agendamentoConfig.knowledge_base;
          agendasSelecionadas = agendamentoConfig.knowledge_base?.agendas_selecionadas || [];
        }
      }
    }

    // ========================================
    // MONTAR CONTEXTO DINÂMICO
    // ========================================
    const leadContext = leadData ? `
DADOS DO CLIENTE:
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone || leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
` : '';

    // Buscar compromissos existentes do lead
    let compromissosContext = '';
    const tools = await createTools(supabase);
    
    if (leadData?.id) {
      const compromissos = await tools.buscar_compromissos_lead({ lead_id: leadData.id });
      
      if (compromissos.compromissos_futuros?.length > 0) {
        compromissosContext = `
COMPROMISSOS AGENDADOS DO CLIENTE:
${compromissos.compromissos_futuros.map((c: any) => 
  `- ${new Date(c.data_hora_inicio).toLocaleDateString('pt-BR')} às ${new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${c.tipo_servico} ${c.profissional_nome ? `com ${c.profissional_nome}` : ''} (${c.status})`
).join('\n')}
`;
      } else {
        compromissosContext = '\nO cliente não possui compromissos agendados.\n';
      }
    }

    // Buscar horários disponíveis de hoje e próximos dias
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const depoisAmanha = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    
    const horariosHoje = await tools.buscar_horarios_disponiveis({ data: hoje, company_id: companyId });
    const horariosAmanha = await tools.buscar_horarios_disponiveis({ data: amanha, company_id: companyId });
    
    // Buscar agendas disponíveis
    let agendasContext = '';
    const agendasResult = await tools.listar_agendas({ company_id: companyId });
    
    if (agendasResult.agendas?.length > 0) {
      // Filtrar por agendas selecionadas se configurado
      const agendasFiltradas = agendasSelecionadas.length > 0 
        ? agendasResult.agendas.filter((a: any) => agendasSelecionadas.includes(a.id))
        : agendasResult.agendas;
      
      if (agendasFiltradas.length > 0) {
        agendasContext = `
AGENDAS/PROFISSIONAIS DISPONÍVEIS:
${agendasFiltradas.map((a: any) => `- ${a.nome}${a.profissional ? ` (${a.profissional})` : ''} - Tempo médio: ${a.tempo_medio || 30}min`).join('\n')}
`;
      }
    }

    // Buscar profissionais
    let profissionaisContext = '';
    const profissionaisResult = await tools.listar_profissionais({ company_id: companyId });
    
    if (profissionaisResult.profissionais?.length > 0) {
      profissionaisContext = `
PROFISSIONAIS DISPONÍVEIS:
${profissionaisResult.profissionais.map((p: any) => `- ${p.nome}${p.especialidade ? ` (${p.especialidade})` : ''}`).join('\n')}
`;
    }
    
    const horariosContext = `
HORÁRIOS DISPONÍVEIS:
📅 Hoje (${new Date(hoje).toLocaleDateString('pt-BR')}): ${horariosHoje.horarios_disponiveis?.length > 0 ? horariosHoje.horarios_disponiveis.slice(0, 6).join(', ') + (horariosHoje.horarios_disponiveis.length > 6 ? ` e mais ${horariosHoje.horarios_disponiveis.length - 6}` : '') : 'Sem vagas'}
📅 Amanhã (${new Date(amanha).toLocaleDateString('pt-BR')}): ${horariosAmanha.horarios_disponiveis?.length > 0 ? horariosAmanha.horarios_disponiveis.slice(0, 6).join(', ') + (horariosAmanha.horarios_disponiveis.length > 6 ? ` e mais ${horariosAmanha.horarios_disponiveis.length - 6}` : '') : 'Sem vagas'}
${agendasContext}
${profissionaisContext}`;

    // Adicionar base de conhecimento
    let knowledgeContext = '';
    if (knowledgeBase?.empresa) {
      knowledgeContext = `
INFORMAÇÕES DA EMPRESA:
- Nome: ${knowledgeBase.empresa.nome || ''}
- Endereço: ${knowledgeBase.empresa.endereco || ''}
- Horário: ${knowledgeBase.empresa.horario || ''}
`;
    }

    // ========================================
    // CONSTRUIR PROMPT FINAL
    // ========================================
    let systemPrompt = '';
    
    if (promptPersonalizado && promptPersonalizado.trim()) {
      let promptComVariaveis = promptPersonalizado
        .replace(/{lead\.name}/g, leadData?.name || 'Cliente')
        .replace(/{lead\.phone}/g, leadData?.phone || leadData?.telefone || '')
        .replace(/{lead\.email}/g, leadData?.email || '')
        .replace(/{company\.name}/g, knowledgeBase?.empresa?.nome || 'Empresa');
      
      systemPrompt = `${promptComVariaveis}

${leadContext}
${compromissosContext}
${horariosContext}
${knowledgeContext}

AÇÕES DISPONÍVEIS (inclua no final da resposta entre colchetes, se aplicável):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - para verificar horários de uma data específica
- [AGENDAR:YYYY-MM-DDTHH:MM|TIPO_SERVICO|PROFISSIONAL_OPCIONAL] - para confirmar agendamento
- [ALTERAR:COMPROMISSO_ID|NOVA_DATA] - para alterar compromisso existente
- [CANCELAR:COMPROMISSO_ID] - para cancelar compromisso
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    } else {
      systemPrompt = `Você é uma assistente especializada em agendamentos. Ajude clientes a agendar, alterar ou cancelar compromissos de forma simpática e eficiente.

DIRETRIZES:
- Seja proativa e sugira horários disponíveis
- Confirme todos os dados antes de agendar (data, horário, serviço)
- Use emojis para deixar a conversa mais amigável
- Se o cliente pedir uma data específica, verifique a disponibilidade
- Sempre confirme o agendamento com todos os detalhes

${leadContext}
${compromissosContext}
${horariosContext}
${knowledgeContext}

AÇÕES DISPONÍVEIS (inclua no final da resposta entre colchetes, se aplicável):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - para verificar horários de uma data específica
- [AGENDAR:YYYY-MM-DDTHH:MM|TIPO_SERVICO] - para confirmar agendamento
- [ALTERAR:COMPROMISSO_ID|NOVA_DATA] - para alterar compromisso existente
- [CANCELAR:COMPROMISSO_ID] - para cancelar compromisso
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    }

    console.log('📅 IA Agendamento - Processando:', { 
      conversationId, 
      message: message?.substring(0, 50),
      hasCustomPrompt: !!promptPersonalizado,
      agendasDisponiveis: agendasResult.total
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('❌ Erro da IA:', response.status, errorText);
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Extrair e executar ações
    const actionPattern = /\[(VERIFICAR_HORARIOS|AGENDAR|ALTERAR|CANCELAR|TRANSFERIR_HUMANO)(:([^\]]+))?\]/;
    const actionMatch = aiResponse.match(actionPattern);
    
    const actionType = actionMatch ? actionMatch[1] : null;
    const actionParams = actionMatch ? actionMatch[3] : null;
    
    const cleanResponse = aiResponse.replace(actionPattern, '').trim();

    let actionResult = null;

    if (actionType && companyId) {
      const { data: user } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', companyId)
        .limit(1)
        .single();
      
      const ownerId = user?.user_id;

      switch (actionType) {
        case 'VERIFICAR_HORARIOS':
          if (actionParams) {
            const horariosData = await tools.buscar_horarios_disponiveis({ 
              data: actionParams,
              company_id: companyId 
            });
            actionResult = horariosData;
          }
          break;
          
        case 'AGENDAR':
          if (actionParams && ownerId && leadData?.id) {
            const parts = actionParams.split('|');
            const dataHora = parts[0];
            const tipoServico = parts[1] || 'Consulta';
            
            const resultado = await tools.criar_compromisso({
              lead_id: leadData.id,
              data_hora: dataHora,
              tipo_servico: tipoServico,
              company_id: companyId,
              owner_id: ownerId,
              telefone: leadData.telefone || leadData.phone
            });
            actionResult = resultado;
          }
          break;
          
        case 'CANCELAR':
          if (actionParams) {
            const cancelResult = await tools.cancelar_compromisso({ 
              compromisso_id: actionParams 
            });
            actionResult = cancelResult;
          }
          break;
      }
    }

    // Registrar interação para aprendizado
    try {
      await supabase
        .from('ia_training_data')
        .insert({
          company_id: companyId,
          agent_type: 'agendamento',
          conversation_id: conversationId,
          lead_id: leadData?.id,
          input_message: message,
          ai_response: cleanResponse,
          context_data: {
            action: actionType,
            actionParams,
            actionResult
          }
        });
    } catch (e) {
      console.warn('⚠️ Erro ao registrar aprendizado:', e);
    }

    const execTime = Date.now() - startTime;
    console.log(`✅ IA Agendamento - Concluído em ${execTime}ms`);

    return new Response(
      JSON.stringify({
        response: cleanResponse,
        action: actionType,
        actionParams,
        actionResult,
        executionTime: execTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro na IA Agendamento:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        response: 'Desculpe, estou com dificuldades técnicas. Um atendente irá te ajudar em breve.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
