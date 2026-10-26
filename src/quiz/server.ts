import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HATS, SKINS } from "@/components/blob/look";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { INTRO_MS, LIMITS, normalizeQuestions, normalizeSettings, playable, issuesOf, type Question, type QuizSettings } from "./model";
import { cleanNickname, isBlobName, isRude } from "./names";
import { grade, isRight, parseAnswer, sliderTolerance, speedPoints, normalizeText, textMatches, type PlayerAnswer } from "./score";
import type { GameInfo, GamePeek, HostPlayer, HostView, Look, Mine, Phase, PlayerView, Reveal, ShownQuestion, Standing } from "./views";

// Live games, worked out on the server only (the service role; games are closed to everyone else,
// migration 0021). The host's screen and the phones ask for the game's state and send what they
// do; after every change the server tells them over a live channel ("quiz:<game id>") that there
// is something new, and they ask again. Answers count with the time the server got them.

/** Late answers still count for this long after the time is up (slow networks). */
const GRACE_MS = 1200;
/** Games nobody finished stop after this long (their PIN is free again). */
const STALE_MS = 12 * 3600e3;

type GameRow = {
  id: string;
  pin: string;
  host_id: string;
  quiz_id: string | null;
  title: string;
  questions: unknown;
  settings: unknown;
  phase: Phase;
  q: number;
  open_at: string | null;
  close_at: string | null;
  locked: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type PlayerRow = { id: string; game_id: string; nickname: string; look: unknown; score: number; streak: number; correct: number; kicked: boolean; joined_at: string };
type AnswerRow = { player_id: string; q: number; answer: unknown; fraction: number | null; points: number; ms: number };

/** A game with its questions and settings read. */
export type Game = GameRow & { qs: Question[]; set: QuizSettings };

export class QuizError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}

const db = (): SupabaseClient => createAdminClient();
const ms = (iso: string | null) => (iso ? Date.parse(iso) : null);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function read(row: GameRow): Game {
  return { ...row, qs: normalizeQuestions(row.questions), set: normalizeSettings(row.settings) };
}

function cleanLook(raw: unknown): Look {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    skin: typeof o.skin === "string" && (SKINS as readonly string[]).includes(o.skin) ? (o.skin as Look["skin"]) : null,
    hat: typeof o.hat === "string" && (HATS as readonly string[]).includes(o.hat) ? (o.hat as Look["hat"]) : null,
  };
}

/** Tells everyone in the game that something changed (they then ask for the state). */
async function ping(gameId: string, event: "sync" | "answer" = "sync") {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      // Legacy service role keys are JWTs and go along as the bearer too; the new secret keys don't.
      headers: { apikey: key, "Content-Type": "application/json", ...(key.startsWith("ey") ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ messages: [{ topic: `quiz:${gameId}`, event, payload: { at: Date.now() }, private: true }] }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // The devices also ask now and then, so they catch up either way.
  }
}

// Loading ---------------------------------------------------------------------------------------

async function gameById(id: string): Promise<Game | null> {
  if (!isUuid(id)) return null;
  const { data } = await db().from("quiz_games").select("*").eq("id", id).maybeSingle();
  return data ? read(data as GameRow) : null;
}

/** The game with this PIN that is still on. */
async function gameByPin(pin: string): Promise<Game | null> {
  if (!/^\d{6}$/.test(pin)) return null;
  const { data } = await db().from("quiz_games").select("*").eq("pin", pin).neq("phase", "ended").maybeSingle();
  if (!data) return null;
  const game = read(data as GameRow);
  if (Date.now() - Date.parse(game.created_at) > STALE_MS) {
    await db().from("quiz_games").update({ phase: "ended", ended_at: new Date().toISOString() }).eq("id", game.id);
    return null;
  }
  return game;
}

async function playerByToken(token: unknown): Promise<PlayerRow | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data } = await db().from("quiz_players").select("*").eq("token_hash", hashToken(token)).maybeSingle();
  return (data as PlayerRow | null) ?? null;
}

async function playersOf(gameId: string): Promise<PlayerRow[]> {
  const { data } = await db().from("quiz_players").select("id, game_id, nickname, look, score, streak, correct, kicked, joined_at").eq("game_id", gameId).order("joined_at").limit(LIMITS.players + 50);
  return (data as PlayerRow[] | null) ?? [];
}

