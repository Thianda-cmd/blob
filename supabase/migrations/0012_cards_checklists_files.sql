-- Known gaps of the notes and projects round, closed.
--
-- 1. Flashcards in your own words are saved with your account (they were kept in one browser).
-- 2. Checklists on cards change one item at a time on the server, so two people ticking, adding or
--    renaming items at once don't overwrite each other.
-- 3. Files nobody uses any more can be found and removed: files of a note or project that no block
--    or card refers to, and files whose note or project is gone.

-- Flashcards in your own words ----------------------------------------------------------------------

create table if not exists public.card_edits (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 64),
  front text not null default '' check (char_length(front) <= 4000),
  back text not null default '' check (char_length(back) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, page_id, card_id)
);

alter table public.card_edits enable row level security;
drop policy if exists "card_edits: own rows" on public.card_edits;
-- Your own wording, for notes you can read (like card_reviews).
create policy "card_edits: own rows" on public.card_edits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.page_role(page_id) is not null);

grant select, insert, update, delete on public.card_edits to authenticated;
revoke all on public.card_edits from anon;

-- Checklists, one change at a time ---------------------------------------------------------------

/**
 * Change one checklist item of a card and return the whole checklist as it is now (null when you
 * can't change the card). p_op:
 *   'add'    a new item p_item with p_text (and p_done) at p_index (default: the end); nothing if it exists
 *   'set'    the item's text (p_text) and/or tick (p_done), whichever is given
 *   'remove' the item
 *   'move'   the item to p_index (counted without it)
 * Items are { id, text, done }. Runs with the caller's rights: who may change the card decides.
 */
create or replace function public.task_checklist(
  p_task uuid, p_op text, p_item text, p_text text default null, p_done boolean default null, p_index integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cur jsonb;
  item jsonb;
  pos integer;
  n integer;
begin
  if p_item is null or char_length(p_item) not between 1 and 64 then
    raise exception 'task_checklist: bad item id' using errcode = '22023';
  end if;
  -- Locks the card for this change (and finds nothing for people who can't change it).
  select t.checklist into cur from public.tasks t where t.id = p_task for update;
  if not found then
    return null;
  end if;
  cur := coalesce(cur, '[]'::jsonb);
  select (e.ord - 1)::integer into pos
  from jsonb_array_elements(cur) with ordinality as e(v, ord)
  where e.v ->> 'id' = p_item
  limit 1;

  if p_op = 'add' then
    if pos is not null or jsonb_array_length(cur) >= 100 then
      return cur;
    end if;
    item := jsonb_build_object('id', p_item, 'text', left(coalesce(p_text, ''), 500), 'done', coalesce(p_done, false));
    n := jsonb_array_length(cur);
    pos := least(greatest(coalesce(p_index, n), 0), n);
    select coalesce(jsonb_agg(x.v order by x.o), '[]'::jsonb) into cur
    from (
      select e.v, (e.ord - 1)::numeric as o from jsonb_array_elements(cur) with ordinality as e(v, ord)
      union all
      select item, pos - 0.5
    ) x;
  elsif pos is null then
    -- Someone else removed it already.
    return cur;
  elsif p_op = 'set' then
    item := cur -> pos;
    if p_text is not null then
      item := jsonb_set(item, '{text}', to_jsonb(left(p_text, 500)));
    end if;
    if p_done is not null then
      item := jsonb_set(item, '{done}', to_jsonb(p_done));
    end if;
    cur := jsonb_set(cur, array[pos::text], item);
  elsif p_op = 'remove' then
    cur := cur - pos;
  elsif p_op = 'move' then
    item := cur -> pos;
    cur := cur - pos;
    n := jsonb_array_length(cur);
    pos := least(greatest(coalesce(p_index, n), 0), n);
    select coalesce(jsonb_agg(x.v order by x.o), '[]'::jsonb) into cur
    from (
      select e.v, (e.ord - 1)::numeric as o from jsonb_array_elements(cur) with ordinality as e(v, ord)
      union all
      select item, pos - 0.5
    ) x;
  else
    raise exception 'task_checklist: unknown change %', p_op using errcode = '22023';
  end if;

  update public.tasks set checklist = cur where id = p_task;
  return cur;
end;
$$;

-- Files nobody uses ----------------------------------------------------------------------------------

/**
 * Files in the folder of a page or project you can edit ("page/<id>/…", "project/<id>/…") that no
 * note and no card refers to, uploaded more than p_min_age ago (so a file whose block is still on
 * its way, or was just removed and may come back with undo, stays). p_whole: the page or project
 * is about to be deleted, so its own references don't count.
 */
create or replace function public.unused_files(p_kind text, p_id uuid, p_min_age interval default interval '1 day', p_whole boolean default false)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('page', 'project') or not public.file_access(p_kind, p_id::text, true) then
    return;
  end if;
  return query
    select o.name
    from storage.objects o
    where o.bucket_id = 'files'
      and o.name like p_kind || '/' || p_id::text || '/%'
      and o.created_at < now() - greatest(p_min_age, interval '0')
      and not exists (
        select 1 from public.pages p
        where strpos(p.content::text, o.name) > 0 and not (p_whole and p_kind = 'page' and p.id = p_id)
      )
      and not exists (
        select 1 from public.tasks t
        where strpos(t.attachments::text, o.name) > 0 and not (p_whole and p_kind = 'project' and t.project_id = p_id)
      );
end;
$$;

/**
 * For the nightly clean-up (server only): files whose page or project no longer exists, uploaded
 * more than a day ago, and that nothing else refers to.
 */
create or replace function public.orphan_files(p_limit integer default 1000)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'files'
    and o.created_at < now() - interval '1 day'
    and (
      (split_part(o.name, '/', 1) = 'page'
        and not exists (select 1 from public.pages p where p.id::text = split_part(o.name, '/', 2)))
      or (split_part(o.name, '/', 1) = 'project'
        and not exists (select 1 from public.projects p where p.id::text = split_part(o.name, '/', 2)))
    )
    and not exists (select 1 from public.pages p where strpos(p.content::text, o.name) > 0)
    and not exists (select 1 from public.tasks t where strpos(t.attachments::text, o.name) > 0)
  order by o.created_at
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

-- Data API access ------------------------------------------------------------------------------

revoke execute on function public.task_checklist(uuid, text, text, text, boolean, integer), public.unused_files(text, uuid, interval, boolean)
  from public, anon;
grant execute on function public.task_checklist(uuid, text, text, text, boolean, integer), public.unused_files(text, uuid, interval, boolean)
  to authenticated;
revoke execute on function public.orphan_files(integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.orphan_files(integer) to service_role;
  end if;
end $$;
