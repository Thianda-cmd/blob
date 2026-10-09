-- Sharing, made safe (review of 0010).
--
-- 1. Pages in a shared tree: only the page's own owner and the owner of the top page count as
--    owners (not someone who owns a page in between), a page can only move into pages you can
--    edit, never inside itself, and only its owner takes it out of a shared tree (never with other
--    people's pages inside). Deleting a page keeps other people's pages inside it: they move up.
-- 2. Invite links: the server picks the token and expiry, links of people who lost their rights stop
--    working, links never change an existing member's role, and the owner can delete any link.
-- 3. Notes edited together: a save outside working together never throws away steps it doesn't
--    contain, and an old snapshot can't overwrite a newer save.
-- 4. Live channels: everyone with access sees who is there; only editors send changes.

-- Who may do what --------------------------------------------------------------------------------

/** The top page above p_page (p_page itself when it has no parent). */
create or replace function public.page_root(p_page uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select p.id, p.parent_id, 0 as depth from public.pages p where p.id = p_page
    union all
    select p.id, p.parent_id, c.depth + 1
    from public.pages p join chain c on p.id = c.parent_id
    where c.depth < 64
  )
  select id from chain order by depth desc limit 1;
$$;

/** Whether p_page is p_ancestor or sits somewhere inside it. */
create or replace function public.page_is_inside(p_page uuid, p_ancestor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select p.id, p.parent_id, 0 as depth from public.pages p where p.id = p_page
    union all
    select p.id, p.parent_id, c.depth + 1
    from public.pages p join chain c on p.id = c.parent_id
    where c.depth < 64
  )
  select exists (select 1 from chain where id = p_ancestor);
$$;

/** Whether any page inside p_page (at any depth) belongs to someone other than p_user. */
create or replace function public.page_has_others_inside(p_page uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive inside as (
    select p.id, p.user_id, 0 as depth from public.pages p where p.parent_id = p_page
    union all
    select p.id, p.user_id, i.depth + 1
    from public.pages p join inside i on p.parent_id = i.id
    where i.depth < 64
  )
  select exists (select 1 from inside where user_id is distinct from p_user);
$$;

/**
 * Someone's role on a page: 'owner' (owns the page itself, or the top page of its tree),
 * 'editor', 'viewer' (shared with them, on the page or a page above it) or null.
 */
create or replace function public.page_role_for(p_page uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select p.id, p.parent_id, p.user_id, 0 as depth from public.pages p where p.id = p_page
    union all
    select p.id, p.parent_id, p.user_id, c.depth + 1
    from public.pages p join chain c on p.id = c.parent_id
    where c.depth < 32
  )
  select case
    when p_user is null then null
    when bool_or(c.user_id = p_user and (c.depth = 0 or c.parent_id is null)) then 'owner'
    when bool_or(m.role = 'editor') then 'editor'
    when bool_or(m.role = 'viewer') then 'viewer'
  end
  from chain c
  left join public.page_members m on m.page_id = c.id and m.user_id = p_user;
$$;

/** The caller's role on a page: 'owner', 'editor', 'viewer' or null (see page_role_for). */
create or replace function public.page_role(p_page uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.page_role_for(p_page, (select auth.uid()));
$$;

/**
 * Every page the caller reaches through sharing: pages shared with them (as editor only when
 * p_edit) and everything inside those, and every page in trees they own the top page of.
 */
create or replace function public.shared_page_ids(p_edit boolean default false)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive seeds as (
    select m.page_id as id
    from public.page_members m
    where m.user_id = (select auth.uid()) and (not p_edit or m.role = 'editor')
    union
    -- A tree of yours with something shared in it: the whole tree (members' pages included).
    select r.id
    from (
      select distinct public.page_root(p.id) as id
      from public.pages p
      where p.user_id = (select auth.uid()) and exists (select 1 from public.page_members m where m.page_id = p.id)
    ) r
    join public.pages top on top.id = r.id and top.user_id = (select auth.uid())
  ),
  tree as (
    select s.id, 0 as depth from seeds s
    union
    select p.id, t.depth + 1
    from public.pages p join tree t on p.parent_id = t.id
    where t.depth < 32
  )
  select coalesce(array_agg(distinct id), '{}') from tree;
$$;

/** Someone's role on a project: 'owner', 'editor', 'viewer' or null. */
create or replace function public.project_role_for(p_project uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user is null then null
    when exists (select 1 from public.projects p where p.id = p_project and p.user_id = p_user) then 'owner'
    else (select m.role from public.project_members m where m.project_id = p_project and m.user_id = p_user)
  end;
$$;

create or replace function public.project_role(p_project uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.project_role_for(p_project, (select auth.uid()));
$$;

-- Guards -----------------------------------------------------------------------------------------

create or replace function public.pages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  old_root uuid;
  new_root uuid;
  old_root_owner uuid;
  new_root_owner uuid;
begin
  -- Versions: a changed document gets a new revision. A note saved outside working together
  -- (doc_version unchanged) must already contain every step; then the step history goes.
  if new.content is distinct from old.content then
    if new.rev = old.rev then
      new.rev := old.rev + 1;
    end if;
    if new.doc_version = old.doc_version then
      if exists (
        select 1 from public.page_steps s
        where s.page_id = new.id and s.version + jsonb_array_length(s.steps) > old.doc_version
      ) then
        raise exception 'pages: this note has newer changes from working together' using errcode = 'BL409';
      end if;
      delete from public.page_steps where page_id = new.id;
    end if;
  end if;
  -- The server itself, and pages moved by pages_keep_others (a trigger inside a delete).
  if me is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  new.id := old.id;
  if old.user_id <> me then
    -- Someone the page is shared with: who owns it, its subject, the owner's favourite and the
    -- trash stay as they are.
    new.user_id := old.user_id;
    new.subject_id := old.subject_id;
    new.is_favorite := old.is_favorite;
    new.trashed_at := old.trashed_at;
  end if;
  if new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if new.parent_id is not null then
    if public.page_is_inside(new.parent_id, new.id) then
      raise exception 'pages: a page can''t go inside itself' using errcode = '42501';
    end if;
    if coalesce(public.page_role(new.parent_id), '') not in ('owner', 'editor') then
      raise exception 'pages: you can only move pages into pages you can edit' using errcode = '42501';
    end if;
  end if;
  -- Into another tree (or out to the top level): only the page's owner, and other people's pages
  -- inside stay with the tree they were shared in.
  old_root := public.page_root(old.id);
  new_root := case when new.parent_id is null then new.id else public.page_root(new.parent_id) end;
  if old_root is distinct from new_root then
    if old.user_id <> me then
      raise exception 'pages: you can only move this page inside the shared page' using errcode = '42501';
    end if;
    select user_id into old_root_owner from public.pages where id = old_root;
    new_root_owner := case when new_root = new.id then old.user_id else (select user_id from public.pages where id = new_root) end;
    if old_root_owner is distinct from new_root_owner and public.page_has_others_inside(new.id, me) then
      raise exception 'pages: other people''s pages inside stay in the shared page' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

/**
 * Before a page is deleted: other people's pages inside it are theirs, so they move up to the
 * deleted page's parent (or the top level) instead of being deleted with it.
 */
create or replace function public.pages_keep_others()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := old.parent_id;
begin
  if target is not null and not exists (select 1 from public.pages where id = target and trashed_at is null) then
    target := null;
  end if;
  with recursive inside as (
    select p.id, p.user_id, 0 as depth from public.pages p where p.parent_id = old.id
    union all
    -- Only through the deleted page owner's pages: someone else's page moves with everything in it.
    select p.id, p.user_id, i.depth + 1
    from public.pages p join inside i on p.parent_id = i.id
    where i.user_id = old.user_id and i.depth < 64
  )
  update public.pages p set parent_id = target
  where p.id in (select id from inside where user_id <> old.user_id);
  return old;
end;
$$;

drop trigger if exists pages_keep_others on public.pages;
create trigger pages_keep_others before delete on public.pages
  for each row execute function public.pages_keep_others();

-- Notes edited together ----------------------------------------------------------------------------

create or replace function public.save_note_snapshot(p_page uuid, p_version integer, p_content jsonb, p_plain text, p_links uuid[] default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest integer;
  current_version integer;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return false;
  end if;
  select doc_version into current_version from public.pages where id = p_page for update;
  select coalesce(max(s.version + jsonb_array_length(s.steps)), current_version) into latest
  from public.page_steps s where s.page_id = p_page;
  if p_version < current_version or p_version > latest then
    return false;
  end if;
  -- Already stored at this version (maybe with newer changes saved outside working together).
  if p_version = current_version then
    return true;
  end if;
  update public.pages
  set content = p_content, plain_text = left(coalesce(p_plain, ''), 20000), doc_version = p_version,
      links = coalesce(p_links, links)
  where id = p_page;
  delete from public.page_steps where page_id = p_page and version + jsonb_array_length(steps) <= p_version - 400;
  return true;
end;
$$;

-- Invite links ---------------------------------------------------------------------------------

-- Links that were given an endless life before the server decided expiry.
update public.invites set expires_at = created_at + interval '14 days' where expires_at > created_at + interval '30 days';

drop policy if exists "invites: managers" on public.invites;
drop policy if exists "invites: read" on public.invites;
drop policy if exists "invites: add" on public.invites;
drop policy if exists "invites: change" on public.invites;
drop policy if exists "invites: remove" on public.invites;
create policy "invites: read" on public.invites for select to authenticated
  using (
    (target_type = 'page' and public.page_role(target_id) in ('owner', 'editor'))
    or (target_type = 'project' and public.project_role(target_id) in ('owner', 'editor'))
  );
create policy "invites: add" on public.invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (target_type = 'page' and public.page_role(target_id) in ('owner', 'editor'))
      or (target_type = 'project' and public.project_role(target_id) in ('owner', 'editor'))
    )
  );
-- The owner manages every link; an editor the links they made.
create policy "invites: change" on public.invites for update to authenticated
  using (
    (target_type = 'page' and (public.page_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.page_role(target_id) = 'editor')))
    or (target_type = 'project' and (public.project_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.project_role(target_id) = 'editor')))
  )
  with check (
    (target_type = 'page' and (public.page_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.page_role(target_id) = 'editor')))
    or (target_type = 'project' and (public.project_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.project_role(target_id) = 'editor')))
  );
create policy "invites: remove" on public.invites for delete to authenticated
  using (
    (target_type = 'page' and (public.page_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.page_role(target_id) = 'editor')))
    or (target_type = 'project' and (public.project_role(target_id) = 'owner' or (created_by = (select auth.uid()) and public.project_role(target_id) = 'editor')))
  );

