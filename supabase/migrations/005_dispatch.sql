create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  daily_cap int not null default 35,
  hourly_cap int not null default 10,
  min_interval_sec int not null default 45,
  message_template text not null default
    E'🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

do $$ begin
  create type public.dispatch_status as enum (
    'queued', 'sending', 'sent', 'failed', 'skipped'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id),
  group_id uuid not null references public.wa_groups(id),
  affiliate_link_id uuid not null references public.affiliate_links(id),
  status public.dispatch_status not null default 'queued',
  message_body text not null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists dispatch_jobs_status_sched_idx
  on public.dispatch_jobs (status, scheduled_for);

create index if not exists dispatch_jobs_offer_group_idx
  on public.dispatch_jobs (offer_id, group_id, created_at desc);

create unique index if not exists dispatch_jobs_one_sent_per_day
  on public.dispatch_jobs (
    offer_id,
    group_id,
    ((timezone('UTC', sent_at))::date)
  )
  where status = 'sent' and sent_at is not null;

alter table public.app_settings enable row level security;
alter table public.dispatch_jobs enable row level security;

create policy "app_settings_all_authenticated"
  on public.app_settings for all
  to authenticated
  using (true)
  with check (true);

create policy "dispatch_jobs_all_authenticated"
  on public.dispatch_jobs for all
  to authenticated
  using (true)
  with check (true);
