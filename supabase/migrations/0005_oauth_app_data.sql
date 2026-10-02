-- Sign in with Blob: apps can keep their own data (e.g. LernLabor's learning progress) in the
-- person's Blob account, so it follows them to every device. Needs the "data" scope.
-- Only server code (service role) touches this table, like the other oauth_* tables.

create table public.oauth_app_data (
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
  value jsonb not null,
  size integer not null check (size between 0 and 262144),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_id, user_id, key)
);

create index oauth_app_data_user on public.oauth_app_data (user_id);

alter table public.oauth_app_data enable row level security;
revoke all on public.oauth_app_data from anon, authenticated;

-- Writes a value only if the version still matches (optimistic concurrency). Returns the new
-- row, or nothing when someone else wrote in between.
create or replace function public.oauth_app_data_put(
  p_app_id uuid,
  p_user_id uuid,
  p_key text,
  p_value jsonb,
  p_size integer,
  p_expected_version integer
)
returns setof public.oauth_app_data
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expected_version is null then
    return query
      insert into public.oauth_app_data as d (app_id, user_id, key, value, size)
      values (p_app_id, p_user_id, p_key, p_value, p_size)
      on conflict (app_id, user_id, key) do update
        set value = excluded.value, size = excluded.size, version = d.version + 1, updated_at = now()
      returning d.*;
  elsif p_expected_version = 0 then
    return query
      insert into public.oauth_app_data as d (app_id, user_id, key, value, size)
      values (p_app_id, p_user_id, p_key, p_value, p_size)
      on conflict (app_id, user_id, key) do nothing
      returning d.*;
  else
    return query
      update public.oauth_app_data as d
         set value = p_value, size = p_size, version = d.version + 1, updated_at = now()
       where d.app_id = p_app_id and d.user_id = p_user_id and d.key = p_key and d.version = p_expected_version
      returning d.*;
  end if;
end;
$$;

revoke all on function public.oauth_app_data_put(uuid, uuid, text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.oauth_app_data_put(uuid, uuid, text, jsonb, integer, integer) to service_role;
