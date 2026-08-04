# Plano — Shopee + espelho + preço/caption

**Data:** 2026-08-04  
**Método:** grill-me (decisões do operador) + evidência de checagens E1–E3  
**Status:** fatia P0 fechada em escopo; execução ops pendente de profile Firecrawl

---

## 1. Decisões da entrevista (grill-me)

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Fatia prioritária | **Shopee env + profile (ops)** |
| 2 | Escopo Shopee | **Padrão MeLi/Amazon** = fonte ativa que colhe de verdade |
| 3 | Como chegar lá | **Ops: profile + env** (código `shopee.ts` permanece exigindo profile) |
| 4 | Quem cria o profile | Operador fornece credenciais da conta dedicada; setup no Firecrawl + Vercel (sem commitar segredo) |

**Fora desta fatia (backlog explícito):**

- Preço MeLi null (~87% captions ready sem `price_cents`) + prompt “cite preço exato”
- Planilha espelho UX (`mirrorToSheets` colunas/status/limite)
- Tom/verbosidade do caption (~400 chars cômico)

---

## 2. Evidência que ancora o plano

### E1 — Env Production (Vercel)

| Env | Production |
|-----|------------|
| `FIRECRAWL_API_KEY` | Presente (ML/Amazon colhem) |
| **`FIRECRAWL_SHOPEE_PROFILE`** | **Ausente** |
| `SCRAPE_SHOPEE_URL` | Ausente (default `flash_sale` ok) |
| `SCRAPE_MOCK` | Ausente em Production (ok) |
| `SHOP_LOGIN` / `SHOP_PASS` | Ausentes (não autenticam Shopee de verdade) |

### E2 — `scrape_runs` Shopee (prod Supabase)

- Últimos 20 runs Shopee: **0 ok**
- Erro dominante (02–04/08): `FIRECRAWL_SHOPEE_PROFILE ausente…` (~70ms)
- Runs antigos (01/08): `Login Necessário: sessão ausente/expirada…`
- Ofertas Shopee no DB: **0**
- No mesmo cron: MeLi/Amazon **ok, 15 itens**

### E3 — Preço vs caption (não é P0, mas mitigações já apontadas)

- MeLi: ~114/131 caption-ready com `price_cents` **null**
- Quando DB tem preço e caption cita `R$`, na amostra **bate** (não vimos LLM trocar número)
- Amazon: scrape de preço melhor; várias captions **omitem** preço mesmo com DB ok

---

## 3. Fatia P0 — Shopee no ar (ops)

### Objetivo

Shopee se comporta como MeLi/Amazon no cron: `scrape_runs` com `ok=true` e `items_found > 0`; ofertas entram no funil caption → afiliado → enqueue → espelho.

### Por que não é “código primeiro”

`shopee.ts` já:

1. exige `FIRECRAWL_SHOPEE_PROFILE`
2. chama Firecrawl v2 com `profile` + `saveChanges: false`
3. falha legível se “Login Necessário”

Sem profile/env, qualquer refactor de scraper é teatro.

### Mitigação / solução (passos)

| Passo | Ação | Dono | Critério de pronto |
|-------|------|------|--------------------|
| 1 | Criar/garantir profile de browser no Firecrawl, **logado** na Shopee (conta dedicada) | Ops + guia | Profile existe e abre Shopee logado |
| 2 | `vercel env add FIRECRAWL_SHOPEE_PROFILE` → **Production** (valor = nome do profile, ex. `shopee-br`) | Ops | `vercel env ls production` lista a var |
| 3 | Redeploy app Production (env só entra em build/runtime novo) | Ops / CI | Deploy live pós-env |
| 4 | Disparar scrape (cron ou `POST /api/scrape/run`) | Ops | `scrape_runs` Shopee: `ok=true`, `items_found>0` |
| 5 | Se erro `Login Necessário` | Relogar profile no Firecrawl | Run seguinte ok |
| 6 | (Opcional) `SCRAPE_SHOPEE_URL` se flash_sale for ruim | Ops | Só se colheita 0 com profile ok |

### Referência de criação de profile (já no `.env.example`)

```text
# Profile de browser do Firecrawl com sessão Shopee logada.
# firecrawl scrape https://shopee.com.br/buyer/login --profile shopee-br
# firecrawl interact "preencha e-mail e senha e clique em ENTRAR"
# FIRECRAWL_SHOPEE_PROFILE=shopee-br
```

### Segurança (invariante desta fatia)

