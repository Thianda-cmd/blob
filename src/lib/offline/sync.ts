"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getAll, getMeta, replaceAll, setMeta, wipeDb, write } from "./idb";
import { isNetworkError, isOnline, onConnectivity, reportNetworkError, reportOk } from "./net";

// Offline-first rows: a copy of the account's events and personal tasks lives on the device
// (IndexedDB), every change goes into an outbox that is sent in order, one change at a time, and
// waits for the connection instead of being undone when it is missing. What the screen shows is
// the server's rows with the outbox laid over them, so a change shows up at once and stays while
// it waits. Realtime and refreshes update the server rows underneath.
//
// Several tabs share one outbox (in IndexedDB); a Web Lock makes sure only one of them sends.

export type SyncTable = "events" | "tasks";

export type Row = { id: string; updated_at?: string; deleted_at?: string | null } & Record<string, unknown>;

export type Change =
  /**
   * A new row, complete as the screen should show it; its database columns are sent. `restore`
   * brings back a deleted row (undo): it is written over a row with the same id.
   */
  | { op: "insert"; table: SyncTable; id: string; row: Row; restore?: boolean }
  /** `local`: what the database works out from `values` itself (shown at once, not sent). */
  | { op: "update"; table: SyncTable; id: string; values: Record<string, unknown>; local?: Record<string, unknown> }
  | { op: "delete"; table: SyncTable; id: string };

type Entry = Change & { key: string; at: number };

/** A change the server refused (a rule it broke), for Blob to explain. */
export type Refusal = { change: Change; message: string };

type Spec = {
  /** Columns a new row is sent with (the database fills in the rest). */
  insert: string[];
  /** Deleting sets `deleted_at` (a tombstone other devices learn from) instead of removing the row. */
  soft: boolean;
  /** Everything the device should have. */
  load: (db: SupabaseClient) => PromiseLike<{ data: unknown; error: unknown; status: number }>;
  /** What changed since `since` (tables with tombstones only). */
  since?: (db: SupabaseClient, since: string) => PromiseLike<{ data: unknown; error: unknown; status: number }>;
  /** Rows that belong here (personal tasks, not project cards). */
  keep?: (row: Row) => boolean;
};

const SPECS: Record<SyncTable, Spec> = {
  events: {
    insert: ["id", "title", "details", "location", "kind", "color", "subject_id", "all_day", "starts_at", "ends_at", "time_zone", "recurrence", "exdates", "series_id", "series_start", "reminders"],
    soft: true,
    load: (db) => db.from("events").select("*").is("deleted_at", null).order("starts_at").limit(5000),
    since: (db, since) => db.from("events").select("*").gt("updated_at", since).order("updated_at").limit(2000),
  },
  tasks: {
    insert: ["id", "title", "details", "kind", "due_at", "subject_id", "status", "position", "done", "completed_at", "created_at"],
    soft: false,
    // The same rows the tasks page loads: open ones, and the ones done in the last week.
    load: (db) =>
      db
        .from("tasks")
        .select("*")
        .is("project_id", null)
        .or(`done.eq.false,completed_at.gte.${new Date(Date.now() - 7 * 864e5).toISOString()}`)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(1000),
    keep: (row) => row.project_id == null,
  },
};

const TABLES = Object.keys(SPECS) as SyncTable[];
const FULL_EVERY = 6 * 3600e3;

let counter = 0;
const nextKey = () => `${Date.now().toString(36).padStart(9, "0")}-${(counter++).toString(36).padStart(4, "0")}-${Math.random().toString(36).slice(2, 6)}`;

const pick = (row: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));

/** Newer `updated_at` wins; a row without one never replaces one with it. */
const newer = (a: Row | undefined, b: Row) => !a || (b.updated_at ?? "") >= (a.updated_at ?? "");

