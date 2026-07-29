create table if not exists public.wa_groups (
  id uuid primary key default gen_random_uuid(),
  jid text not null unique,
  name text not null,
  active boolean not null default true,
  daily_limit int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wa_session (
  id int primary key default 1 check (id = 1),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'qr', 'connecting', 'connected')),
  qr_payload text,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.wa_session (id, status)
values (1, 'disconnected')
on conflict (id) do nothing;

alter table public.wa_groups enable row level security;
alter table public.wa_session enable row level security;

create policy "wa_groups_all_authenticated"
  on public.wa_groups for all
  to authenticated
  using (true)
  with check (true);

create policy "wa_session_select_authenticated"
  on public.wa_session for select
  to authenticated
  using (true);
