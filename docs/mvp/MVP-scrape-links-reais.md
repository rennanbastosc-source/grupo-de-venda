# MVP Scope & Slice Breakdown: Scrape por links reais

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Client Firecrawl: `links` + `html` (sem extract LLM no happy path) → `RawOffer[]`
- Wire **ML + Amazon + Shopee** com padrões de URL de produto
- Manter `isProductOffer` no pipeline
- **Validação HTTP** (HEAD/GET) descartando 404 antes do upsert
- Testes unitários do client (mock fetch) + cobertura do descarte 404
- `SCRAPE_MOCK=1` sem rede; contrato `runScrape` inalterado

### 🟡 Nice-To-Have (Postergado)
- Login real CAPTCHA / Playwright / cookie manual na UI
- Soft-404 semântico profundo (parse body “não encontramos” multi-idioma além do status)
- Magalu real
- Migrar API Firecrawl v1 → v2 só por moda (só se `links` falhar no endpoint atual)
- UI nova além de `scrapeMsg` / lista já existentes

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Harvest de links + validação HTTP + wire 3 fontes
- **Objetivo:** Eliminar URLs inventadas no funil de ofertas. Refatorar client de scrape para harvest real (`links`/`html` + `html-extract`), aplicar `isProductOffer`, validar existência HTTP (descartar 404), ligar ML/Amazon/Shopee, testes mock, defaults de URL alinhados ao `.env.example` quando necessário.
- **Dependências:** Nenhuma (sobre `firecrawl-scrape` + `scrape-auth-sessao` já integrados).
- **Status:** `PENDENTE`
- **Entrega ponta a ponta:** Backend (client + scrapers + gate HTTP no pipeline ou helper) + UI inalterada em contrato (lista/ofertas já consome `offers`) + Testes Vitest.

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** Nenhuma oferta scrapada com URL que o sistema saiba ser 404 (validação HTTP do MVP) ou que não case padrão de produto (`isProductOffer`).
- **Invariante 2:** `SCRAPE_MOCK=1` não chama Firecrawl nem HEAD externo de marketplace.
- **Invariante 3:** Contrato `runScrape` / cron / `POST /api/scrape/run` / status `new` não muda.
- **Invariante 4:** Secrets (`FIRECRAWL_API_KEY`, cookies) só server.
- **Risco 1:** Shopee flash_sale devolve zero links sem sessão/browser real → lista vazia honesta. → **Mitigação:** `waitFor` curto no scrape se útil; cookie header se sessão ok; Playwright fica nice-to-have.
- **Risco 2:** HEAD bloqueado (403) por marketplace → falso negativo. → **Mitigação:** fallback GET leve; se status 2xx/3xx aceita; 403 sem body conclusivo pode **manter** item se formato de produto ok (documentar no spec) — preferir não dropar em massa por 403 genérico.
- **Risco 3:** Validação HTTP multiplica latência. → **Mitigação:** max ~15 URLs, timeout curto, paralelismo limitado (ex. 3–5 concurrent).
