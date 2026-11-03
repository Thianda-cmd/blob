"use client";

// A spreadsheet seen through its public link. The read-only grid (PublicSheetView.tsx, with the
// formula engine behind it) loads in a bundle of its own: the public page shows notes, decks and
// handwriting too, and those don't need it.

import dynamic from "next/dynamic";
import { GooSpinner } from "@/components/blob/GooSpinner";

export const PublicSheet = dynamic(() => import("./PublicSheetView").then((m) => m.PublicSheetView), {
  loading: () => (
    <div className="grid h-[min(72vh,640px)] min-h-[320px] place-items-center rounded-xl border border-line bg-raised shadow-card">
      <GooSpinner size={48} />
    </div>
  ),
});
