"use client";

// The spreadsheet editor for /p/[id], in a bundle of its own: this route serves every kind of page
// (notes, decks, handwriting, folders), and only spreadsheets need the grid and the formula engine.
// (A client component is needed for that: the route's page is a server component, and the client
// components it imports directly all load together.)

import dynamic from "next/dynamic";
import { GooSpinner } from "@/components/blob/GooSpinner";

export const SheetPage = dynamic(() => import("@/components/sheet/SheetEditor").then((m) => m.SheetEditor), {
  loading: () => (
    <div className="grid flex-1 place-items-center">
      <GooSpinner size={56} />
    </div>
  ),
});
