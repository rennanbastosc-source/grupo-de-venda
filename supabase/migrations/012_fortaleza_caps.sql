-- Fuso único America/Fortaleza (UTC-3 fixo) + caps duplos.
-- daily_cap segue sendo mensagens/dia; daily_offer_cap é ofertas distintas/dia.
alter table public.app_settings
  add column if not exists daily_offer_cap int not null default 10;

-- Janela operacional default: silêncio 23:01–06:59 (07:00–23:00 ativo)
update public.app_settings
  set sleep_start = coalesce(sleep_start, '23:01'),
      sleep_end   = coalesce(sleep_end,   '06:59')
  where id = 1;

-- Unicidade diária no mesmo relógio dos contadores (antes: UTC).
drop index if exists public.dispatch_jobs_one_sent_per_day;
create unique index dispatch_jobs_one_sent_per_day
  on public.dispatch_jobs (
    offer_id,
    group_id,
    ((timezone('America/Fortaleza', sent_at))::date)
  )
  where status = 'sent' and sent_at is not null;
