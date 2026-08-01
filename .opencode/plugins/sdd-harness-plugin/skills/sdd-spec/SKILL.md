---
name: sdd-spec
description: Lê o PRD/MVP da feature ativa e gera as especificações técnicas base de todas as fatias do MVP (docs/specs/spec-<slug>-fatia-NN.md) com mapeamento holístico de banco, APIs, UI e testes.
---

# /sdd-spec [fatia-ou-funcionalidade-opcional]

Mapeia a arquitetura técnica e gera as especificações técnicas base de **todas as fatias** previstas no MVP, fornecendo uma visão arquitetural holística antes de criar qualquer linha de código.

## Passos de Execução

0. **Resolução da Feature Ativa (obrigatório, antes de tudo):**
   - Aplique o **Motor de Escopo por Feature** de `skills/sdd/references/workflow-guide.md` (fonte única da verdade) para resolver o `<slug>`. Se a resolução for ambígua (≥ 2 MVPs e nenhuma branch `feat/*`), **PARE e pergunte** qual feature — não escolha por conta própria.
   - Anuncie o slug resolvido e por qual regra.

1. **Análise de Contexto Arquitetural (escopada ao `<slug>`):**
   - Lê **apenas** `docs/prd/PRD-<slug>.md` e `docs/mvp/MVP-<slug>.md` para identificar o fatiamento completo do escopo e **conta o número `N` de fatias enumeradas no MVP** (`Fatia 01`, `Fatia 02`, …). Nunca varra os diretórios inteiros: eles podem conter features paralelas.
   - Inspeciona a estrutura do repositório (usando `codebase-memory` ou busca textual) para mapear símbolos, funções, modelos de banco (Prisma/ORM), APIs e componentes UI afetados por cada fatia.

2. **Geração das Specs Técnicas Base:**
   - Gera **exatamente uma spec por fatia** (`N` fatias → `N` arquivos `docs/specs/spec-<slug>-fatia-NN.md`) usando o template em `skills/sdd/references/spec-template.md`. O `<slug>` no nome do arquivo é obrigatório — é ele que impede que fluxos paralelos sobrescrevam as specs uns dos outros.
   - Preenche o escopo funcional, arquivos a alterar/criar, contratos de dados, interfaces visuais, critérios de aceite e plano de testes (unitários, integração e e2e se tocar UI).
   - Cada spec nasce com `Status: PENDENTE` (cabeçalho e Checkpoint de Execução) — é `/sdd-implement` que fará a transição `PENDENTE → EM ANDAMENTO → CONCLUÍDO`.
   - **Formato legado:** se já existirem specs sem slug (`docs/specs/spec-fatia-NN.md`) pertencentes a esta feature pela regra de compatibilidade do motor, atualize-as **onde estão** em vez de gerar duplicatas. Só sugira a renomeação (`git mv`) e aguarde a decisão do usuário — nunca renomeie por conta própria.

3. **Verificação de Cobertura (portão fechado, dentro da feature):**
   - Confirma que o número de specs **desta feature** (`docs/specs/spec-<slug>-fatia-*.md`, mais as legadas atribuídas a ela) é **igual a `N`**. Specs de outras features **não entram na contagem**.
   - Exibe um mapa `Fatia → spec` e sinaliza explicitamente qualquer fatia do MVP que tenha ficado **sem spec**. Não conclua o comando com cobertura incompleta.

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

Ao finalizar a geração das specs técnicas de todas as fatias, o agente **DEVE obrigatoriamente** terminar a resposta exibindo o seguinte aviso em destaque:

> **👉 Próximo Passo Recomendado:**
> As especificações de todas as fatias estão mapeadas! Execute o comando para criar a branch da feature, abrir a PR e iniciar a implementação sequencial de ponta a ponta:
> `/sdd-implement`
