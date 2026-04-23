import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SkipMotivo =
  | 'no_active_flow'
  | 'human_assignment'
  | 'excluded_tag'
  | 'out_of_schedule'
  | 'keyword_no_match'
  | 'no_trigger_match'
  | 'flow_state_active'
  | 'ai_mode_off';

export interface SkipLog {
  id: string;
  company_id: string;
  telefone: string;
  flow_id: string | null;
  motivo: string;
  details: Record<string, any>;
  created_at: string;
}

export interface FlowState {
  conversation_number: string;
  flow_id: string;
  current_node_id: string;
  waiting_for_input: boolean;
  expires_at: string;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  telefone_formatado: string;
  assigned_user_id: string;
  company_id: string;
  created_at: string;
}

export const MOTIVO_LABEL: Record<string, { label: string; color: string; tip: string }> = {
  no_active_flow: { label: 'Nenhum fluxo ativo', color: 'bg-amber-500', tip: 'Esta empresa não tem nenhum fluxo de URA ativo. Vá em IA → Fluxos e ative um.' },
  human_assignment: { label: 'Atendimento humano', color: 'bg-blue-500', tip: 'A conversa está atribuída a um colaborador. A URA fica pausada por padrão. Use "Liberar" para reativar.' },
  excluded_tag: { label: 'Tag bloqueada', color: 'bg-purple-500', tip: 'Este lead tem uma tag listada em "tags excluídas" do fluxo. Edite as configurações do fluxo ou remova a tag do lead.' },
  out_of_schedule: { label: 'Fora do horário', color: 'bg-gray-500', tip: 'A URA está fora do horário configurado. Verifique Configurações → Horário do fluxo.' },
  keyword_no_match: { label: 'Sem palavra-chave', color: 'bg-orange-500', tip: 'O fluxo só dispara com palavras-chave específicas e a mensagem do contato não casou.' },
  no_trigger_match: { label: 'Sem gatilho', color: 'bg-red-500', tip: 'O fluxo não tem gatilho "nova_mensagem" nem "palavra_chave". Adicione um gatilho válido.' },
  flow_state_active: { label: 'URA aguardando resposta', color: 'bg-green-500', tip: 'A URA está esperando o contato responder ao menu. Use "Resetar URA" para reiniciar.' },
  ai_mode_off: { label: 'IA/URA desativada', color: 'bg-zinc-500', tip: 'Esta conversa tem IA desligada manualmente. Reative no chat.' },
};

export function useAutomationDiagnostics(companyId: string | null, telefoneFilter: string = '') {
  const [skipLogs, setSkipLogs] = useState<SkipLog[]>([]);
  const [flowStates, setFlowStates] = useState<FlowState[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const tel = telefoneFilter.replace(/\D/g, '');

  const refetch = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let q1 = supabase
        .from('automation_skip_logs' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (tel) q1 = q1.ilike('telefone', `%${tel}%`);
      const { data: logs } = await q1;
      setSkipLogs((logs as any) || []);

      let q2 = supabase
        .from('conversation_flow_state' as any)
        .select('*')
        .eq('company_id', companyId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      if (tel) q2 = q2.ilike('conversation_number', `%${tel}%`);
      const { data: states } = await q2;
      setFlowStates((states as any) || []);

      let q3 = supabase
        .from('conversation_assignments' as any)
        .select('*')
        .eq('company_id', companyId)
        .not('assigned_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (tel) q3 = q3.ilike('telefone_formatado', `%${tel}%`);
      const { data: assigns } = await q3;
      setAssignments((assigns as any) || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, tel]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Realtime: nova entrada de skip
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`skip-logs-${companyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'automation_skip_logs', filter: `company_id=eq.${companyId}` },
        (payload) => {
          const row = payload.new as SkipLog;
          if (!tel || row.telefone.includes(tel)) {
            setSkipLogs((prev) => [row, ...prev].slice(0, 100));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [companyId, tel]);

  return { skipLogs, flowStates, assignments, loading, refetch };
}

export async function resetConversationState(
  telefone: string,
  companyId: string,
  actions: Array<'flow_state' | 'assignment' | 'attendance'>,
) {
  const { data, error } = await supabase.functions.invoke('resetar-fluxo-conversa', {
    body: { telefone, companyId, actions },
  });
  if (error) throw error;
  return data;
}
