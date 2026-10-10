"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BlobLook } from "./look";

// The student's look for every Blob inside (see look.ts). Client-only: the data and helpers live in
// look.ts so server code (layouts) can use them.

const LookContext = createContext<BlobLook>({});

/** Every Blob inside wears this look (unless it's given its own). */
export function BlobLookProvider({ look, children }: { look: BlobLook; children: ReactNode }) {
  return <LookContext value={look}>{children}</LookContext>;
}

export const useBlobLook = () => useContext(LookContext);
