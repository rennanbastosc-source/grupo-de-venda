---
name: sdd
description: Guardião de sessão e máquina de checkpoints do fluxo SDD, ciente de múltiplas worktrees. Após um /clear (ou contexto perdido), enumera as worktrees, reconstrói onde cada programa parou lendo docs/, specs e Git, e resume as sessões apontando qual comando rodar em qual pasta. Também serve de índice master da suíte.
---

# /sdd — Guardião de Sessão & Máquina de Checkpoints (Multi-Worktree)

O `/sdd` reconstrói o estado do fluxo **Spec-Driven Development** a partir dos artefatos em disco e do Git, permitindo **retomar exatamente de onde cada sessão parou** — típico após um `/clear` com o contexto apodrecido. Como o desenvolvimento pode acontecer em **várias git worktrees em paralelo** (uma feature por worktree), o `/sdd` trata **cada worktree como uma sessão independente** e resume a frota inteira.

É read-only: **detecta, reporta e recomenda** o próximo comando e o **local correto** (pasta da worktree) para executá-lo; nunca executa a próxima etapa nem troca de pasta sem sua confirmação.

---

## 🧭 Passos de Execução (Reconstrução de Checkpoints)

1. **Enumerar as worktrees (a frota):**
   - Roda `git worktree list --porcelain` para obter todas as worktrees: `path`, `branch` e `HEAD` de cada uma. A checkout principal também é uma worktree.
   - Se o diretório não for um repositório Git, trate como **worktree única** (o próprio `cwd`).

2. **Enumerar as SESSÕES de cada worktree (read-only, escopado ao `path` dela):**

   Uma worktree pode conter **mais de uma feature** em `docs/` (o caso normal depois de um merge: a branch base acumula os artefatos de todas as features já integradas). Cada feature é uma **sessão própria**, mesmo quando duas compartilham o mesmo path.

   - **Descobrir as features:** liste um `<slug>` por `docs/mvp/MVP-<slug>.md` encontrado. Se a branch for `feat/<slug>`, essa é a **sessão em foco** da worktree (as demais são sessões dormentes ali). Nunca use heurística de "a mais recente" — ver o **Motor de Escopo por Feature** em [references/workflow-guide.md](references/workflow-guide.md), a fonte única da verdade.
   - Para **cada** sessão, escopado ao seu `<slug>`:
     - **Planejamento:** existem `docs/prd/PRD-<slug>.md` e `docs/mvp/MVP-<slug>.md`?
     - **Escopo:** conta `N` = fatias enumeradas em `docs/mvp/MVP-<slug>.md` (`Fatia 01`, `Fatia 02`, …).
     - **Specs:** conta `docs/specs/spec-<slug>-fatia-*.md` e lê o `Status` de cada uma (`PENDENTE` / `EM ANDAMENTO` / `CONCLUÍDO`). Nunca varra `docs/specs/spec-*.md` sem o slug — isso mistura fluxos paralelos e corrompe a contagem `X de N`.
     - **Legado:** specs sem slug (`docs/specs/spec-fatia-NN.md`) contam para esta sessão **só** se ela for a única feature da worktree e não houver specs do formato novo para ela; com ≥ 2 features, reporte-as como órfãs.
     - **Git/PR:** há uma PR (Draft) para `feat/<slug>` (`gh pr list --head feat/<slug>`)? Quantos commits de fatia?
     - **Estado:** `STATE.md` (se existir) tem o bloco `### <slug>` na seção `## Features Integradas`?
   - Uma worktree **sem nenhum artefato SDD** é marcada como "sem sessão SDD" (não é uma sessão retomável).

3. **Derivar a fase de cada sessão** — avalie da linha **mais avançada** para a mais inicial e pare na primeira verdadeira. Todas as comparações são **dentro da feature**:

   | Estado detectado | Fase | Próximo comando |
   |---|---|---|
   | Nenhum `MVP-*.md` na worktree | **Zero** | `/sdd-plan <feature>` |
   | PRD/MVP da feature existem, sem specs dela | **Planejado** | `/sdd-spec` |
   | nº de specs da feature ≠ `N` fatias do MVP dela | **Specs incompletas** | `/sdd-spec` (fechar cobertura) |
   | specs da feature existem, nem todas `CONCLUÍDO` | **Implementando (X de N)** | `/sdd-implement` |
   | todas `CONCLUÍDO`, ainda em `feat/<slug>` | **Implementado** | `/sdd-validate` (e depois `/sdd-finish`) |
   | branch mergeada / bloco `### <slug>` no `STATE.md` | **Concluído** | `/sdd-plan <nova-feature>` |

4. **Consolidar e emitir:**
   - **Se houver ≥ 2 sessões SDD** (em worktrees diferentes **ou** duas features na mesma worktree): emita o **Painel de Frota** (formato abaixo), ordenado da sessão mais avançada para a mais inicial, e peça ao usuário para escolher qual retomar.
   - **Se houver apenas 1 sessão SDD:** emita o **Checkpoint Detalhado** dessa sessão.
   - Sempre destaque o **local correto** (path) de cada sessão: os subcomandos precisam ser executados na worktree correspondente. Quando duas sessões dividem o mesmo path, repita o path e marque qual está em foco pela branch — o usuário precisa saber que ali o `<slug>` é o que desambigua, não a pasta.

