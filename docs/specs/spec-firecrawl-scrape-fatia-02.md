# Spec Técnica: Fatia 02 - Wire ML, Amazon e Shopee no pipeline

> **Feature:** `firecrawl-scrape` | **Status:** `PENDENTE` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-firecrawl-scrape-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Substituir harvest HTML frágil de ML/Amazon por `scrapeOffersFromUrl`; implementar scraper Shopee real; manter path `SCRAPE_MOCK=1` com fixtures por fonte; atualizar `registry` para fontes ativas `mercadolivre | amazon | shopee`; Magalu permanece stub em `stubs.ts`; contrato `runScrape` / `Scraper` / cron / `POST /api/scrape/run` **inalterados**.
- **Limites da fatia:** Sem multi-página; sem Magalu real; sem mudança de schema Supabase; sem UI nova (botão “Rodar scrape” já existe). Sem smoke real de créditos (Fatia 03).

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/scrapers/mercadolivre.ts` — mock + Firecrawl
  - `[MODIFY]` `src/lib/scrapers/amazon.ts` — mock + Firecrawl
  - `[NEW]` `src/lib/scrapers/shopee.ts` — mock + Firecrawl
  - `[MODIFY]` `src/lib/scrapers/stubs.ts` — apenas `magaluScraper`
  - `[MODIFY]` `src/lib/scrapers/registry.ts` — import shopee; `listActiveScrapeSources` → 3 fontes
  - `[MODIFY]` se necessário `tests/dedupe-offers.test.ts` (continua com `SCRAPE_MOCK=1`)
- **Símbolos e funções afetadas:**
  - `mercadolivreScraper`, `amazonScraper`, `shopeeScraper` (`Scraper`)
  - `getScraper`, `listActiveScrapeSources`, `listAllScrapeSources`
  - `runScrape` (consumidor, sem mudança de assinatura)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** inalterados.
- **Env por fonte:**
  | Var | Default |
  |-----|---------|
  | `SCRAPE_ML_URL` | `https://lista.mercadolivre.com.br/ofertas` |
  | `SCRAPE_AMAZON_URL` | `https://www.amazon.com.br/gp/goldbox` |
  | `SCRAPE_SHOPEE_URL` | `https://shopee.com.br/flash_sale` |
  | `SCRAPE_MOCK` | `1` em CI/dev local atual; prod sem mock |
  | `FIRECRAWL_API_KEY` | obrigatória se mock off |
- **Registry:**
  ```ts
  listActiveScrapeSources(): ["mercadolivre", "amazon", "shopee"]
  ```

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum arquivo novo.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/firecrawl-scraper.test.ts` e `tests/dedupe-offers.test.ts` verdes com `SCRAPE_MOCK=1`.
- [ ] **Validação Estrita:** `npm run typecheck` + `npm run test` verdes.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** rewrites ML/Amazon, shopee.ts, registry, stubs, testes
- **Próximo comando:** `/sdd-implement`
