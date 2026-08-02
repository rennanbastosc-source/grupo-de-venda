# Spec Técnica: [Fatia 01 - Envio seguro — dedupe durável, retry e reaper]

> **Feature:** `escala-disparos` | **Status:** `CONCLUÍDO` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Mecanismo único de envio seguro em três faces: (a) dedupe durável — o worker registra cada `job_id` entregue na tabela `wa_sent_jobs` e nunca reenvia um job já entregue, mesmo após restart; (b) retry — job com falha transitória volta a `queued` com backoff, até 3 tentativas; (c) reaper — job preso em `sending` há mais de 10 min é resgatado para `queued` no início de cada processamento. Pré-requisito das Fatias 03/04 (burst + crons externos).
- **Limites da fatia:** 1 migration nova; worker: 1 módulo novo pequeno + edições em `server.ts` e `auth-state.ts`; app: edições em `process.ts`; 2 arquivos de teste. Sem UI (o resgate é invisível por design — decisão da entrevista).

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/011_safe_send.sql`
  - `[NEW]` `worker/src/db.ts` — helper `rest()` extraído de `auth-state.ts` (reuso, não duplicação; a Fatia 07 também o consome)
  - `[MODIFY]` `worker/src/baileys/auth-state.ts` — passa a importar `rest()` de `../db.js` (mesma assinatura, zero mudança de comportamento)
  - `[MODIFY]` `worker/src/http/server.ts` — rota `/send`: consulta durável antes de enviar, insert após enviar (Set `sentJobIds` permanece como fast-path)
  - `[MODIFY]` `src/lib/dispatch/process.ts` — reaper no início; retry com backoff na falha; tratar `deduped:true` como sucesso
  - `[NEW]` `tests/dispatch-retry-reaper.test.ts`
  - `[NEW]` `tests/worker-send-dedupe.test.ts`
- **Símbolos e funções afetadas:**
  - `rest()` (extraído) · `sentJobIds` · rota `POST /send` (`server.ts:118-152`)
  - `processDispatchQueue` (`process.ts:53`) — novo passo `reapStuckJobs` + branch de retry
  - Invariante intocada: claim atômico `WHERE id AND status='queued'` (`process.ts:128-134`)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 011_safe_send.sql
  create table if not exists public.wa_sent_jobs (
    job_id uuid primary key,
    sent_at timestamptz not null default now()
  );
  alter table public.wa_sent_jobs enable row level security;
  -- sem policy: só service_role (mesmo padrão de wa_session_keys)

  alter table public.dispatch_jobs
    add column if not exists attempts int not null default 0,
    add column if not exists claimed_at timestamptz;
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - Worker `POST /send` (contrato externo inalterado): com `jobId`, ordem de checagem = Set em memória → `GET wa_sent_jobs?job_id=eq.<id>` (via `rest()`). Já entregue → `200 {ok:true, deduped:true}` sem tocar o socket. Envio OK → `POST wa_sent_jobs` (`Prefer: resolution=merge-duplicates` — insert idempotente) + `sentJobIds.add`. **Falha na consulta durável → 500** (não envia às cegas: na dúvida, não duplica; o retry do app cobre).
  - `processDispatchQueue`:
    1. **Reaper (novo, antes do loop):** `UPDATE dispatch_jobs SET status='queued', attempts=attempts+1, claimed_at=null WHERE status='sending' AND claimed_at < now()-'10 min'` (uma query, sem loop).
    2. **Claim:** passa a gravar `claimed_at: now` junto com `status:'sending'`.
    3. **Falha do send (novo):** `attempts >= 2` (3ª falha) → `failed` terminal + `error`. Senão → `queued`, `attempts+1`, `scheduled_for = now + 2^attempts * 60s`, `claimed_at=null`.
    4. **`deduped:true` do worker → trata como enviado** (job `sent` + oferta `sent`), sem incrementar contadores de rate (a mensagem já contou quando foi de fato entregue).
- **Guardas CI (AGENTS §11):** `rest()` em `worker/src/db.ts` lança se envs ausentes (comportamento atual preservado); testes mockam `fetch` — nenhuma chamada de rede real no CI.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** Nenhum (decisão explícita: reaper/dedupe invisíveis; badge de "resgatados" é nice-to-have futuro).
- **Estados Visuais:** N/A. `DispatchManager` já exibe `status` e `error` dos jobs — `failed` terminal ganha mensagem legível `"3 tentativas falharam: <último erro>"` sem mudança de tela.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/worker-send-dedupe.test.ts`:** re-POST de `jobId` já em `wa_sent_jobs` (Set vazio, simulando restart) responde `deduped:true` e não chama `socket.sendMessage`; envio OK insere em `wa_sent_jobs`; falha da consulta durável responde 500 sem enviar.
- [ ] **`tests/dispatch-retry-reaper.test.ts`:** falha transitória → job volta a `queued` com `attempts=1` e `scheduled_for` futuro; 3ª falha → `failed` terminal; job `sending` com `claimed_at` velho é resgatado no início do run; resposta `deduped:true` marca job `sent` sem duplicar contadores.
- [ ] **Integração Backend + UI:** job `failed` terminal aparece no `DispatchManager` com o erro das 3 tentativas (fluxo existente, sem código novo de UI).
- [ ] **Validação Estrita:** `tsc`, `worker:typecheck`, `lint` e `vitest run` verdes.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** migration 011 · `worker/src/db.ts` (rest extraído + isJobSent/markJobSent) · dedupe durável em `/send` · reaper/retry/deduped em `process.ts` · 2 arquivos de teste (loop verde: tsc app+worker, lint, 171 testes)
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
