"use client";

// Saving and working together for the spreadsheet page (the logic is in saver.ts): watches the
// store, saves a moment after each change, keeps unsaved work on the device, pulls in other
// people's saves as they happen (Realtime on the page row, and a "saved" broadcast on the page's
// live channel when it is shared) and says who is here.

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageSaid } from "@/components/page/SaveIndicator";
import type { SaveState } from "@/components/page/useAutosave";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { sheetText } from "@/i18n/messages/sheet";
import { useLive, useTableChanges, type Peer } from "@/lib/live";
import { posName, quoteSheetName } from "@/sheet/a1";
import { sameJson, type CopyTies } from "@/sheet/collab";
import { sheetById } from "@/sheet/ops";
import type { Sheet, Workbook } from "@/sheet/types";
import { currentSheetNotice, showSheetNotice } from "./notice";
import { SheetSaver, type SaveNotice, type SheetConflict } from "./saver";
import { useSheet, type SheetStore } from "./store";

type Me = { user_id: string; name: string; avatar_url: string | null };

/**
 * The conflict copies that make the spreadsheet too big to save, once merging told `found`
 * (SaverEvents.conflict): those this editor's merge made and marked so (MergeReport tooBig), each
 * with my version of its sheet (never a copy that arrived with someone else's), newest first, then
 * those known before (`had`, the same list when nothing is new).
 */
export function ownBigCopies(had: string[], found: SheetConflict[]): string[] {
  const big = found.filter((c) => c.tooBig && c.copyId).map((c) => c.copyId);
  return big.length ? [...big, ...had.filter((id) => !big.includes(id))] : had;
}

/**
 * Why a spreadsheet is too big to save, for the editor's banner: "own", the newest of `own`
 * (ownBigCopies) still there with its original, which can be kept as a spreadsheet of my own; else
 * "copies", conflict copies with their originals whose version isn't known to be mine (after a
 * reload, say), which mustn't be deleted before what's needed from them is moved; else "big".
 */
export function tooBigBecause(sheets: readonly Sheet[], own: readonly string[]): { kind: "own"; copy: Sheet; original: Sheet } | { kind: "copies" | "big" } {
  const originalOf = (copy: Sheet | undefined) => (copy?.copyOf === undefined ? undefined : sheets.find((s) => s.id === copy.copyOf));
  for (const id of own) {
    const copy = sheets.find((s) => s.id === id);
    const original = originalOf(copy);
    if (copy && original) return { kind: "own", copy, original };
  }
  return { kind: sheets.some((s) => originalOf(s)) ? "copies" : "big" };
}

/**
 * What reads the conflict copy from other sheets (collab.ts copyTies), as the editor's bar names it
 * (tooBigReaders): the cells whose formulas do, at most `max` ("Auswertung!B3", then "B4" on the
 * same sheet), how many more, and the charts (with the sheet the only one is on).
 */
export function copyReaders(wb: Workbook, ties: CopyTies, max = 3): { cells: string[]; more: number; charts: number; chartSheet: string | null } {
  const cells: string[] = [];
  let sheetId = "";
  for (const p of ties.cells.slice(0, max)) {
    cells.push(p.sheetId === sheetId ? posName(p) : `${quoteSheetName(sheetById(wb, p.sheetId)?.name ?? "")}!${posName(p)}`);
    sheetId = p.sheetId;
  }
  const only = ties.charts.length === 1 ? wb.charts.find((ch) => ch.id === ties.charts[0]) : undefined;
  return { cells, more: ties.cells.length - cells.length, charts: ties.charts.length, chartSheet: (only && sheetById(wb, only.sheetId)?.name) ?? null };
}

/**
 * Whether what my version of the conflict copy `copyId` is made of (collab.ts ownVersion: the copy,
 * its charts and smart tables) is in `now` as it was in `then`. Only then can the copy go once that
 * version is a spreadsheet of my own: what was done to it in between would be in neither.
 */
export function sameOwnVersion(then: Workbook, now: Workbook, copyId: string): boolean {
  const parts = (wb: Workbook) => [sheetById(wb, copyId), wb.charts.filter((c) => c.sheetId === copyId), wb.tables.filter((t) => t.sheetId === copyId)];
  return now === then || sameJson(parts(then), parts(now));
}

