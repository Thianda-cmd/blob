"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BarChart3, ChevronRight, Copy, Lock, LockOpen, Maximize, Play, RotateCcw, SkipForward, Square, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Blob } from "@/components/blob/Blob";
import { useMessages } from "@/i18n/client";
import { quizText, type QuizText } from "@/i18n/messages/quiz";
import { INTRO_MS } from "@/quiz/model";
import type { HostPlayer, HostView } from "@/quiz/views";
import { cn } from "@/lib/utils";
import { api } from "../api";
import { useSecondsLeft } from "../Countdown";
import { MiniBlob } from "../MiniBlob";
import { QR } from "../QR";
import { quizSound } from "../sound";
import { useQuizLive } from "../useQuizLive";
import { Asking, Intro, Podium, Revealed, Scoreboard } from "./Stages";

type T = QuizText;

/**
 * The big screen of a live game (/live/<id>), for its host: the lobby with the PIN, the QR code
 * and everyone who joined, then each question, its answer and the scoreboard, and the podium.
 * Space, Enter or → moves on; M turns the sound off; F goes full screen.
 */
export function HostScreen({ initial, origin }: { initial: HostView; origin: string }) {
  const t = useMessages(quizText);
  const router = useRouter();
  const load = useCallback(() => api.host(initial.game.id), [initial.game.id]);
  const live = useQuizLive<HostView>(load, { listenToAnswers: true });
  const { put } = live;
  useEffect(() => {
    put(initial);
  }, [initial, put]);
  const view = live.view ?? initial;
  const game = view.game;
  const [busy, setBusy] = useState(false);
  const sound = quizSound();
  const muted = useSyncExternalStore(sound.subscribe, () => sound.muted, () => false);
  const [unlocked, setUnlocked] = useState(false);
  const soundOn = unlocked && !muted && view.game.phase !== "ended";

  const act = useCallback(
    async (action: string, playerId?: string) => {
      setBusy(true);
      try {
        put(await api.act(game.id, action, playerId));
      } catch {
        live.refresh();
      } finally {
        setBusy(false);
      }
    },
    [game.id, put, live],
  );

  // Sound needs a first click; any click on the page will do.
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      setUnlocked(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [sound]);

  const openAt = game.openAt !== null ? live.local(game.openAt) : null;
  const closeAt = game.closeAt !== null ? live.local(game.closeAt) : null;
  const toOpen = useSecondsLeft(game.phase === "question" ? openAt : null, 100);
  const toClose = useSecondsLeft(game.phase === "question" ? closeAt : null, 100);
  const intro = game.phase === "question" && toOpen !== null && toOpen > 0;
  const asking = game.phase === "question" && !intro;

  // Music for the lobby and while people answer; ticks for the last seconds; a gong at the end.
  useEffect(() => {
    if (!soundOn) return sound.play(null);
    sound.play(game.phase === "lobby" ? "lobby" : asking && (toClose ?? 0) > 0 ? "answer" : null);
  }, [soundOn, game.phase, asking, toClose, sound]);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!soundOn || !asking || toClose === null) return;
    const s = Math.ceil(toClose);
    if (s !== lastTick.current && s <= 5 && s > 0) sound.tick(s === 1);
    lastTick.current = s;
  }, [soundOn, asking, toClose, sound]);
  const revealKey = game.phase === "reveal" ? game.q : null;
  useEffect(() => {
    if (revealKey === null || !soundOn) return;
    sound.gong();
    const t2 = setTimeout(() => sound.chime(), 500);
    return () => clearTimeout(t2);
  }, [revealKey, soundOn, sound]);
  useEffect(() => () => sound.play(null), [sound]);

  // A plop for everyone who joins.
  const count = view.players.length;
  const lastCount = useRef(count);
  useEffect(() => {
    if (count > lastCount.current && soundOn) sound.plop();
    lastCount.current = count;
  }, [count, soundOn, sound]);

  // Time's up: show the answer (the server does too, when this screen is asleep).
  const closedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!asking || toClose === null || toClose > 0 || closedFor.current === game.q) return;
    closedFor.current = game.q;
    const timer = setTimeout(() => void act("reveal"), 600);
    return () => clearTimeout(timer);
  }, [asking, toClose, game.q, act]);

  const primary = (): { label: string; action: string; icon: React.ReactNode } | null => {
    if (game.phase === "lobby") return { label: t.host.start, action: "start", icon: <Play className="size-5" /> };
    if (game.phase === "question") return { label: t.host.skip, action: "reveal", icon: <SkipForward className="size-5" /> };
    if (game.phase === "reveal" || game.phase === "board") return { label: t.host.next, action: "next", icon: <ChevronRight className="size-5" /> };
    return null;
  };
  const main = primary();
  const canGo = !!main && !busy && !(game.phase === "lobby" && view.players.length === 0) && !(game.phase === "question" && intro);

  const keys = useRef({ main, canGo, act });
  useEffect(() => {
    keys.current = { main, canGo, act };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, button")) return;
      const k = keys.current;
      if ((e.key === " " || e.key === "Enter" || e.key === "ArrowRight") && k.main && k.canGo) {
        e.preventDefault();
        void k.act(k.main.action);
      } else if (e.key.toLowerCase() === "m") quizSound().setMuted(!quizSound().muted);
      else if (e.key.toLowerCase() === "f") void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const again = async () => {
    if (!game.quizId) return;
    setBusy(true);
    try {
      const g = await api.createGame(game.quizId);
      router.push(`/live/${g.id}`);
    } catch {
      setBusy(false);
    }
  };

  const joinUrl = `${origin}/play?pin=${game.pin}`;
  const stageKey = game.phase === "question" ? (intro ? `intro-${game.q}` : `ask-${game.q}`) : `${game.phase}-${game.q}`;

  return (
    <div className={cn("relative flex h-dvh flex-col overflow-hidden", game.phase === "lobby" || game.phase === "podium" || game.phase === "ended" ? "bg-[radial-gradient(100%_90%_at_50%_0%,color-mix(in_oklab,var(--blob)_18%,var(--paper)),var(--paper))]" : "bg-paper")}>
      <Backdrop />
      <header className="relative z-10 flex items-center gap-3 px-[2vw] py-3">
        <Link href={game.quizId ? `/quiz/${game.quizId}` : "/quiz"} className="grid size-9 place-items-center rounded-xl text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.host.close} title={t.host.close}>
          <ArrowLeft className="size-5" />
        </Link>
        <span className="min-w-0 flex-1 truncate font-display text-[clamp(14px,1.4vw,20px)] font-semibold text-ink-2">{game.title || t.untitled}</span>
        {game.phase !== "lobby" && game.phase !== "ended" && (
          <span className="rounded-full bg-raised px-3 py-1 text-[clamp(12px,1.1vw,16px)] font-bold tabular-nums text-ink shadow-card">
            {t.host.pin} {game.pin}
          </span>
        )}
        <IconToggle on={!muted} onClick={() => (sound.unlock(), setUnlocked(true), sound.setMuted(!muted))} label={muted ? t.host.unmute : t.host.mute} icon={muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />} />
        <IconToggle on={false} onClick={() => void toggleFullscreen()} label={t.host.fullscreen} icon={<Maximize className="size-5" />} />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={stageKey} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="flex min-h-0 flex-1 flex-col">
            {game.phase === "lobby" && <Lobby view={view} joinUrl={joinUrl} origin={origin} t={t} onKick={(p) => void act("kick", p.id)} />}
            {game.phase === "question" && view.question && intro && <Intro view={view} left={toOpen ?? 0} total={INTRO_MS / 1000} t={t} />}
            {game.phase === "question" && view.question && !intro && <Asking view={view} left={toClose ?? 0} t={t} />}
            {game.phase === "reveal" && view.question && view.reveal && <Revealed view={view} t={t} />}
            {game.phase === "board" && <Scoreboard view={view} t={t} />}
            {(game.phase === "podium" || game.phase === "ended") && <Podium view={view} t={t} sound={soundOn && game.phase === "podium"} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 flex flex-wrap items-center gap-3 px-[2vw] pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
        {game.phase === "lobby" ? (
          <>
            <span className="flex items-center gap-2 rounded-full bg-raised px-4 py-2 text-[clamp(13px,1.2vw,18px)] font-bold text-ink shadow-card">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-ok" />
              </span>
              {t.host.startHint(view.players.length)}
            </span>
            <button type="button" onClick={() => void act(game.locked ? "unlock" : "lock")} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-[clamp(13px,1.2vw,18px)] font-semibold shadow-card", game.locked ? "bg-ink text-paper" : "bg-raised text-ink-2 hover:text-ink")}>
              {game.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              {game.locked ? t.host.unlock : t.host.lock}
            </button>
          </>
        ) : game.phase === "question" ? (
          <span className="rounded-full bg-raised px-4 py-2 text-[clamp(13px,1.2vw,18px)] font-bold text-ink shadow-card">{t.host.question(game.q + 1, game.total)}</span>
        ) : null}
        <span className="flex-1" />
        {game.phase !== "ended" && game.phase !== "lobby" && game.phase !== "podium" && (
          <button
            type="button"
            onClick={() => {
              if (confirm(t.host.endConfirm)) void act("end");
            }}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[clamp(13px,1.2vw,18px)] font-semibold text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Square className="size-4" /> {t.host.end}
          </button>
        )}
        {(game.phase === "podium" || game.phase === "ended") && (
          <>
            <Link href={`/quiz/report/${game.id}`} className="flex items-center gap-2 rounded-full bg-raised px-5 py-2.5 text-[clamp(14px,1.3vw,19px)] font-bold text-ink shadow-card hover:bg-hover">
              <BarChart3 className="size-5" /> {t.host.report}
            </Link>
            {game.quizId && (
              <button type="button" disabled={busy} onClick={() => void again()} className="flex items-center gap-2 rounded-full bg-blob px-5 py-2.5 text-[clamp(14px,1.3vw,19px)] font-bold text-white shadow-card hover:bg-blob-deep disabled:opacity-60">
                <RotateCcw className="size-5" /> {t.host.again}
              </button>
            )}
          </>
        )}
        {main && game.phase !== "podium" && game.phase !== "ended" && (
          <motion.button
            type="button"
            disabled={!canGo}
            onClick={() => {
              sound.unlock();
              setUnlocked(true);
              void act(main.action);
            }}
            whileTap={{ scale: 0.95 }}
            className="quiz-press flex items-center gap-2 rounded-2xl bg-blob px-[clamp(20px,2.4vw,40px)] py-[clamp(10px,1.4vh,18px)] text-[clamp(16px,1.6vw,26px)] font-bold text-white disabled:opacity-40"
            style={{ ["--quiz-deep" as string]: "var(--blob-deep)" }}
          >
            {main.icon} {main.label}
          </motion.button>
        )}
      </footer>
    </div>
  );
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}

function IconToggle({ on, onClick, label, icon }: { on: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("grid size-9 place-items-center rounded-xl transition-colors hover:bg-hover", on ? "text-ink" : "text-ink-3")} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

/** Big soft jelly shapes slowly drifting behind everything. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {(
        [
          ["-6vw", "8vh", "34vw", "#6d3df5", 0],
          ["72vw", "-6vh", "26vw", "#ff70b0", -5],
          ["80vw", "62vh", "30vw", "#3d74f0", -9],
          ["10vw", "70vh", "24vw", "#26a269", -13],
        ] as const
      ).map(([left, top, size, color, delay], i) => (
        <span key={i} className="quiz-float absolute rounded-full opacity-[0.09] blur-3xl" style={{ left, top, width: size, height: size, background: color, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

function Lobby({ view, joinUrl, origin, t, onKick }: { view: HostView; joinUrl: string; origin: string; t: T; onKick: (p: HostPlayer) => void }) {
  const [copied, setCopied] = useState(false);
  const host = origin.replace(/^https?:\/\//, "");
  const pin = view.game.pin;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-[3vh] px-[3vw]">
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="flex flex-wrap items-stretch justify-center gap-[2vw] rounded-[28px] bg-raised p-[1.4vw] shadow-pop">
        <div className="flex flex-col justify-center gap-1 px-[1.4vw]">
          <span className="text-[clamp(14px,1.4vw,22px)] font-semibold text-ink-3">{t.host.joinAt}</span>
          <span className="font-display text-[clamp(20px,2.6vw,44px)] font-bold tracking-[-0.01em] text-ink">
            {host}/<span className="text-blob-ink">play</span>
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(joinUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="mt-1 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[clamp(12px,1vw,15px)] font-semibold text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Copy className="size-3.5" /> {copied ? t.host.copied : t.host.copyLink}
          </button>
        </div>
        <div className="flex flex-col justify-center rounded-3xl bg-blob px-[2vw] py-[1vh] text-white">
          <span className="text-[clamp(14px,1.4vw,22px)] font-semibold text-white/80">{t.host.pin}</span>
          <span className="font-display text-[clamp(44px,6.4vw,112px)] font-bold leading-none tracking-[0.04em] tabular-nums">
            {pin.slice(0, 3)}
            <span className="inline-block w-[0.3em]" />
            {pin.slice(3)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <QR text={joinUrl} size={150} className="rounded-xl" />
          <span className="text-[clamp(11px,1vw,14px)] font-semibold text-ink-3">{t.host.scan}</span>
        </div>
      </motion.div>

      {view.game.locked && (
        <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-[clamp(13px,1.2vw,18px)] font-semibold text-paper">
          <Lock className="size-4" /> {t.host.locked}
        </span>
      )}

      <div className="relative flex min-h-0 w-full flex-1 flex-col items-center">
        {view.players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Blob size={160} mood="happy" plain />
            <p className="font-display text-[clamp(20px,2.4vw,38px)] font-bold text-ink">{t.host.waiting}</p>
            <p className="text-[clamp(14px,1.3vw,20px)] text-ink-3">{t.host.waitingHint}</p>
          </div>
        ) : (
          <ul className={cn("flex max-h-full w-full flex-wrap content-start justify-center overflow-y-auto px-[2vw] pb-[2vh]", view.players.length <= 12 ? "gap-[2.4vw] pt-[2vh]" : "gap-[1.2vw]")}>
            <AnimatePresence>
              {[...view.players].reverse().map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ scale: 0, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className="group relative flex flex-col items-center gap-0.5"
                >
                  <MiniBlob look={p.look} size={view.players.length <= 12 ? 104 : view.players.length <= 40 ? 76 : 58} delay={(i * 137) % 2400} />
                  <span className={cn("max-w-[180px] truncate rounded-full bg-raised px-3 py-1 font-bold text-ink shadow-card", view.players.length <= 12 ? "text-[clamp(15px,1.6vw,24px)]" : "text-[clamp(13px,1.3vw,19px)]")}>{p.nickname}</span>
                  <button type="button" onClick={() => onKick(p)} className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-ink text-paper opacity-0 shadow-card transition-opacity focus:opacity-100 group-hover:opacity-100" aria-label={t.host.kick(p.nickname)} title={t.host.kick(p.nickname)}>
                    <X className="size-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
