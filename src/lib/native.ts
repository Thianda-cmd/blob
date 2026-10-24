// The Blob app (desktop and phones, src-tauri/) shows this site in a native window. Inside it, the
// app sets window.__BLOB_APP__ before any script runs, and the site may call a few app commands
// (src-tauri/capabilities/site.json): open_external, print_page, app_info, set_offline_ready,
// set_widget, take_opened_files, and on computers the update_* commands. In a browser all of this
// is inert.

export type AppPlatform = "linux" | "macos" | "windows" | "android" | "ios";

export type BlobApp = { platform: AppPlatform; version: string; site: string };

declare global {
  interface Window {
    __BLOB_APP__?: BlobApp;
    /** Android app only (gen/android MainActivity.kt): the system print dialog. */
    BlobAndroid?: { print(): void };
    /** Android app only, on the site's own pages: the home screen widget's data (TodayWidget.kt). */
    BlobWidget?: { postMessage(data: string): void };
    /** Android app only, on the site's own pages: "take" answers with the Blob files opened with the app. */
    BlobFiles?: { postMessage(data: string): void; onmessage: ((event: MessageEvent<string>) => void) | null };
  }
}

/** The app around the site, or null in a browser. */
export function blobApp(): BlobApp | null {
  if (typeof window === "undefined" || !window.__BLOB_APP__) return null;
  const { platform, version, site } = window.__BLOB_APP__;
  return { platform, version, site };
}

export const isPhoneApp = (app: BlobApp | null) => app?.platform === "android" || app?.platform === "ios";

type Command =
  | "open_external"
  | "print_page"
  | "app_info"
  | "set_offline_ready"
  | "set_widget"
  | "take_opened_files"
  | "update_check"
  | "update_download"
  | "update_progress"
  | "update_apply";

async function call<T>(command: Command, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Opens a web or mail link outside the app (the system browser or mail app). */
export async function openOutside(url: string): Promise<boolean> {
  try {
    await call("open_external", { url });
    return true;
  } catch {
    return false;
  }
}

/** Prints the page with the system's print dialog (macOS, iOS and Android, where the webview can't). */
export async function printPage(): Promise<boolean> {
  if (window.BlobAndroid) {
    try {
      window.BlobAndroid.print();
      return true;
    } catch {
      return false;
    }
  }
  try {
    await call("print_page");
    return true;
  } catch {
    return false;
  }
}

/** A Blob file (.blob) opened with the app: double-click, "Open with", or shared to it on Android. */
export type OpenedFile = { name: string; text: string };

/**
 * The Blob files opened with the app since the site last asked (each is handed over once). Empty in
 * a browser and in older apps.
 */
export async function takeOpenedFiles(): Promise<OpenedFile[]> {
  if (!blobApp()) return [];
  const valid = (v: unknown): OpenedFile[] =>
    Array.isArray(v) ? v.filter((f): f is OpenedFile => !!f && typeof f.name === "string" && typeof f.text === "string") : [];
  const channel = window.BlobFiles;
  if (channel) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), 10_000);
      channel.onmessage = (event) => {
        clearTimeout(timer);
        channel.onmessage = null;
        try {
          resolve(valid(JSON.parse(event.data)));
        } catch {
          resolve([]);
        }
      };
      channel.postMessage("take");
    });
  }
  try {
    return valid(await call<unknown>("take_opened_files"));
  } catch {
    // An older app without the command (or a phone app without the channel).
    return [];
  }
}

/** Tells the app the site can start without a connection now (its start page then opens it offline). */
export async function setOfflineReady(ready: boolean): Promise<void> {
  if (!blobApp()) return;
  try {
    await call("set_offline_ready", { ready });
  } catch {
    // An older app without the command: it just won't start offline.
  }
}

/** Hands the home and lock screen widgets their data (src/lib/widget); "" empties them. */
export async function setWidget(json: string): Promise<void> {
  const app = blobApp();
  if (!app) return;
  try {
    if (window.BlobWidget) window.BlobWidget.postMessage(json);
    else if (app.platform === "ios") await call("set_widget", { json });
  } catch {
    // An older app without widgets.
  }
}

/** A newer Blob for this computer (src-tauri/src/update.rs). */
export type AppUpdate = {
  version: string;
  current: string;
  /** The release notes (Markdown). */
  notes: string;
  /** The release page, where every file is. */
  page: string;
  published: string | null;
  /** The app can download and install it itself (else: from the release page). */
  installable: boolean;
  size: number;
};

export type UpdateProgress = { downloaded: number; total: number; ready: boolean; busy: boolean };

/** "0.10.2" > "0.9.0" */
export function newerVersion(a: string, b: string): boolean {
  const pa = a.split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/** The first app version that updates itself (older ones only learn there's a new one). */
export const SELF_UPDATING = "0.3.0";

/** A computer app that can update itself. */
export const canSelfUpdate = (app: BlobApp | null) => !!app && !isPhoneApp(app) && !newerVersion(SELF_UPDATING, app.version);

/** `force`: ask GitHub now (the app otherwise answers from its last check, up to 20 minutes old). */
export const checkUpdate = (force = false) => call<AppUpdate | null>("update_check", { force });
export const downloadUpdate = () => call<void>("update_download");
export const updateProgress = () => call<UpdateProgress>("update_progress");
export const applyUpdate = () => call<void>("update_apply");
