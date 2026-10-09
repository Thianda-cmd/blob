-- Notes & knowledge, project boards, and working together.
--
-- * Pages get tags, their outgoing links (for backlinks), learning topics they belong to, and folders.
-- * Pages (with everything inside them) and projects can be shared: members are editors or viewers,
--   and join through invite links. Sharing a page shares its sub-pages; a member's own sub-pages
--   inside a shared page belong to them but live in the shared tree.
-- * Projects are kanban boards: columns plus tasks with assignees, labels, priority, a checklist and
--   attachments. Personal tasks get a status (to do, doing, done) for a personal board.
-- * Working on one note together: ProseMirror steps are ordered by page_steps (the version is the
--   authority), with a snapshot of the document in pages.content at pages.doc_version.
--   Presentations use pages.rev for optimistic saving with a merge in the browser.
-- * Files attached to notes and projects live in the private "files" bucket.
-- * Flashcard reviews (spaced repetition) are kept per person.
--
-- Access checks live in security definer functions (page_role, project_role, …) so policies don't
-- recurse. Written so it can be run again safely.

-- Pages ----------------------------------------------------------------------------------------

alter table public.pages drop constraint if exists pages_kind_check;
alter table public.pages add constraint pages_kind_check check (kind in ('note', 'deck', 'cv', 'folder'));

alter table public.pages
  add column if not exists tags text[] not null default '{}',
  add column if not exists links uuid[] not null default '{}',
  add column if not exists topics text[] not null default '{}',
  add column if not exists rev integer not null default 0,
  add column if not exists doc_version integer not null default 0;

alter table public.pages drop constraint if exists pages_tags_check;
alter table public.pages add constraint pages_tags_check check (cardinality(tags) <= 20);
alter table public.pages drop constraint if exists pages_links_check;
alter table public.pages add constraint pages_links_check check (cardinality(links) <= 500);
alter table public.pages drop constraint if exists pages_topics_check;
alter table public.pages add constraint pages_topics_check check (cardinality(topics) <= 20);

create index if not exists pages_tags_idx on public.pages using gin (tags);
create index if not exists pages_links_idx on public.pages using gin (links);
create index if not exists pages_topics_idx on public.pages using gin (topics);

-- A member's sub-page in a shared page belongs to the member, so a page's parent may belong to
-- someone else. (Before, parent and child had to have the same owner.)
alter table public.pages drop constraint if exists pages_parent_id_user_id_fkey;
alter table public.pages drop constraint if exists pages_parent_fk;
alter table public.pages add constraint pages_parent_fk foreign key (parent_id) references public.pages (id) on delete cascade;

-- Subjects can also be notebooks that aren't a school subject ("Privat", "Fahrschule").
alter table public.subjects add column if not exists kind text not null default 'subject';
alter table public.subjects drop constraint if exists subjects_kind_check;
alter table public.subjects add constraint subjects_kind_check check (kind in ('subject', 'notebook'));

create table if not exists public.page_members (
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
create index if not exists page_members_user_idx on public.page_members (user_id);

-- Projects -------------------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 4000),
  icon text check (char_length(icon) <= 16),
  color text not null default 'blob' check (char_length(color) <= 20),
  subject_id uuid,
  due_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create index if not exists projects_user_idx on public.projects (user_id);

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);

create table if not exists public.project_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 60),
  color text not null default 'ink' check (char_length(color) <= 20),
  position double precision not null default 0,
  -- Cards moved here count as done (the "Fertig" column).
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists project_columns_project_idx on public.project_columns (project_id, position);

-- Tasks: personal board and project cards --------------------------------------------------------

