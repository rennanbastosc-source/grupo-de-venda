create table if not exists public.marketplace_sessions (
  source public.scrape_source primary key
    check (source in ('mercadolivre', 'amazon', 'shopee')),
  cookies jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'unknown'
    check (status in ('ok', 'expired', 'error', 'unknown')),
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.marketplace_sessions enable row level security;

create policy "marketplace_sessions_all_authenticated"
  on public.marketplace_sessions for all
  to authenticated
  using (true)
  with check (true);
