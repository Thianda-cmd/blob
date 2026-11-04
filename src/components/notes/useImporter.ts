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
import { BLOB_EXT, BLOB_MIME, parseBlobFile, type BlobFile } from "@/notes/blobFile";
import { clipTitle, importBlobFile, settleNote } from "./transfer";

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
/**
 * What the file picker offers. ".xls" too: photometers and web tools save CSV text or an HTML table
 * under that name (a real old Excel file gets a message saying how to save it).
 */
export const IMPORT_ACCEPT = `${BLOB_EXT},.md,.markdown,.txt,text/markdown,text/plain,.xlsx,.xls,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel`;

/** Excel and CSV files become spreadsheets ("Tabellen"). */
export const isSheetFile = (f: File) =>
  /\.(xlsx|xls|csv|tsv)$/i.test(f.name) || f.type === "text/csv" || f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.type === "application/vnd.ms-excel";

const IMPORTABLE = new RegExp(`(\\${BLOB_EXT}|\\.md|\\.markdown|\\.txt)$`, "i");
/**
 * Whether a file is one to import (by its name or type): a Blob file, an Excel or CSV file,
 * Markdown or text. The same for files picked, dropped (FileDrop.tsx) or opened with the app.
 */
export const importable = (f: File) => IMPORTABLE.test(f.name) || f.type === BLOB_MIME || f.type === "text/markdown" || f.type === "text/plain" || isSheetFile(f);

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
      // What went wrong or was left out on the way ("Nicht übernommen: …") is said when it happens
      // and stays the last word: the cheerful "Importiert" at the end would cover it at once.
      let told = false;
      const tell = (text: string, mood: "worried" | "thinking", ms?: number) => {
        told = true;
        blob.say(text, { mood, ms });
      };
      blob.say(t.importing, { mood: "thinking", ms: 4000 });
      for (const file of files) {
        // A PDF or a picture would come in as a note full of gibberish.
        if (!importable(file)) {
          tell(t.notImportable, "thinking", 8000);
          continue;
        }
        if (file.size > MAX_IMPORT_BYTES) {
          tell(t.tooBig, "worried");
          continue;
        }
        const name = file.name.toLowerCase();
        try {
          if (isSheetFile(file)) {
            // A spreadsheet: read in the browser (the spreadsheet code loads only now).
            const { readSheetFile, sheetPageContent, MAX_SHEET_BYTES } = await import("@/components/sheet/importFile");
            const read = await readSheetFile(file, locale);
            if ("error" in read) {
              // The reader's own words when it knows more (a password, a LibreOffice file, too much text…).
              const p = read.error;
              tell(read.message ?? (p === "tooBig" ? ts.importTooBig : p === "oldXls" ? ts.importOldXls : p === "empty" ? ts.importEmpty : ts.importFailed), "worried", 7000);
              continue;
            }
            const { content, plain_text, bytes } = sheetPageContent(read.workbook, locale);
            // A page too big to save could never be changed again: not made at all.
            if (bytes > MAX_SHEET_BYTES) {
              tell(ts.importTooBigSheet(bytes), "worried", 9000);
              continue;
            }
            const meta = await createPage({ kind: "sheet", title: clipTitle(read.name), subject_id: target.parentId ? null : (target.subjectId ?? null), parent_id: target.parentId ?? null, content, plain_text });
            if (!meta) {
              failed++;
              continue;
            }
            // Rows past the last one a spreadsheet holds, and what couldn't come along: said as the
            // spreadsheet's own import says them.
            const left = [read.cutRows ? ts.importCut(read.cutRows.toLocaleString(locale === "de" ? "de-DE" : "en-US")) : "", read.skipped.length ? ts.importSkipped(read.skipped.join(", ")) : ""].filter(Boolean);
            if (left.length) tell(left.join(" "), "thinking", 9000);
            roots.push(meta);
            pages++;
            continue;
          }
          const text = await file.text();
          if (name.endsWith(BLOB_EXT) || text.trimStart().startsWith("{")) {
            const read = parseBlobFile(text);
            if ("error" in read) {
              tell(t[read.error], "worried", 7000);
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
            if (result.tooBig) tell(t.sheetTooBig(result.tooBig), "worried", 9000);
          } else {
            // Markdown or text: one note. A first "# Heading" becomes its title.
            const { markdownToNote } = await import("@/notes/markdown");
            const { title, doc } = markdownToNote(text);
            const fallback = file.name.replace(/\.(md|markdown|txt)$/i, "");
            const meta = await createPage({ kind: "note", title: clipTitle(title ?? fallback), subject_id: target.parentId ? null : (target.subjectId ?? null), parent_id: target.parentId ?? null, content: {} });
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
      if (failed) blob.say(t.partly(failed), { mood: "thinking", ms: 5000 });
      else if (!told) {
        blob.react("celebrate", "happy");
        blob.say(t.done(pages), { mood: "happy", ms: 5000 });
      }
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
      // get every file; what isn't one to import (importable) is turned away with a word.
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
