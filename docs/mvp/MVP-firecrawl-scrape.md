# MVP Scope & Slice Breakdown: Firecrawl Scrape (ML / Amazon / Shopee)

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Client Firecrawl server-only (`scrapeOffersFromUrl`) com schema extract de ofertas + testes unitários (fetch mock)
- Scrapers **Mercado Livre**, **Amazon**, **Shopee** via Firecrawl; `SCRAPE_MOCK=1` com fixtures
- `FIRECRAWL_API_KEY` só em env; documentado em `.env.example`
- Wire no `registry` + pipeline `runScrape` inalterado no contrato
- Ofertas entram `status=new` para o dashboard de ofertas já existente
- Smoke local (1 run real opcional) + nota de env Vercel + invariantes em `STATE.md` no finish

### 🟡 Nice-To-Have (Postergado para versões futuras)
- Magalu real
- Crawl multi-página / pagination
- UI de configuração de URLs de fonte (hoje via env)
- Auto-aprovação por regras de desconto
- SDK oficial `firecrawl-js` (só se fetch ficar insuficiente)
- Monitoramento de créditos Firecrawl no overview
- Rate limit dedicado além do timeout e do cron

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Client Firecrawl + testes unitários
- **Objetivo:** Entregar `src/lib/scrapers/firecrawl.ts` (`scrapeOffersFromUrl`), schema fixo, coerção de preço, erros de key/HTTP, cap max 15; suite `tests/firecrawl-scraper.test.ts`; vars documentadas em `.env.example`.
- **Dependências:** Nenhuma (API externa mockada nos testes)
- **Status:** `EM ANDAMENTO`

### 📦 Fatia 02: Wire ML, Amazon e Shopee no pipeline
- **Objetivo:** Reescrever scrapers ML/Amazon para usar Firecrawl; implementar Shopee real; registry com 3 fontes ativas; Magalu stub; manter mock path; typecheck + testes de dedupe/pipeline verdes.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

### 📦 Fatia 03: Smoke operacional, env prod e documentação de estado
- **Objetivo:** Validar extract real (opcional, 1 fonte) ou documentar path API v1/v2 se divergir; garantir botão/cron de scrape alimenta dashboard; checklist Vercel `FIRECRAWL_API_KEY`; preparar invariantes para `STATE.md` (append no finish). UI: feedback mínimo se scrape falhar por key (mensagem de erro já no fluxo de run, sem redesign).
- **Dependências:** Fatia 02
- **Status:** `PENDENTE`

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** `FIRECRAWL_API_KEY` nunca vai para o client bundle nem para o git.
- **Invariante 2:** Contrato de `runScrape` / estados de oferta não muda; ofertas scrapadas entram como `new`.
- **Invariante 3:** `SCRAPE_MOCK=1` nunca chama a API Firecrawl.
- **Invariante 4:** Sem multi-página neste MVP; max 15 ofertas por fonte por run.
- **Invariante 5:** Magalu permanece stub até feature dedicada.
- **Risco 1:** Créditos free esgotam rápido com extract. → **Mitigação:** mock em CI; 1 página/fonte; cron espaçado; smoke manual controlado.
- **Risco 2:** Schema API Firecrawl v1 `extract` vs v2 `json` divergir. → **Mitigação:** smoke na Fatia 03; ajustar um único client se necessário.
- **Risco 3:** Marketplaces bloqueiam mesmo com Firecrawl. → **Mitigação:** proxy/geo BR se a API suportar; fallback URL manual no painel.
- **Risco 4:** Preço em reais vs centavos inconsistente no extract. → **Mitigação:** prompt pede centavos + `coercePriceCents` no client.
