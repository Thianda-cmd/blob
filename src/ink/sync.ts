"use client";

// Saving and loading handwritten notes. What is on a note comes from the server (ink_pull), and
// every change this device makes waits in "pending" until the server has it (ink_push). The screen
// shows the server's items with the pending ones on top, so a stroke stays even while it waits
// for a connection. Pending items are kept on the device (IndexedDB) everywhere; the app also
// keeps the server's items, so notes open without a connection. Realtime brings others' strokes.
//
// Items are last-writer-wins per id: two devices changing the same stroke end up with whichever
// reached the server last, and nothing else is ever lost.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { tabId } from "@/lib/live";
import { deletePrefix, getAll, getMeta, getPrefix, setMeta, write } from "@/lib/offline/idb";
import { isNetworkError, isOnline, onConnectivity, reportNetworkError, reportOk } from "@/lib/offline/net";
import { createClient } from "@/lib/supabase/client";
import { InkDoc } from "./doc";
import { decodeItem, type InkContent, type Item, type WireItem } from "./model";
import { buildPreview, wordsOf } from "./preview";

export type SyncStatus = "loading" | "saved" | "saving" | "waiting" | "error" | "denied";

type Pending = { key: string; page: string; item: WireItem; v: number };
type Stored = { key: string; page: string; item: WireItem };
type PullResult = { items: WireItem[]; more: boolean; now: string; stale?: boolean } | null;

/** Changes wait this long for more before they are sent (a few strokes go together). */
const PUSH_DELAY = 700;
const PUSH_BYTES = 900_000;
const PUSH_ITEMS = 400;
/** A pull starts this long before the last one ended (writes that were still finishing). */
const OVERLAP_MS = 60_000;

const metaKey = (page: string) => `ink:${page}`;

/** Microseconds since 1970 of a timestamp from PostgREST or Realtime ("…T12:00:00.123456+00:00"). */
export function micros(ts: string | undefined | null): number {
  if (!ts) return 0;
  const m = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d(?::?\d\d)?)?$/.exec(ts);
  if (!m) return Date.parse(ts) * 1000 || 0;
  const zone = !m[4] || m[4] === "Z" ? "Z" : m[4].length === 3 ? `${m[4]}:00` : m[4].includes(":") ? m[4] : `${m[4].slice(0, 3)}:${m[4].slice(3)}`;
  const ms = Date.parse(`${m[1]}T${m[2]}${zone}`);
  return ms * 1000 + Number((m[3] ?? "").padEnd(6, "0"));
}

const shiftIso = (ts: string, ms: number) => new Date(Math.floor(micros(ts) / 1000) + ms).toISOString();

const sizeOf = (item: WireItem) => {
  const p = item.data?.p;
  return 200 + (typeof p === "string" ? p.length : JSON.stringify(item.data ?? {}).length);
};

export class InkSync {
  readonly page: string;
  readonly user: string;
  private doc: InkDoc | null;
  private canEdit: boolean;
  /** Keep the server's items on this device (the app). */
  private keep: boolean;
  private server = new Map<string, WireItem>();
  private pending = new Map<string, Pending>();
  /** Being sent now: id → the version sent. */
  private inflight = new Map<string, number>();
  private version = 0;
  private watermark: string | null = null;
  private pushing = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  /** Smaller after the server refused a batch, until one gets through. */
  private batchMax = PUSH_ITEMS;
  private pulling: Promise<boolean> | null = null;
  private channel: RealtimeChannel | null = null;
  private stops: (() => void)[] = [];
  private stopped = false;
  private hiddenAt = 0;
  status: SyncStatus = "loading";
  /** The server has answered since the note opened. */
  loaded = false;
  private listeners = new Set<() => void>();
  /** Strokes that came from someone else (for "Lena is writing"). */
  private onRemote: ((items: Item[], by: string | null) => void) | null = null;

  onRemoteItems(fn: (items: Item[], by: string | null) => void) {
    this.onRemote = fn;
    return () => {
      if (this.onRemote === fn) this.onRemote = null;
    };
  }

