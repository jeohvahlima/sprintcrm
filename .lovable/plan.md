## Visão

Transformar o CRM em um **cockpit operacional verde Waze** com sensação de missão, progresso e jogo. Foco em SDR/Closer, sem quebrar funcionalidades existentes.

Vou trabalhar em **fases entregáveis**. Cada fase é independente e usável — você aprova ou ajusta antes de seguir.

---

## O que JÁ existe (vou reutilizar, não recriar)

- `prospecting_gamification_config` — regras de XP por ação
- `add_player_xp`, `unlock_achievement`, `recalc_quest_progress` — engine de XP
- `prospecting_player_profile` — XP/level/coins do jogador
- `prospecting_daily_logs` + triggers automáticos (`tg_xp_from_daily_log`, `tg_xp_from_interaction`, `tg_xp_from_call`) — já geram XP de ligações, conversas, vendas
- `useDailyFocus`, `useLeaderboard`, `usePlayerProfile`, `useCommercialGoals`, `useActiveQuests`, `useAchievements`
- `TopoFoco` (Meta do Dia / Perda / Posição) já implementado em `src/components/prospeccao/foco/`
- `RotinaInteligente` com quadro semanal recém criado

## O que vou CRIAR (mínimo necessário)

- `daily_missions` — missões por turno (manhã/tarde/noite), por role
- `daily_mission_progress` — execução diária por usuário
- `daily_checklists` — checklist interno por bloco da agenda
- Vista materializada / função `get_player_dashboard(user_id)` agregando XP do dia, streak, missões e ranking em 1 chamada

---

## Fase 1 — Cockpit de Prospecção (esta entrega)

**Escopo:** página `/prospeccao` vira o cockpit.

1. **Header de Missão (HUD)** acima das abas — sticky, sempre visível:
   - Meta do dia (barra de progresso animada)
   - XP de hoje + nível + barra para próximo nível
   - Streak 🔥 (dias seguidos batendo meta)
   - Energia do SDR (alta/média/baixa — toggle)
   - Posição no ranking + diff para o #1
2. **Bloco "Próxima Missão"** com CTA único destacando a ação prioritária agora (próximo bloco da rotina, lead urgente ou follow-up atrasado).
3. **Agenda Inteligente redesenhada** (timeline viva):
   - Cards maiores com respiro, cor por categoria (verde prospecção, amarelo follow-up, azul reunião, roxo treino, cinza pausa)
   - Checklist interno por bloco
   - Indicador de "agora", tempo restante, % concluído
   - Cor de borda lateral por prioridade
4. **Painel "Como foi meu dia?"** ao fim do expediente — captura foco, objeções, dificuldades.
5. **Feed de performance da equipe** lateral (compactado) — "🔥 João bateu 42 abordagens".

**Mexe em:** `src/pages/RevenueEngine.tsx` (ou onde mora `/prospeccao`), `src/components/prospeccao/RotinaInteligente.tsx`, `src/components/prospeccao/foco/*`, novos componentes em `src/components/prospeccao/cockpit/`.

**Migração:** tabelas `daily_missions`, `daily_mission_progress`, `daily_checklists` + RLS por `company_id`.

---

## Fase 2 — Gamificação completa

- Tela `/gamificacao` com:
  - Carteira de XP e moedas
  - Mural de conquistas (locked/unlocked, raridade)
  - Quests ativas com barra de progresso
  - Ranking semanal/mensal com pódio
  - Histórico de eventos de XP
- Toast de XP ao concluir ação ("+15 XP — CRM atualizado")
- Animação de level up

## Fase 3 — Funil de Vendas modo cockpit

- Kanban com indicadores visuais de calor por coluna
- Cards de lead com prioridade, idade, próximo passo
- "Foco do dia" no funil — leads que exigem ação agora

## Fase 4 — Conversas modo execução

- Header com SLA do contato
- Sugestão de próxima frase (IA)
- Score do lead visível

## Fase 5 — Painel do Gestor

- Visão de equipe (performance, gargalos, ranking)
- Alertas de underperformance
- Comparativo período x período

---

## Stack visual (Verde Waze — já no projeto)

- Primary `142 71% 45%` (#22C55E)
- BG dark `160 35% 5%`
- Tokens semânticos via `index.css` + `tailwind.config.ts` (já existem)
- Animações: `framer-motion` para barras de progresso, level up, conquistas
- Ícones: `lucide-react` (já no projeto)

---

## Detalhes técnicos (para referência)

### Nova migração (Fase 1)

```sql
CREATE TABLE public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  role_target TEXT,             -- 'sdr' | 'closer' | NULL (ambos)
  shift TEXT NOT NULL,          -- 'manha' | 'tarde' | 'noite'
  weekday SMALLINT,             -- 0-6, NULL = todo dia
  xp_reward INT DEFAULT 25,
  active BOOLEAN DEFAULT true,
  ...
);

CREATE TABLE public.daily_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES daily_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending',  -- pending | done | skipped
  completed_at TIMESTAMPTZ,
  UNIQUE(mission_id, user_id, log_date)
);

CREATE TABLE public.daily_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  block_key TEXT NOT NULL,    -- referência ao bloco da rotina
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(user_id, block_key, log_date)
);
```

RLS: SELECT/INSERT/UPDATE só na própria `company_id`. Conclusão de missão chama `add_player_xp` via trigger.

### Componentes novos (Fase 1)

```
src/components/prospeccao/cockpit/
  CockpitHUD.tsx          # Header sticky com XP, meta, streak, energia
  ProximaMissaoCard.tsx   # CTA único da próxima ação
  AgendaTimelineViva.tsx  # Timeline redesenhada
  AgendaBlocoCard.tsx     # Card de bloco com checklist
  MissoesDoTurno.tsx      # Lista de missões manhã/tarde/noite
  FimDeDiaDialog.tsx      # "Como foi meu dia?"
  FeedPerformance.tsx     # Mural lateral da equipe
```

---

## Próximo passo

Se aprovar, **começo já pela Fase 1** (migração + cockpit + agenda redesenhada). Se quiser ajustar escopo ou ordem das fases, me diga antes do build.