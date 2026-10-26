"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { useMessages } from "@/i18n/client";
import { quizText } from "@/i18n/messages/quiz";
import type { PlayerAnswer } from "@/quiz/score";
import type { ShownQuestion } from "@/quiz/views";
import { cn } from "@/lib/utils";
import { Shape, styleAt } from "../Shape";
import { quizSound } from "../sound";

/** How a phone answers a question: big coloured buttons, a text field, a puzzle or a slider. */
export function AnswerPad({ question, onAnswer }: { question: ShownQuestion; onAnswer: (a: PlayerAnswer) => void }) {
  if (question.type === "type") return <TypePad onAnswer={onAnswer} />;
  if (question.type === "puzzle") return <PuzzlePad question={question} onAnswer={onAnswer} />;
  if (question.type === "slider" && question.slider) return <SliderPad slider={question.slider} onAnswer={onAnswer} />;
  return <ChoicePad question={question} onAnswer={onAnswer} />;
}

const buzz = (ms = 18) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

function ChoicePad({ question, onAnswer }: { question: ShownQuestion; onAnswer: (a: PlayerAnswer) => void }) {
  const t = useMessages(quizText).play;
  const [picked, setPicked] = useState<string[]>([]);
  const n = question.choices.length;
  const withText = question.choices.some((c) => c.text);
  const two = n === 2;
  const tap = (id: string) => {
    quizSound().tap();
    buzz();
    if (!question.multi) return onAnswer({ kind: "choice", ids: [id] });
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className={cn("grid min-h-0 flex-1 gap-3", two ? "grid-rows-2" : n <= 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-3")}>
        {question.choices.map((c, i) => {
          const style = styleAt(c.style);
          const on = picked.includes(c.id);
          return (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: on ? 0.96 : 1, y: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 22, delay: i * 0.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => tap(c.id)}
              className={cn("quiz-press relative flex min-h-[72px] items-center gap-3 overflow-hidden rounded-[22px] px-4 text-left text-white", !withText && "justify-center", on && "ring-4 ring-white/90 ring-offset-2 ring-offset-transparent")}
              style={{ background: style.color, ["--quiz-deep" as string]: style.deep }}
              aria-pressed={question.multi ? on : undefined}
              aria-label={c.text ?? style.shape}
            >
              <Shape shape={style.shape} className={withText ? "size-8" : "size-16"} />
              {c.text && <span className={cn("min-w-0 flex-1 font-bold leading-tight hyphens-auto [overflow-wrap:break-word]", c.text.length > 36 ? "text-[14.5px]" : c.text.length > 18 ? "text-[16px]" : "text-[18px]")}>{c.text}</span>}
              {question.multi && (
                <span className={cn("absolute right-3 top-3 grid size-7 place-items-center rounded-full border-2 border-white/90 transition-colors", on ? "bg-white text-ink" : "bg-transparent")}>
                  {on && <Check className="size-4" strokeWidth={3} style={{ color: style.deep }} />}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {question.multi && (
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => {
            buzz(30);
            onAnswer({ kind: "choice", ids: picked });
          }}
          className="quiz-press flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink text-[17px] font-bold text-paper disabled:opacity-40"
        >
          <Send className="size-5" /> {t.submit} {picked.length > 0 && <span className="opacity-70">· {t.selected(picked.length)}</span>}
        </button>
      )}
    </div>
  );
}

function TypePad({ onAnswer }: { onAnswer: (a: PlayerAnswer) => void }) {
  const t = useMessages(quizText).play;
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    buzz(30);
    onAnswer({ kind: "text", text: text.trim() });
  };
  return (
    <form
      className="flex flex-1 flex-col justify-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 40))}
        placeholder={t.typeHere}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        className="h-16 w-full rounded-2xl border-2 border-line bg-raised px-5 text-center text-[22px] font-bold text-ink outline-none transition-colors focus:border-blob"
        aria-label={t.typeHere}
      />
      <button type="submit" disabled={!text.trim()} className="quiz-press flex h-14 items-center justify-center gap-2 rounded-2xl bg-blob text-[17px] font-bold text-white disabled:opacity-40" style={{ ["--quiz-deep" as string]: "var(--blob-deep)" }}>
        <Send className="size-5" /> {t.submit}
      </button>
    </form>
  );
}

function PuzzlePad({ question, onAnswer }: { question: ShownQuestion; onAnswer: (a: PlayerAnswer) => void }) {
  const t = useMessages(quizText).play;
  const [order, setOrder] = useState<string[]>([]);
  const left = question.choices.filter((c) => !order.includes(c.id));
  const byId = new Map(question.choices.map((c) => [c.id, c]));
  const add = (id: string) => {
    quizSound().tap();
    buzz();
    const next = [...order, id];
    // The last one goes in by itself.
    const rest = question.choices.filter((c) => !next.includes(c.id));
    setOrder(rest.length === 1 ? [...next, rest[0].id] : next);
  };
  const done = order.length === question.choices.length;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-center text-[13px] font-medium text-ink-2">{t.tapOrder}</p>
      <ol className="flex flex-col gap-2">
        {question.choices.map((_, i) => {
          const id = order[i];
          const c = id ? byId.get(id) : null;
          return (
            <li key={i} className={cn("flex min-h-12 items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors", c ? "border-transparent bg-raised shadow-card" : "border-dashed border-line-2")}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blob-soft text-[13px] font-bold text-blob-ink">{i + 1}</span>
              <AnimatePresence mode="popLayout">
                {c && (
                  <motion.span key={c.id} layoutId={`pz-${c.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-ink">
                    <Shape shape={styleAt(c.style).shape} fill={styleAt(c.style).color} className="size-4" />
                    <span className="hyphens-auto [overflow-wrap:break-word]">{c.text}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        {left.map((c) => {
          const style = styleAt(c.style);
          return (
            <motion.button key={c.id} layoutId={`pz-${c.id}`} type="button" onClick={() => add(c.id)} className="quiz-press flex min-h-14 items-center gap-2 rounded-2xl px-3 py-2 text-left text-[15px] font-bold text-white" style={{ background: style.color, ["--quiz-deep" as string]: style.deep }}>
              <Shape shape={style.shape} className="size-5" />
              <span className="min-w-0 hyphens-auto [overflow-wrap:break-word]">{c.text}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-auto flex gap-2">
        <button type="button" onClick={() => setOrder([])} disabled={!order.length} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-raised px-4 text-[15px] font-semibold text-ink-2 disabled:opacity-40">
          <RotateCcw className="size-4" /> {t.reset}
        </button>
        <button type="button" disabled={!done} onClick={() => onAnswer({ kind: "order", ids: order })} className="quiz-press flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-blob text-[17px] font-bold text-white disabled:opacity-40" style={{ ["--quiz-deep" as string]: "var(--blob-deep)" }}>
          <Send className="size-5" /> {t.submit}
        </button>
      </div>
    </div>
  );
}

/** A number for people: decimals only when the step has them. */
export function formatValue(v: number, step: number, unit = "") {
  const decimals = Math.min(4, Math.max(0, (String(step).split(".")[1] ?? "").length));
  return `${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ""}`;
}

function SliderPad({ slider, onAnswer }: { slider: NonNullable<ShownQuestion["slider"]>; onAnswer: (a: PlayerAnswer) => void }) {
  const t = useMessages(quizText).play;
  const snap = (v: number) => Math.min(slider.max, Math.max(slider.min, Math.round((v - slider.min) / slider.step) * slider.step + slider.min));
  const [value, setValue] = useState(() => snap((slider.min + slider.max) / 2));
  const share = (value - slider.min) / (slider.max - slider.min || 1);
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <motion.div key={value} initial={{ scale: 1.12 }} animate={{ scale: 1 }} className="text-center font-display text-[52px] font-bold tabular-nums leading-none text-ink">
        {formatValue(value, slider.step, slider.unit)}
      </motion.div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setValue((v) => snap(v - slider.step))} className="grid size-12 shrink-0 place-items-center rounded-full bg-raised text-ink shadow-card" aria-label="−">
          <Minus className="size-5" />
        </button>
        <input
          type="range"
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(e) => setValue(snap(Number(e.target.value)))}
          className="quiz-range h-12 min-w-0 flex-1"
          style={{ ["--fill" as string]: `${share * 100}%` }}
        />
        <button type="button" onClick={() => setValue((v) => snap(v + slider.step))} className="grid size-12 shrink-0 place-items-center rounded-full bg-raised text-ink shadow-card" aria-label="+">
          <Plus className="size-5" />
        </button>
      </div>
      <div className="flex justify-between px-1 text-[12px] font-medium tabular-nums text-ink-3">
        <span>{formatValue(slider.min, slider.step, slider.unit)}</span>
        <span>{formatValue(slider.max, slider.step, slider.unit)}</span>
      </div>
      <button type="button" onClick={() => onAnswer({ kind: "value", value })} className="quiz-press flex h-14 items-center justify-center gap-2 rounded-2xl bg-blob text-[17px] font-bold text-white" style={{ ["--quiz-deep" as string]: "var(--blob-deep)" }}>
        <Send className="size-5" /> {t.submit}
      </button>
    </div>
  );
}
