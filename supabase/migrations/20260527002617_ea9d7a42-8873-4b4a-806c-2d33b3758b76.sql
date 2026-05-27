
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_movement_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS follow_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_last_interaction ON public.leads(last_interaction_at);
CREATE INDEX IF NOT EXISTS idx_leads_etapa_company ON public.leads(etapa_id, company_id);

CREATE TABLE IF NOT EXISTS public.follow_etapa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.etapas(id) ON DELETE CASCADE,
  funil_id uuid NOT NULL REFERENCES public.funis(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  tempo_valor integer NOT NULL DEFAULT 1,
  tempo_unidade text NOT NULL DEFAULT 'dias' CHECK (tempo_unidade IN ('minutos','horas','dias')),
  canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp','tarefa','notificacao','nenhum')),
  template_id uuid,
  mensagem_custom text,
  criar_tarefa boolean NOT NULL DEFAULT false,
  tarefa_titulo text,
  notificar_responsavel boolean NOT NULL DEFAULT false,
  avancar_proxima_etapa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(etapa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_etapa_config TO authenticated;
GRANT ALL ON public.follow_etapa_config TO service_role;
ALTER TABLE public.follow_etapa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_cfg_company_select" ON public.follow_etapa_config FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "follow_cfg_company_insert" ON public.follow_etapa_config FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "follow_cfg_company_update" ON public.follow_etapa_config FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "follow_cfg_company_delete" ON public.follow_etapa_config FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.follow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_templates TO authenticated;
GRANT ALL ON public.follow_templates TO service_role;
ALTER TABLE public.follow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_tpl_company_all" ON public.follow_templates FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.follow_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.etapas(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  config_id uuid REFERENCES public.follow_etapa_config(id) ON DELETE SET NULL,
  acao text NOT NULL,
  status text NOT NULL DEFAULT 'sucesso',
  detalhes jsonb,
  executado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_follow_exec_lead_etapa ON public.follow_execucoes(lead_id, etapa_id);
CREATE INDEX IF NOT EXISTS idx_follow_exec_company ON public.follow_execucoes(company_id, executado_em DESC);

GRANT SELECT, INSERT ON public.follow_execucoes TO authenticated;
GRANT ALL ON public.follow_execucoes TO service_role;
ALTER TABLE public.follow_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_exec_company_select" ON public.follow_execucoes FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Trigger atualiza última interação ao chegar mensagem (conversas)
CREATE OR REPLACE FUNCTION public.fn_update_lead_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_inbound boolean;
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  v_is_inbound := COALESCE(NEW.fromme, false) = false;

  UPDATE public.leads
  SET last_interaction_at = COALESCE(NEW.created_at, now()),
      lead_score = lead_score + CASE WHEN v_is_inbound THEN 10 ELSE 0 END,
      lead_temperature = CASE WHEN v_is_inbound THEN 'quente' ELSE lead_temperature END
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_last_interaction ON public.conversas;
CREATE TRIGGER trg_lead_last_interaction
AFTER INSERT ON public.conversas
FOR EACH ROW EXECUTE FUNCTION public.fn_update_lead_last_interaction();

-- Trigger atualiza last_movement_at e reseta follow_count ao mover etapa
CREATE OR REPLACE FUNCTION public.fn_update_lead_last_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    NEW.last_movement_at := now();
    NEW.follow_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_last_movement ON public.leads;
CREATE TRIGGER trg_lead_last_movement
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_update_lead_last_movement();

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_follow_cfg_updated ON public.follow_etapa_config;
CREATE TRIGGER trg_follow_cfg_updated BEFORE UPDATE ON public.follow_etapa_config
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_follow_tpl_updated ON public.follow_templates;
CREATE TRIGGER trg_follow_tpl_updated BEFORE UPDATE ON public.follow_templates
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
