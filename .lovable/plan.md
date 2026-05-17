
# Revenue Intelligence BI — Tirando a dúvida e plano de evolução

## 1. Por que parece “com pouco valor”

A tela que você vê na **Visão Geral** mostra apenas **4 KPIs principais** (Receita, Ticket Médio, Perda Estimada, Pipeline Aberto) + funil + receita por mês. O restante da inteligência **já existe**, mas está distribuído nas outras 7 abas (Receita & Funil, Perdas Ocultas, Performance, Forecast & Metas, Campanhas/ROI, Growth Score, IA Insights) — e mesmo assim **faltam métricas centrais da metodologia GROW** que prometemos no Diagnóstico 360° e no GMI Score.

Em resumo: a página é uma fotografia parcial. Os dados existem no banco (leads, compromissos, campanhas, custos, metas), mas o hook `useGrowSalesBI` calcula só uma fração deles.

---

## 2. O que a metodologia GROW define como “número que importa”

Nosso Diagnóstico GROW + GMI Score já mede 5 pilares e o usuário espera vê-los traduzidos em **dinheiro** no BI:

| Pilar GROW | Indicadores financeiros que devem aparecer no BI |
|---|---|
| **Aquisição & Marketing** | Investimento em mídia, CPL, CAC, ROAS por canal, % receita por canal, dependência de canal único |
| **Processos Comerciais** | Ciclo médio de vendas (dias), tempo médio por etapa, Win Rate, Sales Velocity, SLA 1ª resposta |
| **Gestão Comercial** | Receita realizada vs meta, Forecast ponderado (30/60/90), gap para meta, projeção fim de mês |
| **Automação & Resposta** | % leads sem 1ª resposta, % sem follow-up 7d, recuperável 30d, no-show recuperável |
| **Pessoas & Performance** | Receita/vendedor, ramp-up, capacidade (leads por vendedor), ranking, atividades/dia |
| **Crescimento & LTV** | LTV, LTV/CAC, Payback de CAC, % receita recorrente, % receita novos vs base, Curva ABC clientes/produtos |

Hoje o BI cobre bem **Perdas Ocultas** e **Funil**, parcialmente **Performance** e **Forecast**, e tem buracos grandes em **Aquisição (CAC/ROAS)**, **Ciclo**, **LTV/CAC** e **Cohort**.

---

## 3. O que está faltando vs. o que já temos

### Já existem na página
- Receita bruta, ticket médio, deals fechados
- Funil 4 etapas (Lead → Agenda → Compareceu → Fechou) + gargalo
- Perdas: no-show, sem resposta, sem follow-up, perdidos
- Performance SDR e Closer
- Pipeline aberto, Forecast 30/60/90 ponderado
- Receita por canal, por vendedor, por mês
- Growth Score (7 dimensões) e IA Insights por regra

### Faltando (mas há dados no banco)
1. **CAC real por canal** — temos `meta_ads_spend` / `campaigns.spend` no `useRevenueEngine`, mas o `useGrowSalesBI` ignora.
2. **ROAS e CPL por campanha** dentro do BI (já calculado em `RevenueEngine.tsx`, falta unificar).
3. **LTV/CAC ratio** e **Payback de CAC** (meses para recuperar CAC).
4. **Ciclo médio de vendas em dias** (created_at → won_at) e **tempo médio por etapa** (já temos `bottlenecks` em `useRevenueEngineMetrics`).
5. **Sales Velocity** = (Oportunidades × Ticket × Win Rate) / Ciclo.
6. **Win Rate global e por etapa** (hoje só mostra conv. fechamento).
7. **Comparativo vs período anterior** (Δ% receita, Δ ticket, Δ conversão) — essencial para “BI”.
8. **% receita recorrente vs nova venda** (LTV multi-deal já está pronto na tabela `leads_origem_id`).
9. **Curva ABC de clientes e produtos** (já existe `CurvaABCEditor` e `ProductsAnalytics`, faltam KPIs aqui).
10. **Cohort de leads por mês de entrada** (quantos % fecharam em 30/60/90 dias).
11. **SLA de 1ª resposta** (tempo médio até primeira mensagem) — métrica norte do GROW.
12. **Projeção fim de mês** (run-rate × dias úteis restantes) com cenário Conservador/Realista/Otimista.
13. **Heatmap horário/dia melhor para fechar** (já temos `created_at`/`won_at`).
14. **Concentração de receita** (top 3 clientes/canais representam X% — alerta de dependência, pilar “Dependência Operacional”).
15. **Investimento total em mídia e mix** (somado de `campaigns.spend`) — hoje só aparece na página RevenueEngine separada.

