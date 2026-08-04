# STATE

## Features Integradas

### plataforma-promocoes  ·  2026-07-29  ·  PR #1
- Invariantes: disparo exige sessão WA `connected` + grupo `active` + `affiliate_links` status `ok`; rate limit diário/horário/intervalo em `app_settings`; sem reenvio offer+group no mesmo dia (UTC); secrets só server/env.
- Modelos: `profiles`, `wa_groups`, `wa_session`, `offers`, `scrape_runs`, `affiliate_providers`, `affiliate_links`, `app_settings`, `dispatch_jobs`.
- Decisões: Next.js 16 na Vercel; worker Baileys long-running fora do serverless; afiliados via template URL até APIs reais; cron scrape/dispatch com `CRON_SECRET`; infra Vercel/Neon preferencialmente via CLI.

### conexao-baileys-dashboard  ·  2026-07-29  ·  PR #2
- Invariantes: 1 sessão Baileys/deploy; gate sessão = `creds.account`; pareamento só pelo dashboard (código 8 dígitos + QR); disparo exige status `connected`; secrets/`WHATSAPP_SESSION_KEY` só worker/server; CI bloqueia merge com tsc/lint/test/build vermelhos.
- Modelos: `wa_session_keys` (creds cifradas); `wa_session` estendido (`waiting_pairing`, `logged_out`, `pairing_code`, `phone`).
- Decisões: auth Postgres/Supabase cifrado (fallback multi-file dev); mailbox pair in-memory no worker + HTTP `x-worker-secret`; UI `/dashboard/bot` com poll 4s; logout/reconnect no painel; CI espelhando almoxarifado (app+worker).

### firecrawl-scrape  ·  2026-07-30  ·  PR #11
- Invariantes: scrape de ofertas de marketplaces via Firecrawl server-side; `FIRECRAWL_API_KEY` apenas em env/server (nunca no client bundle nem no git); `SCRAPE_MOCK=1` para CI e dev local sem gastar créditos; ofertas scrapadas entram com `status=new` no Supabase para filtro/aprovação no dashboard; Magalu permanece stub.
- Modelos: inalterados (`offers`, `scrape_runs`, enum `scrape_source`).
- Decisões: client `scrapeOffersFromUrl` via `fetch` server-only com extract schema JSON único; max 15 ofertas por fonte por run; fontes ativas Mercado Livre, Amazon e Shopee.

### scrape-auth-sessao  ·  2026-07-30  ·  PR #12
- Invariantes: login automático por marketplace via envs (`ML_*`, `AMZN_*`, `SHOP_*`); sessão persistida no DB (`marketplace_sessions`); self-heal 1 retry em falhas de sessão mid-run; filtro anti-lixo (`isProductOffer`) descarta menus ("Já tenho conta"), banners de cupons genéricos da Amazon e URLs inválidas da Shopee; `SCRAPE_MOCK=1` não chama login nem scrape externo; cookies/credenciais nunca vazam para o client.
- Modelos: `marketplace_sessions` (cookies, status, last_error, updated_at).
- Decisões: Cookie Header injetado no payload do Firecrawl `scrapeOffersFromUrl`; reativação da Shopee em `listActiveScrapeSources()`; endpoint público de status `GET /api/scrape/sessions` sem cookies; chips de status por loja em `OffersManager`.

### scrape-links-reais  ·  2026-07-31  ·  PR #13
- Invariantes: scrape grava só hrefs presentes na página (Firecrawl `links`+`html`, sem extract LLM); `isProductOffer` + validação HTTP (404/410 drop; 403 keep) antes do upsert; `SCRAPE_MOCK=1` sem Firecrawl nem HEAD externo; contrato `runScrape` inalterado; secrets só server.
- Modelos: inalterados (`offers`, `scrape_runs`).
- Decisões: harvest via `html-extract`/`harvestOffers`; `url-alive` com paralelismo limitado; Amazon default `gp/goldbox`; worker `normalizePhone` local (sem import cross-package app→worker).

