-- ============= F3.1 SDR specializations =============
CREATE TABLE IF NOT EXISTS public.sdr_specializations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nivel TEXT NOT NULL CHECK (nivel IN ('sdr1','sdr2','sdr3','sdr4')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sdr_spec_company ON public.sdr_specializations(company_id);
ALTER TABLE public.sdr_specializations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdrspec_select" ON public.sdr_specializations FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "sdrspec_insert" ON public.sdr_specializations FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "sdrspec_update" ON public.sdr_specializations FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "sdrspec_delete" ON public.sdr_specializations FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_sdrspec_upd BEFORE UPDATE ON public.sdr_specializations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F3.2 Playbook checklist =============
CREATE TABLE IF NOT EXISTS public.playbook_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado','em_construcao','documentado')),
  link_documento TEXT,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, item_key)
);
ALTER TABLE public.playbook_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbchk_select" ON public.playbook_checklist FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "pbchk_insert" ON public.playbook_checklist FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "pbchk_update" ON public.playbook_checklist FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "pbchk_delete" ON public.playbook_checklist FOR DELETE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_pbchk_upd BEFORE UPDATE ON public.playbook_checklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F3.3 CRM Maturity =============
CREATE TABLE IF NOT EXISTS public.crm_maturity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  criterios JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_maturity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmmat_select" ON public.crm_maturity FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "crmmat_insert" ON public.crm_maturity FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "crmmat_update" ON public.crm_maturity FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_crmmat_upd BEFORE UPDATE ON public.crm_maturity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F3.4 AI Maturity =============
CREATE TABLE IF NOT EXISTS public.ai_maturity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  agentes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_maturity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aimat_select" ON public.ai_maturity FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "aimat_insert" ON public.ai_maturity FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "aimat_update" ON public.ai_maturity FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_aimat_upd BEFORE UPDATE ON public.ai_maturity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F4.1 Commercial HR =============
CREATE TABLE IF NOT EXISTS public.commercial_hr_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  funil_selecao JSONB NOT NULL DEFAULT '{}'::jsonb,
  rampup JSONB NOT NULL DEFAULT '{}'::jsonb,
  remuneracao JSONB NOT NULL DEFAULT '{}'::jsonb,
  retencao JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_hr_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hrcfg_select" ON public.commercial_hr_config FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "hrcfg_insert" ON public.commercial_hr_config FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "hrcfg_update" ON public.commercial_hr_config FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_hrcfg_upd BEFORE UPDATE ON public.commercial_hr_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F4.2 Business Context (fase) =============
CREATE TABLE IF NOT EXISTS public.business_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  fase TEXT CHECK (fase IN ('validacao','tracao','escala')),
  modelo_negocio TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bizctx_select" ON public.business_context FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "bizctx_insert" ON public.business_context FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "bizctx_update" ON public.business_context FOR UPDATE USING (company_id IN (SELECT get_user_company_ids()));
CREATE TRIGGER trg_bizctx_upd BEFORE UPDATE ON public.business_context FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= F4.3 Prescriptive rules (global library) =============
CREATE TABLE IF NOT EXISTS public.prescriptive_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sintoma_key TEXT NOT NULL UNIQUE,
  sintoma_label TEXT NOT NULL,
  causa_provavel TEXT NOT NULL,
  acao_prescrita TEXT NOT NULL,
  modulo_destino TEXT,
  pilar TEXT,
  prioridade INTEGER NOT NULL DEFAULT 50,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptive_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prx_rules_select" ON public.prescriptive_rules FOR SELECT TO authenticated USING (ativo = true);

-- Diagnosis log per company
CREATE TABLE IF NOT EXISTS public.prescriptive_diagnosis_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,
  sintomas_keys TEXT[] NOT NULL DEFAULT '{}',
  acoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptive_diagnosis_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prx_log_select" ON public.prescriptive_diagnosis_log FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));
CREATE POLICY "prx_log_insert" ON public.prescriptive_diagnosis_log FOR INSERT WITH CHECK (company_id IN (SELECT get_user_company_ids()));

