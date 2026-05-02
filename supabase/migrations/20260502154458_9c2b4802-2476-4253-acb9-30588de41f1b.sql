
-- Tabela de integração Google Calendar por usuário
CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_id UUID,
  google_email TEXT,
  google_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcal_int_user ON public.google_calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_gcal_int_company ON public.google_calendar_integrations(company_id);

ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own gcal integration" ON public.google_calendar_integrations;
CREATE POLICY "Users see own gcal integration"
  ON public.google_calendar_integrations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own gcal integration" ON public.google_calendar_integrations;
CREATE POLICY "Users insert own gcal integration"
  ON public.google_calendar_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own gcal integration" ON public.google_calendar_integrations;
CREATE POLICY "Users update own gcal integration"
  ON public.google_calendar_integrations FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own gcal integration" ON public.google_calendar_integrations;
CREATE POLICY "Users delete own gcal integration"
  ON public.google_calendar_integrations FOR DELETE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_gcal_int_updated ON public.google_calendar_integrations;
CREATE TRIGGER trg_gcal_int_updated
  BEFORE UPDATE ON public.google_calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas de sync no compromissos
ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_sync_source TEXT DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS convidar_lead_email BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembretes_config JSONB DEFAULT '{"popup":[10],"email":[60,1440]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_compromissos_google_event ON public.compromissos(google_event_id) WHERE google_event_id IS NOT NULL;
