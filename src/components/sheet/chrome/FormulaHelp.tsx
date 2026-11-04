"use client";

// Help while typing a formula in the formula bar, and in the function browser: a function's
// syntax with the argument you are in bold ("MITTELWERT(Zahl1; [Zahl2]; …)"), the list of
// matching functions with one line of what each does, and the result so far.

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { SheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { FUNCTION_BY_EN, type FunctionName } from "@/sheet/engine";
import { FUNCTION_DOCS, type FnArgDoc, type FnDoc } from "@/sheet/engine/docs";

/**
 * What the help says about a function and its arguments, read while typing to learn the function
 * (here and in the cell's own help): as big and as dark as the settings panels' hints (12 px, 4.5:1
 * and more on every theme).
 */
export const HELP_TEXT = "text-[12px] leading-snug text-ink-2";

/** A function's name in the user's language. */
export const localName = (fn: FunctionName, locale: Locale) => (locale === "de" ? fn.de : fn.en);

/** A function's help in the user's language, when there is some. */
export function fnDoc(en: string, locale: Locale): FnDoc | undefined {
  return FUNCTION_DOCS[en]?.[locale];
}

/** Which argument is "current": past the last one, a repeating one (Zahl1; Zahl2; …) still is. */
export function currentArg(args: FnArgDoc[], index: number): number {
  const last = args.length - 1;
  if (last < 0) return -1;
  return index > last && args[last].repeat ? last : index;
}

/** "MITTELWERT(Zahl1; [Zahl2]; …)", the argument at `current` in bold. */
export function Syntax({ name, args, locale, current = -1, className }: { name: string; args: FnArgDoc[]; locale: Locale; current?: number; className?: string }) {
  const sep = locale === "de" ? "; " : ", ";
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
        <span key={i}>{label}</span>
      ),
    );
    if (a.repeat && i === args.length - 1) parts.push(`${sep}…`);
  });
  return (
    <span className={cn("font-mono text-ink-2", className)}>
      <span className="font-semibold text-ink">{name}</span>({parts})
    </span>
  );
}

/**
 * The hint under the formula bar: the call the caret is in, its current argument and what that is.
 * `compact` (phones): the call alone on one line, so the cells under it stay in view to be tapped.
 */
export function ArgumentHint({ fn, index, locale, t, compact = false }: { fn: string; index: number; locale: Locale; t: SheetChromeText; compact?: boolean }) {
  const info = FUNCTION_BY_EN.get(fn);
  const doc = fnDoc(fn, locale);
  const name = info ? localName(info, locale) : fn;
  const args = doc?.args ?? [];
  const current = currentArg(args, index);
  const arg = current >= 0 ? args[current] : undefined;
  if (compact) return <Syntax name={name} args={args} locale={locale} current={current} className="block min-w-0 truncate text-[12.5px] leading-snug" />;
  return (
    <div className="px-3 py-2">
      <div className="text-[12.5px] leading-snug">
        <Syntax name={name} args={args} locale={locale} current={current} />
      </div>
      {doc?.summary ? (
        <div className={cn("mt-0.5 line-clamp-2", HELP_TEXT)}>{doc.summary}</div>
      ) : (
        info && <div className="mt-0.5 text-[12px] text-ink-3">{t.categories[info.category]}</div>
      )}
      {arg?.desc && (
        <div className="mt-1 text-[12px] leading-snug text-ink-2">
          <span className="font-medium text-ink">{arg.name}</span>
          {arg.optional && <span className="text-ink-3"> ({t.optional})</span>}: {arg.desc}
        </div>
      )}
    </div>
  );
}

/**
 * Matching functions while typing; `pick` is highlighted. Pressing an item keeps the keyboard in the
 * formula. `compact` (phones): one line per function and no keyboard hint, so it covers less.
 */
export function SuggestionList({
  id,
  items,
  pick,
  locale,
  t,
  tapHint,
  typed,
  onPick,
  onHover,
  compact = false,
}: {
  id: string;
  items: FunctionName[];
  pick: number;
  locale: Locale;
  t: SheetChromeText;
  /** The list's last line on touch screens, in place of the keys (t.pickHint). */
  tapHint: string;
  /** What was typed, to tell when an item matched by its other language's name. */
  typed: string;
  onPick: (fn: FunctionName) => void;
  onHover?: (i: number) => void;
  compact?: boolean;
}) {
  const upper = typed.toUpperCase();
  return (
    <div>
      <ul id={id} role="listbox" aria-label={t.suggestions} className={cn("overflow-y-auto overscroll-contain p-1", compact ? "max-h-[min(30vh,200px)]" : "max-h-[min(40vh,280px)]")}>
        {items.map((fn, i) => {
          const name = localName(fn, locale);
          const other = locale === "de" && !fn.de.startsWith(upper) && fn.en.startsWith(upper) ? fn.en : null;
          const doc = fnDoc(fn.en, locale);
          return (
            <li
              key={fn.en}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === pick}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") onHover?.(i);
              }}
              onClick={() => onPick(fn)}
              className={cn("flex cursor-pointer flex-col rounded-lg px-2 py-1 [@media(hover:none)]:py-2", i === pick ? "bg-blob-soft" : "hover:bg-hover")}
            >
              <span className="flex items-baseline gap-2">
                <span className={cn("font-mono text-[12.5px] font-medium", i === pick ? "text-blob-ink" : "text-ink")}>{name}</span>
                {other && <span className="font-mono text-[11px] text-ink-3">{other}</span>}
                <span className="ml-auto shrink-0 text-[10.5px] text-ink-3">{t.categories[fn.category]}</span>
              </span>
              {doc?.summary && !compact && <span className={cn("line-clamp-1", HELP_TEXT)}>{doc.summary}</span>}
            </li>
          );
        })}
      </ul>
      {/* A finger takes a function by tapping it: an on-screen keyboard has no Tab key. */}
      {!compact && (
        <div className={cn("border-t border-line px-2.5 py-1", HELP_TEXT)}>
          <span className="[@media(hover:none)]:hidden">{t.pickHint}</span>
          <span className="hidden [@media(hover:none)]:inline">{tapHint}</span>
        </div>
      )}
    </div>
  );
}
