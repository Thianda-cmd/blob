"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, Check, Dices, Flame, LogOut, Medal, Trophy, Users, Vote, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { HATS, SKINS, type BlobHat, type BlobSkin } from "@/components/blob/look";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { quizText, type QuizText } from "@/i18n/messages/quiz";
import { blobName } from "@/quiz/names";
import type { PlayerAnswer } from "@/quiz/score";
import type { GamePeek, Look, PlayerView } from "@/quiz/views";
import { cn } from "@/lib/utils";
import { api, ApiError, loadSeat, saveSeat, type Seat } from "../api";
import { Confetti } from "../Confetti";
import { useSecondsLeft } from "../Countdown";
import { MiniBlob } from "../MiniBlob";
import { Shape, styleAt } from "../Shape";
import { quizSound } from "../sound";
import { useQuizLive } from "../useQuizLive";
import { useWakeLock } from "../useWakeLock";
import { AnswerPad, formatValue } from "./AnswerPad";

type PT = QuizText["play"];

/**
 * Playing along on a phone (/play): the game's PIN, a name and a Blob, then the questions. No
 * account needed. The phone keeps its seat, so reloading the page goes straight back in.
 */
export function PlayScreen({ initialPin }: { initialPin: string | null }) {
  const [seat, setSeat] = useState<Seat | null | undefined>(undefined);
  const [first, setFirst] = useState<PlayerView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSeat();
    // A link with another game's PIN means the phone wants to join that one.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the seat lives in localStorage, read after mount
    setSeat(saved && (!initialPin || saved.pin === initialPin) ? saved : null);
  }, [initialPin]);

  const leave = useCallback((message?: string) => {
    saveSeat(null);
    setSeat(null);
    setFirst(null);
    setNotice(message ?? null);
  }, []);

  if (seat === undefined) return <div className="min-h-dvh bg-paper" />;
  if (!seat)
    return (
      <JoinFlow
        initialPin={initialPin}
        notice={notice}
        onJoined={(s, view) => {
          saveSeat(s);
          setFirst(view);
          setSeat(s);
          setNotice(null);
        }}
      />
    );
  return <InGame key={seat.token} seat={seat} first={first} onLeave={leave} />;
}

// Joining ---------------------------------------------------------------------------------------

const PLAY_HATS: BlobHat[] = HATS.filter((h) => h !== "halo");

