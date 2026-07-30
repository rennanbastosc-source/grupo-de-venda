# Spec Técnica: Fatia 03 - Desconectar, reconectar, hardening e gate de disparos

> **Feature:** `conexao-baileys-dashboard` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-conexao-baileys-dashboard-fatia-03.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Fechar o fluxo operacional no painel: botão **Desconectar** (logout + clear auth), botão **Reconectar** (força `/session/start` ou re-pair flow), UX de worker offline / código-QR expirados / `logged_out` pelo aparelho. Hardening do contrato com disparos: mensagens explícitas se sessão ≠ `connected`. Documentar env vars (`WHATSAPP_SESSION_KEY`, `WORKER_*`). Smoke E2E ou integração do happy path com worker mockado. Validar reconexão automática do worker (já na F01) via teste de comportamento documentado.
- **Limites da fatia:** Sem multi-número; sem alertas externos; sem deploy Render obrigatório (documentar `WORKER_BASE_URL` prod). Sem reescrever fila de disparo — só garantir gate e copy de erro.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/worker-client.ts` — `logoutWorkerSession()`, `startWorkerSession()`
  - `[NEW]` `src/app/api/bot/logout/route.ts` — `POST` → worker `/session/logout`
  - `[NEW]` `src/app/api/bot/reconnect/route.ts` — `POST` → worker `/session/start` (se creds) ou 409 orientando novo pair
  - `[MODIFY]` `src/components/SessionPanel.tsx` — botões Desconectar / Reconectar; estados de erro offline; TTL copy
  - `[MODIFY]` `src/lib/dispatch/process.ts` — `stoppedReason` legível: “WhatsApp desconectado — reconecte em Bot”
  - `[MODIFY]` `src/components/DispatchManager.tsx` (se existir aviso de sessão) — link para `/dashboard/bot`
  - `[MODIFY]` `.env.example` (e/ou `worker/.env.example`) — `WHATSAPP_SESSION_KEY`, notas openssl
  - `[NEW]` `tests/bot-session-actions.test.ts` — logout/reconnect auth + proxy
  - `[NEW]` `tests/e2e/bot-connection.spec.ts` **ou** integração mock — happy path UI status machine (opcional se Playwright pesado: preferir teste de componente/API completo)
- **Símbolos:**
  - `processDispatchQueue` gate session
  - `SessionPanel` actions
  - worker `POST /session/logout`, `POST /session/start`

## 3. Contratos de Dados & API (Backend)
- **Dashboard:**
  | Método | Path | Efeito |
  |--------|------|--------|
  | POST | `/api/bot/logout` | worker logout + clear; UI → form pair de novo |
  | POST | `/api/bot/reconnect` | worker start; se sem creds → 409 `{ error, needsPairing: true }` |
- **Worker (já F01):** logout limpa keys; start sem account → `waiting_pairing` (não loop infinito de QR).
- **Disparo:**
  - `processDispatchQueue`: se session ≠ connected → `stoppedReason = "WhatsApp desconectado — reconecte em /dashboard/bot"` (ou equivalente PT curto).
  - `/send` no worker permanece 409 com `session <status>`.
- **Env documentado:**
  | Var | Onde | Notas |
  |-----|------|-------|
  | `WHATSAPP_SESSION_KEY` | worker | `openssl rand -base64 32`; perder = re-parear |
  | `WORKER_API_SECRET` | app + worker | igual nos dois |
  | `WORKER_BASE_URL` | app | URL do processo long-running |
  | `SUPABASE_*` / `DATABASE_URL` | worker | auth keys table |

## 4. Interface do Usuário & UX (Frontend)
- **Quando `connected`:** badge verde + phone + botões **Desconectar** (confirm dialog) e **Atualizar**.
- **Quando não connected:** form pair + **Reconectar** (tenta start; se `needsPairing`, foca input phone com mensagem).
- **Worker offline:** banner vermelho “Worker inacessível — verifique o serviço Baileys”; desabilita Gerar código com tooltip.
- **Código/QR expirados:** texto “Código/QR expirado — gere novamente”; botão Gerar código habilitado.
- **`logged_out`:** “Sessão encerrada no aparelho — pareie de novo”.
- **Confirmação desconectar:** “Isso desvincula o WhatsApp e exige novo pareamento. Continuar?”

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **API:** logout autenticado → 200 e status subsequente não-connected; reconnect sem creds → 409 needsPairing.
- [ ] **Disparo:** com session mock disconnected, `processDispatchQueue` retorna `stoppedReason` explícito e zero sends.
- [ ] **UI:** botões Desconectar/Reconectar visíveis nos estados corretos; confirm em logout.
- [ ] **Docs:** `.env.example` atualizado.
- [ ] **Validação:** tsc, lint, test (+ e2e se adicionado) verdes.
- [ ] **Aceite MVP fechado:** painel cobre pair → code+QR → connected → disconnect → reconnect/pair de novo; disparo recusa com mensagem clara se desconectado.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** logout/reconnect APIs + SessionPanel; gate disparos com copy `/dashboard/bot`; Overview/Dispatch links; `.env.example` + `worker/.env.example`; testes bot-session-actions e dispatch-session-gate
- **Pendente:** —
- **Próximo comando:** `/sdd-finish`

## 7. As-Built
- `logoutWorkerSession` / `startWorkerSession`; `POST /api/bot/logout`, `POST /api/bot/reconnect` (409 `needsPairing` se waiting_pairing/logged_out ou pós-start waiting).
- SessionPanel: Desconectar (confirm) · Reconectar · banner worker offline · copy código/QR expirado · foco no input se needsPairing.
- `processDispatchQueue` + `assertSessionConnected`: mensagem “WhatsApp desconectado — reconecte em /dashboard/bot”.
- Overview/Dispatch links para `/dashboard/bot`.
- Env docs: `.env.example`, `worker/.env.example` (`WHATSAPP_SESSION_KEY` = `openssl rand -base64 32`).
- CI GitHub Actions (padrão almoxarifado): lint, tsc app+worker, vitest, build, audit; smoke prod; dependabot. `tsconfig` exclui `tests/` para build CI sem baileys na raiz.
