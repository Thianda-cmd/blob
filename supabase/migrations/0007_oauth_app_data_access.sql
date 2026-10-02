-- Sign in with Blob: app data follow-ups (from the pre-deploy review).
--
-- 1. Counters for data written before 0006, so versions keep going up after those rows are
--    deleted (a device holding an old version can't overwrite a key that was created again).
-- 2. A write only lands while the person still allows the app. Checked under the same lock as
--    "delete all", so "Remove access and delete data" can't be followed by a write that was
--    already under way.
-- Written so it can be run again safely.

insert into public.oauth_app_data_counters (app_id, user_id, last_version)
select d.app_id, d.user_id, max(d.version)
  from public.oauth_app_data d
 group by d.app_id, d.user_id
on conflict (app_id, user_id) do update
  set last_version = greatest(public.oauth_app_data_counters.last_version, excluded.last_version);

-- Same as in 0006, plus: raises BLB03 when the person's permission for the app is gone.
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
  -- writes for the same app and person (and oauth_app_data_delete_all) wait here.
  insert into public.oauth_app_data_counters as c (app_id, user_id, last_version)
  values (
    p_app_id,
    p_user_id,
    coalesce((select max(d.version) from public.oauth_app_data d where d.app_id = p_app_id and d.user_id = p_user_id), 0) + 1
  )
  on conflict (app_id, user_id) do update set last_version = c.last_version + 1
  returning c.last_version into v_version;

  -- Checked after the lock: access removed while this write waited means no write.
  if not exists (
    select 1 from public.oauth_grants g
     where g.app_id = p_app_id and g.user_id = p_user_id and g.revoked_at is null
  ) then
    raise exception 'no access' using errcode = 'BLB03';
  end if;

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

-- Deletes everything one app keeps for one person (Settings › Connected apps). Takes the counter
-- lock first, so a write that is under way finishes before and is deleted too. The counter stays,
-- so versions keep going up. Returns how many keys were deleted.
create or replace function public.oauth_app_data_delete_all(p_app_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.oauth_app_data_counters as c (app_id, user_id, last_version)
  values (
    p_app_id,
    p_user_id,
    coalesce((select max(d.version) from public.oauth_app_data d where d.app_id = p_app_id and d.user_id = p_user_id), 0)
  )
  on conflict (app_id, user_id) do update set last_version = c.last_version;

  delete from public.oauth_app_data d where d.app_id = p_app_id and d.user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.oauth_app_data_delete_all(uuid, uuid) from public, anon, authenticated;
grant execute on function public.oauth_app_data_delete_all(uuid, uuid) to service_role;