  constructor(opts: { page: string; user: string; doc: InkDoc | null; canEdit: boolean; keep: boolean }) {
    this.page = opts.page;
    this.user = opts.user;
    this.doc = opts.doc;
    this.canEdit = opts.canEdit;
    this.keep = opts.keep;
  }

  /** The role changed while the note is open (shared as viewer, or made editor). */
  setCanEdit(canEdit: boolean) {
    this.canEdit = canEdit;
    if (canEdit) this.schedule(0);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setStatus(next: SyncStatus) {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((fn) => fn());
  }

  /** Changes this device made that the server doesn't have yet. */
  get waiting() {
    return this.pending.size;
  }

  /** Whether an item exists on the server (or did). */
  known(id: string) {
    return this.server.has(id);
  }

  // Starting --------------------------------------------------------------------------------------

  /** Shows what the device has at once, then catches up with the server and listens for changes. */
  async start() {
    const prefix = `${this.page}:`;
    const [pend, stored, meta] = await Promise.all([
      getPrefix<Pending>(this.user, "inkPending", prefix),
      this.keep ? getPrefix<Stored>(this.user, "inkItems", prefix) : Promise.resolve([] as Stored[]),
      this.keep ? getMeta<{ at: string }>(this.user, metaKey(this.page)) : Promise.resolve(undefined),
    ]);
    if (this.stopped) return;
    for (const s of stored) if (s.item?.id) this.server.set(s.item.id, s.item);
    for (const p of pend) {
      if (!p.item?.id) continue;
      this.pending.set(p.item.id, p);
      this.version = Math.max(this.version, p.v);
    }
    if (stored.length && meta?.at) this.watermark = meta.at;
    if (stored.length || pend.length) this.show();
    const onConn = () => {
      if (!isOnline()) {
        if (this.pending.size) this.setStatus("waiting");
        return;
      }
      void this.pull().then(() => this.schedule(0));
    };
    this.stops.push(onConnectivity(onConn));
    if (typeof document !== "undefined") {
      const vis = () => {
        if (document.visibilityState === "hidden") {
          this.hiddenAt = Date.now();
          void this.flush();
        } else if (this.hiddenAt && Date.now() - this.hiddenAt > 20_000) {
          // Back after a while (the phone slept): Realtime may have missed things.
          void this.pull();
        }
      };
      document.addEventListener("visibilitychange", vis);
      this.stops.push(() => document.removeEventListener("visibilitychange", vis));
      // Now and then, in case Realtime dropped something (it doesn't promise every message).
      const every = setInterval(() => {
        if (document.visibilityState === "visible" && isOnline() && this.loaded) void this.pull();
      }, 60_000);
      this.stops.push(() => clearInterval(every));
    }
    const ok = await this.pull();
    if (this.stopped) return;
    if (!ok && !stored.length && !pend.length) this.show();
    this.listen();
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.stops.forEach((fn) => fn());
    this.stops = [];
    if (this.channel) void createClient().removeChannel(this.channel);
    this.channel = null;
  }

  /** What the screen should show: the server's items with this device's waiting changes on top. */
  private visible(): Item[] {
    const out: Item[] = [];
    for (const [id, w] of this.server) {
      if (this.pending.has(id)) continue;
      const item = decodeItem(w);
      if (item) out.push(item);
    }
    for (const p of this.pending.values()) {
      const item = decodeItem(p.item);
      if (item) out.push(item);
    }
    return out;
  }

  private show() {
    this.doc?.reset(this.visible());
  }

  // Reading ---------------------------------------------------------------------------------------

  /** Brings the server's changes (everything, the first time). False when it couldn't. */
  pull(): Promise<boolean> {
    if (!this.pulling) this.pulling = this.pullNow().finally(() => (this.pulling = null));
    return this.pulling;
  }

  private async pullNow(): Promise<boolean> {
    if (!isOnline()) return false;
    const db = createClient();
    const full = !this.watermark;
    let at: string | null = full ? null : shiftIso(this.watermark!, -OVERLAP_MS);
    let id: string | null = null;
    const got: WireItem[] = [];
    let now: string | null = null;
    for (let round = 0; round < 500; round++) {
      const { data, error, status } = await db.rpc("ink_pull", { p_page: this.page, p_at: at, p_id: id, p_full: full, p_limit: 2000 });
      if (this.stopped) return false;
      if (error) {
        if (isNetworkError(error, status)) {
          reportNetworkError();
          if (this.pending.size) this.setStatus("waiting");
        } else this.setStatus("error");
        return false;
      }
      reportOk();
      const res = data as PullResult;
      if (!res) {
        // No access (any more): the page was deleted or isn't shared with us now.
        this.setStatus("denied");
        return false;
      }
      if (res.stale) {
        this.watermark = null;
        return this.pullNow();
      }
      got.push(...(res.items ?? []));
      now = res.now;
      if (!res.more || !res.items?.length) break;
      const last = res.items[res.items.length - 1];
      at = last.updated_at ?? null;
      id = last.id;
    }
    if (full) {
      this.server = new Map(got.map((w) => [w.id, w]));
      this.show();
      if (this.keep) await this.storeAll(got);
    } else {
      this.remote(got);
    }
    this.watermark = now;
    if (this.keep && now) void setMeta(this.user, metaKey(this.page), { at: now });
    this.loaded = true;
    if (this.status === "loading" || this.status === "error") this.setStatus(this.pending.size ? "saving" : "saved");
    return true;
  }

  /** Items from the server (a pull or Realtime): newer than what we know wins; our waiting changes stay on top. */
  remote(items: WireItem[]) {
    const puts: Item[] = [];
    const removes: string[] = [];
    const store: Stored[] = [];
    const fromOthers: Item[] = [];
    let by: string | null = null;
    for (const w of items) {
      if (!w?.id) continue;
      const cur = this.server.get(w.id);
      if (cur && micros(cur.updated_at) > micros(w.updated_at)) continue;
      const item: WireItem = { id: w.id, kind: w.kind, sheet: w.sheet ?? null, seq: Number(w.seq) || 0, data: w.data ?? {}, deleted: !!w.deleted, updated_at: w.updated_at, updated_by: w.updated_by ?? null };
      this.server.set(w.id, item);
      if (this.keep) store.push({ key: `${this.page}:${w.id}`, page: this.page, item });
      if (this.pending.has(w.id)) continue;
      const decoded = item.deleted ? null : decodeItem(item);
      if (decoded) {
        puts.push(decoded);
        if (item.updated_by && item.updated_by !== this.user) {
          fromOthers.push(decoded);
          by = item.updated_by;
        }
      } else removes.push(w.id);
    }
    if (puts.length || removes.length) this.doc?.apply(puts, removes);
    if (fromOthers.length) this.onRemote?.(fromOthers, by);
    if (store.length) void write(this.user, "inkItems", store);
  }

  private async storeAll(items: WireItem[]) {
    // Forget the old copy's time first: if this is cut short, the next start loads everything.
    await setMeta(this.user, metaKey(this.page), null);
    await deletePrefix(this.user, "inkItems", `${this.page}:`);
    await write(
      this.user,
      "inkItems",
      items.map((item) => ({ key: `${this.page}:${item.id}`, page: this.page, item })),
    );
  }

  private listen() {
    if (this.stopped || this.channel) return;
    const supabase = createClient();
    // Join with the signed-in user's token (see useTableChanges in src/lib/live.ts).
    void supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (this.stopped || this.channel) return;
        this.channel = supabase
          .channel(`db:ink_items:${this.page}:${tabId()}`)
          .on("postgres_changes" as never, { event: "*", schema: "public", table: "ink_items", filter: `page_id=eq.${this.page}` }, (payload: { new?: WireItem }) => {
            if (payload.new?.id) this.remote([payload.new]);
          })
          .subscribe((status: string) => {
            if (status !== "SUBSCRIBED") return;
            // Joined (again): catch up on what was written before the subscription was in place, or
            // while the connection was lost.
            void this.pull();
          });
      });
  }

  // Writing ---------------------------------------------------------------------------------------

  /** This device changed these items (the screen shows them already): keep them and send them. */
  local(items: WireItem[]) {
    if (!this.canEdit) return;
    const puts: Pending[] = [];
    const deletes: string[] = [];
    for (const item of items) {
      const key = `${this.page}:${item.id}`;
      // Something made and removed again before the server ever saw it: nothing to send.
      if (item.deleted && !this.server.has(item.id) && !this.inflight.has(item.id)) {
        if (this.pending.delete(item.id)) deletes.push(key);
        continue;
      }
      const p: Pending = { key, page: this.page, item, v: ++this.version };
      // Re-inserting moves it to the end: the map's order is the order to send in.
      this.pending.delete(item.id);
      this.pending.set(item.id, p);
      puts.push(p);
    }
    void write(this.user, "inkPending", puts, deletes);
    if (this.pending.size) this.setStatus(isOnline() ? "saving" : "waiting");
    else if (this.status !== "loading") this.setStatus("saved");
    this.schedule(PUSH_DELAY);
  }

  private schedule(delay: number) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.push();
    }, delay);
  }

  /** Sends what waits now (leaving the page, hiding the app). */
  async flush(): Promise<void> {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    for (let i = 0; i < 20 && this.pending.size && isOnline() && !this.stopped; i++) {
      const before = this.pending.size;
      await this.push();
      if (this.pending.size >= before && !this.pushing) break;
    }
  }

  private async push(): Promise<void> {
    if (this.pushing || !this.canEdit || this.status === "denied") return;
    if (!this.pending.size) {
      if (this.status !== "loading") this.setStatus("saved");
      return;
    }
    if (!isOnline()) {
      this.setStatus("waiting");
      return;
    }
    const batch: Pending[] = [];
    let bytes = 0;
    for (const p of this.pending.values()) {
      const size = sizeOf(p.item);
      if (batch.length && (bytes + size > PUSH_BYTES || batch.length >= this.batchMax)) break;
      batch.push(p);
      bytes += size;
    }
    this.pushing = true;
    this.setStatus("saving");
    for (const p of batch) this.inflight.set(p.item.id, p.v);
    const { data, error, status } = await createClient().rpc("ink_push", { p_page: this.page, p_items: batch.map((p) => p.item) });
    for (const p of batch) this.inflight.delete(p.item.id);
    this.pushing = false;
    if (error) {
      if (isNetworkError(error, status)) {
        reportNetworkError();
        this.setStatus("waiting");
        return;
      }
      // The server refused something in this batch (damaged data): smaller batches find it.
      if (batch.length > 1) {
        this.batchMax = Math.max(1, Math.floor(batch.length / 2));
        this.schedule(50);
      } else {
        // A single item it won't take: drop it rather than block everything after it.
        this.pending.delete(batch[0].item.id);
        void write(this.user, "inkPending", [], [batch[0].key]);
        this.retry++;
        this.schedule(Math.min(30_000, 500 * 2 ** this.retry));
      }
      this.setStatus("error");
      return;
    }
    this.batchMax = PUSH_ITEMS;
    reportOk();
    const res = data as { ok: boolean; at?: string; reason?: string } | null;
    if (!res?.ok) {
      if (res?.reason === "denied") {
        this.setStatus("denied");
        return;
      }
      this.retry++;
      this.schedule(Math.min(30_000, 1000 * 2 ** this.retry));
      this.setStatus("error");
      return;
    }
    this.retry = 0;
    const done: string[] = [];
    const store: Stored[] = [];
    for (const p of batch) {
      const item = { ...p.item, updated_at: res.at, updated_by: this.user };
      if (micros(this.server.get(p.item.id)?.updated_at) <= micros(res.at)) this.server.set(p.item.id, item);
      if (this.keep) store.push({ key: p.key, page: this.page, item });
      if (this.pending.get(p.item.id)?.v === p.v) {
        this.pending.delete(p.item.id);
        done.push(p.key);
      }
    }
    void write(this.user, "inkPending", [], done);
    if (store.length) void write(this.user, "inkItems", store);
    if (this.pending.size) this.schedule(0);
    else this.setStatus("saved");
  }
}

