ALTER TABLE public.diagnostico_respostas
ADD COLUMN IF NOT EXISTS curva_abc JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.diagnostico_respostas.curva_abc IS
'Array de produtos com {nome, receita_mensal, custo_unitario, qtd_vendas_mes, curva (A/B/C), pct_receita, pct_acumulado}';