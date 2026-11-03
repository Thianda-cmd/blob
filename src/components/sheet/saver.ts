"use client";

// Saving a spreadsheet: debounced saves through save_sheet (migration 0024) that name the
// revision they build on, merging cell by cell when someone else saved first; other people's saves
// pulled in as they happen; retries with growing pauses when the connection is gone; and a draft
// of unsaved work on this device the whole time (drafts.ts), so nothing typed is ever lost.
//
// SheetSaver is plain TypeScript (no React), driven by useSheetSave; saveOnce is also used by the
// background save of drafts whose editor was closed (flushDrafts.ts).

import type { SaveState } from "@/components/page/useAutosave";
import type { Locale } from "@/i18n/config";
import { isNetworkError, isOnline, onConnectivity, reportNetworkError, reportOk } from "@/lib/offline/net";
import { createClient } from "@/lib/supabase/client";
import { mergeWorkbooks, sameJson } from "@/sheet/collab";
import { normalizeWorkbook, workbookPlainText, workbookPreview, type SheetPreview } from "@/sheet/doc";
import { editText, type Calc } from "@/sheet/engine";
import { getCell, setCells } from "@/sheet/ops";
import type { Workbook } from "@/sheet/types";
import { clearDraft, draftTab, readDraft, writeDraft } from "./drafts";
import { parseTyped, typedCell, type SheetStore } from "./store";

/** Quiet time after the last change before saving. */
export const SAVE_DELAY = 800;
/** …and before writing the draft on this device. */
const DRAFT_DELAY = 2000;
/** save_sheet refuses bigger content (migration 0024). */
const MAX_BYTES = 5_000_000;

export type SaveOutcome =
  | { ok: true; rev: number }
  | { ok: false; reason: "behind"; rev: number; content: unknown; title: string }
  | { ok: false; reason: "offline" | "error" | "denied" | "too_big" };

/** The two server calls saving needs: Supabase by default, a stand-in in tests (scripts/check-sheet-doc.ts). */
export type SaverApi = {
  saveSheet(args: { p_page: string; p_rev: number; p_content: unknown; p_title: string; p_plain: string }): Promise<{ data: unknown; error: unknown; status?: number }>;
  loadRow(pageId: string): Promise<{ rev: number; content: unknown; title: string | null } | null>;
};

export const supabaseApi: SaverApi = {
  async saveSheet(args) {
    const r = await createClient().rpc("save_sheet", args);
    return { data: r.data, error: r.error, status: r.status };
  },
  async loadRow(pageId) {
    const { data, error } = await createClient().from("pages").select("rev, content, title").eq("id", pageId).maybeSingle();
    return error || !data ? null : (data as { rev: number; content: unknown; title: string | null });
  },
};

/** What pages.content gets: the workbook and, beside it, its preview for lists (see src/sheet/doc.ts). */
export function storedContent(wb: Workbook, calc: Calc, locale: Locale): { content: Workbook & { preview?: SheetPreview }; plain: string } {
  let preview: SheetPreview | undefined;
  try {
    preview = workbookPreview(wb, calc, locale);
  } catch (e) {
    console.error("sheet: preview failed", e);
  }
  let plain = "";
  try {
    plain = workbookPlainText(wb, calc, locale);
  } catch (e) {
    console.error("sheet: search text failed", e);
  }
  return { content: preview ? { ...wb, preview } : wb, plain };
}

/** More than save_sheet takes? (Measured as UTF-8 only when it could be.) */
function tooBig(content: object): boolean {
  const json = JSON.stringify(content);
  if (json.length * 3 <= MAX_BYTES) return false;
  return new TextEncoder().encode(json).length > MAX_BYTES;
}

