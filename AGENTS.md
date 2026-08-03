<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

@STATE.md

> **CRITICAL RULE:** Fale SEMPRE em PT-BR.

Este arquivo carrega o **conhecimento deste projeto** (§5–13). O *como trabalhar* genérico vive nas skills — invoque-as em vez de improvisar.

## 0. Roteamento de skills

Fluxo de feature completo: `/sdd-plan` → `/sdd-spec` → `/sdd-implement` → `/sdd-validate` → `/sdd-finish`. As skills SDD ditam os próprios passos; a tabela abaixo vale **fora** delas.

| Situação | Skill |
|---|---|
| Feature/componente/comportamento novo, antes de qualquer código | `superpowers:brainstorming` |
| Bug, teste falhando, comportamento inesperado — antes de propor a correção | `superpowers:systematic-debugging` |
| Implementar feature ou bugfix — antes do código de implementação | `superpowers:test-driven-development` |
| Antes de declarar pronto/corrigido/passando, ou de commitar | `superpowers:verification-before-completion` |
| Escrever, refatorar ou revisar código (escolha da solução) | `ponytail` (ativo por hook) |
| Plano escrito de múltiplos passos, fora do SDD | `superpowers:writing-plans` |
| Revisar diff / receber review | `superpowers:requesting-code-review` / `receiving-code-review` |

Regra de precedência: **process skill primeiro**, skill de implementação depois. Se há 1% de chance de uma skill se aplicar, invoque — descartar depois é barato.

> §1–4 (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) foram removidas — viraram `superpowers:brainstorming`, `ponytail` e `superpowers:test-driven-development` na tabela do §0. A numeração de §5 em diante é preservada porque specs, PRDs e `STATE.md` referenciam essas seções por número.

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
- **Novos módulos/stores com DB**: Todo código server-side que instancia `createClient` com Supabase deve ignorar tentativas de rede (retornar `null` ou fallback in-memory) se a URL contiver `ci.supabase.co` ou se `SCRAPE_MOCK=1`, impedindo timeouts de 5s nos testes do CI.

## 12. Infra CLI (obrigatório)

- **Vercel** / **Neon**: sempre CLI (`vercel`, `neonctl`/`neon`) se resolver; não mandar só painel.
- Auth interativa CLI: expor URL/código e aguardar.
- Render: CLI `render` (services, deploys, logs). Blueprint sync via dashboard se API não criar.

## 13. Domínio (invariantes)

- Disparo: sessão WA `connected` + grupo `active` + `affiliate_links` status `ok`; rate limits em `app_settings`; sem reenvio offer+group no mesmo dia UTC.
- Secrets só server/env — nunca client.
- Detalhe as-built: `STATE.md` + `docs/specs/`.

## 14. Perguntas defensivas específicas deste projeto

O procedimento genérico de "não declare pronto sem evidência" é `superpowers:verification-before-completion` — invoque. O que a skill não sabe, e você tem que perguntar aqui:

1. **Envs opcionais ausentes em produção** (`*_LOGIN`, `*_PASS`, `FIRECRAWL_SHOPEE_PROFILE`): o código degrada graciosamente (modo público sem cookies) ou lança exceção fatal que derruba o fluxo? Exceção fatal é bug.
2. **Rede e banco no CI** (ver §11): todo módulo novo com `createClient`/`fetch` trata `ci.supabase.co` e `SCRAPE_MOCK=1` em **todas** as camadas? Sem isso são 5s de timeout por teste.
3. **Falha silenciosa na UI**: quando a função server falha, o seletor/store propaga o motivo legível, ou a badge trava em `UNKNOWN`/`ERROR` com estado velho?
