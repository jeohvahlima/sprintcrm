
CREATE TABLE IF NOT EXISTS public.grow_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  current_day int NOT NULL DEFAULT 1,
  completed_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.grow_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_onboarding" ON public.grow_onboarding_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR company_id IN (SELECT public.get_my_company_id()));

CREATE POLICY "insert_own_onboarding" ON public.grow_onboarding_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.get_my_company_id());

CREATE POLICY "update_own_onboarding" ON public.grow_onboarding_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_grow_onboarding_updated
  BEFORE UPDATE ON public.grow_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
