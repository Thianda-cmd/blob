"use client";

// Help while typing a formula, under the cell being edited: functions that match the word being
// typed (German and English names, each with one line of what it does), the arguments of the
// function the caret is in with the current one in bold ("MITTELWERT(Zahl1; [Zahl2]; …)"), and
// the result so far. Uses the same helpers as the formula bar (chrome/formulaInput.ts), so both
// suggest and hint the same.

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { FUNCTION_BY_DE, FUNCTION_BY_EN, type FunctionName } from "@/sheet/engine";
import { FUNCTION_DOCS } from "@/sheet/engine/docs";
import { argumentAt, suggestFunctions } from "../chrome/formulaInput";

/** Run a helper that may still be missing or fail on half-typed input; a hint is never worth breaking typing for. */
function quietly<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export type Suggestions = { start: number; end: number; items: FunctionName[] };

/** Functions to suggest for the word before the caret (formulas only), at most `max`. */
export function formulaSuggestions(text: string, caret: number, locale: Locale, max = 8): Suggestions | null {
  if (!text.startsWith("=")) return null;
  const s = quietly(() => suggestFunctions(text, caret, locale), null);
  if (!s || !s.items.length) return null;
  return { ...s, items: s.items.slice(0, max) };
}

/** The function call the caret is in, by its English name, and which argument. */
export function formulaArgument(text: string, caret: number, locale: Locale): { fn: string; index: number } | null {
  if (!text.startsWith("=")) return null;
  const a = quietly(() => argumentAt(text, caret, locale), null);
  if (!a) return null;
  const upper = a.fn.toUpperCase();
  const known = FUNCTION_BY_EN.get(upper) ?? FUNCTION_BY_DE.get(upper);
  return { fn: known?.en ?? upper, index: a.index };
}

/** A function's name in the user's language. */
export const localName = (fn: FunctionName, locale: Locale) => (locale === "de" ? fn.de : fn.en);

function summaryOf(en: string, locale: Locale): string | undefined {
  return FUNCTION_DOCS[en]?.[locale]?.summary;
}

/** "MITTELWERT(Zahl1; [Zahl2]; …)" with the argument at `index` in bold. */
export function ArgumentHint({ fn, index, locale }: { fn: string; index: number; locale: Locale }) {
  const name = FUNCTION_BY_EN.get(fn);
  const doc = FUNCTION_DOCS[fn]?.[locale];
  const shown = name ? localName(name, locale) : fn;
  const sep = locale === "de" ? "; " : ", ";
  const args = doc?.args ?? [];
  // Past the last argument, a repeating one (Zahl1; Zahl2; …) is still the current one.
  const last = args.length - 1;
  const current = index > last && last >= 0 && args[last].repeat ? last : index;
  const parts: ReactNode[] = [];
  args.forEach((a, i) => {
    if (i > 0) parts.push(sep);
    const label = a.optional ? `[${a.name}]` : a.name;
    parts.push(
      i === current ? (
        <b key={i} className="font-semibold text-ink">
          {label}
        </b>
      ) : (
        label
      ),
    );
    if (a.repeat && i === last) parts.push(`${sep}…`);
  });
  return (
    <div className="px-2.5 py-1.5">
      <div className="font-mono text-[12px] leading-snug text-ink-2">
        <span className="font-semibold text-ink">{shown}</span>(<span>{parts}</span>)
      </div>
      {doc?.summary && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{doc.summary}</div>}
      {current >= 0 && current <= last && args[current]?.desc && (
        <div className="mt-0.5 text-[11.5px] leading-snug text-ink-2">
          <span className="font-medium">{args[current].name}</span>: {args[current].desc}
        </div>
      )}
    </div>
  );
}

/** The list of matching functions; `pick` is the highlighted one. Pressing an item keeps the focus in the editor. */
export function SuggestionList({
  items,
  pick,
  locale,
  label,
  hint,
  onPick,
  id,
}: {
  items: FunctionName[];
  pick: number;
  locale: Locale;
  label: string;
  hint: string;
  onPick: (fn: FunctionName) => void;
  id?: string;
}) {
  return (
    <div>
      <ul id={id} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
        {items.map((fn, i) => (
          <li
            key={fn.en}
            id={id ? `${id}-${i}` : undefined}
            role="option"
            aria-selected={i === pick}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(fn)}
            className={`flex cursor-pointer flex-col rounded-lg px-2 py-1 [@media(hover:none)]:py-2 ${i === pick ? "bg-blob-soft" : "hover:bg-hover"}`}
          >
            <span className={`font-mono text-[12.5px] font-medium ${i === pick ? "text-blob-ink" : "text-ink"}`}>{localName(fn, locale)}</span>
            {summaryOf(fn.en, locale) && <span className="line-clamp-1 text-[11.5px] text-ink-3">{summaryOf(fn.en, locale)}</span>}
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-2.5 py-1 text-[11px] text-ink-3">{hint}</div>
    </div>
  );
}
