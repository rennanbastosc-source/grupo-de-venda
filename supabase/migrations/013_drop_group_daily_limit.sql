-- Grupos são espelhados (toda oferta vai para todos): limite por grupo
-- não faz sentido e a coluna nunca foi lida por nenhum gate.
alter table public.wa_groups drop column if exists daily_limit;
