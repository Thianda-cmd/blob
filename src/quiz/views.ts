import type { BlobHat, BlobSkin } from "@/components/blob/look";
import type { PointsMode, Question, QuestionType } from "./model";
import type { PlayerAnswer } from "./score";

// What the server sends: to the phones (PlayerView, nothing that gives an answer away before
// its time) and to the big screen (HostView, everything). Times are the server's clock in
// milliseconds; `now` lets each device work out how far its own clock is off.

export type Phase = "lobby" | "question" | "reveal" | "board" | "podium" | "ended";

/** A player's Blob. */
export type Look = { skin: BlobSkin | null; hat: BlobHat | null };

export type GameInfo = {
  id: string;
  pin: string;
  title: string;
  phase: Phase;
  /** The question now (or last), 0-based; -1 in the lobby. */
  q: number;
  total: number;
  /** When the answers open and close (server time). */
  openAt: number | null;
  closeAt: number | null;
  locked: boolean;
  showOnDevices: boolean;
  names: "free" | "blob";
  streaks: boolean;
};

/** A question as the phones see it: no right answers. */
export type ShownQuestion = {
  index: number;
  type: QuestionType;
  /** Null when the host keeps questions on the big screen only. */
  text: string | null;
  image: string | null;
  time: number;
  points: PointsMode;
  multi: boolean;
  /** In the order shown (puzzles: shuffled); `style` is the shape and colour. */
  choices: { id: string; text: string | null; style: number }[];
  slider: { min: number; max: number; step: number; unit: string } | null;
};

export type Reveal = {
  /** Right choice ids (puzzles: the right order). */
  right: string[];
  accepted: string[];
  value: number | null;
  tolerance: number | null;
  explain: string;
  /** Choice id → how many picked it. */
  counts: Record<string, number>;
  answered: number;
  /** Fully right answers. */
  correct: number;
  players: number;
  /** Type answer: what was typed most. */
  texts: { text: string; count: number; right: boolean }[];
  /** Slider: the average answer. */
  average: number | null;
};

export type Standing = { id: string; nickname: string; look: Look; score: number; rank: number; before: number; beforeRank: number; gained: number; streak: number };

export type Mine = { answered: boolean; answer: PlayerAnswer | null; points: number; bonus: number; fraction: number | null; right: boolean };

export type PlayerView = {
  now: number;
  game: GameInfo;
  question: ShownQuestion | null;
  reveal: Reveal | null;
  /** `moved`: places gained with the last question (once it's over). */
  me: { id: string; nickname: string; look: Look; score: number; rank: number; moved: number; players: number; streak: number; correct: number; kicked: boolean };
  mine: Mine | null;
  /** The player just ahead, and how many points behind them you are. */
  ahead: { nickname: string; gap: number } | null;
  podium: Standing[] | null;
};

export type HostPlayer = { id: string; nickname: string; look: Look; score: number; correct: number; answered: boolean; joinedAt: number };

export type HostView = {
  now: number;
  game: GameInfo & { quizId: string | null; startedAt: number | null };
  question: Question | null;
  shown: ShownQuestion | null;
  players: HostPlayer[];
  answered: number;
  reveal: Reveal | null;
  board: Standing[] | null;
  podium: Standing[] | null;
};

/** The join screen's look at a game. */
export type GamePeek = { title: string; phase: Phase; locked: boolean; full: boolean; names: "free" | "blob" };
