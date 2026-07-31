# Spec Técnica: Fatia 02 - Modal de Balanço de Preço & Interatividade da UI

> **Feature:** `balanco-preco-oferta` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-31

<!-- Arquivo: docs/specs/spec-balanco-preco-oferta-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Construção do componente `PriceBalanceModal.tsx` e conversão dos badges de fonte (`mercadolivre`, `amazon`, `shopee`, `magalu`) no componente `OffersManager.tsx` em botões interativos clicáveis.
- **Limites da fatia:** Criação de `PriceBalanceModal.tsx` e atualização de `OffersManager.tsx`.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `NEW` `src/components/PriceBalanceModal.tsx`
  - `MODIFY` `src/components/OffersManager.tsx`
- **Símbolos e funções afetadas:**
  - `PriceBalanceModal` (Novo Componente React Client)
  - `OffersManager` (Integração do estado do Modal)

## 3. Contratos de Dados & API (Backend)
- Consumo dos dados já fornecidos pela Fatia 01 via `Offer`.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:**
  - `<button>` da coluna Fonte com badges coloridas e hover interativo.
  - Modal Neo-brutalism (`PriceBalanceModal`) com:
    - Preço Original (riscado `line-through`)
    - Preço Com Desconto (destacado)
    - Badge `% OFF` / Economia em R$
    - Ações rápidas: Aceitar, Rejeitar, Gerar Link Afiliado, Disparar.
- **Acessibilidade:** Suporte a tecla `Escape` e clique no backdrop para fechar.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Integração Backend + UI:** Abertura do modal ao clicar na tag da fonte com rendering correto de descontos e preços.
- [ ] **Validação Estrita:** Passar em `npm run typecheck`, `npm run lint` e `npm run test`.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** Criado componente `PriceBalanceModal.tsx` e integrados os botões de fonte clicáveis em `OffersManager.tsx`.
- **Pendente:** Nenhum nesta fatia.
- **Próximo comando:** `/sdd-validate`
