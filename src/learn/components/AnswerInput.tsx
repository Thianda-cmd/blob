"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { learnText } from "@/i18n/messages/learn";
import { useText } from "@/i18n/useText";
import type { AnswerValue } from "@/learn/engine/answers";
import { parse, toDisplay } from "@/learn/engine/expr";
import type { AnswerSpec, Text } from "@/learn/types";
import { cn } from "@/lib/utils";
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
    }
  })();
  const currentKey = JSON.stringify(current);

  // Report the current answer upwards whenever it changes.
  useEffect(() => {
    changeRef.current(JSON.parse(currentKey) as AnswerValue | null);
  }, [currentKey]);
  const submitNow = () => onSubmit(current);

  const setPart = (i: number, v: string) => setParts((p) => p.map((x, j) => (j === i ? v : x)));
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
      const count = spec.allowNone ? 2 : Math.max(1, spec.values.length);
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
            const right = status !== "idle" && i === spec.correct;
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
  }
}
