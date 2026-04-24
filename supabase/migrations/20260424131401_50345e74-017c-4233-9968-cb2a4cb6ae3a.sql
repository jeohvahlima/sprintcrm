
-- ============================================
-- PROSPECÇÃO: Filas + Auto-registro multicanal
-- ============================================

-- 1) Coluna "Para prospectar" em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS to_prospect BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prospecting_priority INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_prospected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_to_prospect ON public.leads(company_id, to_prospect) WHERE to_prospect = true;

-- 2) Filas de prospecção
CREATE TABLE IF NOT EXISTS public.prospecting_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  channel TEXT NOT NULL DEFAULT 'cold_call', -- cold_call | instagram | whatsapp | mixed
  color TEXT DEFAULT '#06b6d4',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  assigned_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queues_select_company" ON public.prospecting_queues FOR SELECT
  USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queues_insert_company" ON public.prospecting_queues FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queues_update_company" ON public.prospecting_queues FOR UPDATE
  USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queues_delete_company" ON public.prospecting_queues FOR DELETE
  USING (company_id IN (SELECT get_user_company_ids()));

-- 3) Leads dentro das filas
CREATE TABLE IF NOT EXISTS public.prospecting_queue_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.prospecting_queues(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | working | done | skipped
  assigned_user_id UUID,
  position INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (queue_id, lead_id)
);

ALTER TABLE public.prospecting_queue_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_leads_select_company" ON public.prospecting_queue_leads FOR SELECT
  USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queue_leads_insert_company" ON public.prospecting_queue_leads FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queue_leads_update_company" ON public.prospecting_queue_leads FOR UPDATE
  USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "queue_leads_delete_company" ON public.prospecting_queue_leads FOR DELETE
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE INDEX IF NOT EXISTS idx_queue_leads_queue ON public.prospecting_queue_leads(queue_id, status, position);
CREATE INDEX IF NOT EXISTS idx_queue_leads_lead ON public.prospecting_queue_leads(lead_id);

-- 4) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_pq ON public.prospecting_queues;
CREATE TRIGGER set_updated_at_pq BEFORE UPDATE ON public.prospecting_queues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pql ON public.prospecting_queue_leads;
CREATE TRIGGER set_updated_at_pql BEFORE UPDATE ON public.prospecting_queue_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) AUTO-REGISTRO: Conversas → prospecting_interactions
-- Ao enviar 1ª mensagem outbound do dia para um lead → registra "contacted"
-- Ao receber resposta → atualiza outcome para "responded"
CREATE OR REPLACE FUNCTION public.tg_auto_log_prospecting_from_conversa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_existing UUID;
  v_channel TEXT;
BEGIN
  IF NEW.lead_id IS NULL OR NEW.company_id IS NULL THEN RETURN NEW; END IF;

  -- Determinar canal
  v_channel := CASE
    WHEN NEW.origem ILIKE '%instagram%' OR NEW.origem_api ILIKE '%instagram%' THEN 'instagram'
    ELSE 'whatsapp'
  END;

  -- Mensagem ENVIADA pelo operador
  IF NEW.fromme = true THEN
    v_user_id := COALESCE(NEW.sent_by::uuid, NEW.assigned_user_id, NEW.owner_id);
    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    -- Já existe interação hoje para este lead/canal?
    SELECT id INTO v_existing FROM public.prospecting_interactions
    WHERE lead_id = NEW.lead_id AND company_id = NEW.company_id
      AND channel = v_channel
      AND interaction_date = CURRENT_DATE
    LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.prospecting_interactions(
        company_id, lead_id, lead_name, lead_phone, user_id,
        log_type, channel, outcome, interaction_date,
        interaction_summary
      ) VALUES (
        NEW.company_id, NEW.lead_id, NEW.nome_contato, NEW.telefone_formatado, v_user_id,
        'prospecting', v_channel, 'contacted', CURRENT_DATE,
        'Auto: 1ª mensagem enviada via ' || v_channel
      );

      UPDATE public.leads SET last_prospected_at = now() WHERE id = NEW.lead_id;
    END IF;

  -- Mensagem RECEBIDA (resposta do lead)
  ELSIF NEW.fromme = false THEN
    UPDATE public.prospecting_interactions
    SET outcome = 'responded',
        interaction_summary = COALESCE(interaction_summary, '') || ' | Lead respondeu'
    WHERE lead_id = NEW.lead_id
      AND company_id = NEW.company_id
      AND channel = v_channel
      AND outcome = 'contacted'
      AND interaction_date >= CURRENT_DATE - INTERVAL '7 days';
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- nunca bloqueia conversa
END;
$$;

DROP TRIGGER IF EXISTS auto_log_prospecting_from_conversa ON public.conversas;
CREATE TRIGGER auto_log_prospecting_from_conversa
  AFTER INSERT ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_log_prospecting_from_conversa();

-- 6) AUTO-REGISTRO: Call History → prospecting_interactions
CREATE OR REPLACE FUNCTION public.tg_auto_log_prospecting_from_call()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outcome TEXT;
BEGIN
  -- Só processa quando call FINALIZADA
  IF NEW.status NOT IN ('finalizada', 'completed', 'sem_resposta', 'ocupado', 'falhou') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Mapear outcome
  v_outcome := CASE
    WHEN NEW.call_result = 'sale_closed' THEN 'sale_closed'
    WHEN NEW.call_result = 'meeting_scheduled' THEN 'meeting_scheduled'
    WHEN NEW.call_result = 'opportunity' THEN 'opportunity'
    WHEN NEW.call_result = 'no_answer' OR NEW.status = 'sem_resposta' THEN 'no_response'
    WHEN NEW.call_result = 'rejected' THEN 'rejected'
    WHEN NEW.duration_seconds > 30 THEN 'responded'
    ELSE 'contacted'
  END;

  INSERT INTO public.prospecting_interactions(
    company_id, lead_id, lead_name, lead_phone, user_id,
    log_type, channel, outcome, interaction_date,
    interaction_summary
  ) VALUES (
    NEW.company_id, NEW.lead_id, NEW.lead_name, NEW.phone_number, NEW.user_id,
    'prospecting', 'cold_call', v_outcome, NEW.call_start::date,
    'Auto: Cold Call (' || COALESCE(NEW.duration_seconds, 0) || 's)'
  );

  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads SET last_prospected_at = now() WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_log_prospecting_from_call ON public.call_history;
CREATE TRIGGER auto_log_prospecting_from_call
  AFTER INSERT OR UPDATE OF status ON public.call_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_log_prospecting_from_call();
