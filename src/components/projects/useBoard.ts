"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { loadMembers } from "@/components/share/useMembers";
import { useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { useLive, useTableChanges } from "@/lib/live";
import { removeFile } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member, Project, ProjectColumn, Task } from "@/lib/types";
import { uid } from "@/lib/utils";
import { byPosition, positionBetween, spacedPositions, tooClose } from "./model";

export type BoardData = { project: Project; columns: ProjectColumn[]; cards: Task[]; members: Member[]; role: AccessRole };
export type Me = { user_id: string; name: string; avatar_url: string | null };

export type CardPatch = Partial<
  Pick<Task, "title" | "details" | "due_at" | "priority" | "assignees" | "labels" | "checklist" | "attachments" | "column_id" | "position" | "done">
>;
export type ColumnPatch = Partial<Pick<ProjectColumn, "title" | "color" | "position" | "done">>;
export type ProjectPatch = Partial<Pick<Project, "title" | "description" | "icon" | "color" | "subject_id" | "due_at" | "archived_at">>;

type Table = "tasks" | "project_columns" | "projects";
type Row = { id: string } & Record<string, unknown>;

const sortColumns = (list: ProjectColumn[]) => [...list].sort(byPosition);

/** Broadcasts on the project's live channel (things Postgres changes can't tell: deletions, member changes). */
const GONE = "gone";
const MEMBERS = "members";

/** Count a write of `fields` on row `key` as in flight (several writes of one field may overlap). */
function begin(inflight: Map<string, Map<string, number>>, key: string, fields: string[]) {
  const map = inflight.get(key) ?? new Map<string, number>();
  for (const f of fields) map.set(f, (map.get(f) ?? 0) + 1);
  inflight.set(key, map);
}

function end(inflight: Map<string, Map<string, number>>, key: string, fields: string[]) {
  const map = inflight.get(key);
  if (!map) return;
  for (const f of fields) {
    const n = (map.get(f) ?? 1) - 1;
    if (n <= 0) map.delete(f);
    else map.set(f, n);
  }
  if (!map.size) inflight.delete(key);
}

/**
 * A project board in the browser: the project, its columns, cards and members, with optimistic
 * writes (the screen changes at once, Supabase follows) and live updates from everyone else.
 *
 * Remote changes never undo what you are typing or moving: fields with a write of yours in flight
 * keep your value, and the row is fetched again once your write is done if someone else changed it
 * meanwhile. Positions are fractional (one row per move); a column is renumbered when two
 * neighbours get too close.
 */
