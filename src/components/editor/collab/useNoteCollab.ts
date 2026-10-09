"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Step } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { collab, getVersion, receiveTransaction, sendableSteps } from "prosemirror-collab";
import { useCallback, useEffect, useRef, useState } from "react";
import { tabId, useLive, useTableChanges, type Peer } from "@/lib/live";
import { createClient } from "@/lib/supabase/client";

// Working on one note together, with the database as the authority (ProseMirror's collab model):
// every change is a list of steps on top of a version. push_steps accepts them only on top of the
// newest version; whoever is behind first receives the others' steps (page_steps, via Realtime or
// a fetch), rebases their own and tries again. pages.content holds a snapshot at doc_version, saved
// by any editor whose steps are all confirmed (save_note_snapshot). Migration 0010 has the SQL.

export type CollabStatus = "off" | "connecting" | "live" | "offline" | "resyncing";

/** What the note saves next to its document in a snapshot. */
export type NoteSnapshot = { content: JSONContent; plain: string; links: string[] };

type StepRow = { version: number; steps: unknown[]; client_id: string };

const PUSH_DELAY = 120;
const SNAPSHOT_DELAY = 2500;
/** After a failed push: try again after 2 s, 4 s, 8 s … up to 30 s. */
const RETRY_FIRST = 2000;
const RETRY_MAX = 30_000;
/** Polling for steps (only while Realtime has been quiet for POLL_QUIET). */
const POLL_EVERY = 2500;
const POLL_QUIET = 15_000;

const cursorKey = new PluginKey<DecorationSet>("collabCursors");

/** Other people's carets and selections, drawn as decorations (positions are only shown at the same version). */
function cursorPlugin() {
  return new Plugin<DecorationSet>({
    key: cursorKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const next = tr.getMeta(cursorKey) as DecorationSet | undefined;
        return next ?? set.map(tr.mapping, tr.doc);
      },
    },
    props: { decorations: (state) => cursorKey.getState(state) },
  });
}

type RemoteCursor = { from: number; to: number; version: number; name: string; color: string };

/** prosemirror-collab's version, or null when the editor no longer runs the collab plugin. */
function versionOf(state: EditorState): number | null {
  try {
    return getVersion(state);
  } catch {
    return null;
  }
}

function unsentOf(state: EditorState) {
  try {
    return sendableSteps(state);
  } catch {
    return null;
  }
}

/**
 * One client id per editor instance. A rebuilt editor (after a reload) is a new client: its own
 * earlier steps, fetched again, are then applied as anyone else's (with the old id, prosemirror-collab
 * would take them for already applied and skip them).
 */
const clientIds = new WeakMap<Editor, string>();
function clientIdFor(editor: Editor) {
  let id = clientIds.get(editor);
  if (!id) {
    id = `${tabId()}-${Math.random().toString(36).slice(2, 8)}`;
    clientIds.set(editor, id);
  }
  return id;
}

/**
 * Best effort when an editor goes away (navigating, closing the tab, a rebuild): send what it
 * hasn't sent and save a snapshot, from data captured while it was still there. When someone else
 * wrote in between, the unsent steps can't be placed without the editor: they are dropped.
 */
async function flushOut({
  pageId,
  clientId,
  version,
  unsent,
  snapshot,
  waitIdle,
}: {
  pageId: string;
  clientId: string;
  version: number;
  unsent: { version: number; steps: Step[] } | null;
  snapshot: NoteSnapshot | null;
  waitIdle: () => Promise<void>;
}) {
  await waitIdle();
  const supabase = createClient();
  let at = version;
  if (unsent) {
    let base = unsent.version;
    let rest = unsent.steps;
    for (let tries = 0; tries < 3 && rest.length; tries++) {
      const { data, error } = await supabase.rpc("push_steps", { p_page: pageId, p_version: base, p_steps: rest.map((s) => s.toJSON()), p_client: clientId });
      if (error) return;
      if ((data as { ok?: boolean } | null)?.ok) {
        base += rest.length;
        rest = [];
        break;
      }
      // Behind: if the newer rows are ours (a push still on its way when the editor closed), skip those steps.
      const { data: rows } = await supabase.from("page_steps").select("version, steps, client_id").eq("page_id", pageId).gte("version", base).order("version");
      let moved = false;
      for (const row of (rows ?? []) as StepRow[]) {
        if (row.version !== base || row.client_id !== clientId) break;
        base += row.steps.length;
        rest = rest.slice(row.steps.length);
        moved = true;
      }
      if (!moved) return;
    }
    if (rest.length) return;
    at = base;
  }
  if (!snapshot) return;
  await supabase.rpc("save_note_snapshot", { p_page: pageId, p_version: at, p_content: snapshot.content, p_plain: snapshot.plain, p_links: snapshot.links });
}

