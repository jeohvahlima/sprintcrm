-- ========== TABELA: legal_deadlines (prazos processuais) ==========
CREATE TABLE IF NOT EXISTS public.legal_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT NOT NULL,
  data_inicial DATE NOT NULL,
  prazo_dias INTEGER NOT NULL DEFAULT 15,
  contagem TEXT NOT NULL DEFAULT 'uteis' CHECK (contagem IN ('uteis','corridos')),
  prazo_dobrado BOOLEAN NOT NULL DEFAULT false,
  data_limite DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','cumprido','perdido','cancelado')),
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  alerta_d7 BOOLEAN NOT NULL DEFAULT true,
  alerta_d3 BOOLEAN NOT NULL DEFAULT true,
  alerta_d1 BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  cumprido_em TIMESTAMPTZ,
  cumprido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_deadlines_company ON public.legal_deadlines(company_id);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_process ON public.legal_deadlines(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_data_limite ON public.legal_deadlines(data_limite);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_status ON public.legal_deadlines(status);

ALTER TABLE public.legal_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view deadlines of their company"
  ON public.legal_deadlines FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users insert deadlines for their company"
  ON public.legal_deadlines FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users update deadlines of their company"
  ON public.legal_deadlines FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users delete deadlines of their company"
  ON public.legal_deadlines FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ========== TABELA: legal_calculations (histórico de cálculos) ==========
CREATE TABLE IF NOT EXISTS public.legal_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('honorarios','custas','correcao','trabalhista','acordo','outro')),
  descricao TEXT,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  valor_total NUMERIC,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_calculations_company ON public.legal_calculations(company_id);
CREATE INDEX IF NOT EXISTS idx_legal_calculations_process ON public.legal_calculations(legal_process_id);

ALTER TABLE public.legal_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view calculations of their company"
  ON public.legal_calculations FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users insert calculations for their company"
  ON public.legal_calculations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users delete calculations of their company"
  ON public.legal_calculations FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ========== TABELA: legal_holidays (feriados forenses) ==========
CREATE TABLE IF NOT EXISTS public.legal_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  abrangencia TEXT NOT NULL DEFAULT 'nacional' CHECK (abrangencia IN ('nacional','estadual','municipal','forense')),
  uf TEXT,
  comarca TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(data, descricao, abrangencia, uf, comarca)
);

CREATE INDEX IF NOT EXISTS idx_legal_holidays_data ON public.legal_holidays(data);

ALTER TABLE public.legal_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read holidays"
  ON public.legal_holidays FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins manage holidays"
  ON public.legal_holidays FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Pré-popular feriados nacionais 2026
INSERT INTO public.legal_holidays (data, descricao, abrangencia) VALUES
  ('2026-01-01','Confraternização Universal','nacional'),
  ('2026-02-16','Carnaval','forense'),
  ('2026-02-17','Carnaval','forense'),
  ('2026-02-18','Quarta-feira de Cinzas','forense'),
  ('2026-04-03','Sexta-feira Santa','nacional'),
  ('2026-04-21','Tiradentes','nacional'),
  ('2026-05-01','Dia do Trabalho','nacional'),
  ('2026-06-04','Corpus Christi','forense'),
  ('2026-09-07','Independência','nacional'),
  ('2026-10-12','Nossa Senhora Aparecida','nacional'),
  ('2026-11-02','Finados','nacional'),
  ('2026-11-15','Proclamação da República','nacional'),
  ('2026-12-08','Imaculada Conceição','forense'),
  ('2026-12-19','Recesso Forense Início','forense'),
  ('2026-12-20','Recesso Forense','forense'),
  ('2026-12-21','Recesso Forense','forense'),
  ('2026-12-22','Recesso Forense','forense'),
  ('2026-12-23','Recesso Forense','forense'),
  ('2026-12-24','Véspera de Natal','forense'),
  ('2026-12-25','Natal','nacional'),
  ('2026-12-26','Recesso Forense','forense'),
  ('2026-12-29','Recesso Forense','forense'),
  ('2026-12-30','Recesso Forense','forense'),
  ('2026-12-31','Véspera de Ano Novo','forense')
ON CONFLICT DO NOTHING;

-- ========== FUNÇÃO: count_business_days ==========
CREATE OR REPLACE FUNCTION public.count_business_days(p_start DATE, p_end DATE)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_curr DATE := p_start;
BEGIN
  WHILE v_curr <= p_end LOOP
    IF EXTRACT(DOW FROM v_curr) NOT IN (0, 6)
       AND NOT EXISTS (SELECT 1 FROM public.legal_holidays WHERE data = v_curr) THEN
      v_count := v_count + 1;
    END IF;
    v_curr := v_curr + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ========== FUNÇÃO: calculate_deadline_date ==========
CREATE OR REPLACE FUNCTION public.calculate_deadline_date(
  p_inicio DATE,
  p_dias INTEGER,
  p_contagem TEXT DEFAULT 'uteis',
  p_dobrado BOOLEAN DEFAULT false
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_dias INTEGER;
  v_curr DATE := p_inicio;
  v_added INTEGER := 0;
BEGIN
  v_total_dias := p_dias * (CASE WHEN p_dobrado THEN 2 ELSE 1 END);

  IF p_contagem = 'corridos' THEN
    RETURN p_inicio + v_total_dias;
  END IF;

  -- Dias úteis: avança pulando finais de semana e feriados
  WHILE v_added < v_total_dias LOOP
    v_curr := v_curr + 1;
    IF EXTRACT(DOW FROM v_curr) NOT IN (0, 6)
       AND NOT EXISTS (SELECT 1 FROM public.legal_holidays WHERE data = v_curr) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN v_curr;
END;
$$;

-- ========== TRIGGER: cálculo automático de data_limite ==========
CREATE OR REPLACE FUNCTION public.tg_legal_deadline_calc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.data_limite := public.calculate_deadline_date(
    NEW.data_inicial,
    NEW.prazo_dias,
    NEW.contagem,
    NEW.prazo_dobrado
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_deadlines_calc ON public.legal_deadlines;
CREATE TRIGGER trg_legal_deadlines_calc
  BEFORE INSERT OR UPDATE OF data_inicial, prazo_dias, contagem, prazo_dobrado
  ON public.legal_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_legal_deadline_calc();