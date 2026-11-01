-- The Atlas (src/learn/atlas) pays a one-time bonus once every structure of a model has been opened.
-- learn_record adds its XP on every call, so a page shown again from the browser's Back/Forward cache,
-- or the same model open in a second tab, could pay that bonus twice. learn_award_explore pays it at
-- most once per topic: it sets lesson_done and adds the XP only while lesson_done is still false, and
-- it leaves mastery alone. It returns whether the XP was paid. Runs as the caller, so RLS applies.
-- Written so it can be run again safely.

create or replace function public.learn_award_explore(p_topic text, p_day date, p_xp integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  paid boolean;
begin
  if p_topic is null or p_topic not like 'atlas:%' then
    raise exception 'the explore bonus is only for Atlas topics';
  end if;

  insert into public.learn_progress as lp (user_id, topic, xp, lesson_done, updated_at)
  values (auth.uid(), p_topic, greatest(p_xp, 0), true, now())
  on conflict (user_id, topic) do update set
    xp = lp.xp + excluded.xp,
    lesson_done = true,
    updated_at = now()
  where not lp.lesson_done
  returning true into paid;

  if not coalesce(paid, false) then
    return false;
  end if;

  insert into public.learn_days as d (user_id, day, xp)
  values (auth.uid(), p_day, greatest(p_xp, 0))
  on conflict (user_id, day) do update set xp = d.xp + excluded.xp;
  return true;
end;
$$;

revoke execute on function public.learn_award_explore(text, date, integer) from public, anon;
grant execute on function public.learn_award_explore(text, date, integer) to authenticated;