export function useBoard(initial: BoardData, me: Me) {
  const t = useMessages(projectsText);
  const id = initial.project.id;
  const [project, setProject] = useState(initial.project);
  const [columns, setColumns] = useState(() => sortColumns(initial.columns));
  const [cards, setCards] = useState(initial.cards);
  const [members, setMembers] = useState(initial.members);
  const [role, setRole] = useState<AccessRole | null>(initial.role);
  const [gone, setGone] = useState<null | "removed" | "deleted">(null);
  const [removed, setRemoved] = useState<Task | null>(null);

  // Mirrors, so async handlers always build on the latest state.
  const projectRef = useRef(project);
  const columnsRef = useRef(columns);
  const cardsRef = useRef(cards);
  const inflight = useRef(new Map<string, Map<string, number>>());
  const stale = useRef(new Set<string>());

  const live = useLive(gone ? null : `project:${id}`, me);
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });

  const commitCards = useCallback((fn: (prev: Task[]) => Task[]) => {
    cardsRef.current = fn(cardsRef.current);
    setCards(cardsRef.current);
  }, []);
  const commitColumns = useCallback((fn: (prev: ProjectColumn[]) => ProjectColumn[]) => {
    columnsRef.current = sortColumns(fn(columnsRef.current));
    setColumns(columnsRef.current);
  }, []);
  const commitProject = useCallback((fn: (prev: Project) => Project) => {
    projectRef.current = fn(projectRef.current);
    setProject(projectRef.current);
  }, []);

  const oops = useCallback(() => {
    blob.say(t.errSave, { mood: "worried" });
    blob.react("shake", "worried");
  }, [t]);

  /* ----- Applying rows from the server ----- */

  /** A row from the server, keeping the fields we are still writing. */
  const merge = useCallback(<T extends Row>(table: Table, local: T | undefined, remote: T): T => {
    const key = `${table}:${remote.id}`;
    const pending = inflight.current.get(key);
    if (!local || !pending?.size) return remote;
    const out: Row = { ...remote };
    for (const field of pending.keys()) {
      if (JSON.stringify(local[field]) !== JSON.stringify(remote[field])) stale.current.add(key);
      out[field] = local[field];
    }
    return out as T;
  }, []);

  const applyRow = useCallback(
    (table: Table, row: Row | null, removedId?: string) => {
      if (table === "projects") {
        if (row) commitProject((p) => merge("projects", p as unknown as Row, row) as unknown as Project);
        return;
      }
      const targetId = row?.id ?? removedId;
      if (!targetId) return;
      if (table === "tasks") {
        commitCards((list) => {
          const i = list.findIndex((c) => c.id === targetId);
          if (!row) return i < 0 ? list : list.filter((c) => c.id !== targetId);
          const next = merge("tasks", list[i] as unknown as Row, row) as unknown as Task;
          return i < 0 ? [...list, next] : list.map((c, j) => (j === i ? next : c));
        });
      } else {
        commitColumns((list) => {
          const i = list.findIndex((c) => c.id === targetId);
          if (!row) return i < 0 ? list : list.filter((c) => c.id !== targetId);
          const next = merge("project_columns", list[i] as unknown as Row, row) as unknown as ProjectColumn;
          return i < 0 ? [...list, next] : list.map((c, j) => (j === i ? next : c));
        });
      }
    },
    [commitCards, commitColumns, commitProject, merge],
  );

  const refetchRow = useCallback(
    async (table: Table, rowId: string) => {
      const { data } = await createClient().from(table).select("*").eq("id", rowId).maybeSingle();
      applyRow(table, (data as Row | null) ?? null, rowId);
    },
    [applyRow],
  );

  /** Everything again (after the tab slept: deletions may have been missed). */
  const refetchAll = useCallback(async () => {
    const supabase = createClient();
    const [p, cols, list] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_columns").select("*").eq("project_id", id),
      supabase.from("tasks").select("*").eq("project_id", id),
    ]);
    if (!p.error && !p.data) {
      setGone("deleted");
      return;
    }
    if (p.data) applyRow("projects", p.data as Row);
    if (cols.data) {
      const remote = cols.data as ProjectColumn[];
      commitColumns((local) => [
        ...remote.map((r) => merge("project_columns", local.find((c) => c.id === r.id) as unknown as Row, r as unknown as Row) as unknown as ProjectColumn),
        ...local.filter((c) => !remote.some((r) => r.id === c.id) && inflight.current.has(`project_columns:${c.id}`)),
      ]);
    }
    if (list.data) {
      const remote = list.data as Task[];
      // Cards still being added by us aren't on the server yet: keep them.
      commitCards((local) => [
        ...remote.map((r) => merge("tasks", local.find((c) => c.id === r.id) as unknown as Row, r as unknown as Row) as unknown as Task),
        ...local.filter((c) => !remote.some((r) => r.id === c.id) && inflight.current.has(`tasks:${c.id}`)),
      ]);
    }
  }, [id, applyRow, commitCards, commitColumns, merge]);

  /* ----- Writing ----- */

  const write = useCallback(
    async (table: Table, rowId: string, patch: Record<string, unknown>) => {
      const key = `${table}:${rowId}`;
      const fields = Object.keys(patch);
      begin(inflight.current, key, fields);
      const { error } = await createClient().from(table).update(patch).eq("id", rowId);
      end(inflight.current, key, fields);
      if (error || (stale.current.has(key) && !inflight.current.has(key))) {
        stale.current.delete(key);
        await refetchRow(table, rowId);
      }
      if (error) oops();
      return !error;
    },
    [refetchRow, oops],
  );

  /* ----- Live ----- */

  useTableChanges<Row>("tasks", gone ? null : `project_id=eq.${id}`, (payload) => {
    if (payload.eventType === "DELETE") applyRow("tasks", null, (payload.old as Row).id);
    else applyRow("tasks", payload.new as Row);
  });
  useTableChanges<Row>("project_columns", gone ? null : `project_id=eq.${id}`, (payload) => {
    if (payload.eventType === "DELETE") applyRow("project_columns", null, (payload.old as Row).id);
    else applyRow("project_columns", payload.new as Row);
  });
  useTableChanges<Row>("projects", gone ? null : `id=eq.${id}`, (payload) => {
    if (payload.eventType === "UPDATE") applyRow("projects", payload.new as Row);
  });

  const reloadMembers = useCallback(async () => {
    const next = await loadMembers({ type: "project", id });
    if (!next.role) {
      setGone("removed");
      return;
    }
    setMembers(next.members);
    setRole(next.role);
  }, [id]);

  useTableChanges<Row>("project_members", gone ? null : `project_id=eq.${id}`, () => void reloadMembers());

  useEffect(() => {
    const offGone = live.listen(GONE, (data) => {
      const d = data as { table?: Table; id?: string } | null;
      if (!d?.table || !d.id) return;
      // Only what the database says counts: ask it instead of trusting the message.
      if (d.table === "projects") void refetchAll();
      else if (d.table === "tasks" || d.table === "project_columns") void refetchRow(d.table, d.id);
    });
    const offMembers = live.listen(MEMBERS, () => void reloadMembers());
    return () => {
      offGone();
      offMembers();
    };
  }, [live, refetchAll, refetchRow, reloadMembers]);

  // Whatever changed between the server's render and the live channel joining.
  useEffect(() => {
    const timer = setTimeout(() => void refetchAll(), 1500);
    return () => clearTimeout(timer);
  }, [refetchAll]);

  // Back after a while (laptop lid, other tab): catch up on what the live updates may have missed.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 20_000) {
        void refetchAll();
        void reloadMembers();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refetchAll, reloadMembers]);

  /* ----- Cards ----- */

  const cardsIn = useCallback(
    (columnId: string) => {
      const first = columnsRef.current[0]?.id;
      const known = new Set(columnsRef.current.map((c) => c.id));
      return cardsRef.current.filter((c) => (c.column_id && known.has(c.column_id) ? c.column_id : first) === columnId).sort(byPosition);
    },
    [],
  );

  const celebrate = useCallback(() => {
    const doneCols = new Set(columnsRef.current.filter((c) => c.done).map((c) => c.id));
    const all = cardsRef.current;
    if (all.length >= 3 && all.every((c) => c.done || (c.column_id && doneCols.has(c.column_id)))) {
      blob.react("celebrate", "excited", 2600, "cap");
      blob.say(t.allDone, { mood: "love", ms: 4200 });
    } else {
      blob.react("jump", "excited");
    }
  }, [t]);

  const addCard = useCallback(
    async (columnId: string, title: string, opts: { top?: boolean } = {}) => {
      const clean = title.trim().slice(0, 200);
      const column = columnsRef.current.find((c) => c.id === columnId);
      if (!clean || !column) return null;
      const list = cardsIn(columnId);
      const position = opts.top ? positionBetween(null, list[0]?.position) : positionBetween(list[list.length - 1]?.position, null);
      const now = new Date().toISOString();
      const card: Task = {
        id: uid(),
        user_id: me.user_id,
        subject_id: null,
        title: clean,
        details: null,
        kind: "project",
        due_at: null,
        done: column.done,
        completed_at: column.done ? now : null,
        status: column.done ? "done" : "todo",
        project_id: id,
        column_id: columnId,
        position,
        priority: 0,
        assignees: [],
        labels: [],
        checklist: [],
        attachments: [],
        created_at: now,
        updated_at: now,
      };
      commitCards((list) => [...list, card]);
      const key = `tasks:${card.id}`;
      begin(inflight.current, key, ["id"]);
      const { error } = await createClient()
        .from("tasks")
        .insert({ id: card.id, title: card.title, kind: "project", project_id: id, column_id: columnId, position, done: column.done });
      end(inflight.current, key, ["id"]);
      if (error) {
        commitCards((list) => list.filter((c) => c.id !== card.id));
        oops();
        return null;
      }
      return card;
    },
    [cardsIn, commitCards, id, me.user_id, oops],
  );

  const updateCard = useCallback(
    (cardId: string, patch: CardPatch) => {
      const before = cardsRef.current.find((c) => c.id === cardId);
      if (!before) return Promise.resolve(false);
      const full: CardPatch = { ...patch };
      if (full.title !== undefined) {
        full.title = full.title.trim().slice(0, 200);
        if (!full.title) return Promise.resolve(false);
      }
      if (full.details !== undefined) full.details = full.details ? full.details.slice(0, 8000) : null;
      const now = new Date().toISOString();
      commitCards((list) =>
        list.map((c) =>
          c.id === cardId
            ? {
                ...c,
                ...full,
                ...(full.done !== undefined && { status: full.done ? "done" : "todo", completed_at: full.done ? (c.completed_at ?? now) : null }),
                updated_at: now,
              }
            : c,
        ),
      );
      return write("tasks", cardId, full);
    },
    [commitCards, write],
  );

  /** Give every card of a column fresh, evenly spaced positions in `order`. */
  const respace = useCallback(
    (order: Task[]) => {
      const positions = spacedPositions(order.length);
      const ids = new Map(order.map((c, i) => [c.id, positions[i]]));
      commitCards((list) => list.map((c) => (ids.has(c.id) ? { ...c, position: ids.get(c.id)! } : c)));
      return Promise.all(order.map((c, i) => write("tasks", c.id, { position: positions[i] })));
    },
    [commitCards, write],
  );

  /** Move a card into `columnId` at `index` (counted without the card itself). */
  const moveCard = useCallback(
    async (cardId: string, columnId: string, index: number) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      const column = columnsRef.current.find((c) => c.id === columnId);
      if (!card || !column) return;
      const list = cardsIn(columnId).filter((c) => c.id !== cardId);
      const at = Math.max(0, Math.min(index, list.length));
      const before = list[at - 1];
      const after = list[at];
      const wasDone = card.done;
      if (tooClose(before?.position, after?.position)) {
        const order = [...list.slice(0, at), card, ...list.slice(at)];
        const patch: CardPatch = { column_id: columnId };
        if (column.done !== card.done) patch.done = column.done;
        await Promise.all([updateCard(cardId, patch), respace(order)]);
      } else {
        const patch: CardPatch = { column_id: columnId, position: positionBetween(before?.position, after?.position) };
        if (column.done !== card.done) patch.done = column.done;
        await updateCard(cardId, patch);
      }
      if (column.done && !wasDone) celebrate();
    },
    [cardsIn, updateCard, respace, celebrate],
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      if (!card) return false;
      commitCards((list) => list.filter((c) => c.id !== cardId));
      setRemoved(card);
      const { error } = await createClient().from("tasks").delete().eq("id", cardId);
      if (error) {
        commitCards((list) => [...list, card]);
        setRemoved(null);
        oops();
        return false;
      }
      liveRef.current.send(GONE, { table: "tasks", id: cardId });
      return true;
    },
    [commitCards, oops],
  );

  const undoDelete = useCallback(async () => {
    const card = removed;
    if (!card) return;
    setRemoved(null);
    commitCards((list) => [...list.filter((c) => c.id !== card.id), card]);
    const columnStillThere = columnsRef.current.some((c) => c.id === card.column_id);
    const { error } = await createClient()
      .from("tasks")
      .insert({
        id: card.id,
        title: card.title,
        details: card.details,
        kind: "project",
        due_at: card.due_at,
        done: card.done,
        project_id: id,
        column_id: columnStillThere ? card.column_id : (columnsRef.current[0]?.id ?? null),
        position: card.position,
        priority: card.priority,
        assignees: card.assignees,
        labels: card.labels,
        checklist: card.checklist,
        attachments: card.attachments,
        created_at: card.created_at,
      });
    if (error) {
      commitCards((list) => list.filter((c) => c.id !== card.id));
      oops();
    }
  }, [removed, commitCards, id, oops]);

  // Gone for good once the undo is no longer offered: its files go too.
  const removedRef = useRef(removed);
  useEffect(() => {
    removedRef.current = removed;
  });
  const dismissRemoved = useCallback(() => {
    const card = removedRef.current;
    setRemoved(null);
    for (const a of card?.attachments ?? []) if (a.type === "file") void removeFile(a.path);
  }, []);

  /* ----- Columns ----- */

  const addColumn = useCallback(
    async (title: string) => {
      const clean = title.trim().slice(0, 60);
      if (!clean) return null;
      const list = columnsRef.current;
      const column: ProjectColumn = {
        id: uid(),
        project_id: id,
        title: clean,
        color: "ink",
        position: positionBetween(list[list.length - 1]?.position, null),
        done: false,
        created_at: new Date().toISOString(),
      };
      commitColumns((cols) => [...cols, column]);
      const key = `project_columns:${column.id}`;
      begin(inflight.current, key, ["id"]);
      const { error } = await createClient().from("project_columns").insert({ id: column.id, project_id: id, title: clean, color: column.color, position: column.position });
      end(inflight.current, key, ["id"]);
      if (error) {
        commitColumns((cols) => cols.filter((c) => c.id !== column.id));
        oops();
        return null;
      }
      return column;
    },
    [commitColumns, id, oops],
  );

  const updateColumn = useCallback(
    async (columnId: string, patch: ColumnPatch) => {
      const full = { ...patch };
      if (full.title !== undefined) {
        full.title = full.title.trim().slice(0, 60);
        if (!full.title) return false;
      }
      commitColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, ...full } : c)));
      const ok = await write("project_columns", columnId, full);
      // Cards in a column that becomes (or stops being) the done column change with it.
      if (ok && full.done !== undefined) {
        await Promise.all(cardsIn(columnId).filter((c) => c.done !== full.done).map((c) => updateCard(c.id, { done: full.done })));
      }
      return ok;
    },
    [commitColumns, write, cardsIn, updateCard],
  );

  const moveColumn = useCallback(
    async (columnId: string, index: number) => {
      const list = columnsRef.current.filter((c) => c.id !== columnId);
      const at = Math.max(0, Math.min(index, list.length));
      const before = list[at - 1];
      const after = list[at];
      if (tooClose(before?.position, after?.position)) {
        const moving = columnsRef.current.find((c) => c.id === columnId)!;
        const order = [...list.slice(0, at), moving, ...list.slice(at)];
        const positions = spacedPositions(order.length);
        commitColumns((cols) => cols.map((c) => ({ ...c, position: positions[order.findIndex((o) => o.id === c.id)] })));
        await Promise.all(order.map((c, i) => write("project_columns", c.id, { position: positions[i] })));
        return;
      }
      const position = positionBetween(before?.position, after?.position);
      commitColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, position } : c)));
      await write("project_columns", columnId, { position });
    },
    [commitColumns, write],
  );

  /** Delete a column; its cards move to the end of `moveTo`. */
  const deleteColumn = useCallback(
    async (columnId: string, moveTo: string) => {
      const target = columnsRef.current.find((c) => c.id === moveTo);
      if (!target || moveTo === columnId) return false;
      const moving = cardsIn(columnId);
      let last = cardsIn(moveTo).at(-1)?.position ?? null;
      await Promise.all(
        moving.map((card) => {
          const position = positionBetween(last, null);
          last = position;
          return updateCard(card.id, { column_id: moveTo, position, ...(card.done !== target.done && { done: target.done }) });
        }),
      );
      const column = columnsRef.current.find((c) => c.id === columnId);
      commitColumns((cols) => cols.filter((c) => c.id !== columnId));
      const { error } = await createClient().from("project_columns").delete().eq("id", columnId);
      if (error) {
        if (column) commitColumns((cols) => [...cols, column]);
        oops();
        return false;
      }
      liveRef.current.send(GONE, { table: "project_columns", id: columnId });
      return true;
    },
    [cardsIn, updateCard, commitColumns, oops],
  );

  /* ----- Project ----- */

  const updateProject = useCallback(
    (patch: ProjectPatch) => {
      const full = { ...patch };
      if (full.title !== undefined) full.title = full.title.trim().slice(0, 120);
      if (full.description !== undefined) full.description = full.description.slice(0, 4000);
      commitProject((p) => ({ ...p, ...full }));
      return write("projects", id, full);
    },
    [commitProject, write, id],
  );

  /** After the share dialog changed something: reload here and tell everyone else. */
  const membersChanged = useCallback(() => {
    void reloadMembers();
    liveRef.current.send(MEMBERS, {});
  }, [reloadMembers]);

  const projectDeleted = useCallback(() => liveRef.current.send(GONE, { table: "projects", id }), [id]);

  return useMemo(
    () => ({
      project,
      columns,
      cards,
      members,
      role,
      gone,
      removed,
      peers: live.peers,
      focus: live.focus,
      addCard,
      updateCard,
      moveCard,
      deleteCard,
      undoDelete,
      dismissRemoved,
      addColumn,
      updateColumn,
      moveColumn,
      deleteColumn,
      updateProject,
      membersChanged,
      projectDeleted,
    }),
    [
      project,
      columns,
      cards,
      members,
      role,
      gone,
      removed,
      live.peers,
      live.focus,
      addCard,
      updateCard,
      moveCard,
      deleteCard,
      undoDelete,
      dismissRemoved,
      addColumn,
      updateColumn,
      moveColumn,
      deleteColumn,
      updateProject,
      membersChanged,
      projectDeleted,
    ],
  );
}

export type Board = ReturnType<typeof useBoard>;
