import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, acao } = await req.json();
    if (!token || !acao) {
      return new Response(JSON.stringify({ error: 'token e acao são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar compromisso pelo token
    const { data: comp, error: compErr } = await supabase
      .from('compromissos')
      .select(`
        id, data_hora_inicio, tipo_servico, lead_id, company_id,
        usuario_responsavel_id, telefone, paciente,
        lead:leads (name, phone, telefone)
      `)
      .eq('confirmation_token', token)
      .maybeSingle();

    if (compErr || !comp) {
      console.error('Compromisso não encontrado:', compErr);
      return new Response(JSON.stringify({ error: 'Compromisso não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const leadNome = (comp as any).lead?.name || comp.paciente || 'Cliente';
    const telefone = (comp as any).lead?.phone || (comp as any).lead?.telefone || comp.telefone;
    const dataFmt = new Date(comp.data_hora_inicio).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    });

    const mensagem = acao === 'confirmar'
      ? `✅ *Agendamento confirmado!*\n\nOlá ${leadNome}, recebemos sua confirmação para ${dataFmt}.\n\nObrigado! Te esperamos no horário marcado. 🙌`
      : `❌ *Agendamento não confirmado*\n\nOlá ${leadNome}, recebemos sua resposta sobre o agendamento de ${dataFmt}.\nEntraremos em contato para reagendar.`;

    if (!telefone) {
      return new Response(JSON.stringify({ success: true, skipped: 'sem telefone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const numero = String(telefone).replace(/\D/g, '');
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('enviar-whatsapp', {
      body: { numero, mensagem, company_id: comp.company_id }
    });

    if (sendError || !(sendResult as any)?.success) {
      console.error('Falha enviar-whatsapp:', sendError || sendResult);
      // Fallback: registra como mensagem do sistema no chat
      await supabase.from('conversas').insert([{
        numero, telefone_formatado: numero, mensagem,
        origem: 'Sistema', status: 'Enviada', tipo_mensagem: 'text',
        lead_id: comp.lead_id, company_id: comp.company_id,
        owner_id: comp.usuario_responsavel_id, fromme: true,
        sent_by: 'sistema', read: true, delivered: false,
      }]);
      return new Response(JSON.stringify({ success: false, error: 'whatsapp falhou, salvo como nota' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // enviar-whatsapp já registra na conversas, então não duplicamos aqui
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Erro notificar-confirmacao:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