function cursorDecorations(state: EditorState, cursors: Map<string, RemoteCursor>) {
  const version = getVersion(state);
  const size = state.doc.content.size;
  const decos: Decoration[] = [];
  for (const c of cursors.values()) {
    if (c.version !== version) continue;
    const from = Math.max(0, Math.min(c.from, size));
    const to = Math.max(0, Math.min(c.to, size));
    if (to > from) decos.push(Decoration.inline(from, to, { class: "collab-selection", style: `--peer: ${c.color}` }));
    decos.push(
      Decoration.widget(
        to,
        () => {
          const caret = document.createElement("span");
          caret.className = "collab-caret";
          caret.style.setProperty("--peer", c.color);
          const label = document.createElement("span");
          label.className = "collab-caret-label";
          label.textContent = c.name;
          caret.append(label);
          return caret;
        },
        { key: `caret-${c.name}-${c.color}`, side: 1 },
      ),
    );
  }
  return DecorationSet.create(state.doc, decos);
}

/**
 * Turns working-together on for a note editor while `enabled`. `version` is the page's doc_version:
 * the editor must have been created with pages.content at that version. While it is on, the note
 * must not save its content itself (only the title): the snapshot is saved here, through
 * `serialize`. Returns the connection status, who else is in the note, and `flush` (send everything
 * now and save a snapshot, e.g. before opening the study mode or going back to saving alone).
 */
