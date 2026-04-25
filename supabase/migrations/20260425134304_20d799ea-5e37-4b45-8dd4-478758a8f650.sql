
-- ============ MENTORIA: SESSÕES ============
CREATE TABLE public.mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  scheduled_by UUID NOT NULL,
  mentor_name TEXT NOT NULL DEFAULT 'Mentor Waze',
  topic TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  post_session_notes TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  recording_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentorship_sessions_company ON public.mentorship_sessions(company_id, scheduled_at DESC);

ALTER TABLE public.mentorship_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view sessions"
  ON public.mentorship_sessions FOR SELECT
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company members can schedule sessions"
  ON public.mentorship_sessions FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND scheduled_by = auth.uid());

CREATE POLICY "Company members can update sessions"
  ON public.mentorship_sessions FOR UPDATE
  USING (company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Company admins can delete sessions"
  ON public.mentorship_sessions FOR DELETE
  USING ((company_id = get_my_company_id() AND has_role(auth.uid(), 'company_admin')) OR is_super_admin());

CREATE TRIGGER trg_mentorship_sessions_updated
  BEFORE UPDATE ON public.mentorship_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MENTORIA: GRAVAÇÕES ============
CREATE TABLE public.mentorship_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID, -- NULL = biblioteca global Waze (visível p/ todos)
  session_id UUID REFERENCES public.mentorship_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  views_count INT NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentorship_recordings_company ON public.mentorship_recordings(company_id, created_at DESC);

ALTER TABLE public.mentorship_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own company recordings or global"
  ON public.mentorship_recordings FOR SELECT
  USING (company_id IS NULL OR company_id = get_my_company_id() OR is_super_admin());

CREATE POLICY "Super admin manages recordings"
  ON public.mentorship_recordings FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Company admins upload own recordings"
  ON public.mentorship_recordings FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND has_role(auth.uid(), 'company_admin'));

CREATE TRIGGER trg_mentorship_recordings_updated
  BEFORE UPDATE ON public.mentorship_recordings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MENTORIA: COMUNIDADE ============
CREATE TABLE public.mentorship_community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  author_company_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'discussion', -- discussion, question, win, tip
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_posts_created ON public.mentorship_community_posts(pinned DESC, created_at DESC);

ALTER TABLE public.mentorship_community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view community"
  ON public.mentorship_community_posts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users create their own posts"
  ON public.mentorship_community_posts FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users update their own posts"
  ON public.mentorship_community_posts FOR UPDATE
  USING (author_id = auth.uid() OR is_super_admin());

CREATE POLICY "Users delete their own posts"
  ON public.mentorship_community_posts FOR DELETE
  USING (author_id = auth.uid() OR is_super_admin());

CREATE TRIGGER trg_community_posts_updated
  BEFORE UPDATE ON public.mentorship_community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
CREATE TABLE public.mentorship_community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.mentorship_community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_comments_post ON public.mentorship_community_comments(post_id, created_at);

ALTER TABLE public.mentorship_community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view comments"
  ON public.mentorship_community_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users add own comments"
  ON public.mentorship_community_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users delete own comments"
  ON public.mentorship_community_comments FOR DELETE
  USING (author_id = auth.uid() OR is_super_admin());

