import { useCallback, useEffect, useRef, useState } from 'react';
import * as JsSIP from 'jssip';
import { supabase } from '@/integrations/supabase/client';

export type SipRegStatus = 'idle' | 'connecting' | 'registered' | 'unregistered' | 'error';
export type SipCallState = 'idle' | 'outgoing' | 'incoming' | 'ringing' | 'active' | 'ended';

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
  remoteNumber: string;
  remoteName: string;
  duration: number;
  muted: boolean;
  direction: 'in' | 'out' | null;
}

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

  const [state, setState] = useState<UseWebphoneState>({
    regStatus: 'idle',
    regError: null,
    callState: 'idle',
    remoteNumber: '',
    remoteName: '',
    duration: 0,
    muted: false,
    direction: null,
  });

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
      setState((s) => ({ ...s, duration: s.duration + 1 }));
    }, 1000);
  };

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

    session.on('progress', () => {
      setState((s) => ({ ...s, callState: direction === 'out' ? 'outgoing' : 'ringing' }));
    });
    session.on('accepted', () => {
      setState((s) => ({ ...s, callState: 'active' }));
      startTimer();
    });
    session.on('confirmed', () => {
      setState((s) => ({ ...s, callState: 'active' }));
      startTimer();
      attachRemoteStream(session);
    });
    session.on('ended', () => {
      stopTimer();
      setState((s) => ({ ...s, callState: 'ended' }));
      sessionRef.current = null;
    });
    session.on('failed', (e: any) => {
      stopTimer();
      console.warn('[Webphone] session failed', e?.cause);
      setState((s) => ({ ...s, callState: 'ended' }));
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
    setState((s) => ({ ...s, regStatus: 'connecting', regError: null }));

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

      ua.on('connecting', () => setState((s) => ({ ...s, regStatus: 'connecting' })));
      ua.on('connected', () => setState((s) => ({ ...s, regStatus: 'connecting' })));
      ua.on('disconnected', () => setState((s) => ({ ...s, regStatus: 'unregistered' })));
      ua.on('registered', () => setState((s) => ({ ...s, regStatus: 'registered', regError: null })));
      ua.on('unregistered', () => setState((s) => ({ ...s, regStatus: 'unregistered' })));
      ua.on('registrationFailed', (e: any) => {
        console.error('[Webphone] registrationFailed', e);
        setState((s) => ({ ...s, regStatus: 'error', regError: e?.cause || 'Falha no registro SIP' }));
      });

      ua.on('newRTCSession', (data: any) => {
        const { session, originator, request } = data;
        if (originator === 'remote') {
          // Incoming call
          const fromUri = request?.from?.uri;
          const remoteNumber = fromUri?.user || '';
          const remoteName = request?.from?.display_name || remoteNumber;
          setState((s) => ({
            ...s,
            callState: 'incoming',
            remoteNumber,
            remoteName,
            duration: 0,
            muted: false,
            direction: 'in',
          }));
          wireSession(session, 'in');
        } else {
          // Outgoing - already wired in call()
        }
      });

      ua.start();
      uaRef.current = ua;
    } catch (err: any) {
      console.error('[Webphone] register error', err);
      setState((s) => ({ ...s, regStatus: 'error', regError: err?.message || 'Erro ao iniciar SIP' }));
    }
  }, [wireSession]);

  const unregister = useCallback(() => {
    try { uaRef.current?.stop(); } catch {}
    uaRef.current = null;
    stopTimer();
    setState({
      regStatus: 'idle',
      regError: null,
      callState: 'idle',
      remoteNumber: '',
      remoteName: '',
      duration: 0,
      muted: false,
      direction: null,
    });
  }, []);

  const call = useCallback((rawNumber: string, displayName?: string) => {
    const ua = uaRef.current;
    const cfg = cfgRef.current;
    if (!ua || !cfg) throw new Error('Webphone não registrado');
    if (state.regStatus !== 'registered') throw new Error('SIP não registrado. Aguarde o status "Conectado".');

    const digits = sanitizeNumber(rawNumber);
    const target = `sip:${digits}@${cfg.sip_domain}`;
    setState((s) => ({
      ...s,
      callState: 'outgoing',
      remoteNumber: digits,
      remoteName: displayName || digits,
      duration: 0,
      muted: false,
      direction: 'out',
    }));

    const session = ua.call(target, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
    wireSession(session, 'out');
  }, [state.regStatus, wireSession]);

  const answer = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.answer({
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
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
    setState((s) => ({ ...s, muted: nextMuted }));
  }, []);

  const resetCall = useCallback(() => {
    setState((s) => ({
      ...s,
      callState: 'idle',
      remoteNumber: '',
      remoteName: '',
      duration: 0,
      muted: false,
      direction: null,
    }));
  }, []);

  // Log call to history when ended
  useEffect(() => {
    if (state.callState !== 'ended') return;
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
  };
}
