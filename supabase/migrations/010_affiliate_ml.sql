-- Mercado Livre Afiliado: link curto meli.la/XXXX via sessão do portal
-- (env server-only ML_AFFILIATE_COOKIE/TAG/TOOL). Sem cookie, degrada para
-- link longo com matt_word/matt_tool.

alter table public.affiliate_providers
  drop constraint if exists affiliate_providers_kind_check;

alter table public.affiliate_providers
  add constraint affiliate_providers_kind_check
  check (kind in ('livelo', 'meliuz', 'generic', 'mercadolivre'));

insert into public.affiliate_providers (slug, name, kind, config)
values (
  'mercadolivre',
  'Mercado Livre Afiliado',
  'mercadolivre',
  '{"template":"{{url}}"}'::jsonb
)
on conflict (slug) do nothing;
