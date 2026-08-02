# Spec Técnica: [Fatia 03 - Burst broadcast com jitter e teto de grupos]

> **Feature:** `escala-disparos` | **Status:** `PENDENTE` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-03.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Novo modelo de slot no dispatch: cada execução do cron processa **1 oferta** e envia seus jobs `queued` a todos os grupos em sequência com delay aleatório de 2–5s entre envios. Mata o bug do `now` congelado (`maxJobs:5` era letra morta). Rotas de cron passam ao padrão `202 + trabalho em background` (`after()`), com `maxDuration=300` no dispatch. Teto de 15 grupos ativos na API. Coluna morta `wa_groups.daily_limit` removida (grupos espelhados — decisão da entrevista).
- **Limites da fatia:** 1 migration; reescrita do loop de `process.ts`; edições nas 4 rotas de cron, 2 rotas de groups, `wa/groups.ts`, `GroupsManager.tsx`; 2 testes novos + ajustes.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/013_drop_group_daily_limit.sql`
  - `[MODIFY]` `src/lib/dispatch/process.ts` — loop vira slot/burst (ver §3); `now` recalculado a cada envio
  - `[MODIFY]` `src/app/api/cron/dispatch/route.ts` — `maxDuration=300` + padrão `202`/`after()`
  - `[MODIFY]` `src/app/api/cron/{scrape,pipeline,keepalive}/route.ts` — padrão `202`/`after()` (preparação da Fatia 04; keepalive pode permanecer síncrono por ser < 30s — decidir na implementação com 1 linha de justificativa)
  - `[MODIFY]` `src/app/api/groups/route.ts` e `src/app/api/groups/[id]/route.ts` — gate `MAX_ACTIVE_GROUPS=15` ao criar ativo / ativar
  - `[MODIFY]` `src/lib/wa/groups.ts` — `validateGroupInput` sem `daily_limit`
  - `[MODIFY]` `src/components/GroupsManager.tsx` — remove campo `daily_limit`
  - `[NEW]` `tests/dispatch-burst.test.ts` · `[MODIFY]` `tests/groups-api.test.ts`
- **Símbolos e funções afetadas:**
  - `processDispatchQueue` (`process.ts:53-182`) — assinatura mantida (`ProcessResult` igual, `maxJobs` reinterpretado como teto de envios do slot)
  - `canSendNow` (`rate-limit.ts:65`) — ganha gate de `daily_offer_cap` (contagem de ofertas distintas `sent` no dia)
  - Rotas de cron (contrato de resposta muda para `202 {accepted:true}` — nenhuma UI consome essas rotas; `POST /api/dispatch/run` manual continua síncrono para dar feedback na tela)
- **⚠️ Next 16:** confirmar API de background (`after` de `next/server`) em `node_modules/next/dist/docs/` antes de codar (AGENTS, regra do topo).

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 013_drop_group_daily_limit.sql
  alter table public.wa_groups drop column if exists daily_limit;
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - **Novo loop do slot** (`processDispatchQueue`):
    1. Reaper (Fatia 01) → 2. gates de slot com `now` fresco: sessão connected, janela de silêncio, `daily_offer_cap` (ofertas distintas hoje), `daily_cap`/`hourly_cap` (mensagens).
    3. Seleciona a **oferta-alvo**: job `queued` mais antigo por `scheduled_for` → `offer_id` dele define o slot.
    4. Itera **todos** os jobs `queued` dessa oferta (≤15, um por grupo): claim atômico (inalterado) → `POST /send` → `sent`/retry (Fatia 01) → **`await jitter(2000–5000ms)`** antes do próximo grupo — exceto após o último. `new Date()` a cada iteração; caps de mensagens re-checados dentro do burst (estourou → para, resto fica `queued`).
    5. Jitter injetável: `opts.sleepFn?: (ms:number)=>Promise<void>` (default `setTimeout`; testes injetam stub — sem timer real no CI).
  - `min_interval_sec` passa a valer **entre slots** (comparado ao `lastSentAt` no gate de entrada, não dentro do burst).
  - **Groups API:** criar com `active:true` ou `PATCH {active:true}` quando já há 15 ativos → `409 {"error":"Limite de 15 grupos ativos atingido"}`.
- **Config:** `vercel.json` continua `*/5` (a troca de agendador é a Fatia 04).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** `GroupsManager` perde o input de `daily_limit`; erro 409 do teto exibido no padrão de erro existente da tela. `DispatchManager` inalterado (`stoppedReason` já é exibido; as novas razões de gate chegam por ele).
- **Estados Visuais:** reuso integral dos estados existentes; nenhuma tela nova.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/dispatch-burst.test.ts`:** slot envia os N jobs da mesma oferta com `sleepFn` chamado N-1 vezes com valores em [2000,5000]; segunda oferta fica para o próximo slot; estouro de `daily_cap` no meio do burst interrompe e preserva `queued`; `daily_offer_cap` atingido → `stoppedReason` sem claim.
- [ ] **`tests/groups-api.test.ts`:** 16º grupo ativo → 409; desativar um libera a ativação; payload com `daily_limit` é ignorado sem erro.
- [ ] **Integração Backend + UI:** grupos gerenciáveis sem o campo removido; disparo manual pela tela segue funcional (rota manual síncrona).
- [ ] **Validação Estrita:** `tsc`, `worker:typecheck`, `lint`, `vitest run` verdes; smoke de build confirma rotas de cron respondendo 202.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** migration 013 · loop burst+jitter · 202/after nas rotas cron · teto 15 grupos · limpeza daily_limit · testes
- **Próximo comando:** `/sdd-implement`
