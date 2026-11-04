"use client";

// The number format panel (toolbar and "Mehr"): Excel's formats in German and English, each with
// a preview of the active cell's value, the decimals, the thousands separator, the currency
// symbol, and a unit after the number ("12,5 mg/L") for lab values.

import { Calendar, CalendarClock, Clock, Euro, FlaskConical, Hash, Minus, Percent, Plus, Ruler, Timer, Type, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { formatValue, isDuration, serialFromYMD } from "@/sheet/engine";
import { getCell } from "@/sheet/ops";
import type { NumberFormat } from "@/sheet/types";
import { useSheet, type SheetStore } from "../store";
import { changeDecimals, setNumberFormat, setUnit, stepDecimals, takesUnit, unitOf } from "./actions";
import { Choice, keepFocus } from "./parts";

export type FormatId = "general" | "number" | "percent" | "scientific" | "significant" | "currency" | "dateShort" | "dateLong" | "dateIso" | "time" | "duration" | "datetime" | "text";

/** Units lab students write after their numbers. */
export const UNIT_SUGGESTIONS = ["mg/L", "µg/mL", "mol/L", "mM", "µL", "mL", "°C", "nm", "%", "min", "h"];

/** Which entry of the list a format is. */
export function formatId(fmt: NumberFormat | undefined): FormatId {
  if (!fmt) return "general";
  switch (fmt.kind) {
    case "date":
      return fmt.style === "long" ? "dateLong" : fmt.style === "iso" ? "dateIso" : "dateShort";
    case "time":
      return isDuration(fmt) ? "duration" : "time";
    default:
      return fmt.kind;
  }
}

/**
 * The decimals the format menu's stepper shows: the format's own, or for Standard as many as the
 * number shows (0,0523: 4; in scientific notation the mantissa's), like the toolbar's buttons
 * count them. An empty or text cell: 0.
 */
export function shownDecimals(fmt: NumberFormat | undefined, value: number | null, locale: Locale): number {
  if (fmt && "decimals" in fmt) return fmt.decimals;
  if (fmt && fmt.kind !== "general") return 0;
  const shown = value === null ? null : stepDecimals(undefined, value, 0, locale);
  return shown && "decimals" in shown ? shown.decimals : 0;
}

/** Decimals that show `sig` significant digits of `value` (0,0000123 with 3 → 7). */
function decimalsFor(value: number | null, sig: number): number {
  if (value === null || value === 0 || !Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(10, sig - 1 - Math.floor(Math.log10(Math.abs(value)))));
}

/**
 * The format an entry stands for, keeping what fits from the current one: the unit, the currency
 * symbol, and the precision the value is shown with (Zahl 0,106 → Prozent 10,6 %, General 0,0523 →
 * Zahl 0,0523, not 0,05: lab values keep their digits).
 */
export function formatFor(id: FormatId, current: NumberFormat | undefined, locale: Locale, value: number | null = null): NumberFormat | null {
  const kind = current?.kind ?? "general";
  const decimals = current && "decimals" in current ? current.decimals : 2;
  const unit = unitOf(current) || undefined;
  const withUnit = <T extends NumberFormat>(f: T): T => (unit ? { ...f, unit } : f);
  /** Decimals a fixed-point number needs to show what the cell shows now. */
  const fixed = (): number => {
    switch (current?.kind) {
      case "number":
      case "currency":
        return current.decimals;
      case "percent":
        return Math.min(15, current.decimals + 2);
      case "scientific":
        return decimalsFor(value, current.decimals + 1);
      case "significant":
        return decimalsFor(value, current.digits);
      case undefined:
      case "general": {
        if (value === null) return 2;
        const shown = stepDecimals(undefined, value, 0, locale);
        return shown?.kind === "number" ? Math.min(4, shown.decimals) : decimalsFor(value, 3);
      }
      default:
        return 2;
    }
  };
  switch (id) {
    case "general":
      return null;
    case "number":
      return withUnit({ kind: "number", decimals: fixed(), ...(current?.kind === "number" && current.group ? { group: true } : {}) });
    case "percent":
      return { kind: "percent", decimals: kind === "percent" ? decimals : kind === "number" || kind === "currency" ? Math.max(0, decimals - 2) : 1 };
    case "scientific":
      return withUnit({ kind: "scientific", decimals: kind === "scientific" ? decimals : current?.kind === "significant" ? Math.max(0, current.digits - 1) : 2 });
    case "significant":
      return withUnit({ kind: "significant", digits: current?.kind === "significant" ? current.digits : current?.kind === "scientific" ? current.decimals + 1 : 3 });
    case "currency":
      return { kind: "currency", decimals: kind === "currency" ? decimals : 2, symbol: current?.kind === "currency" ? current.symbol : locale === "de" ? "€" : "$" };
    case "dateShort":
      return { kind: "date", style: "short" };
    case "dateLong":
      return { kind: "date", style: "long" };
    case "dateIso":
      return { kind: "date", style: "iso" };
    case "time":
      return { kind: "time", seconds: current?.kind === "time" ? current.seconds : false };
    case "duration":
      return { kind: "time", seconds: current?.kind === "time" ? current.seconds : false, duration: true };
    case "datetime":
      return { kind: "datetime" };
    case "text":
      return { kind: "text" };
  }
}

const ICONS: Record<FormatId, ReactNode> = {
  general: <Hash />,
  number: <span className="text-[11px] font-semibold leading-none">1,5</span>,
  percent: <Percent />,
  scientific: <span className="text-[10px] font-semibold leading-none">E+</span>,
  significant: <FlaskConical />,
  currency: <Euro />,
  dateShort: <Calendar />,
  dateLong: <Calendar />,
  dateIso: <Calendar />,
  time: <Clock />,
  duration: <Timer />,
  datetime: <CalendarClock />,
  text: <Type />,
};

const ORDER: FormatId[] = ["general", "number", "percent", "scientific", "significant", "currency", "dateShort", "dateLong", "dateIso", "time", "duration", "datetime", "text"];

// A fixed example date for the previews when the active cell has none: 3 November 2026, 14:30.
const SAMPLE_DATE = serialFromYMD(2026, 11, 3) + 14.5 / 24;
// …and a duration: one and a half days (36:00).
const SAMPLE_DURATION = 1.5;

/**
 * What a format would show: exactly what the active cell would look like, or (when it holds no
 * number) an example that shows the format off.
 */
function preview(id: FormatId, fmt: NumberFormat | null, value: number | null, text: string | null, locale: Locale): string {
  if (id === "text") return text ?? (value !== null ? formatValue(value, undefined, locale) : "007");
  if (value !== null) return formatValue(value, fmt ?? undefined, locale);
  const dateLike = id === "dateShort" || id === "dateLong" || id === "dateIso" || id === "time" || id === "datetime";
  const sample = id === "duration" ? SAMPLE_DURATION : dateLike ? SAMPLE_DATE : id === "percent" ? 0.1234 : id === "scientific" || id === "significant" ? 0.000123456 : 1234.5678;
  return formatValue(sample, fmt ?? undefined, locale);
}

/** The active cell's format, number and text (for the previews). */
function useActive(store: SheetStore) {
  const cell = useSheet(store, (s) => getCell(s.workbook, s.sheetId, s.selection.anchor.row, s.selection.anchor.col));
  const value = useSheet(store, (s) => {
    const v = s.calc.value(s.sheetId, s.selection.anchor.row, s.selection.anchor.col);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
  const text = useSheet(store, (s) => {
    const v = s.calc.value(s.sheetId, s.selection.anchor.row, s.selection.anchor.col);
    return typeof v === "string" && v ? v : null;
  });
  return { fmt: cell?.s?.fmt, value, text };
}

/**
 * A − value + stepper, from `min` up to 15. At an end its button is switched off with
 * aria-disabled, not disabled: pressed from the keyboard down to 0 decimals, the keyboard stays on
 * it (a disabled button would drop it out of the panel), and pressing it again does nothing, as in
 * a number field.
 */
function Stepper({ label, value, min, onLess, onMore, lessLabel, moreLabel }: { label: string; value: number; min: number; onLess: () => void; onMore: () => void; lessLabel: string; moreLabel: string }) {
  const first = value <= min;
  const last = value >= 15;
  // (Only the sign fades at an end: the keyboard's ring around it stays as clear as anywhere.)
  const btn = "grid size-7 place-items-center rounded-md text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-disabled:cursor-default aria-disabled:[&>svg]:opacity-35 [@media(hover:none)]:size-9";
  return (
    <div className="flex min-h-8 items-center gap-2 px-2 text-[13px] text-ink-2">
      <span className="flex-1">{label}</span>
      <button type="button" className={btn} onClick={first ? undefined : onLess} aria-label={lessLabel} aria-disabled={first || undefined}>
        <Minus className="size-3.5" />
      </button>
      <span className="w-5 text-center font-medium tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={last ? undefined : onMore} aria-label={moreLabel} aria-disabled={last || undefined}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** The list of formats and the settings of the current one. `onUnit` opens the unit panel. */
export function FormatPanel({ store, onDone, onUnit }: { store: SheetStore; onDone: () => void; onUnit: () => void }) {
  const t = useMessages(sheetChromeText);
  const locale = useSheet(store, (s) => s.locale);
  const { fmt, value, text } = useActive(store);
  const currentId = formatId(fmt);
  const decimals = fmt && "decimals" in fmt ? fmt.decimals : null;
  const unit = unitOf(fmt);

  const pick = (id: FormatId) => {
    setNumberFormat(store, formatFor(id, fmt, locale, value));
    onDone();
  };

  return (
    <div className="w-[min(310px,calc(100vw-24px))]" onMouseDown={keepFocus}>
      {/* The keyboard's focus ring goes inside each entry here: outside it, the edges of the
          scrolling list would cut it off (the current format, where the keyboard starts, is often
          the first or last entry in view). */}
      <div role="menu" aria-label={t.numberFormat} className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain [&_button]:outline-offset-[-2px]">
        {ORDER.map((id) => {
          const target = formatFor(id, fmt, locale, value);
          const hint = id === "general" || id === "significant" || id === "duration" || id === "text" ? t.formatHints[id] : undefined;
          return <Choice key={id} icon={ICONS[id]} label={t.formats[id]} hint={hint} right={preview(id, target, value, text, locale)} checked={currentId === id} onSelect={() => pick(id)} />;
        })}
      </div>
      {(currentId === "general" || decimals !== null || fmt?.kind === "significant") && <div className="mx-1 my-1 h-px bg-line" />}
      {fmt?.kind === "significant" ? (
        <Stepper label={t.digits} value={fmt.digits} min={1} onLess={() => changeDecimals(store, -1)} onMore={() => changeDecimals(store, 1)} lessLabel={t.fewerDecimals} moreLabel={t.moreDecimals} />
      ) : (
        (decimals !== null || currentId === "general") && (
          <Stepper
            label={t.decimals}
            value={shownDecimals(fmt, value, locale)}
            min={0}
            onLess={() => changeDecimals(store, -1)}
            onMore={() => changeDecimals(store, 1)}
            lessLabel={t.fewerDecimals}
            moreLabel={t.moreDecimals}
          />
        )
      )}
      {fmt?.kind === "number" && (
        <Choice role="menuitemcheckbox" label={t.thousands} right={formatValue(12345, { ...fmt, unit: undefined, decimals: 0, group: true }, locale)} checked={!!fmt.group} onSelect={() => setNumberFormat(store, { ...fmt, group: !fmt.group || undefined })} />
      )}
      {fmt?.kind === "currency" && (
        <div className="flex min-h-8 items-center gap-2 px-2 text-[13px] text-ink-2">
          <span className="flex-1">{t.currencySymbol}</span>
          {(["€", "$", "£", "CHF"] as const).map((symbol) => (
            <button
              key={symbol}
              type="button"
              aria-pressed={fmt.symbol === symbol}
              onClick={() => setNumberFormat(store, { ...fmt, symbol })}
              className={cn("h-7 min-w-8 rounded-md px-1.5 text-[12.5px] font-medium transition-colors [@media(hover:none)]:h-9", fmt.symbol === symbol ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover")}
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
      {/* (data-drill: Back from the unit puts the keyboard here again.) */}
      {takesUnit(fmt) && (
        <div data-drill="unit">
          <Choice role="menuitem" icon={<Ruler />} label={t.unitMenu} right={unit || undefined} onSelect={onUnit} />
        </div>
      )}
    </div>
  );
}

/** The unit after the selected numbers: type one or pick a common one; "Ohne Einheit" removes it. */
export function UnitPanel({ store, onDone }: { store: SheetStore; onDone: () => void }) {
  const t = useMessages(sheetChromeText);
  const locale = useSheet(store, (s) => s.locale);
  const { fmt, value } = useActive(store);
  const current = unitOf(fmt);
  const [draft, setDraft] = useState(current);
  const allowed = takesUnit(fmt);
  const apply = (u: string | null) => {
    if (!allowed) return;
    setUnit(store, u);
    onDone();
  };
  const sample = formatValue(value ?? 12.5, { kind: "number", decimals: value === null ? 1 : Math.min(4, Math.max(0, (String(value).split(".")[1] ?? "").length)), unit: draft || undefined }, locale);
  return (
    <div className="w-[min(300px,calc(100vw-24px))] p-1.5" onMouseDown={keepFocus}>
      <div className="px-0.5 text-[13px] font-medium text-ink">{t.unitTitle}</div>
      <p className="mt-0.5 px-0.5 text-[12px] leading-snug text-ink-2">{allowed ? t.unitHint : t.unitNotHere}</p>
      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 24))}
          placeholder={t.unitPlaceholder}
          aria-label={t.unit}
          disabled={!allowed}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none transition-[border,box-shadow] placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] disabled:opacity-50 [@media(hover:none)]:h-10 [@media(hover:none)]:text-[16px]"
        />
        {/* In dark mode white text needs the deeper purple (4.5:1 and more). */}
        <button
          type="submit"
          disabled={!allowed}
          className="h-8 shrink-0 rounded-lg bg-blob px-3 text-[13px] font-medium text-white transition-colors hover:bg-blob-deep disabled:opacity-40 dark:bg-blob-deep dark:hover:bg-[color-mix(in_srgb,var(--blob-deep)_88%,white)] [@media(hover:none)]:h-10"
        >
          {t.unitApply}
        </button>
      </form>
      {allowed && draft && <div className="mt-1.5 px-0.5 text-[12px] tabular-nums text-ink-2">{sample}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {UNIT_SUGGESTIONS.map((u) => (
          <button
            key={u}
            type="button"
            disabled={!allowed}
            onClick={() => apply(u)}
            className={cn(
              "h-7 rounded-full border px-2.5 text-[12.5px] transition-colors disabled:opacity-40 [@media(hover:none)]:h-9",
              current === u ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:border-line-2 hover:bg-hover hover:text-ink",
            )}
          >
            {u}
          </button>
        ))}
      </div>
      {current && (
        <button type="button" onClick={() => apply(null)} className="mt-2 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10">
          <X className="size-4 text-ink-3" />
          {t.unitNone}
        </button>
      )}
    </div>
  );
}
