"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** `hint` spells the count out ("15 topics") for the tooltip and screen readers. */
export type SubjectNavItem = { id: string; title: string; count: number; hint: string };

/** Where a subject counts as "being read": below the sticky site header and this bar. */
const READ_LINE = 140;

/**
 * Jump links to the gallery's subjects, sticky under the site header. The subject being read is underlined
 * (and scrolled into view when the row is wider than a phone).
 */
export function SubjectNav({ label, items, className }: { label: string; items: SubjectNavItem[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const nav = useRef<HTMLElement>(null);
  const ids = items.map((i) => i.id).join(" ");

  useEffect(() => {
    const sections = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0].id;
      for (const s of sections) if (s.getBoundingClientRect().top <= READ_LINE) current = s.id;
      // At the very bottom the last subject may be too short to reach the line.
      const root = document.documentElement;
      if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) current = sections[sections.length - 1].id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ids]);

  useEffect(() => {
    const row = nav.current;
    const link = row?.querySelector<HTMLElement>("[aria-current=true]");
    if (!row || !link) return;
    if (link.offsetLeft < row.scrollLeft || link.offsetLeft + link.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
    }
  }, [active]);

  return (
    // The background reaches into the page's side padding (cards scroll under it); the line stays as wide as the content.
    <div className={cn("sticky top-14 z-20 -mx-4 bg-paper/90 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6", className)}>
      <nav ref={nav} aria-label={label} className="relative flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={s.id === active ? "true" : undefined}
            aria-label={`${s.title}, ${s.hint}`}
            title={s.hint}
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[14px] font-medium transition-colors",
              s.id === active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {s.title}
            <span className="text-[12px] font-normal tabular-nums text-ink-3">{s.count}</span>
            {s.id === active && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-blob" />}
          </a>
        ))}
      </nav>
    </div>
  );
}
