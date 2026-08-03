---
name: sdd-implement
description: Implementa UMA fatia por execução (a primeira pendente) de ponta a ponta (Backend + UI + Testes), roda o loop de validação com auto-cura antes de commitar na PR Draft, e reconvida a próxima fatia até a última.
---

# /sdd-implement

Gerencia o ciclo de governança de versão e executa o desenvolvimento em código com base estrita nas especificações técnicas em `docs/specs/`. Opera como uma **máquina de estados de uma fatia por execução**: cada chamada implementa a próxima fatia pendente, **valida com o loop de auto-cura**, commita e reconvida `/sdd-implement` até que todas estejam concluídas.

**Nenhuma fatia é commitada sem passar pelo loop de validação** (passo 4) — o commit é o portão, não o fim da linha.

## Passos de Execução

0. **Resolução da Feature Ativa (obrigatório, antes de tudo):**
   - Aplique o **Motor de Escopo por Feature** de `skills/sdd/references/workflow-guide.md` (fonte única da verdade) para resolver o `<slug>`. Em caso de ambiguidade, **PARE e pergunte**.
   - Todo o resto desta execução opera **exclusivamente** sobre os artefatos desse slug.

1. **Governança de Versão (idempotente — configura uma vez, reusa depois):**
   - **Branch:** Se o repositório não estiver na branch exclusiva da feature (`feat/<slug>`, derivada do slug canônico), cria e alterna. Se já estiver, reusa (nunca recria).
   - **Commit dos docs:** Se os documentos de planejamento da feature ainda não foram commitados, commita-os agora **listando os arquivos nominalmente** (`docs/prd/PRD-<slug>.md`, `docs/mvp/MVP-<slug>.md`, `docs/specs/spec-<slug>-fatia-*.md`). **Nunca use `git add docs/`** — isso arrastaria para a PR os artefatos de features paralelas em andamento.
   - **Merge driver do `STATE.md`:** Garante a linha `STATE.md merge=union` no `.gitattributes` do projeto (cria o arquivo se não existir, não duplica se já estiver lá). É o que faz o Git concatenar automaticamente os registros de features paralelas em vez de reportar conflito.
   - **PR Draft:** Se ainda não há PR aberta para a branch, abre uma **Pull Request Draft** (`gh pr create --draft`) com descrição clara do escopo e um **checklist das N fatias**. Se já existir, apenas identifica e reusa. **Nunca abre uma segunda PR.**

2. **Seleção da Fatia Atual (estado explícito, dentro da feature):**
   - Lê **apenas** as specs desta feature (`docs/specs/spec-<slug>-fatia-*.md`, mais as legadas atribuídas a ela pela regra de compatibilidade do motor), conta o total `N` de fatias e seleciona a **primeira fatia** cujo `Status` seja diferente de `CONCLUÍDO` (i.e. `PENDENTE` ou `EM ANDAMENTO`). Essa é a **fatia da vez**.
   - Specs de outras features **nunca** entram nesta seleção nem na contagem de `N`.
   - Se **nenhuma** fatia estiver pendente (todas `CONCLUÍDO`), pule direto para a Regra de Saída (caminho "todas concluídas").
   - Marca a fatia selecionada como `EM ANDAMENTO` no cabeçalho e na seção "Checkpoint de Execução" da sua spec.

3. **Desenvolvimento Ponta a Ponta & Código Enxuto (Escada Ponytail) — apenas da fatia atual:**
   - Antes de criar novos componentes, funções ou abstrações, aplique a **Escada Ponytail**:
     - *YAGNI:* Não adicione recursos especulativos nem abstrações preparadas para o futuro incerto.
     - *Reuso:* Reutilize utilitários, helpers, componentes de UI e esquemas já existentes no codebase.
     - *Nativo/Stdlib:* Prefira APIs nativas e bibliotecas já instaladas antes de adicionar novas dependências.
     - *Causa Raiz:* Em correções de bugs, corrija a causa raiz na função compartilhada em vez de criar retalhos nos chamadores.
   - Desenvolva **somente a fatia da vez**, de ponta a ponta:
     - **Backend / Dados:** Atualiza/cria esquemas de banco, migrações/types, rotas, server actions e regras de negócio.
     - **Frontend / UI:** Constrói/atualiza os componentes visuais, conecta diretamente com o backend e garante UX fluida.
     - **Testes:** Escreve os testes unitários, de integração e cenários E2E descritos na spec.
   - **Regra de Ouro E2E:** NADA deve ser entregue sem começo, meio e fim. NUNCA faça entregas parciais (ex: backend sem UI, ou código sem suíte de testes correspondente).

4. **Loop de Validação da Fatia (portão de commit):**
   - Executa o **Loop de Validação Adaptativo** de `skills/sdd/references/loop-guide.md` (fonte única da rotina) no **escopo Fatia**: triage de risco, bateria sobre o diff não commitado, auto-cura com orçamento de voltas e review Ponytail com revalidação.
   - **Portão fechado:** a fatia só avança para o passo 5 com o loop **verde**. Se o loop parar vermelho, a fatia **permanece `EM ANDAMENTO`**, nada é commitado, e a execução termina com o relatório de parada do loop — não passe para a próxima fatia e não convide `/sdd-implement`.

5. **Checkpoint & Commit da Fatia (write-back de estado):**
   - Atualiza o `Status` da fatia para `CONCLUÍDO` no cabeçalho e na seção "Checkpoint de Execução" da sua spec.
   - Executa o commit da fatia usando **Conventional Commits** em PT-BR (ex: `feat(<modulo>): implementa fatia <XX> - <nome-da-fatia>`) e faz o push na branch da PR (`git push origin feat/<slug>`).

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

O callout de saída é **condicional**, calculado a partir do resultado do loop e da contagem de fatias pendentes após o commit desta execução:

- **Se o loop de validação parou vermelho** (passo 4), o agente **DEVE** exibir o relatório de parada do loop e terminar com:

  > **🛑 Fatia X de N bloqueada na validação.**
  > A fatia continua `EM ANDAMENTO` e **não foi commitada** — o orçamento de auto-cura se esgotou com a bateria vermelha. Revise o diagnóstico acima e decida: corrigir manualmente, ajustar a spec da fatia ou reexecutar com mais voltas.
  > `/sdd-implement` (após resolver o bloqueio)

- **Se ainda restam fatias pendentes**, o agente **DEVE** terminar exibindo:

  > **👉 Próximo Passo Recomendado:**
  > Fatia **X de N** concluída, **validada** e commitada na PR! Restam **Y** fatia(s). Execute novamente para implementar a próxima fatia de ponta a ponta:
  > `/sdd-implement`

- **Se esta era a última fatia (todas `CONCLUÍDO`)**, o agente **DEVE** terminar exibindo:

  > **👉 Próximo Passo Recomendado:**
  > Todas as **N** fatias foram implementadas, validadas individualmente e commitadas na PR! Execute a validação de integração da feature completa (regressão entre fatias + E2E):
  > `/sdd-validate`
