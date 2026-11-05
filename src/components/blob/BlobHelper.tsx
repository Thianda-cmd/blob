"use client";

import { AnimatePresence, motion } from "motion/react";
import { FilePlus2, Info, ListPlus, MonitorPlay, Shirt, TriangleAlert, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "./Blob";
import { blob, type BlobEvent } from "./bus";
import { cleanLook, seasonalHat, type BlobHat } from "./look";
import { useBlobLook } from "./LookContext";
import { KONAMI } from "./wardrobe";
import { TypedText, useTypewriter } from "./speech";
import { useUpdateCorner } from "@/components/AppUpdater";
import { useModKey } from "@/components/ui/ModKey";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { blobText } from "@/i18n/messages/blob";
import { blobCornerText } from "@/i18n/messages/blobCorner";
import { cn, firstName } from "@/lib/utils";

/** The little jelly in the corner: reacts to saves, completions and errors, and offers help. */
export function BlobHelper() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, setProfile, createPage } = useWorkspace();
  const t = useMessages(blobText);
  const corner = useMessages(blobCornerText);
  // The shortcut key in the tips: ⌘ on Apple keyboards, Strg or Ctrl elsewhere.
  const mod = useModKey();
  const look = useBlobLook();
  const ref = useRef<BlobHandle>(null);
  const [heldMood, setHeldMood] = useState<BlobMood | null>(null);
  const [flashMood, setFlashMood] = useState<BlobMood | null>(null);
  const { speech, say, end: endSpeech, hold: holdSpeech } = useSpeech();
  // The desktop app's update card (or its round button) in the same corner.
  const update = useUpdateCorner();
  const [open, setOpen] = useState(false);
  const [sleepy, setSleepy] = useState(false);
  const [tip, setTip] = useState(0);
  const [flashAccessory, setFlashAccessory] = useState<BlobAccessory | null>(null);
  // On phones Blob slides out of the way while you scroll down, and comes back when you scroll up.
  const [tucked, setTucked] = useState(false);
  // Out of the way altogether while a page wants the whole screen (handwritten notes).
  const [away, setAway] = useState(false);
  const accessoryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest profile, for the event handlers below: whether Blob's tips are on (how long words
  // stay), the look the Konami code changes.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    return blob.subscribe((e: BlobEvent) => {
      if (e.type === "away") {
        setAway(e.away);
        if (e.away) setOpen(false);
        return;
      }
      setSleepy(false);
      if (e.type === "mood") {
        setHeldMood(e.mood);
        return;
      }
      if (e.mood) {
        clearTimeout(flashTimer.current);
        setFlashMood(e.mood);
        flashTimer.current = setTimeout(() => setFlashMood(null), e.ms ?? 2400);
      }
      if (e.accessory) {
        clearTimeout(accessoryTimer.current);
        setFlashAccessory(e.accessory);
        accessoryTimer.current = setTimeout(() => setFlashAccessory(null), (e.ms ?? 2400) + 1200);
      }
      if (e.type === "say") {
        setTucked(false);
        say(e.text, e.mood, speechMs(e, profileRef.current.blob_tips));
        ref.current?.poke(-Math.PI / 2, 0.6);
      } else {
        const r = ref.current;
        if (e.reaction === "jump") r?.jump(1);
        if (e.reaction === "squish") r?.squish(1);
        if (e.reaction === "shake") r?.shake();
        if (e.reaction === "poke") r?.poke();
        if (e.reaction === "wave") r?.wave();
        if (e.reaction === "celebrate") r?.celebrate();
        if (e.reaction === "spin") r?.spin();
        if (e.reaction === "dance") r?.dance(e.ms ?? 3000);
        if (e.reaction === "nod") r?.nod();
        if (e.reaction === "wink") r?.wink();
        if (e.reaction === "sneeze") r?.sneeze();
        if (e.reaction === "yawn") r?.yawn();
      }
    });
  }, [say]);

  // Doze off after a while without activity, wake up on the next move.
  useEffect(() => {
    let timer = setTimeout(() => setSleepy(true), 90_000);
    const wake = () => {
      clearTimeout(timer);
      setSleepy((was) => {
        if (was) {
          setFlashMood("surprised");
          setTimeout(() => setFlashMood(null), 900);
          setTimeout(() => ref.current?.wave(), 700);
        }
        return false;
      });
      timer = setTimeout(() => setSleepy(true), 90_000);
    };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Any scroller in the page (capture phase sees them all): down tucks Blob away, up brings it back.
  useEffect(() => {
    const last = new WeakMap<object, number>();
    const onScroll = (e: Event) => {
      const el = e.target instanceof Element ? e.target : document.scrollingElement;
      if (!el) return;
      const top = el.scrollTop;
      const prev = last.get(el) ?? 0;
      last.set(el, top);
      if (Math.abs(top - prev) < 6) return;
      setTucked(top > prev && top > 24);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // A new page starts with Blob in view.
  const [shownPath, setShownPath] = useState(pathname);
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setTucked(false);
  }

  // Wave hello shortly after the workspace opens.
  useEffect(() => {
    const t = setTimeout(() => ref.current?.wave(), 1600);
    return () => clearTimeout(t);
  }, []);

  // A hat for the season (or the night), when no hat is picked. Checked in the browser, by its clock.
  const [seasonal, setSeasonal] = useState<BlobHat | null>(null);
  useEffect(() => {
    const check = () => setSeasonal(seasonalHat(new Date()));
    const first = setTimeout(check, 0);
    const every = setInterval(check, 10 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  // Now and then Blob does a little something on his own, unless you're busy with him.
  const busy = useRef(false);
  useEffect(() => {
    busy.current = open || !!speech || sleepy;
  }, [open, speech, sleepy]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(run, 50_000 + Math.random() * 50_000);
    };
    const run = () => {
      const b = ref.current;
      if (b && document.visibilityState === "visible" && !busy.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const h = new Date().getHours();
        const antics = ["wave", "spin", "wink", "nod", "dance", h >= 21 || h < 7 ? "yawn" : "wave", Math.random() < 0.2 ? "sneeze" : "spin"] as const;
        const a = antics[Math.floor(Math.random() * antics.length)];
        if (a === "dance") b.dance(2400);
        else b[a]();
      }
      schedule();
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // ↑ ↑ ↓ ↓ ← → ← → B A: Disco Blob.
  useEffect(() => {
    let at = 0;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      at = key === KONAMI[at] ? at + 1 : key === KONAMI[0] ? 1 : 0;
      if (at < KONAMI.length) return;
      at = 0;
      const current = cleanLook(profileRef.current.blob_look);
      const secrets = current.secrets ?? [];
      void setProfile({ blob_look: { ...current, skin: "disco", secrets: secrets.includes("disco") ? secrets : [...secrets, "disco"] } });
      blob.react("dance", "excited", 3200);
      blob.say(corner.discoFound, { mood: "excited", ms: 4200 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setProfile, corner.discoFound]);

  // Typed out in Blob's bubble only (the plain card shows the words at once).
  const { shown, typing } = useTypewriter(profile.blob_tips && speech && !open ? speech.text : null);

  // Above the update card or its round button, when one is in the corner (px from the window's bottom: its 16 px, it, 8 px).
  const above = update.kind ? 16 + update.height + 8 : 0;

  // Tips switched off: no Blob, but what went wrong and what needs a look still shows.
  if (!profile.blob_tips) return <SpeechCard speech={speech} away={away} above={above} closeLabel={t.messageClose} onClose={endSpeech} onHold={holdSpeech} />;
  // On learning pages Blob is already on screen as the tutor; one Blob at a time.
  if (pathname.startsWith("/learn") || pathname === "/blob") return null;

  // Reading glasses while you're studying a note or presentation.
  const accessory: BlobAccessory | null = flashAccessory ?? (pathname.startsWith("/p/") ? "glasses" : null);

  const mood: BlobMood = flashMood ?? heldMood ?? (sleepy ? "sleepy" : open ? "happy" : "idle");
  // Keyboard and drag-and-drop tips are no use on a phone. (The panel only renders after a tap, so no hydration mismatch.)
  const tips = open && window.matchMedia("(hover: none)").matches ? t.touchTips : t.tips(mod);
  const name = firstName(profile.full_name);
  // The update card has its own Blob: this one waits below the edge, and comes up above the card to say something.
  const makeRoom = update.kind === "card" && !open && !speech;
  // Below the screen's edge: out of sight, so out of the keyboard's way too (Tab skips it).
  const hidden = (away || makeRoom) && !open && !speech;

  async function newPage(kind: "note" | "deck") {
    setOpen(false);
    const page = await createPage({ kind });
    if (page) router.push(`/p/${page.id}`);
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-[calc(64px+env(safe-area-inset-bottom))] right-2 z-40 flex flex-col items-end transition-[transform,bottom] duration-300 ease-out motion-reduce:transition-none sm:bottom-[calc(12px+env(safe-area-inset-bottom))] sm:right-4",
        tucked && !open && !speech && "max-sm:translate-y-[calc(100%+12px)]",
        // Below the screen's edge (on phones, below the tab bar too).
        hidden && "translate-y-[calc(100%+160px)]",
      )}
      style={above && !makeRoom ? { bottom: `calc(${above}px + env(safe-area-inset-bottom))` } : undefined}
      inert={hidden}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-auto mb-2 w-[290px] rounded-2xl border border-line bg-raised p-3 shadow-pop"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-[15px] font-semibold">{t.needAHand(name)}</div>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{tips[tip % tips.length]}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-8"
                aria-label={t.close}
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid gap-0.5">
              <HelperAction icon={<FilePlus2 />} onClick={() => newPage("note")}>{t.newNote}</HelperAction>
              <HelperAction icon={<MonitorPlay />} onClick={() => newPage("deck")}>{t.newDeck}</HelperAction>
              <HelperAction
                icon={<ListPlus />}
                onClick={() => {
                  setOpen(false);
                  router.push("/tasks?new=1");
                }}
              >
                {t.addTask}
              </HelperAction>
              <HelperAction
                icon={<Shirt />}
                onClick={() => {
                  setOpen(false);
                  router.push("/blob");
                }}
              >
                {t.dressUp}
              </HelperAction>
            </div>
            <button onClick={() => setTip((t) => t + 1)} className="mt-2 text-[12px] text-ink-2 hover:text-ink">
              {t.anotherTip}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {speech && !open && (
          <motion.div
            key={speech.text}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            style={{ transformOrigin: "bottom right" }}
            className="relative -mb-1 mr-8 max-w-[260px] rounded-2xl rounded-br-md border border-line bg-raised px-3 py-2 text-[13px] leading-snug text-ink shadow-pop"
            role="status"
            aria-live="polite"
          >
            <TypedText text={speech.text} shown={shown} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smaller on phones so it covers less of the page. */}
      {/* A real button, so the helper opens with the keyboard too (Blob still wobbles under the mouse). */}
      <button
        type="button"
        aria-label={t.helperTitle}
        title={t.helperTitle}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          endSpeech();
          setTip((t) => t + 1);
        }}
        className="pointer-events-auto grid origin-bottom-right rounded-full outline-offset-[-6px] max-sm:-mt-7 max-sm:scale-75"
      >
        <Blob ref={ref} size={78} mood={mood} talking={typing} accessory={accessory} wear={!look.hat && seasonal ? { hat: seasonal } : undefined} />
      </button>
    </div>
  );
}

function HelperAction({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 hover:bg-hover hover:text-ink [&_svg]:size-4 [&_svg]:text-ink-3">
      {icon}
      {children}
    </button>
  );
}

/** Words Blob says (blob.say), with how Blob feels about them: one message at a time, each with a number of its own. */
type Speech = { id: number; text: string; mood?: BlobMood; ms: number };

/**
 * How long words stay. In Blob's bubble: as long as asked, or long enough to read them after Blob
 * has typed them. On the plain card (tips off) they show at once and stay as the spreadsheet's
 * notices do: long enough to read them at a slow pace (70 ms a character), at least 7 s for a
 * problem and 5.5 s for anything else, at most 16 s unless asked for longer.
 */
function speechMs({ text, mood, ms }: { text: string; mood?: BlobMood; ms?: number }, bubble: boolean): number {
  if (bubble) return ms ?? Math.max(2600, text.length * 60);
  return Math.max(ms ?? 0, Math.min(16_000, Math.max(mood === "worried" ? 7000 : 5500, text.length * 70)));
}

/**
 * What Blob is saying: there until its time is up, it is closed, or newer words replace it.
 * `hold` keeps the words while the pointer rests on them or the keyboard is in them (the plain
 * card); afterwards they count down afresh. Only the words with that number: a card on its way
 * out lets go of nothing but itself.
 */
function useSpeech() {
  const [speech, setSpeech] = useState<Speech | null>(null);
  // The words now, for the timer and the event handlers.
  const now = useRef<Speech | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const count = useRef(0);
  const end = useCallback((id?: number) => {
    if (!now.current || (id !== undefined && now.current.id !== id)) return;
    clearTimeout(timer.current);
    now.current = null;
    setSpeech(null);
  }, []);
  const countDown = useCallback(
    (s: Speech) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => end(s.id), s.ms);
    },
    [end],
  );
  const say = useCallback(
    (text: string, mood: BlobMood | undefined, ms: number) => {
      const next: Speech = { id: ++count.current, text, mood, ms };
      now.current = next;
      setSpeech(next);
      countDown(next);
    },
    [countDown],
  );
  const hold = useCallback(
    (id: number, held: boolean) => {
      if (now.current?.id !== id) return;
      clearTimeout(timer.current);
      if (!held) countDown(now.current);
    },
    [countDown],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { speech, say, end, hold };
}

/**
 * Blob's words while its tips are switched off: Blob stays away, but problems (mood "worried")
 * and hints or work in progress ("thinking") still show, as a plain card at the bottom that looks
 * like the spreadsheet's notices (src/components/sheet/SheetNotice.tsx). Cheerful words stay
 * unsaid. The card closes with its button or Escape, and stays while the pointer rests on it or
 * the keyboard is in it.
 *
 * Screen readers hear each message once, from the two live regions (polite, or at once for
 * problems); the card repeats the words for the eyes only, next to its close button.
 *
 * `away`: the page keeps the bottom of the screen for itself (blob.away). The card sits higher
 * then, above the spreadsheet's sheet tabs and status bar (where its own notices sit, so Summe and
 * Mittelwert stay readable) and above the pen bar of handwritten notes on phones.
 */
function SpeechCard({
  speech,
  away,
  above,
  closeLabel,
  onClose,
  onHold,
}: {
  speech: Speech | null;
  away: boolean;
  /** Above the desktop app's update card in the corner (px from the window's bottom), 0 when there is none. */
  above: number;
  closeLabel: string;
  onClose: (id: number) => void;
  onHold: (id: number, held: boolean) => void;
}) {
  const shown = speech?.mood === "worried" || speech?.mood === "thinking" ? speech : null;
  const urgent = shown?.mood === "worried";

  // The card with the keyboard in it goes (closed, or replaced by newer words): the keyboard goes
  // back to where it came from, not to the top of the page.
  const root = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<HTMLElement | null>(null);
  const shownId = shown?.id;
  useEffect(() => {
    const at = document.activeElement;
    const card = at instanceof HTMLElement ? at.closest<HTMLElement>("[data-blob-says]") : null;
    if (!card || !root.current?.contains(card) || card.dataset.blobSays === String(shownId)) return;
    const back = cameFrom.current;
    cameFrom.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, [shownId]);

  return (
    // Above the phone's tab bar; above dialogs too, which a problem often comes from.
    <div
      ref={root}
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[75] grid grid-cols-[minmax(0,1fr)] justify-items-center px-3 transition-[bottom] duration-300 ease-out motion-reduce:transition-none",
        away
          ? "bottom-[calc(128px+env(safe-area-inset-bottom))] sm:bottom-[calc(72px+env(safe-area-inset-bottom))]"
          : "bottom-[calc(64px+env(safe-area-inset-bottom))] sm:bottom-[calc(16px+env(safe-area-inset-bottom))]",
      )}
      style={above ? { bottom: `calc(${above}px + env(safe-area-inset-bottom))` } : undefined}
    >
      {/* A new element for each message, so the same words twice in a row are said twice. */}
      <div role="status" className="sr-only">
        {shown && !urgent && <span key={shown.id}>{shown.text}</span>}
      </div>
      <div role="alert" className="sr-only">
        {shown && urgent && <span key={shown.id}>{shown.text}</span>}
      </div>
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            data-blob-says={shown.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            // Pointer and keyboard each hold it; it counts down again once both have left.
            onPointerEnter={() => onHold(shown.id, true)}
            onPointerLeave={(e) => {
              if (!e.currentTarget.contains(document.activeElement)) onHold(shown.id, false);
            }}
            onFocus={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) cameFrom.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
              onHold(shown.id, true);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !e.currentTarget.matches(":hover")) onHold(shown.id, false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              onClose(shown.id);
            }}
            // One cell for all cards: a new one takes the old one's place while that fades out.
            className={cn(
              "pointer-events-auto flex w-max max-w-[min(30rem,100%)] items-start gap-2.5 rounded-xl border bg-raised py-2 pl-3 pr-1.5 text-[13px] leading-snug text-ink shadow-pop [grid-area:1/1] [@media(hover:none)]:text-[14px] [&_svg]:size-4 [&_svg]:shrink-0",
              urgent ? "border-danger/35" : "border-line",
            )}
          >
            <span aria-hidden className="mt-[3px] flex">
              {urgent ? <TriangleAlert className="text-danger" /> : <Info className="text-blob-ink" />}
            </span>
            <p aria-hidden className="min-w-0 flex-1 py-px">
              {shown.text}
            </p>
            <button
              type="button"
              onClick={() => onClose(shown.id)}
              aria-label={closeLabel}
              className="-my-0.5 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-blob [@media(hover:none)]:size-9 [&_svg]:!size-3.5"
            >
              <X />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
