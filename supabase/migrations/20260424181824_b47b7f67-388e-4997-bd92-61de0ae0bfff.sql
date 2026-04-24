
-- ============================================================
-- FASE 1: Estruturação Comercial (Times, Metas, Handoffs)
-- ============================================================

-- 1) Estender o player profile com papel comercial e time
ALTER TABLE public.prospecting_player_profile
  ADD COLUMN IF NOT EXISTS commercial_role TEXT DEFAULT 'sdr' CHECK (commercial_role IN ('sdr','closer','hybrid','manager')),
  ADD COLUMN IF NOT EXISTS team_id UUID,
  ADD COLUMN IF NOT EXISTS commission_per_sale NUMERIC DEFAULT 0;

-- 2) Tabela de Times Comerciais
CREATE TABLE IF NOT EXISTS public.sales_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID,
  color TEXT DEFAULT '#7a3cff',
  active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_teams_company_select" ON public.sales_teams
  FOR SELECT USING (company_id = public.get_my_company_id());
CREATE POLICY "sales_teams_company_manage" ON public.sales_teams
  FOR ALL USING (
    company_id = public.get_my_company_id()
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE TRIGGER trg_sales_teams_updated_at
  BEFORE UPDATE ON public.sales_teams
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Metas Comerciais (KPIs)
CREATE TABLE IF NOT EXISTS public.commercial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  team_id UUID,
  user_id UUID,
  scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user','team','role','company')),
  role_target TEXT CHECK (role_target IN ('sdr','closer','hybrid','manager')),
  period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  metric TEXT NOT NULL CHECK (metric IN ('leads_prospected','calls','responses','opportunities','meetings_scheduled','sales_closed','gross_value')),
  target_value NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_goals_user ON public.commercial_goals(user_id, period, active);
CREATE INDEX IF NOT EXISTS idx_commercial_goals_team ON public.commercial_goals(team_id, period, active);
CREATE INDEX IF NOT EXISTS idx_commercial_goals_company ON public.commercial_goals(company_id, period, active);

ALTER TABLE public.commercial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_goals_company_select" ON public.commercial_goals
  FOR SELECT USING (company_id = public.get_my_company_id());
CREATE POLICY "commercial_goals_manager_manage" ON public.commercial_goals
  FOR ALL USING (
    company_id = public.get_my_company_id()
    AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE TRIGGER trg_commercial_goals_updated_at
  BEFORE UPDATE ON public.commercial_goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Handoffs SDR -> Closer
CREATE TABLE IF NOT EXISTS public.sdr_closer_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  sdr_id UUID NOT NULL,
  closer_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','meeting_scheduled','meeting_done','sale_closed','lost','expired')),
  scheduled_meeting_at TIMESTAMPTZ,
  expected_value NUMERIC DEFAULT 0,
  actual_value NUMERIC DEFAULT 0,
  sdr_notes TEXT,
  closer_notes TEXT,
  qualification_score INT,
  accepted_at TIMESTAMPTZ,
  meeting_done_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_closer ON public.sdr_closer_handoffs(closer_id, status);
CREATE INDEX IF NOT EXISTS idx_handoffs_sdr ON public.sdr_closer_handoffs(sdr_id, status);
CREATE INDEX IF NOT EXISTS idx_handoffs_company ON public.sdr_closer_handoffs(company_id, status);

ALTER TABLE public.sdr_closer_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoffs_company_select" ON public.sdr_closer_handoffs
  FOR SELECT USING (company_id = public.get_my_company_id());
CREATE POLICY "handoffs_company_insert" ON public.sdr_closer_handoffs
  FOR INSERT WITH CHECK (company_id = public.get_my_company_id() AND sdr_id = auth.uid());
CREATE POLICY "handoffs_participant_update" ON public.sdr_closer_handoffs
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND (sdr_id = auth.uid() OR closer_id = auth.uid()
         OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'company_admin') OR public.has_role(auth.uid(),'gestor'))
  );

CREATE TRIGGER trg_handoffs_updated_at
  BEFORE UPDATE ON public.sdr_closer_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Função: progresso de meta de um usuário em um período
