# Spec Técnica: [Fatia 07 - Auditoria de conexão WA]

> **Feature:** `escala-disparos` | **Status:** `PENDENTE` | **Data:** 2026-08-02

<!-- Arquivo: docs/specs/spec-escala-disparos-fatia-07.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Histórico auditável de estabilidade da conexão WhatsApp: tabela append-only de eventos escrita pelo worker nas transições de status, consultável em `/dashboard/bot`. Limpeza do schema morto `wa_session` (criado em `002`/`006`, nunca lido nem escrito). **O status vivo permanece na memória do worker** — invariante da entrevista; eventos são histórico, não status.
- **Limites da fatia:** 1 migration; worker: hook de transição em `session.ts` (~20 linhas); app: 1 rota nova + 1 card de lista no `/dashboard/bot`; 2 testes.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `supabase/migrations/015_wa_connection_events.sql`
  - `[MODIFY]` `worker/src/baileys/session.ts` — `setSessionStatus` (`:49`) detecta mudança efetiva de `status` e dispara insert fire-and-forget (todas as transições de `client.ts:116-215` já passam por aqui — 1 ponto de escuta, não 6)
  - `[MODIFY]` `worker/src/db.ts` — reuso do `rest()` da Fatia 01 (se a Fatia 01 ainda não tiver sido implementada, a extração do helper acontece aqui — o primeiro que chegar extrai)
  - `[NEW]` `src/app/api/bot/events/route.ts` — `GET`, `requireUser`, últimos 50 eventos
  - `[MODIFY]` `src/components/SessionPanel.tsx` — card "Histórico de conexão" (apenas na instância de `/dashboard/bot`, via prop `showHistory`; a duplicata em `/dashboard/grupos` não o exibe)
  - `[NEW]` `tests/worker-connection-events.test.ts` · `[NEW]` `tests/bot-events-api.test.ts`
- **Símbolos e funções afetadas:**
  - `setSessionStatus` (`worker/src/baileys/session.ts:49-81`) · `state.status` (transição = `status !== state.status` antes da atribuição)
  - `handleConnectionUpdate` (`worker/src/baileys/client.ts:116`) — **não é tocado** (o hook central em `setSessionStatus` cobre `qr`, `connected`, `logged_out`, `waiting_pairing`, `disconnected`, `connecting`)

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- 015_wa_connection_events.sql
  drop table if exists public.wa_session;  -- schema morto (auditoria 2026-08-01)

  create table if not exists public.wa_connection_events (
    id bigint generated always as identity primary key,
    status text not null check (status in (
      'disconnected','waiting_pairing','qr','connecting','connected','logged_out'
    )),
    detail text,          -- lastError da transição, quando houver
    at timestamptz not null default now()
  );
  create index if not exists wa_connection_events_at_idx
    on public.wa_connection_events (at desc);

  alter table public.wa_connection_events enable row level security;
  create policy "wa_connection_events_select_authenticated"
    on public.wa_connection_events for select
    to authenticated using (true);
  -- insert: só service_role (worker), sem policy de escrita
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - Worker: `logConnectionEvent(status, detail)` — `POST wa_connection_events` via `rest()`, **fire-and-forget com catch silencioso** (telemetria nunca pode derrubar a máquina de conexão — mesma filosofia do `saveCreds().catch()` em `client.ts:274`). Sem envs Supabase → no-op (dev multi-file continua funcionando).
  - Deduplicação de ruído: só grava quando o `status` efetivamente muda (reconexões em loop geram 1 evento por transição real, não por tentativa).
  - App: `GET /api/bot/events` → `{events: [{id, status, detail, at}]}`, `order at desc, limit 50`, `requireUser` (RLS select para authenticated cobre).
- **Guardas CI:** worker testado com `fetch` mockado; rota testada com Supabase mockado (padrão dos testes existentes `bot-*`).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:** card "Histórico de conexão" no `/dashboard/bot` abaixo do `SessionPanel`: lista compacta (badge de status na cor do `SessionBadge` existente + timestamp em Fortaleza + `detail` truncado). Carrega no mount e no clique de "Atualizar" — **sem polling** (histórico não é tempo-real; o status vivo já tem o poll de 4s).
- **Estados Visuais:** loading (skeleton curto), empty ("Nenhum evento registrado ainda"), error (mensagem + retry), success (lista). Scroll interno com `max-height` no padrão Neo-brutalism das outras listas.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **`tests/worker-connection-events.test.ts`:** transição `connecting→connected` gera 1 POST com status/detail corretos; `setSessionStatus` repetido com mesmo status não gera evento; falha do POST não lança (fire-and-forget); sem envs → nenhum fetch.
- [ ] **`tests/bot-events-api.test.ts`:** sem auth → 401 (padrão `requireUser`); com auth → lista ordenada desc limitada a 50.
- [ ] **Integração Backend + UI:** evento inserido no banco aparece no card após "Atualizar"; queda real de conexão (simulada) fica auditável com timestamp e motivo.
- [ ] **Validação Estrita:** `tsc`, `worker:typecheck`, `lint`, `vitest run` verdes; grep confirma zero referências a `wa_session` (fora de migrations históricas).

## 6. Checkpoint de Execução
- **Status:** `PENDENTE`
- **Concluído:** —
- **Pendente:** migration 015 · hook em `setSessionStatus` · rota `/api/bot/events` · card no dashboard · testes
- **Próximo comando:** `/sdd-implement`
