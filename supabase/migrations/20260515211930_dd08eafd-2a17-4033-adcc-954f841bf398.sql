
-- 1) New table for guided diagnosis responses
CREATE TABLE IF NOT EXISTS public.wmi_guided_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  pilar TEXT NOT NULL CHECK (pilar IN ('aquisicao','social','dependencia','crescimento')),
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, pilar)
);

ALTER TABLE public.wmi_guided_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wmi_guided_select" ON public.wmi_guided_responses
  FOR SELECT USING (company_id = public.get_my_company_id());
CREATE POLICY "wmi_guided_insert" ON public.wmi_guided_responses
  FOR INSERT WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "wmi_guided_update" ON public.wmi_guided_responses
  FOR UPDATE USING (company_id = public.get_my_company_id());
CREATE POLICY "wmi_guided_delete" ON public.wmi_guided_responses
  FOR DELETE USING (company_id = public.get_my_company_id());

CREATE TRIGGER trg_wmi_guided_updated_at
  BEFORE UPDATE ON public.wmi_guided_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) New columns on wmi_assessments
ALTER TABLE public.wmi_assessments
  ADD COLUMN IF NOT EXISTS pillar_aquisicao    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_social       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_dependencia  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_crescimento  INT NOT NULL DEFAULT 0;

-- 3) Updated calculate_wmi_score with 9 pillars (5 from CRM data + 4 from guided)
CREATE OR REPLACE FUNCTION public.calculate_wmi_score(p_company_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id UUID := COALESCE(p_company_id, public.get_my_company_id());
  v_processos INT := 0;
  v_prospeccao INT := 0;
  v_gestao INT := 0;
  v_automacao INT := 0;
  v_pessoas INT := 0;
  v_aquisicao INT := 0;
  v_social INT := 0;
  v_dependencia INT := 0;
  v_crescimento INT := 0;
  v_aquisicao_metrics JSONB := '{}'::jsonb;
  v_social_metrics JSONB := '{}'::jsonb;
  v_dependencia_metrics JSONB := '{}'::jsonb;
  v_crescimento_metrics JSONB := '{}'::jsonb;
  v_total_raw INT;
  v_total INT;
  v_class TEXT;
  v_funis INT; v_etapas INT; v_playbooks INT; v_pages INT;
  v_cadencias INT; v_interactions_30d INT; v_meetings_30d INT; v_queues INT;
  v_metas INT; v_won_30d INT; v_lost_30d INT; v_avg_value NUMERIC;
  v_flows INT; v_ai_agents INT; v_scripts INT; v_whatsapp_conn INT; v_calls_30d INT;
  v_users INT; v_modules_done INT; v_quests_active INT; v_team_count INT;
BEGIN
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error','no_company');
  END IF;

  -- Pilar 1: Processos
  SELECT count(*) INTO v_funis FROM funis WHERE company_id = v_company_id;
  SELECT count(*) INTO v_etapas FROM etapas e JOIN funis f ON f.id = e.funil_id WHERE f.company_id = v_company_id;
  SELECT count(*) INTO v_playbooks FROM advisory_playbooks WHERE company_id = v_company_id;
  SELECT count(*) INTO v_pages FROM ai_process_suggestions WHERE company_id = v_company_id AND status = 'approved';
  v_processos := LEAST(20,
    LEAST(5, v_funis * 2) + LEAST(5, v_etapas) + LEAST(5, v_playbooks * 2) + LEAST(5, v_pages));

  -- Pilar 2: Prospecção
  SELECT count(*) INTO v_queues FROM prospecting_queues WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_interactions_30d FROM prospecting_interactions
    WHERE company_id = v_company_id AND interaction_date >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_meetings_30d FROM prospecting_interactions
    WHERE company_id = v_company_id AND outcome = 'meeting_scheduled' AND interaction_date >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_cadencias FROM ia_cadence_rules WHERE company_id = v_company_id;
  v_prospeccao := LEAST(20,
    LEAST(5, v_queues * 2) + LEAST(7, v_interactions_30d / 20) + LEAST(4, v_meetings_30d) + LEAST(4, v_cadencias * 2));

  -- Pilar 3: Gestão
  SELECT count(*) INTO v_metas FROM commercial_goals WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_won_30d FROM leads WHERE company_id = v_company_id AND status = 'ganho' AND won_at >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_lost_30d FROM leads WHERE company_id = v_company_id AND status = 'perdido' AND lost_at >= CURRENT_DATE - 30;
  SELECT COALESCE(AVG(value),0) INTO v_avg_value FROM leads WHERE company_id = v_company_id AND status = 'ganho';
  v_gestao := LEAST(20,
    LEAST(6, v_metas * 2) + LEAST(6, v_won_30d) +
    LEAST(4, CASE WHEN v_won_30d + v_lost_30d > 0 THEN (v_won_30d * 100 / (v_won_30d + v_lost_30d)) / 25 ELSE 0 END) +
    LEAST(4, CASE WHEN v_avg_value > 0 THEN 4 ELSE 0 END));

  -- Pilar 4: Automação
  SELECT count(*) INTO v_flows FROM automation_flows WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_ai_agents FROM ia_scripts WHERE company_id = v_company_id AND is_active = true;
  SELECT count(*) INTO v_scripts FROM commercial_scripts WHERE company_id = v_company_id;
  SELECT count(*) INTO v_whatsapp_conn FROM whatsapp_connections WHERE company_id = v_company_id AND status = 'connected';
  SELECT count(*) INTO v_calls_30d FROM call_history WHERE company_id = v_company_id AND call_start >= CURRENT_DATE - 30;
  v_automacao := LEAST(20,
    LEAST(5, v_flows) + LEAST(5, v_ai_agents * 2) + LEAST(3, v_scripts) +
    LEAST(3, v_whatsapp_conn * 3) + LEAST(4, v_calls_30d / 25));

  -- Pilar 5: Pessoas
  SELECT count(*) INTO v_users FROM user_roles WHERE company_id = v_company_id;
  SELECT count(*) INTO v_modules_done FROM advisory_track_progress WHERE company_id = v_company_id AND status = 'done';
  SELECT count(*) INTO v_quests_active FROM prospecting_quests WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_team_count FROM sales_teams WHERE company_id = v_company_id;
  v_pessoas := LEAST(20,
    LEAST(5, v_users) + LEAST(6, v_modules_done) + LEAST(5, v_quests_active * 2) + LEAST(4, v_team_count * 2));

  -- Pilares 6-9: Guided Diagnosis (only count if responded)
  SELECT COALESCE(score, 0), COALESCE(responses, '{}'::jsonb)
    INTO v_aquisicao, v_aquisicao_metrics
    FROM public.wmi_guided_responses
    WHERE company_id = v_company_id AND pilar = 'aquisicao';

  SELECT COALESCE(score, 0), COALESCE(responses, '{}'::jsonb)
    INTO v_social, v_social_metrics
    FROM public.wmi_guided_responses
    WHERE company_id = v_company_id AND pilar = 'social';

  SELECT COALESCE(score, 0), COALESCE(responses, '{}'::jsonb)
    INTO v_dependencia, v_dependencia_metrics
    FROM public.wmi_guided_responses
    WHERE company_id = v_company_id AND pilar = 'dependencia';

  SELECT COALESCE(score, 0), COALESCE(responses, '{}'::jsonb)
    INTO v_crescimento, v_crescimento_metrics
    FROM public.wmi_guided_responses
    WHERE company_id = v_company_id AND pilar = 'crescimento';

  v_aquisicao    := COALESCE(v_aquisicao, 0);
  v_social       := COALESCE(v_social, 0);
  v_dependencia  := COALESCE(v_dependencia, 0);
  v_crescimento  := COALESCE(v_crescimento, 0);

  -- Total: 9 pilares × 20 = 180. Normalize to 0-100.
  v_total_raw := v_processos + v_prospeccao + v_gestao + v_automacao + v_pessoas
               + v_aquisicao + v_social + v_dependencia + v_crescimento;
  v_total := ROUND(v_total_raw * 100.0 / 180.0)::INT;

  v_class := CASE
    WHEN v_total >= 80 THEN 'Escalável'
    WHEN v_total >= 60 THEN 'Previsível'
    WHEN v_total >= 35 THEN 'Estruturando'
    ELSE 'Inicial'
  END;

  RETURN jsonb_build_object(
    'company_id', v_company_id,
    'total_score', v_total,
    'total_score_raw', v_total_raw,
    'total_score_max', 180,
    'classification', v_class,
    'pillars', jsonb_build_object(
      'processos', jsonb_build_object('score', v_processos, 'max', 20, 'metrics', jsonb_build_object('funis', v_funis, 'etapas', v_etapas, 'playbooks', v_playbooks, 'sugestoes_aprovadas', v_pages)),
      'prospeccao', jsonb_build_object('score', v_prospeccao, 'max', 20, 'metrics', jsonb_build_object('filas_ativas', v_queues, 'interacoes_30d', v_interactions_30d, 'reunioes_30d', v_meetings_30d, 'cadencias', v_cadencias)),
      'gestao', jsonb_build_object('score', v_gestao, 'max', 20, 'metrics', jsonb_build_object('metas_ativas', v_metas, 'ganhos_30d', v_won_30d, 'perdidos_30d', v_lost_30d, 'ticket_medio', v_avg_value)),
      'automacao', jsonb_build_object('score', v_automacao, 'max', 20, 'metrics', jsonb_build_object('fluxos_ativos', v_flows, 'agentes_ia', v_ai_agents, 'scripts', v_scripts, 'whatsapp_conexoes', v_whatsapp_conn, 'ligacoes_30d', v_calls_30d)),
      'pessoas', jsonb_build_object('score', v_pessoas, 'max', 20, 'metrics', jsonb_build_object('usuarios', v_users, 'trilhas_concluidas', v_modules_done, 'quests_ativas', v_quests_active, 'times', v_team_count)),
      'aquisicao', jsonb_build_object('score', v_aquisicao, 'max', 20, 'metrics', v_aquisicao_metrics),
      'social', jsonb_build_object('score', v_social, 'max', 20, 'metrics', v_social_metrics),
      'dependencia', jsonb_build_object('score', v_dependencia, 'max', 20, 'metrics', v_dependencia_metrics),
      'crescimento', jsonb_build_object('score', v_crescimento, 'max', 20, 'metrics', v_crescimento_metrics)
    ),
    'calculated_at', now()
  );
END;
$function$;
