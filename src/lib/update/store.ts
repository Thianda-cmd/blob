// Updates for the Blob app on computers: one shared state for the update card (AppUpdater) and the
// settings. The app finds, downloads, checks and installs the update itself (src-tauri/src/update.rs);
// apps from before that (0.1, 0.2) only learn here that there's a new one (/api/app/latest).

import { applyUpdate, blobApp, canSelfUpdate, checkUpdate, downloadUpdate, isPhoneApp, newerVersion, updateProgress, type AppUpdate } from "@/lib/native";

export type UpdatePhase = "idle" | "checking" | "current" | "available" | "downloading" | "ready" | "installing" | "error";

export type UpdateState = {
  phase: UpdatePhase;
  update: AppUpdate | null;
  /** An app from before it could update itself: the new one comes from its page. */
  legacy: boolean;
  downloaded: number;
  total: number;
  error: string | null;
  /** "Later": the card is away until tomorrow (or until you look in the settings). */
  hidden: boolean;
  /** Folded into the little round button in the corner while it downloads. */
  tucked: boolean;
};

const INITIAL: UpdateState = { phase: "idle", update: null, legacy: false, downloaded: 0, total: 0, error: null, hidden: false, tucked: false };

const LATER_KEY = "blob-update-later";
const AUTO_KEY = "blob-update-auto";
const CHECKED_KEY = "blob-update-checked";
const LATER_MS = 24 * 3_600_000;
/** Checks without finding anything: not again within this time (pages that load anew, many windows). */
const QUIET_MS = 30 * 60_000;
export const CHECK_EVERY_MS = 6 * 3_600_000;

let state = INITIAL;
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const subscribeUpdate = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const updateState = () => state;
export const serverUpdateState = () => INITIAL;

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: it just asks again next time.
  }
}

const snoozed = (version: string) => {
  const later = read<{ version: string; until: number }>(LATER_KEY);
  return later?.version === version && Date.now() < later.until;
};

const reason = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "unknown");

/** Downloads new versions by itself (and asks only before restarting). */
export const autoUpdates = () => read<boolean>(AUTO_KEY) === true;

export function setAutoUpdates(on: boolean) {
  write(AUTO_KEY, on || null);
  listeners.forEach((l) => l());
  if (on && state.phase === "available" && state.update?.installable) void download({ quiet: true });
}

/** Looks for a newer Blob. `manual`: asked in the settings (always asks, shows the card again). */
export async function check({ manual = false } = {}) {
  const app = blobApp();
  if (!app || isPhoneApp(app)) return;
  if (["checking", "downloading", "ready", "installing"].includes(state.phase)) return;
  if (!manual) {
    const last = read<{ at: number; found: boolean }>(CHECKED_KEY);
    if (last && !last.found && Date.now() - last.at < QUIET_MS) return;
  }
  const before = state.phase;
  set({ phase: "checking", error: null });
  try {
    let update: AppUpdate | null;
    const legacy = !canSelfUpdate(app);
    if (!legacy) update = await checkUpdate();
    else {
      const res = await fetch("/api/app/latest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = (await res.json()) as { version?: string; notes?: string; page?: string; published?: string | null };
      update =
        r.version && r.page && newerVersion(r.version, app.version)
          ? { version: r.version, current: app.version, notes: r.notes ?? "", page: r.page, published: r.published ?? null, installable: false, size: 0 }
          : null;
    }
    write(CHECKED_KEY, { at: Date.now(), found: !!update });
    if (!update) return set({ phase: "current", update: null });
    if (manual) write(LATER_KEY, null);
    set({ phase: "available", update, legacy, hidden: snoozed(update.version), tucked: false });
    if (update.installable && autoUpdates()) void download({ quiet: true });
  } catch (e) {
    // Offline or GitHub busy: a check of its own says nothing; one you asked for says so.
    set(manual ? { phase: "error", error: reason(e), update: null } : { phase: before === "checking" ? "idle" : before });
  }
}

/** Downloads (and checks) the update. `quiet`: on its own (automatic updates), the card waits until it's ready. */
export async function download({ quiet = false } = {}) {
  const update = state.update;
  if (!update?.installable || state.phase === "downloading" || state.phase === "installing") return;
  if (state.phase === "ready") return;
  set({ phase: "downloading", downloaded: 0, total: update.size, error: null, hidden: quiet, tucked: false });
  const timer = setInterval(() => {
    void updateProgress()
      .then((p) => state.phase === "downloading" && set({ downloaded: p.downloaded, total: p.total || update.size }))
      .catch(() => {});
  }, 250);
  try {
    await downloadUpdate();
    set({ phase: "ready", downloaded: update.size, total: update.size, hidden: quiet && snoozed(update.version), tucked: false });
  } catch (e) {
    if (quiet) set({ phase: "available", hidden: snoozed(update.version) });
    else set({ phase: "error", error: reason(e) });
  } finally {
    clearInterval(timer);
  }
}

/** Puts the new Blob in place: the app closes and opens again in the new version. */
export async function install() {
  if (state.phase !== "ready") return;
  set({ phase: "installing", error: null });
  // A moment for what's being typed to be saved (notes save as you write).
  await new Promise((r) => setTimeout(r, 900));
  try {
    await applyUpdate();
  } catch (e) {
    set({ phase: "error", error: reason(e) });
  }
}

/** Not now: the card comes back tomorrow (a download that's running goes on in the corner). */
export function later() {
  if (state.phase === "downloading") return set({ tucked: true });
  if (state.update) write(LATER_KEY, { version: state.update.version, until: Date.now() + LATER_MS });
  set({ hidden: true, tucked: false });
}

export const tuck = (tucked: boolean) => set({ tucked });

/** After a failed download or install: back to the start. */
export const retry = () => {
  if (state.update) set({ phase: "available", error: null });
};

/** The release notes' "What's new" bullets in this language (the English ones otherwise). */
export function whatsNew(notes: string, locale: string): { title: string; text: string }[] {
  const lines = notes.split(/\r?\n/);
  const heads = { de: /^(\*\*|#+\s*)\s*(neu in dieser version|was ist neu)/i, en: /^(\*\*|#+\s*)\s*(new in this version|what's new)/i };
  const section = (head: RegExp) => {
    const at = lines.findIndex((l) => head.test(l.trim()));
    if (at < 0) return [];
    const out: string[] = [];
    for (const raw of lines.slice(at + 1)) {
      const l = raw.trim();
      if (l.startsWith("- ") || l.startsWith("* ")) out.push(l.slice(2));
      else if (out.length && (l === "" || /^(\*\*|#)/.test(l))) break;
    }
    return out;
  };
  const items = (locale === "de" && section(heads.de).length ? section(heads.de) : section(heads.en)).slice(0, 8);
  const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").trim();
  return items.map((item) => {
    const m = /^\*\*(.+?)\*\*\s*[:.–—-]?\s*(.*)$/.exec(item);
    return m ? { title: plain(m[1]), text: plain(m[2]) } : { title: "", text: plain(item) };
  });
}
