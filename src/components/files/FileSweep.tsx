"use client";

import { useEffect } from "react";
import { removeUnusedFiles } from "@/lib/files";

const DAY = 24 * 60 * 60 * 1000;
const key = (kind: string, id: string) => `blob-file-sweep:${kind}:${id}`;

/**
 * Quietly removes the files of a note or project that nothing refers to any more (a file block that
 * was deleted, an upload that never made it into the note). Only files at least a day old go, so
 * undo still brings a block back with its file. Mount it for people who can edit; it runs at most
 * once a day per note or project in this browser.
 */
export function FileSweep({ kind, id }: { kind: "page" | "project"; id: string }) {
  useEffect(() => {
    try {
      if (Date.now() - Number(localStorage.getItem(key(kind, id)) ?? 0) < DAY) return;
    } catch {
      // Without storage (private mode) it runs on every visit, which is still harmless.
    }
    // Soon after opening: a block deleted in this visit can't have been saved yet (a note saves a
    // couple of seconds after the last change), so its file is still counted as used.
    const timer = setTimeout(async () => {
      if ((await removeUnusedFiles(kind, id)) === null) return;
      try {
        localStorage.setItem(key(kind, id), String(Date.now()));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [kind, id]);
  return null;
}
