# Spec Técnica: [Fatia XX - Nome da Fatia]

> **Feature:** `<slug>` | **Status:** `PENDENTE` | **Data:** [YYYY-MM-DD]

<!-- Arquivo: docs/specs/spec-<slug>-fatia-XX.md — o <slug> no nome é obrigatório e isola esta feature de fluxos SDD paralelos. -->


## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** [O que será construído exatamente nesta fatia]
- **Limites da fatia:** [Máximo de arquivos e churn de código previstos]

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW/MODIFY]` `caminho/do/arquivo.ext`
- **Símbolos e funções afetadas:**
  - `NomeDaFuncao` / `ModelName` / `ComponentName`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```prisma / sql / typescript
  // Definição de novos campos ou tabelas
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - `actionName(payload: InputType): Promise<OutputType>`

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** [Descrição das telas, modais ou forms a criar]
- **Estados Visuais:** Loading, Empty state, Error state, Success state.
- **Acessibilidade & Modais:** Requisitos de sizing e scroll interno.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `test_file.test.ts` cobrindo o fluxo feliz e exceção.
- [ ] **Integração Backend + UI:** Garantir dados transitando do banco até a tela.
- [ ] **Validação Estrita:** Passar em `tsc`, `lint` e `test`.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE` <!-- /sdd-implement flipa: PENDENTE → EM ANDAMENTO → CONCLUÍDO -->
- **Concluído:** [Lista de itens prontos]
- **Pendente:** [Lista de itens a fazer]
- **Próximo comando:** `/sdd-implement` (repita até a última fatia; depois `/sdd-validate`)
