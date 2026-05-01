ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS group_participant_phone TEXT,
  ADD COLUMN IF NOT EXISTS group_participant_avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_conversas_group_participant_phone
ON public.conversas(company_id, group_participant_phone)
WHERE is_group = true AND group_participant_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_group_participants_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  group_jid TEXT NOT NULL,
  participant_jid TEXT NOT NULL,
  participant_phone TEXT,
  participant_name TEXT,
  avatar_url TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, group_jid, participant_jid)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_cache_lookup
ON public.whatsapp_group_participants_cache(company_id, group_jid, participant_jid);

ALTER TABLE public.whatsapp_group_participants_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users view group participants cache" ON public.whatsapp_group_participants_cache;
CREATE POLICY "Company users view group participants cache"
ON public.whatsapp_group_participants_cache
FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Service role manages group participants cache" ON public.whatsapp_group_participants_cache;
CREATE POLICY "Service role manages group participants cache"
ON public.whatsapp_group_participants_cache
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE TRIGGER update_whatsapp_group_participants_cache_updated_at
BEFORE UPDATE ON public.whatsapp_group_participants_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();