# Confirmação de Compromisso via Link Público

Hoje o lembrete é apenas texto. Vamos transformar em uma experiência clicável: o lead recebe a mensagem com um **link único** que abre uma página com botões **"Confirmar"** / **"Não confirmar"** (igual ao exemplo da Revitalle), e o status volta automaticamente para o CRM e a agenda.

## O que será criado

### 1. Página pública de confirmação `/c/:token`

Rota pública (sem login) que mostra:

- Logo da empresa
- Nome do lead, data/hora, profissional, serviço
- Botões **Confirmar** e **Não confirmar**
- Tela final: "Seu agendamento foi confirmado!" / "Recebemos sua resposta."

Visual no padrão do site público existente (mesma vibe da automação da aba Site).

### 2. Token único por compromisso

Nova coluna `confirmation_token` (uuid) em `compromissos`, gerado quando o compromisso é criado. O link enviado vira:

```
https://app.growos.online/c/{token}
```

### 3. Mensagem do lembrete clicável

O template padrão de lembrete passa a incluir o link curto. Variáveis novas:

- `{link_confirmacao}` — URL completa
- `{botao_confirmar}` — link "✅ Confirmar"
- `{botao_recusar}` — link "❌ Cancelar"

Exemplo gerado:

```
Olá {nome}, confirme seu agendamento para {data} às {hora}.
👉 {link_confirmacao}
```

Para conexões **Meta Oficial** podemos opcionalmente enviar como **mensagem interativa com botões nativos** (Sim/Não) — fallback para texto+link quando for Evolution API.

### 4. Edge Function `confirmar-compromisso`

Pública (sem JWT). Recebe `{ token, acao: "confirmar" | "recusar" }` e:

- Valida token
- Atualiza `compromissos.status_confirmacao` (`confirmado` / `recusado` / `pendente`)
- Grava `confirmado_em` e `confirmado_via` (whatsapp/link)
- Cancela lembretes futuros desse compromisso se confirmado
- Cria notificação no CRM para o responsável
- Posta mensagem automática no chat do lead ("Cliente confirmou via link")

### 5. UI da Agenda

- Badge de status no card do compromisso: 🟡 Aguardando · 🟢 Confirmado · 🔴 Recusado
- Filtro por status de confirmação
- Botão "Copiar link de confirmação" no compromisso

### 6. Configurações do template (por empresa)

Em Configurações → Agenda/Lembretes:

- Editor do template com preview
- Toggle "Incluir link de confirmação"
- Toggle "Usar botões interativos (Meta Oficial)"
- Personalização da página: logo, cor primária, texto de boas-vindas

## Detalhes técnicos

**Banco (migração):**

```sql
alter table compromissos
  add column confirmation_token uuid unique default gen_random_uuid(),
  add column status_confirmacao text default 'pendente',
  add column confirmado_em timestamptz,
  add column confirmado_via text;

create index on compromissos(confirmation_token);
```

Trigger para popular `confirmation_token` em registros antigos.

**RLS:** policy de SELECT pública apenas via RPC `get_compromisso_by_token(token)` (SECURITY DEFINER) que retorna só os campos seguros (nome do lead, data, serviço, profissional, logo da empresa). Nada de telefone/dados sensíveis.

**Rota frontend:** `src/pages/ConfirmarCompromisso.tsx` adicionada em `App.tsx` como rota pública.

**Edge function:** `supabase/functions/confirmar-compromisso/index.ts` com `verify_jwt = false` em `supabase/config.toml`.

**Integração com `enviar-lembretes`:** interpolar `{link_confirmacao}` antes de enviar, usando `VITE_APP_URL` (ou domínio configurado da empresa).

**Reenvio inteligente:** se faltar X horas e ainda estiver `pendente`, dispara segundo lembrete ("Você ainda não confirmou..."). Configurável.

## Fora de escopo desta entrega

- Reagendamento pelo próprio lead (pode ser fase 2)
- Pagamento/sinal pela página
- Multi-idioma da página pública

Posso seguir com a implementação?