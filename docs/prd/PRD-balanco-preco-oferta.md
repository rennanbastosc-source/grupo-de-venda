# PRD: Balanço de Preço e Desconto por Fonte (balanco-preco-oferta)

## 1. Resumo Executivo & Problema
- **Problema:** O quadro de ofertas exibe apenas o preço final (ou `—`), ocultando o preço original de lista e o desconto percentual real obtido do scraping de Mercado Livre e Amazon. Além disso, a coluna de Fonte exibe badges estáticos sem interação detalhada.
- **Proposta de Valor:** Transformar os badges de fonte em botões interativos que abrem um modal detalhado ("Balanço de Preço"), exibindo o preço de lista, preço final, valor/porcentagem de desconto e botões de ação rápida.
- **Público-Alvo / Personas:** Gestores e administradores do dashboard de ofertas.

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Exibir a tag de fonte (Amazon, Mercado Livre, Shopee, Magalu) como botão interativo no quadro de ofertas.
- [ ] **RF-02:** Ao clicar no botão de fonte, abrir o `PriceBalanceModal` exibindo o balanço de preço (Preço Original de Lista, Preço Promocional Atual, Economia em R$ e % de Desconto).
- [ ] **RF-03:** Disponibilizar no modal os botões de ação rápida (Aceitar, Rejeitar, Gerar Link de Afiliado, Disparar).
- [ ] **RF-04:** Manter cálculo defensivo de desconto e fallback elegante caso o preço original não seja capturado no scraping.

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Performance:** Abertura instantânea do modal client-side sem chamadas adicionais desnecessárias.
- **Compatibilidade:** UI totalmente responsiva mantendo a estética Neo-brutalism existente no dashboard.

## 4. Métricas de Sucesso (KPIs)
- Redução do tempo de tomada de decisão de aprovação de ofertas em 40%.
- 100% de clareza visual nos descontos concedidos pelos marketplaces.

## 5. Casos de Uso & Fluxos do Usuário
1. **Fluxo Principal:**
   - Usuário navega até `/dashboard/ofertas`.
   - Clica no botão da fonte de uma oferta (ex: `AMAZON`).
   - O `PriceBalanceModal` abre exibindo a comparação de preços (ex: De R$ 68,99 por R$ 34,00 - 50% OFF).
   - Usuário clica em "Aceitar" ou "Gerar Afiliado" diretamente no modal.
2. **Fluxo de Exceção:**
   - Se o preço de lista não for capturado, o modal exibe o preço promocional com a indicação de preço final e desabilita a barra comparativa de desconto sem quebrar a UI.