function JoinFlow({ initialPin, notice, onJoined }: { initialPin: string | null; notice: string | null; onJoined: (seat: Seat, view: PlayerView) => void }) {
  const tt = useMessages(quizText);
  const t = tt.play;
  const locale = useLocale();
  const [pin, setPin] = useState(initialPin ?? "");
  const [game, setGame] = useState<GamePeek | null>(null);
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [look, setLook] = useState<Look>(() => ({ skin: SKINS[Math.floor(Math.random() * SKINS.length)], hat: null }));
  const tried = useRef(false);

  const check = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        const peek = await api.peek(value);
        if (peek.locked) setError(t.lockedOut);
        else if (peek.full) setError(t.full);
        else if (peek.phase === "podium") setError(t.over);
        else {
          setGame(peek);
          if (peek.names === "blob") setName(blobName(locale));
        }
      } catch (e) {
        setError(e instanceof ApiError && e.code === "offline" ? t.failed : t.notFound);
      } finally {
        setBusy(false);
      }
    },
    [t, locale],
  );

  // A link or QR code with ?pin= goes straight to the name.
  useEffect(() => {
    if (tried.current || !initialPin || !/^\d{6}$/.test(initialPin)) return;
    tried.current = true;
    void check(initialPin);
  }, [initialPin, check]);

  const join = async () => {
    const nickname = name.trim();
    if (!nickname) return setError(t.nameEmpty);
    quizSound().unlock();
    setBusy(true);
    setError(null);
    try {
      const { token, view } = await api.join(pin, nickname, look);
      quizSound().plop();
      onJoined({ pin, token, at: Date.now() }, view);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "failed";
      if (code === "name_taken" && game?.names === "blob") setName(blobName(locale));
      setError(code === "name_taken" ? t.nameTaken : code === "name_rude" || code === "name" ? t.nameRude : code === "locked" ? t.lockedOut : code === "full" ? t.full : code === "not_found" ? t.notFound : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh touch-manipulation flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,color-mix(in_oklab,var(--blob)_22%,var(--paper)),var(--paper))] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <FloatingBlobs />
      <div className="relative flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-[17px] font-bold text-ink">
          <MiniBlob look={{ skin: null, hat: null }} size={28} bounce={false} /> Blob
        </Link>
        <LanguageSwitch compact />
      </div>

      <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-6 py-6">
        <AnimatePresence mode="wait">
          {!game ? (
            <motion.form
              key="pin"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="flex flex-col items-center gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^\d{6}$/.test(pin)) void check(pin);
              }}
            >
              <Blob size={132} mood={error ? "worried" : busy ? "thinking" : "excited"} plain wear={{ skin: look.skin, hat: "party", eyes: null, neck: null }} />
              <h1 className="text-center font-display text-[28px] font-bold tracking-[-0.02em] text-ink">{t.heading}</h1>
              <input
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(v);
                  setError(null);
                  if (v.length === 6) void check(v);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                placeholder={t.pinPlaceholder}
                aria-label={t.pinPlaceholder}
                className="h-16 w-full rounded-2xl border-2 border-line bg-raised text-center font-display text-[30px] font-bold tracking-[0.3em] text-ink shadow-card outline-none transition-colors placeholder:text-[20px] placeholder:font-semibold placeholder:tracking-normal placeholder:text-ink-3 focus:border-blob"
              />
              <button type="submit" disabled={pin.length !== 6 || busy} className="quiz-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[18px] font-bold text-paper disabled:opacity-40" style={{ ["--quiz-deep" as string]: "rgb(0 0 0 / 0.35)" }}>
                {t.enter} <ArrowRight className="size-5" />
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="name"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="flex flex-col items-center gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void join();
              }}
            >
              <p className="max-w-full truncate rounded-full bg-raised/80 px-3 py-1 text-[12.5px] font-semibold text-ink-2 shadow-card">{game.title || tt.untitled}</p>
              <Blob size={140} mood="happy" plain wear={{ skin: look.skin, hat: look.hat, eyes: null, neck: null }} />
              <label className="w-full text-center text-[14px] font-semibold text-ink-2" htmlFor="quiz-name">
                {t.nameLabel}
              </label>
              {game.names === "blob" ? (
                <div className="flex w-full items-center gap-2">
                  <output id="quiz-name" className="flex h-14 min-w-0 flex-1 items-center justify-center truncate rounded-2xl border-2 border-line bg-raised px-3 text-[20px] font-bold text-ink">
                    {name}
                  </output>
                  <button type="button" onClick={() => setName(blobName(locale))} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-raised text-ink shadow-card" aria-label={t.reroll} title={t.reroll}>
                    <Dices className="size-6" />
                  </button>
                </div>
              ) : (
                <input
                  id="quiz-name"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value.slice(0, 20));
                    setError(null);
                  }}
                  placeholder={t.namePlaceholder}
                  maxLength={20}
                  autoComplete="nickname"
                  enterKeyHint="go"
                  className="h-14 w-full rounded-2xl border-2 border-line bg-raised text-center text-[20px] font-bold text-ink shadow-card outline-none focus:border-blob"
                />
              )}
              <LookPicker look={look} onChange={setLook} t={t} />
              <button type="submit" disabled={busy || !name.trim()} className="quiz-press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blob text-[18px] font-bold text-white disabled:opacity-40" style={{ ["--quiz-deep" as string]: "var(--blob-deep)" }}>
                {t.join}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-center text-[14px] font-medium text-danger">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function LookPicker({ look, onChange, t }: { look: Look; onChange: (l: Look) => void; t: PT }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-raised/70 p-3 shadow-card">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.skin}</span>
      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        {SKINS.map((s: BlobSkin) => (
          <button key={s} type="button" onClick={() => onChange({ ...look, skin: s })} className={cn("shrink-0 rounded-xl p-1 transition-colors", look.skin === s ? "bg-blob-soft ring-2 ring-blob" : "hover:bg-hover")} aria-label={s} aria-pressed={look.skin === s}>
            <MiniBlob look={{ skin: s, hat: null }} size={38} bounce={false} />
          </button>
        ))}
      </div>
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.hat}</span>
      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button type="button" onClick={() => onChange({ ...look, hat: null })} className={cn("grid size-[46px] shrink-0 place-items-center rounded-xl text-[11px] font-semibold text-ink-3", !look.hat ? "bg-blob-soft text-blob-ink ring-2 ring-blob" : "hover:bg-hover")} aria-pressed={!look.hat}>
          {t.noHat}
        </button>
        {PLAY_HATS.map((h) => (
          <button key={h} type="button" onClick={() => onChange({ ...look, hat: h })} className={cn("shrink-0 rounded-xl p-1 transition-colors", look.hat === h ? "bg-blob-soft ring-2 ring-blob" : "hover:bg-hover")} aria-label={h} aria-pressed={look.hat === h}>
            <MiniBlob look={{ skin: look.skin, hat: h }} size={38} bounce={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Soft jelly shapes drifting behind the join screen. */
function FloatingBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[
        ["-8%", "12%", 220, "#6d3df5", 0],
        ["70%", "4%", 160, "#ff70b0", -6],
        ["78%", "64%", 240, "#3d74f0", -11],
        ["-10%", "72%", 180, "#26a269", -3],
      ].map(([left, top, size, color, delay], i) => (
        <span key={i} className="quiz-float absolute rounded-full opacity-[0.12] blur-2xl" style={{ left: left as string, top: top as string, width: size as number, height: size as number, background: color as string, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

// Playing ---------------------------------------------------------------------------------------

function InGame({ seat, first, onLeave }: { seat: Seat; first: PlayerView | null; onLeave: (message?: string) => void }) {
  const tt = useMessages(quizText);
  const locale = useLocale();
  const t = tt.play;
  const load = useCallback(() => api.state(seat.token), [seat.token]);
  const live = useQuizLive<PlayerView>(load);
  const { put } = live;
  useEffect(() => {
    if (first) put(first);
  }, [first, put]);
  const view = live.view;
  const [sent, setSent] = useState<{ q: number; answer: PlayerAnswer } | null>(null);
  const [failed, setFailed] = useState(false);
  useWakeLock(view?.game.phase !== "ended");

  // The seat is gone (game deleted, or this phone's token is unknown).
  useEffect(() => {
    if (live.error === "not_found") onLeave(t.gone);
  }, [live.error, onLeave, t.gone]);

  const game = view?.game;
  const q = view?.question ?? null;
  const openAt = game?.openAt != null ? live.local(game.openAt) : null;
  const closeAt = game?.closeAt != null ? live.local(game.closeAt) : null;
  const toOpen = useSecondsLeft(game?.phase === "question" ? openAt : null, 100);
  const toClose = useSecondsLeft(game?.phase === "question" ? closeAt : null, 100);
  const answered = !!view?.mine?.answered || (sent !== null && sent.q === game?.q);

  // Sounds and a buzz when the result comes in.
  const resultKey = game && (game.phase === "reveal" || game.phase === "board") ? `${game.id}:${game.q}` : null;
  const lastResult = useRef<string | null>(null);
  useEffect(() => {
    if (!resultKey || !view || resultKey === lastResult.current || game?.phase !== "reveal") return;
    lastResult.current = resultKey;
    if (q?.type === "poll") return;
    if (view.mine?.right) quizSound().right();
    else quizSound().wrong();
    try {
      navigator.vibrate?.(view.mine?.right ? [30, 40, 30] : 120);
    } catch {}
  }, [resultKey, view, game?.phase, q?.type]);

  const submit = async (answer: PlayerAnswer) => {
    if (!game || answered) return;
    setSent({ q: game.q, answer });
    setFailed(false);
    try {
      put(await api.answer(seat.token, game.q, answer));
    } catch (e) {
      if (e instanceof ApiError && e.code === "closed") live.refresh();
      else {
        setSent(null);
        setFailed(true);
      }
    }
  };

  if (!view || !game) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper">
        <Blob size={96} mood="thinking" plain />
      </main>
    );
  }

  if (view.me.kicked) {
    return (
      <Center tone="neutral">
        <Blob size={120} mood="worried" plain wear={{ skin: view.me.look.skin, hat: view.me.look.hat, eyes: null, neck: null }} />
        <p className="text-center text-[18px] font-semibold text-ink">{t.kicked}</p>
        <button type="button" onClick={() => onLeave()} className="rounded-2xl bg-ink px-5 py-3 text-[15px] font-bold text-paper">
          {t.newGame}
        </button>
      </Center>
    );
  }

  const phase = game.phase;
  const before = phase === "question" && toOpen !== null && toOpen > 0;
  const over = phase === "question" && toClose !== null && toClose <= 0;

  let stage: React.ReactNode;
  let key: string;
  let tone: Tone = "neutral";
  if (phase === "lobby") {
    key = "lobby";
    tone = "blob";
    stage = <Lobby view={view} t={t} />;
  } else if (phase === "question" && q) {
    if (before) {
      key = `ready-${game.q}`;
      tone = "blob";
      stage = <GetReady view={view} seconds={toOpen ?? 0} t={t} tt={tt} />;
    } else if (answered) {
      key = `sent-${game.q}`;
      tone = "blob";
      stage = <Locked view={view} answer={sent?.q === game.q ? sent.answer : (view.mine?.answer ?? null)} t={t} />;
    } else if (over) {
      key = `late-${game.q}`;
      stage = <Message mood="surprised" look={view.me.look} text={t.tooLate} />;
    } else {
      key = `q-${game.q}`;
      stage = (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <TimeBar left={toClose ?? q.time} total={q.time} />
          {q.text ? (
            <h2 className="text-center text-[19px] font-bold leading-snug text-ink hyphens-auto [overflow-wrap:break-word]">{q.text}</h2>
          ) : (
            <p className="text-center text-[14px] font-semibold text-ink-3">{t.lookUp}</p>
          )}
          {q.image && <img src={q.image} alt="" className="mx-auto max-h-[22vh] rounded-2xl object-contain" />}
          {q.multi && <p className="mx-auto rounded-full bg-blob-soft px-3 py-1 text-[13px] font-semibold text-blob-ink">{tt.editor.multiHint}</p>}
          {failed && <p className="text-center text-[13px] font-medium text-danger">{t.failed}</p>}
          <AnswerPad question={q} onAnswer={(a) => void submit(a)} />
        </div>
      );
    }
  } else if ((phase === "reveal" || phase === "board") && q) {
    // The same screen through the answer and the scoreboard (only the place moves).
    key = `result-${game.q}`;
    const r = resultTone(view);
    tone = r;
    stage = <Result view={view} t={t} tone={r} />;
  } else if (phase === "podium" || phase === "ended") {
    key = "final";
    tone = "blob";
    stage = <Final view={view} t={t} onAgain={() => onLeave()} />;
  } else {
    key = "wait";
    stage = <Message mood="thinking" look={view.me.look} text={t.waitHost} />;
  }

  return (
    <main className={cn("relative flex min-h-dvh touch-manipulation flex-col transition-colors duration-500", TONES[tone].bg)}>
      <header className={cn("flex items-center gap-2 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]", TONES[tone].text)}>
        <MiniBlob look={view.me.look} size={34} bounce={false} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{view.me.nickname}</span>
        {game.q >= 0 && phase !== "lobby" && <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums", TONES[tone].chip)}>{t.question(Math.min(game.q + 1, game.total), game.total)}</span>}
        <motion.span key={view.me.score} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className={cn("rounded-full px-3 py-1 text-[13px] font-bold tabular-nums", TONES[tone].chip)}>
          {view.me.score.toLocaleString(intlLocale(locale))}
        </motion.span>
      </header>
      <AnimatePresence>
        {live.error && live.error !== "not_found" && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} role="status" className="mx-4 mb-2 flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-black/25 px-3 py-2 text-[13px] font-semibold text-white">
            <WifiOff className="size-4 shrink-0" /> {t.offline}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.section
          key={key}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.04, y: -10, transition: { duration: 0.14 } }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="flex min-h-0 flex-1 flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
        >
          {stage}
        </motion.section>
      </AnimatePresence>
      {(phase === "lobby" || phase === "podium" || phase === "ended") && (
        <button
          type="button"
          onClick={() => {
            if (phase !== "lobby" || confirm(t.leaveConfirm)) {
              void api.leave(seat.token).catch(() => {});
              onLeave();
            }
          }}
          className={cn("mx-auto mb-[max(14px,env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold", TONES[tone].soft)}
        >
          <LogOut className="size-3.5" /> {t.leave}
        </button>
      )}
    </main>
  );
}

type Tone = "neutral" | "blob" | "right" | "partly" | "wrong" | "poll";

const TONES: Record<Tone, { bg: string; text: string; chip: string; soft: string }> = {
  neutral: { bg: "bg-paper", text: "text-ink", chip: "bg-raised text-ink shadow-card", soft: "text-ink-3" },
  blob: { bg: "bg-[linear-gradient(160deg,#7c4dff,#5326d6)]", text: "text-white", chip: "bg-white/20 text-white", soft: "text-white/75" },
  right: { bg: "bg-[linear-gradient(160deg,#2fbf7a,#1b7a4e)]", text: "text-white", chip: "bg-white/20 text-white", soft: "text-white/75" },
  partly: { bg: "bg-[linear-gradient(160deg,#f0a62a,#b86e00)]", text: "text-white", chip: "bg-white/20 text-white", soft: "text-white/75" },
  wrong: { bg: "bg-[linear-gradient(160deg,#ef5d63,#b8323a)]", text: "text-white", chip: "bg-white/20 text-white", soft: "text-white/75" },
  poll: { bg: "bg-[linear-gradient(160deg,#3d74f0,#2a55bd)]", text: "text-white", chip: "bg-white/20 text-white", soft: "text-white/75" },
};

function resultTone(view: PlayerView): Tone {
  if (view.question?.type === "poll") return "poll";
  const m = view.mine;
  if (!m?.answered) return "wrong";
  if (m.right) return "right";
  return m.fraction && m.fraction > 0 ? "partly" : "wrong";
}

function Center({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <main className={cn("flex min-h-dvh flex-col items-center justify-center gap-5 px-6", TONES[tone].bg)}>{children}</main>;
}

function Message({ text, mood, look }: { text: string; mood: "thinking" | "surprised"; look: Look }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Blob size={120} mood={mood} plain wear={{ skin: look.skin, hat: look.hat, eyes: null, neck: null }} />
      <p className="text-center font-display text-[24px] font-bold text-ink">{text}</p>
    </div>
  );
}

function Lobby({ view, t }: { view: PlayerView; t: PT }) {
  const [pokes, setPokes] = useState(0);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white">
      {/* Something to do while waiting: poke your Blob. */}
      <motion.div
        aria-hidden
        initial={{ scale: 0.4, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        whileTap={{ scale: 0.86, rotate: pokes % 2 ? 8 : -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 12 }}
        onPointerDown={() => {
          setPokes((n) => n + 1);
          quizSound().unlock();
          quizSound().plop();
          try {
            navigator.vibrate?.(12);
          } catch {}
        }}
        className="cursor-pointer select-none"
      >
        <Blob size={170} mood={pokes % 5 === 4 ? "surprised" : "excited"} plain wear={{ skin: view.me.look.skin, hat: view.me.look.hat, eyes: null, neck: null }} />
      </motion.div>
      <h1 className="font-display text-[34px] font-bold tracking-[-0.02em]">{t.youreIn}</h1>
      <p className="max-w-[300px] text-center text-[16px] text-white/85">{t.seeName}</p>
      <motion.span key={view.me.players} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white/80">
        <Users className="size-4" /> {t.here(view.me.players)}
      </motion.span>
      <div className="mt-1 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[14px] font-semibold">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-white" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
        {t.waitHost}
      </div>
    </div>
  );
}

function GetReady({ view, seconds, t, tt }: { view: PlayerView; seconds: number; t: PT; tt: QuizText }) {
  const q = view.question!;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-white">
      <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold uppercase tracking-wide">{tt.types[q.type]}</span>
      <motion.span key={Math.ceil(seconds)} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="grid size-32 place-items-center rounded-full bg-white/15 font-display text-[64px] font-bold tabular-nums">
        {Math.max(1, Math.ceil(seconds))}
      </motion.span>
      <p className="font-display text-[26px] font-bold">{t.getReady}</p>
      {q.text && <p className="max-w-[340px] text-center text-[17px] font-semibold text-white/90 hyphens-auto [overflow-wrap:break-word]">{q.text}</p>}
      {q.points === "double" && <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-blob-ink">{tt.points.double}</span>}
    </div>
  );
}

function TimeBar({ left, total }: { left: number; total: number }) {
  const share = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", left <= 5 ? "bg-danger" : "bg-blob")} style={{ width: `${share * 100}%` }} />
      </div>
      <span className={cn("w-7 text-right text-[14px] font-bold tabular-nums", left <= 5 ? "text-danger" : "text-ink-2")}>{Math.ceil(left)}</span>
    </div>
  );
}

function answerSummary(view: PlayerView, answer: PlayerAnswer | null): React.ReactNode {
  const q = view.question;
  if (!q || !answer) return null;
  if (answer.kind === "choice")
    return (
      <span className="flex flex-wrap justify-center gap-2">
        {answer.ids.map((id) => {
          const c = q.choices.find((x) => x.id === id);
          if (!c) return null;
          const style = styleAt(c.style);
          return (
            <span key={id} className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[15px] font-bold text-white" style={{ background: style.color }}>
              <Shape shape={style.shape} className="size-5" />
              {c.text}
            </span>
          );
        })}
      </span>
    );
  if (answer.kind === "text") return <span className="rounded-2xl bg-white/15 px-4 py-2 text-[18px] font-bold">“{answer.text}”</span>;
  if (answer.kind === "value") return <span className="rounded-2xl bg-white/15 px-4 py-2 text-[22px] font-bold tabular-nums">{q.slider ? formatValue(answer.value, q.slider.step, q.slider.unit) : answer.value}</span>;
  return null;
}

function Locked({ view, answer, t }: { view: PlayerView; answer: PlayerAnswer | null; t: PT }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-white">
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}>
        <Blob size={130} mood="thinking" plain wear={{ skin: view.me.look.skin, hat: view.me.look.hat, eyes: null, neck: null }} />
      </motion.div>
      <p className="font-display text-[28px] font-bold">{t.locked}</p>
      {answerSummary(view, answer)}
      <p className="text-[15px] text-white/80">{t.waitOthers}</p>
    </div>
  );
}

/** A number that counts up from 0. */
function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const locale = useLocale();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no animation: show the number at once
      setN(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{n.toLocaleString(intlLocale(locale))}</>;
}

function Result({ view, t, tone }: { view: PlayerView; t: PT; tone: Tone }) {
  const m = view.mine;
  const q = view.question!;
  const r = view.reveal;
  const Icon = tone === "right" ? Check : tone === "poll" ? Vote : tone === "partly" ? Check : X;
  const title = tone === "poll" ? t.pollThanks : !m?.answered ? t.noAnswer : tone === "right" ? t.right : tone === "partly" ? t.partly : t.wrong;
  const rightChoices = r && (q.type === "quiz" || q.type === "truefalse") ? q.choices.filter((c) => r.right.includes(c.id)) : [];
  const showRight = tone !== "right" && tone !== "poll" && view.game.showOnDevices;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white">
      <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 14 }} className="grid size-24 place-items-center rounded-full bg-white/20">
        <Icon className="size-14" strokeWidth={3} />
      </motion.span>
      <h2 className="font-display text-[34px] font-bold tracking-[-0.02em]">{title}</h2>
      {tone !== "poll" && m?.answered && m.points > 0 && (
        <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="rounded-2xl bg-white/20 px-5 py-2 font-display text-[30px] font-bold tabular-nums">
          +<CountUp to={m.points} />
        </motion.p>
      )}
      {view.game.streaks && view.me.streak >= 2 && tone === "right" && (
        <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 400, damping: 12 }} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-bold text-[#c2410c]">
          <Flame className="size-4" /> {t.streak(view.me.streak)}
        </motion.p>
      )}
      {showRight && rightChoices.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-white/75">{t.rightAnswer}</span>
          <span className="flex flex-wrap justify-center gap-2">
            {rightChoices.map((c) => (
              <span key={c.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-1.5 text-[15px] font-bold" style={{ color: styleAt(c.style).deep }}>
                <Shape shape={styleAt(c.style).shape} fill={styleAt(c.style).color} className="size-4" /> {c.text}
              </span>
            ))}
          </span>
        </div>
      )}
      {showRight && r && q.type === "type" && r.accepted[0] && (
        <p className="text-center text-[15px] font-semibold text-white/90">
          {t.rightAnswer}: <span className="font-bold text-white">{r.accepted[0]}</span>
        </p>
      )}
      {showRight && r && q.type === "slider" && r.value !== null && q.slider && (
        <p className="text-center text-[15px] font-semibold text-white/90">
          {t.rightAnswer}: <span className="font-bold text-white">{formatValue(r.value, q.slider.step, q.slider.unit)}</span>
        </p>
      )}
      {r?.explain && <p className="max-w-[340px] rounded-2xl bg-black/10 px-4 py-2.5 text-center text-[14px] leading-snug text-white/95">{r.explain}</p>}
      {tone !== "poll" && (
        <motion.div layout className="mt-2 flex flex-col items-center gap-1 rounded-2xl bg-black/15 px-5 py-3">
          <AnimatePresence>
            {view.game.phase === "board" && view.me.moved > 0 && (
              <motion.span initial={{ scale: 0, height: 0 }} animate={{ scale: 1, height: "auto" }} transition={{ type: "spring", stiffness: 500, damping: 15 }} className="mb-1 flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-ok">
                <ArrowUp className="size-4" strokeWidth={3} /> {t.moved(view.me.moved)}
              </motion.span>
            )}
          </AnimatePresence>
          <motion.span key={view.me.rank} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="font-display text-[20px] font-bold">
            {t.place(view.me.rank)}
          </motion.span>
          <span className="text-[14px] text-white/85">{view.ahead ? t.behind(view.ahead.gap, view.ahead.nickname) : t.leading}</span>
        </motion.div>
      )}
    </div>
  );
}

