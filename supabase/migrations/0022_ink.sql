-- Handwritten notes (pages of kind 'ink'): written and drawn with a pen or a finger, on sheets of
-- paper with lines, a grid or dots. See src/ink.
--
-- What is on them lives in ink_items, one row per thing: a sheet (one page of paper and its
-- template), a stroke, a picture or a text box. The device makes up the ids, so writing offline and
-- sending it later (or twice) is safe. Removing something keeps a "deleted" mark for a while, so
-- devices that were away learn about it. Everyone on the page writes through ink_push() and reads
-- through ink_pull() (one access check per call instead of one per row); Realtime tells the others
-- right away. pages.content keeps a small preview for lists, pages.plain_text the typed words.

alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check check (kind in ('note', 'deck', 'cv', 'folder', 'ink'));

create table if not exists public.ink_items (
  page_id uuid not null references public.pages (id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('sheet', 'stroke', 'image', 'text')),
  -- The sheet a stroke, picture or text box is on (null for sheets).
  sheet uuid,
  -- Order: sheets top to bottom, everything else back to front.
  seq double precision not null default 0,
  -- What it is (src/ink/model.ts): a stroke's pen, colour, size and points, a sheet's template…
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (page_id, id),
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000)
);

create index if not exists ink_items_page_updated_idx on public.ink_items (page_id, updated_at, id);

alter table public.ink_items enable row level security;

-- Reading goes through ink_pull(); this policy is what Realtime checks before it tells someone.
drop policy if exists "ink_items: read" on public.ink_items;
create policy "ink_items: read" on public.ink_items for select to authenticated
  using (public.page_role(page_id) is not null);

grant select on public.ink_items to authenticated;
revoke insert, update, delete on public.ink_items from authenticated;
revoke all on public.ink_items from anon;

/**
 * Save things on a handwritten note: each item in p_items ({id, kind, sheet, seq, data, deleted})
 * replaces the stored one with the same id. Owners and editors only. Returns {ok, at}.
 */
create or replace function public.ink_push(p_page uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  page_kind text;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select kind into page_kind from public.pages where id = p_page;
  if page_kind is distinct from 'ink' then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 or octet_length(p_items::text) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;

  -- The same id twice in one call: the later one counts.
  insert into public.ink_items as i (page_id, id, kind, sheet, seq, data, deleted, updated_by, updated_at)
  select distinct on (x.id)
    p_page, x.id, x.kind, x.sheet, coalesce(x.seq, 0),
    case when x.deleted then '{}'::jsonb else coalesce(x.data, '{}'::jsonb) end,
    x.deleted, me, now()
  from (
    select (e.item ->> 'id')::uuid as id, e.item ->> 'kind' as kind, (e.item ->> 'sheet')::uuid as sheet,
           (e.item ->> 'seq')::double precision as seq, e.item -> 'data' as data,
           coalesce((e.item ->> 'deleted')::boolean, false) as deleted, e.n
    from jsonb_array_elements(p_items) with ordinality as e(item, n)
  ) x
  where x.id is not null
  order by x.id, x.n desc
  on conflict (page_id, id) do update
    set kind = excluded.kind, sheet = excluded.sheet, seq = excluded.seq, data = excluded.data,
        deleted = excluded.deleted, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  -- The note moves up in lists (at most once a minute while someone writes).
  update public.pages set updated_at = now() where id = p_page and updated_at < now() - interval '1 minute';
  return jsonb_build_object('ok', true, 'at', now());
end;
$$;

/**
 * Read a handwritten note: items changed after (p_at, p_id), oldest first, at most p_limit. With
 * p_full only what is there (a first load), otherwise deleted ones too (catching up). `more` says
 * whether another call (from the last item's updated_at and id) has more. `stale` asks for a full
 * load: deleted marks older than 60 days may be gone (src/app/api/cron/files tidies them).
 */
create or replace function public.ink_pull(p_page uuid, p_at timestamptz default null, p_id uuid default null, p_full boolean default true, p_limit integer default 2000)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  rows jsonb;
  n integer;
begin
  if public.page_role(p_page) is null then
    return null;
  end if;
  if not p_full and p_at is not null and p_at < now() - interval '60 days' then
    return jsonb_build_object('stale', true, 'items', '[]'::jsonb, 'more', false, 'now', now());
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'kind', i.kind, 'sheet', i.sheet, 'seq', i.seq, 'data', i.data,
           'deleted', i.deleted, 'updated_at', i.updated_at, 'updated_by', i.updated_by
         ) order by i.updated_at, i.id), '[]'::jsonb), count(*)
  into rows, n
  from (
    select * from public.ink_items
    where page_id = p_page
      and (p_at is null or (updated_at, id) > (p_at, coalesce(p_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      and (not p_full or not deleted)
    order by updated_at, id
    limit lim
  ) i;
  return jsonb_build_object('items', rows, 'more', n >= lim, 'now', now());
end;
$$;

/** What a public link shows of a handwritten note: everything on it (see public_page, migration 0019). */
create or replace function public.public_ink(p_token text, p_page uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  link public.public_links;
  target uuid;
begin
  link := public.public_link_for(p_token, p_page);
  if link.token is null then
    return null;
  end if;
  target := coalesce(p_page, link.page_id);
  if (select kind from public.pages where id = target) is distinct from 'ink' then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'sheet', i.sheet, 'seq', i.seq, 'data', i.data) order by i.seq, i.id)
    from (select * from public.ink_items where page_id = target and not deleted order by seq, id limit 60000) i
  ), '[]'::jsonb);
