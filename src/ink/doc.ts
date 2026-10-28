// What a handwritten note shows right now: its sheets in order and, on each sheet, its strokes,
// pictures and text boxes back to front. Edits from this device and from the server both arrive
// through apply(); listeners learn which parts of which sheets changed, so only those are drawn
// again.

import { boxesTouch, compareSheets, compareThings, unionBox, type Box, type Item, type Sheet, type Thing } from "./model";

export type Change = {
  /** Everything was replaced (a fresh load): all of it needs drawing. */
  all?: boolean;
  /** Sheets were added, removed, reordered or changed (template, paper). */
  sheets: boolean;
  /** Areas of sheets whose content changed. */
  dirty: Map<string, Box[]>;
  /** New strokes on top of everything on their sheet: they can be painted over what is there. */
  top: Thing[];
};

export class InkDoc {
  private items = new Map<string, Item>();
  /** In order, top to bottom. */
  sheets: Sheet[] = [];
  private bySheet = new Map<string, Thing[]>();
  private listeners = new Set<(c: Change) => void>();

  get(id: string): Item | undefined {
    return this.items.get(id);
  }

  has(id: string) {
    return this.items.has(id);
  }

  get size() {
    return this.items.size;
  }

  /** Things on a sheet, back to front. */
  on(sheet: string): readonly Thing[] {
    return this.bySheet.get(sheet) ?? EMPTY;
  }

  sheetIndex(id: string) {
    return this.sheets.findIndex((s) => s.id === id);
  }

  /** Everything (for exports and the preview). */
  all(): Item[] {
    return [...this.items.values()];
  }

  subscribe(fn: (c: Change) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Puts items (replacing those with the same id) and removes ids, in one change. */
  apply(puts: Item[], removes: string[] = []): Change {
    const change: Change = { sheets: false, dirty: new Map(), top: [] };
    const dirty = (sheet: string, box: Box) => {
      const list = change.dirty.get(sheet);
      if (list) list.push(box);
      else change.dirty.set(sheet, [box]);
    };
    for (const id of removes) {
      const old = this.items.get(id);
      if (!old) continue;
      this.items.delete(id);
      if (old.kind === "sheet") {
        this.sheets = this.sheets.filter((s) => s.id !== id);
        change.sheets = true;
      } else {
        this.unlist(old);
        dirty(old.sheet, old.box);
      }
    }
    const added: Thing[] = [];
    for (const item of puts) {
      const old = this.items.get(item.id);
      this.items.set(item.id, item);
      if (item.kind === "sheet") {
        if (old?.kind === "sheet") this.sheets = this.sheets.map((s) => (s.id === item.id ? item : s));
        else this.sheets.push(item);
        change.sheets = true;
        continue;
      }
      if (old && old.kind !== "sheet") {
        this.unlist(old);
        dirty(old.sheet, old.box);
        dirty(item.sheet, item.box);
      } else if (!old) {
        added.push(item);
      }
      this.list(item);
    }
    if (change.sheets) this.sheets.sort(compareSheets);
    // A few new strokes on top of their sheet (nothing older above them) can be painted over what is
    // there, in order; anything else needs its area drawn again.
    const few = added.length <= 8;
    const paintable = (t: Thing) => t.kind === "stroke" && t.tool !== "highlighter";
    for (const t of added) {
      const list = this.bySheet.get(t.sheet)!;
      const above = few && paintable(t) ? list.slice(list.indexOf(t) + 1) : null;
      if (above && above.every((o) => paintable(o) && added.includes(o))) change.top.push(t);
      else dirty(t.sheet, t.box);
    }
    change.top.sort(compareThings);
    if (change.sheets || change.dirty.size || change.top.length) for (const fn of this.listeners) fn(change);
    return change;
  }

  /** Replaces everything (a fresh load from the server); listeners hear "all sheets changed". */
  reset(items: Item[]) {
    this.items.clear();
    this.bySheet.clear();
    this.sheets = [];
    for (const item of items) {
      this.items.set(item.id, item);
      if (item.kind === "sheet") this.sheets.push(item);
      else {
        const list = this.bySheet.get(item.sheet);
        if (list) list.push(item);
        else this.bySheet.set(item.sheet, [item]);
      }
    }
    this.sheets.sort(compareSheets);
    for (const list of this.bySheet.values()) list.sort(compareThings);
    for (const fn of this.listeners) fn({ all: true, sheets: true, dirty: new Map(), top: [] });
  }

  private list(t: Thing) {
    let list = this.bySheet.get(t.sheet);
    if (!list) this.bySheet.set(t.sheet, (list = []));
    // Usually the newest goes on top: search from the end.
    let lo = 0;
    let hi = list.length;
    if (!list.length || compareThings(list[list.length - 1], t) <= 0) lo = hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareThings(list[mid], t) <= 0) lo = mid + 1;
      else hi = mid;
    }
    list.splice(lo, 0, t);
  }

  private unlist(t: Thing) {
    const list = this.bySheet.get(t.sheet);
    if (!list) return;
    const i = list.findIndex((x) => x.id === t.id);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.bySheet.delete(t.sheet);
  }

  /** Things on a sheet whose box meets `box`, back to front. */
  within(sheet: string, box: Box): Thing[] {
    return this.on(sheet).filter((t) => boxesTouch(t.box, box));
  }

  /** The box around everything on a sheet. */
  extent(sheet: string): Box | null {
    let b: Box | null = null;
    for (const t of this.on(sheet)) b = b ? unionBox(b, t.box) : t.box;
    return b;
  }
}

const EMPTY: readonly Thing[] = [];
