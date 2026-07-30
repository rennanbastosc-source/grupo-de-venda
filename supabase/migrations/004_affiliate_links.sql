create table if not exists public.affiliate_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('livelo', 'meliuz', 'generic')),
  config jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.offers(id) on delete set null,
  provider_id uuid not null references public.affiliate_providers(id),
  original_url text not null,
  affiliate_url text not null,
  status text not null default 'ok' check (status in ('ok', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_links_offer_id_idx
  on public.affiliate_links (offer_id);

alter table public.affiliate_providers enable row level security;
alter table public.affiliate_links enable row level security;

create policy "affiliate_providers_all_authenticated"
  on public.affiliate_providers for all
  to authenticated
  using (true)
  with check (true);

create policy "affiliate_links_all_authenticated"
  on public.affiliate_links for all
  to authenticated
  using (true)
  with check (true);

insert into public.affiliate_providers (slug, name, kind, config)
values
  (
    'generic-tag',
    'Generic tag',
    'generic',
    '{"template":"{{url}}","params":{"tag":"gdv"}}'::jsonb
  ),
  (
    'livelo',
    'Livelo',
    'livelo',
    '{"template":"{{url}}","params":{"utm_source":"livelo"}}'::jsonb
  ),
  (
    'meliuz',
    'Méliuz',
    'meliuz',
    '{"template":"{{url}}","params":{"utm_source":"meliuz"}}'::jsonb
  )
on conflict (slug) do nothing;