### fix-colheita-marketplaces  ·  2026-07-31
- Invariantes: fonte ativa que colhe 0 ofertas marca o run `ok=false` com motivo legível (colheita vazia nunca é sucesso silencioso); Firecrawl na **v2** (`profile` só existe nela); Shopee exige `FIRECRAWL_SHOPEE_PROFILE` — sem ele a fonte falha visivelmente em vez de retornar `[]`; `url-alive` decide morte pelo **GET**, nunca pelo HEAD.
- Medições (2026-07-31) que fundamentam o código: Amazon responde **503 a todo HEAD**, ASIN válido ou não — só o GET distingue (válido → 200 estável; inexistente → 500 em 4/5, 404 em 1/5). ML e Shopee devolvem 200 para qualquer path (SPA): validação HTTP é cega ali, a garantia vem de só colher href presente na página. Amazon `gp/goldbox` e `/deals` servem apenas banners `/promotion/psp/` (0 `/dp/`); `gp/bestsellers` entrega ~36 produtos reais.
- Decisões: `SCRAPE_AMAZON_URL` default → `gp/bestsellers` (+`waitFor` 3s); Shopee via profile de browser Firecrawl (`saveChanges:false`) — login por env nunca autenticou nada; paywall "Login Necessário" (HTTP 200) vira exceção no client.
- Purga: 58 ofertas removidas (42 `/dp/ASIN` alucinados pelo extract LLM antigo — 42/42 mortas na verificação; 11 banners `/promotion/psp/`; 5 links de login/privacidade do ML). Restaram 25, todas ML com slug de produto.

### balanco-preco-oferta  ·  2026-07-31  ·  PR #14
- Invariantes: tags de fonte de ofertas interativas via modal (`PriceBalanceModal.tsx`); sanitização de títulos da Amazon/Mercado Livre usando slug quando o título interno for id/numérico; paginação server-side configurável (`30`/`50`/`100`).
- Modelos: `RawOffer` estendido (`originalPriceCents`).
- Decisões: UI Neo-brutalism preservada com botões clicáveis de fonte; modal com balanço comparativo de preço, economia em R$ e % de desconto; suporte defensivo a atalhos de teclado (Escape) e backdrop click.

### escala-disparos  ·  2026-08-02  ·  PR #15
- Invariantes: nenhum reenvio sem consulta prévia a `wa_sent_jobs` (dedupe durável no worker; na dúvida não envia); retry com backoff até 3 tentativas e reaper de `sending` preso >10min operam POR CIMA do claim atômico, nunca no lugar dele; todo calendário do dispatch (janela, contadores, unicidade diária) em `America/Fortaleza` via `DISPATCH_TZ`/`dayStartInTz` — nenhum `Date.UTC` no domínio; 1 oferta por slot de 5min, burst sequencial a todos os grupos ativos (teto 15) com jitter 2–5s; caps duplos (`daily_offer_cap` ofertas/dia + `daily_cap` msgs/dia) conservadores por default, subida de volume é decisão do admin; planilha é espelho read-only por reescrita completa (nada volta dela); status vivo da sessão WA permanece na memória do worker (eventos são histórico, não status); rotas de cron respondem `202` + `after()` — agendamento vive no cron-job.org (runbook), `vercel.json` sem `crons`.
- Modelos: `wa_sent_jobs` (PK job_id); `dispatch_jobs` + `attempts`/`claimed_at`; `app_settings` + `daily_offer_cap`; `wa_connection_events` (append-only, RLS select); índice `dispatch_jobs_one_sent_per_day` recriado em Fortaleza. Drops: `wa_session` (schema morto), `wa_groups.daily_limit`, `offers.sheets_row`/`sheets_synced_at`.
- Decisões: pacing do burst no app serverless (`maxDuration=300`, exige Fluid Compute no Hobby; plano B documentado: pacing no worker); `rest()` PostgREST extraído para `worker/src/db.ts` e compartilhado (auth cifrada, dedupe, eventos); batches do pipeline derivados de `daily_offer_cap` (clamp 1–25) com leitura única de settings; eventos de conexão em ponto único (`setSessionStatus`), fire-and-forget com guardas ci/env; smoke E2E Playwright (`npm run test:e2e`) com envs neutralizadas — worker cortado no gate de sessão, sem tocar banco real; migrations 011–015 devem estar aplicadas em produção ANTES do merge (AGENTS §5).

### worker-baileys-send-only-bad-mac  ·  2026-08-04
- **Problema as-built:** `Session error: Error: Bad MAC` (libsignal `verifyMAC`) no log do Render — falha de **decrypt inbound**, não de `POST /send`. Storm de Bad MAC + free Render → `502` no health; painel mostra `Worker inacessível` e `Connection was lost (code=408)`.
- **Invariantes (send-only):**
  - `makeWASocket` em `worker/src/baileys/client.ts` usa `shouldIgnoreJid` que retorna true para `isJidGroup` + `isJidBroadcast` + `isJidNewsletter` + `isJidUser` + `isLidUser` — **não** decrypta inbound de grupo/status/newsletter/DM/LID.
  - Outbound `socket.sendMessage` em `POST /send` (`worker/src/http/server.ts`) **não** consulta `shouldIgnoreJid` — disparo a `@g.us` continua válido.
  - 1 processo / 1 `sock` / `render.yaml` `numInstances: 1` no mesmo `wa_session_keys` (2 writers = last-write-wins e Bad MAC).
  - Gate de sessão = `creds.account` (não `me`); anti-flap: `timedOut` **com** account → `disconnected` + backoff (não `waiting_pairing`).
  - Logout / `loggedOut` → `clearAuth` = `DELETE` em **toda** `wa_session_keys` (creds + keys Signal).