alter table public.tasks
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists column_id uuid references public.project_columns (id) on delete set null,
  add column if not exists status text not null default 'todo',
  add column if not exists position double precision not null default 0,
  add column if not exists priority smallint not null default 0,
  add column if not exists assignees uuid[] not null default '{}',
  add column if not exists labels text[] not null default '{}',
  add column if not exists checklist jsonb not null default '[]',
  add column if not exists attachments jsonb not null default '[]';

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('todo', 'doing', 'done'));
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority between 0 and 3);
alter table public.tasks drop constraint if exists tasks_assignees_check;
alter table public.tasks add constraint tasks_assignees_check check (cardinality(assignees) <= 20);
alter table public.tasks drop constraint if exists tasks_labels_check;
alter table public.tasks add constraint tasks_labels_check check (cardinality(labels) <= 12);
alter table public.tasks drop constraint if exists tasks_checklist_check;
alter table public.tasks add constraint tasks_checklist_check check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 100);
alter table public.tasks drop constraint if exists tasks_attachments_check;
alter table public.tasks add constraint tasks_attachments_check check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 30);
-- Project cards have room for a real description.
alter table public.tasks drop constraint if exists tasks_details_check;
alter table public.tasks add constraint tasks_details_check check (char_length(details) <= 8000);

create index if not exists tasks_project_idx on public.tasks (project_id, column_id, position) where project_id is not null;
create index if not exists tasks_assignees_idx on public.tasks using gin (assignees);

update public.tasks set status = 'done' where done and status <> 'done';

-- status and done always agree (older app versions only know done).
create or replace function public.tasks_sync_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.done then
      new.status := 'done';
    elsif new.status = 'done' then
      new.done := true;
    end if;
  elsif new.status is distinct from old.status then
    new.done := new.status = 'done';
  elsif new.done is distinct from old.done then
    new.status := case when new.done then 'done' when old.status = 'done' then 'todo' else old.status end;
  end if;
  if new.done and new.completed_at is null then
    new.completed_at := now();
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_status on public.tasks;
create trigger tasks_sync_status before insert or update on public.tasks
  for each row execute function public.tasks_sync_status();

-- Working on a note together ---------------------------------------------------------------------

create table if not exists public.page_steps (
  page_id uuid not null references public.pages (id) on delete cascade,
  -- The document version these steps start from; they take it to version + jsonb_array_length(steps).
  version integer not null check (version >= 0),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 500),
  client_id text not null check (char_length(client_id) between 1 and 64),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, version)
);

-- Flashcards -----------------------------------------------------------------------------------

create table if not exists public.card_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 64),
  -- Leitner box: 0 = new or forgotten, 6 = known for a long time.
  box smallint not null default 0 check (box between 0 and 6),
  due_on date not null default current_date,
  reviews integer not null default 0,
  lapses integer not null default 0,
  last_reviewed timestamptz,
  primary key (user_id, page_id, card_id)
);

-- Invite links -----------------------------------------------------------------------------------

create table if not exists public.invites (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  target_type text not null check (target_type in ('page', 'project')),
  target_id uuid not null,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  uses integer not null default 0,
  max_uses integer check (max_uses is null or max_uses between 1 and 500)
);
create index if not exists invites_target_idx on public.invites (target_type, target_id);

-- Who may do what --------------------------------------------------------------------------------

/** The caller's role on a page: 'owner' (owns it or a page above it), 'editor', 'viewer' or null. */
create or replace function public.page_role(p_page uuid)
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
    when bool_or(c.user_id = (select auth.uid())) then 'owner'
    when bool_or(m.role = 'editor') then 'editor'
    when bool_or(m.role = 'viewer') then 'viewer'
  end
  from chain c
  left join public.page_members m on m.page_id = c.id and m.user_id = (select auth.uid());
$$;

/**
 * Every page the caller reaches through sharing: pages shared with them (as editor only when
 * p_edit), pages they own that are shared, and everything inside those.
 */
