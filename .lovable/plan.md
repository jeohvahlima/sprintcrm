# Reestruturação dos Módulos — Grow OS

Vou separar **estratégia (metas)** de **execução diária (rotina)** de **prospecção (Grow Machine)**, com motor de cálculo automático ligando os três.

## 1. Novo módulo: Metas & Vendas (`/metas-vendas`)

Página estratégica que centraliza configuração de metas e projeções.

**Conteúdo:**
- Meta de faturamento mensal
- Ticket médio
- Taxa de conversão (lead→reunião, reunião→venda)
- Dias úteis no mês
- **Projeção automática** (calculada): nº de vendas, reuniões, conversas, leads necessários
- Cards de progresso atual vs meta

**Fonte de dados:** reutiliza `useCommercialGoals`, `useTeamPerformance`, e a tabela `commercial_goals` já existente. Cria/edita metas via UI.

## 2. Novo módulo: Rotina Inteligente (`/rotina`)

Página de execução diária do SDR. **Não é agenda fixa** — gerada dinamicamente.

**Conteúdo:**
- **Missões do dia** (reutiliza `MissoesDoTurno` já existente)
- **HUD do dia** (reutiliza `CockpitHUD`)
- Distribuição por canal: ligações, WhatsApp, e-mail, Instagram (cards com nº alvo + nº realizado)
- Alertas: leads parados, follow-up atrasado (reutiliza `useFollowUpData`)
- Mini-ranking SDR (reutiliza `useLeaderboard`)

**Motor de cálculo (`useRotinaCalculator`):**
- Lê: meta ativa + taxas de conversão + pipeline atual
- Calcula: ligações/dia, follow-ups/dia, novos contatos/dia
- Recalcula: ao abrir a página + 1x/dia (cache local com timestamp)
- Sem novas tabelas — tudo derivado em runtime

## 3. Ajustar Grow Machine (`/prospeccao`)

Reduzir para **execução pura de prospecção**.

**Manter:** Cold Call, WhatsApp, Instagram, E-mail, Minha Fila, Painel do Gestor, ICP/Máquina/OTE (Sales Intelligence)

**Remover dali (movidos para os novos módulos):**
- `CockpitDoDia` / `TopoFoco` / Missões do turno → vão para Rotina Inteligente
- Configuração de metas / OTE estratégico → permanece em Metas & Vendas (link rápido)

Vou inspecionar `src/pages/Prospeccao.tsx` para identificar exatamente quais abas/blocos remover, preservando o resto.

## 4. Sidebar — nova ordem

```
📊 Metas & Vendas       (novo)
🧠 Rotina Inteligente   (novo)
🎯 Grow Machine         (existente, enxuto)
📞 Call Center
📈 BI / Relatórios
🎓 Treinamento
... demais itens preservados abaixo
```

Editar `src/components/layout/Sidebar.tsx` para adicionar os 2 itens novos no topo e manter o resto.

## 5. Rotas

Adicionar em `src/App.tsx`:
- `/metas-vendas` → `MetasVendas.tsx`
- `/rotina` → `RotinaInteligente.tsx`

## Arquivos a criar

- `src/pages/MetasVendas.tsx`
- `src/pages/RotinaInteligente.tsx`
- `src/hooks/useRotinaCalculator.ts` (motor: meta + conversão → metas diárias por canal)
- `src/components/rotina/CanaisDistribuicao.tsx` (cards por canal)
- `src/components/metas/ProjecaoAutomatica.tsx` (cálculo reverso da meta)

## Arquivos a editar

- `src/App.tsx` — 2 rotas novas
- `src/components/layout/Sidebar.tsx` — 2 itens novos
- `src/pages/Prospeccao.tsx` — remover Cockpit/TopoFoco/Missões (vão para Rotina)

## Fora de escopo (próximo nível, conforme você listou)

- Gamificação avançada / IA ajustando rotina / score automático de leads — deixo para depois.

Posso executar?