- **Nuances que valem o preço:**
  1. **Ignore só `@g.us` não bastou** — log real tinha sessão `4041564225646.0` (LID 1:1). Send-only de produto precisa ignorar **user + lid** também.
  2. **`shouldIgnoreJid` não conserta ratchet podre** — se Bad MAC volta após deploy do ignore, ordem: deploy código → **Logout** no `/dashboard/bot` (ou `POST /session/logout`) → re-pair. Preferir logout oficial a apagar só `session:%` no SQL.
  3. **Versão:** lock `@whiskeysockets/baileys` **6.7.24** (`package.json` `^6.7.18`). PR WhiskeySockets **#2372** (lock canônico PN/LID, não apagar PN em `migrateSession`, grace de prekey) ainda **OPEN** — **não** está no npm 6.7.x nem v7 RC estável; se voltar Bad MAC estrutural, patch em 6.7.24 (não pular v7 cego).
  4. **Auth store:** `makeCacheableSignalKeyStore` (cache ~5min) + `keys.set` REST em lotes 200 (`on_conflict=id`, merge-duplicates). `saveCreds().catch(() => {})` ainda engole falha de rede — divergência mem/DB no kill do free continua risco residual.
  5. **Logger Baileys silent** — Bad MAC aparece no **stderr do libsignal**, não no pino do app; `/health` rico (`sessionStatus`, `lastError`, `uptimeSec`) e `wa_connection_events` **não** gravam stack Bad MAC.
  6. **UI diagnóstico:** `/dashboard/bot` → card Histórico → **Ver log de erros** (modal em `ConnectionHistoryCard.tsx`) lê `GET /api/bot/events` = `wa_connection_events` (status + `detail`/`lastError`). Útil p/ queda `code=408`, logged_out, etc. — **não** substitui log Render p/ Bad MAC.
  7. **Free Render:** deploy `live` ≠ health `200` imediato; cold start/502 intermitente é normal. Push em `worker/` redeploya worker; push só em `src/` (Vercel) **não**.
- **Operação se Bad MAC / 502 voltar:** (1) health + log Render (jid/sessão do MAC) (2) se ratchet sujo → logout + re-pair (3) se free matando → plano não-free / menos cold (4) se protocolo PN/LID → patch #2372 em 6.7.24.
- **Commits de referência:** `31433d7` / `50e65d6` (shouldIgnoreJid), `80015e7` (modal log), anti-flap anterior `f7d3600`.

### scrape-fontes-meli-amazon  ·  2026-08-04
- **Invariante:** `listActiveScrapeSources()` e cron scrape aceitam só **`mercadolivre` + `amazon`**. Shopee **fora do ativo**.
- **Por quê:** Production sem `FIRECRAWL_SHOPEE_PROFILE` gerava fail-fast em todo cron; profile Firecrawl `shopee-br` criado, mas scrape v2 com `saveChanges:false` ainda devolve HTML **Login Necessário** / captcha anti-bot. Não vale spam de `scrape_runs` fail.
- **Código:** `shopee.ts` e enum `shopee` no DB/UI **permanecem** (reativar = devolver `"shopee"` em `listActiveScrapeSources` + `ACTIVE` do cron). Chips de sessão e filtro de ofertas podem ainda listar Shopee.
- **Locais:** `src/lib/scrapers/registry.ts`, `src/app/api/cron/scrape/route.ts`.
- **Backlog:** planilha espelho UX (`mirrorToSheets`). Docs: `PLANO-shopee-espelho-preco-caption.md`, `ANALISE-planilha-espelho-captions.md`.

### caption-preco-meli  ·  2026-08-04
- **Problema:** em prod ~87% das captions MeLi ready com `price_cents` null (links Firecrawl sem preço no harvest); quando DB tinha preço e caption citava R$, batia (não era LLM trocando número).
- **Mitigações as-built:**
  1. `enrichMissingPrices` + janela vizinha 1400 chars em `html-extract.ts` — re-varre HTML perto do href/path e preenche `priceCents` faltante no `harvestOffers`.
  2. Prompt `caption.ts`: ~280 chars; se preço válido → cite **exatamente**; se `—` → proíbe inventar R$.
- **Limitação:** ofertas **já** no DB com null não se curam sozinhas — precisam re-scrape (upsert atualiza preço) e/ou re-caption. Captions antigas sem preço permanecem até o pipeline regerar.


