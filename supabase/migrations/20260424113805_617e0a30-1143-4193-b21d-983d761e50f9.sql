
-- =============================================================
-- SALES QUEST — Gamificação RPG do módulo Prospecção
-- =============================================================

-- 1) PLAYER PROFILE
CREATE TABLE IF NOT EXISTS public.prospecting_player_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  level INT NOT NULL DEFAULT 1,
  xp_total INT NOT NULL DEFAULT 0,
  xp_current INT NOT NULL DEFAULT 0,
  class TEXT NOT NULL DEFAULT 'hunter', -- hunter | closer | farmer | ranger
  title TEXT,
  streak_days INT NOT NULL DEFAULT 0,
  last_activity_date DATE,
  coins INT NOT NULL DEFAULT 0,
  avatar_frame TEXT DEFAULT 'iniciado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_company ON public.prospecting_player_profile(company_id);
CREATE INDEX IF NOT EXISTS idx_pp_xp ON public.prospecting_player_profile(company_id, xp_total DESC);

ALTER TABLE public.prospecting_player_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players see own profile and company peers"
ON public.prospecting_player_profile FOR SELECT
USING (
  auth.uid() = user_id
  OR company_id = public.get_my_company_id()
);

CREATE POLICY "Players insert own profile"
ON public.prospecting_player_profile FOR INSERT
WITH CHECK (auth.uid() = user_id AND company_id = public.get_my_company_id());

CREATE POLICY "Players update own profile"
ON public.prospecting_player_profile FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage company profiles"
ON public.prospecting_player_profile FOR ALL
USING (
  company_id = public.get_my_company_id()
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- 2) QUESTS
CREATE TABLE IF NOT EXISTS public.prospecting_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID, -- NULL = global template
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('daily','weekly','monthly','special')),
  goal_metric TEXT NOT NULL CHECK (goal_metric IN ('leads','responses','opportunities','meetings','sales','gross_value')),
  goal_value NUMERIC NOT NULL,
  xp_reward INT NOT NULL DEFAULT 0,
  coin_reward INT NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'target',
  active BOOLEAN NOT NULL DEFAULT true,
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quests_company ON public.prospecting_quests(company_id, active);

ALTER TABLE public.prospecting_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone in company sees their quests and templates"
ON public.prospecting_quests FOR SELECT
USING (
  is_template = true
  OR company_id = public.get_my_company_id()
);

CREATE POLICY "Admins manage quests"
ON public.prospecting_quests FOR ALL
USING (
  company_id = public.get_my_company_id()
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- 3) QUEST PROGRESS
CREATE TABLE IF NOT EXISTS public.prospecting_quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  quest_id UUID NOT NULL REFERENCES public.prospecting_quests(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_qp_user ON public.prospecting_quest_progress(user_id, period_start);

ALTER TABLE public.prospecting_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players see own progress and company peers"
ON public.prospecting_quest_progress FOR SELECT
USING (auth.uid() = user_id OR company_id = public.get_my_company_id());

CREATE POLICY "System and user can write own progress"
ON public.prospecting_quest_progress FOR ALL
USING (auth.uid() = user_id OR company_id = public.get_my_company_id())
WITH CHECK (auth.uid() = user_id OR company_id = public.get_my_company_id());

-- 4) ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.prospecting_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  achievement_code TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS idx_ach_user ON public.prospecting_achievements(user_id);

ALTER TABLE public.prospecting_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements visible to company"
ON public.prospecting_achievements FOR SELECT
USING (auth.uid() = user_id OR company_id = public.get_my_company_id());

CREATE POLICY "System inserts achievements"
ON public.prospecting_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id OR company_id = public.get_my_company_id());

-- 5) REWARDS SHOP
CREATE TABLE IF NOT EXISTS public.prospecting_rewards_shop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost_coins INT NOT NULL,
  stock INT,
  active BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  icon TEXT DEFAULT 'gift',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_rewards_shop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company sees rewards"
ON public.prospecting_rewards_shop FOR SELECT
USING (company_id = public.get_my_company_id());

CREATE POLICY "Admins manage rewards"
ON public.prospecting_rewards_shop FOR ALL
USING (
  company_id = public.get_my_company_id()
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- 6) REWARD REDEMPTIONS
CREATE TABLE IF NOT EXISTS public.prospecting_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES public.prospecting_rewards_shop(id) ON DELETE CASCADE,
  cost_paid INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','delivered','rejected')),
  notes TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own redemptions; admins see all"
