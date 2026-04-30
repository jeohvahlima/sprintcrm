
-- ============================================================
-- 1) PERGUNTAS PERSONALIZADAS POR SEGMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diagnostico_perguntas_segmento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento text NOT NULL,
  alavanca_id uuid NOT NULL REFERENCES public.diagnostico_alavancas(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  pergunta text NOT NULL,
  peso integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diag_perg_seg ON public.diagnostico_perguntas_segmento(segmento, alavanca_id, ordem);
ALTER TABLE public.diagnostico_perguntas_segmento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalogo perguntas seg visivel autenticados" ON public.diagnostico_perguntas_segmento;
CREATE POLICY "Catalogo perguntas seg visivel autenticados"
  ON public.diagnostico_perguntas_segmento FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 2) DORES, DESEJOS, SWOT (respostas abertas no diagnóstico)
-- ============================================================
ALTER TABLE public.diagnostico_respostas
  ADD COLUMN IF NOT EXISTS principal_dor text,
  ADD COLUMN IF NOT EXISTS principal_desejo text,
  ADD COLUMN IF NOT EXISTS o_que_travou text,
  ADD COLUMN IF NOT EXISTS meta_faturamento numeric,
  ADD COLUMN IF NOT EXISTS faturamento_atual numeric,
  ADD COLUMN IF NOT EXISTS prazo_meta_meses integer,
  ADD COLUMN IF NOT EXISTS swot_forcas text,
  ADD COLUMN IF NOT EXISTS swot_fraquezas text,
  ADD COLUMN IF NOT EXISTS swot_oportunidades text,
  ADD COLUMN IF NOT EXISTS swot_ameacas text,
  ADD COLUMN IF NOT EXISTS observacoes_alavanca jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS gargalos_detectados jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- 3) GARGALOS CORRIGIDOS — acompanhamento toggle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diagnostico_gargalos_corrigidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  diagnostico_id uuid REFERENCES public.diagnostico_respostas(id) ON DELETE CASCADE,
  gargalo_key text NOT NULL,
  gargalo_titulo text NOT NULL,
  alavanca_id uuid REFERENCES public.diagnostico_alavancas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','corrigido')),
  evidencia text,
  corrigido_em timestamptz,
  corrigido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostico_id, gargalo_key)
);
CREATE INDEX IF NOT EXISTS idx_gargalos_company ON public.diagnostico_gargalos_corrigidos(company_id, status);
ALTER TABLE public.diagnostico_gargalos_corrigidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gargalos por empresa - select" ON public.diagnostico_gargalos_corrigidos;
CREATE POLICY "Gargalos por empresa - select"
  ON public.diagnostico_gargalos_corrigidos FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

DROP POLICY IF EXISTS "Gargalos por empresa - insert" ON public.diagnostico_gargalos_corrigidos;
CREATE POLICY "Gargalos por empresa - insert"
  ON public.diagnostico_gargalos_corrigidos FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

DROP POLICY IF EXISTS "Gargalos por empresa - update" ON public.diagnostico_gargalos_corrigidos;
CREATE POLICY "Gargalos por empresa - update"
  ON public.diagnostico_gargalos_corrigidos FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

DROP POLICY IF EXISTS "Gargalos por empresa - delete" ON public.diagnostico_gargalos_corrigidos;
CREATE POLICY "Gargalos por empresa - delete"
  ON public.diagnostico_gargalos_corrigidos FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.get_user_company_ids()));

DROP TRIGGER IF EXISTS trg_garg_updated_at ON public.diagnostico_gargalos_corrigidos;
CREATE TRIGGER trg_garg_updated_at BEFORE UPDATE ON public.diagnostico_gargalos_corrigidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) BENCHMARKS por segmento — popular para clínicas, advocacia, financeiro, imobiliária, educação
-- ============================================================
INSERT INTO public.wmi_benchmarks (segmento, metric_key, metric_label, market_average, unit) VALUES
-- Clínicas
('clinica_medica',     'no_show_rate',       'Taxa de no-show em consultas',          22, '%'),
('clinica_medica',     'retention_rate',     'Taxa de retorno de pacientes (12m)',    58, '%'),
('clinica_medica',     'win_rate',           'Conversão lead→agendamento',           35, '%'),
('clinica_medica',     'cycle_days',         'Tempo médio até 1ª consulta',           7, 'dias'),
('clinica_odontologica','no_show_rate',      'Taxa de no-show em consultas',          25, '%'),
('clinica_odontologica','win_rate',          'Conversão orçamento→tratamento',       42, '%'),
('clinica_odontologica','cycle_days',        'Ciclo orçamento → fechamento',          12, 'dias'),
('clinica_odontologica','retention_rate',    'Taxa de retorno (12m)',                  55, '%'),
('clinica_estetica',   'no_show_rate',       'Taxa de no-show',                        18, '%'),
('clinica_estetica',   'win_rate',           'Conversão avaliação→procedimento',      48, '%'),
('clinica_estetica',   'cycle_days',         'Ciclo avaliação → procedimento',         5, 'dias'),
('clinica_estetica',   'recompra_rate',      'Taxa de recompra (6m)',                  62, '%'),

