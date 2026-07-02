
CREATE TABLE IF NOT EXISTS public.planos_acao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  meta_mensal numeric,
  prazo_meses int,
  sdrs int,
  closers int,
  engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_acao TO authenticated;
GRANT ALL ON public.planos_acao TO service_role;

ALTER TABLE public.planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own action plan"
ON public.planos_acao FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_planos_acao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planos_acao_updated_at ON public.planos_acao;
CREATE TRIGGER trg_planos_acao_updated_at
BEFORE UPDATE ON public.planos_acao
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_planos_acao();
