
ALTER TABLE public.pre_sdr_analyses
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_to_coldcall_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pre_sdr_company_outcome ON public.pre_sdr_analyses(company_id, outcome);