export function useNoteCollab({
  editor,
  pageId,
  enabled,
  version,
  serialize,
  me,
  onResync,
  onStart,
}: {
  editor: Editor | null;
  pageId: string;
  enabled: boolean;
  version: number;
  serialize: (editor: Editor) => NoteSnapshot;
  me: { user_id: string; name: string; avatar_url: string | null };
  /** The note fell too far behind (or the history was reset): the caller reloads it from the server. */
  onResync: () => void;
  /**
   * The editor was just plugged in, at `version`, and is about to catch up with the others: a change
   * dispatched now is one of yours, rebased over their steps as they arrive.
   */
  onStart?: (editor: Editor) => void;
}): { status: CollabStatus; peers: Peer[]; flush: () => Promise<boolean> } {
  const [status, setStatus] = useState<CollabStatus>(enabled ? "connecting" : "off");
  const live = useLive(enabled ? `page:${pageId}` : null, me);
  const busy = useRef(false);
  const pushRef = useRef<() => Promise<void>>(async () => {});
  const again = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const snapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const failures = useRef(0);
  /** Editors whose collab plugin was taken out: nothing touches them any more. */
  const closed = useRef(new WeakSet<Editor>());
  const cursors = useRef(new Map<string, RemoteCursor>());
  /** When the last step arrived through Realtime. */
  const heard = useRef(0);
  const serializeRef = useRef(serialize);
  const resyncRef = useRef(onResync);
  const startRef = useRef(onStart);
  useEffect(() => {
    serializeRef.current = serialize;
    resyncRef.current = onResync;
    startRef.current = onStart;
  });

  const usable = useCallback((e: Editor | null): e is Editor => !!e && !e.isDestroyed && !closed.current.has(e), []);

  const redrawCursors = useCallback(() => {
    if (!usable(editor)) return;
    const { state, view } = editor;
    if (versionOf(state) === null) return;
    view.dispatch(state.tr.setMeta(cursorKey, cursorDecorations(state, cursors.current)).setMeta("addToHistory", false));
  }, [editor, usable]);

  /** Apply rows of steps that start exactly at our version (others are old or need a fetch). */
  const apply = useCallback(
    (rows: StepRow[]) => {
      if (!usable(editor)) return true;
      for (const row of rows.sort((a, b) => a.version - b.version)) {
        const current = versionOf(editor.state);
        if (current === null) return true;
        if (row.version + row.steps.length <= current) continue;
        if (row.version !== current) return false;
        try {
          const steps = row.steps.map((s) => Step.fromJSON(editor.schema, s));
          editor.view.dispatch(receiveTransaction(editor.state, steps, steps.map(() => row.client_id)));
        } catch {
          return false;
        }
      }
      return true;
    },
    [editor, usable],
  );

  /** Fetch every step we haven't got yet. False when the history doesn't reach back to our version. */
  const pull = useCallback(async () => {
    if (!usable(editor)) return true;
    const from = versionOf(editor.state);
    if (from === null) return true;
    const { data, error } = await createClient()
      .from("page_steps")
      .select("version, steps, client_id")
      .eq("page_id", pageId)
      .gte("version", Math.max(0, from - 500))
      .order("version");
    if (error) {
      setStatus("offline");
      return true;
    }
    setStatus((s) => (s === "offline" ? "live" : s));
    const rows = (data ?? []) as StepRow[];
    const fresh = rows.filter((r) => r.version + r.steps.length > from);
    if (fresh.length && fresh[0].version > from) return false;
    return apply(fresh);
  }, [editor, pageId, apply, usable]);

  const resync = useCallback(() => {
    setStatus("resyncing");
    resyncRef.current();
  }, []);

  /** Store the document at our version, when all our steps are confirmed. */
  const saveSnapshot = useCallback(async () => {
    clearTimeout(snapTimer.current);
    snapTimer.current = undefined;
    if (!usable(editor) || unsentOf(editor.state)) return false;
    const at = versionOf(editor.state);
    if (at === null) return false;
    const snap = serializeRef.current(editor);
    const { data, error } = await createClient().rpc("save_note_snapshot", {
      p_page: pageId,
      p_version: at,
      p_content: snap.content,
      p_plain: snap.plain,
      p_links: snap.links,
    });
    return !error && data !== false;
  }, [editor, pageId, usable]);

  const scheduleSnapshot = useCallback(() => {
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => void saveSnapshot(), SNAPSHOT_DELAY);
  }, [saveSnapshot]);

  const scheduleRetry = useCallback(() => {
    clearTimeout(retryTimer.current);
    const wait = Math.min(RETRY_MAX, RETRY_FIRST * 2 ** failures.current);
    failures.current++;
    retryTimer.current = setTimeout(() => void pushRef.current(), wait);
  }, []);

  /** Send our unconfirmed steps; if someone was faster, take theirs first and try again. */
  const push = useCallback(async () => {
    if (!usable(editor)) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    clearTimeout(retryTimer.current);
    const clientId = clientIdFor(editor);
    let sent = false;
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        if (!usable(editor)) break;
        const sendable = unsentOf(editor.state);
        if (!sendable) break;
        const steps = sendable.steps;
        const { data, error } = await createClient().rpc("push_steps", {
          p_page: pageId,
          p_version: sendable.version,
          p_steps: steps.map((s) => s.toJSON()),
          p_client: clientId,
        });
        if (!usable(editor)) break;
        if (error) {
          // No connection (or the server had a hiccup): keep the steps and try again a little later.
          setStatus("offline");
          scheduleRetry();
          break;
        }
        const result = data as { ok: boolean; version?: number; reason?: string };
        if (result.ok) {
          // Our steps are now the authority's: confirm them (they come back with our client id), unless a
          // fetch in the meantime already brought them back to us.
          if (versionOf(editor.state) === sendable.version) editor.view.dispatch(receiveTransaction(editor.state, steps, steps.map(() => clientId)));
          failures.current = 0;
          sent = true;
          setStatus("live");
          continue;
        }
        if (result.reason === "denied") {
          setStatus("offline");
          break;
        }
        // The server is behind us: the history was reset (the note was saved outside working-together).
        if (typeof result.version === "number" && result.version < sendable.version) {
          resync();
          break;
        }
        if (!(await pull())) {
          resync();
          break;
        }
      }
    } finally {
      busy.current = false;
    }
    if (again.current) {
      again.current = false;
      void pushRef.current();
    } else if (sent) {
      scheduleSnapshot();
    }
  }, [editor, pageId, pull, resync, scheduleSnapshot, scheduleRetry, usable]);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  /** Send everything now and save a snapshot (false when that didn't work, e.g. offline). */
  const flush = useCallback(async () => {
    if (!enabled || !usable(editor)) return true;
    clearTimeout(pushTimer.current);
    await pushRef.current();
    for (let i = 0; i < 40 && usable(editor) && (busy.current || unsentOf(editor.state)); i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!busy.current && unsentOf(editor.state)) await pushRef.current();
    }
    if (!usable(editor) || unsentOf(editor.state)) return false;
    return saveSnapshot();
  }, [enabled, editor, saveSnapshot, usable]);

  // Plug the collab plugin (and remote carets) into the editor while working together.
  useEffect(() => {
    if (!enabled || !editor || editor.isDestroyed) return;
    const closedSet = closed.current;
    // (React's development double-mount closes and reopens the same editor.)
    closedSet.delete(editor);
    const clientId = clientIdFor(editor);
    const plugins = [collab({ version, clientID: clientId }), cursorPlugin()];
    for (const p of plugins) editor.registerPlugin(p);
    const startVersion = version;
    // A moment later (React's development double-mount plugs the editor in twice right away).
    const start = setTimeout(() => {
      if (!usable(editor)) return;
      startRef.current?.(editor);
      void pull().then((ok) => {
        if (!usable(editor)) return;
        if (!ok) return resync();
        setStatus("live");
        // Caught up with steps nobody saved a snapshot of (someone left right after typing): save one.
        if ((versionOf(editor.state) ?? startVersion) > startVersion) scheduleSnapshot();
      });
    }, 0);
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean; getMeta: (k: string) => unknown } }) => {
      if (!transaction.docChanged || transaction.getMeta("collab$")) return;
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void push(), PUSH_DELAY);
    };
    editor.on("transaction", onUpdate as never);

    /** What this editor still owes the server, captured now (the editor may be gone a moment later). */
    const capture = () => {
      if (editor.isDestroyed || closedSet.has(editor)) return null;
      const at = versionOf(editor.state);
      if (at === null) return null;
      const unsent = unsentOf(editor.state);
      const snapshotDue = !!unsent || snapTimer.current !== undefined;
      return {
        pageId,
        clientId,
        version: at,
        unsent: unsent ? { version: unsent.version, steps: [...unsent.steps] } : null,
        snapshot: snapshotDue ? serializeRef.current(editor) : null,
        waitIdle: async () => {
          for (let i = 0; i < 30 && busy.current; i++) await new Promise((r) => setTimeout(r, 100));
        },
      };
    };
    // Leaving the page (closing the tab, going to another site): send what's left, as far as we get.
    const onPageHide = () => {
      const owed = capture();
      if (owed && (owed.unsent || owed.snapshot)) void flushOut(owed);
    };
    // Steps not yet sent: the browser asks before the tab closes.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editor.isDestroyed || !unsentOf(editor.state)) return;
      void push();
      e.preventDefault();
    };
    // Back online, or back to the tab: try again right away.
    const onOnline = () => {
      failures.current = 0;
      void pushRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onOnline();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(start);
      editor.off("transaction", onUpdate as never);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(pushTimer.current);
      clearTimeout(retryTimer.current);
      // Going elsewhere in the app (or the editor is rebuilt): what this editor still owes goes out
      // in the background instead of being dropped.
      const owed = capture();
      clearTimeout(snapTimer.current);
      snapTimer.current = undefined;
      closedSet.add(editor);
      if (owed && (owed.unsent || owed.snapshot)) void flushOut(owed);
      // collab()'s plugin key is "collab$".
      if (!editor.isDestroyed) editor.unregisterPlugin(["collab$", cursorKey]);
    };
    // Re-plugging on every version would reset the collab state; the version only matters at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, editor]);

  // Steps from the others, as soon as they are stored.
  useTableChanges<StepRow>("page_steps", enabled ? `page_id=eq.${pageId}` : null, (payload) => {
    if (payload.eventType !== "INSERT" || !usable(editor)) return;
    const row = payload.new as StepRow;
    if (row.client_id === clientIdFor(editor)) return;
    heard.current = Date.now();
    if (!apply([row])) void pull().then((ok) => !ok && resync());
    redrawCursors();
  });

  // A safety net when Realtime is quiet (some school networks block it, connections drop): look for
  // new steps every few seconds while the note is visible.
  useEffect(() => {
    if (!enabled || !editor) return;
    const poll = async () => {
      if (busy.current || !usable(editor) || document.hidden || Date.now() - heard.current < POLL_QUIET) return;
      busy.current = true;
      try {
        if (!(await pull())) resync();
      } finally {
        busy.current = false;
      }
      redrawCursors();
      if (again.current) {
        again.current = false;
        void pushRef.current();
      }
    };
    const timer = setInterval(() => void poll(), POLL_EVERY);
    return () => clearInterval(timer);
  }, [enabled, editor, pull, resync, redrawCursors, usable]);

  // Carets: send ours when the selection moves, draw theirs.
  useEffect(() => {
    if (!enabled || !editor) return;
    const send = () => {
      if (!usable(editor)) return;
      const { from, to } = editor.state.selection;
      const at = versionOf(editor.state);
      if (at === null) return;
      live.send("cursor", { from, to, version: at, name: me.name, color: "" });
    };
    editor.on("selectionUpdate", send);
    const stop = live.listen("cursor", (data, from) => {
      const c = data as RemoteCursor;
      const peer = live.peers.find((p) => p.key === from);
      cursors.current.set(from, { ...c, name: peer?.name || c.name, color: peer?.color || c.color || "#6d3df5" });
      redrawCursors();
    });
    return () => {
      editor.off("selectionUpdate", send);
      stop();
    };
  }, [enabled, editor, live, me.name, redrawCursors, usable]);

  // Forget the carets of people who left.
  useEffect(() => {
    const keys = new Set(live.peers.map((p) => p.key));
    let changed = false;
    for (const k of cursors.current.keys())
      if (!keys.has(k)) {
        cursors.current.delete(k);
        changed = true;
      }
    if (changed) redrawCursors();
  }, [live.peers, redrawCursors]);

  return { status: enabled ? status : "off", peers: live.peers, flush };
}
