-- 1) ICP Intelligence: campos extras em icp_profiles
ALTER TABLE public.icp_profiles
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS niche TEXT,
  ADD COLUMN IF NOT EXISTS intelligence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fit_score INTEGER,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- 2) Revenue Mix Engine: cenários (já existe sales_machine_configs) + ofertas vinculadas
CREATE TABLE IF NOT EXISTS public.revenue_machine_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  config_id UUID NOT NULL REFERENCES public.sales_machine_configs(id) ON DELETE CASCADE,
  produto_servico_id UUID REFERENCES public.produtos_servicos(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  ticket NUMERIC NOT NULL DEFAULT 0,
  margin_pct NUMERIC NOT NULL DEFAULT 50,
  target_sales INTEGER NOT NULL DEFAULT 0,
  lead_to_meeting_rate NUMERIC NOT NULL DEFAULT 15,
  meeting_show_rate NUMERIC NOT NULL DEFAULT 70,
  win_rate NUMERIC NOT NULL DEFAULT 25,
  cac NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_machine_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read offers"
  ON public.revenue_machine_offers FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "company members insert offers"
  ON public.revenue_machine_offers FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "company members update offers"
  ON public.revenue_machine_offers FOR UPDATE
  USING (company_id = public.get_my_company_id());

CREATE POLICY "company members delete offers"
  ON public.revenue_machine_offers FOR DELETE
  USING (company_id = public.get_my_company_id());

CREATE INDEX IF NOT EXISTS idx_revenue_offers_config ON public.revenue_machine_offers(config_id);
CREATE INDEX IF NOT EXISTS idx_revenue_offers_company ON public.revenue_machine_offers(company_id);

CREATE TRIGGER trg_revenue_offers_updated
  BEFORE UPDATE ON public.revenue_machine_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();