-- Advocacia
('advocacia',          'win_rate',           'Conversão consulta→contrato',           38, '%'),
('advocacia',          'cycle_days',         'Ciclo consulta→assinatura contrato',    14, 'dias'),
('advocacia',          'indicacao_rate',     '% de novos casos por indicação',         45, '%'),
('advocacia',          'ticket_medio',       'Honorário médio por contrato',        4500, 'BRL'),
('advocacia',          'followup_speed_min', 'Tempo de resposta a 1º contato',        25, 'min'),

-- Financeiro
('correspondente_bancario','win_rate',       'Conversão proposta→contratação',        28, '%'),
('correspondente_bancario','cycle_days',     'Ciclo proposta→liberação',              10, 'dias'),
('correspondente_bancario','approval_rate',  'Taxa de aprovação em banco',            55, '%'),
('consorcio',          'win_rate',           'Conversão lead→adesão',                 22, '%'),
('consorcio',          'cycle_days',         'Ciclo lead→assinatura',                 18, 'dias'),
('corretora_seguros',  'win_rate',           'Conversão cotação→apólice',             32, '%'),
('corretora_seguros',  'cycle_days',         'Ciclo cotação→emissão',                  7, 'dias'),
('corretora_seguros',  'retention_rate',     'Renovação anual',                        78, '%'),

-- Imobiliária
('imobiliaria',        'win_rate',           'Conversão visita→proposta',             18, '%'),
('imobiliaria',        'cycle_days',         'Ciclo lead→escritura',                  62, 'dias'),
('imobiliaria',        'no_show_rate',       'No-show em visitas',                    28, '%'),

-- Educação
('educacao',           'win_rate',           'Conversão lead→matrícula',              24, '%'),
('educacao',           'cycle_days',         'Ciclo lead→matrícula',                  21, 'dias'),
('educacao',           'evasao_rate',        'Taxa de evasão (semestre)',             18, '%'),
('educacao',           'recompra_rate',      'Taxa de recompra (próximo módulo)',     52, '%')

ON CONFLICT DO NOTHING;

-- ============================================================
-- 5) PERGUNTAS PERSONALIZADAS por segmento
-- Usa as 5 alavancas existentes (numero 1..5)
-- ============================================================
DO $$
DECLARE
  v_alav_1 uuid; -- Captação
  v_alav_2 uuid; -- Conversão
  v_alav_3 uuid; -- Fidelização/LTV
  v_alav_4 uuid; -- Equipe/Experiência
  v_alav_5 uuid; -- Crescimento
