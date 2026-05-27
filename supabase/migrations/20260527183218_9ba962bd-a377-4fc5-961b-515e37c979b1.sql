
-- Para cada lead_id com múltiplas linhas, manter apenas a "melhor" (mais tentativas,
-- depois mais recente) e remover as duplicatas vazias.
WITH ranked AS (
  SELECT
    id,
    lead_id,
    row_number() OVER (
      PARTITION BY company_id, lead_id
      ORDER BY
        COALESCE(attempts_count, 0) DESC,
        CASE WHEN outcome IS NOT NULL AND outcome <> '' AND outcome <> 'pendente' THEN 0 ELSE 1 END,
        COALESCE(last_attempt_at, updated_at) DESC NULLS LAST
    ) AS rn
  FROM public.pre_sdr_analyses
  WHERE lead_id IS NOT NULL
)
DELETE FROM public.pre_sdr_analyses p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1
  AND COALESCE(p.attempts_count, 0) = 0
  AND (p.outcome IS NULL OR p.outcome = '' OR p.outcome = 'pendente');
