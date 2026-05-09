
## Diagnóstico atual da Ultra URA / Instagram

Verifiquei o módulo de Automação (Fluxos) e a integração Meta/Instagram. Resumo honesto do que **já existe** e do que **ainda não existe**:

### ✅ O que está funcionando
- **Builder de fluxo** (`FluxoAutomacaoBuilder`, `NodesSidebar`, `NodePropertiesPanel`) com gatilhos: `nova_mensagem`, `novo_lead`, `palavra_chave`, `horario`, `tag_added`.
- **Executor** (`executar-fluxo` edge function) que casa o `triggerType` com o nó inicial e roda o fluxo.
- **Webhook Meta** (`webhook-meta`) recebe e salva:
  - Direct messages do Instagram (texto, imagem, vídeo, áudio, story reply, story_mention, reações).
  - **Comentários** do Instagram (`change.field === 'comments'`) — já chega e é salvo como mensagem com `source: 'instagram_comment'`.

### ⚠️ O que está incompleto / não existe hoje
1. **Nenhum disparo de fluxo a partir do webhook do Instagram.** O `webhook-meta` apenas grava a mensagem em `conversations`; **não chama `executar-fluxo`**. Logo, nem mesmo "nova mensagem do Direct" dispara URA hoje pelo IG (só pelo WhatsApp).
2. **Comentário no feed/reels não dispara fluxo.** Já chega no webhook, mas só vira registro — não roda gatilho de palavra-chave.
3. **Comentário em LIVE** — depende de assinar o campo `live_comments` na app Meta (hoje não temos esse subscribe; só `messages` e `comments`).
4. **Novo seguidor** — **a Graph API do Instagram não emite webhook de "new follower"**. Limitação da própria Meta. Só dá pra simular via *polling* periódico do endpoint `/{ig-user-id}?fields=followers_count` + comparar com lista anterior, ou usar a aba "Activity" (não suportada via API oficial).
5. Builder não tem opções específicas: `instagram_comment`, `instagram_live_comment`, `instagram_new_follower`.

---

## Plano sugerido (3 frentes)

### 1. Disparar fluxos a partir do Instagram Direct e Comentários (viável agora)
- Em `webhook-meta`, após salvar mensagem do IG, chamar `executar-fluxo` igual já é feito para WhatsApp:
  - `triggerType = 'nova_mensagem'` para Direct.
  - `triggerType = 'palavra_chave'` quando `source === 'instagram_comment'` e o texto contiver uma palavra-chave configurada.
- Adicionar coluna `canais` (array: `whatsapp`, `instagram_direct`, `instagram_comment`) no fluxo, para o usuário escolher onde o fluxo roda.
- No builder (`NodePropertiesPanel`), adicionar dropdown "Canal de origem" no gatilho.

### 2. Comentários em LIVE
- Atualizar configuração da App Meta para inscrever os campos `live_comments` (e `comments` se ainda não estiver).
- Adicionar branch no `webhook-meta` para `change.field === 'live_comments'`, com mesmo tratamento de palavra-chave do item 1.
- Documentação: requer permissão `instagram_manage_comments` + conta IG Business vinculada a página FB.

### 3. Novo seguidor (workaround — não há webhook oficial)
Opções, em ordem de preferência:
- **A. Polling periódico (recomendado):** cron a cada 10–15 min lê `followers_count` e a lista mais recente via `/{ig-user-id}/business_discovery` ou Graph; compara com snapshot anterior salvo em uma nova tabela `instagram_followers_snapshot`. Para cada novo seguidor → dispara fluxo com `triggerType = 'novo_seguidor_instagram'`.
  - Limitação: a Graph API **não retorna lista de seguidores** para conta IG Business; retorna só contagem. Logo o disparo seria "x novos seguidores hoje" sem `from`.
  - Para enviar DM de saudação a um seguidor específico precisaríamos do username, que **não é exposto pela API**. Só funcionaria se o seguidor te mandar um direct primeiro (janela de 24h).
- **B. Híbrido (realista):** quando alguém comenta/dá direct pela primeira vez, checar se ele te segue (via `is_follower` no payload do Messenger Platform — disponível em alguns eventos). Marcar como "novo seguidor que interagiu" e disparar fluxo de boas-vindas no Direct.
- **C. Manual:** o usuário cola uma lista de @usuários e o sistema envia um Direct (sujeito à janela de 24h da Meta).

Recomendo **B** + a saudação por palavra-chave do item 1, pois é o caminho que **realmente entrega mensagem ao seguidor** dentro das regras da Meta.

---

## Detalhes técnicos

```text
Hoje:
  Instagram → webhook-meta → conversations (fim)

Proposto:
  Instagram → webhook-meta → conversations
                          ↓
                    executar-fluxo (triggerType + canal + palavra-chave)
                          ↓
                    enviar-instagram (DM) / comentar
```

Arquivos afetados:
- `supabase/functions/webhook-meta/index.ts` — chamar `executar-fluxo` após persistir IG.
- `supabase/functions/executar-fluxo/index.ts` — aceitar `canal` e novos `triggerType` (`comentario_instagram`, `live_comment_instagram`, `novo_seguidor_instagram`).
- `src/components/fluxos/NodePropertiesPanel.tsx` + `NodesSidebar.tsx` — novos gatilhos e seletor de canal.
- `src/components/fluxos/nodes/TriggerNode.tsx` — ícones para os novos triggers.
- Nova migration: `flows.canais text[]`, tabela `instagram_followers_snapshot` (se polling).
- Atualizar inscrição da App Meta para incluir `comments`, `live_comments`, `mentions`.

---

## Pergunta antes de executar

Quer que eu implemente as **3 frentes** ou começo só pela **Frente 1** (Direct + comentário com palavra-chave), que é a que dá retorno imediato e respeita os limites da Meta? A "saudação automática a novo seguidor" tem limitação de plataforma — posso implementar a versão B (saudação ao primeiro contato do seguidor) que é o que de fato funciona.
