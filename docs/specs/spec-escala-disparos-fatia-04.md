# Spec Técnica: [Fatia 04 - Migração dos crons para cron-job.org]

> **Feature:** `escala-disparos` | **Status:** `PENDENTE` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-04.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Independência do plano Vercel Pro: agendamento migrado para cron-job.org (free), `vercel.json` sem crons, runbook completo para operar/recriar os jobs externos, e verificação documentada do Fluid Compute (pré-requisito do `maxDuration=300` no Hobby). Sem código de aplicação novo — o padrão `202` já nasceu na Fatia 03.
- **Limites da fatia:** `vercel.json` (remoção do array `crons`) + 1 runbook novo em `docs/`. Churn mínimo por natureza; o risco é operacional, não de código.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[MODIFY]` `vercel.json` — remove a chave `crons` inteira (mantém `git.deploymentEnabled=false`)
  - `[NEW]` `docs/runbooks/crons-externos.md` — fonte da verdade da agenda externa
- **Símbolos e funções afetadas:**
  - Nenhum símbolo de código. `assertCronSecret` (`src/lib/cron-auth.ts`) já aceita `x-cron-secret` e `Bearer` — compatível com headers customizados do cron-job.org sem mudança.

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:** nenhum.
- **Runbook (`docs/runbooks/crons-externos.md`) DEVE conter:**
  | Job | URL | Agenda | Header |
  |---|---|---|---|
  | scrape | `GET https://<app>/api/cron/scrape` | `0 11,16,21 * * *` | `x-cron-secret: <CRON_SECRET>` |
  | pipeline | `GET https://<app>/api/cron/pipeline` | `15 11,16,21 * * *` (revisada na Fatia 05) | idem |
  | dispatch | `GET https://<app>/api/cron/dispatch` | `*/5 * * * *` | idem |
  | keepalive | `GET https://<app>/api/cron/keepalive` | `*/5 * * * *` | idem |
  - Passo a passo de criação no cron-job.org (job → URL → header → agenda → timezone **America/Fortaleza** no painel), aviso de que o free aborta a resposta em ~30s (inofensivo com o padrão 202) e de que **falha de auth aparece como 401 no histórico** do painel.
  - **Checklist de transição:** (1) criar jobs externos; (2) conviver com os crons Vercel por ≥ 2 dias (idempotência: claim atômico + upserts + `wa_sent_jobs` cobrem o disparo duplo); (3) verificar no dashboard Vercel que **Fluid Compute está ativo** — registrar no runbook o resultado; (4) commit removendo `crons` do `vercel.json`; (5) pós-downgrade, conferir histórico de execuções por 24h.
  - **Plano B registrado:** se Fluid indisponível → pacing do burst migra para o worker (Render). Fica documentado como contingência, sem implementação.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** nenhum. Observabilidade da agenda passa a ser o painel do cron-job.org (histórico + alerta de falha por e-mail, ganho sobre o Vercel Hobby).

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste de configuração:** `npm run build` verde com `vercel.json` sem `crons` (smoke do CI já cobre); nenhum teste referencia a agenda da Vercel.
- [ ] **Validação operacional (manual, registrada no runbook):** 4 jobs criados no cron-job.org com header correto; execução real de cada um com `202` no histórico; convivência de 2 dias sem duplicação visível em `dispatch_jobs`/`offers`.
- [ ] **Verificação Fluid Compute:** status registrado no runbook antes do commit que esvazia `crons`.
- [ ] **Validação Estrita:** `tsc`, `lint`, `vitest run` verdes (inalterados por esta fatia).

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** runbook · jobs externos criados · verificação Fluid · commit `vercel.json`
- **Próximo comando:** `/sdd-implement`
