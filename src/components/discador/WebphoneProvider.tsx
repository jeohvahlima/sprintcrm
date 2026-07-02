import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebphoneSIP } from '@/hooks/useWebphoneSIP';
import { IncomingCallPopup } from './IncomingCallPopup';

type Ctx = ReturnType<typeof useWebphoneSIP> & {
  mode: 'webphone' | 'callback' | 'microsip' | null;
  configured: boolean;
  sipNumber: string;
  reload: (forceRegister?: boolean) => Promise<void>;
  waitUntilRegistered: (timeoutMs?: number) => Promise<boolean>;
  isWebphoneReady: () => boolean;
};

const WebphoneCtx = createContext<Ctx | null>(null);

export const useWebphone = () => {
  const ctx = useContext(WebphoneCtx);
  if (!ctx) throw new Error('useWebphone must be used inside WebphoneProvider');
  return ctx;
};

export const WebphoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const webphone = useWebphoneSIP();
  const [mode, setMode] = useState<Ctx['mode']>(null);
  const [configured, setConfigured] = useState(false);
  const [sipNumber, setSipNumber] = useState('');
  const lastRegisterKey = useRef<string>('');
  const modeRef = useRef<Ctx['mode']>(null);
  const configuredRef = useRef(false);
  const regStatusRef = useRef(webphone.regStatus);

  useEffect(() => {
    regStatusRef.current = webphone.regStatus;
  }, [webphone.regStatus]);

  useEffect(() => {
    modeRef.current = mode;
    configuredRef.current = configured;
  }, [mode, configured]);

  const waitUntilRegistered = useCallback((timeoutMs = 12000) => {
    return new Promise<boolean>((resolve) => {
      if (regStatusRef.current === 'registered') {
        resolve(true);
        return;
      }
      const started = Date.now();
      const tick = () => {
        if (regStatusRef.current === 'registered') {
          resolve(true);
          return;
        }
        if (regStatusRef.current === 'error' || Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        window.setTimeout(tick, 150);
      };
      tick();
    });
  }, []);

  const isWebphoneReady = useCallback(
    () => modeRef.current === 'webphone' && configuredRef.current && regStatusRef.current === 'registered',
    []
  );

  const load = async (forceRegister = false) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setMode(null);
        setConfigured(false);
        setSipNumber('');
        return;
      }
      const { data: ur } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (!ur?.company_id) {
        setMode(null);
        setConfigured(false);
        setSipNumber('');
        return;
      }
      const { data: cfg } = await supabase
        .from('nvoip_config')
        .select('*')
        .eq('company_id', ur.company_id)
        .maybeSingle();

      const sipPassword = (cfg as any)?.sip_password;
      const numberSip = (cfg as any)?.number_sip;
      const wsUri = (cfg as any)?.sip_ws_uri || 'wss://app.nvoip.com.br:7443';
      const domain = (cfg as any)?.sip_domain || 'app.nvoip.com.br';
      const hasWebphoneCredentials = Boolean(sipPassword && numberSip);
      const m = hasWebphoneCredentials ? 'webphone' : ((cfg as any)?.telephony_mode || 'webphone');
      setMode(m);
      setSipNumber(numberSip || '');

      if (m === 'webphone' && hasWebphoneCredentials) {
        setConfigured(true);
        const key = `${numberSip}|${wsUri}|${domain}|${sipPassword}`;
        if (forceRegister || key !== lastRegisterKey.current) {
          lastRegisterKey.current = key;
          webphone.register({
            number_sip: numberSip,
            sip_password: sipPassword,
            sip_ws_uri: wsUri,
            sip_domain: domain,
            display_name: 'CRM',
          });
        }
      } else {
        setConfigured(false);
        if (!numberSip) setSipNumber('');
        if (lastRegisterKey.current) {
          webphone.unregister();
          lastRegisterKey.current = '';
        }
      }
    } catch (e) {
      console.error('[WebphoneProvider] load error', e);
    }
  };

  useEffect(() => {
    load();
    const onConfigUpdated = () => load(true);
    window.addEventListener('webphone-config-updated', onConfigUpdated);

    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') load();
      if (event === 'SIGNED_OUT') {
        webphone.unregister();
        lastRegisterKey.current = '';
        setSipNumber('');
      }
    });

    return () => {
      window.removeEventListener('webphone-config-updated', onConfigUpdated);
      sub.data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = useMemo(
    () => ({
      ...webphone,
      mode,
      configured,
      sipNumber,
      reload: load,
      waitUntilRegistered,
      isWebphoneReady,
    }),
    [webphone, mode, configured, sipNumber, waitUntilRegistered, isWebphoneReady]
  );

  return (
    <WebphoneCtx.Provider value={value}>
      {children}
      <IncomingCallPopup />
    </WebphoneCtx.Provider>
  );
};
