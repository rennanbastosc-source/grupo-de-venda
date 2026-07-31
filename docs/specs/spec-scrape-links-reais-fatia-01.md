# Spec Técnica: Fatia 01 - Harvest de links + validação HTTP + wire 3 fontes

> **Feature:** `scrape-links-reais` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-31

<!-- Arquivo: docs/specs/spec-scrape-links-reais-fatia-01.md — o <slug> no nome é obrigatório e isola esta feature de fluxos SDD paralelos. -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Eliminar URLs inventadas pelo Firecrawl `extract` LLM. Client passa a harvest **links + html** reais; mapear hrefs → `RawOffer`; manter `isProductOffer`; **validar HTTP** (descartar 404) antes do upsert; rewire ML/Amazon/Shopee sem prompt LLM; testes mock. Admin clica oferta no dashboard e cai em produto real (ou lista vazia honesta).
- **Limites da fatia:** Sem Playwright/login CAPTCHA. Sem Magalu. Sem mudança de contrato `runScrape` / cron / `POST /api/scrape/run` / UI além do que já existe (`scrapeMsg`, lista). Soft-404 por parse de body multi-idioma = nice-to-have (status 404 basta no MVP). Sem SDK npm novo.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/scrapers/firecrawl.ts` — tirar extract/schema LLM; `formats: ["links","html"]`; mapear → `RawOffer[]` via harvest
  - `[NEW]` `src/lib/scrapers/html-extract.ts` — `extractOffersFromHtml(html, baseUrl, { hostIncludes, hrefPattern, max? })` (stdlib regex; não existia no repo)
  - `[NEW]` `src/lib/scrapers/url-alive.ts` — `filterAliveUrls` / `isUrlAlive` (HEAD→GET fallback; regras 404 drop / 403 keep)
  - `[MODIFY]` `src/lib/scrapers/run-pipeline.ts` — após `isProductOffer` + normalize/dedupe, filtrar por alive **exceto** quando `SCRAPE_MOCK=1`
  - `[MODIFY]` `src/lib/scrapers/amazon.ts` — sem `PROMPT`; harvest com padrão Amazon; default URL alinhar goldbox se útil
  - `[MODIFY]` `src/lib/scrapers/mercadolivre.ts` — idem ML
  - `[MODIFY]` `src/lib/scrapers/shopee.ts` — idem Shopee; opcional `waitFor` no client se exposto
  - `[MODIFY]` `tests/firecrawl-scraper.test.ts` — mock `data.links`/`data.html`; assert body **sem** `extract`
  - `[NEW]` `tests/html-extract.test.ts` e/ou `tests/url-alive.test.ts`
  - `[MODIFY]` `tests/product-filter.test.ts` — só se precisar caso Shopee estrito (opcional)
- **Símbolos e funções afetadas:**
  - `scrapeOffersFromUrl(targetUrl, opts)` — **nova assinatura** (sem `prompt` obrigatório):  
    `opts: { max?, signal?, headers?, waitFor?, hostIncludes, hrefPattern }`  
    Retorna `Promise<RawOffer[]>`. Call sites = 3 scrapers apenas.
  - `extractOffersFromHtml` — harvest de anchors
  - `isUrlAlive(url): Promise<boolean>` / `filterAliveOffers(offers): Promise<RawOffer[]>`
  - `isProductOffer` — **inalterado** em comportamento (pipeline continua filtrando)
  - `runScrape` — contrato retorno `{ sources, found, upserted, errors }` **inalterado**
  - `withSessionRetry` + Cookie header — mantidos nos 3 scrapers
  - `OffersManager` — sem mudança de código (consome `/api/offers` e scrapeMsg existentes)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum. Tabelas `offers`, `scrape_runs`, `marketplace_sessions` inalteradas.
- **Firecrawl request (novo body happy path):**
  ```ts
  {
    url: targetUrl,
    formats: ["links", "html"],
    onlyMainContent: true,
    timeout: 40000,
    // opcional: waitFor?: number (ms) — Shopee SPA
    headers?: { Cookie?: string; "User-Agent"?: string }
  }
  // Response usada:
  // data.links: string[]
  // data.html?: string
  // NÃO usar data.extract / formats extract
  ```
  - `FIRECRAWL_API_KEY` ausente → throw `FIRECRAWL_API_KEY ausente` (igual hoje).
  - HTTP Firecrawl não-OK → throw `Firecrawl HTTP ${status}: …` (igual).
- **Harvest → RawOffer:**
  1. Se `html` presente e não vazio → `extractOffersFromHtml` com `hostIncludes` + `hrefPattern` da fonte.
  2. Complementar/fallback: iterar `links[]`, absolutizar se relativo, filtrar host + `hrefPattern`, dedupe por URL; título = texto do anchor se veio do HTML, senão slug decodificado do path (fallback curto ≤ 240).
  3. `priceCents` opcional (HTML anchor se `parsePriceToCents` achar; senão omitir).
  4. Cap `max` default 15.
- **Padrões por fonte (alinhados a `product-filter`):**

  | Fonte | hostIncludes | hrefPattern (essência) |
  |-------|--------------|------------------------|
  | mercadolivre | `mercadolivre.com.br` | `/p/MLB`, `/up/MLB`, ou path com produto MLB |
  | amazon | `amazon.com.br` | `/dp/[A-Z0-9]{10}` ou `/gp/product/` |
  | shopee | `shopee.com.br` | `i.\d+.\d+` ou `/product/\d+/\d+` |

- **Validação HTTP (`url-alive`):**
  ```ts
  // Pseudocódigo
  async function isUrlAlive(url: string, opts?: { timeoutMs?: number }): Promise<boolean> {
    // 1) HEAD com redirect follow, timeout 5–8s
    // 2) se HEAD não suportado / 405 / rede ambígua → GET leve (sem baixar body inteiro se possível)
    // 3) status 404 ou 410 → false (descartar)
    // 4) status 2xx / 3xx → true
    // 5) status 403 / 401 / 429 → true (manter se formato produto ok — evita falso negativo em massa)
    // 6) erro de rede / timeout → false (descartar item; NÃO throw na fonte)
  }
  ```
  - Pipeline: `SCRAPE_MOCK === "1"` → **pula** alive check.
  - Paralelismo limitado (ex. 3–5 concurrent) sobre ≤15 URLs.
  - `found` = contagem **após** `isProductOffer` (e preferencialmente após alive, para não reportar mortos como found) — documentar: `itemsFound` = raws que passaram filtro de produto **e** alive (exceto mock).
- **Scrapers (padrão):**
  ```ts
  async function fetchOffers() {
    if (process.env.SCRAPE_MOCK === "1") return fixtures; // URL produto válida
    return withSessionRetry(source, (session) =>
      scrapeOffersFromUrl(DEFAULT_URL, {
        headers: session.cookieHeader ? { Cookie: session.cookieHeader } : undefined,
        hostIncludes: "…",
        hrefPattern: /…/,
        // waitFor: 2500 // shopee se necessário
      }),
    );
  }
  ```
  - Amazon default: `process.env.SCRAPE_AMAZON_URL || "https://www.amazon.com.br/gp/goldbox"` (alinhar `.env.example`; sair de `/deals` se for pior em links de produto).
  - Shopee/ML defaults: manter env + flash_sale / ofertas.
- **Endpoints HTTP app:** inalterados (`POST /api/scrape/run`, cron scrape, `GET /api/offers`).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum novo. `OffersManager` já lista `offers` e mostra `scrapeMsg` com `found`/`upserted`/`errors`.
- **Estados Visuais:**
  - Sucesso: ofertas com URL real clicável.
  - Empty honesto: “Nenhuma oferta” se harvest+alive = 0.
  - Erro fonte: `shopee: Firecrawl HTTP …` em `scrapeMsg` (já existe).
- **Acessibilidade:** N/A (sem UI nova).

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário:** `tests/firecrawl-scraper.test.ts`
  - body request: `formats` inclui `links` e `html`; **não** inclui `extract` / schema LLM
  - mock `data.links` com `/dp/B0REALASIN12` → 1 offer com essa URL
  - link fora do padrão (ex. `/b?node=`) não vira offer quando `hrefPattern` amazon
  - sem key → throw `FIRECRAWL_API_KEY`
- [ ] **Teste Unitário:** `tests/html-extract.test.ts` (ou embutido)
  - HTML com `<a href="https://www.amazon.com.br/dp/B0876MJBG6">Mouse</a>` → title+url
- [ ] **Teste Unitário:** `tests/url-alive.test.ts`
  - mock fetch 404 → `isUrlAlive` false
  - mock 200 → true
  - mock 403 → true (política keep)
  - mock rede throw → false (não propaga)
- [ ] **Teste:** pipeline/mock — com `SCRAPE_MOCK=1`, fixtures passam e **não** chamam alive externo (spy fetch marketplace ou env)
- [ ] **Integração Backend + UI:** botão “Rodar scrap agora” inalterado; lista reflete só URLs que passaram filtros (smoke manual pós-deploy)
- [ ] **Validação Estrita:** `npm run lint` + `npm run typecheck` + `npm run test` verdes

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído (as-built):**
  - `scrapeOffersFromUrl(url, { hostIncludes, hrefPattern, max?, headers?, waitFor? })` — `formats: ["links","html"]`, sem extract LLM
  - `html-extract.ts`: `extractOffersFromHtml` + `harvestOffers` (HTML título vence; links fallback slug)
  - `url-alive.ts`: HEAD→GET; 404/410 drop; 401/403/429 keep; rede/timeout drop item
  - `run-pipeline`: `isProductOffer` → `filterAliveOffers` se `SCRAPE_MOCK≠1` → normalize/upsert
  - Scrapers ML/Amazon/Shopee: padrões de URL; Amazon default `gp/goldbox`; Shopee `waitFor: 2500`
  - Fix colateral: `worker/src/baileys/phone.ts` cópia local de `normalizePhone` (rootDir worker sem import app)
  - Testes: firecrawl-scraper, html-extract, url-alive; suíte 106; worker:typecheck verde
- **Pendente:** —
- **Próximo comando:** `/sdd-plan <nova-feature>` (pós-merge)
