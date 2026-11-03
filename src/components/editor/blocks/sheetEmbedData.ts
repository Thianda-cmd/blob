"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc, type Calc } from "@/sheet/engine";
import { filteredRows } from "@/sheet/table/model";
import type { Workbook } from "@/sheet/types";

// Spreadsheets shown in notes (the sheetEmbed block), loaded once per page however many blocks
// show them, and kept fresh: a block shows what it has at once, and asks the database whether the
// spreadsheet changed when it appears, when the window gets the focus again, when Blob saves the
// spreadsheet in this tab (its updated_at moves), and when you press "Refresh". Asking is cheap
// (one row's date); the content is fetched again only when it did change.

export type SheetDoc = { id: string; title: string; wb: Workbook; updatedAt: string | null };

export type SheetLoad =
  | { status: "loading" }
  | { status: "ready"; doc: SheetDoc; refreshing: boolean }
  /** Deleted, or not shared with you (the database can't say which). */
  | { status: "missing" }
  | { status: "trashed" }
  | { status: "notSheet" }
  /** Public pages: the link doesn't open this spreadsheet. */
  | { status: "private" }
  | { status: "offline" }
  | { status: "failed" };

type Final = Exclude<SheetLoad, { status: "loading" }>;

type Source = {
  /** The page's date of last change, or null when there is no such spreadsheet (then `full` says why). */
  stamp: (id: string) => Promise<{ updatedAt: string | null } | Final>;
  full: (id: string) => Promise<Final>;
};

const LOADING: SheetLoad = { status: "loading" };


const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Workbooks normalised in the reader's language at the time (a damaged one gets sheet names from it). */
let normalizeLocale: Locale = "de";
export const setSheetLocale = (locale: Locale) => {
  normalizeLocale = locale;
};

function readRow(id: string, row: { title?: string | null; kind?: string; trashed_at?: string | null; updated_at?: string | null; content?: unknown } | null): Final {
  if (!row) return { status: "missing" };
  if (row.trashed_at) return { status: "trashed" };
  // (Compared as text: the page kind "sheet" is new.)
  if (String(row.kind) !== "sheet") return { status: "notSheet" };
  let wb: Workbook;
  try {
    wb = normalizeWorkbook(row.content, normalizeLocale);
  } catch {
    return { status: "failed" };
  }
  return { status: "ready", doc: { id, title: row.title ?? "", wb, updatedAt: row.updated_at ?? null }, refreshing: false };
}

const privateSource: Source = {
  stamp: async (id) => {
    const { data, error } = await createClient().from("pages").select("updated_at, trashed_at, kind").eq("id", id).maybeSingle();
    if (error) return { status: offline() ? "offline" : "failed" };
    const row = data as { updated_at: string | null; trashed_at: string | null; kind: string } | null;
    if (!row) return { status: "missing" };
    if (row.trashed_at) return { status: "trashed" };
    if (String(row.kind) !== "sheet") return { status: "notSheet" };
    return { updatedAt: row.updated_at };
  },
  full: async (id) => {
    const { data, error } = await createClient().from("pages").select("title, kind, trashed_at, updated_at, content").eq("id", id).maybeSingle();
    if (error) return { status: offline() ? "offline" : "failed" };
    return readRow(id, data as Parameters<typeof readRow>[1]);
  },
};

/** Through a public link: the page as public_page() hands it out (only pages the link opens). */
function publicSource(token: string): Source {
  const full = async (id: string): Promise<Final> => {
    const { data, error } = await createClient().rpc("public_page", { p_token: token, p_page: id });
    if (error) return { status: offline() ? "offline" : "failed" };
    const view = data as { page?: { title?: string; kind?: string; content?: unknown; updated_at?: string } } | null;
    if (!view?.page) return { status: "private" };
    return readRow(id, { ...view.page, trashed_at: null });
  };
  // A public link has no cheap way to ask for the date alone: the whole page it is.
  return { full, stamp: async (id) => full(id) };
}

class SheetDocs {
  private entries = new Map<string, { load: SheetLoad; checkedAt: number; busy: Promise<void> | null }>();
  private listeners = new Map<string, Set<() => void>>();

  constructor(private source: Source) {}

  get = (id: string): SheetLoad => this.entries.get(id)?.load ?? LOADING;

  subscribe = (id: string, fn: () => void) => {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  };

  private set(id: string, load: SheetLoad, checked = true) {
    const entry = this.entries.get(id);
    this.entries.set(id, { load, checkedAt: checked ? Date.now() : (entry?.checkedAt ?? 0), busy: entry?.busy ?? null });
    this.listeners.get(id)?.forEach((fn) => fn());
  }

  /** Make sure the spreadsheet is loaded and was checked no longer than `maxAge` ms ago (0: check now). */
  ensure(id: string, maxAge = 30_000): Promise<void> {
    const entry = this.entries.get(id);
    if (entry?.busy) return entry.busy;
    const load = entry?.load;
    if (entry && load && load.status !== "loading" && Date.now() - entry.checkedAt < maxAge) return Promise.resolve();
    const busy = this.refresh(id).finally(() => {
      const e = this.entries.get(id);
      if (e) e.busy = null;
    });
    this.entries.set(id, { load: entry?.load ?? LOADING, checkedAt: entry?.checkedAt ?? 0, busy });
    return busy;
  }

