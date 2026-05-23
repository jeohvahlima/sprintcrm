-- ===== Enum =====
DO $$ BEGIN
  CREATE TYPE public.hunter_stage AS ENUM (
    'novo','tentativa_contato','follow_up','contato_realizado',
    'buscando_decisor','conversa_decisor','oportunidade','descartado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Tabela principal =====
CREATE TABLE IF NOT EXISTS public.hunter_pipeline_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID,
  assigned_to UUID,
  stage public.hunter_stage NOT NULL DEFAULT 'novo',
  substatus TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  next_action_reason TEXT,
  contact_person_name TEXT,
  decisor_classificacao TEXT CHECK (decisor_classificacao IN ('A','B','C')),
  dor_identificada TEXT,
  meeting_at TIMESTAMPTZ,
  discard_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_hpl_company_stage ON public.hunter_pipeline_leads(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_hpl_assigned ON public.hunter_pipeline_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hpl_lead ON public.hunter_pipeline_leads(lead_id);

ALTER TABLE public.hunter_pipeline_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hpl_select_company" ON public.hunter_pipeline_leads
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "hpl_insert_company" ON public.hunter_pipeline_leads
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "hpl_update_company" ON public.hunter_pipeline_leads
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "hpl_delete_company" ON public.hunter_pipeline_leads
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE TRIGGER tg_hpl_updated BEFORE UPDATE ON public.hunter_pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Eventos / timeline =====
CREATE TABLE IF NOT EXISTS public.hunter_pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_pipeline_id UUID NOT NULL REFERENCES public.hunter_pipeline_leads(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  from_stage public.hunter_stage,
  to_stage public.hunter_stage,
  payload JSONB DEFAULT '{}'::jsonb,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpe_pipeline ON public.hunter_pipeline_events(lead_pipeline_id);
CREATE INDEX IF NOT EXISTS idx_hpe_company_user ON public.hunter_pipeline_events(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_hpe_company_created ON public.hunter_pipeline_events(company_id, created_at);

ALTER TABLE public.hunter_pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hpe_select_company" ON public.hunter_pipeline_events
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "hpe_insert_company" ON public.hunter_pipeline_events
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

-- ===== Trigger: pontuação + auto-move 3 tentativas =====
CREATE OR REPLACE FUNCTION public.tg_hunter_event_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempts INT;
BEGIN
  -- Atribui pontos conforme o evento
  IF NEW.points = 0 THEN
    NEW.points := CASE NEW.event_type
      WHEN 'call_attempt' THEN 1
      WHEN 'contact_made' THEN 3
      WHEN 'reached_decisor' THEN 5
      WHEN 'opportunity' THEN 10
      ELSE 0
    END;
  END IF;

  -- Para tentativa de ligação sem sucesso, incrementa contador
  IF NEW.event_type = 'call_attempt' THEN
    UPDATE public.hunter_pipeline_leads
      SET attempts = attempts + 1,
          last_action_at = now()
      WHERE id = NEW.lead_pipeline_id
      RETURNING attempts INTO v_attempts;

    -- Após 3 tentativas no estágio tentativa_contato, move para follow_up
    IF v_attempts >= 3 THEN
      UPDATE public.hunter_pipeline_leads
        SET stage = 'follow_up',
            next_action_reason = COALESCE(next_action_reason, '3 tentativas sem sucesso — agendar retomada')
        WHERE id = NEW.lead_pipeline_id
          AND stage = 'tentativa_contato';
    END IF;
  ELSE
    UPDATE public.hunter_pipeline_leads
      SET last_action_at = now()
      WHERE id = NEW.lead_pipeline_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_hunter_event_handler ON public.hunter_pipeline_events;
CREATE TRIGGER tg_hunter_event_handler
  BEFORE INSERT ON public.hunter_pipeline_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_hunter_event_handler();

-- ===== Realtime =====
ALTER TABLE public.hunter_pipeline_leads REPLICA IDENTITY FULL;
ALTER TABLE public.hunter_pipeline_events REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hunter_pipeline_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hunter_pipeline_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;