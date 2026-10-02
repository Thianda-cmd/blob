"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Keyboard, LayoutGrid, Maximize, Minimize, MonitorSpeaker, NotebookText, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Blob } from "@/components/blob/Blob";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { useMessages } from "@/i18n/client";
import { presentText } from "@/i18n/messages/present";
import type { Deck, SlideTransition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildUnits, deckPalette, sectionNumbers, transitionFor } from "./deck";
import type { StageCustom } from "./motion";
import { SlideView } from "./SlideView";
import { SmallButton, SpeakerView, type Timer } from "./SpeakerView";
import { StageCanvas, StageSlide } from "./Stage";

type Awake = "pointer" | "key" | null;
type View = "audience" | "speaker";
type Blank = "black" | "white" | null;

/** Where the show is. `origin` says whether this window made the change (and should tell the other window). */
type Pos = { index: number; step: number; dir: number; kind: SlideTransition; origin: "local" | "remote" };

type Message =
  | { t: "pos"; index: number; step: number }
  | { t: "hello" }
  | { t: "blank"; v: Blank }
  | { t: "laser"; x: number; y: number }
  | { t: "laser-off" };

/** Fullscreen slideshow. Lives outside the app shell. Two windows (audience + speaker) stay in sync. */
export function Presenter({ pageId, title, deck, start, initialView = "audience" }: { pageId: string; title: string; deck: Deck; start: number; initialView?: View }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const t = useMessages(presentText);
  const total = deck.slides.length;
  const palette = useMemo(() => deckPalette(deck.theme, deck.custom), [deck.theme, deck.custom]);
  const sections = useMemo(() => sectionNumbers(deck.slides), [deck.slides]);
  const units = useMemo(() => deck.slides.map(buildUnits), [deck.slides]);

  const [pos, setPos] = useState<Pos>({ index: start, step: 0, dir: 0, kind: "none", origin: "remote" });
  const [view, setView] = useState<View>(initialView);
  const [awake, setAwake] = useState<Awake>("key");
  const [hint, setHint] = useState(true);
  const [notes, setNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [overview, setOverview] = useState<number | null>(null);
  const [blank, setBlank] = useState<Blank>(null);
  const [laser, setLaser] = useState(false);
  const [laserSeen, setLaserSeen] = useState(false);
  const [help, setHelp] = useState(false);
  const [timer, setTimer] = useState<Timer>({ acc: 0, since: null });
  const [notice, setNotice] = useState<string | null>(null);

  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const remoteLaserTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const posRef = useRef(pos);
  const canvases = useRef(new Map<number, HTMLElement>());
  const speakerCanvas = useRef<HTMLDivElement>(null);
  const other = useRef<Window | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const laserX = useMotionValue(-100);
  const laserY = useMotionValue(-100);

  const { index, step } = pos;
  const ended = index >= total;
  const slide = deck.slides[Math.min(index, total - 1)];
  const nextSlide = deck.slides[index + 1];

  // Navigation ------------------------------------------------------------------

  const kindFor = useCallback((to: number, from: number): SlideTransition => {
    if (to >= total || from >= total) return "fade";
    return to > from ? transitionFor(deck, deck.slides[to]) : transitionFor(deck, deck.slides[from]);
  }, [deck, total]);

  const next = useCallback(() => {
    setPos((p) => {
      if (p.index < total && p.step < units[p.index]) return { ...p, step: p.step + 1, origin: "local" };
      if (p.index >= total) return p;
      return { index: p.index + 1, step: 0, dir: 1, kind: kindFor(p.index + 1, p.index), origin: "local" };
    });
    setHint(false);
  }, [total, units, kindFor]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.index < total && p.step > 0) return { ...p, step: p.step - 1, origin: "local" };
      if (p.index <= 0) return p;
      const to = Math.min(p.index - 1, total - 1);
      return { index: to, step: units[to], dir: -1, kind: kindFor(to, p.index), origin: "local" };
    });
    setHint(false);
  }, [total, units, kindFor]);

  const go = useCallback(
    (to: number, built = false) => {
      setPos((p) => {
        const t = Math.min(Math.max(to, 0), total);
        if (t === p.index) return p;
        return { index: t, step: built && t < total ? units[t] : 0, dir: t > p.index ? 1 : -1, kind: kindFor(t, p.index), origin: "local" };
      });
      setHint(false);
    },
    [total, units, kindFor],
  );

  // Sync with the other window --------------------------------------------------

  const send = useCallback((m: Message) => channel.current?.postMessage(m), []);

  useEffect(() => {
    posRef.current = pos;
    if (pos.origin === "local") send({ t: "pos", index: pos.index, step: pos.step });
  }, [pos, send]);

  const showLaserAt = useCallback(
    (nx: number, ny: number) => {
      const canvas = view === "speaker" ? speakerCanvas.current : canvases.current.get(posRef.current.index);
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      laserX.set(r.left + nx * r.width);
      laserY.set(r.top + ny * r.height);
      setLaserSeen(true);
      clearTimeout(remoteLaserTimer.current);
      remoteLaserTimer.current = setTimeout(() => setLaserSeen(false), 2000);
    },
    [view, laserX, laserY],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`blob-deck-${pageId}`);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (m.t === "pos") {
        setPos((p) => {
          const t = Math.min(Math.max(m.index, 0), total);
          if (t === p.index && m.step === p.step) return p;
          return { index: t, step: Math.min(Math.max(m.step, 0), units[t] ?? 0), dir: t === p.index ? p.dir : t > p.index ? 1 : -1, kind: t === p.index ? p.kind : kindFor(t, p.index), origin: "remote" };
        });
        setHint(false);
      } else if (m.t === "hello") {
        ch.postMessage({ t: "pos", index: posRef.current.index, step: posRef.current.step } satisfies Message);
      } else if (m.t === "blank") {
        setBlank(m.v);
      } else if (m.t === "laser") {
        showLaserAt(m.x, m.y);
      } else if (m.t === "laser-off") {
        setLaserSeen(false);
      }
    };
    ch.postMessage({ t: "hello" } satisfies Message);
    return () => {
      ch.close();
      channel.current = null;
    };
  }, [pageId, total, units, kindFor, showLaserAt]);

  const setBlankBoth = useCallback(
    (v: Blank) => {
      setBlank(v);
      send({ t: "blank", v });
    },
    [send],
  );

  const popOut = useCallback(() => {
    const target: View = view === "speaker" ? "audience" : "speaker";
    const url = `/present/${pageId}?slide=${Math.min(posRef.current.index, total - 1) + 1}${target === "speaker" ? "&view=speaker" : ""}`;
    const w = window.open(url, `blob-deck-${target}`, target === "speaker" ? "popup,width=1180,height=760" : "popup,width=1280,height=760");
    if (w) {
      other.current = w;
      return;
    }
    // Pop-ups blocked: show the speaker view here instead, and say why.
    if (target === "speaker") setView("speaker");
    setNotice(target === "speaker" ? t.popupSpeaker : t.popupAudience);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, [view, pageId, total, t]);

  // Chrome ----------------------------------------------------------------------

  const wake = useCallback((kind: "pointer" | "key") => {
    setAwake((a) => (a === "pointer" ? a : kind));
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAwake(null), kind === "pointer" ? 2600 : 1800);
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    // A second window (one we opened) just closes itself.
    if (window.opener && window.name.startsWith("blob-deck-")) {
      window.close();
      return;
    }
    other.current?.close();
    router.replace(`/p/${pageId}?slide=${Math.min(posRef.current.index, total - 1) + 1}`);
  }, [router, pageId, total]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleTimer = useCallback((action: "toggle" | "reset") => {
    const now = Date.now();
    setTimer((t) => (action === "reset" ? { acc: 0, since: t.since === null ? null : now } : t.since === null ? { acc: t.acc, since: now } : { acc: t.acc + now - t.since, since: null }));
  }, []);

  // Initial chrome and hint fade out on their own; the speaker timer starts.
  useEffect(() => {
    idleTimer.current = setTimeout(() => setAwake(null), 3000);
    const t = setTimeout(() => setHint(false), 5000);
    const started = setTimeout(() => setTimer((tm) => (tm.since === null && tm.acc === 0 ? { acc: 0, since: Date.now() } : tm)), 0);
    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(t);
      clearTimeout(started);
      clearTimeout(remoteLaserTimer.current);
      clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Warm the cache so image slides appear instantly.
  useEffect(() => {
    deck.slides.forEach((s) => {
      if (s.image) new Image().src = s.image;
    });
  }, [deck.slides]);

  // Keep ?slide= in sync so a reload resumes where you were.
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    window.history.replaceState(null, "", `?slide=${Math.min(index, total - 1) + 1}${view ? `&view=${view}` : ""}`);
  }, [index, total]);

  // Keyboard ----------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;

      // The overview grid has its own arrows.
      if (overview !== null) {
        const cols = gridColumns(gridRef.current);
        const move = (d: number) => setOverview((o) => Math.min(Math.max((o ?? 0) + d, 0), total - 1));
        switch (e.key) {
          case "ArrowRight":
            move(1);
            break;
          case "ArrowLeft":
            move(-1);
            break;
          case "ArrowDown":
            move(cols);
            break;
          case "ArrowUp":
            move(-cols);
            break;
          case "Enter":
          case " ":
            go(overview);
            setOverview(null);
            break;
          case "Escape":
          case "g":
          case "G":
            setOverview(null);
            break;
          default:
            return;
        }
        e.preventDefault();
        return;
      }

      if (help && (e.key === "Escape" || e.key === "?")) {
        e.preventDefault();
        setHelp(false);
        return;
      }

      const unblank = () => {
        if (!blank) return false;
        setBlankBoth(null);
        return true;
      };

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          if (!unblank()) next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          if (!unblank()) prev();
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(total - 1, true);
          break;
        case "Escape":
          e.preventDefault();
          if (help) setHelp(false);
          else if (unblank()) break;
          else exit();
          return;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "n":
        case "N":
          setNotes((v) => !v);
          break;
        case "g":
        case "G":
          setOverview(Math.min(posRef.current.index, total - 1));
          break;
        case "b":
        case "B":
        case ".":
          setBlankBoth(blank === "black" ? null : "black");
          break;
        case "w":
        case "W":
        case ",":
          setBlankBoth(blank === "white" ? null : "white");
          break;
        case "l":
        case "L":
          setLaser((v) => {
            if (v) send({ t: "laser-off" });
            return !v;
          });
          break;
        case "s":
        case "S":
          setView((v) => (v === "speaker" ? "audience" : "speaker"));
          break;
        case "p":
        case "P":
          popOut();
          break;
        case "?":
          setHelp((v) => !v);
          break;
        default:
          return;
      }
      e.preventDefault();
      wake("key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, exit, toggleFullscreen, wake, total, overview, help, blank, setBlankBoth, popOut, send]);

  // Laser -------------------------------------------------------------------------

  const laserFrame = useRef(0);
  const onLaserMove = (e: React.PointerEvent) => {
    if (!laser) return;
    laserX.set(e.clientX);
    laserY.set(e.clientY);
    if (laserFrame.current) return;
    const { clientX, clientY } = e;
    laserFrame.current = requestAnimationFrame(() => {
      laserFrame.current = 0;
      const canvas = view === "speaker" ? speakerCanvas.current : canvases.current.get(posRef.current.index);
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) send({ t: "laser", x, y });
      else send({ t: "laser-off" });
    });
  };

  const showChrome = awake !== null;
  const built = units[index] ?? 0;
  const progress = ended ? 1 : (index + (built ? step / built : 1)) / total;
  const kind: SlideTransition = reduce ? (pos.kind === "none" ? "none" : "fade") : pos.kind;
  const custom: StageCustom = { dir: pos.dir, kind };

  const overlays = (
    <>
      <AnimatePresence>
        {overview !== null && (
          <Overview
            deck={deck}
            palette={palette}
            sections={sections}
            current={Math.min(index, total - 1)}
            selected={overview}
            gridRef={gridRef}
            onPick={(i) => {
              go(i);
              setOverview(null);
            }}
            onHover={setOverview}
            onClose={() => setOverview(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{help && <Help onClose={() => setHelp(false)} />}</AnimatePresence>
      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex justify-center px-4"
          >
            <div className="max-w-[520px] rounded-xl border border-white/10 bg-[#1c1b18] px-3.5 py-2 text-center text-[13px] text-white/80 shadow-pop">{notice}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {(laser || laserSeen) && !(blank && view === "audience") && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[80] -ml-[7px] -mt-[7px] size-[14px] rounded-full bg-[#ff2e55] shadow-[0_0_0_3px_rgb(255_46_85/0.28),0_0_22px_8px_rgb(255_46_85/0.5)]"
          style={{ x: laserX, y: laserY }}
        />
      )}
    </>
  );

  if (view === "speaker") {
    return (
      <div onPointerMove={onLaserMove} style={{ cursor: laser ? "none" : undefined }}>
        <p className="sr-only" aria-live="polite">
          {ended ? t.endOfPresentation : t.slideOf(index + 1, total)}
        </p>
        <SpeakerView
          deck={deck}
          palette={palette}
          sections={sections}
          index={index}
          step={step}
          units={units}
          title={title}
          timer={timer}
          blank={blank}
          remote={initialView === "speaker"}
          canvasRef={speakerCanvas}
          onTimer={toggleTimer}
          onPrev={prev}
          onNext={next}
          onOverview={() => setOverview(Math.min(index, total - 1))}
          onHelp={() => setHelp(true)}
          onPopOut={() => (initialView === "speaker" ? setView("audience") : popOut())}
          onExit={exit}
        />
        {overlays}
      </div>
    );
  }

  return (
    <div
      data-theme="dark"
      className="fixed inset-0 select-none overflow-hidden bg-[#0b0b0a] text-[#f1efe8]"
      style={{ cursor: laser ? "none" : awake === "pointer" ? "default" : "none" }}
      onPointerMove={(e) => {
        wake("pointer");
        onLaserMove(e);
      }}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY, swiped: false };
      }}
      onPointerUp={(e) => {
        const s = swipe.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          s.swiped = true;
          if (dx < 0) next();
          else prev();
        }
      }}
      onClick={(e) => {
        if (swipe.current?.swiped) return;
        if (blank) return setBlankBoth(null);
        if (e.clientX < window.innerWidth / 2) prev();
        else next();
      }}
    >
      <p className="sr-only" aria-live="polite">
        {ended ? t.endOfPresentation : `${t.slideOf(index + 1, total)}${slide.title.trim() ? `: ${slide.title.trim()}` : ""}`}
      </p>

      {/* Slides */}
      <AnimatePresence initial={false} custom={custom}>
        <StageSlide key={index} custom={custom}>
          {ended ? (
            <EndScreen title={title} total={total} onRestart={() => go(0)} onExit={exit} />
          ) : (
            <StageCanvas index={index} canvases={canvases} morphFrom={kind === "morph" && pos.dir !== 0 ? index - pos.dir : null}>
              {(ref) => <SlideView slide={deck.slides[index]} palette={palette} mode="present" reveal={built ? step : undefined} ordinal={sections.get(deck.slides[index].id)} canvasRef={ref} />}
            </StageCanvas>
          )}
        </StageSlide>
      </AnimatePresence>

      {/* Black / white screen */}
      <AnimatePresence>
        {blank && (
          <motion.div
            key={blank}
            className={cn("absolute inset-0 z-30", blank === "black" ? "bg-black" : "bg-white")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* Top controls (mouse only) */}
      <motion.div
        initial={false}
        animate={{ opacity: awake === "pointer" ? 1 : 0, y: awake === "pointer" ? 0 : -6 }}
        transition={{ duration: 0.2 }}
        className={cn("absolute inset-x-0 top-0 z-40 flex items-center justify-between p-4", awake !== "pointer" && "pointer-events-none")}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <ChromeButton onClick={exit} label={t.exitPresentation}>
          <X className="size-4" /> {t.exit} <Kbd className="ml-0.5 border-white/10 bg-white/5 text-white/50 shadow-none">Esc</Kbd>
        </ChromeButton>
        <div className="flex gap-1.5">
          <ChromeButton onClick={() => setNotes((v) => !v)} label={t.notesKey} active={notes}>
            <NotebookText className="size-4" /> {t.notes}
          </ChromeButton>
          <ChromeButton onClick={() => setView("speaker")} label={t.speakerViewKey}>
            <MonitorSpeaker className="size-4" />
          </ChromeButton>
          <ChromeButton onClick={() => setOverview(Math.min(index, total - 1))} label={t.allSlidesKey}>
            <LayoutGrid className="size-4" />
          </ChromeButton>
          <ChromeButton onClick={() => setLaser((v) => !v)} label={t.laserKey} active={laser}>
            <span className="grid size-4 place-items-center">
              <span className={cn("size-2 rounded-full", laser ? "bg-[#ff2e55] shadow-[0_0_8px_2px_rgb(255_46_85/0.6)]" : "bg-current")} />
            </span>
          </ChromeButton>
          <ChromeButton onClick={() => setHelp(true)} label={t.shortcutsKey}>
            <Keyboard className="size-4" />
          </ChromeButton>
          <ChromeButton onClick={toggleFullscreen} label={fullscreen ? t.exitFullscreen : t.fullscreen}>
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </ChromeButton>
        </div>
      </motion.div>

      {/* Counter with prev/next */}
      <motion.div
        initial={false}
        animate={{ opacity: showChrome ? 1 : 0 }}
        transition={{ duration: showChrome ? 0.15 : 0.5 }}
        className={cn("absolute bottom-4 right-4 z-40 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#1c1b18] p-1", !showChrome && "pointer-events-none")}
        onClick={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), prev())} disabled={index === 0 && step === 0} aria-label={t.previous} className="grid size-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[56px] px-1 text-center text-[12.5px] tabular-nums text-white/80">{ended ? t.end : `${index + 1} / ${total}`}</span>
        <button type="button" onClick={(e) => (e.detail > 0 && e.currentTarget.blur(), next())} disabled={ended} aria-label={t.next} className="grid size-7 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </motion.div>

      {/* First-run hint */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4, type: "spring", stiffness: 400, damping: 30 } }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.25 } }}
            className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center"
          >
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1c1b18] px-3.5 py-2 text-[12.5px] text-white/70 shadow-pop">
              <Hint keys={["←", "→"]}>{t.hintMove}</Hint>
              <Hint keys={["S"]}>{t.hintSpeaker}</Hint>
              <Hint keys={["G"]}>{t.hintAll}</Hint>
              <Hint keys={["?"]}>{t.hintShortcuts}</Hint>
              <Hint keys={["Esc"]}>{t.hintExit}</Hint>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker notes */}
      <AnimatePresence>
        {notes && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-x-0 bottom-16 z-40 flex justify-center px-4"
            onClick={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{ cursor: "default" }}
          >
            <div className="w-full max-w-[760px] rounded-2xl border border-white/10 bg-[#1c1b18] shadow-pop">
              <div className="flex items-center gap-3 border-b border-white/8 px-5 py-3 text-[12.5px] text-white/50">
                <NotebookText className="size-3.5" />
                <span className="font-medium text-white/80">{t.speakerNotes}</span>
                <span className="tabular-nums">{ended ? t.end : t.slideOf(index + 1, total)}</span>
                <span className="ml-auto truncate">
                  {nextSlide ? (
                    <>
                      {t.nextLabel} <span className="text-white/75">{nextSlide.title.trim() || t.slideAria(index + 2, "")}</span>
                    </>
                  ) : ended ? null : (
                    t.lastSlide
                  )}
                </span>
                <button type="button" onClick={() => setNotes(false)} aria-label={t.hideNotes} className="-mr-2 grid size-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="max-h-[34vh] overflow-y-auto px-5 py-4 text-[17px] leading-[1.6] text-white/90">
                {!ended && slide.notes.trim() ? <p className="whitespace-pre-wrap">{slide.notes}</p> : <p className="text-white/40">{ended ? t.lastSlideWas : t.noNotes}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-[3px] bg-white/[0.06]">
        <motion.div className="h-full origin-left bg-blob" initial={false} animate={{ scaleX: progress }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
      </div>

      {overlays}
    </div>
  );
}

/** Columns of the overview grid, read from the DOM (for arrow keys). */
function gridColumns(grid: HTMLElement | null) {
  if (!grid) return 4;
  return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 4;
}

function ChromeButton({ children, onClick, label, active }: { children: ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Mouse clicks shouldn't leave focus behind, or Space would press the button again.
        if (e.detail > 0) e.currentTarget.blur();
        onClick();
      }}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1b18] px-2.5 text-[13px] text-white/75 transition-colors hover:bg-[#262623] hover:text-white",
        active && "border-blob/50 text-white",
      )}
    >
      {children}
    </button>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {keys.map((k) => (
          <Kbd key={k} className="border-white/12 bg-white/5 text-white/70 shadow-none">
            {k}
          </Kbd>
        ))}
      </span>
      {children}
    </span>
  );
}

