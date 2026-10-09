// The knowledge graph: notes as nodes, joined by their links, sub-pages, shared tags and learning
// topics (tags and topics are small hub nodes, so a tag on 30 notes is 30 lines, not 435). A calm
// force layout (repulsion, springs, a little gravity), deterministic for the same notes.

import { cos, sin } from "@/lib/stableMath";
import type { PageKind } from "@/lib/types";
import { hash } from "./text";

export type GraphPage = {
  id: string;
  title: string;
  kind: PageKind;
  subject_id: string | null;
  parent_id: string | null;
  tags: string[];
  topics: string[];
  links: string[];
};

export type GNode = {
  id: string;
  kind: "page" | "tag" | "topic";
  label: string;
  pageKind?: PageKind;
  subjectId?: string | null;
  degree: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held in place while dragged. */
  fixed?: boolean;
};

export type GEdge = { a: number; b: number; kind: "link" | "child" | "tag" | "topic" };

export type Graph = { nodes: GNode[]; edges: GEdge[]; index: Map<string, number> };

const SPRING: Record<GEdge["kind"], number> = { link: 70, child: 55, tag: 48, topic: 52 };

/** A number in [0, 1) from a string, for stable starting positions. */
const unit = (s: string) => (parseInt(hash(s).slice(0, 6), 36) % 10007) / 10007;

export function buildGraph(pages: GraphPage[], opts: { tags: boolean; topics: boolean; topicLabel: (slug: string) => string }): Graph {
  const nodes: GNode[] = [];
  const index = new Map<string, number>();
  const edges: GEdge[] = [];
  const seen = new Set<string>();
  const add = (n: Omit<GNode, "degree" | "r" | "x" | "y" | "vx" | "vy">) => {
    index.set(n.id, nodes.length);
    nodes.push({ ...n, degree: 0, r: 0, x: 0, y: 0, vx: 0, vy: 0 });
    return nodes.length - 1;
  };
  const link = (a: number, b: number, kind: GEdge["kind"]) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, kind });
    nodes[a].degree++;
    nodes[b].degree++;
  };

  for (const p of pages) add({ id: p.id, kind: "page", label: p.title, pageKind: p.kind, subjectId: p.subject_id });
  for (const p of pages) {
    const a = index.get(p.id)!;
    for (const to of p.links) {
      const b = index.get(to);
      if (b !== undefined) link(a, b, "link");
    }
    if (p.parent_id) {
      const b = index.get(p.parent_id);
      if (b !== undefined) link(a, b, "child");
    }
  }
  if (opts.tags) {
    const byTag = new Map<string, { label: string; ids: number[] }>();
    for (const p of pages) {
      for (const t of p.tags) {
        const k = t.toLowerCase();
        if (!byTag.has(k)) byTag.set(k, { label: t, ids: [] });
        byTag.get(k)!.ids.push(index.get(p.id)!);
      }
    }
    // A tag on a single note joins nothing: leave it out.
    for (const [k, { label, ids }] of byTag) {
      if (ids.length < 2) continue;
      const t = add({ id: `tag:${k}`, kind: "tag", label: `#${label}` });
      ids.forEach((i) => link(i, t, "tag"));
    }
  }
  if (opts.topics) {
    const byTopic = new Map<string, number[]>();
    for (const p of pages) {
      for (const raw of p.topics) {
        const slug = raw.split("@")[0];
        if (!byTopic.has(slug)) byTopic.set(slug, []);
        byTopic.get(slug)!.push(index.get(p.id)!);
      }
    }
    for (const [slug, ids] of byTopic) {
      const t = add({ id: `topic:${slug}`, kind: "topic", label: opts.topicLabel(slug) });
      ids.forEach((i) => link(i, t, "topic"));
    }
  }

  // Sizes by connections, and starting places: each subject gets its own direction.
  const subjects = [...new Set(nodes.map((n) => n.subjectId ?? ""))].sort();
  nodes.forEach((n, i) => {
    n.r = n.kind === "page" ? 6 + Math.sqrt(n.degree) * 2.6 : 4.5 + Math.sqrt(n.degree) * 1.8;
    const sector = n.kind === "page" ? subjects.indexOf(n.subjectId ?? "") / Math.max(1, subjects.length) : unit(n.id);
    const angle = (sector + unit(n.id) * 0.35) * Math.PI * 2;
    const radius = 30 + Math.sqrt(i + 1) * 22 * (0.6 + unit(`${n.id}r`) * 0.8);
    // stableMath: the server and the browser must start from exactly the same places.
    n.x = cos(angle) * radius;
    n.y = sin(angle) * radius;
  });
  return { nodes, edges, index };
}

/** One step of the layout; `alpha` (1 → 0) cools it down. Returns how much the nodes still move. */
export function tick(g: Graph, alpha: number): number {
  const { nodes, edges } = g;
  const n = nodes.length;
  const repel = 900 * alpha;
  // Repulsion between every pair (fine up to a few hundred notes; far pairs are skipped).
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 > 160000) continue;
      if (d2 < 0.01) {
        dx = (unit(a.id) - 0.5) * 0.1;
        dy = (unit(b.id) - 0.5) * 0.1;
        d2 = 0.01;
      }
      const f = repel / d2;
      const fx = dx * f;
      const fy = dy * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }
  // Springs along the edges.
  for (const e of edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const k = ((d - SPRING[e.kind]) / d) * 0.06 * alpha;
    const wa = b.degree / (a.degree + b.degree);
    a.vx += dx * k * wa;
    a.vy += dy * k * wa;
    b.vx -= dx * k * (1 - wa);
    b.vy -= dy * k * (1 - wa);
  }
  // Gravity keeps islands (and notes without links) close, then friction.
  let moved = 0;
  const pull = 0.006 + 0.018 * alpha;
  for (const node of nodes) {
    node.vx -= node.x * pull;
    node.vy -= node.y * pull;
    if (node.fixed) {
      node.vx = node.vy = 0;
      continue;
    }
    node.vx *= 0.55;
    node.vy *= 0.55;
    node.x += node.vx;
    node.y += node.vy;
    moved += Math.abs(node.vx) + Math.abs(node.vy);
  }
  return n ? moved / n : 0;
}

/** Holds a node in place while it is dragged (or lets it go again). */
export function pin(g: Graph, i: number, fixed: boolean) {
  g.nodes[i].fixed = fixed;
}

/** Puts a dragged node at (x, y); its neighbours follow a little. */
export function dragTo(g: Graph, i: number, x: number, y: number) {
  g.nodes[i].x = x;
  g.nodes[i].y = y;
  for (let k = 0; k < 3; k++) tick(g, 0.12);
}

/** Runs the layout to rest (for tests and for a first frame without animation). */
export function settle(g: Graph, ticks = 300) {
  for (let i = 0; i < ticks; i++) tick(g, 1 - i / ticks);
}

/** The box around all nodes. */
export function bounds(g: Graph) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of g.nodes) {
    minX = Math.min(minX, n.x - n.r);
    minY = Math.min(minY, n.y - n.r);
    maxX = Math.max(maxX, n.x + n.r);
    maxY = Math.max(maxY, n.y + n.r);
  }
  if (!g.nodes.length) return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}