ON public.prospecting_reward_redemptions FOR SELECT
USING (
  auth.uid() = user_id
  OR (company_id = public.get_my_company_id()
      AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor')))
);

CREATE POLICY "Users create own redemptions"
ON public.prospecting_reward_redemptions FOR INSERT
WITH CHECK (auth.uid() = user_id AND company_id = public.get_my_company_id());

CREATE POLICY "Admins update redemptions"
ON public.prospecting_reward_redemptions FOR UPDATE
USING (
  company_id = public.get_my_company_id()
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- 7) GAMIFICATION CONFIG
CREATE TABLE IF NOT EXISTS public.prospecting_gamification_config (
  company_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  shop_enabled BOOLEAN NOT NULL DEFAULT false,
  xp_per_response INT NOT NULL DEFAULT 5,
  xp_per_opportunity INT NOT NULL DEFAULT 15,
  xp_per_meeting INT NOT NULL DEFAULT 30,
  xp_per_sale INT NOT NULL DEFAULT 100,
  xp_per_value_unit NUMERIC NOT NULL DEFAULT 0.01, -- 1 XP a cada R$100
  coins_per_sale INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prospecting_gamification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company sees own config"
ON public.prospecting_gamification_config FOR SELECT
USING (company_id = public.get_my_company_id());

CREATE POLICY "Admins manage config"
ON public.prospecting_gamification_config FOR ALL
USING (
  company_id = public.get_my_company_id()
  AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'company_admin') OR public.has_role(auth.uid(), 'gestor'))
);

-- =============================================================
-- HELPER FUNCTIONS
-- =============================================================

-- XP needed to reach next level: 100 * level^1.5
CREATE OR REPLACE FUNCTION public.xp_needed_for_level(p_level INT)
RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT FLOOR(100 * POWER(p_level, 1.5))::INT;
$$;

-- Ensure player profile exists
CREATE OR REPLACE FUNCTION public.ensure_player_profile(p_user_id UUID, p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.prospecting_player_profile
  WHERE user_id = p_user_id AND company_id = p_company_id;

  IF v_id IS NULL THEN
    INSERT INTO public.prospecting_player_profile(user_id, company_id, title)
    VALUES (p_user_id, p_company_id, 'Iniciado')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Add XP and process level ups
CREATE OR REPLACE FUNCTION public.add_player_xp(p_user_id UUID, p_company_id UUID, p_xp INT, p_coins INT DEFAULT 0)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_profile RECORD;
  v_needed INT;
  v_new_total INT;
  v_new_current INT;
  v_new_level INT;
  v_new_streak INT;
BEGIN
  PERFORM public.ensure_player_profile(p_user_id, p_company_id);

  SELECT * INTO v_profile FROM public.prospecting_player_profile
  WHERE user_id = p_user_id AND company_id = p_company_id FOR UPDATE;

  v_new_total := v_profile.xp_total + p_xp;
  v_new_current := v_profile.xp_current + p_xp;
  v_new_level := v_profile.level;

  -- Process level ups
  LOOP
    v_needed := public.xp_needed_for_level(v_new_level);
    EXIT WHEN v_new_current < v_needed;
    v_new_current := v_new_current - v_needed;
    v_new_level := v_new_level + 1;
  END LOOP;

  -- Streak
  IF v_profile.last_activity_date IS NULL OR v_profile.last_activity_date < CURRENT_DATE THEN
    IF v_profile.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN
      v_new_streak := v_profile.streak_days + 1;
    ELSE
      v_new_streak := 1;
    END IF;
  ELSE
    v_new_streak := v_profile.streak_days;
  END IF;

  UPDATE public.prospecting_player_profile
  SET xp_total = v_new_total,
      xp_current = v_new_current,
      level = v_new_level,
      streak_days = v_new_streak,
      last_activity_date = CURRENT_DATE,
      coins = coins + GREATEST(p_coins, 0),
      updated_at = now()
  WHERE id = v_profile.id;
END;
$$;

-- Unlock achievement (idempotent)
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_user_id UUID, p_company_id UUID, p_code TEXT, p_rarity TEXT DEFAULT 'common')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  INSERT INTO public.prospecting_achievements(user_id, company_id, achievement_code, rarity)
  VALUES (p_user_id, p_company_id, p_code, p_rarity)
  ON CONFLICT (user_id, achievement_code) DO NOTHING;
END;
$$;

