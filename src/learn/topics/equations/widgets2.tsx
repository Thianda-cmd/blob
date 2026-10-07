"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Eye, RotateCcw } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { frac, show as qshow, value as qvalue } from "@/learn/engine/frac";
import { Graph } from "@/learn/visuals/Graph";
import { cn } from "@/lib/utils";
import { intervalText, lead, setBuilder } from "./build2";
import { Caption, fmtNum, Segmented, Slider, useNarrow } from "./ui";

// ---------------------------------------------------------------------------
// Both sides as lines: an equation ax + b = cx + d is solved where the two lines
// y = ax + b and y = cx + d cross. Parallel lines: no solution. The same line: every x.

/** "2x - 3", "x", "-x + 4", "5" */
function linTex(a: number, b: number) {
  const x = a === 0 ? "" : a === 1 ? "x" : a === -1 ? "-x" : `${a}x`;
  if (!x) return String(b);
  return b === 0 ? x : `${x} ${b > 0 ? "+" : "-"} ${Math.abs(b)}`;
}

const RIGHT_SIDES = [
  { c: 1, d: 2 },
  { c: 2, d: -1 },
  { c: -1, d: 3 },
];

export function BothSidesLab() {
  const t = useText();
  const locale = useLocale();
  const [a, setA] = useState(2);
  const [b, setB] = useState(-1);
  const [ri, setRi] = useState(0);
  const { c, d } = RIGHT_SIDES[ri];
  const kind = a !== c ? "one" : b !== d ? "none" : "all";
  const x0 = kind === "one" ? frac(d - b, a - c) : null;
  const xv = x0 ? qvalue(x0) : 0;
  const yv = a * xv + b;
  const inside = Math.abs(xv) <= 6 && Math.abs(yv) <= 6;

  const status: Record<typeof kind, { title: Text; text: Text; set: string }> = {
    one: {
      title: tx("Exactly one solution", "Genau eine Lösung"),
      text: inside
        ? tx("The lines cross once. At that x both sides have the same value.", "Die Geraden schneiden sich einmal. An dieser Stelle haben beide Seiten denselben Wert.")
        : tx("The lines cross once, outside the picture. At that x both sides have the same value.", "Die Geraden schneiden sich einmal, außerhalb des Bildes. An dieser Stelle haben beide Seiten denselben Wert."),
      set: `L = \\{ ${x0 ? lead(qshow(x0)) : ""} \\}`,
    },
    none: {
      title: tx("No solution", "Keine Lösung"),
      text: tx("Same slope, different start: the lines are parallel and never meet.", "Gleiche Steigung, anderer Startwert: Die Geraden sind parallel und treffen sich nie."),
      set: "L = \\{ \\}",
    },
    all: {
      title: tx("Every number is a solution", "Jede Zahl ist eine Lösung"),
      text: tx("Both sides are the same line. Whatever x is, the sides are equal.", "Beide Seiten sind dieselbe Gerade. Egal, was x ist: Die Seiten sind gleich."),
      set: "L = ℚ",
    },
  };
  const s = status[kind];
  // What is left after taking cx away on both sides: (a − c)x = d − b.
  const reduced = `${a - c} \\cdot x = ${d - b}`;

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "Each side of the equation is a line. Where they cross, both sides have the same value. Change the left side with the sliders.",
            "Jede Seite der Gleichung ist eine Gerade. Wo sie sich schneiden, haben beide Seiten denselben Wert. Verändere die linke Seite mit den Schiebereglern.",
          ),
        )}
      </p>

      <div className="grid place-items-center rounded-xl border border-line bg-surface px-3 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-1">
          <span className="rounded-md px-1.5 text-blob-ink">
            <MathView src={`${linTex(a, b)}`} size="lg" />
          </span>
          <MathView src="=" size="lg" animate={false} />
          <MathView src={linTex(c, d)} size="lg" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
        <div className="rounded-xl border border-line bg-surface p-2">
          <Graph
            xRange={[-6, 6]}
            yRange={[-6, 6]}
            height={300}
            functions={[
              { f: (x) => c * x + d, key: "right", color: "ink", label: tx("right side", "rechte Seite") },
              { f: (x) => a * x + b, key: "left", color: "blob", dashed: kind === "all", label: kind === "all" ? undefined : tx("left side", "linke Seite") },
            ]}
            points={kind === "one" && inside ? [{ x: xv, y: yv, key: "cross", color: "ok", label: `x = ${fmtNum(xv, locale)}` }] : []}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Caption>{t(tx("Left side", "Linke Seite"))}</Caption>
            <Slider name="a" value={a} min={-3} max={3} shown={fmtNum(a, locale)} onChange={setA} label={t(tx("Number in front of x", "Zahl vor dem x"))} />
            <Slider name="b" value={b} min={-5} max={5} shown={fmtNum(b, locale)} onChange={setB} label={t(tx("Number added", "Addierte Zahl"))} />
          </div>
          <div className="space-y-1.5">
            <Caption>{t(tx("Right side", "Rechte Seite"))}</Caption>
            <Segmented
              label={t(tx("Right side", "Rechte Seite"))}
              value={ri}
              onChange={setRi}
              options={RIGHT_SIDES.map((r, i) => ({ value: i, label: <MathView src={linTex(r.c, r.d)} size="sm" animate={false} /> }))}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${kind}${ri}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn("space-y-2 rounded-xl border px-4 py-3", kind === "one" ? "border-ok/40 bg-ok/5" : "border-blob/30 bg-blob-soft/50")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("text-[14px] font-semibold", kind === "one" ? "text-ok" : "text-blob-ink")}>{t(s.title)}</span>
                <MathView src={s.set} size="md" animate={false} />
              </div>
              <p className="text-[13.5px] text-ink-2">{t(s.text)}</p>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
                {t(tx("All x-terms to the left:", "Alle x-Terme nach links:"))}
                <MathView src={reduced} size="sm" animate={false} className="text-ink" />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build the solution set on a number line: boundary, open or filled dot, direction.