create or replace function public.shared_page_ids(p_edit boolean default false)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  with recursive tree as (
    select m.page_id as id, 0 as depth
    from public.page_members m
    where m.user_id = (select auth.uid()) and (not p_edit or m.role = 'editor')
    union
    select p.id, 0
    from public.pages p
    where p.user_id = (select auth.uid()) and exists (select 1 from public.page_members m where m.page_id = p.id)
    union
    select p.id, t.depth + 1
    from public.pages p join tree t on p.parent_id = t.id
    where t.depth < 32
  )
  select coalesce(array_agg(distinct id), '{}') from tree;
$$;

/** The caller's role on a project: 'owner', 'editor', 'viewer' or null. */
create or replace function public.project_role(p_project uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.projects p where p.id = p_project and p.user_id = (select auth.uid())) then 'owner'
    else (select m.role from public.project_members m where m.project_id = p_project and m.user_id = (select auth.uid()))
  end;
$$;

/** Projects the caller owns or is a member of (as editor only when p_edit). */
create or replace function public.my_project_ids(p_edit boolean default false)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from (
    select p.id from public.projects p where p.user_id = (select auth.uid())
    union
    select m.project_id from public.project_members m
    where m.user_id = (select auth.uid()) and (not p_edit or m.role = 'editor')
  ) ids;
$$;

/** Access to a file path "page/<id>/…" or "project/<id>/…" in the files bucket. */
create or replace function public.file_access(p_kind text, p_id text, p_edit boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  role text;
begin
  if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if p_kind = 'page' then
    role := public.page_role(p_id::uuid);
  elsif p_kind = 'project' then
    role := public.project_role(p_id::uuid);
  else
    return false;
  end if;
  return role is not null and (not p_edit or role in ('owner', 'editor'));
end;
$$;

/** Live channels "page:<id>" and "project:<id>" (presence, cursors, quick updates) are for members. */
create or replace function public.live_access(p_topic text)
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
  return public.file_access(split_part(p_topic, ':', 1), split_part(p_topic, ':', 2), false);
end;
$$;

-- Guards: members edit content, owners decide ownership and place -------------------------------

create or replace function public.pages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  -- Versions: a changed document gets a new revision; a note saved outside working-together
  -- (doc_version unchanged) drops the step history, which no longer fits the document.
  if new.content is distinct from old.content then
    if new.rev = old.rev then
      new.rev := old.rev + 1;
    end if;
    if new.doc_version = old.doc_version then
      delete from public.page_steps where page_id = new.id;
    end if;
  end if;
  if me is null or old.user_id = me then
    return new;
  end if;
  -- Someone the page is shared with: who owns it, its subject, the owner's favourite and the trash
  -- stay as they are.
  new.user_id := old.user_id;
  new.subject_id := old.subject_id;
  new.is_favorite := old.is_favorite;
  new.trashed_at := old.trashed_at;
  if new.parent_id is distinct from old.parent_id
     and (new.parent_id is null or coalesce(public.page_role(new.parent_id), '') not in ('owner', 'editor')) then
    raise exception 'pages: you can only move this page inside the shared page' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pages_guard on public.pages;
create trigger pages_guard before update on public.pages
  for each row execute function public.pages_guard();

create or replace function public.projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or old.user_id = (select auth.uid()) then
    return new;
  end if;
  new.user_id := old.user_id;
  new.subject_id := old.subject_id;
  new.archived_at := old.archived_at;
  return new;
end;
$$;

drop trigger if exists projects_guard on public.projects;
create trigger projects_guard before update on public.projects
  for each row execute function public.projects_guard();

create or replace function public.tasks_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or old.user_id = (select auth.uid()) then
    return new;
  end if;
  -- A project member edits someone else's card: it stays theirs, and in a project.
  new.user_id := old.user_id;
  new.subject_id := old.subject_id;
  if new.project_id is null then
    raise exception 'tasks: a card from a project stays in a project' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before update on public.tasks
  for each row execute function public.tasks_guard();

-- Column ids must belong to the card's project.
create or replace function public.tasks_column_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.column_id is not null
     and not exists (select 1 from public.project_columns c where c.id = new.column_id and c.project_id is not distinct from new.project_id) then
    raise exception 'tasks: that column belongs to another project' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_column_check on public.tasks;
create trigger tasks_column_check before insert or update of column_id, project_id on public.tasks
  for each row execute function public.tasks_column_check();

-- Row level security -------------------------------------------------------------------------------

drop policy if exists "pages: own rows" on public.pages;
drop policy if exists "pages: read" on public.pages;
drop policy if exists "pages: add" on public.pages;
drop policy if exists "pages: change" on public.pages;
drop policy if exists "pages: remove" on public.pages;
create policy "pages: read" on public.pages for select to authenticated
  using (user_id = (select auth.uid()) or id = any ((select public.shared_page_ids(false))::uuid[]));
create policy "pages: add" on public.pages for insert to authenticated
  with check (user_id = (select auth.uid()) and (parent_id is null or public.page_role(parent_id) in ('owner', 'editor')));
create policy "pages: change" on public.pages for update to authenticated
  using (user_id = (select auth.uid()) or id = any ((select public.shared_page_ids(true))::uuid[]))
  with check (user_id = (select auth.uid()) or id = any ((select public.shared_page_ids(true))::uuid[]));
create policy "pages: remove" on public.pages for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.page_members enable row level security;
drop policy if exists "page_members: read" on public.page_members;
drop policy if exists "page_members: change" on public.page_members;
drop policy if exists "page_members: remove" on public.page_members;
create policy "page_members: read" on public.page_members for select to authenticated
  using (user_id = (select auth.uid()) or public.page_role(page_id) is not null);
create policy "page_members: change" on public.page_members for update to authenticated
  using (public.page_role(page_id) = 'owner') with check (public.page_role(page_id) = 'owner');
-- The owner removes anyone; a member can leave.
create policy "page_members: remove" on public.page_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.page_role(page_id) = 'owner');

