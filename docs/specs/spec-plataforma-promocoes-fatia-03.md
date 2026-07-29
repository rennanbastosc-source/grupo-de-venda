# Spec Técnica: Fatia 03 - Pipeline de Scraping de Promoções

> **Feature:** `plataforma-promocoes` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-03.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Pipeline de scraping pluggable por fonte (Mercado Livre, Amazon, Shopee, Magalu — **mínimo 2 fontes implementadas**, stubs tipados para as demais); normalização de oferta; dedupe por URL canônica; estados `new | approved | rejected | sent`; listagem/filtros no dashboard; job agendado (Vercel Cron ou worker timer) com rate/backoff free-tier; fallback: cadastro manual de URL de oferta.
- **Limites da fatia:** Sem emissão afiliada e sem disparo WhatsApp. Não resolve anti-bot avançado (proxy residencial, captcha). Volume baixo proposital.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `src/lib/scrapers/types.ts` — `ScraperSource`, `RawOffer`, `Scraper`
  - `[NEW]` `src/lib/scrapers/mercadolivre.ts`, `amazon.ts` (ou `shopee.ts` / `magalu.ts` — 2 reais)
  - `[NEW]` `src/lib/scrapers/registry.ts`, `normalize.ts`, `dedupe.ts`
  - `[NEW]` `src/lib/scrapers/run-pipeline.ts`
  - `[NEW]` `src/app/api/cron/scrape/route.ts` (protegido `CRON_SECRET`)
  - `[NEW]` `src/app/api/offers/route.ts`, `src/app/api/offers/[id]/route.ts` (list/patch status; POST manual)
  - `[NEW]` `src/app/(dashboard)/dashboard/ofertas/page.tsx` + componentes tabela/filtros
  - `[NEW]` migration `offers`, `scrape_runs`
  - `[MODIFY]` nav já existente
- **Símbolos e funções afetadas:**
  - `runScrape(source?)`, `upsertOffer`, `canonicalizeUrl`
  - `Offer`, `ScrapeRun`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  create type public.offer_status as enum ('new','approved','rejected','sent');
  create type public.scrape_source as enum ('mercadolivre','amazon','shopee','magalu','manual');

  create table public.offers (
    id uuid primary key default gen_random_uuid(),
    source public.scrape_source not null,
    external_id text,                  -- id na fonte se houver
    title text not null,
    price_cents int,
    currency text default 'BRL',
    url text not null,
    url_canonical text not null,
    image_url text,
    status public.offer_status not null default 'new',
    raw jsonb,
    scraped_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source, url_canonical)
  );

  create table public.scrape_runs (
    id uuid primary key default gen_random_uuid(),
    source public.scrape_source not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    ok boolean,
    items_found int default 0,
    items_upserted int default 0,
    error text
  );
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - `GET /api/cron/scrape?source=` + header cron secret → `runScrape`
  - `GET /api/offers?status=&source=` (auth admin)
  - `PATCH /api/offers/:id` `{ status }` (approved/rejected)
  - `POST /api/offers` body manual `{ title, url, price_cents?, source: 'manual' }`
  - Scraper interface:
    ```ts
    type Scraper = { source: ScrapeSource; fetchOffers(): Promise<RawOffer[]> }
    type RawOffer = { title: string; url: string; priceCents?: number; imageUrl?: string; externalId?: string }
    ```

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** tabela ofertas (título, fonte, preço, status, data); filtros status/fonte; ações aprovar/rejeitar; botão “adicionar manual”; botão “rodar scrap agora” (opcional, admin).
- **Estados Visuais:** loading; empty; erro de scrap na última run (banner).
- **Acessibilidade:** filtros com labels; ações com `aria`/texto.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/canonicalize-url.test.ts`; `tests/dedupe-offers.test.ts`; mock scraper → upsert sem duplicar.
- [ ] **Integração Backend + UI:** oferta `new` lista; approve → `approved`; manual POST aparece.
- [ ] **Validação Estrita:** tsc, lint, test.
- [ ] **Aceite:** cron protegido rejeita sem secret; 2 fontes no registry; dedupe por `url_canonical`.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** scrapers ML+Amazon (+stubs), normalize/dedupe/pipeline, migration offers, cron+API+UI, testes canonicalize/dedupe/cron (29 total)
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