// Live notation as inequality, set and interval.

type SetRel = "<" | ">" | "≤" | "≥";
const SET_TASKS: { tex: string; rel: SetRel; at: number; steps: string[] }[] = [
  { tex: "2(x - 1) > 4", rel: ">", at: 3, steps: ["2(x - 1) > 4", "2x - 2 > 4 \\quad | \\, +2", "2x > 6 \\quad | \\, :2", "x > 3"] },
  { tex: "\\frac{x}{2} + 1 \\le 3", rel: "≤", at: 4, steps: ["\\frac{x}{2} + 1 \\le 3 \\quad | \\, -1", "\\frac{x}{2} \\le 2 \\quad | \\, \\cdot 2", "x \\le 4"] },
  { tex: "5 - x < 7", rel: ">", at: -2, steps: ["5 - x < 7 \\quad | \\, -5", "-x < 2 \\quad | \\, \\cdot (-1)", "x \\hl{>} -2"] },
  { tex: "3x + 2 \\ge x - 4", rel: "≥", at: -3, steps: ["3x + 2 \\ge x - 4 \\quad | \\, -x", "2x + 2 \\ge -4 \\quad | \\, -2", "2x \\ge -6 \\quad | \\, :2", "x \\ge -3"] },
];
const REL_TEX: Record<SetRel, string> = { "<": "<", ">": ">", "≤": "\\le", "≥": "\\ge" };
const NL = { from: -6, to: 6, y: 50 };
const lineGeometry = (narrow: boolean) => (narrow ? { w: 360, left: 22, right: 338, font: 17 } : { w: 640, left: 34, right: 606, font: 15 });

