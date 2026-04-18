import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ============================================
// API PÚBLICA DE AGENDA
// Endpoints:
//  GET  ?action=agendas&company=SLUG
//  GET  ?action=profissionais&company=SLUG
//  GET  ?action=horarios&data=YYYY-MM-DD&company=SLUG[&profissional_id=...&agenda_id=...]
//  POST ?action=agendar  (cria lead + compromisso + WhatsApp + notifica profissional)
// ============================================

interface CompromissoInput {
  nome: string;
  telefone: string;
  email?: string;
  data: string;
  horario: string;
  tipo_servico: string;
  observacoes?: string;
  company_slug?: string;
  agenda_id?: string;
  profissional_id?: string;
  origem?: string; // 'site' | 'ia-chat'
}

async function resolveCompany(supabase: any, companySlug: string | null) {
  if (companySlug) {
    // 1. Tenta via get_capture_page (slug salvo em capture_page_config.slug ou UUID)
    try {
      const { data: rows } = await supabase.rpc('get_capture_page', { _identifier: companySlug });
      if (rows && rows.length > 0) {
        const { data: c } = await supabase
          .from('companies')
          .select('id, name, owner_user_id')
          .eq('id', rows[0].id)
          .maybeSingle();
        if (c) return { companyId: c.id, ownerId: c.owner_user_id, companyName: c.name };
      }
    } catch {}

    // 2. Fallback domain/name
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, owner_user_id')
      .or(`domain.eq.${companySlug},name.ilike.%${companySlug}%`)
      .limit(1)
      .maybeSingle();
    if (company) return { companyId: company.id, ownerId: company.owner_user_id, companyName: company.name };
  }

  // 3. Fallback master
  const { data: master } = await supabase
    .from('companies')
    .select('id, name, owner_user_id')
    .eq('is_master_account', true)
    .limit(1)
    .maybeSingle();
  if (master) return { companyId: master.id, ownerId: master.owner_user_id, companyName: master.name };

  return { companyId: null, ownerId: null, companyName: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'horarios';
    const companySlug = url.searchParams.get('company') || url.searchParams.get('company_slug');

    const { companyId, ownerId } = await resolveCompany(supabase, companySlug);

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ AGENDAS ============
    if (req.method === 'GET' && action === 'agendas') {
      const { data: agendas } = await supabase
        .from('agendas')
        .select('id, nome, tipo, tempo_medio_servico, permite_simultaneo, capacidade_simultanea, disponibilidade')
        .eq('company_id', companyId)
        .eq('status', 'ativa');
      return new Response(
        JSON.stringify({ success: true, agendas: agendas || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ PROFISSIONAIS ============
    if (req.method === 'GET' && action === 'profissionais') {
      const { data: profissionais } = await supabase
        .from('profissionais')
        .select('id, nome, especialidade, email, telefone')
        .eq('company_id', companyId);

      // tentar buscar avatar via user_avatars / profiles
      const enriched = await Promise.all((profissionais || []).map(async (p: any) => {
        let avatar_url: string | null = null;
        if (p.email) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('email', p.email)
            .maybeSingle();
          avatar_url = prof?.avatar_url || null;
        }
        return { ...p, avatar_url };
      }));

      return new Response(
        JSON.stringify({ success: true, profissionais: enriched }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ HORÁRIOS ============
    if (req.method === 'GET' && action === 'horarios') {
      const data = url.searchParams.get('data');
      const agendaId = url.searchParams.get('agenda_id');
      const profissionalId = url.searchParams.get('profissional_id');

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data é obrigatória (YYYY-MM-DD)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dataConsulta = new Date(data + 'T00:00:00');
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      if (dataConsulta < hoje) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data deve ser hoje ou futura' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let agenda: any = null;
      if (agendaId) {
        const { data: a } = await supabase.from('agendas').select('*').eq('id', agendaId).eq('company_id', companyId).maybeSingle();
        agenda = a;
      } else {
        const { data: a } = await supabase.from('agendas').select('*').eq('company_id', companyId).eq('status', 'ativa').limit(1).maybeSingle();
        agenda = a;
      }

      const horariosBase = agenda?.disponibilidade?.horarios || [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ];
      const capacidadeMaxima = agenda?.permite_simultaneo ? (agenda?.capacidade_simultanea || 1) : 1;

      let query = supabase
        .from('compromissos')
        .select('data_hora_inicio, profissional_id')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', `${data}T00:00:00`)
        .lte('data_hora_inicio', `${data}T23:59:59`)
        .neq('status', 'cancelado');
      if (profissionalId) query = query.eq('profissional_id', profissionalId);
      if (agendaId) query = query.eq('agenda_id', agendaId);

      const { data: compromissos } = await query;

      const contador: Record<string, number> = {};
      (compromissos || []).forEach((c: any) => {
        const hora = new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
        });
        contador[hora] = (contador[hora] || 0) + 1;
      });

      const agora = new Date();
      const ehHoje = dataConsulta.toDateString() === agora.toDateString();

      const horariosDisponiveis = horariosBase.map((horario: string) => {
        const ocupados = contador[horario] || 0;
        const vagasRestantes = capacidadeMaxima - ocupados;
        let passado = false;
        if (ehHoje) {
          const [h, m] = horario.split(':').map(Number);
          const d = new Date(); d.setHours(h, m, 0, 0);
          passado = d <= agora;
        }
        return {
          horario,
          disponivel: vagasRestantes > 0 && !passado,
          ocupado: ocupados > 0,
          vagas_restantes: Math.max(0, vagasRestantes),
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          data,
          horarios: horariosDisponiveis,
          agenda_nome: agenda?.nome || 'Agenda',
          agenda_id: agenda?.id,
          tempo_servico: agenda?.tempo_medio_servico || 30,
          capacidade: capacidadeMaxima,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ AGENDAR ============
    if (req.method === 'POST' && action === 'agendar') {
      const body: CompromissoInput = await req.json();

      if (!body.nome || body.nome.trim().length < 2) {
        return new Response(JSON.stringify({ success: false, error: 'Nome é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!body.telefone) {
        return new Response(JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!body.data || !body.horario) {
        return new Response(JSON.stringify({ success: false, error: 'Data e horário são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!body.tipo_servico) {
        return new Response(JSON.stringify({ success: false, error: 'Tipo de serviço é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const dataHoraInicio = new Date(`${body.data}T${body.horario}:00`);

      let tempoServico = 30;
      if (body.agenda_id) {
        const { data: agenda } = await supabase
          .from('agendas').select('tempo_medio_servico, permite_simultaneo, capacidade_simultanea')
          .eq('id', body.agenda_id).maybeSingle();
        if (agenda?.tempo_medio_servico) tempoServico = agenda.tempo_medio_servico;
      }
      const dataHoraFim = new Date(dataHoraInicio.getTime() + tempoServico * 60 * 1000);

      // Verificar conflito
      let conflictQuery = supabase
        .from('compromissos').select('id')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', dataHoraInicio.toISOString())
        .lt('data_hora_inicio', dataHoraFim.toISOString())
        .neq('status', 'cancelado');
      if (body.profissional_id) conflictQuery = conflictQuery.eq('profissional_id', body.profissional_id);

      const { data: conflitos } = await conflictQuery;

      let capacidadeMaxima = 1;
      if (body.agenda_id) {
        const { data: agenda } = await supabase
          .from('agendas').select('permite_simultaneo, capacidade_simultanea')
          .eq('id', body.agenda_id).maybeSingle();
        if (agenda?.permite_simultaneo) capacidadeMaxima = agenda.capacidade_simultanea || 1;
      }
      // se há profissional específico, é sempre 1 vaga
      if (body.profissional_id) capacidadeMaxima = 1;

      if (conflitos && conflitos.length >= capacidadeMaxima) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este horário não está mais disponível. Por favor, escolha outro.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const telefoneNorm = body.telefone.replace(/\D/g, '');

      // Lead
      let leadId: string | null = null;
      const { data: leadExistente } = await supabase
        .from('leads').select('id')
        .eq('company_id', companyId)
        .or(`telefone.eq.${telefoneNorm},phone.eq.${telefoneNorm}`)
        .limit(1).maybeSingle();

      if (leadExistente) {
        leadId = leadExistente.id;
      } else {
        const { data: novoLead } = await supabase
          .from('leads').insert({
            name: body.nome.trim(),
            telefone: telefoneNorm,
            phone: telefoneNorm,
            email: body.email?.toLowerCase().trim() || null,
            company_id: companyId,
            owner_id: ownerId,
            source: body.origem === 'ia-chat' ? 'site-ia-chat' : 'site-agendamento',
            status: 'novo',
            tags: ['agendamento-site', body.origem === 'ia-chat' ? 'ia-chat' : 'manual'],
            notes: `Lead criado via ${body.origem === 'ia-chat' ? 'IA do chat do site' : 'agendamento manual no site'} em ${new Date().toLocaleString('pt-BR')}`,
          }).select('id').maybeSingle();
        if (novoLead) leadId = novoLead.id;
      }

      // Buscar nome do profissional para o título
      let profissionalNome = '';
      let profissionalUserId: string | null = null;
      let profissionalTelefone: string | null = null;
      if (body.profissional_id) {
        const { data: prof } = await supabase
          .from('profissionais').select('nome, user_id, telefone, email').eq('id', body.profissional_id).maybeSingle();
        if (prof) {
          profissionalNome = prof.nome;
          profissionalUserId = prof.user_id;
          profissionalTelefone = prof.telefone;
        }
      }

      // Compromisso
      const { data: compromisso, error: compError } = await supabase
        .from('compromissos').insert({
          titulo: `${body.tipo_servico} - ${body.nome}${profissionalNome ? ` (${profissionalNome})` : ''}`,
          tipo_servico: body.tipo_servico,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          status: 'agendado',
          paciente: body.nome.trim(),
          telefone: telefoneNorm,
          observacoes: body.observacoes || `Agendamento via site${body.origem === 'ia-chat' ? ' (IA Chat)' : ''} - ${body.email || 'Sem email'}`,
          lead_id: leadId,
          agenda_id: body.agenda_id || null,
          profissional_id: body.profissional_id || null,
          company_id: companyId,
          owner_id: ownerId,
          usuario_responsavel_id: profissionalUserId || ownerId,
        }).select('id, data_hora_inicio, data_hora_fim, tipo_servico').maybeSingle();

      if (compError) {
        console.error('[api-public-agenda] Erro ao criar compromisso:', compError);
        return new Response(JSON.stringify({ success: false, error: 'Erro ao criar agendamento: ' + compError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const dataFmt = dataHoraInicio.toLocaleDateString('pt-BR');
      const horaFmt = dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // 1. WhatsApp para o cliente
      try {
        const msgCliente = `✅ *Agendamento Confirmado!*\n\n` +
          `Olá ${body.nome}!\n\n` +
          `📅 *Data:* ${dataFmt}\n` +
          `⏰ *Horário:* ${horaFmt}\n` +
          `📋 *Serviço:* ${body.tipo_servico}\n` +
          (profissionalNome ? `👤 *Profissional:* ${profissionalNome}\n` : '') +
          `\nAguardamos você! 😊`;

        await supabase.functions.invoke('enviar-whatsapp', {
          body: { telefone: telefoneNorm, mensagem: msgCliente, company_id: companyId }
        });
      } catch (e) {
        console.warn('[api-public-agenda] WhatsApp cliente falhou:', e);
      }

      // 2. Notificar profissional via WhatsApp
      if (profissionalTelefone) {
        try {
          const profTel = profissionalTelefone.replace(/\D/g, '');
          if (profTel.length >= 10) {
            const msgProf = `🔔 *Novo Agendamento*\n\n` +
              `👤 Cliente: ${body.nome}\n` +
              `📞 ${telefoneNorm}\n` +
              `📅 ${dataFmt} às ${horaFmt}\n` +
              `📋 ${body.tipo_servico}\n` +
              (body.observacoes ? `📝 ${body.observacoes}\n` : '');
            await supabase.functions.invoke('enviar-whatsapp', {
              body: { telefone: profTel, mensagem: msgProf, company_id: companyId }
            });
          }
        } catch (e) {
          console.warn('[api-public-agenda] WhatsApp profissional falhou:', e);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Agendamento realizado com sucesso!',
          compromisso: {
            id: compromisso?.id,
            data: body.data,
            horario: body.horario,
            tipo_servico: compromisso?.tipo_servico,
            profissional: profissionalNome || null,
            data_hora_formatada: `${dataFmt} às ${horaFmt}`,
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET' && action === 'status') {
      return new Response(
        JSON.stringify({ success: true, status: 'online', version: '2.0.0' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Rota não encontrada', available_actions: ['agendas', 'profissionais', 'horarios', 'agendar', 'status'] }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[api-public-agenda] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
