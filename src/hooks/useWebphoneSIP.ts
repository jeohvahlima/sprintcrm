import { useCallback, useEffect, useRef, useState } from 'react';
import * as JsSIP from 'jssip';
import { supabase } from '@/integrations/supabase/client';

export type SipRegStatus = 'idle' | 'connecting' | 'registered' | 'unregistered' | 'error';
export type SipCallState = 'idle' | 'outgoing' | 'incoming' | 'ringing' | 'active' | 'ended' | 'failed';

export interface WebphoneConfig {
  number_sip: string;
  sip_password: string;
  sip_ws_uri: string;
  sip_domain: string;
  display_name?: string;
}

interface UseWebphoneState {
  regStatus: SipRegStatus;
  regError: string | null;
  callState: SipCallState;
  callError: string | null;
  remoteNumber: string;
  remoteName: string;
  duration: number;
  muted: boolean;
  direction: 'in' | 'out' | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function sanitizeNumber(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  // NVOIP SIP/WSS disca para PSTN usando DDD + número. Não prefixar 55,
  // senão a chamada pode ficar presa no ramal em vez de sair direto ao contato.
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function useWebphoneSIP() {
  const uaRef = useRef<JsSIP.UA | null>(null);
  const sessionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const cfgRef = useRef<WebphoneConfig | null>(null);
  const regStatusRef = useRef<SipRegStatus>('idle');

  const [state, setState] = useState<UseWebphoneState>({
    regStatus: 'idle',
    regError: null,
    callState: 'idle',
    callError: null,
    remoteNumber: '',
    remoteName: '',
    duration: 0,
    muted: false,
    direction: null,
  });

  const patchState = useCallback((patch: Partial<UseWebphoneState> | ((prev: UseWebphoneState) => Partial<UseWebphoneState>)) => {
    setState((prev) => {
      const nextPatch = typeof patch === 'function' ? patch(prev) : patch;
      const next = { ...prev, ...nextPatch };
      if (nextPatch.regStatus) regStatusRef.current = nextPatch.regStatus;
      return next;
    });
  }, []);

  // Ensure a single global <audio> element to play remote stream
  useEffect(() => {
    let el = document.getElementById('webphone-remote-audio') as HTMLAudioElement | null;
    if (!el) {
      el = document.createElement('audio');
      el.id = 'webphone-remote-audio';
      el.autoplay = true;
      (el as any).playsInline = true;
      document.body.appendChild(el);
    }
    audioRef.current = el;
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      patchState((s) => ({ duration: s.duration + 1 }));
    }, 1000);
  };

  const ensureMicrophoneAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfone indisponível neste navegador.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotFoundError' || /device not found/i.test(String(e?.message || ''))) {
        throw new Error('Nenhum microfone encontrado. Conecte um headset/microfone ou habilite o dispositivo de áudio do Windows.');
      }
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error('Permissão de microfone negada. Clique no cadeado do navegador e permita o microfone.');
      }
      throw new Error(e?.message || 'Não foi possível acessar o microfone.');
    }
  }, []);

  const attachRemoteStream = useCallback((session: any) => {
    try {
      const pc: RTCPeerConnection = session.connection;
      if (!pc) return;
      const playStream = (stream: MediaStream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          audioRef.current.play().catch(() => {});
        }
      };
      pc.addEventListener('track', (e) => {
        if (e.streams && e.streams[0]) playStream(e.streams[0]);
      });
      // Fallback for older browsers
      const streams = (pc as any).getRemoteStreams ? (pc as any).getRemoteStreams() : [];
      if (streams && streams[0]) playStream(streams[0]);
    } catch (err) {
      console.error('[Webphone] attachRemoteStream error', err);
    }
  }, []);

  const wireSession = useCallback((session: any, direction: 'in' | 'out') => {
    sessionRef.current = session;

    session.on('progress', (e: any) => {
      const response = e?.response;
      const isRinging = response?.status_code === 180 || response?.status_code === 183;
      patchState({
        callState: direction === 'out'
          ? (isRinging ? 'ringing' : 'outgoing')
          : 'ringing',
        callError: null,
      });
    });
    session.on('accepted', () => {
      patchState({ callState: 'active', callError: null });
      startTimer();
    });
    session.on('confirmed', () => {
      patchState({ callState: 'active', callError: null });
      startTimer();
      attachRemoteStream(session);
    });
    session.on('ended', () => {
      stopTimer();
      patchState({ callState: 'ended', callError: null });
      sessionRef.current = null;
    });
    session.on('failed', (e: any) => {
      stopTimer();
      const cause = e?.cause || 'Falha na ligação SIP';
      console.warn('[Webphone] session failed', cause, e?.message);
      patchState({ callState: 'failed', callError: String(cause) });
      sessionRef.current = null;
    });
    session.on('peerconnection', () => attachRemoteStream(session));
  }, [attachRemoteStream]);

  const register = useCallback((cfg: WebphoneConfig) => {
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch {}
      uaRef.current = null;
    }
    cfgRef.current = cfg;
    patchState({ regStatus: 'connecting', regError: null });

    try {
      const socket = new JsSIP.WebSocketInterface(cfg.sip_ws_uri);
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${cfg.number_sip}@${cfg.sip_domain}`,
        authorization_user: cfg.number_sip,
        password: cfg.sip_password,
        display_name: cfg.display_name || 'CRM Webphone',
        session_timers: false,
        register: true,
      });

      ua.on('connecting', () => patchState({ regStatus: 'connecting' }));
      ua.on('connected', () => patchState({ regStatus: 'connecting' }));
      ua.on('disconnected', () => patchState({ regStatus: 'unregistered' }));
      ua.on('registered', () => patchState({ regStatus: 'registered', regError: null }));
      ua.on('unregistered', () => patchState({ regStatus: 'unregistered' }));
      ua.on('registrationFailed', (e: any) => {
        console.error('[Webphone] registrationFailed', e);
        patchState({ regStatus: 'error', regError: e?.cause || 'Falha no registro SIP' });
      });

      ua.on('newRTCSession', (data: any) => {
        const { session, originator, request } = data;
        if (originator === 'remote') {
          // Incoming call
          const fromUri = request?.from?.uri;
          const remoteNumber = fromUri?.user || '';
          const remoteName = request?.from?.display_name || remoteNumber;
          patchState({
            callState: 'incoming',
            callError: null,
            remoteNumber,
            remoteName,
            duration: 0,
            muted: false,
            direction: 'in',
          });
          wireSession(session, 'in');
        } else {
          // Outgoing - already wired in call()
        }
      });

      ua.start();
      uaRef.current = ua;
    } catch (err: any) {
      console.error('[Webphone] register error', err);
      patchState({ regStatus: 'error', regError: err?.message || 'Erro ao iniciar SIP' });
    }
  }, [patchState, wireSession]);

  const unregister = useCallback(() => {
    try { uaRef.current?.stop(); } catch {}
    uaRef.current = null;
    stopTimer();
    regStatusRef.current = 'idle';
    setState({
      regStatus: 'idle',
      regError: null,
      callState: 'idle',
      callError: null,
      remoteNumber: '',
      remoteName: '',
      duration: 0,
      muted: false,
      direction: null,
    });
  }, []);

  const call = useCallback(async (rawNumber: string, displayName?: string) => {
    const ua = uaRef.current;
    const cfg = cfgRef.current;
    if (!ua || !cfg) throw new Error('Webphone não registrado');
    if (regStatusRef.current !== 'registered') {
      throw new Error('SIP não registrado. Aguarde o status "Conectado".');
    }

    const digits = sanitizeNumber(rawNumber);
    if (digits.length < 10 || digits.length > 11) {
      throw new Error('Número inválido. Use DDD + número do contato.');
    }

    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch {}
      sessionRef.current = null;
    }

    await ensureMicrophoneAccess();

    const target = `sip:${digits}@${cfg.sip_domain}`;
    patchState({
      callState: 'outgoing',
      callError: null,
      remoteNumber: digits,
      remoteName: displayName || digits,
      duration: 0,
      muted: false,
      direction: 'out',
    });

    const session = ua.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: { iceServers: ICE_SERVERS },
    });
    if (!session) throw new Error('Não foi possível iniciar a sessão SIP.');
    wireSession(session, 'out');
  }, [ensureMicrophoneAccess, patchState, wireSession]);

  const answer = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: ICE_SERVERS },
    });
  }, []);

  const reject = useCallback(() => {
    try { sessionRef.current?.terminate(); } catch {}
  }, []);

  const hangup = useCallback(() => {
    try { sessionRef.current?.terminate(); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const pc: RTCPeerConnection | undefined = session.connection;
    if (!pc) return;
    let nextMuted = false;
    pc.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = !sender.track.enabled;
        nextMuted = !sender.track.enabled;
      }
    });
    patchState({ muted: nextMuted });
  }, [patchState]);

  const resetCall = useCallback(() => {
    patchState({
      callState: 'idle',
      callError: null,
      remoteNumber: '',
      remoteName: '',
      duration: 0,
      muted: false,
      direction: null,
    });
  }, [patchState]);

  const isRegistered = useCallback(() => regStatusRef.current === 'registered', []);

  // Log call to history when ended
  useEffect(() => {
    if (!['ended', 'failed'].includes(state.callState)) return;
    const direction = state.direction;
    const duration = state.duration;
    const phone = state.remoteNumber;
    const name = state.remoteName;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data: ur } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', u.user.id)
          .maybeSingle();
        if (!ur?.company_id) return;
        await supabase.from('call_history').insert({
          company_id: ur.company_id,
          user_id: u.user.id,
          phone_number: phone,
          lead_name: name,
          status: 'finalizado',
          call_end: new Date().toISOString(),
          duration_seconds: duration,
          call_result: duration > 0 ? 'atendida' : (direction === 'in' ? 'perdida' : 'nao_atendida'),
        });
      } catch (e) {
        console.error('[Webphone] history insert error', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.callState]);

  useEffect(() => () => {
    try { uaRef.current?.stop(); } catch {}
    stopTimer();
  }, []);

  return {
    ...state,
    register,
    unregister,
    call,
    answer,
    reject,
    hangup,
    toggleMute,
    resetCall,
    isRegistered,
  };
}