/** Spreadsheets just made with my version of a sheet (page id → the sheet's name) whose editor hasn't said so yet. */
const ownVersionsMade = new Map<string, string>();

/** Spreadsheet `pageId` was just made with my version of sheet `name` (SheetEditor): its editor says so as it opens. */
export function markOwnVersion(pageId: string, name: string) {
  ownVersionsMade.set(pageId, name);
}

/** The sheet whose version spreadsheet `pageId` was just made with (markOwnVersion), asked once. */
export function takeOwnVersion(pageId: string): string | undefined {
  const name = ownVersionsMade.get(pageId);
  ownVersionsMade.delete(pageId);
  return name;
}

/**
 * Whether the editor's notice says that saving fails, or that it works again (SaverEvents.trouble),
 * given whether it said the failure (`shown`). Not while the notice about a conflict copy shows
 * (where my version went, and that the copy mustn't go yet: it stays its time, and the top bar says
 * that saving fails), nor while the bar under the top bar says what to do already (no access any
 * more, too big, refused as sent); and that it works again only after it said the failure. Each
 * goes to screen readers once: said here, the top bar's indicator stays quiet (PageSaid), else it
 * speaks. Returns what to say ("failed", or "saved" when it works again; null: nothing), and
 * whether the failure is said now.
 */
export function troubleSaid(kind: "failed" | "recovered", shown: boolean, conflictShowing: boolean, banner: SaveNotice | null): { say: "failed" | "saved" | null; shown: boolean } {
  if (kind === "recovered") return { say: shown && !conflictShowing ? "saved" : null, shown: false };
  if (conflictShowing || banner === "denied" || banner === "tooBig" || banner === "rejected") return { say: null, shown: false };
  return { say: "failed", shown: true };
}

export type SheetSave = {
  state: SaveState;
  /** News about saving the editor's notices said themselves (for the top bar's indicator, which then doesn't). */
  said: PageSaid;
  /** A problem that stays until it is solved (no access any more, too big to save), or "large": close to the limit. */
  notice: SaveNotice | null;
  /** The spreadsheet's size when it was last saved (bytes, as the limit counts them; 0: not measured yet). */
  bytes: number;
  /**
   * While the spreadsheet is too big to save: the conflict copies (sheet ids) this editor's merges
   * made that make it so (ownBigCopies). Each holds my version of its sheet. (After a reload this
   * isn't known: a copy may hold someone else's version, collab.ts arrivedCopies.)
   */
  ownCopies: string[];
  /** Who else has the spreadsheet open (shared spreadsheets). */
  peers: Peer[];
  /** First name of whoever just changed something (shared spreadsheets), for a moment. */
  writer: string | null;
  /** The title was typed: saved with the content. */
  setTitle: (title: string) => void;
  /** Save now. */
  flush: () => Promise<void>;
};

