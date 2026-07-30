-- Credenciais Baileys (keys Signal + creds) cifradas no worker.
create table if not exists public.wa_session_keys (
  id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.wa_session_keys enable row level security;
-- sem policy para authenticated: só service_role (bypass RLS)

alter table public.wa_session drop constraint if exists wa_session_status_check;
alter table public.wa_session
  add constraint wa_session_status_check
  check (status in (
    'disconnected',
    'waiting_pairing',
    'qr',
    'connecting',
    'connected',
    'logged_out'
  ));

alter table public.wa_session
  add column if not exists pairing_code text,
  add column if not exists pairing_code_at timestamptz,
  add column if not exists phone text;
