# Análise — planilha espelho + produção de captions

**Data:** 2026-08-04  
**Escopo:** investigação no-code (só leitura do repo). Base para PRD/plano de UX e verbosidade.  
**Status:** rascunho de descoberta — sem implementação neste arquivo.

---

## 1. Resumo em uma frase

Caption nasce no **pipeline via 9router** (`generateCaption`); a planilha Google é só um **espelho read-only** reescrito no fim do run (`mirrorToSheets`). Poluição de UX vem de caption longo, coluna `id` (UUID), status binário grosso e mistura pendente/enviado na mesma aba.

---

## 2. Mapa do fluxo

```
Scrape → offers (status=new, caption_status=none)
   ↓ pipeline (cron /api/cron/pipeline | API | UI)
generateCaptions  → offers.caption + caption_status=ready|failed
ensureAffiliates  → affiliate_links (status=ok)
autoEnqueue       → dispatch_jobs → WA
mirrorToSheets    → Google Sheet aba "Ofertas" (reescrita completa)
```

**Orquestração:** `src/lib/pipeline/run.ts` → `runOfferPipeline()`  
Ordem fixa: captions → afiliados → enqueue → espelho.

Caption **não** depende da planilha. A planilha **não** gera caption, **não** enfileira e **não** importa edição de volta.

---

## 3. Onde o caption é produzido

| Peça | Path | Papel |
|------|------|--------|
| Geração LLM | `src/lib/ai/caption.ts` → `generateCaption()` | POST OpenAI-compat no 9router |
| Orquestra batch | `src/lib/pipeline/run.ts` → `generateCaptions()` | Seleciona ofertas e grava no DB |
| Template WA | `src/lib/dispatch/enqueue.ts` + `template.ts` | Monta mensagem final |
| Mock CI/dev | `SCRAPE_MOCK=1` | Template fixo, sem rede |

### 3.1 Seleção de ofertas para caption

- `caption_status ∈ ('pending', 'none', 'failed')` — failed reentra (repescagem)
- `status ∈ ('new', 'approved')`
- Ordem: `scraped_at` asc
- Batch: `min(max(daily_offer_cap, 1), 25)` — teto duro 25/run
- Delay: 1,5s entre calls (anti-429 no provedor), exceto mock

### 3.2 Campos em `offers`

| Campo | Uso |
|-------|-----|
| `caption` | Texto gerado (ou null) |
| `caption_status` | `none` \| `pending` \| `ready` \| `failed` |
| `caption_error` | Até ~300 chars do erro 9router/DB (migration 016) |

### 3.3 Prompt atual (verbosidade)

System em `caption.ts` (~linhas 47–56):

- Copywriter PT-BR, humor quase cômico, “amigo animado”
- Máximo **~400 caracteres**
- Gancho + curiosidade; emojis com moderação; pergunta/brincadeira
- Não inventar preço/desconto/frete/estoque
- **Não** incluir URLs (link vai no template do WA)
- Resposta só o texto da legenda

Pós-processo: `stripUrls()` — remove URL e isca tipo “Corre: https://…” se o modelo vazar link.

Mock:

```text
Achado raro: {title} por {price}! Corre que acaba — quem demora fica de fora!
```

### 3.4 Mensagem no WhatsApp

Default `app_settings.message_template` (fallback em `enqueue.ts`):

```text
{{caption}}

🔗 {{affiliate_url}}
```

Variáveis suportadas em `buildMessage`: `title`, `price`, `affiliate_url`, `caption`.

Env vars relevantes: `NINE_ROUTER_BASE_URL`, `NINE_ROUTER_MODEL` (default `GeMiNi`), `NINE_ROUTER_API_KEY`, timeout 30s.

---

## 4. Planilha espelho (as-built)

| Item | Valor |
|------|--------|
| Função | `mirrorToSheets` — `src/lib/pipeline/run.ts` (~263–316) |
| Cliente | `overwriteRows` — `src/lib/sheets/client.ts` (JWT RS256, sem SDK) |
| Aba/range | `Ofertas!A1:D…` + clear do excedente |
| Limite | `MIRROR_LIMIT = 500` |
| Gatilho | Fim de **todo** `runOfferPipeline` (se Sheets configurado) |
| Spec | `docs/specs/spec-escala-disparos-fatia-06.md` |
| Migration | `014_sheets_mirror.sql` — drop `sheets_row` / `sheets_synced_at` |

### 4.1 Colunas (ordem exata)

| Coluna | Header | Conteúdo |
|--------|--------|----------|
| A | `id` | UUID da oferta |
| B | `link` | `affiliate_url` com `status=ok` (vazio se sem afiliado) |
| C | `caption` | Texto da IA (pode ser longo, com `\n` e emojis) |
| D | `status` | `enviado` se `offers.status === 'sent'`, senão **`pendente`** |

Header no código: `MIRROR_HEADER = ["id", "link", "caption", "status"]`.

