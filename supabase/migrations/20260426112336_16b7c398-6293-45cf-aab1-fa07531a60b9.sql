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

  SELECT count(*) INTO v_funis FROM funis WHERE company_id = v_company_id;
  SELECT count(*) INTO v_etapas FROM etapas e JOIN funis f ON f.id = e.funil_id WHERE f.company_id = v_company_id;
  SELECT count(*) INTO v_playbooks FROM advisory_playbooks WHERE company_id = v_company_id;
  SELECT count(*) INTO v_pages FROM ai_process_suggestions WHERE company_id = v_company_id AND status = 'approved';
  v_processos := LEAST(20,
    LEAST(5, v_funis * 2) +
    LEAST(5, v_etapas) +
    LEAST(5, v_playbooks * 2) +
    LEAST(5, v_pages));

  SELECT count(*) INTO v_queues FROM prospecting_queues WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_interactions_30d FROM prospecting_interactions
    WHERE company_id = v_company_id AND interaction_date >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_meetings_30d FROM prospecting_interactions
    WHERE company_id = v_company_id AND outcome = 'meeting_scheduled' AND interaction_date >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_cadencias FROM ia_cadence_rules WHERE company_id = v_company_id;
  v_prospeccao := LEAST(20,
    LEAST(5, v_queues * 2) +
    LEAST(7, v_interactions_30d / 20) +
    LEAST(4, v_meetings_30d) +
    LEAST(4, v_cadencias * 2));

  SELECT count(*) INTO v_metas FROM commercial_goals WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_won_30d FROM leads WHERE company_id = v_company_id AND status = 'ganho' AND won_at >= CURRENT_DATE - 30;
  SELECT count(*) INTO v_lost_30d FROM leads WHERE company_id = v_company_id AND status = 'perdido' AND lost_at >= CURRENT_DATE - 30;
  SELECT COALESCE(AVG(value),0) INTO v_avg_value FROM leads WHERE company_id = v_company_id AND status = 'ganho';
  v_gestao := LEAST(20,
    LEAST(6, v_metas * 2) +
    LEAST(6, v_won_30d) +
    LEAST(4, CASE WHEN v_won_30d + v_lost_30d > 0 THEN (v_won_30d * 100 / (v_won_30d + v_lost_30d)) / 25 ELSE 0 END) +
    LEAST(4, CASE WHEN v_avg_value > 0 THEN 4 ELSE 0 END));

  -- Pilar 4: ia_scripts usa is_active (não active)
  SELECT count(*) INTO v_flows FROM automation_flows WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_ai_agents FROM ia_scripts WHERE company_id = v_company_id AND is_active = true;
  SELECT count(*) INTO v_scripts FROM commercial_scripts WHERE company_id = v_company_id;
  SELECT count(*) INTO v_whatsapp_conn FROM whatsapp_connections WHERE company_id = v_company_id AND status = 'connected';
  SELECT count(*) INTO v_calls_30d FROM call_history WHERE company_id = v_company_id AND call_start >= CURRENT_DATE - 30;
  v_automacao := LEAST(20,
    LEAST(5, v_flows) +
    LEAST(5, v_ai_agents * 2) +
    LEAST(3, v_scripts) +
    LEAST(3, v_whatsapp_conn * 3) +
    LEAST(4, v_calls_30d / 25));

  SELECT count(*) INTO v_users FROM user_roles WHERE company_id = v_company_id;
  SELECT count(*) INTO v_modules_done FROM advisory_track_progress WHERE company_id = v_company_id AND status = 'done';
  SELECT count(*) INTO v_quests_active FROM prospecting_quests WHERE company_id = v_company_id AND active = true;
  SELECT count(*) INTO v_team_count FROM sales_teams WHERE company_id = v_company_id;
  v_pessoas := LEAST(20,
    LEAST(5, v_users) +
    LEAST(6, v_modules_done) +
    LEAST(5, v_quests_active * 2) +
    LEAST(4, v_team_count * 2));

  v_total := v_processos + v_prospeccao + v_gestao + v_automacao + v_pessoas;
  v_class := CASE
    WHEN v_total >= 80 THEN 'Escalável'
    WHEN v_total >= 60 THEN 'Previsível'
    WHEN v_total >= 35 THEN 'Estruturando'
    ELSE 'Inicial'
  END;

  RETURN jsonb_build_object(
    'company_id', v_company_id,
    'total_score', v_total,
    'classification', v_class,
    'pillars', jsonb_build_object(
      'processos', jsonb_build_object('score', v_processos, 'max', 20, 'metrics', jsonb_build_object('funis', v_funis, 'etapas', v_etapas, 'playbooks', v_playbooks, 'sugestoes_aprovadas', v_pages)),
      'prospeccao', jsonb_build_object('score', v_prospeccao, 'max', 20, 'metrics', jsonb_build_object('filas_ativas', v_queues, 'interacoes_30d', v_interactions_30d, 'reunioes_30d', v_meetings_30d, 'cadencias', v_cadencias)),
      'gestao', jsonb_build_object('score', v_gestao, 'max', 20, 'metrics', jsonb_build_object('metas_ativas', v_metas, 'ganhos_30d', v_won_30d, 'perdidos_30d', v_lost_30d, 'ticket_medio', v_avg_value)),
      'automacao', jsonb_build_object('score', v_automacao, 'max', 20, 'metrics', jsonb_build_object('fluxos_ativos', v_flows, 'agentes_ia', v_ai_agents, 'scripts', v_scripts, 'whatsapp_conexoes', v_whatsapp_conn, 'ligacoes_30d', v_calls_30d)),
      'pessoas', jsonb_build_object('score', v_pessoas, 'max', 20, 'metrics', jsonb_build_object('usuarios', v_users, 'trilhas_concluidas', v_modules_done, 'quests_ativas', v_quests_active, 'times', v_team_count))
    ),
    'calculated_at', now()
  );
END;
$function$;