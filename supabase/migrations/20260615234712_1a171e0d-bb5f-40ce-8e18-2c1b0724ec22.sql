-- Garantir acesso da API a tabela agendas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendas TO authenticated;
GRANT ALL ON public.agendas TO service_role;
GRANT SELECT ON public.agendas TO anon;

-- Adicionar campo de senha de acesso público
ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS senha_acesso TEXT;