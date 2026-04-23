

## Distribuir o WAZE CRM em Android, iOS e Computador

Hoje o CRM roda apenas no navegador. Para que os usuários possam **instalar no celular e no computador**, existem dois caminhos — e o ideal é combinar os dois para cobrir todos os cenários.

---

### Caminho 1 — App Instalável (PWA) — Recomendado para começar AGORA

Transforma o CRM num app que pode ser **instalado direto pelo navegador** no Android, iPhone, Windows, Mac e Linux. Sem lojas, sem aprovação, sem custo.

- Funciona em todos os celulares e computadores
- Usuário instala em 2 toques: "Adicionar à tela de início"
- Ícone próprio, abre em tela cheia (sem barra do navegador)
- Atualiza sozinho quando você publica novidades
- Pronto em 1 etapa

**Limitação:** não fica nas lojas oficiais (Play Store / App Store).

### Caminho 2 — Apps Nativos para Play Store, App Store e Desktop

Empacotamento real para publicar nas lojas. Usa **Capacitor** (mobile) e **Electron** (desktop).

| Plataforma | Tecnologia | Onde publica |
|---|---|---|
| Android | Capacitor → APK/AAB | Google Play Store |
| iOS | Capacitor → IPA | Apple App Store |
| Windows / Mac / Linux | Electron → .exe / .dmg / .AppImage | Site próprio ou Microsoft Store |

**O que você precisa providenciar (eu não consigo fazer por você):**
- **Google Play:** conta de desenvolvedor Google (US$ 25, taxa única)
- **Apple App Store:** conta Apple Developer (US$ 99/ano) + um **Mac com Xcode** para gerar e enviar o build iOS
- **Android Studio** (gratuito) instalado na sua máquina para gerar o APK final
- Ícones do app em alta resolução, screenshots, descrição da loja, política de privacidade

**Importante:** as lojas **não aceitam** apps publicados diretamente da Lovable. Você precisa exportar o projeto para o GitHub, baixar no seu computador e fazer o build final localmente. Eu deixo tudo configurado, mas o "enviar para a loja" é manual.

---

### Minha recomendação: fazer em fases

**Fase 1 (agora, rápido):** Implementar PWA. Em poucos minutos seus clientes já instalam o CRM no celular e no computador.

**Fase 2 (quando quiser ir para as lojas):** Adicionar Capacitor para Android/iOS e Electron para desktop.

---

### O que vou fazer na Fase 1 (PWA)

1. Instalar `vite-plugin-pwa` e configurar para gerar o app instalável apenas em produção (não atrapalha o preview da Lovable)
2. Criar o `manifest.json` com nome "WAZE CRM", cor da marca e ícones
3. Gerar ícones PWA (192x192, 512x512, maskable) a partir do logo
4. Configurar service worker com **denylist para `/~oauth`** e rotas do Supabase (não cachear callbacks do Instagram/Meta — protege a integração que acabamos de arrumar)
5. Adicionar meta tags mobile no `index.html` (Apple touch icon, theme-color, viewport)
6. Criar uma página `/instalar` com instruções visuais e botão "Instalar agora" (usa o evento `beforeinstallprompt`)
7. Adicionar guard para que o service worker **nunca** registre dentro do iframe da Lovable nem em domínios `*.lovableproject.com`

### O que NÃO vou mexer
- Nenhuma lógica de negócio, Supabase, edge functions, conversas, Instagram OAuth, etc.
- Apenas adições de configuração de build + nova rota `/instalar`

---

### Detalhes técnicos

- `vite.config.ts`: adicionar plugin `VitePWA` com `registerType: 'autoUpdate'`, `devOptions.enabled: false`, `workbox.navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /supabase\.co/]`
- `src/main.tsx`: guard `isInIframe || isPreviewHost` antes de qualquer registro de SW + unregister automático em ambiente de preview
- `public/manifest.webmanifest` + ícones em `public/icons/`
- Nova rota `/instalar` em `src/App.tsx` apontando para `src/pages/InstallApp.tsx`

### Pergunta pra você decidir depois (não bloqueia agora)

Quando quiser publicar nas lojas oficiais, me avise e eu adiciono Capacitor + Electron numa segunda etapa. Vou precisar saber: nome final do app, bundle ID (ex: `online.wazecrm.app`), e se você já tem as contas de desenvolvedor.

