CREATE OR REPLACE FUNCTION public.claim_next_queue_lead(_queue_id uuid, _user_id uuid)
RETURNS TABLE(
  queue_lead_id uuid,
  lead_id uuid,
  queue_position int,
  attempts int,
  notes text,
  lead_name text,
  lead_phone text,
  lead_tags text[],
  lead_stage text,
  lead_value numeric,
  lead_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_id uuid;
BEGIN
  SELECT pql.id INTO _next_id
  FROM public.prospecting_queue_leads pql
  WHERE pql.queue_id = _queue_id
    AND pql.status = 'pending'
    AND (pql.assigned_user_id = _user_id OR pql.assigned_user_id IS NULL)
  ORDER BY pql.position ASC, pql.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _next_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.prospecting_queue_leads
  SET status = 'in_progress',
      assigned_user_id = _user_id,
      last_attempt_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = _next_id;

  RETURN QUERY
  SELECT pql.id, pql.lead_id, pql.position, pql.attempts, pql.notes,
         l.name, COALESCE(l.phone, l.telefone), l.tags, l.stage, l.value, l.email
  FROM public.prospecting_queue_leads pql
  JOIN public.leads l ON l.id = pql.lead_id
  WHERE pql.id = _next_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.distribute_queue_leads(_queue_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _users uuid[];
  _user_count int;
  _idx int := 0;
  _updated int := 0;
  _rec record;
BEGIN
  SELECT assigned_user_ids INTO _users FROM public.prospecting_queues WHERE id = _queue_id;
  IF _users IS NULL OR array_length(_users, 1) IS NULL THEN RETURN 0; END IF;
  _user_count := array_length(_users, 1);

  FOR _rec IN
    SELECT id FROM public.prospecting_queue_leads
    WHERE queue_id = _queue_id AND status = 'pending' AND assigned_user_id IS NULL
    ORDER BY position ASC, created_at ASC
  LOOP
    UPDATE public.prospecting_queue_leads
    SET assigned_user_id = _users[(_idx % _user_count) + 1], updated_at = now()
    WHERE id = _rec.id;
    _idx := _idx + 1;
    _updated := _updated + 1;
  END LOOP;

  RETURN _updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_queue_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _users uuid[];
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT assigned_user_ids INTO _users FROM public.prospecting_queues WHERE id = NEW.queue_id;
  IF _users IS NULL OR array_length(_users, 1) IS NULL THEN RETURN NEW; END IF;

  SELECT u INTO NEW.assigned_user_id
  FROM unnest(_users) u
  LEFT JOIN public.prospecting_queue_leads pql
    ON pql.assigned_user_id = u AND pql.queue_id = NEW.queue_id AND pql.status = 'pending'
  GROUP BY u
  ORDER BY count(pql.id) ASC, random()
  LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_queue_lead ON public.prospecting_queue_leads;
CREATE TRIGGER trg_auto_assign_queue_lead
BEFORE INSERT ON public.prospecting_queue_leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_queue_lead();