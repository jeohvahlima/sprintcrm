-- Campos clínicos no lead/paciente: NPS e histórico de procedimento.
-- Colunas adicionadas (sem impacto em empresas não-clínicas — ficam null).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS nps_score smallint,
  ADD COLUMN IF NOT EXISTS nps_comment text,
  ADD COLUMN IF NOT EXISTS nps_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS procedimentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS observacoes_clinicas text;

-- Validação leve do NPS (0-10)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_nps_score_range'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_nps_score_range
      CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10));
  END IF;
END$$;

-- Índice útil para reativação por inatividade (BI clínico e regras 30d)
CREATE INDEX IF NOT EXISTS idx_leads_company_last_interaction
  ON public.leads (company_id, last_interaction_at);