- **Nunca** commit de senha Shopee / cookie / profile secret no git, `STATE.md`, `.env.example` ou memória do agente.
- Chat pode carregar credencial de conta **dedicada** só para setup ao vivo; preferível digitar senha **só no browser do Firecrawl**, e no chat passar apenas o **nome do profile**.
- `SHOP_LOGIN`/`SHOP_PASS` no Vercel **não** substituem o profile (código e STATE já documentam).

### Fora do P0 (não fazer agora)

- Mudar `listActiveScrapeSources` para esconder Shopee
- Reescrever scraper Shopee “igual ML” sem profile (paywall)
- Planilha / prompt de caption / parse de preço MeLi

---

## 4. Backlog com mitigações já apontadas

### B1 — Preço MeLi null → caption sem âncora

| Achado | Mitigação |
|--------|-----------|
| ~87% caption-ready MeLi com `price_cents` null | Melhorar harvest/`parsePricesFromText` / janela HTML em listagem ML |
| Caption sem `R$` quando DB null | Modelo omite ou inventa; preferir **não inventar** + scrape certo |
| Quando DB tem preço e caption cita número, amostra bate | Priorizar **scrape**, não paranoia de “LLM troca preço” |
| Amazon omite preço com DB ok | Prompt: “se Preço ≠ —, cite **exatamente** esse valor” |
| Caption gerada com preço velho, re-scrape atualiza DB | Regenerar caption se `price_cents` mudar (ou invalidar caption) |

**Locais:** `html-extract.ts`, `normalize.ts`, scrapers ML/Amazon, `caption.ts`, opcional pipeline.

### B2 — Planilha espelho UX

| Dor | Mitigação |
|-----|-----------|
| UUID na coluna A | Tirar `id` ou ir pro fim |
| Caption ~400 chars | Limitar preview na sheet / caption mais curta (liga B3) |
| `pendente` vs `enviado` grosso | Status mais rico ou só pendentes |
| 500 linhas misturadas | `MIRROR_LIMIT` menor; só não-enviados |
| Reescrita apaga manual | Aceitar (espelho) ou documentar “não edite” |

**Locais:** `mirrorToSheets` / `MIRROR_HEADER` em `pipeline/run.ts`, `overwriteRows`.

### B3 — Verbosidade / estrutura da caption

| Dor | Mitigação |
|-----|-----------|
| Texto longo cômico | Prompt mais curto + estrutura (gancho + preço + CTA) |
| Mensagem WA | Ajustar `message_template` se preciso |
| URL vazando na legenda | Já tem `stripUrls` — manter |

**Locais:** `src/lib/ai/caption.ts`, `app_settings.message_template`.

---

## 5. Ordem recomendada pós-P0

```
P0  Shopee profile + env + validar scrape_runs     ← agora
B1  Preço MeLi (scrape) + prompt preço exato
B3  Caption mais curta/estruturada (se ainda poluir)
B2  Planilha espelho (colunas/filtro/limite)
```

B1 antes de B2: planilha com caption sem preço continua confusa mesmo com colunas bonitas.

---

## 6. Critérios de aceite P0

- [ ] `FIRECRAWL_SHOPEE_PROFILE` listado em `vercel env ls` Production  
- [ ] Redeploy Production após add da env  
- [ ] Pelo menos 1 `scrape_runs` Shopee com `ok=true` e `items_found > 0`  
- [ ] `offers` com `source=shopee` count > 0  
- [ ] Nenhum segredo Shopee no git  

---

## 7. Docs de apoio

- `ANALISE-planilha-espelho-captions.md` — fluxo caption + espelho  
- `STATE.md` — `FIRECRAWL_SHOPEE_PROFILE`, fail-fast Shopee  
- `.env.example` — como criar profile  
- Checagens E1–E3 (sessão 2026-08-04) — base factual deste plano  

---

## 8. Próximo passo de execução

### P0 Shopee — ENCERRADO (2026-08-04)

- Tentativa de profile Firecrawl `shopee-br` + login 2FA: **não** desbloqueou scrape v2 (Login Necessário / captcha).
- Decisão do operador: **eliminar Shopee da jogada**; seguir só MeLi + Amazon.
- Código: `listActiveScrapeSources` = `["mercadolivre","amazon"]`; cron `ACTIVE` igual. Scraper Shopee permanece no repo para reativação futura.

### Agora

1. **B1** — Preço MeLi (`price_cents` null em massa) + prompt caption “cite preço exato” quando informado.  
2. **B3** — Caption mais curta/estruturada (se ainda poluir).  
3. **B2** — Planilha espelho UX.