export class Sync {
  readonly userId: string;
  readonly ready: Promise<void>;
  private base: Record<SyncTable, Map<string, Row>> = { events: new Map(), tasks: new Map() };
  private outbox: Entry[] = [];
  private views: Partial<Record<SyncTable, Row[]>> = {};
  private listeners = new Set<() => void>();
  private refusalListeners = new Set<(r: Refusal) => void>();
  private dirty: Record<SyncTable, Set<string>> = { events: new Set(), tasks: new Set() };
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  /** Signed out: nothing is written to the device any more (its data is being wiped). */
  private stopped = false;
  private channels: RealtimeChannel[] = [];
  private stops: (() => void)[] = [];
  private bc: BroadcastChannel | null = null;
  private live = false;
  private loaded: Record<SyncTable, boolean> = { events: false, tasks: false };
  private refreshing: Partial<Record<SyncTable, Promise<void>>> = {};
  private version = 0;
  /** Rows the server confirmed lately (id → when). */
  private recent = new Map<string, number>();
  /** Outbox entries not yet stored on the device. */
  private unsaved = new Set<string>();
  /**
   * Rows deleted for good (tables without tombstones), id → when: an older copy of the row (a page
   * rendered before, opened offline) doesn't bring them back.
   */
  private gone: Record<SyncTable, Map<string, number>> = { events: new Map(), tasks: new Map() };

  constructor(userId: string) {
    this.userId = userId;
    this.ready = this.hydrate();
  }

  // Reading ---------------------------------------------------------------------------------------

  /** The rows the screen shows: the server's, with waiting changes on top. Stable until something changes. */
  rows(table: SyncTable): Row[] {
    let view = this.views[table];
    if (!view) {
      const map = new Map(this.base[table]);
      for (const e of this.outbox) {
        if (e.table !== table) continue;
        if (e.op === "insert") map.set(e.id, { ...map.get(e.id), ...e.row });
        else if (e.op === "update") {
          const cur = map.get(e.id);
          if (cur) map.set(e.id, { ...cur, ...e.values, ...e.local });
        } else map.delete(e.id);
      }
      const keep = SPECS[table].keep;
      view = [...map.values()].filter((r) => !r.deleted_at && (!keep || keep(r)));
      this.views[table] = view;
    }
    return view;
  }

  row(table: SyncTable, id: string): Row | undefined {
    return this.rows(table).find((r) => r.id === id);
  }

  /** Whether the server has answered for this table since the page opened (else the rows come from the device). */
  isLoaded(table: SyncTable) {
    return this.loaded[table];
  }

  /** Changes still waiting to be sent. */
  pending(): number {
    return this.outbox.length;
  }

  /** Changes waiting for this row. */
  pendingFor(table: SyncTable, id: string): number {
    return this.outbox.filter((e) => e.table === table && e.id === id).length;
  }

  /** A number that grows with every change, for `useSyncExternalStore`. */
  getVersion = () => this.version;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  onRefusal(fn: (r: Refusal) => void) {
    this.refusalListeners.add(fn);
    return () => {
      this.refusalListeners.delete(fn);
    };
  }