end;
$$;

-- Pictures on handwritten notes are files too ----------------------------------------------------

/** Whether any note, card or handwritten note refers to this file (see migration 0013). */
create or replace function public.file_in_use(p_name text, p_except_page uuid default null, p_except_project uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pages p
    where p.file_refs @> jsonb_build_array(p_name) and p.id is distinct from p_except_page
  )
  or exists (
    select 1 from public.tasks t
    where t.file_refs @> jsonb_build_array(p_name) and t.project_id is distinct from p_except_project
  )
  or case
    when p_name ~* '^page/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
      -- A file block someone just added while working together, not yet in the stored note.
      exists (
        select 1 from public.page_steps s
        where s.page_id = split_part(p_name, '/', 2)::uuid and strpos(s.steps::text, p_name) > 0
      )
      -- A picture on a handwritten note (its own page's folder).
      or exists (
        select 1 from public.ink_items i
        where i.page_id = split_part(p_name, '/', 2)::uuid and i.kind = 'image' and not i.deleted
          and i.data ->> 'path' = p_name and i.page_id is distinct from p_except_page
      )
    else false
  end;
$$;

/** Whether a public link may hand out the file at p_path: it belongs to a page the link opens. */
create or replace function public.public_file(p_token text, p_page uuid, p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (public.public_link_for(p_token, p_page)).token is null or p_path is null then
    return false;
  end if;
  return exists (select 1 from public.pages p where p.id = p_page and p.file_refs @> jsonb_build_array(p_path))
    or exists (
      select 1 from public.ink_items i
      where i.page_id = p_page and i.kind = 'image' and not i.deleted and i.data ->> 'path' = p_path
    );
end;
$$;

-- Live updates ---------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ink_items') then
    alter publication supabase_realtime add table public.ink_items;
  end if;
end $$;

revoke all on function public.ink_push(uuid, jsonb) from public, anon;
revoke all on function public.ink_pull(uuid, timestamptz, uuid, boolean, integer) from public, anon;
revoke all on function public.public_ink(text, uuid) from public;
grant execute on function public.ink_push(uuid, jsonb) to authenticated;
grant execute on function public.ink_pull(uuid, timestamptz, uuid, boolean, integer) to authenticated;
grant execute on function public.public_ink(text, uuid) to anon, authenticated;
