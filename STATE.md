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

