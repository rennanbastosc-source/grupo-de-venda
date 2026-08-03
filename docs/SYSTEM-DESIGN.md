# System Design — Grupo de Venda

> Documentação de arquitetura as-built para orientar refatorações.
> Fonte: leitura direta do código em `2026-08-01`. Todas as afirmações citam `arquivo:linha`.
> Complementa (não substitui) `STATE.md` e `docs/specs/`.

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
│  • Crons Vercel              │ x-worker│  • estado de sessão EM      │
│  • Pipeline scrape→enqueue   │ -secret │    MEMÓRIA (não no banco)   │
└──────────────┬───────────────┘         └──────────────┬──────────────┘
               │                                        │
               │        ┌────────────────────┐          │
               └───────▶│  Supabase Postgres │◀─────────┘
                        │  (canônico)        │  PostgREST direto,
                        └────────────────────┘  service role
                                 ▲
                        ┌────────┴─────────┐
                        │  Google Sheets   │ espelho de revisão humana
                        └──────────────────┘
```

Regras estruturais que caem fora do óbvio:

- **O banco é canônico. A planilha é espelho.** O pipeline exporta, deixa humano editar, reimporta com regras de não-rebaixamento (§4.3).
- **O status do WhatsApp não está no banco.** Vive na memória do worker (`worker/src/baileys/session.ts:22-30`). A tabela `wa_session` existe nas migrations mas **nenhum código a lê ou escreve** — é schema morto.
- **O que está cifrado no banco são as chaves da sessão** (`wa_session_keys`), não o status.
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
| `src/app/api/**` | Rotas REST (todas com `requireUser`, exceto `/api/cron/*`) |
| `src/app/(dashboard)/**` | Telas (todas cascas server → componente client) |

---

## 3. Fluxo A — Ingestão (scrape → oferta)

### 3.1 Entrypoints

| Gatilho | Rota | Arquivo |
|---|---|---|
| Cron `0 11,16,21 * * *` | `GET /api/cron/scrape` | `src/app/api/cron/scrape/route.ts:23` |
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
Cron (11/16/21h) ──CRON_SECRET──▶ GET /api/cron/scrape
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

`runOfferPipeline(supabase)` — `src/lib/pipeline/run.ts:464`.
Entrada: `SupabaseClient` (service role). Saída: `PipelineResult {exported, captioned, imported, affiliates, enqueued, errors[]}` (`types.ts:3`).
5 fases **sequenciais** (`run.ts:476-480`), `BATCH=10` (:29).

### 4.1 Fase 1 — `exportToSheets` (`run.ts:82`)

Seleciona `sheets_row IS NULL` + `status IN ('new','approved')`, ordem `scraped_at` asc, batch 10 (:88-96).
Garante header (:105-109), monta linha via `offerToSheetRow` (:45), `appendRows` (:125).
Grava de volta: `sheets_row`, `sheets_synced_at`, e **`caption_status: none → pending`** (:133-144).

Colunas da planilha (:45): `0=id 1=title 2=price 3=url 4=source 5=status 6=caption 7=caption_status 8=affiliate_url 9=sheets_synced_at 10=updated_at 11=notes`.

### 4.2 Fase 2 — `generateCaptions` (`run.ts:156`)

Alvo: `caption_status IN ('pending','none')` e `status IN ('new','approved')`, **batch 3**.
Provedor: `src/lib/ai/caption.ts:14` → 9router OpenAI-compat, `NINE_ROUTER_BASE_URL` default `http://127.0.0.1:20128/v1` (:1), modelo `NINE_ROUTER_MODEL` default `"GeMiNi"` (:2), temperature 0.7, timeout 30s (:53). System prompt: copywriter PT-BR, ~400 chars, sem links, proibido inventar preço (:30-39).
Sucesso → `caption_status:"ready"` (:188). Erro → `"failed"` (:225). Write-back do caption na planilha quando há `sheets_row` (:199-217).

### 4.3 Fase 3 — `importFromSheets` (`run.ts:237`)

Lê a planilha inteira, mapeia `id → {status, caption, caption_status}`, compara com o DB (:261-271) e aplica patch com **duas travas**:

- Não rebaixa oferta já `sent` (:317).
- Não sobrescreve caption `ready` com valor stale da planilha (:289).

### 4.4 Fase 4 — `ensureAffiliates` (`run.ts:335`)

Para `caption_status='ready'` e `status IN ('new','approved')`:
roteia provider por fonte (:376-379) — `mercadolivre` → slug `mercadolivre`; demais → slug `generic-tag`; fallback `app_settings.default_affiliate_provider_id`.
**Skipa** se já existe link `ok` do provider que seria usado (:384-392). Senão `emitAffiliateLink` (`src/lib/affiliates/emit.ts:36`).

Providers (`affiliates/types.ts:1`):

| kind | Implementação | Comportamento |
|---|---|---|
| `generic` / `livelo` / `meliuz` | `providers/generic.ts:4` | template `{{url}}` + query params |
| `mercadolivre` | `providers/mercadolivre.ts:23` | modo curto `meli.la` (POST `createLink` com CSRF, requer `ML_AFFILIATE_COOKIE` + `ML_AFFILIATE_TAG`); **degrada** para modo longo `matt_word/matt_tool` se faltar env (:37-114) |

Resultado gravado em `affiliate_links` com `status:"ok"` ou `"failed"` + `error` (`emit.ts:81-112`).

### 4.5 Fase 5 — `autoEnqueue` (`run.ts:408`)

Só roda se `auto_dispatch_enabled` **e** `auto_dispatch_group_ids` não vazio (:412-420).
Para cada `caption_status='ready'`, chama `enqueueDispatch` (`src/lib/dispatch/enqueue.ts:15`).
Ao criar jobs, a oferta vai para `status:'approved'` (:448).

### 4.6 Estado "pronta para disparo"

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
5. Por grupo: `assertGroupActive` (`guards.ts:30`) → `hasDispatchToday` (`guards.ts:106`) → INSERT `queued` (:72-82).

`hasDispatchToday` cobre `queued|sending|sent` com `created_at >= meia-noite UTC` para o par offer+group.

### 5.2 Consumo — `processDispatchQueue` (`process.ts:53`)

`maxJobs` default **5** por execução (:58).

Sequência por execução:

1. `GET worker /session`; se ≠ connected, retorna com `stoppedReason` (:66-72).
2. `loadSettings` (:13-26) — defaults `35 / 10 / 45 / null / null`.
3. Contadores: `dayStart` = meia-noite UTC (:75-77), `hourStart` = `now - 1h` (:78), `daily`/`hourly` = COUNT de `sent` (:28-38), `lastSentAt` (:40-51).
4. Loop até 5: `canSendNow` → SELECT job → claim → send → update.

### 5.3 Rate limiting — `canSendNow` (`rate-limit.ts:65-97`)

Ordem de avaliação (primeiro que falhar interrompe o loop com `stoppedReason`):

| # | Gate | Fonte | Detalhe |
|---|---|---|---|
| 1 | Janela de silêncio | `sleep_start`/`sleep_end` | `isWithinSleepWindow` (:47-63) em **America/Sao_Paulo** via `Intl.DateTimeFormat` (:29-41); suporta cruzar meia-noite (22:00→07:00, :61-62); `null` ou `start===end` desativa |
| 2 | Teto diário | `daily_cap` (35) | `counts.daily >= cap` |
| 3 | Teto horário | `hourly_cap` (10) | `counts.hourly >= cap` |
| 4 | Intervalo mínimo | `min_interval_sec` (45) | desde `lastSentAt` |

Contadores são incrementados em memória após cada envio (:176-178), então os tetos valem dentro da mesma execução.

> **Atenção ao refatorar:** a janela de silêncio usa fuso de São Paulo, mas os tetos diários usam meia-noite **UTC**. São relógios diferentes no mesmo arquivo.

### 5.4 Máquina de estados de `dispatch_jobs`

```
        enqueue.ts:78                                   ┌──────────┐
   ────────────────────────────────────────────────────▶│  queued  │
                                                        └────┬─────┘
   process.ts:114-125  grupo inativo                         │
   ◀───────────────────────────────────────────  ┌───────────┤
   ┌───────────┐                                 │           │
   │  skipped  │ (terminal)                      │  process.ts:128-134
   └───────────┘                                 │  UPDATE ... SET 'sending'
                                                 │  WHERE id AND status='queued'
                                                 ▼  (claim atômico)
                                            ┌──────────┐
                                            │ sending  │
                                            └────┬─────┘
                       worker /send ok           │         worker /send !ok
                       process.ts:161-168        │         process.ts:148-158
                            ┌───────────────────┴──────────────────┐
                            ▼                                      ▼
                      ┌──────────┐                           ┌──────────┐
                      │   sent   │ + sent_at                 │  failed  │ + error
                      └────┬─────┘ (terminal)                └──────────┘ (terminal)
                           │                                   (terminal)
                           └─▶ offers.status = 'sent'  (process.ts:170-173)
```

**Não existe retry nem requeue.** `failed` e `skipped` são terminais — recuperação só por nova enfileirada manual ou pelo próximo pipeline.

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
| `/send` | POST | `{jid,text,jobId?}` → `{ok, deduped?}`; status ≠ connected → **409**; sem socket 503 (:118-152) |

Dedupe no worker: `sentJobIds` — `Set` **em memória** (`server.ts:34`); re-POST do mesmo `jobId` responde `{ok:true, deduped:true}` sem reenviar (:136-138). Some no restart.

### 5.6 Diagrama — disparo

```
Cron */5min ── GET /api/cron/dispatch (CRON_SECRET)
Admin ─────── POST /api/dispatch/run (requireUser)
        │
        ▼
