"use client";

import { blobApp, isPhoneApp } from "@/lib/native";
import type { NotifyKind, Planned } from "./plan";

// Hands the planned notifications to the system (tauri-plugin-notification). Phones schedule them
// with the system, so they come even when Blob is closed; computers show the ones due while the
// app is open. In a browser nothing happens.

export type Permission = "granted" | "denied" | "prompt" | "unavailable";

/** Where the last cards-due and learning-days counts wait for when there is no connection. */
export const NOTIFY_EXTRA_KEY = "blob-notify-extra";

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Whether this device may show Blob's notifications. */
export async function notifyPermission(): Promise<Permission> {
  if (!blobApp()) return "unavailable";
  try {
    const granted = await invoke<boolean | null>("plugin:notification|is_permission_granted");
    if (granted === true) return "granted";
    if (granted === false) return "denied";
    return "prompt";
  } catch {
    return "unavailable";
  }
}

export async function requestNotifyPermission(): Promise<Permission> {
  if (!blobApp()) return "unavailable";
  try {
    const state = await invoke<string>("plugin:notification|request_permission");
    return state === "granted" ? "granted" : state === "denied" ? "denied" : "prompt";
  } catch {
    return "unavailable";
  }
}

const KEY = "blob-notify-scheduled";
const signature = (p: Planned) => `${p.at.getTime()}|${p.title}|${p.body}|${p.link}|${p.kind}|${p.lines?.join("\n") ?? ""}`;

/** The groups' names, in the account's language (Android lists them in Blob's notification settings). */
export type ChannelWords = Record<NotifyKind, { name: string; description: string }>;

// Android: a channel per group. Calendar and school ones pop up and buzz; learning ones arrive
// quietly; the morning overview only sits in the list.
const CHANNELS: Record<NotifyKind, { importance: number; vibration: boolean }> = {
  events: { importance: 4, vibration: true },
  school: { importance: 4, vibration: true },
  learning: { importance: 3, vibration: false },
  daily: { importance: 2, vibration: false },
};
const channelId = (kind: NotifyKind) => `blob-${kind}`;
/** Blob's own status bar icon (gen/android res/drawable/ic_stat_blob.xml) in Blob's purple. */
const ICON = "ic_stat_blob";
const ACCENT = "#6D3DF5";

let channelsMade: string | null = null;
async function makeChannels(words: ChannelWords) {
  const signature = JSON.stringify(words);
  if (channelsMade === signature) return;
  for (const kind of Object.keys(CHANNELS) as NotifyKind[]) {
    const c = CHANNELS[kind];
    try {
      await invoke("plugin:notification|create_channel", {
        id: channelId(kind),
        name: words[kind].name,
        description: words[kind].description,
        importance: c.importance,
        visibility: 0,
        vibration: c.vibration,
        lights: c.vibration,
        lightsColor: ACCENT,
      });
    } catch {
      // An older Android without channels.
    }
  }
  channelsMade = signature;
}

function readScheduled(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

let timers: ReturnType<typeof setTimeout>[] = [];
let running: Promise<void> | null = null;
let queued: Planned[] | null = null;

/** Brings the system's notifications in step with `planned` (only what changed is touched). */
export function scheduleNotifications(planned: Planned[], channels: ChannelWords): Promise<void> {
  if (running) {
    queued = planned;
    return running;
  }
  running = apply(planned, channels).finally(() => {
    running = null;
    if (queued) {
      const next = queued;
      queued = null;
      void scheduleNotifications(next, channels);
    }
  });
  return running;
}

async function apply(planned: Planned[], channels: ChannelWords) {
  const app = blobApp();
  if (!app || (await notifyPermission()) !== "granted") return;
  if (!isPhoneApp(app)) return showWhileOpen(planned);
  if (app.platform === "android") await makeChannels(channels);

  const had = readScheduled();
  const want = new Map(planned.map((p) => [String(p.id), signature(p)]));
  // What the system still has waiting (ones that fired are gone from it).
  let pending: Set<string> | null = null;
  try {
    pending = new Set((await invoke<{ id: number }[]>("plugin:notification|get_pending")).map((p) => String(p.id)));
  } catch {
    // Not available: trust what we scheduled before.
  }
  const cancel = new Set<string>();
  for (const id of Object.keys(had)) if (want.get(id) !== had[id]) cancel.add(id);
  if (pending) for (const id of pending) if (!want.has(id)) cancel.add(id);
  if (cancel.size) {
    try {
      await invoke("plugin:notification|cancel", { notifications: [...cancel].map(Number) });
    } catch {
      // Nothing to cancel.
    }
  }
  const next: Record<string, string> = {};
  for (const p of planned) {
    const id = String(p.id);
    const sig = signature(p);
    const there = had[id] === sig && !cancel.has(id) && (!pending || pending.has(id));
    if (!there) {
      try {
        await invoke("plugin:notification|notify", {
          options: {
            id: p.id,
            title: p.title,
            body: p.body,
            schedule: { at: { date: p.at.toISOString(), allowWhileIdle: true } },
            extra: { link: p.link },
            autoCancel: true,
            channelId: channelId(p.kind),
            // Grouped in the list (Android), threads on iOS.
            group: channelId(p.kind),
            icon: ICON,
            iconColor: ACCENT,
            ...(p.lines ? { inboxLines: p.lines.slice(0, 6), summary: p.lines.length > 6 ? `+${p.lines.length - 6}` : undefined } : {}),
          },
        });
      } catch {
        continue;
      }
    }
    next[id] = sig;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

/** Computers: the next day's notifications, shown at their time while the app is open. */
function showWhileOpen(planned: Planned[]) {
  timers.forEach(clearTimeout);
  timers = [];
  const now = Date.now();
  for (const p of planned) {
    const wait = p.at.getTime() - now;
    if (wait < 0 || wait > 24 * 3600e3) continue;
    timers.push(
      setTimeout(() => {
        // The computer slept through it: a reminder for long ago is no help now.
        if (Date.now() - p.at.getTime() > 15 * 60_000) return;
        void invoke("plugin:notification|notify", { options: { id: p.id, title: p.title, body: p.body, extra: { link: p.link } } }).catch(() => {});
      }, wait),
    );
  }
}

/** Removes everything Blob scheduled (signing out, or notifications switched off). */
export async function clearNotifications() {
  timers.forEach(clearTimeout);
  timers = [];
  try {
    localStorage.removeItem(KEY);
  } catch {}
  const app = blobApp();
  if (!app || !isPhoneApp(app)) return;
  try {
    await invoke("plugin:notification|cancel");
  } catch {}
}

/** Tapping a notification opens its page. */
export async function onNotificationTap(go: (link: string) => void): Promise<() => void> {
  if (!blobApp()) return () => {};
  try {
    const { addPluginListener } = await import("@tauri-apps/api/core");
    const listener = await addPluginListener("notification", "actionPerformed", (e: { notification?: { extra?: { link?: unknown } } }) => {
      const link = e.notification?.extra?.link;
      if (typeof link === "string" && link.startsWith("/") && !link.startsWith("//")) go(link);
    });
    return () => void listener.unregister();
  } catch {
    return () => {};
  }
}
