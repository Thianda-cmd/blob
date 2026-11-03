"use client";

// "Add to note" ("In Notiz einfügen"): pick a note (or make a new one) and the chart, table or
// range appears there as a live block. Opened from the chart and table panels and the grid's menu.
//
// CONTRACT: keep the props.
//
// Picking a note opens it at /p/<note>?sheetEmbed=<what to show>; the note itself adds the block
// (src/components/editor/useSheetEmbedParam.ts), so it is saved and shared like any edit there.

import { FileText, NotebookPen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Picker } from "@/components/editor/blocks/Picker";
import { Dialog } from "@/components/ui/Dialog";
import { Sheet } from "@/components/ui/Sheet";
import { usePhone } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn, pageTitle } from "@/lib/utils";
import { addToNoteHref, type SheetEmbedItem } from "@/sheet/embed";

export function AddToNoteDialog({ open, onClose, pageId, item }: { open: boolean; onClose: () => void; pageId: string; item: SheetEmbedItem }): ReactNode {
  const phone = usePhone();
  const t = useMessages(noteBlocksText).sheet.addToNote;
  const body = open ? <AddToNoteBody pageId={pageId} item={item} onClose={onClose} phone={phone} /> : null;
  if (phone) {
    return (
      <Sheet open={open} onClose={onClose} label={t.title}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} labelledBy="add-to-note-title" className="max-w-[460px]">
      {body}
    </Dialog>
  );
}

function AddToNoteBody({ pageId, item, onClose, phone }: { pageId: string; item: SheetEmbedItem; onClose: () => void; phone: boolean }) {
  const t = useMessages(noteBlocksText).sheet.addToNote;
  const locale = useLocale();
  const router = useRouter();
  const { pages, subjects, userId, createPage } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sheet = pages.find((p) => p.id === pageId);

  const notes = useMemo(
    () =>
      pages
        .filter((p) => p.kind === "note" && !p.trashed_at)
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .map((p) => {
          const parent = p.parent_id ? pages.find((x) => x.id === p.parent_id) : undefined;
          const subject = subjects.find((s) => s.id === p.subject_id);
          return {
            key: p.id,
            label: pageTitle(p.title, "note", locale),
            sub: parent?.title?.trim() || subject?.name || t.noSubject,
            keywords: [subject?.name, parent?.title].filter(Boolean).join(" "),
            icon: p.icon ? <span className="text-[15px] leading-none">{p.icon}</span> : <FileText className="size-4" />,
          };
        }),
    [pages, subjects, t.noSubject, locale],
  );

  const go = (noteId: string) => {
    onClose();
    router.push(addToNoteHref(noteId, { pageId, item }));
  };

  const newNote = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    // Next to the spreadsheet: in its subject (when the spreadsheet is yours), named after it.
    const mine = !sheet || sheet.user_id === userId;
    const created = await createPage({ kind: "note", title: sheet?.title?.trim() ?? "", subject_id: mine ? (sheet?.subject_id ?? null) : null });
    setBusy(false);
    if (!created) {
      setFailed(true);
      return;
    }
    go(created.id);
  };

  return (
    <div className={cn("flex flex-col", phone ? "max-h-none" : "max-h-[min(80dvh,640px)]")}>
      <header className="flex items-start gap-3 px-5 pb-3 pt-5 max-sm:pt-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
          <NotebookPen className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="add-to-note-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {t.title}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.intro[item.kind]}</p>
        </div>
      </header>

      <div className="px-3">
        <button
          type="button"
          onClick={() => void newNote()}
          disabled={busy}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover disabled:opacity-60 [@media(hover:none)]:py-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blob text-white">{busy ? <span className="blob-upload-spinner" /> : <Plus className="size-4" />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">{t.newNote}</span>
            <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-3">{t.newNoteHint}</span>
          </span>
        </button>
        {failed && (
          <p role="alert" className="px-2 pt-1 text-[12.5px] text-danger">
            {t.failed}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3 pt-2">
        {notes.length ? (
          <Picker
            items={notes}
            placeholder={t.search}
            empty={t.noMatch}
            onPick={go}
            autoFocus={!phone}
            listClassName={phone ? "max-h-[50dvh]" : "max-h-[340px]"}
          />
        ) : (
          <p className="px-2 py-6 text-center text-[13px] text-ink-3">{t.none}</p>
        )}
      </div>

      <footer className="flex justify-end border-t border-line px-4 py-3">
        <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink">
          {t.cancel}
        </button>
      </footer>
    </div>
  );
}
