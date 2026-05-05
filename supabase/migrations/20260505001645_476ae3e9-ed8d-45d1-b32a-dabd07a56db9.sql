ALTER TABLE public.diagnostico_respostas
  ADD COLUMN IF NOT EXISTS ticket_medio numeric,
  ADD COLUMN IF NOT EXISTS taxa_conversao numeric,
  ADD COLUMN IF NOT EXISTS prospeccoes_dia_atual integer,
  ADD COLUMN IF NOT EXISTS prospeccoes_dia_ideal integer,
  ADD COLUMN IF NOT EXISTS dias_uteis_mes integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS revenue_leak jsonb;