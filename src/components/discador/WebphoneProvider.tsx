import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebphoneSIP } from '@/hooks/useWebphoneSIP';
import { IncomingCallPopup } from './IncomingCallPopup';

type Ctx = ReturnType<typeof useWebphoneSIP> & {
  mode: 'webphone' | 'callback' | 'microsip' | null;
  configured: boolean;
  reload: () => Promise<void>;
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
  const lastRegisterKey = useRef<string>('');

  const load = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setMode(null);
        setConfigured(false);
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
        return;
      }
      const { data: cfg } = await supabase
        .from('nvoip_config')
        .select('*')
        .eq('company_id', ur.company_id)
        .maybeSingle();

      const m = (cfg as any)?.telephony_mode || 'webphone';
      setMode(m);

      const sipPassword = (cfg as any)?.sip_password;
      const numberSip = (cfg as any)?.number_sip;
      const wsUri = (cfg as any)?.sip_ws_uri || 'wss://app.nvoip.com.br:7443';
      const domain = (cfg as any)?.sip_domain || 'app.nvoip.com.br';

      if (m === 'webphone' && sipPassword && numberSip) {
        setConfigured(true);
        const key = `${numberSip}|${wsUri}|${domain}|${sipPassword.length}`;
        if (key !== lastRegisterKey.current) {
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
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') load();
      if (event === 'SIGNED_OUT') {
        webphone.unregister();
        lastRegisterKey.current = '';
      }
    });
    return () => { sub.data.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = { ...webphone, mode, configured, reload: load };

  return (
    <WebphoneCtx.Provider value={value}>
      {children}
      <IncomingCallPopup />
    </WebphoneCtx.Provider>
  );
};