alter table public.projects enable row level security;
drop policy if exists "projects: read" on public.projects;
drop policy if exists "projects: add" on public.projects;
drop policy if exists "projects: change" on public.projects;
drop policy if exists "projects: remove" on public.projects;
create policy "projects: read" on public.projects for select to authenticated
  using (user_id = (select auth.uid()) or id = any ((select public.my_project_ids(false))::uuid[]));
create policy "projects: add" on public.projects for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "projects: change" on public.projects for update to authenticated
  using (id = any ((select public.my_project_ids(true))::uuid[])) with check (id = any ((select public.my_project_ids(true))::uuid[]));
create policy "projects: remove" on public.projects for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.project_members enable row level security;
drop policy if exists "project_members: read" on public.project_members;
drop policy if exists "project_members: change" on public.project_members;
drop policy if exists "project_members: remove" on public.project_members;
create policy "project_members: read" on public.project_members for select to authenticated
  using (project_id = any ((select public.my_project_ids(false))::uuid[]));
create policy "project_members: change" on public.project_members for update to authenticated
  using (public.project_role(project_id) = 'owner') with check (public.project_role(project_id) = 'owner');
create policy "project_members: remove" on public.project_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.project_role(project_id) = 'owner');

alter table public.project_columns enable row level security;
drop policy if exists "project_columns: read" on public.project_columns;
drop policy if exists "project_columns: write" on public.project_columns;
create policy "project_columns: read" on public.project_columns for select to authenticated
  using (project_id = any ((select public.my_project_ids(false))::uuid[]));
create policy "project_columns: write" on public.project_columns for all to authenticated
  using (project_id = any ((select public.my_project_ids(true))::uuid[]))
  with check (project_id = any ((select public.my_project_ids(true))::uuid[]));

