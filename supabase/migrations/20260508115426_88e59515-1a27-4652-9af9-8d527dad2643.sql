ALTER TABLE public.diagnostico_respostas
  ADD COLUMN IF NOT EXISTS qtd_sdrs integer,
  ADD COLUMN IF NOT EXISTS qtd_closers integer,
  ADD COLUMN IF NOT EXISTS custo_sdr_mes numeric,
  ADD COLUMN IF NOT EXISTS custo_closer_mes numeric,
  ADD COLUMN IF NOT EXISTS custo_estrutura_mes numeric,
  ADD COLUMN IF NOT EXISTS prod_sdr_leads_dia numeric,
  ADD COLUMN IF NOT EXISTS prod_closer_reunioes_dia numeric,
  ADD COLUMN IF NOT EXISTS prod_closer_vendas_mes numeric;