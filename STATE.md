# STATE

## Features Integradas

### plataforma-promocoes  ·  2026-07-29  ·  PR #1
- Invariantes: disparo exige sessão WA `connected` + grupo `active` + `affiliate_links` status `ok`; rate limit diário/horário/intervalo em `app_settings`; sem reenvio offer+group no mesmo dia (UTC); secrets só server/env.
- Modelos: `profiles`, `wa_groups`, `wa_session`, `offers`, `scrape_runs`, `affiliate_providers`, `affiliate_links`, `app_settings`, `dispatch_jobs`.
- Decisões: Next.js 16 na Vercel; worker Baileys long-running fora do serverless; afiliados via template URL até APIs reais; cron scrape/dispatch com `CRON_SECRET`; infra Vercel/Neon preferencialmente via CLI.

