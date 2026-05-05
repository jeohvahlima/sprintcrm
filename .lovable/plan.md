## Objetivo

Transformar o card "Impacto Financeiro / Custo da Inação" (aba Diagnóstico 360°) em uma **calculadora editável em tempo real** — sem precisar refazer todo o diagnóstico para testar cenários diferentes.

## O que muda

Hoje os valores são fixos, derivados do diagnóstico:
- Faturamento atual, Meta, Ticket médio
- Taxas de conversão (10% lead→reunião, 20% reunião→venda)
- Multiplicador de captação fraca (1x / 2x / 3x)
- % de recuperação esperada (30% a 70%)

Tudo isso passa a ser **ajustável via inputs/sliders** dentro do próprio card, com recálculo instantâneo de:
- Perda diária / semanal / mensal / anual / 90 dias
- Leads não gerados, reuniões perdidas, vendas perdidas
- Cenário "se nada mudar" vs "com solução"
- Conclusão estratégica (números do parágrafo se atualizam ao vivo)

## UX proposto

Adicionar no topo do componente um painel **"⚙️ Ajustar premissas da calculadora"** (colapsável, fechado por padrão para não poluir):

```text
┌─ Ajustar premissas ──────────────────────── [▼] ┐
│ Faturamento atual  [R$ 3.000     ]              │
│ Meta de faturamento [R$ 30.000   ]              │
│ Ticket médio        [R$ 1.000    ]              │
│ Conv. lead→reunião  [====●==] 10%               │
│ Conv. reunião→venda [======●] 20%               │
│ Recuperação mín/máx [==●===●==] 30% – 70%       │
│ Multiplicador captação  ( ) 1x ( ) 2x (●) 3x    │
│                              [Restaurar padrão] │
└─────────────────────────────────────────────────┘
```

Os valores iniciais vêm do diagnóstico (como hoje). Qualquer edição apenas altera o **estado local** do card — não grava no banco nem invalida o diagnóstico salvo. Botão "Restaurar padrão" volta aos valores originais do diagnóstico.

Opcional (segunda iteração, se quiser): botão "💾 Salvar como cenário" para persistir variações nomeadas.

## Onde mexer

Único arquivo: `src/components/wmi/ImpactoFinanceiroExpandido.tsx`

1. Converter as constantes derivadas (`fatAtual`, `meta`, `ticket`, taxas, multiplicador, % recuperação) em `useState` inicializados a partir de `result`.
2. Adicionar bloco UI colapsável (usar `Collapsible` do shadcn já presente no projeto) com `Input` numérico para valores monetários e `Slider` para percentuais.
3. Mover os cálculos (`perdaMensalAjustada`, `vendasPerdidas`, etc.) para um `useMemo` que depende dos states.
4. Botão "Restaurar padrão" que reseta os states aos valores originais do `result`.
5. Formatação BRL nos inputs (parse on change).

Sem alterações de banco, RLS, edge functions ou outros componentes.

## Melhorias adicionais sugeridas (incluídas no escopo)

- Mostrar um **badge "Editado"** quando algum valor foi alterado em relação ao diagnóstico original, para o usuário lembrar que está vendo cenário simulado.
- Permitir editar também o **horizonte de projeção** (3 / 6 / 12 meses) no cenário "com solução".
- Adicionar campo **% de capacidade comercial usada** (visível na imagem 3) também editável.
