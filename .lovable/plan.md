# Evolução da Confirmação de Compromissos

Implementar 5 melhorias na página `/c/:token` e no fluxo de lembretes.

## 1. Reenvio inteligente (item 3)

Quando o cron `enviar-lembretes` rodar, além dos lembretes já configurados, dispara um **segundo lembrete de cobrança** se:
- Faltam ≤ `X` horas para o compromisso (padrão: 3h)
- `status_confirmacao = 'pendente'`
- Ainda não foi enviado lembrete de cobrança (nova coluna `cobranca_enviada_em`)

Mensagem: "Olá {nome}, ainda não recebemos sua confirmação para {data} às {hora}. 👉 {link}"

## 2. Cancelar lembretes futuros ao confirmar (item 8)

Quando o lead clica em "Confirmar" na página pública, a função `confirmar_compromisso_by_token` marca todos os `lembretes_agendados` futuros do compromisso como `cancelado`, evitando spam.

## 3. Postar mensagem no chat do lead (item 4)

Após confirmar/recusar, dispara edge function `notificar-confirmacao-compromisso` que:
- Insere mensagem no chat do lead: "✅ Cliente confirmou o agendamento via link às 14:32" (ou ❌ recusou)
- Usa `mensagens` table com `tipo='sistema'` e `from_me=true`

## 4. Notificação no CRM para o responsável (item 5)

Mesma edge function cria registro em `notifications` para o `responsavel_id` do compromisso:
- Título: "Agendamento confirmado" / "Agendamento recusado"
- Mensagem com nome do lead e horário
- Link para a Agenda

## 5. Reagendamento pelo próprio lead (item 9)

Na página `/c/:token`, adicionar terceiro botão **"Quero remarcar"** que:
- Abre um seletor de horários disponíveis (próximos 14 dias) consultando RPC pública `get_horarios_disponiveis(_token, _data_inicio, _data_fim)`
- Respeita horário comercial da empresa, profissional do compromisso e blocos já ocupados
- Ao escolher novo horário, chama RPC `reagendar_compromisso_by_token(_token, _nova_data)`:
  - Atualiza `data_hora_inicio` / `data_hora_fim` (preserva duração)
  - Seta `status_confirmacao='confirmado'`, `confirmado_via='link_reagendamento'`
  - Cancela lembretes futuros e cria novos para a nova data
  - Notifica responsável: "Lead remarcou para {nova data}"
- Tela final: "Reagendamento confirmado! Te esperamos em {nova data}"

## Detalhes técnicos

**Migração SQL (`supabase/migrations/...`):**

```sql
alter table compromissos add column if not exists cobranca_enviada_em timestamptz;

-- Função: cancela lembretes futuros de um compromisso
create or replace function public.cancelar_lembretes_futuros(_compromisso_id uuid)
returns void language sql security definer set search_path = public as $$
  update lembretes_agendados
     set status = 'cancelado'
   where compromisso_id = _compromisso_id
     and status = 'pendente'
     and data_envio > now();
$$;

-- Atualiza confirmar_compromisso_by_token para:
-- 1) cancelar lembretes futuros se confirmado
-- 2) inserir notificação no CRM
-- 3) inserir mensagem-sistema no chat do lead

-- Nova RPC pública: get_horarios_disponiveis(_token, _data_inicio, _data_fim)
-- Retorna slots de 30min livres respeitando horário comercial e ocupação

-- Nova RPC pública: reagendar_compromisso_by_token(_token, _nova_data)
-- Atualiza compromisso, cria lembretes novos, notifica responsável
```

**Edge functions:**

- `enviar-lembretes/index.ts`: adicionar loop que busca compromissos `pendente` com `data_hora_inicio` entre `now()` e `now()+3h` e `cobranca_enviada_em IS NULL`. Envia mensagem e marca `cobranca_enviada_em`.

**Frontend (`src/pages/ConfirmarCompromisso.tsx`):**

- Adicionar botão "Quero remarcar" abaixo dos dois atuais
- Novo estado `view: 'inicial' | 'remarcar' | 'sucesso-remarcacao'`
- Grid de horários disponíveis (data → slots), 2 colunas no mobile
- Loading e tratamento de erro

## Fora de escopo

- Edição de duração / observações pelo lead
- Notificação por email/push (só in-app + WhatsApp)
- Horários disponíveis multi-profissional (usa só o profissional original)
