"use client";

import type { Editor } from "@tiptap/core";
import { ChevronDown, Copy, FileArchive, FileDown, FileText, FileType, Hash, Keyboard, Smartphone } from "lucide-react";
import { useCallback, useState } from "react";
import { blob } from "@/components/blob/bus";
import { download, exportPages } from "@/components/notes/transfer";
import { usePanes } from "@/components/shell/Panes";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { panesText } from "@/i18n/messages/panes";
import { transferText } from "@/i18n/messages/transfer";
import { BLOB_EXT, BLOB_MIME, fileNameFor } from "@/notes/blobFile";
import { printNote } from "./notePrint";
import { contentToSave } from "./schema";

const EXPLAINED = "blob-note-pdf-explained";

function explained() {
  try {
    return localStorage.getItem(EXPLAINED) === "1";
  } catch {
    return false;
  }
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * A note's ways out: PDF (through the print window), Word, Blob file, Markdown and text. `items` go into
 * the note's "…" menu; `dialog` is the first-time PDF explanation; `pdf` starts the PDF (Ctrl+P).
 * `beforeExport` stores the latest text first (sub-pages are read from the database).
 */
export function useNoteExport({ editor, pageId, title, icon, beforeExport }: { editor: Editor | null; pageId: string; title: string; icon: string | null; beforeExport: () => Promise<unknown> }) {
  const t = useMessages(transferText);
  const untitled = useMessages(editorText).untitled;
  const shortcuts = useMessages(panesText).shortcuts;
  const locale = useLocale();
  const mac = useIsMac();
  const { showShortcuts } = usePanes();
  const { pages } = useWorkspace();
  const [asking, setAsking] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const name = (ext: string) => fileNameFor(title, ext, untitled);

  const print = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    await printNote({ dom: editor.view.dom, title, icon, untitled });
  }, [editor, title, icon, untitled]);

  const pdf = useCallback(() => {
    if (explained()) void print();
    else setAsking(true);
  }, [print]);

  const blobFile = async () => {
    blob.say(t.export.preparing, { mood: "thinking", ms: 4000 });
    await beforeExport();
    const result = await exportPages([pageId], editor && !editor.isDestroyed ? { id: pageId, content: contentToSave(editor) } : undefined);
    if (!result) return blob.say(t.export.failed, { mood: "worried" });
    download(name(BLOB_EXT), JSON.stringify(result.file), BLOB_MIME);
    blob.say(result.missing ? t.export.missing(result.missing) : t.export.done(result.pages), { mood: "happy", ms: 6000 });
  };

  const markdown = async () => {
    if (!editor || editor.isDestroyed) return;
    const { noteToMarkdown } = await import("@/notes/markdown");
    download(name(".md"), noteToMarkdown(contentToSave(editor), { locale, title: title || untitled, pageHref: (id) => `${location.origin}/p/${id}` }), "text/markdown;charset=utf-8");
  };

  const copyMarkdown = async () => {
    if (!editor || editor.isDestroyed) return;
    const { noteToMarkdown } = await import("@/notes/markdown");
    try {
      await navigator.clipboard.writeText(noteToMarkdown(contentToSave(editor), { locale, title: title || untitled, pageHref: (id) => `${location.origin}/p/${id}` }));
      blob.say(t.export.copied, { mood: "happy" });
    } catch {
      blob.say(t.export.failed, { mood: "worried" });
    }
  };

  const word = async () => {
    if (!editor || editor.isDestroyed) return;
    blob.say(t.export.preparing, { mood: "thinking", ms: 4000 });
    try {
      const [{ noteToDocx }, { docxDrawings, docxImage }] = await Promise.all([import("@/notes/docx"), import("./docxAssets")]);
      const file = await noteToDocx(editor.state.doc.toJSON(), {
        locale,
        title: title || untitled,
        pageHref: (id) => `${location.origin}/p/${id}`,
        absolute: (href) => new URL(href, location.origin).href,
        pageTitle: (id) => pages.find((p) => p.id === id)?.title || undefined,
        image: docxImage,
        drawings: await docxDrawings(editor),
      });
      download(name(".docx"), file, DOCX_MIME);
      blob.say(t.export.wordDone, { mood: "happy", ms: 6000 });
    } catch {
      blob.say(t.export.failed, { mood: "worried" });
    }
  };

  const text = () => {
    if (!editor || editor.isDestroyed) return;
    download(name(".txt"), `${title || untitled}\n\n${editor.getText({ blockSeparator: "\n\n" })}\n`, "text/plain;charset=utf-8");
  };

  const items = (close: () => void) => {
    const run = (fn: () => unknown) => () => {
      close();
      void fn();
    };
    return (
      <>
        <MenuLabel>{t.export.label}</MenuLabel>
        <MenuItem icon={<FileDown />} shortcut={mac ? "⌘P" : locale === "de" ? "Strg+P" : "Ctrl+P"} onSelect={run(pdf)}>
          {t.export.pdf}
        </MenuItem>
        <MenuItem icon={<FileType />} onSelect={run(word)}>
          <span title={t.export.wordHint}>{t.export.word}</span>
        </MenuItem>
        <MenuItem icon={<FileArchive />} onSelect={run(blobFile)}>
          <span title={t.export.blobHint}>{t.export.blob}</span>
        </MenuItem>
        <MenuItem icon={<Hash />} onSelect={run(markdown)}>
          {t.export.markdown}
        </MenuItem>
        <MenuItem icon={<FileText />} onSelect={run(text)}>
          {t.export.text}
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={run(copyMarkdown)}>
          {t.export.copyMarkdown}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Keyboard />} shortcut={mac ? "⌘/" : locale === "de" ? "Strg+/" : "Ctrl+/"} onSelect={run(showShortcuts)}>
          {shortcuts.open}
        </MenuItem>
        <MenuSeparator />
      </>
    );
  };

  const d = t.pdfDialog;
  const dialog = (
    <Dialog open={asking} onClose={() => setAsking(false)} labelledBy="note-pdf-title" className="max-w-[440px]">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
            <FileDown className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="note-pdf-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {d.title}
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{d.intro}</p>
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-[13.5px] text-ink">
          {[d.step1, d.step2].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob-soft text-[12px] font-semibold text-blob-ink">{i + 1}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p>{step}</p>
                {i === 0 && (
                  <div aria-hidden className="mt-2 flex max-w-[300px] items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-card">
                    <span className="text-ink-3">{d.mockLabel}</span>
                    <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 font-medium text-ink">
                      <FileDown className="size-3.5 shrink-0 text-blob" />
                      <span className="truncate">{d.mockValue}</span>
                      <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex gap-2 rounded-lg bg-hover/60 px-3 py-2 text-[12.5px] leading-snug text-ink-2">
          <Smartphone className="mt-px size-4 shrink-0 text-ink-3" />
          <span>{d.phone}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="size-4 accent-[var(--blob)]" />
            {d.dontShow}
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              {d.cancel}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (dontShow) {
                  try {
                    localStorage.setItem(EXPLAINED, "1");
                  } catch {}
                }
                setAsking(false);
                // Let the dialog close before the paper is made.
                setTimeout(() => void print(), 200);
              }}
            >
              <FileDown className="size-3.5" /> {d.go}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );

  return { items, dialog, pdf };
}
