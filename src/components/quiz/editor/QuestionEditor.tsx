"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, GripVertical, ImagePlus, Lightbulb, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { inputClass } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import type { QuizText } from "@/i18n/messages/quiz";
import { cn } from "@/lib/utils";
import { LIMITS, issuesOf, newId, type Choice, type Margin, type Question } from "@/quiz/model";
import { Shape, styleAt } from "../Shape";
import { IMAGE_TYPES, uploadQuizImage } from "./image";
import { SortableList } from "./Sortable";

type T = QuizText;

/** One question being made: its text, a picture and its answers, in the colours they'll be played in. */
export function QuestionEditor({ question: q, index, onChange, userId, t }: { question: Question; index: number; onChange: (q: Question) => void; userId: string; t: T }) {
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const issues = issuesOf(q);
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
      <QuestionText key={q.id} value={q.text} index={index} onChange={(text) => set({ text })} t={t} />
      <ImageBlock image={q.image} onChange={(image) => set({ image })} userId={userId} t={t} />
      {(q.type === "quiz" || q.type === "poll" || q.type === "truefalse") && <ChoicesEditor q={q} onChange={onChange} t={t} />}
      {q.type === "type" && <AcceptedEditor q={q} onChange={onChange} t={t} />}
      {q.type === "puzzle" && <PuzzleEditor q={q} onChange={onChange} t={t} />}
      {q.type === "slider" && q.slider && <SliderEditor q={q} onChange={onChange} t={t} />}
      <AnimatePresence>
        {issues.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap justify-center gap-2">
            {issues.map((i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-[#fff4e0] px-3 py-1 text-[12.5px] font-medium text-[#9a5b00] dark:bg-[#3a2a10] dark:text-[#f0b860]">
                <TriangleAlert className="size-3.5" /> {t.editor.issues[i]}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionText({ value, index, onChange, t }: { value: string; index: number; onChange: (v: string) => void; t: T }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <div className="relative rounded-3xl bg-raised px-5 pb-4 pt-5 shadow-card">
      <span className="absolute -top-3 left-5 rounded-full bg-blob px-2.5 py-0.5 text-[12px] font-bold text-white shadow-card">{index + 1}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, LIMITS.text))}
        rows={1}
        placeholder={t.editor.questionPlaceholder}
        className="w-full resize-none bg-transparent text-center font-display text-[clamp(20px,2.4vw,30px)] font-bold leading-snug tracking-[-0.01em] text-ink outline-none placeholder:text-ink-3/70"
        aria-label={t.editor.questionPlaceholder}
      />
      <span className="absolute bottom-2 right-4 text-[11px] tabular-nums text-ink-3">{LIMITS.text - value.length}</span>
    </div>
  );
}

function ImageBlock({ image, onChange, userId, t }: { image: string | null; onChange: (v: string | null) => void; userId: string; t: T }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined | null) => {
    if (!file || !IMAGE_TYPES.includes(file.type)) return;
    setBusy(true);
    const url = await uploadQuizImage(file, userId);
    setBusy(false);
    if (url) onChange(url);
    else blob.say(t.editor.uploadFailed, { mood: "worried" });
  };
  // Pasting a picture anywhere in the editor puts it here.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => IMAGE_TYPES.includes(f.type));
      if (!file) return;
      e.preventDefault();
      void upload(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void upload(e.dataTransfer.files[0]);
      }}
      className={cn("group relative mx-auto flex w-full max-w-[560px] items-center justify-center overflow-hidden rounded-3xl transition-colors", image ? "bg-surface" : "aspect-[16/7] border-2 border-dashed", over ? "border-blob bg-blob-soft/60" : "border-line-2")}
    >
      <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      {image ? (
        <>
          <img src={image} alt="" className="max-h-[300px] w-full object-contain" />
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-black/55 px-2.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur hover:bg-black/70">
              {t.editor.replaceImage}
            </button>
            <button type="button" onClick={() => onChange(null)} className="grid size-7 place-items-center rounded-lg bg-black/55 text-white backdrop-blur hover:bg-black/70" aria-label={t.editor.removeImage} title={t.editor.removeImage}>
              <X className="size-4" />
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-[13.5px] font-medium text-ink-3 hover:text-blob-ink">
          <ImagePlus className="size-7" />
          {busy ? t.editor.uploading : t.editor.addImage}
        </button>
      )}
      {busy && image && <div className="absolute inset-0 grid place-items-center bg-black/30 text-[13px] font-semibold text-white">{t.editor.uploading}</div>}
    </div>
  );
}