processDispatchQueue (process.ts:53)
  1. GET worker /session ──────────▶ server.ts:47
     ◀─ {status:'connected'}   (senão para: stoppedReason)
  2. loadSettings(app_settings id=1)
  3. counts: sent desde dayStart UTC / última 1h / lastSentAt
  4. loop até 5 jobs:
       canSendNow (sleep SP → daily → hourly → interval)   rate-limit.ts:65
       SELECT queued AND scheduled_for<=now  ORDER BY scheduled_for
       grupo inativo? ──▶ skipped
       UPDATE 'sending' WHERE status='queued'   ← claim atômico
       POST worker /send {jid,text,jobId} ─────▶ server.ts:118
            ├ status≠connected → 409 → job failed
            ├ sentJobIds dedupe (memória) → {deduped:true}
            └ socket.sendMessage(jid,{text}) ─▶ Baileys ─▶ grupo (…@g.us)
       ◀─ 200 {ok:true}
       UPDATE job 'sent' + sent_at
       UPDATE offers 'sent'
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

Vive em memória (`session.ts:22-30`). TTL de 3 min para pairing code e 1 min para QR (:19-20), expirados em `getSessionState` (:32-47). `sessionPublicView()` (:118-127) é o que sai no `GET /session`.
No app, `mapSessionForUi` (`src/lib/wa/session.ts:16-66`) valida contra o enum e calcula `canDispatch = status === 'connected'`. UI faz polling ~4s.

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