-- ============ MATURIDADE COMERCIAL ============
CREATE OR REPLACE FUNCTION public.get_commercial_maturity_score(p_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_prospeccao_score INT := 0;
  v_processos_score INT := 0;
  v_discador_score INT := 0;
  v_automacao_score INT := 0;
  v_total_score INT;
  v_level TEXT;

  -- Métricas
  v_interactions_30d INT := 0;
  v_active_queues INT := 0;
  v_active_cadences INT := 0;
  v_playbooks INT := 0;
  v_rotinas INT := 0;
  v_processos_pages INT := 0;
  v_calls_30d INT := 0;
  v_call_users INT := 0;
  v_active_flows INT := 0;
  v_ia_agents INT := 0;
  v_scripts INT := 0;
BEGIN
  v_company_id := COALESCE(p_company_id, get_my_company_id());
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_company');
  END IF;

  -- ===== PILAR 1: PROSPECÇÃO (0-25) =====
  SELECT COUNT(*) INTO v_interactions_30d
  FROM public.prospecting_interactions
  WHERE company_id = v_company_id
    AND interaction_date >= CURRENT_DATE - INTERVAL '30 days';

  SELECT COUNT(*) INTO v_active_queues
  FROM public.prospecting_queues
  WHERE company_id = v_company_id;

  v_prospeccao_score :=
    LEAST(15, (v_interactions_30d / 10)) +  -- até 15 pts (150 interações)
    LEAST(10, v_active_queues * 5);          -- até 10 pts (2 filas)

  -- ===== PILAR 2: PROCESSOS COMERCIAIS (0-25) =====
  BEGIN
    SELECT COUNT(*) INTO v_playbooks FROM public.commercial_playbooks WHERE company_id = v_company_id;
  EXCEPTION WHEN undefined_table THEN v_playbooks := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_rotinas FROM public.commercial_routines WHERE company_id = v_company_id;
  EXCEPTION WHEN undefined_table THEN v_rotinas := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_processos_pages FROM public.notion_pages WHERE company_id = v_company_id;
  EXCEPTION WHEN undefined_table THEN v_processos_pages := 0; END;

  v_processos_score :=
    LEAST(10, v_playbooks * 3) +           -- até 10 pts
    LEAST(8, v_rotinas * 2) +              -- até 8 pts
    LEAST(7, v_processos_pages);            -- até 7 pts

  -- ===== PILAR 3: DISCADOR (0-25) =====
  BEGIN
    SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO v_calls_30d, v_call_users
    FROM public.call_logs
    WHERE company_id = v_company_id
      AND call_start >= CURRENT_DATE - INTERVAL '30 days';
  EXCEPTION WHEN undefined_table THEN v_calls_30d := 0; v_call_users := 0; END;

  v_discador_score :=
    LEAST(18, (v_calls_30d / 10)) +        -- até 18 pts (180 chamadas)
    LEAST(7, v_call_users * 3);            -- até 7 pts (engajamento equipe)

  -- ===== PILAR 4: AUTOMAÇÃO + IA (0-25) =====
  BEGIN
    SELECT COUNT(*) INTO v_active_flows
    FROM public.automation_flows
    WHERE company_id = v_company_id AND active = true;
  EXCEPTION WHEN undefined_table THEN v_active_flows := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_ia_agents
    FROM public.ia_agents
    WHERE company_id = v_company_id;
  EXCEPTION WHEN undefined_table THEN v_ia_agents := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_scripts
    FROM public.ia_scripts
    WHERE company_id = v_company_id;
  EXCEPTION WHEN undefined_table THEN v_scripts := 0; END;

  v_automacao_score :=
    LEAST(10, v_active_flows * 3) +         -- até 10 pts
    LEAST(10, v_ia_agents * 5) +            -- até 10 pts
    LEAST(5, v_scripts * 2);                -- até 5 pts

  v_total_score := v_prospeccao_score + v_processos_score + v_discador_score + v_automacao_score;

  v_level := CASE
    WHEN v_total_score >= 80 THEN 'Elite'
    WHEN v_total_score >= 60 THEN 'Maduro'
    WHEN v_total_score >= 40 THEN 'Em Estruturação'
    WHEN v_total_score >= 20 THEN 'Iniciante'
    ELSE 'Não Estruturado'
  END;

  RETURN jsonb_build_object(
    'total_score', v_total_score,
    'level', v_level,
    'pillars', jsonb_build_object(
      'prospeccao', jsonb_build_object(
        'score', v_prospeccao_score, 'max', 25,
        'metrics', jsonb_build_object('interactions_30d', v_interactions_30d, 'queues', v_active_queues)
      ),
      'processos', jsonb_build_object(
        'score', v_processos_score, 'max', 25,
        'metrics', jsonb_build_object('playbooks', v_playbooks, 'rotinas', v_rotinas, 'pages', v_processos_pages)
      ),
      'discador', jsonb_build_object(
        'score', v_discador_score, 'max', 25,
        'metrics', jsonb_build_object('calls_30d', v_calls_30d, 'users', v_call_users)
      ),
      'automacao', jsonb_build_object(
        'score', v_automacao_score, 'max', 25,
        'metrics', jsonb_build_object('flows', v_active_flows, 'ia_agents', v_ia_agents, 'scripts', v_scripts)
      )
    ),
    'calculated_at', now()
  );
END;
$$;
