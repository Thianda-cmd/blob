"use client";

import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The bar above a note that asks before an address someone sent adds a spreadsheet block
 * (src/components/editor/useSheetEmbedParam.ts): Blob's own "Add to note" never needs it.
 */
export function SheetEmbedOffer({ question, add, no, onAnswer }: { question: string; add: string; no: string; onAnswer: (add: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-blob-soft/60 px-4 py-2 text-[13px] text-blob-ink" aria-live="polite">
      <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
      {/* Room enough for the question, else the buttons go below it; a long file name breaks anywhere. */}
      <span className="min-w-[12rem] flex-1 [overflow-wrap:anywhere]">{question}</span>
      <span className="ml-auto flex gap-2">
        <Button size="sm" variant="blob" onClick={() => onAnswer(true)}>
          {add}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAnswer(false)}>
          {no}
        </Button>
      </span>
    </div>
  );
}
