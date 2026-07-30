# Spec Técnica: Fatia 06 - Dashboard Executivo e Stats Operacionais

> **Feature:** `plataforma-promocoes` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-06.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Overview executivo com KPIs do dia: disparos vs meta (`daily_cap`, default 35), erros de envio, ofertas scrapadas (hoje), jobs pendentes na fila, status sessão Baileys; telas de histórico/erros polidas; refresh sob demanda ou polling curto (ex. 30s no overview); UX alinhada ao shell `chatbotrdo` (cards, densidade, sidebar).
- **Limites da fatia:** Sem BI multi-dia avançado, export CSV, ou tracking de cliques afiliado (nice-to-have). Agregações SQL simples / views leves free-tier.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `src/app/api/stats/overview/route.ts`
  - `[NEW]` `src/app/api/stats/errors/route.ts` (opcional se filtrar dispatch failed)
  - `[NEW]` `src/lib/stats/overview.ts` — queries agregadas
  - `[MODIFY]` `src/app/(dashboard)/dashboard/page.tsx` — cards KPI + alertas
  - `[MODIFY]` `src/app/(dashboard)/dashboard/disparos/page.tsx` — filtros histórico
  - `[NEW]` `src/components/KpiCard.tsx`, `SessionBadge.tsx`, `MetaProgress.tsx`
  - `[MODIFY]` empty/error states consistentes nas páginas existentes
- **Símbolos e funções afetadas:**
  - `getOverviewStats(day: Date)`
  - `OverviewStats` type
  - `KpiCard`, `MetaProgress`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- Sem tabelas novas obrigatórias; views opcionais:
  -- create view public.v_dispatch_daily as
  --   select date_trunc('day', sent_at) d, count(*) filter (where status='sent'), ...
  -- Preferir queries parametrizadas em getOverviewStats para free tier.
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - `GET /api/stats/overview` →
    ```ts
    type OverviewStats = {
      date: string // YYYY-MM-DD (TZ app, default America/Sao_Paulo)
      dispatchesSent: number
      dispatchesFailed: number
      dispatchesQueued: number
      dailyCap: number
      hourlyCap: number
      offersScrapedToday: number
      sessionStatus: 'disconnected'|'qr'|'connecting'|'connected'
      lastScrapeError?: string | null
    }
    ```
  - Auth admin only; queries index-friendly (`sent_at`, `scraped_at`, `status`).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:**
  - Overview: grid de cards (Enviados/meta, Falhas, Fila, Ofertas hoje, Sessão).
  - Barra/progress meta 35 (ou `daily_cap`).
  - Alerta vermelho se sessão down ou falhas recentes.
  - Botão “Atualizar”; polling opcional só no overview montado.
  - Histórico disparos: filtro status/data; erros com `error` truncado + expand.
- **Estados Visuais:** skeleton loading; zero-state “0 disparos hoje”; erro API stats.
- **Acessibilidade:** KPIs com texto (“12 de 35”); não só cor.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/overview-stats.test.ts` — agrega sent/failed/queued corretamente com fixtures.
- [ ] **Integração Backend + UI:** com jobs seed, overview mostra números coerentes; meta progress = sent/cap.
- [ ] **Validação Estrita:** tsc, lint, test; smoke build.
- [ ] **Aceite:** admin vê de relance se meta do dia e saúde do bot; latência aceitável free tier.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** overview API/KPIs, meta progress, filtros histórico disparos, testes agregação
- **Pendente:** —
- **Próximo comando:** `/sdd-finish`

## 7. As-Built
- `GET /api/stats/overview` + `getOverviewStats` (dia America/Sao_Paulo).
- UI `OverviewDashboard` (MetaProgress, KpiCard, SessionBadge, poll 30s).
- Histórico disparos: filtros status/`from`; erro expandível.
- Validação feature: tsc/lint/test/worker tsc/build verdes; E2E Playwright não no repo.
