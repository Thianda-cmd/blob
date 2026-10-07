"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, RotateCcw, Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { tx, txMap } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { createRng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { par } from "./shared";
import { AxisLine, Hint, makeAxis, signed, Stepper } from "./ui";

// ---------------------------------------------------------------------------
// Follow the pattern: why minus times minus is plus.

const FIRST = [3, 2, 1, 0, -1, -2, -3];

export function NegPattern() {
  const t = useText();
  const scope = useId();
  const [b, setB] = useState(-4);
  const [rows, setRows] = useState(4);
  const [open, setOpen] = useState(true);
  const shown = FIRST.slice(0, rows);
  const results = shown.map((a) => a * b);
  const last = shown[shown.length - 1];
  const step = -b;
  const ax = makeAxis(-15, 15, 15);
  const y = 60;
  const visible = results.slice(0, open ? rows : rows - 1);

  const next = () => {
    if (!open) setOpen(true);
    else if (rows < FIRST.length) {
      setRows(rows + 1);
      setOpen(false);
    }
  };
  const reset = () => {
    setRows(4);
    setOpen(true);
  };

  const message = !open
    ? tx("Guess first: what does the pattern say? Then show the result.", "Rate zuerst: Was sagt das Muster? Dann zeig das Ergebnis.")
    : last >= 0
      ? tx(`Each row the first factor gets 1 smaller, and the result gets ${step} bigger. What comes next?`, `In jeder Zeile wird der erste Faktor um 1 kleiner und das Ergebnis um ${step} größer. Wie geht es weiter?`)
      : txMap((tr) =>
          tr(
            `The pattern goes on: $${par(last)} \\cdot ${par(b)} = ${last * b}$. Minus times minus gives **plus**!`,
            `Das Muster geht weiter: $${par(last)} \\cdot ${par(b)} = ${last * b}$. Minus mal minus ergibt **plus**!`,
          ),
        );

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Go down the rows: the first factor gets smaller each time. Watch what the result does.", "Geh die Zeilen nach unten: Der erste Faktor wird jedes Mal kleiner. Schau, was das Ergebnis macht."))}</Hint>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stepper
          label={t(tx("Second factor", "Zweiter Faktor"))}
          value={b}
          min={-5}
          max={-1}
          onChange={(v) => {
            setB(v);
            reset();
          }}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <LayoutGroup id={scope}>
            {shown.map((a, i) => {
              const isLast = i === shown.length - 1;
              const res = a * b;
              const hidden = isLast && !open;
              const resSrc = hidden ? "\\box{?}" : a < 0 ? `\\green{${res}}` : String(res);
              return (
                <motion.div
                  key={a}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex items-center justify-between gap-3 rounded-lg px-2 py-1", isLast && "bg-blob-soft")}
                >
                  <MathView src={`${par(a)} \\cdot ${par(b)} = ${resSrc}`} size="md" scope={`${scope}-r${a}`} />
                  {i > 0 && !hidden && (
                    <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="shrink-0 rounded-full bg-hover px-2 py-0.5 font-math text-[13px] text-ink-2">
                      +{step}
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </LayoutGroup>
        </div>
        <div className="space-y-3">
          <svg viewBox={`0 0 ${ax.width} 100`} className="w-full overflow-visible" role="img" aria-label={visible.map(signed).join(", ")}>
            <AxisLine ax={ax} y={y} labelEvery={5} phoneEvery={1} />
            {visible.map((r, i) =>
              i === 0 ? null : (
                <motion.path
                  key={`hop${i}`}
                  d={`M${ax.x(visible[i - 1])} ${y - 6} Q${(ax.x(visible[i - 1]) + ax.x(r)) / 2} ${y - 30} ${ax.x(r)} ${y - 6}`}
                  fill="none"
                  stroke={FIRST[i] < 0 ? "var(--ok)" : "var(--blob)"}
                  strokeWidth={2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45 }}
                />
              ),
            )}
            {visible.map((r, i) => (
              <motion.circle
                key={`pt${i}`}
                cx={ax.x(r)}
                cy={y}
                initial={{ r: 0 }}
                animate={{ r: i === visible.length - 1 ? 8 : 5 }}
                fill={FIRST[i] < 0 ? "var(--ok)" : "var(--blob)"}
                stroke="var(--raised)"
                strokeWidth={2}
              />
            ))}
          </svg>
          <p className="min-h-[3em] text-[15px] leading-relaxed text-ink-2">
            <Inline text={message} />
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={next}
              disabled={open && rows >= FIRST.length}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-card hover:bg-blob-deep disabled:opacity-40"
            >
              <ChevronDown className="size-4" />
              {!open ? t(tx("Show the result", "Ergebnis zeigen")) : t(tx("Next row", "Nächste Zeile"))}
            </button>
            <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count the minus signs: every two of them make a plus.

const START_AMOUNTS = [2, 3, 5, 1, 2, 4];

export function NegSignCounter() {
  const t = useText();
  const scope = useId();
  const [count, setCount] = useState(4);
  const [signs, setSigns] = useState<(1 | -1)[]>([-1, 1, -1, -1, 1, -1]);
  const [amounts, setAmounts] = useState(START_AMOUNTS);
  const [seed, setSeed] = useState(1);
  const used = signs.slice(0, count);
  const minus = used.map((s, i) => (s < 0 ? i : -1)).filter((i) => i >= 0);
  const pairs: number[][] = [];
  for (let i = 0; i + 1 < minus.length; i += 2) pairs.push([minus[i], minus[i + 1]]);
  const left = minus.length % 2 ? minus[minus.length - 1] : null;
  const product = amounts.slice(0, count).reduce((p, a, i) => p * a * used[i], 1);
  const factors = amounts.slice(0, count).map((a, i) => par(a * used[i])).join(" \\cdot ");
  const flip = (i: number) => setSigns((s) => s.map((x, j) => (j === i ? (-x as 1 | -1) : x)));
  const shuffle = () => {
    const rng = createRng(seed * 7717 + 3);
    setSeed(seed + 1);
    setAmounts(START_AMOUNTS.map(() => rng.pick([1, 2, 2, 3, 3, 4, 5])));
    setSigns(START_AMOUNTS.map(() => (rng.chance(0.55) ? -1 : 1)));
  };
  const n = minus.length;
  const verdict =
    n % 2 === 0
      ? tx(`${n} minus sign${n === 1 ? "" : "s"}: an **even** number. They all pair up, so the product is **positive**.`, `${n} Minuszeichen: eine **gerade** Anzahl. Alle bilden Paare, also ist das Produkt **positiv**.`)
      : tx(`${n} minus sign${n === 1 ? "" : "s"}: an **odd** number. One is left over, so the product is **negative**.`, `${n} Minuszeichen: eine **ungerade** Anzahl. Eins bleibt übrig, also ist das Produkt **negativ**.`);

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Tap a factor to switch its sign between plus and minus.", "Tipp einen Faktor an, um sein Vorzeichen zwischen plus und minus zu wechseln."))}</Hint>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stepper label={t(tx("Factors", "Faktoren"))} value={count} min={2} max={6} onChange={setCount} />
        <button type="button" onClick={shuffle} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("New numbers", "Neue Zahlen"))}
        </button>
      </div>

      <LayoutGroup id={scope}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-xl border border-line bg-surface px-3 py-4">
          {used.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="font-math text-[22px] text-ink-3">·</span>}
              <button
                type="button"
                onClick={() => flip(i)}
                aria-label={t(tx(`Factor ${i + 1}: ${signed(s * amounts[i])}. Switch the sign.`, `Faktor ${i + 1}: ${signed(s * amounts[i])}. Vorzeichen wechseln.`))}
                className={cn(
                  "flex h-12 min-w-12 items-center justify-center rounded-xl border px-2.5 font-math text-[24px] transition-colors",
                  s < 0 ? "border-blob bg-blob-soft text-ink" : "border-line bg-raised text-ink hover:border-line-2",
                )}
              >
                {s < 0 ? (
                  <>
                    <span className="text-ink-3">(</span>
                    <span className="font-semibold text-blob-ink">−</span>
                    {amounts[i]}
                    <span className="text-ink-3">)</span>
                  </>
                ) : (
                  amounts[i]
                )}
              </button>
            </span>
          ))}
        </div>
      </LayoutGroup>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Minus signs", "Minuszeichen"))}</span>
        <AnimatePresence mode="popLayout">
          {pairs.map(([p, q]) => (
            <motion.span
              layout
              key={`pair${p}-${q}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="flex items-center gap-1 rounded-lg border border-line bg-raised px-2 py-1 font-math text-[18px]"
            >
              <span>{`(−${amounts[p]})`}</span>
              <span className="text-ink-3">·</span>
              <span>{`(−${amounts[q]})`}</span>
              <span className="text-ink-3">→</span>
              <span className="font-semibold text-ok">+</span>
            </motion.span>
          ))}
          {left !== null && (
            <motion.span
              layout
              key={`left${left}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="flex items-center gap-1 rounded-lg border border-danger px-2 py-1 font-math text-[18px]"
            >
              <span className="font-semibold text-danger">{`(−${amounts[left]})`}</span>
              <span className="text-[12px] text-ink-2">{t(tx("left over", "bleibt übrig"))}</span>
            </motion.span>
          )}
          {n === 0 && (
            <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] text-ink-3">
              {t(tx("none", "keine"))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={`${factors} = ${product < 0 ? `\\red{${product}}` : `\\green{${product}}`}`} size="lg" />
      </div>
      <p className="text-[15px] leading-relaxed text-ink-2">
        <Inline text={verdict} />
      </p>
    </div>
  );
}
