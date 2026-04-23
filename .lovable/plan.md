## Diagnóstico da URA — Por que ativa para alguns contatos e não para outros

Fiz uma varredura completa no motor de URA (`webhook-conversas`) e nos dados reais do banco. A URA tem **6 portões de bloqueio** que rodam ANTES de iniciar o fluxo. Se qualquer um deles falhar, a URA é silenciosamente pulada — e é exatamente isso que está acontecendo.

### O que descobri no banco agora

1. **TODOS os fluxos de automação estão `active = false`** — inclusive o fluxo chamado "URA de Atendimento" (id `3c58e0c5...`, da empresa `3d34ff74...`). Isso por si só explica grande parte do "às vezes ativa, às vezes não": só ativa para empresas/contatos onde alguém ligou o flag manualmente em algum momento.
2. Existem **estados de fluxo travados** em `conversation_flow_state` para 4 números (`555391984592`, `558699400294`, `558799257780`, `558799636954`) — todos no nó `f830826f...` aguardando input. Esses contatos não vão reativar o início da URA até o estado expirar (TTL 30min) ou ser limpo manualmente.
3. Existe **1 conversa com `ai_mode = 'off'`** (`558798157747`) — esse contato nunca dispara nada.
4. Existem **dezenas de `conversation_assignments` ativos** (atendimento humano em curso) — qualquer mensagem desses números pula a URA por design.

### Os 6 portões que bloqueiam silenciosamente a URA

Ordem real no código (`webhook-conversas/index.ts` linhas 1747–2050):

```text
mensagem recebida
   │
   ├─[1]─ é mensagem RECEBIDA, não-grupo, com companyId e número?           ── não → pula
   │
   ├─[2]─ existe flowState ativo (TTL 30min) p/ esse número+empresa?
   │        sim → continua de onde parou (não reinicia a URA)
   │
   ├─[3]─ palavra-chave de algum fluxo bate na mensagem?
   │        sim → reseta estado e força reinício
   │
   ├─[4]─ existe conversation_assignment ativo (humano atendendo)?           ── sim → pula URA
   │
   ├─[5]─ existem fluxos com active=true na MESMA empresa?                   ── não → pula URA
   │        (regra: NÃO herda fluxo da empresa-mãe — cada subconta precisa do próprio)
   │
   ├─[6]─ p/ cada fluxo:
   │        ├─ lead tem tag em settings.filters.excludeTags? ── sim → pula esse fluxo
   │        ├─ schedule.enabled e fora do horário?           ── sim → envia msg fora-de-hora e PARA
   │        ├─ tem trigger keyword? msg contém keyword?      ── não → pula
   │        └─ tem trigger nova_mensagem?                    ── não → pula
   │
   └─[7]─ fluxo iniciou? sim → break (só usa o primeiro fluxo que casar)
```

### Causas concretas do comportamento "ativa às vezes"

| # | Causa | Quem afeta | Sintoma |
|---|---|---|---|
| A | Fluxo está com `active = false` | Todos os contatos da empresa | URA nunca dispara |
| B | `conversation_flow_state` travado em nó "aguardando input" | Apenas o número travado | Primeira mensagem entra na URA, depois a URA "some" — na verdade está esperando resposta de menu |
| C | `conversation_assignments` ativo | Apenas números atribuídos a um colaborador | URA não dispara mais para aquele contato (correto, mas invisível para o usuário) |
| D | `conversation_ai_settings.ai_mode = 'off'` ou `'fluxo'` | Apenas a conversa com flag | Bloqueia IA (e em parte fluxos) |
| E | Lead com tag em `excludeTags` do fluxo | Lead específico | URA pula esse fluxo silenciosamente |
| F | Fora do `schedule` configurado (timezone fixo Brasília UTC-3) | Todos no horário ruim | URA não dispara, mas envia msg fora-de-hora se configurado |
| G | Subconta criou fluxo na empresa-mãe achando que ia herdar | Toda a subconta | URA nunca dispara (regra de isolamento explícita) |
| H | Fluxo só tem trigger `palavra_chave` e mensagem não contém | Mensagens "olá", "bom dia" etc. | URA só ativa para frases específicas |
| I | `numeroLimpo` veio vazio na normalização | Mensagens com formato anômalo | Bloqueio no portão [1] |

