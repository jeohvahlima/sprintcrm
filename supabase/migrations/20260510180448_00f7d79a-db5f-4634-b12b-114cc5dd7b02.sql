-- F2.1: Esteira de Produtos (Front/Back/High End)
CREATE TABLE IF NOT EXISTS public.product_ladder (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('front','back','high_end')),
  nome TEXT NOT NULL,
  descricao TEXT,
  ticket NUMERIC NOT NULL DEFAULT 0,
  ciclo_dias INTEGER DEFAULT 0,
  canal_aquisicao TEXT,
  objetivo TEXT,
  funcao_funil TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_ladder_company ON public.product_ladder(company_id);
CREATE INDEX IF NOT EXISTS idx_product_ladder_tier ON public.product_ladder(tier);

ALTER TABLE public.product_ladder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ladder_select_company" ON public.product_ladder
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "ladder_insert_company" ON public.product_ladder
  FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "ladder_update_company" ON public.product_ladder
  FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "ladder_delete_company" ON public.product_ladder
  FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_product_ladder_updated
  BEFORE UPDATE ON public.product_ladder
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- F2.2: Trilhas de Funis de Marketing (VSL / Social Selling / Isca Paga)
CREATE TABLE IF NOT EXISTS public.marketing_funnel_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  trilha TEXT NOT NULL CHECK (trilha IN ('vsl','social_selling','isca_paga')),
  etapa_key TEXT NOT NULL,
  etapa_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado','em_construcao','ativo')),
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, trilha, etapa_key)
);

CREATE INDEX IF NOT EXISTS idx_mfp_company ON public.marketing_funnel_progress(company_id);

ALTER TABLE public.marketing_funnel_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfp_select_company" ON public.marketing_funnel_progress
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "mfp_insert_company" ON public.marketing_funnel_progress
  FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "mfp_update_company" ON public.marketing_funnel_progress
  FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "mfp_delete_company" ON public.marketing_funnel_progress
  FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_mfp_updated
  BEFORE UPDATE ON public.marketing_funnel_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- F2.3: ICP Estruturado (3 etapas: quem é, dores, gatilhos)
CREATE TABLE IF NOT EXISTS public.icp_structured (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  quem_e JSONB NOT NULL DEFAULT '{}'::jsonb,
  dores JSONB NOT NULL DEFAULT '{}'::jsonb,
  gatilhos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.icp_structured ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icps_select_company" ON public.icp_structured
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "icps_insert_company" ON public.icp_structured
  FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "icps_update_company" ON public.icp_structured
  FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "icps_delete_company" ON public.icp_structured
  FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));

CREATE TRIGGER trg_icps_updated
  BEFORE UPDATE ON public.icp_structured
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();