# Runbook — Crons externos (cron-job.org)

> Fonte da verdade da agenda de crons após a saída do Vercel Pro.
> O `vercel.json` **não** tem mais o array `crons` — todo agendamento vive no
> painel do cron-job.org (conta free). Feature: `escala-disparos`, Fatia 04.

## Por que cron-job.org

- Vercel Hobby limita cron a **2 jobs com precisão diária** — o `*/5` do
  dispatch e do keepalive são impossíveis no plano free.
- Os endpoints já aceitam acionamento externo via `CRON_SECRET`
  (`x-cron-secret` ou `Authorization: Bearer`) — `src/lib/cron-auth.ts`.
- Bônus de observabilidade: histórico de execução + alerta de falha por
  e-mail, que o Vercel Hobby não oferece.

## Jobs a configurar

Base URL: `https://<dominio-do-app-na-vercel>`. Timezone do painel:
**America/Fortaleza** (todas as agendas abaixo são interpretadas nela).

| Job | Método/URL | Agenda (cron) | Observação |
|---|---|---|---|
| scrape | `GET /api/cron/scrape` | `0 11,16,21 * * *` | Responde `202` imediato; trabalho em background |
| pipeline | `GET /api/cron/pipeline` | `10 7-22 * * *` | Horária dentro da janela operacional (dimensiona o funil de caption — Fatia 05) |
| dispatch | `GET /api/cron/dispatch` | `*/5 * * * *` | Responde `202`; burst roda até 300s em background |
| keepalive | `GET /api/cron/keepalive` | `*/5 * * * *` | Síncrono (<30s); mantém o 9router acordado |

**Header obrigatório em todos os jobs:**

```
x-cron-secret: <valor de CRON_SECRET no ambiente da Vercel>
```

## Passo a passo (por job)

1. cron-job.org → *Create cronjob*.
2. URL completa do endpoint (com `https://`).
3. *Advanced* → *Headers* → adicionar `x-cron-secret` com o valor do secret.
4. *Schedule* → modo cron expression, expressão da tabela acima; timezone
   **America/Fortaleza**.
5. Salvar e usar *Run now* para o teste: o histórico deve registrar **202**
   (scrape/pipeline/dispatch) ou **200** (keepalive).
   - `401` no histórico = header errado/ausente.
   - O free aborta a resposta em ~30s — **inofensivo** para as rotas `202`
     (o trabalho continua na Vercel via `after()` até o `maxDuration`).

## Checklist de transição (executar ANTES do downgrade da conta)

- [ ] 4 jobs criados e testados (histórico com 202/200).
- [ ] **Fluid Compute ativo** no projeto Vercel (Settings → Functions).
      Sem Fluid, o Hobby não atinge `maxDuration=300` e o burst do dispatch
      não cabe no serverless — plano B registrado abaixo.
      Resultado da verificação: `[ ] verificado em ____-__-__ por ____`
- [ ] Convivência de ≥ 2 dias com os crons da Vercel ainda ativos.
      Disparo duplo é inofensivo: claim atômico da fila, upserts idempotentes
      do scrape/pipeline e dedupe durável (`wa_sent_jobs`) cobrem.
      Conferir em `dispatch_jobs`/`offers` que não há duplicação.
- [ ] Commit removendo o array `crons` do `vercel.json` (esta fatia) em
      produção.
- [ ] Downgrade da conta.
- [ ] 24h de histórico limpo no cron-job.org pós-downgrade.

## Plano B (só se Fluid Compute indisponível)

Mover o pacing do burst (jitter 2–5s entre grupos) do app para o worker no
Render (long-running, sem limite de duração): o app passaria a enviar o lote
de jobs num único POST e o worker iteraria com os delays. Não implementado —
contingência documentada.

## Rollback

Restaurar o array `crons` no `vercel.json` (histórico do git, commit desta
fatia) e fazer push — válido apenas enquanto a conta for Pro.
