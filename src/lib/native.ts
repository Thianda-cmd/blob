// The Blob app (desktop and phones, src-tauri/) shows this site in a native window. Inside it, the
// app sets window.__BLOB_APP__ before any script runs, and the site may call a few app commands
// (src-tauri/capabilities/site.json): open_external, print_page, app_info, set_offline_ready,
// set_widget. In a browser all of this is inert.

export type AppPlatform = "linux" | "macos" | "windows" | "android" | "ios";

export type BlobApp = { platform: AppPlatform; version: string; site: string };

declare global {
  interface Window {
    __BLOB_APP__?: BlobApp;
    /** Android app only (gen/android MainActivity.kt): the system print dialog. */
    BlobAndroid?: { print(): void };
    /** Android app only, on the site's own pages: the home screen widget's data (TodayWidget.kt). */
    BlobWidget?: { postMessage(data: string): void };
  }
}

/** The app around the site, or null in a browser. */
export function blobApp(): BlobApp | null {
  if (typeof window === "undefined" || !window.__BLOB_APP__) return null;
  const { platform, version, site } = window.__BLOB_APP__;
  return { platform, version, site };
}

export const isPhoneApp = (app: BlobApp | null) => app?.platform === "android" || app?.platform === "ios";

type Command = "open_external" | "print_page" | "app_info" | "set_offline_ready" | "set_widget";

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