`DispatchManager` — 856 linhas, a tela mais densa e o principal candidato a quebra.
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
| `/dashboard/bot` | `/api/bot/{status,qr,pairing-code,pair,logout,reconnect}`, `GET/PATCH /api/settings` | nenhuma (bot = worker) · `app_settings` |
| `/dashboard/grupos` | `GET/POST /api/groups`, `PATCH/DELETE /api/groups/[id]` + bot status | `wa_groups` |
| `/dashboard/ofertas` | `GET /api/offers`, `PATCH /api/offers/[id]`, `POST /api/scrape/run`, `GET /api/scrape/sessions`, `GET /api/affiliate-providers`, `POST /api/affiliate-links` | `offers`, `scrape_runs`, `marketplace_sessions`, `affiliate_providers`, `affiliate_links` |
| `/dashboard/links` | `GET /api/affiliate-providers`, `GET/POST /api/affiliate-links` | `affiliate_providers`, `affiliate_links`, `offers`, `app_settings` |
| `/dashboard/disparos` | `GET /api/pipeline/status`, `GET /api/offers`, `GET /api/groups`, `GET/POST /api/dispatch`, `POST /api/dispatch/run`, `GET/PATCH /api/settings`, `GET /api/affiliate-providers`, `POST /api/bot/test-send`, `POST /api/scrape/run`, `POST /api/pipeline/run` | `app_settings`, `offers`, `dispatch_jobs`, `wa_groups`, `scrape_runs`, `affiliate_providers` |

**Rotas sem consumidor na UI:** `GET /api/dispatch/[id]` (detalhe de job) e todos os `/api/cron/*`.

---

## 9. Estados do domínio × onde são exibidos e editados

