// Live quizzes: what a quiz is made of. A quiz is a list of questions; each question has a type, a
// text (and maybe a picture), a time limit and how many points it's worth. The same shapes are
// stored in quizzes.questions (jsonb) and copied into a game when it starts (migration 0021).

export type QuestionType = "quiz" | "truefalse" | "type" | "poll" | "puzzle" | "slider";

export const QUESTION_TYPES: QuestionType[] = ["quiz", "truefalse", "type", "poll", "puzzle", "slider"];

/** Standard: up to 1000 points; double: up to 2000; none: for fun (and polls). */
export type PointsMode = "standard" | "double" | "none";

/** How close a slider answer must be: exactly, or within 5/10/20 % of the range, or anywhere. */
export type Margin = "none" | "low" | "medium" | "high" | "max";

export type Choice = { id: string; text: string; correct: boolean };

export type SliderSpec = { min: number; max: number; step: number; value: number; margin: Margin; unit: string };

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  /** A picture (public URL in the uploads bucket). */
  image: string | null;
  /** Seconds to answer. */
  time: number;
  points: PointsMode;
  /** Quiz, true/false and poll: the choices. Puzzle: the items in the right order. */
  choices: Choice[];
  /** Quiz: players pick every right answer (else any one right answer counts). */
  multi: boolean;
  /** Type answer: what counts as right (small typos are forgiven). */
  accepted: string[];
  slider: SliderSpec | null;
  /** Shown with the right answer: why it's right. */
  explain: string;
};

export type QuizSettings = {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  /** Questions and answers on the phones too (else only shapes, read from the big screen). */
  showOnDevices: boolean;
  /** "blob": players get a funny Blob name instead of typing one. */
  names: "free" | "blob";
  /** Bonus points for answers right in a row. */
  streaks: boolean;
  /** Music and sounds on the big screen. */
  music: boolean;
};

export type Quiz = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string;
  cover: string | null;
  questions: Question[];
  settings: QuizSettings;
  plays: number;
  last_played_at: string | null;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const QUIZ_COLUMNS = "id, user_id, subject_id, title, description, cover, questions, settings, plays, last_played_at, trashed_at, created_at, updated_at";

export const LIMITS = {
  questions: 100,
  title: 120,
  description: 600,
  text: 240,
  choice: 90,
  choices: 6,
  accepted: 4,
  acceptedLength: 40,
  explain: 300,
  nickname: 20,
  players: 250,
};

export const TIME_OPTIONS = [5, 10, 20, 30, 45, 60, 90, 120, 240];

export const DEFAULT_SETTINGS: QuizSettings = { shuffleQuestions: false, shuffleAnswers: false, showOnDevices: true, names: "free", streaks: true, music: true };

/** The shapes and colours of the answers, in order (the colours stay the same in dark mode). */
export const ANSWER_STYLES = [
  { shape: "triangle", color: "#e5484d", deep: "#b8323a" },
  { shape: "diamond", color: "#3d74f0", deep: "#2a55bd" },
  { shape: "circle", color: "#d99000", deep: "#a86d00" },
  { shape: "square", color: "#26a269", deep: "#1b7a4e" },
  { shape: "hexagon", color: "#8b4fd6", deep: "#6a37ab" },
  { shape: "drop", color: "#0f9aa8", deep: "#0b7580" },
] as const;

export type Shape = (typeof ANSWER_STYLES)[number]["shape"];

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));

/** A fresh question of a type, with the words for true and false in the quiz's language. */
export function newQuestion(type: QuestionType, words: { true: string; false: string } = { true: "True", false: "False" }): Question {
  const base: Question = { id: newId(), type, text: "", image: null, time: 20, points: type === "poll" ? "none" : "standard", choices: [], multi: false, accepted: [], slider: null, explain: "" };
  if (type === "quiz") base.choices = [0, 1, 2, 3].map(() => ({ id: newId(), text: "", correct: false }));
  if (type === "truefalse")
    base.choices = [
      { id: newId(), text: words.true, correct: true },
      { id: newId(), text: words.false, correct: false },
    ];
  if (type === "poll") base.choices = [0, 1, 2, 3].map(() => ({ id: newId(), text: "", correct: false }));
  if (type === "puzzle") {
    base.choices = [0, 1, 2, 3].map(() => ({ id: newId(), text: "", correct: true }));
    base.time = 30;
  }
  if (type === "type") {
    base.accepted = [""];
    base.time = 30;
  }
  if (type === "slider") base.slider = { min: 0, max: 100, step: 1, value: 50, margin: "medium", unit: "" };
  return base;
}

