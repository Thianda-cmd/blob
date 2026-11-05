import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

// The frame of every overview page (Start, Notizen, Lernen, Aufgaben, Projekte, Fächer, Papierkorb,
// Lebenslauf, Blobs Ecke, Einstellungen …), in the look of the spreadsheet page: under the TopBar,
// a hairline and the page on paper, with white cards on it. The page's create button (violet) and
// its view switch (Segmented) go into the TopBar's actions, like on the calendar; the title, one
// meta line and a toolbar row go into PageHeader. Not for editors (notes, spreadsheets,
// presentations, handwriting, the calendar), which have their own frame.

const WIDTH = {
  wide: "max-w-[1320px]",
  default: "max-w-[1080px]",
  narrow: "max-w-[880px]",
  full: "",
} as const;

/** The scrolling page area on paper. `width`: how wide its content may get. */
export function PageBody({
  width = "wide",
  scrollRef,
  className,
  outerClassName,
  children,
  id,
}: {
  width?: keyof typeof WIDTH;
  scrollRef?: Ref<HTMLDivElement>;
  /** Classes for the centred content column. */
  className?: string;
  /** Classes for the scrolling area itself. */
  outerClassName?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div
      ref={scrollRef}
      id={id}
      className={cn(
        "relative min-h-0 flex-1 overflow-y-auto border-t border-line bg-paper print:overflow-visible print:border-0 print:bg-transparent",
        outerClassName,
      )}
    >
      <div className={cn("mx-auto w-full px-4 pb-24 pt-5 sm:px-6 sm:pb-16 lg:px-8 lg:pt-6", WIDTH[width], className)}>{children}</div>
    </div>
  );
}

/** A page's title: display font, semibold, 22 px (24 from sm). */
export const pageTitleClass = "font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[24px]";
/** A bigger title for a greeting (Start) or a start screen. */
export const heroTitleClass = "font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]";

/**
 * A page's header: an optional small label above (a date, the subject), the title, one line of
 * meta (counts, what this is) and actions for the thing itself (a subject's ⋯). `children` is a
 * toolbar row under it (search, filters), which scrolls sideways on phones. No eyebrow in capitals,
 * no paragraph of intro (explanations belong on empty and start screens), no load-in animation.
 */
export function PageHeader({
  title,
  label,
  meta,
  icon,
  actions,
  children,
  size = "page",
  wrapMeta = false,
  className,
  titleId,
}: {
  title: ReactNode;
  label?: ReactNode;
  meta?: ReactNode;
  /** An emoji or icon in a small raised tile before the title (a subject's emoji). */
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  size?: "page" | "hero";
  /** Let the meta line wrap onto a second line instead of being cut (a subject's counts and its next test). */
  wrapMeta?: boolean;
  className?: string;
  titleId?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:mb-6", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-[20px] leading-none shadow-card [&_svg]:size-5">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {label && <p className="mb-0.5 truncate text-[12.5px] font-medium text-ink-2">{label}</p>}
          <h1 id={titleId} className={cn(size === "hero" ? heroTitleClass : pageTitleClass, "line-clamp-2 break-words")}>
            {title}
          </h1>
          {meta && (
            <p className={cn("mt-0.5 text-[13px] text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]", wrapMeta ? "line-clamp-2" : "truncate")}>{meta}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children && (
        // (On phones the row scrolls sideways, which also cuts what sticks out above and below it:
        // 6 px of room there, so a field's or a button's focus ring shows whole.)
        <div className="-mx-4 -my-1.5 flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0">
          {children}
        </div>
      )}
    </header>
  );
}

/** A section's heading on a page: 17 px display, an optional count and an action on the right ("Alle ansehen →"). */
export function SectionHeader({ title, count, action, id, className }: { title: ReactNode; count?: number | null; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-3 flex min-h-6 items-baseline gap-2", className)}>
      <h2 id={id} className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {count != null && <span className="text-[13px] tabular-nums text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]">{count}</span>}
      {action && <span className="ml-auto self-center text-[12.5px]">{action}</span>}
    </div>
  );
}
