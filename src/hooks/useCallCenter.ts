import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CallRecord {
  id: string;
  company_id: string;
  lead_id: string | null;
  user_id: string;
  phone_number: string;
  lead_name: string | null;
  call_start: string;
  call_end: string | null;
  duration_seconds: number;
  status: string;
  call_result: string | null;
  notes: string | null;
  notes_required: boolean;
  created_at: string;
  updated_at: string;
}

export type CallStatus = 'idle' | 'iniciando' | 'chamando' | 'tocando' | 'conectado' | 'finalizado' | 'falha';

interface CallState {
  isActive: boolean;
  status: CallStatus;
  leadId: string | null;
  leadName: string;
  phoneNumber: string;
  callRecordId: string | null;
  nvoipCallId: string | null;
  startTime: Date | null;
  duration: number;
  isMuted: boolean;
}

// Map Nvoip status → CRM status
const mapNvoipStatus = (nvoipStatus: string): CallStatus => {
  switch (nvoipStatus) {
    case 'calling_origin': return 'iniciando';
    case 'calling_destination': return 'chamando';
    case 'ringing': return 'tocando';
    case 'established': return 'conectado';
    case 'noanswer':
    case 'busy':
    case 'failed': return 'falha';
    case 'finished': return 'finalizado';
    default: return 'chamando';
  }
};

