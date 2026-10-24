"use client";

import { rewriteUnknownContent, type JSONContent } from "@tiptap/core";
import { collectLinks } from "@/components/editor/links";
import { noteSchema, plainDoc, plainTextOf } from "@/components/editor/schema";
import type { Locale } from "@/i18n/config";
import { fileUrl, uploadFile } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import type { PageKind, PageMeta } from "@/lib/types";
import {
  BLOB_FORMAT_VERSION,
  MAX_ASSET_BYTES,
  assetIdOf,
  assetRef,
  assetsOf,
  isDoc,
  remapPageIds,
  swapAssets,
  type BlobAsset,
  type BlobFile,
  type BlobFilePage,
} from "@/notes/blobFile";

// Moving pages in and out of Blob: Blob files (.blob, see src/notes/blobFile.ts), and saving any
// text as a download.

type Row = { id: string; kind: PageKind; title: string; icon: string | null; tags: string[] | null; topics: string[] | null; content: unknown; parent_id: string | null };
const KINDS = new Set<PageKind>(["note", "deck", "folder"]);

/** Saves text as a file in the Downloads folder (browsers and the apps alike). */
export function download(name: string, data: string | Blob, mime: string) {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

function fromBase64(data: string) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** The pages and everything below them (not in the trash, CVs left out), as stored. */
async function loadTree(rootIds: string[]): Promise<Row[] | null> {
  const db = createClient();
  const cols = "id, kind, title, icon, tags, topics, content, parent_id";
  const { data, error } = await db.from("pages").select(cols).in("id", rootIds).is("trashed_at", null);
  if (error) return null;
  const rows = (data ?? []) as Row[];
  let level = rows.map((r) => r.id);
  for (let depth = 0; depth < 12 && level.length; depth++) {
    const { data: kids, error: kidsError } = await db.from("pages").select(cols).in("parent_id", level).is("trashed_at", null).order("position");
    if (kidsError) return null;
    const fresh = ((kids ?? []) as Row[]).filter((k) => !rows.some((r) => r.id === k.id));
    rows.push(...fresh);
    level = fresh.map((k) => k.id);
  }
  return rows.filter((r) => KINDS.has(r.kind));
}

export type ExportResult = { file: BlobFile; pages: number; /** Pictures and files that couldn't come along (too big, or unreachable). */ missing: number };

/**
 * A Blob file of these pages and all their sub-pages, pictures and attached files inside.
 * `current` replaces a page's stored content with what an open editor holds right now.
 */
export async function exportPages(rootIds: string[], current?: { id: string; content: JSONContent }): Promise<ExportResult | null> {
  const rows = await loadTree(rootIds);
  if (!rows) return null;
  const byParent = new Map<string, Row[]>();
  for (const r of rows) if (r.parent_id && !rootIds.includes(r.id)) byParent.set(r.parent_id, [...(byParent.get(r.parent_id) ?? []), r]);

  const assets: Record<string, BlobAsset> = {};
  const assetIds = new Map<string, string>();
  let total = 0;
  let missing = 0;

  /** Fetches a picture or file once and keeps it in the file (null: it stays out). */
  const take = async (key: string, url: string | null, name: string, mimeHint: string) => {
    if (assetIds.has(key)) return assetIds.get(key)!;
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await res.arrayBuffer();
      if (total + buf.byteLength > MAX_ASSET_BYTES) return null;
      total += buf.byteLength;
      const id = `a${assetIds.size + 1}`;
      assets[id] = { name, mime: res.headers.get("content-type")?.split(";")[0] || mimeHint || "application/octet-stream", size: buf.byteLength, data: toBase64(buf) };
      assetIds.set(key, id);
      return id;
    } catch {
      return null;
    }
  };

  const build = async (r: Row): Promise<BlobFilePage> => {
    const content = current && r.id === current.id ? current.content : r.content;
    const page = { kind: r.kind as BlobFilePage["kind"], content };
    const { images, files } = assetsOf(page);
    const found = new Map<string, string>();
    for (const src of images) {
      if (!/^https?:\/\//.test(src)) continue;
      const id = await take(`img:${src}`, src, src.split("/").pop()?.split("?")[0] || "image", "image/png");
      if (id) found.set(src, assetRef(id));
      else missing++;
    }
    for (const [path, info] of files) {
      const id = await take(`file:${path}`, await fileUrl(path), info.name || path.split("/").pop() || "file", info.mime);
      if (id) found.set(path, assetRef(id));
      else missing++;
    }
    const kids = await Promise.all((byParent.get(r.id) ?? []).map(build));
    return {
      ref: r.id,
      kind: page.kind,
      title: r.title ?? "",
      icon: r.icon,
      tags: r.tags ?? [],
      topics: r.topics ?? [],
      content: r.kind === "folder" ? null : swapAssets(page, (ref) => found.get(ref)),
      children: kids,
    };
  };

  const roots = rootIds.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => !!r);
  const pages = [];
  for (const r of roots) pages.push(await build(r));
  return {
    file: { format: "blob", version: BLOB_FORMAT_VERSION, exportedAt: new Date().toISOString(), app: "Blob", pages, assets },
    pages: rows.length,
    missing,
  };
}

