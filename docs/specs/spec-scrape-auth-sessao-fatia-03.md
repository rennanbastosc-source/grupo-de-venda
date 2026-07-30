# Spec Técnica: Fatia 03 - Shopee ativo + UI de status de sessão

> **Feature:** `scrape-auth-sessao` | **Status:** `EM ANDAMENTO` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-scrape-auth-sessao-fatia-03.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Reativar **Shopee** em `listActiveScrapeSources()` com o mesmo path autenticado da Fatia 02; API server-only de **status de sessão** por loja (sem vazar cookies); UI mínima no fluxo de **ofertas** (`OffersManager` ou bloco adjacente); erros de login/sessão legíveis; invariantes prontos para append em `STATE.md` no `/sdd-finish`.
- **Limites da fatia:** Sem botão “forçar re-login” (nice-to-have). Sem Playwright. Sem Magalu. Status expõe apenas `status` + `lastError` + `updatedAt` — **nunca** `cookies`.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/scrapers/registry.ts` — `listActiveScrapeSources()` → `["mercadolivre", "amazon", "shopee"]`
  - `[MODIFY]` `src/lib/scrapers/shopee.ts` — `ensureSession` / `withSessionRetry` + scrape com Cookie; remover/relaxar filtro ad-hoc de URLs mock se `isProductOffer` cobrir
  - `[NEW]` `src/app/api/scrape/sessions/route.ts` — `GET` status das 3 fontes (admin auth)
  - `[MODIFY]` `src/components/OffersManager.tsx` — carregar e exibir status por loja
  - `[NEW]` `tests/scrape-sessions-api.test.ts` e/ou estender testes de session store para “public status shape”
  - Opcional: `[MODIFY]` `src/lib/scrapers/session/store.ts` — `listSessionStatuses()` sem cookies
- **Símbolos e funções afetadas:**
  - `listActiveScrapeSources`
  - `shopeeScraper.fetchOffers`
  - `GET /api/scrape/sessions` → `{ sessions: SessionStatusPublic[] }`
  - `OffersManager` — estado local + fetch status no mount e após scrape

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum novo (usa `marketplace_sessions`).
- **GET `/api/scrape/sessions`:**
  ```ts
  // requireUser() — mesmo padrão de /api/offers
  type SessionStatusPublic = {
    source: "mercadolivre" | "amazon" | "shopee";
    status: "ok" | "expired" | "error" | "unknown";
    lastError: string | null;
    updatedAt: string | null; // ISO
  };
  // Response 200: { sessions: SessionStatusPublic[] }
  // Sem cookies, meta sensível, nem credenciais
  ```
  - Se linha ausente no DB → `status: "unknown"`, `updatedAt: null`.
  - Service role ou client admin com policy: se RLS bloquear authenticated de ler a tabela, **só service role no route** e mapear para public shape (preferido — cookies nunca no client Supabase do browser).
- **Shopee scraper:**
  - `SCRAPE_MOCK=1` → fixture com URL de produto válida (`/product/1/2` ou `i.1.2`)
  - Real: `withSessionRetry("shopee", …)` + `scrapeOffersFromUrl` + headers Cookie
  - Falha de login → erro em `runScrape.errors` como `shopee: …` (outras fontes seguem)
- **Registry:**
  ```ts
  export function listActiveScrapeSources() {
    return ["mercadolivre", "amazon", "shopee"] as const;
  }
  ```

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** bloco compacto acima dos filtros ou abaixo do botão scrap em `OffersManager`:
  - Três chips/linhas: Mercado Livre · Amazon · Shopee
  - Texto: `ok` | `expirado` | `erro` | `desconhecido` (+ `lastError` truncado se `error`)
  - Estilo brutalist existente (`text-sm`, `b-label`, cores `text-ok` / `text-danger` / `text-muted`)
- **Estados Visuais:**
  - Loading: “Sessões…” discreto
  - Após “Rodar scrap agora”: re-fetch de status
  - Empty: fontes unknown se nunca logou
- **Acessibilidade:** `role="status"` no bloco; não só cor.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** API sessions retorna shape público sem campo cookies (mock supabase/store)
- [ ] **Teste:** registry inclui `shopee`; mock path Shopee passa `isProductOffer`
- [ ] **Integração Backend + UI:** OffersManager lista 3 status; scrape com mock não quebra UI
- [ ] **Validação Estrita:** lint + typecheck + `npm run test` verdes
- [ ] Checklist finish: invariantes (credenciais/cookies server-only; mock sem login; Shopee ativa com sessão; filtro produto) prontos para `STATE.md`

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** Shopee ativa em listActiveScrapeSources(), shopeeScraper com withSessionRetry, GET /api/scrape/sessions (sem vazar cookies), chips de status de sessão no OffersManager, testes de integração API
- **Pendente:** —
- **Próximo comando:** `/sdd-validate` (após Fatia 03 → `/sdd-validate`)
