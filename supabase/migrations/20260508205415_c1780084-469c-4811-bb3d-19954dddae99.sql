
-- Fix: meeting_chat_messages publicly readable
DROP POLICY IF EXISTS "Anyone can read chat messages" ON public.meeting_chat_messages;
DROP POLICY IF EXISTS "Anyone can send chat messages" ON public.meeting_chat_messages;

CREATE POLICY "Company users view meeting chat"
ON public.meeting_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat_messages.meeting_id
      AND public.user_belongs_to_company(auth.uid(), m.company_id)
  )
);

CREATE POLICY "Public view chat for external meetings"
ON public.meeting_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat_messages.meeting_id
      AND m.meeting_type = 'external'
      AND m.public_link IS NOT NULL
  )
);

CREATE POLICY "Company users send meeting chat"
ON public.meeting_chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat_messages.meeting_id
      AND public.user_belongs_to_company(auth.uid(), m.company_id)
  )
);

CREATE POLICY "Public send chat in external meetings"
ON public.meeting_chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_chat_messages.meeting_id
      AND m.meeting_type = 'external'
      AND m.public_link IS NOT NULL
  )
);

-- Fix: function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix: function search_path for tg_set_updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Fix: function search_path for set_updated_at_sm
CREATE OR REPLACE FUNCTION public.set_updated_at_sm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Fix: function search_path for xp_needed_for_level
CREATE OR REPLACE FUNCTION public.xp_needed_for_level(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT FLOOR(100 * POWER(p_level, 1.5))::INT;
$$;
