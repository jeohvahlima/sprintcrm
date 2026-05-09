-- =========================
-- REVENUE ENGINE METRICS
-- =========================

-- Métrica agregada por campanha
CREATE OR REPLACE FUNCTION public.get_revenue_engine_metrics(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  campaign_key text,
  campaign_id text,
  campaign_name text,
  ad_id text,
  ad_creative_name text,
  utm_source text,
  utm_medium text,
  source_type text,
  total_leads bigint,
  novos bigint,
  em_contato bigint,
  qualificados bigint,
  agendados bigint,
  ganhos bigint,
  perdidos bigint,
  receita_total numeric,
  ticket_medio numeric,
  taxa_conversao numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end date := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  IF NOT (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.company_id = p_company_id
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(l.campaign_id, ''),
        NULLIF(l.utm_campaign, ''),
        NULLIF(l.utm_source, ''),
        NULLIF(l.lead_source_type, ''),
        NULLIF(l.source, ''),
        'sem_origem'
      ) AS campaign_key,
      l.campaign_id,
      l.utm_campaign,
      l.ad_id,
      l.ad_creative_name,
      l.utm_source,
      l.utm_medium,
      l.lead_source_type,
      l.source,
      l.status,
      COALESCE(l.value, 0) AS valor,
      l.etapa_id,
      e.nome AS etapa_nome
    FROM public.leads l
    LEFT JOIN public.etapas e ON e.id = l.etapa_id
    WHERE l.company_id = p_company_id
      AND l.created_at::date BETWEEN v_start AND v_end
  )
  SELECT
    b.campaign_key,
    MAX(b.campaign_id),
    COALESCE(MAX(NULLIF(b.utm_campaign, '')), MAX(NULLIF(b.ad_creative_name, '')), b.campaign_key),
    MAX(b.ad_id),
    MAX(b.ad_creative_name),
    MAX(b.utm_source),
    MAX(b.utm_medium),
    COALESCE(MAX(b.lead_source_type), MAX(b.source)),
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE b.etapa_nome ILIKE '%novo%' OR b.status = 'novo')::bigint,
    COUNT(*) FILTER (WHERE b.etapa_nome ILIKE '%contato%' OR b.etapa_nome ILIKE '%abord%')::bigint,
    COUNT(*) FILTER (WHERE b.etapa_nome ILIKE '%qualific%')::bigint,
    COUNT(*) FILTER (WHERE b.etapa_nome ILIKE '%agend%' OR b.etapa_nome ILIKE '%reuni%' OR b.etapa_nome ILIKE '%proposta%')::bigint,
    COUNT(*) FILTER (WHERE b.status = 'ganho')::bigint,
    COUNT(*) FILTER (WHERE b.status = 'perdido')::bigint,
    COALESCE(SUM(b.valor) FILTER (WHERE b.status = 'ganho'), 0)::numeric,
    CASE WHEN COUNT(*) FILTER (WHERE b.status = 'ganho') > 0
      THEN (SUM(b.valor) FILTER (WHERE b.status = 'ganho') / COUNT(*) FILTER (WHERE b.status = 'ganho'))::numeric
      ELSE 0 END,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE b.status = 'ganho')::numeric / COUNT(*)::numeric) * 100, 2)
      ELSE 0 END
  FROM base b
  GROUP BY b.campaign_key
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_engine_metrics(uuid, date, date) TO authenticated;

-- Resumo geral (KPIs)
CREATE OR REPLACE FUNCTION public.get_revenue_engine_summary(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end date := COALESCE(p_end_date, CURRENT_DATE);
  v_total bigint := 0;
  v_pago bigint := 0;
  v_organico bigint := 0;
  v_ganhos bigint := 0;
  v_perdidos bigint := 0;
  v_receita numeric := 0;
  v_ticket numeric := 0;
  v_top_origem text;
  v_response_time_avg numeric;
BEGIN
  IF NOT (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.company_id = p_company_id
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE COALESCE(NULLIF(campaign_id,''), NULLIF(utm_campaign,''), NULLIF(ad_id,'')) IS NOT NULL OR lead_source_type = 'ctwa'),
    COUNT(*) FILTER (WHERE COALESCE(NULLIF(campaign_id,''), NULLIF(utm_campaign,''), NULLIF(ad_id,'')) IS NULL AND COALESCE(lead_source_type, '') <> 'ctwa'),
    COUNT(*) FILTER (WHERE status = 'ganho'),
    COUNT(*) FILTER (WHERE status = 'perdido'),
    COALESCE(SUM(value) FILTER (WHERE status = 'ganho'), 0),
    COALESCE(AVG(value) FILTER (WHERE status = 'ganho'), 0)
  INTO v_total, v_pago, v_organico, v_ganhos, v_perdidos, v_receita, v_ticket
  FROM public.leads
  WHERE company_id = p_company_id
    AND created_at::date BETWEEN v_start AND v_end;

  SELECT COALESCE(NULLIF(utm_campaign,''), NULLIF(utm_source,''), NULLIF(lead_source_type,''), NULLIF(source,''), 'sem_origem')
  INTO v_top_origem
  FROM public.leads
  WHERE company_id = p_company_id
    AND created_at::date BETWEEN v_start AND v_end
  GROUP BY 1
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'period_start', v_start,
    'period_end', v_end,
    'total_leads', v_total,
    'leads_pagos', v_pago,
    'leads_organicos', v_organico,
    'ganhos', v_ganhos,
    'perdidos', v_perdidos,
    'receita_total', v_receita,
    'ticket_medio', v_ticket,
    'taxa_conversao', CASE WHEN v_total > 0 THEN ROUND((v_ganhos::numeric / v_total::numeric) * 100, 2) ELSE 0 END,
    'top_origem', v_top_origem
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_engine_summary(uuid, date, date) TO authenticated;

-- Detecção de gargalos: para cada etapa, conta leads parados há > 3 dias
CREATE OR REPLACE FUNCTION public.get_revenue_engine_bottlenecks(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  etapa_id uuid,
  etapa_nome text,
  total_leads bigint,
  leads_parados bigint,
  dias_medio_parado numeric,
  receita_potencial numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end date := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  IF NOT (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.company_id = p_company_id
  )) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    COUNT(l.id)::bigint,
    COUNT(l.id) FILTER (WHERE l.updated_at < now() - INTERVAL '3 days' AND l.status NOT IN ('ganho','perdido'))::bigint,
    COALESCE(AVG(EXTRACT(DAY FROM now() - l.updated_at)) FILTER (WHERE l.status NOT IN ('ganho','perdido')), 0)::numeric,
    COALESCE(SUM(l.value) FILTER (WHERE l.status NOT IN ('ganho','perdido')), 0)::numeric
  FROM public.etapas e
  LEFT JOIN public.leads l ON l.etapa_id = e.id
    AND l.company_id = p_company_id
    AND l.created_at::date BETWEEN v_start AND v_end
  WHERE e.company_id = p_company_id
  GROUP BY e.id, e.nome, e.posicao
  HAVING COUNT(l.id) > 0
  ORDER BY e.posicao NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_engine_bottlenecks(uuid, date, date) TO authenticated;

-- Índice para acelerar consultas por campanha
CREATE INDEX IF NOT EXISTS idx_leads_company_created_campaign
  ON public.leads(company_id, created_at, campaign_id, utm_campaign);