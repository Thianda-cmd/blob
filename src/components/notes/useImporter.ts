"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { sheetText } from "@/i18n/messages/sheet";
import { transferText } from "@/i18n/messages/transfer";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta } from "@/lib/types";
import { BLOB_EXT, parseBlobFile, type BlobFile } from "@/notes/blobFile";
import { importBlobFile, settleNote } from "./transfer";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
/** What the file picker offers. */
export const IMPORT_ACCEPT = `${BLOB_EXT},.md,.markdown,.txt,text/markdown,text/plain,.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;

/** Excel and CSV files become spreadsheets ("Tabellen"). */
export const isSheetFile = (f: File) =>
  /\.(xlsx|xls|csv|tsv)$/i.test(f.name) || f.type === "text/csv" || f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.type === "application/vnd.ms-excel";

export type ImportTarget = { subjectId?: string | null; parentId?: string | null; /** Open the first imported page afterwards (default true). */ open?: boolean };

/**
 * Bringing files into Blob: Blob files (.blob) with all their pages, Excel (.xlsx) and CSV files as
 * a new spreadsheet each, Markdown and plain text as a new note each. `pick` opens the file picker;
 * `importFiles` takes files dropped somewhere.
 */
export function useImporter() {
  const t = useMessages(transferText).import;
  const ts = useMessages(sheetText);
  const locale = useLocale();
  const router = useRouter();
  const { userId, createPage, updatePage } = useWorkspace();

  const importFiles = useCallback(
    async (files: File[], target: ImportTarget = {}): Promise<PageMeta[]> => {
      const roots: PageMeta[] = [];
      let pages = 0;
      let failed = 0;
      blob.say(t.importing, { mood: "thinking", ms: 4000 });
      for (const file of files) {
        if (file.size > MAX_IMPORT_BYTES) {
          blob.say(t.tooBig, { mood: "worried" });
          continue;
        }
        const name = file.name.toLowerCase();
        try {
          if (isSheetFile(file)) {
            // A spreadsheet: read in the browser (the spreadsheet code loads only now).
            const { readSheetFile, sheetPageContent, MAX_SHEET_BYTES } = await import("@/components/sheet/importFile");
            const read = await readSheetFile(file, locale);
            if ("error" in read) {
              const p = read.error;
              blob.say(p === "tooBig" ? ts.importTooBig : p === "oldXls" ? ts.importOldXls : p === "empty" ? ts.importEmpty : ts.importFailed, { mood: "worried", ms: 7000 });
              continue;
            }
            const { content, plain_text, bytes } = sheetPageContent(read.workbook, locale);
            // A page too big to save could never be changed again: not made at all.
            if (bytes > MAX_SHEET_BYTES) {
              blob.say(ts.importTooBigSheet(bytes), { mood: "worried", ms: 9000 });
              continue;
            }
            const meta = await createPage({ kind: "sheet", title: read.name.slice(0, 200), subject_id: target.parentId ? null : (target.subjectId ?? null), parent_id: target.parentId ?? null, content, plain_text });
            if (!meta) {
              failed++;
              continue;
            }
            if (read.skipped.length) blob.say(ts.importSkipped(read.skipped.join(", ")), { mood: "thinking", ms: 9000 });
            roots.push(meta);
            pages++;
            continue;
          }
          const text = await file.text();
          if (name.endsWith(BLOB_EXT) || text.trimStart().startsWith("{")) {
            const read = parseBlobFile(text);
            if ("error" in read) {
              blob.say(t[read.error], { mood: "worried", ms: 7000 });
              continue;
            }
            const result = await importBlobFile(read.file as BlobFile, {
              userId,
              subjectId: target.parentId ? null : (target.subjectId ?? null),
              parentId: target.parentId ?? null,
              locale,
              createPage: (input) => createPage(input),
            });
            roots.push(...result.roots);
            pages += result.pages;
            failed += result.failed;
          } else {
            // Markdown or text: one note. A first "# Heading" becomes its title.
            const { markdownToNote } = await import("@/notes/markdown");
            const { title, doc } = markdownToNote(text);
            const fallback = file.name.replace(/\.(md|markdown|txt)$/i, "").slice(0, 300);
            const meta = await createPage({ kind: "note", title: title ?? fallback, subject_id: target.parentId ? null : (target.subjectId ?? null), parent_id: target.parentId ?? null, content: {} });
            if (!meta) {
              failed++;
              continue;
            }
            const settled = settleNote(doc, meta.id, locale);
            const { error } = await createClient().from("pages").update(settled).eq("id", meta.id);
            if (error) failed++;
            void updatePage(meta.id, {}, { local: true });
            roots.push(meta);
            pages++;
          }
        } catch {
          failed++;
        }
      }
      if (!roots.length) {
        if (failed) blob.say(t.failed, { mood: "worried" });
        return roots;
      }
      blob.react("celebrate", "happy");
      blob.say(failed ? t.partly(failed) : t.done(pages), { mood: failed ? "thinking" : "happy", ms: 5000 });
      if (target.open !== false) router.push(`/p/${roots[0].id}`);
      return roots;
    },
    [t, ts, userId, locale, createPage, updatePage, router],
  );

  const pick = useCallback(
    (target: ImportTarget = {}) => {
      const input = document.createElement("input");
      input.type = "file";
      // Phones and tablets only offer files of types they know: a .blob would be greyed out. They
      // get every file; what isn't a Blob file, Markdown or text is turned away when it's read.
      if (!matchMedia("(pointer: coarse)").matches) input.accept = IMPORT_ACCEPT;
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        if (files.length) void importFiles(files, target);
      };
      input.click();
    },
    [importFiles],
  );

  return { pick, importFiles };
}

/** Whether a dropped or pasted file is one to import rather than attach (a Blob file). */
export const isBlobFile = (f: File) => f.name.toLowerCase().endsWith(BLOB_EXT);
