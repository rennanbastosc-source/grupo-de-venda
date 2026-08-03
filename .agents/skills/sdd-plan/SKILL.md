---
name: sdd-plan
description: Inicia a entrevista de produto para a funcionalidade e gera o PRD (docs/prd/PRD-<slug>.md) e o escopo do MVP fatiado (docs/mvp/MVP-<slug>.md).
---

# /sdd-plan [nome-da-feature]

Comando inicial do fluxo SDD (Spec-Driven Development). Abre a conversa de alinhamento de produto e gera os artefatos base em `docs/`.

## Passos de Execução

0. **Resolução do Slug da Feature (obrigatório, antes de tudo):**
   - Aplique o **Motor de Escopo por Feature** de `skills/sdd/references/workflow-guide.md` (fonte única da verdade) para derivar o `<slug>` canônico a partir do nome informado.
   - **🚦 GATE DE COLISÃO:** Se `docs/prd/PRD-<slug>.md` ou `docs/mvp/MVP-<slug>.md` **já existem**, **PARE** e pergunte ao usuário se ele quer *retomar* essa feature (nesse caso, encaminhe para `/sdd` ou `/sdd-spec`) ou *escolher outro nome*. **Nunca sobrescreva um planejamento existente.**
   - Anuncie o slug resolvido e a branch prevista (`feat/<slug>`) antes de iniciar a entrevista.

1. **Entrevista de Produto Refinada (Respostas em PT-BR):**
   - **🚦 GATE OBRIGATÓRIO:** APRESENTE as perguntas ao usuário e **AGUARDE as respostas** antes de prosseguir. **NUNCA invente, assuma ou responda por conta própria** questões de produto. Só avance ao Passo 2 quando as respostas essenciais (dor, público, must-have, restrições, fatiamento) estiverem efetivamente respondidas pelo usuário.
   - Qual é a dor principal ou objetivo de negócio desta funcionalidade?
   - Quem é o público-alvo (motoristas, gestores, admin, etc.) e o contexto de uso?
   - Quais são os recursos essenciais (Must-Have) sem os quais o MVP não funciona?
   - Quais são as restrições técnicas, de segurança ou regras de negócio imutáveis?
   - Como essa funcionalidade será fatiada em entregas incrementais (`Fatia 01`, `Fatia 02`, etc.)?

2. **Geração dos Artefatos de Produto (escopados ao `<slug>`):**
   - Cria `docs/prd/PRD-<slug>.md` usando o template em `skills/sdd/references/prd-template.md`.
   - Cria `docs/mvp/MVP-<slug>.md` usando o template em `skills/sdd/references/mvp-template.md` com o fatiamento detalhado do escopo.
   - **As fatias DEVEM ser explicitamente enumeradas e numeradas** (`Fatia 01`, `Fatia 02`, …). Esse total `N` é o contrato que `/sdd-spec` e `/sdd-implement` vão contar e verificar depois.
   - Escreve **apenas** esses dois arquivos. Não toca em artefatos de outras features que existam em `docs/`.

---

## 🛑 REGRA OBRIGATÓRIA DE SAÍDA (NEXT COMMAND CALLOUT)

Ao finalizar a geração do PRD e MVP, o agente **DEVE obrigatoriamente** terminar a resposta exibindo o seguinte aviso em destaque:

> **👉 Próximo Passo Recomendado:**
> PRD e MVP da feature `<slug>` gerados (`N` fatias). Execute o comando para mapear e criar as especificações técnicas base de todas as fatias do MVP:
> `/sdd-spec`
