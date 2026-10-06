-- Learning center: three levels per topic (beginner, intermediate, expert).
--
-- learn_record can now also say which level an answer or lesson was at. The topic's own row
-- keeps the totals as before; the level gets its own row "<topic>@<level>" with the same XP,
-- attempts and streak, its own mastery, and whether that level's lesson is done.
-- Calls without a level (older app versions) work exactly as before.
-- Written so it can be run again safely.

drop function if exists public.learn_record(text, date, integer, integer, integer, integer, integer, boolean);

create or replace function public.learn_record(
  p_topic text,
  p_day date,
  p_xp integer,
  p_attempts integer,
  p_correct integer,
  p_mastery integer,
  p_streak integer,
  p_lesson boolean,
  p_level integer default null,
  p_level_mastery integer default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_level is not null and p_level not between 1 and 3 then
    raise exception 'level must be 1, 2 or 3';
  end if;

  insert into public.learn_progress as lp (user_id, topic, xp, attempts, correct, mastery, best_streak, lesson_done, updated_at)
  values (
    auth.uid(), p_topic, greatest(p_xp, 0), greatest(p_attempts, 0), greatest(p_correct, 0),
    least(greatest(p_mastery, 0), 100), greatest(p_streak, 0), p_lesson, now()
  )
  on conflict (user_id, topic) do update set
    xp = lp.xp + excluded.xp,
    attempts = lp.attempts + excluded.attempts,
    correct = lp.correct + excluded.correct,
    mastery = excluded.mastery,
    best_streak = greatest(lp.best_streak, excluded.best_streak),
    lesson_done = lp.lesson_done or excluded.lesson_done,
    updated_at = now();

  if p_level is not null then
    insert into public.learn_progress as lp (user_id, topic, xp, attempts, correct, mastery, best_streak, lesson_done, updated_at)
    values (
      auth.uid(), p_topic || '@' || p_level, greatest(p_xp, 0), greatest(p_attempts, 0), greatest(p_correct, 0),
      least(greatest(coalesce(p_level_mastery, p_mastery), 0), 100), greatest(p_streak, 0), p_lesson, now()
    )
    on conflict (user_id, topic) do update set
      xp = lp.xp + excluded.xp,
      attempts = lp.attempts + excluded.attempts,
      correct = lp.correct + excluded.correct,
      mastery = excluded.mastery,
      best_streak = greatest(lp.best_streak, excluded.best_streak),
      lesson_done = lp.lesson_done or excluded.lesson_done,
      updated_at = now();
  end if;

  insert into public.learn_days as d (user_id, day, xp)
  values (auth.uid(), p_day, greatest(p_xp, 0))
  on conflict (user_id, day) do update set xp = d.xp + excluded.xp;
end;
$$;

revoke execute on function public.learn_record(text, date, integer, integer, integer, integer, integer, boolean, integer, integer) from public, anon;
grant execute on function public.learn_record(text, date, integer, integer, integer, integer, integer, boolean, integer, integer) to authenticated;
