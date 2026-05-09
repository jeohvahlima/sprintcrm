
CREATE OR REPLACE FUNCTION public.user_company_ids_array()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(cid), ARRAY[]::uuid[]) FROM public.get_user_company_ids() AS cid
$$;

CREATE TABLE public.follow_up_cadence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  step_number INT NOT NULL CHECK (step_number BETWEEN 1 AND 10),
  days_offset INT NOT NULL CHECK (days_offset >= 0),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, step_number)
);
ALTER TABLE public.follow_up_cadence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuc_select_company" ON public.follow_up_cadence
  FOR SELECT USING (company_id = ANY (public.user_company_ids_array()));
CREATE POLICY "fuc_modify_company" ON public.follow_up_cadence
  FOR ALL USING (company_id = ANY (public.user_company_ids_array()))
  WITH CHECK (company_id = ANY (public.user_company_ids_array()));

INSERT INTO public.follow_up_cadence (company_id, step_number, days_offset, label)
SELECT c.id, s.step, s.days, s.label
FROM public.companies c
CROSS JOIN (VALUES
  (1, 1,  'F1 — D+1'),
  (2, 3,  'F2 — D+3'),
  (3, 7,  'F3 — D+7'),
  (4, 14, 'F4 — D+14'),
  (5, 30, 'F5 — D+30')
) AS s(step, days, label)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_follow_up_cadence_for_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.follow_up_cadence (company_id, step_number, days_offset, label) VALUES
    (NEW.id, 1, 1,  'F1 — D+1'),
    (NEW.id, 2, 3,  'F2 — D+3'),
    (NEW.id, 3, 7,  'F3 — D+7'),
    (NEW.id, 4, 14, 'F4 — D+14'),
    (NEW.id, 5, 30, 'F5 — D+30')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_follow_up_cadence ON public.companies;
CREATE TRIGGER trg_seed_follow_up_cadence
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_follow_up_cadence_for_company();

CREATE TABLE public.follow_up_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  prospecting_contact_id UUID,
  source TEXT NOT NULL CHECK (source IN ('favorite','no_response','cold_lead','manual')),
  current_step INT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 0 AND 10),
  next_due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cooled','paused','lost')),
  outcome TEXT CHECK (outcome IN ('responded','meeting','sale','lost','no_response')),
  assigned_to UUID,
  notes TEXT,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fue_company_status ON public.follow_up_entries(company_id, status);
CREATE INDEX idx_fue_due ON public.follow_up_entries(next_due_at) WHERE status = 'active';
CREATE INDEX idx_fue_lead ON public.follow_up_entries(lead_id);
ALTER TABLE public.follow_up_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fue_select_company" ON public.follow_up_entries
  FOR SELECT USING (company_id = ANY (public.user_company_ids_array()));
CREATE POLICY "fue_insert_company" ON public.follow_up_entries
  FOR INSERT WITH CHECK (company_id = ANY (public.user_company_ids_array()));
CREATE POLICY "fue_update_company" ON public.follow_up_entries
  FOR UPDATE USING (company_id = ANY (public.user_company_ids_array()))
  WITH CHECK (company_id = ANY (public.user_company_ids_array()));
CREATE POLICY "fue_delete_company" ON public.follow_up_entries
  FOR DELETE USING (company_id = ANY (public.user_company_ids_array()));

CREATE TABLE public.follow_up_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.follow_up_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  step_number INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','call','instagram','email','sms','other')),
  notes TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('no_response','responded','meeting','sale','lost')),
  script_used TEXT,
  executed_by UUID,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fux_entry ON public.follow_up_executions(entry_id);
CREATE INDEX idx_fux_company ON public.follow_up_executions(company_id);
ALTER TABLE public.follow_up_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fux_select_company" ON public.follow_up_executions
  FOR SELECT USING (company_id = ANY (public.user_company_ids_array()));
CREATE POLICY "fux_insert_company" ON public.follow_up_executions
  FOR INSERT WITH CHECK (company_id = ANY (public.user_company_ids_array()));

CREATE OR REPLACE FUNCTION public.tg_follow_up_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_fue_updated_at
BEFORE UPDATE ON public.follow_up_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_follow_up_entries_updated_at();

CREATE OR REPLACE FUNCTION public.advance_follow_up_entry(
  p_entry_id UUID,
  p_channel TEXT,
  p_outcome TEXT,
  p_notes TEXT DEFAULT NULL,
  p_script TEXT DEFAULT NULL
) RETURNS public.follow_up_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.follow_up_entries;
  v_next_step INT;
  v_next_offset INT;
  v_user UUID := auth.uid();
BEGIN
  SELECT * INTO v_entry FROM public.follow_up_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entry not found'; END IF;
  IF NOT (v_entry.company_id = ANY (public.user_company_ids_array())) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  INSERT INTO public.follow_up_executions
    (entry_id, company_id, step_number, channel, notes, outcome, script_used, executed_by)
  VALUES
    (v_entry.id, v_entry.company_id, v_entry.current_step, p_channel, p_notes, p_outcome, p_script, v_user);

  IF p_outcome IN ('responded','meeting','sale') THEN
    UPDATE public.follow_up_entries
       SET status = 'completed', outcome = p_outcome, last_executed_at = now()
     WHERE id = v_entry.id RETURNING * INTO v_entry;
  ELSIF p_outcome = 'lost' THEN
    UPDATE public.follow_up_entries
       SET status = 'lost', outcome = 'lost', last_executed_at = now()
     WHERE id = v_entry.id RETURNING * INTO v_entry;
  ELSE
    SELECT step_number, days_offset
      INTO v_next_step, v_next_offset
      FROM public.follow_up_cadence
     WHERE company_id = v_entry.company_id
       AND step_number > v_entry.current_step
     ORDER BY step_number ASC LIMIT 1;

    IF v_next_step IS NULL THEN
      UPDATE public.follow_up_entries
         SET status = 'cooled', last_executed_at = now()
       WHERE id = v_entry.id RETURNING * INTO v_entry;
    ELSE
      UPDATE public.follow_up_entries
         SET current_step = v_next_step,
             next_due_at = now() + (v_next_offset || ' days')::interval,
             last_executed_at = now()
       WHERE id = v_entry.id RETURNING * INTO v_entry;
    END IF;
  END IF;

  RETURN v_entry;
END;
$$;
