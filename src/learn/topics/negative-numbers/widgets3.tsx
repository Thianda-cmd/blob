"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { tx, txMap } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { createRng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { par, stepsOf } from "./shared";
import { AxisLine, Brace, DragPoint, Hint, makeAxis, Segmented, signed, Stepper } from "./ui";

// ---------------------------------------------------------------------------
// Distances on the number line: |a|, |b| and |a − b|.

export function NegDistance() {
  const t = useText();
  const [a, setA] = useState(-3);
  const [b, setB] = useState(4);
  const [mode, setMode] = useState<"zero" | "between">("between");
  const ax = makeAxis(-10, 10);
  const y = 112;
  const d = Math.abs(a - b);
  const src =
    mode === "zero"
      ? `\\group{|#l1 a#va |#r1 =#e1 |#l3 ${a}#a |#r3 =#e3 ${Math.abs(a)}#da} \\quad \\group{|#l2 b#vb |#r2 =#e2 |#l4 ${b}#b |#r4 =#e4 ${Math.abs(b)}#db}`
      : `\\group{|#l1 ${par(a)}#a -#m ${par(b)}#b |#r1} \\group{=#e1 |#l2 ${a - b}#q |#r2} \\group{=#e2 ${d}#d}`;
  const other = `\\group{|#l1 ${par(b)}#b -#m ${par(a)}#a |#r1} \\group{=#e1 |#l2 ${b - a}#q |#r2} \\group{=#e2 ${d}#d}`;
  const sentence =
    mode === "zero"
      ? tx(
          `$a = ${a}$ is ${stepsOf(Math.abs(a), "en")} from $0$, and $b = ${b}$ is ${stepsOf(Math.abs(b), "en")} from $0$. The absolute value is that distance, so it is never negative.`,
          `$a = ${a}$ ist ${stepsOf(Math.abs(a), "de")} von $0$ entfernt und $b = ${b}$ ist ${stepsOf(Math.abs(b), "de")} von $0$ entfernt. Der Betrag ist genau dieser Abstand, deshalb ist er nie negativ.`,
        )
      : d === 0
        ? tx("Both points are on the same number: the distance is $0$.", "Beide Punkte liegen auf derselben Zahl: Der Abstand ist $0$.")
        : txMap((tr) =>
            tr(
              `There ${d === 1 ? "is" : "are"} ${stepsOf(d, "en")} between $a$ and $b$. Whichever way round you subtract, $${a - b}$ or $${b - a}$, the absolute value makes the distance positive.`,
              `Zwischen $a$ und $b$ ${d === 1 ? "liegt" : "liegen"} ${stepsOf(d, "de")}. Egal, wie herum du subtrahierst, $${a - b}$ oder $${b - a}$: Der Betrag macht den Abstand positiv.`,
            ),
          );

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Drag a and b, and switch between the two kinds of distance.", "Zieh a und b und wechsle zwischen den beiden Arten von Abstand."))}</Hint>
      <Segmented
        value={mode}
        onChange={setMode}
        label={t(tx("Which distance", "Welcher Abstand"))}
        options={[
          { value: "zero", label: t(tx("Distance from 0", "Abstand zur 0")) },
          { value: "between", label: t(tx("Distance between a and b", "Abstand zwischen a und b")) },
        ]}
      />
      <div className="grid min-h-[96px] gap-2 rounded-xl border border-line bg-surface px-4 py-4">
        <div className="flex justify-center">
          <MathView src={src} size="lg" />
        </div>
        <AnimatePresence>
          {mode === "between" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex justify-center overflow-hidden text-ink-2">
              <MathView src={other} size="md" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <svg viewBox={`0 0 ${ax.width} 182`} className="mx-auto w-full max-w-[660px] select-none overflow-visible">
        <AxisLine ax={ax} y={y} />
        <AnimatePresence>
          {mode === "zero" && a !== 0 && <Brace key="za" x1={ax.x(0)} x2={ax.x(a)} y={y - 16} label={`|a| = ${Math.abs(a)}`} tone="blob" />}
          {mode === "zero" && b !== 0 && <Brace key="zb" x1={ax.x(0)} x2={ax.x(b)} y={y - 58} label={`|b| = ${Math.abs(b)}`} tone="ink" />}
          {mode === "between" && d !== 0 && <Brace key="ab" x1={ax.x(a)} x2={ax.x(b)} y={y - 16} label={`|a − b| = ${d}`} tone="ok" />}
        </AnimatePresence>
        <DragPoint ax={ax} y={y} value={b} onChange={setB} label="b" name={tx("Point b", "Punkt b")} tone="ink" above={false} />
        <DragPoint ax={ax} y={y} value={a} onChange={setA} label="a" name={tx("Point a", "Punkt a")} tone="blob" above={false} />
      </svg>
      <p className="text-[15px] leading-relaxed text-ink-2">
        <Inline text={sentence} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Power lab: (−2)ⁿ against −2ⁿ.

const BASES = [-1, -2, -3, -5, -10];

/** "1 000 000" with thin spaces in the display language. */
const big = (v: number) => {
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
  return v < 0 ? `-${s}` : s;
};

export function NegPowerLab() {
  const t = useText();
  const scope = useId();
  const [base, setBase] = useState(-2);
  const [n, setN] = useState(3);
  const [brackets, setBrackets] = useState(true);
  const a = Math.abs(base);
  const value = brackets ? base ** n : -(a ** n);
  const factors = Array.from({ length: n }, (_, i) => i);
  // Lines may only break before "=" or "·": a minus never dangles at the end of a line.
  const chain = brackets
    ? [`\\group{= (${base})}`, ...factors.slice(1).map(() => `\\group{\\cdot (${base})}`)].join(" ")
    : `\\group{= -(${factors.map(() => a).join(" \\cdot ")})}`;
  const head = brackets ? `(${base})^{${n}}` : `-${a}^{${n}}`;
  const src = `${head} ${chain} \\group{= ${big(value)}}`;
  // "−(10 · 10 · 10 · 10 · 10 · 10)" can't break inside the bracket: smaller on phones so it fits.
  const long = !brackets && a === 10 && n >= 5;
  const pairs = Math.floor(n / 2);
  const odd = n % 2 === 1;
  const verdict = brackets
    ? odd
      ? tx(`${n} minus signs: ${pairs} pair${pairs === 1 ? "" : "s"} and one left over. **Odd** exponent, **negative** result.`, `${n} Minuszeichen: ${pairs} ${pairs === 1 ? "Paar" : "Paare"} und eins bleibt übrig. **Ungerader** Exponent, **negatives** Ergebnis.`)
      : tx(`${n} minus signs: ${pairs} pair${pairs === 1 ? "" : "s"}, nothing left over. **Even** exponent, **positive** result.`, `${n} Minuszeichen: ${pairs} ${pairs === 1 ? "Paar" : "Paare"}, nichts bleibt übrig. **Gerader** Exponent, **positives** Ergebnis.`)
    : tx(`Without brackets, the exponent belongs only to the ${a}. The minus stays in front, so the result is always **negative**.`, `Ohne Klammer gehört der Exponent nur zur ${a}. Das Minus bleibt davor, das Ergebnis ist also immer **negativ**.`);

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Pick a base and an exponent. Then switch the brackets off and compare.", "Wähl eine Basis und einen Exponenten. Schalte dann die Klammer aus und vergleiche."))}</Hint>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Base", "Basis"))}</span>
          <Segmented value={base} onChange={setBase} label={t(tx("Base", "Basis"))} options={BASES.map((v) => ({ value: v, label: <span className="font-math">{signed(v)}</span> }))} />
        </div>
        <Stepper label={t(tx("Exponent", "Exponent"))} value={n} min={1} max={6} onChange={setN} />
        <Segmented
          value={brackets ? "with" : "without"}
          onChange={(v) => setBrackets(v === "with")}
          label={t(tx("Brackets", "Klammer"))}
          options={[
            { value: "with", label: <span className="font-math">{`(${signed(base)})ⁿ`}</span>, aria: t(tx("with brackets", "mit Klammer")) },
            { value: "without", label: <span className="font-math">{`${signed(base)}ⁿ`}</span>, aria: t(tx("without brackets", "ohne Klammer")) },
          ]}
        />
      </div>

      <div className="grid min-h-[96px] place-items-center rounded-xl border border-line bg-surface px-4 py-4">
        <MathView src={src} size="lg" className={long ? "max-sm:text-[21px]!" : undefined} />
      </div>

      <LayoutGroup id={scope}>
        <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
          {!brackets && (
            <motion.span layout key="minus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mr-1 font-math text-[22px] font-semibold text-danger">
              −
            </motion.span>
          )}
          {factors.map((i) => {
            const pairNo = Math.floor(i / 2);
            const alone = odd && i === n - 1;
            const closesPair = brackets && i % 2 === 1;
            return (
              <motion.span layout key={i} className={cn("flex items-center gap-1.5", closesPair && i !== n - 1 && "mr-2")}>
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "flex h-10 min-w-12 items-center justify-center rounded-lg border px-2 font-math text-[18px]",
                    !brackets ? "border-line bg-raised text-ink" : alone ? "border-danger text-danger" : pairNo % 2 ? "border-blob bg-blob-soft text-ink" : "border-ok text-ink",
                  )}
                >
                  {brackets ? `(${signed(base)})` : a}
                </motion.span>
                {closesPair && <span className="font-math text-[15px] font-semibold text-ok">→ +</span>}
              </motion.span>
            );
          })}
        </div>
      </LayoutGroup>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Sign for n =", "Vorzeichen für n ="))}</span>
        {[1, 2, 3, 4, 5, 6].map((k) => {
          const neg = brackets ? k % 2 === 1 : true;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              aria-label={t(tx(`Exponent ${k}`, `Exponent ${k}`))}
              className={cn(
                "flex h-9 w-11 flex-col items-center justify-center rounded-lg border text-[11px] leading-none transition-colors",
                k === n ? "border-blob bg-blob-soft" : "border-line hover:bg-hover",
              )}
            >
              <span className="text-ink-3">{k}</span>
              <span className={cn("font-math text-[16px] font-semibold", neg ? "text-danger" : "text-ok")}>{neg ? "−" : "+"}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[15px] leading-relaxed text-ink-2">
        <Inline text={verdict} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clever adding: combine partners that give round numbers.

type Card = { id: number; v: number; round?: boolean };

function makePuzzle(seed: number): Card[] {
  const rng = createRng(seed * 104729 + 17);
  let p = rng.int(12, 89);
  if (p % 10 === 0) p += 3;
  const u = rng.int(1, 9);
  const q = 10 * rng.int(2, 8);
  const s1 = rng.sign();
  const w = rng.int(1, 9);
  const m = 10 * rng.int(1, 4);
  const n = 10 * rng.int(1, 3) * rng.sign();
  const s2 = rng.sign();
  // Three pairs of partners: −p and p cancel, the others give round numbers.
  const vals = [-p, p, s1 * (q + u), -s1 * u, s2 * (m + w), -s2 * w + n];
  return rng.shuffle(vals).map((v, i) => ({ id: i, v }));
}

const START_SEED = 3;

export function NegCleverSum() {
  const t = useText();
  const scope = useId();
  const [seed, setSeed] = useState(START_SEED);
  const [cards, setCards] = useState<Card[]>(() => makePuzzle(START_SEED));
  const [picked, setPicked] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [roundMoves, setRoundMoves] = useState(0);
  const [last, setLast] = useState<{ a: number; b: number; sum: number; swapped: boolean } | null>(null);
  const total = cards.reduce((s, c) => s + c.v, 0);
  const done = cards.length === 1;

  const restart = (s: number) => {
    setSeed(s);
    setCards(makePuzzle(s));
    setPicked(null);
    setMoves(0);
    setRoundMoves(0);
    setLast(null);
  };
  const tap = (id: number) => {
    if (done) return;
    if (picked === null || picked === id) {
      setPicked(picked === id ? null : id);
      return;
    }
    const i = cards.findIndex((c) => c.id === picked);
    const j = cards.findIndex((c) => c.id === id);
    const a = cards[i];
    const b = cards[j];
    const sum = a.v + b.v;
    const round = sum % 10 === 0;
    const keep = Math.min(i, j);
    const next = cards.filter((c) => c.id !== a.id && c.id !== b.id);
    next.splice(keep, 0, { id: a.id, v: sum, round });
    setCards(next);
    setPicked(null);
    setMoves((m) => m + 1);
    if (round) setRoundMoves((m) => m + 1);
    setLast({ a: a.v, b: b.v, sum, swapped: Math.abs(i - j) > 1 });
  };
  const sumOf = (list: Card[]) => list.map((c, i) => (i === 0 ? String(c.v) : c.v < 0 ? `- ${-c.v}` : `+ ${c.v}`)).join(" ");
  const sumSrc = done ? `${sumOf(makePuzzle(seed))} = ${total}` : `${sumOf(cards)} = ?`;
  const stepText = last
    ? txMap((tr) =>
        [
          `$${last.a} + ${par(last.b)} = ${last.sum}$:`,
          last.sum % 10 === 0 ? tr("a round number!", "eine glatte Zahl!") : tr("not round, but that's allowed.", "nicht glatt, aber erlaubt."),
          last.swapped ? tr("You swapped and grouped: commutative and associative law.", "Du hast vertauscht und zusammengefasst: Kommutativ- und Assoziativgesetz.") : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
    : tx("Tap two numbers to add them. Look for partners that give a round number.", "Tipp zwei Zahlen an, um sie zu addieren. Such Partner, die zusammen eine glatte Zahl ergeben.");

  return (
    <div className="space-y-4">
      <Hint>{t(tx("Each number keeps its sign. You may add any two of them, in any order.", "Jede Zahl behält ihr Vorzeichen. Du darfst zwei beliebige Zahlen addieren, in jeder Reihenfolge."))}</Hint>
      <div className="grid min-h-[84px] place-items-center rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={sumSrc} size="lg" />
      </div>
      <LayoutGroup id={scope}>
        <div className="flex min-h-[64px] flex-wrap items-center justify-center gap-2.5">
          <AnimatePresence mode="popLayout">
            {cards.map((c) => (
              <motion.button
                layout
                key={c.id}
                type="button"
                onClick={() => tap(c.id)}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: picked === c.id ? 1.08 : 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                aria-pressed={picked === c.id}
                className={cn(
                  "relative flex h-14 min-w-16 items-center justify-center rounded-2xl border-2 px-3 font-math text-[22px] shadow-card",
                  picked === c.id ? "border-blob bg-blob-soft" : c.round ? "border-ok bg-raised" : "border-line bg-raised hover:border-line-2",
                  done && "border-blob",
                )}
              >
                {c.v > 0 ? `+${c.v}` : signed(c.v)}
                {c.round && !done && <Sparkles className="absolute -right-1.5 -top-1.5 size-4 text-ok" />}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      <p className="min-h-[3em] text-center text-[15px] leading-relaxed text-ink-2">
        {done ? (
          <Inline
            text={tx(
              `Done: the sum is $${total}$. ${roundMoves === moves ? "Very clever: only round steps!" : `${roundMoves} of ${moves} steps were round. Try to find better partners!`}`,
              `Fertig: Die Summe ist $${total}$. ${roundMoves === moves ? "Sehr geschickt: nur glatte Schritte!" : `${roundMoves} von ${moves} Schritten waren glatt. Versuch, bessere Partner zu finden!`}`,
            )}
          />
        ) : (
          <Inline text={stepText} />
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => restart(seed)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
        </button>
        <button type="button" onClick={() => restart(seed + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("New sum", "Neue Summe"))}
        </button>
      </div>
    </div>
  );
}
