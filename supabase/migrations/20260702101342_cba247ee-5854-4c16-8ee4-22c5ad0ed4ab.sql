CREATE TABLE public.rotina_categorias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  preset_index integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotina_categorias TO authenticated;
GRANT ALL ON public.rotina_categorias TO service_role;

ALTER TABLE public.rotina_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotina_categorias_select_same_company"
  ON public.rotina_categorias FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "rotina_categorias_insert_same_company"
  ON public.rotina_categorias FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "rotina_categorias_update_same_company"
  ON public.rotina_categorias FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "rotina_categorias_delete_same_company"
  ON public.rotina_categorias FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE INDEX rotina_categorias_company_idx ON public.rotina_categorias(company_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_rotina_categorias()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_rotina_categorias_updated_at
  BEFORE UPDATE ON public.rotina_categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_rotina_categorias();