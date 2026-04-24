## Análise: o que falta para virar uma "Máquina de Vendas Completa"

### O que já existe hoje no módulo Prospecção
- **Logs diários** por SDR (`prospecting_daily_logs`): leads, respostas, oportunidades, reuniões, vendas, valor bruto.
- **Interações 1:1** (`prospecting_interactions`) com timeline e auto-log a partir de chamadas (Nvoip) e mensagens (WhatsApp/Instagram).
- **Gamificação RPG** (XP, level, quests, conquistas, ranking semanal, loja de moedas).
- **Filas de prospecção** (`prospecting_queues` + `prospecting_queue_leads`) — tabelas existem mas não são usadas em UI.
- **Canais**: abas Cold Call, Instagram, WhatsApp, Funil espelhado.
- **Scripts** (Grimório), follow-up, KPIs e gráficos por canal.
- **SDRDashboard** (Discador) já tem dashboard de chamadas por SDR.

### O que ESTÁ FALTANDO para entregar a "máquina de vendas"
A engrenagem técnica já está 80% pronta. Falta a **camada de gestão comercial**: metas, papéis (SDR/Closer), atribuição de fila, handoff e visão consolidada do gestor.

---

## Plano: Módulo de Estruturação Comercial Completa

### 1. Papéis comerciais reais (SDR vs Closer vs Gestor)
Hoje existe só `app_role` genérico. Adicionar **perfil comercial** ao player:
- Migration: adicionar coluna `commercial_role` em `prospecting_player_profile` (`sdr` | `closer` | `hybrid` | `manager`) e `team_id uuid`.
- Nova tabela `sales_teams` (id, company_id, name, manager_id, color) — gestor agrupa SDRs/Closers em squads.
- Tela de configuração para o gestor atribuir cada usuário a um time + papel.

### 2. Metas diárias / semanais / mensais por usuário (KPIs)
Hoje as "quests" são gamificação, não metas comerciais formais. Criar sistema paralelo de **metas de SDR**:
- Nova tabela `commercial_goals`:
  - `user_id`, `team_id`, `company_id`, `period` (daily/weekly/monthly), `metric` (leads_prospected, calls, responses, meetings, sales, gross_value), `target_value`, `start_date`, `end_date`, `created_by`.
- Tela "Metas do Time" (somente gestor/admin):
  - Definir meta padrão por papel (ex: SDR = 50 cold calls/dia, 10 respostas, 3 reuniões; Closer = 5 reuniões realizadas, 2 vendas).
  - Override individual por usuário.
  - Aplicação em lote ("aplicar para todo o time SDR").
- HUD do SDR (no topo de Prospecção) mostra **barra de progresso da meta do dia** (calls feitas/meta, reuniões/meta, vendas/meta) puxando de `prospecting_daily_logs` + chamadas + interações.
- Alerta visual quando meta < 50% no meio do expediente.

### 3. Fila de Prospecção operável (ativar tabelas existentes)
As tabelas `prospecting_queues` existem mas estão ociosas. Construir UI:
- **Aba "Fila do SDR"** dentro de Prospecção: cartão grande com "Próximo Lead" + botão "Ligar agora" / "Enviar mensagem" / "Pular".
- Gestor cria fila por canal (Cold Call, IG, WhatsApp), atribui SDRs e injeta leads (manual, por tag, por filtro de funil ou por importação).
- Distribuição automática round-robin entre SDRs atribuídos.
- Status do lead na fila: `pending → in_progress → contacted → qualified → handoff → done`.

### 4. Handoff SDR → Closer (peça-chave)
Quando um SDR qualifica uma reunião, o lead precisa "passar o bastão" para um Closer:
- Botão "Transferir para Closer" no card da fila / na conversa / no lead.
- Nova tabela `sdr_closer_handoffs` (sdr_id, closer_id, lead_id, scheduled_meeting_at, sdr_notes, status, accepted_at).
- Closer recebe notificação + lead aparece na sua "Caixa de Entrada Closer" com: contexto do SDR, transcrição/timeline, agendamento, valor previsto.
- Métrica: **taxa de show-up** (reunião marcada vs realizada vs vendida).

