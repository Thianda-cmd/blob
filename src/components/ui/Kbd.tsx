import { cn } from "@/lib/utils";

/** A key cap ("Strg", "F6"). Its letters are a mid-tone between ink-2 and ink-3: lighter than text, still 4.5:1 and more. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line bg-raised px-1 font-sans text-[10.5px] font-medium text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] shadow-[0_1px_0_var(--line)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
