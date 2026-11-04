"use client";

// Saving a spreadsheet: saves through save_sheet (migration 0024) that name the revision they
// build on, merging cell by cell when someone else saved first; other people's saves pulled in as
// they happen; retries with growing pauses when the connection is gone or the server has a problem
// (the editor tells the two apart: "Auf diesem Gerät gespeichert", or "Nicht gespeichert,
// versuche erneut" and a notice that saving isn't working); and a draft of unsaved work on this
// device the whole time (drafts.ts), so nothing typed is ever lost.
//
// Every save has an id. When its answer never comes (the connection dropped on the way, the page
// was closed), the save may still have landed, so before anything else the editor, or whoever
// takes its draft later, asks whether it did (pages.save_ids). If it did, the work kept here is
// merged starting from what that save sent, not from the older version, so a change made elsewhere
// since then isn't overwritten with the old value. While that can't be found out, nothing of it is
// sent: a draft stays on the device as it is, or an editor that opened with the draft's version or
// an older one carries on from it (SheetSaver.restore). A device remembers its last save that went
// through (drafts.ts readLastSave): its next visit's first save takes that one's place there.
//
// Saving can't always work: no access any more ("denied"), too big, or a request the database
// refuses as it is ("rejected", which trying again can't fix). Then the work stays in the draft and
// the editor says what to do (export it, or keep it as a copy of your own).
//
// SheetSaver is plain TypeScript (no React), driven by useSheetSave; saveOnce is also used by the
// background save of drafts whose editor was closed (flushDrafts.ts).

import type { SaveState } from "@/components/page/useAutosave";
import type { Locale } from "@/i18n/config";
import { isNetworkError, isOnline, onConnectivity, reportNetworkError, reportOk } from "@/lib/offline/net";
import { createClient } from "@/lib/supabase/client";
import { arrivedCopies, mergeWorkbooks, sameJson, type MergeReport } from "@/sheet/collab";
import { normalizeWorkbook, storable, storableText, workbookPlainText, workbookPreview, type SheetPreview } from "@/sheet/doc";
import { editText, type Calc } from "@/sheet/engine";
import { getCell, setCells } from "@/sheet/ops";
import type { Workbook } from "@/sheet/types";
import {
  clearDraft,
  closingDone,
  flushedRev,
  newWriterId,
  openSheet,
  randomUuid,
  readLastSave,
  takeDrafts,
  writeDraft,
  writeLastSave,
  type SheetDraft,
} from "./drafts";
import { parseTyped, typedCell, typingAt, type SheetStore } from "./store";

/** Quiet time after the last change before saving… */
export const SAVE_DELAY = 800;
/** …but steady typing puts a save off for at most this long after the first change it holds… */
const SAVE_MAX_WAIT = 3000;
/** Quiet time before the draft on this device is written… */
const DRAFT_DELAY = 2000;
/** …and at most this long after the first change it doesn't have yet… */
const DRAFT_MAX_WAIT = 5000;
/**
 * …both times this for a big spreadsheet, where each save and each draft takes a moment of its own
 * (the preview, the search text, the JSON), so steady typing isn't held up every few seconds: 1 up
 * to 1 MB, then in step with the size (five times as long at 5 MB).
 */
const waitScale = (bytes: number) => Math.min(5, Math.max(1, bytes / 1_000_000));
/** The biggest spreadsheet save_sheet takes (migration 0024): bytes of its JSON as sent, counted the same way here. */
export const MAX_BYTES = 5_000_000;
/** From this size on, the editor says the spreadsheet is getting close to that. */
export const LARGE_BYTES = 4_000_000;

/**
 * What a save came to. "rejected": the database refused the request as it is (it can't read it,
 * or a number in it), so sending it again would be refused again; "error": anything else that went
 * wrong on the server, worth trying again. `unsure`: a server error (5xx), which may come from in
 * front of save_sheet while the save itself went through, as when the answer is lost.
 */
export type SaveOutcome =
  | { ok: true; rev: number; title: string | null; bytes: number }
  | { ok: false; reason: "behind"; rev: number; content: unknown; title: string }
  | { ok: false; reason: "too_big"; bytes: number }
  | { ok: false; reason: "error"; unsure?: true }
  | { ok: false; reason: "offline" | "denied" | "rejected" };

/**
 * The server answered with an error of its own (HTTP 5xx: the database, or a gateway in front of it,
 * has a problem) while the connection works. Not "offline" for saving: the top bar would say so,
 * and a connection check getting through would set off a new try every second while it lasts.
 * (src/lib/offline/net.ts counts it as no connection for the rest of Blob, whose changes wait then.)
 */
const serverError = (status?: number) => status !== undefined && status >= 500;

/** What save_sheet gets (migration 0024). */
export type SaveArgs = {
  p_page: string;
  p_rev: number;
  p_content: unknown;
  p_title: string;
  p_plain: string;
  /** The title this editor last had from the server: the title is written only when it changed. */
  p_base_title: string;
  /** This save's id, and the same editor's last save that went through (pages.save_ids). */
  p_save_id: string;
  p_last_save: string | null;
};

/** The server calls saving needs: Supabase by default, a stand-in in tests (scripts/check-sheet-doc.ts). */
export type SaverApi = {
  saveSheet(args: SaveArgs): Promise<{ data: unknown; error: unknown; status?: number }>;
  loadRow(pageId: string): Promise<{ rev: number; content: unknown; title: string | null } | null>;
  /**
   * Whether the save with this id went through (pages.save_ids). While that can't be found out:
   * null without a connection, undefined while the server has a problem (landedFrom).
   */
  landed(pageId: string, saveId: string): Promise<boolean | null | undefined>;
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
  async landed(pageId, saveId) {
    // (Without a network the look can't even leave: postgrest-js would try it for seconds, with the
    // bar on "Speichert…". Blob's connection state says offline already.)
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
    return landedFrom(await createClient().from("pages").select("save_ids").eq("id", pageId).maybeSingle(), saveId);
  },
};