function ChoicesEditor({ q, onChange, t }: { q: Question; onChange: (q: Question) => void; t: T }) {
  const grade = q.type !== "poll";
  const fixed = q.type === "truefalse";
  const setChoice = (id: string, patch: Partial<Choice>) => onChange({ ...q, choices: q.choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const toggleRight = (id: string) => {
    if (fixed) return onChange({ ...q, choices: q.choices.map((c) => ({ ...c, correct: c.id === id })) });
    setChoice(id, { correct: !q.choices.find((c) => c.id === id)?.correct });
  };
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3", q.choices.length > 4 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <AnimatePresence initial={false}>
          {q.choices.map((c, i) => {
            const style = styleAt(i);
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
                className={cn("group relative flex min-h-[76px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-white transition-shadow", grade && c.correct && "ring-4 ring-ok/70 ring-offset-2 ring-offset-paper")}
                style={{ background: style.color, boxShadow: `0 5px 0 ${style.deep}` }}
              >
                <Shape shape={style.shape} className="size-7" />
                <input
                  value={c.text}
                  onChange={(e) => setChoice(c.id, { text: e.target.value.slice(0, LIMITS.choice) })}
                  placeholder={t.editor.choicePlaceholder(i + 1)}
                  className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-white outline-none placeholder:text-white/65"
                  aria-label={t.editor.choicePlaceholder(i + 1)}
                />
                {grade && (
                  <button
                    type="button"
                    onClick={() => toggleRight(c.id)}
                    className={cn("grid size-9 shrink-0 place-items-center rounded-full border-[3px] transition-all", c.correct ? "border-white bg-ok text-white" : "border-white/70 text-transparent hover:border-white hover:text-white/60")}
                    aria-pressed={c.correct}
                    aria-label={t.editor.markCorrect}
                    title={t.editor.markCorrect}
                  >
                    <Check className="size-5" strokeWidth={3.4} />
                  </button>
                )}
                {!fixed && q.choices.length > 2 && (
                  <button type="button" onClick={() => onChange({ ...q, choices: q.choices.filter((x) => x.id !== c.id) })} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-paper opacity-0 shadow-card transition-opacity focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-label={t.editor.removeChoice} title={t.editor.removeChoice}>
                    <X className="size-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {!fixed && q.choices.length < LIMITS.choices && (
        <button type="button" onClick={() => onChange({ ...q, choices: [...q.choices, { id: newId(), text: "", correct: false }] })} className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-3 hover:bg-hover hover:text-ink">
          <Plus className="size-4" /> {t.editor.addChoice}
        </button>
      )}
    </div>
  );
}

function AcceptedEditor({ q, onChange, t }: { q: Question; onChange: (q: Question) => void; t: T }) {
  const list = q.accepted.length ? q.accepted : [""];
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2 rounded-3xl bg-raised p-4 shadow-card">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Check className="size-4 text-ok" strokeWidth={3} /> {t.editor.acceptedLabel}
      </span>
      {list.map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={a}
            onChange={(e) => onChange({ ...q, accepted: list.map((x, j) => (j === i ? e.target.value.slice(0, LIMITS.acceptedLength) : x)) })}
            placeholder={t.editor.acceptedPlaceholder(i + 1)}
            className={cn(inputClass, "h-11 text-[16px] font-semibold")}
          />
          {list.length > 1 && (
            <button type="button" onClick={() => onChange({ ...q, accepted: list.filter((_, j) => j !== i) })} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.editor.removeChoice}>
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {list.length < LIMITS.accepted && (
        <button type="button" onClick={() => onChange({ ...q, accepted: [...list, ""] })} className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-ink-3 hover:bg-hover hover:text-ink">
          <Plus className="size-4" /> {t.editor.addChoice}
        </button>
      )}
      <p className="flex items-start gap-1.5 text-[12px] text-ink-3">
        <Lightbulb className="mt-px size-3.5 shrink-0" /> {t.editor.acceptedHint}
      </p>
    </div>
  );
}

function PuzzleEditor({ q, onChange, t }: { q: Question; onChange: (q: Question) => void; t: T }) {
  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-2">
      <p className="flex items-start justify-center gap-1.5 text-center text-[12.5px] text-ink-3">
        <Lightbulb className="mt-px size-3.5 shrink-0" /> {t.editor.puzzleHint}
      </p>
      <SortableList
        items={q.choices}
        onMove={(choices) => onChange({ ...q, choices })}
        className="flex flex-col gap-2"
        render={(c, i, handle) => {
          const style = styleAt(i);
          return (
            <div className={cn("group flex items-center gap-2 rounded-2xl px-2 py-2 text-white", handle.dragging && "shadow-pop")} style={{ background: style.color, boxShadow: handle.dragging ? undefined : `0 4px 0 ${style.deep}` }}>
              <button type="button" ref={handle.ref} {...handle.props} className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-white/80 hover:bg-white/15 active:cursor-grabbing" aria-label={t.editor.moveUp}>
                <GripVertical className="size-4" />
              </button>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/25 text-[13px] font-bold">{i + 1}</span>
              <input
                value={c.text}
                onChange={(e) => onChange({ ...q, choices: q.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value.slice(0, LIMITS.choice) } : x)) })}
                placeholder={t.editor.itemPlaceholder(i + 1)}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-white outline-none placeholder:text-white/65"
              />
              {q.choices.length > 3 && (
                <button type="button" onClick={() => onChange({ ...q, choices: q.choices.filter((x) => x.id !== c.id) })} className="grid size-8 shrink-0 place-items-center rounded-lg text-white/80 opacity-0 hover:bg-white/15 group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-label={t.editor.removeChoice}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          );
        }}
      />
      {q.choices.length < LIMITS.choices && (
        <button type="button" onClick={() => onChange({ ...q, choices: [...q.choices, { id: newId(), text: "", correct: true }] })} className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-3 hover:bg-hover hover:text-ink">
          <Plus className="size-4" /> {t.editor.addChoice}
        </button>
      )}
    </div>
  );
}

const MARGINS: Margin[] = ["none", "low", "medium", "high", "max"];

function SliderEditor({ q, onChange, t }: { q: Question; onChange: (q: Question) => void; t: T }) {
  const s = q.slider!;
  const set = (patch: Partial<typeof s>) => onChange({ ...q, slider: { ...s, ...patch } });
  const num = (label: string, value: number, key: "min" | "max" | "step" | "value") => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-medium text-ink-2">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step="any"
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) set({ [key]: key === "step" ? Math.max(1e-6, Math.abs(v)) : v });
        }}
        className={cn(inputClass, "h-10 text-[15px] font-semibold tabular-nums", key === "value" && "border-ok/60")}
      />
    </label>
  );
  const share = (s.value - s.min) / (s.max - s.min || 1);
  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-4 rounded-3xl bg-raised p-4 shadow-card">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {num(t.editor.slider.min, s.min, "min")}
        {num(t.editor.slider.max, s.max, "max")}
        {num(t.editor.slider.step, s.step, "step")}
        {num(t.editor.slider.value, s.value, "value")}
      </div>
      <div className="relative h-4 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-blob/30" style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
        <div className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ok text-white shadow-card" style={{ left: `${Math.max(0, Math.min(1, share)) * 100}%` }}>
          <Check className="size-4" strokeWidth={3} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-2">{t.editor.slider.margin}</span>
          <Segmented value={s.margin} onChange={(margin) => set({ margin })} label={t.editor.slider.margin} options={MARGINS.map((m) => ({ value: m, label: t.editor.margins[m] }))} size="sm" />
        </div>
        <label className="flex min-w-[120px] flex-1 flex-col gap-1">
          <span className="text-[12px] font-medium text-ink-2">{t.editor.slider.unit}</span>
          <input value={s.unit} onChange={(e) => set({ unit: e.target.value.slice(0, 12) })} placeholder="kg, %, °C…" className={cn(inputClass, "h-9 text-[14px]")} />
        </label>
      </div>
    </div>
  );
}
