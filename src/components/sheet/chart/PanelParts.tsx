"use client";

// Small controls of the chart panel: foldable sections, switches, fields that save when you
// leave them (one undo step per change, not per key), range fields with "use the selection",
// option chips, colour swatches and the series picker.

import { ChevronDown, SquareDashedMousePointer } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui/Input";
import type { Locale } from "@/i18n/config";
import type { SheetChartText } from "@/i18n/messages/sheetChart";
import { cn } from "@/lib/utils";
import { formatSignificant, parseChartNumber } from "@/sheet/chart/format";
import { sheetColor, SHEET_COLORS } from "@/sheet/colors";
import type { RangeRef, SheetColor, Workbook } from "@/sheet/types";
import { parseRef, refText } from "./ranges";

/** A foldable part of the panel. */
export function Section({ id, title, icon, open, onToggle, children }: { id: string; title: string; icon: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  const bodyId = `${id}-body`;
  return (
    <section className="border-b border-line" data-chart-section={id}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex h-11 w-full items-center gap-2.5 px-4 text-left text-[13px] font-medium text-ink transition-colors hover:bg-hover/50 [@media(hover:none)]:h-12"
        >
          <span className="text-ink-3 [&_svg]:size-4">{icon}</span>
          <span className="flex-1">{title}</span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </h3>
      {open && (
        <div id={bodyId} className="space-y-3.5 px-4 pb-4 pt-0.5">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Small text of the panel that says more (hints, why something can't be done, how a result is
 * worked out): readable on every background of the panel (4.5:1 and more) and not too small on a
 * phone, like the smart table's panel.
 */
export const HINT_TEXT = "text-[12px] leading-snug text-ink-2";
const ERROR_TEXT = "text-[12px] leading-snug text-danger";

/** A label above a control (or a group of them). */
export function Field({ label, htmlFor, hint, error, action, children }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-ink-2">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className={ERROR_TEXT} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={HINT_TEXT}>{hint}</p>
      ) : null}
    </div>
  );
}

/** An on/off switch with its label, the whole row tappable. */
export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-8 w-full items-center gap-3 rounded-lg text-left text-[13px] text-ink-2 disabled:opacity-50 [@media(hover:none)]:min-h-10"
    >
      <span className="flex-1 leading-snug">{label}</span>
      <span className={cn("relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200", checked ? "bg-blob" : "bg-line-2")}>
        <motion.span layout initial={false} transition={{ type: "spring", stiffness: 700, damping: 30 }} className={cn("block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]", checked && "ml-auto")} />
      </span>
    </button>
  );
}

// 16 px text on touch screens: an iPhone zooms into any field with smaller text when it gets the
// keyboard (the smart table's panel does the same).
export const fieldClass = cn(inputClass, "h-9 [@media(hover:none)]:h-10 [@media(hover:none)]:text-[16px]");

