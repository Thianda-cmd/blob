"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type KeyboardEvent } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import {
  CHARACTERS,
  GROUPS,
  LEAVES,
  PHYLY,
  TREES,
  ageText,
  carriers,
  isLeaf,
  lca,
  leavesOf,
  nodesOf,
  type CharacterId,
  type LeafId,
  type TreeId,
  type TreeNode,
} from "@/learn/biology/topics/evolution/data";
import { cn } from "@/lib/utils";

// Family trees (Stammbäume) and the vertebrate cladogram: lines from the root on the left to
// today's species on the right. Where two lines meet lies their last common ancestor.

const sans = { fontFamily: "var(--font-sans)" };
const W = 480;
const X_ROOT = 46;
const X_LEAF = 322;
const Y0 = 28;
const ROW = 40;

type P = { x: number; y: number };
type Layout = { pos: Record<string, P>; parent: Record<string, string | null>; height: number; timed: boolean; maxAge: number };

const keyOf = (n: TreeNode | LeafId) => (isLeaf(n) ? n : n.id);

function layoutTree(root: TreeNode, timed: boolean): Layout {
  const pos: Record<string, P> = {};
  const parent: Record<string, string | null> = { [root.id]: null };
  const leaves = leavesOf(root);
  leaves.forEach((l, i) => (pos[l] = { x: X_LEAF, y: Y0 + i * ROW }));
  const h = (n: TreeNode | LeafId): number => (isLeaf(n) ? 0 : 1 + Math.max(...n.kids.map(h)));
  const total = h(root);
  const maxAge = root.age ?? 1;
  const place = (n: TreeNode) => {
    n.kids.forEach((k) => {
      parent[keyOf(k)] = n.id;
      if (!isLeaf(k)) place(k);
    });
    const ys = n.kids.map((k) => pos[keyOf(k)].y);
    const x = timed && n.age !== undefined ? X_LEAF - ((X_LEAF - X_ROOT) * n.age) / maxAge : X_LEAF - ((X_LEAF - X_ROOT) * h(n)) / total;
    pos[n.id] = { x, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  };
  place(root);
  return { pos, parent, height: Y0 + (leaves.length - 1) * ROW + (timed ? 58 : 26), timed, maxAge };
}

/** All ids on the way from a node down to some leaves (nodes and leaves). */
function below(root: TreeNode, id: string): Set<string> {
  const node = nodesOf(root).find((n) => n.id === id);
  if (!node) return new Set([id]);
  const out = new Set<string>([id]);
  const walk = (n: TreeNode) =>
    n.kids.forEach((k) => {
      out.add(keyOf(k));
      if (!isLeaf(k)) walk(k);
    });
  walk(node);
  return out;
}

/** The ids on the path from `from` (an ancestor) down to a leaf, without `from` itself. */
function pathDown(layout: Layout, from: string, leaf: string): string[] {
  const out: string[] = [];
  let cur: string | null = leaf;
  while (cur && cur !== from) {
    out.push(cur);
    cur = layout.parent[cur] ?? null;
  }
  return out;
}

/** The lines and labels of a tree. `lit`: ids whose incoming branch is highlighted. */
function TreeLines({
  root,
  layout,
  lit,
  litLeaves,
  dot,
  stemLit,
  onLeaf,
  marks,
}: {
  root: TreeNode;
  layout: Layout;
  lit?: Set<string>;
  litLeaves?: Set<string>;
  dot?: string | null;
  stemLit?: boolean;
  onLeaf?: (id: LeafId) => void;
  marks?: { on: string; n: number; on2?: boolean }[];
}) {
  const t = useText();
  const reduce = useReducedMotion();
  const { pos } = layout;
  const edges: { from: string; to: string }[] = [];
  const walk = (n: TreeNode) =>
    n.kids.forEach((k) => {
      edges.push({ from: n.id, to: keyOf(k) });
      if (!isLeaf(k)) walk(k);
    });
  walk(root);
  const rootP = pos[root.id];
  const stemX = rootP.x - 26;
  const markAt = (on: string) => {
    if (on === root.id) return { x: (stemX + rootP.x) / 2, y: rootP.y };
    const par = layout.parent[on];
    const a = par ? pos[par] : rootP;
    const b = pos[on];
    return { x: (a.x + b.x) / 2, y: b.y };
  };
  const leaves = leavesOf(root);
  const lastY = pos[leaves[leaves.length - 1]].y;
  return (
    <g>
      {/* root stem */}
      <path d={`M${stemX} ${rootP.y} H${rootP.x}`} stroke={stemLit ? "var(--blob)" : "var(--ink-2)"} strokeWidth={stemLit ? 3.6 : 2.4} strokeLinecap="round" />
      {edges.map(({ from, to }) => {
        const a = pos[from];
        const b = pos[to];
        const on = lit?.has(to);
        return (
          <path
            key={to}
            d={`M${a.x} ${a.y} V${b.y} H${b.x}`}
            fill="none"
            stroke={on ? "var(--blob)" : "var(--ink-2)"}
            strokeWidth={on ? 3.6 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "stroke .25s, stroke-width .25s" }}
          />
        );
      })}
      {marks?.map((m) => {
        const p = markAt(m.on);
        return (
          <g key={m.n}>
            <rect x={p.x - 3.5} y={p.y - 11} width={7} height={22} rx={2} fill={m.on2 ? "var(--blob)" : "var(--bio-sun)"} stroke="var(--bio-outline)" strokeWidth={1.3} />
            <text x={p.x} y={p.y - 18} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={m.on2 ? "var(--blob)" : "var(--ink)"} style={sans}>
              {m.n}
            </text>
          </g>
        );
      })}
      {leaves.map((l) => {
        const p = pos[l];
        const on = litLeaves?.has(l);
        const label = t(LEAVES[l]);
        const act = onLeaf ? () => onLeaf(l) : undefined;
        return (
          <g
            key={l}
            onClick={act}
            role={onLeaf ? "button" : undefined}
            tabIndex={onLeaf ? 0 : undefined}
            aria-pressed={onLeaf ? !!on : undefined}
            aria-label={onLeaf ? label : undefined}
            onKeyDown={act ? (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), act()) : undefined}
            className={cn(onLeaf && "cursor-pointer outline-none")}
          >
            <rect x={p.x + 4} y={p.y - 15} width={W - p.x - 8} height={30} rx={8} fill={on ? "var(--blob-soft)" : onLeaf ? "transparent" : "none"} stroke={on ? "var(--blob)" : "none"} strokeWidth={1.4} style={{ transition: "fill .2s" }} />
            <circle cx={p.x} cy={p.y} r={4.2} fill={on ? "var(--blob)" : "var(--ink-2)"} />
            <text x={p.x + 14} y={p.y} dominantBaseline="central" fontSize={15} fontWeight={on ? 700 : 500} fill="var(--ink)" style={sans}>
              {label}
            </text>
          </g>
        );
      })}
      <AnimatePresence>
        {dot && pos[dot] && (
          <motion.g key={dot} initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            {!reduce && (
              <motion.circle cx={pos[dot].x} cy={pos[dot].y} r={10} fill="none" stroke="var(--blob)" strokeWidth={2} initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            )}
            <circle cx={pos[dot].x} cy={pos[dot].y} r={8} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
          </motion.g>
        )}
      </AnimatePresence>
      {layout.timed && (
        <g>
          <line x1={X_ROOT} x2={X_LEAF} y1={lastY + 34} y2={lastY + 34} stroke="var(--ink-3)" strokeWidth={1.2} />
          <path d={`M${X_LEAF - 6} ${lastY + 30} L${X_LEAF} ${lastY + 34} L${X_LEAF - 6} ${lastY + 38}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
          <text x={X_ROOT} y={lastY + 50} fontSize={12} fill="var(--ink-3)" style={sans}>
            {t(tx(`${layout.maxAge} million years ago`, `vor ${layout.maxAge} Mio. Jahren`))}
          </text>
          <text x={X_LEAF} y={lastY + 50} textAnchor="end" fontSize={12} fill="var(--ink-3)" style={sans}>
            {t(tx("today", "heute"))}
          </text>
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Level 1 widget: tap two animals, see their last common ancestor

const TABS: TreeId[] = ["apes", "vertebrates", "hoofed"];

export function EvolutionFamilyTree() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [tree, setTree] = useState<TreeId>("apes");
  const [picked, setPicked] = useState<LeafId[]>(["human", "chimp"]);
  const root = TREES[tree].root;
  const layout = layoutTree(root, tree !== "hoofed");
  const pair = picked.length === 2 ? picked : null;
  const anc = pair ? lca(root, pair) : null;
  const lit = new Set(pair && anc ? [...pathDown(layout, anc.id, pair[0]), ...pathDown(layout, anc.id, pair[1])] : []);
  const others = anc && pair ? leavesOf(anc).filter((l) => !pair.includes(l)) : [];

  const tap = (l: LeafId) => setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l].slice(-2)));
  const switchTree = (id: TreeId) => {
    setTree(id);
    const ls = leavesOf(TREES[id].root);
    setPicked(id === "apes" ? ["human", "chimp"] : [ls[ls.length - 2], ls[ls.length - 1]]);
  };

  const name = (l: LeafId, lang: "en" | "de") => resolveText(LEAVES[l], lang);
  let info: Text;
  if (!pair || !anc) info = tx("Tap two living things to find their last common ancestor.", "Tipp zwei Lebewesen an, um ihren letzten gemeinsamen Vorfahren zu finden.");
  else {
    const when = anc.age !== undefined ? ageText(anc.age) : null;
    const line = (lang: "en" | "de") => {
      const a = name(pair[0], lang);
      const b = name(pair[1], lang);
      const w = when ? `, ${resolveText(when, lang)}` : "";
      const rest = others.map((o) => name(o, lang)).join(", ");
      return lang === "en"
        ? `The lines of ${a} and ${b} meet at the purple point: their last common ancestor${w}.${others.length ? ` It is also the ancestor of: ${rest}.` : " Nothing else here descends from it, so these two are each other's closest relatives."}`
        : `Die Linien von ${a} und ${b} treffen sich am lila Punkt: bei ihrem letzten gemeinsamen Vorfahren${w}.${others.length ? ` Er ist auch der Vorfahre von: ${rest}.` : " Von ihm stammt hier sonst nichts ab: Die beiden sind also die nächsten Verwandten."}`;
    };
    info = tx(line("en"), line("de"));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Family tree", "Stammbaum"))}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tree === id}
            onClick={() => switchTree(id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", tree === id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {tree === id && <motion.span layoutId={`${scope}-tree`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(TREES[id].title)}</span>
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${layout.height}`} className="mx-auto block h-auto w-full max-w-[600px]" role="group" aria-label={t(TREES[tree].title)}>
        <TreeLines root={root} layout={layout} lit={lit} litLeaves={new Set(picked)} dot={anc?.id ?? null} onLeaf={tap} />
      </svg>
      <motion.p
        key={`${tree}-${picked.join("-")}`}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[4.5rem] rounded-xl border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        {t(info)}
      </motion.p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task picture: a tree with numbered branching points

/** A family tree for tasks. `numbered` lists inner node ids in the order of their numbers. */
export function EvolutionTreeFigure({ tree, numbered, ask, highlight, mode = "numbers", leaves: litLeaves }: DrawingProps & { tree: TreeId; numbered?: string[]; leaves?: LeafId[] }) {
  const root = TREES[tree].root;
  const layout = layoutTree(root, false);
  const parts: FigurePart[] = (numbered ?? []).map((id) => ({ id, label: tx("branching point", "Verzweigungspunkt"), at: [layout.pos[id].x, layout.pos[id].y] }));
  return (
    <Figure title={TREES[tree].title} width={W} height={layout.height} parts={parts} mode={numbered?.length ? mode : "plain"} ask={ask} highlight={highlight} legend="none">
      <TreeLines root={root} layout={layout} litLeaves={new Set(litLeaves ?? [])} />
      {(numbered ?? []).map((id) => (
        <g key={id} data-part={id}>
          <circle cx={layout.pos[id].x} cy={layout.pos[id].y} r={3} fill="var(--ink-2)" />
        </g>
      ))}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Level 3: the vertebrate cladogram with characters and groups

/** The cladogram with numbered characters (1–7) for tasks. `lit`: character ids to highlight. */
export function EvolutionCladogramFigure({ lit = [], leaves: litLeaves = [] }: { lit?: CharacterId[]; leaves?: LeafId[] }) {
  const t = useText();
  const root = TREES.vertebrates.root;
  const layout = layoutTree(root, false);
  const marks = CHARACTERS.map((c, i) => ({ on: c.on, n: i + 1, on2: lit.includes(c.id) }));
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${layout.height}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Cladogram of vertebrates", "Kladogramm der Wirbeltiere"))}>
        <TreeLines root={root} layout={layout} marks={marks} litLeaves={new Set(litLeaves)} />
      </svg>
      <ol className="grid gap-x-4 gap-y-0.5 text-[13.5px] text-ink-2 sm:grid-cols-2">
        {CHARACTERS.map((c, i) => (
          <li key={c.id} className={cn("flex gap-2", lit.includes(c.id) && "font-semibold text-ink")}>
            <span className="w-4 shrink-0 text-right font-bold tabular-nums text-ink">{i + 1}</span>
            <span>{t(c.name)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function EvolutionCladogram() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<"chars" | "groups">("chars");
  const [char, setChar] = useState<CharacterId | null>("amnion");
  const [group, setGroup] = useState<string | null>(null);
  const root = TREES.vertebrates.root;
  const layout = layoutTree(root, false);
  const c = tab === "chars" && char ? CHARACTERS.find((x) => x.id === char)! : null;
  const g = tab === "groups" && group ? GROUPS.find((x) => x.id === group)! : null;
  const has = c ? carriers(c) : [];
  const anc = g ? lca(root, g.leaves) : null;
  const lit = c ? below(root, c.on) : g && anc ? new Set(g.leaves.flatMap((l) => pathDown(layout, anc.id, l))) : new Set<string>();
  const marks = CHARACTERS.map((x, i) => ({ on: x.on, n: i + 1, on2: c?.id === x.id }));
  const allLeaves = leavesOf(root);

  let info: Text;
  if (c) {
    const single = has.length === 1;
    const names = (l: "en" | "de") => has.map((h) => resolveText(LEAVES[h], l)).join(", ");
    const lacking = allLeaves.filter((l) => !has.includes(l));
    info = single
      ? tx(
          `Only ${names("en")} has it: a derived trait of a single group, an **autapomorphy**. It tells us nothing about who is related to whom.`,
          `Nur ${names("de")} hat es: ein abgeleitetes Merkmal einer einzelnen Gruppe, eine **Autapomorphie**. Über die Verwandtschaft sagt es nichts aus.`,
        )
      : lacking.length === 0
        ? tx(
            "All the animals here have it: it arose before their common ancestor. Compared within this tree it is an original trait, a **plesiomorphy**, so it groups nobody.",
            "Alle Tiere hier haben es: Es entstand schon vor ihrem gemeinsamen Vorfahren. Innerhalb dieses Baums ist es ein ursprüngliches Merkmal, eine **Plesiomorphie**, und begründet keine Gruppe.",
          )
        : tx(
            `A new (derived) trait of their common ancestor: a shared **synapomorphy** of ${names("en")}. It shows that these animals form a monophyletic group. For comparisons inside this group it counts as original (plesiomorphic).`,
            `Ein neues (abgeleitetes) Merkmal ihres gemeinsamen Vorfahren: eine gemeinsame **Synapomorphie** von ${names("de")}. Sie zeigt, dass diese Tiere eine monophyletische Gruppe bilden. Für Vergleiche innerhalb der Gruppe gilt es als ursprünglich (plesiomorph).`,
          );
  } else if (g) {
    info = tx(`**${resolveText(PHYLY[g.phyly], "en")}**: ${resolveText(g.why, "en")}`, `**${resolveText(PHYLY[g.phyly], "de")}**: ${resolveText(g.why, "de")}`);
  } else info = tab === "chars" ? tx("Tap a character.", "Tipp ein Merkmal an.") : tx("Tap a group.", "Tipp eine Gruppe an.");

  const chip = (on: boolean) => cn("rounded-lg border px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors", on ? "border-blob bg-blob-soft font-semibold text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Explore", "Erkunden"))}>
        {(["chars", "groups"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", tab === id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {tab === id && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(id === "chars" ? tx("Characters", "Merkmale") : tx("Groups", "Gruppen"))}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(200px,250px)] md:items-start">
        <svg viewBox={`0 0 ${W} ${layout.height}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Cladogram of vertebrates", "Kladogramm der Wirbeltiere"))}>
          <TreeLines root={root} layout={layout} lit={lit} stemLit={c?.on === root.id} marks={marks} litLeaves={new Set(c ? has : g ? g.leaves : [])} dot={anc?.id ?? null} />
        </svg>
        <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1">
          {tab === "chars"
            ? CHARACTERS.map((x, i) => (
                <button key={x.id} type="button" aria-pressed={char === x.id} onClick={() => setChar(char === x.id ? null : x.id)} className={chip(char === x.id)}>
                  <span className="mr-1.5 font-bold tabular-nums">{i + 1}</span>
                  {t(x.name)}
                </button>
              ))
            : GROUPS.map((x) => (
                <button key={x.id} type="button" aria-pressed={group === x.id} onClick={() => setGroup(group === x.id ? null : x.id)} className={chip(group === x.id)}>
                  {t(x.name)}
                </button>
              ))}
        </div>
      </div>
      <motion.p
        key={`${tab}-${char}-${group}`}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[4.5rem] rounded-xl border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        <RichLine text={info} />
      </motion.p>
    </div>
  );
}

/** **bold** inside a widget line. */
function RichLine({ text }: { text: Text }) {
  const t = useText();
  return (
    <>
      {t(text)
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((p, i) => (p.startsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}