/** Pictures and files whose upload failed leave the note (an empty picture would only show as broken). */
function dropMissing(content: unknown): unknown {
  if (!isDoc(content)) return content;
  const clean = (node: JSONContent): JSONContent => ({
    ...node,
    ...(node.content && {
      content: node.content.filter((n) => !((n.type === "image" && !n.attrs?.src) || (n.type === "file" && !n.attrs?.path))).map(clean),
    }),
  });
  return clean(content);
}

/** A note's content made safe for this schema, with its plain text and links (for search and backlinks). */
export function settleNote(content: unknown, pageId: string, locale: Locale) {
  const schema = noteSchema(locale);
  let json: JSONContent = isDoc(content) ? content : typeof content === "string" ? plainDoc(content) : plainDoc("");
  let doc;
  try {
    doc = schema.nodeFromJSON(json);
    doc.check();
  } catch {
    // Blocks this Blob doesn't know (a newer file): left out rather than breaking the note.
    try {
      json = rewriteUnknownContent(json, schema).json ?? plainDoc("");
      doc = schema.nodeFromJSON(json);
      doc.check();
    } catch {
      json = plainDoc("");
      doc = schema.nodeFromJSON(json);
    }
  }
  return { content: json, plain_text: plainTextOf(doc), links: collectLinks(doc, pageId) };
}

type Create = (input: { kind: PageKind; title: string; icon: string | null; tags: string[]; topics: string[]; subject_id: string | null; parent_id: string | null; content?: unknown }) => Promise<PageMeta | null>;

export type ImportResult = { roots: PageMeta[]; pages: number; failed: number };

/**
 * Brings the pages of a Blob file into this account (below `parentId`, or in `subjectId`): pictures
 * and files are uploaded again, links between the file's pages point to the new pages.
 */
export async function importBlobFile(file: BlobFile, opts: { userId: string; subjectId: string | null; parentId: string | null; locale: Locale; createPage: Create }): Promise<ImportResult> {
  const db = createClient();
  const ids = new Map<string, string>();
  const created: { page: BlobFilePage; id: string }[] = [];
  const roots: PageMeta[] = [];
  let failed = 0;

  // First every page (parents before their children), so links can find their new ids.
  const make = async (page: BlobFilePage, parentId: string | null, depth: number): Promise<void> => {
    const meta = await opts.createPage({
      kind: page.kind,
      title: page.title,
      icon: page.icon,
      tags: page.tags,
      topics: page.topics,
      subject_id: opts.subjectId,
      parent_id: parentId,
      // The real content follows once its pictures are uploaded.
      content: page.kind === "deck" ? page.content : {},
    });
    if (!meta) {
      failed++;
      return;
    }
    if (depth === 0) roots.push(meta);
    if (page.ref) ids.set(page.ref, meta.id);
    created.push({ page, id: meta.id });
    for (const child of page.children) await make(child, meta.id, depth + 1);
  };
  for (const p of file.pages) await make(p, opts.parentId, 0);

  // Pictures once for the whole file; attached files per page (they live in the page's folder).
  const pictures = new Map<string, string | null>();
  const picture = async (id: string) => {
    if (pictures.has(id)) return pictures.get(id)!;
    const a = file.assets[id];
    let url: string | null = null;
    if (a && a.mime.startsWith("image/") && a.mime !== "image/svg+xml") {
      const ext = a.mime.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "png";
      const path = `${opts.userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("uploads").upload(path, new Blob([fromBase64(a.data)], { type: a.mime }), { contentType: a.mime, cacheControl: "31536000", upsert: false });
      if (!error) url = db.storage.from("uploads").getPublicUrl(path).data.publicUrl;
    }
    pictures.set(id, url);
    return url;
  };

  for (const { page, id } of created) {
    if (page.kind === "folder") continue;
    const uploaded = new Map<string, string>();
    const { images, files } = assetsOf(page);
    for (const ref of [...images, ...files.keys()]) {
      const assetId = assetIdOf(ref);
      if (!assetId) continue;
      const a = file.assets[assetId];
      if (!a) continue;
      if (files.has(ref)) {
        const stored = await uploadFile({ type: "page", id }, new File([fromBase64(a.data)], a.name, { type: a.mime }));
        if (stored) uploaded.set(ref, stored.path);
      } else {
        const url = await picture(assetId);
        if (url) uploaded.set(ref, url);
      }
    }
    // A picture that couldn't come along: "" (notes drop it, presentations show no picture).
    const content = remapPageIds(swapAssets(page, (ref) => uploaded.get(ref) ?? (assetIdOf(ref) ? "" : undefined)), ids);
    const patch = page.kind === "note" ? settleNote(dropMissing(content), id, opts.locale) : { content };
    const { error } = await db.from("pages").update(patch).eq("id", id);
    if (error) failed++;
  }
  return { roots, pages: created.length, failed };
}
