"use client";

import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Sheet as BottomSheet } from "@/components/ui/Sheet";
import { useMessages } from "@/i18n/client";
import { inkText } from "@/i18n/messages/ink";
import type { InkDoc } from "@/ink/doc";
import type { Images } from "@/ink/render";
import { cn } from "@/lib/utils";
import { SheetThumb } from "./Paper";

type Props = {
  open: boolean;
  onClose: () => void;
  doc: InkDoc;
  dark: boolean;
  images: Images | null;
  /** Grows with every change (the thumbnails draw again). */
  version: number;
  current: number;
  readOnly: boolean;
  phone: boolean;
  onGo: (index: number) => void;
  onAdd: (after: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: number) => void;
};

/** All pages at a glance: open one, add, duplicate, move or delete pages. */
export function Pages(p: Props) {
  const t = useMessages(inkText);
  const sheets = p.doc.sheets;
  const body = (
    <div className="flex max-h-[min(70vh,720px)] flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">{t.pages}</h2>
        <button type="button" onClick={p.onClose} aria-label={t.cancel} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-3">
        {sheets.map((s, i) => (
          <div key={s.id} className="group relative">
            <button
              type="button"
              onClick={() => {
                p.onGo(i);
                p.onClose();
              }}
              aria-label={t.pageOf(i + 1, sheets.length)}
              className={cn("block w-full overflow-hidden rounded-lg border shadow-card transition-[box-shadow,border-color]", i === p.current ? "border-blob shadow-[0_0_0_2px_var(--blob-soft)]" : "border-line hover:border-line-2")}
            >
              <SheetThumb doc={p.doc} sheet={s} dark={p.dark} images={p.images} version={p.version} />
            </button>
            <div className="mt-1 flex items-center justify-between gap-1">
              <span className="text-[12px] tabular-nums text-ink-3">{i + 1}</span>
              {!p.readOnly && (
                <span className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <IconButton label={t.moveUp} disabled={i === 0} onClick={() => p.onMove(s.id, i - 1)}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton label={t.moveDown} disabled={i === sheets.length - 1} onClick={() => p.onMove(s.id, i + 1)}>
                    <ArrowDown />
                  </IconButton>
                  <IconButton label={t.duplicatePage} onClick={() => p.onDuplicate(s.id)}>
                    <CopyPlus />
                  </IconButton>
                  <IconButton label={sheets.length > 1 ? t.deletePage : t.lastPage} disabled={sheets.length <= 1} danger onClick={() => p.onDelete(s.id)}>
                    <Trash2 />
                  </IconButton>
                </span>
              )}
            </div>
          </div>
        ))}
        {!p.readOnly && (
          <button
            type="button"
            onClick={() => p.onAdd(sheets.length - 1)}
            className="flex aspect-[1000/1414] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-2 text-[13px] font-medium text-ink-3 transition-colors hover:border-blob hover:text-blob-ink"
          >
            <Plus className="size-6" />
            {t.addPage}
          </button>
        )}
      </div>
    </div>
  );
  if (p.phone)
    return (
      <BottomSheet open={p.open} onClose={p.onClose} label={t.pages}>
        {body}
      </BottomSheet>
    );
  return (
    <Dialog open={p.open} onClose={p.onClose} className="max-w-xl">
      {body}
    </Dialog>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors disabled:opacity-30 [&_svg]:size-3.5 [@media(hover:none)]:size-8",
        danger ? "text-ink-3 hover:bg-danger/10 hover:text-danger" : "text-ink-3 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
