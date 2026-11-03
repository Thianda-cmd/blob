"use client";

// CONTRACT: the function library (fx): categories, search in German and English, each function's
// help (src/sheet/engine/docs.ts). onPick gets the canonical (English) name.
//
// A dialog on wide screens (categories, list, details side by side) and a bottom sheet on phones
// (list, then the details of the one tapped). Search finds names in both languages, also without
// umlauts, and words of the descriptions ("Mittelwert", "Kalibrier…"). Works without help texts
// too: then a function shows its name and category.

import { ArrowLeft, Lightbulb, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Sheet } from "@/components/ui/Sheet";
import { usePhone } from "@/components/ui/useMediaQuery";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { sheetChromeText, type SheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { FUNCTION_BY_EN, FUNCTION_NAMES, type FunctionCategory, type FunctionName } from "@/sheet/engine";
import { fnDoc, localName, Syntax } from "./FormulaHelp";
import { POPULAR_FUNCTIONS } from "./formulaInput";

type Category = "popular" | "all" | FunctionCategory;

const CATEGORIES: FunctionCategory[] = ["math", "stats", "regression", "logic", "lookup", "text", "date", "info", "science"];
const POPULAR = POPULAR_FUNCTIONS.slice(0, 16)
  .map((en) => FUNCTION_BY_EN.get(en))
  .filter((f): f is FunctionName => !!f);

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");

/** Functions for a search (names first: starts with, then contains; then descriptions), or a category. */
export function browseFunctions(query: string, category: Category, locale: Locale): FunctionName[] {
  const q = fold(query.trim());
  if (!q) {
    if (category === "popular") return POPULAR;
    const list = category === "all" ? FUNCTION_NAMES : FUNCTION_NAMES.filter((f) => f.category === category);
    return [...list].sort((a, b) => localName(a, locale).localeCompare(localName(b, locale), locale));
  }
  const scored: { fn: FunctionName; score: number }[] = [];
  for (const fn of FUNCTION_NAMES) {
    const names = [fold(fn.de), fold(fn.en)];
    const own = fold(localName(fn, locale));
    let score = -1;
    if (own === q || names.includes(q)) score = 0;
    else if (own.startsWith(q)) score = 1;
    else if (names.some((n) => n.startsWith(q))) score = 2;
    else if (names.some((n) => n.includes(q))) score = 3;
    else {
      const doc = fnDoc(fn.en, locale);
      const text = doc ? fold(`${doc.summary} ${doc.tip ?? ""} ${doc.args.map((a) => a.name).join(" ")}`) : "";
      if (text.includes(q)) score = 4;
    }
    if (score >= 0) scored.push({ fn, score });
  }
  const pop = (f: FunctionName) => {
    const i = POPULAR_FUNCTIONS.indexOf(f.en);
    return i < 0 ? 1000 : i;
  };
  scored.sort((a, b) => a.score - b.score || pop(a.fn) - pop(b.fn) || localName(a.fn, locale).localeCompare(localName(b.fn, locale), locale));
  return scored.map((s) => s.fn);
}

function countIn(category: Category): number {
  if (category === "popular") return POPULAR.length;
  if (category === "all") return FUNCTION_NAMES.length;
  return FUNCTION_NAMES.filter((f) => f.category === category).length;
}

/** Everything about one function: syntax, arguments, example, tip. */
function Details({ fn, locale, t, canInsert, onInsert }: { fn: FunctionName; locale: Locale; t: SheetChromeText; canInsert: boolean; onInsert: () => void }) {
  const doc = fnDoc(fn.en, locale);
  const name = localName(fn, locale);
  const other = locale === "de" ? fn.en : fn.de;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-mono text-[19px] font-semibold tracking-tight text-ink">{name}</h3>
          <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-ink-3">{t.categories[fn.category]}</span>
        </div>
        {other !== name && <div className="mt-0.5 text-[12px] text-ink-3">{t.otherName(other)}</div>}
        {doc ? (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-ink">{doc.summary}</p>
            <section className="mt-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.syntax}</h4>
              <div className="mt-1.5 rounded-lg bg-paper px-3 py-2 text-[13px] leading-relaxed">
                <Syntax name={name} args={doc.args} locale={locale} />
              </div>
            </section>
            <section className="mt-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.arguments}</h4>
              {doc.args.length ? (
                <dl className="mt-1.5 space-y-2">
                  {doc.args.map((a) => (
                    <div key={a.name}>
                      <dt className="flex flex-wrap items-baseline gap-1.5">
                        <span className="font-mono text-[13px] font-medium text-ink">{a.name}</span>
                        {a.optional && <span className="text-[11px] text-ink-3">{t.optional}</span>}
                        {a.repeat && <span className="text-[11px] text-ink-3">· {t.repeats}</span>}
                      </dt>
                      <dd className="text-[13px] leading-snug text-ink-2">{a.desc}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1.5 text-[13px] text-ink-2">{t.noArgs}</p>
              )}
            </section>
            <section className="mt-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.example}</h4>
              <div className="mt-1.5 rounded-lg border border-line bg-paper px-3 py-2">
                <code className="block break-all font-mono text-[13px] text-ink">{doc.example}</code>
                <div className="mt-1 text-[12.5px] leading-snug text-ink-2">= {doc.exampleResult}</div>
              </div>
            </section>
            {doc.tip && (
              <section className="mt-4 flex gap-2.5 rounded-lg bg-blob-soft/60 px-3 py-2.5">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-blob-ink" aria-hidden />
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-blob-ink">{t.tip}</h4>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink">{doc.tip}</p>
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="mt-3 text-[13.5px] text-ink-2">{t.noDoc}</p>
        )}
      </div>
      {canInsert && (
        <div className="flex shrink-0 justify-end border-t border-line px-4 py-3">
          <Button variant="blob" size="md" onClick={onInsert} className="[@media(hover:none)]:h-10">
            {t.insert}
          </Button>
        </div>
      )}
    </div>
  );
}

export function FunctionBrowser({ open, onClose, onPick, canInsert = true }: { open: boolean; onClose: () => void; onPick: (fn: string) => void; canInsert?: boolean }): ReactNode {
  const phone = usePhone();
  const t = useMessages(sheetChromeText);
  if (phone) {
    return (
      <Sheet open={open} onClose={onClose} full label={t.browserTitle}>
        {open && <Browser phone onClose={onClose} onPick={onPick} canInsert={canInsert} />}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} className="max-w-[920px]!" labelledBy="sheet-fx-title">
      {open && <Browser phone={false} onClose={onClose} onPick={onPick} canInsert={canInsert} />}
    </Dialog>
  );
}

function Browser({ phone, onClose, onPick, canInsert }: { phone: boolean; onClose: () => void; onPick: (fn: string) => void; canInsert: boolean }) {
  const t = useMessages(sheetChromeText);
  const locale = useLocale();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("popular");
  const [selected, setSelected] = useState<string | null>(null);
  /** Phones: the list, or the details of one function. */
  const [detail, setDetail] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const items = useMemo(() => browseFunctions(query, category, locale), [query, category, locale]);
  const current = items.find((f) => f.en === selected) ?? items[0] ?? null;

  useEffect(() => {
    // Wide screens: start typing right away (phones would pop up the keyboard over the list).
    if (!phone) input.current?.focus();
  }, [phone]);

  // The highlighted function stays in sight while moving through the list with the keyboard.
  useEffect(() => {
    if (!current) return;
    const i = items.indexOf(current);
    list.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current, items]);

  const insert = (fn: FunctionName | null) => {
    if (fn && canInsert) onPick(fn.en);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!items.length) return;
    const i = current ? items.indexOf(current) : -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
      setSelected(next.en);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (phone) setDetail(true);
      else insert(current);
    }
  };

  /** The categories: chips in a row (phones, medium screens) or a column (wide screens). */
  const chips = (row: boolean) => (
    <div role="tablist" aria-label={t.browserTitle} className={cn(row ? "flex gap-1.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex flex-col gap-0.5 p-2")}>
      {(["popular", "all", ...CATEGORIES] as Category[]).map((c) => {
        const on = !query && category === c;
        const label = c === "popular" ? t.popular : c === "all" ? t.all : t.categories[c];
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              setCategory(c);
              setQuery("");
              setSelected(null);
            }}
            className={cn(
              "shrink-0 text-left text-[13px] transition-colors",
              row
                ? cn("h-8 rounded-full border px-3 [@media(hover:none)]:h-9", on ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover")
                : cn("flex h-8 items-center justify-between gap-2 rounded-lg px-2.5", on ? "bg-blob-soft font-medium text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink"),
            )}
          >
            <span className="truncate">{label}</span>
            {!row && <span className="text-[11px] tabular-nums text-ink-3">{countIn(c)}</span>}
          </button>
        );
      })}
    </div>
  );

  const search = (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-blob focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)]">
      <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
      <input
        ref={input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        onKeyDown={onKeyDown}
        placeholder={t.browserPlaceholder}
        aria-label={t.browserSearch}
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${items.indexOf(current)}` : undefined}
        spellCheck={false}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label={t.close} className="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );

  const listView = (
    <ul ref={list} id={listId} role="listbox" aria-label={t.browserTitle} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      {items.map((fn, i) => {
        const on = current?.en === fn.en;
        const doc = fnDoc(fn.en, locale);
        return (
          <li
            key={fn.en}
            id={`${listId}-${i}`}
            data-index={i}
            role="option"
            aria-selected={on}
            onClick={() => {
              setSelected(fn.en);
              if (phone) setDetail(true);
            }}
            onDoubleClick={() => insert(fn)}
            className={cn("cursor-pointer rounded-lg px-3 py-2 transition-colors [@media(hover:none)]:py-2.5", on && !phone ? "bg-blob-soft" : "hover:bg-hover")}
          >
            <div className="flex items-baseline gap-2">
              <span className={cn("font-mono text-[13px] font-medium", on && !phone ? "text-blob-ink" : "text-ink")}>{localName(fn, locale)}</span>
              {(query || category === "popular" || category === "all") && <span className="ml-auto shrink-0 text-[11px] text-ink-3">{t.categories[fn.category]}</span>}
            </div>
            <div className="line-clamp-2 text-[12.5px] leading-snug text-ink-3">{doc?.summary ?? t.categories[fn.category]}</div>
          </li>
        );
      })}
      {!items.length && <li className="px-3 py-8 text-center text-[13px] text-ink-3">{t.noResults(query)}</li>}
    </ul>
  );

  if (phone) {
    return (
      <div className="flex h-full flex-col">
        {detail && current ? (
          <>
            <div className="flex items-center gap-2 px-3 pb-1">
              <button type="button" onClick={() => setDetail(false)} className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-2 hover:bg-hover" aria-label={t.backToList}>
                <ArrowLeft className="size-4" />
                {t.backToList}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Details fn={current} locale={locale} t={t} canInsert={canInsert} onInsert={() => insert(current)} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 pb-2">
              <h2 className="font-display text-[18px] font-semibold text-ink">{t.browserTitle}</h2>
              <span className="ml-auto text-[12px] text-ink-3">{t.functionCount(items.length)}</span>
            </div>
            <div className="px-4 pb-2">{search}</div>
            {chips(true)}
            {listView}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[min(76vh,600px)] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h2 id="sheet-fx-title" className="shrink-0 font-display text-[18px] font-semibold text-ink">
          {t.browserTitle}
        </h2>
        {search}
        <button type="button" onClick={onClose} aria-label={t.close} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[196px] shrink-0 overflow-y-auto border-r border-line lg:block">{chips(false)}</nav>
        <div className="flex w-[300px] shrink-0 flex-col border-r border-line">
          <div className="lg:hidden">{chips(true)}</div>
          <div className="px-4 pt-2 text-[11.5px] text-ink-3">{t.functionCount(items.length)}</div>
          {listView}
        </div>
        <div className="min-w-0 flex-1">
          {current ? <Details fn={current} locale={locale} t={t} canInsert={canInsert} onInsert={() => insert(current)} /> : <p className="p-6 text-[13px] text-ink-3">{t.pickOne}</p>}
        </div>
      </div>
    </div>
  );
}
