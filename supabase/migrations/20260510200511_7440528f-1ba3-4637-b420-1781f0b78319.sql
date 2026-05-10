
-- ============ Tabela: phase_north_metrics ============
CREATE TABLE IF NOT EXISTS public.phase_north_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase TEXT NOT NULL CHECK (fase IN ('validacao','tracao','escala')),
  metrica_key TEXT NOT NULL,
  label TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT,
  meta_min NUMERIC,
  meta_ideal NUMERIC,
  modulo_origem TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(fase, metrica_key)
);
ALTER TABLE public.phase_north_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "north_metrics_read_all" ON public.phase_north_metrics FOR SELECT USING (true);

-- ============ Tabela: meeting_rhythm_templates ============
CREATE TABLE IF NOT EXISTS public.meeting_rhythm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('D1','S1','M1','T1')),
  label TEXT NOT NULL,
  duracao_min INT NOT NULL DEFAULT 30,
  periodicidade TEXT NOT NULL,
  pauta_md TEXT,
  participantes_sugeridos TEXT,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo)
);
ALTER TABLE public.meeting_rhythm_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rhythm_templates_read_all" ON public.meeting_rhythm_templates FOR SELECT USING (true);

-- ============ Tabela: segment_benchmarks ============
CREATE TABLE IF NOT EXISTS public.segment_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento TEXT NOT NULL UNIQUE,
  avg_score NUMERIC NOT NULL DEFAULT 0,
  top10_score NUMERIC NOT NULL DEFAULT 0,
  sample_size INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.segment_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmarks_read_authenticated" ON public.segment_benchmarks
  FOR SELECT TO authenticated USING (sample_size >= 5);

-- ============ RPC: GROW Score Consolidado ============
CREATE OR REPLACE FUNCTION public.get_grow_score_consolidated(p_company_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_base JSONB;
  v_prosp INT := 0;
  v_proc INT := 0;
  v_disc INT := 0;
  v_auto INT := 0;
  v_crm INT := 0;
  v_ai INT := 0;
  v_playbook INT := 0;
  v_playbook_total INT := 0;
  v_playbook_ok INT := 0;
  v_ai_total INT := 0;
  v_ai_active INT := 0;
  v_grow_score NUMERIC := 0;
  v_selo TEXT;
  v_fase TEXT;
BEGIN
  v_company_id := COALESCE(p_company_id, get_my_company_id());
  IF v_company_id IS NULL THEN RETURN jsonb_build_object('error','no_company'); END IF;

  -- Base score (4 pilares originais)
  v_base := public.get_commercial_maturity_score(v_company_id);
  v_prosp := COALESCE((v_base->'pillars'->'prospeccao'->>'score')::INT, 0);
  v_proc  := COALESCE((v_base->'pillars'->'processos'->>'score')::INT, 0);
  v_disc  := COALESCE((v_base->'pillars'->'discador'->>'score')::INT, 0);
  v_auto  := COALESCE((v_base->'pillars'->'automacao'->>'score')::INT, 0);

  -- CRM Maturity
  BEGIN
    SELECT COALESCE(score,0) INTO v_crm FROM public.crm_maturity WHERE company_id = v_company_id;
  EXCEPTION WHEN OTHERS THEN v_crm := 0; END;

  -- AI Maturity (cada agente ativo conta)
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE value::text <> '"desligado"'),
      COUNT(*)
    INTO v_ai_active, v_ai_total
    FROM public.ai_maturity, jsonb_each(agentes)
    WHERE company_id = v_company_id;
    IF v_ai_total > 0 THEN v_ai := ROUND((v_ai_active::NUMERIC / v_ai_total) * 100); END IF;
  EXCEPTION WHEN OTHERS THEN v_ai := 0; END;

  -- Playbook
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pronto','ativo')),
      COUNT(*)
    INTO v_playbook_ok, v_playbook_total
    FROM public.playbook_checklist WHERE company_id = v_company_id;
    IF v_playbook_total > 0 THEN v_playbook := ROUND((v_playbook_ok::NUMERIC / v_playbook_total) * 100); END IF;
  EXCEPTION WHEN OTHERS THEN v_playbook := 0; END;

  -- Fase do negócio
  BEGIN
    SELECT fase INTO v_fase FROM public.business_context WHERE company_id = v_company_id;
  EXCEPTION WHEN OTHERS THEN v_fase := NULL; END;

  -- GROW Score ponderado (escalas 0-25 para pilares já = total 100, normalizados):
  -- Pilares originais 60% + CRM 15% + IA 10% + Playbook 15%
  v_grow_score :=
      (v_prosp + v_proc + v_disc + v_auto) * 0.60  -- 0-100 * 0.6
    + v_crm * 0.15
    + v_ai * 0.10
    + v_playbook * 0.15;

  v_grow_score := LEAST(100, GREATEST(0, ROUND(v_grow_score)));

  v_selo := CASE
    WHEN v_grow_score >= 85 THEN 'referencia'
    WHEN v_grow_score >= 65 THEN 'maduro'
    WHEN v_grow_score >= 40 THEN 'estruturado'
    ELSE 'iniciante'
  END;

  RETURN jsonb_build_object(
    'grow_score', v_grow_score,
    'selo', v_selo,
    'fase', v_fase,
    'pillars', jsonb_build_object(
      'prospeccao', v_prosp,
      'processos', v_proc,
      'discador', v_disc,
      'automacao', v_auto,
      'crm', v_crm,
      'ia', v_ai,
      'playbook', v_playbook
    ),
    'calculated_at', now()
  );
