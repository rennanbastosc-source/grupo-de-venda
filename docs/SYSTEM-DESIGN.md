# System Design — Grupo de Venda

> Documentação de arquitetura as-built para orientar refatorações.
> Fonte: leitura direta do código. Base `2026-08-01`; **revisado em `2026-08-03`**
> após a feature `escala-disparos` (PR #15) e as correções de produção do dia.
> Complementa (não substitui) `STATE.md` e `docs/specs/`.
>
> **O que mudou nesta revisão:** a auditoria original (§12) listava 13 pontos de
> atenção. Nove foram resolvidos e estão marcados ✅ ao longo do texto; os que
> permanecem seguem marcados ⚠️. O §14 registra os cinco bugs que só apareceram
> com o sistema em operação real e como foram corrigidos.

---

## 1. Visão geral

Dois deploys independentes, um banco compartilhado:

```
┌──────────────────────────────┐         ┌─────────────────────────────┐
│  App Next.js 16 (Vercel)     │         │  Worker Baileys (Render)    │
│  src/                        │         │  worker/  — package próprio │
│                              │         │                             │
│  • Dashboard (6 telas)       │  HTTP   │  • node:http :3100          │
│  • API routes (/api/*)       │ ──────▶ │  • socket WhatsApp Web      │
│  • Rotas /api/cron/*         │ x-worker│  • estado de sessão EM      │
│  • Pipeline scrape→enqueue   │ -secret │    MEMÓRIA (não no banco)   │
└──────────────┬───────────────┘         └──────────────┬──────────────┘
               │                                        │
               │        ┌────────────────────┐          │
               └───────▶│  Supabase Postgres │◀─────────┘
                        │  (canônico)        │  PostgREST direto,
                        └────────────────────┘  service role
                                 │
                        ┌────────▼─────────┐
                        │  Google Sheets   │ espelho READ-ONLY (mão única)
                        └──────────────────┘
                                 ▲
                    ┌────────────┴────────────┐
                    │  cron-job.org (externo) │ agenda os 4 jobs
                    └─────────────────────────┘
```

Regras estruturais que caem fora do óbvio:

- **O banco é canônico. A planilha é espelho de mão única.** ✅ *(mudou)* O pipeline
  reescreve a planilha inteira a cada run; **nada volta dela**. O ciclo de
  export/edição-humana/import foi removido na feature `escala-disparos` (§4.4).
- **O status do WhatsApp não está no banco.** Vive na memória do worker
  (`worker/src/baileys/session.ts:24-32`) — decisão mantida deliberadamente: status
  é volátil e o worker é a única fonte que sabe se o socket está de pé. ✅ *(mudou)*
  A tabela morta `wa_session` foi **dropada** (migration `015`) e substituída por
  `wa_connection_events`, um log append-only de transições para auditoria (§6.4).
- **O que está cifrado no banco são as chaves da sessão** (`wa_session_keys`), não o status.
- **O agendamento é externo.** ✅ *(mudou)* `vercel.json` não tem mais `crons`; os
  quatro jobs vivem no cron-job.org (§11), o que libera o projeto do plano Pro.
- `tsconfig` da app exclui `worker/` e `tests/` — typecheck separado (`npm run worker:typecheck`).

---

## 2. Mapa de módulos

| Diretório | Responsabilidade |
|---|---|
| `src/lib/scrapers/**` | Coleta (Firecrawl), filtros, normalização, upsert em `offers` |
| `src/lib/pipeline/**` | Orquestração pós-scrape: Sheets, caption IA, afiliados, enqueue |
| `src/lib/ai/caption.ts` | Geração de legenda via 9router (OpenAI-compat) |
| `src/lib/affiliates/**` | Emissão de link afiliado por provider |
| `src/lib/dispatch/**` | Fila, guards, rate limit, consumo da fila |
| `src/lib/worker-client.ts` | Único ponto de contato app→worker |
| `src/lib/wa/**` | Tipos/normalização de sessão, jid, telefone (lado app) |
| `worker/src/baileys/**` | Socket WhatsApp, auth cifrada, estado runtime |
| `worker/src/db.ts` | PostgREST do worker (`rest()`): auth cifrada, dedupe durável, eventos de conexão |
| `src/app/api/**` | Rotas REST (todas com `requireUser`, exceto `/api/cron/*`) |
| `src/app/(dashboard)/**` | Telas (todas cascas server → componente client) |

---

## 3. Fluxo A — Ingestão (scrape → oferta)

### 3.1 Entrypoints

| Gatilho | Rota | Arquivo |
|---|---|---|
| cron-job.org `0 11,16,21 * * *` | `GET /api/cron/scrape` | `src/app/api/cron/scrape/route.ts` — responde `202`, trabalho em `after()` |
| Admin (botão) | `POST /api/scrape/run` | `src/app/api/scrape/run/route.ts:9` |
| Manual (form) | `POST /api/offers` | `src/app/api/offers/route.ts:70` — `source:"manual"` (:109) |

Core: `runScrape(store, source?)` em `src/lib/scrapers/run-pipeline.ts:47`.
Sem `source`, itera `listActiveScrapeSources()` = `["mercadolivre","amazon","shopee"]` (`registry.ts:18`).

> **Pegadinha:** `/api/cron/scrape` aceita `?source=magalu` (`cron/scrape/route.ts:10`) mas `getScraper` lançaria "Scraper desconhecido" — `magalu` só existe no enum do banco.

### 3.2 Scrapers

Contrato comum: `RawOffer { title, url, priceCents?, originalPriceCents?, imageUrl?, externalId? }` (`src/lib/scrapers/types.ts:10`); interface `Scraper { source, fetchOffers() }` (`types.ts:24`).

| Fonte | Arquivo | URL default | Regex de detecção | Nota |
|---|---|---|---|---|
| Mercado Livre | `mercadolivre.ts:12` | `/ofertas` | `/\/p\/MLB\|\/up\/MLB\|MLB\d+/i` (:10) | `withSessionRetry` + cookie de sessão |
| Amazon | `amazon.ts:14` | `/gp/bestsellers` | `/\/dp\/[A-Z0-9]{10}\|\/gp\/product\//i` (:11) | goldbox é SPA, não renderiza `/dp/` (:7) |
| Shopee | `shopee.ts:10` | `flash_sale` | `/i\.\d+\.\d+\|\/product\/\d+\/\d+/i` (:8) | **exige** `FIRECRAWL_SHOPEE_PROFILE` (:26); detecta "Login Necessário" mesmo em HTTP 200 (:49) |

Extração: `scrapeOffersFromUrl` (`firecrawl.ts:24`) → POST `api.firecrawl.dev/v2/scrape`, formats `["links","html"]`, timeout 45s (:33) → `harvestOffers` (`html-extract.ts:131`) faz merge dos links crus com parse de `<a href>` e busca preço na janela vizinha (`neighborWindow`, :20).

`SCRAPE_MOCK=1` curto-circuita: mock fixo por scraper, `ensureSession` mock (`session/ensure.ts:10`), `isSheetsConfigured()` → false (`sheets/client.ts:28`), e **pula** `filterAliveOffers` (`run-pipeline.ts:68`).

### 3.3 Filtros e persistência

Ordem em `run-pipeline.ts:66-79`:

1. `isProductOffer` (`product-filter.ts:14`) — rejeita nav/suporte e banners "X% off" sem `/dp/`.
2. `filterAliveOffers` (`url-alive.ts:60`) — HEAD/GET, concorrência 4, timeout 6s.
3. Zero ofertas de fonte ativa → **erro de run** (:73). Isso distingue "não colheu" de "colheu e filtrou tudo".
4. `dedupeOffers` (`dedupe.ts:4`) — primeira ocorrência por `source::urlCanonical`.
5. `normalizeRaw` (`run-pipeline.ts:24`) → `canonicalizeUrl` (`normalize.ts:37`: remove tracking, `www.`, hash; normaliza `/dp/ASIN`; força `https:`).
6. `store.upsertOffer` (`supabase-store.ts:30`).

Semântica do upsert (`supabase-store.ts:30-66`) — busca por `(source, url_canonical)`:

- **Existe** → UPDATE de `title, price_cents, original_price_cents, url, url_canonical, image_url, external_id, updated_at`. **Preserva `status`** (comentário :54) — reprocessar não desaprova o que já foi curado.
- **Não existe** → INSERT com `status:"new"` (:61). `caption_status` cai no default `'none'` (migration 008).
- Erro `23505` → retorna `"skipped"` (:64).

`scrape_runs` recebe `startRun` (:9) antes e `finishRun` (:18) depois, com `ok, items_found, items_upserted, error`.

### 3.4 Diagrama — ingestão

```
cron-job.org (11/16/21h) ──x-cron-secret──▶ GET /api/cron/scrape
Admin ─────────────────────────▶ POST /api/scrape/run
                       │
                       ▼
        runScrape  (run-pipeline.ts:47)
        por fonte (ML, Amazon, Shopee):
          1. startRun            → scrape_runs (ok=null)
          2. fetchOffers()
               ├ SCRAPE_MOCK=1 → mock fixo
               ├ withSessionRetry → ensureSession (marketplace_sessions)
               └ Firecrawl v2 → harvestOffers (href + título + preço)
          3. isProductOffer → filterAliveOffers (HEAD/GET)
          4. dedupeOffers (source::urlCanonical)
          5. normalizeRaw (canonicalizeUrl)
          6. upsertOffer → offers
               ├ existe → UPDATE (preserva status)
               └ novo   → INSERT status='new', caption_status='none'
          7. finishRun           → scrape_runs ok/items_*
                       │
                       ▼
        offers: status='new', caption_status='none'
```

---

## 4. Fluxo B — Pipeline (oferta crua → pronta para disparo)

`runOfferPipeline(supabase)` — `src/lib/pipeline/run.ts:318`.
Entrada: `SupabaseClient` (service role). Saída: `PipelineResult {captioned, affiliates, enqueued, mirrored, errors[]}` (`types.ts`).

✅ *(mudou)* São **4 fases**, não 5: o par export/import da planilha virou um único
espelho de saída, executado por último. O batch deixou de ser a constante `BATCH=10`
e passa a ser derivado do volume configurado: `loadPipelineSettings` (`run.ts:25`)
lê `app_settings` **uma vez por run** e calcula `clamp(daily_offer_cap, 1, 25)`.
Isso resolveu o gargalo em que o funil produzia menos captions do que o dispatch
consumia por dia.

### 4.1 Fase 1 — `generateCaptions` (`run.ts:58`)

Alvo: `caption_status IN ('pending','none','failed')` e `status IN ('new','approved')`,
batch dinâmico.

✅ *(mudou)* `failed` entrou na seleção — **repescagem**. Antes, uma oferta que
falhasse por erro transitório do provedor (401 de chave, 429 de cota) ficava presa
em `failed` para sempre, porque nada a reprocessava. Ver §14.1.

Provedor: `src/lib/ai/caption.ts` → 9router OpenAI-compat, `NINE_ROUTER_BASE_URL`,
modelo `NINE_ROUTER_MODEL`, temperature 0.7, timeout 30s. System prompt: copywriter
PT-BR, ~400 chars, sem links, proibido inventar preço.

Duas defesas adicionadas em produção (§14.2 e §14.3):

- **`stream: false` explícito** no corpo da requisição — o provedor streamava por
  default e os chunks concatenados quebravam `res.json()`.
- **Pausa de 1,5s entre chamadas** (`run.ts:81-85`), no topo da iteração para valer
  inclusive após um `continue`; pulada quando `SCRAPE_MOCK=1` para não arrastar o CI.
  É o intervalo mínimo que a documentação do Google recomenda para não estourar cota.

Sucesso → `caption_status:"ready"`. Erro → `"failed"` (e agora volta no run seguinte).

### 4.2 Fase 2 — `ensureAffiliates` (`run.ts:122`)

Para `caption_status='ready'` e `status IN ('new','approved')`:
roteia provider por fonte — `mercadolivre` → slug `mercadolivre`; demais → slug
`generic-tag`; fallback `app_settings.default_affiliate_provider_id`.
**Skipa** se já existe link `ok` do provider que seria usado. Senão `emitAffiliateLink`
(`src/lib/affiliates/emit.ts:36`).

Exclui do batch ofertas com link `failed` na última hora (`run.ts:142-151`) — evita
que uma oferta problemática monopolize o lote a cada run (head-of-line). ⚠️ Esse
filtro carregava um bug que derrubava a emissão inteira; ver §14.5.

Providers (`affiliates/types.ts:1`):

| kind | Implementação | Comportamento |
|---|---|---|
| `generic` / `livelo` / `meliuz` | `providers/generic.ts:4` | template `{{url}}` + query params |
| `mercadolivre` | `providers/mercadolivre.ts:23` | modo curto `meli.la` (POST `createLink` com CSRF, requer `ML_AFFILIATE_COOKIE` + `ML_AFFILIATE_TAG`); **degrada** para modo longo `matt_word/matt_tool` se faltar env (:37-114) |

Resultado gravado em `affiliate_links` com `status:"ok"` ou `"failed"` + `error` (`emit.ts:81-112`).

### 4.3 Fase 3 — `autoEnqueue` (`run.ts:208`)

Só roda se `auto_dispatch_enabled` **e** `auto_dispatch_group_ids` não vazio.
Para cada `caption_status='ready'`, chama `enqueueDispatch` (`src/lib/dispatch/enqueue.ts:15`).
Ao criar jobs, a oferta vai para `status:'approved'`.

### 4.4 Fase 4 — `mirrorToSheets` (`run.ts:259`)

✅ *(substituiu export+import)* Espelho **somente-leitura**, por reescrita completa:
seleciona ofertas com `caption_status='ready'` ou `status='sent'` (limite 500), resolve
os links em lote e sobrescreve `Ofertas!A:D` com `[id, link, caption, "enviado"|"pendente"]`,
limpando as linhas excedentes com `values:clear`.

Consequências desta troca:

- Não existe mais caminho de escrita planilha → banco. As duas travas do import antigo
  (não rebaixar `sent`, não sobrescrever caption `ready`) **deixaram de ser
  necessárias** — não há mais o que rebaixar.
- As colunas `offers.sheets_row` e `offers.sheets_synced_at` foram **dropadas**
  (migration `014`), junto com o índice que as acompanhava.
- `src/lib/sheets/client.ts` perdeu `appendRows`/`readRows`/`updateRows`; sobrou
  `overwriteRows`, e `getAccessToken` virou interno ao módulo.

### 4.5 Estado "pronta para disparo"

```
offers.status        = 'approved'
offers.caption_status= 'ready'
affiliate_links      = existe linha status='ok'
dispatch_jobs        = existe linha status='queued'
```

---

## 5. Fluxo C — Disparo (fila → mensagem no grupo)

### 5.1 Enfileiramento — `enqueueDispatch` (`enqueue.ts:15`)

Ordem dos guards:

1. `assertSessionConnected` (`guards.ts:8`) — consulta o worker; erro → 503, status ≠ `connected` → 409.
2. `assertOfferReady` (`guards.ts:47`) — oferta existe (404) e tem `affiliate_links.status='ok'` mais recente (:78-85).
3. Lê `app_settings.message_template` (:38-43), default `"{{caption}}\n\n🔗 {{affiliate_url}}"` (:47).
4. `buildMessage` (`template.ts:8`) resolve `{{title}} {{price}} {{affiliate_url}} {{caption}}`.
5. Por grupo: `assertGroupActive` (`guards.ts:31`) → `hasDispatchToday` (`guards.ts:112`) → INSERT `queued`.

✅ *(mudou)* `hasDispatchToday` faz **duas consultas com recortes diferentes**:

| Situação | Recorte | Bloqueia? |
|---|---|---|
| Job `queued`/`sending` | **qualquer data** | sim |
| Job `sent` | só o dia atual (`DISPATCH_TZ`) | sim |
| Job `sent` em dia anterior | — | não (reenvio entre dias é permitido) |

A versão anterior recortava tudo por `created_at >= início do dia`, então uma sobra
de ontem ainda em `queued` era invisível e o pipeline criava um job irmão hoje —
origem das mensagens duplicadas (§14.6).

### 5.2 Consumo — `processDispatchQueue` (`process.ts:126`)

✅ *(mudou)* O modelo deixou de ser "consome N jobs soltos" e passou a ser
**slot + burst**: cada execução escolhe **uma oferta** (a do job `queued` mais antigo)
e a transmite a **todos os grupos ativos**, com jitter entre eles.

Sequência por execução:

1. `GET worker /session`; se ≠ connected, retorna com `stoppedReason`.
2. `reapStuckJobs` (`process.ts:34`) — resgata jobs presos em `sending`.
3. `loadSettings` — defaults `192 / 12 / 240 / 10 / null / null`.
4. Contadores em `DISPATCH_TZ`: `daily`, `hourly`, `lastSentAt` e `dailyOffers`
   (ofertas distintas do dia, para o cap de ofertas).
5. `canSendNow`; se barrar, retorna com `stoppedReason`.
6. **Head do slot**: job `queued` mais antigo → define `offer_id`.
7. **Burst**: todos os jobs `queued` daquela oferta, **um por grupo**
   (`process.ts:196-200`), com jitter de 2–5s entre envios.

✅ *(mudou)* A deduplicação por grupo no burst é nova: sem ela, dois jobs irmãos da
mesma oferta para o mesmo grupo eram enviados em sequência, a segundos de distância
(§14.6).

### 5.3 Retry, reaper e dedupe durável

Três mecanismos que não existiam na versão original:

| Mecanismo | Onde | Regra |
|---|---|---|
| **Retry com backoff** | `process.ts:258-286` | falha de envio → `queued` com `attempts+1` e `scheduled_for = now + 2^attempts min`; a 3ª é terminal (`failed`) |
| **Reaper** | `process.ts:34-62` | job em `sending` com `claimed_at` > 10 min volta para `queued`, `attempts+1`; **no teto vira `failed`** ✅ *(§14.8)* |
| **Dedupe durável** | `worker/src/db.ts` + `server.ts` | tabela `wa_sent_jobs` (PK `job_id`); antes de enviar o worker consulta, e **na dúvida não envia** |

A ordem no `/send` do worker importa: `Set` em memória → consulta durável → envio →
registro `markJobSent` best-effort. Se a *consulta* falhar, responde 500 e o app faz
retry; se o *registro* falhar depois do envio, não vira 500 (a mensagem já saiu, e um
erro aqui faria o app marcar `failed` e reenviar).

### 5.4 Rate limiting — `canSendNow` (`rate-limit.ts:91`)

Ordem de avaliação (primeiro que falhar interrompe o slot com `stoppedReason`):

| # | Gate | Fonte | Detalhe |
|---|---|---|---|
| 1 | Janela de silêncio | `sleep_start`/`sleep_end` | `isWithinSleepWindow` (`rate-limit.ts:73`) em **`DISPATCH_TZ`**; suporta cruzar meia-noite; `null` ou `start===end` desativa |
| 2 | Teto de **ofertas**/dia | `daily_offer_cap` | ✅ *novo* — `counts.dailyOffers >= cap`, contando ofertas distintas |
| 3 | Teto diário de mensagens | `daily_cap` | `counts.daily >= cap` |
| 4 | Teto horário | `hourly_cap` | `counts.hourly >= cap` |
| 5 | Intervalo mínimo | `min_interval_sec` | desde `lastSentAt` |

✅ *(resolvido)* **Existe um único relógio.** `DISPATCH_TZ = "America/Fortaleza"`
(`rate-limit.ts:6`) e `dayStartInTz` (`:57`) são a fonte única de "início do dia" —
usados pelo rate limit, pelos guards e pelo índice único do banco. O descompasso
anterior (silêncio em São Paulo, tetos em UTC) deixou de existir.

> **Cuidado ao configurar:** `min_interval_sec` precisa ser **menor** que o período
> do cron, senão eles entram em batimento. Com cron a cada 5 min e intervalo de 300s,
> o slot seguinte chega ~5s antes de completar o intervalo e é recusado — o ritmo real
> vira 10 minutos. Por isso a produção roda com **240s**.

### 5.5 Máquina de estados de `dispatch_jobs`

```
        enqueue.ts                                      ┌──────────┐
   ────────────────────────────────────────────────────▶│  queued  │◀────┐
                                                        └────┬─────┘     │
   grupo inativo                                             │           │
   ◀───────────────────────────────────────────  ┌───────────┤           │
   ┌───────────┐                                 │           │           │
   │  skipped  │ (terminal)                      │  UPDATE ... SET       │
   └───────────┘                                 │  'sending'            │
        ▲                                        │  WHERE status='queued'│
        │ índice único recusou                   ▼  (claim atômico)      │
        │ o sent (§14.7)                    ┌──────────┐                 │
        └───────────────────────────────────│ sending  │                 │
                                            └────┬─────┘                 │
                   /send ok                      │      /send !ok        │
                       ┌─────────────────────────┴──────────┐            │
                       ▼                                    ▼            │
                 ┌──────────┐                     attempts < 3 ──────────┘
                 │   sent   │ + sent_at              (backoff 2^n min)
                 └────┬─────┘ (terminal)                    │
                      │                                     ▼ attempts >= 3
                      └─▶ offers.status = 'sent'      ┌──────────┐
                                                      │  failed  │ (terminal)
   reaper: sending há >10min ──▶ queued (attempts+1)  └──────────┘
                            └──▶ failed, se no teto
```

✅ *(resolvido)* **Retry e requeue existem.** Uma falha transitória (deploy do worker,
reconexão) não perde mais o job: ele volta para `queued` com backoff exponencial, e só
a terceira tentativa é terminal. As colunas `attempts` e `claimed_at` foram adicionadas
na migration `011`.

### 5.5 Fronteira app → worker

Cliente único: `src/lib/worker-client.ts`. Header `x-worker-secret` (:43), `cache:"no-store"`. Sem env → 503 "Worker não configurado" (:35-37).
Servidor: `worker/src/http/server.ts` (node:http, porta 3100 default em `index.ts:5`). `/health` sem auth (:41-43); todo o resto passa por `requireWorkerSecret` (`worker/src/auth.ts:3-20`) — sem env 500, mismatch 401.

| Endpoint | Método | Contrato |
|---|---|---|
| `/health` | GET | `{ok:true}` — sem auth |
| `/session` | GET | `{status, hasQr, hasPairingCode, phone, lastError}` (:47-49) |
| `/session/qr` | GET | `{qrDataUrl}` (:51-54) |
| `/session/pairing-code` | GET | `{code, phone, at}` (:56-63) |
| `/session/pair` | POST | `{phone}` → 202; pairing async (:65-82) |
| `/session/logout` | POST | `{ok:true}` (:84-87) |
| `/session/start` | POST | 202, `startBaileys` async (:89-96) |
| `/groups` | GET | `{groups:[{jid,name,participantCount}]}` via `groupFetchAllParticipating`; sem socket 503 (:98-116) |
| `/send` | POST | `{jid,text,jobId?}` → `{ok, deduped?}`; status ≠ connected → **409**; sem socket 503 |

✅ *(mudou)* Dedupe no worker agora tem **duas camadas**: o `Set` em memória
(`server.ts:35`, rápido, some no restart) **e** a tabela `wa_sent_jobs`, consultada via
`isJobSent` (`worker/src/db.ts:53`). É o registro durável que sobrevive a deploy — foi
verificado em produção: re-POST do mesmo `jobId` responde `{"deduped":true}` sem
reenviar nada ao grupo.

> ⚠️ **O dedupe é por `jobId`, não por conteúdo.** Dois jobs distintos com a mesma
> oferta e o mesmo grupo são, para o worker, duas mensagens legítimas. É por isso que
> a proteção contra duplicata precisa estar no app (§5.1 e §5.2), não aqui.

### 5.6 Diagrama — disparo

```
cron-job.org */5min ── GET /api/cron/dispatch (x-cron-secret) → 202 + after()
Admin ──────────────── POST /api/dispatch/run (requireUser)
        │
        ▼
processDispatchQueue (process.ts:126)
  1. GET worker /session ──────────▶ server.ts
     ◀─ {status:'connected'}   (senão para: stoppedReason)
  2. reapStuckJobs: sending há >10min → queued (attempts+1) | failed no teto
  3. loadSettings(app_settings id=1)
  4. counts em DISPATCH_TZ: daily / hourly / lastSentAt / dailyOffers
  5. canSendNow (silêncio → ofertas/dia → daily → hourly → interval)
       └ barrou? retorna com stoppedReason
  6. HEAD do slot: job queued mais antigo  →  define offer_id
  7. BURST: jobs queued dessa oferta, UM POR GRUPO
       para cada grupo:
         grupo inativo? ──▶ skipped
         UPDATE 'sending' + claimed_at WHERE status='queued'  ← claim atômico
         POST worker /send {jid,text,jobId} ─────▶ server.ts
              ├ Set memória       → {deduped:true}
              ├ wa_sent_jobs      → {deduped:true}   (durável)
              ├ consulta falhou   → 500 (na dúvida NÃO envia)
              └ socket.sendMessage ─▶ Baileys ─▶ grupo (…@g.us)
                    └ markJobSent(jobId) best-effort
         ◀─ 200 {ok:true}
              ├ UPDATE job 'sent' ── índice recusou? ──▶ skipped
              └ UPDATE offers 'sent'
         ◀─ !ok → attempts+1: queued com backoff 2^n min, ou failed no teto
         jitter 2–5s antes do próximo grupo
  → ProcessResult {processed, sent, failed, skipped, stoppedReason?}
```

---

## 6. Sessão WhatsApp (área de maior risco)

### 6.1 Persistência cifrada — `worker/src/baileys/auth-state.ts`

Dois modos em `createAuthState(deps, encryptionKey)` (:75):

- **Sem `WHATSAPP_SESSION_KEY`** → `useMultiFileAuthState` em `BAILEYS_AUTH_DIR` (:79-93). **No Render o disco é efêmero — perde a sessão a cada deploy.**
- **Com a key** → PostgREST direto em `wa_session_keys` com service role (:34-41, `rest()` :43-73).

Criptografia (`crypto.ts`): AES-256-GCM, chave de 32 bytes base64 (:7-15), payload `iv.tag.ciphertext` em base64 (:25-27).

**A regra que não pode ser quebrada** (:110-128):

```
GET wa_session_keys?id=eq.creds
  ├ linha existe + decode OK   → usa as creds
  ├ linha existe + decode FALHA → THROW  ("Creds WA ilegíveis… Não sobrescrevendo")
  └ linha NÃO existe            → initAuthCreds()
```

Se o erro de decode for engolido e cair em `initAuthCreds()`, o `saveCreds` seguinte **sobrescreve a sessão pareada**. Sintoma no campo: "a conta some depois do deploy".

Upsert: lotes de 200, `POST wa_session_keys?on_conflict=id` com `Prefer: resolution=merge-duplicates,return=minimal` (:175-179). `clearAuth` (:205-207) faz `DELETE id=not.is.null` — apaga a tabela toda.

### 6.2 Ciclo de conexão — `worker/src/baileys/client.ts`

`startBaileys()` (:217) só sobe o socket se **`creds.account` existe**, ou há pair pendente, ou `resumingPairing` (:225-233). Senão fica `waiting_pairing` com poll de 10s.

`handleConnectionUpdate` (:116):

| Evento | Ação |
|---|---|
| `qr` | `QRCode.toDataURL` → status `qr`; se há `pendingPairingPhone`, pede `requestPairingCode` (:133-146) |
| `open` | status `connected`, phone de `target.user.id` (:150-162) |
| `close` / `restartRequired` | `connecting` + reagenda imediato (:171-176) |
| `close` / **`loggedOut`** | **`clearAuth()`** + status `logged_out` + poll 10s (:178-191) |
| `close` / timeout com pair pendente | `discardIncompleteAuth` (limpa creds sem `account`, :78-86) → `waiting_pairing` (:193-204) |
| `close` / outros | `disconnected` + reconexão exponencial 5s→60s (`scheduleReconnect` :58-65) |

### 6.3 Estado runtime

Vive em memória (`session.ts:24-32`). TTL de 3 min para pairing code e 1 min para QR,
expirados em `getSessionState`. `sessionPublicView()` é o que sai no `GET /session`.
No app, `mapSessionForUi` (`src/lib/wa/session.ts:16`) valida contra o enum e calcula
`canDispatch = status === 'connected'`. UI faz polling ~4s.

> **Efeito colateral em plano free:** quando o Render hiberna o worker por falta de
> tráfego, o processo reinicia com a memória zerada e responde `disconnected` por
> alguns segundos até o Baileys reconectar. Um slot de dispatch que caia exatamente
> nessa janela para com "WhatsApp desconectado" — comportamento correto do gate, não
> falha. Com o cron batendo a cada 5 min o worker não chega a hibernar.

### 6.4 Auditoria de conexão — `wa_connection_events`

✅ *(novo)* `logConnectionEvent` (`session.ts:55`) grava cada **transição real** de
status numa tabela append-only. Características deliberadas:

- Disparado em ponto único, dentro de `setSessionStatus`, e só quando o status muda
  (`changed`) — reconexão em loop não vira ruído.
- **Fire-and-forget** (`void … .catch(() => {})`): telemetria nunca pode derrubar a
  máquina de conexão, mesma filosofia do `saveCreds`.
- Guardas de ambiente: não escreve sem envs Supabase, com `SCRAPE_MOCK=1` ou quando a
  URL aponta para `ci.supabase.co` (AGENTS §11).
- Consulta pela UI em `GET /api/bot/events` (últimos 50) e no card
  `ConnectionHistoryCard` de `/dashboard/bot`.

Isso responde à pergunta que antes exigia adivinhação: *o worker caiu de madrugada?*
Foi essa tabela que permitiu diagnosticar, em produção, um `Stream Errored (ack)` que
reconectou sozinho em 7 segundos.

---

## 7. Telas do dashboard

Todas as pages são **cascas server** que renderizam um componente client. Nenhuma faz fetch de dados no server — só o layout lê `getUser` para exibir o e-mail.

Gate de auth: **middleware**, não layout. `src/middleware.ts:4` → `updateSession` (`src/lib/supabase/middleware.ts:4`): sem env redireciona `/dashboard*` → `/login` (:10-16); sem user → `/login?next=path` (:44-49); com user em `/login` → `/dashboard` (:51-55).
Menu: `src/components/Sidebar.tsx:15-27` (6 links, ordem fixa). Shell: `DashboardShell.tsx:11-18`.

### 7.1 `/dashboard` — Overview

`src/components/OverviewDashboard.tsx` (client).
Consome `GET /api/stats/overview` (:26) → `getOverviewStats` (`src/lib/stats/overview.ts:57`) toca `app_settings`, `dispatch_jobs`, `offers`, `scrape_runs` + worker `/session`.
Polling de **30s** (:41-47) + botão manual.
Componentes: `KpiCard` (:124-164), `MetaProgress` (:122), `SessionBadge` (:79). Banner de alerta se sessão ≠ connected (:100-112).

### 7.2 `/dashboard/bot` — Bot / sessão WA

`SessionPanel` + `SleepWindowCard` (ambos client).
Leitura: `GET /api/bot/status` (:47), e condicionalmente `/api/bot/qr` (:54) e `/api/bot/pairing-code` (:63). **Não toca Supabase** — tudo delegado ao worker.
Ações: `POST /api/bot/pair` `{phone}` (:102), `POST /api/bot/logout` (:133), `POST /api/bot/reconnect` (:153 — 409 significa "precisa parear de novo").
`SleepWindowCard`: `GET`/`PATCH /api/settings` para `sleep_start`/`sleep_end` (:25, :54).
Polling de **4s, apenas enquanto não conectado** (:89-95).

### 7.3 `/dashboard/grupos` — Grupos WA

`SessionPanel` (duplicado, ver §9) + `GroupsManager`.
`GET /api/groups` (:27) → `wa_groups`. Ações: `POST /api/groups` (:50), `PATCH /api/groups/[id]` `{active}` (:73), `DELETE` = soft delete `active=false` (:82).
Sem polling.

### 7.4 `/dashboard/ofertas` — Ofertas e scrape

`OffersManager` (client). Três fontes:
`GET /api/offers?status&source&page&limit` (:115, paginação server-side), `GET /api/scrape/sessions` (:96 → `marketplace_sessions` + último `scrape_runs`), `GET /api/affiliate-providers` (:137).

Ações: `POST /api/scrape/run` (:218), `POST /api/offers` (cadastro manual, :182), `PATCH /api/offers/[id]` `{status}` (aceitar/rejeitar, :201), `POST /api/affiliate-links` `{offerId}` (:157 — sem providerId, deixa o roteamento por fonte decidir).
Componente: `PriceBalanceModal` (:564) — preço original vs atual, % de desconto, e ações inline.
Sem polling; recarrega após cada ação.
Botão "Disparar" só aparece com `status === 'approved'` (:503-510).

### 7.5 `/dashboard/links` — Links afiliados

`LinksManager`. `GET /api/affiliate-providers` + `GET /api/affiliate-links` em `Promise.all` (:40-43).
Ação: `POST /api/affiliate-links` `{providerId, url?, offerId?}` (:72) — aqui o provider é explícito, diferente da tela de ofertas.
Mostra `affiliate_links.status` e o erro (:240-247).

### 7.6 `/dashboard/disparos` — Disparos e pipeline

`DispatchManager` — a tela mais densa e o principal candidato a quebra. Ganhou na
feature o campo **Ofertas/dia** (`daily_offer_cap`) e o retorno de `mirrored` na
mensagem do pipeline.
**Dois loads separados:**

- `loadStatus` (:83-108): `GET /api/pipeline/status`.
- `load` (:110-157): **5 fetches em paralelo** — `/api/offers?status=approved` (:118), `/api/groups` (:119), `/api/dispatch` (:120), `/api/settings` (:121), `/api/affiliate-providers` (:122).

Ações (6 endpoints de escrita):
`POST /api/dispatch` (:185), `PATCH /api/settings` (:217 — rate limit, template com validação client de `{{affiliate_url}}` :210, auto-dispatch, provider padrão), `POST /api/bot/test-send` (:247), `POST /api/scrape/run` (:268), `POST /api/pipeline/run` (:292), `POST /api/dispatch/run` (:313).
Sem polling; reload manual após cada ação.

---

## 8. Rastreio tela → API → tabela

| Tela | Endpoints | Tabelas |
|---|---|---|
| `/login` | — (client Supabase direto) | `auth` |
| `/dashboard` | `GET /api/stats/overview` | `app_settings`, `dispatch_jobs`, `offers`, `scrape_runs` + worker |
| `/dashboard/bot` | `/api/bot/{status,qr,pairing-code,pair,logout,reconnect}`, **`GET /api/bot/events`**, `GET/PATCH /api/settings` | `wa_connection_events` (histórico) · `app_settings` — status vem do worker |
| `/dashboard/grupos` | `GET/POST /api/groups`, `PATCH/DELETE /api/groups/[id]` + bot status | `wa_groups` |
| `/dashboard/ofertas` | `GET /api/offers`, `PATCH /api/offers/[id]`, `POST /api/scrape/run`, `GET /api/scrape/sessions`, `GET /api/affiliate-providers`, `POST /api/affiliate-links` | `offers`, `scrape_runs`, `marketplace_sessions`, `affiliate_providers`, `affiliate_links` |
| `/dashboard/links` | `GET /api/affiliate-providers`, `GET/POST /api/affiliate-links` | `affiliate_providers`, `affiliate_links`, `offers`, `app_settings` |
| `/dashboard/disparos` | `GET /api/pipeline/status`, `GET /api/offers`, `GET /api/groups`, `GET/POST /api/dispatch`, `POST /api/dispatch/run`, `GET/PATCH /api/settings`, `GET /api/affiliate-providers`, `POST /api/bot/test-send`, `POST /api/scrape/run`, `POST /api/pipeline/run` | `app_settings`, `offers`, `dispatch_jobs`, `wa_groups`, `scrape_runs`, `affiliate_providers` |

**Rotas sem consumidor na UI:** `GET /api/dispatch/[id]` (detalhe de job) e todos os `/api/cron/*`.

---

## 9. Estados do domínio × onde são exibidos e editados

| Estado | Valores | Exibido em | Editado por |
|---|---|---|---|
| `offers.status` | `new / approved / rejected / sent` (`003_offers.sql`) | `OffersManager` badge (:466-473), filtro (:253-258) | `PATCH /api/offers/[id]`; `sent` é escrito pelo dispatch, nunca pela UI |
| `offers.caption_status` | `none / pending / ready / failed` (`008`) | Só **contagens agregadas** em `DispatchManager` | Não editável pela UI — só `pipeline/run.ts`. ✅ *(mudou)* A planilha não escreve mais nada (§4.4) |
| Sessão WA | `disconnected / waiting_pairing / qr / connecting / connected / logged_out` | `SessionBadge` (Overview :79, SessionPanel :206, DispatchManager :364-373) | `/api/bot/{pair,reconnect,logout}` |
| Sessão de marketplace | `ok / unauthenticated / error / expired` | `OffersManager` chips (:297-318) | Não editável (login em `scrapers/session/login.ts`) |
| `dispatch_jobs.status` | `queued / sending / sent / failed / skipped` (`005`) | `DispatchManager` tabela + filtro (:752-853), KPIs do Overview | `POST /api/dispatch`, `/api/dispatch/run`, cron; transições em `process.ts` |
| `affiliate_links.status` | `ok / failed` | `LinksManager` (:240-247) | `POST /api/affiliate-links` |

---

## 10. Esquema do banco (colunas relevantes)

| Tabela | Colunas | Migration |
|---|---|---|
| `offers` | `id, source, external_id, title, price_cents, currency, url, url_canonical, image_url, status, raw, scraped_at, updated_at`, **UNIQUE(source,url_canonical)** | `003_offers.sql:13` |
| `offers` (+) | `original_price_cents, caption, caption_status (CHECK none/pending/ready/failed, default 'none')` — `sheets_row`/`sheets_synced_at` **dropadas** | `008`; drop em `014` |
| `scrape_runs` | `id, source, started_at, finished_at, ok, items_found, items_upserted, error` | `003_offers.sql:30` |
| `affiliate_providers` | `id, slug UNIQUE, name, kind (CHECK livelo/meliuz/generic/mercadolivre), config, active` | `004:1` + `010:5-10` |
| `affiliate_links` | `id, offer_id, provider_id, original_url, affiliate_url, status (CHECK ok/failed), error, created_at` | `004_affiliate_links.sql:11` |
| `app_settings` | `id=1, daily_cap, hourly_cap, min_interval_sec, message_template` | `005_dispatch.sql:1` |
| `app_settings` (+) | `auto_dispatch_enabled, auto_dispatch_group_ids uuid[], default_affiliate_provider_id` (`008`); `sleep_start, sleep_end` (`009`); **`daily_offer_cap`** (`012`) | `008`, `009`, `012` |
| `dispatch_jobs` | `id, offer_id, group_id, affiliate_link_id, status, message_body, scheduled_for, sent_at, error, created_at` + **`attempts` (default 0), `claimed_at`** | `005`; `011` |
| **`wa_sent_jobs`** | `job_id uuid PK, sent_at` — dedupe durável; RLS sem policy (só service role) | `011` |
| **`wa_connection_events`** | `id identity, status (CHECK 6 valores), detail, at` — append-only; RLS select para authenticated, insert só service role | `015` |
| `wa_groups` | `id, jid UNIQUE, name, active, notes` — `daily_limit` **dropada** | `002`; drop em `013` |
| ~~`wa_session`~~ | **dropada** — era schema morto | `002`, `006`; drop em `015` |
| `wa_session_keys` | `id (text PK: 'creds' ou 'type:id'), value (cifrado), updated_at` — **sem RLS**, só service role | `006:2-6` |
| `marketplace_sessions` | `source PK, cookies, meta, status, last_error, updated_at` | `007:1` |

Índices críticos de `dispatch_jobs`: `(status, scheduled_for)`,
`(offer_id, group_id, created_at desc)` e o único parcial — ✅ *(mudou)* recriado na
migration `012` no fuso do domínio:

```sql
(offer_id, group_id, (timezone('America/Fortaleza', sent_at))::date)
  WHERE status = 'sent' AND sent_at IS NOT NULL
```

> Esse índice é a **última linha de defesa** contra duplicata, e funciona: em produção
> ele recusou o segundo job de um par irmão. Mas recusar não basta — quem faz o UPDATE
> precisa tratar a rejeição, ou o job fica preso (§14.7).

---

## 11. Agendamento (cron-job.org)

✅ *(mudou)* `vercel.json` **não tem mais o array `crons`**. O plano Hobby da Vercel
limita a 2 jobs com precisão diária, o que é incompatível com o `*/5` do dispatch e do
keepalive. A agenda vive no cron-job.org (conta free), timezone **America/Fortaleza**:

| Job | Endpoint | Agenda | Resposta | Propósito |
|---|---|---|---|---|
| scrape | `/api/cron/scrape` | `0 11,16,21 * * *` | 202 | Scrape das 3 fontes |
| pipeline | `/api/cron/pipeline` | `10 7-22 * * *` | 202 | Caption → afiliado → enqueue → espelho |
| dispatch | `/api/cron/dispatch` | `*/5 * * * *` | 202 | Um slot: 1 oferta × grupos ativos |
| keepalive | `/api/cron/keepalive` | `*/5 * * * *` | 200 | Mantém 9router e worker acordados |

As três primeiras respondem **`202` imediato** e fazem o trabalho em `after()` de
`next/server` — o plano free do cron-job.org corta a resposta em ~30s, o que seria
fatal para uma rota síncrona. `/api/cron/dispatch` declara `maxDuration=300`
✅ *(resolvido)*, necessário porque o burst com jitter pode se estender; exige Fluid
Compute ativo no projeto.

Auth: `assertCronSecret` (`src/lib/cron-auth.ts:1`) — `CRON_SECRET` via `x-cron-secret`
ou `Authorization: Bearer`. Header ausente ou com espaço colado ao valor → **401 e o
job não executa nada**; o sintoma no log da Vercel é a requisição aparecer sem nenhuma
linha de resultado.

Runbook completo: `docs/runbooks/crons-externos.md`.

---

## 12. Pontos de atenção — situação atual

Os 13 itens da auditoria original, com o desfecho de cada um.

### Resolvidos ✅

| # | Item original | Como foi resolvido |
|---|---|---|
| 1 | `wa_session` é schema morto | Tabela **dropada** (`015`); auditoria passou a viver em `wa_connection_events` (§6.4), com o status runtime seguindo na memória do worker por decisão explícita |
| 2 | Dedupe em três camadas desalinhadas | Camada durável `wa_sent_jobs` no worker (§5.3); índice único recriado em Fortaleza; guard do app com semântica corrigida (§5.1). ⚠️ Ver a limitação que resta em §14.6 |
| 3 | Sem retry | Retry com backoff exponencial + `attempts` + reaper de `sending` (§5.3 e §5.5) |
| 4 | Dois relógios no rate limit | `DISPATCH_TZ` único (`America/Fortaleza`) para gates, guards e índice do banco (§5.4) |
| 5 | `wa_groups.daily_limit` nunca lido | Coluna **dropada** (`013`) e campo removido da UI — a promessa some em vez de mentir |
| 9 | `/api/cron/dispatch` sem `maxDuration` | Declara `maxDuration=300`; rotas de cron respondem `202` + `after()` (§11) |

### Permanecem ⚠️

| # | Item | Observação |
|---|---|---|
| 6 | `DispatchManager` denso, settings em dois loads | Cresceu na feature (ganhou o campo de ofertas/dia). Continua o principal candidato a quebra |
| 7 | `SessionPanel` duplicado com polling próprio | Inalterado |
| 8 | Roteamento de provider afiliado em dois lugares | Inalterado — mudar a regra ainda exige tocar `pipeline/run.ts` e a rota da tela de links |
| 10 | `magalu` aceito como `?source=` sem scraper | Inalterado — erro só em runtime |
| 11 | `caption_status` sem visibilidade por oferta | **Piorou de importância:** depurar caption `failed` exigiu ir ao banco e ao log da Vercel várias vezes hoje. Uma coluna de erro por oferta na UI pagaria o custo |
| 12 | `requireUser()` repetido sem memoização | Inalterado |
| 13 | `GET /api/dispatch/[id]` órfão | Inalterado |

### Invariantes que qualquer refactor deve preservar

- O throw no load das creds do WhatsApp (`auth-state.ts`). Nunca degradar para
  `initAuthCreds()` numa linha existente.
- O gate `creds.account` antes de subir o socket (`client.ts`).
- O `status` preservado no update de `offers` (`supabase-store.ts:54`) — reprocessar
  não pode desaprovar.
- O claim atômico `WHERE id=$id AND status='queued'` (`process.ts`).
- **Todo cálculo de "dia" via `dayStartInTz`** — nenhum `Date.UTC` no domínio.
- **Na dúvida, não enviar:** se a consulta de dedupe falhar, o worker responde 500 e
  deixa o retry decidir; enviar às cegas é o único caminho para duplicar.
- **Nenhum UPDATE de estado terminal sem checar erro** — foi exatamente isso que criou
  os jobs zumbis (§14.7).
- Degradação graciosa do provider ML sem `ML_AFFILIATE_COOKIE` (`providers/mercadolivre.ts`).
- Guardas de `ci.supabase.co` / `SCRAPE_MOCK=1` em qualquer módulo novo com acesso a
  banco ou rede (AGENTS.md §11).

---

## 13. Estado compartilhado no front

**Não existe.** Sem store, sem context, sem provider custom, sem SWR. Cada componente client tem seu `useState` e faz o próprio fetch.
O estado compartilhado real é o **banco + a memória do worker**; a UI sempre revalida por fetch.
Isso explica os fetches repetidos de `/api/settings` e `/api/affiliate-providers` em telas diferentes, e o `SessionPanel` duplicado.

---

## 14. Falhas encontradas em operação real (2026-08-02/03)

A auditoria estática pegou os problemas de desenho. Estes cinco só apareceram com o
sistema rodando em produção — e nenhum seria pego por teste unitário, porque todos
dependem de estado acumulado entre dias ou de comportamento de serviço externo.

### 14.1 Ofertas presas em `failed` para sempre

**Sintoma:** o estoque de captions `failed` só crescia.
**Causa:** o funil selecionava apenas `pending|none`. Uma falha transitória do provedor
(401 de chave rotacionada, 429 de cota) marcava `failed`, e nada reprocessava.
**Correção:** `failed` entrou na seleção (§4.1). A oferta se recupera sozinha no run
seguinte. O teto conhecido está comentado no código: se um dia uma oferta "envenenada"
monopolizar o batch, o próximo passo é um contador de tentativas.

### 14.2 Streaming quebrando o parse da caption

**Sintoma:** `Unexpected non-whitespace character after JSON at position 1800`.
**Causa:** ao trocar o provedor por trás do 9router, o novo passou a streamar
`chat/completions` por default; os chunks concatenados não são JSON válido.
**Correção:** `stream: false` explícito no corpo — robusto independentemente de
configuração de painel.

### 14.3 Rate limit do provedor de IA

**Sintoma:** `429 … prepayment credits are depleted` em rajada.
**Causa:** o loop de captions chamava a API sem pausa.
**Correção:** 1,5s entre chamadas (§4.1), conforme a documentação do provedor.

### 14.4 218 KB de HTML no banco a cada falha do worker

**Sintoma:** `dispatch_jobs.error` com 223 mil caracteres.
**Causa:** `workerFetch` gravava o corpo inteiro da resposta de erro; quando o Render
hiberna, ele serve uma página HTML completa.
**Correção:** corpo truncado em 300 caracteres e, se for HTML, substituído por
`Worker HTTP <status>` (`worker-client.ts:48`) — legível na UI e sem lixo no banco.

### 14.5 Emissão de afiliados parada por filtro malformado

**Sintoma:** `failed to parse filter (not.in.<uuid>)`, `affiliates: 0`.
**Causa:** `.not("id", "in", array)` gera `not.in.<uuid>` sem parênteses; o PostgREST
recusa o filtro e **a query inteira falha**. Bastava **um** link `failed` na última
hora para nenhum link novo ser emitido no sistema todo — head-of-line block silencioso.
**Correção:** `` `(${ids.join(",")})` `` (§4.2), com teste travando a sintaxe.

### 14.6 Mensagem duplicada no grupo

**Sintoma:** 12 mensagens entregues para 8 ofertas; pares separados por ~5 segundos.
**Causa em duas partes:**

1. `hasDispatchToday` recortava tudo por data, então a sobra de ontem ainda em `queued`
   era invisível e o pipeline criava um job irmão hoje.
2. O burst pegava todos os jobs da oferta sem deduplicar por grupo e enviava os dois.
   O dedupe do worker não protege: `jobId` distintos são mensagens distintas para ele.

**Correção:** guard com recorte duplo (§5.1) + um job por grupo no burst (§5.2).

### 14.7 Job zumbi travando a fila inteira

**Sintoma:** 3h14 sem nenhum envio, com fila cheia e worker conectado.
**Causa — a mais instrutiva do dia:** o índice único recusava marcar `sent` no segundo
job do par (corretamente), mas **o erro do UPDATE não era verificado**. O job ficava em
`sending`; o reaper o devolvia para `queued` preservando o `scheduled_for` original, o
que o tornava perpetuamente o **head da fila**; o slot seguinte o escolhia de novo, o
worker respondia `deduped`, e o ciclo recomeçava. Todos os slots eram consumidos por um
job que nunca poderia concluir.
**Correção:** rejeição do índice → `skipped` com motivo legível (§5.5).

**Lição de desenho:** um constraint de banco que rejeita silenciosamente não protege —
transfere o problema para um estado intermediário que ninguém observa.

### 14.8 Reaper sem teto de tentativas

**Sintoma:** jobs com `attempts=13` (o teto é 3).
**Causa:** `MAX_ATTEMPTS` só era avaliado no caminho de falha de *envio*. Como o envio
sempre dava certo (o worker respondia `deduped`), o teto nunca era exercido e o reaper
incrementava indefinidamente.
**Correção:** o reaper também respeita `MAX_ATTEMPTS` e manda para `failed` (§5.3).

### 14.9 Batimento entre `min_interval_sec` e o período do cron

**Sintoma:** envios a cada 10 minutos com cron de 5.
**Causa:** intervalo mínimo de 300s com cron `*/5` — quando o slot chega, faltam ~5s
para completar o intervalo, e ele é recusado; só o slot seguinte passa.
**Correção:** operação com `min_interval_sec=240`. Não é bug de código, é configuração
— mas é uma armadilha silenciosa que corta o throughput pela metade sem erro nenhum.

### Padrão comum aos cinco

Nenhum destes é erro de lógica isolada: **todos são falhas de contrato com o mundo
externo** — o provedor de IA mudou de comportamento, o PostgREST tem uma sintaxe
específica, o Render devolve HTML quando hiberna, o banco rejeita mas quem chama não
lê o erro, o agendador tem período próprio. Testes unitários com fake não pegam isso.
O que pegou foi observar a produção com dados: contar entregas confirmadas contra jobs
registrados, e comparar horários reais entre envios.
