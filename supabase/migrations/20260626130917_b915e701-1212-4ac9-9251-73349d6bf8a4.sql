
-- 1a. Novos campos em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_lead_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_bilateral_silence_notified_at timestamptz;

-- 1b. Trigger automático para last_lead_reply_at
CREATE OR REPLACE FUNCTION public.update_last_lead_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fromme = false THEN
    UPDATE public.leads
    SET last_lead_reply_at = NEW.created_at
    WHERE company_id = NEW.company_id
      AND (
        regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = regexp_replace(coalesce(NEW.telefone_formatado, NEW.numero, ''), '\D', '', 'g')
        OR regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(coalesce(NEW.telefone_formatado, NEW.numero, ''), '\D', '', 'g')
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_last_lead_reply ON public.conversas;
CREATE TRIGGER trg_update_last_lead_reply
AFTER INSERT ON public.conversas
FOR EACH ROW EXECUTE FUNCTION public.update_last_lead_reply();

-- 1c. lead_coach_cache
CREATE TABLE IF NOT EXISTS public.lead_coach_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  temperatura text CHECK (temperatura IN ('quente','morno','frio')),
  risco_de_perda integer DEFAULT 0,
  score_engajamento integer DEFAULT 0,
  score_intencao integer DEFAULT 0,
  score_fit integer DEFAULT 0,
  script text,
  scripts_alternativos jsonb DEFAULT '[]'::jsonb,
  cadencia jsonb DEFAULT '[]'::jsonb,
  objecoes_detectadas jsonb DEFAULT '[]'::jsonb,
  proximos_passos jsonb DEFAULT '[]'::jsonb,
  resumo text,
  analisado_em timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_coach_cache_lead_unique UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_coach_cache_lead_id ON public.lead_coach_cache(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_coach_cache_expires ON public.lead_coach_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_lead_coach_cache_company ON public.lead_coach_cache(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_coach_cache TO authenticated;
GRANT ALL ON public.lead_coach_cache TO service_role;

ALTER TABLE public.lead_coach_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_coach_cache_select_company" ON public.lead_coach_cache;
CREATE POLICY "lead_coach_cache_select_company" ON public.lead_coach_cache
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "lead_coach_cache_modify_company" ON public.lead_coach_cache;
CREATE POLICY "lead_coach_cache_modify_company" ON public.lead_coach_cache
  FOR ALL TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

CREATE OR REPLACE FUNCTION public.update_lead_coach_cache_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_coach_cache_updated_at ON public.lead_coach_cache;
CREATE TRIGGER trg_lead_coach_cache_updated_at
BEFORE UPDATE ON public.lead_coach_cache
FOR EACH ROW EXECUTE FUNCTION public.update_lead_coach_cache_updated_at();

-- 1d. Novos campos em follow_etapa_config
ALTER TABLE public.follow_etapa_config
  ADD COLUMN IF NOT EXISTS usar_script_ia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cooldown_dinamico boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cadencia_progressiva boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS detectar_silencio_bilateral boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dias_silencio_bilateral integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS escalar_gestor_em_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS gestor_id uuid;
