import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Lembrete {
  id: string;
  compromisso_id: string;
  canal: string;
  mensagem: string;
  midia_url?: string | null;
  horas_antecedencia: number;
  data_envio: string;
  status_envio: string;
  destinatario?: string;
  telefone_responsavel?: string;
  tentativas?: number;
  proxima_tentativa?: string;
  recorrencia?: string | null;
  data_hora_envio?: string | null;
  proxima_data_envio?: string | null;
  ativo?: boolean;
      compromisso: {
        id: string;
        data_hora_inicio: string;
        tipo_servico: string;
        lead_id: string;
        company_id?: string;
        usuario_responsavel_id?: string;
        lead: {
          name: string;
          phone?: string;
          telefone?: string;
        };
      };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Iniciando verificação de lembretes...');

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configuração do backoff exponencial para retry (em horas)
    // Tentativa 1: 1h, Tentativa 2: 3h, Tentativa 3: 24h
    const BACKOFF_TIMES_HOURS = [1, 3, 24];

    // Buscar lembretes pendentes ou em retry que devem ser enviados agora
    const agora = new Date();
    const agoraISO = agora.toISOString();
    
    // Buscar lembretes pendentes com data_envio <= agora OU em retry com proxima_tentativa <= agora
    // Máximo 3 tentativas (0, 1, 2 = 3 tentativas)
    // Apenas lembretes ativos (ativo = true ou null para compatibilidade)
    // CORREÇÃO: Excluir lembretes com status 'processando' para evitar duplicação
    const { data: lembretesPendentes, error: pendentesError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          confirmation_token,
          status_confirmacao,
          lead_id,
          company_id,
          usuario_responsavel_id,
          lead:leads (
            name,
            email,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'pendente')
      .lte('data_envio', agoraISO)
      .lte('tentativas', 2)
      .neq('ativo', false);
    
    // ✅ CORREÇÃO: Buscar lembretes SEM data_envio definido (legado)
    // Esses lembretes foram criados antes da correção e precisam ser processados
    const { data: lembretesSemDataEnvio, error: semDataError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          confirmation_token,
          status_confirmacao,
          lead_id,
          company_id,
          usuario_responsavel_id,
          lead:leads (
            name,
            email,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'pendente')
      .is('data_envio', null)
      .lte('tentativas', 2);
    
    const { data: lembretesRetry, error: retryError } = await supabase
      .from('lembretes')
      .select(`
        *,
        compromisso:compromissos (
          id,
          data_hora_inicio,
          tipo_servico,
          confirmation_token,
          status_confirmacao,
          lead_id,
          company_id,
          usuario_responsavel_id,
          lead:leads (
            name,
            email,
            phone,
            telefone
          )
        )
      `)
      .eq('status_envio', 'retry')
      .lte('proxima_tentativa', agoraISO)
      .lte('tentativas', 2);
    
    if (pendentesError || retryError || semDataError) {
      const lembretesError = pendentesError || retryError || semDataError;
      console.error('❌ Erro ao buscar lembretes:', lembretesError);
      throw lembretesError;
    }
    
    // ✅ Processar lembretes sem data_envio - calcular baseado no compromisso
    const lembretesSemDataProcessados = (lembretesSemDataEnvio || []).filter(lembrete => {
      if (!lembrete.compromisso?.data_hora_inicio) {
        console.log(`⚠️ Lembrete ${lembrete.id} sem compromisso associado - ignorando`);
        return false;
      }
      
      const dataCompromisso = new Date(lembrete.compromisso.data_hora_inicio);
      const horasAntecedencia = lembrete.horas_antecedencia || 0;
      const dataEnvioCalculada = new Date(dataCompromisso.getTime() - (horasAntecedencia * 60 * 60 * 1000));
      
      // Se a data de envio calculada já passou, deve enviar
      if (dataEnvioCalculada <= agora) {
        console.log(`📝 Lembrete ${lembrete.id} (legado): data_envio calculada = ${dataEnvioCalculada.toISOString()}`);
        // Atualizar o lembrete com a data_envio calculada para futuras consultas
        supabase
          .from('lembretes')
          .update({ data_envio: dataEnvioCalculada.toISOString() })
          .eq('id', lembrete.id)
          .then(() => console.log(`✅ Atualizado data_envio do lembrete ${lembrete.id}`));
        return true;
      }
      
      return false;
    });
    
    // Combinar resultados e remover duplicatas
    const lembretesMap = new Map();
    [...(lembretesPendentes || []), ...(lembretesSemDataProcessados || []), ...(lembretesRetry || [])].forEach(lembrete => {
      lembretesMap.set(lembrete.id, lembrete);
    });
    const lembretes = Array.from(lembretesMap.values());

    console.log(`📋 ${lembretes?.length || 0} lembretes pendentes encontrados`);

    if (!lembretes || lembretes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum lembrete pendente para enviar',
          processados: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Para cada lembrete, obter a configuração WhatsApp da empresa correspondente
    // Primeiro, vamos agrupar lembretes por empresa para processar eficientemente
    const lembretesPorEmpresa = lembretes.reduce((acc, lembrete) => {
      const companyId = lembrete.compromisso?.company_id || 'default';
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(lembrete);
      return acc;
    }, {} as Record<string, typeof lembretes>);

    let totalProcessados = 0;
    let totalErros = 0;

    // Processar lembretes por empresa
    for (const [companyId, lembretesEmpresa] of Object.entries(lembretesPorEmpresa)) {
      const lembretes = lembretesEmpresa as any[];
      console.log(`🏢 Processando ${lembretes.length} lembretes da empresa ${companyId}`);

      // Obter configuração WhatsApp da empresa
      let whatsappConfig = null;

      if (companyId !== 'default') {
        // Tentar buscar configuração da empresa específica
        const { data: configEmpresa } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'connected')
          .limit(1)
          .single();

        whatsappConfig = configEmpresa;
      }

      // Fallback para configuração global (sem company_id) se não encontrou específica
      if (!whatsappConfig) {
        console.log(`🔄 Usando configuração global para empresa ${companyId}`);
        const { data: configGlobal } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .is('company_id', null)
          .eq('status', 'connected')
          .limit(1)
          .single();

        whatsappConfig = configGlobal;
      }

      if (!whatsappConfig) {
        console.error(`❌ Nenhuma conexão WhatsApp ativa encontrada para empresa ${companyId}`);
        // Marcar todos os lembretes desta empresa como erro
        for (const lembrete of lembretes) {
          await supabase
            .from('lembretes')
            .update({
              status_envio: 'erro',
              data_envio: new Date().toISOString()
            })
            .eq('id', lembrete.id);
        }
        totalErros += lembretes.length;
        continue;
      }

      console.log(`📱 Usando configuração WhatsApp da empresa ${companyId}`);

      // Processar lembretes desta empresa
      for (const lembrete of lembretesEmpresa as Lembrete[]) {
        try {
          console.log(`📤 Processando lembrete ${lembrete.id}`);

          // CORREÇÃO: Marcar como 'processando' IMEDIATAMENTE para evitar duplicação
          // Usar update condicional para garantir atomicidade
          const { data: updateResult, error: lockError } = await supabase
            .from('lembretes')
            .update({ status_envio: 'processando' })
            .eq('id', lembrete.id)
            .in('status_envio', ['pendente', 'retry'])
            .select('id')
            .single();

          if (lockError || !updateResult) {
            console.log(`⚠️ Lembrete ${lembrete.id} já está sendo processado por outra instância - pulando`);
            continue;
          }

          console.log(`🔒 Lembrete ${lembrete.id} marcado como 'processando'`);

          // Validar dados do compromisso
          if (!lembrete.compromisso) {
            console.error(`❌ Compromisso não encontrado para lembrete ${lembrete.id}`);
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);
            totalErros++;
            continue;
          }

          // Validar dados do lead
          if (!lembrete.compromisso.lead) {
            console.error(`❌ Lead não encontrado para compromisso ${lembrete.compromisso_id}`);
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);
            totalErros++;
            continue;
          }

            // ✉️ Canal E-MAIL — usa Gmail integrado da empresa
            if (lembrete.canal === 'email') {
              const emailDestino = lembrete.compromisso.lead?.email;
              if (!emailDestino) {
                console.warn(`⚠️ Lembrete ${lembrete.id} (email): lead sem e-mail cadastrado — ignorando silenciosamente`);
                await supabase
                  .from('lembretes')
                  .update({ status_envio: 'erro', data_envio: new Date().toISOString() })
                  .eq('id', lembrete.id);
                totalErros++;
                continue;
              }

              const dataCompromisso = new Date(lembrete.compromisso.data_hora_inicio);
              const dataFmt = dataCompromisso.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
              const tipoServ = lembrete.compromisso.tipo_servico || 'Compromisso';
              const nomeLead = lembrete.compromisso.lead?.name || 'Cliente';
              const subject = `Lembrete: ${tipoServ.charAt(0).toUpperCase()}${tipoServ.slice(1)} em ${dataFmt}`;
              const bodyHtml = `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
                  <h2 style="color:#16a34a;margin:0 0 16px">⏰ Lembrete de Compromisso</h2>
                  <p>Olá, <strong>${nomeLead}</strong>!</p>
                  <p>${(lembrete.mensagem || '').replace(/\n/g, '<br/>') || `Este é um lembrete do seu compromisso de <strong>${tipoServ}</strong>.`}</p>
                  <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:4px 0"><strong>📅 Quando:</strong> ${dataFmt}</p>
                    <p style="margin:4px 0"><strong>📋 Tipo:</strong> ${tipoServ}</p>
                  </div>
                  <p style="color:#64748b;font-size:12px;margin-top:24px">Este é um lembrete automático. Por favor, confirme sua presença respondendo a este e-mail ou pelo WhatsApp.</p>
                </div>
              `;

              try {
                const { data: emailResult, error: emailError } = await supabase.functions.invoke('enviar-email-gmail', {
                  body: {
                    company_id: lembrete.compromisso.company_id || companyId,
                    to: emailDestino,
                    subject,
                    body: bodyHtml,
                    is_html: true,
                    lead_id: lembrete.compromisso.lead_id,
                  },
                });

                if (emailError || !emailResult?.success) {
                  console.error(`❌ Erro ao enviar e-mail do lembrete ${lembrete.id}:`, emailError || emailResult);
                  await supabase
                    .from('lembretes')
                    .update({ status_envio: 'erro', data_envio: new Date().toISOString() })
                    .eq('id', lembrete.id);
                  totalErros++;
                } else {
                  console.log(`✅ E-mail do lembrete ${lembrete.id} enviado para ${emailDestino}`);
                  await supabase
                    .from('lembretes')
                    .update({ status_envio: 'enviado', data_hora_envio: new Date().toISOString(), data_envio: new Date().toISOString() })
                    .eq('id', lembrete.id);
                  totalProcessados++;
                }
              } catch (err) {
                console.error(`❌ Exceção ao enviar e-mail do lembrete ${lembrete.id}:`, err);
                await supabase
                  .from('lembretes')
                  .update({ status_envio: 'erro', data_envio: new Date().toISOString() })
                  .eq('id', lembrete.id);
                totalErros++;
              }
              continue;
            }

            // Enviar mensagem via edge function enviar-whatsapp
            if (lembrete.canal === 'whatsapp') {
              const destinatario = lembrete.destinatario || 'lead';
              let telefoneEnvio: string | null = null;
              
              // Função auxiliar para validar se é um telefone real (só dígitos, mínimo 10)
              const isValidPhone = (phone: string | null | undefined): boolean => {
                if (!phone) return false;
                const digits = phone.replace(/\D/g, '');
                return digits.length >= 10;
              };

              // 1. Tentar usar telefone_responsavel se for um número válido
              if (lembrete.telefone_responsavel && isValidPhone(lembrete.telefone_responsavel)) {
                telefoneEnvio = lembrete.telefone_responsavel;
                console.log(`📱 Usando telefone do lembrete: ${telefoneEnvio} (destinatario: ${destinatario})`);
              }
              
              // 2. Se não tem telefone válido, resolver baseado no destinatário
              if (!telefoneEnvio) {
                if (destinatario === 'lead' || destinatario === 'ambos') {
                  // Buscar telefone do lead
                  telefoneEnvio = lembrete.compromisso.lead.phone || lembrete.compromisso.lead.telefone || null;
                  console.log(`📱 Fallback - Telefone do lead: ${telefoneEnvio || 'não encontrado'}`);
                }
                
                // Se destinatário é responsável ou ambos (e ainda sem telefone), buscar do perfil
                if (!telefoneEnvio && (destinatario === 'responsavel' || destinatario === 'ambos')) {
                  const responsavelId = lembrete.compromisso.usuario_responsavel_id;
                  if (responsavelId) {
                    const { data: profileResp } = await supabase
                      .from('profiles')
                      .select('phone')
                      .eq('id', responsavelId)
                      .single();
                    
                    if (profileResp?.phone && isValidPhone(profileResp.phone)) {
                      telefoneEnvio = profileResp.phone;
                      console.log(`📱 Telefone do responsável (profile): ${telefoneEnvio}`);
                    }
                  }
                }
                
                // Última tentativa: buscar nas conversas do lead
                if (!telefoneEnvio && lembrete.compromisso.lead_id) {
                  const { data: conversa } = await supabase
                    .from('conversas')
                    .select('numero, telefone_formatado')
                    .eq('lead_id', lembrete.compromisso.lead_id)
                    .not('numero', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                  
                  if (conversa) {
                    telefoneEnvio = conversa.telefone_formatado || conversa.numero;
                    console.log(`✅ Telefone encontrado nas conversas: ${telefoneEnvio}`);
                  }
                }
              }

            if (!telefoneEnvio) {
              console.error(`❌ Nenhum telefone disponível para lembrete ${lembrete.id}`);
              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'erro',
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);
              totalErros++;
              continue;
            }

            // Enviar UMA mensagem para o telefone definido
            const telefoneFormatado = telefoneEnvio.replace(/\D/g, '');
            let mensagemLembrete = lembrete.mensagem || `Olá! Lembramos do compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${new Date(lembrete.compromisso.data_hora_inicio).toLocaleString('pt-BR')}.`;

            // 🔗 Inserir link público de confirmação (token único do compromisso)
            const appBaseUrl = (Deno.env.get('PUBLIC_APP_URL') || 'https://app.wazecrm.online').replace(/\/$/, '');
            const token = (lembrete.compromisso as any)?.confirmation_token;
            const jaConfirmado = (lembrete.compromisso as any)?.status_confirmacao === 'confirmado';
            if (token && !jaConfirmado) {
              const linkConfirmacao = `${appBaseUrl}/c/${token}`;
              if (mensagemLembrete.includes('{link_confirmacao}')) {
                mensagemLembrete = mensagemLembrete.replace(/\{link_confirmacao\}/g, linkConfirmacao);
              } else if (!mensagemLembrete.includes('/c/')) {
                // Auto-append se não houver placeholder
                mensagemLembrete = `${mensagemLembrete}\n\n✅ Confirme seu agendamento clicando aqui:\n${linkConfirmacao}`;
              }
            }

            const midiaUrl = lembrete.midia_url || null;
            
            console.log(`📱 Enviando WhatsApp para: ${telefoneFormatado} via edge function ${midiaUrl ? '(com mídia)' : ''}`);

            let enviado = false;
            try {
              // Se tiver mídia, enviar primeiro a mídia e depois o texto separadamente
              if (midiaUrl) {
                console.log(`📷 Enviando mídia do lembrete: ${midiaUrl}`);
                
                // Enviar mídia com caption
                const mediaBody = {
                  numero: telefoneFormatado,
                  mensagem: mensagemLembrete, // Usar como caption
                  mediaUrl: midiaUrl,
                  tipo_mensagem: 'image',
                  company_id: lembrete.compromisso.company_id || companyId,
                };
                
                const { data: mediaResult, error: mediaError } = await supabase.functions.invoke(
                  'enviar-whatsapp',
                  { body: mediaBody }
                );
                
                if (mediaError || !mediaResult?.success) {
                  console.error(`❌ Erro ao enviar mídia do lembrete:`, mediaError || mediaResult);
                } else {
                  console.log(`✅ Mídia do lembrete enviada com sucesso`);
                  enviado = true;
                }
              } else {
                // Sem mídia, enviar apenas texto
                const requestBody = {
                  numero: telefoneFormatado,
                  mensagem: mensagemLembrete,
                  company_id: lembrete.compromisso.company_id || companyId,
                };
              
                // Chamar edge function enviar-whatsapp
                const { data: sendResult, error: sendError } = await supabase.functions.invoke(
                  'enviar-whatsapp',
                  { body: requestBody }
                );

                if (sendError || !sendResult?.success) {
                  console.error(`❌ Erro ao enviar WhatsApp via edge function:`, sendError || sendResult);
                } else {
                  console.log(`✅ WhatsApp enviado com sucesso via edge function`);
                  enviado = true;
                }
              }
            } catch (error) {
              console.error(`❌ Erro ao chamar edge function enviar-whatsapp:`, error);
            }

            // Salvar mensagem de lembrete na tabela conversas para ficar visível no CRM
            if (enviado) {
              try {
                const leadNome = lembrete.compromisso.lead?.name || 'Contato';
                
                // Buscar nome do usuário responsável pelo compromisso para assinatura
                let sentBy = 'Sistema';
                const responsavelId = lembrete.compromisso.usuario_responsavel_id;
                if (responsavelId) {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', responsavelId)
                    .single();
                  
                  if (profileData) {
                    sentBy = profileData.full_name || profileData.email || 'Sistema';
                  }
                }
                
                const { error: dbError } = await supabase.from('conversas').insert([{
                  numero: telefoneFormatado,
                  telefone_formatado: telefoneFormatado,
                  mensagem: mensagemLembrete,
                  origem: 'WhatsApp',
                  status: 'Enviada',
                  tipo_mensagem: midiaUrl ? 'image' : 'text',
                  midia_url: midiaUrl,
                  nome_contato: leadNome,
                  company_id: lembrete.compromisso.company_id || companyId,
                  lead_id: lembrete.compromisso.lead_id,
                  owner_id: responsavelId,
                  sent_by: sentBy,
                  fromme: true,
                }]);
                
                if (dbError) {
                  console.error(`❌ Erro ao salvar mensagem de lembrete no banco:`, dbError);
                } else {
                  console.log(`✅ Mensagem de lembrete salva no banco de dados`);
                }
              } catch (saveError) {
                console.error(`❌ Erro ao salvar mensagem de lembrete no banco:`, saveError);
              }
            }

            if (enviado) {
              // Verificar se lembrete tem recorrência
              const recorrencia = lembrete.recorrencia;
              const ativo = lembrete.ativo !== false;
              
              if (recorrencia && ativo) {
                // Calcular próxima data de envio baseado na recorrência
                const dataAtual = new Date(lembrete.proxima_data_envio || lembrete.data_envio || new Date().toISOString());
                let proximaData = new Date(dataAtual);
                
                switch (recorrencia) {
                  case 'semanal':
                    proximaData.setDate(proximaData.getDate() + 7);
                    break;
                  case 'quinzenal':
                    proximaData.setDate(proximaData.getDate() + 15);
                    break;
                  case 'mensal':
                    proximaData.setMonth(proximaData.getMonth() + 1);
                    break;
                }
                
                console.log(`🔄 Lembrete ${lembrete.id} é recorrente (${recorrencia}). Próximo envio: ${proximaData.toISOString()}`);
                
                // Atualizar lembrete para próximo envio (resetar status e tentativas)
                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'pendente',
                    data_envio: proximaData.toISOString(),
                    proxima_data_envio: proximaData.toISOString(),
                    tentativas: 0,
                    proxima_tentativa: null
                  })
                  .eq('id', lembrete.id);
                  
                console.log(`✅ Lembrete ${lembrete.id} recorrente reagendado para ${proximaData.toISOString()}`);
              } else {
                // Sem recorrência - marcar como enviado definitivamente
                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'enviado',
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);
              }

              // Atualizar flag no compromisso
              await supabase
                .from('compromissos')
                .update({ lembrete_enviado: true })
                .eq('id', lembrete.compromisso_id);

              // Criar notificação para o responsável do compromisso
              if (lembrete.compromisso.usuario_responsavel_id) {
                try {
                  const dataCompromisso = new Date(lembrete.compromisso.data_hora_inicio);
                  const mensagemNotificacao = `Lembrete enviado: Compromisso de ${lembrete.compromisso.tipo_servico} agendado para ${dataCompromisso.toLocaleString('pt-BR')}`;
                  
                  // Criar entrada na tabela de notificações (se existir) ou usar outro método
                  // Por enquanto, vamos criar uma entrada em uma tabela de notificações simples
                  // ou usar um campo no compromisso que o frontend pode verificar
                  
                  // Tentar inserir em uma tabela de notificações (se existir)
                  const { error: notifError } = await supabase.from('notificacoes').insert([{
                    usuario_id: lembrete.compromisso.usuario_responsavel_id,
                    tipo: 'lembrete_enviado',
                    titulo: 'Lembrete Enviado',
                    mensagem: mensagemNotificacao,
                    compromisso_id: lembrete.compromisso_id,
                    company_id: lembrete.compromisso.company_id || companyId,
                    lida: false,
                    created_at: new Date().toISOString()
                  }]).select();
                  
                  if (notifError) {
                    // Se a tabela não existir, apenas logar (não é crítico)
                    console.log(`ℹ️ Tabela de notificações não encontrada ou erro ao criar notificação:`, notifError.message);
                  } else {
                    console.log(`✅ Notificação criada para o responsável do compromisso`);
                  }
                } catch (notifError) {
                  console.log(`ℹ️ Erro ao criar notificação (não crítico):`, notifError);
                }
              }

              totalProcessados++;
              console.log(`✅ Lembrete ${lembrete.id} processado com sucesso`);
            } else {
              // Sistema de retry com backoff exponencial
              const tentativasAtuais = (lembrete.tentativas || 0) + 1;

              if (tentativasAtuais < 3) {
                // Calcular próxima tentativa com backoff exponencial: 1h, 3h, 24h
                const proximaTentativa = new Date();
                const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
                proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'retry',
                    tentativas: tentativasAtuais,
                    proxima_tentativa: proximaTentativa.toISOString(),
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);

                console.log(`🔄 Lembrete ${lembrete.id} agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
              } else {
                // Máximo de tentativas atingido
                await supabase
                  .from('lembretes')
                  .update({
                    status_envio: 'erro',
                    tentativas: tentativasAtuais,
                    data_envio: new Date().toISOString()
                  })
                  .eq('id', lembrete.id);

                totalErros++;
                console.log(`❌ Lembrete ${lembrete.id} falhou após ${tentativasAtuais} tentativas`);
              }
            }
          } else {
            console.log(`⚠️ Canal ${lembrete.canal} não suportado ainda`);
            // Mesmo para canais não suportados, aplicar retry se ainda houver tentativas
            const tentativasAtuais = (lembrete.tentativas || 0) + 1;

            if (tentativasAtuais < 3) {
              // Backoff exponencial: 1h, 3h, 24h
              const proximaTentativa = new Date();
              const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
              proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'retry',
                  tentativas: tentativasAtuais,
                  proxima_tentativa: proximaTentativa.toISOString(),
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);

              console.log(`🔄 Lembrete ${lembrete.id} (canal não suportado) agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
            } else {
              await supabase
                .from('lembretes')
                .update({
                  status_envio: 'erro',
                  tentativas: tentativasAtuais,
                  data_envio: new Date().toISOString()
                })
                .eq('id', lembrete.id);
              totalErros++;
            }
          }

        } catch (error) {
          console.error(`❌ Erro ao processar lembrete ${lembrete.id}:`, error);

          // Sistema de retry para erros de processamento
          const tentativasAtuais = (lembrete.tentativas || 0) + 1;

          if (tentativasAtuais < 3) {
            // Backoff exponencial: 1h, 3h, 24h
            const proximaTentativa = new Date();
            const horasBackoff = BACKOFF_TIMES_HOURS[tentativasAtuais - 1];
            proximaTentativa.setHours(proximaTentativa.getHours() + horasBackoff);

            await supabase
              .from('lembretes')
              .update({
                status_envio: 'retry',
                tentativas: tentativasAtuais,
                proxima_tentativa: proximaTentativa.toISOString(),
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);

            console.log(`🔄 Lembrete ${lembrete.id} (erro de processamento) agendado para retry ${tentativasAtuais}/3 em ${proximaTentativa.toISOString()} (backoff: ${horasBackoff}h)`);
          } else {
            await supabase
              .from('lembretes')
              .update({
                status_envio: 'erro',
                tentativas: tentativasAtuais,
                data_envio: new Date().toISOString()
              })
              .eq('id', lembrete.id);

            totalErros++;
            console.log(`❌ Lembrete ${lembrete.id} falhou após ${tentativasAtuais} tentativas (erro de processamento)`);
          }
        }
      }
    }

    console.log(`✅ Processamento concluído: ${totalProcessados} enviados, ${totalErros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        processados: totalProcessados,
        erros: totalErros,
        total: lembretes.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro fatal na função de lembretes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
