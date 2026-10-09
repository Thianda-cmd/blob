-- CV builder (Lebenslauf): a page can also be a CV. Its content is the CV as JSON (src/cv/types.ts),
-- so CVs get autosave, the trash, search and favourites like notes and presentations.
-- Written so it can be run again safely.

alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check check (kind in ('note', 'deck', 'cv'));
