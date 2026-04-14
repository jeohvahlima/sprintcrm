UPDATE conversas SET mensagem = (
  SELECT COALESCE(
    (SELECT comp->>'text' FROM whatsapp_templates wt, jsonb_array_elements(wt.components::jsonb) comp WHERE comp->>'type' = 'BODY' AND wt.name = TRIM(BOTH '[]' FROM REPLACE(conversas.mensagem, 'Template: ', '')) AND wt.company_id = conversas.company_id LIMIT 1),
    conversas.mensagem
  )
) WHERE tipo_mensagem = 'template' AND mensagem LIKE '[Template:%'