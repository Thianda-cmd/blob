-- Public links: anyone with the link can view a page (a note, presentation, CV or folder), without
-- an account. Only the page's owner makes one, one link per page; editors see and copy it. A link
-- can include the pages inside (sub_pages). Viewers get exactly what they may see through
-- public_page() and public_file() below, never the tables.

create table if not exists public.public_links (
  -- 64 hex characters, chosen by the server.
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  page_id uuid not null unique references public.pages (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  sub_pages boolean not null default true,
  views integer not null default 0,
  viewed_at timestamptz
);

alter table public.public_links enable row level security;

drop policy if exists "public links: read" on public.public_links;
drop policy if exists "public links: add" on public.public_links;
drop policy if exists "public links: change" on public.public_links;
drop policy if exists "public links: remove" on public.public_links;
create policy "public links: read" on public.public_links for select to authenticated
  using (public.page_role(page_id) in ('owner', 'editor'));
create policy "public links: add" on public.public_links for insert to authenticated
  with check (created_by = (select auth.uid()) and public.page_role(page_id) = 'owner');
create policy "public links: change" on public.public_links for update to authenticated
  using (public.page_role(page_id) = 'owner')
  with check (public.page_role(page_id) = 'owner');
create policy "public links: remove" on public.public_links for delete to authenticated
  using (public.page_role(page_id) = 'owner');

-- The token, creator and counts come from the server; the owner only says what and how much.
revoke all on public.public_links from anon;
revoke insert, update on public.public_links from authenticated;
grant select, delete on public.public_links to authenticated;
grant insert (page_id, sub_pages) on public.public_links to authenticated;
grant update (sub_pages) on public.public_links to authenticated;

/**
 * The link behind p_token and the page p_page it opens (the link's own page when null): the link
 * when that page may be shown through it, else null. A page inside needs a link with sub-pages,
 * and nothing between the link's page and it (both included) may be in the trash. A link stops
 * working when the person who made it no longer owns the page.
 */
create or replace function public.public_link_for(p_token text, p_page uuid)
returns public.public_links
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  link public.public_links;
  target uuid;
  ok boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into link from public.public_links where token = p_token;
  if not found or public.page_role_for(link.page_id, link.created_by) is distinct from 'owner' then
    return null;
  end if;
  target := coalesce(p_page, link.page_id);
  if target <> link.page_id and not link.sub_pages then
    return null;
  end if;
  -- Walk up from the page to the link's page: it must get there, with nothing trashed on the way.
  with recursive chain as (
    select p.id, p.parent_id, p.trashed_at, 0 as depth from public.pages p where p.id = target
    union all
    select p.id, p.parent_id, p.trashed_at, c.depth + 1
    from public.pages p join chain c on p.id = c.parent_id
    where c.id <> link.page_id and c.depth < 64
  )
  select bool_and(trashed_at is null) and bool_or(id = link.page_id) into ok from chain;
  if not coalesce(ok, false) then
    return null;
  end if;
  return link;
end;
$$;

revoke all on function public.public_link_for(text, uuid) from public, anon, authenticated;

/**
 * What a public link shows: the page (title, icon, kind, content), where it sits under the link's
 * page, the pages right inside it and the titles of linked pages the link also opens. Null when
 * the link doesn't open that page. Opening the link's own page counts a view (not for the people
 * the page is shared with).
 */
create or replace function public.public_page(p_token text, p_page uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.public_links;
  pg public.pages;
  trail jsonb;
  inside jsonb;
  linked jsonb;
begin
  link := public.public_link_for(p_token, p_page);
  if link.token is null then
    return null;
  end if;
  select * into pg from public.pages where id = coalesce(p_page, link.page_id);

  -- From the link's page down to the page's parent.
  with recursive chain as (
    select p.id, p.parent_id, p.title, p.icon, p.kind, 0 as depth from public.pages p where p.id = pg.parent_id and pg.id <> link.page_id
    union all
    select p.id, p.parent_id, p.title, p.icon, p.kind, c.depth + 1
    from public.pages p join chain c on p.id = c.parent_id
    where c.id <> link.page_id and c.depth < 64
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'icon', icon, 'kind', kind) order by depth desc), '[]'::jsonb)
  into trail from chain;

  if link.sub_pages then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'icon', c.icon, 'kind', c.kind) order by c.position, c.created_at), '[]'::jsonb)
    into inside
    from public.pages c where c.parent_id = pg.id and c.trashed_at is null;
    select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'icon', l.icon, 'kind', l.kind)), '[]'::jsonb)
    into linked
    from public.pages l
    where l.id = any (pg.links) and (public.public_link_for(p_token, l.id)).token is not null;
  end if;

  if p_page is null and public.page_role(link.page_id) is null then
    update public.public_links set views = views + 1, viewed_at = now() where token = link.token;
  end if;

  return jsonb_build_object(
    'page', jsonb_build_object(
      'id', pg.id, 'kind', pg.kind, 'title', pg.title, 'icon', pg.icon, 'content', pg.content,
      'plain_text', left(coalesce(pg.plain_text, ''), 400), 'updated_at', pg.updated_at
    ),
    'root', link.page_id,
    'sub_pages', link.sub_pages,
    'trail', trail,
    'children', coalesce(inside, '[]'::jsonb),
    'linked', coalesce(linked, '[]'::jsonb)
  );
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
  return exists (select 1 from public.pages p where p.id = p_page and p.file_refs @> jsonb_build_array(p_path));
end;
$$;

revoke all on function public.public_page(text, uuid) from public;
revoke all on function public.public_file(text, uuid, text) from public;
grant execute on function public.public_page(text, uuid) to anon, authenticated;
grant execute on function public.public_file(text, uuid, text) to anon, authenticated;
