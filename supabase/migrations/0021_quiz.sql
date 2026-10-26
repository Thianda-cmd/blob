-- Live quizzes: make a quiz (/quiz), host it on a big screen (/live) and play along on any phone
-- without an account (/play, with the game's PIN). See src/quiz.
--
-- Quizzes belong to their maker (row-level security, like everything else). A game is a copy of
-- the quiz at the moment it starts, with its players and their answers; only the server reads and
-- writes games (service role, src/quiz/server.ts): it checks who may do what, grades the answers
-- and keeps the correct ones away from the phones until the question is over.

-- Quizzes ---------------------------------------------------------------------------------------

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 600),
  -- A picture for the quiz (public URL in the uploads bucket).
  cover text check (cover is null or char_length(cover) <= 600),
  -- The questions (src/quiz/model.ts): type, text, picture, time, points and answers.
  questions jsonb not null default '[]'::jsonb,
  -- How it's played by default (shuffling, names, showing answers on the phones).
  settings jsonb not null default '{}'::jsonb,
  plays integer not null default 0,
  last_played_at timestamptz,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 100 and octet_length(questions::text) <= 400000),
  check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 2000)
);

create index if not exists quizzes_user_updated_idx on public.quizzes (user_id, updated_at desc);

drop trigger if exists quizzes_touch on public.quizzes;
create trigger quizzes_touch before update on public.quizzes
  for each row execute function public.touch_updated_at();

alter table public.quizzes enable row level security;

drop policy if exists "quizzes: own rows" on public.quizzes;
create policy "quizzes: own rows" on public.quizzes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.quizzes to authenticated;
revoke all on public.quizzes from anon;

-- Games -----------------------------------------------------------------------------------------

create table if not exists public.quiz_games (
  id uuid primary key default gen_random_uuid(),
  -- What players type to join (unique among games that are still on).
  pin text not null check (pin ~ '^[0-9]{6}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid references public.quizzes (id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  -- The quiz as it was when the game began (answers shuffled already, when asked to).
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  -- lobby → question → reveal → board → question … → podium → ended
  phase text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'board', 'podium', 'ended')),
  q integer not null default -1 check (q between -1 and 99),
  -- Answers count from open_at (after the question's intro) until close_at.
  open_at timestamptz,
  close_at timestamptz,
  -- No one new may join.
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create unique index if not exists quiz_games_live_pin on public.quiz_games (pin) where phase <> 'ended';
create index if not exists quiz_games_host_idx on public.quiz_games (host_id, created_at desc);
create index if not exists quiz_games_quiz_idx on public.quiz_games (quiz_id, created_at desc);

create table if not exists public.quiz_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.quiz_games (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  -- Their Blob: skin and hat (src/components/blob/look.ts).
  look jsonb not null default '{}'::jsonb check (jsonb_typeof(look) = 'object' and octet_length(look::text) <= 300),
  -- SHA-256 (hex) of the secret their phone keeps; the secret itself is never stored.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  score integer not null default 0,
  streak integer not null default 0,
  correct integer not null default 0,
  kicked boolean not null default false,
  joined_at timestamptz not null default now()
);

create unique index if not exists quiz_players_name on public.quiz_players (game_id, lower(nickname)) where not kicked;
create unique index if not exists quiz_players_token on public.quiz_players (token_hash);
create index if not exists quiz_players_game_idx on public.quiz_players (game_id, score desc);

create table if not exists public.quiz_answers (
  game_id uuid not null references public.quiz_games (id) on delete cascade,
  player_id uuid not null references public.quiz_players (id) on delete cascade,
  q integer not null check (q between 0 and 99),
  answer jsonb not null check (octet_length(answer::text) <= 2000),
  -- How right it was, 0..1 (null: not graded, like a poll).
  fraction real,
  points integer not null default 0,
  -- Milliseconds after the answers opened.
  ms integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (player_id, q)
);

create index if not exists quiz_answers_game_idx on public.quiz_answers (game_id, q);

alter table public.quiz_games enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_games, public.quiz_players, public.quiz_answers from anon, authenticated;

/**
 * Records a player's answer once and adds its points: the speed points worked out by the server,
 * plus 100 per correct answer in a row before this one (at most 500) when `p_streak` is on.
 * Returns nothing when the player answered this question already.
 */
create or replace function public.quiz_record_answer(p_game uuid, p_player uuid, p_q integer, p_answer jsonb, p_fraction real, p_points integer, p_ms integer, p_streak boolean)
returns table (points integer, bonus integer, streak integer, score integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  is_full boolean := p_fraction is not null and p_fraction >= 0.999;
  old_streak integer;
  new_streak integer;
  extra integer := 0;
  total integer;
  new_score integer;
begin
  select pl.streak into old_streak from public.quiz_players pl where pl.id = p_player and pl.game_id = p_game and not pl.kicked for update;
  if not found then
    return;
  end if;
  insert into public.quiz_answers (game_id, player_id, q, answer, fraction, points, ms)
  values (p_game, p_player, p_q, p_answer, p_fraction, 0, greatest(0, p_ms))
  on conflict do nothing;
  if not found then
    return;
  end if;
  if p_fraction is null then
    new_streak := old_streak;
  elsif is_full then
    new_streak := old_streak + 1;
  else
    new_streak := 0;
  end if;
  if is_full and p_streak and p_points > 0 then
    extra := least(old_streak, 5) * 100;
  end if;
  total := greatest(0, p_points) + extra;
  update public.quiz_answers a set points = total where a.player_id = p_player and a.q = p_q;
  update public.quiz_players pl
    set score = pl.score + total, streak = new_streak, correct = pl.correct + (case when is_full then 1 else 0 end)
    where pl.id = p_player
    returning pl.score into new_score;
  return query select total, extra, new_streak, new_score;
end $$;

/** Players who didn't answer a graded question lose their streak. */
create or replace function public.quiz_break_streaks(p_game uuid, p_q integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quiz_players pl set streak = 0
  where pl.game_id = p_game and pl.streak <> 0
    and not exists (select 1 from public.quiz_answers a where a.player_id = pl.id and a.q = p_q);
$$;

revoke execute on function public.quiz_record_answer(uuid, uuid, integer, jsonb, real, integer, integer, boolean) from public, anon, authenticated;
revoke execute on function public.quiz_break_streaks(uuid, integer) from public, anon, authenticated;
grant execute on function public.quiz_record_answer(uuid, uuid, integer, jsonb, real, integer, integer, boolean) to service_role;
grant execute on function public.quiz_break_streaks(uuid, integer) to service_role;

-- Live channels ---------------------------------------------------------------------------------
-- "quiz:<game id>": the server tells hosts and players that something changed (they then ask it
-- what). Anyone may listen, no one but the server may send (no insert policy), so nobody can
-- trick the other phones.

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    drop policy if exists "quiz: everyone listens" on realtime.messages;
    create policy "quiz: everyone listens" on realtime.messages for select to anon, authenticated
      using ((select realtime.topic()) like 'quiz:%' and extension = 'broadcast');
  end if;
end $$;
