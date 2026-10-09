"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PickerItem = {
  key: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
  /** More words that find it (another language, a subject…). */
  keywords?: string;
  /** Shown above the item when it starts a new group. */
  group?: string;
};

/** "Brüche" is found by "bru", "brü" and "brue". */
function forms(s: string) {
  const lower = s.toLowerCase();
  return [lower, lower.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss"), lower.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")];
}

/** Items matching every word of the query (best: the label starts with it). */
export function filterItems<T extends PickerItem>(items: T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const scored = items
    .map((item, index) => {
      const hay = forms(`${item.label} ${item.sub ?? ""} ${item.keywords ?? ""}`).join(" ");
      if (!words.every((w) => hay.includes(w))) return null;
      const starts = forms(item.label).some((f) => f.startsWith(words[0]));
      return { item, index, score: starts ? 0 : 1 };
    })
    .filter((x): x is { item: T; index: number; score: number } => !!x);
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((x) => x.item);
}

/** A search field over a list you can walk with the arrow keys (Enter picks). */
export function Picker({
  items,
  placeholder,
  empty,
  onPick,
  onCancel,
  autoFocus = true,
  className,
  listClassName,
  footer,
}: {
  items: PickerItem[];
  placeholder: string;
  empty: string;
  onPick: (key: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
  listClassName?: string;
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(query);
  const list = useRef<HTMLDivElement>(null);
  const shown = filterItems(items, query);
  if (seen !== query) {
    setSeen(query);
    setActive(0);
  }
  const current = Math.min(active, Math.max(shown.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let lastGroup: string | undefined;
  return (
    <div className={cn("blob-picker", className)} onMouseDown={(e) => e.stopPropagation()}>
      <div className="blob-picker-search">
        <Search className="size-4 shrink-0 text-ink-3" />
        <input
          ref={(el) => {
            // The picker opens because you want to search: start there.
            if (el && autoFocus && !el.dataset.focused) {
              el.dataset.focused = "1";
              requestAnimationFrame(() => el.focus({ preventScroll: true }));
            }
          }}
          data-open-editor
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((current + 1) % Math.max(shown.length, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((current - 1 + shown.length) % Math.max(shown.length, 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown[current]) onPick(shown[current].key);
            } else if (e.key === "Escape" && onCancel) {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3/80"
        />
      </div>
      <div ref={list} role="listbox" className={cn("blob-picker-list", listClassName)}>
        {shown.length === 0 ? (
          <div className="px-3 py-5 text-center text-[13px] text-ink-3">{empty}</div>
        ) : (
          shown.map((item, i) => {
            const group = item.group !== lastGroup ? item.group : undefined;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {group && <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-ink-3">{group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === current}
                  data-active={i === current}
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => onPick(item.key)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors", i === current ? "bg-hover" : "hover:bg-hover/60")}
                >
                  {item.icon && <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface text-ink-2">{item.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">{item.label}</span>
                    {item.sub && <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-3">{item.sub}</span>}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      {footer}
    </div>
  );
}