---

## 4. O que vamos fazer (3 entregas)

### Entrega 1 — Enriquecer a Visão Geral (rápido)
Adicionar à aba **Visão Geral** um bloco “Saúde Financeira GROW” com 8 KPIs em vez de 4:

```text
[ Receita ] [ Ticket Médio ] [ LTV ] [ LTV/CAC ]
[ CAC ] [ ROAS ] [ Win Rate ] [ Sales Velocity / dia ]
```

E uma linha “Δ vs período anterior” em cada card (verde/vermelho).

### Entrega 2 — Nova aba “GROW Score Financeiro”
Cruzar os 5 pilares do GMI com valores em R$:

- Aquisição: investimento, CPL, ROAS, % receita por canal, **alerta de dependência** (canal > 60%).
- Processos: Ciclo médio (dias), tempo por etapa, Win Rate por etapa.
- Gestão: Realizado vs Meta, Forecast ponderado, **projeção fim de mês 3 cenários**.
- Automação: SLA 1ª resposta, % sem follow-up, **recuperável em R$**.
- Pessoas: receita/vendedor, capacidade, ramp-up dos novos.

Cada pilar com um mini-score 0–100 e o valor monetário traduzido.

### Entrega 3 — Análises avançadas
Adicionar nas abas existentes:
- **Receita & Funil**: comparativo período anterior, % receita recorrente vs nova, Curva ABC de clientes.
- **Campanhas/ROI**: trazer pra cá os dados de `useRevenueEngineMetrics` (CPL/ROI/Spend por campanha) e unificar com o que já existe — fim da duplicação entre `/revenue-engine` e o BI.
- **Performance**: SLA 1ª resposta por vendedor, atividades/dia, ciclo médio por vendedor.
- **Forecast & Metas**: run-rate + 3 cenários de fechamento de mês.
- **Perdas Ocultas**: cohort “entraram em janeiro e ainda estão abertos” + heatmap horário.

---

## 5. Detalhe técnico (para o próximo loop)

Arquivos envolvidos (sem editar agora — modo plano):

- `src/hooks/useGrowSalesBI.ts` — adicionar:
  - cálculo de `cac`, `roas`, `cpl` (juntar `campaigns.spend` via `useRevenueEngineMetrics`)
  - `ciclo_medio_dias` (média de `won_at - created_at`)
  - `sales_velocity = (#abertos × ticketMedio × winRate) / cicloMedio`
  - `previousPeriod` (mesma janela imediatamente anterior) para deltas
  - `cohorts` por mês de entrada
  - `sla_primeira_resposta` (tabela `lead_events` ou `interactions`)
  - `concentracao_receita` (top 3 / total)
  - `curva_abc_clientes`
- `src/pages/GrowSalesBI.tsx` — adicionar nova aba `GROW Score Financeiro`, blocos comparativos e cards de CAC/LTV/Velocity.
- Unificar com `src/pages/RevenueEngine.tsx` (que hoje fica solto) — mover campanhas/ROI para dentro do BI e deprecar a página separada (ou deixar como atalho).
- Confirmar que as queries seguem paginação `.range()` (já segue) e que campos `meta_ads_spend`, `expected_close_date`, `probability` estão preenchidos — caso contrário a IA Insights deve sinalizar “sem dado para esse KPI” em vez de mostrar 0.

---

## 6. Sua decisão agora

Se aprovar o plano, na implementação eu começo pela **Entrega 1 + Entrega 2** (impacto visível imediato com CAC, LTV/CAC, ROAS, Ciclo, Velocity, comparativo período anterior e a aba GROW Score Financeiro). Entrega 3 entra em sequência.
