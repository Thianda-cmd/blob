"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Blob, type BlobHandle, type BlobMood } from "./Blob";

const KEY = "blob-booted";
const MESSAGES = ["Waking up Blob", "Gathering your notes", "Sharpening pencils", "Almost there"];

function subscribe() {
  return () => {};
}
function shouldBoot() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return !sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Forget the boot flag so the intro plays again (e.g. after signing out). */
export function resetBoot() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/**
 * The intro played once per browser session when the app opens:
 * jelly droplets rain down and merge into Blob (inside the Blob component, so the
 * shape never swaps), Blob wakes up and waves, then floods the screen and opens
 * a hole onto the workspace.
 */
export function BlobBoot({ ready = true, greeting }: { ready?: boolean; greeting?: string }) {
  // Server and hydration render the overlay (an inline script hides it when already booted).
  const wanted = useSyncExternalStore(subscribe, shouldBoot, () => true);
  const [done, setDone] = useState(false);
  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setDone(true);
  }, []);

  if (!wanted || done) return null;
  return <BootSequence ready={ready} greeting={greeting} onDone={finish} />;
}

function BootSequence({ ready, greeting, onDone }: { ready: boolean; greeting?: string; onDone: () => void }) {
  const [scope, animate] = useAnimate();
  const blobRef = useRef<BlobHandle>(null);
  const [phase, setPhase] = useState<"rain" | "alive" | "exit">("rain");
  const [mood, setMood] = useState<BlobMood>("sleepy");
  const [message, setMessage] = useState(0);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const skipped = useRef(false);

  // The droplets merge into Blob inside the Blob component itself, so there is no swap:
  // when it's whole, it wakes up, hops and waves.
  const formed = useCallback(() => {
    setPhase("alive");
    setMood("happy");
    blobRef.current?.jump(0.8);
    setTimeout(() => blobRef.current?.wave(), 450);
    setTimeout(() => setMinTimePassed(true), 900);
  }, []);

  // Cycle the status line while we wait.
  useEffect(() => {
    if (phase === "exit") return;
    const t = setInterval(() => setMessage((m) => Math.min(m + 1, MESSAGES.length - 1)), 1100);
    return () => clearInterval(t);
  }, [phase]);

  // Leave once the app is ready.
  const exiting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!(ready && minTimePassed) || exiting.current) return;
    exiting.current = true;
    (async () => {
      setMood("excited");
      blobRef.current?.jump(1.1);
      await new Promise((r) => setTimeout(r, 420));
      if (!mounted.current || skipped.current) return;
      setPhase("exit");
      const cover = Math.hypot(window.innerWidth, window.innerHeight) * 2.2;
      await animate("[data-flood]", { width: [0, cover], height: [0, cover] }, { duration: 0.46, ease: [0.7, 0, 0.84, 0] });
      if (!mounted.current || skipped.current) return;
      await animate(scope.current, { "--hole": ["0px", `${cover / 2}px`] }, { duration: 0.62, ease: [0.16, 1, 0.3, 1] });
      if (mounted.current && !skipped.current) onDone();
    })();
  }, [ready, minTimePassed, animate, scope, onDone]);

  // Any key or click skips the intro.
  useEffect(() => {
    const skip = () => {
      if (skipped.current) return;
      skipped.current = true;
      animate(scope.current, { opacity: 0 }, { duration: 0.25 }).then(onDone);
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [animate, scope, onDone]);

  return (
    <div
      ref={scope}
      className="blob-boot fixed inset-0 z-[100] grid place-items-center bg-paper"
      style={
        {
          "--hole": "0px",
          WebkitMaskImage: "radial-gradient(circle at 50% 46%, transparent var(--hole), #000 calc(var(--hole) + 1px))",
          maskImage: "radial-gradient(circle at 50% 46%, transparent var(--hole), #000 calc(var(--hole) + 1px))",
        } as React.CSSProperties
      }
      aria-busy="true"
      aria-label="Opening Blob"
    >
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative flex flex-col items-center" style={{ marginTop: "-8vh" }}>
        <div className="relative h-[260px] w-[400px]">
          {/* Blob forms out of falling droplets, wakes up and says hi */}
          <div className="absolute left-1/2 top-[34px] -translate-x-1/2">
            <Blob ref={blobRef} size={200} mood={mood} intro onFormed={formed} interactive={false} />
          </div>

          {/* Flood circle used for the exit */}
          <div className="pointer-events-none absolute left-1/2 top-[150px] z-10">
            <div data-flood className="rounded-full bg-blob" style={{ width: 0, height: 0, transform: "translate(-50%, -50%)", position: "absolute" }} />
          </div>
        </div>

        <motion.div
          className="font-display text-[44px] font-bold leading-none tracking-[-0.04em] text-ink"
          initial="hidden"
          animate={phase === "rain" ? "hidden" : "shown"}
          variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
          aria-hidden
        >
          {"Blob".split("").map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              variants={{
                hidden: { y: 18, opacity: 0, scaleY: 0.6 },
                shown: { y: 0, opacity: 1, scaleY: 1, transition: { type: "spring", stiffness: 520, damping: 14 } },
              }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>

        <div className="mt-3 h-5 text-[13px] text-ink-3">
          <AnimatePresence mode="wait">
            <motion.span
              key={greeting && phase !== "rain" ? "greeting" : message}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="block"
            >
              {greeting && phase !== "rain" ? greeting : `${MESSAGES[message]}…`}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