BEGIN
  SELECT id INTO v_alav_1 FROM public.diagnostico_alavancas WHERE numero = 1;
  SELECT id INTO v_alav_2 FROM public.diagnostico_alavancas WHERE numero = 2;
  SELECT id INTO v_alav_3 FROM public.diagnostico_alavancas WHERE numero = 3;
  SELECT id INTO v_alav_4 FROM public.diagnostico_alavancas WHERE numero = 4;
  SELECT id INTO v_alav_5 FROM public.diagnostico_alavancas WHERE numero = 5;

  -- CLÍNICAS
  INSERT INTO public.diagnostico_perguntas_segmento (segmento, alavanca_id, ordem, pergunta) VALUES
  ('clinica_medica', v_alav_1, 1, 'Você tem campanhas ativas para captar pacientes por convênio + particular?'),
  ('clinica_medica', v_alav_1, 2, 'Tem parcerias com clínicas, farmácias ou empresas para indicações?'),
  ('clinica_medica', v_alav_2, 1, 'Você confirma a consulta automaticamente 24h e 2h antes para reduzir no-show?'),
  ('clinica_medica', v_alav_2, 2, 'Tem fluxo automático para reagendar pacientes que faltaram?'),
  ('clinica_medica', v_alav_3, 1, 'Você dispara lembretes de retorno após X dias (acompanhamento clínico)?'),
  ('clinica_medica', v_alav_3, 2, 'Tem programa de fidelização ou plano recorrente para pacientes ativos?'),
  ('clinica_medica', v_alav_4, 1, 'Sua recepção tem script padronizado de atendimento humanizado?'),
  ('clinica_odontologica', v_alav_2, 1, 'Você tem fluxo de follow-up para orçamentos não fechados em 7/15/30 dias?'),
  ('clinica_odontologica', v_alav_2, 2, 'Confirma consulta automaticamente para reduzir no-show?'),
  ('clinica_odontologica', v_alav_3, 1, 'Tem campanha de retorno para limpeza/manutenção a cada 6 meses?'),
  ('clinica_estetica', v_alav_1, 1, 'Capta leads via Instagram/Meta Ads com landing pages segmentadas por procedimento?'),
  ('clinica_estetica', v_alav_3, 1, 'Tem programa de pacotes/recorrência para procedimentos contínuos?'),

  -- ADVOCACIA
  ('advocacia', v_alav_1, 1, 'Tem estratégia ativa para gerar indicações de clientes atendidos?'),
  ('advocacia', v_alav_1, 2, 'Capta casos por canais digitais (Google, redes sociais, blog jurídico)?'),
  ('advocacia', v_alav_2, 1, 'Responde primeiro contato em menos de 30 minutos?'),
  ('advocacia', v_alav_2, 2, 'Tem proposta padronizada de honorários (não personaliza do zero a cada cliente)?'),
  ('advocacia', v_alav_2, 3, 'Faz follow-up estruturado em consultas que não viraram contrato?'),
  ('advocacia', v_alav_3, 1, 'Mantém comunicação ativa com cliente durante o andamento do processo?'),
  ('advocacia', v_alav_3, 2, 'Oferece outros serviços jurídicos para clientes da carteira (cross-sell)?'),
  ('advocacia', v_alav_4, 1, 'Tem advogado dedicado a captação/comercial separado da operação jurídica?'),

  -- FINANCEIRO (correspondente, consórcio, seguros)
  ('correspondente_bancario', v_alav_1, 1, 'Capta leads de consignado/FGTS/imobiliário com campanhas segmentadas?'),
  ('correspondente_bancario', v_alav_2, 1, 'Tem esteira de simulação→análise→contratação medindo conversão por etapa?'),
  ('correspondente_bancario', v_alav_2, 2, 'Faz follow-up automático em propostas que ficaram pendentes no banco?'),
  ('correspondente_bancario', v_alav_3, 1, 'Trabalha portabilidade ativa em clientes da base?'),
  ('consorcio', v_alav_2, 1, 'Tem fluxo de nutrição para leads que não compraram na primeira reunião?'),
  ('consorcio', v_alav_3, 1, 'Faz reativação ativa de clientes que pagaram parcelas e nunca contemplaram?'),
  ('corretora_seguros', v_alav_3, 1, 'Tem processo automático de renovação 60 dias antes do vencimento?'),
  ('corretora_seguros', v_alav_3, 2, 'Faz cross-sell de produtos (auto + vida + residencial) na carteira?'),

  -- IMOBILIÁRIA
  ('imobiliaria', v_alav_1, 1, 'Capta leads via portais (Zap, Viva Real) + tráfego pago próprio?'),
  ('imobiliaria', v_alav_2, 1, 'Confirma visitas 24h antes para reduzir no-show?'),
  ('imobiliaria', v_alav_2, 2, 'Tem corretor escalado especificamente para qualificação (SDR) antes de mandar para o closer?'),
  ('imobiliaria', v_alav_3, 1, 'Mantém relacionamento com clientes pós-venda para gerar indicações?'),

  -- EDUCAÇÃO
  ('educacao', v_alav_1, 1, 'Capta alunos via tráfego pago + parcerias escolares/empresariais?'),
  ('educacao', v_alav_2, 1, 'Tem fluxo de matrícula automatizado (sem gargalo administrativo)?'),
  ('educacao', v_alav_3, 1, 'Tem campanha ativa de retenção para evitar evasão no meio do curso?'),
  ('educacao', v_alav_3, 2, 'Vende próximo módulo/curso para alunos formandos (LTV)?')
  ON CONFLICT DO NOTHING;
END $$;
