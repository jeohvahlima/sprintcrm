## Evolução do GMI → GROW Revenue Intelligence

Hoje o GMI tem 5 pilares (Processos, Prospecção, Gestão, Automação, Pessoas) calculados a partir de dados do CRM. Vou adicionar uma camada de **autodiagnóstico guiado** com 4 novos blocos focados em clínicas, sem quebrar o que já existe.

### 1. Novos pilares (peso configurável no score)

| Pilar | Mede | Tipo |
|---|---|---|
| **Aquisição & Marketing** | Canais de origem (Instagram, Google, indicação, ads, orgânico, convênio), investimento mensal em tráfego, CPL, CAC, ROI, dependência de canal único | Wizard |
| **Social Selling** | Instagram comercial: tempo de resposta, CTA, prova social, stories diários, antes/depois, autoridade, ponte para WhatsApp | Wizard |
| **Dependência Operacional** | Continuidade se a secretária sair, scripts documentados, processos escritos, dono acompanha indicadores, rotina comercial | Wizard |
| **Crescimento Travado** | Faturamento estagnado X meses, teto operacional, gargalo de gestão vs marketing vs atendimento | Wizard |

O score total passa de 100 para **100 normalizados** (peso ajustado). Os 5 pilares antigos continuam contribuindo do CRM; os 4 novos vêm do wizard.

### 2. Novo módulo "Diagnóstico Guiado"

Nova aba dentro de `/maturidade` chamada **Diagnóstico Guiado** com:

- Wizard em etapas (uma por pilar novo), ~4–6 perguntas por etapa
- Tipos de pergunta: escala 0–5, sim/não, múltipla escolha, slider de R$
- Barra de progresso, possibilidade de pular e voltar depois
- Ao concluir → calcula sub-score e injeta no GMI

### 3. Diagnóstico de tráfego desperdiçado

Componente dedicado dentro do bloco Aquisição que cruza:
- Investimento informado em ads
- Leads recebidos no CRM por origem
- Conversão lead → consulta → procedimento

E mostra em destaque: **"você investiu R$ X, R$ Y virou paciente, R$ Z foi desperdiçado em lead frio / sem follow-up / sem resposta rápida"** — apontando se a culpa é tráfego ou operação.

### 4. Reposicionamento do discurso da IA

No `advisor-ai` (edge function) e nos textos do `Diagnostico360` / `PlanoIARenderer`:
- Trocar menções a "IA / inteligência artificial" por: **"resposta instantânea, redução de no-show, recuperação de pacientes, confirmação automática de consultas"**
- Adaptar copy para clínicas (paciente, consulta, retorno, no-show) quando `segmento = clinica_medica/estetica/odonto/derma`

### 5. Reorganização visual do GMI (5 blocos GRI)

O Radar e os cards do `/maturidade` passam a agrupar os 9 pilares em 5 áreas:

```
Aquisição    → Aquisição & Marketing + Social Selling
Conversão    → Prospecção + Processos
Operação     → Gestão + Pessoas + Dependência
Retenção     → (novo) recompra, retorno, LTV (já existe na base)
Inteligência → Automação + Crescimento Travado
```

---

## Detalhes técnicos

### Banco
- Nova tabela `wmi_guided_responses` (company_id, pilar, respostas jsonb, score, completed_at) com RLS por `get_my_company_id()`
- Adicionar colunas `pillar_aquisicao`, `pillar_social`, `pillar_dependencia`, `pillar_crescimento` em `wmi_assessments`
- Atualizar RPC `calculate_wmi_score` para incluir os 4 novos pilares quando houver respostas
- Nova RPC `get_traffic_waste_diagnosis(company_id)` cruzando ads_spend ↔ leads ↔ conversões

### Frontend
- `src/components/wmi/GuidedDiagnosisWizard.tsx` (novo)
- `src/components/wmi/pillars/AcquisitionStep.tsx`, `SocialSellingStep.tsx`, `DependencyStep.tsx`, `GrowthBlockStep.tsx`
- `src/components/wmi/TrafficWasteCard.tsx` (novo)
- `src/hooks/useGuidedDiagnosis.ts` (novo)
- Atualizar `useWMI.ts` para os novos campos e `RadarPilares.tsx` para 9 eixos (ou agrupar em 5)
- Atualizar `Maturidade.tsx`: nova aba **"Diagnóstico Guiado"** entre Onboarding e Diagnóstico 360°
- Atualizar `PILLAR_META` e tipo `WMIScore`

### Edge function
- Atualizar `advisor-ai` para receber `guided_responses` e gerar plano referenciando aquisição/social/dependência
- Reescrita de copy clínica condicional ao segmento

### Sem quebrar nada
- Migration adiciona colunas com `DEFAULT 0` → registros antigos continuam válidos
- Wizard é opcional; quem não responder mantém score só dos 5 pilares originais
- Tipos atualizados via migração; nenhum endpoint existente muda assinatura

---

**Quer que eu comece pela migration + wizard de Aquisição (passo mais impactante) e depois adicione os outros 3 pilares em sequência?** Ou prefere que eu faça tudo de uma vez (mais demorado, mas entrega o pacote completo numa rodada só)?