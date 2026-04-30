
CREATE TABLE IF NOT EXISTS public.sales_machine_diagnostico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  faturamento_atual NUMERIC NOT NULL DEFAULT 0,
  meses_travado INT NOT NULL DEFAULT 0,
  sdrs_atual INT NOT NULL DEFAULT 0,
  closers_atual INT NOT NULL DEFAULT 0,
  ferramentas TEXT[] NOT NULL DEFAULT '{}',
  ticket_medio_atual NUMERIC NOT NULL DEFAULT 0,
  taxa_lead_reuniao_atual NUMERIC NOT NULL DEFAULT 0,
  taxa_show_atual NUMERIC NOT NULL DEFAULT 0,
  taxa_win_atual NUMERIC NOT NULL DEFAULT 0,
  ciclo_dias_atual INT NOT NULL DEFAULT 30,
  atividades JSONB NOT NULL DEFAULT '{}'::jsonb,
  gargalos_observacoes TEXT,
  gargalos_auto JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_faturamento NUMERIC NOT NULL DEFAULT 0,
  prazo_meses INT NOT NULL DEFAULT 6,
  manter_estrutura BOOLEAN NOT NULL DEFAULT true,
  plano_acoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sm_diag_company ON public.sales_machine_diagnostico(company_id);

ALTER TABLE public.sales_machine_diagnostico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_select_own_company" ON public.sales_machine_diagnostico
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY "diag_insert_own_company" ON public.sales_machine_diagnostico
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());
CREATE POLICY "diag_update_own_company" ON public.sales_machine_diagnostico
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id());
CREATE POLICY "diag_delete_own_company" ON public.sales_machine_diagnostico
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE TABLE IF NOT EXISTS public.sales_machine_daily_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  role_type TEXT NOT NULL DEFAULT 'closer',
  leads_prospectados INT NOT NULL DEFAULT 0,
  ligacoes_feitas INT NOT NULL DEFAULT 0,
  mensagens_enviadas INT NOT NULL DEFAULT 0,
  followups INT NOT NULL DEFAULT 0,
  reunioes_agendadas INT NOT NULL DEFAULT 0,
  reunioes_realizadas INT NOT NULL DEFAULT 0,
  oportunidades_abertas INT NOT NULL DEFAULT 0,
  propostas_enviadas INT NOT NULL DEFAULT 0,
  vendas_fechadas INT NOT NULL DEFAULT 0,
  faturamento_gerado NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sm_log_unique ON public.sales_machine_daily_log(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_sm_log_company_date ON public.sales_machine_daily_log(company_id, log_date);

ALTER TABLE public.sales_machine_daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_select_self_or_manager" ON public.sales_machine_daily_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      company_id = public.get_my_company_id()
      AND (
        public.has_role(auth.uid(), 'company_admin')
        OR public.has_role(auth.uid(), 'gestor')
        OR public.has_role(auth.uid(), 'super_admin')
      )
    )
  );

CREATE POLICY "daily_insert_self" ON public.sales_machine_daily_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY "daily_update_self" ON public.sales_machine_daily_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.get_my_company_id());

CREATE POLICY "daily_delete_self" ON public.sales_machine_daily_log
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND company_id = public.get_my_company_id());

CREATE OR REPLACE FUNCTION public.set_updated_at_sm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_sm_diag_updated ON public.sales_machine_diagnostico;
CREATE TRIGGER trg_sm_diag_updated BEFORE UPDATE ON public.sales_machine_diagnostico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_sm();

DROP TRIGGER IF EXISTS trg_sm_log_updated ON public.sales_machine_daily_log;
CREATE TRIGGER trg_sm_log_updated BEFORE UPDATE ON public.sales_machine_daily_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_sm();
