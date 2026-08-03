# Runbook — Staging / Preview isolados de produção

## Por que existe

Antes de 2026-08-03, **Production, Preview e Development** no Vercel apontavam
para o **mesmo** Supabase (`fyotfffqjrtxwfupzhij`) e o **mesmo** worker Render.
Testar feature em preview = risco de mexer em ofertas/disparos reais.

## Mapa canônico

| Camada | Production | Staging (Preview + Development) |
|---|---|---|
| App Vercel env | Production | Preview · Development |
| Supabase project | `fyotfffqjrtxwfupzhij` (`grupo-de-venda`, sa-east-1) | `ojnxywrzeouyzowcgmoe` (projeto free reaproveitado; schema 001–016) |
| `SCRAPE_MOCK` | **ausente / 0** (scrape real) | **`1`** (sem Firecrawl/IA real) |
| Worker | `grupo-de-venda-worker.onrender.com` | **mesmo** por enquanto (ver § Worker) |
| Crons (cron-job.org) | URLs de produção | **não** apontar para preview |

`supabase link` no **repo** = sempre **production**. Staging nunca vira o link default.

## Assert

```bash
bash scripts/assert-db-env.sh production          # confere link do repo
bash scripts/assert-db-env.sh production --push   # db push em prod (gate pré-merge)
bash scripts/assert-db-env.sh staging --list      # migrations no staging
bash scripts/assert-db-env.sh staging --push      # aplica migrations novas no staging
```

Ordem de schema (AGENTS §5):

1. `assert-db-env.sh staging --push` (código novo em preview)
2. Validar preview
3. `assert-db-env.sh production --push` **antes** de merge/deploy em `main`
4. Deploy prod (CI)

## Aplicar migration nova

```bash
# 1) arquivo em supabase/migrations/0xx_*.sql
# 2) staging primeiro
bash scripts/assert-db-env.sh staging --push
# 3) preview smoke (manual ou vercel)
# 4) produção
bash scripts/assert-db-env.sh production --push
# 5) merge/deploy main
```

## Envs Vercel (checklist)

Preview e Development devem ter:

- `NEXT_PUBLIC_SUPABASE_URL=https://ojnxywrzeouyzowcgmoe.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` do **staging**
- `SCRAPE_MOCK=1`

Production deve ter URL/keys de **fyotfff…** e **não** ter `SCRAPE_MOCK=1`.

Conferir:

```bash
vercel env pull /tmp/p.env --environment=production --yes
vercel env pull /tmp/v.env --environment=preview --yes
grep NEXT_PUBLIC_SUPABASE_URL /tmp/p.env /tmp/v.env
```

Hosts **diferentes** = isolamento ok.

## Auth no staging

Staging nasceu **vazio** (sem usuários Supabase Auth). Crie um admin de teste:

1. Dashboard Supabase do projeto staging → Authentication → Add user  
2. Ou `signUp` local com as keys de Development (`vercel env pull .env.local --environment=development`)

Não reutilize senha de produção.

## Worker

Hoje Preview ainda usa o **mesmo** `WORKER_BASE_URL` de produção. Consequências:

- Status/session WA no dashboard preview = sessão **real**
- `POST /send` de teste a partir de preview pode bater no worker de prod se a fila/dispatch apontar pra lá

Mitigações até haver worker de staging:

1. Não rodar dispatch real a partir de preview (fila vazia no staging DB ajuda)
2. Preferir `SCRAPE_MOCK=1` (já setado) e dados de oferta só no staging
3. Futuro: segundo serviço Render + `WORKER_*` só em Preview

## Limite free Supabase

Org free = **2 projetos**. Staging reutilizou o 2º projeto vazio
(`ojnxywrzeouyzowcgmoe`, us-west-2). Não dá para criar um terceiro sem upgrade
ou pausar/apagar um projeto.

## Renomear no dashboard (opcional)

No console Supabase, renomear o projeto `ojnxywrzeouyzowcgmoe` para
`grupo-de-venda-staging` (só label; o ref não muda).