async function answersOf(gameId: string, q: number): Promise<AnswerRow[]> {
  if (q < 0) return [];
  const { data } = await db().from("quiz_answers").select("player_id, q, answer, fraction, points, ms").eq("game_id", gameId).eq("q", q).limit(LIMITS.players + 50);
  return (data as AnswerRow[] | null) ?? [];
}

// Moving on -------------------------------------------------------------------------------------

/** Changes the game if it is still where `from` says (two clicks or two devices never skip a step). */
async function move(game: Game, from: { phase: Phase; q: number }, values: Partial<GameRow>): Promise<Game> {
  const { data } = await db().from("quiz_games").update(values).eq("id", game.id).eq("phase", from.phase).eq("q", from.q).select("*").maybeSingle();
  if (!data) {
    const now = await gameById(game.id);
    if (!now) throw new QuizError("not_found", 404);
    return now;
  }
  void ping(game.id);
  return read(data as GameRow);
}

/** A question whose time is up shows its answer, even when the host's screen is asleep. */
async function settle(game: Game): Promise<Game> {
  if (game.phase !== "question" || !game.close_at || Date.now() < Date.parse(game.close_at) + GRACE_MS) return game;
  return reveal(game);
}

async function reveal(game: Game): Promise<Game> {
  if (game.phase !== "question") return game;
  const now = Date.now();
  const closed = ms(game.close_at);
  const next = await move(game, { phase: "question", q: game.q }, { phase: "reveal", close_at: new Date(closed !== null && closed < now ? closed : now).toISOString() });
  const q = game.qs[game.q];
  if (q && q.type !== "poll" && next.phase === "reveal" && next.q === game.q) await db().rpc("quiz_break_streaks", { p_game: game.id, p_q: game.q });
  return next;
}

function openQuestion(game: Game, index: number): Partial<GameRow> {
  const q = game.qs[index];
  const open = Date.now() + INTRO_MS;
  return { phase: "question", q: index, open_at: new Date(open).toISOString(), close_at: new Date(open + q.time * 1000).toISOString() };
}

// Views -----------------------------------------------------------------------------------------

/** The same shuffle for everyone, from the game and the question. */
function seeded<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // A puzzle never starts out solved.
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift()!);
  return out;
}

function shown(game: Game, index: number, forPlayers: boolean): ShownQuestion | null {
  const q = game.qs[index];
  if (!q) return null;
  const hide = forPlayers && !game.set.showOnDevices;
  const order = q.type === "puzzle" ? seeded(q.choices, `${game.id}:${index}`) : q.choices;
  return {
    index,
    type: q.type,
    text: hide ? null : q.text,
    image: hide ? null : q.image,
    time: q.time,
    points: q.points,
    multi: q.type === "quiz" && q.multi,
    // Puzzle pieces take their colours from where they're shown (else the colours would give the order away).
    choices: order.map((c, i) => ({ id: c.id, text: hide && q.type !== "puzzle" ? null : c.text, style: q.type === "puzzle" ? i : q.choices.indexOf(c) })),
    slider: q.slider ? { min: q.slider.min, max: q.slider.max, step: q.slider.step, unit: q.slider.unit } : null,
  };
}

function info(game: Game): GameInfo {
  return {
    id: game.id,
    pin: game.pin,
    title: game.title,
    phase: game.phase,
    q: game.q,
    total: game.qs.length,
    openAt: ms(game.open_at),
    closeAt: ms(game.close_at),
    locked: game.locked,
    showOnDevices: game.set.showOnDevices,
    names: game.set.names,
    streaks: game.set.streaks,
  };
}

