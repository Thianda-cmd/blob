"use client";

import { AnimatePresence, motion } from "motion/react";
import { FilePlus2, ListPlus, MonitorPlay, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle, type BlobMood } from "./Blob";
import { blob, type BlobEvent } from "./bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { firstName } from "@/lib/utils";

const TIPS = [
  "Type / in a note to add headings, checklists, quotes and more.",
  "Press ⌘K (Ctrl K) to jump to any note in a second.",
  "Select text in a note to make it bold, highlighted or a link.",
  "Add homework on the Tasks page. Try “Essay due friday”.",
  "Presentations have a Present button. Use the arrow keys to move through slides.",
  "Everything saves automatically. I keep an eye on it.",
  "Drop an image into a note to add it.",
];

/** The little jelly in the corner: reacts to saves, completions and errors, and offers help. */
export function BlobHelper() {
  const router = useRouter();
  const { profile, createPage } = useWorkspace();
  const ref = useRef<BlobHandle>(null);
  const [heldMood, setHeldMood] = useState<BlobMood | null>(null);
  const [flashMood, setFlashMood] = useState<BlobMood | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sleepy, setSleepy] = useState(false);
  const [tip, setTip] = useState(0);
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
      if (e.type === "say") {
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

  if (!profile.blob_tips) return null;

  const mood: BlobMood = flashMood ?? heldMood ?? (sleepy ? "sleepy" : open ? "happy" : "idle");
  const name = firstName(profile.full_name);

  async function newPage(kind: "note" | "deck") {
    setOpen(false);
    const page = await createPage({ kind });
    if (page) router.push(`/p/${page.id}`);
  }

  return (
    <div className="pointer-events-none fixed bottom-3 right-4 z-40 flex flex-col items-end">
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
                <div className="font-display text-[15px] font-semibold">Hey{name ? ` ${name}` : ""}! Need a hand?</div>
                <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{TIPS[tip % TIPS.length]}</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label="Close">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid gap-0.5">
              <HelperAction icon={<FilePlus2 />} onClick={() => newPage("note")}>New note</HelperAction>
              <HelperAction icon={<MonitorPlay />} onClick={() => newPage("deck")}>New presentation</HelperAction>
              <HelperAction
                icon={<ListPlus />}
                onClick={() => {
                  setOpen(false);
                  router.push("/tasks?new=1");
                }}
              >
                Add homework or exam
              </HelperAction>
            </div>
            <button onClick={() => setTip((t) => t + 1)} className="mt-2 text-[12px] text-ink-3 hover:text-ink">
              Another tip →
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
            {speech}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto">
        <Blob
          ref={ref}
          size={68}
          mood={mood}
          title="Blob, your helper"
          onClick={() => {
            setOpen((o) => !o);
            setSpeech(null);
            setTip((t) => t + 1);
          }}
        />
      </div>
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