### 5. Dashboard do Gestor Comercial (visão consolidada)
Nova aba **"🎯 Comando" / "Gestor"** dentro de Prospecção (visível só para gestor/admin):
- KPI cards do time inteiro vs metas (atingimento %).
- Tabela "Performance por SDR/Closer hoje": atividade, conversão, gap vs meta, pacing.
- Heatmap de horários produtivos.
- Funil de conversão por etapa: Tentativas → Conexões → Respostas → Reuniões → Vendas (por SDR e agregado).
- Ranking de Closers por taxa de fechamento e ticket médio.
- Alertas automáticos: "SDR X está 70% abaixo da meta há 2 dias", "Closer Y tem 5 leads sem follow-up há 48h".

### 6. Cadências automáticas por SDR
Já existem `ia_cadence_rules` e `lead_cadence_progress`. Conectar ao módulo:
- Templates prontos: "Cadência SDR Outbound 7 dias" (D0 cold call → D1 WhatsApp → D3 e-mail → D5 IG → D7 break-up).
- Gestor escolhe cadência padrão por time.
- Cada lead na fila avança automaticamente conforme atividades do SDR.

### 7. Cultura comercial (rituais)
- **Daily Huddle**: tela "Briefing Diário" com metas do dia + ranking de ontem + leads quentes — primeira coisa que SDR vê ao entrar.
- **Roleplay/Treino**: aba simples de "Treinos" com áudios gravados de chamadas reais (já temos transcrição) marcadas como exemplo.
- **Comissionamento simulado**: campo `commission_per_sale` na meta + widget "💰 Você ganhou R$ X hoje" no HUD.

---

## Resumo técnico de entregáveis

**Migrations (1 arquivo SQL):**
- Tabela `sales_teams`
- Tabela `commercial_goals`
- Tabela `sdr_closer_handoffs`
- Adicionar `commercial_role`, `team_id`, `commission_per_sale` em `prospecting_player_profile`
- Função `get_user_goal_progress(user_id, period)` retornando target vs realizado por métrica
- Função `get_team_performance(team_id, period)` para o dashboard do gestor
- RLS por `company_id`

**Hooks novos:**
- `useCommercialGoals.ts`, `useSalesTeams.ts`, `useProspectingQueue.ts`, `useHandoffs.ts`, `useTeamPerformance.ts`

**Componentes novos (`src/components/prospeccao/comercial/`):**
- `GoalProgressHUD.tsx` (barra de meta do dia no topo)
- `SDRQueuePanel.tsx` (próximo lead da fila com ações)
- `HandoffDialog.tsx` (passar para closer)
- `CloserInbox.tsx` (caixa de entrada do closer)
- `ManagerCommandCenter.tsx` (dashboard do gestor)
- `TeamGoalsManager.tsx` (CRUD de metas)
- `SalesTeamsManager.tsx` (CRUD de times)
- `DailyBriefingModal.tsx` (huddle diário)

**Páginas/rotas:**
- `/configuracoes/comercial` — gestor configura times, papéis e metas
- Novas abas em `/prospeccao`: "🎯 Minha Fila" (SDR), "📥 Caixa Closer" (Closer), "🎖️ Comando" (Gestor)

**Refator:**
- `Prospeccao.tsx` ganha o `GoalProgressHUD` no topo e renderização condicional das abas conforme `commercial_role`.
- `MainLayout` / sidebar: link "Configurações Comerciais" para gestor.

### Resultado final
Quando aprovado, o CRM deixa de ser um simples gerenciador e vira:
1. **Para o SDR**: fila clara do dia, meta visível, próximo lead já na tela, cadência automática, gamificação.
2. **Para o Closer**: caixa de entrada de reuniões qualificadas com contexto completo do SDR.
3. **Para o Gestor**: comando centralizado com metas, performance individual, alertas de gap, ranking e estruturação completa do time.

Quer que eu siga com a implementação completa, ou prefere fasear (ex: Fase 1 = Times + Metas + HUD; Fase 2 = Fila + Handoff; Fase 3 = Dashboard do Gestor)?