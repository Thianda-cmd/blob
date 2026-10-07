"use client";

// Widget: the mean as levelling out. Drag the bars (test scores); the dashed line is
// their mean. "Level out" moves the parts above the line into the gaps below it, so
// every bar ends up at the mean. Changing one value by d moves the mean by d : n.

import { motion } from "motion/react";
import { Minus, Plus, Scale } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { clean, mn, nf } from "./kit";
import { BlobLine, HowTo, soft } from "./ui";

const MAX = 20;
const W = 360;
const H = 220;
const L = 30;
const R = 64;
const T = 14;
const B = 28;
const PH = H - T - B;
const yOf = (v: number) => T + PH - (v / MAX) * PH;

/** "13", "13,2" or "≈ 12,67" */
function meanText(sum: number, n: number, l: Locale) {
  const m = sum / n;
  const exact = Math.abs(m * 100 - Math.round(m * 100)) < 1e-9;
  return { exact, text: nf(m, l, 2), value: m };
}

export function MeanLevel() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [values, setValues] = useState<number[]>([12, 18, 9, 15, 11]);
  const [level, setLevel] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [said, setSaid] = useState<{ text: Text; mood: "happy" | "thinking" | "excited" }>({
    text: tx("Drag a bar up or down and watch the dashed line.", "Zieh einen Balken hoch oder runter und schau auf die gestrichelte Linie."),
    mood: "happy",
  });
  const [base, setBase] = useState<{ i: number; from: number; n: number } | null>(null);

  const n = values.length;
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = meanText(sum, n, l);
  const slot = (W - L - R) / n;
  const bw = Math.min(44, slot * 0.62);
  const xOf = (i: number) => L + slot * i + slot / 2;

  function valueAt(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return Math.max(0, Math.min(MAX, Math.round(((T + PH - p.y) / PH) * MAX)));
  }

  function changeTo(i: number, v: number, from: { i: number; from: number; n: number } | null) {
    if (values[i] === v) return;
    const next = values.map((x, k) => (k === i ? v : x));
    setValues(next);
    const start = from && from.i === i ? from : { i, from: values[i], n };
    if (!from || from.i !== i) setBase(start);
    const d = v - start.from;
    if (d === 0) {
      setSaid({ text: tx("Back where it started: same sum, same mean.", "Wieder wie am Anfang: gleiche Summe, gleicher Mittelwert."), mood: "happy" });
      return;
    }
    const dm = clean(d / n, 2);
    const dText = (lang: Locale) => nf(Math.abs(d), lang, 0);
    const mText = (lang: Locale) => nf(Math.abs(dm), lang, 2);
    const exact = Math.abs((d / n) * 100 - Math.round((d / n) * 100)) < 1e-9;
    setSaid({
      text: tx(
        `Test ${i + 1} is ${d > 0 ? "up" : "down"} by ${dText("en")}: the sum ${d > 0 ? "grows" : "shrinks"} by ${dText("en")}, the mean only by ${dText("en")} : ${n} ${exact ? "=" : "≈"} ${mText("en")}.`,
        `Test ${i + 1} ist um ${dText("de")} ${d > 0 ? "gestiegen" : "gesunken"}: Die Summe ändert sich um ${dText("de")}, der Mittelwert nur um ${dText("de")} : ${n} ${exact ? "=" : "≈"} ${mText("de")}.`,
      ),
      mood: "thinking",
    });
  }

  function key(i: number, e: React.KeyboardEvent) {
    if (level) return;
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    changeTo(i, Math.max(0, Math.min(MAX, values[i] + d)), base);
  }

  function resize(delta: 1 | -1) {
    setLevel(false);
    setBase(null);
    if (delta > 0) {
      const v = 10;
      setValues((vs) => [...vs, v]);
      setSaid({
        text: tx(`A new value: the sum gets ${v} more, and now you divide by ${n + 1}.`, `Ein neuer Wert: Die Summe wird um ${v} größer, und jetzt teilst du durch ${n + 1}.`),
        mood: "happy",
      });
    } else {
      setValues((vs) => vs.slice(0, -1));
      setSaid({ text: tx(`One value fewer: now you divide by ${n - 1}.`, `Ein Wert weniger: Jetzt teilst du durch ${n - 1}.`), mood: "happy" });
    }
  }

  function toggleLevel() {
    const on = !level;
    setLevel(on);
    setBase(null);
    setSaid(
      on
        ? {
            text: tx(
              `Levelled out: if every test had the same score, each would have ${mean.text} points. That's exactly the mean.`,
              `Ausgeglichen: Hätte jeder Test gleich viele Punkte, wären es überall ${mean.text}. Genau das ist der Mittelwert.`,
            ),
            mood: "excited",
          }
        : { text: tx("Back to the real scores.", "Zurück zu den echten Punkten."), mood: "happy" },
    );
  }

  const shown = level ? values.map(() => mean.value) : values;
  const pill = t(tx(`mean ${mean.text}`, `Ø ${mean.text}`));
  const formula = `\\frac{${values.map((v, i) => `${v}#v${i}`).join(" + ")}}{${n}#n} =#e1 \\frac{${sum}#s}{${n}#n2} ${mean.exact ? "=" : "\\approx"}#e2 ${mn(mean.value, l, "r", 2)}`;

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "Points in the vocabulary tests (at most 20). Drag the bars, or select one and use the arrow keys. The dashed line is the mean.",
          "Punkte in den Vokabeltests (höchstens 20). Zieh an den Balken oder wähl einen aus und nimm die Pfeiltasten. Die gestrichelte Linie ist der Mittelwert.",
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={toggleLevel}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
            level ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          <Scale className="size-3.5" /> {level ? t(tx("Show the real values", "Echte Werte zeigen")) : t(tx("Level out", "Ausgleichen"))}
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[13px] text-ink-2">{t(tx("Values", "Werte"))}</span>
          <button
            onClick={() => resize(-1)}
            disabled={n <= 3}
            aria-label={t(tx("Remove a value", "Einen Wert entfernen"))}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-5 text-center font-math text-[18px] tabular-nums">{n}</span>
          <button
            onClick={() => resize(1)}
            disabled={n >= 7}
            aria-label={t(tx("Add a value", "Einen Wert hinzufügen"))}
            className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[560px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={t(tx(`Bar chart, mean ${mean.text}`, `Säulendiagramm, Mittelwert ${mean.text}`))}
          onPointerMove={(e) => {
            if (drag !== null && !level) changeTo(drag, valueAt(e), base);
          }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          {[0, 5, 10, 15, 20].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.4 : 0.8} />
              <text x={L - 7} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {v}
              </text>
            </g>
          ))}
          {values.map((v, i) => (
            <g
              key={i}
              tabIndex={0}
              role="slider"
              aria-label={`Test ${i + 1}`}
              aria-valuenow={v}
              aria-valuemin={0}
              aria-valuemax={MAX}
              onKeyDown={(e) => key(i, e)}
              onPointerDown={(e) => {
                if (level) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDrag(i);
                changeTo(i, valueAt(e), base);
              }}
              style={{ cursor: level ? "default" : drag === i ? "grabbing" : "ns-resize", outline: "none" }}
              className="group"
            >
              <rect x={xOf(i) - slot / 2} y={T} width={slot} height={PH} fill="transparent" />
              {level && <rect x={xOf(i) - bw / 2} y={yOf(v)} width={bw} height={T + PH - yOf(v)} rx={5} fill="none" stroke="var(--ink-3)" strokeDasharray="3 3" />}
              <motion.rect
                initial={false}
                animate={{ y: yOf(shown[i]), height: Math.max(0.01, T + PH - yOf(shown[i])) }}
                transition={soft}
                x={xOf(i) - bw / 2}
                width={bw}
                rx={5}
                fill={level ? "color-mix(in oklab, var(--blob) 55%, transparent)" : "var(--blob)"}
                className="group-focus-visible:stroke-[var(--ink)] group-focus-visible:[stroke-width:2]"
              />
              <motion.text
                initial={false}
                animate={{ y: yOf(shown[i]) - 6 }}
                transition={soft}
                x={xOf(i)}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="var(--ink)"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {level ? mean.text : v}
              </motion.text>
              <text x={xOf(i)} y={H - 9} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {`Test ${i + 1}`}
              </text>
            </g>
          ))}
          <motion.line
            initial={false}
            animate={{ y1: yOf(mean.value), y2: yOf(mean.value) }}
            transition={soft}
            x1={L}
            x2={W - R}
            stroke="var(--ink)"
            strokeWidth={1.6}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
          <motion.g initial={false} animate={{ y: yOf(mean.value) }} transition={soft} pointerEvents="none">
            <rect x={W - R + 4} y={-9} width={Math.min(R - 4, 14 + 6 * pill.length)} height={18} rx={9} fill="var(--ink)" />
            <text x={W - R + 4 + Math.min(R - 4, 14 + 6 * pill.length) / 2} y={3.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--raised)" style={{ fontFamily: "var(--font-sans)" }}>
              {pill}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={formula} size="md" scope={`${id}-f`} />
        <p className="mt-1 text-[12.5px] text-ink-3">{t(tx("mean = sum of all values : number of values", "Mittelwert = Summe aller Werte : Anzahl der Werte"))}</p>
      </div>
      <BlobLine text={said.text} mood={said.mood} />
    </div>
  );
}
