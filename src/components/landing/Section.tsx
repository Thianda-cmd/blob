import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The landing page's section system (no client JS): sections alternate between bare paper and an
// inset panel (like the app's content panel), each opens with a kicker chip, a title and one short
// paragraph, and blocks fade up as they scroll in (the CSS `.reveal` in globals.css, visible
// without JS, with reduced motion, in print and in screenshots).

/** Fades up as it scrolls into view (CSS only). Never give it Tailwind translate-* classes. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("reveal", className)}>{children}</div>;
}

/**
 * One section of the page: `panel` puts it on a raised panel with a hairline (every other
 * section), else it sits on the paper. `tight`: less room above (right under the hero).
 * `backdrop` is drawn behind the content (the spreadsheet section's faint grid).
 */
export function Section({ id, panel, tight, backdrop, children }: { id?: string; panel?: boolean; tight?: boolean; backdrop?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-14 px-2 py-1 sm:px-3">
      <div className={cn("relative mx-auto max-w-[1416px]", panel && "rounded-2xl border border-line bg-surface")}>
        {backdrop}
        <div className={cn("relative mx-auto max-w-[1240px] px-4 pb-14 sm:px-6 sm:pb-16 lg:pb-20", tight ? "pt-6 sm:pt-8 lg:pt-10" : "pt-14 sm:pt-16 lg:pt-20")}>{children}</div>
      </div>
    </section>
  );
}

/** The small "New" chip: white on violet (the deeper violet in the dark theme, for contrast). */
export function NewChip({ label, className }: { label: string; className?: string }) {
  return <span className={cn("rounded-full bg-blob px-1.5 text-[10.5px] font-semibold leading-[18px] text-white dark:bg-blob-deep", className)}>{label}</span>;
}

/** A section's opening: kicker chip with its icon, the title, and one paragraph next to it from lg. */
export function SectionHead({ icon: Icon, kicker, fresh, title, body }: { icon: LucideIcon; kicker: string; fresh?: string; title: string; body: string }) {
  return (
    <div className="reveal grid items-end gap-x-10 gap-y-3 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-raised pl-2 text-[12.5px] font-medium text-ink-2 shadow-card", fresh ? "pr-1" : "pr-2.5")}>
          <Icon className="size-3.5 text-blob-ink" aria-hidden />
          {kicker}
          {fresh && <NewChip label={fresh} className="ml-0.5" />}
        </p>
        <h2 className="mt-3 font-display text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.02] tracking-[-0.035em] text-balance">{title}</h2>
      </div>
      <p className="max-w-[520px] text-[15.5px] leading-relaxed text-ink-2 lg:col-span-5">{body}</p>
    </div>
  );
}

/** A smaller feature inside a section (the notes home, homework): a sentence-case kicker, a title, a line and its demo. */
export function SubFeature({ id, icon: Icon, kicker, title, body, children, className }: { id: string; icon: LucideIcon; kicker: string; title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <article id={id} className={cn("scroll-mt-20", className)}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-blob-ink">
        <Icon className="size-3.5" aria-hidden />
        {kicker}
      </p>
      <h3 className="mt-1.5 font-display text-[21px] font-semibold leading-snug tracking-[-0.02em] text-balance">{title}</h3>
      <p className="mt-1.5 max-w-[560px] text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      <Reveal className="mt-4">{children}</Reveal>
    </article>
  );
}

/** "Free · No ads · Private until you share", each with a green tick (one line from a 390 px phone up). */
export function TrustRow({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12.5px] text-ink-2 sm:gap-x-4 sm:text-[13px]", className)}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1 sm:gap-1.5">
          <Check className="size-3.5 shrink-0 text-ok" strokeWidth={2.6} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}
