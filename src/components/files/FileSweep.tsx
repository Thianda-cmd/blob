"use client";

import { useEffect } from "react";
import { removeFiles, unusedFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";

const DAY = 24 * 60 * 60 * 1000;
const key = (kind: string, id: string) => `blob-file-sweep:${kind}:${id}`;

/** The last look in this browser: when, and which files nothing referred to then. */
type Seen = { at: number; unused: string[] };

function loadSeen(kind: string, id: string): Seen | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(kind, id)) ?? "null");
    // An older version kept only the time.
    if (typeof raw === "number") return { at: raw, unused: [] };
    return raw && typeof raw.at === "number" && Array.isArray(raw.unused) ? raw : null;
  } catch {
    return null;
  }
}

/** When the note, or the board and its cards, last changed (ms); null when the server couldn't say. */
async function lastChange(kind: "page" | "project", id: string) {
  const supabase = createClient();
  if (kind === "page") {
    const { data, error } = await supabase.from("pages").select("updated_at").eq("id", id).maybeSingle();
    return error || !data ? null : Date.parse(data.updated_at);
  }
  const [project, card] = await Promise.all([
    supabase.from("projects").select("updated_at").eq("id", id).maybeSingle(),
    supabase.from("tasks").select("updated_at").eq("project_id", id).order("updated_at", { ascending: false }).limit(1),
  ]);
  if (project.error || !project.data || card.error) return null;
  return Math.max(Date.parse(project.data.updated_at), ...card.data.map((c) => Date.parse(c.updated_at)));
}

/**
 * Quietly removes the files of a note or project that nothing refers to any more (a file block that
 * was deleted, an upload that never made it onto a card). The server only knows when a file was
 * uploaded, not when its block went away, and a block deleted a minute ago can still come back
 * (undo, paste, a deleted card's undo). So a file only goes when this browser saw it unused on an
 * earlier visit at least a day ago and sees it unused again now, and only while the note or board
 * hasn't changed for a day. Mount it for people who can edit; it asks at most once a day per note or
 * project in this browser, and not at all while the note or board is in use.
 */
export function FileSweep({ kind, id }: { kind: "page" | "project"; id: string }) {
  useEffect(() => {
    const seen = loadSeen(kind, id);
    if (seen && Date.now() - seen.at < DAY) return;
    // A moment after opening, out of the way of the page loading.
    const timer = setTimeout(async () => {
      const since = await lastChange(kind, id);
      if (since === null || Date.now() - since < DAY) return;
      const unused = await unusedFiles(kind, id);
      // Changed while we asked: something removed just now may still come back.
      if (!unused || (await lastChange(kind, id)) !== since) return;
      const before = new Set(seen?.unused);
      const sure = unused.filter((p) => before.has(p));
      if (sure.length) await removeFiles(sure);
      try {
        localStorage.setItem(key(kind, id), JSON.stringify({ at: Date.now(), unused } satisfies Seen));
      } catch {
        // Without storage (private mode) nothing is remembered, so nothing is ever removed here.
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [kind, id]);
  return null;
}
