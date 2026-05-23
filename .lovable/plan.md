## Pipeline Hunter (Cold Call Kanban)

Adicionar um modo **Pipeline** ao painel Cold Call atual (`ChannelProspectPanel` / aba Cold Call do módulo Prospecção), mantendo o **Modo Lista** existente intacto. O modo Pipeline é um Kanban de execução de SDR outbound.

### Escopo — Fase 1 (entrega agora)

Foco no núcleo do produto. Gamificação avançada, cadência automática e IA ficam para a Fase 2.

#### 1. Banco (migração)
- Tabela `hunter_pipeline_leads` (1 linha por lead no pipeline):
  - `lead_id`, `company_id`, `assigned_to`, `stage` (enum), `substatus`, `attempts`, `last_action_at`, `next_action_at`, `next_action_reason`, `contact_person_name`, `decisor_classificacao` (A/B/C), `dor_identificada`, `meeting_at`, `discard_reason`, `notes`.
- Tabela `hunter_pipeline_events` (auditoria/timeline):
  - `lead_pipeline_id`, `user_id`, `event_type` (call_attempt, stage_moved, note, score), `from_stage`, `to_stage`, `payload jsonb`, `points`, `created_at`.
- Enum `hunter_stage`: `novo`, `tentativa_contato`, `follow_up`, `contato_realizado`, `buscando_decisor`, `conversa_decisor`, `oportunidade`, `descartado`.
- RLS por `company_id` (security definer `get_user_company_ids()` padrão do projeto).
- Trigger: após 3 `call_attempt` sem sucesso → move para `follow_up` automaticamente.

#### 2. UI — toggle Lista | Pipeline
- Em `ChannelProspectPanel.tsx`, na aba Cold Call adicionar toggle `Lista` / `Pipeline` no topo.
- Modo Lista = comportamento atual (sem mudar).
- Modo Pipeline = novo componente `HunterPipelineBoard`.

#### 3. Componente `HunterPipelineBoard`
- Kanban com 8 colunas fixas (padrão `JuridicoKanban`: `@dnd-kit/core`, `PointerSensor` distance 8).
- Card mostra: nome empresa, último evento, contador de tentativas, cor por estágio, badge de classificação A/B/C.
- Drag-and-drop entre colunas → grava evento + atualiza `stage`.
- Click no card abre `HunterLeadDrawer`:
  - Histórico de ligações/eventos (de `hunter_pipeline_events`)
  - Notas, status, próxima ação
  - Botão **Click-to-Call** integrado ao discador existente (`useCallCenter`)
  - Form contextual ao estágio (substatus, classificação obrigatória em "Conversa decisor", motivo em "Descartado", data em "Oportunidade" e "Follow-up").

#### 4. Regras automáticas
- Hook `useHunterPipeline` controla optimistic update + chamada Supabase.
- Validações:
  - Mover para `conversa_decisor` exige classificação A/B/C + dor.
  - Mover para `oportunidade` exige `meeting_at`.
  - Mover para `descartado` exige motivo.
  - Mover para `follow_up` exige `next_action_at` + motivo.
- 3 tentativas sem sucesso → trigger DB já trata.
- Alerta visual no card se `last_action_at > 24h` (badge âmbar "Parado").

#### 5. Dashboard mínimo (topo do board)
- 4 KPIs: total no pipeline, taxa de conexão, taxa de decisor, taxa de oportunidade (calculadas client-side a partir dos eventos).

#### 6. Pontuação (base para gamificação)
- Trigger DB grava `points` em `hunter_pipeline_events` conforme `event_type`:
  - `call_attempt` +1, `contato_realizado` +3, `buscando_decisor`→`conversa_decisor` +5, `oportunidade` +10.
- Exibição de ranking detalhado fica para Fase 2 (já há ranking SDR no projeto).

### Fora desta fase (Fase 2)
- Cadência automática multicanal
- IA de próxima ação
- Ranking Hunter Performance completo + integração com gamificação existente
- Insights automáticos ("você está falando com muitas recepções…")
- Integrações LinkedIn / e-mail

### Arquivos previstos
- `supabase/migrations/<nova>.sql`
- `src/hooks/useHunterPipeline.ts`
- `src/components/prospeccao/hunter/HunterPipelineBoard.tsx`
- `src/components/prospeccao/hunter/HunterLeadDrawer.tsx`
- `src/components/prospeccao/hunter/HunterStageForm.tsx`
- `src/components/prospeccao/hunter/HunterKPIs.tsx`
- Edição: `src/components/prospeccao/channels/ChannelProspectPanel.tsx` (toggle)

### Confirmações que preciso antes de começar
1. **OK rodar migração** criando `hunter_pipeline_leads`, `hunter_pipeline_events` e enum `hunter_stage`?
2. **Fase 1 conforme acima** (sem cadência/IA/insights ainda) — pode seguir? Ou prefere que eu inclua tudo em uma entrega só (vai gerar várias migrações + ~10 arquivos novos)?
3. Os leads existentes em Cold Call entram no Kanban automaticamente em **"Leads Novos"** na primeira abertura, certo?