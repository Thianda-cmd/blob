-- Blob: core schema
-- Every row is owned by a user and protected by row level security.

create extension if not exists pg_trgm with schema extensions;

-- updated_at helper ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 80),
  school text check (char_length(school) <= 120),
  grade text check (char_length(grade) <= 40),
  avatar_url text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  blob_tips boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that signed up before this migration ran.
insert into public.profiles (id, full_name)
select id, nullif(trim(raw_user_meta_data ->> 'full_name'), '')
from auth.users
on conflict (id) do nothing;

-- subjects -------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'ink',
  emoji text check (char_length(emoji) <= 16),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index subjects_user_idx on public.subjects (user_id, position);

alter table public.subjects enable row level security;

create policy "subjects: own rows" on public.subjects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- pages (notes and presentation decks) ----------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  parent_id uuid,
  kind text not null default 'note' check (kind in ('note', 'deck')),
  title text not null default '' check (char_length(title) <= 200),
  icon text check (char_length(icon) <= 16),
  content jsonb not null default '{}'::jsonb,
  plain_text text not null default '',
  is_favorite boolean not null default false,
  position double precision not null default 0,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Composite keys make it impossible to attach rows to another user's subject or page.
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (parent_id, user_id) references public.pages (id, user_id) on delete cascade,
  check (parent_id is null or parent_id <> id)
);

create index pages_user_updated_idx on public.pages (user_id, updated_at desc);
create index pages_parent_idx on public.pages (parent_id);
create index pages_subject_idx on public.pages (subject_id);
create index pages_title_trgm_idx on public.pages using gin (title extensions.gin_trgm_ops);
create index pages_text_trgm_idx on public.pages using gin (plain_text extensions.gin_trgm_ops);

create trigger pages_touch before update on public.pages
  for each row execute function public.touch_updated_at();

alter table public.pages enable row level security;

create policy "pages: own rows" on public.pages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- tasks (homework, exams, projects) -------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 2000),
  kind text not null default 'homework' check (kind in ('homework', 'exam', 'project', 'reminder')),
  due_at timestamptz,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);

create index tasks_user_due_idx on public.tasks (user_id, done, due_at);

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

alter table public.tasks enable row level security;

create policy "tasks: own rows" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- storage: images pasted into notes and slides ----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 10485760, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "uploads: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "uploads: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "uploads: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "uploads: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Data API access: signed-in users only (RLS decides which rows).
grant select, insert, update, delete on public.profiles, public.subjects, public.pages, public.tasks to authenticated;
revoke all on public.profiles, public.subjects, public.pages, public.tasks from anon;
