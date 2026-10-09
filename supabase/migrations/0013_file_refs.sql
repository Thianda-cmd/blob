-- Finding which files are still in use, without reading every note.
--
-- 0012 searched the text of every page's content (and every card's attachments) for each file, so
-- the clean-up got slower with every note in the app. Files in the "files" bucket are only ever
-- referred to by a file block's "path" in a note and by an attachment's "path" on a card, so the
-- database now keeps those paths in their own indexed column, filled automatically on every save.

alter table public.pages
  add column if not exists file_refs jsonb generated always as (jsonb_path_query_array(content, '$.**.path')) stored;
create index if not exists pages_file_refs_idx on public.pages using gin (file_refs jsonb_path_ops);

alter table public.tasks
  add column if not exists file_refs jsonb generated always as (jsonb_path_query_array(attachments, '$[*].path')) stored;
create index if not exists tasks_file_refs_idx on public.tasks using gin (file_refs jsonb_path_ops);

/** Whether any note or card refers to this file (other than those listed in p_except_pages / p_except_project). */
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
  -- A file block someone just added while working together, not yet in the stored note.
  or case
    when p_name ~* '^page/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then exists (
      select 1 from public.page_steps s
      where s.page_id = split_part(p_name, '/', 2)::uuid and strpos(s.steps::text, p_name) > 0
    )
    else false
  end;
$$;

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
      and not public.file_in_use(
        o.name,
        case when p_whole and p_kind = 'page' then p_id end,
        case when p_whole and p_kind = 'project' then p_id end
      );
end;
$$;

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
    and not public.file_in_use(o.name)
  order by o.created_at
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

revoke execute on function public.file_in_use(text, uuid, uuid) from public, anon, authenticated;
