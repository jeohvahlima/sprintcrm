
-- =====================================================
-- FASE 1 — Cockpit operacional: missões, checklists, energia, review
-- =====================================================

-- 1. daily_missions: catálogo de missões da empresa
CREATE TABLE public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  role_target TEXT,                          -- 'sdr' | 'closer' | NULL (ambos)
  shift TEXT NOT NULL DEFAULT 'manha',       -- 'manha' | 'tarde' | 'noite'
  weekday SMALLINT,                          -- 0-6 (dom..sab) | NULL (todo dia)
  xp_reward INT NOT NULL DEFAULT 25,
  icon TEXT DEFAULT 'target',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_missions_company ON public.daily_missions(company_id, active);

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions_select_company" ON public.daily_missions
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "missions_manage_admins" ON public.daily_missions
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT get_user_company_ids())
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'gestor')
    )
  )
  WITH CHECK (
    company_id IN (SELECT get_user_company_ids())
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'gestor')
    )
  );

CREATE TRIGGER trg_daily_missions_updated
  BEFORE UPDATE ON public.daily_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. daily_mission_progress: execução diária
CREATE TABLE public.daily_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.daily_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'done' | 'skipped'
  completed_at TIMESTAMPTZ,
  xp_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, user_id, log_date)
);
CREATE INDEX idx_mission_progress_user_date ON public.daily_mission_progress(user_id, log_date);

ALTER TABLE public.daily_mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_progress_select_company" ON public.daily_mission_progress
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "mission_progress_insert_own" ON public.daily_mission_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "mission_progress_update_own" ON public.daily_mission_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_mission_progress_updated
  BEFORE UPDATE ON public.daily_mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. daily_checklists: checklist por bloco da rotina
CREATE TABLE public.daily_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  block_key TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, block_key, log_date)
);
CREATE INDEX idx_checklists_user_date ON public.daily_checklists(user_id, log_date);

ALTER TABLE public.daily_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select_company" ON public.daily_checklists
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "checklists_manage_own" ON public.daily_checklists
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_checklists_updated
  BEFORE UPDATE ON public.daily_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. daily_energy_log
CREATE TABLE public.daily_energy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy_level TEXT NOT NULL DEFAULT 'media',   -- 'alta' | 'media' | 'baixa'
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.daily_energy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy_select_company" ON public.daily_energy_log
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "energy_manage_own" ON public.daily_energy_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_energy_updated
  BEFORE UPDATE ON public.daily_energy_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 5. end_of_day_reviews
CREATE TABLE public.end_of_day_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  focus_score SMALLINT,                        -- 1..5
  objections_count INT DEFAULT 0,
  meetings_count INT DEFAULT 0,
  biggest_difficulty TEXT,
  wins TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.end_of_day_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_company" ON public.end_of_day_reviews
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "reviews_manage_own" ON public.end_of_day_reviews
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_reviews_updated
  BEFORE UPDATE ON public.end_of_day_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 6. Trigger: ao concluir uma missão, conceder XP via add_player_xp
CREATE OR REPLACE FUNCTION public.tg_award_mission_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INT;
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    SELECT xp_reward INTO v_xp FROM public.daily_missions WHERE id = NEW.mission_id;
    IF v_xp IS NULL THEN v_xp := 0; END IF;
    IF v_xp > 0 THEN
      BEGIN
        PERFORM public.add_player_xp(NEW.user_id, NEW.company_id, v_xp, 0);
      EXCEPTION WHEN OTHERS THEN
        -- não bloquear conclusão se engine de XP falhar
        NULL;
      END;
    END IF;
    NEW.xp_awarded := v_xp;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_mission_xp
  BEFORE INSERT OR UPDATE ON public.daily_mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_mission_xp();
