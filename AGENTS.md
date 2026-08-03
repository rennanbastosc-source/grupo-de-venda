<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

@STATE.md

> **CRITICAL RULE:** Fale SEMPRE em PT-BR.

Este arquivo carrega o **conhecimento deste projeto** (§5–13). O *como trabalhar* genérico vive nas skills do **host ativo** — invoque-as em vez de improvisar. **Nunca misture harness de processo entre hosts.**

## 0. Host × harness (segregação obrigatória)

Dois runtimes, **dois** conjuntos de plugins. Mesmo repo, configs e roteamento diferentes.

| Host | Harness de processo | Onde se configura | Proibido |
|---|---|---|---|
| **OpenCode** | **oh-my-opencode-slim (OMO slim)** + `ponytail` + skills **SDD** do repo | `~/.config/opencode/opencode.jsonc` (`plugin`) · `opencode.json` do repo (`skills.paths` → sdd-harness) | Plugin / skill `superpowers` · invocar `superpowers:*` |
| **Claude Code** | **superpowers** + `ponytail` (hooks user) | `.claude/settings.json` (`superpowers@claude-plugins-official`) · `~/.claude/settings.json` (ponytail hooks) | Tratar OMO slim / agents `explorer|fixer|oracle` do OpenCode como se fossem skills Claude |

**Compartilhado (os dois hosts):** conhecimento de domínio deste arquivo (§5–14), `STATE.md`, SDD (`/sdd-*` quando o host expõe), `ponytail` como disciplina de solução mínima.

**Não compartilhado:** superpowers só no Claude; orquestração multi-agent OMO slim só no OpenCode.

### 0.1 Detecção de host (faça no início da sessão de trabalho)

1. Se o runtime é OpenCode (TUI/CLI opencode, agents OMO, tool `task` com `explorer`/`fixer`/…): host = **opencode**.
2. Se o runtime é Claude Code (plugin marketplace, skills `superpowers:*`): host = **claude**.
3. Na dúvida: rode `bash scripts/assert-agent-host.sh` (opcional: `OPENCODE=1` ou `CLAUDECODE=1` se a detecção automática falhar).

### 0.2 Hook de validação (obrigatório antes de invocar process-skill)

Antes da **primeira** invocação de skill de processo na sessão (ou após `/clear`):

```bash
bash scripts/assert-agent-host.sh
```

| Resultado | Ação |
|---|---|
| `result=OK` + `host_detect=opencode` | Use **só** a tabela §0.3 (OpenCode). Não chame `superpowers:*`. |
| `result=OK` + `host_detect=claude` | Use **só** a tabela §0.4 (Claude). Não carregue OMO slim. |
| `result=FAIL` | **Pare.** Corrija config (plugin errado no host) antes de implementar. Não “continue com o que der”. |

Se o script não estiver disponível no sandbox, aplique a regra mental: **nome do host na UI** + **lista de skills que a tool `skill` realmente expõe**. Skill listada no `AGENTS.md` mas **ausente** na tool = não invocar; usar a coluna do host ativo.

### 0.3 OpenCode — roteamento (OMO slim + SDD)

Fluxo de feature: `/sdd-plan` → `/sdd-spec` → `/sdd-implement` → `/sdd-validate` → `/sdd-finish` (plugin sdd-harness). Fora do SDD:

| Situação | O que usar no OpenCode |
|---|---|
| Feature/comportamento novo, antes de código | `/sdd-plan` se for fatia de produto; senão entrevista curta + plano (sem `superpowers:brainstorming`) |
| Bug / comportamento inesperado | Diagnóstico sistemático no thread (ou agent `oracle` se risco alto); **não** `superpowers:systematic-debugging` |
| Implementar feature ou bugfix | TDD como **disciplina** (teste que falha → código); agents `fixer` / `designer` para execução; **não** skill `superpowers:test-driven-development` |
| Antes de pronto / commit | `/sdd-validate` ou `npm run lint` + typecheck + testes do escopo; **não** `superpowers:verification-before-completion` |
| Escolher solução / enxugar | `ponytail` (plugin ativo) |
| Plano multi-passo fora do SDD | Plano curto no thread ou skill de plano **se existir no host**; senão bullets no thread |
| Review de diff | `ponytail-review` / agent `oracle` se alto risco |
| Recon de codebase | agent `explorer` (OMO) |
| Docs / libs externas | agent `librarian` (OMO) |

