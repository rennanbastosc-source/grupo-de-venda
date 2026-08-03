# Guia de Condução do Workflow SDD

Este guia orienta o agente durante as 5 etapas do **Spec-Driven Development (SDD)**.

---

## 🎯 Regras de Ouro do SDD

1. **Nunca programe sem Spec:** Antes de alterar qualquer linha de código, crie as specs técnicas base de todas as fatias da funcionalidade.
2. **Governança de Versão:** Toda implementação inicia criando uma branch exclusiva (`feat/<slug>`), commitando a documentação **da feature** e abrindo uma PR Draft comentada e identificada. Cada fatia gera um commit próprio dentro da PR, e o encerramento no `/sdd-finish` integra tudo via **squash-merge**.
3. **Código Enxuto (Escada Ponytail):** Evite sobre-engenharia. Reutilize helpers, componentes e a stdlib/plataforma nativa antes de inventar novas abstrações. Mantenha o menor diff funcional possível.
4. **Entregas Ponta a Ponta:** Toda fatia deve ser entregue completa (Backend + Frontend/UI + Testes). NUNCA entregue códigos parciais ou sem testes (nada deve ser entregue sem começo, meio e fim).
5. **Loop Engineering Adaptativo:** Validação dinâmica por complexidade, com auto-cura baseada em logs e review Ponytail anti-overengineering. A rotina é **uma só** ([loop-guide.md](loop-guide.md)) e roda em **dois escopos**: por fatia em `/sdd-implement`, como portão de commit, e por feature em `/sdd-validate`, como portão de merge. Nenhuma fatia é commitada vermelha; nenhuma PR é integrada vermelha.
6. **Spec Final As-Built:** O encerramento no `/sdd-finish` gera a documentação final pós-implementação consolidando o estado real do código antes do merge.
7. **Chamada de Próximo Comando OBRIGATÓRIA (UX):** Todo final de execução de qualquer subcomando (`/sdd-*`) **DEVE** incluir um bloco em destaque com a indicação explícita do próximo comando slash a ser executado pelo usuário.
8. **Um Fluxo, Um Escopo:** Nenhuma skill lê ou escreve artefato fora da **feature ativa**. Vários fluxos SDD podem coexistir no mesmo repositório (worktrees paralelas, branches simultâneas) sem que um sobrescreva o outro — a garantia está no **Motor de Escopo por Feature** abaixo.

---

## 🔑 Motor de Escopo por Feature (fonte única da verdade)

Todo subcomando `/sdd-*` **DEVE** resolver a feature ativa por este motor **antes** de tocar em qualquer arquivo de `docs/`. É ele que impede que dois fluxos paralelos colidam.

### 1. Slug canônico

O nome da feature é sempre normalizado para um **slug** antes de virar caminho de arquivo ou branch:

1. minúsculas
2. remove acentos (normalização NFD, descarta os diacríticos)
3. todo caractere fora de `[a-z0-9]` vira `-`
4. colapsa hífens repetidos e apara os das pontas

Exemplos: `"Autenticação Social"` → `autenticacao-social` · `"Integração Supabase"` → `integracao-supabase`.

O **mesmo slug** é o token de identidade em todos os artefatos da feature:

| Artefato | Caminho |
|---|---|
| PRD | `docs/prd/PRD-<slug>.md` |
| MVP | `docs/mvp/MVP-<slug>.md` |
| Specs | `docs/specs/spec-<slug>-fatia-NN.md` |
| Branch | `feat/<slug>` |
| Estado | bloco `### <slug>` em `STATE.md` |

### 2. Resolução da feature ativa (a primeira regra que resolve vence)

1. **Argumento explícito** do comando (ex: `/sdd-plan Autenticação Social`) → normalizado pela regra 1.
2. **Branch atual** casa `feat/<slug>` → esse slug.
3. Existe **exatamente um** `docs/mvp/MVP-*.md` na worktree → o slug dele.
4. **Ambíguo** (≥ 2 MVPs e nenhuma branch `feat/*`) → **PARE e pergunte ao usuário qual feature.** Nunca adivinhe, nunca use heurística de "a mais recente".

Sempre **exiba o slug resolvido e por qual regra** antes de prosseguir.

### 3. Escopo de leitura e escrita

Toda skill opera **exclusivamente** sobre os caminhos da feature resolvida.

