-- Backfill whatsapp_message_logs para disparos de campanhas Meta sem log
INSERT INTO whatsapp_message_logs (
  company_id, conversation_id, lead_id, message_id_meta, provider, direction,
  message_type, phone_number, status, cost_category, cost_estimate,
  campaign_id, campaign_name, sent_at, delivered_at, read_at
)
SELECT
  c.company_id,
  c.id,
  c.lead_id,
  c.whatsapp_message_id,
  'meta',
  'outbound',
  COALESCE(c.tipo_mensagem, 'text'),
  COALESCE(c.telefone_formatado, c.numero),
  CASE WHEN c.read THEN 'read' WHEN c.delivered THEN 'delivered' ELSE 'sent' END,
  CASE WHEN c.tipo_mensagem = 'template' THEN 'marketing' ELSE 'service' END,
  CASE WHEN c.tipo_mensagem = 'template' THEN 0.05 ELSE 0.005 END,
  c.campanha_id::text,
  c.campanha_nome,
  c.created_at,
  CASE WHEN c.delivered OR c.read THEN c.created_at ELSE NULL END,
  CASE WHEN c.read THEN c.created_at ELSE NULL END
FROM conversas c
WHERE c.fromme = true
  AND c.campanha_id IS NOT NULL
  AND c.created_at > now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_message_logs l
    WHERE l.campaign_id = c.campanha_id::text
      AND l.phone_number = COALESCE(c.telefone_formatado, c.numero)
  );

-- Forçar origem_api=meta nas conversas de campanhas template (para futuros webhooks bater)
UPDATE conversas
SET origem_api = 'meta'
WHERE fromme = true
  AND campanha_id IS NOT NULL
  AND tipo_mensagem = 'template'
  AND origem_api <> 'meta'
  AND created_at > now() - interval '7 days';