export function SolutionSetLab() {
  const t = useText();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [task, setTask] = useState(0);
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(true);
  const [closed, setClosed] = useState(false);
  const [verdict, setVerdict] = useState<null | "ok" | "wrong">(null);
  const [show, setShow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const g = lineGeometry(useNarrow());
  const nx = (v: number) => g.left + ((v - NL.from) / (NL.to - NL.from)) * (g.right - g.left);
  const rel: SetRel = right ? (closed ? "≥" : ">") : closed ? "≤" : "<";
  const goal = SET_TASKS[task];
  const issues = {
    at: at !== goal.at,
    dir: (rel === ">" || rel === "≥") !== (goal.rel === ">" || goal.rel === "≥"),
    dot: (rel === "≤" || rel === "≥") !== (goal.rel === "≤" || goal.rel === "≥"),
  };

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setVerdict(null);
    };
  }
  const moveTo = (raw: number) => change(setAt)(Math.max(NL.from, Math.min(NL.to, Math.round(raw))));
  function fromPointer(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    moveTo(NL.from + ((p.x - g.left) / (g.right - g.left)) * (NL.to - NL.from));
  }
  function pick(i: number) {
    setTask(i);
    setVerdict(null);
    setShow(false);
  }

  const ticks: number[] = [];
  for (let v = NL.from; v <= NL.to; v++) ticks.push(v);
  const wrongText: Text = issues.at
    ? tx("Not quite: the boundary isn't there yet. Solve the inequality first, then drag the dot.", "Noch nicht: Die Grenze liegt woanders. Löse zuerst die Ungleichung, dann zieh den Punkt.")
    : issues.dir
      ? tx("The boundary is right! But the shading points the wrong way: bigger or smaller numbers?", "Die Grenze stimmt! Aber die Markierung zeigt in die falsche Richtung: größere oder kleinere Zahlen?")
      : tx("Boundary and direction are right! Now the dot: is the boundary itself a solution?", "Grenze und Richtung stimmen! Jetzt der Punkt: Gehört die Grenze selbst zur Lösung?");

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "Pick an inequality and solve it. Then build its solution set: drag the boundary, choose the direction and an open or filled dot.",
            "Wähle eine Ungleichung und löse sie. Bau dann ihre Lösungsmenge: Zieh die Grenze, wähle die Richtung und einen offenen oder geschlossenen Punkt.",
          ),
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SET_TASKS.map((l, i) => (
          <button
            key={l.tex}
            type="button"
            onClick={() => pick(i)}
            className={cn("relative h-10 rounded-lg border px-3 transition-colors", task === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
          >
            {task === i && <motion.span layoutId={`${scope}-task`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <MathView src={l.tex} size="sm" animate={false} className="relative" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 py-3 sm:px-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${g.w} 84`}
          className={cn("block w-full touch-none select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
          role="slider"
          aria-label={t(tx("Boundary of the solution set", "Grenze der Lösungsmenge"))}
          aria-valuemin={NL.from}
          aria-valuemax={NL.to}
          aria-valuenow={at}
          tabIndex={0}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
              ev.preventDefault();
              moveTo(at + 1);
            } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
              ev.preventDefault();
              moveTo(at - 1);
            }
          }}
          onPointerDown={(ev) => {
            (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
            setDragging(true);
            fromPointer(ev);
          }}
          onPointerMove={(ev) => dragging && fromPointer(ev)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <line x1={g.left - 22} x2={g.right + 22} y1={NL.y} y2={NL.y} stroke="var(--ink-3)" strokeWidth={1.5} />
          <path d={`M ${g.right + 15} ${NL.y - 5} L ${g.right + 23} ${NL.y} L ${g.right + 15} ${NL.y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} />
          {ticks.map((v) => (
            <g key={v}>
              <line x1={nx(v)} x2={nx(v)} y1={NL.y - 7} y2={NL.y + 7} stroke="var(--ink-3)" strokeWidth={v === 0 ? 1.6 : 1} />
              <text x={nx(v)} y={NL.y + 27} fontSize={g.font} textAnchor="middle" fill="var(--ink-2)" className="font-math">
                {String(v).replace("-", "−")}
              </text>
            </g>
          ))}
          <motion.line
            y1={NL.y}
            y2={NL.y}
            initial={false}
            animate={{ x1: nx(at), x2: right ? g.right + 20 : g.left - 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            stroke="var(--blob)"
            strokeWidth={9}
            strokeLinecap="round"
            opacity={0.35}
          />
          <motion.g initial={false} animate={{ x: nx(at) }} transition={{ type: "spring", stiffness: 520, damping: 36 }}>
            <circle cy={NL.y} r={17} fill="var(--blob)" opacity={dragging ? 0.2 : 0.1} />
            <circle cy={NL.y} r={8} fill={closed ? "var(--blob)" : "var(--surface)"} stroke="var(--blob)" strokeWidth={2.8} />
            <text y={NL.y - 18} textAnchor="middle" fontSize={g.font} fill="var(--blob)" className="font-math" fontWeight={600}>
              {String(at).replace("-", "−")}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Caption>{t(tx("Direction", "Richtung"))}</Caption>
          <Segmented
            label={t(tx("Direction", "Richtung"))}
            value={right ? "r" : "l"}
            onChange={(v) => change(setRight)(v === "r")}
            options={[
              { value: "l", label: t(tx("← smaller", "← kleiner")) },
              { value: "r", label: t(tx("bigger →", "größer →")) },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Caption>{t(tx("Boundary", "Grenze"))}</Caption>
          <Segmented
            label={t(tx("Boundary", "Grenze"))}
            value={closed ? "c" : "o"}
            onChange={(v) => change(setClosed)(v === "c")}
            options={[
              { value: "o", label: t(tx("○ left out", "○ nicht dabei")) },
              { value: "c", label: t(tx("● included", "● dabei")) },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-line bg-surface px-4 py-3 sm:grid-cols-3">
        <div className="space-y-0.5">
          <Caption>{t(tx("Inequality", "Ungleichung"))}</Caption>
          <MathView src={`x#x ${REL_TEX[rel]}#r ${at}#a`} size="md" scope={`${scope}-i`} />
        </div>
        <div className="space-y-0.5">
          <Caption>{t(tx("Solution set", "Lösungsmenge"))}</Caption>
          <MathView src={t(setBuilder("x", rel, at))} size="md" scope={`${scope}-s`} />
        </div>
        <div className="space-y-0.5">
          <Caption>{t(tx("Interval", "Intervall"))}</Caption>
          <div className="font-math text-[24px] leading-[1.25] text-ink">{t(intervalText(rel, at))}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVerdict(issues.at || issues.dir || issues.dot ? "wrong" : "ok")}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-blob px-4 text-[14px] font-semibold text-white shadow-card transition-transform active:scale-95"
        >
          <Check className="size-4" /> {t(tx("Check", "Prüfen"))}
        </button>
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Eye className="size-3.5" /> {show ? t(tx("Hide the steps", "Rechenweg ausblenden")) : t(tx("Show the steps", "Rechenweg zeigen"))}
        </button>
        <button
          type="button"
          onClick={() => {
            setAt(0);
            setRight(true);
            setClosed(false);
            setVerdict(null);
          }}
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t(tx("Reset", "Von vorn"))}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {verdict && (
          <motion.p
            key={`${verdict}${at}${rel}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("text-[14px]", verdict === "ok" ? "font-semibold text-ok" : "text-danger")}
          >
            {verdict === "ok" ? t(tx("Right! That's exactly the solution set.", "Richtig! Genau das ist die Lösungsmenge.")) : t(wrongText)}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {show && (
          <motion.div key={`steps${task}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-1 rounded-xl bg-blob-soft/50 px-4 py-3">
              {goal.steps.map((st) => (
                <div key={st}>
                  <MathView src={st} size="md" animate={false} />
                </div>
              ))}
              {goal.rel === ">" && goal.at === -2 && (
                <p className="pt-1 text-[13px] text-ink-2">{t(tx("Multiplying by −1 flips the sign.", "Beim Multiplizieren mit −1 dreht sich das Zeichen um."))}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