function Final({ view, t, onAgain }: { view: PlayerView; t: PT; onAgain: () => void }) {
  const rank = view.me.rank;
  const top = rank <= 3;
  const colors = ["#f0bf2e", "#c9ced8", "#d48a4a"];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-white">
      {top && <Confetti ms={6500} />}
      <motion.div initial={{ y: 40, scale: 0.6 }} animate={{ y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 13 }}>
        <Blob size={170} mood={top ? "proud" : "happy"} plain wear={{ skin: view.me.look.skin, hat: rank === 1 ? "crown" : view.me.look.hat, eyes: null, neck: top ? "medal" : null }} />
      </motion.div>
      <p className="text-[15px] font-semibold uppercase tracking-wide text-white/80">{t.podiumTitle}</p>
      <h1 className="flex items-center gap-2 font-display text-[40px] font-bold tracking-[-0.02em]">
        {top && (rank === 1 ? <Trophy className="size-9" style={{ color: colors[0] }} /> : <Medal className="size-9" style={{ color: colors[rank - 1] }} />)}
        {t.finalPlace(rank)}
      </h1>
      <p className="rounded-2xl bg-white/15 px-5 py-2 font-display text-[24px] font-bold tabular-nums">
        <CountUp to={view.me.score} ms={1400} /> <span className="text-[15px] font-semibold text-white/80">{t.score}</span>
      </p>
      <p className="text-[15px] text-white/85">{t.thanks}</p>
      <div className="mt-2 flex flex-col items-center gap-2">
        <button type="button" onClick={onAgain} className="quiz-press rounded-2xl bg-white px-5 py-3 text-[15px] font-bold text-blob-ink" style={{ ["--quiz-deep" as string]: "rgb(0 0 0 / 0.2)" }}>
          {t.newGame}
        </button>
        <Link href="/" className="text-[13px] font-semibold text-white/80 underline-offset-4 hover:underline">
          {t.makeYourOwn}
        </Link>
      </div>
    </div>
  );
}
