# Spec Técnica: [Fatia 06 - Planilha espelho somente-leitura]

> **Feature:** `escala-disparos` | **Status:** `PENDENTE` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-06.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** A planilha deixa de ser superfície de escrita e vira espelho enxuto de mão única (decisão da entrevista: colunas link/caption + status enviado/pendente; ninguém edita a planilha hoje). Morrem: `importFromSheets` com as travas de não-rebaixamento, o rastreio por linha (`sheets_row`/`sheets_synced_at`) e o gatilho de caption acoplado ao export. O espelho passa a ser **reescrita completa** da aba a cada run — idempotente, sem estado de linha.
- **Limites da fatia:** 1 migration (drop de 2 colunas); reescrita da integração em `run.ts` + `sheets/client.ts`; remoção de 1 teste obsoleto + 2 atualizados.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/014_sheets_mirror.sql`
  - `[MODIFY]` `src/lib/pipeline/run.ts` — remove `importFromSheets` (`:237-332`), `exportToSheets` (`:82-153`) e o write-back de caption (`:199-217`); nova fase única `mirrorToSheets` ao **final** do pipeline; orquestração (`:492-496`) vira `captions → affiliates → enqueue → mirror`
  - `[MODIFY]` `src/lib/sheets/client.ts` — novo `overwriteRows(rows)` (PUT a partir de A1 + clear do excedente via `values:clear`); `DEFAULT_RANGE` → `Ofertas!A:D`; `appendRows`/`readRows` removidos se ficarem órfãos
  - `[MODIFY]` `src/lib/pipeline/types.ts` — `PipelineResult`: `exported`/`imported` → `mirrored` (contrato interno; único consumidor é a resposta do cron/rota manual)
  - `[DELETE]` `tests/import-guard.test.ts` (as travas que ele protege deixam de existir)
  - `[NEW]` `tests/sheets-mirror.test.ts` · `[MODIFY]` `tests/pipeline-run.test.ts`
- **Símbolos e funções afetadas:**
  - `HEADER` (12 colunas → 4) · `offerToSheetRow` · `affiliateUrlFor` (reusado pelo mirror)
  - Gatilho `caption_status none→pending` do export (`run.ts:138-141`): **removível sem substituto** — `generateCaptions` já seleciona `in ("pending","none")` (`:165`), então caption é gerada independentemente de planilha (fato verificado na análise; o PRD pedia "gatilho interno" e ele já existe)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 014_sheets_mirror.sql
  alter table public.offers
    drop column if exists sheets_row,
    drop column if exists sheets_synced_at;
  drop index if exists public.offers_sheets_synced_idx;
  ```
  > **Atenção à ordem de deploy (AGENTS §5):** coluna só pode ser dropada em produção com o código novo já sem leituras — migration aplicada junto do merge desta fatia, nunca antes de push de código que ainda leia `sheets_row`.
- **Endpoints / Server Actions / Funções de Serviço:**
  - `mirrorToSheets(supabase, result)`: seleciona ofertas com `caption_status='ready'` ou `status='sent'` (as que interessam à revisão), ordena `scraped_at` desc, limita 500; monta linhas `[id, affiliate_url, caption, status_espelho]` onde `status_espelho = status==='sent' ? 'enviado' : 'pendente'`; `overwriteRows([HEADER, ...linhas])`. Sem write-back no DB — mão única de verdade.
  - `isSheetsConfigured()` e curto-circuito `SCRAPE_MOCK=1` preservados (`client.ts:27-30`); planilha ausente/quebrada → erro em `result.errors`, nunca falha o pipeline inteiro (comportamento atual preservado).
  - Bloqueio de edição humana: proteção de intervalo no próprio Google Sheets (operacional, registrado no runbook — não é código).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum — a curadoria já vive em `/dashboard/ofertas` (aprovar/rejeitar) e não muda nesta fatia.
- **Estados Visuais:** N/A.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/sheets-mirror.test.ts`:** linhas montadas com as 4 colunas e status `enviado`/`pendente` corretos; `overwriteRows` chamado 1× com header + N linhas; Sheets não configurado → no-op sem erro; erro da API → `result.errors` sem abortar fases anteriores.
- [ ] **`tests/pipeline-run.test.ts`:** nova ordem de fases; nenhum acesso a `sheets_row`; `PipelineResult.mirrored` contado.
- [ ] **Integração Backend + UI:** run manual do pipeline pela tela de disparos reflete o novo shape do resultado sem quebrar a exibição.
- [ ] **Validação Estrita:** `tsc`, `lint`, `vitest run` verdes; grep confirma zero referências restantes a `sheets_row`/`importFromSheets`.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** migration 014 · `mirrorToSheets` + `overwriteRows` · remoção import/export antigos · testes
- **Próximo comando:** `/sdd-implement`
