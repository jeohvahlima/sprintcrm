-- 1. Colunas em leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS social_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_type TEXT,
  ADD COLUMN IF NOT EXISTS intent_level TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_social_score ON public.leads (company_id, social_score DESC) WHERE lead_source_type = 'instagram';
CREATE INDEX IF NOT EXISTS idx_leads_intent ON public.leads (company_id, intent_level) WHERE lead_source_type = 'instagram';

-- 2. Tabela de ações de social selling (cadência por lead)
CREATE TABLE IF NOT EXISTS public.social_selling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadence_day INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'interact_profile', 'dm_light', 'dm_value', 'follow_up', 'whatsapp', 'meeting_invite'
  action_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending','done','skipped'
  scheduled_for TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  done_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssa_company ON public.social_selling_actions(company_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_ssa_lead ON public.social_selling_actions(lead_id, cadence_day);

ALTER TABLE public.social_selling_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssa_select" ON public.social_selling_actions
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "ssa_insert" ON public.social_selling_actions
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "ssa_update" ON public.social_selling_actions
  FOR UPDATE USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "ssa_delete" ON public.social_selling_actions
  FOR DELETE USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

CREATE TRIGGER trg_ssa_updated_at BEFORE UPDATE ON public.social_selling_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Keywords de intenção
CREATE TABLE IF NOT EXISTS public.social_selling_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID, -- null = global
  keyword TEXT NOT NULL,
  intent_level TEXT NOT NULL DEFAULT 'alta', -- 'alta','media','baixa'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssk_company ON public.social_selling_keywords(company_id, active);

ALTER TABLE public.social_selling_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssk_select" ON public.social_selling_keywords
  FOR SELECT USING (company_id IS NULL OR company_id IN (SELECT company_id FROM public.get_user_company_ids()));
CREATE POLICY "ssk_modify_company" ON public.social_selling_keywords
  FOR ALL USING (company_id IS NOT NULL AND company_id IN (SELECT company_id FROM public.get_user_company_ids()))
  WITH CHECK (company_id IS NOT NULL AND company_id IN (SELECT company_id FROM public.get_user_company_ids()));

-- Seeds globais de palavras-chave de alta intenção
INSERT INTO public.social_selling_keywords (company_id, keyword, intent_level) VALUES
  (NULL,'preço','alta'),(NULL,'preco','alta'),(NULL,'valor','alta'),(NULL,'orçamento','alta'),(NULL,'orcamento','alta'),
  (NULL,'quanto custa','alta'),(NULL,'contratar','alta'),(NULL,'agendar','alta'),(NULL,'consulta','alta'),
  (NULL,'reunião','alta'),(NULL,'reuniao','alta'),(NULL,'comprar','alta'),(NULL,'pagamento','alta'),(NULL,'plano','alta'),
  (NULL,'serviço','media'),(NULL,'servico','media'),(NULL,'como funciona','media'),(NULL,'gostei','media'),
  (NULL,'interessante','media'),(NULL,'oi','baixa'),(NULL,'olá','baixa')
ON CONFLICT DO NOTHING;

-- 4. Função para criar funil padrão Social Selling
CREATE OR REPLACE FUNCTION public.create_social_selling_funnel(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funil_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  -- Idempotente: se já existe, retorna o id
  SELECT id INTO v_funil_id FROM public.funis
   WHERE company_id = p_company_id AND nome = 'Social Selling' LIMIT 1;
  IF v_funil_id IS NOT NULL THEN RETURN v_funil_id; END IF;

  INSERT INTO public.funis (company_id, nome, descricao, owner_id)
  VALUES (p_company_id, 'Social Selling', 'Funil padrão de Social Selling — Instagram + WhatsApp', v_user_id)
  RETURNING id INTO v_funil_id;

  INSERT INTO public.etapas (funil_id, company_id, nome, posicao, cor) VALUES
    (v_funil_id, p_company_id, 'Novo Seguidor',     1, '#94A3B8'),
    (v_funil_id, p_company_id, 'Engajado',          2, '#22C55E'),
    (v_funil_id, p_company_id, 'Conversa Iniciada', 3, '#0EA5E9'),
    (v_funil_id, p_company_id, 'Lead Qualificado',  4, '#A855F7'),
    (v_funil_id, p_company_id, 'Reunião Agendada',  5, '#F59E0B'),
    (v_funil_id, p_company_id, 'Proposta Enviada',  6, '#EAB308'),
    (v_funil_id, p_company_id, 'Fechamento',        7, '#16A34A');

  RETURN v_funil_id;
END; $$;

-- 5. Função: detectar intenção numa mensagem
CREATE OR REPLACE FUNCTION public.detect_social_intent(p_company_id UUID, p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lower TEXT := lower(coalesce(p_text,''));
  v_kw RECORD;
BEGIN
  IF v_lower = '' THEN RETURN NULL; END IF;
  FOR v_kw IN
    SELECT keyword, intent_level FROM public.social_selling_keywords
     WHERE active = true AND (company_id IS NULL OR company_id = p_company_id)
     ORDER BY CASE intent_level WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END
  LOOP
    IF position(lower(v_kw.keyword) IN v_lower) > 0 THEN
      RETURN v_kw.intent_level;
    END IF;
  END LOOP;
  RETURN NULL;
END; $$;

-- 6. Função: calcular social_score
CREATE OR REPLACE FUNCTION public.compute_social_score(p_lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_score INT := 0;
  v_msgs INT := 0;
  v_intent TEXT;
  v_recent BOOLEAN;
  v_lead RECORD;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF v_lead IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_msgs FROM public.conversas
   WHERE lead_id = p_lead_id AND origem = 'Instagram';

  v_score := LEAST(40, v_msgs * 4); -- até 40 por volume de interação
  IF v_lead.intent_level = 'alta' THEN v_score := v_score + 40;
  ELSIF v_lead.intent_level = 'media' THEN v_score := v_score + 20;
  ELSIF v_lead.intent_level = 'baixa' THEN v_score := v_score + 5;
  END IF;

  IF v_lead.last_engagement_at IS NOT NULL AND v_lead.last_engagement_at > now() - INTERVAL '24 hours' THEN
    v_score := v_score + 20;
  ELSIF v_lead.last_engagement_at IS NOT NULL AND v_lead.last_engagement_at > now() - INTERVAL '7 days' THEN
    v_score := v_score + 10;
  END IF;

  RETURN LEAST(100, v_score);
END; $$;

-- 7. Trigger principal: ao chegar conversa do Instagram, processa social selling
CREATE OR REPLACE FUNCTION public.tg_social_selling_on_conversa()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_funil_id UUID;
  v_etapa_id UUID;
  v_etapa_atual TEXT;
  v_target_etapa TEXT;
  v_intent TEXT;
  v_score INT;
BEGIN
  IF NEW.origem <> 'Instagram' OR NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  IF v_lead IS NULL THEN RETURN NEW; END IF;

  -- Garantir funil
  SELECT id INTO v_funil_id FROM public.funis
   WHERE company_id = NEW.company_id AND nome = 'Social Selling' LIMIT 1;
  IF v_funil_id IS NULL THEN RETURN NEW; END IF;

  -- Detectar intenção apenas em mensagem RECEBIDA (fromme=false)
  IF NEW.fromme = false AND NEW.mensagem IS NOT NULL THEN
    v_intent := public.detect_social_intent(NEW.company_id, NEW.mensagem);
  END IF;

  -- Etapa atual do lead
  SELECT e.nome INTO v_etapa_atual FROM public.etapas e WHERE e.id = v_lead.etapa_id;

  -- Decidir etapa-alvo: se intenção alta -> Lead Qualificado; senão Conversa Iniciada
  IF v_intent = 'alta' THEN
    v_target_etapa := 'Lead Qualificado';
  ELSE
    v_target_etapa := 'Conversa Iniciada';
  END IF;

  -- Não regredir o lead
  IF v_etapa_atual IN ('Reunião Agendada','Proposta Enviada','Fechamento','Lead Qualificado')
     AND v_target_etapa <> 'Lead Qualificado' THEN
    v_target_etapa := v_etapa_atual;
  END IF;

  SELECT id INTO v_etapa_id FROM public.etapas
   WHERE funil_id = v_funil_id AND nome = v_target_etapa LIMIT 1;

  -- Atualizar lead
  UPDATE public.leads SET
    funil_id = COALESCE(funil_id, v_funil_id),
    etapa_id = COALESCE(v_etapa_id, etapa_id),
    intent_level = COALESCE(v_intent, intent_level),
    engagement_type = 'dm',
    last_engagement_at = now(),
    next_action = CASE
      WHEN v_intent = 'alta' THEN 'Agendar reunião'
      WHEN v_intent = 'media' THEN 'Qualificar lead'
      ELSE 'Enviar follow-up'
    END,
    next_action_at = now() + INTERVAL '4 hours',
    tags = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          COALESCE(tags, ARRAY[]::TEXT[]) ||
          ARRAY['DM Recebida'] ||
          CASE WHEN v_intent = 'alta' THEN ARRAY['Alta Intenção']
               WHEN v_intent = 'media' THEN ARRAY['Média Intenção']
               WHEN v_intent = 'baixa' THEN ARRAY['Baixa Intenção']
               ELSE ARRAY[]::TEXT[] END
        )
      )
    ),
    updated_at = now()
  WHERE id = NEW.lead_id;

  -- Recalcular score
  v_score := public.compute_social_score(NEW.lead_id);
  UPDATE public.leads SET social_score = v_score, priority_score = v_score WHERE id = NEW.lead_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_social_selling_on_conversa ON public.conversas;
CREATE TRIGGER trg_social_selling_on_conversa
AFTER INSERT ON public.conversas
FOR EACH ROW EXECUTE FUNCTION public.tg_social_selling_on_conversa();

-- 8. Função para gerar cadência 5D para um lead
CREATE OR REPLACE FUNCTION public.create_social_selling_cadence(p_lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_count INT := 0;
BEGIN
  SELECT company_id INTO v_company_id FROM public.leads WHERE id = p_lead_id;
  IF v_company_id IS NULL THEN RETURN 0; END IF;

  -- Não duplicar
  IF EXISTS(SELECT 1 FROM public.social_selling_actions WHERE lead_id = p_lead_id) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.social_selling_actions(company_id, lead_id, cadence_day, action_type, action_label, scheduled_for)
  VALUES
    (v_company_id, p_lead_id, 1, 'interact_profile', 'Interagir com perfil (curtir 2-3 posts)', now()),
    (v_company_id, p_lead_id, 1, 'dm_light',         'Enviar DM leve de apresentação',         now() + INTERVAL '2 hours'),
    (v_company_id, p_lead_id, 2, 'interact_profile', 'Nova interação no perfil',                now() + INTERVAL '1 day'),
    (v_company_id, p_lead_id, 2, 'dm_value',         'DM com valor (insight ou conteúdo útil)', now() + INTERVAL '1 day 3 hours'),
    (v_company_id, p_lead_id, 3, 'follow_up',        'Follow-up no Instagram',                  now() + INTERVAL '2 days'),
    (v_company_id, p_lead_id, 3, 'whatsapp',         'Tentativa via WhatsApp (se disponível)',  now() + INTERVAL '2 days 2 hours'),
    (v_company_id, p_lead_id, 5, 'meeting_invite',   'Convite para reunião / call',             now() + INTERVAL '4 days');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;