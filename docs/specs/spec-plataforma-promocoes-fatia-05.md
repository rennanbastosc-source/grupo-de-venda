# Spec Técnica: Fatia 05 - Disparo em Grupos (Fila + Rate Limit)

> **Feature:** `plataforma-promocoes` | **Status:** `PENDENTE` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-05.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Fila de disparos: oferta + grupos ativos + mensagem (template com título/preço/link afiliado) → worker Baileys envia; disparo manual e enfileiramento em lote; **rate limit horário** + **teto diário** configuráveis (defaults alinhados a free tier / anti-ban; meta operacional ≥ 35/dia); histórico sucesso/falha; compliance: só `wa_groups.active`; bloqueio se sessão ≠ connected; bloqueio se oferta sem `affiliate_links` ok; marca oferta `sent` quando aplicável; sem reenvio cego mesma URL+grupo no mesmo dia.
- **Limites da fatia:** Sem ads Meta; sem mídia rica obrigatória (texto + link basta); stats polidos ficam na Fatia 06 (aqui contadores mínimos para gates).

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` migration `dispatch_jobs`, `dispatch_attempts`, `app_settings` (limits)
  - `[NEW]` `src/lib/dispatch/enqueue.ts`, `rate-limit.ts`, `template.ts`, `guards.ts`
  - `[NEW]` `src/app/api/dispatch/route.ts` (POST enqueue), `src/app/api/dispatch/[id]/route.ts`
  - `[NEW]` `src/app/api/settings/route.ts` (GET/PATCH limits)
  - `[MODIFY]` worker: `POST /send` `{ jid, text }` + idempotency key; consumer de fila (poll Supabase ou POST do cron)
  - `[NEW]` `src/app/api/cron/dispatch/route.ts` — processa pendentes respeitando rate
  - `[NEW]` `src/app/(dashboard)/dashboard/disparos/page.tsx`
  - `[MODIFY]` ofertas UI: “disparar”
- **Símbolos e funções afetadas:**
  - `enqueueDispatch`, `processDispatchQueue`, `canSendNow`, `buildMessage`
  - `assertSessionConnected`, `assertGroupActive`, `assertOfferHasAffiliateLink`
  - `DispatchJob`, `AppSettings`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  create table public.app_settings (
    id int primary key default 1 check (id = 1),
    daily_cap int not null default 35,
    hourly_cap int not null default 10,
    min_interval_sec int not null default 45,
    message_template text not null default
      E'🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}',
    updated_at timestamptz not null default now()
  );

  create type public.dispatch_status as enum (
    'queued','sending','sent','failed','skipped'
  );

  create table public.dispatch_jobs (
    id uuid primary key default gen_random_uuid(),
    offer_id uuid not null references public.offers(id),
    group_id uuid not null references public.wa_groups(id),
    affiliate_link_id uuid not null references public.affiliate_links(id),
    status public.dispatch_status not null default 'queued',
    message_body text not null,
    scheduled_for timestamptz not null default now(),
    sent_at timestamptz,
    error text,
    created_at timestamptz not null default now(),
    unique (offer_id, group_id, (sent_at::date)) -- ou unique parcial via índice em app logic
  );
  -- Preferir índice único parcial: um sent por offer+group+dia (implementar na migration)
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - `POST /api/dispatch` `{ offerId, groupIds: string[] }` → cria N jobs se guards OK
  - `GET /api/dispatch?status=&from=`
  - `GET/PATCH /api/settings` (caps)
  - `GET /api/cron/dispatch` + secret → `processDispatchQueue`:
    1. se session not connected → skip
    2. se hourly/daily cap atingido → stop
    3. pega next `queued` com `scheduled_for <= now`, ordenado
    4. `min_interval_sec` desde último sent
    5. worker `POST /send`
    6. marca sent/failed; incrementa contadores
  - Worker `POST /send` (secret): `{ jid, text, jobId }` → Baileys `sendMessage`

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** Disparos — form (oferta aprovada com link, multi-select grupos ativos), lista jobs, badges status; settings caps (daily/hourly/interval).
- **Estados Visuais:** bloqueio com motivo (sem sessão / sem link / limite / grupo inativo); success enqueue; empty queue.
- **Acessibilidade:** multi-select acessível; erros em texto.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/rate-limit.test.ts` (hourly/daily/interval); `tests/dispatch-guards.test.ts` (sem link, grupo inativo, sessão down); `tests/template.test.ts`.
- [ ] **Integração Backend + UI:** enqueue 2 grupos → 2 jobs; cron processa 1 se interval; segundo espera; UI lista statuses.
- [ ] **Validação Estrita:** tsc, lint, test.
- [ ] **Aceite:** impossível enviar URL crua; impossível enviar a grupo inativo; caps não contornáveis via API.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** fila, guards, rate limit, worker send, UI disparos, testes
- **Próximo comando:** `/sdd-implement`
