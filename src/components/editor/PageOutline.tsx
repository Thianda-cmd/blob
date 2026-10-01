"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** `n` is the heading's index among the note's top-level headings (in DOM order). */
type Heading = { n: number; level: number; text: string };

function readHeadings(editor: Editor): Heading[] {
  const out: Heading[] = [];
  let n = 0;
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (text) out.push({ n, level: node.attrs.level as number, text });
    n++;
  });
  return out;
}

function headingDOMs(editor: Editor) {
  return editor.view.dom.querySelectorAll<HTMLElement>(":scope > h1, :scope > h2, :scope > h3");
}

/**
 * "On this page": a quiet column of dashes at the right edge (one per heading) that
 * opens into a clickable outline on hover. Only rendered on wide screens.
 * Re-renders only when headings change, not on every keystroke.
 */
export function PageOutline({ editor, scroller }: { editor: Editor; scroller: HTMLElement | null }) {
  const headings = useEditorState({ editor, selector: ({ editor: e }) => readHeadings(e) });
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Long outlines: open with the current section in view (without scrolling the page).
  const centerActive = () => {
    const el = list.current;
    const btn = el?.querySelector<HTMLElement>("[data-active='true']");
    if (el && btn) el.scrollTop = btn.offsetTop - el.clientHeight / 2 + btn.offsetHeight / 2;
  };

  useEffect(() => {
    if (!scroller || headings.length < 2) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doms = headingDOMs(editor);
      const line = scroller.getBoundingClientRect().top + 120;
      let index = 0;
      headings.forEach((h, i) => {
        const dom = doms[h.n];
        if (dom && dom.getBoundingClientRect().top <= line) index = i;
      });
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) index = headings.length - 1;
      setActive(index);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [editor, scroller, headings]);

  if (headings.length < 2) return null;
  const minLevel = Math.min(...headings.map((h) => h.level));

  const go = (h: Heading) => {
    const dom = headingDOMs(editor)[h.n];
    if (!dom || !scroller) return;
    const top = scroller.scrollTop + dom.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 64;
    scroller.scrollTo({ top, behavior: "smooth" });
    dom.classList.remove("blob-flash");
    void dom.offsetWidth;
    dom.classList.add("blob-flash");
  };

  return (
    <nav aria-label="On this page" className="group/outline relative" onMouseEnter={centerActive} onFocus={centerActive}>
      <div
        className="flex flex-col items-end justify-between py-3 pl-8 pr-1"
        style={{ height: `min(${headings.length * 13 + 22}px, 56vh)` }}
        aria-hidden
      >
        {headings.map((h, i) => (
          <span
            key={h.n}
            className={cn("block h-[2px] rounded-full transition-[background,width] duration-200", i === active ? "bg-ink-2" : "bg-line-2")}
            style={{ width: 18 - (h.level - minLevel) * 5 }}
          />
        ))}
      </div>
      <div className="pointer-events-none invisible absolute right-0 top-0 w-[252px] origin-top-right translate-x-1 scale-[0.97] opacity-0 transition-[opacity,transform,visibility] duration-200 ease-out-soft group-focus-within/outline:pointer-events-auto group-focus-within/outline:visible group-focus-within/outline:translate-x-0 group-focus-within/outline:scale-100 group-focus-within/outline:opacity-100 group-hover/outline:pointer-events-auto group-hover/outline:visible group-hover/outline:translate-x-0 group-hover/outline:scale-100 group-hover/outline:opacity-100">
        <div className="rounded-xl border border-line bg-raised p-1.5 shadow-pop">
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium text-ink-3">On this page</div>
          <div ref={list} className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {headings.map((h, i) => (
              <button
                key={h.n}
                type="button"
                data-active={i === active}
                onClick={() => go(h)}
                className={cn(
                  "block w-full truncate rounded-md py-[5px] pr-2 text-left text-[13px] leading-snug transition-colors hover:bg-hover",
                  i === active ? "font-medium text-ink" : "text-ink-3 hover:text-ink",
                )}
                style={{ paddingLeft: 8 + (h.level - minLevel) * 12 }}
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
