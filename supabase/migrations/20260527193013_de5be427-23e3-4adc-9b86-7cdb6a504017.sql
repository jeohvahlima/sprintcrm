
ALTER TABLE public.nvoip_config
  ADD COLUMN IF NOT EXISTS sip_password text,
  ADD COLUMN IF NOT EXISTS sip_ws_uri text DEFAULT 'wss://app.nvoip.com.br:7443',
  ADD COLUMN IF NOT EXISTS sip_domain text DEFAULT 'app.nvoip.com.br',
  ADD COLUMN IF NOT EXISTS telephony_mode text DEFAULT 'webphone';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nvoip_config_telephony_mode_check'
  ) THEN
    ALTER TABLE public.nvoip_config
      ADD CONSTRAINT nvoip_config_telephony_mode_check
      CHECK (telephony_mode IN ('webphone','callback','microsip'));
  END IF;
END $$;
