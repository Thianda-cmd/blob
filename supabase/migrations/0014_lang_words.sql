-- The language courses (French first): how well each word sits for each student.
--
-- Lessons and XP use learn_progress / learn_days like every other subject (keys "fr:<unit>:<n>"),
-- so the streak and the daily goal are shared with the learning center. Here: per word, a strength
-- from 0 to 5 and when it should come back (spaced repetition), for practice rounds and the word list.

create table if not exists public.lang_words (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course text not null check (course in ('fr')),
  word_id text not null check (char_length(word_id) between 1 and 80),
  strength smallint not null default 0 check (strength between 0 and 5),
  seen integer not null default 0 check (seen >= 0),
  wrong integer not null default 0 check (wrong >= 0),
  due_on date not null default current_date,
  last_seen timestamptz not null default now(),
  primary key (user_id, course, word_id)
);

alter table public.lang_words enable row level security;
drop policy if exists "lang_words: own rows" on public.lang_words;
create policy "lang_words: own rows" on public.lang_words for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.lang_words to authenticated;
revoke all on public.lang_words from anon;

/**
 * After a lesson: how each word went ([{ "id": "pomme", "ok": 2, "bad": 0 }, …]). A word answered
 * right gets stronger and comes back later (1, 3, 7, 14, 30 days); a mistake weakens it and
 * brings it back today. p_day is the student's own date.
 */
create or replace function public.lang_words_record(p_course text, p_day date, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  ok integer;
  bad integer;
  s integer;
  wait integer[] := array[0, 1, 3, 7, 14, 30];
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 400 then
    raise exception 'lang_words_record: a list of at most 400 words' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    ok := greatest(0, least(50, coalesce((item ->> 'ok')::integer, 0)));
    bad := greatest(0, least(50, coalesce((item ->> 'bad')::integer, 0)));
    if ok + bad = 0 or coalesce(item ->> 'id', '') = '' then
      continue;
    end if;
    select w.strength into s from public.lang_words w
    where w.user_id = (select auth.uid()) and w.course = p_course and w.word_id = item ->> 'id';
    s := coalesce(s, 0);
    s := case when bad > 0 then greatest(0, s - 1) else least(5, s + 1) end;
    insert into public.lang_words as w (user_id, course, word_id, strength, seen, wrong, due_on, last_seen)
    values ((select auth.uid()), p_course, item ->> 'id', s, ok + bad, bad, p_day + wait[s + 1], now())
    on conflict (user_id, course, word_id) do update
      set strength = excluded.strength,
          seen = w.seen + excluded.seen,
          wrong = w.wrong + excluded.wrong,
          due_on = excluded.due_on,
          last_seen = excluded.last_seen;
  end loop;
end;
$$;

revoke execute on function public.lang_words_record(text, date, jsonb) from public, anon;
grant execute on function public.lang_words_record(text, date, jsonb) to authenticated;
