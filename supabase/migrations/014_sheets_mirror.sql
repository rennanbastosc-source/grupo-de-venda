-- Planilha rebaixada a espelho somente-leitura com reescrita completa:
-- o rastreio por linha (sheets_row/sheets_synced_at) deixa de existir.
alter table public.offers
  drop column if exists sheets_row,
  drop column if exists sheets_synced_at;

drop index if exists public.offers_sheets_synced_idx;
