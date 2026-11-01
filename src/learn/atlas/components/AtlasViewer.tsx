"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpenCheck, Check, Clock, GraduationCap, Layers, ListOrdered, Map as MapIcon, PartyPopper, Route, Tags, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Segmented } from "@/components/ui/Segmented";
import { useMessages } from "@/i18n/client";
import { atlasText } from "@/i18n/messages/atlas";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import { Ring } from "@/learn/components/Ring";
import { DAILY_GOAL, type LearnDay, type TopicProgress } from "@/learn/progress";
import { useStudySession, useTodayXp, useWide } from "@/learn/session";
import { cn } from "@/lib/utils";
import { ATLAS_AREAS, atlasHref, atlasKey, findAtlas } from "../catalog";
import { useAtlasModel } from "../models";
import { EXPLORE_XP } from "../quiz";
import { markSeen, useSeen } from "../seen";
import type { AtlasView, PartsView, StepsView, TimelineView } from "../types";
import { InfoCard, type InfoContent } from "./InfoCard";
import { Layout } from "./Layout";
import { PartsStage } from "./PartsStage";
import { Quiz } from "./Quiz";
import { StepsStage } from "./StepsStage";
import { TimelineStage } from "./TimelineStage";

/** Every item of a view as "<view>/<item>" keys (what "explored everything" counts). */
export const itemKeys = (v: AtlasView) =>
  v.kind === "parts" ? v.parts.map((p) => `${v.id}/${p.id}`) : v.kind === "steps" ? v.steps.map((_, i) => `${v.id}/${i}`) : v.events.map((e) => `${v.id}/${e.id}`);

/** The first item of a view, for views that always show one (steps, timeline). */
const firstItem = (v: AtlasView) => (v.kind === "steps" ? "0" : v.kind === "timeline" ? v.events[0].id : null);