-- ============= SEED prescriptive rules =============
INSERT INTO public.prescriptive_rules (sintoma_key, sintoma_label, causa_provavel, acao_prescrita, modulo_destino, pilar, prioridade) VALUES
('leads_nao_atendem','Leads não atendem o telefone','SLA de contato lento (>5min) ou número desconhecido','Implementar SLA <5min via fila automática + WhatsApp antes da ligação','prospeccao','prospeccao',95),
('lead_demora_responder','Leads demoram para responder mensagens','Falta de cadência estruturada de follow-up','Configurar fluxo de 7 toques em 14 dias com mídias variadas','fluxos','automacao',85),
('booking_baixo','Taxa de booking < 20%','Script de qualificação fraco ou oferta não clara','Refinar script BANT + treinar SDR + reescrever copy de agendamento','processos','prospeccao',90),
('show_baixo','Show rate < 65%','Falta de pré-aquecimento / lembretes','Sequência de 3 lembretes (24h, 1h, 15min) + vídeo de boas-vindas','fluxos','prospeccao',88),
('conversao_baixa','Conversão em vendas < 20%','Closer sem método ou ICP errado','Treinamento SPIN + revisar ICP + role-play semanal','processos','processos',92),
('ticket_baixo','Ticket médio caindo','Falta de upsell / esteira incompleta','Criar oferta High End + script de upsell pós-venda','prospeccao','processos',75),
('cac_alto','CAC acima do ideal','Mix de canais ineficiente ou ICP largo','Redistribuir investimento para canais com melhor ROAS + apertar ICP','prospeccao','prospeccao',88),
('roas_baixo','ROAS < 5','Criativos saturados ou LP convertendo mal','Renovar 3 criativos + teste A/B na LP','prospeccao','automacao',85),
('time_subdimensionado','Time não dá conta dos leads','Falta de SDRs (>750 leads/SDR/mês)','Contratar SDRs conforme calculadora Grow Sales Intelligence','rh','pessoas',95),
('time_ocioso','Vendedores ociosos','Geração de leads insuficiente','Aumentar mídia ou ativar Social Selling para gerar volume','prospeccao','prospeccao',80),
('sem_previsibilidade','Não consigo prever a receita do mês','Funil sem etapas claras ou CRM desatualizado','Implementar 7 etapas padrão + reuniões diárias de pipeline','funil','gestao',90),
('cancelamento_alto','Churn / cancelamento alto','Expectativa errada na venda ou onboarding fraco','Alinhar copy + criar onboarding estruturado','processos','processos',82),
('rampup_lento','Vendedores demoram a performar','Falta de playbook + treinamento','Documentar playbook + criar trilha 30/60/90','rh','pessoas',86),
('sem_indicadores','Não vejo os números do time','Falta de gestão data-driven','Configurar dashboards diários + reunião 1:1 semanal','analytics','gestao',90),
('sem_automacao','Tudo é manual','Falta de fluxos de automação','Implementar 5 fluxos críticos (boas-vindas, follow-up, no-show, ganho, perda)','fluxos','automacao',85),
('lead_frio','Leads frios na lista','Qualificação fraca na entrada','Filtro automático no formulário + score por engajamento','leads','prospeccao',75),
('vendedor_desmotivado','Time desmotivado','Comissão pouco atrativa ou metas irreais','Revisar comissão escalonada + metas SMART','rh','pessoas',88),
('falta_objecao_resp','Vendedores travam em objeções','Falta de matriz de objeções','Documentar TOP 10 objeções com respostas validadas','processos','processos',80),
('reuniao_improdutiva','Reuniões de venda improdutivas','Sem roteiro ou descoberta fraca','Padronizar roteiro de descoberta (SPIN) + gravação para auditoria','processos','processos',80),
('ia_sem_contexto','IA respondendo errado','Prompts genéricos sem contexto da empresa','Configurar IA com ICP + esteira + objeções da empresa','ia','automacao',82),
('cold_call_sem_resultado','Cold call sem retorno','Lista fria mal segmentada','Refinar ICP + comprar lista qualificada (LinkedIn Sales Navigator)','prospeccao','prospeccao',70),
('inbound_baixo','Inbound seco','Conteúdo fraco ou inexistente','Plano editorial 3x/semana com autoridade + isca digital','site','prospeccao',75),
('agendamento_dificil','Difícil agendar com decisor','Não está chegando ao decisor','Mapear stakeholders + multi-thread (4-6 contatos por conta)','prospeccao','prospeccao',85),
('reuniao_sem_decisor','Reunião sem o decisor','SDR qualifica errado','Critério obrigatório: confirmar decisor antes de agendar','processos','prospeccao',88),
('proposta_nao_fecha','Propostas paradas no follow-up','Falta de senso de urgência','Criar gatilhos (validade, bônus, garantia) + plano de ação','processos','processos',86),
('pipeline_sujo','Pipeline cheio mas sem fechar','Leads no estágio errado / não-leads','Higienização semanal + critérios claros por etapa','funil','gestao',90),
('discador_ocioso','Discador subutilizado','Sem cadência ou lista','Importar lista + criar campanhas diárias com meta de tentativas','discador','prospeccao',80),
('whatsapp_desconectado','WhatsApp caindo','Instância Evolution instável','Avaliar migração para Meta Official','integracao','automacao',75),
('falta_kpi','Não sei meus KPIs','Falta de cultura de métricas','Definir 5 KPIs vitais e revisar diariamente','analytics','gestao',92),
('sem_diferenciacao','Cliente compara só por preço','Falta de proposta de valor única','Reescrever pitch de valor + provar com cases','processos','processos',82)
ON CONFLICT (sintoma_key) DO NOTHING;