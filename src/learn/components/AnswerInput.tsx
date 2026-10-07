"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import type { AnswerValue } from "@/learn/engine/answers";
import { equationParts } from "@/learn/chemistry/check";
import { orderStart } from "@/learn/engine/arrange";
import { parseFormula } from "@/learn/chemistry/formula";
import { parse, toDisplay } from "@/learn/engine/expr";
import type { AnswerSpec, Text } from "@/learn/types";
import { cn } from "@/lib/utils";
import { MatchField, OrderField } from "./ArrangeInputs";
import { MathView } from "./MathView";
import { Inline } from "./Rich";

export type AnswerStatus = "idle" | "correct" | "wrong";

const fieldBase =
  "h-12 rounded-xl border-2 bg-raised px-3.5 text-[19px] outline-none transition-[border,box-shadow,background] [font-family:var(--font-math)] placeholder:text-ink-3/60 placeholder:[font-family:var(--font-sans)] placeholder:text-[15px] focus:border-blob focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--blob)_14%,transparent)] disabled:opacity-80";

function tone(status: AnswerStatus) {
  return status === "correct" ? "border-ok bg-ok/5" : status === "wrong" ? "border-danger bg-danger/5" : "border-line-2";
}

type KeyName = keyof (typeof learnText)["en"]["input"]["keys"];

const KEYS: { label: string; insert: string; name?: KeyName }[] = [
  { label: "x", insert: "x" },
  { label: "y", insert: "y" },
  { label: "x²", insert: "^2", name: "squared" },
  { label: "xⁿ", insert: "^", name: "power" },
  { label: "√", insert: "√(", name: "root" },
  { label: "(", insert: "(", name: "open" },
  { label: ")", insert: ")", name: "close" },
  { label: "·", insert: "·", name: "times" },
  { label: "÷", insert: "/", name: "divide" },
  { label: "−", insert: "-", name: "minus" },
];

const OPS = ["<", ">", "≤", "≥"] as const;