function revealOf(q: Question, answers: AnswerRow[], players: number): Reveal {
  const counts: Record<string, number> = Object.fromEntries(q.choices.map((c) => [c.id, 0]));
  const texts = new Map<string, { text: string; count: number; right: boolean }>();
  let sum = 0;
  let values = 0;
  for (const a of answers) {
    const ans = a.answer as PlayerAnswer;
    if (ans?.kind === "choice") for (const id of ans.ids) if (id in counts) counts[id]++;
    if (ans?.kind === "text") {
      const key = normalizeText(ans.text);
      const cur = texts.get(key) ?? { text: ans.text.slice(0, 40), count: 0, right: textMatches(ans.text, q.accepted) };
      cur.count++;
      texts.set(key, cur);
    }
    if (ans?.kind === "value") {
      sum += ans.value;
      values++;
    }
  }
  return {
    right: q.type === "puzzle" ? q.choices.map((c) => c.id) : q.choices.filter((c) => c.correct).map((c) => c.id),
    accepted: q.type === "type" ? q.accepted : [],
    value: q.slider ? q.slider.value : null,
    tolerance: q.slider ? sliderTolerance(q.slider) : null,
    explain: q.explain,
    counts,
    answered: answers.length,
    correct: answers.filter((a) => isRight(a.fraction)).length,
    players,
    texts: [...texts.values()].sort((x, y) => y.count - x.count || Number(y.right) - Number(x.right)).slice(0, 6),
    average: values ? sum / values : null,
  };
}

/** Everyone in order, with where they stood before the last question (for the scoreboard's moves). */
function standings(players: PlayerRow[], answers: AnswerRow[]): Standing[] {
  const gained = new Map(answers.map((a) => [a.player_id, a.points]));
  const live = players.filter((p) => !p.kicked);
  const rows = live.map((p) => ({ p, before: p.score - (gained.get(p.id) ?? 0) }));
  // Equal points, equal place (1, 2, 2, 4).
  const place = (score: number, all: number[]) => 1 + all.filter((x) => x > score).length;
  const befores = rows.map((r) => r.before);
  const scores = rows.map((r) => r.p.score);
  return rows
    .sort((a, b) => b.p.score - a.p.score || a.p.joined_at.localeCompare(b.p.joined_at))
    .map((r) => ({ id: r.p.id, nickname: r.p.nickname, look: cleanLook(r.p.look), score: r.p.score, rank: place(r.p.score, scores), before: r.before, beforeRank: place(r.before, befores), gained: gained.get(r.p.id) ?? 0, streak: r.p.streak }));
}

const showsAnswer = (phase: Phase) => phase === "reveal" || phase === "board" || phase === "podium" || phase === "ended";

function mineOf(answer: AnswerRow | undefined): Mine {
  if (!answer) return { answered: false, answer: null, points: 0, bonus: 0, fraction: null, right: false };
  return { answered: true, answer: answer.answer as PlayerAnswer, points: answer.points, bonus: 0, fraction: answer.fraction, right: isRight(answer.fraction) };
}

async function playerView(game: Game, player: PlayerRow): Promise<PlayerView> {
  const [players, answers] = await Promise.all([playersOf(game.id), answersOf(game.id, game.q)]);
  const board = standings(players, answers);
  const me = board.find((s) => s.id === player.id);
  const meIndex = board.findIndex((s) => s.id === player.id);
  const q = game.qs[game.q];
  const inGame = game.phase !== "lobby" && game.q >= 0;
  const myAnswer = answers.find((a) => a.player_id === player.id);
  // The rank and gap only show once the question is over (else they'd give answers away).
  const settled = showsAnswer(game.phase) || game.phase === "lobby";
  // The nearest player with more points (not someone you're tied with).
  const above = meIndex > 0 ? [...board.slice(0, meIndex)].reverse().find((s) => s.score > board[meIndex].score) : undefined;
  const ahead = settled && above ? { nickname: above.nickname, gap: above.score - board[meIndex].score } : null;
  return {
    now: Date.now(),
    game: info(game),
    question: inGame ? shown(game, game.q, true) : null,
    reveal: inGame && q && showsAnswer(game.phase) ? revealOf(q, answers, board.length) : null,
    me: {
      id: player.id,
      nickname: player.nickname,
      look: cleanLook(player.look),
      score: settled ? player.score : (me?.before ?? player.score),
      rank: settled ? (me?.rank ?? board.length + 1) : (me?.beforeRank ?? board.length + 1),
      moved: settled && me ? Math.max(0, me.beforeRank - me.rank) : 0,
      players: board.length,
      streak: player.streak,
      correct: player.correct,
      kicked: player.kicked,
    },
    mine: inGame ? (showsAnswer(game.phase) ? mineOf(myAnswer) : { ...mineOf(myAnswer), points: 0, fraction: null, right: false }) : null,
    ahead,
    podium: game.phase === "podium" || game.phase === "ended" ? board.slice(0, 3) : null,
  };
}

