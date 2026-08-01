-- Janela de descanso dos disparos (horário America/Sao_Paulo, formato HH:MM).
-- null = desativada.
alter table public.app_settings add column if not exists sleep_start text;
alter table public.app_settings add column if not exists sleep_end text;