END;
$$;

-- ============ RPC: refresh_segment_benchmarks ============
CREATE OR REPLACE FUNCTION public.refresh_segment_benchmarks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.segment_benchmarks;
  INSERT INTO public.segment_benchmarks (segmento, avg_score, top10_score, sample_size, updated_at)
  SELECT
    c.segmento,
    ROUND(AVG((public.get_grow_score_consolidated(c.id)->>'grow_score')::NUMERIC), 1) AS avg_score,
    ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY (public.get_grow_score_consolidated(c.id)->>'grow_score')::NUMERIC), 1) AS top10_score,
    COUNT(*) AS sample_size,
    now()
  FROM public.companies c
  WHERE c.segmento IS NOT NULL AND c.segmento <> ''
  GROUP BY c.segmento
  HAVING COUNT(*) >= 5;
END;
$$;

-- ============ Seed: phase_north_metrics ============
INSERT INTO public.phase_north_metrics (fase, metrica_key, label, descricao, unidade, meta_min, meta_ideal, modulo_origem, ordem) VALUES
-- Validação
('validacao','entrevistas_mes','Entrevistas com clientes (mês)','Conversas reais com o ICP para validar dor e solução','qtd',10,30,'prospeccao',1),
('validacao','pmf_score','PMF Score (Sean Ellis)','% de clientes que ficariam "muito decepcionados" sem o produto','%',40,60,'analytics',2),
('validacao','cac_payback','CAC Payback','Meses para recuperar o custo de aquisição','meses',12,6,'analytics',3),
('validacao','taxa_conversao_diagnostico','Conversão Diagnóstico → Proposta','Validação da dor antes de vender','%',20,40,'funil',4),
('validacao','tempo_ciclo','Ciclo de Venda Médio','Tempo entre primeiro contato e fechamento','dias',60,30,'funil',5),
-- Tração
('tracao','leads_mes','Leads qualificados (MQL) por mês','Volume previsível de demanda','qtd',150,500,'prospeccao',1),
('tracao','taxa_mql_sql','Taxa MQL → SQL','Qualidade da prospecção','%',25,40,'prospeccao',2),
('tracao','taxa_sql_proposta','Taxa SQL → Proposta','Eficiência do SDR/Closer','%',40,60,'funil',3),
('tracao','win_rate','Win Rate','Taxa de fechamento sobre propostas','%',20,35,'funil',4),
('tracao','ltv_cac','LTV / CAC','Saúde da unidade econômica','razão',3,5,'analytics',5),
('tracao','mrr_growth','MRR Growth (m/m)','Crescimento mensal de receita recorrente','%',10,20,'analytics',6),
-- Escala
('escala','nrr','NRR — Net Revenue Retention','Expansão da base atual','%',100,115,'analytics',1),
('escala','grr','GRR — Gross Revenue Retention','Retenção bruta (sem expansão)','%',85,95,'analytics',2),
('escala','sales_velocity','Sales Velocity','(SQL × Ticket × Win Rate) / Ciclo','R$/dia',5000,15000,'funil',3),
('escala','rampup_medio','Ramp-up Médio (novos vendedores)','Tempo até atingir 100% da meta','dias',90,60,'rh',4),
('escala','quota_attainment','Quota Attainment','% do time batendo meta','%',60,80,'analytics',5),
('escala','cac_payback_escala','CAC Payback','Meta mais agressiva em escala','meses',9,4,'analytics',6)
ON CONFLICT (fase, metrica_key) DO NOTHING;