// Notes that aren't open ----------------------------------------------------------------------

/** Notes open in an editor on this page (their own InkSync sends their changes). */
const open = new Set<string>();
export function markOpen(page: string) {
  open.add(page);
  return () => {
    open.delete(page);
  };
}

/**
 * Sends what was written on notes that aren't open (the app was closed before it could). Called
 * when the device is back online and when the app starts.
 */
export async function flushInkPending(userId: string): Promise<void> {
  if (!isOnline()) return;
  const all = await getAll<Pending>(userId, "inkPending");
  if (!all.length) return;
  const byPage = new Map<string, Pending[]>();
  for (const p of all) {
    if (open.has(p.page)) continue;
    const list = byPage.get(p.page) ?? [];
    list.push(p);
    byPage.set(p.page, list);
  }
  const db = createClient();
  for (const [page, list] of byPage) {
    let sent = true;
    for (let i = 0; i < list.length; ) {
      const batch: Pending[] = [];
      let bytes = 0;
      while (i < list.length && (!batch.length || (bytes + sizeOf(list[i].item) <= PUSH_BYTES && batch.length < PUSH_ITEMS))) {
        bytes += sizeOf(list[i].item);
        batch.push(list[i++]);
      }
      const { data, error, status } = await db.rpc("ink_push", { p_page: page, p_items: batch.map((p) => p.item) });
      if (error) {
        if (isNetworkError(error, status)) {
          reportNetworkError();
          return;
        }
        sent = false;
        break;
      }
      const res = data as { ok: boolean; reason?: string } | null;
      if (res?.reason === "denied") {
        // The note is gone (or no longer ours to edit): nothing of it can be saved any more.
        await deletePrefix(userId, "inkPending", `${page}:`);
        sent = false;
        break;
      }
      if (!res?.ok) {
        sent = false;
        break;
      }
      await write(userId, "inkPending", [], batch.map((p) => p.key));
    }
    if (sent) await afterFlush(userId, page, list);
  }
}

