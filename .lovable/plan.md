## 🎮 Sales Quest — Gamificação Cyberpunk do módulo Prospecção (MVP)

Transforma o módulo `/prospeccao` em uma experiência estilo HUD de jogo (tema sci-fi/cyberpunk: neon ciano, magenta, glow), mantendo 100% da engenharia atual (logs, KPIs, scripts, follow-up). XP é gerado automaticamente a partir das interações que o vendedor já registra.

---

### 🎨 Identidade visual cyberpunk
- Paleta: ciano neon (#00f0ff), magenta (#ff2bd6), violeta (#7a3cff), fundo grafite com grid sutil
- Bordas com `box-shadow` glow, fontes mono para números, animações scanline
- Ícones Lucide: `Zap`, `Target`, `Trophy`, `Crosshair`, `Cpu`, `Radar`, `ShieldCheck`, `Flame`
- Animações: `canvas-confetti` (level up/venda), toasts com slide-glow, barras de XP com gradiente animado

---

### 🧱 Banco de dados (1 migration)

**Tabelas novas (todas com RLS por `company_id` via `get_my_company_id()`):**

1. `prospecting_player_profile`  
   `user_id`, `company_id`, `level int default 1`, `xp_total int`, `xp_current int`, `class text` (hunter/closer/farmer/ranger), `title text`, `streak_days int`, `last_activity_date date`, `coins int`

2. `prospecting_quests`  
   `id`, `company_id` (NULL = global/template), `name`, `description`, `type` (daily/weekly/monthly), `goal_metric` (leads/responses/opportunities/meetings/sales/gross_value), `goal_value numeric`, `xp_reward int`, `coin_reward int`, `icon text`, `active bool`, `is_template bool`

3. `prospecting_quest_progress`  
   `user_id`, `quest_id`, `period_start date`, `current_value numeric`, `completed_at`, `claimed_at` (UNIQUE user+quest+period)

4. `prospecting_achievements`  
   `user_id`, `company_id`, `achievement_code text`, `unlocked_at`, `rarity` (common/rare/epic/legendary)

5. `prospecting_rewards_shop` (configurável; ativa/desativa por empresa)  
   `company_id`, `name`, `description`, `cost_coins`, `stock`, `active`, `requires_approval`

6. `prospecting_reward_redemptions`  
   `user_id`, `reward_id`, `status` (pending/approved/delivered/rejected), `notes`

**Triggers automáticas:**
- `AFTER INSERT/UPDATE on prospecting_interactions` → calcula delta de XP por outcome (responded=+5, opportunity=+15, meeting=+30, sale=+100 + valor/100), atualiza `xp_total`, `xp_current`, `level` (curva: `xp_needed = 100 * level^1.5`), seta `streak_days`
- Mesma lógica `AFTER INSERT/UPDATE on prospecting_daily_logs`
- Função `recalc_quest_progress(user_id, company_id)` chamada nas triggers — soma métricas do período da quest e marca `completed_at` quando bate a meta
- Função `unlock_achievement(user_id, code, rarity)` idempotente

**Function RPC:**
- `claim_quest_reward(quest_progress_id)` — credita XP + coins, marca `claimed_at`
- `get_player_dashboard(user_id)` — retorna profile + quests ativas + progresso + ranking semanal numa única chamada
- `get_company_leaderboard(company_id, period)` — top 10 da semana/mês

**Seed inicial (15 missões template + 20 conquistas):**
- Diárias: "Caçar 10 leads", "3 respostas hoje", "1 reunião agendada"
- Semanais: "30 oportunidades", "5 vendas", "R$ 5k em vendas"
- Mensais: "100 leads", "Top 3 do ranking", "R$ 50k bruto"
- Conquistas: First Blood, Combo x5, Velocista (50 leads/dia), Lobo Solitário (7 dias streak), Implacável (30 dias streak), Diamante (R$ 100k acumulado), Lenda (Nv 50), etc.

---

### 🧩 Hooks novos (`src/hooks/`)

- `usePlayerProfile.ts` — busca + realtime do profile do usuário logado
- `useActiveQuests.ts` — quests ativas + progresso, com mutation `claimReward`
- `useLeaderboard.ts` — ranking da empresa (week/month)
- `useAchievements.ts` — conquistas desbloqueadas + bloqueadas
- `useGamificationConfig.ts` — config da empresa (ativo? loja real ativa?)

---

### 🧱 Componentes novos (`src/components/prospeccao/rpg/`)

1. **`PlayerHeaderCard.tsx`** — Banner topo: avatar com moldura por rank, nome, classe, level, barra XP animada (gradiente ciano→magenta), streak 🔥, moedas 💎, botão "Ver Conquistas"
2. **`QuestBoard.tsx`** — Lista de quests ativas com barra de progresso, ícone neon, botão "RESGATAR" pulsante quando completa
3. **`RankLadder.tsx`** — Modal/seção mostrando os 6 ranks (Iniciado → Operador → Hunter → Veterano → Mestre → Lenda) com requisitos
4. **`WeeklyLeaderboard.tsx`** — Top 10 com pódio (1º glow dourado, 2º prata, 3º bronze), substitui/complementa `BenchmarkPanel`
5. **`AchievementsGallery.tsx`** — Grid de badges (desbloqueadas em cor + bloqueadas em silhueta com hint)
6. **`LevelUpModal.tsx`** — Modal full-screen ao subir nível, com confetti + áudio + classe nova
7. **`XpToast.tsx`** — Toast custom slide-in com `+XX XP` em estilo HUD
8. **`ClassicVsRpgToggle.tsx`** — Switch persistido em `localStorage` por usuário
9. **`RewardShop.tsx`** — Loja de recompensas (só renderiza se config da empresa estiver com loja real ativa)

---

### 🛠 Refator de `src/pages/Prospeccao.tsx`

- Header novo com `PlayerHeaderCard` quando modo RPG ativo
- Toggle "🎮 Modo RPG / 📊 Modo Clássico" no canto superior direito
- Renomear tabs em modo RPG: ⚔️ Caçada · 💰 Mercenário · 📜 Reforço · 🏆 **Arena** (novo) · 📖 Grimório
- Aba Arena nova: `WeeklyLeaderboard` + `AchievementsGallery` + `RankLadder`
- Sidebar direita: `QuestBoard` (substitui ou fica acima do `BenchmarkPanel`)
- Em modo Clássico: layout 100% atual permanece intacto

---

### ⚙️ Tela de configuração (gestor)

Nova rota: `/configuracoes/gamificacao` (`src/pages/ConfiguracoesGamificacao.tsx`)

- Toggle global "Ativar gamificação na empresa"
- Toggle "Ativar loja de recompensas reais" (com aprovação por gestor)
- Editor de pesos de XP (responded/opportunity/meeting/sale_closed)
- CRUD de missões customizadas (clonar das 15 templates ou criar do zero)
- CRUD da loja de recompensas (folga, vale, bônus, etc.)
- Botão "Resetar temporada" (zera ranking semanal/mensal sem apagar histórico)
- Listagem de pedidos de resgate pendentes para aprovação

Permissão: apenas `super_admin`, `company_admin` e `gestor`.

---

### 📦 Dependências novas
- `canvas-confetti` (já leve, ~7kb) para efeitos de venda/level up

---

### 📋 Resumo de arquivos
- **1 migration SQL** com 6 tabelas + triggers + RPCs + seed
- **5 hooks novos**
- **9 componentes RPG novos** + pasta `src/components/prospeccao/rpg/`
- **1 página nova** (`ConfiguracoesGamificacao.tsx`) + rota em `App.tsx`
- **1 refator** em `Prospeccao.tsx`
- **1 entrada de menu** em `Configurações`

---

### ✅ O que NÃO muda
- Tabelas `prospecting_daily_logs`, `prospecting_interactions`, `prospecting_scripts`, `prospecting_followup_logs` permanecem idênticas
- Componentes existentes (`ProspeccaoKPIs`, `ProspeccaoTable`, `ProspeccaoCharts`, `FollowUp*`, `BenchmarkPanel`, `ScriptLibrary`, `InteractionTimeline`) ficam intocados — são apenas reembrulhados visualmente
- Nenhum dado existente é migrado/destruído
- Modo Clássico sempre disponível com 1 clique