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