/**
 * What the answer to a look at pages.save_ids says about the save `saveId`: whether it went
 * through, or why that can't be found out now: null without a connection (reported, as a save
 * reports it), undefined while the server has a problem (a 5xx, which isn't the connection:
 * serverError). The editor goes by this, not by Blob's connection state, which other parts of Blob
 * set to offline on a 5xx.
 */
export function landedFrom(res: { data: unknown; error: unknown; status?: number }, saveId: string): boolean | null | undefined {
  if (res.error && serverError(res.status)) return undefined;
  if (res.error && isNetworkError(res.error, res.status)) {
    reportNetworkError();
    return null;
  }
  // Any other trouble (or a page that can't be read any more) counts as "didn't land": the work
  // kept here is then merged from its older start, which keeps all of it.
  const ids = (res.data as { save_ids?: unknown } | null)?.save_ids;
  return Array.isArray(ids) && ids.includes(saveId);
}

// (Text the database can store: src/sheet/doc.ts, where the editor's undo steps are repaired too.)
export { storableText };

/** A page title as the database keeps it: storable, at most 200 characters (cut between characters, never inside one). */
const storableTitle = (title: string) => Array.from(storableText(title)).slice(0, 200).join("");

/**
 * Text storableText repairs, as JSON writes it: a lone surrogate or NUL is always an escape
 * (`\ud83e`, `\u0000`), and the backslash before it isn't one written for a backslash in the text.
 */
const UNSTORABLE_JSON = /(?:^|[^\\])(?:\\\\)*\\u(?:0000|d[89a-f])/;

/** The bytes of JSON text as UTF-8. Exact from LARGE_BYTES on; below that it may count less (sizes don't matter there). */
function utf8Bytes(json: string): number {
  // A character is 1 to 3 bytes: counted only where that could matter.
  return json.length * 3 < LARGE_BYTES ? json.length : new TextEncoder().encode(json).length;
}

/** What a spreadsheet page stores (storedContent). */
export type StoredContent = {
  /** The workbook with its preview beside it. */
  content: Workbook & { preview?: SheetPreview };
  /** The workbook in `content`: the one given, or a copy of it with its text repaired. */
  workbook: Workbook;
  /** The words for search (pages.plain_text). */
  plain: string;
  /** The size of `content` as save_sheet measures it: its JSON, UTF-8. */
  bytes: number;
};

/**
 * What pages.content gets: the workbook and, beside it, its preview for lists (see src/sheet/doc.ts),
 * with its words for search and its size. All text in it is storable (storableText). What the
 * formulas show, in the preview and the search text (LEFT on emoji text can be half of one), is
 * repaired as it is worked out. Text kept in the workbook itself (half an emoji pasted, a NUL from a
 * file) is rare: the JSON written to measure it shows when there is some, and only then is the
 * workbook gone through (`workbook` is the repaired copy, which the editor takes: SheetSaver.run,
 * store.ts repair).
 */
export function storedContent(wb: Workbook, calc: Calc, locale: Locale): StoredContent {
  let preview: SheetPreview | undefined;
  try {
    preview = storable(workbookPreview(wb, calc, locale));
  } catch (e) {
    console.error("sheet: preview failed", e);
  }
  let plain = "";
  try {
    plain = storableText(workbookPlainText(wb, calc, locale));
  } catch (e) {
    console.error("sheet: search text failed", e);
  }
  let workbook = wb;
  let content: Workbook & { preview?: SheetPreview } = preview ? { ...wb, preview } : wb;
  let json = JSON.stringify(content) ?? "";
  if (UNSTORABLE_JSON.test(json)) {
    workbook = storable(wb);
    content = preview ? { ...workbook, preview } : workbook;
    json = JSON.stringify(content);
  }
  return { content, workbook, plain, bytes: utf8Bytes(json) };
}

/**
 * The bytes `content` takes as JSON (UTF-8), which is how save_sheet measures what it gets. Exact
 * from LARGE_BYTES on; below that it may count less (sizes don't matter there).
 */
export function jsonBytes(content: unknown): number {
  return utf8Bytes(JSON.stringify(content) ?? "");
}

/**
 * The database refused the request as it is, and would refuse it again however often it came:
 * text or JSON in it that can't be read (22P02, 22P05 and the other data errors of class 22, or
 * PGRST102 for the request body), or a request too big to take (413). Not the connection, not
 * access, not a passing server problem.
 */
function refusedAsSent(error: unknown, status?: number): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return status === 413 || (status === 400 && typeof code === "string" && (code.startsWith("22") || code === "PGRST102"));
}

