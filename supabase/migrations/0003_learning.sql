-- Learning center: progress per topic and XP per day (for streaks and the daily goal).

create table public.learn_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 80),
  xp integer not null default 0 check (xp >= 0),
  mastery integer not null default 0 check (mastery between 0 and 100),
  attempts integer not null default 0,
  correct integer not null default 0,
  best_streak integer not null default 0,
  lesson_done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create table public.learn_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  xp integer not null default 0 check (xp >= 0),
  primary key (user_id, day)
);

alter table public.learn_progress enable row level security;
alter table public.learn_days enable row level security;

create policy "learn_progress: own rows" on public.learn_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "learn_days: own rows" on public.learn_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.learn_progress, public.learn_days to authenticated;
revoke all on public.learn_progress, public.learn_days from anon;

-- Records one answer (or a finished lesson) atomically. Runs as the caller, so RLS applies.
create or replace function public.learn_record(
  p_topic text,
  p_day date,
  p_xp integer,
  p_attempts integer,
  p_correct integer,
  p_mastery integer,
  p_streak integer,
  p_lesson boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
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

  insert into public.learn_days as d (user_id, day, xp)
  values (auth.uid(), p_day, greatest(p_xp, 0))
  on conflict (user_id, day) do update set xp = d.xp + excluded.xp;
$$;

revoke execute on function public.learn_record from public, anon;
grant execute on function public.learn_record to authenticated;
