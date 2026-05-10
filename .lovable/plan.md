
# F5 — Finalizar 100% da Metodologia GROW Sales Intelligence

Fechar os 6 gaps que restaram do diagnóstico anterior, priorizados por impacto. Tudo dentro dos 4 módulos existentes, sem criar rotas novas, mantendo o verde GROW (`142 71% 45%`).

---

## 5.1 — GROW Score Consolidado (PRIORIDADE 1)
**Onde:** módulo Maturidade (topo) + card resumo no Dashboard
**Por que:** hoje temos 4 scores soltos (Prospecção, Processos, Discador, Automação). Falta o número único que vira o "selo GROW".

- Estender RPC `get_commercial_maturity_score` para também consolidar:
  - CRM Maturity (peso 15%)
  - AI Maturity (peso 10%)
  - Playbook Checklist (peso 15%)
  - Fase do Negócio declarada (multiplicador de expectativa)
- Novo componente `GrowScoreHero.tsx` (gauge 0-100 + classificação: Iniciante / Estruturado / Maduro / Referência)
- Badge "Selo GROW Nível X" reutilizável em outros módulos

## 5.2 — Métricas Norte por Fase do Negócio (PRIORIDADE 2)
**Onde:** novo painel em Maturidade > aba "Métricas Norte"
**Por que:** o playbook define KPIs diferentes para Validação / Tração / Escala — hoje mostramos métricas genéricas.

- Tabela `phase_north_metrics` (seed com ~15 métricas do playbook):
  - Validação: nº de entrevistas, % PMF, CAC payback
  - Tração: leads/mês, taxa SQL, CAC/LTV, MRR growth
  - Escala: NRR, GRR, sales velocity, ramp-up médio
- Componente `NorthMetricsPanel.tsx` que lê a fase declarada em `business_context` e mostra só as métricas relevantes + meta sugerida + status (acima/dentro/abaixo)
- Cada métrica linkada ao módulo onde se mede

## 5.3 — Plano de Ação Auto-Gerado do Diagnóstico (PRIORIDADE 3)
**Onde:** botão dentro de `PrescriptiveDiagnosis.tsx`
**Por que:** hoje o diagnóstico mostra ações em texto. Precisa virar **tarefa real** no módulo Tarefas.

- Botão "Gerar plano de ação" no resultado do diagnóstico
- Cria N tarefas em `tarefas` (uma por ação prescrita) com:
  - Título: ação prescrita
  - Descrição: causa provável + módulo destino
  - Prioridade espelhada da regra
  - Tag automática: `grow-diagnostico`
  - Vencimento: hoje + (10 - prioridade) dias
- Toast com deep-link "Ver plano em Tarefas"

## 5.4 — Templates de Reuniões de Ritmo D1/S1/M1/T1 (PRIORIDADE 4)
**Onde:** Agenda (já existe) + nova aba "Ritmos GROW" na Maturidade
**Por que:** Capítulo 10 do playbook prescreve ritmos diários/semanais/mensais/trimestrais — hoje sem templates.

- Tabela `meeting_rhythm_templates` (seed com 4 templates):
  - **D1 Daily** (15min) — pipeline do dia, bloqueios, metas
  - **S1 Semanal** (60min) — KPIs da semana, leads perdidos, próximas ações
  - **M1 Mensal** (90min) — fechamento, forecast, pessoas
  - **T1 Trimestral** (3h) — OKRs, fase do negócio, plano 90 dias
- Componente `RhythmTemplatesPanel.tsx` com botão "Agendar recorrência" → cria evento recorrente em `agenda`
- Cada template inclui pauta padrão (markdown) anexada ao evento

## 5.5 — Calculadora de Remuneração Interativa (PRIORIDADE 5)
**Onde:** dentro de `CommercialHRPanel.tsx` (já existe a seção, faltam os charts)
**Por que:** hoje só salva valores. Falta o **simulador** para o gestor brincar com cenários.

- Adicionar tab "Simulador" dentro do painel RH
- Inputs: fixo, % comissão, meta, acelerador (>100%), super-acelerador (>120%)
- Output: gráfico de linha (Recharts) mostrando remuneração total em 5 cenários de atingimento (60%, 80%, 100%, 120%, 150%)
- Comparativo com benchmark de mercado por cargo (SDR1 / SDR2 / Closer / Gerente)

## 5.6 — Benchmark Anônimo por Segmento (PRIORIDADE 6)
**Onde:** card discreto no Dashboard de Maturidade
**Por que:** valor altíssimo de retenção, mas precisa massa crítica. Implementar a base agora.

- View materializada `segment_benchmarks` (agregada, sem PII): média de GROW Score por segmento (advocacia, médico, financeiro, etc.) com `count >= 5` para anonimizar
- Componente `SegmentBenchmarkCard.tsx`: "Seu score: 72 | Média do seu segmento (advocacia): 64 | Top 10%: 89"
- Refresh diário via cron edge function

---

## Detalhes Técnicos

**Migrations:**
- `phase_north_metrics` (id, fase, metrica_key, label, formula, meta_min, meta_ideal, modulo_origem)
- `meeting_rhythm_templates` (id, tipo D1/S1/M1/T1, duracao_min, pauta_md, periodicidade)
- View materializada `segment_benchmarks`
- Extensão da RPC `get_commercial_maturity_score` para incluir CRM/AI/Playbook
- Seed: ~15 métricas norte + 4 templates de ritmo + ~10 benchmarks de remuneração de mercado

**Edge functions:**
- `refresh-segment-benchmarks` (cron diário)
- Extensão de `advisor-ai` para usar GROW Score consolidado no contexto

**Frontend (componentes novos):**
- `src/components/wmi/GrowScoreHero.tsx`
- `src/components/wmi/NorthMetricsPanel.tsx`
- `src/components/wmi/RhythmTemplatesPanel.tsx`
- `src/components/wmi/SegmentBenchmarkCard.tsx`
- `src/components/wmi/CompensationSimulator.tsx` (sub-componente do CommercialHRPanel)
- Botão `GenerateActionPlanButton.tsx` em PrescriptiveDiagnosis

**Reutilização total:**
- Design tokens existentes (verde GROW, sem cores hardcoded)
- Hook `useEstruturacao.ts` estendido (não criar hook novo)
- Recharts já está no projeto
- Tarefas já tem hook próprio

**Ordem de execução (1 sessão por bloco):**
1. F5.1 (GROW Score Hero) — fechamento visual da metodologia
2. F5.2 (Métricas Norte) — valor imediato por fase
3. F5.3 (Plano de Ação) — diagnóstico vira ação
4. F5.4 (Ritmos D1/S1/M1/T1)
5. F5.5 (Simulador de Remuneração)
6. F5.6 (Benchmark por Segmento)

---

## Resultado final

Ao fim da F5: **100% da metodologia GROW Sales Intelligence implementada**, com:
- 1 número único (GROW Score) que resume a maturidade comercial
- Métricas ajustadas à fase do negócio
- Diagnóstico que vira plano de ação executável
- Ritmos de gestão padronizados
- Simulador de remuneração com benchmark
- Comparativo anônimo entre clientes do mesmo segmento

**Posicionamento:** único CRM brasileiro com playbook nativo completo de estruturação comercial.

Quer que eu execute as **6 fases em sequência** ou prefere começar só pelos **3 primeiros** (Score + Métricas Norte + Plano de Ação) que entregam ~80% do impacto?
