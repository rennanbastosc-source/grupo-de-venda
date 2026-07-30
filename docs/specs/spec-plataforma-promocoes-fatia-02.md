# Spec Técnica: Fatia 02 - Grupos WhatsApp + Sessão Baileys

> **Feature:** `plataforma-promocoes` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-02.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Worker long-running Baileys (fora da Vercel serverless) com sessão persistente; dashboard mostra status (`disconnected` | `qr` | `connecting` | `connected`) e QR; CRUD de grupos WhatsApp (jid, nome, ativo, limite_diario opcional); API autenticada dashboard ↔ worker (token shared secret); se sessão ≠ connected, envios futuros devem poder ser pausados (flag/status lido pela Fatia 05).
- **Limites da fatia:** Sem scrap, afiliados ou fila de disparo real. Worker só conecta + expõe status/QR + (opcional) lista grupos do WA para facilitar cadastro. Sem envio em massa.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `worker/` (ou `apps/worker/`) — `package.json`, `src/index.ts`, `src/baileys/session.ts`, `src/baileys/client.ts`, `src/http/server.ts`
  - `[NEW]` `worker/src/auth.ts` — valida `WORKER_API_SECRET`
  - `[NEW]` tabelas via migration Supabase: `wa_groups`, `wa_session_state` (ou status em Redis/arquivo + espelho no DB)
  - `[NEW]` `src/app/(dashboard)/dashboard/grupos/page.tsx` (UI real)
  - `[NEW]` `src/app/(dashboard)/dashboard/bot/page.tsx` ou seção no overview: QR + status
  - `[NEW]` `src/app/api/bot/status/route.ts`, `src/app/api/bot/qr/route.ts` (proxy → worker ou lê DB)
  - `[NEW]` `src/app/api/groups/route.ts`, `src/app/api/groups/[id]/route.ts`
  - `[NEW]` `src/lib/worker-client.ts`
  - `[MODIFY]` `Sidebar.tsx` — link Bot/Sessão se separado
- **Símbolos e funções afetadas:**
  - `startBaileys`, `getConnectionState`, `getQrDataUrl`
  - `listGroups`, `createGroup`, `updateGroup`, `deleteGroup` (soft: `active=false`)
  - `WaGroup`, `WaSessionStatus`

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  create table public.wa_groups (
    id uuid primary key default gen_random_uuid(),
    jid text not null unique,          -- ex: 120363...@g.us
    name text not null,
    active boolean not null default true,
    daily_limit int,                   -- null = usa global
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.wa_session (
    id int primary key default 1 check (id = 1), -- singleton
    status text not null default 'disconnected'
      check (status in ('disconnected','qr','connecting','connected')),
    qr_payload text,                   -- data-url ou string QR (TTL curto)
    last_error text,
    updated_at timestamptz not null default now()
  );
  -- Sessão Baileys auth state: prefer auth dir no disco do worker;
  -- opcional: bytes em R2/Supabase storage se multi-host.
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - Worker (HTTP interno, secret header `x-worker-secret`):
    - `GET /health`
    - `GET /session` → `{ status, hasQr }`
    - `GET /session/qr` → `{ qrDataUrl | null }`
    - `POST /session/logout` (opcional)
  - Dashboard (auth Supabase):
    - `GET/POST /api/groups`, `PATCH/DELETE /api/groups/:id`
    - `GET /api/bot/status`, `GET /api/bot/qr` (proxy ou DB poll)
  - Env worker: `WORKER_API_SECRET`, `PORT`, paths de auth Baileys; dashboard: `WORKER_BASE_URL`, `WORKER_API_SECRET`.

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:**
  - Página Grupos: tabela (nome, jid, ativo, limite), form criar/editar, toggle ativo.
  - Bloco Sessão: badge status, imagem QR quando `qr`, botão “atualizar”, mensagem de erro.
- **Estados Visuais:** Loading lista; empty “nenhum grupo”; erro worker offline; QR expirado → refresh.
- **Acessibilidade:** labels jid/nome; botões com texto; status com texto além de cor.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/groups-api.test.ts` — CRUD + jid unique; `tests/session-status.test.ts` — mapeamento status.
- [ ] **Integração Backend + UI:** criar grupo ativo aparece na lista; status desconectado sem QR; com QR mock aparece imagem.
- [ ] **Validação Estrita:** tsc, lint, test; worker typecheck se package separado.
- [ ] **Aceite:** admin cadastra grupo; vê status Baileys; worker rejeita request sem secret.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** worker Baileys + secret HTTP, migration wa_groups/wa_session, CRUD groups API+UI, bot status/QR, testes groups/session/worker-auth
- **Pendente:** —
- **Próximo comando:** `/sdd-finish`

## 7. As-Built
- Package `worker/` separado (`@whiskeysockets/baileys`); HTTP secret `x-worker-secret`.
- Endpoints worker: `/session`, `/session/qr`, `/session/start|logout`, `/send` (fatia 05).
- App: `GET /api/bot/status|qr` proxy; `GET/POST /api/groups`, `PATCH/DELETE /api/groups/[id]`.
- UI: `SessionPanel`, `GroupsManager`; `canDispatch` só se `connected`.
