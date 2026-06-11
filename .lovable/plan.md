# Relatório de Perguntas — Maturidade Comercial

## Objetivo
Entregar um arquivo `.md` único com TODAS as perguntas usadas no módulo de Maturidade Comercial, incluindo opções de resposta e pesos/scores, organizado por bloco do diagnóstico.

## Escopo confirmado
1. **Diagnóstico 360** — 5 pilares (Processos, Prospecção, Gestão, Automação, Pessoas)
2. **Diagnóstico Guiado WMI** — 4 pilares (Aquisição, Social, Dependência, Crescimento)
3. **Maturidade do CRM** — critérios de auto-avaliação
4. **Maturidade da IA Comercial** — agentes e níveis

## Fontes que serão extraídas
- `src/components/wmi/Diagnostico360.tsx` — banco de perguntas dos 5 pilares
- `src/components/wmi/GuidedDiagnosisWizard.tsx` — perguntas do diagnóstico guiado
- `src/hooks/useDiagnostico360.ts` — schema/scoring do Diagnóstico 360
- `src/hooks/useEstruturacao.ts` — `CRM_CRITERIOS` e `AI_AGENTES` + níveis
- `src/components/wmi/CRMMaturityCheck.tsx` e `AIMaturityCheck.tsx` — opções de UI (níveis Desligado/Sugestivo/Automático)

## Estrutura do documento final
```text
Maturidade Comercial — Banco de Perguntas (vYYYY-MM-DD)
├── 1. Diagnóstico 360
│   ├── 1.1 Pilar Processos
│   │   └── Pergunta → Opções (rótulo + peso/score)
│   ├── 1.2 Pilar Prospecção
│   ├── 1.3 Pilar Gestão
│   ├── 1.4 Pilar Automação
│   └── 1.5 Pilar Pessoas
├── 2. Diagnóstico Guiado WMI
│   ├── 2.1 Aquisição
│   ├── 2.2 Social
│   ├── 2.3 Dependência de Founder
│   └── 2.4 Crescimento
├── 3. Maturidade do CRM (checklist + peso)
├── 4. Maturidade da IA Comercial (agentes × níveis)
└── Anexo: regras de score / classificação (Inicial / Estruturando / Previsível / Escalável)
```

## Passos de execução (após aprovação)
1. Ler integralmente os 6 arquivos-fonte acima (são ~3.200 linhas no total).
2. Extrair, sem alterar nada no app, cada array de perguntas, opções, `weight`/`score` e classificação final.
3. Gerar `/mnt/documents/maturidade-comercial-perguntas.md` com a estrutura acima, em PT-BR, formato pronto para leitura/auditoria.
4. Entregar via `<presentation-artifact>` para download direto.

## Nota
Nenhum arquivo do projeto será alterado — esta tarefa apenas lê o código e produz um artefato em `/mnt/documents/`.