/** A text field for maths with a live, rendered preview and a small keypad. */
export function MathField({
  value,
  onChange,
  onEnter,
  status,
  placeholder,
  preview = true,
  keypad = true,
  autoFocus,
  disabled,
  className,
  inputClassName,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  status: AnswerStatus;
  placeholder?: string;
  preview?: boolean;
  keypad?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Shown in front of the field, e.g. "t =". */
  label?: Text;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const t = useMessages(learnText).input;
  const tt = useText();
  const labelText = tt(label);
  const parsed = value.trim() ? parse(value) : null;
  const shown = parsed?.ok ? toDisplay(parsed.ast) : null;

  function insert(text: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        {label && <MathView src={label} size="md" animate={false} className="shrink-0 text-ink-2" />}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
            }
          }}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder ?? t.placeholder}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(fieldBase, tone(status), "w-full", inputClassName)}
          aria-label={labelText ? t.answerFor(labelText) : t.answer}
        />
      </div>
      {(preview || keypad) && (
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          {keypad && !disabled && (
            <div className="flex flex-wrap gap-1">
              {KEYS.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  title={k.name ? t.keys[k.name] : k.label}
                  aria-label={k.name ? t.keys[k.name] : k.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(k.insert)}
                  className="h-8 min-w-8 rounded-lg border border-line bg-surface px-2 text-[15px] text-ink-2 transition-colors [font-family:var(--font-math)] hover:border-line-2 hover:bg-hover hover:text-ink active:scale-95"
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}
          {preview && (
            <AnimatePresence mode="wait">
              {shown && value.trim() && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="ml-auto flex items-center gap-2 text-[12px] text-ink-3"
                >
                  {t.readsAs}
                  <MathView src={shown} size="sm" animate={false} className="text-ink" />
                </motion.div>
              )}
              {parsed && !parsed.ok && (
                <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-auto text-[12px] text-ink-3">
                  {tt(parsed.error)}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}

/** Small numeric box used inside fractions, pairs and solution lists. */
function NumBox({
  value,
  onChange,
  onEnter,
  status,
  autoFocus,
  disabled,
  className,
  placeholder = "?",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  status: AnswerStatus;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  label?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter?.();
        }
      }}
      autoFocus={autoFocus}
      disabled={disabled}
      placeholder={placeholder}
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      className={cn(fieldBase, tone(status), "w-28 text-center", className)}
    />
  );
}

/**
 * The right input for each answer type. Calls `onChange` with an AnswerValue,
 * or null while the answer is still incomplete.
 */
export function AnswerInput({
  spec,
  onChange,
  onSubmit,
  status,
  disabled,
  autoFocus = true,
}: {
  spec: AnswerSpec;
  onChange: (value: AnswerValue | null) => void;
  onSubmit: (value: AnswerValue | null) => void;
  status: AnswerStatus;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [parts, setParts] = useState<string[]>(["", ""]);
  const [none, setNone] = useState(false);
  const [op, setOp] = useState<string>("");
  const [choice, setChoice] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [coefs, setCoefs] = useState<string[]>(() =>
    spec.kind === "balance" ? Array.from({ length: equationParts(spec.equation).left.length + equationParts(spec.equation).right.length }, () => "") : [],
  );
  const [order, setOrder] = useState<number[]>(() => (spec.kind === "order" ? orderStart(spec) : []));
  const [picks, setPicks] = useState<(number | null)[]>(() => (spec.kind === "match" ? spec.pairs.map(() => null) : []));
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  // The answer as it stands right now (also handed to onSubmit, so pressing Enter straight
  // after typing never checks the previous value).
  const current = ((): AnswerValue | null => {
    switch (spec.kind) {
      case "number":
      case "expr":
        return text.trim() ? { kind: "text", text } : null;
      case "fraction":
        return parts[0].trim() && parts[1].trim() ? { kind: "fraction", n: parts[0], d: parts[1] } : null;
      case "solutions":
        return none ? { kind: "list", values: [], none: true } : parts.some((p) => p.trim()) ? { kind: "list", values: parts } : null;
      case "pair":
        return parts[0].trim() && parts[1].trim() ? { kind: "list", values: parts } : null;
      case "inequality":
        return op && text.trim() ? { kind: "inequality", op, text } : null;
      case "choice":
        return choice === null ? null : { kind: "choice", index: choice };
      case "multi":
        return picked.length ? { kind: "multi", indices: [...picked].sort((a, b) => a - b) } : null;
      case "formula":
      case "word":
        return text.trim() ? { kind: "text", text } : null;
      case "balance":
        return coefs.some((c) => c.trim()) ? { kind: "list", values: coefs } : null;
      case "order":
        return { kind: "order", order };
      case "match":
        return picks.every((p) => p !== null) ? { kind: "match", picks } : null;
    }
  })();
  const currentKey = JSON.stringify(current);

  // Report the current answer upwards whenever it changes.
  useEffect(() => {
    changeRef.current(JSON.parse(currentKey) as AnswerValue | null);
  }, [currentKey]);
  const submitNow = () => onSubmit(current);

  // Any number of boxes (equations can have three or four solutions).
  const setPart = (i: number, v: string) =>
    setParts((p) => {
      const next = [...p];
      while (next.length <= i) next.push("");
      next[i] = v;
      return next;
    });
  const t = useMessages(learnText).input;
  const tt = useText();

  switch (spec.kind) {
    case "number":
      return (
        <div className="flex items-center gap-2">
          {spec.label && <MathView src={spec.label} size="md" animate={false} className="text-ink-2" />}
          <MathField value={text} onChange={setText} onEnter={submitNow} status={status} keypad={false} preview={false} autoFocus={autoFocus} disabled={disabled} placeholder={t.number} className="w-56" />
          {spec.unit && <span className="text-[17px] text-ink-2">{tt(spec.unit)}</span>}
        </div>
      );
    case "expr":
      return <MathField value={text} onChange={setText} onEnter={submitNow} status={status} autoFocus={autoFocus} disabled={disabled} label={spec.prefix} placeholder={t.example} />;
    case "fraction":
      return (
        <div className="inline-flex flex-col items-center gap-1.5">
          <NumBox value={parts[0]} onChange={(v) => setPart(0, v)} onEnter={submitNow} status={status} autoFocus={autoFocus} disabled={disabled} label={t.numerator} />
          <div className="h-[3px] w-32 rounded-full bg-ink" />
          <NumBox value={parts[1]} onChange={(v) => setPart(1, v)} onEnter={submitNow} status={status} disabled={disabled} label={t.denominator} />
        </div>
      );
    case "pair":
      return (
        <div className="flex flex-wrap items-center gap-4">
          {spec.names.map((name, i) => (
            <label key={i} className="flex items-center gap-2">
              <MathView src={`${tt(name)} =`} size="md" animate={false} />
              <NumBox value={parts[i]} onChange={(v) => setPart(i, v)} onEnter={submitNow} status={status} autoFocus={autoFocus && i === 0} disabled={disabled} label={tt(name)} />
            </label>
          ))}
        </div>
      );
    case "solutions": {
      // With "no solution" allowed, at least two boxes, so the box count doesn't give the answer away.
      const count = spec.allowNone ? Math.max(2, spec.values.length) : Math.max(1, spec.values.length);
      return (
        <div className="space-y-3">
          <div className={cn("flex flex-wrap items-center gap-4 transition-opacity", none && "pointer-events-none opacity-35")}>
            {Array.from({ length: count }, (_, i) => (
              <label key={i} className="flex items-center gap-2">
                <MathView src={count === 1 ? `${spec.variable} =` : `${spec.variable}_${i + 1} =`} size="md" animate={false} />
                <NumBox value={parts[i] ?? ""} onChange={(v) => setPart(i, v)} onEnter={submitNow} status={status} autoFocus={autoFocus && i === 0} disabled={disabled || none} label={t.solution(i + 1)} />
              </label>
            ))}
          </div>
          {spec.allowNone && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setNone((v) => !v)}
              className={cn(
                "h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors",
                none ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
              )}
            >
              {none ? "✓ " : ""}
              {t.noSolution}
            </button>
          )}
        </div>
      );
    }
    case "inequality":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <MathView src={spec.variable} size="lg" animate={false} />
          <div className="flex gap-1 rounded-xl bg-paper p-1">
            {OPS.map((o) => (
              <button
                key={o}
                type="button"
                disabled={disabled}
                onClick={() => setOp(o)}
                title={t.ops[o]}
                aria-label={t.ops[o]}
                className={cn(
                  "h-10 w-11 rounded-lg text-[22px] transition-all [font-family:var(--font-math)]",
                  op === o ? "bg-blob text-white shadow-card" : "text-ink-2 hover:bg-hover",
                )}
                aria-pressed={op === o}
              >
                {o}
              </button>
            ))}
          </div>
          <NumBox value={text} onChange={setText} onEnter={submitNow} status={status} autoFocus={autoFocus} disabled={disabled} label={t.boundary} />
        </div>
      );
    case "choice":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {spec.options.map((opt, i) => {
            const picked = choice === i;
            // After a wrong pick only the pick turns red; the right option shows once it's solved or revealed.
            const right = i === spec.correct && (status === "correct" || (status === "wrong" && disabled));
            const wrong = status === "wrong" && picked && i !== spec.correct;
            return (
              <motion.button
                key={i}
                type="button"
                disabled={disabled}
                whileTap={{ scale: 0.97 }}
                onClick={() => setChoice(i)}
                onDoubleClick={submitNow}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border-2 bg-raised px-4 py-3 text-left text-[15px] transition-colors",
                  picked ? "border-blob bg-blob-soft/60" : "border-line hover:border-line-2",
                  right && "border-ok bg-ok/10",
                  wrong && "border-danger bg-danger/10",
                )}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold", picked ? "border-blob bg-blob text-white" : "border-line-2 text-ink-3")}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>
                  <Inline text={opt} />
                </span>
              </motion.button>
            );
          })}
        </div>
      );
    case "multi":
      return (
        <div className="space-y-2">
          <div className="text-[12.5px] text-ink-3">{t.selectAll}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {spec.options.map((opt, i) => {
              const on = picked.includes(i);
              const should = spec.correct.includes(i);
              const right = status !== "idle" && on && should;
              const wrong = status === "wrong" && on && !should;
              return (
                <motion.button
                  key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={disabled}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl border-2 bg-raised px-4 py-3 text-left text-[15px] transition-colors",
                    on ? "border-blob bg-blob-soft/60" : "border-line hover:border-line-2",
                    right && "border-ok bg-ok/10",
                    wrong && "border-danger bg-danger/10",
                  )}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-blob bg-blob text-white" : "border-line-2")}>
                    {on && (
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                        <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span>
                    <Inline text={opt} />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      );
    case "order":
      return <OrderField spec={spec} order={order} onChange={setOrder} status={status} disabled={disabled} />;
    case "match":
      return <MatchField spec={spec} picks={picks} onChange={setPicks} status={status} disabled={disabled} />;
    case "formula":
      return <FormulaField value={text} onChange={setText} onEnter={submitNow} status={status} autoFocus={autoFocus} disabled={disabled} label={spec.label ? tt(spec.label) : undefined} />;
    case "word":
      return (
        <div className="flex flex-wrap items-center gap-2.5">
          {spec.label && <span className="text-[16px] text-ink-2">{tt(spec.label)}</span>}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNow();
              }
            }}
            autoFocus={autoFocus}
            disabled={disabled}
            placeholder={spec.placeholder ? tt(spec.placeholder) : t.word}
            autoComplete="off"
            spellCheck={false}
            aria-label={spec.label ? tt(spec.label) : t.answer}
            className={cn(fieldBase, tone(status), "w-full max-w-md [font-family:var(--font-sans)] text-[17px]")}
          />
        </div>
      );
    case "balance": {
      const { left, right } = equationParts(spec.equation);
      const box = (i: number) => (
        <input
          key={`b${i}`}
          value={coefs[i] ?? ""}
          onChange={(e) => setCoefs((c) => c.map((x, j) => (j === i ? e.target.value.replace(/[^0-9]/g, "") : x)))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNow();
            }
          }}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          placeholder="1"
          inputMode="numeric"
          aria-label={t.coefficient(i + 1)}
          className={cn(fieldBase, tone(status), "h-11 w-14 px-1 text-center text-[20px] tabular-nums placeholder:text-ink-3/40 placeholder:[font-family:var(--font-math)]")}
        />
      );
      const species = (list: string[], offset: number) =>
        list.map((sp, i) => (
          <span key={`${offset}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span className="px-1 text-[22px] text-ink-2">+</span>}
            {box(offset + i)}
            <MathView src={`\\ce{${sp}}`} size="md" animate={false} />
          </span>
        ));
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5 rounded-2xl border border-line bg-surface px-3 py-3">
            {species(left, 0)}
            <span className="px-2 text-[22px] text-ink-2">→</span>
            {species(right, left.length)}
          </div>
          <div className="text-[12.5px] text-ink-3">{t.balanceHint}</div>
        </div>
      );
    }
  }
}

/** A text field for chemical formulas: type H2SO4, see H₂SO₄. */
function FormulaField({
  value,
  onChange,
  onEnter,
  status,
  autoFocus,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  status: AnswerStatus;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const t = useMessages(learnText).input;
  const tt = useText();
  const parsed = value.trim() ? parseFormula(value) : null;
  const ref = useRef<HTMLInputElement>(null);
  const insert = (str: string) => {
    const el = ref.current;
    if (!el) return onChange(value + str);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + str + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + str.length, start + str.length);
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        {label && <span className="text-[16px] text-ink-2">{label}</span>}
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={t.formula}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          aria-label={label ?? t.answer}
          className={cn(fieldBase, tone(status), "w-full max-w-sm")}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {["(", ")", "^", "+", "-", "·"].map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => insert(k)}
              className="grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-raised px-2 font-math text-[16px] text-ink-2 hover:bg-hover hover:text-ink"
            >
              {k === "-" ? "−" : k}
            </button>
          ))}
        </div>
        <div className="flex min-h-8 items-center gap-2 text-[12.5px] text-ink-3">
          {parsed?.ok ? (
            <>
              {t.readsAs} <MathView src={`\\ce{${parsed.species.text}}`} size="md" animate={false} className="text-ink" />
            </>
          ) : parsed ? (
            <span className="text-danger/80">{tt(parsed.error)}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
