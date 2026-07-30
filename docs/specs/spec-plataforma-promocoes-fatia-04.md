# Spec Técnica: Fatia 04 - Painel de Links Promocionais (Afiliados)

> **Feature:** `plataforma-promocoes` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-04.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Cadastro de provedores de afiliado/cashback (Livelo, Méliuz, encurtador genérico); serviço de emissão `URL original → URL afiliada`; histórico de emissões ligado à oferta; **invariante:** qualquer caminho de disparo futuro exige `affiliate_links` válido (gate reutilizado na Fatia 05); secrets de API/templates em env, não no client.
- **Limites da fatia:** Sem envio WhatsApp. Integrações reais quando houver API/doc; senão adapter com template de URL (query params de afiliado) + marca `provider` — sem inventar credenciais. Tracking de clique pós-envio = nice-to-have (fora).

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `src/lib/affiliates/types.ts`, `providers/livelo.ts`, `meliuz.ts`, `generic.ts`, `registry.ts`, `emit.ts`
  - `[NEW]` `src/app/api/affiliate-providers/route.ts`
  - `[NEW]` `src/app/api/affiliate-links/route.ts` (POST emit, GET history)
  - `[NEW]` `src/app/(dashboard)/dashboard/links/page.tsx`
  - `[NEW]` migration `affiliate_providers`, `affiliate_links`
  - `[MODIFY]` `offers` UI: ação “gerar link afiliado”
  - `[NEW]` `src/lib/affiliates/require-link.ts` — `assertOfferHasAffiliateLink(offerId)`
- **Símbolos e funções afetadas:**
  - `emitAffiliateLink(offerId | url, providerId)`
  - `AffiliateProvider`, `AffiliateLink`
  - `assertOfferHasAffiliateLink`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  create table public.affiliate_providers (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,         -- livelo | meliuz | generic-...
    name text not null,
    kind text not null check (kind in ('livelo','meliuz','generic')),
    config jsonb not null default '{}',-- template, base_url (sem secrets)
    active boolean not null default true,
    created_at timestamptz not null default now()
  );

  create table public.affiliate_links (
    id uuid primary key default gen_random_uuid(),
    offer_id uuid references public.offers(id) on delete set null,
    provider_id uuid not null references public.affiliate_providers(id),
    original_url text not null,
    affiliate_url text not null,
    status text not null default 'ok' check (status in ('ok','failed')),
    error text,
    created_at timestamptz not null default now()
  );
  create index on public.affiliate_links (offer_id);
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - `GET/POST /api/affiliate-providers` (admin; POST seed/config não-secreta)
  - `POST /api/affiliate-links` `{ offerId?: string, url?: string, providerId: string }` → `{ id, affiliateUrl }`
  - `GET /api/affiliate-links?offerId=`
  - `emitAffiliateLink`:
    1. resolve URL (oferta ou body)
    2. carrega provider ativo
    3. chama adapter (HTTP API ou template `{{url}}` + params)
    4. persiste `affiliate_links`
  - Secrets: `LIVELO_*`, `MELIUZ_*`, etc. só server.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** página Links — lista emissões; form “emitir” (URL ou oferta + provider); lista providers ativos (read-only se seed via env/migration).
- **Estados Visuais:** loading emit; erro provider; success com URL copiável.
- **Acessibilidade:** botão copiar com feedback textual.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/emit-affiliate-link.test.ts` — template generic reescreve URL; provider inativo falha; `assertOfferHasAffiliateLink` true/false.
- [ ] **Integração Backend + UI:** emitir a partir de oferta aprovada grava histórico; UI lista.
- [ ] **Validação Estrita:** tsc, lint, test.
- [ ] **Aceite:** zero secret no bundle client; falha de provider → `status=failed` + mensagem.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** migration affiliate_*, adapters template, emit API, UI links + ação em ofertas, assertOfferHasAffiliateLink, testes
- **Pendente:** —
- **Próximo comando:** `/sdd-finish`

## 7. As-Built
- Tables `affiliate_providers`, `affiliate_links`; seed generic/livelo/meliuz (template URL).
- `emitAffiliateLink` + `assertOfferHasAffiliateLink` (gate fatia 05).
- APIs `/api/affiliate-providers`, `/api/affiliate-links`; UI `LinksManager` + ação em ofertas.
- APIs reais Livelo/Méliuz adiado (`ponytail:`) até credenciais.
