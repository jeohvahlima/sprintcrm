
# Refatoração: Visual RPG → Corporativo Moderno (Prospecção)

## Objetivo
Trocar a estética "joguinho RPG" (neon ciano/magenta, fontes mono, termos como Caçada/Mercenário/Arena/Hunter, "Nv 1", "ASCENSÃO ▲", confetti) por um visual **corporativo moderno** estilo Linear / Attio / Notion — **mantendo 100% da mecânica de gamificação** (níveis, pontos, ranking, metas, conquistas, comissão), apenas com nova embalagem visual e linguagem profissional.

## Princípios
- **Lógica preservada**: nenhuma alteração em hooks (`usePlayerProfile`, `useCommercialGoals`, `useTeamPerformance`, `useProspectingQueue`), tabelas, RPC ou regras de negócio.
- **Mudança é só de UI**: CSS, copy, ícones e nomes de abas.
- **Coerência com o resto do CRM**: alinhar com a estética já usada em Conversas, Funil, Financeiro.

## Renomeação de termos (UI/copy)

| Antes (RPG) | Depois (Corporativo) |
|---|---|
| ⚔️ Caçada | 📊 Visão Geral |
| 💰 Mercenário | 🎯 Pipeline Pago |
| 📜 Reforço | 🔁 Follow-ups |
| 🎯 Minha Fila | 📋 Minha Fila |
| 📥 Caixa Closer | 📥 Leads Qualificados |
| 🎖️ Comando | 📈 Painel do Gestor |
| 🏆 Arena | 🏆 Ranking |
| 🎮 Missões Ativas | ✅ Metas do Dia |
| Equipe · Lobby | 👥 Equipe Online |
| Arena · Top Operadores | 🏆 Top Performers |
| Nv 1 / XP / Ascensão | Nível 1 · 240/500 pts · "Subiu de nível" |
| Hunter / Closer / Farmer / Ranger | SDR / Closer / Farmer / Account |
| Bronze/Prata/Ouro/Platina/Diamante/Mítico | Iniciante / Pleno / Sênior / Expert / Master / Elite |
| "Operador" / "Lobo Alfa" / "ascendeu" | "Vendedor" / "Top performer" / "subiu de nível" |
| `[ VOCÊ ESTÁ AQUI ]` | "Sua posição atual" |
| Kill Feed | Atividade em tempo real |
| Reward Shop | Loja de recompensas |
| Quest Board | Metas e desafios |

## Mudanças visuais (CSS)

**Remover/desativar:**
- Fundo `rpg-hex-bg` (grid hexagonal animado)
- `rpg-particle` (partículas flutuantes)
- `rpg-glow-cyan/magenta/gold` (sombras neon saturadas)
- `rpg-scanline` (efeito CRT)
- `rpg-text-mono` (JetBrains Mono em tudo) → usar Inter/sans padrão do CRM
- Cores neon `#00f0ff` / `#ff2bd6` / `#7a3cff` como primárias
- Confetti + animação "ASCENSÃO ▲" do `LevelUpModal`
- Bordas piscantes `rpg-pulse`, `rpg-frame-rotate`
- Avatares com frame neon hexagonal (`ClassAvatar`)

**Substituir por (alinhado ao design system do CRM):**
- Fundo: `bg-background` neutro (sem grid)
- Cards: `bg-card border border-border rounded-lg shadow-sm` (padrão shadcn)
- Cores de destaque: tokens semânticos (`primary`, `accent`, `muted`) — sem neon
- Tipografia: Inter para tudo, peso 600 em títulos
- Avatares: redondos padrão com borda fina, badge de nível discreto no canto
- Progresso: `<Progress>` do shadcn com cor primária (sem barra animada de XP)
- Ranks: badges sólidos discretos com gradiente sutil (não neon)
- Level up: `toast` elegante "🎉 Você subiu para Nível X" — sem confetti, sem modal full-screen

## Arquivos a editar

**Página principal:**
- `src/pages/Prospeccao.tsx` — renomear todas as labels, remover `rpg-hex-bg`, `rpg-card`, `rpg-text-mono`, `rpg-neon-*`, substituir por classes shadcn padrão.

**Componentes RPG (refatorar mantendo nome do arquivo para não quebrar imports):**
- `rpg/ArenaTopBar.tsx` → renderizar como "Top Performers" com cards limpos
- `rpg/PlayerHeaderCard.tsx` → card de perfil corporativo (avatar redondo + nível + pontos + meta)
- `rpg/ClassAvatar.tsx` → avatar redondo padrão com badge de nível discreto
- `rpg/LevelUpModal.tsx` → substituir por toast simples (manter componente como wrapper opcional)
- `rpg/RankLadder.tsx` → "Trilha de Carreira" com badges corporativos
- `rpg/QuestBoard.tsx` → "Metas e Desafios" com checklist limpo
- `rpg/AchievementsGallery.tsx` → "Conquistas" com cards minimalistas
- `rpg/WeeklyLeaderboard.tsx` → "Ranking Semanal" tipo tabela
- `rpg/TeamLobbyPanel.tsx` → "Equipe Online" com lista de avatares
- `rpg/KillFeed.tsx` → "Atividade Recente" com timeline limpa
- `rpg/RewardShop.tsx` → "Loja de Recompensas" com cards de produtos
- `rpg/ClassicVsRpgToggle.tsx` → **remover** (não há mais dois modos)

**Configurações:**
- `src/pages/ConfiguracoesGamificacao.tsx` — renomear "RPG"/"Classes" para "Gamificação"/"Cargos"
- `src/hooks/usePlayerProfile.ts` — renomear `getRankByLevel` para retornar nomes corporativos (Iniciante/Pleno/Sênior/Expert/Master/Elite) mantendo a mesma lógica de níveis

**CSS:**
- `src/index.css` — remover bloco de classes `.rpg-*` (linhas ~593-741) ou neutralizar para usar tokens do design system. Manter apenas utilitários genéricos se reaproveitados.

## Gamificação preservada (vísivel ao usuário)
- ✅ Ranking da equipe (leaderboard semanal/mensal)
- ✅ Barra de progresso de meta diária (HUD discreto no topo)
- ✅ Níveis e pontos do operador (badge no avatar e card de perfil)
- ✅ Conquistas/badges silenciosas (toast discreto, sem confetti)
- ❌ Removido: scanlines CRT, partículas, neon glow, fonte mono, confetti, "ASCENSÃO"

## Detalhes técnicos
- Usar exclusivamente tokens semânticos do `index.css` (`--primary`, `--accent`, `--muted`, `--card`, `--border`)
- Componentes shadcn padrão: `Card`, `Badge`, `Progress`, `Avatar`, `Tabs`
- Ícones: lucide-react sem emoji nos títulos das abas (manter emojis discretos só onde já fazem sentido em CRMs corporativos, ex: 🏆 ranking)
- Toast via `sonner` para level up
- Manter compatibilidade com `gamificationOn` flag — se desligado, esconde elementos de ranking/pontos mas mantém layout

## Fora de escopo
- Nenhuma mudança em banco de dados, RPCs ou edge functions
- Nenhuma mudança nas mecânicas de XP, comissão, handoff, fila
- Não mexer em outros módulos (Conversas, Funil, etc.) — já estão corporativos

## Resultado esperado
Módulo Prospecção com aparência **profissional, limpo e vendável** para diretores comerciais B2B, mantendo todo o engajamento da gamificação por meio de ranking, metas visíveis e progressão de nível — sem visual de "joguinho".
