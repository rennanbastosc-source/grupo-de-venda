do $$ begin
  create type public.offer_status as enum ('new', 'approved', 'rejected', 'sent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scrape_source as enum (
    'mercadolivre', 'amazon', 'shopee', 'magalu', 'manual'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  source public.scrape_source not null,
  external_id text,
  title text not null,
  price_cents int,
  currency text default 'BRL',
  url text not null,
  url_canonical text not null,
  image_url text,
  status public.offer_status not null default 'new',
  raw jsonb,
  scraped_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, url_canonical)
);

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source public.scrape_source not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  items_found int default 0,
  items_upserted int default 0,
  error text
);

create index if not exists offers_status_idx on public.offers (status);
create index if not exists offers_source_idx on public.offers (source);

alter table public.offers enable row level security;
alter table public.scrape_runs enable row level security;

create policy "offers_all_authenticated"
  on public.offers for all
  to authenticated
  using (true)
  with check (true);

create policy "scrape_runs_all_authenticated"
  on public.scrape_runs for all
  to authenticated
  using (true)
  with check (true);