/** Every slide at once (G). Click or arrows + Enter to jump. */
function Overview({
  deck,
  palette,
  sections,
  current,
  selected,
  gridRef,
  onPick,
  onHover,
  onClose,
}: {
  deck: Deck;
  palette: ReturnType<typeof deckPalette>;
  sections: Map<string, number>;
  current: number;
  selected: number;
  gridRef: RefObject<HTMLDivElement | null>;
  onPick: (i: number) => void;
  onHover: (i: number) => void;
  onClose: () => void;
}) {
  const t = useMessages(presentText);
  useEffect(() => {
    document.getElementById(`overview-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <motion.div
      data-theme="dark"
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0a]/96 text-[#f1efe8] backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{ cursor: "default" }}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-6 text-[13px] text-white/55">
        <LayoutGrid className="size-4" />
        <span className="font-medium text-white/85">{t.allSlides}</span>
        <span className="tabular-nums">{deck.slides.length}</span>
        <span className="ml-auto hidden items-center gap-1.5 sm:flex">
          <Kbd className="border-white/12 bg-white/5 text-white/60 shadow-none">↵</Kbd> {t.jump}
          <Kbd className="ml-2 border-white/12 bg-white/5 text-white/60 shadow-none">Esc</Kbd> {t.closeHint}
        </span>
        <SmallButton label={t.close} onClick={onClose}>
          <X />
        </SmallButton>
      </div>
      <motion.div
        ref={gridRef}
        className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-5 overflow-y-auto px-6 pb-10"
        initial={{ scale: 0.98, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            id={`overview-${i}`}
            type="button"
            onClick={() => onPick(i)}
            onPointerEnter={() => onHover(i)}
            className="group text-left outline-none"
            aria-label={t.slideAria(i + 1, s.title.trim())}
            aria-current={i === current ? "true" : undefined}
          >
            <div
              className={cn(
                "aspect-video overflow-hidden rounded-lg ring-1 ring-white/10 transition-[box-shadow,transform] duration-150",
                i === selected && "ring-2 ring-blob",
                i === current && i !== selected && "ring-white/40",
              )}
            >
              <SlideView slide={s} palette={palette} mode="present" ordinal={sections.get(s.id)} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-white/50">
              <span className={cn("tabular-nums", i === current && "font-semibold text-blob-ink")}>{i + 1}</span>
              <span className="truncate group-hover:text-white/80">{s.title.trim() || t.untitledSlide}</span>
            </div>
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const t = useMessages(presentText);
  const shortcuts: [string[], string][] = [
    [["→", t.keys.space], t.help.next],
    [["←"], t.help.back],
    [[t.keys.home, t.keys.end], t.help.firstLast],
    [["G"], t.help.all],
    [["S"], t.help.speaker],
    [["P"], t.help.popOut],
    [["N"], t.help.notes],
    [["B", "W"], t.help.blank],
    [["L"], t.help.laser],
    [["F"], t.help.fullscreen],
    [["?"], t.help.help],
    [["Esc"], t.help.exit],
  ];
  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerUp={(e) => e.stopPropagation()}
      style={{ cursor: "default" }}
    >
      <motion.div
        role="dialog"
        aria-label={t.shortcuts}
        data-theme="dark"
        className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#1c1b18] p-5 text-[#f1efe8] shadow-pop"
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Keyboard className="size-4 text-white/55" />
          <h2 className="text-[14px] font-medium">{t.shortcuts}</h2>
          <span className="ml-auto" />
          <SmallButton label={t.close} onClick={onClose}>
            <X />
          </SmallButton>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
          {shortcuts.map(([keys, what]) => (
            <div key={what} className="contents">
              <dt className="flex justify-end gap-1">
                {keys.map((k) => (
                  <Kbd key={k} className="border-white/12 bg-white/5 text-white/75 shadow-none">
                    {k}
                  </Kbd>
                ))}
              </dt>
              <dd className="text-white/70">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-white/40">{t.helpFooter}</p>
      </motion.div>
    </motion.div>
  );
}

function EndScreen({ title, total, onRestart, onExit }: { title: string; total: number; onRestart: () => void; onExit: () => void }) {
  const t = useMessages(presentText);
  return (
    <div className="grid size-full place-items-center px-6">
      <div className="flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <Blob size={120} mood="excited" />
        <h1 className="mt-3 font-display text-[40px] font-semibold tracking-[-0.03em] text-[#f6f4ee]">{t.wrap}</h1>
        <p className="mt-1 max-w-[520px] truncate text-[15px] text-white/55">
          {title} · {t.slideCount(total)}
        </p>
        <div className="mt-7 flex gap-2">
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw className="size-4" /> {t.startOver}
          </Button>
          <Button variant="blob" onClick={onExit}>
            {t.backToEditor}
          </Button>
        </div>
      </div>
    </div>
  );
}
