-- Limpeza de schema morto: wa_session (criada em 002/006) nunca foi lida
-- nem escrita por código algum — o status vivo mora na memória do worker.
drop table if exists public.wa_session;

-- Auditoria de estabilidade: log append-only das transições de conexão,
-- escrito pelo worker (service role) e lido pelo dashboard.
create table if not exists public.wa_connection_events (
  id bigint generated always as identity primary key,
  status text not null check (status in (
    'disconnected',
    'waiting_pairing',
    'qr',
    'connecting',
    'connected',
    'logged_out'
  )),
  detail text,
  at timestamptz not null default now()
);

create index if not exists wa_connection_events_at_idx
  on public.wa_connection_events (at desc);

alter table public.wa_connection_events enable row level security;

create policy "wa_connection_events_select_authenticated"
  on public.wa_connection_events for select
  to authenticated
  using (true);
-- insert: só service_role (worker), sem policy de escrita
