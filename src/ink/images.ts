"use client";

// Pictures on handwritten notes come from the private files bucket through short-lived links.
// Each is loaded once per page and kept decoded; until then a placeholder shows.

import type { Images } from "./render";

type Entry = { img: CanvasImageSource | null; state: "loading" | "ready" | "error"; waiters: (() => void)[] };

export class ImageCache implements Images {
  private map = new Map<string, Entry>();

  constructor(
    /** A link for a stored file (null when it can't be had). */
    private resolve: (path: string) => Promise<string | null>,
    /** Told when a picture is ready (to draw it). */
    private onReady: (path: string) => void,
  ) {}

  get(path: string): CanvasImageSource | null {
    const e = this.map.get(path);
    if (e?.state === "ready") return e.img;
    if (!e) void this.load(path);
    return null;
  }

  /** Waits until these pictures are loaded (or failed): for exports. */
  async ready(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(
        (p) =>
          new Promise<void>((resolve) => {
            const e = this.map.get(p);
            if (e && e.state !== "loading") return resolve();
            if (e) e.waiters.push(resolve);
            else {
              void this.load(p);
              this.map.get(p)?.waiters.push(resolve);
            }
          }),
      ),
    );
  }

  private async load(path: string) {
    const entry: Entry = { img: null, state: "loading", waiters: [] };
    this.map.set(path, entry);
    try {
      const url = await this.resolve(path);
      if (!url) throw new Error("no link");
      const img = new Image();
      // Pictures go into canvases that are exported: they must not taint them.
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
      await img.decode();
      entry.img = img;
      entry.state = "ready";
      this.onReady(path);
    } catch {
      entry.state = "error";
    }
    entry.waiters.splice(0).forEach((fn) => fn());
  }
}