export function useSheetSave({
  store,
  pageId,
  rev,
  title,
  readOnly,
  shared,
  userId,
  me,
  onTitle,
}: {
  store: SheetStore;
  pageId: string;
  /** The page's revision the store's workbook is (pages.rev). */
  rev: number;
  /** The page's title as loaded. */
  title: string;
  readOnly: boolean;
  /** Shared with others: who is here, and their saves announced on the live channel. */
  shared: boolean;
  userId: string;
  me: Me;
  /** A title from someone else's save (or a restored draft) to show. */
  onTitle: (title: string) => void;
}): SheetSave {
  const locale = useLocale();
  const t = useMessages(sheetText);
  const [state, setState] = useState<SaveState>("saved");
  const [said, setSaid] = useState<PageSaid>(null);
  const [notice, setNotice] = useState<SheetSave["notice"]>(null);
  const [bytes, setBytes] = useState(0);
  const [ownCopies, setOwnCopies] = useState<string[]>([]);
  const [writer, setWriter] = useState<string | null>(null);
  const saverRef = useRef<SheetSaver | null>(null);
  const live = useLive(shared ? `page:${pageId}` : null, me);
  const { updatePage } = useWorkspace();

  // Kept current for the long-lived saver.
  const latest = useRef({ live, onTitle, t, updatePage });
  useEffect(() => {
    latest.current = { live, onTitle, t, updatePage };
  });
  const initial = useRef({ rev, title, readOnly, locale, userId });

  useEffect(() => {
    const init = initial.current;
    /** The notice about conflict copies showing (its id), the bar's problem, and whether the notice said that saving fails (troubleSaid). */
    let conflictNotice = 0;
    let banner: SaveNotice | null = null;
    let failedShown = false;
    let news = 0;
    const saver = new SheetSaver({
      store,
      pageId,
      userId: init.userId,
      locale: init.locale,
      rev: init.rev,
      base: store.get().workbook,
      title: init.title,
      readOnly: init.readOnly,
      // What the person should hear about goes to the editor's notices (notice.ts): Blob's speech
      // bubble stays away on spreadsheets.
      on: {
        state: setState,
        notice: (next) => {
          banner = next;
          setNotice(next);
          // (Which copies make it too big is known only while it is.)
          if (next !== "tooBig") setOwnCopies([]);
        },
        size: setBytes,
        conflict: (found) => {
          setOwnCopies((had) => ownBigCopies(had, found));
          conflictNotice = showSheetNotice(store, latest.current.t.conflict(found), "info", { ms: 20_000 });
        },
        title: (next) => latest.current.onTitle(next),
        saved: (next) => {
          latest.current.live.send("sheet-saved", { rev: next });
          // Moves the spreadsheet's updated_at in this tab's page list (no request): a note
          // showing it here, say in a side pane, checks for the new values at once.
          void latest.current.updatePage(pageId, {}, { local: true });
        },
        restored: () => showSheetNotice(store, latest.current.t.restored, "done"),
        trouble: (kind) => {
          const next = troubleSaid(kind, failedShown, currentSheetNotice(store)?.id === conflictNotice, banner);
          failedShown = next.shown;
          if (!next.say) return;
          const { t } = latest.current;
          showSheetNotice(store, next.say === "failed" ? t.saveTrouble : t.saveBack, next.say === "failed" ? "error" : "done");
          setSaid({ state: next.say, n: ++news });
        },
      },
    });
    saverRef.current = saver;

    // Document changes (not the selection or the zoom): save in a moment.
    let version = store.get().version;
    const off = store.subscribe(() => {
      const v = store.get().version;
      if (v === version) return;
      version = v;
      saver.changed();
    });

    // Unsaved work from an earlier visit, put back.
    void saver.restore();

    // Leaving or hiding the page: the draft is written right away, the save goes out if it can.
    const hide = () => {
      saver.keepDraft();
      void saver.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("beforeunload", hide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      off();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("beforeunload", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      saverRef.current = null;
      // The last save still goes out after the editor has closed.
      void saver.close();
    };
  }, [store, pageId]);

  // Someone else saved (any device): fetch it and merge. A rename elsewhere (the revision stays)
  // comes with the row.
  useTableChanges<{ rev: number; title: string }>("pages", `id=eq.${pageId}`, (payload) => {
    if (payload.eventType !== "UPDATE") return;
    const row = payload.new as { rev?: unknown; title?: unknown };
    if (typeof row.rev === "number") void saverRef.current?.remoteRow(row.rev, row.title);
  });

  // …and said so on the live channel (quicker than the database's message, and names who it was).
  useEffect(() => {
    if (!shared) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = live.listen("sheet-saved", (data, from) => {
      const next = (data as { rev?: unknown } | null)?.rev;
      if (typeof next === "number") void saverRef.current?.remote(next);
      const who = live.peers.find((p) => p.key === from)?.name?.trim();
      if (!who) return;
      setWriter(who.split(" ")[0]);
      clearTimeout(timer);
      timer = setTimeout(() => setWriter(null), 2500);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [live, shared]);

  // Others see which sheet you are on.
  const sheetId = useSheet(store, (s) => s.sheetId);
  const { focus } = live;
  useEffect(() => focus(sheetId), [focus, sheetId]);

  const setTitle = useCallback((next: string) => saverRef.current?.setTitle(next), []);
  const flush = useCallback(async () => {
    await saverRef.current?.flush();
  }, []);

  return { state, said, notice, bytes, ownCopies, peers: live.peers, writer, setTitle, flush };
}
