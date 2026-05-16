## Objetivo

Confirmar e implementar o controle de visibilidade do funil (pipeline) por usuário, exatamente como mostram seus prints:

- **Vendedor** vê por padrão apenas os leads onde ele é responsável (botão "Meus Leads" ativo).
- **Gestor / Admin / Super Admin** podem alternar entre **Meus Leads**, **Equipe**, **Todos**, **Sem Responsável** e ainda filtrar por um usuário específico no dropdown "Todos os responsáveis".
- Cada card mostra um tooltip "Criado por: {nome}" no hover (como na primeira foto).

## Situação atual (auditada)

- `src/pages/Kanban.tsx` carrega `select("*") from leads` **sem nenhum filtro por responsável** e não existe a barra de filtros ("Meus Leads / Equipe / Todos / Sem Responsável" + dropdown).
- A tabela `leads` já possui `responsavel_id` (legado), `responsaveis uuid[]` (múltiplos) e `created_by`. O `usePermissions()` já expõe `isAdmin` (super_admin / company_admin).
- As RLS já permitem ver leads da mesma empresa — o filtro será aplicado no client, mantendo segurança no banco.
- Existe um documento `CORRECOES_RESPONSAVEIS.md` confirmando o suporte a múltiplos responsáveis no `LeadCard`.

## O que vai mudar

### 1. Estado e papéis no `Kanban.tsx`

- Buscar `user.id` atual e expandir `usePermissions` para também devolver `isGestor` (roles: `super_admin`, `company_admin`, `gestor`).
- Adicionar estados:
  - `viewMode: 'meus' | 'equipe' | 'todos' | 'sem-responsavel'`
  - `responsavelFiltro: string | 'all'`
- Default:
  - vendedor/suporte → `meus`, sem dropdown de responsáveis e sem botões Equipe/Todos/Sem Responsável (ocultos).
  - gestor/admin → `todos`, com todos os controles visíveis.

### 2. Barra de filtros (igual ao print)

Logo abaixo do título "Funil de Vendas / X oportunidades":

```text
[ Meus Leads ] [ Equipe ] [ Todos ] [ ⚠ Sem Responsável ]      [ 👤 Todos os responsáveis ▾ ]
```

- Botões usam `variant` default/outline conforme ativo.
- Dropdown lista profiles da mesma empresa com contagem de leads no funil selecionado.
- A contagem em "X oportunidades" passa a refletir o filtro ativo.

### 3. Lógica de filtragem (client-side, sem tocar RLS)

Aplicada sobre `leads` antes de distribuir nas etapas:

- `meus` → `responsavel_id === user.id` **OU** `responsaveis?.includes(user.id)`.
- `equipe` → leads de qualquer responsável que pertença à empresa do gestor, **exceto** os do próprio user (visão "do time").
- `todos` → sem filtro de responsável.
- `sem-responsavel` → `!responsavel_id && (!responsaveis || responsaveis.length === 0)`.
- Se `responsavelFiltro !== 'all'`, intersecta com `responsavel_id === filtro || responsaveis?.includes(filtro)`.

### 4. Tooltip "Criado por" no `LeadCard`

- Buscar `profiles.full_name` para `lead.created_by` e exibir num `Tooltip` no canto do card (o badge "Criado por: jeohvah" do seu print).

### 5. Persistência da preferência

- Salvar `viewMode` e `responsavelFiltro` em `localStorage` por usuário, para manter a escolha entre sessões.

## Detalhes técnicos

- **Arquivos a editar:**
  - `src/pages/Kanban.tsx` — estados, barra de filtros, `useMemo` de `leadsFiltrados`, passar para `DroppableColumn`.
  - `src/hooks/usePermissions.ts` — expor `isGestor` (soma de `gestor` + admins).
  - `src/components/funil/LeadCard.tsx` — tooltip "Criado por".
  - Novo: `src/components/funil/FunilFiltrosResponsaveis.tsx` — componente puro da barra (botões + dropdown).
- **Sem migrations**: as colunas necessárias (`responsavel_id`, `responsaveis`, `created_by`, `company_id`) já existem; RLS atual continua válida.
- **Realtime**: o listener atual continua atualizando `leads`; o filtro é recomputado via `useMemo`.

## Fora do escopo (a confirmar depois se quiser)

- Forçar via RLS que vendedor só consiga `SELECT` dos próprios leads (hoje o vendedor pode ver todos da empresa via SQL direto, embora a UI não mostre). Se quiser **bloqueio real no banco**, faço uma migration separada criando policy específica.
- Transferência em massa de responsável entre usuários.
