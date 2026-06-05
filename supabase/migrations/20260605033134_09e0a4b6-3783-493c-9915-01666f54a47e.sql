
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  display_name text,
  phone_number text,
  phone_number_id text,
  business_account_id text,
  access_token text,
  webhook_verify_token text,
  webhook_url text,
  quality_rating text,
  messaging_tier text,
  daily_message_limit integer DEFAULT 1000,
  messages_sent_today integer DEFAULT 0,
  meta_balance_cents integer DEFAULT 0,
  last_template_sync_at timestamptz,
  last_balance_sync_at timestamptz,
  dashboard_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_alerts jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_config TO authenticated;
GRANT ALL ON public.meta_whatsapp_config TO service_role;

ALTER TABLE public.meta_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read meta config"
  ON public.meta_whatsapp_config FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Company admins manage meta config"
  ON public.meta_whatsapp_config FOR ALL
  TO authenticated
  USING (
    company_id IN (SELECT public.get_user_company_ids())
    AND (public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'gestor'))
  )
  WITH CHECK (
    company_id IN (SELECT public.get_user_company_ids())
    AND (public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE OR REPLACE FUNCTION public.tg_meta_whatsapp_config_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_meta_whatsapp_config_updated ON public.meta_whatsapp_config;
CREATE TRIGGER trg_meta_whatsapp_config_updated
  BEFORE UPDATE ON public.meta_whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_meta_whatsapp_config_updated();
