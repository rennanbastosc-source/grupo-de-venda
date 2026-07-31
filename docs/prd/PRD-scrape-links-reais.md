# PRD: Scrape por links reais (anti-URL inventada)

## 1. Resumo Executivo & Problema
- **Problema:** O scrape via Firecrawl `extract` (LLM) grava URLs que **não existem** na página: ASINs Amazon inventados (404 “DESCULPE” ao clicar no dashboard) e URLs Shopee fake/filtradas (lista vazia ou lixo). Cupons/menus genéricos ainda passam se o formato bater com regex. O funil ofertas → afiliado → disparo quebra na confiança do link.
- **Proposta de Valor:** Parar de confiar no LLM para inventar `url`. Harvest de **links/HTML reais** da página (Firecrawl `links` + `html`), filtrar por padrão de produto (`isProductOffer`), e **validar HTTP** (descartar 404/soft-404) antes do upsert. Admin só vê produtos clicáveis.
- **Público-Alvo / Personas:**
  - **Admin single-tenant:** roda scrap (botão/cron), revisa e aprova em `/dashboard/ofertas`.
  - Membros de grupos WhatsApp: só consomem promo depois (fora do escopo de UI desta feature).

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Client de scrape usa conteúdo real da página (`formats` com `links` e/ou `html`), **sem** `extract` LLM no happy path; mapeia hrefs → `RawOffer` (reuso de `html-extract` quando houver HTML).
- [ ] **RF-02:** Wire das três fontes ativas — **Mercado Livre**, **Amazon**, **Shopee** — com padrões de URL de produto alinhados ao filtro existente.
- [ ] **RF-03:** Manter `isProductOffer` no pipeline (`run-pipeline`) como trava de formato (menus, cupons sem `/dp/`, Shopee sem `i.shop.item` / `/product/…`).
- [ ] **RF-04:** **Validação HTTP pós-scrape** antes do upsert: HEAD ou GET leve por URL candidata; descartar respostas 404 (e soft-404 óbvios quando detectáveis com custo baixo); timeout curto por URL; falha de rede em uma URL **não** derruba a fonte inteira (só descarta o item).
- [ ] **RF-05:** `SCRAPE_MOCK=1` continua com fixtures de URL de produto válida, **sem** rede Firecrawl nem HEAD externo.
- [ ] **RF-06:** Contrato de `runScrape` / cron / `POST /api/scrape/run` / status `new` **inalterado**; erros por fonte seguem em `errors[]`.
- [ ] **RF-07:** Testes unitários do client (mock `fetch`): body sem extract LLM; só links presentes no mock viram oferta; 404 mockado é descartado.
- [ ] **RF-08:** Magalu permanece stub; sessão/cookies existentes (Cookie header) podem continuar injetados se presentes — login CAPTCHA/Playwright **fora** deste PRD.

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Performance / SLA:** timeout scrape página ≤ ~45s (como hoje); validação HTTP com teto por item (ex. 5–8s) e teto de N itens já limitado pelo max de ofertas (~15); não serializar de forma a estourar o request Vercel sem necessidade (batch paralelo limitado ok se enxuto).
- **Segurança & Permissões:** `FIRECRAWL_API_KEY`, cookies e credenciais **somente** server/env; nunca no client; scrape só admin autenticado ou cron com `CRON_SECRET`.
- **Compatibilidade:** Next.js 16 (Vercel) + `src/lib/scrapers/*` + Vitest; preferir `fetch` fino, sem SDK npm novo.
- **Código enxuto (Ponytail):** reutilizar `html-extract`, `product-filter`, `canonicalizeUrl`; não inventar browser farm; validação HTTP mínima (status code), sem Playwright.
- **Imutável:** contrato `runScrape` + mock sem rede de marketplace/Firecrawl quando `SCRAPE_MOCK=1`.

## 4. Métricas de Sucesso (KPIs)
- Sample manual: clique em oferta Amazon no dashboard **não** abre página “não encontramos esta página”.
- Shopee: ou grava links reais (`i.\d+.\d+` / `/product/\d+/\d+`) ou `found=0` honesto — **zero** URL inventada.
- Menos lixo: cupons/menus continuam rejeitados pelo filtro.
- CI verde com `SCRAPE_MOCK=1` (sem depender de Firecrawl/HEAD real).

## 5. Casos de Uso & Fluxos do Usuário
1. **Fluxo Principal (Happy Path):**
   - Admin clica “Rodar scrap agora” (ou cron) → Firecrawl devolve links/html da página de ofertas → harvest filtra padrões de produto → HEAD/GET descarta 404 → upsert `offers` `new` → admin clica título e cai em página de produto real.
2. **Fluxo de Exceção:**
   - Extract/links vazios (anti-bot Shopee) → `found=0` para a fonte, run ok ou erro explícito da fonte se HTTP Firecrawl falhar; **não** inventa ofertas.
   - URL com formato ok mas 404 → item descartado, demais seguem.
   - `SCRAPE_MOCK=1` → fixtures; sem Firecrawl nem validação HTTP externa.