-- Recalculate quest progress for a user
CREATE OR REPLACE FUNCTION public.recalc_quest_progress(p_user_id UUID, p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  q RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_value NUMERIC;
  v_progress_id UUID;
BEGIN
  FOR q IN
    SELECT * FROM public.prospecting_quests
    WHERE active = true
      AND (company_id = p_company_id OR (is_template = true AND company_id IS NULL))
  LOOP
    -- Determine period window
    IF q.type = 'daily' THEN
      v_period_start := CURRENT_DATE;
      v_period_end := CURRENT_DATE;
    ELSIF q.type = 'weekly' THEN
      v_period_start := date_trunc('week', CURRENT_DATE)::DATE;
      v_period_end := (v_period_start + INTERVAL '6 days')::DATE;
    ELSIF q.type = 'monthly' THEN
      v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
      v_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    ELSE
      CONTINUE;
    END IF;

    -- Compute current value from interactions + daily logs
    IF q.goal_metric = 'leads' THEN
      SELECT COALESCE(SUM(leads_prospected),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSIF q.goal_metric = 'responses' THEN
      SELECT COALESCE(SUM(responses),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSIF q.goal_metric = 'opportunities' THEN
      SELECT COALESCE(SUM(opportunities),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSIF q.goal_metric = 'meetings' THEN
      SELECT COALESCE(SUM(meetings_scheduled),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSIF q.goal_metric = 'sales' THEN
      SELECT COALESCE(SUM(sales_closed),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSIF q.goal_metric = 'gross_value' THEN
      SELECT COALESCE(SUM(gross_value),0) INTO v_value
      FROM public.prospecting_daily_logs
      WHERE user_id = p_user_id AND company_id = p_company_id
        AND log_date BETWEEN v_period_start AND v_period_end;
    ELSE
      v_value := 0;
    END IF;

    -- Upsert progress
    INSERT INTO public.prospecting_quest_progress(user_id, company_id, quest_id, period_start, current_value, completed_at)
    VALUES (p_user_id, p_company_id, q.id, v_period_start, v_value,
            CASE WHEN v_value >= q.goal_value THEN now() ELSE NULL END)
    ON CONFLICT (user_id, quest_id, period_start)
    DO UPDATE SET
      current_value = EXCLUDED.current_value,
      completed_at = CASE
        WHEN public.prospecting_quest_progress.completed_at IS NOT NULL THEN public.prospecting_quest_progress.completed_at
        WHEN EXCLUDED.current_value >= q.goal_value THEN now()
        ELSE NULL
      END,
      updated_at = now();
  END LOOP;
END;
$$;

-- Claim quest reward
CREATE OR REPLACE FUNCTION public.claim_quest_reward(p_progress_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_progress RECORD;
  v_quest RECORD;
BEGIN
  SELECT * INTO v_progress FROM public.prospecting_quest_progress WHERE id = p_progress_id;
  IF v_progress IS NULL THEN RAISE EXCEPTION 'Progresso não encontrado'; END IF;
  IF v_progress.user_id <> auth.uid() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_progress.completed_at IS NULL THEN RAISE EXCEPTION 'Missão não completada'; END IF;
  IF v_progress.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Recompensa já resgatada'; END IF;

  SELECT * INTO v_quest FROM public.prospecting_quests WHERE id = v_progress.quest_id;

  PERFORM public.add_player_xp(v_progress.user_id, v_progress.company_id, v_quest.xp_reward, v_quest.coin_reward);

  UPDATE public.prospecting_quest_progress
  SET claimed_at = now(), updated_at = now()
  WHERE id = p_progress_id;

  RETURN json_build_object('success', true, 'xp', v_quest.xp_reward, 'coins', v_quest.coin_reward);
END;
$$;

-- Redeem shop reward
CREATE OR REPLACE FUNCTION public.redeem_shop_reward(p_reward_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_reward RECORD;
  v_profile RECORD;
  v_redemption_id UUID;
BEGIN
  SELECT * INTO v_reward FROM public.prospecting_rewards_shop WHERE id = p_reward_id AND active = true;
  IF v_reward IS NULL THEN RAISE EXCEPTION 'Recompensa não disponível'; END IF;

  SELECT * INTO v_profile FROM public.prospecting_player_profile
  WHERE user_id = auth.uid() AND company_id = v_reward.company_id FOR UPDATE;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Ficha não encontrada'; END IF;
  IF v_profile.coins < v_reward.cost_coins THEN RAISE EXCEPTION 'Moedas insuficientes'; END IF;
  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN RAISE EXCEPTION 'Sem estoque'; END IF;

  UPDATE public.prospecting_player_profile SET coins = coins - v_reward.cost_coins, updated_at = now() WHERE id = v_profile.id;
  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.prospecting_rewards_shop SET stock = stock - 1, updated_at = now() WHERE id = v_reward.id;
  END IF;

  INSERT INTO public.prospecting_reward_redemptions(user_id, company_id, reward_id, cost_paid, status)
  VALUES (auth.uid(), v_reward.company_id, v_reward.id, v_reward.cost_coins,
          CASE WHEN v_reward.requires_approval THEN 'pending' ELSE 'approved' END)
  RETURNING id INTO v_redemption_id;

  RETURN json_build_object('success', true, 'redemption_id', v_redemption_id);
END;
$$;

-- =============================================================
-- TRIGGERS — auto XP from interactions and daily logs
-- =============================================================

CREATE OR REPLACE FUNCTION public.tg_xp_from_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_cfg RECORD;
  v_xp INT := 0;
  v_coins INT := 0;
BEGIN
  -- Skip if gamification disabled
  SELECT * INTO v_cfg FROM public.prospecting_gamification_config WHERE company_id = NEW.company_id;
  IF v_cfg IS NULL THEN
    INSERT INTO public.prospecting_gamification_config(company_id) VALUES (NEW.company_id)
    ON CONFLICT DO NOTHING;
    SELECT * INTO v_cfg FROM public.prospecting_gamification_config WHERE company_id = NEW.company_id;
  END IF;
  IF NOT v_cfg.enabled THEN RETURN NEW; END IF;

  IF NEW.outcome = 'responded' THEN v_xp := v_cfg.xp_per_response;
  ELSIF NEW.outcome = 'opportunity' THEN v_xp := v_cfg.xp_per_opportunity;
  ELSIF NEW.outcome = 'meeting_scheduled' THEN v_xp := v_cfg.xp_per_meeting;
  ELSIF NEW.outcome = 'sale_closed' THEN
    v_xp := v_cfg.xp_per_sale + FLOOR(COALESCE(NEW.gross_value,0) * v_cfg.xp_per_value_unit)::INT;
    v_coins := v_cfg.coins_per_sale;
  END IF;

  IF v_xp > 0 THEN
    PERFORM public.add_player_xp(NEW.user_id, NEW.company_id, v_xp, v_coins);
    PERFORM public.recalc_quest_progress(NEW.user_id, NEW.company_id);

    -- First sale achievement
    IF NEW.outcome = 'sale_closed' THEN
      PERFORM public.unlock_achievement(NEW.user_id, NEW.company_id, 'first_blood', 'rare');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_interaction ON public.prospecting_interactions;
CREATE TRIGGER trg_xp_from_interaction
AFTER INSERT ON public.prospecting_interactions
FOR EACH ROW EXECUTE FUNCTION public.tg_xp_from_interaction();

CREATE OR REPLACE FUNCTION public.tg_xp_from_daily_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_cfg RECORD;
  v_xp INT := 0;
  v_coins INT := 0;
  v_delta_responses INT;
  v_delta_opps INT;
  v_delta_meetings INT;
  v_delta_sales INT;
  v_delta_value NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.prospecting_gamification_config WHERE company_id = NEW.company_id;
  IF v_cfg IS NULL THEN
    INSERT INTO public.prospecting_gamification_config(company_id) VALUES (NEW.company_id)
    ON CONFLICT DO NOTHING;
    SELECT * INTO v_cfg FROM public.prospecting_gamification_config WHERE company_id = NEW.company_id;
  END IF;
  IF NOT v_cfg.enabled THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_delta_responses := COALESCE(NEW.responses,0);
    v_delta_opps := COALESCE(NEW.opportunities,0);
    v_delta_meetings := COALESCE(NEW.meetings_scheduled,0);
    v_delta_sales := COALESCE(NEW.sales_closed,0);
    v_delta_value := COALESCE(NEW.gross_value,0);
  ELSE
    v_delta_responses := GREATEST(COALESCE(NEW.responses,0) - COALESCE(OLD.responses,0), 0);
    v_delta_opps := GREATEST(COALESCE(NEW.opportunities,0) - COALESCE(OLD.opportunities,0), 0);
    v_delta_meetings := GREATEST(COALESCE(NEW.meetings_scheduled,0) - COALESCE(OLD.meetings_scheduled,0), 0);
    v_delta_sales := GREATEST(COALESCE(NEW.sales_closed,0) - COALESCE(OLD.sales_closed,0), 0);
    v_delta_value := GREATEST(COALESCE(NEW.gross_value,0) - COALESCE(OLD.gross_value,0), 0);
  END IF;

  v_xp := v_delta_responses * v_cfg.xp_per_response
        + v_delta_opps * v_cfg.xp_per_opportunity
        + v_delta_meetings * v_cfg.xp_per_meeting
        + v_delta_sales * v_cfg.xp_per_sale
        + FLOOR(v_delta_value * v_cfg.xp_per_value_unit)::INT;
  v_coins := v_delta_sales * v_cfg.coins_per_sale;

  IF v_xp > 0 THEN
    PERFORM public.add_player_xp(NEW.user_id, NEW.company_id, v_xp, v_coins);
    PERFORM public.recalc_quest_progress(NEW.user_id, NEW.company_id);

    IF v_delta_sales > 0 THEN
      PERFORM public.unlock_achievement(NEW.user_id, NEW.company_id, 'first_blood', 'rare');
    END IF;
    IF COALESCE(NEW.leads_prospected,0) >= 50 THEN
      PERFORM public.unlock_achievement(NEW.user_id, NEW.company_id, 'velocista', 'epic');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_from_daily_log ON public.prospecting_daily_logs;
CREATE TRIGGER trg_xp_from_daily_log
AFTER INSERT OR UPDATE ON public.prospecting_daily_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_xp_from_daily_log();

-- =============================================================
-- SEED — 15 quest templates
-- =============================================================

INSERT INTO public.prospecting_quests(company_id, name, description, type, goal_metric, goal_value, xp_reward, coin_reward, icon, is_template, active)
VALUES
-- Daily
(NULL, 'Caçar 10 leads', 'Prospecte 10 leads novos hoje', 'daily', 'leads', 10, 50, 5, 'crosshair', true, true),
(NULL, 'Receber 3 respostas', 'Consiga 3 respostas hoje', 'daily', 'responses', 3, 60, 5, 'message-circle', true, true),
(NULL, 'Agendar 1 reunião', 'Marque uma reunião hoje', 'daily', 'meetings', 1, 100, 10, 'calendar', true, true),
(NULL, 'Detectar oportunidade', 'Identifique 1 oportunidade qualificada', 'daily', 'opportunities', 1, 70, 5, 'radar', true, true),
(NULL, 'Fechar negócio', 'Feche 1 venda hoje', 'daily', 'sales', 1, 200, 25, 'trophy', true, true),
-- Weekly
(NULL, '50 leads na semana', 'Prospecte 50 leads esta semana', 'weekly', 'leads', 50, 250, 30, 'crosshair', true, true),
(NULL, '15 oportunidades', 'Gere 15 oportunidades qualificadas', 'weekly', 'opportunities', 15, 350, 40, 'target', true, true),
(NULL, '5 reuniões agendadas', 'Marque 5 reuniões esta semana', 'weekly', 'meetings', 5, 400, 50, 'calendar', true, true),
(NULL, '3 vendas fechadas', 'Feche 3 negócios esta semana', 'weekly', 'sales', 3, 600, 75, 'trophy', true, true),
(NULL, 'R$ 10k em vendas', 'Some R$ 10.000 em vendas na semana', 'weekly', 'gross_value', 10000, 700, 100, 'gem', true, true),
-- Monthly
(NULL, '200 leads mensais', 'Prospecte 200 leads no mês', 'monthly', 'leads', 200, 1000, 150, 'crosshair', true, true),
(NULL, '20 reuniões mensais', 'Marque 20 reuniões no mês', 'monthly', 'meetings', 20, 1500, 200, 'calendar', true, true),
(NULL, '10 vendas mensais', 'Feche 10 negócios no mês', 'monthly', 'sales', 10, 2500, 300, 'trophy', true, true),
(NULL, 'R$ 50k mensal', 'Atinja R$ 50.000 em vendas no mês', 'monthly', 'gross_value', 50000, 3000, 400, 'gem', true, true),
(NULL, 'R$ 100k Diamante', 'Atinja R$ 100.000 em vendas no mês', 'monthly', 'gross_value', 100000, 5000, 750, 'gem', true, true)
ON CONFLICT DO NOTHING;

-- update_at triggers
CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.prospecting_player_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quests_updated BEFORE UPDATE ON public.prospecting_quests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_qp_updated BEFORE UPDATE ON public.prospecting_quest_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_updated BEFORE UPDATE ON public.prospecting_rewards_shop FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_red_updated BEFORE UPDATE ON public.prospecting_reward_redemptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
