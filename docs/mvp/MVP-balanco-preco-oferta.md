# MVP Scope & Slice Breakdown: balanco-preco-oferta

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Suporte aos campos de preço original (`original_price_cents`) no modelo de dados / tipos client e endpoint.
- Tags de fonte (`mercadolivre`, `amazon`, etc.) transformadas em botões clicáveis com estilos Neo-brutalism.
- Componente `PriceBalanceModal.tsx` exibindo valor original, preço promocional, desconto e ações de oferta.

### 🟡 Nice-To-Have (Postergado)
- Histórico de variação de preço em gráfico no modal.

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Modelo de Dados & Extensão do Scrape/API
- **Objetivo:** Adicionar suporte a `original_price_cents` e cálculo de desconto na API `/api/offers` e parsers de scraping.
- **Dependências:** Nenhuma
- **Status:** `PENDENTE`

### 📦 Fatia 02: Modal de Balanço de Preço & Interatividade da UI
- **Objetivo:** Criar o componente `PriceBalanceModal.tsx` e integrar os botões de fonte em `OffersManager.tsx`.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** As ações (Aprovar, Rejeitar, Afiliado) acionadas pelo modal devem atualizar o estado da lista em tempo real.
- **Risco 1:** Preços de lista ausentes no HTML de scraping. → **Mitigação:** Exibir o modal com badge e mensagem amigável de preço promocional único.
