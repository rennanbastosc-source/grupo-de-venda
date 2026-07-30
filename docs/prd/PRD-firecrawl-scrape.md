# PRD: Firecrawl Scrape (ML / Amazon / Shopee)

## 1. Resumo Executivo & Problema
- **Problema:** O pipeline de scraping atual depende de `fetch` + harvest HTML frágil (ou `SCRAPE_MOCK=1`), o que não entrega ofertas reais de forma confiável em marketplaces com anti-bot e páginas JS-heavy (em especial Shopee). Sem ofertas reais em volume, o funil dashboard → afiliado → disparo WhatsApp não sustenta a meta operacional de disparos/dia.
- **Proposta de Valor:** Integrar **Firecrawl** (server-side, extract estruturado) para scrapar páginas de ofertas do **Mercado Livre**, **Amazon** e **Shopee**, normalizar e gravar ofertas com status `new` no fluxo já existente, para o admin filtrar/aprovar no dashboard e disparar via chatbot.
- **Público-Alvo / Personas:**
  - **Admin single-tenant:** opera scrape (cron ou botão), revisa ofertas em `/dashboard/ofertas`, aprova e dispara.
  - **Membros de grupos WhatsApp:** só consomem promos (fora do escopo de UI desta feature).

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Client server-only que chama a API Firecrawl com schema fixo de ofertas (`title`, `url`, `priceCents?`, `imageUrl?`, `externalId?`), max 15 itens por fonte por run.
- [ ] **RF-02:** Scrapers ativos **Mercado Livre**, **Amazon** e **Shopee** via Firecrawl (URLs configuráveis por env).
- [ ] **RF-03:** Modo `SCRAPE_MOCK=1` retorna fixtures **sem** chamar Firecrawl (CI e dev seguro de créditos).
- [ ] **RF-04:** Sem `FIRECRAWL_API_KEY` e sem mock → erro explícito (não engolir falha).
- [ ] **RF-05:** Integração no pipeline existente (`runScrape` → upsert → `status=new`); cron e `POST /api/scrape/run` continuam como portas de entrada.
- [ ] **RF-06:** Ofertas scrapadas aparecem no dashboard de ofertas para filtro/aprovação (fluxo as-built; sem redesign obrigatório nesta feature).
- [ ] **RF-07:** Magalu permanece stub (fora do MVP desta feature).

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Performance / SLA:** timeout por request ≤ 45s; 1 página por fonte por run (sem multi-página); respeitar créditos free (~1k) — extract custa mais que markdown puro.
- **Segurança & Permissões:** `FIRECRAWL_API_KEY` **somente** env/server (`.env.local`, secrets Vercel); nunca no client nem no git; scrape só admin autenticado ou cron com `CRON_SECRET`.
- **Compatibilidade:** Next.js 16 app (Vercel) + pipeline `src/lib/scrapers/*` existente; preferir `fetch` fino (sem SDK npm se não for necessário).
- **Contrato:** não quebrar assinaturas de `runScrape`, `OfferStore`, estados de oferta (`new` | `approved` | `rejected` | `sent`).
- **Compliance scraping:** volume baixo, backoff via cron existente, cache Firecrawl quando disponível; fallback manual de URL no painel permanece válido.

## 4. Métricas de Sucesso (KPIs)
- ≥ 1 run real (não-mock) por fonte configurada com key válida produz ofertas `new` utilizáveis no dashboard.
- Zero URL “crua” no WhatsApp continua valendo (ainda passa por afiliado antes do disparo — invariante da plataforma).
- CI verde com `SCRAPE_MOCK=1` (sem depender de créditos Firecrawl).
- Redução de falhas de parse HTML frágil nas 3 fontes cobertas.

## 5. Casos de Uso & Fluxos do Usuário
1. **Fluxo Principal (Happy Path):**
   - Admin (ou cron) dispara scrape → Firecrawl extrai ofertas de ML/Amazon/Shopee → pipeline normaliza/dedupe → grava `offers` com `status=new` → admin lista no dashboard → aprova → emite link afiliado → enfileira disparo → bot envia aos grupos.
2. **Fluxo de Exceção:**
   - Key ausente / créditos esgotados / HTTP 4xx–5xx Firecrawl → run marca erro em `scrape_runs`; demais fontes do lote podem seguir; UI/logs expõem mensagem clara.
   - Extract vazio → `found=0`, run ok sem upserts (não inventar ofertas).
   - `SCRAPE_MOCK=1` → fixtures estáveis, zero chamada externa.
