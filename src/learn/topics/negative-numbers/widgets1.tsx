"use client";

import { AnimatePresence, motion } from "motion/react";
import { Footprints, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, txMap } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { kn, kp } from "./shared";
import { AxisLine, DragPoint, Hint, makeAxis, MiniBlob, Segmented, Stepper, signed } from "./ui";

// ---------------------------------------------------------------------------
// Compare two numbers on the number line.

export function NegCompare() {
  const t = useText();
  const [a, setA] = useState(-7);
  const [b, setB] = useState(-2);
  const [opp, setOpp] = useState(false);
  const ax = makeAxis(-10, 10);
  const y = 74;
  const [lo, hi] = a <= b ? [{ v: a, k: "A" }, { v: b, k: "B" }] : [{ v: b, k: "B" }, { v: a, k: "A" }];
  const src = a === b ? `${kn(a, "A")} =#R ${kn(b, "B")}` : `${kn(lo.v, lo.k)} <#R ${kn(hi.v, hi.k)}`;
  const L = `$${lo.v}$`;
  const H = `$${hi.v}$`;
  const sentence =
    a === b
      ? tx("Both points sit on the same number, so they are equal.", "Beide Punkte liegen auf derselben Zahl. Die Zahlen sind gleich.")
      : txMap(
          (tr) =>
            `${tr(`${L} lies further **left** than ${H}, so ${L} is the smaller number.`, `${L} liegt weiter **links** als ${H}, also ist ${L} die kleinere Zahl.`)}${
              lo.v < 0 ? ` ${tr(`At ${L} °C it is colder than at ${H} °C.`, `Bei ${L} °C ist es kälter als bei ${H} °C.`)}` : ""
            }`,
        );
  const arc = (v: number) => `M${ax.x(v)} ${y - 4} Q${ax.x(0)} ${y - 58} ${ax.x(-v)} ${y - 4}`;
  const oppText = txMap((tr) =>
    [a, b]
      .filter((v, i, list) => v !== 0 && list.indexOf(v) === i)
      .map((v) => tr(`The opposite of $${v}$ is $${-v}$.`, `Die Gegenzahl von $${v}$ ist $${-v}$.`))
      .join(" "),
  );

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Drag the points a and b along the line, or select one and use the arrow keys.", "Zieh die Punkte a und b über die Gerade oder wähl einen aus und nimm die Pfeiltasten."))}</Hint>
      <div className="grid min-h-[96px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
        <MathView src={src} size="xl" />
      </div>
      <svg viewBox={`0 0 ${ax.width} 132`} className="mx-auto w-full max-w-[660px] select-none overflow-visible">
        <AxisLine ax={ax} y={y} />
        <AnimatePresence>
          {opp &&
            [a, b]
              .filter((v, i, list) => v !== 0 && list.indexOf(v) === i)
              .map((v) => (
                <motion.g key={`opp${v}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <path d={arc(v)} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="4 5" />
                  <circle cx={ax.x(-v)} cy={y} r={7.5} fill="var(--raised)" stroke="var(--ink-2)" strokeWidth={2} />
                </motion.g>
              ))}
        </AnimatePresence>
        <DragPoint ax={ax} y={y} value={b} onChange={setB} label="b" name={tx("Point b", "Punkt b")} tone="ink" />
        <DragPoint ax={ax} y={y} value={a} onChange={setA} label="a" name={tx("Point a", "Punkt a")} tone="blob" />
      </svg>
      <p className="text-[15px] leading-relaxed text-ink-2">
        <Inline text={sentence} />
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpp((v) => !v)}
          aria-pressed={opp}
          className={cn(
            "h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors",
            opp ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          {t(tx("Show opposite numbers", "Gegenzahlen zeigen"))}
        </button>
        <AnimatePresence>
          {opp && (
            <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] text-ink-2">
              <Inline text={oppText} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blob walks the number line: the operation sign says where Blob looks, the sign of
// the number whether Blob walks forwards or backwards.

type Sign = "+" | "-";

export function NegWalker() {
  const t = useText();
  const [start, setStart] = useState(3);
  const [op, setOp] = useState<Sign>("-");
  const [sign, setSign] = useState<Sign>("-");
  const [k, setK] = useState(4);
  const [walked, setWalked] = useState(false);
  const ax = makeAxis(-12, 12);
  const y = 112;
  const look = op === "+" ? 1 : -1;
  const forward = sign === "+";
  const dir = look * (forward ? 1 : -1);
  const result = start + dir * k;
  const merged: Sign = op === sign ? "+" : "-";
  const n = sign === "-" ? -k : k;

  const xs = walked ? Array.from({ length: k + 1 }, (_, i) => ax.x(start + dir * i)) : ax.x(start);
  const ys = walked ? Array.from({ length: 2 * k + 1 }, (_, i) => (i % 2 ? -13 : 0)) : 0;
  const change = (f: () => void) => {
    f();
    setWalked(false);
  };

  const task = `${kn(start, "s")} ${op}#o ${kp(n, "n")}`;
  const src = walked ? `${task} =#e1 ${kn(start, "s2")} ${merged}#m ${k}#k =#e2 ${kn(result, "r")}` : `${task} =#e1 ?#q`;
  const lookLine =
    op === "+"
      ? tx("Operation sign **plus**: Blob looks to the **right**.", "Rechenzeichen **plus**: Blob schaut nach **rechts**.")
      : tx("Operation sign **minus**: Blob turns and looks to the **left**.", "Rechenzeichen **minus**: Blob dreht sich um und schaut nach **links**.");
  const walkLine = forward
    ? tx(`The number is **positive**: Blob walks ${k} steps **forwards**.`, `Die Zahl ist **positiv**: Blob läuft ${k} Schritte **vorwärts**.`)
    : tx(`The number is **negative**: Blob walks ${k} steps **backwards**.`, `Die Zahl ist **negativ**: Blob läuft ${k} Schritte **rückwärts**.`);
  const pm = (s: Sign) => (s === "+" ? "+" : "−");

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Set up a calculation, then press Go and watch where Blob lands.", "Stell eine Rechnung ein, drück dann auf Los und schau, wo Blob landet."))}</Hint>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stepper label={t(tx("Start", "Start"))} value={start} min={-6} max={6} onChange={(v) => change(() => setStart(v))} />
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Operation", "Rechenzeichen"))}</span>
          <Segmented
            size="lg"
            label={t(tx("Operation sign", "Rechenzeichen"))}
            value={op}
            onChange={(v) => change(() => setOp(v))}
            options={[
              { value: "+", label: "+", aria: t(tx("plus", "plus")) },
              { value: "-", label: "−", aria: t(tx("minus", "minus")) },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Number", "Zahl"))}</span>
          <Segmented
            size="lg"
            label={t(tx("Sign of the number", "Vorzeichen der Zahl"))}
            value={sign}
            onChange={(v) => change(() => setSign(v))}
            options={[
              { value: "+", label: "+", aria: t(tx("positive", "positiv")) },
              { value: "-", label: "−", aria: t(tx("negative", "negativ")) },
            ]}
          />
          <Stepper label={t(tx("steps", "Schritte"))} value={k} min={1} max={6} onChange={(v) => change(() => setK(v))} />
        </div>
      </div>

      <div className="grid min-h-[96px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
        <MathView src={src} size="xl" highlight={walked ? ["o", "ns", "m"] : ["o", "ns"]} />
      </div>

      <svg viewBox={`0 0 ${ax.width} 160`} className="mx-auto w-full max-w-[700px] select-none overflow-visible" role="img" aria-label={t(tx(`Blob walks from ${signed(start)} to ${signed(result)}.`, `Blob läuft von ${signed(start)} nach ${signed(result)}.`))}>
        <AxisLine ax={ax} y={y} />
        <circle cx={ax.x(start)} cy={y} r={6} fill="var(--raised)" stroke="var(--ink-2)" strokeWidth={2} />
        <AnimatePresence>
          {walked && (
            <motion.g key={`trail${start}${result}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              <motion.path
                d={`M${ax.x(start)} 56 Q${(ax.x(start) + ax.x(result)) / 2} 26 ${ax.x(result)} 56`}
                fill="none"
                stroke="var(--blob)"
                strokeWidth={2.4}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.36 * k, ease: "easeInOut" }}
              />
              <motion.text
                x={(ax.x(start) + ax.x(result)) / 2}
                y={22}
                textAnchor="middle"
                fill="var(--blob)"
                fontWeight={700}
                className="font-math text-[16px] max-sm:text-[22px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.36 * k }}
              >
                {`${pm(op)} (${pm(sign)}${k})`}
              </motion.text>
              <motion.circle
                cx={ax.x(result)}
                cy={y}
                r={7}
                fill="var(--blob)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.36 * k, type: "spring", stiffness: 500, damping: 20 }}
              />
            </motion.g>
          )}
        </AnimatePresence>
        <motion.g
          initial={false}
          animate={{ x: xs, y: ys }}
          transition={walked ? { duration: 0.36 * k, ease: "easeInOut" } : { type: "spring", stiffness: 260, damping: 26 }}
        >
          <g transform={`translate(0 ${y - 3})`}>
            <MiniBlob look={look > 0 ? "right" : "left"} />
          </g>
        </motion.g>
      </svg>

      <div className="space-y-1 text-[14.5px] leading-relaxed text-ink-2">
        <p>
          <Inline text={lookLine} />
        </p>
        <p>
          <Inline text={walkLine} />
        </p>
        <AnimatePresence>
          {walked && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 * k }} className="font-medium text-ink">
              <Inline
                text={txMap((tr) =>
                  tr(
                    `Blob lands on $${result}$. Two signs in a row: ${op === sign ? "equal signs give **plus**" : "different signs give **minus**"}.`,
                    `Blob landet bei $${result}$. Zwei Zeichen hintereinander: ${op === sign ? "gleiche Zeichen ergeben **plus**" : "verschiedene Zeichen ergeben **minus**"}.`,
                  ),
                )}
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => setWalked((w) => !w)}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-card hover:bg-blob-deep"
      >
        {walked ? <RotateCcw className="size-4" /> : <Footprints className="size-4" />}
        {walked ? t(tx("Back to the start", "Zurück zum Start")) : t(tx("Go!", "Los!"))}
      </button>
    </div>
  );
}