-- ============ Seed: meeting_rhythm_templates ============
INSERT INTO public.meeting_rhythm_templates (tipo, label, duracao_min, periodicidade, pauta_md, participantes_sugeridos, ordem) VALUES
('D1','Daily Comercial (D1)',15,'Diária — 09h00',
'## Daily Comercial — 15 minutos

**Por pessoa, 90 segundos cada:**
1. ✅ O que fechei/avancei ontem
2. 🎯 O que vou atacar hoje (3 prioridades)
3. 🚧 Bloqueios que preciso de ajuda

**Gestor revisa em tela:**
- Pipeline de hoje (chamadas, reuniões agendadas)
- Top 3 oportunidades em fechamento
- 1 KPI do dia (ex: nº de discagens, agendamentos)

**Regra de ouro:** sem debate. Bloqueio vira reunião 1:1 depois.','Time comercial + Gestor',1),

('S1','Semanal Comercial (S1)',60,'Semanal — Segunda 10h00',
'## Semanal Comercial — 60 minutos

### 1. Revisão de KPIs da semana passada (15min)
- Leads gerados / Qualificados / Convertidos
- Taxa de conversão por etapa do funil
- Receita fechada vs meta

### 2. Análise de perdas e ganhos (15min)
- 3 negócios perdidos: por quê? Que aprendizado?
- 3 negócios fechados: que padrão se repete?

### 3. Pipeline da semana (20min)
- Top 10 oportunidades em aberto
- Próximos passos definidos para cada uma
- Risco de escorregamento

### 4. Foco da semana (10min)
- 1 prioridade comercial (atingir X% de SQL, fechar Y, etc.)
- Quem é responsável por cada frente','Time comercial + Gestor + Marketing',2),

('M1','Mensal de Resultado (M1)',90,'Mensal — Última sexta',
'## Mensal de Resultado — 90 minutos

### 1. Fechamento financeiro do mês (20min)
- Receita realizada vs meta
- MRR / Novos clientes / Churn
- Ticket médio e mix de produtos

### 2. Forecast do próximo mês (20min)
- Pipeline ponderado por probabilidade
- Risco vs garantido
- Ações para atingir meta

### 3. Pessoas (20min)
- Ranking individual (atingimento, atividades, qualidade)
- Quem precisa de ajuda / treinamento
- Reconhecimento público

### 4. Processos e gargalos (20min)
- O que tirou tempo do time?
- Que automação resolveria?
- Decisões a tomar

### 5. Compromissos do próximo mês (10min)
- 3 OKRs do time
- Responsáveis claros','Time comercial completo + CEO/Diretor',3),

('T1','Trimestral Estratégico (T1)',180,'Trimestral — 1ª semana',
'## Trimestral Estratégico — 3 horas

### 1. Revisão do trimestre (40min)
- OKRs: o que bateu, o que não bateu, por quê
- Aprendizados estratégicos
- Movimentos do mercado

### 2. Fase do negócio (30min)
- Estamos em Validação / Tração / Escala?
- Métricas-norte da fase: status
- Mudança de fase no horizonte?

### 3. ICP e Produto (30min)
- ICP continua o mesmo?
- Esteira de produtos: front/back/high-end performando?
- Gaps identificados

### 4. Pessoas e estrutura (30min)
- Quem promover / contratar / desligar
- Plano de carreira ativo
- Cultura comercial

### 5. Plano dos próximos 90 dias (50min)
- 3 OKRs do trimestre
- Iniciativas estratégicas (2-3 grandes apostas)
- Métricas de acompanhamento','C-Level + Gestor Comercial + Líderes',4)
ON CONFLICT (tipo) DO NOTHING;
