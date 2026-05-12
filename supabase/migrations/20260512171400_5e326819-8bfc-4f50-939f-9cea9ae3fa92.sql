CREATE TABLE IF NOT EXISTS public.pre_sdr_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  row_key TEXT NOT NULL,
  empresa_nome TEXT,
  telefone TEXT,
  cnpj TEXT,
  site TEXT,
  raw_row JSONB NOT NULL DEFAULT '{}'::jsonb,
  brief JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pre_sdr_analyses_status_check CHECK (status IN ('pending', 'running', 'done', 'error')),
  CONSTRAINT pre_sdr_analyses_company_row_key_unique UNIQUE (company_id, row_key)
);

ALTER TABLE public.pre_sdr_analyses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pre_sdr_analyses_company_updated
  ON public.pre_sdr_analyses(company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pre_sdr_analyses_company_status
  ON public.pre_sdr_analyses(company_id, status);

CREATE POLICY "company members can view pre sdr analyses"
ON public.pre_sdr_analyses FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "company members can insert pre sdr analyses"
ON public.pre_sdr_analyses FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()) AND user_id = auth.uid());

CREATE POLICY "company members can update pre sdr analyses"
ON public.pre_sdr_analyses FOR UPDATE
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()))
WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "company members can delete pre sdr analyses"
ON public.pre_sdr_analyses FOR DELETE
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE OR REPLACE FUNCTION public.touch_pre_sdr_analyses()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pre_sdr_analyses ON public.pre_sdr_analyses;
CREATE TRIGGER trg_touch_pre_sdr_analyses
BEFORE UPDATE ON public.pre_sdr_analyses
FOR EACH ROW EXECUTE FUNCTION public.touch_pre_sdr_analyses();