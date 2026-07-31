# Spec — Pipeline de Automação (estado atual, contexto vivo)

> **Data**: 2026-07-31
> **Objetivo**: registro vivo para retomar em nova sessão sem perder contexto.
> **Status geral**: código implementado e verificado; infra de produção parcialmente configurada; faltam 3 passos manuais.

---

## 1. O que foi pedido (contrato fechado com o usuário)

Pipeline automático ponta a ponta:

```
cron scrape (08h/13h/18h BRT) → offers (DB)
  → Google Sheets (espelho + revisão humana)
  → 9router (modelo GeMiNi) gera caption
  → import edições humanas da planilha → DB
  → affiliate link (provider default)
  → auto-enqueue (configurável)
  → cron dispatch → worker Baileys → WhatsApp
```

Decisões confirmadas pelo usuário:

| Contrato | Escolha |
|----------|---------|
| IA | 9router, OpenAI-compat, modelo `GeMiNi` |
| Sheets | Service account Google (cliente JWT próprio, sem lib) |
| Horários scrape | 08h/13h/18h BRT = 11h/16h/21h UTC |
| Regra auto-dispatch | Configurável em `app_settings` (`auto_dispatch_enabled` + `auto_dispatch_group_ids`) |

---

## 2. Arquivos novos/criados (sem commit)

### Código
| Arquivo | Papel |
|---------|-------|
| `supabase/migrations/008_pipeline_automation.sql` | Colunas `offers` (caption, caption_status, sheets_row, sheets_synced_at, original_price_cents) + `app_settings` (auto_dispatch*, default_affiliate_provider_id) + índices |
| `src/lib/ai/caption.ts` | `generateCaption()` — POST OpenAI-compat no 9router; `SCRAPE_MOCK=1` → template fixo; timeout 30s |
| `src/lib/sheets/client.ts` | JWT RS256 + fetch (sem googleapis): `isSheetsConfigured`, `getAccessToken`, `appendRows` (retorna startRow), `updateRows`, `readRows` |
| `src/lib/pipeline/types.ts` | `CaptionStatus`, `PipelineResult` |
| `src/lib/pipeline/run.ts` | `runOfferPipeline()` — export→caption→import→affiliate→auto-enqueue |
| `src/app/api/cron/pipeline/route.ts` | Cron do pipeline (`maxDuration=120`) |
| `src/app/api/cron/keepalive/route.ts` | Ping no 9router (evita spin-down do Render free) |
| `tests/pipeline-caption.test.ts` | caption mock/HTTP + buildMessage caption + isSheetsConfigured |
| `tests/pipeline-run.test.ts` | runOfferPipeline com supabase mock (sem Sheets) |

### Alterados
| Arquivo | Mudança |
|---------|---------|
| `src/app/api/settings/route.ts` | GET/PATCH com auto_dispatch_enabled, auto_dispatch_group_ids, default_affiliate_provider_id |
| `src/components/DispatchManager.tsx` | Bloco "Auto-dispatch" no form de rate limit (checkbox + grupos + provider) |
| `src/lib/dispatch/template.ts` | `{{caption}}` no template (fallback title) |
| `src/lib/dispatch/guards.ts` | assertOfferReady retorna `caption` |
| `src/lib/dispatch/enqueue.ts` | passa caption + default template com `{{caption}}` |
| `src/lib/dispatch/process.ts` | **Claim atômico**: update `sending` com `WHERE status=queued` |
| `src/app/api/cron/scrape/route.ts` | `maxDuration=120` |
| `vercel.json` | Crons: scrape 11/16/21 UTC, pipeline 11:15/16:15/21:15 UTC, dispatch `*/5`, keepalive `*/5` |
| `.env.example` | Blocos NINE_ROUTER_* e GOOGLE_* |

### Git
- Tudo **sem commit** (main). Git status tem M + ?? conforme acima.
- `.opencode/` e `plans/` também untracked (pré-existentes da sessão).

---

## 3. Infra de produção — CONFIGURADO (feito)

### Google Cloud / Sheets ✅
- `gcloud` instalado em `~/google-cloud-sdk` (autenticado: rennan.bastosc@gmail.com)
- Projeto GCP: **`grupo-de-venda-pipeline`** (criado)
- Google Sheets API habilitada
- Service account: **`gdv-sheets@grupo-de-venda-pipeline.iam.gserviceaccount.com`**
- Chave JSON: **`~/secrets/gdv-sheets.json`** (não versionar; `.gitignore` cobre `*.pem` mas NÃO cobre `~/secrets` — fora do repo, ok)
- Planilha: id **`1AQOggK_Lsaq0IxJkgUEvH1HzUUhTPjL4n2D0svpI6ZU`**, aba `Ofertas` A:L, compartilhada com a SA como Editor
- **Validado**: escrita/leitura real OK (header `id|title|...` criado na planilha)

