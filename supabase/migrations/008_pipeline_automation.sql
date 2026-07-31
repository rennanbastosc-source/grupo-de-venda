-- original_price se faltar
alter table public.offers add column if not exists original_price_cents int;

alter table public.offers add column if not exists caption text;
alter table public.offers add column if not exists caption_status text not null default 'none'
  check (caption_status in ('none','pending','ready','failed'));
alter table public.offers add column if not exists sheets_row int;
alter table public.offers add column if not exists sheets_synced_at timestamptz;

alter table public.app_settings add column if not exists auto_dispatch_enabled boolean not null default false;
alter table public.app_settings add column if not exists auto_dispatch_group_ids uuid[] not null default '{}';
alter table public.app_settings add column if not exists default_affiliate_provider_id uuid references public.affiliate_providers(id);

create index if not exists offers_caption_status_idx on public.offers (caption_status);
create index if not exists offers_sheets_synced_idx on public.offers (sheets_synced_at nulls first);
