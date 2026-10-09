import type { Deck, Slide } from "@/lib/types";

// Saving a presentation that several people edit at once. Each save names the revision it builds on
// (save_deck, migration 0010); when someone else saved in between, the database returns their deck
// and the browser merges: for every slide and every field, whoever changed it since the common base
// wins (if both did, the newer save, i.e. theirs, stays). New slides from both sides are kept,
// deleted ones stay deleted.

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** For each field: mine if I changed it since base, else theirs. */
function mergeFields<T extends object>(base: T | undefined, mine: T, theirs: T): T {
  if (!base) return { ...theirs, ...mine };
  const out = { ...theirs } as Record<string, unknown>;
  for (const key of Object.keys(mine) as (keyof T)[]) {
    if (!same(mine[key], base[key])) out[key as string] = mine[key];
  }
  return out as T;
}

/**
 * Slide order: whoever reordered wins (mine first); slides new on the other side go after the slide
 * before them there, or at the end.
 */
function mergeOrder(base: string[], mine: string[], theirs: string[], keep: Set<string>): string[] {
  const reorderedByMe = !same(
    mine.filter((id) => base.includes(id)),
    base.filter((id) => mine.includes(id)),
  );
  const [primary, other] = reorderedByMe ? [mine, theirs] : [theirs, mine];
  const order = primary.filter((id) => keep.has(id));
  for (let i = 0; i < other.length; i++) {
    const id = other[i];
    if (!keep.has(id) || order.includes(id)) continue;
    const before = other.slice(0, i).reverse().find((x) => order.includes(x));
    order.splice(before ? order.indexOf(before) + 1 : order.length, 0, id);
  }
  return order;
}

/** Three-way merge of decks (all three normalized). */
export function mergeDeck(base: Deck, mine: Deck, theirs: Deck): Deck {
  const top = mergeFields(
    { theme: base.theme, custom: base.custom, transition: base.transition },
    { theme: mine.theme, custom: mine.custom, transition: mine.transition },
    { theme: theirs.theme, custom: theirs.custom, transition: theirs.transition },
  );
  const byId = (d: Deck) => new Map(d.slides.map((s) => [s.id, s]));
  const b = byId(base);
  const m = byId(mine);
  const t = byId(theirs);
  const keep = new Set<string>();
  for (const id of new Set([...m.keys(), ...t.keys()])) {
    const inBase = b.has(id);
    // Deleted on either side (it was there before): gone. New on either side: kept.
    if (inBase && (!m.has(id) || !t.has(id))) continue;
    keep.add(id);
  }
  const order = mergeOrder(
    base.slides.map((s) => s.id),
    mine.slides.map((s) => s.id),
    theirs.slides.map((s) => s.id),
    keep,
  );
  const slides: Slide[] = order.map((id) => {
    const mineSlide = m.get(id);
    const theirSlide = t.get(id);
    if (mineSlide && theirSlide) return mergeFields(b.get(id), mineSlide, theirSlide);
    return (mineSlide ?? theirSlide)!;
  });
  return { ...top, slides };
}

/** Merge a title the same way: mine if I changed it, else theirs. */
export const mergeTitle = (base: string, mine: string, theirs: string) => (mine !== base ? mine : theirs);
