# Spec Técnica: Fatia 02 - Orquestração Next ↔ worker + tela dashboard de pareamento

> **Feature:** `conexao-baileys-dashboard` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-conexao-baileys-dashboard-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Camada no app Next (rotas API autenticadas + `worker-client`) consumindo o contrato da Fatia 01: solicitar pareamento (telefone), ler status + código + QR. UI no dashboard (`/dashboard/bot` e `SessionPanel`): formulário de telefone, código 8 dígitos + instruções WhatsApp, imagem QR, badges de status ao vivo (polling ~4s enquanto ≠ connected), número conectado quando `connected`. Proteção por `requireUser` (Supabase Auth).
- **Limites da fatia:** Sem botões Desconectar/Reconectar manuais (Fatia 03). Sem alterar processador de disparo além de consumir status enriquecido se necessário. Sem deploy Render.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/worker-client.ts` — tipos + `pairWorkerSession(phone)`, `getWorkerPairingCode()`, campos novos em `WorkerSession`
  - `[MODIFY]` `src/lib/wa/types.ts` — `WaSessionStatus` estendido (`waiting_pairing`, `logged_out`)
  - `[MODIFY]` `src/lib/wa/session.ts` — `mapSessionForUi` com phone, pairingCode, canDispatch só `connected`
  - `[MODIFY]` `src/app/api/bot/status/route.ts` — repassa phone/hasPairingCode/status novos
  - `[MODIFY]` `src/app/api/bot/qr/route.ts` — inalterado no contrato (qrDataUrl)
  - `[NEW]` `src/app/api/bot/pair/route.ts` — `POST { phone }` → worker `/session/pair`
  - `[NEW]` `src/app/api/bot/pairing-code/route.ts` — `GET` → worker `/session/pairing-code`
  - `[MODIFY]` `src/components/SessionPanel.tsx` — form phone, código, QR, badges, poll
  - `[MODIFY]` `src/components/SessionBadge.tsx` — labels dos novos status (se usado no overview)
  - `[MODIFY]` `src/app/(dashboard)/dashboard/bot/page.tsx` — copy/título “Conexão WhatsApp”
  - `[MODIFY]` `tests/session-status.test.ts` — novos status + mapping
  - `[NEW]` `tests/bot-pair-api.test.ts` ou extensão — validação phone + auth gate (mock worker)
- **Símbolos:**
  - `mapSessionForUi`, `isWaSessionStatus`, `getWorkerSession`, `workerFetch`
  - `SessionPanel`, `requireUser`

## 3. Contratos de Dados & API (Backend)
- **Dashboard (auth cookie Supabase via `requireUser`):**
  | Método | Path | Body/Query | Resposta |
  |--------|------|------------|----------|
  | GET | `/api/bot/status` | — | `{ status, hasQr, hasPairingCode, phone, lastError, canDispatch }` |
  | GET | `/api/bot/qr` | — | `{ qrDataUrl }` |
  | GET | `/api/bot/pairing-code` | — | `{ code, phone, at }` (nulls se expirado/ausente) |
  | POST | `/api/bot/pair` | `{ phone: string }` | `202 { ok }` ou `400` phone inválido; `503` worker offline |
- **Validação phone (server):**
  - strip non-digits; se 10–11 dígitos BR → prefixar `55`; aceitar já com `55`; rejeitar &lt; 12 ou &gt; 15 dígitos.
- **Env app (já existentes):** `WORKER_BASE_URL`, `WORKER_API_SECRET`. Sem config → status disconnected + lastError claro (já implementado).
- **Sem secrets no client.**

## 4. Interface do Usuário & UX (Frontend)
- **Página:** `/dashboard/bot` — título “Conexão WhatsApp / Baileys”.
- **`SessionPanel` estados:**
  | Status | Badge | Conteúdo |
  |--------|-------|----------|
  | `waiting_pairing` / `disconnected` / `logged_out` | âmbar/vermelho | form telefone + “Gerar código” |
  | `qr` / `connecting` | azul | código 8 dígitos (se houver) + QR + instruções + poll |
  | `connected` | verde | “Conectado” + phone mascarado (`**…****1234`) · pronto para disparo |
- **Instruções fixas:** WhatsApp → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone (código) **ou** escanear QR.
- **Polling:** ~4s enquanto `status !== "connected"`; parar ou rarear quando conectado (manual “Atualizar” permanece).
- **A11y:** labels no input; status em texto; `role="alert"` em erros; QR com `alt`.
- **Máscara input:** BR amigável na UI; envia dígitos normalizados no POST.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Unitário:** `mapSessionForUi` — `waiting_pairing`/`logged_out` válidos; `canDispatch` só `connected`; phone repassado.
- [ ] **Unitário/Integração API:** `POST /api/bot/pair` sem auth → 401; phone inválido → 400; mock worker ok → 202.
- [ ] **UI smoke:** form visível desconectado; após mock status qr + code, painel mostra ambos.
- [ ] **Validação:** tsc, lint, test verdes.
- [ ] **Aceite:** admin logado digita número, vê código+QR no painel (worker real ou mock), status atualiza até `connected` no happy path.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** worker-client pair/code; mapSessionForUi + statuses; APIs `/api/bot/pair` e `/pairing-code`; SessionPanel form+código+QR+poll 4s; SessionBadge; testes session-status e bot-pair-api
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