### O que vou fazer (Fase 1 — Diagnóstico Visível)

Criar uma **tela de diagnóstico da URA por contato** dentro do builder de automação, que mostra em tempo real **qual portão bloqueou** a URA para um número específico. Sem isso, vocês continuam no escuro.

1. **Tabela nova `automation_skip_logs`** — toda vez que `webhook-conversas` decide não disparar a URA, registra: `company_id`, `numero`, `flow_id` (se aplicável), `motivo` (enum: `flow_state_active`, `human_assignment`, `excluded_tag`, `out_of_schedule`, `no_active_flow`, `keyword_no_match`, `ai_mode_off`, `no_trigger_match`), `details` jsonb, `created_at`. TTL de 7 dias via cron (evita inflar o banco).
2. **Instrumentar `webhook-conversas/index.ts`** — adicionar 1 insert por portão de bloqueio (não-bloqueante, fire-and-forget). Zero impacto em performance.
3. **Nova página `/automacoes/diagnostico`** com:
   - Campo "Buscar por número"
   - Lista dos últimos 50 eventos de skip + os últimos 50 disparos OK
   - Badge colorido por motivo + tooltip com solução ("Limpar estado", "Remover atribuição", "Editar tag", etc.)
   - Botão "Limpar estado de fluxo deste número" (deleta da `conversation_flow_state`)
   - Botão "Liberar atendimento humano" (deleta da `conversation_assignments`)

### O que vou fazer (Fase 2 — Correções de Robustez)

4. **Aviso visual no Builder** quando o fluxo está `active = false` — um banner amarelo grande no topo: "Este fluxo está DESATIVADO. Mensagens não dispararão a URA." (hoje fica meio escondido no toggle).
5. **Aviso no Builder** quando o fluxo NÃO tem trigger de `nova_mensagem` nem `palavra_chave` — banner vermelho explicando que ele nunca vai disparar sozinho.
6. **Reduzir TTL do `conversation_flow_state`** dos atuais 30min para um valor configurável por fluxo (default 30min) e adicionar **botão "Resetar fluxo"** dentro de cada conversa no menu Conversas (3 pontinhos → "Reiniciar URA").
7. **Filtro de fluxo herdado opcional**: adicionar checkbox no fluxo da empresa-mãe "Permitir que subcontas usem este fluxo" — quando ligado, mudar a query no webhook para buscar também `parent_company_id`. Hoje a regra é hardcoded em "não herda".
8. **Corrigir o cálculo de timezone** do `schedule` — o código atual usa offset fixo `-3 * 60`, ignora horário de verão de outros países e está duplicando a aplicação do offset (`now.getTimezoneOffset()` + `brasiliaOffset`). Vou usar `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`.

### O que NÃO vou mexer

- Lógica do `executar-fluxo` (motor de execução de nós) — está estável
- IA orchestrator / ia-atendimento / ia-agendamento
- Estrutura visual do builder n8n-style
- Webhook do Meta — só o da Evolution (`webhook-conversas`) tem o motor de URA

### Detalhes técnicos

- Migration: `automation_skip_logs (id uuid pk, company_id uuid, telefone text, flow_id uuid null, motivo text, details jsonb, created_at timestamptz default now())` + index em `(company_id, telefone, created_at desc)` + RLS por `company_id` via `get_user_company_ids()` + cron `pg_cron` diário para purge >7d.
- Hook React Query: `useAutomationDiagnostics(numero?: string)` com realtime subscription.
- Componente: `src/pages/AutomacaoDiagnostico.tsx` + rota em `src/App.tsx`.
- Botão "Resetar URA": chama edge function existente ou nova `resetar-fluxo-conversa` que deleta de `conversation_flow_state`.
- Timezone fix: `new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', weekday: 'long'}).formatToParts(now)`.

### Pergunta rápida pra você decidir

Quer que eu faça as **Fases 1 e 2 juntas agora** (recomendo, demora o mesmo "round"), ou prefere **só a Fase 1** primeiro pra você ver os bloqueios reais e decidir as correções depois?