async function hostView(game: Game): Promise<HostView> {
  const [players, answers] = await Promise.all([playersOf(game.id), answersOf(game.id, game.q)]);
  const answered = new Set(answers.map((a) => a.player_id));
  const live = players.filter((p) => !p.kicked);
  const board = standings(players, answers);
  const q = game.qs[game.q] ?? null;
  const inGame = game.phase !== "lobby" && game.q >= 0;
  return {
    now: Date.now(),
    game: { ...info(game), quizId: game.quiz_id, startedAt: ms(game.started_at) },
    question: inGame ? q : null,
    shown: inGame ? shown(game, game.q, false) : null,
    players: live.map((p): HostPlayer => ({ id: p.id, nickname: p.nickname, look: cleanLook(p.look), score: p.score, correct: p.correct, answered: answered.has(p.id), joinedAt: Date.parse(p.joined_at) })),
    answered: answers.filter((a) => live.some((p) => p.id === a.player_id)).length,
    reveal: inGame && q && showsAnswer(game.phase) ? revealOf(q, answers, live.length) : null,
    board: game.phase === "board" || game.phase === "reveal" ? board.slice(0, 5) : null,
    podium: game.phase === "podium" || game.phase === "ended" ? board.slice(0, 5) : null,
  };
}

// For the host ----------------------------------------------------------------------------------

function newPin() {
  // 6 digits, never starting with 0 (easier to read out).
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Starts a game of one of your quizzes (in its lobby, with a fresh PIN). */
export async function createGame(userId: string, quizId: string, override?: Partial<QuizSettings>): Promise<{ id: string; pin: string }> {
  if (!isUuid(quizId)) throw new QuizError("not_found", 404);
  const { data: quiz } = await db().from("quizzes").select("id, user_id, title, questions, settings, plays, trashed_at").eq("id", quizId).maybeSingle();
  if (!quiz || quiz.user_id !== userId || quiz.trashed_at) throw new QuizError("not_found", 404);
  const settings = normalizeSettings({ ...normalizeSettings(quiz.settings), ...(override ?? {}) });
  let questions = normalizeQuestions(quiz.questions).filter((q) => !issuesOf(q).length).map(playable);
  if (!questions.length) throw new QuizError("empty");
  if (settings.shuffleQuestions) questions = shuffle(questions);
  if (settings.shuffleAnswers) questions = questions.map((q) => (q.type === "quiz" || q.type === "poll" ? { ...q, choices: shuffle(q.choices) } : q));

  // Games left open for too long give their PIN back.
  await db().from("quiz_games").update({ phase: "ended", ended_at: new Date().toISOString() }).neq("phase", "ended").lt("created_at", new Date(Date.now() - STALE_MS).toISOString());
  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = newPin();
    const { data, error } = await db()
      .from("quiz_games")
      .insert({ pin, host_id: userId, quiz_id: quiz.id, title: (quiz.title || "").slice(0, 120), questions, settings })
      .select("id, pin")
      .single();
    if (!error && data) {
      await db().from("quizzes").update({ plays: (quiz.plays ?? 0) + 1, last_played_at: new Date().toISOString() }).eq("id", quiz.id);
      return data as { id: string; pin: string };
    }
    if ((error as { code?: string } | null)?.code !== "23505") throw new QuizError("failed", 500);
  }
  throw new QuizError("failed", 500);
}

async function hostGame(userId: string, gameId: string): Promise<Game> {
  const game = await gameById(gameId);
  if (!game || game.host_id !== userId) throw new QuizError("not_found", 404);
  return game;
}

export async function hostState(userId: string, gameId: string): Promise<HostView> {
  return hostView(await settle(await hostGame(userId, gameId)));
}

export type HostAction = "start" | "reveal" | "next" | "end" | "lock" | "unlock" | "kick";

