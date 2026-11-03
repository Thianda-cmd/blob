"use client";

// Saving and working together for the spreadsheet page (the logic is in saver.ts): watches the
// store, saves a moment after each change, keeps unsaved work on the device, pulls in other
// people's saves as they happen (Realtime on the page row, and a "saved" broadcast on the page's
// live channel when it is shared) and says who is here.

import { useCallback, useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import type { SaveState } from "@/components/page/useAutosave";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { sheetText } from "@/i18n/messages/sheet";
import { useLive, useTableChanges, type Peer } from "@/lib/live";
import { markSheetOpen } from "./drafts";
import { SheetSaver } from "./saver";
import { useSheet, type SheetStore } from "./store";

type Me = { user_id: string; name: string; avatar_url: string | null };

export type SheetSave = {
  state: SaveState;
  /** A problem that stays until it is solved (no access any more, too big to save). */
  notice: "denied" | "tooBig" | null;
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
  const words = useMessages(pageText);
  const [state, setState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<SheetSave["notice"]>(null);
  const [writer, setWriter] = useState<string | null>(null);
  const saverRef = useRef<SheetSaver | null>(null);
  const live = useLive(shared ? `page:${pageId}` : null, me);
  const { updatePage } = useWorkspace();

  // Kept current for the long-lived saver.
  const latest = useRef({ live, onTitle, t, words, updatePage });
  useEffect(() => {
    latest.current = { live, onTitle, t, words, updatePage };
  });
  const initial = useRef({ rev, title, readOnly, locale, userId });

  useEffect(() => {
    const init = initial.current;
    const saver = new SheetSaver({
      store,
      pageId,
      userId: init.userId,
      locale: init.locale,
      rev: init.rev,
      base: store.get().workbook,
      title: init.title,
      readOnly: init.readOnly,
      on: {
        state: setState,
        notice: setNotice,
        title: (next) => latest.current.onTitle(next),
        saved: (next) => {
          latest.current.live.send("sheet-saved", { rev: next });
          // Moves the spreadsheet's updated_at in this tab's page list (no request): a note
          // showing it here, say in a side pane, checks for the new values at once.
          void latest.current.updatePage(pageId, {}, { local: true });
        },
        restored: () => blob.say(latest.current.t.restored, { mood: "happy", ms: 5000 }),
        trouble: (kind) =>
          kind === "failed" ? blob.say(latest.current.words.cantReach, { mood: "worried" }) : blob.say(latest.current.words.backOnline, { mood: "happy" }),
      },
    });
    saverRef.current = saver;
    const unmark = markSheetOpen(pageId);

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
      unmark();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("beforeunload", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      saverRef.current = null;
      // The last save still goes out after the editor has closed.
      void saver.close();
    };
  }, [store, pageId]);

  // Someone else saved (any device): fetch it and merge.
  useTableChanges<{ rev: number }>("pages", `id=eq.${pageId}`, (payload) => {
    if (payload.eventType !== "UPDATE") return;
    const next = (payload.new as { rev?: unknown }).rev;
    if (typeof next === "number") void saverRef.current?.remote(next);
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

  return { state, notice, peers: live.peers, writer, setTitle, flush };
}
