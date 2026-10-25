"use client";

import { FileText, FileUser, Folder, Presentation } from "lucide-react";
import { createContext, useContext } from "react";
import type { PublicPageRef } from "@/lib/publicLink";
import type { PageKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The public link a page is seen through, and the pages it also opens (for links inside the note). */
export type PublicPages = { token: string; root: string; pages: Map<string, PublicPageRef> };

const Ctx = createContext<PublicPages>({ token: "", root: "", pages: new Map() });

export const PublicPagesProvider = Ctx.Provider;

export function usePublicPages() {
  return useContext(Ctx);
}

/** A page's emoji, else an icon for its kind. */
export function PageGlyph({ page, className }: { page: { icon: string | null; kind: PageKind }; className?: string }) {
  if (page.icon) return <span className={cn("grid size-4 shrink-0 place-items-center text-[13px] leading-none", className)}>{page.icon}</span>;
  const Icon = page.kind === "deck" ? Presentation : page.kind === "cv" ? FileUser : page.kind === "folder" ? Folder : FileText;
  return <Icon className={cn("size-4 shrink-0 text-ink-3", className)} strokeWidth={1.8} />;
}
