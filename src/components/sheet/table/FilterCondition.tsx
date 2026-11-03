"use client";

// Filter by a condition: "größer als 0,5", "zwischen 01.11.2026 und 30.11.2026", "Top 10",
// "über dem Durchschnitt" for numbers and dates; "enthält", "beginnt mit"… for text. Numbers and
// dates are typed like in a cell (German: 0,5 and 01.11.2026).

import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { SheetTableText } from "@/i18n/messages/sheetTable";
import { formatValue, parseInput } from "@/sheet/engine";
import type { ColumnKind } from "@/sheet/table/model";
import type { FilterSpec, NumberFormat } from "@/sheet/types";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/utils";
import { fieldClass, Select } from "./parts";

type NumberSpec = Extract<FilterSpec, { kind: "number" }>;
type TextSpec = Extract<FilterSpec, { kind: "text" }>;
/** The choices of the menu: top and bottom are one choice ("Top 10 …") with largest/smallest. */
type NumberChoice = Exclude<NumberSpec["op"], "bottom">;

const NUMBER_CHOICES: NumberChoice[] = ["gt", "gte", "lt", "lte", "eq", "neq", "between", "top", "aboveAverage", "belowAverage"];
const DATE_CHOICES: NumberChoice[] = ["eq", "neq", "gt", "gte", "lt", "lte", "between", "top", "aboveAverage", "belowAverage"];
const TEXT_CHOICES: TextSpec["op"][] = ["contains", "notContains", "begins", "ends", "equals"];
const DATE_FMT: NumberFormat = { kind: "date", style: "short" };

/** A number or date typed like in a cell; null when it is neither. */
function readNumber(text: string, locale: Locale): number | null {
  const s = text.trim();
  if (!s) return null;
  const v = parseInput(s, locale).cell.v;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function FilterCondition({
  kind,
  current,
  average,
  locale,
  t,
  disabled,
  onApply,
  onCancel,
}: {
  kind: ColumnKind;
  current: FilterSpec | undefined;
  /** The column's average (shown with "über dem Durchschnitt"). */
  average: number | null;
  locale: Locale;
  t: SheetTableText;
  disabled?: boolean;
  onApply: (filter: FilterSpec) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const show = (n: number | null) => (n === null ? "" : formatValue(n, kind === "date" ? DATE_FMT : undefined, locale));
  const num = current?.kind === "number" && kind !== "text" ? current : null;
  const txt = current?.kind === "text" && kind === "text" ? current : null;

  const [op, setOp] = useState<NumberChoice>(num ? (num.op === "bottom" ? "top" : num.op) : kind === "date" ? "eq" : "gt");
  const [side, setSide] = useState<"top" | "bottom">(num?.op === "bottom" ? "bottom" : "top");
  const [a, setA] = useState(num && num.op !== "top" && num.op !== "bottom" ? show(num.a) : "");
  const [b, setB] = useState(num?.op === "between" ? show(num.b) : "");
  const [n, setN] = useState(num && (num.op === "top" || num.op === "bottom") && num.a !== null ? String(num.a) : "10");
  const [textOp, setTextOp] = useState<TextSpec["op"]>(txt?.op ?? "contains");
  const [text, setText] = useState(txt?.text ?? "");
  const [error, setError] = useState<string | null>(null);

  const ops = kind === "text" ? null : kind === "date" ? DATE_CHOICES : NUMBER_CHOICES;
  const opNames = kind === "date" ? t.dateOps : t.numberOps;
  const bad = kind === "date" ? t.notADate : t.notANumber;

  const apply = () => {
    if (disabled) return;
    if (kind === "text") return onApply({ kind: "text", op: textOp, text });
    if (op === "aboveAverage" || op === "belowAverage") return onApply({ kind: "number", op, a: null, b: null });
    if (op === "top") {
      const count = readNumber(n, locale);
      if (count === null || count < 1) return setError(t.notANumber);
      return onApply({ kind: "number", op: side, a: Math.floor(count), b: null });
    }
    const va = readNumber(a, locale);
    if (va === null) return setError(a.trim() ? bad : t.needValue);
    if (op === "between") {
      const vb = readNumber(b, locale);
      if (vb === null) return setError(b.trim() ? bad : t.needValue);
      return onApply({ kind: "number", op, a: va, b: vb });
    }
    onApply({ kind: "number", op, a: va, b: null });
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  };
  const input = (value: string, set: (v: string) => void, label: string, extra?: string) => (
    <input
      value={value}
      onChange={(e) => {
        set(e.target.value);
        setError(null);
      }}
      onKeyDown={onKey}
      aria-label={label}
      aria-invalid={!!error || undefined}
      placeholder={label}
      inputMode={kind === "text" ? "text" : "decimal"}
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      className={cn(fieldClass, kind !== "text" && "tabular-nums", extra)}
    />
  );

  return (
    <div className="space-y-2.5">
      {ops ? (
        <Select<NumberChoice>
          label={t.condition}
          value={op}
          disabled={disabled}
          onChange={(v) => {
            setOp(v);
            setError(null);
          }}
          options={ops.map((o) => ({ value: o, label: opNames[o] }))}
        />
      ) : (
        <Select<TextSpec["op"]> label={t.condition} value={textOp} disabled={disabled} onChange={setTextOp} options={TEXT_CHOICES.map((o) => ({ value: o, label: t.textOps[o] }))} />
      )}

      {kind === "text" ? (
        <>
          {input(text, setText, t.value)}
          <p className="text-[11.5px] leading-snug text-ink-3">{t.wildcards}</p>
        </>
      ) : op === "between" ? (
        <div className="flex items-center gap-2">
          {input(a, setA, t.from, "min-w-0 flex-1")}
          <span className="shrink-0 text-[12px] text-ink-3">{t.and}</span>
          {input(b, setB, t.to, "min-w-0 flex-1")}
        </div>
      ) : op === "top" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label={t.howMany}
            value={side}
            onChange={setSide}
            options={[
              { value: "top", label: kind === "date" ? t.latest : t.largest },
              { value: "bottom", label: kind === "date" ? t.earliest : t.smallest },
            ]}
          />
          <label htmlFor={`${id}-n`} className="sr-only">
            {t.howMany}
          </label>
          <input
            id={`${id}-n`}
            value={n}
            onChange={(e) => {
              setN(e.target.value);
              setError(null);
            }}
            onKeyDown={onKey}
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            className={cn(fieldClass, "w-16 tabular-nums")}
          />
          <span className="text-[12px] text-ink-3">{t.items}</span>
        </div>
      ) : op === "aboveAverage" || op === "belowAverage" ? (
        average !== null && <p className="text-[12px] leading-snug text-ink-2">{t.average(show(average))}</p>
      ) : (
        input(a, setA, t.value)
      )}

      {error && (
        <p className="text-[11.5px] leading-snug text-danger" role="alert">
          {error}
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
          disabled={disabled}
          className="inline-flex h-8 items-center rounded-lg bg-blob px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-blob-deep disabled:opacity-45 [@media(hover:none)]:h-10"
        >
          {t.apply}
        </button>
      </div>
    </div>
  );
}
