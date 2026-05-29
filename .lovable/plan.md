# Plano: Adaptação Clínica do Grow OS

Refatorar funcionalidades **já existentes** para o contexto de clínica. Sem novos módulos, sem duplicação. Foco em naming, UX, automações e gating por segmento (`useCompanySegmento`).

## Princípios

- Toda mudança é **condicional** a `isClinica` (via `useCompanySegmento`). Empresas de agência continuam vendo nomes comerciais.
- Reaproveitar: `useFollowUpEsteira`, `useFollowUpFunnel`, `useWorkflowAutomation`, `clinicaLabels.ts`, perfil de lead existente, BI atuais.
- Backend permanece intacto onde possível. Quando necessário, apenas seeds/templates novos (não tabelas novas).

## Entregas por frente

### 1. Pós-consulta (refatora Follow-up)
- `EsteiraFollowUp.tsx` e `FunilFollowUp.tsx`: título "Follow-up" → "Pós-consulta" quando `isClinica`.
- Trigger automático: ao mover lead para etapa cujo nome contém "Atendido"/"Procedimento Realizado", criar entry na esteira via `useFollowUpEsteira.addEntry` (hook em `Funil`/`Kanban` no `onStageChange`).
- Cadência padrão clínica (seed em `follow_up_cadence`): D0 acompanhamento, D1 dúvida, D7 retorno — só insere se a empresa for clínica e ainda não houver cadência.

### 2. NPS (usa formulários existentes)
- Template padrão "NPS Pós-consulta" salvo em `commercial_scripts`/templates de mensagem existentes.
- Adicionar campo `nps_score` (0-10) no `LeadValueEditor`/perfil; persistir em `leads.custom_fields` (JSONB já existe) — sem nova tabela.
- Exibir badge NPS no header do perfil do paciente.

### 3. Reativação (automação existente)
- Seed de regra em `workflow_automation`: trigger "lead sem `last_interaction_at` há 30 dias" → ação "enviar template".
- Criar 2-3 templates de reativação em `message_templates` (categoria "reativacao_clinica").

### 4. Prontuário (expande perfil)
- No `EditarLeadDialog`/perfil do lead: aplicar `leadLabel(isClinica)` → "Paciente".
- Adicionar 3 seções colapsáveis no mesmo dialog: **Histórico** (já existe `interactions`), **Observações** (campo `notes` existente), **Procedimentos** (lista derivada de `interactions` tipo procedimento ou `custom_fields.procedimentos`).
- Sem módulo novo, sem rota nova.

### 5. BI Clínico (unifica)
- `Sidebar`: quando `isClinica`, mostrar apenas `/bi-clinico`; ocultar `/analytics` e o BI de `/financeiro`.
- `BIClinico.tsx`: garantir 4 cards — consultas, comparecimento, faltas, faturamento estimado (já existe `useBIClinico`; complementar o que faltar a partir de `leads` + `etapas`).

### 6. Qualificação clínica (campos custom)
- Template de qualificação salvo em `custom_field_templates` (ou seed em `company_settings`): `tipo_procedimento`, `urgencia`, `origem`.
- Renderizar no `EditarLeadDialog` quando `isClinica`.

### 7. Script de atendimento (templates existentes)
- Seed em `message_templates` (categoria "script_clinica"): abertura, qualificação, fechamento.
- No chat (`Conversas.tsx` → `QuickMessages`), filtrar categoria e exibir grupo "Scripts clínicos" quando `isClinica`.

### 8. Confirmação de consulta
- Em `useAgendaNotifications`/automação de agenda: regras 24h e 2h antes (se não existirem, adicionar via seed em `workflow_automation`).
- Botão `[Confirmar presença]` no card de agendamento (`AgendaDayView`/`AgendarRetornoDialog`) chamando ação já existente de update de status.

### 9. No-show
- No card de lead em etapa "Não Compareceu": botões `[Reagendar]` (abre `AgendarRetornoDialog`) e `[Enviar mensagem]` (abre conversa).
- Em `RotinaInteligente`/`useRotinaClinica`: já existe `resgatarNoShow`; expor como "Faltantes de hoje" com CTA direto.

### 10. Jornada (rename de etapas)
- Função utilitária `clinicaStageLabel(nome)` que mapeia: Lead→Paciente, Novo Lead→Novo paciente, Negócio→Atendimento, Ganho→Atendido, etc.
- Aplicar no Kanban/Funil render (não altera dados no banco).
- Template de funil clínico (`clinicaFunnelTemplate.ts` já existe) usado no onboarding para criar etapas: Novo paciente → Em atendimento → Agendado → Confirmado → Atendido → Retorno.

## Mudanças técnicas (resumo)

**Arquivos a editar (frontend):**
- `src/lib/clinicaLabels.ts` (expandir com `stageLabel`, `followUpLabel`, etc.)
- `src/components/prospeccao/followup/EsteiraFollowUp.tsx`, `FunilFollowUp.tsx`
- `src/components/funil/*` (LeadCard, EditarLeadDialog, DroppableColumn — naming + botões no-show)
- `src/components/leads/EditarLeadDialog` e `LeadCard`
- `src/components/layout/Sidebar.tsx` (gating BI)
- `src/pages/BIClinico.tsx` (completar 4 cards)
- `src/pages/Conversas.tsx` (scripts clínicos no chat)
- `src/components/agenda/*` (botão confirmar)
- Hook novo: `useClinicaSeeds.ts` — roda 1x por empresa clínica, idempotente, semeia cadência pós-consulta, templates de reativação, scripts e regras de confirmação.

**Migrações (mínimas, idempotentes):**
- Nenhuma tabela nova. Apenas garantir colunas `category` em `message_templates` (se não existir) e índice em `leads.last_interaction_at`. Tudo via 1 migração curta.

**Sem mudanças:** rotas, schema de funnel, lógica de workflow engine, edge functions.

## Ordem de execução

1. Expandir `clinicaLabels.ts` + criar `clinicaStageLabel`.
2. Gating na `Sidebar` (BI único, esconder termos comerciais).
3. Refator Follow-up → Pós-consulta (UI + trigger no Kanban).
4. Perfil do paciente (seções Histórico/Observações/Procedimentos + NPS + qualificação).
5. Botões no-show + confirmação na agenda.
6. Seeds idempotentes (`useClinicaSeeds`): cadência, templates reativação, scripts, regras 24h/2h.
7. BI Clínico: completar cards faltantes.

## Critérios de aceite

- Empresa com `segmento = 'clinica'`: vê "Paciente", "Pós-consulta", "Atendimento", 1 só BI, scripts no chat, botões no-show/confirmação, NPS no perfil.
- Empresa de agência: **zero alteração visível**.
- Sem novas rotas. Sem novas tabelas. Backend de automação/funil intacto.