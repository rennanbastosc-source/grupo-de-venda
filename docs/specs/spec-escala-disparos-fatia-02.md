# Spec Técnica: [Fatia 02 - Relógio único, janela operacional e caps duplos]

> **Feature:** `escala-disparos` | **Status:** `CONCLUÍDO` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Um único fuso (`America/Fortaleza`, UTC-3 fixo) para todos os cálculos de calendário do dispatch — janela de silêncio, virada de dia dos contadores e índice de unicidade diária. Janela operacional 07:00–23:00 (silêncio 23:01–06:59) como default. Caps separados: `daily_offer_cap` (ofertas/dia, novo) e `daily_cap` (mensagens/dia, existente), editáveis na UI de disparos com defaults conservadores.
- **Limites da fatia:** 1 migration; edições em `rate-limit.ts`, `process.ts`, `guards.ts`, `settings/route.ts` e a seção de settings do `DispatchManager.tsx`; 2 testes atualizados/criados.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/012_fortaleza_caps.sql`
  - `[MODIFY]` `src/lib/dispatch/rate-limit.ts` — `localMinutesSp` → `localMinutes` com constante exportada `DISPATCH_TZ = "America/Fortaleza"`; novo helper exportado `dayStartInTz(now): Date` (via `Intl.DateTimeFormat` no mesmo padrão de `:29-41`); `RateSettings` ganha `daily_offer_cap`
  - `[MODIFY]` `src/lib/dispatch/process.ts` — `dayStart` UTC (`:75-77`) → `dayStartInTz(now)`; `loadSettings` inclui `daily_offer_cap`
  - `[MODIFY]` `src/lib/dispatch/guards.ts` — `hasDispatchToday` (`:106`) usa `dayStartInTz` (hoje usa meia-noite UTC)
  - `[MODIFY]` `src/app/api/settings/route.ts` — `SETTINGS_SELECT`, `DEFAULTS` e validação PATCH ganham `daily_offer_cap` (inteiro ≥ 1)
  - `[MODIFY]` `src/components/DispatchManager.tsx` — campo "Ofertas/dia" ao lado dos caps existentes na seção de settings
  - `[MODIFY]` `tests/rate-limit.test.ts` — casos de Fortaleza + virada de dia
  - `[NEW]` `tests/dispatch-clock.test.ts` — `dayStartInTz` e coerência janela × contadores
- **Símbolos e funções afetadas:**
  - `isWithinSleepWindow` / `localMinutesSp` (`rate-limit.ts:29-63`) · `canSendNow` (`:65`)
  - `processDispatchQueue` `dayStart` (`process.ts:75-77`) · `hasDispatchToday` (`guards.ts:106`)
  - Índice parcial `dispatch_jobs_one_sent_per_day` (`005_dispatch.sql`)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 012_fortaleza_caps.sql
  alter table public.app_settings
    add column if not exists daily_offer_cap int not null default 10;

  -- janela default 23:01–06:59 onde ainda não configurada
  update public.app_settings
    set sleep_start = coalesce(sleep_start, '23:01'),
        sleep_end   = coalesce(sleep_end,   '06:59')
    where id = 1;

  -- unicidade diária no mesmo relógio dos contadores (era UTC)
  drop index if exists public.dispatch_jobs_one_sent_per_day;
  create unique index dispatch_jobs_one_sent_per_day
    on public.dispatch_jobs (
      offer_id, group_id,
      ((timezone('America/Fortaleza', sent_at))::date)
    )
    where status = 'sent' and sent_at is not null;
  ```
  > Migração aditiva/idempotente; recriação do índice é instantânea no volume atual. **Gate de deploy (AGENTS §5): schema aplicado em produção antes do merge.**
- **Endpoints / Server Actions / Funções de Serviço:**
  - `GET/PATCH /api/settings` — novo campo `daily_offer_cap` (default 10). Semântica: `daily_cap` = mensagens/dia (inalterada), `daily_offer_cap` = ofertas distintas/dia (consumido pelo gate de slot na Fatia 03 e pelo funil na Fatia 05).
  - `dayStartInTz(now)` — única fonte de "meia-noite de hoje" do domínio dispatch. Nenhum `Date.UTC(...)` sobrevive no módulo.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** Seção de configurações do `DispatchManager` ganha input numérico "Ofertas por dia" com hint do fuso ("horários em America/Fortaleza"); labels da janela de descanso passam a citar o fuso.
- **Estados Visuais:** reuso do padrão existente da tela (loading/erro/sucesso do PATCH já implementados); validação client de inteiro ≥ 1 espelhando o server.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/rate-limit.test.ts`:** janela 23:01–06:59 bloqueia às 23:30 e às 06:30 e libera às 07:00 (instantes UTC convertidos p/ Fortaleza); `start===end` desativa (comportamento preservado).
- [ ] **`tests/dispatch-clock.test.ts`:** `dayStartInTz` para `2026-08-02T01:00:00Z` retorna meia-noite de Fortaleza de 2026-08-01 (o caso 21h–00h que motivou a fatia); contadores e `hasDispatchToday` viram no mesmo instante.
- [ ] **Integração Backend + UI:** editar "Ofertas por dia" na tela persiste via PATCH e o GET reflete.
- [ ] **Validação Estrita:** `tsc`, `lint`, `vitest run` verdes.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** migration 012 · `DISPATCH_TZ`/`dayStartInTz` em rate-limit + process + guards · `daily_offer_cap` em settings API, pipeline/status e UI · testes (loop verde: 180 testes)
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
