"use client";

import { ChevronDown, FileDown, Printer, Smartphone } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { useTrapFocus } from "./useTrapFocus";

const KEY = "blob-cv-pdf-explained";

/** Whether the student said "don't show this again" (this browser only). */
export function pdfExplained() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function rememberExplained() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob-soft text-[12px] font-semibold text-blob-ink">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

/** The first time: how the print window turns into a PDF. Then the print window opens. */
export function PdfDialog({ open, onClose, onPrint, warning }: { open: boolean; onClose: () => void; onPrint: () => void; warning?: ReactNode }) {
  const t = useMessages(cvEditorText).pdfDialog;
  const [dontShow, setDontShow] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useTrapFocus(open, boxRef);
  return (
    <Dialog open={open} onClose={onClose} labelledBy="cv-pdf-title" className="max-w-[440px]">
      <div ref={boxRef} className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
            <FileDown className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="cv-pdf-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {t.title}
            </h2>
            <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{t.intro}</p>
          </div>
        </div>

        <ol className="mt-4 space-y-3 text-[13.5px] text-ink">
          <Step n={1}>
            <p>{t.step1}</p>
            {/* What it looks like in the print window, so it's easy to spot. */}
            <div aria-hidden className="mt-2 flex max-w-[300px] items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-card">
              <span className="text-ink-3">{t.mockLabel}</span>
              <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 font-medium text-ink">
                <FileDown className="size-3.5 shrink-0 text-blob" />
                <span className="truncate">{t.mockValue}</span>
                <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
              </span>
            </div>
          </Step>
          <Step n={2}>
            <p>{t.step2}</p>
          </Step>
        </ol>

        <p className="mt-4 flex gap-2 rounded-lg bg-hover/60 px-3 py-2 text-[12.5px] leading-snug text-ink-2">
          <Smartphone className="mt-px size-4 shrink-0 text-ink-3" />
          <span>{t.phone}</span>
        </p>

        {warning}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="size-4 accent-[var(--blob)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blob" />
            {t.dontShow}
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              variant="blob"
              autoFocus
              onClick={() => {
                if (dontShow) rememberExplained();
                onPrint();
              }}
            >
              <Printer className="size-4" /> {t.go}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
