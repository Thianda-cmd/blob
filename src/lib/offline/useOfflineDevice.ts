"use client";

import { useEffect, useRef } from "react";
import { noteCache } from "@/components/editor/noteCache";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { blobApp } from "@/lib/native";
import { registerOffline, warmOffline } from "./device";
import { isOnline, onConnectivity } from "./net";
import { blob } from "@/components/blob/bus";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { flushWaitingNotes, settleOwed, syncNoteCopies } from "./notes";
import { flushReviews } from "./reviews";

/** Pages the app keeps for offline use besides the notes themselves. */
const MAIN_PAGES = ["/home", "/notes", "/calendar", "/tasks", "/projects", "/learn", "/cv", "/settings", "/notes/offline"];
const RECENT_PAGES = 25;

/**
 * Keeps this device ready to work without a connection. Everywhere: unsaved note text stays on
 * the device (noteCache), and shared-note edits that couldn't be sent go out later. In the apps
 * also: the offline helper (public/sw.js) with the main pages and recent notes, and a copy of every
 * note's text.
 */
export function useOfflineDevice() {
  const { userId, pages, reloadPages } = useWorkspace();
  const words = useMessages(offlineText).notes;
  const latest = useRef({ pages, words, reloadPages });
  useEffect(() => {
    latest.current = { pages, words, reloadPages };
  });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const app = !!blobApp();

    const catchUp = async () => {
      if (!alive || !isOnline()) return;
      const onConflict = (message: string) => {
        blob.say(message, { mood: "thinking", ms: 8000 });
        void latest.current.reloadPages();
      };
      await Promise.all([settleOwed(userId, latest.current.words, onConflict), flushReviews(userId)]);
      // Notes written offline whose editor was closed before they were saved.
      await flushWaitingNotes(userId, latest.current.words, onConflict);
      if (!app) return;
      await syncNoteCopies(userId, latest.current.pages);
      await noteCache.loadCopies(userId);
    };

    void noteCache.load(userId).then(async () => {
      if (!alive) return;
      if (app) await registerOffline(userId);
      await catchUp();
    });

    // When things are quiet: the pages for offline use (every few hours).
    const idle = setTimeout(() => {
      if (!alive || !app) return;
      const recent = latest.current.pages
        .filter((p) => (p.kind === "note" || p.kind === "deck") && !p.trashed_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, RECENT_PAGES)
        .map((p) => `/p/${p.id}`);
      void warmOffline([...MAIN_PAGES, ...recent]);
    }, 8000);

    // Back online, or back in the app after a while: catch up.
    const off = onConnectivity(() => {
      if (isOnline()) void catchUp();
    });
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) void catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(idle);
      off();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);
}