| Estado | Valores | Exibido em | Editado por |
|---|---|---|---|
| `offers.status` | `new / approved / rejected / sent` (`003_offers.sql`) | `OffersManager` badge (:466-473), filtro (:253-258) | `PATCH /api/offers/[id]`; `sent` é escrito pelo dispatch (`process.ts:170`), nunca pela UI |
| `offers.caption_status` | `none / pending / ready / failed` (`008`) | Só **contagens agregadas** em `DispatchManager` (:376-400) | Não editável pela UI — só `pipeline/run.ts:188,225` e import da planilha (:289-307) |
| Sessão WA | `disconnected / waiting_pairing / qr / connecting / connected / logged_out` | `SessionBadge` (Overview :79, SessionPanel :206, DispatchManager :364-373) | `/api/bot/{pair,reconnect,logout}` |
| Sessão de marketplace | `ok / unauthenticated / error / expired` | `OffersManager` chips (:297-318) | Não editável (login em `scrapers/session/login.ts`) |
| `dispatch_jobs.status` | `queued / sending / sent / failed / skipped` (`005`) | `DispatchManager` tabela + filtro (:752-853), KPIs do Overview | `POST /api/dispatch`, `/api/dispatch/run`, cron; transições em `process.ts` |
| `affiliate_links.status` | `ok / failed` | `LinksManager` (:240-247) | `POST /api/affiliate-links` |

---

## 10. Esquema do banco (colunas relevantes)

| Tabela | Colunas | Migration |
|---|---|---|
| `offers` | `id, source, external_id, title, price_cents, currency, url, url_canonical, image_url, status, raw, scraped_at, updated_at`, **UNIQUE(source,url_canonical)** | `003_offers.sql:13` |
| `offers` (+) | `original_price_cents, caption, caption_status (CHECK none/pending/ready/failed, default 'none'), sheets_row, sheets_synced_at` | `008_pipeline_automation.sql:2-14` |
| `scrape_runs` | `id, source, started_at, finished_at, ok, items_found, items_upserted, error` | `003_offers.sql:30` |
| `affiliate_providers` | `id, slug UNIQUE, name, kind (CHECK livelo/meliuz/generic/mercadolivre), config, active` | `004:1` + `010:5-10` |
| `affiliate_links` | `id, offer_id, provider_id, original_url, affiliate_url, status (CHECK ok/failed), error, created_at` | `004_affiliate_links.sql:11` |
| `app_settings` | `id=1, daily_cap(35), hourly_cap(10), min_interval_sec(45), message_template` | `005_dispatch.sql:1` |
| `app_settings` (+) | `auto_dispatch_enabled, auto_dispatch_group_ids uuid[], default_affiliate_provider_id` (`008`); `sleep_start, sleep_end` (`009`) | `008:10-12`, `009:3-4` |
| `dispatch_jobs` | `id, offer_id, group_id, affiliate_link_id, status, message_body, scheduled_for, sent_at, error, created_at` | `005:22-47` |
| `wa_groups` | `id, jid UNIQUE, name, active, daily_limit, notes` | `002:1-10` |
| `wa_session` | **schema morto** — nenhum código lê/escreve | `002:12-19`, `006:11-26` |
| `wa_session_keys` | `id (text PK: 'creds' ou 'type:id'), value (cifrado), updated_at` — **sem RLS**, só service role | `006:2-6` |
| `marketplace_sessions` | `source PK, cookies, meta, status, last_error, updated_at` | `007:1` |

Índices críticos de `dispatch_jobs` (`005:35-47`):
`(status, scheduled_for)`, `(offer_id, group_id, created_at desc)` e o único parcial
`(offer_id, group_id, timezone('UTC', sent_at)::date) WHERE status='sent' AND sent_at IS NOT NULL`.

---

## 11. Agendamento (`vercel.json`)

| Cron | Endpoint | `maxDuration` | Propósito |
|---|---|---|---|
| `0 11,16,21 * * *` | `/api/cron/scrape` | 120s (`route.ts:8`) | Scrape das 3 fontes |
| `15 11,16,21 * * *` | `/api/cron/pipeline` | 300s (`route.ts:6`) | Export → caption → import → afiliado → enqueue |
| `*/5 * * * *` | `/api/cron/dispatch` | **não definido** (default da plataforma) | Consome até 5 jobs |
| `*/5 * * * *` | `/api/cron/keepalive` | — | Mantém o 9router acordado (free tier do Render dorme ~15min) |

Auth: `assertCronSecret` (`src/lib/cron-auth.ts:1`) — `CRON_SECRET` via `x-cron-secret` ou `Authorization: Bearer`.

---

## 12. Pontos de atenção para refatoração

Fatos observados no código, ordenados por risco. Nenhuma alteração foi feita.

### Risco alto

