---
name: sdd-validate
description: Portão de integração da feature — roda o loop de validação adaptativo (auto-cura + review Ponytail) sobre a branch inteira, detectando a stack do repositório (tsc, lint, vitest/pytest, e2e/playwright).
---

# /sdd-validate

Portão de qualidade **da feature completa**, executado depois que todas as fatias já passaram pelo loop individualmente em `/sdd-implement`.

O que este comando pega e a validação por fatia não pega: **regressão de uma fatia sobre outra**. Cada fatia foi validada contra o próprio diff; só aqui a branch inteira é exercitada junta, com a suíte completa e o E2E.

## Passos de Execução

0. **Resolução da Feature Ativa:**
   - Aplique o **Motor de Escopo por Feature** de `skills/sdd/references/workflow-guide.md` para resolver o `<slug>` e confirmar que está na branch `feat/<slug>`. Em caso de ambiguidade, **PARE e pergunte**.
   - Confirme que todas as specs da feature estão `CONCLUÍDO`. Se alguma continua `PENDENTE` ou `EM ANDAMENTO`, a feature não está pronta para este portão — encaminhe para `/sdd-implement`.

1. **Loop de Validação Adaptativo — escopo Feature:**
   - Executa o loop definido em `skills/sdd/references/loop-guide.md` (**fonte única da rotina**) no **escopo Feature**: detecção de stack, triage de risco, bateria completa sobre a branch `feat/<slug>` contra a base, auto-cura com orçamento de voltas e review Ponytail com revalidação.
   - Diferenças do escopo Fatia, já definidas no contrato do loop: o diff analisado é o da **branch inteira**, a suíte roda **completa** (não só os testes afetados) e o **E2E é obrigatório**, mesmo que nenhuma fatia isolada tenha tocado UI.

2. **Portão Fechado:**
   - **Verde:** a feature está pronta para o encerramento. Reporte a classificação de risco, as voltas gastas e os cortes Ponytail aplicados.
   - **Vermelho após esgotar as voltas:** **PARE.** A PR **não** é marcada como pronta e `/sdd-finish` **não** é convidado. Exiba o relatório de parada do loop e devolva o controle ao usuário.

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

O callout é **condicional**, derivado do resultado do loop:

- **Loop verde**, o agente **DEVE** terminar exibindo:

  > **👉 Próximo Passo Recomendado:**
  > A bateria completa da feature (`tsc`, `lint`, `tests`, `e2e`) passou com 100% de sucesso e o review Ponytail foi aplicado! Execute o comando para gerar a spec final pós-implementação, atualizar o estado e realizar o commit/push/merge:
  > `/sdd-finish`

- **Loop vermelho**, o agente **DEVE** exibir o relatório de parada e terminar com:

  > **🛑 Validação da feature bloqueada.**
  > O orçamento de auto-cura se esgotou com a bateria vermelha — a PR continua Draft e **não** deve ser integrada. Como as fatias passaram individualmente, o suspeito principal é **interação entre fatias**. Revise o diagnóstico acima e reexecute:
  > `/sdd-validate` (após resolver o bloqueio)
