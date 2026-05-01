ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS group_participant_name TEXT,
  ADD COLUMN IF NOT EXISTS group_subject TEXT;

CREATE INDEX IF NOT EXISTS idx_conversas_group_subject ON public.conversas(group_subject) WHERE is_group = true;

CREATE TABLE IF NOT EXISTS public.whatsapp_groups_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  group_jid TEXT NOT NULL,
  group_subject TEXT,
  picture_url TEXT,
  participants_count INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, group_jid)
);

ALTER TABLE public.whatsapp_groups_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company groups cache" ON public.whatsapp_groups_cache;
CREATE POLICY "Users can view their company groups cache"
ON public.whatsapp_groups_cache
FOR SELECT
TO authenticated
USING (company_id IN (SELECT public.get_user_company_ids()));

DROP POLICY IF EXISTS "Service role manages groups cache" ON public.whatsapp_groups_cache;
CREATE POLICY "Service role manages groups cache"
ON public.whatsapp_groups_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);