drop policy if exists "tasks: own rows" on public.tasks;
drop policy if exists "tasks: read" on public.tasks;
drop policy if exists "tasks: add" on public.tasks;
drop policy if exists "tasks: change" on public.tasks;
drop policy if exists "tasks: remove" on public.tasks;
create policy "tasks: read" on public.tasks for select to authenticated
  using (user_id = (select auth.uid()) or project_id = any ((select public.my_project_ids(false))::uuid[]));
create policy "tasks: add" on public.tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and (project_id is null or project_id = any ((select public.my_project_ids(true))::uuid[])));
create policy "tasks: change" on public.tasks for update to authenticated
  using ((user_id = (select auth.uid()) and project_id is null) or project_id = any ((select public.my_project_ids(true))::uuid[]))
  with check ((user_id = (select auth.uid()) and project_id is null) or project_id = any ((select public.my_project_ids(true))::uuid[]));
create policy "tasks: remove" on public.tasks for delete to authenticated
  using ((user_id = (select auth.uid()) and project_id is null) or project_id = any ((select public.my_project_ids(true))::uuid[]));

alter table public.page_steps enable row level security;
drop policy if exists "page_steps: read" on public.page_steps;
create policy "page_steps: read" on public.page_steps for select to authenticated
  using (public.page_role(page_id) is not null);
-- Steps are only added through push_steps (it keeps the versions in order).

alter table public.card_reviews enable row level security;
drop policy if exists "card_reviews: own rows" on public.card_reviews;
create policy "card_reviews: own rows" on public.card_reviews for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.page_role(page_id) is not null);

alter table public.invites enable row level security;
drop policy if exists "invites: managers" on public.invites;
create policy "invites: managers" on public.invites for all to authenticated
  using (
    (target_type = 'page' and public.page_role(target_id) in ('owner', 'editor'))
    or (target_type = 'project' and public.project_role(target_id) in ('owner', 'editor'))
  )
  with check (
    created_by = (select auth.uid())
    and (
      (target_type = 'page' and public.page_role(target_id) in ('owner', 'editor'))
      or (target_type = 'project' and public.project_role(target_id) in ('owner', 'editor'))
    )
  );

-- Functions the app calls ------------------------------------------------------------------------

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

/** Join through an invite link. Returns what was joined (or why not). */
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
  preview := public.invite_preview(p_token);
  if not (preview ->> 'ok')::boolean then
    return preview;
  end if;
  select * into inv from public.invites where token = p_token for update;
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
  elsif (preview ->> 'member') = 'viewer' and inv.role = 'editor' then
    -- A viewer who gets an editor link becomes an editor.
    if inv.target_type = 'page' then
      update public.page_members set role = 'editor' where page_id = inv.target_id and user_id = me;
    else
      update public.project_members set role = 'editor' where project_id = inv.target_id and user_id = me;
    end if;
    update public.invites set uses = uses + 1 where token = p_token;
  end if;
  return jsonb_build_object('ok', true, 'type', inv.target_type, 'id', inv.target_id, 'kind', preview ->> 'kind', 'title', preview ->> 'title');
end;
$$;

