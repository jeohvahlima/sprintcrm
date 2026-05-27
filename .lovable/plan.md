# Follow-up Inteligente — Motor de Recuperação de Leads

Vamos transformar o funil "Follow-UP Inteligente" já existente em um motor automático, sem criar funil novo. Tudo se conecta às etapas que você já tem (F1 D+1, F2 D+3, F3 D+7, F4 D+14, F5 D+30).

## O que será entregue

### 1. Configuração por etapa (UI)
- Engrenagem ⚙️ ao lado de "Nova Etapa" abre o painel **"Follow Inteligente"**
- Por etapa: tempo parado (dias/horas), canal (WhatsApp/Tarefa/Notificação), template de mensagem, ações (criar tarefa, notificar responsável)
- Botão global **"Ativar Follow Inteligente"** no topo do funil

### 2. Detecção de "tempo parado"
- Novos campos no lead: `last_interaction_at`, `last_movement_at`, `follow_count`, `lead_score`, `lead_temperature` (quente/morno/frio)
- Atualização automática via trigger sempre que chega mensagem, ligação ou movimentação

### 3. Motor automático (cron 5 min)
- Edge function `follow-inteligente-engine` roda a cada 5 minutos
- Para cada lead em etapa configurada: se `tempo_parado >= tempo_configurado` → dispara ações (WhatsApp template, tarefa, notificação)
- Registra execução em `follow_execucoes` para evitar duplicidade
- Avança lead para próxima etapa após disparo (configurável)

### 4. Reset automático
- Lead respondeu (mensagem recebida) → zera timer, pausa automações da etapa atual, soma score
- Atendeu ligação → mesmo comportamento

### 5. Score + Temperatura
- +10 respondeu, +5 atendeu ligação, +3 visualizou, -5 ignorou, -10 após 7 dias
- 🔥 Quente (respondeu <24h) / ⚠️ Morno (2-5d) / ❄️ Frio (>7d)
- Ordenação automática do card no funil pela temperatura + score

### 6. Card inteligente
- Badge de temperatura (🔥/⚠️/❄️)
- "Há 3 dias sem resposta"
- Score numérico
- Contador de follow-ups disparados

### 7. Dashboard de Follow
- Nova aba/seção: leads sem resposta, esquecidos (>7d), quentes, taxa de recuperação

## Estrutura técnica

**Tabelas novas:**
- `follow_etapa_config` (etapa_id, tempo_valor, tempo_unidade, canal, template_id, criar_tarefa, notificar, avancar_etapa, ativo)
- `follow_execucoes` (lead_id, etapa_id, executado_em, acao, status)
- `follow_templates` (nome, conteudo, variaveis)

**Colunas em `leads`:**
- `last_interaction_at`, `last_movement_at`, `follow_count`, `lead_score`, `lead_temperature`

**Edge functions:**
- `follow-inteligente-engine` (cron a cada 5 min)
- `follow-inteligente-test` (testar etapa manualmente)

**Triggers:**
- Atualiza `last_interaction_at` quando mensagem/ligação criada
- Atualiza `last_movement_at` quando etapa muda
- Reset de timer + score ao receber resposta

**Frontend:**
- `FollowInteligenteConfigDialog.tsx` — config por etapa
- `FollowInteligentePanel.tsx` — painel global do funil
- `FollowTemperatureBadge.tsx` — badge no card
- `FollowDashboard.tsx` — métricas

**Reutiliza:**
- Sistema de templates do WhatsApp já existente
- Edge function de envio Meta/Evolution já existente
- Sistema de tarefas existente

## Fora de escopo (futuras evoluções nível 2)
- Cadência multicanal (email)
- IA sugestão de mensagem
- Metas SDR e gamificação ligadas ao follow

Posso começar pela migração do banco + motor + UI de configuração?