### 4.2 Quem entra no espelho

Query:

- `caption_status = 'ready'` **OU** `status = 'sent'`
- Ordem: `scraped_at` desc
- Limit 500

Link: primeiro `affiliate_links` ok por `offer_id` (mais recente `created_at`).

### 4.3 O que a planilha NÃO faz

- Não é fonte de verdade
- Editar célula / apagar linha / mudar “status” **não** altera o Postgres
- Próximo pipeline **apaga** formatação e alterações manuais (`overwriteRows`)
- Não grava `caption_error` nem stack do 9router
- Não separa abas “fila” vs “histórico”

---

## 5. Por que a UX da planilha parece terrível

Inferência direta do código (não opinião de design solta):

1. **Caption ~400 chars** na célula → linha alta, difícil escanear.
2. **Coluna `id` (UUID)** — ruído para operação diária.
3. **Status só binário** — tudo que não é `sent` vira `pendente` (some new/approved/sem link/failed).
4. **Pendente + enviado na mesma lista** — fila e histórico misturados.
5. **Reescrita total** — qualquer “arrumação” manual some.
6. **Sem título / preço / fonte** — só legenda + link; difícil reconhecer o produto.
7. **Link vazio** possível (caption ready, afiliado ainda falhou) → linha “meio morta”.

A fatia 06 pediu espelho **enxuto em schema** (4 colunas, mão única). Enxuto no schema ≠ legível para humano.

---

## 6. Specs e docs de referência

| Doc | O que fixa |
|------|------------|
| `docs/specs/spec-escala-disparos-fatia-06.md` | Espelho read-only, reescrita completa, colunas id/link/caption/status |
| `docs/prd/PRD-escala-disparos.md` (RF-10) | Planilha espelho somente-leitura; import morre |
| `docs/mvp/MVP-escala-disparos.md` | Mesma direção |
| `STATE.md` (escala-disparos) | Planilha = espelho reescrita completa; drops sheets_row/synced_at |
| `docs/SYSTEM-DESIGN.md` §4 | Fases do pipeline e mirror |

Testes: `tests/sheets-mirror.test.ts`, `tests/pipeline-caption.test.ts`, `tests/pipeline-run.test.ts`, `tests/caption-strip-urls.test.ts`.

---

## 7. Onde mexer (mapa para o plano futuro)

| Objetivo | Lugar natural |
|----------|----------------|
| Menos verbosidade / outro tom | System prompt em `src/lib/ai/caption.ts` |
| Estrutura fixa da legenda (gancho, preço, CTA) | Prompt + eventual pós-processo em `generateCaption` |
| Formato da mensagem no WA | `app_settings.message_template` + `enqueue.ts` |
| Colunas / labels da sheet | `MIRROR_HEADER` + loop em `mirrorToSheets` |
| Quem entra no espelho (só pendentes? limite menor?) | Query `.or(...)` + `MIRROR_LIMIT` |
| Status mais legível | Regra `status_espelho` no loop do mirror |
| Diagnóstico de caption failed | Já existe `caption_error` + UI ofertas/modal — **não** a planilha |

---

## 8. Direções de redesign (hipóteses — não decididas)

Para alimentar o PRD/plano; **não** são requisitos fechados:

| Hoje | Possível depois |
|------|-----------------|
| `id \| link \| caption \| status` | `titulo \| preco \| caption \| link \| status` (UUID opcional no fim ou omitido) |
| Caption 400 chars cômico | Caption mais curta e/ou estrutura fixa |
| Pendente + enviado juntos | Só pendentes no espelho; enviados outra aba / sumir / janela curta |
| 500 linhas reescritas | N recentes pendentes (ex. 30–50) |
| Status binário | `fila` / `sem link` / `enviado` / etc. |

---

## 9. Perguntas abertas (próximas investigações)

1. A planilha ainda é lida por humano no dia a dia, ou virou “arquivo morto” e a UX real é o dashboard?
2. Caption: prioridade é **menos texto**, **mais conversão**, ou **mais previsível** (template fixo)?
3. Espelho deve mostrar **só o que ainda não enviou**, ou histórico de enviados importa?
4. Vale manter Google Sheets, ou o dashboard de ofertas já cobre e a sheet pode encolher ao mínimo?
5. Precisamos de título/preço na sheet mesmo com caption já citando preço?

---

## 10. Commits / código âncora (paths)

```
src/lib/ai/caption.ts          — generateCaption, stripUrls, prompt
src/lib/pipeline/run.ts        — generateCaptions, mirrorToSheets, runOfferPipeline
src/lib/sheets/client.ts       — overwriteRows, isSheetsConfigured
src/lib/dispatch/enqueue.ts    — message_template + buildMessage
src/lib/dispatch/template.ts   — buildMessage, formatPriceCents
docs/specs/spec-escala-disparos-fatia-06.md
```

---

*Próximo passo combinado: investigar mais pontos em aberto e formular plano/PRD em cima deste documento.*
