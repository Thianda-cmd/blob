import type { Locale } from "@/i18n/config";
import type { Level } from "./types";
import data from "./show-manifest.json";

/** A public lesson picture as the server sees it (written by scripts/show-manifest.ts before each build). */
export type ShowEntry = {
  level: Level;
  id: string;
  kind: "widget" | "picture";
  title: Record<Locale, string>;
  /** The step's explanation as plain text, for link previews. */
  text?: Record<Locale, string>;
};

export type ShowManifest = Record<string, ShowEntry[]>;

const manifest = data as ShowManifest;

/** A topic's public pictures, or undefined when the manifest doesn't know the topic (then the browser decides). */
export const manifestItems = (slug: string): ShowEntry[] | undefined => manifest[slug];

export const manifestItem = (slug: string, level: Level, id: string) => manifest[slug]?.find((e) => e.level === level && e.id === id);
