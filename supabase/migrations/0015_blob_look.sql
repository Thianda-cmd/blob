-- What Blob wears for each student (hat, glasses, neck, colour, secrets found), picked in Blob's
-- corner. Cosmetic only; kept small.
alter table public.profiles
  add column if not exists blob_look jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_blob_look_small;
alter table public.profiles
  add constraint profiles_blob_look_small check (jsonb_typeof(blob_look) = 'object' and octet_length(blob_look::text) <= 2000);
