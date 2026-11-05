"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

// The board's toolbar in the look of the spreadsheet's (sheet/chrome/Toolbar): one raised card with
// tool buttons, the ones that are on violet-soft, hairlines between groups. The classes are copied
// from sheet/chrome/parts.tsx, not imported: its ToolButton brings the sheet's tooltip system along.

/** The raised card the tools sit in. It scrolls sideways when they don't fit (phones). */
export function ToolbarCard({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-raised px-1.5 py-1 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

const toolClass =
  "relative inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 outline-none transition-[background,color,transform] duration-150 hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blob active:scale-[0.94] disabled:pointer-events-none disabled:opacity-35 [@media(hover:none)]:h-9 [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * A tool in the card. `pressed`: a toggle that is on (aria-pressed); `on`: shows a filter is set
 * without being a toggle (a menu's trigger, which says aria-expanded instead).
 */
export function ToolbarButton({
  pressed,
  on,
  className,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; on?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const lit = pressed || on;
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      {...props}
      className={cn(
        toolClass,
        lit ? "bg-blob-soft text-blob-ink hover:bg-blob-soft hover:text-blob-ink" : "aria-expanded:bg-hover aria-expanded:text-ink",
        className,
      )}
    />
  );
}

/** A hairline between groups of tools. */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-line" />;
}
