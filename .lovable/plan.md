# Esteira de Follow-up (Prospecção)

Transforma a aba **Follow-ups** de relatório passivo numa **esteira ativa** estilo Kanban com cadência agressiva, registro de canal e múltiplas fontes de entrada.

## Cadência (fixa nesta entrega, configurável depois)

```text
F1 → D+1   (1 dia após entrar)
F2 → D+3
F3 → D+7
F4 → D+14
F5 → D+30
```

Após F5 sem resposta → vai pra coluna **"Esfriou"**. Resposta/reunião/venda → **"Concluído"** com motivo.

## Entrada na esteira (3 fontes)

1. **Favoritados** — botão "Adicionar à esteira" no card do contato favoritado.
2. **Contactado sem resposta** — quando registrar `Contactado` na prospecção e passar 24h sem `Respondeu`, entra automaticamente.
3. **Leads frios do CRM** — botão "Reaquecer no follow-up" em leads sem interação há +X dias.

Toda entrada vira um card único com `source` marcado.

## Layout da aba Follow-ups

```text
┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
│ A executar │   F1 D+1   │   F2 D+3   │   F3 D+7   │  F4 D+14   │  F5 D+30   │ Concluído  │
│  (HOJE)    │            │            │            │            │            │            │
│            │            │            │            │            │            │            │
│ [card]     │ [card]     │ ...        │            │            │            │            │
│ [card]     │            │            │            │            │            │            │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

Cada card mostra: nome do contato, canal sugerido, **dias na etapa**, badge da fonte (Favorito / Sem resposta / Frio) e botão **"Executar follow"**.

A coluna **"A executar"** lista todos com `next_due_at <= now()` — é o foco do dia.

## Executar follow (dialog)

Ao clicar "Executar follow":
- Seleciona **canal**: WhatsApp / Ligação / Instagram / Email / SMS
- Campo de **observação**
- Resultado: Sem resposta / Respondeu / Reunião agendada / Venda / Perdido
- Botão **"Sugerir script com IA"** (usa histórico do contato)
- Confirmar → grava em `follow_up_executions`, avança o card para próxima etapa com `next_due_at` recalculado.

## Estrutura técnica

**Migrations (3 tabelas):**

- `follow_up_entries` — um registro por contato na esteira
  - `lead_id`, `contact_id`, `prospecting_id` (nullable, pelo menos um)
  - `current_step` (0-5), `next_due_at`, `status` (active|completed|cooled|paused)
  - `source` (favorite|no_response|cold_lead|manual)
  - `outcome` (responded|meeting|sale|lost|null)
  - `assigned_to`, `company_id`
- `follow_up_executions` — histórico de cada toque
  - `entry_id`, `step_number`, `channel`, `notes`, `outcome`, `script_used`, `executed_at`
- `follow_up_cadence` — cadência por empresa (default F1=1, F2=3, F3=7, F4=14, F5=30)

RLS por `company_id` usando o pattern `get_user_company_ids()` já existente.

**Frontend:**
- `src/components/prospeccao/followup/EsteiraFollowUp.tsx` (board)
- `src/components/prospeccao/followup/FollowEntryCard.tsx`
- `src/components/prospeccao/followup/ExecutarFollowDialog.tsx`
- `src/components/prospeccao/followup/AddToEsteiraDialog.tsx`
- `src/hooks/useFollowUpEsteira.ts`

**Página `Prospeccao.tsx`:** aba `followup` passa a renderizar `<EsteiraFollowUp />` no topo + relatório atual (`FollowUpKPIs` + `FollowUpTable`) abaixo, como histórico.

**Trigger automático** (fonte 2): trigger SQL em `prospecting_logs` — quando insere com `outcome = 'contacted'` e não houver `outcome = 'responded'` no mesmo contato em 24h, função agendada cria entry com `source = 'no_response'`. Implementação: cron diário simples lendo logs sem resposta de 24h+.

## O que entrego nesta rodada

1. Migrations completas (3 tabelas + RLS + função de avanço de etapa).
2. UI da esteira com colunas + cards + drag opcional (foco em botão "Executar" primeiro).
3. Dialog de execução com canal/notas/outcome.
4. Botões de entrada manual (favoritado e lead frio). 
5. Cron diário para fonte automática (sem resposta 24h).

Sugestão de script IA fica como botão placeholder ligado ao endpoint existente `commercial-ai` numa próxima rodada para não inflar essa entrega.

Confirma que é isso e mando a migration.
