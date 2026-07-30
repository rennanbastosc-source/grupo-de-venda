<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

@STATE.md
@AGENTS.md

> **CRITICAL RULE:** Fale SEMPRE em PT-BR.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Git — política de operações

**Duas vias de autorização — commit, push e merge/squash exigem UMA delas:**

1. **Pedido explícito do usuário.** "commita", "faz o push", "pode mergear". Um "vai commitando" vale até o fim da sessão.
2. **Invocação de uma skill que codifica o passo.** Chamar `/sdd-implement` ou `/sdd-finish` **é** a autorização para os passos de git que aquele procedimento descreve — não peça confirmação de novo. O usuário já autorizou ao invocar; represar ali só transforma um fluxo codificado em pergunta redundante.

O que NÃO muda com isso:

- **Validação continua sendo pré-requisito, não formalidade.** Nada é commitado sem tsc + lint + testes verdes (regra de entrega no `AGENTS.md`); nenhuma PR é mergeada sem o loop de escopo Feature verde. A skill autoriza o git, não dispensa o portão.
- **Merge exige o schema JÁ aplicado na produção.** Push em `master` é deploy imediato: mergear com migração aditiva só na staging põe no ar código que lê coluna inexistente. Antes do merge: `assert-db-env.sh production` → `db push` → `migrate diff` vazio. Isso é gate técnico, não de permissão — nenhuma skill o dispensa.
- **Operação de escrita direta no banco de produção segue exigindo pedido explícito** (§8). Skill não cobre isso.
- **Push em `master` = deploy imediato** — agrupe commits pequenos (docs, ajustes) num push só quando possível.
- Mensagens: conventional commits em PT-BR (`fix:`, `feat:`, `docs:`), corpo explicando o porquê.

## 6. Deploy (dois caminhos — não misturar)

| Alvo | Como |
|------|------|
| **App (Vercel)** | Auto-deploy Git **desligado** (`vercel.json`). CI job `Deploy Vercel (pós-CI)`: `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`. |
| **Worker (Render)** | Blueprint `render.yaml`, `rootDir: worker`, `autoDeploy: true`. GitHub App precisa de acesso ao repo (log limpo: `Cloning from…` **sem** “don't have access”). |

- Push que só mexe fora de `worker/` **não** redeploya o worker (`rootDir`).
- Render ≠ Vercel: CI Actions não controla o worker.


## 7. Layout

| Path | Role |
|------|------|
| `src/` | Next.js 16 app (Vercel) — dashboard, APIs, scrape/dispatch/afiliados |
| `worker/` | Baileys long-running (Render) — **package separado** (`npm ci` em `worker/`) |
| `supabase/migrations/` | SQL em ordem; não há seed de auth no repo |
| `tests/` | Vitest na raiz (`vitest run`); importa worker via path relativo |
| `docs/`, `STATE.md` | Specs SDD + invariantes pós-feature |

`tsconfig` da app **exclui** `worker` e `tests` — typecheck do worker: `npm run worker:typecheck`.

## 8. Commands

```bash
npm run dev                 # Next :3000
npm run worker:dev          # Baileys :3100 (precisa worker/.env)
npm run lint
npm run typecheck           # app only
npm run worker:typecheck
npm run test                # todos
npx vitest run tests/foo.test.ts
npm run build
```

Ordem CI: lint → typecheck (app+worker) → test → build smoke → (main) deploy Vercel.

## 9. Auth / env

- Login: Supabase e-mail+senha (`src/app/login`), single-tenant admin.
- App: `.env.local` — ver `.env.example`.
- Worker: `worker/.env` — `WORKER_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, **`WHATSAPP_SESSION_KEY`** (32 bytes base64). Sem a key → multi-file `BAILEYS_AUTH_DIR` (disco efêmero no Render = perde sessão).
- Mesmo `WORKER_API_SECRET` no app e no worker; header `x-worker-secret`.
- Cron: `CRON_SECRET` (Bearer ou `x-cron-secret`).

## 10. Baileys / sessão WA (crítico)

- Persistência: `wa_session_keys` cifrado (`worker/src/baileys/auth-state.ts`).
- Gate de sessão: `creds.account` (não `me`).
- **Nunca** engolir falha de load com `initAuthCreds()` — o `saveCreds` seguinte **sobrescreve** sessão pareada (sintoma: “conta some após deploy”). Throw se REST/decode falhar; só `initAuthCreds` se a linha `creds` não existir.
- Upsert PostgREST: `wa_session_keys?on_conflict=id` + `Prefer: resolution=merge-duplicates`.
- Logout / `loggedOut` → `clearAuth` (DELETE keys).
- Status runtime em memória no worker; UI poll ~4s em `/dashboard/bot`.


### 11. Armadilha CI / login produção

Placeholders `NEXT_PUBLIC_SUPABASE_*=https://ci.supabase.co` **só** nos jobs `quality`/`build`. **Nunca** no job `deploy` nem como `env:` global do workflow — o shell vaza pro `vercel build` e embute `ci.supabase.co` no bundle (login quebra). Há guard `grep` no output antes do deploy.

## 12. Infra CLI (obrigatório)

- **Vercel** / **Neon**: sempre CLI (`vercel`, `neonctl`/`neon`) se resolver; não mandar só painel.
- Auth interativa CLI: expor URL/código e aguardar.
- Render: CLI `render` (services, deploys, logs). Blueprint sync via dashboard se API não criar.

## 13. Domínio (invariantes)

- Disparo: sessão WA `connected` + grupo `active` + `affiliate_links` status `ok`; rate limits em `app_settings`; sem reenvio offer+group no mesmo dia UTC.
- Secrets só server/env — nunca client.
- Detalhe as-built: `STATE.md` + `docs/specs/`.