  private emit(tables: SyncTable[] = TABLES) {
    for (const t of tables) delete this.views[t];
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // Writing ---------------------------------------------------------------------------------------

  /** Shows the change at once and sends it as soon as the connection allows. */
  mutate(change: Change) {
    const entry: Entry = { ...change, key: nextKey(), at: Date.now() };
    if (change.op === "update" && !Object.keys(change.values).length) return;
    this.outbox.push(entry);
    this.unsaved.add(entry.key);
    this.emit([change.table]);
    // (Without IndexedDB it stays "unsaved": this page's outbox is then the only one.)
    void write(this.userId, "outbox", [entry]).then((stored) => {
      if (!stored) return;
      this.unsaved.delete(entry.key);
      this.announce();
    });
    void this.flush();
  }

  /**
   * Server rows that arrived some other way (a server render, another loader): newer ones win.
   * `quiet` (while rendering) tells the other listeners a moment later.
   */
  seed(table: SyncTable, rows: Row[], opts: { quiet?: boolean } = {}) {
    let changed = false;
    for (const row of rows) {
      if (!row?.id) continue;
      const goneAt = this.gone[table].get(row.id);
      if (goneAt && Date.parse(row.updated_at ?? "") <= goneAt) continue;
      if (newer(this.base[table].get(row.id), row)) {
        this.base[table].set(row.id, row);
        this.dirty[table].add(row.id);
        changed = true;
      }
    }
    if (!changed) return;
    if (opts.quiet) {
      delete this.views[table];
      this.version++;
      queueMicrotask(() => this.emit([table]));
    } else this.emit([table]);
    this.persistSoon();
  }

  /**
   * Sends waiting changes, oldest first; stops at the first one that needs the connection. While a
   * flush is running, this waits for it (and for one more round with what was added meanwhile).
   */
  flush(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.flushOnce();
        } while (this.again && !this.stopped);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Changes waiting to be sent. */
  get waiting() {
    return this.outbox.length;
  }

  private async flushOnce(): Promise<void> {
    if (!this.outbox.length) return;
    if (!isOnline() && typeof navigator !== "undefined" && navigator.onLine === false) return;
    await withLock(`blob-outbox:${this.userId}`, async () => {
      // Other tabs queue and send changes too: the stored outbox is the truth, plus this tab's
      // changes that aren't stored yet. (One stored before but gone now was sent by another tab.)
      this.adoptStored(await getAll<Entry>(this.userId, "outbox"));
      const db = createClient();
      let renewed = false;
      while (this.outbox.length && !this.stopped) {
        const entry = this.outbox[0];
        const result = await this.send(db, entry);
        if (result === "wait") {
          reportNetworkError();
          break;
        }
        if (result === "auth") {
          // The sign-in expired: renew it once, else keep everything for later.
          if (renewed) break;
          renewed = true;
          const { error } = await db.auth.refreshSession();
          if (error) break;
          continue;
        }
        reportOk();
        // A refused new row takes the changes queued for it along.
        const drop = result === "refused" && entry.op === "insert" ? this.outbox.filter((e) => e.table === entry.table && e.id === entry.id) : [entry];
        const gone = new Set(drop.map((e) => e.key));
        this.outbox = this.outbox.filter((e) => !gone.has(e.key));
        for (const k of gone) this.unsaved.delete(k);
        if (this.stopped) break;
        await write(this.userId, "outbox", [], [...gone]);
        this.emit([entry.table]);
        this.persistSoon();
        this.announce();
      }
    });
  }

  private async send(db: SupabaseClient, e: Entry): Promise<"sent" | "refused" | "wait" | "auth"> {
    const spec = SPECS[e.table];
    const table = db.from(e.table);
    if (e.op === "insert") {
      const values = pick(e.row, spec.insert);
      const { data, error, status } = e.restore
        ? await table.upsert(spec.soft ? { ...values, deleted_at: null } : values, { onConflict: "id" }).select().single()
        : await table.insert(values).select().single();
      if (!error && data) return this.confirmed(e.table, data as Row);
      if (isNetworkError(error, status)) return "wait";
      if (isAuthError(error, status)) return "auth";
      // Already there: an earlier try got through but its answer was lost.
      if ((error as { code?: string }).code === "23505") {
        const got = await db.from(e.table).select("*").eq("id", e.id).maybeSingle();
        if (got.error && isNetworkError(got.error, got.status)) return "wait";
        if (got.data) return this.confirmed(e.table, got.data as Row);
      }
      return this.refused(e, error);
    }
    if (e.op === "update") {
      const { data, error, status } = await table.update(e.values).eq("id", e.id).select().maybeSingle();
      if (!error) {
        if (data) return this.confirmed(e.table, data as Row);
        // The row is gone (deleted on another device): nothing left to change.
        this.forget(e.table, e.id);
        return "sent";
      }
      if (isNetworkError(error, status)) return "wait";
      if (isAuthError(error, status)) return "auth";
      return this.refused(e, error);
    }
    if (spec.soft) {
      const res = await table.update({ deleted_at: new Date().toISOString() }).eq("id", e.id).select().maybeSingle();
      if (res.error) {
        if (isNetworkError(res.error, res.status)) return "wait";
        if (isAuthError(res.error, res.status)) return "auth";
        return this.refused(e, res.error);
      }
      if (res.data) return this.confirmed(e.table, res.data as Row);
      this.forget(e.table, e.id);
      return "sent";
    }
    const res = await table.delete().eq("id", e.id);
    if (res.error) {
      if (isNetworkError(res.error, res.status)) return "wait";
      if (isAuthError(res.error, res.status)) return "auth";
      return this.refused(e, res.error);
    }
    this.forget(e.table, e.id);
    return "sent";
  }

  /** A row that is gone for good. */
  private forget(table: SyncTable, id: string) {
    this.base[table].delete(id);
    this.dirty[table].add(id);
    if (!SPECS[table].soft) {
      this.gone[table].set(id, Date.now());
      this.goneDirty = true;
    }
  }

  /** Keeps a row from the server: a tombstone too (tables that have them), so older copies can't revive it. */
  private put(table: SyncTable, row: Row) {
    const keep = SPECS[table].keep;
    if (row.deleted_at && !SPECS[table].soft) this.forget(table, row.id);
    else if (keep && !keep(row)) {
      this.base[table].delete(row.id);
      this.dirty[table].add(row.id);
    } else {
      this.base[table].set(row.id, row);
      this.dirty[table].add(row.id);
      if (!row.deleted_at && this.gone[table].delete(row.id)) this.goneDirty = true;
    }
  }

  private confirmed(table: SyncTable, row: Row): "sent" {
    this.recent.set(row.id, Date.now());
    this.put(table, row);
    return "sent";
  }

  private refused(e: Entry, error: unknown): "refused" {
    const message = (error as { message?: string })?.message ?? "refused";
    this.refusalListeners.forEach((fn) => fn({ change: e, message }));
    // Show the row as the server has it again.
    void this.reloadRow(e.table, e.id);
    return "refused";
  }

  private async reloadRow(table: SyncTable, id: string) {
    const { data, error } = await createClient().from(table).select("*").eq("id", id).maybeSingle();
    if (error) return;
    if (data) this.put(table, data as Row);
    else this.forget(table, id);
    this.emit([table]);
    this.persistSoon();
  }

  // Loading ---------------------------------------------------------------------------------------

  private async hydrate() {
    const [events, tasks, outbox, gone] = await Promise.all([
      getAll<Row>(this.userId, "events"),
      getAll<Row>(this.userId, "tasks"),
      getAll<Entry>(this.userId, "outbox"),
      getMeta<[string, number][]>(this.userId, "gone:tasks"),
    ]);
    const month = Date.now() - 30 * 864e5;
    for (const [id, at] of gone ?? []) if (at > month && !this.gone.tasks.has(id)) this.gone.tasks.set(id, at);
    for (const [table, rows] of [["events", events], ["tasks", tasks]] as const) {
      for (const row of rows) if (newer(this.base[table].get(row.id), row)) this.base[table].set(row.id, row);
    }
    this.adoptStored(outbox, true);
  }

  /** Takes the stored outbox as the truth, keeping this tab's changes that aren't stored yet. */
  private adoptStored(stored: Entry[], always = false) {
    const keys = new Set(stored.map((e) => e.key));
    const mine = this.outbox.filter((e) => this.unsaved.has(e.key) && !keys.has(e.key));
    const next = [...stored, ...mine].sort((a, b) => (a.key < b.key ? -1 : 1));
    const same = next.length === this.outbox.length && next.every((e, i) => e.key === this.outbox[i].key);
    if (same && !always) return;
    this.outbox = next;
    this.emit();
  }

  /** Loads from the server: what changed since last time, or everything now and then. */
  refresh(table: SyncTable, opts: { full?: boolean } = {}): Promise<void> {
    const running = this.refreshing[table];
    if (running) return running;
    const job = this.load(table, opts.full ?? false).finally(() => {
      delete this.refreshing[table];
    });
    this.refreshing[table] = job;
    return job;
  }

  private async load(table: SyncTable, forceFull: boolean) {
    await this.ready;
    const spec = SPECS[table];
    const db = createClient();
    const cursorKey = `cursor:${table}`;
    const fullKey = `full:${table}`;
    const cursor = spec.since ? await getMeta<string>(this.userId, cursorKey) : undefined;
    const lastFull = (await getMeta<number>(this.userId, fullKey)) ?? 0;
    const full = forceFull || !spec.since || !cursor || Date.now() - lastFull > FULL_EVERY;

    const res = full ? await spec.load(db) : await spec.since!(db, cursor!);
    if (this.stopped) return;
    if (res.error) {
      if (isNetworkError(res.error, res.status)) reportNetworkError();
      return;
    }
    reportOk();
    const rows = (res.data ?? []) as Row[];
    const map = this.base[table];
    if (full) {
      const ids = new Set(rows.map((r) => r.id));
      const old = Date.now() - 60 * 864e5;
      for (const [id, row] of map) {
        if (ids.has(id)) continue;
        // Tombstones stay a while (a full list leaves them out); rows confirmed a moment ago stay too
        // (the list may have been read just before they existed).
        if (row.deleted_at && Date.parse(row.deleted_at) > old) continue;
        if (Date.now() - (this.recent.get(id) ?? 0) > 60_000) this.forget(table, id);
      }
    }
    let latest = cursor ?? "";
    for (const row of rows) {
      if (row.updated_at && row.updated_at > latest) latest = row.updated_at;
      // Not over a newer row (one the outbox had confirmed while this list was on its way).
      if (newer(map.get(row.id), row)) this.put(table, row);
    }
    this.loaded[table] = true;
    if (spec.since && latest) await setMeta(this.userId, cursorKey, latest);
    if (full) await setMeta(this.userId, fullKey, Date.now());
    this.emit([table]);
    this.persistSoon();
  }

  // Live ------------------------------------------------------------------------------------------

  /** Loads everything, sends waiting changes and listens for changes made elsewhere. */
  start() {
    if (this.live) return;
    this.live = true;
    void this.ready.then(() => {
      if (!this.live) return;
      for (const t of TABLES) void this.refresh(t);
      void this.flush();
    });

    // Back online: catch up and send.
    this.stops.push(
      onConnectivity(() => {
        if (!isOnline()) return;
        for (const t of TABLES) void this.refresh(t);
        void this.flush();
      }),
    );

    // Coming back to the app after a while: catch up.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 20_000) {
        for (const t of TABLES) void this.refresh(t);
        void this.flush();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.stops.push(() => document.removeEventListener("visibilitychange", onVisibility));

    // Other tabs: their changes show up here too.
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(`blob-sync:${this.userId}`);
      this.bc.onmessage = () => void this.reloadFromDevice();
    }

    // Changes made on other devices.
    const db = createClient();
    void db.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (!this.live) return;
        for (const table of TABLES) {
          const ch = db
            .channel(`sync:${table}:${this.userId}:${Math.random().toString(36).slice(2, 8)}`)
            .on("postgres_changes" as never, { event: "*", schema: "public", table, filter: `user_id=eq.${this.userId}` }, (payload: { eventType: string; new: Row; old: Partial<Row> }) =>
              this.onRemote(table, payload),
            )
            .subscribe();
          this.channels.push(ch);
        }
        // Realtime can't filter deletions (they carry only the id), so hard-deleted tasks come
        // through a channel of their own and are dropped if they are here.
        const gone = db
          .channel(`sync:tasks-gone:${this.userId}:${Math.random().toString(36).slice(2, 8)}`)
          .on("postgres_changes" as never, { event: "DELETE", schema: "public", table: "tasks" }, (payload: { old: Partial<Row> }) => {
            const id = payload.old?.id;
            if (id && this.base.tasks.has(id)) this.onRemote("tasks", { eventType: "DELETE", new: {} as Row, old: { id } });
          })
          .subscribe();
        this.channels.push(gone);
      });
  }

  private onRemote(table: SyncTable, payload: { eventType: string; new: Row; old: Partial<Row> }) {
    const map = this.base[table];
    if (payload.eventType === "DELETE") {
      const id = payload.old?.id;
      if (!id) return;
      this.forget(table, id);
    } else {
      const row = payload.new;
      if (!row?.id) return;
      if (newer(map.get(row.id), row)) this.put(table, row);
      if (row.updated_at) {
        void getMeta<string>(this.userId, `cursor:${table}`).then((c) => {
          if (SPECS[table].since && (!c || row.updated_at! > c)) void setMeta(this.userId, `cursor:${table}`, row.updated_at);
        });
      }
    }
    this.emit([table]);
    this.persistSoon();
  }

  private async reloadFromDevice() {
    const [events, tasks, outbox] = await Promise.all([getAll<Row>(this.userId, "events"), getAll<Row>(this.userId, "tasks"), getAll<Entry>(this.userId, "outbox")]);
    for (const [table, rows] of [["events", events], ["tasks", tasks]] as const) {
      const map = this.base[table];
      const ids = new Set(rows.map((r) => r.id));
      for (const id of map.keys()) if (!ids.has(id) && !this.dirty[table].has(id)) map.delete(id);
      for (const row of rows) if (newer(map.get(row.id), row)) map.set(row.id, row);
    }
    this.adoptStored(outbox, true);
  }

  private announce() {
    try {
      this.bc?.postMessage("changed");
    } catch {
      // The channel was closed.
    }
  }

  private persistSoon() {
    if (this.persistTimer || this.stopped) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, 300);
  }

  private goneDirty = false;

  private async persist() {
    if (this.stopped) return;
    if (this.goneDirty) {
      this.goneDirty = false;
      await setMeta(this.userId, "gone:tasks", [...this.gone.tasks].slice(-2000));
    }
    for (const table of TABLES) {
      const ids = [...this.dirty[table]];
      if (!ids.length) continue;
      this.dirty[table].clear();
      const map = this.base[table];
      const puts = ids.map((id) => map.get(id)).filter(Boolean) as Row[];
      const deletes = ids.filter((id) => !map.has(id));
      await write(this.userId, table, puts, deletes);
    }
    this.announce();
  }

  stop() {
    this.stopped = true;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.live = false;
    this.stops.forEach((fn) => fn());
    this.stops = [];
    const db = createClient();
    for (const ch of this.channels) void db.removeChannel(ch);
    this.channels = [];
    this.bc?.close();
    this.bc = null;
  }

  /** Everything this device keeps for the account (tests and a full reset). */
  async snapshot() {
    await this.ready;
    return { events: [...this.base.events.values()], tasks: [...this.base.tasks.values()], outbox: [...this.outbox] };
  }

  /** Replaces the stored rows of a table (used after a full reset). */
  async replace(table: SyncTable, rows: Row[]) {
    this.base[table] = new Map(rows.map((r) => [r.id, r]));
    await replaceAll(this.userId, table, rows);
    this.emit([table]);
  }
}

