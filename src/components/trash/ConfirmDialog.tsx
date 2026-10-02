"use client";

import type { ReactNode } from "react";
import { Blob } from "@/components/blob/Blob";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMessages } from "@/i18n/client";
import { trashText } from "@/i18n/messages/trash";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  loading?: boolean;
}) {
  const t = useMessages(trashText);
  return (
    <Dialog open={open} onClose={loading ? () => {} : onClose} className="max-w-[400px]" labelledBy="trash-confirm-title">
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <div className="flex items-start gap-3.5">
          <div className="-ml-1 -mt-1 shrink-0">
            <Blob size={60} mood="worried" track={false} look={{ x: 0.3, y: 0.4 }} />
          </div>
          <div className="min-w-0 pt-1">
            <h2 id="trash-confirm-title" className="font-display text-[17px] font-semibold leading-snug tracking-[-0.015em]">
              {title}
            </h2>
            <div className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {t.cancel}
          </Button>
          <Button type="submit" variant="danger" loading={loading} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
