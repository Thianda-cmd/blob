import { use } from "react";
import type { AtlasModel } from "../types";

type Loader = () => Promise<{ default: AtlasModel }>;

/** Each model is its own chunk, loaded when its page opens. */
const LOADERS: Record<string, Loader> = {
  "bacterial-cell": () => import("./bacterial-cell"),
  "cell-wall": () => import("./cell-wall"),
  "gram-stain": () => import("./gram-stain"),
  endospores: () => import("./endospores"),
  "eukaryotic-cell": () => import("./eukaryotic-cell"),
  "membrane-transport": () => import("./membrane-transport"),
  history: () => import("./history"),
};

const cache = new Map<string, Promise<AtlasModel>>();

export function loadAtlasModel(slug: string): Promise<AtlasModel> {
  let p = cache.get(slug);
  if (!p) {
    const load = LOADERS[slug];
    p = load ? load().then((m) => m.default) : Promise.reject(new Error(`Unknown model: ${slug}`));
    cache.set(slug, p);
  }
  return p;
}

/** The full model inside a component (suspends until its chunk has loaded). */
export function useAtlasModel(slug: string): AtlasModel {
  return use(loadAtlasModel(slug));
}

export const hasAtlasModel = (slug: string) => slug in LOADERS;