  /** Check now (the "Refresh" button): the content is fetched again only when it changed. */
  reload(id: string): Promise<void> {
    return this.ensure(id, 0);
  }

  private async refresh(id: string): Promise<void> {
    const before = this.get(id);
    try {
      if (before.status === "ready") {
        this.set(id, { ...before, refreshing: true }, false);
        const stamp = await this.source.stamp(id);
        if ("updatedAt" in stamp && stamp.updatedAt && stamp.updatedAt === before.doc.updatedAt) {
          this.set(id, before);
          return;
        }
        if (!("updatedAt" in stamp)) {
          // Offline or a hiccup: keep showing what we have.
          this.set(id, stamp.status === "offline" || stamp.status === "failed" ? before : stamp);
          return;
        }
      }
      const next = await this.source.full(id);
      this.set(id, before.status === "ready" && (next.status === "offline" || next.status === "failed") ? before : next);
    } catch {
      this.set(id, before.status === "ready" ? before : { status: offline() ? "offline" : "failed" });
    }
  }
}

export const privateSheets = new SheetDocs(privateSource);
const publicSheets = new Map<string, SheetDocs>();

/** The loader for a public link's spreadsheets, or the signed-in one. */
export function sheetDocs(token: string | null | undefined): SheetDocs {
  if (!token) return privateSheets;
  let docs = publicSheets.get(token);
  if (!docs) publicSheets.set(token, (docs = new SheetDocs(publicSource(token))));
  return docs;
}

export type { SheetDocs };

const NOTHING: SheetLoad = { status: "missing" };

/**
 * A spreadsheet for a block: loaded on first use, then kept fresh (see the top of the file).
 * `changedAt`: the spreadsheet's updated_at as the workspace knows it; when it moves (Blob saved
 * the spreadsheet in this tab, maybe right beside the note), the block checks at once.
 */
export function useSheetDoc(pageId: string | null, docs: SheetDocs, changedAt?: string | null): SheetLoad {
  const load = useSyncExternalStore(
    (fn) => (pageId ? docs.subscribe(pageId, fn) : () => {}),
    () => (pageId ? docs.get(pageId) : NOTHING),
    () => LOADING,
  );
  const seen = useRef<{ pageId: string | null; changedAt: string | null | undefined } | null>(null);
  useEffect(() => {
    if (!pageId) return;
    const before = seen.current;
    seen.current = { pageId, changedAt };
    const moved = !!before && before.pageId === pageId && before.changedAt !== changedAt;
    // Appearing (back from editing the spreadsheet, say) checks too; blocks of one spreadsheet
    // appearing together share that one check.
    void docs.ensure(pageId, moved ? 0 : 3_000);
  }, [pageId, docs, changedAt]);
  useEffect(() => {
    if (!pageId) return;
    const check = () => {
      if (document.visibilityState === "visible") void docs.ensure(pageId, 4_000);
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [pageId, docs]);
  return load;
}

// Values -----------------------------------------------------------------------------------------

const calcs = new WeakMap<Workbook, Map<Locale, Calc>>();
const filterMemo = new WeakMap<Calc, Map<string, ReadonlySet<number>>>();
const NONE: ReadonlySet<number> = new Set<number>();

/** Rows a smart table's filter hides (worked out once per calculation and sheet), as the spreadsheet does. */
function filterHidden(calc: Calc, sheetId: string, locale: Locale): ReadonlySet<number> {
  const wb = calc.workbook;
  if (!wb.tables.some((t) => t.sheetId === sheetId && Object.keys(t.filters).length > 0)) return NONE;
  let bySheet = filterMemo.get(calc);
  if (!bySheet) filterMemo.set(calc, (bySheet = new Map()));
  const known = bySheet.get(sheetId);
  if (known) return known;
  // While a sheet's filters are worked out (they read values), only rows hidden by hand count.
  bySheet.set(sheetId, NONE);
  let rows: ReadonlySet<number> = NONE;
  try {
    rows = filteredRows(wb, calc, sheetId, locale);
  } catch {
    rows = NONE;
  }
  bySheet.set(sheetId, rows);
  return rows;
}

/** The values of a workbook, calculated as the spreadsheet does (SUBTOTAL skips hidden and filtered rows). */
export function calcOf(wb: Workbook, locale: Locale): Calc {
  let byLocale = calcs.get(wb);
  if (!byLocale) calcs.set(wb, (byLocale = new Map()));
  let calc = byLocale.get(locale);
  if (!calc) {
    let self: Calc | null = null;
    calc = createCalc(wb, {
      locale,
      isRowHidden: (sheetId, row) => {
        const sheet = wb.sheets.find((s) => s.id === sheetId);
        if (!sheet) return false;
        if (sheet.rows[String(row)]?.hidden) return true;
        return self ? filterHidden(self, sheetId, locale).has(row) : false;
      },
    });
    self = calc;
    byLocale.set(locale, calc);
  }
  return calc;
}