/**
 * A note changed on this device while it was closed has reached the server: the device's copy (the
 * app keeps one) takes the changes, and the note's preview in lists is drawn again from it.
 */
async function afterFlush(userId: string, page: string, sent: Pending[]) {
  if (!(await getMeta(userId, metaKey(page)))) return;
  await write(userId, "inkItems", sent.map((p) => ({ key: p.key, page, item: p.item })));
  const items = new Map((await getPrefix<Stored>(userId, "inkItems", `${page}:`)).map((s) => [s.item.id, s.item]));
  const doc = new InkDoc();
  doc.reset([...items.values()].map(decodeItem).filter((i): i is Item => !!i));
  const content: InkContent = { v: 1, preview: buildPreview(doc) };
  await createClient().from("pages").update({ content, plain_text: wordsOf(doc) }).eq("id", page);
}

/** Whether notes have changes on this device that the server doesn't have yet. */
export async function inkWaiting(userId: string): Promise<number> {
  return (await getAll<Pending>(userId, "inkPending")).length;
}

/** Keeps a copy of a note on the device (the app, for offline use): loads what changed since the last copy. */
export async function keepInkCopy(userId: string, page: string): Promise<void> {
  if (open.has(page)) return;
  const sync = new InkSync({ page, user: userId, doc: null, canEdit: false, keep: true });
  const meta = await getMeta<{ at: string }>(userId, metaKey(page));
  if (meta?.at) {
    // Only what changed: the stored items are loaded so the newer-wins check works.
    const stored = await getPrefix<Stored>(userId, "inkItems", `${page}:`);
    if (stored.length) {
      for (const s of stored) sync["server"].set(s.item.id, s.item);
      sync["watermark"] = meta.at;
    }
  }
  await sync.pull();
  sync.stop();
}

/** Removes a note's copy from the device (it was deleted). */
export async function forgetInk(userId: string, page: string) {
  await Promise.all([deletePrefix(userId, "inkItems", `${page}:`), deletePrefix(userId, "inkPending", `${page}:`), setMeta(userId, metaKey(page), null)]);
}