/** The owner and members of a page or project, with names and pictures (for the people who can see it). */
create or replace function public.member_profiles(p_type text, p_target uuid)
returns table (user_id uuid, full_name text, avatar_url text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  root uuid;
begin
  if p_type = 'page' then
    if public.page_role(p_target) is null then
      return;
    end if;
    -- The members sit on the shared page itself or a page above it; the owner is the top page's.
    return query
      with recursive chain as (
        select p.id, p.parent_id, p.user_id, 0 as depth from public.pages p where p.id = p_target
        union all
        select p.id, p.parent_id, p.user_id, c.depth + 1 from public.pages p join chain c on p.id = c.parent_id where c.depth < 32
      ),
      people as (
        select c.user_id as uid, 'owner'::text as r, 0 as rank from chain c where c.parent_id is null
        union all
        select m.user_id, m.role, case m.role when 'editor' then 1 else 2 end from public.page_members m join chain c on m.page_id = c.id
      )
      select distinct on (pe.uid) pe.uid, coalesce(pr.full_name, ''), pr.avatar_url, pe.r
      from people pe left join public.profiles pr on pr.id = pe.uid
      order by pe.uid, pe.rank;
  elsif p_type = 'project' then
    if public.project_role(p_target) is null then
      return;
    end if;
    return query
      select p.user_id, coalesce(pr.full_name, ''), pr.avatar_url, 'owner'::text
      from public.projects p left join public.profiles pr on pr.id = p.user_id where p.id = p_target
      union all
      select m.user_id, coalesce(pr.full_name, ''), pr.avatar_url, m.role
      from public.project_members m left join public.profiles pr on pr.id = m.user_id where m.project_id = p_target;
  end if;
end;
$$;

/** People the caller already works with somewhere (to add them without a new link). */
create or replace function public.my_collaborators()
returns table (user_id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select unnest((select public.shared_page_ids(false))) as page_id
  ),
  people as (
    select m.user_id from public.page_members m where m.page_id in (select page_id from mine)
    union
    select p.user_id from public.pages p where p.id in (select page_id from mine) and p.parent_id is null
    union
    select m.user_id from public.project_members m where m.project_id = any ((select public.my_project_ids(false))::uuid[])
    union
    select p.user_id from public.projects p where p.id = any ((select public.my_project_ids(false))::uuid[])
  )
  select pe.user_id, coalesce(pr.full_name, ''), pr.avatar_url
  from people pe left join public.profiles pr on pr.id = pe.user_id
  where pe.user_id <> (select auth.uid());
$$;

/** Add someone you already work with to a page or project you can edit. */
create or replace function public.add_member(p_type text, p_target uuid, p_user uuid, p_role text default 'editor')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('editor', 'viewer') then
    return false;
  end if;
  if not exists (select 1 from public.my_collaborators() c where c.user_id = p_user) then
    return false;
  end if;
  if p_type = 'page' and public.page_role(p_target) in ('owner', 'editor') then
    insert into public.page_members (page_id, user_id, role, added_by) values (p_target, p_user, p_role, (select auth.uid()))
    on conflict (page_id, user_id) do nothing;
    return true;
  elsif p_type = 'project' and public.project_role(p_target) in ('owner', 'editor') then
    insert into public.project_members (project_id, user_id, role, added_by) values (p_target, p_user, p_role, (select auth.uid()))
    on conflict (project_id, user_id) do nothing;
    return true;
  end if;
  return false;
end;
$$;

/**
 * Add a note's steps on top of version p_version. Succeeds only when nobody else added steps
 * since (the caller then receives theirs and tries again). Returns the version now.
 */
create or replace function public.push_steps(p_page uuid, p_version integer, p_steps jsonb, p_client text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest integer;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  -- One writer at a time per note.
  select doc_version into latest from public.pages where id = p_page for update;
  select coalesce(max(s.version + jsonb_array_length(s.steps)), latest) into latest
  from public.page_steps s where s.page_id = p_page;
  if p_version <> latest then
    return jsonb_build_object('ok', false, 'reason', 'behind', 'version', latest);
  end if;
  insert into public.page_steps (page_id, version, steps, client_id) values (p_page, p_version, p_steps, p_client);
  return jsonb_build_object('ok', true, 'version', p_version + jsonb_array_length(p_steps));
end;
$$;

/**
 * Store a note's document at a version all its steps reached (by a client that has them all),
 * and forget steps far behind it.
 */
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
  update public.pages
  set content = p_content, plain_text = left(coalesce(p_plain, ''), 20000), doc_version = p_version,
      links = coalesce(p_links, links)
  where id = p_page;
  delete from public.page_steps where page_id = p_page and version + jsonb_array_length(steps) <= p_version - 400;
  return true;
end;
$$;

/**
 * Save a presentation when nobody else saved since revision p_rev. Otherwise returns the newer
 * content, so the browser merges and tries again.
 */
create or replace function public.save_deck(p_page uuid, p_rev integer, p_content jsonb, p_title text, p_plain text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.pages;
begin
  if coalesce(public.page_role(p_page), '') not in ('owner', 'editor') then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select * into cur from public.pages where id = p_page for update;
  if cur.kind <> 'deck' then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if cur.rev <> p_rev then
    return jsonb_build_object('ok', false, 'reason', 'behind', 'rev', cur.rev, 'content', cur.content, 'title', cur.title);
  end if;
  update public.pages
  set content = p_content, title = left(coalesce(p_title, ''), 200), plain_text = left(coalesce(p_plain, ''), 20000), rev = p_rev + 1
  where id = p_page;
  return jsonb_build_object('ok', true, 'rev', p_rev + 1);
end;
$$;

-- Files ----------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files', 'files', false, 26214400,
  array[
    'image/*', 'audio/*', 'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation', 'application/zip', 'application/x-zip-compressed',
    'application/vnd.apple.pages', 'application/vnd.apple.numbers', 'application/vnd.apple.keynote'
  ]
)
on conflict (id) do nothing;

drop policy if exists "files: read" on storage.objects;
drop policy if exists "files: add" on storage.objects;
drop policy if exists "files: change" on storage.objects;
drop policy if exists "files: remove" on storage.objects;
create policy "files: read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.file_access((storage.foldername(name))[1], (storage.foldername(name))[2], false));
create policy "files: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.file_access((storage.foldername(name))[1], (storage.foldername(name))[2], true));
create policy "files: change" on storage.objects for update to authenticated
  using (bucket_id = 'files' and public.file_access((storage.foldername(name))[1], (storage.foldername(name))[2], true));
create policy "files: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.file_access((storage.foldername(name))[1], (storage.foldername(name))[2], true));

-- Live updates ---------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['pages', 'page_members', 'page_steps', 'projects', 'project_members', 'project_columns', 'tasks'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    drop policy if exists "live: members read" on realtime.messages;
    drop policy if exists "live: members send" on realtime.messages;
    create policy "live: members read" on realtime.messages for select to authenticated
      using (public.live_access((select realtime.topic())));
    create policy "live: members send" on realtime.messages for insert to authenticated
      with check (public.live_access((select realtime.topic())));
  end if;
end $$;

-- Data API access ------------------------------------------------------------------------------

grant select, insert, update, delete on public.page_members, public.projects, public.project_members, public.project_columns, public.card_reviews, public.invites to authenticated;
grant select on public.page_steps to authenticated;
revoke all on public.page_members, public.projects, public.project_members, public.project_columns, public.card_reviews, public.invites, public.page_steps from anon;

revoke execute on function public.page_role(uuid), public.shared_page_ids(boolean), public.project_role(uuid), public.my_project_ids(boolean),
  public.file_access(text, text, boolean), public.live_access(text), public.invite_preview(text), public.accept_invite(text),
  public.member_profiles(text, uuid), public.my_collaborators(), public.add_member(text, uuid, uuid, text),
  public.push_steps(uuid, integer, jsonb, text), public.save_note_snapshot(uuid, integer, jsonb, text, uuid[]),
  public.save_deck(uuid, integer, jsonb, text, text) from public, anon;
grant execute on function public.page_role(uuid), public.shared_page_ids(boolean), public.project_role(uuid), public.my_project_ids(boolean),
  public.file_access(text, text, boolean), public.live_access(text), public.invite_preview(text), public.accept_invite(text),
  public.member_profiles(text, uuid), public.my_collaborators(), public.add_member(text, uuid, uuid, text),
  public.push_steps(uuid, integer, jsonb, text), public.save_note_snapshot(uuid, integer, jsonb, text, uuid[]),
  public.save_deck(uuid, integer, jsonb, text, text) to authenticated;
