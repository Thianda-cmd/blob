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
 * Turns working-together on for a note editor while `enabled` (a shared note). `version` is the
 * page's doc_version: the editor must have been created with pages.content at that version.
 * While it is on, the note must not save its content itself (only the title): the snapshot is
 * saved here, through `serialize`. Returns the connection status and who else is in the note.
 */
export function useNoteCollab({
  editor,
  pageId,
  enabled,
  version,
  serialize,
  me,
  onResync,
}: {
  editor: Editor | null;
  pageId: string;
  enabled: boolean;
  version: number;
  serialize: (editor: Editor) => NoteSnapshot;
  me: { user_id: string; name: string; avatar_url: string | null };
  /** The note fell too far behind (or the history was reset): the caller reloads it from the server. */
  onResync: () => void;
}): { status: CollabStatus; peers: Peer[] } {
  const [status, setStatus] = useState<CollabStatus>(enabled ? "connecting" : "off");
  const live = useLive(enabled ? `page:${pageId}` : null, me);
  // One id per editor instance (tabs and remounts count as different clients).
  const [clientId] = useState(() => `${tabId()}-${Math.random().toString(36).slice(2, 8)}`);
  const busy = useRef(false);
  const pushRef = useRef<() => Promise<void>>(async () => {});
  const again = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const snapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cursors = useRef(new Map<string, RemoteCursor>());
  const serializeRef = useRef(serialize);
  const resyncRef = useRef(onResync);
  useEffect(() => {
    serializeRef.current = serialize;
    resyncRef.current = onResync;
  });

  const redrawCursors = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { state, view } = editor;
    view.dispatch(state.tr.setMeta(cursorKey, cursorDecorations(state, cursors.current)).setMeta("addToHistory", false));
  }, [editor]);

  /** Apply rows of steps that start exactly at our version (others are old or need a fetch). */
  const apply = useCallback(
    (rows: StepRow[]) => {
      if (!editor || editor.isDestroyed) return true;
      for (const row of rows.sort((a, b) => a.version - b.version)) {
        const current = getVersion(editor.state);
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
    [editor],
  );

  /** Fetch every step we haven't got yet. False when the history doesn't reach back to our version. */
  const pull = useCallback(async () => {
    if (!editor || editor.isDestroyed) return true;
    const from = getVersion(editor.state);
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
    const rows = (data ?? []) as StepRow[];
    const fresh = rows.filter((r) => r.version + r.steps.length > from);
    if (fresh.length && fresh[0].version > from) return false;
    return apply(fresh);
  }, [editor, pageId, apply]);

  const resync = useCallback(() => {
    setStatus("resyncing");
    resyncRef.current();
  }, []);

  const scheduleSnapshot = useCallback(() => {
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(async () => {
      if (!editor || editor.isDestroyed || sendableSteps(editor.state)) return;
      const snap = serializeRef.current(editor);
      await createClient().rpc("save_note_snapshot", {
        p_page: pageId,
        p_version: getVersion(editor.state),
        p_content: snap.content,
        p_plain: snap.plain,
        p_links: snap.links,
      });
    }, SNAPSHOT_DELAY);
  }, [editor, pageId]);

  /** Send our unconfirmed steps; if someone was faster, take theirs first and try again. */
  const push = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        const sendable = sendableSteps(editor.state);
        if (!sendable) break;
        const steps = sendable.steps;
        const { data, error } = await createClient().rpc("push_steps", {
          p_page: pageId,
          p_version: sendable.version,
          p_steps: steps.map((s) => s.toJSON()),
          p_client: clientId,
        });
        if (error) {
          setStatus("offline");
          break;
        }
        const result = data as { ok: boolean; version?: number; reason?: string };
        if (result.ok) {
          // Our steps are now the authority's: confirm them (they come back with our client id).
          if (!editor.isDestroyed) editor.view.dispatch(receiveTransaction(editor.state, steps, steps.map(() => clientId)));
          setStatus("live");
          continue;
        }
        if (result.reason === "denied") {
          setStatus("offline");
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
    } else {
      scheduleSnapshot();
    }
  }, [editor, pageId, clientId, pull, resync, scheduleSnapshot]);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  // Plug the collab plugin (and remote carets) into the editor while working together.
  useEffect(() => {
    if (!enabled || !editor || editor.isDestroyed) return;
    const plugins = [collab({ version, clientID: clientId }), cursorPlugin()];
    for (const p of plugins) editor.registerPlugin(p);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pull() only sets state after the network answers
    void pull().then((ok) => {
      if (!ok) resync();
      else setStatus("live");
    });
    const onUpdate = ({ transaction }: { transaction: { docChanged: boolean; getMeta: (k: string) => unknown } }) => {
      if (!transaction.docChanged || transaction.getMeta("collab$")) return;
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void push(), PUSH_DELAY);
    };
    editor.on("transaction", onUpdate as never);
    return () => {
      editor.off("transaction", onUpdate as never);
      clearTimeout(pushTimer.current);
      clearTimeout(snapTimer.current);
      // collab()'s plugin key is "collab$".
      if (!editor.isDestroyed) editor.unregisterPlugin(["collab$", cursorKey]);
    };
    // Re-plugging on every version would reset the collab state; the version only matters at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, editor]);

  // Steps from the others, as soon as they are stored.
  useTableChanges<StepRow>("page_steps", enabled ? `page_id=eq.${pageId}` : null, (payload) => {
    if (payload.eventType !== "INSERT" || !editor || editor.isDestroyed) return;
    const row = payload.new as StepRow;
    if (row.client_id === clientId) return;
    if (!apply([row])) void pull().then((ok) => !ok && resync());
    redrawCursors();
  });

  // Carets: send ours when the selection moves, draw theirs.
  useEffect(() => {
    if (!enabled || !editor) return;
    const send = () => {
      if (editor.isDestroyed) return;
      const { from, to } = editor.state.selection;
      live.send("cursor", { from, to, version: getVersion(editor.state), name: me.name, color: "" });
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
  }, [enabled, editor, live, me.name, redrawCursors]);

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

  return { status: enabled ? status : "off", peers: live.peers };
}