-- The token, creator, expiry and use count come from the server; a link's role can change.
revoke insert, update on public.invites from authenticated;
grant insert (target_type, target_id, role, max_uses) on public.invites to authenticated;
grant update (role) on public.invites to authenticated;

/** What an invite link opens, shown before joining (title, type, who shares it, the role). */
create or replace function public.invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  title text;
  kind text;
  owner_id uuid;
  owner_name text;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('ok', false, 'reason', 'signin');
  end if;
  select * into inv from public.invites where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  -- A link stops working when the person who made it can no longer share (removed, or a viewer now).
  if coalesce(
       case when inv.target_type = 'page' then public.page_role_for(inv.target_id, inv.created_by)
            else public.project_role_for(inv.target_id, inv.created_by) end,
       '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if inv.target_type = 'page' then
    select p.title, p.kind, p.user_id into title, kind, owner_id from public.pages p where p.id = inv.target_id and p.trashed_at is null;
  else
    select p.title, 'project', p.user_id into title, kind, owner_id from public.projects p where p.id = inv.target_id and p.archived_at is null;
  end if;
  if owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  select pr.full_name into owner_name from public.profiles pr where pr.id = inv.created_by;
  return jsonb_build_object(
    'ok', true, 'type', inv.target_type, 'id', inv.target_id, 'title', title, 'kind', kind,
    'role', inv.role, 'from', coalesce(owner_name, ''),
    'member', case when inv.target_type = 'page' then public.page_role(inv.target_id) else public.project_role(inv.target_id) end
  );
end;
$$;

/**
 * Join through an invite link. Returns what was joined (or why not). Someone who is already in
 * keeps their role: only the owner changes roles.
 */
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  preview jsonb;
  inv public.invites;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'signin');
  end if;
  -- One join at a time per link, so a link for 3 people lets in 3.
  select * into inv from public.invites where token = p_token for update;
  preview := public.invite_preview(p_token);
  if not (preview ->> 'ok')::boolean then
    return preview;
  end if;
  if (preview ->> 'member') is null then
    if inv.target_type = 'page' then
      insert into public.page_members (page_id, user_id, role, added_by)
      values (inv.target_id, me, inv.role, inv.created_by)
      on conflict (page_id, user_id) do nothing;
    else
      insert into public.project_members (project_id, user_id, role, added_by)
      values (inv.target_id, me, inv.role, inv.created_by)
      on conflict (project_id, user_id) do nothing;
    end if;
    update public.invites set uses = uses + 1 where token = p_token;
  end if;
  return jsonb_build_object('ok', true, 'type', inv.target_type, 'id', inv.target_id, 'kind', preview ->> 'kind', 'title', preview ->> 'title');
