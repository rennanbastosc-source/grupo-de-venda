# Spec Técnica: Fatia 01 - Client Firecrawl + testes unitários

> **Feature:** `firecrawl-scrape` | **Status:** `EM ANDAMENTO` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-firecrawl-scrape-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Client HTTP server-only `scrapeOffersFromUrl` que chama `POST https://api.firecrawl.dev/v1/scrape` com `formats: ["extract"]` + schema JSON de ofertas; coerção de preço; cap max 15; erros explícitos sem key e HTTP não-OK; suite Vitest com `fetch` mock; documentar `FIRECRAWL_API_KEY` e URLs opcionais em `.env.example`.
- **Limites da fatia:** Não reescreve scrapers de loja, não altera registry/pipeline/UI. Sem package npm `firecrawl-js` se `fetch` bastar. Sem smoke real (créditos) — isso é Fatia 03.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `src/lib/scrapers/firecrawl.ts` — client + schema + `coercePriceCents` (interno)
  - `[NEW]` `tests/firecrawl-scraper.test.ts`
  - `[MODIFY]` `.env.example` — documentar `FIRECRAWL_API_KEY`, `SCRAPE_*_URL`, `SCRAPE_MOCK`
- **Símbolos e funções afetadas:**
  - `scrapeOffersFromUrl(targetUrl, prompt, opts?) → Promise<FirecrawlOffer[]>`
  - `FirecrawlOffer` (alias / compatível com `RawOffer`)
  - Reutiliza tipo `RawOffer` de `src/lib/scrapers/types.ts` (não duplicar shape)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum (sem migration).
- **Schema extract Firecrawl (request body):**
  ```ts
  {
    url: string;
    formats: ["extract"];
    onlyMainContent: true;
    timeout: 40000;
    extract: {
      prompt: string;
      schema: {
        type: "object";
        properties: {
          offers: {
            type: "array";
            items: {
              type: "object";
              properties: {
                title: { type: "string" };
                url: { type: "string" };
                priceCents: { type: "number" };
                imageUrl: { type: "string" };
                externalId: { type: "string" };
              };
              required: ["title", "url"];
            };
          };
        };
        required: ["offers"];
      };
    };
  }
  ```
- **Resposta mapeada:**
  ```ts
  // data.extract.offers[] → FirecrawlOffer[]
  type FirecrawlOffer = {
    title: string;       // trim, max 240
    url: string;
    priceCents?: number; // coerce: reais fracionários → *100; inteiros grandes → centavos
    imageUrl?: string;
    externalId?: string;
  };
  ```
- **Erros:**
  - `FIRECRAWL_API_KEY` ausente/vazia → `throw Error("FIRECRAWL_API_KEY ausente")`
  - HTTP `!ok` → `throw Error("Firecrawl HTTP <status>: <body slice 200>")`
  - extract ausente / não-array → `[]` (não throw)
- **Timeout:** AbortController 45s default; `opts.signal` opcional.
- **Endpoints / Server Actions:** nenhum novo nesta fatia.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum.
- **Estados Visuais:** N/A.
- **Acessibilidade & Modais:** N/A.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário:** `tests/firecrawl-scraper.test.ts`
  - throws sem API key
  - mapeia `data.extract.offers` e envia `Authorization: Bearer …` + body com `formats`/`extract.schema`
  - throws em HTTP não-OK (ex. 402)
  - respeita `max` (cap 15 default)
- [ ] **Integração Backend + UI:** N/A nesta fatia.
- [ ] **Validação Estrita:** `npx vitest run tests/firecrawl-scraper.test.ts` verde; `npm run typecheck` verde; key **não** aparece em arquivos versionados.

## 6. Checkpoint de Execução
- **Status:** `EM ANDAMENTO`
- **Concluído:** —
- **Pendente:** client, testes, `.env.example`
- **Próximo comando:** `/sdd-implement`
