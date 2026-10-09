"use client";

import { PenLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { blob } from "@/components/blob/bus";
import { Button, IconButton } from "@/components/ui/Button";
import { SignatureMark } from "@/cv/render";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { SignaturePad, type Point } from "./editor/SignaturePad";
import { useOfferUndo } from "./form/undo";
import type { CvEditorProps } from "./types";

/** Draw the signature (mouse, pen or finger), redo or remove it. */
export function SignatureField({ cv, change }: CvEditorProps) {
  const t = useMessages(cvEditorText).signature;
  const offerUndo = useOfferUndo();
  const signature = cv.closing.signature;
  // A fresh pad every time it opens, with what was drawn before it was closed by mistake.
  const [pad, setPad] = useState({ open: false, key: 0 });
  const [draft, setDraft] = useState<Point[][]>([]);
  const draw = () => setPad((p) => ({ open: true, key: p.key + 1 }));
  const remove = () => {
    const before = signature;
    change((c) => ({ ...c, closing: { ...c.closing, signature: null } }));
    offerUndo({ message: t.removed, restore: (c) => ({ ...c, closing: { ...c.closing, signature: before } }) });
  };

  return (
    <div>
      {signature ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-cv-signature-button
            onClick={draw}
            title={t.redraw}
            aria-label={t.redraw}
            className="flex h-[68px] min-w-[150px] max-w-full items-center justify-center rounded-xl border border-line bg-white px-4 shadow-card transition-colors hover:border-line-2"
          >
            <span className="max-w-full overflow-hidden">
              <SignatureMark signature={signature} height={13} />
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={draw}>
              <PenLine className="size-3.5" /> {t.redraw}
            </Button>
            <IconButton
              label={t.remove}
              onClick={remove}
              className="hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-cv-signature-button
          onClick={draw}
          className="group flex w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-line-2 bg-raised px-3.5 py-3 text-left transition-colors hover:border-blob hover:bg-blob-soft/30"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink transition-transform group-hover:-rotate-6">
            <PenLine className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-medium text-ink">{t.draw}</span>
            <span className="block text-[12.5px] text-ink-3">{t.drawHint}</span>
          </span>
        </button>
      )}

      <SignaturePad
        key={pad.key}
        open={pad.open}
        initial={draft}
        onClose={(strokes) => {
          setDraft(strokes);
          setPad((p) => ({ ...p, open: false }));
        }}
        onDone={(next) => {
          setDraft([]);
          setPad((p) => ({ ...p, open: false }));
          change((c) => ({ ...c, closing: { ...c.closing, signature: next, show: true } }));
          blob.react("jump", "happy");
        }}
      />
    </div>
  );
}
