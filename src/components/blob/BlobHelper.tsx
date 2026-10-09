"use client";

import { AnimatePresence, motion } from "motion/react";
import { FilePlus2, ListPlus, MonitorPlay, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "./Blob";
import { blob, type BlobEvent } from "./bus";
import { TypedText, useTypewriter } from "./speech";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { blobText } from "@/i18n/messages/blob";
import { cn, firstName } from "@/lib/utils";

/** The little jelly in the corner: reacts to saves, completions and errors, and offers help. */
export function BlobHelper() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, createPage } = useWorkspace();
  const t = useMessages(blobText);
  const ref = useRef<BlobHandle>(null);
  const [heldMood, setHeldMood] = useState<BlobMood | null>(null);
  const [flashMood, setFlashMood] = useState<BlobMood | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sleepy, setSleepy] = useState(false);
  const [tip, setTip] = useState(0);
  const [flashAccessory, setFlashAccessory] = useState<BlobAccessory | null>(null);
  // On phones Blob slides out of the way while you scroll down, and comes back when you scroll up.
  const [tucked, setTucked] = useState(false);
  const accessoryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const speechTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return blob.subscribe((e: BlobEvent) => {
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
        clearTimeout(speechTimer.current);
        setSpeech(e.text);
        speechTimer.current = setTimeout(() => setSpeech(null), e.ms ?? Math.max(2600, e.text.length * 60));
        ref.current?.poke(-Math.PI / 2, 0.6);
      } else {
        const r = ref.current;
        if (e.reaction === "jump") r?.jump(1);
        if (e.reaction === "squish") r?.squish(1);
        if (e.reaction === "shake") r?.shake();
        if (e.reaction === "poke") r?.poke();
        if (e.reaction === "wave") r?.wave();
        if (e.reaction === "celebrate") r?.celebrate();
      }
    });
  }, []);

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

  const { shown, typing } = useTypewriter(speech && !open ? speech : null);

  // On learning pages Blob is already on screen as the tutor; one Blob at a time.
  if (!profile.blob_tips || pathname.startsWith("/learn")) return null;

  // Reading glasses while you're studying a note or presentation.
  const accessory: BlobAccessory | null = flashAccessory ?? (pathname.startsWith("/p/") ? "glasses" : null);

  const mood: BlobMood = flashMood ?? heldMood ?? (sleepy ? "sleepy" : open ? "happy" : "idle");
  // Keyboard and drag-and-drop tips are no use on a phone. (The panel only renders after a tap, so no hydration mismatch.)
  const tips = open && window.matchMedia("(hover: none)").matches ? t.touchTips : t.tips;
  const name = firstName(profile.full_name);

  async function newPage(kind: "note" | "deck") {
    setOpen(false);
    const page = await createPage({ kind });
    if (page) router.push(`/p/${page.id}`);
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-2 right-2 z-40 flex flex-col items-end transition-transform duration-300 ease-out sm:bottom-3 sm:right-4",
        tucked && !open && !speech && "max-sm:translate-y-[calc(100%+12px)]",
      )}
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
            </div>
            <button onClick={() => setTip((t) => t + 1)} className="mt-2 text-[12px] text-ink-3 hover:text-ink">
              {t.anotherTip}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {speech && !open && (
          <motion.div
            key={speech}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            style={{ transformOrigin: "bottom right" }}
            className="relative -mb-1 mr-8 max-w-[260px] rounded-2xl rounded-br-md border border-line bg-raised px-3 py-2 text-[13px] leading-snug text-ink shadow-pop"
            role="status"
            aria-live="polite"
          >
            <TypedText text={speech} shown={shown} />
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
          setSpeech(null);
          setTip((t) => t + 1);
        }}
        className="pointer-events-auto grid origin-bottom-right rounded-full outline-offset-[-6px] max-sm:-mt-7 max-sm:scale-75"
      >
        <Blob ref={ref} size={78} mood={mood} talking={typing} accessory={accessory} />
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
