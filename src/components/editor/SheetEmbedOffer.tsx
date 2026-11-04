"use client";

import { FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * How long after the bar appears its question goes into its status region (ms): a region that
 * comes with its words already in it isn't reliably read out.
 */
const SAY_AFTER = 150;

/**
 * The bar above a note that asks before an address someone sent adds a spreadsheet block
 * (src/components/editor/useSheetEmbedParam.ts): Blob's own "Add to note" never needs it. Screen
 * readers hear the question once, from a status region that is there before the question goes in
 * (the words shown are for the eyes).
 */
export function SheetEmbedOffer({ question, add, no, onAnswer }: { question: string; add: string; no: string; onAnswer: (add: boolean) => void }) {
  const [say, setSay] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSay(true), SAY_AFTER);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-blob-soft/60 px-4 py-2 text-[13px] text-blob-ink">
      <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
      <span role="status" className="sr-only">
        {say ? question : ""}
      </span>
      {/* Room enough for the question, else the buttons go below it; a long file name breaks anywhere. */}
      <span aria-hidden className="min-w-[12rem] flex-1 [overflow-wrap:anywhere]">
        {question}
      </span>
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
