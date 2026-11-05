import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * What a page or a section shows when there's nothing yet: a picture (usually Blob), a short title,
 * one or two sentences and what to do. No border and no dashed box: it sits on the page.
 */
export function EmptyState({
  art,
  title,
  body,
  actions,
  children,
  className,
  size = "md",
}: {
  art?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** sm: inside a section or side column. */
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("mx-auto flex max-w-[480px] flex-col items-center px-4 text-center", size === "md" ? "py-12 sm:py-16" : "py-6", className)}>
      {art}
      <h2 className={cn("font-display font-semibold tracking-[-0.01em] text-ink", art && "mt-3", size === "md" ? "text-[18px]" : "text-[15px]")}>{title}</h2>
      {body && <p className={cn("mt-1.5 text-balance leading-relaxed text-ink-2", size === "md" ? "text-[13.5px]" : "text-[13px]")}>{body}</p>}
      {actions && <div className={cn("flex flex-wrap justify-center gap-2", size === "md" ? "mt-5" : "mt-3.5")}>{actions}</div>}
      {children}
    </div>
  );
}
