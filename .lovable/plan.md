# Webphone NVOIP — Ligação Direta no CRM

Implementar um novo modo de telefonia que faz e recebe chamadas **dentro do navegador**, usando SIP sobre WebSocket (WSS) direto no PBX da NVOIP, sem MicroSIP e sem o callback `/v2/calls`.

## 1. Dependência

- Adicionar `jssip` (`bun add jssip`) — biblioteca SIP madura, compatível com NVOIP WSS.

## 2. Armazenamento da senha SIP

A `nvoip_config` hoje guarda `number_sip` e `user_token` (token REST). A senha SIP do ramal é diferente. Criar migração:

```sql
ALTER TABLE public.nvoip_config
  ADD COLUMN IF NOT EXISTS sip_password text,
  ADD COLUMN IF NOT EXISTS sip_ws_uri text DEFAULT 'wss://app.nvoip.com.br:7443',
  ADD COLUMN IF NOT EXISTS sip_domain  text DEFAULT 'app.nvoip.com.br',
  ADD COLUMN IF NOT EXISTS telephony_mode text DEFAULT 'webphone'
    CHECK (telephony_mode IN ('webphone','callback','microsip'));
```

`sip_password` continua protegida pelas RLS atuais (somente admins da company).

## 3. UI — Conta Telefônica (`NvoipAccountPanel.tsx`)

Adicionar:

- Campo **Senha SIP do ramal** (input password, mascarado igual ao user_token).
- Select **Modo de telefonia**:
  - `Webphone NVOIP — Ligação Direta no CRM` (padrão, recomendado)
  - `NVOIP API Callback` (fallback antigo)
  - `MicroSIP Local` (fallback antigo)
- Salvar via `nvoip-call` action `save-config` (estender para aceitar os novos campos).

## 4. Hook `useWebphoneSIP`

Novo `src/hooks/useWebphoneSIP.ts`. Responsável por todo o ciclo JsSIP.

Configuração:

```ts
const socket = new JsSIP.WebSocketInterface(cfg.sip_ws_uri);
const ua = new JsSIP.UA({
  sockets: [socket],
  uri: `sip:${cfg.number_sip}@${cfg.sip_domain}`,
  authorization_user: cfg.number_sip,
  password: cfg.sip_password,
  display_name: company.name,
  session_timers: false,
  register: true,
});
```

Estados expostos:

- `registrationStatus`: `idle | connecting | registered | unregistered | error`
- `callState`: `idle | outgoing | incoming | ringing | active | ended`
- `currentSession`, `remoteNumber`, `remoteName`, `duration`, `muted`

Eventos JsSIP tratados:

- `connecting`, `connected`, `disconnected`, `registered`, `unregistered`, `registrationFailed`
- `newRTCSession` → distingue `originator === 'remote'` (entrada) de `'local'` (saída)
- Em sessão: `progress`, `accepted`, `confirmed`, `ended`, `failed`
- Anexar `<audio>` remoto via `session.connection.getRemoteStreams()` (ou `peerconnection.ontrack`) num elemento `<audio autoplay>` global.

API do hook:

- `register()` / `unregister()`
- `call(number: string)` — sanitiza, envia INVITE: `ua.call(\`sip:${digits}@${cfg.sip_domain}, { mediaConstraints: { audio: true, video: false } })`. **Nunca** chama` /v2/calls`.
- `answer()`, `reject()`, `hangup()`
- `toggleMute()` (manipula `RTCRtpSender.track.enabled`)

Sanitização do número: remover não-dígitos, garantir DDI 55 quando faltar, manter compatível com o que o trunk NVOIP espera (10–13 dígitos).

## 5. Componente `WebphoneProvider` + UI

- `src/components/discador/WebphoneProvider.tsx` no topo do app autenticado: instancia o hook 1 vez, expõe via Context, registra automaticamente quando `telephony_mode === 'webphone'` e há `sip_password`.
- `IncomingCallPopup.tsx`: popup global quando `callState === 'incoming'`, com botões Atender / Recusar e identificação do lead (busca lead pelo número via `leads.telefone` da company).
- `WebphoneDialer.tsx`: substitui o card "Iniciar Ligação" em `Discador.tsx` quando o modo é `webphone`. Mostra status SIP, dialpad, botão Ligar, e durante a chamada usa o `CallModal` existente (atender/mudo/encerrar/timer).

## 6. Integração na página `Discador.tsx`

- Ler `telephony_mode` da `nvoip_config`.
- `webphone` → renderiza `WebphoneDialer` + usa `useWebphoneSIP` (sem `useCallCenter.startCall` REST).
- `callback` / `microsip` → mantém o fluxo atual (`useCallCenter`).
- `StartCallFromLeadDialog`: quando modo webphone, chama `webphone.call(phone)` em vez do edge function.
- Após `ended`, abre `PostCallNotesDialog` e grava em `call_history` (inserir registro com `direction`, `phone_number`, `duration`, `call_result`). Inbound também grava.

## 7. Histórico

Inserir em `call_history` ao final de cada sessão (out e in). Reutiliza tabela atual; campo `notes_required = true` quando atendida.

## 8. Preparação para gravação / IA / transcrição

- Expor a `MediaStream` remota e local no contexto para futuro `MediaRecorder`.
- Deixar hook `onAudioStream(localStream, remoteStream)` documentado mas sem gravar agora (escopo futuro).

## 9. Edge function

Estender `supabase/functions/nvoip-call/index.ts` apenas no `save-config` para persistir `sip_password`, `sip_ws_uri`, `sip_domain`, `telephony_mode`. Nenhuma chamada REST nova; o modo webphone não usa esse edge para discar.

## 10. Fallback

Manter `callback` e `microsip` totalmente funcionais como hoje — só não são mais o padrão.

## Arquivos

Novos:

- `src/hooks/useWebphoneSIP.ts`
- `src/components/discador/WebphoneProvider.tsx`
- `src/components/discador/WebphoneDialer.tsx`
- `src/components/discador/IncomingCallPopup.tsx`
- migração `nvoip_config` (colunas SIP + telephony_mode)

Editados:

- `src/pages/Discador.tsx` (branch por modo)
- `src/components/discador/NvoipAccountPanel.tsx` (senha SIP + select modo)
- `src/components/discador/StartCallFromLeadDialog.tsx` (rota para webphone)
- `src/App.tsx` (montar `WebphoneProvider` dentro do layout autenticado)
- `supabase/functions/nvoip-call/index.ts` (`save-config` aceita campos novos)
- `package.json` (`jssip`)

## Riscos / Observações

- O servidor SIP da NVOIP precisa aceitar WebRTC no ramal — confirmado pelos dados fornecidos (`wss://app.nvoip.com.br:7443`).
- Browser exige HTTPS para `getUserMedia` (já temos no preview/published).
- Senha SIP fica em `nvoip_config` (RLS por company); o browser a recebe somente para o usuário autenticado da própria company.  
  
  
  
atenção ja temos o modulo de call center iremos fializado e deixalo apto a fazer ligações
- telefonicas