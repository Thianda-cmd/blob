// The Blob app (desktop and phones, src-tauri/) shows this site in a native window. Inside it, the
// app sets window.__BLOB_APP__ before any script runs, and the site may call three app commands:
// open_external, print_page, app_info (src-tauri/capabilities/site.json). In a browser all of this
// is inert.

export type AppPlatform = "linux" | "macos" | "windows" | "android" | "ios";

export type BlobApp = { platform: AppPlatform; version: string; site: string };

declare global {
  interface Window {
    __BLOB_APP__?: BlobApp & { start?: string };
  }
}

/** The app around the site, or null in a browser. */
export function blobApp(): BlobApp | null {
  if (typeof window === "undefined" || !window.__BLOB_APP__) return null;
  const { platform, version, site } = window.__BLOB_APP__;
  return { platform, version, site };
}

export const isPhoneApp = (app: BlobApp | null) => app?.platform === "android" || app?.platform === "ios";

async function call<T>(command: "open_external" | "print_page" | "app_info", args?: Record<string, unknown>): Promise<T> {
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

/** Prints the page with the system's print dialog (desktop apps). */
export async function printPage(): Promise<boolean> {
  try {
    await call("print_page");
    return true;
  } catch {
    return false;
  }
}
