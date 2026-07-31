# PRD: Scrape autenticado com sessão persistente (ML / Amazon / Shopee)

## 1. Resumo Executivo & Problema
- **Problema:** O scrape via Firecrawl anônimo entrega lixo operacional: menus (“Já tenho conta”), cupons de categoria da Amazon e URLs inventadas/404 da Shopee (anti-bot / “Login Necessário”). Sem sessão de usuário real, o funil ofertas → afiliado → disparo não sustenta promoções de produtos físicos.
- **Proposta de Valor:** Autenticar contas dedicadas por marketplace (credenciais em env), **persistir cookies/sessão no Supabase** (padrão frota-impacto / Rastrosystem), **re-login automático** quando a sessão expirar, e injetar a sessão no scrape (Firecrawl headers e/ou fetch autenticado) para gravar só **produtos reais** com URL válida. Reativar **Shopee** no pipeline ativo e expor **status de sessão** no dashboard para o admin.
- **Público-Alvo / Personas:**
  - **Admin single-tenant:** opera scrape (botão/cron), confere se ML/Amazon/Shopee estão logados, revisa ofertas em `/dashboard/ofertas`.
  - Membros de grupos WhatsApp: só consomem promos (fora do escopo de UI desta feature).

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Login automático por plataforma usando credenciais server-only (`ML_LOGIN`/`ML_PASS`, `AMZN_LOGIN`/`AMZN_PASS`, `SHOP_LOGIN`/`SHOP_PASS`) quando não houver sessão válida.
- [ ] **RF-02:** Persistência de sessão (cookies + metadados mínimos) no Supabase por fonte (`mercadolivre` | `amazon` | `shopee`); load antes do scrape; save após login bem-sucedido.
- [ ] **RF-03:** Self-heal: se scrape/login-check indicar sessão inválida (redirect login, 401/403, body “Login Necessário”), forçar re-login **uma vez** e repetir a operação (padrão retry do frota-impacto).
- [ ] **RF-04:** Scrape com sessão injetada (Cookie/headers no client Firecrawl e/ou path HTTP autenticado) para as 3 fontes; `SCRAPE_MOCK=1` continua sem rede externa de marketplace/login.
- [ ] **RF-05:** Filtro anti-lixo obrigatório antes do upsert: descartar menus/suporte, cupons de categoria sem produto, URLs sem padrão de produto (ML `/p/MLB…` ou equivalente; Amazon `/dp/ASIN`; Shopee `i.shop.item` ou `/product/…`).
- [ ] **RF-06:** Shopee volta a `listActiveScrapeSources()` quando o path autenticado estiver implementado e a sessão puder ser obtida (ou erro explícito se credenciais/sessão falharem).
- [ ] **RF-07:** UI mínima de status de sessão por loja (logado / expirado / erro / desconhecido) no dashboard (ofertas ou bot — preferir superfície já usada pelo admin no fluxo de scrape).
- [ ] **RF-08:** Magalu permanece stub; contrato de `runScrape` / status de oferta (`new`…) não quebra.

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Performance / SLA:** login sob demanda (não a cada item); timeout de scrape compatível com o atual (~45s); 1 página por fonte por run.
- **Segurança & Permissões:** credenciais e cookies **somente** server/env/DB service role; nunca no client bundle nem no git; scrape/login só admin autenticado ou cron com `CRON_SECRET`.
- **Login 100% automático:** MVP deve reautenticar com user/pass das envs sempre que a sessão falhar, sem fluxo manual de cookie no happy path. **Risco aceito:** 2FA/CAPTCHA/Cloudflare podem impedir login automatizado — nesses casos erro explícito na UI/logs (não inventar ofertas).
- **Compatibilidade:** Next.js 16 (Vercel) + `src/lib/scrapers/*` + Supabase; worker Baileys permanece separado — se Playwright for necessário, preferir worker long-running (Render), não serverless Vercel.
- **Código enxuto:** reutilizar padrão de sessão do frota-impacto (load/save/retry); não reinventar browser farm multi-conta.

## 4. Métricas de Sucesso (KPIs)
- Run real (mock off) grava ofertas com URL de **produto** (não menu/cupom genérico) em ≥ 2 fontes com sessão ok.
- Shopee ativa no pipeline sem 404 em massa nas URLs gravadas (sample manual de links no dashboard).
- Admin vê status de sessão por loja sem abrir o banco.
- CI verde com `SCRAPE_MOCK=1` (sem depender de login real).

## 5. Casos de Uso & Fluxos do Usuário
1. **Fluxo Principal (Happy Path):**
   - Admin clica “Rodar scrap agora” (ou cron) → sistema carrega sessão por fonte → se inválida, login automático com envs → scrape com cookies → filtro anti-lixo → upsert `offers` `new` → admin lista produtos reais e aprova.
2. **Fluxo de status:**
   - Admin abre dashboard de ofertas (ou painel de status) → vê ML / Amazon / Shopee: logado | expirado | erro (mensagem curta).
3. **Fluxo de Exceção:**
   - Login bloqueado (CAPTCHA/2FA) → run reporta erro da fonte; outras fontes seguem; UI mostra falha de sessão; **não** grava URLs fake.
   - Sessão expira mid-run → re-login + 1 retry; se falhar de novo → erro da fonte.
   - `SCRAPE_MOCK=1` → fixtures; sem login real.