export const useCallCenter = () => {
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    status: 'idle',
    leadId: null,
    leadName: '',
    phoneNumber: '',
    callRecordId: null,
    nvoipCallId: null,
    startTime: null,
    duration: 0,
    isMuted: false
  });

  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load call history
  const loadCallHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const { data, error } = await supabase
        .from('call_history')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('call_start', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCallHistory((data as CallRecord[]) || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Call Nvoip edge function
  const callNvoip = useCallback(async (action: string, payload: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('nvoip-call', {
      body: { action, ...payload }
    });
    if (error) throw new Error(error.message || 'Erro na edge function');
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  // Poll call status from Nvoip
  const startPolling = useCallback((nvoipCallId: string, callRecordId: string) => {
    // Start duration counter
    durationIntervalRef.current = setInterval(() => {
      setCallState(prev => {
        if (prev.status === 'conectado') {
          return { ...prev, duration: prev.duration + 1 };
        }
        return prev;
      });
    }, 1000);

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const result = await callNvoip('check-call', { callId: nvoipCallId });
        
        // Nvoip returns array or object
        const callData = Array.isArray(result) ? result[0] : result;
        if (!callData) return;

        const nvoipStatus = callData.status || callData.callStatus;
        const crmStatus = mapNvoipStatus(nvoipStatus);

        setCallState(prev => {
          if (prev.status === crmStatus) return prev;
          return { ...prev, status: crmStatus };
        });

        // Update DB status
        await supabase
          .from('call_history')
          .update({ status: crmStatus })
          .eq('id', callRecordId);

        // If call ended, stop polling and save recording
        if (['finalizado', 'falha'].includes(crmStatus)) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }

          const recordingUrl = callData.linkAudio || callData.recording_url || null;
          const duration = callData.duration || callData.callDuration || 0;

          await supabase
            .from('call_history')
            .update({
              status: crmStatus,
              call_end: new Date().toISOString(),
              duration_seconds: duration,
              recording_url: recordingUrl,
              call_result: crmStatus === 'falha' ? nvoipStatus : 'atendida'
            })
            .eq('id', callRecordId);

          setCallState(prev => ({
            ...prev,
            duration: duration || prev.duration,
            status: crmStatus
          }));
        }
      } catch (error) {
        console.error('Erro no polling:', error);
      }
    }, 2000);
  }, [callNvoip]);

  // Start a call
  const startCall = useCallback(async (leadId: string | null, leadName: string, phoneNumber: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error('Empresa não encontrada');
        return false;
      }

      // Get Nvoip config (NumberSIP + DID)
      const configResult = await callNvoip('get-config');
      if (!configResult?.config?.number_sip) {
        toast.error('Configuração Nvoip não encontrada. Configure o NumberSIP.');
        return false;
      }

      const numberSip = configResult.config.number_sip;
      const callerNumber = configResult.config.caller_number;
      if (!callerNumber) {
        toast.error('Configure o "Número do ramal/DID" em Call Center → Conta Telefônica para fazer ligações reais.');
        return false;
      }
      if (!configResult.config.napikey) {
        toast.error('Configure a Napikey da Nvoip em Call Center → Conta Telefônica.');
        return false;
      }

      // Clean phone number
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Create call record
      const { data: callRecord, error } = await supabase
        .from('call_history')
        .insert({
          company_id: userRole.company_id,
          lead_id: leadId,
          user_id: userData.user.id,
          phone_number: phoneNumber,
          lead_name: leadName,
          status: 'iniciando'
        })
        .select()
        .single();

      if (error) throw error;

      setCallState({
        isActive: true,
        status: 'iniciando',
        leadId,
        leadName,
        phoneNumber,
        callRecordId: callRecord.id,
        nvoipCallId: null,
        startTime: new Date(),
        duration: 0,
        isMuted: false
      });

      // Make real call via Nvoip (caller = DID/ramal, called = cliente)
      const nvoipResult = await callNvoip('make-call', {
        caller: callerNumber,
        called: cleanPhone
      });

      const nvoipCallId = nvoipResult?.callId || nvoipResult?.id;
      if (!nvoipCallId) {
        throw new Error('Nvoip não retornou callId');
      }

      // Save nvoip_call_id
      await supabase
        .from('call_history')
        .update({ nvoip_call_id: nvoipCallId })
        .eq('id', callRecord.id);

      setCallState(prev => ({ ...prev, nvoipCallId }));

      // Start polling
      startPolling(nvoipCallId, callRecord.id);

      toast.success('Ligação iniciada!');
      return true;
    } catch (error: any) {
      console.error('Erro ao iniciar ligação:', error);
      toast.error(`Erro ao iniciar ligação: ${error.message || 'Erro desconhecido'}`);
      setCallState(prev => ({ ...prev, status: 'falha', isActive: false }));
      return false;
    }
  }, [callNvoip, startPolling]);

  // End call
  const endCall = useCallback(async (result?: string) => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // End call on Nvoip
    if (callState.nvoipCallId) {
      try {
        await callNvoip('end-call', { callId: callState.nvoipCallId });
      } catch (error) {
        console.error('Erro ao encerrar chamada na Nvoip:', error);
      }
    }

    if (callState.callRecordId) {
      try {
        await supabase
          .from('call_history')
          .update({
            status: 'finalizado',
            call_end: new Date().toISOString(),
            duration_seconds: callState.duration,
            call_result: result || 'encerrada'
          })
          .eq('id', callState.callRecordId);
      } catch (error) {
        console.error('Erro ao finalizar ligação:', error);
      }
    }

    setCallState(prev => ({
      ...prev,
      status: 'finalizado'
    }));
  }, [callState.callRecordId, callState.duration, callState.nvoipCallId, callNvoip]);

  // Save notes after call
  const saveCallNotes = useCallback(async (notes: string) => {
    if (!callState.callRecordId) return false;

    try {
      const { error } = await supabase
        .from('call_history')
        .update({ notes, notes_required: false })
        .eq('id', callState.callRecordId);

      if (error) throw error;

      setCallState({
        isActive: false,
        status: 'idle',
        leadId: null,
        leadName: '',
        phoneNumber: '',
        callRecordId: null,
        nvoipCallId: null,
        startTime: null,
        duration: 0,
        isMuted: false
      });

      await loadCallHistory();
      toast.success('Anotações salvas com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao salvar anotações:', error);
      toast.error('Erro ao salvar anotações');
      return false;
    }
  }, [callState.callRecordId, loadCallHistory]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  // Get SDR metrics
  const getSDRMetrics = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayCalls } = await supabase
        .from('call_history')
        .select('*')
        .eq('company_id', userRole.company_id)
        .gte('call_start', today.toISOString())
        .lt('call_start', tomorrow.toISOString());

      const { data: allCalls } = await supabase
        .from('call_history')
        .select('*')
        .eq('company_id', userRole.company_id);

      const calls = (todayCalls as CallRecord[]) || [];
      const allCallsData = (allCalls as CallRecord[]) || [];

      const totalCalls = calls.length;
      const answeredCalls = calls.filter(c => c.call_result === 'atendida').length;
      const missedCalls = calls.filter(c => ['recusada', 'caixa_postal', 'falha'].includes(c.call_result || '')).length;
      const totalDuration = calls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

      const userCallCounts: Record<string, number> = {};
      allCallsData.forEach(call => {
        userCallCounts[call.user_id] = (userCallCounts[call.user_id] || 0) + 1;
      });

      return {
        totalCalls,
        answeredCalls,
        missedCalls,
        avgDuration,
        totalDuration,
        conversionRate: totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
        userRankings: userCallCounts
      };
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    callState,
    callHistory,
    isLoading,
    startCall,
    endCall,
    saveCallNotes,
    toggleMute,
    loadCallHistory,
    getSDRMetrics
  };
};
