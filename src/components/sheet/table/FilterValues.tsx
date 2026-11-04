"use client";

// Filter by values: every value of the column with how often it occurs, a search box and
// "(Alle auswählen)", like Excel's checklist. While searching, only the found values count
// (they start ticked), so "search Probe, Anwenden" shows just the Probe rows. Ticking everything
// clears the filter.

import { Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { SheetTableText } from "@/i18n/messages/sheetTable";
import { cn } from "@/lib/utils";
import { valueKey, type ColumnValue } from "@/sheet/table/model";
import type { FilterSpec } from "@/sheet/types";
import { fieldClass } from "./parts";

/** More rows than this aren't drawn (the search finds the others). */
const SHOW = 300;

export function FilterValues({
  values,
  current,
  locale,
  t,
  disabled,
  onApply,
  onCancel,
}: {
  values: ColumnValue[];
  current: FilterSpec | undefined;
  locale: Locale;
  t: SheetTableText;
  disabled?: boolean;
  onApply: (filter: FilterSpec | null) => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() =>
    current?.kind === "values" ? new Set(current.values.map((v) => valueKey(v, locale))) : new Set(values.map((v) => v.key)),
  );
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Set<string>>(() => new Set());

  const label = (v: ColumnValue) => v.text || t.emptyValue;
  const matching = (q: string) => {
    const needle = q.trim().toLocaleLowerCase(locale);
    return needle ? values.filter((v) => label(v).toLocaleLowerCase(locale).includes(needle)) : values;
  };
  const searching = query.trim() !== "";
  const list = matching(query);
  const active = searching ? found : checked;
  const setActive = searching ? setFound : setChecked;
  const allOn = list.length > 0 && list.every((v) => active.has(v.key));
  const someOn = list.some((v) => active.has(v.key));
  const chosen = searching ? list.filter((v) => found.has(v.key)) : values.filter((v) => checked.has(v.key));

  const toggle = (key: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () =>
    setActive((prev) => {
      const next = new Set(prev);
      for (const v of list) {
        if (allOn) next.delete(v.key);
        else next.add(v.key);
      }
      return next;
    });
  const search = (text: string) => {
    setQuery(text);
    // A new search starts with everything it finds ticked, like Excel.
    setFound(new Set(matching(text).map((v) => v.key)));
  };
  const apply = () => {
    if (!chosen.length || disabled) return;
    if (!searching && chosen.length === values.length) onApply(null);
    else onApply({ kind: "values", values: chosen.map((v) => v.text) });
  };

  // Up and down move between the ticks (the list can be long).
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const boxes = [...e.currentTarget.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    const i = boxes.indexOf(document.activeElement as HTMLInputElement);
    const next = boxes[Math.max(0, Math.min(boxes.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const rowClass = "flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] text-ink transition-colors hover:bg-hover [@media(hover:none)]:h-10";
  const boxClass = "size-4 shrink-0 cursor-pointer accent-blob";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder={t.search}
          aria-label={t.search}
          autoComplete="off"
          spellCheck={false}
          className={cn(fieldClass, "pl-8")}
        />
      </div>
      <div role="group" aria-label={t.filterBy.values} onKeyDown={onListKey} className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-line bg-raised p-1 [@media(hover:none)]:max-h-72">
        {list.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12.5px] text-ink-2">{t.noMatches}</p>
        ) : (
          <>
            <label className={cn(rowClass, "font-medium")}>
              <input
                type="checkbox"
                className={boxClass}
                checked={allOn}
                disabled={disabled}
                ref={(el) => {
                  if (el) el.indeterminate = someOn && !allOn;
                }}
                onChange={toggleAll}
              />
              <span className="min-w-0 flex-1 truncate">{searching ? t.selectAllResults : t.selectAll}</span>
            </label>
            {list.slice(0, SHOW).map((v) => (
              <label key={v.key} className={rowClass}>
                <input type="checkbox" className={boxClass} checked={active.has(v.key)} disabled={disabled} onChange={() => toggle(v.key)} />
                <span className={cn("min-w-0 flex-1 truncate", !v.text && "italic text-ink-2", v.num !== null && "tabular-nums")}>{label(v)}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-2">{v.count}</span>
              </label>
            ))}
            {list.length > SHOW && <p className="px-2 py-1.5 text-[12px] text-ink-2">{t.moreValues(list.length - SHOW)}</p>}
          </>
        )}
      </div>
      {!chosen.length && list.length > 0 && (
        <p className="text-[12px] text-ink-2" role="status">
          {t.nothingChecked}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!chosen.length || disabled}
          className="inline-flex h-8 items-center rounded-lg bg-blob px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-blob-deep dark:bg-blob-deep dark:hover:bg-[color-mix(in_srgb,var(--blob-deep)_88%,white)] disabled:opacity-45 [@media(hover:none)]:h-10"
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
}
