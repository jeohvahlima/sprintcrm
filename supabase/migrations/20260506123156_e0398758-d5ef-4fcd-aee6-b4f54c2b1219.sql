ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_disparo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_disparo_campaign TEXT,
  ADD COLUMN IF NOT EXISTS disparo_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_last_disparo_at ON public.leads(last_disparo_at);