export function AtlasViewer({
  slug,
  initialView,
  initialItem,
  progress,
  days,
}: {
  slug: string;
  initialView?: string;
  initialItem?: string;
  progress: TopicProgress;
  days: LearnDay[];
}) {
  const model = useAtlasModel(slug);
  const meta = findAtlas(slug)!;
  const t = useMessages(atlasText);
  const l = useMessages(learnText);
  const tt = useText();
  const { userId } = useWorkspace();
  const today = useTodayXp(days);
  const session = useStudySession({ topic: atlasKey(slug), mastery: progress.mastery, todayXp: today.xp });

  const [viewId, setViewId] = useState(() => (model.views.some((v) => v.id === initialView) ? initialView! : model.views[0].id));
  const view = model.views.find((v) => v.id === viewId) ?? model.views[0];
  const validItem = (v: AtlasView, item: string | undefined | null) =>
    item != null && (v.kind === "parts" ? v.parts.some((p) => p.id === item) : v.kind === "steps" ? Number(item) >= 0 && Number(item) < v.steps.length : v.events.some((e) => e.id === item));
  const [item, setItem] = useState<string | null>(() => {
    const v = model.views.find((x) => x.id === viewId)!;
    return validItem(v, initialItem) ? initialItem! : firstItem(v);
  });
  const [mode, setMode] = useState<"explore" | "quiz">("explore");
  const [labels, setLabels] = useState(true);
  const seenList = useSeen(slug);
  const seen = useMemo(() => new Set(seenList), [seenList]);
  const total = useMemo(() => model.views.flatMap(itemKeys), [model]);
  const seenCount = total.filter((k) => seen.has(k)).length;
  const [celebrate, setCelebrate] = useState(false);
  const awarded = useRef(progress.lesson_done);

  // The address follows the view and item, so a link or reload opens the same place.
  useEffect(() => {
    window.history.replaceState(null, "", atlasHref(slug, viewId === model.views[0].id ? undefined : viewId, item ?? undefined));
  }, [slug, viewId, item, model.views]);

  // Opening an item ticks it off; the last one of the model earns the explorer bonus once.
  useEffect(() => {
    if (mode !== "explore" || item == null) return;
    markSeen(userId, slug, `${view.id}/${item}`);
  }, [mode, item, view.id, slug, userId]);
  const { bonus } = session;
  useEffect(() => {
    if (awarded.current || seenCount < total.length || total.length === 0) return;
    awarded.current = true;
    bonus(EXPLORE_XP, { lesson: true });
    setCelebrate(true);
  }, [seenCount, total.length, bonus]);
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(false), 5200);
    return () => clearTimeout(id);
  }, [celebrate]);

  const chooseView = (id: string) => {
    const v = model.views.find((x) => x.id === id)!;
    setViewId(id);
    setItem(firstItem(v));
    if (v.kind === "timeline" || mode === "quiz") setMode("explore");
  };

  const kindIcon = (v: AtlasView) => (v.kind === "parts" ? <Tags className="size-3.5" /> : v.kind === "steps" ? <ListOrdered className="size-3.5" /> : <Route className="size-3.5" />);
  const viewSeen = (v: AtlasView) => {
    const keys = itemKeys(v);
    return keys.filter((k) => seen.has(k)).length / keys.length;
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: l.learn, href: "/learn", icon: <GraduationCap className="size-3.5" /> },
          { label: t.atlas, href: "/learn/atlas", icon: <MapIcon className="size-3.5" /> },
          { label: tt(meta.title) },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-2 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">
                <MapIcon className="size-3.5" /> {t.atlas} · {tt(ATLAS_AREAS[meta.area].title)}
              </div>
              <h1 className="mt-1 hyphens-auto font-display text-[28px] font-bold leading-tight tracking-[-0.02em] break-words sm:text-[32px]">{tt(meta.title)}</h1>
              <p className="mt-1 max-w-[640px] text-[14.5px] leading-relaxed text-ink-2">{tt(meta.subtitle)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised pl-2 pr-3.5 shadow-card" title={t.explored(seenCount, total.length)}>
                <Ring value={total.length ? seenCount / total.length : 0} size={34} stroke={4} color={seenCount === total.length ? "var(--ok)" : "var(--blob)"}>
                  {seenCount === total.length ? <Check className="size-3.5 text-ok" strokeWidth={3} /> : <Layers className="size-3.5 text-blob" />}
                </Ring>
                <div className="leading-tight">
                  <div className="text-[14px] font-semibold tabular-nums">
                    {seenCount}
                    <span className="font-normal text-ink-3"> / {total.length}</span>
                  </div>
                  <div className="text-[11.5px] text-ink-3">{t.seen}</div>
                </div>
              </div>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-raised pl-2 pr-3.5 shadow-card" title={l.dailyGoal}>
                <Ring value={session.todayXp / DAILY_GOAL} size={34} stroke={4}>
                  <BookOpenCheck className="size-3.5 text-blob" />
                </Ring>
                <div className="leading-tight">
                  <div className="text-[14px] font-semibold tabular-nums">
                    {session.todayXp}
                    <span className="font-normal text-ink-3"> / {DAILY_GOAL} XP</span>
                  </div>
                  <div className="text-[11.5px] text-ink-3">{l.dailyGoal}</div>
                </div>
              </div>
            </div>
          </header>

          {/* Views and mode. */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            {model.views.length > 1 ? (
              <nav className="-mx-1 flex min-w-0 max-w-full gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t.views_}>
                {model.views.map((v) => {
                  const on = v.id === view.id;
                  const share = viewSeen(v);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => chooseView(v.id)}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors",
                        on ? "border-ink bg-ink text-paper" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
                      )}
                    >
                      {kindIcon(v)}
                      {tt(v.title)}
                      {share === 1 && <Check className={cn("size-3.5", on ? "text-paper" : "text-ok")} strokeWidth={3} />}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {mode === "explore" && view.kind === "parts" && (
                <button
                  type="button"
                  onClick={() => setLabels((x) => !x)}
                  aria-pressed={labels}
                  title={labels ? t.labelsHide : t.labelsShow}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors [@media(hover:none)]:h-9",
                    labels ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink-2 hover:text-ink",
                  )}
                >
                  <Tags className="size-3.5" /> {t.labels}
                </button>
              )}
              <Segmented
                label={t.mode}
                value={mode}
                onChange={(m) => setMode(m)}
                options={[
                  { value: "explore", label: t.modeExplore },
                  { value: "quiz", label: t.modeQuiz },
                ]}
              />
            </div>
          </div>

          <div className="mt-4">
            {mode === "quiz" ? (
              <Quiz
                key={view.id}
                view={view}
                session={session}
                onExit={() => setMode("explore")}
                onLook={(id) => {
                  setMode("explore");
                  setItem(id);
                }}
              />
            ) : view.kind === "parts" ? (
              <ExploreParts key={view.id} view={view} item={item} setItem={setItem} labels={labels} seen={seen} onQuiz={() => setMode("quiz")} />
            ) : view.kind === "steps" ? (
              <ExploreSteps key={view.id} view={view} item={item} setItem={setItem} seen={seen} />
            ) : (
              <ExploreTimeline key={view.id} view={view} item={item} setItem={setItem} seen={seen} />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-raised p-4 shadow-pop"
            role="status"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ok text-white">
              <PartyPopper className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold">{t.exploredAll}</div>
              <div className="text-[13px] text-ink-2">{t.exploredAllText(EXPLORE_XP)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Walks a list with ← → (outside text fields), Escape clears. */
function useArrowKeys(onMove: (d: 1 | -1) => void, onEscape?: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onMove(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onMove(-1);
      } else if (e.key === "Escape" && onEscape) onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMove, onEscape]);
}

/** On phones the card sits below the picture: bring it into view when it changes, if it is out of sight. */
function useRevealBelow(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useWide();
  useEffect(() => {
    if (wide || dep == null) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight - 120) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [dep, wide]);
  return ref;
}

function ExploreParts({
  view,
  item,
  setItem,
  labels,
  seen,
  onQuiz,
}: {
  view: PartsView;
  item: string | null;
  setItem: (id: string | null) => void;
  labels: boolean;
  seen: Set<string>;
  onQuiz: () => void;
}) {
  const t = useMessages(atlasText);
  const tt = useText();
  const index = item ? view.parts.findIndex((p) => p.id === item) : -1;
  const part = index >= 0 ? view.parts[index] : null;
  const n = view.parts.length;
  const move = useCallback((d: 1 | -1) => setItem(view.parts[(((index < 0 ? (d === 1 ? -1 : 0) : index) + d) % n + n) % n].id), [index, n, setItem, view.parts]);
  useArrowKeys(move, () => setItem(null));
  const card = useRevealBelow(item);
  const seenHere = useMemo(() => new Set(view.parts.filter((p) => seen.has(`${view.id}/${p.id}`)).map((p) => p.id)), [seen, view]);

  const content: InfoContent | null = part
    ? {
        key: part.id,
        eyebrow: `${tt(view.title)} · ${t.of(index + 1, n)}`,
        title: part.info.name,
        aka: part.info.aka,
        tag: part.info.tag,
        leadLabel: t.role,
        lead: part.info.role,
        facts: part.info.facts,
        tip: part.info.tip,
      }
    : null;

  return (
    <Layout
      stage={<PartsStage view={view} selected={item} onPick={(id) => setItem(id === item ? null : id)} labels={labels} seen={seenHere} />}
      panel={
        <div ref={card} className="space-y-4 scroll-mt-3">
          {content ? (
            <InfoCard content={content} onPrev={() => move(-1)} onNext={() => move(1)} onClose={() => setItem(null)} />
          ) : (
            <IntroCard view={view} count={t.structures(n)} hint={t.tapHint} onStart={() => setItem(view.parts[0].id)} onQuiz={onQuiz} />
          )}
          <section className="rounded-2xl border border-line bg-raised p-3 shadow-card">
            <div className="flex items-baseline justify-between px-1.5 pb-2">
              <h3 className="text-[13px] font-semibold">{t.structuresList}</h3>
              <span className="text-[12px] tabular-nums text-ink-3">{t.explored(seenHere.size, n)}</span>
            </div>
            <ol className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {view.parts.map((p, i) => {
                const on = p.id === item;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setItem(on ? null : p.id)}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[13.5px] transition-colors", on ? "bg-blob-soft text-ink" : "text-ink-2 hover:bg-hover hover:text-ink")}
                    >
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold tabular-nums",
                          on ? "bg-blob text-white" : seenHere.has(p.id) ? "bg-blob/15 text-blob-ink" : "border border-line-2 text-ink-3",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tt(p.info.name)}</span>
                      {seenHere.has(p.id) && !on && <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      }
    />
  );
}

function IntroCard({ view, count, hint, onStart, onQuiz }: { view: AtlasView; count: string; hint: string; onStart: () => void; onQuiz: () => void }) {
  const t = useMessages(atlasText);
  const tt = useText();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-raised p-5 shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_80%_at_100%_0%,color-mix(in_oklab,var(--blob)_12%,transparent),transparent_60%)]" aria-hidden />
      <div className="relative">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-blob-ink">{count}</div>
        <h2 className="mt-1 font-display text-[22px] font-bold leading-tight tracking-[-0.015em]">{tt(view.title)}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{tt(view.intro)}</p>
        <p className="mt-2 text-[13px] text-ink-3">{hint}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-[background,transform] hover:bg-blob-deep active:scale-[0.97]"
          >
            <Route className="size-4" /> {t.startTour}
          </button>
          <button type="button" onClick={onQuiz} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-raised px-4 text-[14px] font-medium text-ink transition-colors hover:bg-hover">
            {t.startQuiz}
          </button>
        </div>
      </div>
    </section>
  );
}

function ExploreSteps({ view, item, setItem, seen }: { view: StepsView; item: string | null; setItem: (id: string | null) => void; seen: Set<string> }) {
  const t = useMessages(atlasText);
  const tt = useText();
  const step = Math.max(0, Math.min(view.steps.length - 1, Number(item ?? 0)));
  const s = view.steps[step];
  const n = view.steps.length;
  const go = useCallback((i: number) => setItem(String(Math.max(0, Math.min(n - 1, i)))), [n, setItem]);
  useArrowKeys(useCallback((d: 1 | -1) => go(step + d), [go, step]));
  const seenHere = useMemo(() => new Set(view.steps.map((_, i) => String(i)).filter((i) => seen.has(`${view.id}/${i}`))), [seen, view]);
  const content: InfoContent = {
    key: String(step),
    eyebrow: `${tt(view.title)} · ${t.step(step + 1, n)}`,
    title: s.title,
    chips: s.time ? [{ icon: <Clock className="size-3" />, label: s.time }] : undefined,
    leadLabel: t.whatHappens,
    lead: s.body,
    facts: s.facts,
    tip: s.tip,
  };
  return (
    <Layout
      stage={<StepsStage view={view} step={step} onStep={go} seen={seenHere} />}
      panel={
        <div className="space-y-4">
          <InfoCard content={content} onPrev={step > 0 ? () => go(step - 1) : undefined} onNext={step < n - 1 ? () => go(step + 1) : undefined} />
          <p className="px-1 text-[12.5px] leading-relaxed text-ink-3">{tt(view.intro)}</p>
        </div>
      }
    />
  );
}

function ExploreTimeline({ view, item, setItem, seen }: { view: TimelineView; item: string | null; setItem: (id: string | null) => void; seen: Set<string> }) {
  const t = useMessages(atlasText);
  const tt = useText();
  const wide = useWide();
  const index = Math.max(0, view.events.findIndex((e) => e.id === item));
  const e = view.events[index];
  const n = view.events.length;
  const go = useCallback((i: number) => setItem(view.events[Math.max(0, Math.min(n - 1, i))].id), [n, setItem, view.events]);
  useArrowKeys(useCallback((d: 1 | -1) => go(index + d), [go, index]));
  const seenHere = useMemo(() => new Set(view.events.map((x) => x.id).filter((id) => seen.has(`${view.id}/${id}`))), [seen, view]);
  const content: InfoContent = {
    key: e.id,
    eyebrow: `${e.when ? tt(e.when) : e.year} · ${t.of(index + 1, n)}`,
    title: e.title,
    chips: [{ icon: <User className="size-3" />, label: e.who }],
    leadLabel: t.whatHappens,
    lead: e.body,
    facts: e.facts,
    tip: e.tip,
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
      <div className="min-w-0">
        <p className="mb-4 max-w-[640px] text-[14px] leading-relaxed text-ink-2">{tt(view.intro)}</p>
        <TimelineStage
          view={view}
          selected={e.id}
          onPick={(id) => setItem(id)}
          seen={seenHere}
          detail={wide ? undefined : <InfoCard content={{ ...content, eyebrow: t.of(index + 1, n) }} onPrev={index > 0 ? () => go(index - 1) : undefined} onNext={index < n - 1 ? () => go(index + 1) : undefined} />}
        />
      </div>
      {wide && (
        <div className="sticky top-3">
          <InfoCard content={content} onPrev={index > 0 ? () => go(index - 1) : undefined} onNext={index < n - 1 ? () => go(index + 1) : undefined} />
        </div>
      )}
    </div>
  );
}
