"use client";

import { FileUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useMessages } from "@/i18n/client";
import { transferText } from "@/i18n/messages/transfer";
import { BLOB_EXT } from "@/notes/blobFile";
import { useImporter } from "./useImporter";

const IMPORTABLE = new RegExp(`(\\${BLOB_EXT}|\\.md|\\.markdown|\\.txt)$`, "i");
const importable = (f: File) => IMPORTABLE.test(f.name) || f.type === "text/markdown" || f.type === "text/plain";
const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

/**
 * Files dropped anywhere in Blob that isn't a place for them (a note takes pictures and files
 * itself, so does a card or a CV photo): Blob files, Markdown and text come in as new pages, and
 * the first one opens. Without this the browser (or the app's web view) would open the file
 * instead of Blob.
 */
export function FileDrop() {
  const t = useMessages(transferText).import;
  const { importFiles } = useImporter();
  const importRef = useRef(importFiles);
  const [over, setOver] = useState(false);

  useEffect(() => {
    importRef.current = importFiles;
  });

  useEffect(() => {
    // While a file is dragged over the page, dragover comes every few milliseconds; the hint goes
    // when it stops (the file left the window, or the drag was cancelled).
    let timer = 0;
    const hide = () => {
      window.clearTimeout(timer);
      setOver(false);
    };
    // These run last (on the window, after the page's own handlers): a place that takes the file
    // has already said so with preventDefault.
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      if (e.defaultPrevented) return hide();
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setOver(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setOver(false), 250);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      hide();
      if (e.defaultPrevented) return;
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      const ok = files.filter(importable);
      if (ok.length) void importRef.current(ok);
      else if (files.length) blob.say(t.dropInNote, { mood: "thinking", ms: 7000 });
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      hide();
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [t]);

  return (
    <AnimatePresence>
      {over && (
        <motion.div
          key="drop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-paper/55 p-6 backdrop-blur-[2px]"
          role="status"
        >
          <motion.div
            initial={{ scale: 0.96, y: 6 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="flex max-w-[340px] flex-col items-center rounded-2xl border-2 border-dashed border-blob/60 bg-raised px-8 py-7 text-center shadow-pop"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-blob-soft text-blob-ink">
              <FileUp className="size-5" />
            </span>
            <span className="mt-3 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{t.drop}</span>
            <span className="mt-1 text-[13px] text-ink-3">{t.actionHint}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