/** A question changed to another type, keeping what fits. */
export function convertQuestion(q: Question, type: QuestionType, words?: { true: string; false: string }): Question {
  if (q.type === type) return q;
  const fresh = newQuestion(type, words);
  const keep = { id: q.id, text: q.text, image: q.image, time: q.time, explain: q.explain, points: type === "poll" ? ("none" as const) : q.points === "none" && q.type === "poll" ? ("standard" as const) : q.points };
  const texts = q.choices.map((c) => c.text);
  if ((type === "quiz" || type === "poll" || type === "puzzle") && texts.some(Boolean)) {
    const n = Math.max(type === "puzzle" ? 3 : 2, Math.min(LIMITS.choices, texts.length));
    fresh.choices = Array.from({ length: n }, (_, i) => ({ id: q.choices[i]?.id ?? newId(), text: texts[i] ?? "", correct: type === "puzzle" ? true : type === "quiz" ? (q.type === "quiz" ? !!q.choices[i]?.correct : false) : false }));
  }
  if (type === "type" && q.type === "quiz") {
    const right = q.choices.filter((c) => c.correct && c.text.trim()).map((c) => c.text.slice(0, LIMITS.acceptedLength));
    if (right.length) fresh.accepted = right.slice(0, LIMITS.accepted);
  }
  return { ...fresh, ...keep };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

/** A question as stored, made safe to use (unknown or broken parts get their defaults). */
export function normalizeQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = oneOf(o.type, QUESTION_TYPES, "quiz");
  const q = newQuestion(type);
  q.id = str(o.id, 40) || q.id;
  q.text = str(o.text, LIMITS.text);
  q.image = typeof o.image === "string" && /^https:\/\//.test(o.image) ? o.image.slice(0, 600) : null;
  q.time = Math.min(240, Math.max(5, Math.round(num(o.time, q.time))));
  q.points = type === "poll" ? "none" : oneOf(o.points, ["standard", "double", "none"] as const, "standard");
  q.explain = str(o.explain, LIMITS.explain);
  if (type === "quiz" || type === "truefalse" || type === "poll" || type === "puzzle") {
    const list = Array.isArray(o.choices) ? o.choices : [];
    const choices = list
      .slice(0, type === "truefalse" ? 2 : LIMITS.choices)
      .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {}))
      .map((c) => ({ id: str(c.id, 40) || newId(), text: str(c.text, LIMITS.choice), correct: type === "puzzle" ? true : type === "poll" ? false : c.correct === true }));
    if (choices.length >= 2 || type !== "truefalse") q.choices = choices.length ? choices : q.choices;
    q.multi = type === "quiz" && o.multi === true;
  }
  if (type === "type") {
    const list = Array.isArray(o.accepted) ? o.accepted : [];
    q.accepted = list.slice(0, LIMITS.accepted).map((x) => str(x, LIMITS.acceptedLength));
    if (!q.accepted.length) q.accepted = [""];
  }
  if (type === "slider") {
    const s = o.slider && typeof o.slider === "object" ? (o.slider as Record<string, unknown>) : {};
    const min = num(s.min, 0);
    const max = Math.max(min + 1e-9, num(s.max, 100));
    const step = Math.max(1e-6, Math.abs(num(s.step, 1)));
    q.slider = { min, max, step, value: Math.min(max, Math.max(min, num(s.value, (min + max) / 2))), margin: oneOf(s.margin, ["none", "low", "medium", "high", "max"] as const, "medium"), unit: str(s.unit, 12) };
  }
  return q;
}

export function normalizeQuestions(raw: unknown): Question[] {
  return (Array.isArray(raw) ? raw : []).slice(0, LIMITS.questions).map(normalizeQuestion).filter((q): q is Question => !!q);
}

export function normalizeSettings(raw: unknown): QuizSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const bool = (k: keyof QuizSettings) => (typeof o[k] === "boolean" ? (o[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean));
  return {
    shuffleQuestions: bool("shuffleQuestions"),
    shuffleAnswers: bool("shuffleAnswers"),
    showOnDevices: bool("showOnDevices"),
    names: o.names === "blob" ? "blob" : "free",
    streaks: bool("streaks"),
    music: bool("music"),
  };
}

export function normalizeQuiz(row: Record<string, unknown>): Quiz {
  return { ...(row as unknown as Quiz), questions: normalizeQuestions(row.questions), settings: normalizeSettings(row.settings) };
}

/** What still needs doing before a question can be played (empty when it's ready). */
export type Issue = "text" | "choices" | "correct" | "accepted" | "slider" | "items";

export function issuesOf(q: Question): Issue[] {
  const out: Issue[] = [];
  if (!q.text.trim() && !q.image) out.push("text");
  const filled = q.choices.filter((c) => c.text.trim());
  if (q.type === "quiz" || q.type === "poll") {
    if (filled.length < 2) out.push("choices");
    if (q.type === "quiz" && !filled.some((c) => c.correct)) out.push("correct");
  }
  if (q.type === "truefalse" && !q.choices.some((c) => c.correct)) out.push("correct");
  if (q.type === "puzzle" && filled.length < 3) out.push("items");
  if (q.type === "type" && !q.accepted.some((a) => a.trim())) out.push("accepted");
  if (q.type === "slider") {
    const s = q.slider;
    if (!s || s.max <= s.min || s.value < s.min || s.value > s.max || (s.max - s.min) / s.step > 100000) out.push("slider");
  }
  return out;
}

/** The questions as they're played: empty choices left out. */
export function playable(q: Question): Question {
  if (q.type === "quiz" || q.type === "poll" || q.type === "puzzle") return { ...q, choices: q.choices.filter((c) => c.text.trim()), accepted: [] };
  if (q.type === "type") return { ...q, accepted: q.accepted.map((a) => a.trim()).filter(Boolean) };
  return q;
}

/** Points a question is worth at most (before streak bonuses). */
export const basePoints = (q: Pick<Question, "points" | "type">) => (q.type === "poll" || q.points === "none" ? 0 : q.points === "double" ? 2000 : 1000);

/** Seconds of the question on its own before the answers open. */
export const INTRO_MS = 5000;
