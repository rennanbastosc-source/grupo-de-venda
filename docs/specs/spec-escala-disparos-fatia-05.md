# Spec Técnica: [Fatia 05 - Funil de caption dimensionado pelo cap]

> **Feature:** `escala-disparos` | **Status:** `CONCLUÍDO` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-05.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** O pipeline apronta ofertas no ritmo que o dispatch consome: os batches de caption/afiliado/enqueue deixam de ser constantes fixas (`CAPTION_BATCH=3` gerava no máx. 9 captions/dia — gargalo diagnosticado na auditoria) e passam a derivar de `daily_offer_cap`. A agenda do cron de pipeline sobe de 3×/dia para horária dentro da janela operacional (mudança só no runbook da Fatia 04 — agendador já é externo).
- **Limites da fatia:** edições concentradas em `src/lib/pipeline/run.ts` + 1 atualização de runbook + testes. Sem migration, sem UI nova.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `src/lib/pipeline/run.ts` — `runOfferPipeline` lê `daily_offer_cap` de `app_settings` uma vez no início e o injeta nas fases; `CAPTION_BATCH` fixo morre
  - `[MODIFY]` `docs/runbooks/crons-externos.md` — agenda do job pipeline: `10 7-22 * * *` (horária, dentro da janela 07–23 de Fortaleza)
  - `[MODIFY]` `tests/pipeline-caption.test.ts` · `[MODIFY]` `tests/pipeline-run.test.ts`
- **Símbolos e funções afetadas:**
  - `BATCH` / `CAPTION_BATCH` (`run.ts:29-30`) · `generateCaptions` (`:156`, `limit(CAPTION_BATCH)` em `:168`) · `ensureAffiliates` (`:379`) · `autoEnqueue` (`:444`)
  - `loadSettings`-like: reuso do padrão de leitura de `app_settings` já presente em `ensureAffiliates` (`:339-343`) — uma leitura única em `runOfferPipeline`, passada por parâmetro (sem novo módulo)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum (usa `daily_offer_cap` criado na Fatia 02).
- **Endpoints / Server Actions / Funções de Serviço:**
  - `runOfferPipeline(supabase)` — assinatura e `PipelineResult` inalterados. Internamente:
    - `captionBatch = clamp(daily_offer_cap, 1, 25)` por run — com agenda horária (≈16 runs/dia), capacidade diária ≈ `16 × captionBatch`, sempre ≥ demanda do dispatch com folga para `failed`.
    - `ensureAffiliates` e `autoEnqueue` usam o mesmo valor (funil alinhado de ponta a ponta; `exportToSheets`/espelho não é gargalo e mantém batch próprio).
    - Guarda de custo: teto duro de 25/run protege o 9router (timeout 30s/caption, sequencial — pior caso ~12min < `maxDuration` não se aplica pois roda via `after()`; ainda assim registrar tempo no resultado se exceder).
  - Head-of-line de caption `failed`: já mitigado para afiliados (`run.ts:359-371`); replicar o mesmo padrão para captions — `failed` há <1h não re-entra no batch (hoje `failed` nem re-entra; comportamento preservado, só documentado).
- **Guardas CI:** `SCRAPE_MOCK=1`/`ci.supabase.co` seguem curto-circuitando 9router e Sheets (nenhuma chamada externa nova).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum novo. As contagens agregadas de `caption_status` no `DispatchManager` já refletem o novo ritmo.
- **Estados Visuais:** N/A.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/pipeline-caption.test.ts`:** com `daily_offer_cap=10`, `generateCaptions` consulta com `limit(10)`; com cap ausente (linha `app_settings` vazia) usa default 10; teto duro 25 respeitado com cap=100.
- [ ] **`tests/pipeline-run.test.ts`:** leitura única de settings por run (spy — sem N+1); fases recebem o mesmo batch; `PipelineResult` inalterado.
- [ ] **Integração Backend + UI:** alterar `daily_offer_cap` na tela de disparos muda o throughput do próximo run (verificável pelos contadores do resultado).
- [ ] **Validação Estrita:** `tsc`, `lint`, `vitest run` verdes.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** `loadPipelineSettings` (leitura única/run) · batches de caption/afiliado/enqueue = clamp(daily_offer_cap, 1, 25) · `CAPTION_BATCH` fixo morto · agenda horária `10 7-22 * * *` já registrada no runbook (Fatia 04) · 4 testes novos (192 verdes)
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
