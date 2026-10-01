import type { SlideLayout } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Wireframe preview of a slide layout. Pure CSS, scales with its box (16:9). */
export function LayoutGlyph({ layout, active, className }: { layout: SlideLayout; active?: boolean; className?: string }) {
  const bar = "rounded-full bg-ink-3/45";
  const strong = "rounded-full bg-ink-2/80";
  const accent = "rounded-full bg-blob";
  const panel = "bg-ink-3/20";
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
      {layout === "section" && (
        <>
          <div className="absolute bottom-[8%] right-[8%] h-[52%] w-[30%] rounded-[3px] border-[3px] border-ink-3/20" />
          <div className="absolute inset-0 flex flex-col justify-center gap-[8%] pl-[13%] pr-[44%]">
            <div className={cn(accent, "h-[5%] w-[24%]")} />
            <div className={cn(strong, "h-[13%] w-full")} />
            <div className={cn(bar, "h-[7%] w-[70%]")} />
          </div>
        </>
      )}
      {layout === "agenda" && (
        <div className="absolute inset-0 flex flex-col gap-[7%] px-[12%] pt-[13%]">
          <div className={cn(strong, "h-[11%] w-[40%]")} />
          <div className="mt-[3%] flex flex-col">
            {[56, 44, 50].map((w, i) => (
              <div key={i} className="flex items-center gap-[5%] border-t border-ink-3/25 py-[4.5%]">
                <div className="h-[5px] w-[8%] rounded-[1px] bg-blob/80" />
                <div className={cn(bar, "h-[5px]")} style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
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
      {layout === "closing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8%]">
          <div className={cn(accent, "h-[5%] w-[12%]")} />
          <div className={cn(strong, "h-[16%] w-[52%]")} />
          <div className={cn(bar, "h-[7%] w-[38%]")} />
        </div>
      )}
      {layout === "split" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="flex flex-col justify-center gap-[9%] pl-[18%] pr-[10%]">
            <div className={cn(strong, "h-[11%] w-full")} />
            <div className={cn(strong, "h-[11%] w-[70%]")} />
            <div className={cn(bar, "h-[6%] w-[80%]")} />
          </div>
          <div className={panel} />
        </div>
      )}
      {layout === "media" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className={cn(panel, "relative overflow-hidden")}>
            <div className="absolute bottom-0 left-[10%] h-[45%] w-[70%] bg-ink-3/25 [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
            <div className="absolute right-[18%] top-[20%] aspect-square h-[16%] rounded-full bg-blob/80" />
          </div>
          <div className="flex flex-col justify-center gap-[9%] pl-[12%] pr-[16%]">
            <div className={cn(strong, "h-[11%] w-full")} />
            <div className={cn(strong, "h-[11%] w-[66%]")} />
            <div className={cn(bar, "h-[6%] w-[80%]")} />
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
      {layout === "cover" && (
        <div className="absolute inset-0 bg-ink-3/35">
          <div className="absolute bottom-0 left-[8%] h-[62%] w-[52%] bg-ink-3/30 [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
          <div className="absolute bottom-0 left-[40%] h-[46%] w-[48%] bg-ink-3/40 [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-ink/55 to-transparent" />
          <div className="absolute bottom-[14%] left-[10%] flex w-[60%] flex-col gap-[14%]">
            <div className="h-[4px] w-[16%] rounded-full bg-white/90" />
            <div className="h-[7px] w-full rounded-full bg-white" />
          </div>
        </div>
      )}
      {layout === "columns" && (
        <div className="absolute inset-0 flex flex-col gap-[10%] px-[11%] pt-[13%]">
          <div className={cn(strong, "h-[10%] w-[48%]")} />
          <div className="grid grid-cols-2 gap-[10%]">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-[14%] border-t border-ink-3/30 pt-[12%]">
                <div className={cn(strong, "h-[5px] w-[70%]")} />
                <div className={cn(bar, "h-[4px] w-full")} />
                <div className={cn(bar, "h-[4px] w-[80%]")} />
              </div>
            ))}
          </div>
        </div>
      )}
      {layout === "compare" && (
        <div className="absolute inset-0 flex flex-col gap-[8%] px-[9%] pt-[11%]">
          <div className={cn(strong, "h-[10%] w-[46%]")} />
          <div className="grid flex-1 grid-cols-2 gap-[6%] pb-[10%]">
            {[0, 1].map((i) => (
              <div key={i} className="relative flex flex-col gap-[12%] overflow-hidden rounded-[3px] bg-ink-3/15 px-[12%] pt-[16%]">
                {i === 0 && <div className="absolute inset-x-0 top-0 h-[6%] bg-blob" />}
                <div className={cn("h-[4px] w-[50%] rounded-full", i === 0 ? "bg-blob" : "bg-ink-2/80")} />
                <div className={cn(bar, "h-[3px] w-[80%]")} />
                <div className={cn(bar, "h-[3px] w-[64%]")} />
              </div>
            ))}
          </div>
        </div>
      )}
      {layout === "steps" && (
        <div className="absolute inset-0 flex flex-col px-[10%] pt-[13%]">
          <div className={cn(strong, "h-[10%] w-[44%]")} />
          <div className="mt-[14%] grid grid-cols-3 gap-[6%]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-[16%]">
                <div className="flex items-center gap-[8%]">
                  <div className="aspect-square w-[34%] rounded-full bg-blob" />
                  {i < 2 && <div className="h-[2px] flex-1 rounded-full bg-ink-3/40" />}
                </div>
                <div className={cn(strong, "h-[4px] w-[80%]")} />
                <div className={cn(bar, "h-[3px] w-[90%]")} />
              </div>
            ))}
          </div>
        </div>
      )}
      {layout === "timeline" && (
        <div className="absolute inset-0 flex flex-col px-[10%] pt-[13%]">
          <div className={cn(strong, "h-[10%] w-[40%]")} />
          <div className="relative mt-[12%] grid grid-cols-4">
            <div className="absolute left-[2%] right-[8%] top-[calc(4px+11%)] h-[2px] bg-ink-3/40" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative flex flex-col gap-[22%] pr-[14%]">
                <div className="h-[4px] w-[64%] rounded-full bg-blob/80" />
                <div className="relative z-10 aspect-square w-[22%] rounded-full border-2 border-blob bg-raised" />
                <div className={cn(bar, "h-[3px] w-full")} />
              </div>
            ))}
          </div>
        </div>
      )}
      {layout === "stats" && (
        <div className="absolute inset-0 grid grid-cols-3 items-center px-[9%]">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("flex flex-col gap-[12%] py-[4%]", i > 0 && "border-l border-ink-3/30 pl-[14%]")}>
              <div className="h-[13px] w-[70%] rounded-[2px] bg-blob" />
              <div className={cn(bar, "h-[4px] w-[86%]")} />
            </div>
          ))}
        </div>
      )}
      {layout === "big" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8%]">
          <div className="h-[34%] w-[40%] rounded-[3px] bg-blob" />
          <div className={cn(bar, "h-[7%] w-[44%]")} />
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
      {layout === "formula" && (
        <div className="absolute inset-0 flex flex-col px-[11%] pt-[13%]">
          <div className={cn(strong, "h-[10%] w-[40%]")} />
          <div className="flex flex-1 items-center justify-center pb-[8%] font-serif text-[115%] italic leading-none text-ink-2">
            x =
            <span className="ml-[6%] inline-flex flex-col items-center not-italic">
              <span className="h-[3px] w-[1.6em] rounded-full bg-blob" />
              <span className="my-[3px] h-px w-[2.2em] bg-ink-2/70" />
              <span className="h-[3px] w-[0.9em] rounded-full bg-ink-3/60" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