export async function hostAct(userId: string, gameId: string, action: HostAction, playerId?: string): Promise<HostView> {
  let game = await settle(await hostGame(userId, gameId));
  const at = { phase: game.phase, q: game.q };
  switch (action) {
    case "start":
      if (game.phase === "lobby") game = await move(game, at, { ...openQuestion(game, 0), started_at: new Date().toISOString() });
      break;
    case "reveal":
      game = await reveal(game);
      break;
    case "next":
      if (game.phase === "reveal") {
        // After the last question straight to the podium; else the scoreboard first.
        game = await move(game, at, game.q >= game.qs.length - 1 ? { phase: "podium" } : { phase: "board" });
      } else if (game.phase === "board") {
        game = await move(game, at, openQuestion(game, game.q + 1));
      } else if (game.phase === "podium") {
        game = await move(game, at, { phase: "ended", ended_at: new Date().toISOString() });
      }
      break;
    case "end":
      if (game.phase !== "ended") game = await move(game, at, { phase: "ended", ended_at: new Date().toISOString() });
      break;
    case "lock":
    case "unlock":
      await db().from("quiz_games").update({ locked: action === "lock" }).eq("id", game.id);
      game = { ...game, locked: action === "lock" };
      void ping(game.id);
      break;
    case "kick":
      if (isUuid(playerId)) {
        await db().from("quiz_players").update({ kicked: true }).eq("id", playerId).eq("game_id", game.id);
        void ping(game.id);
      }
      break;
  }
  return hostView(game);
}

// For the players -------------------------------------------------------------------------------

export async function peek(pin: string): Promise<GamePeek | null> {
  const game = await gameByPin(pin);
  if (!game) return null;
  const { count } = await db().from("quiz_players").select("id", { count: "exact", head: true }).eq("game_id", game.id).eq("kicked", false);
  return { title: game.title, phase: game.phase, locked: game.locked, full: (count ?? 0) >= LIMITS.players, names: game.set.names };
}

/** Joins a game: a new player with a secret only their phone keeps. */
export async function join(pin: string, rawName: unknown, rawLook: unknown): Promise<{ token: string; view: PlayerView }> {
  const game = await gameByPin(pin);
  if (!game) throw new QuizError("not_found", 404);
  if (game.locked) throw new QuizError("locked", 403);
  if (game.phase === "podium") throw new QuizError("over", 403);
  const nickname = cleanNickname(rawName, LIMITS.nickname);
  if (!nickname) throw new QuizError("name");
  if (game.set.names === "blob" ? !isBlobName(nickname) : isRude(nickname)) throw new QuizError("name_rude");
  const { count } = await db().from("quiz_players").select("id", { count: "exact", head: true }).eq("game_id", game.id).eq("kicked", false);
  if ((count ?? 0) >= LIMITS.players) throw new QuizError("full", 403);
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await db().from("quiz_players").insert({ game_id: game.id, nickname, look: cleanLook(rawLook), token_hash: hashToken(token) }).select("*").single();
  if (error || !data) throw new QuizError((error as { code?: string } | null)?.code === "23505" ? "name_taken" : "failed", 409);
  void ping(game.id);
  return { token, view: await playerView(game, data as PlayerRow) };
}

async function playerGame(token: unknown): Promise<{ player: PlayerRow; game: Game }> {
  const player = await playerByToken(token);
  if (!player) throw new QuizError("not_found", 404);
  const game = await gameById(player.game_id);
  if (!game) throw new QuizError("not_found", 404);
  return { player, game: await settle(game) };
}

export async function playerState(token: unknown): Promise<PlayerView> {
  const { player, game } = await playerGame(token);
  return playerView(game, player);
}

/** An answer to the question that is open now. */
export async function answer(token: unknown, index: unknown, raw: unknown): Promise<PlayerView> {
  const { player, game } = await playerGame(token);
  if (player.kicked) throw new QuizError("kicked", 403);
  const now = Date.now();
  const q = game.qs[game.q];
  if (game.phase !== "question" || index !== game.q || !q || !game.open_at || !game.close_at) throw new QuizError("closed", 409);
  const open = Date.parse(game.open_at);
  if (now < open - 400 || now > Date.parse(game.close_at) + GRACE_MS) throw new QuizError("closed", 409);
  const parsed = parseAnswer(q, raw);
  if (!parsed) throw new QuizError("answer");
  const fraction = grade(q, parsed);
  const took = Math.min(q.time * 1000, Math.max(0, now - open));
  const points = speedPoints(q, fraction, took);
  const { error } = await db().rpc("quiz_record_answer", {
    p_game: game.id,
    p_player: player.id,
    p_q: game.q,
    p_answer: parsed,
    p_fraction: fraction,
    p_points: points,
    p_ms: took,
    p_streak: game.set.streaks,
  });
  if (error) throw new QuizError("failed", 500);
  // Everyone has answered: no need to wait for the clock.
  const [players, answers] = await Promise.all([playersOf(game.id), answersOf(game.id, game.q)]);
  const live = players.filter((p) => !p.kicked);
  const done = live.length > 0 && live.every((p) => answers.some((a) => a.player_id === p.id));
  let current = game;
  if (done) current = await reveal(game);
  else void ping(game.id, "answer");
  return playerView(current, { ...player, ...(players.find((p) => p.id === player.id) ?? {}) });
}