1. **`wa_session` é schema morto.** Migrations `002` e `006` criam a tabela e as colunas de status; nenhum código em `src/` ou `worker/` a lê ou escreve. O status autoritativo é memória do worker. Consequência: reinício do worker perde o status até o primeiro poll, e não há histórico de conexão. Decidir entre remover a tabela ou passar a persistir nela.

2. **Dedupe de envio tem três camadas desalinhadas.**
   - App: `hasDispatchToday` cobre `queued|sending|sent` (`guards.ts:106`).
   - SQL: índice único parcial cobre **só** `sent` (`005:41-47`).
   - Worker: `sentJobIds` em memória, some no restart (`server.ts:34`).
   A janela de corrida entre `queued` e `sending` depende apenas do claim atômico em `process.ts:128-134`. Funciona hoje porque há um único consumidor; quebra se houver concorrência.

3. **Sem retry.** `failed` e `skipped` são terminais (§5.4). Uma falha transitória do worker (deploy, reconexão) marca o job como perdido em definitivo. Não há coluna `attempts` nem requeue.

4. **Dois relógios no rate limit.** Janela de silêncio em America/Sao_Paulo (`rate-limit.ts:29-41`), tetos diários em UTC (`process.ts:75-77`). Entre 21:00 e 00:00 de Brasília o "dia" do teto já virou.

### Risco médio

5. **`wa_groups.daily_limit` nunca é lido.** A coluna existe (`002`), a UI edita (`GroupsManager:163`), mas nenhum gate do dispatch a consulta. Limite por grupo é uma promessa não cumprida na UI.

6. **`DispatchManager` acumula 6 endpoints de escrita e 6 de leitura em um componente de 856 linhas**, com settings sincronizadas em dois pontos (`loadStatus` e `load`) — risco de divergência entre o que a tela mostra e o que está no banco.

7. **`SessionPanel` duplicado** em `/dashboard/bot` e `/dashboard/grupos`, cada instância com seu próprio polling de 4s. Sem store compartilhado (§13), são dois clientes independentes batendo no worker.

8. **Roteamento de provider afiliado vive em dois lugares** com regras diferentes: `pipeline/run.ts:376-379` (por `source`, com fallback para `default_affiliate_provider_id`) e `POST /api/affiliate-links` da tela de links (provider explícito). Mudar a regra exige tocar os dois.

9. **`/api/cron/dispatch` sem `maxDuration`** enquanto scrape (120s) e pipeline (300s) definem. Se a fila crescer e o worker ficar lento, o timeout default corta no meio — jobs ficam presos em `sending` sem transição terminal.

### Risco baixo / limpeza

10. **`magalu` aceito como `?source=` mas sem scraper** (`cron/scrape/route.ts:10` vs `registry.ts:18`) — erro só em runtime.
11. **`caption_status` não tem visibilidade por oferta**, só contagens agregadas em `/dashboard/disparos`. Depurar uma caption `failed` específica exige ir ao banco.
12. **`requireUser()` repetido em cada rota**, sem client memoizado.
13. **Nenhuma tela consome `GET /api/dispatch/[id]`** — rota órfã.

### Invariantes que qualquer refactor deve preservar

- O throw no load das creds do WhatsApp (`auth-state.ts:120-125`). Nunca degradar para `initAuthCreds()` numa linha existente.
- O gate `creds.account` antes de subir o socket (`client.ts:225-233`).
- O `status` preservado no update de `offers` (`supabase-store.ts:54`) — reprocessar não pode desaprovar.
- As duas travas do import da planilha: não rebaixar `sent` (:317) e não sobrescrever caption `ready` (:289).
- O claim atômico `WHERE id=$id AND status='queued'` (`process.ts:128-134`).
- Degradação graciosa do provider ML sem `ML_AFFILIATE_COOKIE` (`providers/mercadolivre.ts:37-114`).
- Guardas de `ci.supabase.co` / `SCRAPE_MOCK=1` em qualquer módulo novo com acesso a banco ou rede (AGENTS.md §11).

---

## 13. Estado compartilhado no front

**Não existe.** Sem store, sem context, sem provider custom, sem SWR. Cada componente client tem seu `useState` e faz o próprio fetch.
O estado compartilhado real é o **banco + a memória do worker**; a UI sempre revalida por fetch.
Isso explica os fetches repetidos de `/api/settings` e `/api/affiliate-providers` em telas diferentes, e o `SessionPanel` duplicado.
