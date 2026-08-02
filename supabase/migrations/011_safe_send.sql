-- Envio seguro: dedupe durável de jobs entregues + retry/reaper.
-- wa_sent_jobs é a verdade durável de "este job já chegou no WhatsApp";
-- o Set em memória do worker é só fast-path (some no restart).
create table if not exists public.wa_sent_jobs (
  job_id uuid primary key,
  sent_at timestamptz not null default now()
);

alter table public.wa_sent_jobs enable row level security;
-- sem policy: só service_role (mesmo padrão de wa_session_keys)

alter table public.dispatch_jobs
  add column if not exists attempts int not null default 0,
  add column if not exists claimed_at timestamptz;
