"use client";

import { createClient } from "@/lib/supabase/client";

// Files attached to notes and project cards, in the private "files" bucket (migration 0010).
// Paths: "page/<page id>/<uuid>/<file name>" and "project/<project id>/<uuid>/<file name>". Only
// people who can see the page or project can read them (through short-lived signed links).

export const FILE_BUCKET = "files";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type StoredFile = { path: string; name: string; size: number; mime: string };

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };

/**
 * A file name for the storage path: Storage only takes plain ASCII keys, so "Brüche (Teil 2).pdf"
 * becomes "Brueche (Teil 2).pdf" (umlauts written out, other accents dropped, anything else "_").
 * At most 120 characters, the extension kept. The real name is kept for display.
 */
function safeName(name: string) {
  const ascii = name
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
  const dot = ascii.lastIndexOf(".");
  const ext = dot > 0 && ascii.length - dot <= 10 ? ascii.slice(dot) : "";
  // A name with nothing left but underscores ("数学.pdf") becomes "file.pdf".
  const base = (ext ? ascii.slice(0, dot) : ascii).replace(/^[._ ]+|[._ ]+$/g, "");
  return (/[A-Za-z0-9]/.test(base) ? base : "file").slice(0, 120 - ext.length) + ext;
}

/** Upload a file for a page or project. Null when it is too big or the upload fails. */
export async function uploadFile(target: { type: "page" | "project"; id: string }, file: File): Promise<StoredFile | null> {
  if (file.size > MAX_FILE_BYTES) return null;
  const name = safeName(file.name);
  const path = `${target.type}/${target.id}/${crypto.randomUUID()}/${name}`;
  const { error } = await createClient()
    .storage.from(FILE_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return null;
  // The note or card shows the name as the student knows it.
  const shown = file.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || name;
  return { path, name: shown, size: file.size, mime: file.type || "application/octet-stream" };
}

/** A link to open or download a file, valid for an hour. `download` asks the browser to save it. */
export async function fileUrl(path: string, opts: { download?: string | boolean } = {}): Promise<string | null> {
  const { data, error } = await createClient()
    .storage.from(FILE_BUCKET)
    .createSignedUrl(path, 3600, opts.download ? { download: opts.download === true ? true : opts.download } : undefined);
  return error ? null : data.signedUrl;
}

export async function removeFile(path: string) {
  const { error } = await createClient().storage.from(FILE_BUCKET).remove([path]);
  return !error;
}

/** "2,4 MB" / "2.4 MB" in the reader's language. */
export function formatSize(bytes: number, locale: "de" | "en") {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  const value = u === 0 ? String(n) : n.toLocaleString(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: n < 10 ? 1 : 0 });
  return `${value} ${units[u]}`;
}

/** What kind of file it is, for its icon and whether it can be previewed in the page. */
export function fileKind(mime: string, name = ""): "image" | "pdf" | "audio" | "video" | "doc" | "sheet" | "slides" | "archive" | "text" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (/word|opendocument\.text|apple\.pages/.test(mime) || ["doc", "docx", "odt", "pages"].includes(ext)) return "doc";
  if (/excel|spreadsheet|apple\.numbers|text\/csv/.test(mime) || ["xls", "xlsx", "ods", "csv", "numbers"].includes(ext)) return "sheet";
  if (/powerpoint|presentation|apple\.keynote/.test(mime) || ["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  if (/zip/.test(mime) || ext === "zip") return "archive";
  if (mime.startsWith("text/")) return "text";
  return "other";
}
