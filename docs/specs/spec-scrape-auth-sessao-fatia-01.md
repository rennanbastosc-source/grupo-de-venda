# Spec Técnica: Fatia 01 - Sessão persistente + login automático (store + self-heal)

> **Feature:** `scrape-auth-sessao` | **Status:** `EM ANDAMENTO` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-scrape-auth-sessao-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Persistência de sessão por marketplace no Supabase; módulo server-only de load/save; login HTTP automático por fonte (`mercadolivre` | `amazon` | `shopee`) com credenciais env; `ensureSession(source)` + **1 retry** de re-login se a sessão for inválida; documentar envs em `.env.example`; testes Vitest com `fetch` mock. **Não** altera registry ativo, Firecrawl, scrapers de loja nem UI nesta fatia.
- **Limites da fatia:** Sem Playwright/worker browser. Sem injeção de cookie no scrape. Sem UI. Magalu fora. Login real pode falhar em CAPTCHA/2FA — o código deve **throw** com mensagem clara, nunca inventar cookies.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/007_marketplace_sessions.sql` — tabela de sessão por fonte
  - `[NEW]` `src/lib/scrapers/session/types.ts` — tipos de sessão / status
  - `[NEW]` `src/lib/scrapers/session/store.ts` — load/save via Supabase service role
  - `[NEW]` `src/lib/scrapers/session/ensure.ts` — `ensureSession` + self-heal
  - `[NEW]` `src/lib/scrapers/session/login-mercadolivre.ts` (ou um `login.ts` com switch por fonte — preferir um arquivo por fonte só se >80 linhas; senão `login.ts` único com 3 funções)
  - `[NEW]` `src/lib/scrapers/session/login-amazon.ts` / `login-shopee.ts` **ou** consolidado
  - `[NEW]` `tests/marketplace-session.test.ts`
  - `[MODIFY]` `.env.example` — `ML_LOGIN`/`ML_PASS`, `AMZN_LOGIN`/`AMZN_PASS`, `SHOP_LOGIN`/`SHOP_PASS`
- **Símbolos e funções afetadas:**
  - `loadSession(source) → PlatformSession | null`
  - `saveSession(source, session) → void`
  - `ensureSession(source, opts?) → PlatformSession` (load → validate leve → login se preciso)
  - `performLogin(source) → PlatformSession` (dispatch por fonte)
  - Credenciais: `process.env.ML_LOGIN` etc. (já usadas no `.env.local` do admin; **não** commitar valores)
- **Padrão de referência (só leitura, repo vizinho):** `frota-impacto` `RastrosystemService` — load DB → ensure → login full → save → retry=false no self-heal.
- **Não tocar:** `run-pipeline.ts`, `registry.ts`, `firecrawl.ts`, `OffersManager.tsx`, `app_settings` (singleton id=1 — inadequado para 3 blobs de cookie).

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 007_marketplace_sessions.sql
  create table if not exists public.marketplace_sessions (
    source public.scrape_source primary key
      check (source in ('mercadolivre', 'amazon', 'shopee')),
    cookies jsonb not null default '{}'::jsonb,
    -- cookies: Record<string, string> serializado
    meta jsonb not null default '{}'::jsonb,
    -- meta: { userAgent?, lastLoginAt?, lastError? }
    status text not null default 'unknown'
      check (status in ('ok', 'expired', 'error', 'unknown')),
    last_error text,
    updated_at timestamptz not null default now()
  );

  alter table public.marketplace_sessions enable row level security;
  -- service role bypassa RLS; policy authenticated só se necessário para admin read de status (status/last_error, NÃO cookies) — preferir leitura de status via API server-only na Fatia 03
  ```
- **Tipos TS:**
  ```ts
  type PlatformSession = {
    source: "mercadolivre" | "amazon" | "shopee";
    cookies: Record<string, string>;
    cookieHeader: string; // join "k=v; "
    status: "ok" | "expired" | "error" | "unknown";
    lastError?: string;
    updatedAt?: string;
  };
  ```
- **Login por fonte (contrato de comportamento):**
  - **Mercado Livre:** GET página de login → capturar cookies/CSRF se existir → POST credenciais → exigir cookie de sessão identificável (ex. `ssid` / `nsa_rotok` / `orguserid` — validar no smoke e documentar no código o gate real usado).
  - **Amazon:** fluxo de login web clássico (CSRF/`appActionToken` se presente) → cookie `session-id` + `at-main` ou equivalente; se 2FA → throw `Amazon login requer 2FA/desafio`.
  - **Shopee:** POST/login API ou form; se Cloudflare/login page → throw explícito `Shopee login bloqueado (CAPTCHA/Cloudflare)`.
  - Sem credenciais env → throw `ML_LOGIN/ML_PASS ausentes` (mensagem por fonte).
- **ensureSession:**
  1. load do DB
  2. se cookies vazios → `performLogin` → save status `ok`
  3. opcional: GET leve “estou logado?” (1 URL barata por fonte); se inválido → login + save
  4. se `performLogin` falhar → save status `error` + `last_error` → rethrow
- **Self-heal API (exportada para Fatias 02/03):**
  ```ts
  async function withSessionRetry<T>(
    source: "mercadolivre" | "amazon" | "shopee",
    fn: (session: PlatformSession) => Promise<T>,
  ): Promise<T>
  // tenta fn; se erro indicar sessão inválida, performLogin + save + fn de novo 1x
  ```
- **SCRAPE_MOCK=1:** `ensureSession` / `performLogin` **não** disparam rede de marketplace; retornam sessão dummy in-memory ou short-circuit documentado nos testes.
- **Endpoints:** nenhum novo nesta fatia.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum.
- **Estados Visuais:** N/A.
- **Acessibilidade & Modais:** N/A.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário:** `tests/marketplace-session.test.ts`
  - load vazio → login mock → save cookies
  - ensureSession reutiliza cookies do store sem re-login se status ok e validate mock ok
  - self-heal: 1ª chamada falha “sessão inválida” → re-login → 2ª ok; 3ª falha não re-loga de novo (retry único)
  - sem env de credenciais → throw com nome da env
  - `SCRAPE_MOCK=1` não chama fetch de login real
- [ ] **Integração Backend + UI:** N/A (store com supabase mockável ou interface `SessionStore` injetável nos testes).
- [ ] **Validação Estrita:** `npx vitest run tests/marketplace-session.test.ts` verde; `npm run typecheck`; migration versionada; **nenhum** secret de `.env.local` no git.
- [ ] Migration aplicável em staging/prod **antes** do merge (gate AGENTS.md).

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** migration 007_marketplace_sessions, store (load/save/list), login (ML/Amazon/Shopee), ensureSession/withSessionRetry, .env.example, testes Vitest
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