/** One save_sheet call (`saveId` names it; see the top of this file). `stored`: storedContent of `wb`, when the caller has it already. */
export async function saveOnce(
  s: { pageId: string; rev: number; wb: Workbook; calc: Calc; title: string; baseTitle: string; saveId: string; lastSave: string | null; locale: Locale; stored?: StoredContent },
  api: SaverApi = supabaseApi,
): Promise<SaveOutcome> {
  const { content, plain, bytes } = s.stored ?? storedContent(s.wb, s.calc, s.locale);
  if (bytes > MAX_BYTES) return { ok: false, reason: "too_big", bytes };
  let res: { data: unknown; error: unknown; status?: number };
  try {
    res = await api.saveSheet({
      p_page: s.pageId,
      p_rev: s.rev,
      p_content: content,
      p_title: storableTitle(s.title),
      p_plain: plain,
      p_base_title: storableTitle(s.baseTitle),
      p_save_id: s.saveId,
      p_last_save: s.lastSave,
    });
  } catch (e) {
    if (isNetworkError(e)) {
      reportNetworkError();
      return { ok: false, reason: "offline" };
    }
    return { ok: false, reason: "error" };
  }
  if (res.error) {
    // (Tried again after the saver's own pauses, with the sheet's notice that saving isn't working.)
    if (serverError(res.status)) {
      console.error("sheet: save failed", res.status, res.error);
      return { ok: false, reason: "error", unsure: true };
    }
    if (isNetworkError(res.error, res.status)) {
      reportNetworkError();
      return { ok: false, reason: "offline" };
    }
    console.error("sheet: save failed", res.error);
    return { ok: false, reason: refusedAsSent(res.error, res.status) ? "rejected" : "error" };
  }
  reportOk();
  const r = (res.data ?? {}) as { ok?: boolean; reason?: string; rev?: number; content?: unknown; title?: unknown };
  if (r.ok) return { ok: true, rev: typeof r.rev === "number" ? r.rev : s.rev + 1, title: typeof r.title === "string" ? r.title : null, bytes };
  if (r.reason === "behind" && typeof r.rev === "number") return { ok: false, reason: "behind", rev: r.rev, content: r.content, title: typeof r.title === "string" ? r.title : "" };
  if (r.reason === "too_big") return { ok: false, reason: "too_big", bytes };
  if (r.reason === "denied") return { ok: false, reason: "denied" };
  // ("invalid": something in it save_sheet can't take, which sending it again won't change.)
  if (r.reason === "invalid") return { ok: false, reason: "rejected" };
  return { ok: false, reason: "error" };
}

/** A title merged like the content: mine if I changed it since base, else theirs. */
export const mergeTitle = (base: string, mine: string, theirs: string) => (mine !== base ? mine : theirs);

/**
 * Something the person should know that stays until it is solved ("large": a warning, until it
 * shrinks; "rejected": the database refused the last save as it is, tried again with the next change).
 */
export type SaveNotice = "denied" | "tooBig" | "rejected" | "large";

/** A sheet both versions had moved rows or columns on: theirs kept, mine beside it as a copy (src/sheet/collab.ts). */
export type SheetConflict = MergeReport["conflicts"][number];