/** The sign-in expired or is missing (PostgREST: 401, JWT errors PGRST301/PGRST302). */
function isAuthError(error: unknown, status?: number) {
  const code = (error as { code?: string })?.code ?? "";
  return status === 401 || code === "PGRST301" || code === "PGRST302" || /jwt/i.test((error as { message?: string })?.message ?? "");
}

async function withLock(name: string, fn: () => Promise<void>) {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) {
    await locks.request(name, fn);
  } else {
    await fn();
  }
}

const syncs = new Map<string, Sync>();

/** The account's sync (one per page). */
export function getSync(userId: string): Sync {
  let s = syncs.get(userId);
  if (!s) {
    s = new Sync(userId);
    syncs.set(userId, s);
  }
  return s;
}

/** Stops syncing and removes the account's data from this device (sign-out). */
export async function forgetAccount(userId: string) {
  const s = syncs.get(userId);
  s?.stop();
  syncs.delete(userId);
  await wipeDb(userId);
}

/** Sends what's waiting, for at most `ms` (before signing out). How many changes are still waiting. */
export async function flushAllSyncs(ms = 5000): Promise<number> {
  await Promise.race([Promise.all([...syncs.values()].map((s) => s.flush())), new Promise((r) => setTimeout(r, ms))]);
  return [...syncs.values()].reduce((n, s) => n + s.waiting, 0);
}

/** Stops syncing every account on this page (signing out). */
export function stopAllSyncs() {
  for (const s of syncs.values()) s.stop();
  syncs.clear();
}