/** One save_sheet call. */
export async function saveOnce(pageId: string, rev: number, wb: Workbook, calc: Calc, title: string, locale: Locale, api: SaverApi = supabaseApi): Promise<SaveOutcome> {
  const { content, plain } = storedContent(wb, calc, locale);
  if (tooBig(content)) return { ok: false, reason: "too_big" };
  let res: { data: unknown; error: unknown; status?: number };
  try {
    res = await api.saveSheet({ p_page: pageId, p_rev: rev, p_content: content, p_title: title.slice(0, 200), p_plain: plain });
  } catch (e) {
    if (isNetworkError(e)) {
      reportNetworkError();
      return { ok: false, reason: "offline" };
    }
    return { ok: false, reason: "error" };
  }
  if (res.error) {
    if (isNetworkError(res.error, res.status)) {
      reportNetworkError();
      return { ok: false, reason: "offline" };
    }
    console.error("sheet: save failed", res.error);
    return { ok: false, reason: "error" };
  }
  reportOk();
  const r = (res.data ?? {}) as { ok?: boolean; reason?: string; rev?: number; content?: unknown; title?: string };
  if (r.ok) return { ok: true, rev: typeof r.rev === "number" ? r.rev : rev + 1 };
  if (r.reason === "behind" && typeof r.rev === "number") return { ok: false, reason: "behind", rev: r.rev, content: r.content, title: r.title ?? "" };
  if (r.reason === "too_big") return { ok: false, reason: "too_big" };
  if (r.reason === "denied") return { ok: false, reason: "denied" };
  return { ok: false, reason: "error" };
}

/** A title merged like the content: mine if I changed it since base, else theirs. */
export const mergeTitle = (base: string, mine: string, theirs: string) => (mine !== base ? mine : theirs);

export type SaverEvents = {
  state: (state: SaveState) => void;
  /** Something the person should know that stays until it is solved. */
  notice: (notice: "denied" | "tooBig" | null) => void;
  /** The title changed through someone else's save (or a restored draft). */
  title: (title: string) => void;
  /** A save went through (to tell the others on the live channel). */
  saved: (rev: number) => void;
  /** Unsaved work from an earlier visit was put back. */
  restored: () => void;
  /** The first time saving fails for a reason other than the connection, and when it works again. */
  trouble: (kind: "failed" | "recovered") => void;
};

type Options = {
  store: SheetStore;
  pageId: string;
  userId: string;
  locale: Locale;
  /** The server's revision and content (normalized) the editor opened with. */
  rev: number;
  base: Workbook;
  title: string;
  readOnly: boolean;
  on: SaverEvents;
  api?: SaverApi;
};

/** Pauses before trying again: growing, at most a minute. */
const backoff = (failures: number, first: number) => Math.min(60_000, first * 2 ** Math.max(0, failures - 1));

export class SheetSaver {
  private rev: number;
  /** What the server has at `rev` (as far as this tab knows). */
  private base: Workbook;
  private baseTitle: string;
  private title: string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private draftTimer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private pulling = false;
  /** The newest revision someone told us about. */
  private heard = 0;
  private failures = 0;
  private troubled = false;
  private denied = false;
  /** Closing (the editor went away): no new timers, pulls or restores; the last save still goes out. */
  private stopped = false;
  private current: SaveState = "saved";
  private offConnectivity: () => void;

  constructor(private o: Options) {
    this.rev = o.rev;
    this.base = o.base;
    this.baseTitle = o.title;
    this.title = o.title;
    this.offConnectivity = onConnectivity(() => {
      if (isOnline() && this.failures > 0 && !this.denied) void this.flush();
    });
  }

  get state() {
    return this.current;
  }

  private setState(state: SaveState) {
    if (state === this.current) return;
    this.current = state;
    this.o.on.state(state);
  }

  /** Unsaved changes (in the workbook or the title)? */
  dirty(): boolean {
    return this.o.store.get().workbook !== this.base || this.title !== this.baseTitle;
  }

