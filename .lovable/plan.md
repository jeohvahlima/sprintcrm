# Plano de Implementação — Estruturação Comercial 100% GROW

Vamos fechar os 7 gaps identificados no playbook, distribuídos em 3 fases (F2, F3, F4). Tudo dentro dos 4 módulos de estruturação comercial existentes (Prospecção, Discador, Processos Comerciais, Maturidade) — sem criar módulos paralelos, mantendo a marca **Grow Sales Intelligence**.

---

## FASE 2 — Esteira de Produtos + Funis de Marketing + ICP Estruturado
**Onde:** módulo Prospecção (nova aba "Estratégia Comercial")
**Impacto:** alto (cliente final vê valor imediato)

### 2.1 Esteira de Produtos (Front / Back / High End)
- Novo componente `ProductLadderBuilder.tsx` em `src/components/prospeccao/`
- Tabela `product_ladder` (company_id, tier: front|back|high_end, nome, ticket, objetivo, ordem)
- Visual em 3 colunas com matriz: ticket médio, ciclo de venda, canal de aquisição, função no funil
- Sugestões IA por segmento (usa `useCompanySegmento`)

### 2.2 Trilhas de Funis de Marketing
- Componente `MarketingFunnelTracks.tsx` com 3 trilhas:
  - **VSL/Diagnóstico** (orgânico)
  - **Social Selling** (já parcial — consolidar com `SocialSellingPanel`)
  - **Isca Paga** (anúncios)
- Cada trilha = checklist de etapas do playbook + status (não iniciado / em construção / ativo)
- Salvar em `marketing_funnel_progress`

### 2.3 ICP Estruturado em 3 Etapas
- Refatorar `ICPBuilder` para wizard de 3 passos: **Quem é** → **Dores** → **Gatilhos de compra**
- Output: ficha ICP imprimível + injeção automática nos prompts da IA de prospecção

---

## FASE 3 — SDR1-4 + Playbook/CRM/IA Checklists
**Onde:** módulo Discador + Processos Comerciais
**Impacto:** médio-alto (organização operacional)

### 3.1 Estrutura SDR1 → SDR4
- Estender tabela `user_roles_extended` (ou criar `sdr_specializations`): nivel: sdr1|sdr2|sdr3|sdr4
  - SDR1: lista fria | SDR2: inbound | SDR3: outbound qualificado | SDR4: closer-assistant
- `SDRDashboard.tsx`: filtro por nível + KPIs específicos por nível
- Distribuição automática de leads conforme nível (regra no `useProspectingQueue`)

### 3.2 Score de Maturidade do CRM
- Adicionar sub-score em `GrowSalesIntelligence.tsx` (4ª aba "Maturidade do CRM")
- Checklist auto-avaliativo: pipelines configurados, automações ativas, lead scoring, integrações, tagging
- Resultado alimenta o pilar "automacao" do GMI

### 3.3 Maturidade da IA Comercial
- Componente `AIMaturityCheck.tsx` em Processos Comerciais
- 3 níveis: Sugestivo / Automático / Desligado — por agente (atendimento, qualificação, follow-up)
- Mapeia para configurações já existentes em `useAIAgents`

### 3.4 Playbooks Documentados (checklist)
- Painel "Playbooks Comerciais" em Processos Comerciais
- Checklist: script de abordagem, qualificação BANT/SPIN, objeções, fechamento, follow-up
- Status por item + link para o documento (usa `useCommercialPlaybooks`)

---

## FASE 4 — RH Comercial + Fase do Negócio + Diagnóstico Prescritivo
**Onde:** módulo Maturidade (3 novas abas) + Processos Comerciais
**Impacto:** alto estratégico (fecha o capítulo 11 e 12 do playbook)

### 4.1 RH Comercial (Capítulo 11)
- Nova aba na Maturidade: **"RH Comercial"**
- 4 sub-seções:
  - **Funil de Seleção** (etapas de recrutamento + taxas)
  - **Ramp-up** (timeline 30/60/90 dias por cargo)
  - **Calculadora de Remuneração** (fixo + variável + comissão escalonada por meta)
  - **Painel de Retenção** (turnover, NPS interno, planos de carreira)
- Tabela `commercial_hr_config` (company_id, secao, dados jsonb)

### 4.2 Fase do Negócio
- Pergunta no início do Diagnóstico 360°: **Validação / Tração / Escala**
- Plano de ação IA passa a considerar a fase (prompts diferentes em `advisor-ai`)
- Badge visível no header da Maturidade

### 4.3 Diagnóstico Prescritivo ("Consultor de Problemas")
- Componente `PrescriptiveDiagnosis.tsx` em Processos Comerciais
- Matriz "Se X então Y": usuário marca sintomas (ex: "leads não atendem", "fechamento baixo"), sistema retorna causas prováveis + ações prescritas + módulo do CRM responsável
- Base de regras em tabela `prescriptive_rules` (sintoma, causa, acao, modulo_destino, prioridade) — seed inicial com ~40 regras do playbook

---

## Detalhes Técnicos

**Banco (migrations):**
- `product_ladder`, `marketing_funnel_progress`, `sdr_specializations`, `commercial_hr_config`, `prescriptive_rules`
- Todas com RLS por `company_id` usando `get_user_company_ids()` (padrão do projeto)
- Seed de `prescriptive_rules` com regras do playbook

**Edge functions:**
- Estender `advisor-ai` para aceitar `business_phase` e gerar prompts contextualizados
- Nova função `prescriptive-diagnosis` (recebe sintomas, retorna ações)

**Frontend:**
- Componentes em `src/components/wmi/`, `src/components/prospeccao/`, `src/components/processos/`
- Reuso total dos design tokens (verde `142 71% 45%`)
- Sem rota nova — tudo via abas dentro dos módulos existentes

**Ordem de execução proposta:**
1. F2.1 (Esteira) → F2.3 (ICP) → F2.2 (Funis)
2. F3.2 (CRM Maturity) → F3.3 (IA) → F3.4 (Playbooks) → F3.1 (SDR1-4)
3. F4.2 (Fase) → F4.3 (Prescritivo) → F4.1 (RH Comercial — maior)

---

## Entregáveis por fase

| Fase | Componentes novos | Tabelas | Edge functions | Tempo estimado |
|------|------------------|---------|----------------|----------------|
| F2   | 3                | 2       | 0              | ~3 sessões     |
| F3   | 4                | 1       | 0              | ~3 sessões     |
| F4   | 3                | 2       | 1 nova + 1 ext | ~4 sessões     |

Ao fim das 3 fases: **100% da metodologia GROW Sales Intelligence coberta no SaaS**, posicionando o produto como único CRM brasileiro com playbook nativo de estruturação comercial.

**Recomendação:** começar por **F2.1 (Esteira de Produtos)** — é o gap mais visível e o que mais diferencia visualmente o produto.