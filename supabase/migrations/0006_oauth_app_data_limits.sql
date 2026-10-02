-- Sign in with Blob: app data limits that hold under load (from the security review).
--
-- 1. App data writes for one (app, person) run one after another, so the 50-key limit holds
--    even when many PUTs arrive at once.
-- 2. The size is also measured on what Postgres stores and sends back (jsonb prints numbers in
--    full, so 1e308 becomes 309 digits), so one value can't cost megabytes per read.
-- 3. Versions only ever go up, also across DELETE, so a device holding an old version can't
--    overwrite a key that was deleted and created again.
-- Written so it can be run again safely.

-- One row per (app, person): the last version handed out. Writing takes this row's lock, which
-- also serialises that person's writes for that app.
create table if not exists public.oauth_app_data_counters (
  app_id uuid not null references public.oauth_apps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_version integer not null default 0 check (last_version >= 0),
  primary key (app_id, user_id)
);

create index if not exists oauth_app_data_counters_user on public.oauth_app_data_counters (user_id);

alter table public.oauth_app_data_counters enable row level security;
revoke all on public.oauth_app_data_counters from anon, authenticated;

-- Writes a value with optimistic concurrency. p_expected_version: null = overwrite, 0 = only
-- create, n = only if the stored version is still n. Returns the new row, or nothing when the
-- version didn't match. Raises BLB01 when a new key would pass 50 keys for this app and person,
-- and BLB02 when the stored form of the value would pass 384 KiB.
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
declare
  v_version integer;
  v_current integer;
  v_keys integer;
begin
  -- 384 KiB = 256 KiB of compact JSON with the spaces jsonb adds after ':' and ','. Only numbers
  -- written with an exponent (1e308, 1e-300) grow beyond that.
  if octet_length(p_value::text) > 393216 then
    raise exception 'value too large' using errcode = 'BLB02';
  end if;

  -- Take the next version. The row stays locked until the end of this call, so concurrent
  -- writes for the same app and person wait here.
  insert into public.oauth_app_data_counters as c (app_id, user_id, last_version)
  values (
    p_app_id,
    p_user_id,
    coalesce((select max(d.version) from public.oauth_app_data d where d.app_id = p_app_id and d.user_id = p_user_id), 0) + 1
  )
  on conflict (app_id, user_id) do update set last_version = c.last_version + 1
  returning c.last_version into v_version;

  select d.version into v_current
    from public.oauth_app_data d
   where d.app_id = p_app_id and d.user_id = p_user_id and d.key = p_key;

  if v_current is null then
    -- Only "overwrite" and "create only" may create a key.
    if p_expected_version is not null and p_expected_version <> 0 then
      return;
    end if;
    select count(*) into v_keys from public.oauth_app_data d where d.app_id = p_app_id and d.user_id = p_user_id;
    if v_keys >= 50 then
      raise exception 'too many keys' using errcode = 'BLB01';
    end if;
    return query
      insert into public.oauth_app_data as d (app_id, user_id, key, value, size, version)
      values (p_app_id, p_user_id, p_key, p_value, p_size, v_version)
      on conflict (app_id, user_id, key) do nothing
      returning d.*;
  elsif p_expected_version is null or p_expected_version = v_current then
    return query
      update public.oauth_app_data as d
         set value = p_value, size = p_size, version = v_version, updated_at = now()
       where d.app_id = p_app_id and d.user_id = p_user_id and d.key = p_key
         and (p_expected_version is null or d.version = p_expected_version)
      returning d.*;
  end if;
  -- Otherwise (exists but "create only", or another version): nothing, the caller reports a conflict.
end;
$$;

revoke all on function public.oauth_app_data_put(uuid, uuid, text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.oauth_app_data_put(uuid, uuid, text, jsonb, integer, integer) to service_role;
