---
name: sdd-finish
description: Consolida a Spec Final pós-implementação (as-built), atualiza o estado do projeto (STATE.md) e finaliza com commit convencional, push e squash-merge da PR.
---

# /sdd-finish

Finaliza o ciclo completo do desenvolvimento, registrando a documentação final *as-built*, atualizando o estado do repositório e concluindo o fluxo Git.

## Passos de Execução

0. **Resolução da Feature Ativa (obrigatório, antes de tudo):**
   - Aplique o **Motor de Escopo por Feature** de `skills/sdd/references/workflow-guide.md` (fonte única da verdade) para resolver o `<slug>`. Em caso de ambiguidade, **PARE e pergunte**.

1. **Geração da Spec Final Pós-Implementação (*As-Built*), só da feature ativa:**
   - Consolida e atualiza **apenas** as specs desta feature (`docs/specs/spec-<slug>-fatia-*.md`, mais as legadas atribuídas a ela) refletindo o estado final exato de como a funcionalidade foi construída no código (registrando quaisquer refinamentos de design ou ajustes técnicos feitos durante o dev).
   - Marca o status **dessas** specs como `CONCLUÍDO`. **Nunca** toque em specs de outras features — elas podem estar em implementação ativa numa worktree paralela.

2. **Atualização do Estado do Repositório (append-only):**
   - Atualiza `STATE.md` (se existir) **anexando** o bloco desta feature, conforme o protocolo append-only do Motor de Escopo: garante a seção `## Features Integradas` e acrescenta ao fim dela `### <slug> · <data> · PR #<n>` com invariantes vivos, modelos de banco e decisões arquiteturais introduzidas. **Nunca reescreva blocos de outras features nem o corpo pré-existente do arquivo** — é isso que evita conflito de merge entre fluxos paralelos.
   - Atualiza `BACKLOG.md` / `STATE_ARCHIVE.md` (se existirem) movendo **os itens desta feature** para concluídos.

3. **Commit Final, Push e Squash-Merge da PR:**
   - Prepara e executa o commit final utilizando **Conventional Commits** em PT-BR (ex: `feat(modulo): conclui implementação de...`).
   - Faz o push da branch de feature (`git push origin feat/<slug>`).
   - Marca a Pull Request como pronta (`gh pr ready`) e a integra via **squash-merge** com título em Conventional Commit, removendo a branch: `gh pr merge --squash --delete-branch`.

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

Ao concluir a consolidação e o merge da funcionalidade, o agente **DEVE obrigatoriamente** terminar a resposta exibindo o seguinte aviso em destaque:

> **👉 Próximo Passo Recomendado:**
> A funcionalidade e a documentação *as-built* foram concluídas e integradas com sucesso! Para iniciar o planejamento de um novo produto ou feature:
> `/sdd-plan <nome-da-nova-feature>`