  /** The workbook (or title) changed: keep a draft and save in a moment. */
  changed() {
    if (this.o.readOnly || this.stopped) return;
    if (!this.dirty()) {
      if (!this.running && this.failures === 0) this.setState("saved");
      return;
    }
    // The draft follows a little behind (writing it costs a moment on big workbooks); leaving or
    // hiding the page writes it at once, and so does a save that doesn't go through.
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.keepDraft(), DRAFT_DELAY);
    if (this.denied) return;
    // While saving fails, the pause before the next try stays (typing doesn't hammer the server).
    if (this.failures > 0 && this.timer) return;
    if (!this.running) this.setState("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  setTitle(title: string) {
    if (title === this.title) return;
    this.title = title;
    this.changed();
  }

  /** Write the draft now (the page is being hidden or closed). */
  keepDraft() {
    clearTimeout(this.draftTimer);
    if (this.o.readOnly || !this.o.userId) return;
    const mine = this.withRunningEdit();
    if (mine === this.base && this.title === this.baseTitle) {
      clearDraft(this.o.userId, this.o.pageId, draftTab());
      return;
    }
    writeDraft(this.o.userId, {
      v: 1,
      pageId: this.o.pageId,
      rev: this.rev,
      base: this.base,
      mine,
      baseTitle: this.baseTitle,
      title: this.title,
      at: Date.now(),
      tab: draftTab(),
    });
  }

  /**
   * The workbook with what is being typed in a cell right now as if it were entered, so a draft
   * written while the app goes to the background keeps it too (the app may never come back).
   */
  private withRunningEdit(): Workbook {
    const s = this.o.store.get();
    const wb = s.workbook;
    const e = s.edit;
    if (!e) return wb;
    try {
      const current = getCell(wb, e.sheetId, e.row, e.col);
      if (e.text === editText(current, this.o.locale)) return wb;
      const parsed = parseTyped(e.text, this.o.locale, current);
      if (parsed.error) return wb;
      return setCells(wb, e.sheetId, [{ row: e.row, col: e.col, cell: typedCell(current, parsed) }]);
    } catch {
      return wb;
    }
  }

  /** Save now (waits for a save already on its way). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.o.readOnly || this.denied) return;
    while (this.running) await this.running;
    if (!this.dirty()) {
      if (this.failures === 0) this.setState("saved");
      return;
    }
    this.running = this.run().finally(() => {
      this.running = null;
    });
    await this.running;
    if (this.heard > this.rev && !this.stopped) void this.pull();
  }

  private async run(): Promise<void> {
    const { store, pageId, locale } = this.o;
    let outcome: "ok" | "offline" | "error" | "denied" | "too_big" = "ok";
    this.setState("saving");
    for (let attempt = 0; ; attempt++) {
      const s = store.get();
      const wb = s.workbook;
      const title = this.title;
      if (wb === this.base && title === this.baseTitle) break;
      if (attempt >= 6) {
        outcome = "error";
        break;
      }
      const r = await saveOnce(pageId, this.rev, wb, s.calc, title, locale, this.o.api);
      if (r.ok) {
        this.rev = r.rev;
        this.base = wb;
        this.baseTitle = title;
        this.o.on.saved(r.rev);
        break;
      }
      if (r.reason === "behind") {
        // Someone saved in between: theirs is the new base, ours goes on top (merged), and again.
        this.absorb(r.rev, r.content, r.title);
        continue;
      }
      outcome = r.reason;
      break;
    }

    if (outcome === "ok") {
      if (this.troubled) {
        this.troubled = false;
        this.o.on.trouble("recovered");
      }
      this.failures = 0;
      this.o.on.notice(null);
      if (this.dirty()) {
        this.setState("pending");
        clearTimeout(this.timer);
        if (!this.stopped) this.timer = setTimeout(() => void this.flush(), SAVE_DELAY);
      } else {
        this.setState("saved");
        clearDraft(this.o.userId, pageId, draftTab());
      }
      return;
    }

    // Not saved: the work stays on this device until it is.
    this.keepDraft();
    this.failures++;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (outcome === "offline") {
      this.setState("device");
      if (!this.stopped) this.timer = setTimeout(() => void this.flush(), backoff(this.failures, 3000));
    } else if (outcome === "denied") {
      this.denied = true;
      this.setState("error");
      this.o.on.notice("denied");
    } else if (outcome === "too_big") {
      // Tried again with the next change (deleting rows makes it fit).
      this.setState("error");
      this.o.on.notice("tooBig");
    } else {
      this.setState("error");
      if (!this.troubled) {
        this.troubled = true;
        this.o.on.trouble("failed");
      }
      if (!this.stopped) this.timer = setTimeout(() => void this.flush(), backoff(this.failures, 4000));
    }
  }

  /** Someone else's version (revision `rev`): merged into the editor and taken as the new base. */
  private absorb(rev: number, content: unknown, title: string) {
    const { store, locale } = this.o;
    const theirs = normalizeWorkbook(content, locale);
    const now = store.get().workbook;
    if (now === this.base) {
      // Nothing of ours waiting: theirs as it is (or ours, when it's the same anyway).
      if (sameJson(theirs, now)) this.base = now;
      else {
        this.base = theirs;
        store.replaceRemote(theirs);
      }
    } else {
      const merged = mergeWorkbooks(this.base, now, theirs);
      this.base = theirs;
      if (merged !== now && !sameJson(merged, now)) store.replaceRemote(merged);
    }
    this.rev = rev;
    const next = mergeTitle(this.baseTitle, this.title, title);
    this.baseTitle = title;
    if (next !== this.title) {
      this.title = next;
      this.o.on.title(next);
    }
  }

