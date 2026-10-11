-- Blob's calendar: events (one row per event or recurring series), plus the settings the
-- calendar and the apps' notifications need on the profile. See docs/calendar-offline-native.md.

-- Minutes for reminders: at most 5, from 1 day after the start (all-day events count from local
-- midnight, so "on the day at 9:00" is -540) to 4 weeks before.
create or replace function public.reminder_minutes_ok(m integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select m is not null
    and cardinality(m) <= 5
    and coalesce((select bool_and(x between -1440 and 40320) from unnest(m) x), true);
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  details text check (char_length(details) <= 4000),
  location text check (char_length(location) <= 200),
  kind text not null default 'event' check (kind in ('event', 'lesson', 'study', 'birthday', 'break')),
  -- A subject colour key; null takes the subject's colour (or Blob's).
  color text check (color in ('ink', 'clay', 'moss', 'sky', 'plum', 'sand', 'rose', 'teal')),
  all_day boolean not null default false,
  -- All-day events store UTC midnights that stand for dates (end exclusive: one day is [d, d+1)).
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- The IANA zone the event was made in (for jobs on the server; the apps work in local time).
  time_zone text check (char_length(time_zone) <= 64),
  -- {freq: daily|weekly|monthly|yearly, interval: 1..99, byDay?: [0..6], until?: "yyyy-mm-dd", count?: 1..1000}
  recurrence jsonb,
  -- Occurrences of a series that were removed (their original start).
  exdates timestamptz[] not null default '{}',
  -- A changed occurrence of a series: the series and the start it replaces.
  series_id uuid,
  series_start timestamptz,
  reminders integer[] not null default '{}',
  -- Deleted events stay as tombstones for a while, so devices that were offline hear about it.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (series_id, user_id) references public.events (id, user_id) on delete cascade,
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '400 days'),
  check (recurrence is null or (
    jsonb_typeof(recurrence) = 'object'
    and recurrence ->> 'freq' in ('daily', 'weekly', 'monthly', 'yearly')
    and octet_length(recurrence::text) <= 600
  )),
  check (series_id is null or (recurrence is null and series_start is not null)),
  check (series_id is null or series_id <> id),
  check (cardinality(exdates) <= 1000),
  check (public.reminder_minutes_ok(reminders))
);

create index if not exists events_user_start_idx on public.events (user_id, starts_at);
create index if not exists events_user_updated_idx on public.events (user_id, updated_at);
create index if not exists events_series_idx on public.events (series_id) where series_id is not null;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.events enable row level security;

drop policy if exists "events: own rows" on public.events;
create policy "events: own rows" on public.events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.events to authenticated;
revoke all on public.events from anon;

-- Live updates: other devices see changes right away.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;

-- Profile settings ------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1,
  add column if not exists time_zone text,
  add column if not exists notify jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_week_starts_on_range;
alter table public.profiles add constraint profiles_week_starts_on_range check (week_starts_on between 0 and 6);
alter table public.profiles drop constraint if exists profiles_time_zone_small;
alter table public.profiles add constraint profiles_time_zone_small check (char_length(time_zone) <= 64);
alter table public.profiles drop constraint if exists profiles_notify_small;
alter table public.profiles add constraint profiles_notify_small check (jsonb_typeof(notify) = 'object' and octet_length(notify::text) <= 2000);

-- Signing the desktop app in through the browser ----------------------------------------------
-- The browser page (signed in) stores a one-time code for the app; the app trades it, with the
-- PKCE verifier only it knows, for a session (src/app/api/auth/app). Only the server's service
-- role reads and writes these rows: no policies, no grants.

create table if not exists public.app_sign_ins (
  -- SHA-256 (hex) of the code; the code itself is never stored.
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- base64url SHA-256 of the app's verifier (PKCE S256).
  challenge text not null check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')
);

create index if not exists app_sign_ins_expires_idx on public.app_sign_ins (expires_at);

alter table public.app_sign_ins enable row level security;
revoke all on public.app_sign_ins from anon, authenticated;
