# Spec Técnica: Fatia 01 - Modelo de Dados & Extensão do Scrape/API

> **Feature:** `balanco-preco-oferta` | **Status:** `PENDENTE` | **Data:** 2026-07-31

<!-- Arquivo: docs/specs/spec-balanco-preco-oferta-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Mapeamento e suporte para armazenamento e retorno do preço original de lista (`original_price_cents`) nas APIs de ofertas e parsers/scrapers.
- **Limites da fatia:** Alteração em `src/lib/scrapers/types.ts`, `src/app/api/offers/route.ts` e utilitários de scraping.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `MODIFY` `src/lib/scrapers/types.ts`
  - `MODIFY` `src/app/api/offers/route.ts`
  - `MODIFY` `src/lib/scrapers/html-extract.ts`
  - `NEW` `tests/price-balance.test.ts`
- **Símbolos e funções afetadas:**
  - Interface `RawOffer` e `Offer`
  - Handler `GET /api/offers`

## 3. Contratos de Dados & API (Backend)
- **Modelos de Dados:**
  ```ts
  export type RawOffer = {
    title: string;
    url: string;
    priceCents?: number;
    originalPriceCents?: number;
    imageUrl?: string;
    externalId?: string;
  };
  ```
- **Endpoints / APIs:**
  - `GET /api/offers`: Retorna `offers` contendo os campos `price_cents` e `original_price_cents` (quando disponível).

## 4. Interface do Usuário & UX (Frontend)
- Sem alterações visuais nesta fatia (foco no contrato de dados backend).

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário:** `tests/price-balance.test.ts` testando o cálculo defensivo do percentual de desconto e desconto economizado em R$.
- [ ] **Validação Estrita:** Passar em `npm run typecheck`, `npm run lint` e `npm run test`.

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** Nenhum
- **Pendente:** Implementação dos tipos e testes da Fatia 01.
- **Próximo comando:** `/sdd-implement`