CREATE OR REPLACE FUNCTION public.get_user_goal_progress(p_user_id UUID, p_period TEXT)
RETURNS TABLE(
  metric TEXT,
  target_value NUMERIC,
  current_value NUMERIC,
  progress_pct NUMERIC,
  goal_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_start DATE;
  v_end DATE;
  v_role TEXT;
  v_team_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
  SELECT commercial_role, team_id INTO v_role, v_team_id
    FROM public.prospecting_player_profile
    WHERE user_id = p_user_id AND company_id = v_company_id LIMIT 1;

  IF p_period = 'daily' THEN
    v_start := CURRENT_DATE; v_end := CURRENT_DATE;
  ELSIF p_period = 'weekly' THEN
    v_start := date_trunc('week', CURRENT_DATE)::DATE; v_end := (v_start + INTERVAL '6 days')::DATE;
  ELSE
    v_start := date_trunc('month', CURRENT_DATE)::DATE; v_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  END IF;

  RETURN QUERY
  WITH goals AS (
    SELECT cg.id, cg.metric, cg.target_value
    FROM public.commercial_goals cg
    WHERE cg.company_id = v_company_id
      AND cg.active = true
      AND cg.period = p_period
      AND (
        (cg.scope = 'user' AND cg.user_id = p_user_id)
        OR (cg.scope = 'team' AND cg.team_id = v_team_id)
        OR (cg.scope = 'role' AND cg.role_target = v_role)
        OR (cg.scope = 'company')
      )
    ORDER BY
      CASE cg.scope WHEN 'user' THEN 1 WHEN 'team' THEN 2 WHEN 'role' THEN 3 ELSE 4 END
  ),
  dedup AS (
    SELECT DISTINCT ON (metric) id, metric, target_value FROM goals
  ),
  realized AS (
    SELECT
      COALESCE(SUM(leads_prospected),0)::NUMERIC AS leads_prospected,
      COALESCE(SUM(responses),0)::NUMERIC AS responses,
      COALESCE(SUM(opportunities),0)::NUMERIC AS opportunities,
      COALESCE(SUM(meetings_scheduled),0)::NUMERIC AS meetings_scheduled,
      COALESCE(SUM(sales_closed),0)::NUMERIC AS sales_closed,
      COALESCE(SUM(gross_value),0)::NUMERIC AS gross_value
    FROM public.prospecting_daily_logs
    WHERE user_id = p_user_id AND log_date BETWEEN v_start AND v_end
  ),
  calls AS (
    SELECT COUNT(*)::NUMERIC AS total
    FROM public.prospecting_interactions
    WHERE user_id = p_user_id AND channel = 'cold_call'
      AND interaction_date BETWEEN v_start AND v_end
  )
  SELECT
    d.metric,
    d.target_value,
    CASE d.metric
      WHEN 'leads_prospected' THEN r.leads_prospected
      WHEN 'responses' THEN r.responses
      WHEN 'opportunities' THEN r.opportunities
      WHEN 'meetings_scheduled' THEN r.meetings_scheduled
      WHEN 'sales_closed' THEN r.sales_closed
      WHEN 'gross_value' THEN r.gross_value
      WHEN 'calls' THEN c.total
      ELSE 0
    END AS current_value,
    CASE WHEN d.target_value > 0 THEN
      ROUND((CASE d.metric
        WHEN 'leads_prospected' THEN r.leads_prospected
        WHEN 'responses' THEN r.responses
        WHEN 'opportunities' THEN r.opportunities
        WHEN 'meetings_scheduled' THEN r.meetings_scheduled
        WHEN 'sales_closed' THEN r.sales_closed
        WHEN 'gross_value' THEN r.gross_value
        WHEN 'calls' THEN c.total
        ELSE 0 END / d.target_value) * 100, 1)
      ELSE 0 END AS progress_pct,
    d.id AS goal_id
  FROM dedup d
  CROSS JOIN realized r
  CROSS JOIN calls c;
END;
$$;

-- 6) Função: performance agregada do time
CREATE OR REPLACE FUNCTION public.get_team_performance(p_company_id UUID, p_period TEXT DEFAULT 'daily')
RETURNS TABLE(
  user_id UUID,
  user_name TEXT,
  commercial_role TEXT,
  team_id UUID,
  team_name TEXT,
  leads_prospected NUMERIC,
  calls NUMERIC,
  responses NUMERIC,
  meetings_scheduled NUMERIC,
  sales_closed NUMERIC,
  gross_value NUMERIC,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE; v_end DATE;
BEGIN
  IF p_period = 'daily' THEN
    v_start := CURRENT_DATE; v_end := CURRENT_DATE;
  ELSIF p_period = 'weekly' THEN
    v_start := date_trunc('week', CURRENT_DATE)::DATE; v_end := (v_start + INTERVAL '6 days')::DATE;
  ELSE
    v_start := date_trunc('month', CURRENT_DATE)::DATE; v_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    COALESCE(p.full_name, p.email, 'Usuário')::TEXT AS user_name,
    COALESCE(pp.commercial_role, 'sdr')::TEXT,
    pp.team_id,
    st.name AS team_name,
    COALESCE(SUM(dl.leads_prospected),0)::NUMERIC,
    COALESCE((SELECT COUNT(*) FROM public.prospecting_interactions pi
              WHERE pi.user_id = ur.user_id AND pi.channel = 'cold_call'
              AND pi.interaction_date BETWEEN v_start AND v_end),0)::NUMERIC,
    COALESCE(SUM(dl.responses),0)::NUMERIC,
    COALESCE(SUM(dl.meetings_scheduled),0)::NUMERIC,
    COALESCE(SUM(dl.sales_closed),0)::NUMERIC,
    COALESCE(SUM(dl.gross_value),0)::NUMERIC,
    CASE WHEN COALESCE(SUM(dl.leads_prospected),0) > 0
      THEN ROUND((COALESCE(SUM(dl.sales_closed),0)::NUMERIC / SUM(dl.leads_prospected)) * 100, 2)
      ELSE 0 END
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  LEFT JOIN public.prospecting_player_profile pp ON pp.user_id = ur.user_id AND pp.company_id = ur.company_id
  LEFT JOIN public.sales_teams st ON st.id = pp.team_id
  LEFT JOIN public.prospecting_daily_logs dl ON dl.user_id = ur.user_id
       AND dl.log_date BETWEEN v_start AND v_end
  WHERE ur.company_id = p_company_id
  GROUP BY ur.user_id, p.full_name, p.email, pp.commercial_role, pp.team_id, st.name;
END;
$$;