/** A player leaves (their name is free again). */
export async function leave(token: unknown) {
  const player = await playerByToken(token);
  if (!player) return;
  await db().from("quiz_players").update({ kicked: true }).eq("id", player.id);
  void ping(player.game_id);
}

// Reports ---------------------------------------------------------------------------------------

export type ReportPlayer = { id: string; nickname: string; look: Look; score: number; correct: number; rank: number; answers: ({ fraction: number | null; points: number; ms: number } | null)[] };
export type ReportQuestion = { index: number; question: Question; answered: number; correct: number; averageMs: number | null };
export type Report = { id: string; title: string; pin: string; quizId: string | null; createdAt: string; endedAt: string | null; phase: Phase; players: ReportPlayer[]; questions: ReportQuestion[] };

/** How a game went, for its host. */
export async function report(userId: string, gameId: string): Promise<Report | null> {
  const game = await gameById(gameId);
  if (!game || game.host_id !== userId) return null;
  const [players, { data: answerRows }] = await Promise.all([playersOf(game.id), db().from("quiz_answers").select("player_id, q, answer, fraction, points, ms").eq("game_id", game.id).limit(30000)]);
  const answers = (answerRows as AnswerRow[] | null) ?? [];
  const live = players.filter((p) => !p.kicked).sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  const byPlayer = new Map<string, Map<number, AnswerRow>>();
  for (const a of answers) {
    if (!byPlayer.has(a.player_id)) byPlayer.set(a.player_id, new Map());
    byPlayer.get(a.player_id)!.set(a.q, a);
  }
  const played = game.phase === "lobby" ? 0 : Math.min(game.qs.length, game.q + 1);
  return {
    id: game.id,
    title: game.title,
    pin: game.pin,
    quizId: game.quiz_id,
    createdAt: game.created_at,
    endedAt: game.ended_at,
    phase: game.phase,
    players: live.map((p, i) => ({
      id: p.id,
      nickname: p.nickname,
      look: cleanLook(p.look),
      score: p.score,
      correct: p.correct,
      rank: i + 1,
      answers: Array.from({ length: played }, (_, q) => {
        const a = byPlayer.get(p.id)?.get(q);
        return a ? { fraction: a.fraction, points: a.points, ms: a.ms } : null;
      }),
    })),
    questions: game.qs.slice(0, played).map((question, index) => {
      const list = answers.filter((a) => a.q === index);
      return { index, question, answered: list.length, correct: list.filter((a) => isRight(a.fraction)).length, averageMs: list.length ? list.reduce((s, a) => s + a.ms, 0) / list.length : null };
    }),
  };
}

/** The host's games of a quiz, newest first (for its results). */
export async function gamesOf(userId: string, quizId: string) {
  if (!isUuid(quizId)) return [];
  const { data } = await db().from("quiz_games").select("id, pin, phase, created_at, ended_at, q, questions").eq("host_id", userId).eq("quiz_id", quizId).order("created_at", { ascending: false }).limit(30);
  const games = (data as (Pick<GameRow, "id" | "pin" | "phase" | "created_at" | "ended_at" | "q"> & { questions: unknown[] })[] | null) ?? [];
  if (!games.length) return [];
  const { data: counts } = await db().from("quiz_players").select("game_id").in("game_id", games.map((g) => g.id)).eq("kicked", false).limit(10000);
  const players = new Map<string, number>();
  for (const r of (counts as { game_id: string }[] | null) ?? []) players.set(r.game_id, (players.get(r.game_id) ?? 0) + 1);
  return games.map((g) => ({ id: g.id, pin: g.pin, phase: g.phase, createdAt: g.created_at, endedAt: g.ended_at, questions: Array.isArray(g.questions) ? g.questions.length : 0, players: players.get(g.id) ?? 0 }));
}
