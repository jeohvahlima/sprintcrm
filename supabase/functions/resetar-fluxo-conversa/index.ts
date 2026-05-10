// Reseta o estado de URA/atendimento de uma conversa específica.
// Pode limpar: conversation_flow_state, conversation_assignments, active_attendances
// e reativar o modo Fluxo/URA em conversation_ai_settings.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Validar JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const telefone = String(body?.telefone || '').replace(/\D/g, '');
    const companyId = String(body?.companyId || '');
    const actions: string[] = Array.isArray(body?.actions) ? body.actions : ['flow_state'];

    if (!telefone || !companyId) {
      return new Response(JSON.stringify({ error: 'telefone e companyId são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar que o usuário pertence à company
    const { data: roles } = await supabase
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', user.id);
    const userCompanies = (roles || []).map((r: any) => r.company_id);
    const isSuperAdmin = (roles || []).some((r: any) => r.role === 'super_admin');
    if (!isSuperAdmin && !userCompanies.includes(companyId)) {
      return new Response(JSON.stringify({ error: 'Sem permissão nesta empresa' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: Record<string, number> = {};

    if (actions.includes('flow_state')) {
      const { count } = await supabase
        .from('conversation_flow_state')
        .delete({ count: 'exact' })
        .eq('conversation_number', telefone)
        .eq('company_id', companyId);
      result.flow_state_deleted = count || 0;
    }

    if (actions.includes('assignment')) {
      const { count } = await supabase
        .from('conversation_assignments')
        .delete({ count: 'exact' })
        .eq('telefone_formatado', telefone)
        .eq('company_id', companyId);
      result.assignments_deleted = count || 0;
    }

    if (actions.includes('attendance')) {
      const { count } = await supabase
        .from('active_attendances')
        .delete({ count: 'exact' })
        .eq('telefone_formatado', telefone)
        .eq('company_id', companyId);
      result.attendances_deleted = count || 0;
    }

    if (actions.includes('ai_mode')) {
      const { error: aiModeError } = await supabase
        .from('conversation_ai_settings')
        .upsert({
          conversation_id: telefone,
          company_id: companyId,
          ai_mode: 'fluxo',
          activated_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'conversation_id,company_id' });

      if (aiModeError) throw aiModeError;
      result.ai_mode_reactivated = 1;
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ [RESET] erro:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
