# PRD: Plataforma de Promoções (Scraping + Chatbot WhatsApp)

## 1. Resumo Executivo & Problema
- **Problema:** Operação de disparo de promoções em grupos de WhatsApp hoje é manual, sem scraping contínuo de marketplaces, sem painel unificado de links afiliados (Livelo/Méliuz/cashback) e sem métricas executivas de volume/erro. Conversão de anúncios (Instagram, Facebook, X) para grupos abertos perde eficiência sem bot confiável e rastreável.
- **Proposta de Valor:** Serviço single-tenant que (1) scrapa ofertas de marketplaces (Mercado Livre, Amazon, Shopee, Magalu, etc.), (2) reescreve URLs via painel de links promocionais afiliados, (3) dispara via Baileys em grupos abertos com meta mínima de **35 disparos/dia**, e (4) expõe dashboard executivo (modelo visual/estrutural inspirado no `chatbotrdo`) para operação e KPIs.
- **Público-Alvo / Personas:**
  - **Operador/Admin (único tenant):** configura fontes de scrap, grupos, templates de mensagem, rate limits e monitora saúde do bot.
  - **Membros de grupos abertos de WhatsApp:** recebem promos com links afiliados (não usam o dashboard).
  - **Tráfego pago (Instagram/Facebook/X):** alimenta entrada nos grupos; produto não gerencia ads no MVP — só o funil pós-entrada (disparo + link).

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Autenticação de admin via Supabase Auth (single-tenant); rotas de dashboard protegidas.
- [ ] **RF-02:** Shell de dashboard (layout sidebar/header estilo `chatbotrdo`) com páginas: overview, grupos, ofertas, links, disparos, erros.
- [ ] **RF-03:** CRUD de grupos WhatsApp (id/jid, nome, ativo, limites) e status da sessão Baileys (conectado/desconectado/QR).
- [ ] **RF-04:** Pipeline de scraping configurável por fonte (ML, Amazon, Shopee, Magalu, …): agendamento, parse de título/preço/URL/imagem, dedupe, status (nova/aprovada/rejeitada/enviada).
- [ ] **RF-05:** Painel de links promocionais: entrada URL original → saída URL afiliada via provedores (Livelo, Méliuz, encurtadores/cashback genéricos); histórico de emissões.
- [ ] **RF-06:** Fila de disparo: selecionar oferta + grupos → mensagem com link afiliado → envio via Baileys; suporte a disparo manual e lote agendado.
- [ ] **RF-07:** Rate limiting e teto diário configuráveis (free tier / anti-ban); contador de disparos do dia com meta ≥ 35.
- [ ] **RF-08:** Dashboard executivo: disparos/dia, taxa de erro, ofertas scrapadas, cliques (quando tracking disponível), status sessão, filas pendentes.
- [ ] **RF-09:** Histórico de envios (grupo, oferta, link, timestamp, status sucesso/falha).
- [ ] **RF-10:** Compliance operacional: opt-in de grupos (somente grupos cadastrados/ativos), logs de envio, sem spam a contatos fora de grupos autorizados.

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Stack fixa:** Next.js + TypeScript + React + Tailwind CSS v4 · deploy Vercel · Auth + DB Supabase · storage Cloudflare R2 (somente se mídia/QR/sessão exigir).
- **WhatsApp:** Baileys (API não oficial). Sessão persistente; reconexão e exibição de QR no dashboard. **Nota:** Baileys é long-running/WebSocket — incompatível com serverless puro da Vercel para o processo do bot; MVP deve isolar o worker Baileys (processo/serviço separado ou edge de sessão) e o dashboard Next na Vercel. Detalhe de hospedagem do worker na spec técnica.
- **Multi-tenancy:** single-tenant apenas.
- **Performance / SLA:** scrap e disparos respeitam limites free tier e rate limit horário/diário; dashboard interativo < 2s em free tier razoável.
- **Segurança & Permissões:** só admin autenticado; secrets (session Baileys, chaves afiliados) em env/Supabase secrets; nunca commitar credenciais.
- **Compliance:** LGPD — mínimo de PII; só JIDs de grupos e metadados operacionais; trilha de auditoria de disparos; respeito a termos dos marketplaces no scraping (volume baixo, cache, backoff).
- **Compatibilidade:** desktop Chrome/Firefox para o painel admin.

## 4. Métricas de Sucesso (KPIs)
- **≥ 35 disparos/dia** sustentados em dias úteis com sessão Baileys estável.
- Ofertas scrapadas diariamente suficientes para alimentar a meta de disparos (sem reenvio cego da mesma URL no mesmo grupo no mesmo dia).
- 100% dos links enviados passam pelo painel de links promocionais (zero URL marketplace “crua” no chat).
- Dashboard reflete contadores do dia com latência aceitável (atualização sob demanda ou polling curto).

## 5. Casos de Uso & Fluxos do Usuário
1. **Fluxo Principal (Happy Path):**
   - Admin autentica no dashboard → confere sessão Baileys conectada → cron/job scrapa marketplaces → ofertas entram na fila “novas” → admin (ou regra auto-aprovação) gera link afiliado no painel → enfileira disparo para grupos ativos → Baileys envia mensagem com promo + link → histórico e contador diário atualizam (≥ 35/dia).
2. **Fluxo de Exceção:**
   - Sessão Baileys cai → dashboard marca desconectado + QR; disparos pausam; alerta no overview.
   - Scrap falha/fonte bloqueia → oferta não entra; erro logado; demais fontes seguem.
   - Rate limit / teto diário atingido → fila retém envios; UI mostra “limite do período”.
   - Provedor afiliado falha → envio bloqueado para aquele item; admin vê falha de emissão de link.
