# Spec Técnica: Fatia 03 - Smoke operacional, env prod e documentação de estado

> **Feature:** `firecrawl-scrape` | **Status:** `PENDENTE` | **Data:** 2026-07-30

<!-- Arquivo: docs/specs/spec-firecrawl-scrape-fatia-03.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Validar path real Firecrawl (1 fonte, 1 run controlado) **ou** ajustar client se API v1 `extract` vs v2 `json` divergir; garantir que admin/cron alimentam `offers` `new` visíveis no dashboard; checklist env Vercel `FIRECRAWL_API_KEY`; feedback de erro mínimo se key ausente; preparar texto de invariantes para append em `STATE.md` no `/sdd-finish`.
- **Limites da fatia:** Sem multi-página; sem Magalu; sem UI redesign; sem gastar créditos em loop.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/scrapers/firecrawl.ts` (apenas se API exigir ajuste)
  - `[MODIFY]` `.env.example`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** inalterados.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** diff mínimo se necessário em OffersManager.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Validação Estrita:** `npm run typecheck` + `npm run test` verdes.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** smoke/ajuste API, feedback erro se preciso, checklist Vercel, suite verde
- **Próximo comando:** `/sdd-implement`