Config canônica OpenCode (não adicionar superpowers):

- User: `plugin: ["@dietrichgebert/ponytail", "oh-my-opencode-slim"]`
- Repo: `skills.paths: [".opencode/plugins/sdd-harness-plugin"]`

### 0.4 Claude Code — roteamento (superpowers)

Fluxo SDD igual quando as skills SDD estiverem no Claude; fora dele:

| Situação | Skill |
|---|---|
| Feature/componente/comportamento novo, antes de qualquer código | `superpowers:brainstorming` |
| Bug, teste falhando, comportamento inesperado — antes de propor a correção | `superpowers:systematic-debugging` |
| Implementar feature ou bugfix — antes do código de implementação | `superpowers:test-driven-development` |
| Antes de declarar pronto/corrigido/passando, ou de commitar | `superpowers:verification-before-completion` |
| Escrever, refatorar ou revisar código (escolha da solução) | `ponytail` (hook user) |
| Plano escrito de múltiplos passos, fora do SDD | `superpowers:writing-plans` |
| Revisar diff / receber review | `superpowers:requesting-code-review` / `receiving-code-review` |

Config canônica Claude (projeto): `.claude/settings.json` → `"superpowers@claude-plugins-official": true`.  
**Não** habilitar oh-my-opencode-slim no Claude.

### 0.5 Anti-padrões (violação = corrigir config, não contornar)

| Anti-padrão | Por quê |
|---|---|
| No OpenCode: `skill("superpowers:…")` ou copiar path do cache Claude pra “forçar” | Harness errado; tool nem registra; conflito com OMO |
| No Claude: orquestrar como se houvesse agents OMO `explorer`/`fixer` nativos do slim | Modelo mental do host errado |
| Colocar `superpowers` em `~/.config/opencode/opencode.jsonc` `plugin` | Quebra segregação; assert deve falhar |
| Um único §0 que só lista superpowers (histórico) | Agente OpenCode tenta invocar skill inexistente |

Regra de precedência **dentro do host ativo:** process skill / SDD primeiro, implementação depois. Se há 1% de chance de uma skill do **host** se aplicar, invoque — descartar depois é barato. Skill do **outro** host: ignore.

> §1–4 genéricos antigos viraram: no Claude → superpowers + ponytail; no OpenCode → SDD + OMO + ponytail. Numeração §5+ preservada (specs/STATE).

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

O procedimento genérico de "não declare pronto sem evidência": no **Claude** invoque `superpowers:verification-before-completion`; no **OpenCode** use `/sdd-validate` ou o loop lint+typecheck+testes do escopo (`AGENTS.md` §0.3). O que o harness não sabe, e você tem que perguntar aqui:

1. **Envs opcionais ausentes em produção** (`*_LOGIN`, `*_PASS`, `FIRECRAWL_SHOPEE_PROFILE`): o código degrada graciosamente (modo público sem cookies) ou lança exceção fatal que derruba o fluxo? Exceção fatal é bug.
2. **Rede e banco no CI** (ver §11): todo módulo novo com `createClient`/`fetch` trata `ci.supabase.co` e `SCRAPE_MOCK=1` em **todas** as camadas? Sem isso são 5s de timeout por teste.
3. **Falha silenciosa na UI**: quando a função server falha, o seletor/store propaga o motivo legível, ou a badge trava em `UNKNOWN`/`ERROR` com estado velho?
