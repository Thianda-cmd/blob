import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line bg-raised px-1 font-sans text-[10.5px] font-medium text-ink-3 shadow-[0_1px_0_var(--line)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