5. **Callout obrigatório** do próximo passo. Ofereça-se para executar o comando recomendado da sessão escolhida, mas **aguarde a confirmação do usuário** (e confirme que ele está na pasta certa) antes de rodá-lo.

---

## 🗂️ Formato do Painel de Frota (≥ 2 sessões)

```text
🗂️  SDD FLEET — 3 sessões ativas

[1] auth              /home/user/proj              main worktree   (em foco)
     Fase: Implementando   ·   2/4 fatias   ·   PR #12 Draft
     👉 na pasta /home/user/proj → /sdd-implement   (Fatia 3 de 4)

[2] billing           /home/user/proj-billing      feat/billing
     Fase: Specs incompletas   ·   3/5 specs
     👉 na pasta /home/user/proj-billing → /sdd-spec

[3] reports           /home/user/proj              main worktree   (dormente)
     Fase: Implementado   ·   4/4 fatias   ·   aguardando validação
     👉 na pasta /home/user/proj → /sdd-validate   (feature reports)

(+1 worktree sem sessão SDD)

Escolha a sessão [1–3] para ver o checkpoint detalhado ou retomar.
```

Note as sessões `[1]` e `[3]`: mesmo path, features diferentes. A pasta não desambigua — o `<slug>` sim.

## 📋 Formato do Checkpoint Detalhado (1 sessão)

```text
🧭 SDD CHECKPOINT: <slug>   (worktree: /home/user/proj)
├─ Fase:      <fase>   (branch: <branch> | PR: #<n> Draft)
├─ Progresso: <X> de <N> fatias concluídas
├─ Pendentes: spec-<slug>-fatia-03 (EM ANDAMENTO), spec-<slug>-fatia-04 (PENDENTE)
└─ 👉 Próximo: /sdd-implement   (retomar na Fatia 3 de 4)
```

Se **nenhuma** worktree tiver fluxo SDD, o relatório informa que não há sessão ativa e sugere `/sdd-plan <feature>`.

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

Após o painel/checkpoint, o agente **DEVE** terminar exibindo o próximo passo em destaque, incluindo **a pasta** quando houver múltiplas sessões:

> **👉 Próximo Passo Recomendado:**
> <mensagem contextual da sessão> — execute na pasta `<path-da-worktree>`:
> `<comando derivado>`

---

## 🚀 Índice da Suíte (referência)

O fluxo completo, na ordem `PRD → MVP → Spec → Implement → Validate → Finish | Audit`:

* **`/sdd-plan <nome-feature>`** — Entrevista de produto (com gate de espera) e criação do PRD (`docs/prd/`) e MVP fatiado (`docs/mvp/`).
* **`/sdd-spec`** — Mapeamento holístico de arquitetura e geração das specs base de **todas as fatias** (`docs/specs/spec-<slug>-fatia-NN.md`), com verificação de cobertura `N specs == N fatias` **dentro da feature**.
* **`/sdd-implement`** — Governança na 1ª execução (branch `feat/...`, commit dos docs, PR Draft) e implementação **fatia a fatia** de ponta a ponta (Backend + UI + Testes), com o **loop de validação no escopo Fatia como portão de commit**. Repita até a última fatia.
* **`/sdd-validate`** — O mesmo loop no **escopo Feature**: branch inteira, suíte completa e E2E obrigatório, para pegar regressão entre fatias antes do merge.
* **`/sdd-finish`** — Geração da Spec Final pós-implementação (*as-built*), registro append-only no `STATE.md`, commit final, push e **squash-merge** da PR.
* **`/sdd-audit`** — Auditoria holística do repositório (Lean code, consistência SDD/STATE.md e gaps de testes).

---

## 📁 Estrutura de Artefatos Gerados no Projeto Local

```text
<raiz-do-projeto>/
└── docs/
    ├── prd/
    │   ├── PRD-auth.md
    │   └── PRD-billing.md
    ├── mvp/
    │   ├── MVP-auth.md
    │   └── MVP-billing.md
    └── specs/
        ├── spec-auth-fatia-01.md
        ├── spec-auth-fatia-02.md
        ├── spec-billing-fatia-01.md
        └── spec-billing-fatia-02.md
```

O `<slug>` no nome de **todo** artefato é o que permite fluxos SDD paralelos (worktrees simultâneas) sem sobrescrita e sem conflito de merge em `docs/`. A regra de derivação está no [Motor de Escopo por Feature](references/workflow-guide.md).

---

## 📚 Referências Globais
- [Motor de Escopo por Feature](references/workflow-guide.md) — slug canônico, resolução da feature ativa e `STATE.md` append-only
- [Guia do Loop de Validação](references/loop-guide.md) — rotina única de auto-cura e review, nos escopos Fatia e Feature
- [Template de PRD](references/prd-template.md)
- [Template de MVP](references/mvp-template.md)
- [Template de Spec](references/spec-template.md)
- [Guia do Workflow](references/workflow-guide.md)
- [Guia Ponytail de Código Enxuto](references/ponytail-guide.md)