- ❌ **Proibido** ler ou varrer `docs/specs/spec-*.md`, `docs/prd/` ou `docs/mvp/` sem o slug — esse glob enxerga specs de features alheias e é a origem de todo cruzamento de fluxos.
- ❌ **Proibido** `git add docs/`. Commits de documentação listam os arquivos da feature **nominalmente**.
- ✅ Contagens, checkpoints e portões de cobertura (`N specs == N fatias`) são calculados **dentro** da feature ativa.

### 4. Compatibilidade com o formato legado

Specs antigas `docs/specs/spec-fatia-NN.md` (sem slug) pertencem à feature ativa **somente se** as duas condições valerem:

- a feature foi resolvida sem ambiguidade pelas regras 1–3, **e**
- não existe nenhuma spec do formato novo (`spec-<slug>-fatia-*.md`) para essa feature.

Com ≥ 2 MVPs no repositório, specs legadas são **reportadas como órfãs** e nunca atribuídas a ninguém. **Nunca renomeie automaticamente** — se o usuário quiser migrar, sugira o `git mv` e aguarde a decisão dele.

### 5. `STATE.md` é append-only

`STATE.md` é global do repositório e escrito a partir de worktrees diferentes. Para não gerar conflito de merge, `/sdd-finish` **anexa**, nunca reescreve:

1. Garante a existência da seção `## Features Integradas` (cria no fim do arquivo se faltar).
2. **Anexa ao fim dessa seção** o bloco da feature:

```markdown
### <slug>  ·  <YYYY-MM-DD>  ·  PR #<n>
- Invariantes: [regras permanentes introduzidas]
- Modelos: [modelos de banco / entidades criadas]
- Decisões: [decisões arquiteturais relevantes]

```

3. O bloco **termina com uma linha em branco** — é o que mantém os blocos separados quando dois merges concatenam.
4. **Nunca** edita, reordena ou remove blocos de outras features. Nunca reescreve o corpo pré-existente do arquivo.

**Auto-resolução de merge (`.gitattributes`):** append-only torna o conflito trivial, mas o Git ainda o reporta quando duas branches anexam no mesmo ponto. A linha abaixo no `.gitattributes` do projeto elimina a intervenção manual — o driver `union` é nativo do Git e concatena os dois lados, preservando os blocos das duas features:

```gitattributes
STATE.md merge=union
```

`/sdd-implement` garante essa linha na governança de versão (idempotente).

---

## 🔄 Encadeamento de Comandos (Next Step Matrix)

| Slash Command | Saída Esperada | **Chamada Obrigatória no Final** |
|---|---|---|
| `/sdd` | **Guardião de sessão (multi-worktree):** enumera as worktrees e reconstrói o checkpoint de cada sessão (fase + progresso X/N) a partir de `docs/` e Git; resume a frota apontando o comando e a pasta corretos; ideal após `/clear` | `👉 <próximo comando + pasta, derivados do estado detectado>` |
| `/sdd-plan <feature>` | `PRD` + `MVP` (N fatias) gerados e lapidados em `docs/` | `👉 Próximo Passo Recomendado: /sdd-spec` |
| `/sdd-spec` | Specs Técnicas base de **todas as fatias** em `docs/specs/` | `👉 Próximo Passo Recomendado: /sdd-implement` |
| `/sdd-implement` | **Uma fatia** implementada (Backend + UI + Testes), **validada pelo loop no escopo Fatia** e commitada na PR Draft; governança criada na 1ª execução | `👉 /sdd-implement` (se restam fatias pendentes) **\|** `👉 /sdd-validate` (após a última fatia) **\|** `🛑 parada` (loop vermelho: fatia segue `EM ANDAMENTO`, sem commit) |
| `/sdd-validate` | Loop no **escopo Feature**: branch inteira, suíte completa, E2E obrigatório e Ponytail Review 100% verde — pega regressão entre fatias | `👉 Próximo Passo Recomendado: /sdd-finish` **\|** `🛑 parada` (loop vermelho: PR continua Draft) |
| `/sdd-finish` | Spec Final *as-built*, `STATE.md` atualizado, commit final, push e **squash-merge** | `👉 Próximo Passo Recomendado: /sdd-plan <nova-feature>` |
| `/sdd-audit` | Relatório executivo de dívida técnica, código enxuto, consistência SDD e gaps de testes | `👉 Próximo Passo Recomendado: /sdd-implement` ou `/sdd-spec` |