  /** Someone saved revision `rev` (Realtime or a broadcast): fetch and merge it unless we have it. */
  remote(rev: number): Promise<void> {
    if (this.stopped || !(rev > this.rev)) return Promise.resolve();
    this.heard = Math.max(this.heard, rev);
    // A save on its way pulls afterwards (flush).
    return this.running ? Promise.resolve() : this.pull();
  }

  private async pull() {
    if (this.pulling || this.stopped) return;
    this.pulling = true;
    try {
      const row = await (this.o.api ?? supabaseApi).loadRow(this.o.pageId);
      if (!row) return;
      while (this.running) await this.running;
      if (typeof row.rev !== "number" || row.rev <= this.rev) return;
      this.absorb(row.rev, row.content, row.title ?? "");
      if (this.dirty()) this.changed();
    } finally {
      this.pulling = false;
    }
  }

  /**
   * Put back unsaved work this device kept from an earlier visit (or another tab): merged with
   * what the server has now, the draft's changes winning, and saved.
   */
  async restore() {
    const { store, userId, pageId, locale } = this.o;
    if (this.o.readOnly || !userId) return;
    const d = await readDraft(userId, pageId);
    if (!d || this.stopped) return;
    const base = normalizeWorkbook(d.base, locale);
    const mine = normalizeWorkbook(d.mine, locale);
    if (sameJson(base, mine) && d.title === d.baseTitle) {
      clearDraft(userId, pageId);
      return;
    }
    const now = store.get().workbook;
    const merged = mergeWorkbooks(base, mine, now);
    const title = mergeTitle(d.baseTitle, d.title, this.title);
    const changed = !sameJson(merged, now) || title !== this.title;
    if (!changed) {
      // Already saved (the draft outlived its save).
      clearDraft(userId, pageId);
      return;
    }
    if (merged !== now) store.replaceRemote(merged);
    if (title !== this.title) {
      this.title = title;
      this.o.on.title(title);
    }
    this.o.on.restored();
    this.changed();
  }

  /**
   * The editor is going away: the draft written now, a last save sent, then no more retries or
   * listening (a draft that couldn't be saved waits for the background save, flushDrafts.ts).
   */
  async close(): Promise<void> {
    this.stopped = true;
    this.keepDraft();
    try {
      await this.flush();
    } finally {
      clearTimeout(this.timer);
      clearTimeout(this.draftTimer);
      this.offConnectivity();
    }
  }
}
