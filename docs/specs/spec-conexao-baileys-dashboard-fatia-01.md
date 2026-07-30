# Spec Técnica: Fatia 01 - Worker Baileys (socket, auth, código/QR, status)

> **Feature:** `conexao-baileys-dashboard` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-conexao-baileys-dashboard-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Evoluir o worker Baileys existente para o ciclo de vida validado no `frota-impacto`: gate de sessão por `creds.account` (não `me`), pareamento sob demanda por telefone (`requestPairingCode`), publicação de **código 8 dígitos** (TTL) + **QR** (TTL), reconexão com backoff e **reconnect imediato** em `DisconnectReason.restartRequired` (515), limpeza em `loggedOut`, auth state **em memória** entre restarts de pair-success. Persistência de credenciais preferencial em **Postgres/Supabase cifrado** (tabela de keys); multi-file só fallback local se chave de cifra ausente. Endpoints HTTP worker para status enriquecido, pair, start e logout/clear.
- **Limites da fatia:** Sem UI Next, sem botão reconectar manual do painel, sem alterar fluxo de disparo além de manter `/send` exigindo `connected`. Sem multi-número.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `worker/src/baileys/client.ts` — ciclo de vida completo (pair, restartRequired, account gate, phone)
  - `[MODIFY]` `worker/src/baileys/session.ts` — estados estendidos + `pairingCode`, `phone`, TTLs
  - `[NEW]` `worker/src/baileys/auth-state.ts` — `createPostgresAuthState` (ou Supabase) cifrado; API `clearAuth` / `discardIncompleteAuth`
  - `[NEW]` `worker/src/baileys/crypto.ts` — AES-256-GCM (padrão frota) com `WHATSAPP_SESSION_KEY`
  - `[NEW]` `worker/src/baileys/pairing.ts` — normaliza phone, mailbox de pedido pendente em memória (e/ou espelho DB)
  - `[MODIFY]` `worker/src/http/server.ts` — `POST /session/pair`, status com code/phone/qr flags; logout limpa auth
  - `[MODIFY]` `worker/src/index.ts` — boot: não force-connect sem creds/pedido (waiting_pairing)
  - `[NEW]` `supabase/migrations/006_wa_session_keys.sql` — tabela keys + colunas extras em `wa_session`
  - `[MODIFY]` testes worker: `tests/worker-auth.test.ts` + `[NEW]` `tests/worker-session-lifecycle.test.ts` (mocks)
- **Símbolos e funções afetadas:**
  - `startBaileys`, `getSocket`, `getSessionState`, `setSessionStatus`, `clearQr`
  - `requestPairing(phone)`, `clearAuth`, `discardIncompleteAuth`
  - `createWorkerServer` rotas `/session*`, `/send`
- **Referência (somente leitura):** `frota-impacto` `socket-manager.ts`, `auth-state.ts`, `whatsapp-crypto.ts`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 006_wa_session_keys.sql
  create table if not exists public.wa_session_keys (
    id text primary key,              -- 'creds' | 'pre-key:N' | ...
    value text not null,              -- JSON BufferJSON cifrado AES-GCM
    updated_at timestamptz not null default now()
  );
  -- service_role only (RLS deny all authenticated) — worker usa service key

  alter table public.wa_session
    drop constraint if exists wa_session_status_check;
  alter table public.wa_session
    add constraint wa_session_status_check
    check (status in (
      'disconnected','waiting_pairing','qr','connecting','connected','logged_out'
    ));
  alter table public.wa_session
    add column if not exists pairing_code text,
    add column if not exists pairing_code_at timestamptz,
    add column if not exists phone text;
  ```
- **Estado em memória (fonte de verdade runtime do worker):**
  ```ts
  type SessionStatus =
    | "disconnected" | "waiting_pairing" | "qr"
    | "connecting" | "connected" | "logged_out";
  type SessionState = {
    status: SessionStatus;
    qrDataUrl: string | null;
    pairingCode: string | null;   // 8 chars; null se TTL expirou
    phone: string | null;         // E.164 digits, ex 5511...
    lastError: string | null;
  };
  // PAIRING_CODE_TTL_MS = 3min; PAIRING_QR_TTL_MS = 1min
  ```
- **Endpoints worker** (header `x-worker-secret`, exceto `/health`):
  | Método | Path | Body | Resposta |
  |--------|------|------|----------|
  | GET | `/session` | — | `{ status, hasQr, hasPairingCode, phone, lastError }` |
  | GET | `/session/qr` | — | `{ qrDataUrl }` (null se TTL/ausente) |
  | GET | `/session/pairing-code` | — | `{ code, phone, at }` |
  | POST | `/session/pair` | `{ phone: string }` | `202 { ok }` — normaliza BR, grava pedido, sobe socket se preciso |
  | POST | `/session/start` | — | `202` reconnect/start se há creds |
  | POST | `/session/logout` | — | logout socket + `clearAuth` + status `logged_out`/`disconnected` |
  | POST | `/send` | (existente) | 409 se status ≠ `connected` |
- **Env worker:** `WORKER_API_SECRET`, `PORT`, `DATABASE_URL` ou `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_SESSION_KEY` (32 bytes base64). Sem session key → fallback multi-file `BAILEYS_AUTH_DIR` só em dev (documentar).
- **Regras de ciclo:**
  1. Sem `account` e sem pedido de pair → `waiting_pairing`, não gerar QR eterno.
  2. Com pedido → socket up → em `qr`: grava QR; se phone pendente → `requestPairingCode(phone)` → publica código.
  3. `restartRequired` (515) → `resumingPairing=true`, reconnect **sem** backoff, **sem** reler auth do DB.
  4. `loggedOut` → `clearAuth`, status `logged_out`.
  5. Outros closes → backoff 5s–60s e reconnect se havia sessão.

## 4. Interface do Usuário & UX (Frontend)
- **N/A nesta fatia** (somente worker + migration). UI na Fatia 02.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Unitário:** lifecycle — waiting_pairing sem pedido; pair grava phone; status `connected` só com account; TTL zera code/QR; logout chama clearAuth.
- [ ] **Unitário:** normalização de phone (máscara BR → dígitos com 55).
- [ ] **Integração worker HTTP:** `POST /session/pair` sem secret → 401; com secret → 202; `GET /session` reflete campos novos; `/send` 409 se não connected.
- [ ] **Validação:** `tsc` no package worker; testes verdes.
- [ ] **Aceite:** worker sozinho (curl) completa contrato de status/pair/qr/code/logout sem Next.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** worker lifecycle (account gate, pair code+QR TTL, restartRequired, logout clearAuth); auth Supabase cifrado + fallback multi-file; HTTP `/session`, `/session/qr`, `/session/pairing-code`, `/session/pair`, logout/start; migration `006_wa_session_keys.sql`; testes phone/crypto/session/HTTP
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