end;
$$;

/** Someone removed (or made a viewer) loses the links they made for that page or project. */
create or replace function public.members_drop_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role <> 'viewer' then
    return null;
  end if;
  if tg_table_name = 'page_members' then
    delete from public.invites where target_type = 'page' and target_id = old.page_id and created_by = old.user_id;
  else
    delete from public.invites where target_type = 'project' and target_id = old.project_id and created_by = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists page_members_drop_invites on public.page_members;
create trigger page_members_drop_invites after delete or update of role on public.page_members
  for each row execute function public.members_drop_invites();
drop trigger if exists project_members_drop_invites on public.project_members;
create trigger project_members_drop_invites after delete or update of role on public.project_members
  for each row execute function public.members_drop_invites();

-- Live channels ----------------------------------------------------------------------------------

/** Sending on a live channel: presence for everyone with access, broadcasts for editors. */
create or replace function public.live_send_access(p_topic text, p_extension text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic is null then
    return false;
  end if;
  return public.file_access(split_part(p_topic, ':', 1), split_part(p_topic, ':', 2), coalesce(p_extension, '') = 'broadcast');
end;
$$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    drop policy if exists "live: members send" on realtime.messages;
    create policy "live: members send" on realtime.messages for insert to authenticated
      with check (public.live_send_access((select realtime.topic()), extension));
  end if;
end $$;

-- Data API access ------------------------------------------------------------------------------

-- Helpers used inside other functions only.
revoke execute on function public.page_root(uuid), public.page_is_inside(uuid, uuid), public.page_has_others_inside(uuid, uuid),
  public.page_role_for(uuid, uuid), public.project_role_for(uuid, uuid), public.members_drop_invites(), public.pages_keep_others()
  from public, anon, authenticated;
revoke execute on function public.live_send_access(text, text) from public, anon;
grant execute on function public.live_send_access(text, text) to authenticated;
