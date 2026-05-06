ALTER TABLE public.whatsapp_message_logs
ALTER COLUMN campaign_id TYPE text USING campaign_id::text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_company_sent
ON public.whatsapp_message_logs (company_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_campaign_text
ON public.whatsapp_message_logs (campaign_id);

CREATE INDEX IF NOT EXISTS idx_conversas_campanha_company_created
ON public.conversas (company_id, campanha_id, created_at DESC)
WHERE campanha_id IS NOT NULL;