/** Text that is saved when you leave the field or press Enter (Escape goes back). */
export function TextField({ id, value, onCommit, placeholder, label, className, invalid, mono }: { id?: string; value: string; onCommit: (v: string) => void; placeholder?: string; label?: string; className?: string; invalid?: boolean; mono?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft ?? value}
      placeholder={placeholder}
      spellCheck={false}
      autoComplete="off"
      className={cn(fieldClass, mono && "font-mono text-[12.5px]", className)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape" && draft !== null) {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

/** A number in the user's format ("0,5"); empty means null when `allowEmpty` (an automatic value). */
export function NumberField({
  id,
  value,
  onCommit,
  locale,
  placeholder,
  label,
  allowEmpty,
  min,
  max,
  integer,
  className,
}: {
  id?: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  locale: Locale;
  placeholder?: string;
  label?: string;
  allowEmpty?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value === null || !Number.isFinite(value) ? "" : formatSignificant(value, locale, 10);
  const bad = draft !== null && draft.trim() !== "" && parseChartNumber(draft, locale) === null;
  const commit = (text: string) => {
    const empty = text.trim() === "";
    // Not a number, or emptied where a number is needed: the old value stays.
    if (empty ? !allowEmpty : parseChartNumber(text, locale) === null) return;
    let v = empty ? null : parseChartNumber(text, locale);
    if (v !== null) {
      if (integer) v = Math.round(v);
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
    }
    if (v !== value) onCommit(v);
  };
  return (
    <input
      id={id}
      aria-label={label}
      aria-invalid={bad || undefined}
      inputMode="decimal"
      value={draft ?? shown}
      placeholder={placeholder}
      autoComplete="off"
      className={cn(fieldClass, "tabular-nums", className)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape" && draft !== null) {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

/** A range like B2:B8 (or 'Blatt 2'!B2:B8) to type, with a button that takes the grid's selection. */
export function RangeField({
  label,
  value,
  wb,
  hostSheetId,
  onCommit,
  onUseSelection,
  allowEmpty,
  single,
  placeholder,
  hint,
  hideLabel,
  t,
}: {
  label: string;
  value: RangeRef | null;
  wb: Workbook;
  hostSheetId: string;
  onCommit: (ref: RangeRef | null) => void;
  onUseSelection?: () => void;
  allowEmpty?: boolean;
  /** One cell only (a series name). */
  single?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  /** The label only for screen readers (a field right under its own heading). */
  hideLabel?: boolean;
  t: SheetChartText;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = refText(value, wb, hostSheetId);
  const commit = (s: string) => {
    const parsed = parseRef(s, wb, hostSheetId);
    if (parsed === null) {
      if (allowEmpty) {
        setError(null);
        if (value !== null) onCommit(null);
      } else setError(t.rangeInvalid);
      return;
    }
    if ("error" in parsed) {
      setError(parsed.error === "sheet" ? t.rangeUnknownSheet(parsed.name) : t.rangeInvalid);
      return;
    }
    const r = parsed.ref;
    if (single && (r.r0 !== r.r1 || r.c0 !== r.c1)) {
      setError(t.rangeOneCell);
      return;
    }
    setError(null);
    if (!value || r.sheetId !== value.sheetId || r.r0 !== value.r0 || r.r1 !== value.r1 || r.c0 !== value.c0 || r.c1 !== value.c1) onCommit(r);
  };
  const field = (
    <div className="flex gap-1.5">
      <input
        id={id}
        aria-label={hideLabel ? label : undefined}
        value={draft ?? text}
        placeholder={placeholder ?? t.rangePlaceholder}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        aria-invalid={!!error || undefined}
        className={cn(fieldClass, "min-w-0 flex-1 font-mono text-[12.5px] uppercase placeholder:normal-case")}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onBlur={() => {
          if (draft !== null && draft !== text) commit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape" && draft !== null) {
            e.stopPropagation();
            setDraft(null);
            setError(null);
          }
        }}
      />
      {onUseSelection && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft(null);
            onUseSelection();
          }}
          title={t.useSelection}
          aria-label={`${t.useSelection}: ${label}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink [@media(hover:none)]:h-10 [&_svg]:size-4"
        >
          <SquareDashedMousePointer />
          <span className="max-[380px]:hidden">{t.useSelectionShort}</span>
        </button>
      )}
    </div>
  );
  if (!hideLabel) {
    return (
      <Field label={label} htmlFor={id} hint={hint} error={error}>
        {field}
      </Field>
    );
  }
  return (
    <div className="space-y-1.5">
      {field}
      {error ? (
        <p className={ERROR_TEXT} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={HINT_TEXT}>{hint}</p>
      ) : null}
    </div>
  );
}

/** A row (or grid) of options, one chosen; icons above or before the label. */
export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode; title?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  columns?: number;
  size?: "md" | "tile";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn(columns ? "grid gap-1.5" : "flex flex-wrap gap-1.5")} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border text-[12.5px] transition-[background,border,color] disabled:opacity-40",
              size === "tile" ? "min-h-[58px] flex-col gap-1 px-1 py-2 text-[12px] leading-tight" : "h-8 gap-1.5 px-2.5 [@media(hover:none)]:h-9",
              on ? "border-blob bg-blob-soft font-medium text-blob-ink" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
              "[&_svg]:shrink-0",
            )}
          >
            {o.icon}
            <span className={cn(size === "tile" && "text-center")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Colour choice: automatic (the palette in turn) or one of the sheet colours. */
export function Swatches({ label, value, onChange, autoColor, t }: { label: string; value: SheetColor | null; onChange: (c: SheetColor | null) => void; autoColor: SheetColor; t: SheetChartText }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        title={t.autoColor}
        aria-label={t.autoColor}
        onClick={() => onChange(null)}
        className={cn("grid size-8 place-items-center rounded-full border-2 transition-transform active:scale-95 [@media(hover:none)]:size-9", value === null ? "border-blob" : "border-transparent")}
      >
        <span className="relative block size-6 overflow-hidden rounded-full ring-1 ring-line" style={{ background: sheetColor(autoColor) }}>
          <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-white">A</span>
        </span>
      </button>
      {SHEET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          title={t.colors[c]}
          aria-label={t.colors[c]}
          onClick={() => onChange(c)}
          className={cn("grid size-8 place-items-center rounded-full border-2 transition-transform active:scale-95 [@media(hover:none)]:size-9", value === c ? "border-blob" : "border-transparent")}
        >
          <span className="block size-6 rounded-full" style={{ background: sheetColor(c) }} />
        </button>
      ))}
    </div>
  );
}

/** Which series a section is about (shown when there are several). */
export function SeriesPicker({ label, series, value, onChange }: { label: string; series: { id: string; name: string; color: SheetColor }[]; value: string; onChange: (id: string) => void }) {
  if (series.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {series.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s.id)}
            className={cn(
              "inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors [@media(hover:none)]:h-9",
              on ? "border-blob bg-blob-soft font-medium text-blob-ink" : "border-line bg-raised text-ink-2 hover:border-line-2",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: sheetColor(s.color) }} />
            <span className="truncate">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A short note in the panel (hints, why a trendline can't be drawn). */
export function Note({ tone = "plain", icon, children }: { tone?: "plain" | "warn"; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2 rounded-lg px-3 py-2 text-[12px] leading-snug", tone === "warn" ? "bg-danger/8 text-danger-ink" : "bg-hover/70 text-ink-2")}>
      {icon && <span className="mt-px shrink-0 [&_svg]:size-3.5">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
