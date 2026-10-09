"use client";

import { FileDown, Languages, LayoutTemplate, Lightbulb } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SampleFan } from "@/components/cv/home/SampleFan";
import { CV_TEMPLATES } from "@/cv/catalog";
import { useLocale, useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

const POINTS = [
  { key: "designs", Icon: LayoutTemplate },
  { key: "language", Icon: Languages },
  { key: "tips", Icon: Lightbulb },
  { key: "pdf", Icon: FileDown },
] as const;
const IDS = CV_TEMPLATES.map((m) => m.id);

/** The CV builder on the landing page: the example CV fanned out, cycling through every design, and what it does. */
export function CvShowcase() {
  const t = useMessages(landingText).cv;
  const locale = useLocale();
  const tt = useText();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.4 });
  const [front, setFront] = useState(0);
  const [picked, setPicked] = useState(false);
  // Holds still while the pointer or the keyboard focus is on it, so nothing moves while you look or choose.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = picked || hovered || focused;

  // Shows the designs one after another while in view, until someone picks one.
  useEffect(() => {
    if (paused || reduce || !visible) return;
    const id = window.setInterval(() => setFront((i) => (i + 1) % IDS.length), 3200);
    return () => window.clearInterval(id);
  }, [paused, reduce, visible]);

  const n = IDS.length;
  const designs = [IDS[(front + n - 1) % n], IDS[front], IDS[(front + 1) % n]] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div
        ref={ref}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
        className="relative overflow-hidden rounded-3xl border border-line bg-paper p-5 shadow-card sm:p-8 lg:col-span-7"
      >
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_45%,#000_20%,transparent_75%)]" />
        <div className="relative" role="img" aria-label={t.label(n)}>
          <SampleFan lang={locale} designs={designs} maxPaper={210} className="mx-auto w-full max-w-[560px]" />
        </div>
        <div role="group" aria-label={t.pick} className="relative mt-6 flex flex-wrap justify-center gap-1.5">
          {CV_TEMPLATES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={i === front}
              onClick={() => {
                setFront(i);
                setPicked(true);
              }}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                i === front ? "border-ink bg-ink font-medium text-paper" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink",
              )}
            >
              <span className="size-2 rounded-full ring-1 ring-ink/25" style={{ background: m.accent }} />
              {tt(m.name)}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:flex lg:flex-col lg:justify-center">
        {POINTS.map(({ key, Icon }, i) => {
          const point = t.points[key];
          const title = typeof point.title === "function" ? point.title(n) : point.title;
          return (
            <motion.li
              key={key}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-raised text-blob-ink shadow-card">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{point.body}</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
