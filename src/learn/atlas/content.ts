import { resolveText, type Text } from "@/i18n/text";
import { ATLAS } from "./catalog";
import { CONTENT as bacterialCell } from "./models/bacterial-cell/content";
import { CONTENT as cellWall } from "./models/cell-wall/content";
import { CONTENT as endospores } from "./models/endospores/content";
import { CONTENT as eukaryoticCell } from "./models/eukaryotic-cell/content";
import { CONTENT as gramStain } from "./models/gram-stain/content";
import { CONTENT as history } from "./models/history/content";
import { CONTENT as membraneTransport } from "./models/membrane-transport/content";
import type { ModelContent, ViewContent } from "./types";

/**
 * The text of every model (no drawings): for counts on cards and for search. Server pages
 * import it directly; the command palette loads it only once someone searches.
 */
export const ATLAS_CONTENT: Record<string, ModelContent> = Object.fromEntries(
  [bacterialCell, cellWall, gramStain, endospores, history, eukaryoticCell, membraneTransport].map((c) => [c.slug, c]),
);

const itemsOf = (v: ViewContent) => (v.kind === "parts" ? Object.keys(v.parts).length : v.kind === "steps" ? v.steps.length : Object.keys(v.events).length);

/** What a model holds, for its card: views, and how many structures, steps and milestones. */
export type AtlasStats = { slug: string; views: number; items: number; parts: number; steps: number; events: number };

export function atlasStats(slug: string): AtlasStats {
  const views = Object.values(ATLAS_CONTENT[slug]?.views ?? {});
  const count = (kind: ViewContent["kind"]) => views.filter((v) => v.kind === kind).reduce((n, v) => n + itemsOf(v), 0);
  return { slug, views: views.length, items: views.reduce((n, v) => n + itemsOf(v), 0), parts: count("parts"), steps: count("steps"), events: count("timeline") };
}

export const allAtlasStats = () => ATLAS.map((m) => atlasStats(m.slug));

/** One searchable thing: a model, or a structure, step or milestone inside one. */
export type AtlasHit = { slug: string; view?: string; item?: string; label: Text; aka?: Text; model: Text };

/** Everything the command palette can find in the Atlas. */
export function atlasSearchIndex(): AtlasHit[] {
  const out: AtlasHit[] = [];
  for (const meta of ATLAS) {
    out.push({ slug: meta.slug, label: meta.title, aka: meta.subtitle, model: meta.title });
    const content = ATLAS_CONTENT[meta.slug];
    if (!content) continue;
    for (const [view, v] of Object.entries(content.views)) {
      if (v.kind === "parts") for (const [id, p] of Object.entries(v.parts)) out.push({ slug: meta.slug, view, item: id, label: p.name, aka: p.aka, model: meta.title });
      else if (v.kind === "steps") v.steps.forEach((s, i) => out.push({ slug: meta.slug, view, item: String(i), label: s.title, model: meta.title }));
      else for (const [id, e] of Object.entries(v.events)) out.push({ slug: meta.slug, view, item: id, label: e.title, aka: e.who, model: meta.title });
    }
  }
  return out;
}

/** Does a hit match the query (either language, name or other names)? */
export function atlasHitMatches(hit: AtlasHit, query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  const texts = [hit.label, hit.aka].filter(Boolean) as Text[];
  return texts.some((t) => resolveText(t, "de").toLowerCase().includes(q) || resolveText(t, "en").toLowerCase().includes(q));
}
