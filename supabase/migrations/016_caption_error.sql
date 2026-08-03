-- Motivo legível da última falha de caption (UI modal). Limpo quando ready.
alter table public.offers
  add column if not exists caption_error text;
