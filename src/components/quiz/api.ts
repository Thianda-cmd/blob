"use client";

import type { GamePeek, HostView, Look, PlayerView } from "@/quiz/views";

// Talking to the quiz's routes (src/app/api/quiz). Errors come back as their code.

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError("offline", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data?.error ?? "failed", res.status);
  return data;
}

const post = <T,>(url: string, body: unknown) => call<T>(url, { method: "POST", body: JSON.stringify(body) });

export const api = {
  peek: (pin: string) => call<GamePeek>(`/api/quiz/play/${encodeURIComponent(pin)}`),
  join: (pin: string, nickname: string, look: Look) => post<{ token: string; view: PlayerView }>(`/api/quiz/play/${encodeURIComponent(pin)}/join`, { nickname, look }),
  state: (token: string) => post<PlayerView>("/api/quiz/play/state", { token }),
  answer: (token: string, q: number, answer: unknown) => post<PlayerView>("/api/quiz/play/answer", { token, q, answer }),
  leave: (token: string) => post<{ ok: true }>("/api/quiz/play/leave", { token }),
  createGame: (quizId: string, settings?: unknown) => post<{ id: string; pin: string }>("/api/quiz/games", { quizId, settings }),
  host: (id: string) => call<HostView>(`/api/quiz/games/${id}`),
  act: (id: string, action: string, playerId?: string) => post<HostView>(`/api/quiz/games/${id}`, { action, playerId }),
};

/** Where a phone keeps its seat in a game (so a reload doesn't lose it). */
const SEAT_KEY = "blob-quiz-seat";

export type Seat = { pin: string; token: string; at: number };

export function loadSeat(): Seat | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    const seat = raw ? (JSON.parse(raw) as Seat) : null;
    // Seats from more than half a day ago are for games long over.
    return seat && typeof seat.token === "string" && Date.now() - seat.at < 12 * 3600e3 ? seat : null;
  } catch {
    return null;
  }
}

export function saveSeat(seat: Seat | null) {
  try {
    if (seat) localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else localStorage.removeItem(SEAT_KEY);
  } catch {}
}
