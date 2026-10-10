"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Dices, Lock, Shirt } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { blobCornerText } from "@/i18n/messages/blobCorner";
import { cn } from "@/lib/utils";
import { Blob, type BlobHandle, type BlobMood } from "./Blob";
import { blob } from "./bus";
import { cleanLook, type BlobEyes, type BlobHat, type BlobLook, type BlobNeck, type BlobSkin } from "./look";
import { itemProgress, WARDROBE, type BlobStats, type Slot, type WardrobeItem } from "./wardrobe";

const SLOTS: Slot[] = ["hat", "eyes", "neck", "skin"];
const TRICKS = [
  ["wave", "👋"],
  ["jump", "⤴️"],
  ["spin", "🌀"],
  ["dance", "💃"],
  ["nod", "🙂"],
  ["wink", "😉"],
  ["sneeze", "🤧"],
  ["yawn", "🥱"],
  ["celebrate", "🎉"],
] as const;
const FACES: BlobMood[] = ["happy", "excited", "love", "silly", "proud", "laughing", "surprised", "thinking", "shy", "worried", "sleepy", "dizzy"];

type Trick = (typeof TRICKS)[number][0];

/** Play with Blob, teach him tricks and dress him up; learning unlocks the wardrobe. */
export function BlobCorner({ stats, month }: { stats: BlobStats; month: number }) {
  const t = useMessages(blobCornerText);
  const { profile, setProfile } = useWorkspace();
  const look = useMemo(() => cleanLook(profile.blob_look), [profile.blob_look]);
  const secrets = useMemo(() => look.secrets ?? [], [look]);
  const stage = useRef<BlobHandle>(null);
  const [mood, setMood] = useState<BlobMood | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [tab, setTab] = useState<Slot>("hat");
  const [failed, setFailed] = useState(false);
  const lineNo = useRef(0);
  const timers = useRef<{ line?: ReturnType<typeof setTimeout>; mood?: ReturnType<typeof setTimeout> }>({});

  function say(text: string, ms = 3400) {
    clearTimeout(timers.current.line);
    setLine(text);
    timers.current.line = setTimeout(() => setLine(null), ms);
  }
  function face(m: BlobMood, ms = 2600) {
    clearTimeout(timers.current.mood);
    setMood(m);
    timers.current.mood = setTimeout(() => setMood(null), ms);
  }
  function trick(name: Trick) {
    const b = stage.current;
    if (!b) return;
    if (name === "jump") b.jump(1.1);
    else if (name === "dance") b.dance(3200);
    else b[name]();
  }

  useEffect(() => {
    const t0 = timers.current;
    return () => {
      clearTimeout(t0.line);
      clearTimeout(t0.mood);
    };
  }, []);

  // The corner helper is hidden here: its news (a secret found) plays on the stage instead.
  useEffect(
    () =>
      blob.subscribe((e) => {
        if (e.type === "say") say(e.text, 4200);
        if (e.type === "react" && e.reaction !== "poke" && e.reaction !== "squish" && e.reaction !== "shake") trick(e.reaction);
        if (e.type !== "mood" && e.mood) face(e.mood, e.ms ?? 2600);
      }),
    [],
  );

  const items = WARDROBE.map((item) => ({ item, ...itemProgress(item, stats, secrets, month) }));
  const openCount = items.filter((i) => i.open).length;
  const worn = (item: WardrobeItem) => (item.slot === "skin" ? (look.skin ?? "classic") === item.id : look[item.slot] === item.id);

  async function save(next: BlobLook) {
    setFailed(false);
    const ok = await setProfile({ blob_look: next });
    if (!ok) setFailed(true);
  }

  function toggle(item: WardrobeItem) {
    const on = worn(item);
    const next: BlobLook = { ...look, [item.slot]: on ? (item.slot === "skin" ? "classic" : null) : item.id };
    // Seasonal things stay in the wardrobe once worn.
    if (!on && item.need.kind === "month" && !secrets.includes(item.id)) next.secrets = [...secrets, item.id];
    if (on) stage.current?.squish(0.8);
    else if (item.slot === "skin") stage.current?.spin();
    else stage.current?.jump(0.9);
    face(on ? "surprised" : "happy", 1200);
    void save(next);
  }

  function surprise() {
    const pick = (slot: Slot, chance: number) => {
      const open = items.filter((i) => i.open && i.item.slot === slot && i.item.id !== "classic");
      return open.length && Math.random() < chance ? open[Math.floor(Math.random() * open.length)].item.id : null;
    };
    const next: BlobLook = {
      hat: pick("hat", 0.9) as BlobHat | null,
      eyes: pick("eyes", 0.45) as BlobEyes | null,
      neck: pick("neck", 0.5) as BlobNeck | null,
      skin: (pick("skin", 0.7) as BlobSkin | null) ?? "classic",
      secrets,
    };
    stage.current?.spin();
    face("excited", 1500);
    void save(next);
  }

  function undress() {
    stage.current?.shake();
    face("shy", 1600);
    void save({ secrets });
  }

  const tabItems = items.filter((i) => i.item.slot === tab);

  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <BlobMark size={14} /> }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1040px] px-5 pb-20 pt-4 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-[560px]">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <BlobMark size={14} /> {t.kicker}
              </div>
              <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{t.title}</h1>
              <p className="mt-1.5 text-[14.5px] text-ink-2">{t.intro}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [t.stats.xp, stats.xp],
                  [t.stats.lessons, stats.lessons],
                  [t.stats.streak, stats.bestStreak],
                  [t.stats.days, stats.activeDays],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-raised px-3 py-1.5 shadow-card">
                  <div className="text-[16px] font-bold tabular-nums">{value}</div>
                  <div className="text-[11.5px] text-ink-3">{label}</div>
                </div>
              ))}
            </div>
          </header>

          {/* The stage: Blob in his little room. */}
          <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-raised shadow-card">
            <div className="relative h-[300px] sm:h-[340px]" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--blob) 16%, var(--raised)) 0%, var(--raised) 78%)" }}>
              <div className="bg-dots absolute inset-0 opacity-40" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 h-16 border-t border-line bg-surface" aria-hidden />
              <div className="absolute bottom-6 left-1/2 h-10 w-[300px] max-w-[80%] -translate-x-1/2 rounded-[50%] bg-blob-soft" aria-hidden />
              <AnimatePresence>
                {line && (
                  <motion.div
                    key={line}
                    initial={{ opacity: 0, y: 8, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                    className="absolute left-1/2 top-4 z-10 max-w-[min(420px,86%)] -translate-x-1/2 rounded-2xl border border-line bg-raised px-4 py-2.5 text-center text-[14.5px] font-medium text-ink shadow-pop"
                    role="status"
                    aria-live="polite"
                  >
                    {line}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
                <Blob
                  ref={stage}
                  size={220}
                  mood={mood ?? "happy"}
                  className="max-sm:size-[180px]"
                  title={t.tapMe}
                  onClick={() => {
                    say(t.lines[lineNo.current++ % t.lines.length]);
                    face((["happy", "excited", "love", "silly", "laughing"] as const)[lineNo.current % 5], 1800);
                  }}
                />
              </div>
            </div>
            <div className="space-y-3 border-t border-line p-4 sm:p-5">
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.tricksTitle}</h2>
                <div className="flex flex-wrap gap-2">
                  {TRICKS.map(([name, emoji]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => trick(name)}
                      className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-paper px-3 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:bg-hover hover:text-ink active:translate-y-px"
                    >
                      <span aria-hidden>{emoji}</span> {t.tricks[name]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.facesTitle}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {FACES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => face(m, 3000)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
                        mood === m ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-paper text-ink-2 hover:bg-hover hover:text-ink",
                      )}
                    >
                      {t.moods[m as keyof typeof t.moods]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* The wardrobe. */}
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-[22px] font-semibold">
                  <Shirt className="size-5 text-blob-ink" /> {t.wardrobe}
                </h2>
                <p className="mt-0.5 text-[13.5px] text-ink-3">{t.unlocked(openCount, items.length)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={surprise} className="flex h-9 items-center gap-1.5 rounded-xl bg-blob px-3.5 text-[13.5px] font-semibold text-white shadow-[0_3px_0_var(--blob-deep)] active:translate-y-px active:shadow-none">
                  <Dices className="size-4" /> {t.surprise}
                </button>
                <button type="button" onClick={undress} className="h-9 rounded-xl border border-line bg-raised px-3.5 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                  {t.undress}
                </button>
              </div>
            </div>
            {failed && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[13.5px] text-danger">{t.saveError}</p>}

            <div className="mt-4 flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 [scrollbar-width:none]" role="tablist">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  role="tab"
                  aria-selected={tab === slot}
                  onClick={() => setTab(slot)}
                  className={cn("h-9 flex-1 shrink-0 whitespace-nowrap rounded-lg px-4 text-[13.5px] font-medium", tab === slot ? "bg-raised text-ink shadow-card" : "text-ink-2 hover:text-ink")}
                >
                  {t.tabs[slot]} <span className="ml-1 text-[12px] text-ink-3">{items.filter((i) => i.item.slot === slot && i.open).length}/{items.filter((i) => i.item.slot === slot).length}</span>
                </button>
              ))}
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {tabItems.map(({ item, open, have, goal }) => {
                const on = worn(item);
                const need = item.need;
                const needText =
                  need.kind === "free"
                    ? t.need.free
                    : need.kind === "chef" || need.kind === "secret"
                      ? t.need[need.kind]
                      : need.kind === "month"
                        ? t.need.month(need.month)
                        : t.need[need.kind](need.n);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!open}
                      onClick={() => toggle(item)}
                      aria-pressed={on}
                      className={cn(
                        "flex h-full w-full flex-col items-center rounded-2xl border-2 px-3 pb-3 pt-2 text-center transition-[border-color,transform]",
                        on ? "border-blob bg-blob-soft" : open ? "border-line bg-raised hover:-translate-y-0.5 hover:border-line-2" : "cursor-default border-dashed border-line-2 bg-surface",
                      )}
                    >
                      <div className={cn("relative", !open && "opacity-55 grayscale")}>
                        <Blob size={88} interactive={false} track={false} arms={false} mood={on ? "happy" : "idle"} wear={{ [item.slot]: item.id }} />
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[13.5px] font-semibold text-ink">
                        {!open && <Lock className="size-3.5 text-ink-3" />}
                        {t.items[item.id] ?? item.id}
                      </div>
                      {on ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blob px-2 py-0.5 text-[11.5px] font-semibold text-white">
                          <Check className="size-3" strokeWidth={3} /> {t.wearing}
                        </span>
                      ) : open ? (
                        <span className="mt-1 text-[12px] text-ink-3">{t.putOn}</span>
                      ) : (
                        <span className="mt-1 w-full text-[11.5px] leading-snug text-ink-3">
                          {needText}
                          {goal > 1 && (
                            <span className="mx-auto mt-1.5 block h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-line">
                              <span className="block h-full rounded-full bg-blob" style={{ width: `${Math.round((have / goal) * 100)}%` }} />
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {!secrets.includes("disco") && (
              <p className="mt-6 rounded-2xl border border-dashed border-line-2 px-4 py-3 text-[13px] text-ink-3">
                <span aria-hidden>🤫 </span>
                {t.secretHint}
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
