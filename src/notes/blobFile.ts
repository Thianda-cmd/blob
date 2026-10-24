import type { JSONContent } from "@tiptap/core";
import type { PageKind } from "@/lib/types";

// The Blob file (.blob): notes (with their sub-pages), presentations and folders as one file that
// holds everything Blob knows about them, pictures and attached files included, so it opens again
// in any Blob account exactly as it was. It is JSON:
//
//   { "format": "blob", "version": 1, "exportedAt": "…", "app": "Blob", "pages": [ … ], "assets": { … } }
//
// Each page: kind, title, icon, tags, topics, its content as stored (Tiptap JSON for notes, the deck
// for presentations) and its sub-pages in `children`. Pictures and files point to an asset of the
// file ("blob-asset:<id>") instead of a web address; links between pages of the file keep the page's
// `ref`, so they still point to each other after importing.

export const BLOB_EXT = ".blob";
export const BLOB_MIME = "application/vnd.blob+json";
export const BLOB_FORMAT_VERSION = 1;
/** What an export may carry in pictures and files together (bigger ones stay out, with a note). */
export const MAX_ASSET_BYTES = 60 * 1024 * 1024;
const ASSET = "blob-asset:";

export type BlobFilePage = {
  /** The page's id where it came from: links between pages of the file use it. */
  ref: string;
  kind: Extract<PageKind, "note" | "deck" | "folder">;
  title: string;
  icon: string | null;
  tags: string[];
  topics: string[];
  content: unknown;
  children: BlobFilePage[];
};

export type BlobAsset = { name: string; mime: string; size: number; /** base64 */ data: string };

export type BlobFile = {
  format: "blob";
  version: number;
  exportedAt: string;
  app: "Blob";
  pages: BlobFilePage[];
  assets: Record<string, BlobAsset>;
};

