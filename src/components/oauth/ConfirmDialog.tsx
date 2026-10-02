"use client";

import { useCallback, type ReactNode } from "react";
import { Blob, type BlobMood } from "@/components/blob/Blob";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/** A short "Are you sure?" with a worried little Blob. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel,
  loading,
  tone = "danger",
  mood = "worried",
  id,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  tone?: "danger" | "primary";
  mood?: BlobMood;
  id: string;
}) {
  const noop = useCallback(() => {}, []);
  return (
    <Dialog open={open} onClose={loading ? noop : onClose} className="max-w-[420px]" labelledBy={`${id}-title`}>
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onConfirm();
        }}
      >
        <div className="flex items-start gap-3.5">
          <div className="-ml-1 -mt-1 shrink-0">
            <Blob size={60} mood={mood} track={false} look={{ x: 0.3, y: 0.4 }} interactive={false} />
          </div>
          <div className="min-w-0 pt-1">
            <h2 id={`${id}-title`} className="font-display text-[17px] font-semibold leading-snug tracking-[-0.015em] text-balance">
              {title}
            </h2>
            <div className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {/* Something that can't be undone starts on Cancel, so a stray Enter doesn't confirm it. */}
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading} autoFocus={tone === "danger"}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={tone} loading={loading} autoFocus={tone !== "danger"}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
