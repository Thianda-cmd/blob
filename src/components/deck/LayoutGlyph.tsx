import type { SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Wireframe preview of a slide layout. Pure CSS, scales with its box (16:9). */
export function LayoutGlyph({ layout, active, className }: { layout: SlideLayout; active?: boolean; className?: string }) {
  const bar = "rounded-full bg-ink-3/45";
  const strong = "rounded-full bg-ink-2/80";
  const accent = "rounded-full bg-blob";
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-[5px] border bg-raised transition-colors",
        active ? "border-blob" : "border-line",
        className,
      )}
    >
      {layout === "title" && (
        <div className="absolute inset-0 flex flex-col justify-center gap-[7%] px-[13%]">
          <div className={cn(accent, "h-[5%] w-[14%]")} />
          <div className={cn(strong, "h-[13%] w-[78%]")} />
          <div className={cn(bar, "h-[7%] w-[46%]")} />
        </div>
      )}
      {layout === "bullets" && (
        <div className="absolute inset-0 flex flex-col gap-[8%] px-[12%] pt-[13%]">
          <div className={cn(strong, "h-[11%] w-[56%]")} />
          {[64, 52, 58].map((w, i) => (
            <div key={i} className="flex h-[7%] items-center gap-[4%]">
              <div className="aspect-square h-full rounded-full bg-blob" />
              <div className={cn(bar, "h-full")} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}
      {layout === "split" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="flex flex-col justify-center gap-[9%] pl-[18%] pr-[10%]">
            <div className={cn(strong, "h-[11%] w-full")} />
            <div className={cn(strong, "h-[11%] w-[70%]")} />
            <div className={cn(bar, "h-[6%] w-[80%]")} />
          </div>
          <div className="bg-ink-3/20" />
        </div>
      )}
      {layout === "quote" && (
        <div className="absolute inset-0 flex flex-col justify-center gap-[7%] px-[16%]">
          <svg viewBox="0 0 22 16" className="h-[14%] w-auto fill-blob">
            <path d="M0 16V9.5C0 4.6 2.6 1.4 7.6 0L8.6 2.2C6.2 3.2 5 4.9 4.9 7H9v9zM13 16V9.5c0-4.9 2.6-8.1 7.6-9.5l1 2.2c-2.4 1-3.6 2.7-3.7 4.8H22v9z" />
          </svg>
          <div className={cn(strong, "h-[9%] w-full")} />
          <div className={cn(strong, "h-[9%] w-[62%]")} />
          <div className="flex h-[6%] items-center gap-[4%]">
            <div className="h-[50%] w-[12%] rounded-full bg-blob" />
            <div className={cn(bar, "h-full w-[30%]")} />
          </div>
        </div>
      )}
      {layout === "image" && (
        <div className="absolute inset-0 flex flex-col gap-[7%] p-[7%]">
          <div className="relative flex-1 overflow-hidden rounded-[3px] bg-ink-3/20">
            <div className="absolute bottom-0 left-[14%] h-[55%] w-[46%] bg-ink-3/30 [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
            <div className="absolute bottom-0 left-[44%] h-[38%] w-[40%] bg-ink-3/40 [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
            <div className="absolute right-[16%] top-[18%] aspect-square h-[20%] rounded-full bg-blob/80" />
          </div>
          <div className={cn(strong, "h-[8%] w-[42%] shrink-0")} />
        </div>
      )}
      {layout === "big" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8%]">
          <div className="h-[34%] w-[40%] rounded-[3px] bg-blob" />
          <div className={cn(bar, "h-[7%] w-[44%]")} />
        </div>
      )}
    </div>
  );
}