/** A safe file name from a title ("Bio: Zellen?" → "Bio Zellen.blob"). */
export function fileNameFor(title: string, ext: string, fallback: string) {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || fallback}${ext}`;
}

// Walking content ---------------------------------------------------------------------------------

/** Every node of a Tiptap document (depth first), to read or change in place. */
function eachNode(node: JSONContent, fn: (n: JSONContent) => void) {
  fn(node);
  for (const child of node.content ?? []) eachNode(child, fn);
}

/** Pictures in a deck: every string field that looks like an image address (slides' image, theme backgrounds). */
function eachDeckImage(value: unknown, fn: (src: string, set: (next: string) => void) => void) {
  if (Array.isArray(value)) value.forEach((v, i) => (typeof v === "string" ? isImageRef(v) && fn(v, (n) => (value[i] = n)) : eachDeckImage(v, fn)));
  else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") {
        if (isImageRef(v) && /image|background|src|photo|logo/i.test(k)) fn(v, (n) => (obj[k] = n));
      } else eachDeckImage(v, fn);
    }
  }
}

const isImageRef = (v: string) => /^https?:\/\//.test(v) || v.startsWith(ASSET) || v.startsWith("data:image/");

/** Pictures to carry: web addresses (exporting) and the file's own assets (importing). */
const isCarried = (src: string) => /^https?:\/\//.test(src) || src.startsWith(ASSET);

/** What a page's content needs from outside: pictures (by address) and attached files (by storage path). */
export function assetsOf(page: Pick<BlobFilePage, "kind" | "content">) {
  const images = new Set<string>();
  const files = new Map<string, { name: string; mime: string }>();
  if (page.kind === "note" && isDoc(page.content)) {
    eachNode(page.content, (n) => {
      if (n.type === "image" && typeof n.attrs?.src === "string" && isCarried(n.attrs.src)) images.add(n.attrs.src);
      if (n.type === "file" && typeof n.attrs?.path === "string" && n.attrs.path) files.set(n.attrs.path, { name: String(n.attrs.name ?? ""), mime: String(n.attrs.mime ?? "") });
    });
  } else if (page.kind === "deck") {
    eachDeckImage(page.content, (src) => {
      if (isCarried(src)) images.add(src);
    });
  }
  return { images: [...images], files };
}

/**
 * The content with pictures and files swapped: `swap` gets each address or file path and returns
 * what goes there instead (undefined: leave it). Works on a copy.
 */
export function swapAssets(page: Pick<BlobFilePage, "kind" | "content">, swap: (ref: string, what: "image" | "file") => string | undefined): unknown {
  const content = structuredClone(page.content);
  if (page.kind === "note" && isDoc(content)) {
    eachNode(content, (n) => {
      if (n.type === "image" && typeof n.attrs?.src === "string") {
        const next = swap(n.attrs.src, "image");
        if (next !== undefined) n.attrs.src = next;
      }
      if (n.type === "file" && typeof n.attrs?.path === "string" && n.attrs.path) {
        const next = swap(n.attrs.path, "file");
        if (next !== undefined) n.attrs.path = next;
      }
    });
  } else if (page.kind === "deck") {
    eachDeckImage(content, (src, set) => {
      const next = swap(src, "image");
      if (next !== undefined) set(next);
    });
  }
  return content;
}

export const assetRef = (id: string) => `${ASSET}${id}`;
export const assetIdOf = (ref: string) => (ref.startsWith(ASSET) ? ref.slice(ASSET.length) : null);

/**
 * Links between pages ("[[" links, sub-page blocks, presentations shown in a note) moved to the
 * pages' new ids after an import. Links to pages outside the file stay as they were.
 */
export function remapPageIds(content: unknown, ids: Map<string, string>): unknown {
  if (!isDoc(content) || !ids.size) return content;
  const doc = structuredClone(content);
  const swapHref = (href: string) => href.replace(/^\/p\/([0-9a-f-]{36})/i, (whole, id: string) => (ids.has(id) ? `/p/${ids.get(id)}` : whole));
  eachNode(doc, (n) => {
    if ((n.type === "pageLink" || n.type === "deckEmbed") && typeof n.attrs?.id === "string" && ids.has(n.attrs.id)) n.attrs.id = ids.get(n.attrs.id);
    for (const m of n.marks ?? []) if (m.type === "link" && typeof m.attrs?.href === "string") m.attrs.href = swapHref(m.attrs.href);
  });
  return doc;
}

export const isDoc = (v: unknown): v is JSONContent => !!v && typeof v === "object" && (v as JSONContent).type === "doc";

// Reading a file ----------------------------------------------------------------------------------

export type ReadError = "notBlob" | "newer" | "broken";

/** A Blob file from its text, checked enough to import safely (anything odd is left out, not trusted). */
export function parseBlobFile(text: string): { file: BlobFile } | { error: ReadError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "notBlob" };
  }
  const v = raw as Partial<BlobFile> | null;
  if (!v || typeof v !== "object" || v.format !== "blob") return { error: "notBlob" };
  if (typeof v.version !== "number" || v.version > BLOB_FORMAT_VERSION) return { error: "newer" };
  if (!Array.isArray(v.pages)) return { error: "broken" };
  const page = (p: unknown, depth: number): BlobFilePage | null => {
    if (!p || typeof p !== "object" || depth > 12) return null;
    const x = p as Partial<BlobFilePage>;
    const kind = x.kind === "deck" || x.kind === "folder" ? x.kind : x.kind === "note" ? "note" : null;
    if (!kind) return null;
    if (kind === "note" && x.content !== undefined && x.content !== null && !isDoc(x.content) && typeof x.content !== "string") return null;
    return {
      ref: typeof x.ref === "string" ? x.ref.slice(0, 64) : "",
      kind,
      title: typeof x.title === "string" ? x.title.slice(0, 300) : "",
      icon: typeof x.icon === "string" ? x.icon.slice(0, 16) : null,
      tags: Array.isArray(x.tags) ? x.tags.filter((t): t is string => typeof t === "string").slice(0, 20) : [],
      topics: Array.isArray(x.topics) ? x.topics.filter((t): t is string => typeof t === "string").slice(0, 20) : [],
      content: x.content ?? null,
      children: Array.isArray(x.children) ? x.children.map((c) => page(c, depth + 1)).filter((c): c is BlobFilePage => !!c).slice(0, 500) : [],
    };
  };
  const pages = v.pages.map((p) => page(p, 0)).filter((p): p is BlobFilePage => !!p);
  if (!pages.length) return { error: "broken" };
  const assets: Record<string, BlobAsset> = {};
  if (v.assets && typeof v.assets === "object") {
    for (const [id, a] of Object.entries(v.assets)) {
      if (!a || typeof a !== "object" || typeof (a as BlobAsset).data !== "string") continue;
      const asset = a as BlobAsset;
      assets[id] = { name: String(asset.name ?? "file").slice(0, 200), mime: String(asset.mime ?? "application/octet-stream").slice(0, 100), size: Number(asset.size) || 0, data: asset.data };
    }
  }
  return { file: { format: "blob", version: v.version, exportedAt: String(v.exportedAt ?? ""), app: "Blob", pages, assets } };
}

/** How many pages a file holds (sub-pages included). */
export function countPages(pages: BlobFilePage[]): number {
  return pages.reduce((n, p) => n + 1 + countPages(p.children), 0);
}
