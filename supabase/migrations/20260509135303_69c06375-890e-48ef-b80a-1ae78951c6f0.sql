-- Renomeia etapas do funil "Follow-up" para refletir a cadência da Esteira
UPDATE public.etapas e
SET nome = CASE p.posicao
    WHEN 0 THEN 'F1 — D+1'
    WHEN 1 THEN 'F2 — D+3'
    WHEN 2 THEN 'F3 — D+7'
    WHEN 3 THEN 'F4 — D+14'
    WHEN 4 THEN 'F5 — D+30'
    ELSE e.nome
  END,
  cor = CASE p.posicao
    WHEN 0 THEN '#22C55E'
    WHEN 1 THEN '#3B82F6'
    WHEN 2 THEN '#F59E0B'
    WHEN 3 THEN '#A855F7'
    WHEN 4 THEN '#EF4444'
    ELSE e.cor
  END
FROM (SELECT id, posicao FROM public.etapas) p
WHERE p.id = e.id
  AND e.funil_id IN (SELECT id FROM public.funis WHERE nome = 'Follow-up')
  AND e.posicao BETWEEN 0 AND 4;