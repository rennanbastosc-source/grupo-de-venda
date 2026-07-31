# Spec Técnica: Fatia 02 - Scrape autenticado ML/Amazon + filtro anti-lixo

> **Feature:** `scrape-auth-sessao` | **Status:** `EM ANDAMENTO` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-scrape-auth-sessao-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Injetar cookies/headers de `PlatformSession` no client de scrape (`scrapeOffersFromUrl`); wire **Mercado Livre** e **Amazon** para `ensureSession` + scrape autenticado (ou path HTTP autenticado se Firecrawl headers forem insuficientes); **filtro anti-lixo** obrigatório antes de normalizar/upsert; prompts/URLs focados em produtos físicos; testes do filtro e do client com headers. Shopee permanece **fora** do registry ativo nesta fatia (Fatia 03). UI inalterada além de erros já retornados por `runScrape.errors`.
- **Limites da fatia:** Não implementa UI de status. Não reativa Shopee. Não Playwright. Contrato de `runScrape` / `OfferStore` / status `new` **não muda**.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/scrapers/firecrawl.ts` — `opts.headers?: Record<string, string>`; repassar no body Firecrawl (`headers` no payload da API se suportado) e/ou documentar fallback
  - `[NEW]` `src/lib/scrapers/product-filter.ts` — `isProductOffer(source, raw): boolean`
  - `[MODIFY]` `src/lib/scrapers/mercadolivre.ts` — ensureSession + cookie no scrape; prompt produto
  - `[MODIFY]` `src/lib/scrapers/amazon.ts` — idem
  - `[MODIFY]` `src/lib/scrapers/run-pipeline.ts` — aplicar filtro após `fetchOffers` (ou dentro dos scrapers — preferir **um único ponto** no pipeline para não esquecer fonte)
  - `[NEW]` `tests/product-filter.test.ts`
  - `[MODIFY]` `tests/firecrawl-scraper.test.ts` — assert headers repassados quando `opts.headers` setado
- **Símbolos e funções afetadas:**
  - `scrapeOffersFromUrl(url, prompt, { max?, signal?, headers? })`
  - `isProductOffer(source, raw: RawOffer): boolean`
  - `mercadolivreScraper.fetchOffers` / `amazonScraper.fetchOffers`
  - `runScrape` → filtra raws antes de `normalizeRaw`
  - Reutiliza Fatia 01: `ensureSession`, `withSessionRetry`
- **Estado atual (contexto):**
  - `listActiveScrapeSources()` = `["mercadolivre", "amazon"]` (Shopee desligada)
  - Firecrawl já filtra títulos de menu parcialmente; **não basta** — falta gate de URL por fonte

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum novo (sessões da Fatia 01).
- **Firecrawl request (extensão):**
  ```ts
  // body adicional quando session presente:
  {
    url, formats: ["extract"], onlyMainContent, timeout, extract,
    headers?: { Cookie: string, "User-Agent"?: string }
  }
  ```
  - Se a API Firecrawl rejeitar `headers` no body, fallback documentado: fetch HTML autenticado (Cookie) + extract local mínimo **ou** erro explícito — implementar o path mais enxuto que funcione no smoke; não inventar SDK.
- **Filtro anti-lixo (`isProductOffer`):**
  | Fonte | URL aceita (qualquer um) | Título rejeita (substring, case-insensitive) |
  |-------|--------------------------|-----------------------------------------------|
  | mercadolivre | `/p/MLB`, `/up/MLB`, path com `MLB\d+` em produto | já tenho conta, sou novo, central de privacidade, termos, carrinho, ajuda |
  | amazon | `/dp/[A-Z0-9]{10}`, `/gp/product/` | `^\d+%\s*off`, cupom genérico de categoria sem ASIN |
  | shopee (prep Fatia 03) | `i.\d+.\d+`, `/product/\d+/\d+` | placeholders genéricos |
  - Sem `priceCents` **não** é motivo único de rejeição se URL de produto ok (preço opcional no schema).
  - Cupons Amazon tipo “15% off em Ferramentas” com URL **sem** `/dp/` → rejeitar.
- **Scrapers ML/Amazon:**
  ```ts
  async function fetchOffers() {
    if (SCRAPE_MOCK === "1") return fixtures; // sem ensureSession rede
    return withSessionRetry("mercadolivre", async (session) => {
      const raws = await scrapeOffersFromUrl(DEFAULT_URL, PROMPT, {
        headers: { Cookie: session.cookieHeader },
      });
      return raws; // filtro global no pipeline
    });
  }
  ```
- **Pipeline:**
  ```ts
  const raws = (await scraper.fetchOffers()).filter((r) =>
    isProductOffer(src, r),
  );
  ```
- **Endpoints:** inalterados (`POST /api/scrape/run`, cron scrape).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum novo. `OffersManager` já mostra `scrapeMsg` com `errors[]`.
- **Estados Visuais:** erros de login/sessão aparecem como `mercadolivre: …` / `amazon: …` na mensagem existente.
- **Acessibilidade:** N/A.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário:** `tests/product-filter.test.ts`
  - aceita URL ML `/p/MLB…` e Amazon `/dp/B0…`
  - rejeita “Já tenho conta”, cupom “15% off em Ferramentas” sem `/dp/`, URL Shopee genérica (prep)
- [ ] **Teste Unitário:** `tests/firecrawl-scraper.test.ts` — body/headers incluem Cookie quando passado
- [ ] **Integração Backend + UI:** botão scrap continua; com mock, fixtures passam filtro se tiverem URL de produto (ajustar fixtures mock se necessário)
- [ ] **Validação Estrita:** `npm run test` / typecheck; zero mudança de contrato de resposta de `runScrape` além de `found` menor (filtrado)

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** product-filter, headers no client Firecrawl, wire ML/Amazon com withSessionRetry, filtro no run-pipeline, testes unitários product-filter e firecrawl
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
