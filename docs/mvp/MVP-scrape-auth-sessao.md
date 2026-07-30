# MVP Scope & Slice Breakdown: Scrape autenticado com sessão persistente

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Store de sessão por plataforma no Supabase (cookies + metadados) com load/save
- Login automático com `ML_*` / `AMZN_*` / `SHOP_*` e self-heal (1 retry)
- Scrape com cookie/headers injetados (Firecrawl e/ou HTTP) para ML, Amazon e Shopee
- Filtro anti-lixo (menus, cupons de categoria, URL sem padrão de produto)
- Shopee de volta no `listActiveScrapeSources` no path autenticado
- UI mínima de status de sessão por loja (admin)
- `SCRAPE_MOCK=1` sem login/scrape real; credenciais só server
- Testes unitários do store, filtro e client (fetch/login mockados)

### 🟡 Nice-To-Have (Postergado para versões futuras)
- Playwright persistente no worker para bypass Cloudflare (se HTTP+Firecrawl falhar em prod)
- Renovação proativa de sessão (cron só de health-check de login)
- UI para “forçar re-login” por botão
- Magalu autenticado
- Criptografia at-rest dedicada dos cookies além do isolamento service-role
- Multi-conta / rotação de usuários por plataforma

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Sessão persistente + login automático (store + self-heal)
- **Objetivo:** Modelo/tabela ou chave em storage existente para sessão por fonte; módulo server-only de load/save; login automático por plataforma (HTTP handshake estilo frota-impacto onde viável); `ensureSession` + retry único; documentar envs em `.env.example`; testes com fetch mock.
- **Dependências:** Nenhuma (independe do extract Firecrawl)
- **Status:** `PENDENTE`

### 📦 Fatia 02: Scrape autenticado ML/Amazon + filtro anti-lixo
- **Objetivo:** Injetar cookies/headers no client de scrape; wire ML e Amazon com sessão; filtro de URL/título antes do upsert; prompts/URLs alinhados a produtos físicos; dashboard continua listando `new`; testes do filtro e do client com headers.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

### 📦 Fatia 03: Shopee ativo + UI de status de sessão
- **Objetivo:** Reativar Shopee no registry ativo com sessão; endpoint ou extensão de API para status por loja; UI mínima no fluxo de ofertas (ou superfície admin adjacente); smoke de erros de login na UI; invariantes prontos para `STATE.md` no finish.
- **Dependências:** Fatia 02
- **Status:** `PENDENTE`

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** Credenciais e cookies de sessão nunca vão para o client bundle nem para o git.
- **Invariante 2:** Ofertas scrapadas entram `status=new`; contrato de `runScrape` não quebra.
- **Invariante 3:** `SCRAPE_MOCK=1` não chama login real nem Firecrawl de marketplace.
- **Invariante 4:** Sem inventar ofertas quando login/scrape falha; erro explícito por fonte.
- **Invariante 5:** Magalu stub até feature dedicada.
- **Risco 1:** 2FA / CAPTCHA / Cloudflare impedem login 100% automático. → **Mitigação:** erro claro; avaliar Playwright no worker em feature seguinte; não gravar lixo.
- **Risco 2:** Cookies no banco sensíveis. → **Mitigação:** só service role; sem exposição em API client além de status booleano/mensagem curta.
- **Risco 3:** Firecrawl pode não encaminhar cookies da mesma forma em todos os hosts. → **Mitigação:** path HTTP autenticado + extract local se headers Firecrawl forem insuficientes.
- **Risco 4:** Login em serverless (Vercel) com timeout. → **Mitigação:** login sob demanda 1x; se precisar browser, worker Render.
