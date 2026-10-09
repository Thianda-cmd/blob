"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Focus, GraduationCap, Hash, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Blob } from "@/components/blob/Blob";
import { PageIcon } from "@/components/shell/Sidebar";
import { useLocale, useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";
import { CATALOG, topicHref } from "@/learn/catalog";
import { bounds, buildGraph, dragTo, pin, settle, type Graph, type GNode } from "@/notes/graph";
import { subjectColor } from "@/lib/subjects";
import type { PageMeta, Subject } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

type Transform = { x: number; y: number; k: number };

const MIN_K = 0.15;
const MAX_K = 4;

/** The knowledge graph: notes joined by links, sub-pages, shared tags and learning topics. */
export function NotesGraph({
  pages,
  links,
  subjects,
  topicLabel,
}: {
  pages: PageMeta[];
  links: Record<string, string[]>;
  subjects: Subject[];
  topicLabel: (slug: string) => string;
}) {
  const t = useMessages(notesText).graph;
  const locale = useLocale();
  const router = useRouter();
  const [showTags, setShowTags] = useState(true);
  const [showTopics, setShowTopics] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [, setFrame] = useState(0);
  const touch = useSyncExternalStore(subscribeTouch, () => window.matchMedia("(hover: none)").matches, () => false);

  // Notes and presentations (folders only hold pages): the layout settles once, right here.
  const graph: Graph = useMemo(() => {
    const g = buildGraph(
      pages
        .filter((p) => p.kind === "note" || p.kind === "deck")
        .map((p) => ({ id: p.id, title: pageTitle(p.title, p.kind, locale), kind: p.kind, subject_id: p.subject_id, parent_id: p.parent_id, tags: p.tags, topics: p.topics, links: links[p.id] ?? [] })),
      { tags: showTags, topics: showTopics, topicLabel },
    );
    settle(g, Math.min(320, 120 + g.nodes.length));
    return g;
  }, [pages, links, showTags, showTopics, topicLabel, locale]);

  const neighbors = useMemo(() => {
    const out = graph.nodes.map(() => new Set<number>());
    for (const e of graph.edges) {
      out[e.a].add(e.b);
      out[e.b].add(e.a);
    }
    return out;
  }, [graph]);

  // The view follows the screen (fitted) until you zoom or pan; a new graph starts fitted again.
  const [manual, setManual] = useState<Transform | null>(null);
  const [seen, setSeen] = useState(graph);
  if (seen !== graph) {
    setSeen(graph);
    setManual(null);
  }
  const view = manual ?? fitted(graph, size);
  const fit = () => setManual(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setManual((m) => {
        const v = m ?? fitted(graph, size);
        const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
        const f = k / v.k;
        return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
      });
    },
    [graph, size],
  );

  // Wheel zoom around the pointer (a non-passive listener, so the page doesn't scroll instead).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Dragging: a node (it pulls its neighbours along), the background (pan) or two fingers (pinch).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ node: number | null; startX: number; startY: number; moved: boolean; pinch?: number } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent, node: number | null) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { node: null, startX: 0, startY: 0, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    const p = local(e);
    drag.current = { node, startX: p.x, startY: p.y, moved: false };
    if (node !== null) pin(graph, node, true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    const prev = pointers.current.get(e.pointerId)!;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (d.pinch !== undefined && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(dist / d.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      d.pinch = dist;
      return;
    }
    if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) < 4) return;
    d.moved = true;
    if (d.node !== null) {
      dragTo(graph, d.node, (p.x - view.x) / view.k, (p.y - view.y) / view.k);
      setFrame((f) => f + 1);
    } else {
      setManual((m) => {
        const v = m ?? fitted(graph, size);
        return { ...v, x: v.x + p.x - prev.x, y: v.y + p.y - prev.y };
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (!d) return;
    if (d.node !== null) pin(graph, d.node, false);
    if (pointers.current.size === 0) drag.current = null;
    if (d.moved || d.pinch !== undefined) return;
    if (d.node === null) {
      setSelected(null);
      return;
    }
    // Mouse: a click opens. Touch: the first tap shows what it is, the card has "Öffnen".
    if (e.pointerType === "mouse") open(graph.nodes[d.node]);
    else setSelected(d.node);
  };

  const open = (n: GNode) => {
    if (n.kind === "page") router.push(`/p/${n.id}`);
    else if (n.kind === "tag") router.push(`/notes?tag=${encodeURIComponent(n.label.slice(1))}`);
    else {
      const meta = CATALOG.find((c) => c.slug === n.id.slice(6));
      if (meta) router.push(topicHref(meta));
    }
  };

  const focus = hover ?? selected;
  // Nodes keep a size you can see and tap, however far you zoom out.
  const r = (n: GNode) => Math.max(n.r, (n.kind === "page" ? 4.5 : 3.5) / view.k);
  const lit = focus !== null ? new Set([focus, ...neighbors[focus]]) : null;
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));
  const nodeColor = (n: GNode) => {
    if (n.kind === "tag") return "var(--blob)";
    if (n.kind === "topic") return "var(--ok)";
    const s = n.subjectId ? subjectOf.get(n.subjectId) : undefined;
    return s ? subjectColor(s.color) : "var(--ink-3)";
  };
  // Labels that fit: the focused node and its neighbours first, then hubs and well-connected notes;
  // a label that would overlap one already placed waits until you zoom in.
  const labels = new Set<number>();
  {
    const order = graph.nodes
      .map((n, i) => ({ n, i, rank: (lit?.has(i) ? 1000 : 0) + (i === focus ? 1000 : 0) + (n.kind !== "page" ? 50 : 0) + n.degree }))
      .filter(({ i }) => !lit || lit.has(i))
      .sort((a, b) => b.rank - a.rank);
    const boxes: [number, number, number, number][] = [];
    for (const { n, i } of order) {
      const text = n.label.length > 28 ? 28 : n.label.length;
      const w = text * 6.6 + 6;
      const x = n.x * view.k + view.x;
      const y = (n.y + r(n)) * view.k + view.y + 4;
      const box: [number, number, number, number] = [x - w / 2, y, x + w / 2, y + 15];
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box);
      labels.add(i);
    }
  }
  const showLabel = (_n: GNode, i: number) => labels.has(i);
  const card = focus !== null ? graph.nodes[focus] : null;
  const cardPage = card?.kind === "page" ? pages.find((p) => p.id === card.id) : undefined;

  if (!graph.nodes.length || !graph.edges.length) {
    return (
      <div className="mt-2 flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-14 text-center">
        <Blob size={104} mood="thinking" track={false} />
        <h2 className="mt-2 font-display text-[19px] font-semibold tracking-[-0.015em]">{t.emptyTitle}</h2>
        <p className="mt-1 max-w-[420px] text-[13.5px] text-ink-2">{t.emptyText}</p>
      </div>
    );
  }

  return (
    <div
      ref={wrap}
      className="relative mt-2 h-[calc(100dvh-19rem)] min-h-[420px] touch-none select-none overflow-hidden rounded-2xl border border-line bg-raised shadow-card"
      onPointerDown={(e) => onPointerDown(e, null)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-40" />
      <svg width={size.w} height={size.h} className="relative block" role="img" aria-label={t.label}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.edges.map((e, i) => {
            const a = graph.nodes[e.a];
            const b = graph.nodes[e.b];
            const on = lit ? lit.has(e.a) && lit.has(e.b) && (e.a === focus || e.b === focus) : false;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={on ? (e.kind === "link" ? "var(--blob)" : "var(--ink-3)") : "var(--line-2)"}
                strokeWidth={(e.kind === "link" ? 1.6 : 1.2) / view.k}
                strokeDasharray={e.kind === "child" ? `${5 / view.k} ${4 / view.k}` : e.kind === "tag" || e.kind === "topic" ? `${1.5 / view.k} ${4 / view.k}` : undefined}
                strokeLinecap="round"
                opacity={lit && !on ? 0.25 : 1}
                className="transition-[opacity,stroke] duration-150"
              />
            );
          })}
          {graph.nodes.map((n, i) => {
            const dim = lit && !lit.has(i);
            const label = showLabel(n, i);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.22 : 1}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
                onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              >
                {/* A bigger invisible target, so small nodes are easy to hit with a finger. */}
                <circle r={Math.max(r(n), 16 / view.k)} fill="transparent" />
                {n.kind === "page" ? (
                  <circle r={r(n)} fill={nodeColor(n)} stroke="var(--raised)" strokeWidth={1.5 / view.k} />
                ) : (
                  <>
                    <circle r={r(n) + 2 / view.k} fill="var(--raised)" stroke={nodeColor(n)} strokeWidth={1.8 / view.k} />
                    {/* A tag or a learning topic: its symbol inside the ring. */}
                    {n.kind === "tag" ? (
                      <Hash x={-r(n) * 0.75} y={-r(n) * 0.75} width={r(n) * 1.5} height={r(n) * 1.5} color={nodeColor(n)} strokeWidth={2.4} className="pointer-events-none" />
                    ) : (
                      <GraduationCap x={-r(n) * 0.75} y={-r(n) * 0.75} width={r(n) * 1.5} height={r(n) * 1.5} color={nodeColor(n)} strokeWidth={2.4} className="pointer-events-none" />
                    )}
                  </>
                )}
                {focus === i && <circle r={r(n) + 5 / view.k} fill="none" stroke={nodeColor(n)} strokeWidth={1.5 / view.k} opacity={0.5} />}
                {label && (
                  <text
                    y={r(n) + 13 / view.k}
                    textAnchor="middle"
                    fontSize={12 / view.k}
                    fill={n.kind === "page" ? "var(--ink-2)" : nodeColor(n)}
                    fontWeight={focus === i || n.kind !== "page" ? 600 : 450}
                    paintOrder="stroke"
                    stroke="var(--raised)"
                    strokeWidth={3.5 / view.k}
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  >
                    {n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
        <Toggle on={showTags} onClick={() => setShowTags((v) => !v)} icon={<Hash />} label={t.tags} />
        <Toggle on={showTopics} onClick={() => setShowTopics((v) => !v)} icon={<GraduationCap />} label={t.topics} />
        <div className="flex rounded-lg border border-line bg-raised shadow-card">
          <IconBtn label={t.zoomOut} onClick={() => zoomAt(1 / 1.3, size.w / 2, size.h / 2)}>
            <Minus />
          </IconBtn>
          <IconBtn label={t.zoomIn} onClick={() => zoomAt(1.3, size.w / 2, size.h / 2)}>
            <Plus />
          </IconBtn>
          <IconBtn label={t.fit} onClick={fit}>
            <Focus />
          </IconBtn>
        </div>
      </div>

      {/* Legend and hint */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex flex-wrap items-end justify-between gap-2 text-[11px] text-ink-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-raised/85 px-2 py-1 backdrop-blur-sm">
          <Legend dash={undefined} label={t.legendLink} />
          <Legend dash="4 3" label={t.legendChild} />
          {showTags && <Legend dash="1.5 3" label={t.legendTag} color="var(--blob)" />}
          {showTopics && <Legend dash="1.5 3" label={t.legendTopic} color="var(--ok)" />}
        </div>
        <span className="rounded-lg bg-raised/85 px-2 py-1 backdrop-blur-sm max-sm:hidden">{touch ? t.hintTouch : t.hint}</span>
      </div>

      {/* What's under the pointer (or tapped) */}
      <AnimatePresence>
        {card && (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
            className="absolute left-2.5 top-2.5 w-[min(300px,calc(100%-1.25rem))] rounded-xl border border-line bg-raised/95 p-3 shadow-pop backdrop-blur-sm max-sm:top-14"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center gap-2">
              {cardPage ? <PageIcon page={cardPage} /> : card.kind === "tag" ? <Hash className="size-4 text-blob-ink" /> : <GraduationCap className="size-4 text-ok" />}
              <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{card.label}</span>
            </div>
            <div className="mt-1 text-[12px] text-ink-3">{t.connections(neighbors[graph.index.get(card.id)!].size)}</div>
            {(touch || selected !== null) && (
              <button
                onClick={() => open(card)}
                className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-ink text-[13px] font-medium text-paper hover:bg-ink/88"
              >
                {card.kind === "page" ? t.open : card.kind === "tag" ? t.showNotes : t.openTopic} <ArrowUpRight className="size-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The whole graph in the middle of the screen. */
function fitted(graph: Graph, size: { w: number; h: number }): Transform {
  const b = bounds(graph);
  const pad = 48;
  const k = Math.max(MIN_K, Math.min(1.6, Math.min((size.w - pad * 2) / Math.max(1, b.maxX - b.minX), (size.h - pad * 2) / Math.max(1, b.maxY - b.minY))));
  return { k, x: size.w / 2 - ((b.minX + b.maxX) / 2) * k, y: size.h / 2 - ((b.minY + b.maxY) / 2) * k };
}

function subscribeTouch(onChange: () => void) {
  const query = window.matchMedia("(hover: none)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-card transition-colors [&_svg]:size-3.5 [@media(hover:none)]:h-9",
        on ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink-3 hover:text-ink",
      )}
    >
      {icon}
      <span className="max-sm:sr-only">{label}</span>
    </button>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-8 place-items-center text-ink-3 transition-colors hover:text-ink [&_svg]:size-4 [@media(hover:none)]:size-9">
      {children}
    </button>
  );
}

function Legend({ dash, label, color = "var(--ink-3)" }: { dash?: string; label: string; color?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="1.5" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
