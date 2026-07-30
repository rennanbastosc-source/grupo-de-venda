# MVP Scope & Slice Breakdown: Plataforma de Promoções

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Scaffold Next.js + TS + React + Tailwind v4 + Supabase Auth/DB + shell dashboard (referência visual/estrutura `chatbotrdo`)
- Sessão Baileys (QR, status, reconexão) + CRUD grupos ativos
- Scraping de marketplaces (ML, Amazon, Shopee, Magalu — ao menos 1–2 fontes no código, extensível) → fila de ofertas
- Painel de links promocionais (Livelo/Méliuz/cashback genérico) + emissão obrigatória antes do envio
- Disparo manual + fila com rate limit horário e teto diário; meta operacional **≥ 35 disparos/dia**
- Dashboard executivo: contadores do dia, erros, filas, status bot
- Single-tenant; compliance mínima (grupos autorizados, log de envios); limites free tier

### 🟡 Nice-To-Have (Postergado para versões futuras)
- Multi-tenant / white-label
- Tracking fino de cliques/conversão por rede de ads (UTM + postback Méliuz/Livelo)
- Aprovação automática por regras de desconto %
- Mídia rica (stories, carrossel, áudio)
- Integração nativa com Meta Ads / pixels
- API oficial WhatsApp Cloud (substituir Baileys)
- App mobile admin
- R2 para mídia em escala (só se sessão/mídia exigir no caminho crítico)

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Scaffold, Auth Supabase e Shell do Dashboard
- **Objetivo:** App Next.js + TS + Tailwind v4 na Vercel; Supabase Auth (admin); layout sidebar/header no espírito `chatbotrdo`; páginas placeholder (overview, grupos, ofertas, links, disparos); middleware de proteção; schema Supabase inicial (profiles/admin).
- **Dependências:** Nenhuma
- **Status:** `PENDENTE`

### 📦 Fatia 02: Grupos WhatsApp + Sessão Baileys
- **Objetivo:** Worker/processo Baileys com persistência de sessão; UI de QR e status; CRUD de grupos (jid, nome, ativo, limites); API dashboard ↔ worker; pausa de envio se desconectado.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

### 📦 Fatia 03: Pipeline de Scraping de Promoções
- **Objetivo:** Jobs de scrap por fonte (ML, Amazon, Shopee, Magalu — mínimo viável por fonte); normalização oferta (título, preço, url, imagem, fonte); dedupe; estados nova/aprovada/rejeitada; listagem e filtros no dashboard; respeito a rate/backoff free-tier.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

### 📦 Fatia 04: Painel de Links Promocionais (Afiliados)
- **Objetivo:** Cadastro de provedores (Livelo, Méliuz, encurtador/cashback); emitir URL afiliada a partir da URL da oferta; histórico de emissões; bloquear disparo sem link afiliado; secrets de afiliado em env.
- **Dependências:** Fatia 03
- **Status:** `PENDENTE`

### 📦 Fatia 05: Disparo em Grupos (Fila + Rate Limit)
- **Objetivo:** Enfileirar oferta+grupos+mensagem; envio via Baileys; disparo manual e lote; rate limit horário + teto diário configuráveis; contador ≥ 35/dia; histórico sucesso/falha; compliance (só grupos ativos cadastrados).
- **Dependências:** Fatia 02, Fatia 04
- **Status:** `PENDENTE`

### 📦 Fatia 06: Dashboard Executivo e Stats Operacionais
- **Objetivo:** Overview com KPIs (disparos/dia vs meta, erros, ofertas scrapadas, pendências de fila, status sessão); telas de histórico/erros polidas; polling ou refresh sob demanda; alinhamento final UX ao modelo `chatbotrdo`.
- **Dependências:** Fatia 05
- **Status:** `PENDENTE`

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** Nenhum link de marketplace é enviado ao WhatsApp sem passar pelo painel de links promocionais.
- **Invariante 2:** Disparos apenas para grupos cadastrados e ativos (single-tenant, compliance).
- **Invariante 3:** Rate limit horário e teto diário nunca são contornáveis pela UI/API de disparo.
- **Invariante 4:** Stack: Next.js + TS + React + TW v4 · Vercel (dashboard) · Supabase auth+DB · R2 só se necessário · Baileys (não oficial).
- **Risco 1:** Baileys + Vercel serverless — processo do bot não roda “dentro” de uma lambda Next. → **Mitigação:** worker Baileys separado (VM/container/processo sempre ligado); dashboard só orquestra via API/queue.
- **Risco 2:** Ban/bloqueio WhatsApp e instabilidade de sessão. → **Mitigação:** rate limits conservadores, jitter, meta 35/dia baixa, reconexão + alerta no overview.
- **Risco 3:** Scraping bloqueado por anti-bot dos marketplaces. → **Mitigação:** poucos requests, cache, backoff, fontes pluggáveis; fallback manual de URL no painel.
- **Risco 4:** Free tier Supabase/Vercel (cron, DB, edge). → **Mitigação:** jobs espaçados, queries enxutas, contadores agregados, sem fan-out pesado no MVP.