### Envs Vercel production ✅
```
GOOGLE_SERVICE_ACCOUNT_EMAIL      = gdv-sheets@grupo-de-venda-pipeline.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY= (do ~/secrets/gdv-sheets.json, \n escapados)
GOOGLE_SHEETS_SPREADSHEET_ID      = 1AQOggK_Lsaq0IxJkgUEvH1HzUUhTPjL4n2D0svpI6ZU
GOOGLE_SHEETS_RANGE               = Ofertas!A:L
NINE_ROUTER_BASE_URL              = https://grupo-de-venda-9router.onrender.com/v1
NINE_ROUTER_MODEL                 = GeMiNi
```
(Já existiam: CRON_SECRET, SUPABASE_*, WORKER_*, FIRECRAWL_API_KEY, NEXT_PUBLIC_*)

### 9router no Render ✅ (parcial)
- Serviço: **`grupo-de-venda-9router`** — id `srv-d9miuuvavr4c73egiejg`, plano free, região oregon
- URL: **`https://grupo-de-venda-9router.onrender.com`**
- Imagem Docker `decolua/9router:latest`, sem health check custom (o `/v1/models` retorna 401 e travava o deploy — removido)
- **Lição**: o 1º serviço (`srv-d9mihd942hec73dr9380`) ficou preso em `update_in_progress` por causa do health check `/v1/models` (404/401) — foi deletado e recriado sem health check
- Validado: deploy live, root 307 → dashboard, `/v1/models` 401 (exige API key — bom, exposto à internet)
- Keepalive: cron Vercel `/api/cron/keepalive` `*/5 * * * *` → pinga `/v1/models` (401 = acordado). **Necessário**: free dorme após 15min e **perde o sqlite** (providers) no wake. 24/7 ≈ 744h/mês < 750h do free → não estoura.
- **Pendente**: dashboard remoto ainda SEM senha configurada, SEM providers conectados, SEM API key própria (a `sk-3cea...` local é da máquina local e não funciona no remoto)

### Banco Supabase ✅
- Migration **006, 007, 008** aplicadas em produção (`npx supabase db push --linked`) — verificado `migration list`: 001–008 todos remotos
- Migration 006/007 estavam pendentes (código já as usava) — aplicadas junto

---

## 4. Pendências — o que falta para ligar em prod

### P1 — Dashboard 9router remoto (aguardando usuário)
1. Abrir `https://grupo-de-venda-9router.onrender.com/login` e criar senha
2. Conectar providers (pelo menos um que sirva `GeMiNi`)
3. Gerar **API key nova** (`sk-...`) e colar para configurar `NINE_ROUTER_API_KEY` na Vercel

### P2 — Auto-dispatch (aguarda dados do banco)
- Banco tem **0 grupos** (`wa_groups` vazio) → nada a enfileirar até cadastrar/ativar grupo em `/dashboard/grupos`
- Providers afiliados existentes: generic-tag, livelo, meliuz (ativos)
- Após grupo: em `/dashboard/disparos` → Auto-dispatch ON + grupos + provider default → salvar

### P3 — Deploy Vercel
- Push + deploy (`vercel deploy --prebuilt --prod` ou CI) para ativar crons e novo código
- Validar `/api/cron/pipeline` com `x-cron-secret`

### P4 — Segurança/config pós-ligado
- Decidir se `requireApiKey=true` no 9router remoto (recomendado — exposto)
- `NINE_ROUTER_API_KEY` na Vercel para autenticar
- Opcional: trocar senha do dashboard periódicamente

---

## 5. Como retomar em nova sessão (checklist)

```bash
# 1. Contexto
cat docs/specs/spec-pipeline-automacao-estado-atual.md   # este arquivo
git status && git diff --stat

# 2. Envs locais (dev)
vercel env pull .env.local   # já linkado: rennan-s-projects2/grupo-de-venda

# 3. Testes
npm run typecheck && npm run lint && npm run test

# 4. Migrations
npx supabase migration list --linked   # esperado: 001–008 remote

# 5. Deploy
git add -A && git commit -m "feat: pipeline automático scrape→sheets→ia→dispatch"
git push origin main   # push em master/main = deploy imediato (Vercel)
```

---

## 6. Comandos úteis

```bash
# Render
render services list
render logs -r srv-d9miuuvavr4c73egiejg --limit 100
render deploys list srv-d9miuuvavr4c73egiejg

# Vercel envs
vercel env ls production
vercel env add NOME production < valor.txt

# Supabase
npx supabase db push --linked --dry-run
npx supabase migration list --linked

# Google Cloud
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud config get-value project   # grupo-de-venda-pipeline
gcloud iam service-accounts list
```

---

## 7. Risco / decisões pendentes registradas

| Risco | Mitigação |
|-------|-----------|
| 9router free perde sqlite em redeploy/restart da Render | Keepalive 24/7 evita sleep; se Render reiniciar, reconectar providers (~5min) |
| API key local não serve no remoto | Gerar key nova no dashboard remoto |
| Sem grupos cadastrados → auto-dispatch ocioso | Cadastrar grupo em `/dashboard/grupos` |
| Cron Vercel requer redeploy p/ ativar `vercel.json` | Push/deploy pendente (P3) |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` com `\n` — se quebrar no env | Re-adicionar com `printf`/pipe direto (como foi feito) |
