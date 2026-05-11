CREATE TABLE IF NOT EXISTS public.prospeccao_smart_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sdr_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  closer_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.prospeccao_smart_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members can view smart routines"
ON public.prospeccao_smart_routines FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "company members can insert smart routines"
ON public.prospeccao_smart_routines FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "company members can update smart routines"
ON public.prospeccao_smart_routines FOR UPDATE
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()))
WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE POLICY "company members can delete smart routines"
ON public.prospeccao_smart_routines FOR DELETE
TO authenticated
USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE OR REPLACE FUNCTION public.touch_prospeccao_smart_routines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_psr ON public.prospeccao_smart_routines;
CREATE TRIGGER trg_touch_psr BEFORE UPDATE ON public.prospeccao_smart_routines
FOR EACH ROW EXECUTE FUNCTION public.touch_prospeccao_smart_routines();