export type SaverEvents = {
  state: (state: SaveState) => void;
  notice: (notice: SaveNotice | null) => void;
  /** The spreadsheet's size when it was last measured for saving (bytes, as save_sheet counts them). */
  size?: (bytes: number) => void;
  /** The title changed through someone else's save (or a restored draft). */
  title: (title: string) => void;
  /** A save went through (to tell the others on the live channel). */
  saved: (rev: number) => void;
  /** Unsaved work from an earlier visit was put back. */
  restored: () => void;
  /** The first time saving fails for a reason other than the connection, and when it works again. */
  trouble: (kind: "failed" | "recovered") => void;
  /** Merging kept both versions of sheets whose rows or columns were moved on both sides at once. */
  conflict?: (conflicts: SheetConflict[]) => void;
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

/**
 * A save looks at drafts left waiting again (restore) only this long after the last look, and
 * doesn't wait for it: a look that can't get through takes seconds (postgrest-js tries a GET four
 * times), and reads the drafts.
 */
const LOOK_AGAIN = 5000;

/** A save as it was sent: it may land even when its answer never comes. */
type Sent = { id: string; rev: number; wb: Workbook; title: string };

/** Where a draft's own changes start (restore): the version they were made on, and its title. */
type Start = { base: Workbook; baseTitle: string };

export class SheetSaver {
  /** This editor's id: its draft on this device (drafts.ts). */
  readonly writer = newWriterId();
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
  /** The newest revision announced while a pull was on its way (it may have read the page before that save). */
  private announced = 0;
  private failures = 0;
  /**
   * The last try failed for lack of a connection: it goes out as soon as Blob is online again,
   * not after its pause. (After a server error the pause stays: being online is no news then.)
   */
  private noConnection = false;
  private troubled = false;
  private denied = false;
  /** Closing (the editor went away): no new timers, pulls or restores; the last save still goes out. */
  private stopped = false;
  private closing: Promise<void> | null = null;
  /** Signed out, or the work saved as a copy (letGo): nothing more is saved or kept on this device. */
  private discarded = false;
  private current: SaveState = "saved";
  private notice: SaveNotice | null = null;
  /** The size measured at the last try to save (bytes, as save_sheet counts them; 0: none yet). */
  private measured = 0;
  /** The workbook last found too big to save (it still is, while it is the one in the editor). */
  private bigWb: Workbook | null = null;
  /** The size of `base`, when this editor measured it (-1: not known, e.g. someone else's save). */
  private savedBytes = -1;
  /** When the first change not yet on its way to the server was made (0: none). */
  private pendingSince = 0;
  /** When the first change the draft on this device doesn't have was made (0: none). */
  private undraftedSince = 0;
  /** This editor's draft is on the device. */
  private drafted = false;
  /** The save on its way. */
  private sending: Sent | null = null;
  /** A save that went out and got no answer: it may have landed (settle finds out). */
  private unsure: Sent | null = null;
  /**
   * This device's last save that went through: the next one takes its place in pages.save_ids.
   * From the device's record at first (drafts.ts readLastSave), so a visit doesn't take a new place.
   */
  private lastSave: string | null;
  /**
   * Drafts restore() left on the device: whether their save that got no answer landed can't be
   * found out yet (startOf). `wb` and `title`: the editor's version when they were left, which they
   * are put back onto once that is known (what was done here since then comes on top of them).
   * `offline`: the last look found no connection, so being online again is the time to look again
   * (after a server error being online is no news: the pause stays, as for saves).
   */
  private waiting: { wb: Workbook; title: string; offline: boolean } | null = null;
  /** When the last look left drafts waiting (ms; LOOK_AGAIN). */
  private lookedAt = 0;
  /** restore() on its way: one at a time. */
  private restoring: Promise<void> | null = null;
  /** The next look at drafts left waiting, after a pause that grows with each one (restoreTries). */
  private restoreTimer: ReturnType<typeof setTimeout> | undefined;
  private restoreTries = 0;
  /**
   * Opened without a connection (the app's copy of the page, public/sw.js): nothing tells it of
   * saves made meanwhile, so once Blob is online again it fetches the newest version, once. (Work of
   * its own waiting to go out is merged with that as it is saved.)
   */
  private openedOffline = !isOnline();
  private offConnectivity: () => void;
  private release: () => void;

  constructor(private o: Options) {
    this.lastSave = o.readOnly ? null : readLastSave(o.userId, o.pageId);
    this.rev = o.rev;
    this.base = o.base;
    this.baseTitle = o.title;
    this.title = o.title;
    this.offConnectivity = onConnectivity(() => {
      if (!isOnline()) return;
      if (this.noConnection && !this.denied) void this.flush();
      if (this.waiting?.offline) void this.restore();
      if (this.openedOffline) {
        this.openedOffline = false;
        if (!this.unsure && !this.waiting && !this.dirty()) void this.pull();
      }
    });
    this.release = openSheet({
      pageId: o.pageId,
      writer: this.writer,
      flush: () => this.flush(),
      unsaved: () => !o.readOnly && !this.discarded && (this.dirty() || !!this.unsure),
      discard: () => this.discard(),
      letGo: () => this.letGo(),
      remote: (rev) => this.remote(rev),
      closing: () => this.closing,
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

  private setNotice(notice: SaveNotice | null) {
    if (notice === this.notice) return;
    this.notice = notice;
    this.o.on.notice(notice);
  }

  /** Unsaved changes (in the workbook or the title)? */
  dirty(): boolean {
    return this.o.store.get().workbook !== this.base || this.title !== this.baseTitle;
  }

  /** The workbook (or title) changed: keep a draft and save in a moment. */
  changed() {
    if (this.o.readOnly) return;
    // Signed out (here, or in another tab): nothing is saved any more, and the bar says so.
    if (this.discarded) {
      if (this.dirty()) this.setState("refused");
      return;
    }
    if (this.stopped) return;
    const now = Date.now();
    if (!this.dirty()) {
      // Back to what the server has (a change undone, say): nothing to save, and the draft follows.
      this.pendingSince = 0;
      if (this.drafted) {
        if (!this.undraftedSince) this.undraftedSince = now;
        this.scheduleDraft(now);
      }
      if (!this.running) this.upToDate();
      return;
    }
    // The draft follows a little behind (writing it costs a moment on big workbooks), but not for
    // long while typing goes on; leaving or hiding the page writes it at once, and so does a save
    // that doesn't go through.
    if (!this.undraftedSince) this.undraftedSince = now;
    this.scheduleDraft(now);
    if (this.denied) return;
    // While saving fails, the pause before the next try stays (typing doesn't hammer the server).
    if (this.failures > 0 && this.timer) return;
    if (!this.running) this.setState("pending");
    if (!this.pendingSince) this.pendingSince = now;
    this.scheduleSave(now);
  }

  /** The draft a moment after the last change, and at most DRAFT_MAX_WAIT (scaled) after the first it lacks. */
  private scheduleDraft(now = Date.now()) {
    clearTimeout(this.draftTimer);
    const latest = this.undraftedSince + DRAFT_MAX_WAIT * waitScale(this.measured);
    this.draftTimer = setTimeout(() => this.keepDraft(), Math.max(0, Math.min(DRAFT_DELAY, latest - now)));
  }

  /** The save a moment after the last change, and at most SAVE_MAX_WAIT (scaled) after the first waiting. */
  private scheduleSave(now = Date.now()) {
    clearTimeout(this.timer);
    const latest = this.pendingSince + SAVE_MAX_WAIT * waitScale(this.measured);
    this.timer = setTimeout(() => void this.flush(), Math.max(0, Math.min(SAVE_DELAY, latest - now)));
  }

  /**
   * Nothing waits to be saved: the server has what the editor shows (a change was undone, say), so
   * a problem saving it is over as well: no more tries, "Gespeichert" (or "Auf diesem Gerät
   * gespeichert" while drafts restore left wait there). Not when access is gone, nor while a save
   * that got no answer may still have landed (the next try finds out).
   */
  private upToDate() {
    if (this.denied || this.unsure) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.failures = 0;
    this.noConnection = false;
    if (this.notice === "tooBig") {
      // Back to the size that was saved: the warning near the limit, if it was that close.
      if (this.savedBytes >= 0) {
        this.measured = this.savedBytes;
        this.o.on.size?.(this.savedBytes);
      }
      this.setNotice(this.savedBytes > LARGE_BYTES ? "large" : null);
    } else if (this.notice === "rejected") {
      this.setNotice(this.measured > LARGE_BYTES ? "large" : null);
    }
    this.setState(this.waiting ? "device" : "saved");
  }

  setTitle(title: string) {
    if (title === this.title) return;
    this.title = title;
    this.changed();
  }

  /** Write the draft now (the page is being hidden or closed, or a save didn't go through). */
  keepDraft() {
    clearTimeout(this.draftTimer);
    const { readOnly, userId, pageId } = this.o;
    if (readOnly || !userId || this.discarded) return;
    const mine = this.withRunningEdit();
    // A save on its way, or one that got no answer, may land: the draft says which.
    const sent = this.sending ?? this.unsure;
    this.undraftedSince = 0;
    if (mine === this.base && this.title === this.baseTitle && !sent) {
      if (this.drafted) clearDraft(userId, pageId, this.writer);
      this.drafted = false;
      return;
    }
    writeDraft(userId, {
      v: 1,
      pageId,
      writer: this.writer,
      rev: this.rev,
      base: this.base,
      mine,
      baseTitle: this.baseTitle,
      title: this.title,
      at: Date.now(),
      ...(sent && { sending: sent.wb === mine ? { id: sent.id, title: sent.title } : { id: sent.id, title: sent.title, wb: sent.wb } }),
      ...(this.lastSave && { lastSave: this.lastSave }),
      // (No more tries in the background. The notice here has said it can't be saved; once this
      // editor is closed, Blob asks what to do with it the next time the app starts: DeniedDrafts.)
      ...(this.denied && { denied: true }),
    });
    this.drafted = true;
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
      if (e.text === editText(getCell(wb, e.sheetId, e.row, e.col), this.o.locale)) return wb;
      const { current, place } = typingAt(s, e.sheetId, { row: e.row, col: e.col });
      const parsed = parseTyped(e.text, this.o.locale, current, place);
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
    if (this.o.readOnly || this.denied || this.discarded) return;
    // Drafts restore left waiting are looked at again too, now and then (LOOK_AGAIN). This save
    // doesn't wait for that: what is put back goes out with the next one. (Not while closing: they
    // stay on the device for the next editor.)
    if (this.waiting && !this.stopped && Date.now() - this.lookedAt >= LOOK_AGAIN) void this.restore();
    while (this.running) await this.running;
    if (!this.dirty() && !this.unsure) {
      this.upToDate();
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
    let outcome: "ok" | "offline" | "error" | "denied" | "too_big" | "rejected" = "ok";
    /** The size the last try measured (-1: none). */
    let bytes = -1;
    this.setState("saving");
    for (let attempt = 0; ; attempt++) {
      // A save that got no answer comes first: did it land? While that can't be found out (no
      // connection, or the server has a problem: the lookup's answer says which), nothing is sent.
      const settled = await this.settle();
      if (settled !== true) {
        outcome = settled;
        break;
      }
      const s = store.get();
      let wb = s.workbook;
      const title = this.title;
      if (wb === this.base && title === this.baseTitle) break;
      if (attempt >= 6) {
        outcome = "error";
        break;
      }
      // Without a network the request can't even leave. A spreadsheet found too big to save stays
      // that offline too (being online again wouldn't help): known without measuring while it is
      // the same workbook, measured here (no network needed) once it has changed.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (this.notice === "tooBig" && wb !== this.bigWb) {
          bytes = storedContent(wb, s.calc, locale).bytes;
          if (bytes > MAX_BYTES) this.bigWb = wb;
        }
        outcome = this.notice === "tooBig" && wb === this.bigWb ? "too_big" : "offline";
        break;
      }
      // What goes out (storedContent). Text in the workbook that had to be repaired for it (half an
      // emoji pasted, say) is repaired in the editor as well, its undo steps too (store.repair): what
      // the server has is what is on screen, the next saves don't repair it again, and undo still
      // takes back the step that brought it.
      const stored = storedContent(wb, s.calc, locale);
      if (stored.workbook !== wb) {
        store.repair(stored.workbook);
        wb = stored.workbook;
      }
      const sent: Sent = { id: randomUuid(), rev: this.rev, wb, title };
      this.sending = sent;
      this.pendingSince = 0;
      // A draft on the device (or a page that is closing) learns about this save first: should the
      // page go before the answer comes, whoever takes the draft finds out whether it landed.
      if (this.drafted || this.stopped) this.keepDraft();
      const r = await saveOnce({ pageId, rev: sent.rev, wb, calc: s.calc, title, baseTitle: this.baseTitle, saveId: sent.id, lastSave: this.lastSave, locale, stored }, this.o.api);
      this.sending = null;
      if (r.ok) {
        this.rev = r.rev;
        this.base = wb;
        this.lastSave = sent.id;
        bytes = r.bytes;
        this.savedBytes = r.bytes;
        this.tookTitle(title, r.title ?? title);
        this.o.on.saved(r.rev);
        break;
      }
      if (r.reason === "behind") {
        // Someone saved in between: theirs is the new base, ours goes on top (merged), and again.
        this.absorb(r.rev, r.content, r.title);
        continue;
      }
      // The connection dropped on the way, or a server error came back: the save may have landed all the same.
      if (r.reason === "offline" || (r.reason === "error" && r.unsure)) this.unsure = sent;
      if (r.reason === "too_big") {
        bytes = r.bytes;
        this.bigWb = wb;
      }
      outcome = r.reason;
      break;
    }
    if (bytes >= 0) {
      this.measured = bytes;
      this.o.on.size?.(bytes);
    }
    this.noConnection = outcome === "offline";

    if (outcome === "ok") {
      if (this.troubled) {
        this.troubled = false;
        this.o.on.trouble("recovered");
      }
      this.failures = 0;
      this.setNotice(bytes > LARGE_BYTES || (bytes < 0 && this.notice === "large") ? "large" : null);
      // The draft on the device is no newer than what was just saved (what came after is in the
      // editor, and in the draft again soon).
      if (this.drafted) {
        clearDraft(this.o.userId, pageId, this.writer);
        this.drafted = false;
      }
      // (Once no draft names it as a save that may have landed.)
      if (this.lastSave) writeLastSave(this.o.userId, pageId, this.lastSave);
      if (this.dirty()) {
        this.setState("pending");
        if (!this.pendingSince) this.pendingSince = Date.now();
        this.undraftedSince = this.pendingSince;
        if (this.stopped) this.keepDraft();
        else {
          this.scheduleDraft();
          this.scheduleSave();
        }
      } else {
        this.setState(this.waiting ? "device" : "saved");
        this.undraftedSince = 0;
        clearTimeout(this.draftTimer);
      }
      return;
    }

    // Not saved: the work stays on this device until it is (or, with no access, until you decide).
    if (outcome === "denied") this.denied = true;
    this.keepDraft();
    this.failures++;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (outcome === "offline") {
      // (Measured offline after a change and small enough now: it goes out once online again.)
      if (this.notice === "tooBig" && bytes >= 0) this.setNotice(bytes > LARGE_BYTES ? "large" : null);
      this.setState("device");
      if (!this.stopped) this.timer = setTimeout(() => void this.flush(), backoff(this.failures, 3000));
    } else if (outcome === "denied") {
      this.setState("refused");
      this.setNotice("denied");
    } else if (outcome === "too_big") {
      // Tried again with the next change (deleting rows makes it fit); nothing is sent until then.
      this.setState("tooBig");
      this.setNotice("tooBig");
    } else if (outcome === "rejected") {
      // The same save would be refused again: none goes out until the spreadsheet changes, and the
      // editor says how to keep the work meanwhile (as an Excel file, or as a copy).
      this.setState("refused");
      this.setNotice("rejected");
    } else {
      this.setState("failed");
      if (!this.troubled) {
        this.troubled = true;
        this.o.on.trouble("failed");
      }
      if (!this.stopped) this.timer = setTimeout(() => void this.flush(), backoff(this.failures, 4000));
    }
  }

  /**
   * Find out whether the save that got no answer landed: true once that's known, else why it can't
   * be found out now ("offline": no connection; "error": the server has a problem). If it did land,
   * it made the next revision and what it sent is the base: work done since is merged on top of
   * that, not of the older version (so a change someone made after it stays).
   */
  private async settle(): Promise<true | "offline" | "error"> {
    const u = this.unsure;
    if (!u) return true;
    const landed = await (this.o.api ?? supabaseApi).landed(this.o.pageId, u.id);
    if (landed === null) return "offline";
    if (landed === undefined) return "error";
    // (Settled meanwhile by the pull or the save next to this.)
    if (this.unsure !== u) return true;
    this.unsure = null;
    if (landed && this.rev === u.rev) {
      this.rev = u.rev + 1;
      this.base = u.wb;
      this.savedBytes = -1;
      this.baseTitle = u.title;
      this.lastSave = u.id;
      this.o.on.saved(this.rev);
    }
    return true;
  }

  /**
   * The title the server has after a save that sent `sent`: when this editor hadn't renamed the
   * spreadsheet, a rename made elsewhere stays there (save_sheet), and shows here too.
   */
  private tookTitle(sent: string, stored: string) {
    this.baseTitle = stored;
    if (stored !== sent && this.title === sent) {
      this.title = stored;
      this.o.on.title(stored);
    }
  }

  /** Someone else's version (revision `rev`): merged into the editor and taken as the new base. */
  private absorb(rev: number, content: unknown, title: string) {
    const { store, locale } = this.o;
    const theirs = normalizeWorkbook(content, locale);
    const now = store.get().workbook;
    this.savedBytes = -1;
    // Someone else's merge couldn't combine their version of a sheet with this one and put theirs
    // on a copy next to it: said here too (the first time it arrives), with what to do.
    const arrived = arrivedCopies(this.base, now, theirs);
    if (now === this.base) {
      // Nothing of ours waiting: theirs as it is (or ours, when it's the same anyway).
      if (sameJson(theirs, now)) this.base = now;
      else {
        this.base = theirs;
        store.replaceRemote(theirs);
      }
      if (arrived.length) this.o.on.conflict?.(arrived);
    } else {
      const report: MergeReport = { conflicts: [] };
      const merged = mergeWorkbooks(this.base, now, theirs, report, locale);
      this.base = theirs;
      // A sheet kept as theirs has my version on a copy: a running edit there goes on in the copy.
      if (merged !== now && !sameJson(merged, now)) store.replaceRemote(merged, report.conflicts);
      // A copy keeps my version safe, but with both versions the spreadsheet may be too big to
      // save (measured as saving measures it): then it waits on this device until the copy is
      // gone, and the notice says so.
      if (report.conflicts.some((c) => c.copyId)) {
        const s = store.get();
        if (storedContent(s.workbook, s.calc, locale).bytes > MAX_BYTES) for (const c of report.conflicts) if (c.copyId) c.tooBig = true;
      }
      const told = [...report.conflicts, ...arrived];
      if (told.length) this.o.on.conflict?.(told);
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
    // A pull on its way may have read the page before that save: it looks once more when done.
    if (this.pulling) {
      this.announced = Math.max(this.announced, rev);
      return Promise.resolve();
    }
    // A save on its way pulls afterwards (flush).
    return this.running ? Promise.resolve() : this.pull();
  }

  /**
   * The page row changed (Realtime): a newer revision is fetched, and a rename made elsewhere (a
   * rename alone leaves the revision as it is) shows here, unless the title was changed here too.
   */
  remoteRow(rev: number, title: unknown): Promise<void> {
    if (!this.stopped && rev === this.rev && typeof title === "string" && title !== this.baseTitle) {
      const next = mergeTitle(this.baseTitle, this.title, title);
      this.baseTitle = title;
      if (next !== this.title) {
        this.title = next;
        this.o.on.title(next);
      }
    }
    return this.remote(rev);
  }

  private async pull() {
    if (this.pulling || this.stopped) return;
    this.pulling = true;
    this.announced = 0;
    let row: { rev: number; content: unknown; title: string | null } | null = null;
    try {
      if ((await this.settle()) !== true) return;
      row = await (this.o.api ?? supabaseApi).loadRow(this.o.pageId);
      if (!row) return;
      while (this.running) await this.running;
      if (typeof row.rev !== "number" || row.rev <= this.rev) return;
      this.absorb(row.rev, row.content, row.title ?? "");
      if (this.dirty()) this.changed();
    } finally {
      this.pulling = false;
      const again = this.announced;
      this.announced = 0;
      // Only after a row came (no pulling in circles while it can't be read).
      if (row && typeof row.rev === "number" && !this.stopped) {
        const got = Math.max(row.rev, this.rev);
        // A save announced while this pull was on its way, newer than what it read: once more.
        if (again > got) void this.pull();
        // An announced revision the page doesn't have: not fetched again after every save.
        else if (this.heard > got) this.heard = got;
      }
    }
  }

  /**
   * Put back unsaved work this device kept from earlier visits, closed tabs or crashed ones (drafts
   * whose editor is gone): merged with what the server has now, the drafts' changes winning, and
   * saved. This editor takes them over, so none is put back twice.
   *
   * A draft whose save may have landed is put back only once that is known (startOf). Until then it
   * stays on the device as it is, and the bar says the work is there ("Auf diesem Gerät
   * gespeichert"). It is looked at again once Blob is online again, after a pause (growing), and now
   * and then before a save. The background save may take it meanwhile (flushDrafts.ts finds out the
   * same way): what that saves comes in like anyone's save. Only an editor that opened with the
   * version that draft was made on, or an older one, carries on from it at once (putBack).
   */
  restore(): Promise<void> {
    this.restoring ??= this.putBack().finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }

  private async putBack() {
    const { store, userId, pageId, locale } = this.o;
    if (this.o.readOnly || !userId || this.stopped) return;
    clearTimeout(this.restoreTimer);
    // The background save (flushDrafts.ts) sent a draft while this page was on its way with the
    // version before: that newer version comes in now, as if someone had saved it.
    const flushed = flushedRev(pageId);
    if (flushed > this.rev) void this.remote(flushed);
    // An editor of this page closing in this tab (you came straight back): its last save first.
    await closingDone(pageId);
    if (this.stopped) return;
    const waited = !!this.waiting;
    try {
      await takeDrafts(userId, pageId, async (drafts) => {
        if (this.stopped) return;
        const starts: (Start | "offline" | "error")[] = [];
        for (const d of drafts) starts.push(await this.startOf(d));
        // (Closed meanwhile: the drafts wait for the next editor.)
        if (this.stopped) return;
        const now = store.get().workbook;
        // A draft whose save can't be looked up, made on the version this editor opened with or a
        // newer one (the page came from the app's copy of an earlier visit, say: public/sw.js, opened
        // without a connection). An editor untouched so far carries on from it as that draft's own
        // editor would have: its version, and its save that got no answer, become this editor's. Its
        // work is on the screen at once, and settle finds out whether that save landed before
        // anything is sent, so nothing it sent goes over a change made elsewhere since. The newest
        // such draft; any other waits, as does one made on an older version than this editor's.
        const untouched = !this.waiting && !this.unsure && !this.running && !this.pulling && !this.dirty();
        const carry = untouched ? drafts.findLast((d, i) => typeof starts[i] !== "object" && d.rev >= this.rev) : undefined;
        let carried: Workbook | null = null;
        if (carry?.sending) {
          carried = normalizeWorkbook(carry.mine, locale);
          this.rev = carry.rev;
          this.base = normalizeWorkbook(carry.base, locale);
          this.baseTitle = carry.baseTitle;
          this.savedBytes = -1;
          // (What the screen shows, when that save sent all the draft has: once it is known to have
          // landed, there is nothing more to save.)
          const sent = carry.sending;
          this.unsure = { id: sent.id, rev: carry.rev, wb: sent.wb ? normalizeWorkbook(sent.wb, locale) : carried, title: sent.title };
        }
        const taken: { d: SheetDraft; start: Start; mine: Workbook }[] = [];
        const left: ("offline" | "error")[] = [];
        drafts.forEach((d, i) => {
          const start = starts[i];
          if (d === carry && carried) taken.push({ d, start: { base: this.base, baseTitle: this.baseTitle }, mine: carried });
          else if (typeof start === "object") taken.push({ d, start, mine: normalizeWorkbook(d.mine, locale) });
          else left.push(start);
        });
        if (taken.length) {
          // Drafts that waited go onto the editor's version from when they were left, and what was
          // done here since comes on top: it is newer than they are. (Carrying on from a draft, the
          // editor's version is the one that draft was made on, with nothing done here yet.)
          const ours = carried ? { wb: this.base, title: this.baseTitle } : { wb: now, title: this.title };
          const from = this.waiting ?? ours;
          const report: MergeReport = { conflicts: [] };
          let wb = from.wb;
          let title = from.title;
          for (const { d, start, mine } of taken) {
            wb = mergeWorkbooks(start.base, mine, wb, report, locale);
            title = mergeTitle(start.baseTitle, d.title, title);
          }
          const since: MergeReport = { conflicts: [] };
          if (from.wb !== ours.wb) wb = mergeWorkbooks(from.wb, ours.wb, wb, since, locale);
          title = mergeTitle(from.title, ours.title, title);
          const changed = !sameJson(wb, now);
          // (Nothing changes when the drafts outlived their saves.)
          if (changed || title !== this.title) {
            // For the drafts the editor's version is "theirs": a sheet both moved rows of keeps what
            // is on the screen, and only the draft's version goes on a copy (a running edit stays
            // where it is). Only rows moved here since drafts were left that moved them too go the
            // other way (`since`): this version on a copy, and a running edit goes on there.
            if (changed) store.replaceRemote(wb, since.conflicts);
            if (title !== this.title) {
              this.title = title;
              this.o.on.title(title);
            }
            this.o.on.restored();
            const told = [...report.conflicts, ...since.conflicts];
            if (told.length) this.o.on.conflict?.(told);
          }
          // What was taken is this editor's work now: its own draft holds it (written before the
          // others go), and it is saved in a moment. Without a last save remembered on this device,
          // the newest draft's is this device's place in pages.save_ids.
          if (!this.lastSave) for (const { d } of taken) if (d.lastSave) this.lastSave = d.lastSave;
          this.keepDraft();
          for (const { d } of taken) clearDraft(userId, pageId, d.writer);
        }
        // The others stay on the device as they are: not merged, not removed.
        this.waiting = left.length ? { ...(this.waiting ?? { wb: store.get().workbook, title: this.title }), offline: left.includes("offline") } : null;
        if (taken.length) this.changed();
      });
    } catch (e) {
      console.error("sheet: restoring the drafts failed", e);
    }
    if (this.stopped) return;
    if (this.waiting) {
      // (A save on its way says so as it ends; a problem the bar shows already stays.)
      if (this.current === "saved") this.setState("device");
      this.lookedAt = Date.now();
      this.restoreTimer = setTimeout(() => void this.restore(), backoff(++this.restoreTries, 3000));
    } else {
      this.restoreTries = 0;
      // Nothing waits any more (put back, or the background save took it): the bar says so too.
      if (waited && !this.running && !this.dirty()) this.upToDate();
    }
  }

  /**
   * Where a draft's own changes start: its base, or, when its save got no answer but landed, what
   * that save sent. Looked up whenever the draft names such a save, even when this editor's version
   * seems no newer than the draft's: a page opened without a connection is the app's copy of an
   * earlier visit. While it can't be found out whether that save landed, why ("offline": no
   * connection; "error": the server has a problem): merged from its base, the values that save sent
   * could go over a change made elsewhere since (putBack keeps such a draft waiting, or carries on
   * from it).
   */
  private async startOf(d: SheetDraft): Promise<Start | "offline" | "error"> {
    const { locale, pageId } = this.o;
    if (d.sending) {
      // (Without a network the look can't even leave: postgrest-js would try it for seconds.)
      if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
      const landed = await (this.o.api ?? supabaseApi).landed(pageId, d.sending.id);
      if (landed === null) return "offline";
      if (landed === undefined) return "error";
      if (landed) return { base: normalizeWorkbook(d.sending.wb ?? d.mine, locale), baseTitle: d.sending.title };
    }
    return { base: normalizeWorkbook(d.base, locale), baseTitle: d.baseTitle };
  }

  /**
   * The editor is going away: a last save sent (the draft written first, with that save in it,
   * since the page may be going too), then no more retries or listening. A draft that couldn't be
   * saved waits for the next editor or the background save (flushDrafts.ts).
   */
  close(): Promise<void> {
    this.closing ??= (async () => {
      this.stopped = true;
      try {
        // The draft at once (with a save that is on its way, if there is one): the page's own
        // "leaving" events don't reach this editor any more.
        this.keepDraft();
        if (!this.o.readOnly && !this.denied && !this.discarded && (this.dirty() || this.unsure)) await this.flush();
      } finally {
        clearTimeout(this.timer);
        clearTimeout(this.draftTimer);
        clearTimeout(this.restoreTimer);
        this.offConnectivity();
        this.release();
      }
    })();
    return this.closing;
  }

  /**
   * Its work was saved as a spreadsheet of your own (SheetEditor, when it couldn't be saved here):
   * nothing more is saved or kept on this device for this page, and its draft goes.
   */
  letGo() {
    if (this.discarded) return;
    this.discarded = true;
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
    clearTimeout(this.restoreTimer);
    this.offConnectivity();
    this.release();
    if (this.drafted) clearDraft(this.o.userId, this.o.pageId, this.writer);
    this.drafted = false;
  }

  /** Signed out (here or in another tab): stops at once, saving and keeping nothing more on this device. */
  discard() {
    if (this.discarded) return;
    this.discarded = true;
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.draftTimer);
    clearTimeout(this.restoreTimer);
    this.offConnectivity();
    this.release();
    // What it held goes with the session (drafts left waiting too): the bar doesn't claim it is saved.
    if (!this.o.readOnly && (this.dirty() || this.unsure || this.waiting)) this.setState("refused");
  }
}
