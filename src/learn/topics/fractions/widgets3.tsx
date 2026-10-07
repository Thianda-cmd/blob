"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { Check, Minus, Plus, RotateCcw, Shuffle, Wand2 } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { MathView } from "@/learn/components/MathView";
import { Graph } from "@/learn/visuals/Graph";
import { cn } from "@/lib/utils";
import { decStr, r6 } from "./decimals";
import { Segmented, usePick } from "./level1";

// ---------------------------------------------------------------------------
// Widget: where the denominator becomes zero. Move x and watch the value of the term;
// at a gap of the domain the denominator is 0 and the term has no value.

type Term = {
  id: string;
  src: string;
  num: (x: number) => number;
  den: (x: number) => number;
  /** The term with a value for x, display language (German decimals are fixed later). */
  put: (x: string) => [string, string];
  gaps: number[];
  never?: boolean;
};

const TERMS: Term[] = [
  {
    id: "a",
    src: "\\frac{x + 1}{x - 2}",
    num: (x) => x + 1,
    den: (x) => x - 2,
    put: (x) => [`${x} + 1`, `${x} - 2`],
    gaps: [2],
  },
  {
    id: "b",
    src: "\\frac{4}{x^2 - 4}",
    num: () => 4,
    den: (x) => x * x - 4,
    put: (x) => ["4", `${x}^2 - 4`],
    gaps: [-2, 2],
  },
  {
    id: "c",
    src: "\\frac{2x}{x^2 + 1}",
    num: (x) => 2 * x,
    den: (x) => x * x + 1,
    put: (x) => [`2 \\cdot ${x}`, `${x}^2 + 1`],
    gaps: [],
    never: true,
  },
];

const XMIN = -5;
const XMAX = 5;
const STEP = 0.25;

export function FractionsDomainExplorer() {
  const t = usePick();
  const de = useLocale() === "de";
  const l = de ? "de" : "en";
  const scope = useId();
  const [ti, setTi] = useState("a");
  const [x, setX] = useState(0.5);
  const [found, setFound] = useState<Record<string, number[]>>({});
  const term = TERMS.find((tm) => tm.id === ti)!;
  const n = r6(term.num(x));
  const d = r6(term.den(x));
  const gap = d === 0;
  const v = gap ? NaN : r6(n / d);
  const exact = !gap && Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9;
  const mine = found[ti] ?? [];
  const all = term.gaps.every((g) => mine.includes(g));

  const move = (nx: number) => {
    const c = Math.max(XMIN, Math.min(XMAX, Math.round(nx / STEP) * STEP));
    setX(c);
    if (term.gaps.includes(c) && !mine.includes(c)) setFound((f) => ({ ...f, [ti]: [...(f[ti] ?? []), c] }));
  };

  const xs = x < 0 ? `(${decStr(x, l)})` : decStr(x, l);
  const [pn, pd] = term.put(xs);
  const fmt = (y: number) => decStr(y, l);
  const value = gap
    ? `\\frac{${pn}}{${pd}} = \\frac{${fmt(n)}}{\\red{0}}`
    : `\\frac{${pn}}{${pd}} = \\frac{${fmt(n)}}{${fmt(d)}} ${exact ? "=" : "\\approx"} ${exact ? fmt(v) : decStr(Math.round(v * 100) / 100, l)}`;

  const gapsSrc = (g: number[]) => `\\{ ${[...g].sort((a, b) => a - b).map((y) => (y < 0 ? `\\group{${fmt(y)}}` : fmt(y))).join(de ? "; " : ", ")} \\}`;
  const domain = term.never ? "D = ℚ" : `D = ℚ ∖ ${gapsSrc(term.gaps)}`;

  const inRange = !gap && Math.abs(v) <= 4.5;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          scope={scope}
          options={TERMS.map((tm, i) => [tm.id, `${t("Term", "Term")} ${i + 1}`] as [string, string])}
          value={ti}
          onChange={(id) => {
            setTi(id);
            setX(0.5);
          }}
        />
        <div className="ml-auto">
          <MathView src={`f(x) = ${term.src}`} size="md" animate={false} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-surface p-2">
          <Graph
            xRange={[XMIN, XMAX]}
            yRange={[-4, 4]}
            height={230}
            functions={[{ f: (z) => term.num(z) / term.den(z), key: `fn-${ti}`, color: "blob" }]}
            segments={term.gaps.map((g) => ({ from: [g, -4], to: [g, 4], color: "danger" as const, dashed: true, key: `gap-${ti}-${g}` }))}
            points={inRange ? [{ x, y: v, key: "p", color: "blob" }] : []}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[12.5px] text-ink-2">
              <span>{t("Choose x", "Wähle x")}</span>
              <span className="font-math text-[17px] text-ink">x = {fmt(x)}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => move(x - STEP)}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink"
                aria-label={t("Smaller x", "x kleiner")}
              >
                <Minus className="size-3.5" />
              </button>
              <input
                type="range"
                min={XMIN}
                max={XMAX}
                step={STEP}
                value={x}
                onChange={(e) => move(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-[var(--blob)]"
                aria-label="x"
              />
              <button
                type="button"
                onClick={() => move(x + STEP)}
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink"
                aria-label={t("Bigger x", "x größer")}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </label>
          <motion.div
            animate={{ borderColor: gap ? "var(--danger)" : "var(--line)" }}
            className="grid min-h-[92px] place-items-center overflow-x-auto rounded-xl border bg-surface px-3 py-3"
          >
            <MathView src={value} size="md" animate={false} />
          </motion.div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={gap ? "gap" : term.never ? "never" : "ok"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("text-[13.5px] leading-relaxed", gap ? "font-medium text-danger" : "text-ink-2")}
            >
              {gap
                ? t(
                    `For x = ${fmt(x)} the denominator is 0. You can't divide by 0: this x is a gap in the domain.`,
                    `Für x = ${fmt(x)} ist der Nenner 0. Durch 0 kann man nicht teilen: Dieses x ist eine Definitionslücke.`,
                  )
                : term.never
                  ? t("x² + 1 is always at least 1, so this denominator is never 0. Try any x you like!", "x² + 1 ist immer mindestens 1, dieser Nenner wird also nie 0. Probier ruhig alle x aus!")
                  : t("Move x. Where does the graph break apart? There the denominator is 0.", "Verschieb x. Wo reißt der Graph auseinander? Dort wird der Nenner 0.")}
            </motion.p>
          </AnimatePresence>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {!term.never && (
              <span className="rounded-full bg-hover px-2.5 py-1 font-semibold text-ink-2">
                {t(`Gaps found: ${mine.length} of ${term.gaps.length}`, `Lücken gefunden: ${mine.length} von ${term.gaps.length}`)}
              </span>
            )}
            <AnimatePresence>
              {(all || term.never) && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-ok/12 px-2.5 py-1 text-ok"
                >
                  <Check className="size-3.5" />
                  <MathView src={domain} size="sm" animate={false} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: the cancelling workshop. Only factors may be cancelled. In the sum form, the
// pieces are summands (cancelling them is not allowed); after factorising they are factors.

type Piece = { id: string; src: string };
type Example = {
  num: Piece[];
  den: Piece[];
  /** Factored form; pieces with the same `src` cancel. */
  fnum: Piece[];
  fden: Piece[];
  how: [string, string];
  result: string;
  except: [string, string];
};

const EXAMPLES: Example[] = [
  {
    num: [
      { id: "s1", src: "3x" },
      { id: "s2", src: "+ 6" },
    ],
    den: [
      { id: "t1", src: "x^2" },
      { id: "t2", src: "+ 2x" },
    ],
    fnum: [
      { id: "a", src: "3" },
      { id: "b", src: "(x + 2)" },
    ],
    fden: [
      { id: "c", src: "x" },
      { id: "d", src: "(x + 2)" },
    ],
    how: ["Factor out: 3x + 6 = 3(x + 2) and x² + 2x = x(x + 2).", "Ausklammern: 3x + 6 = 3(x + 2) und x² + 2x = x(x + 2)."],
    result: "\\frac{3}{x}",
    except: ["for x ≠ 0 and x ≠ −2", "für x ≠ 0 und x ≠ −2"],
  },
  {
    num: [
      { id: "s1", src: "x^2" },
      { id: "s2", src: "- 9" },
    ],
    den: [
      { id: "t1", src: "2x" },
      { id: "t2", src: "+ 6" },
    ],
    fnum: [
      { id: "a", src: "(x + 3)" },
      { id: "b", src: "(x - 3)" },
    ],
    fden: [
      { id: "c", src: "2" },
      { id: "d", src: "(x + 3)" },
    ],
    how: ["Third binomial formula: x² − 9 = (x + 3)(x − 3). And 2x + 6 = 2(x + 3).", "3. binomische Formel: x² − 9 = (x + 3)(x − 3). Und 2x + 6 = 2(x + 3)."],
    result: "\\frac{x - 3}{2}",
    except: ["for x ≠ −3", "für x ≠ −3"],
  },
  {
    num: [
      { id: "s1", src: "5x" },
      { id: "s2", src: "- 10" },
    ],
    den: [
      { id: "t1", src: "x^2" },
      { id: "t2", src: "- 4x" },
      { id: "t3", src: "+ 4" },
    ],
    fnum: [
      { id: "a", src: "5" },
      { id: "b", src: "(x - 2)" },
    ],
    fden: [
      { id: "c", src: "(x - 2)" },
      { id: "d", src: "(x - 2)" },
    ],
    how: ["5x − 10 = 5(x − 2), and the second binomial formula: x² − 4x + 4 = (x − 2)(x − 2).", "5x − 10 = 5(x − 2), und die 2. binomische Formel: x² − 4x + 4 = (x − 2)(x − 2)."],
    result: "\\frac{5}{x - 2}",
    except: ["for x ≠ 2", "für x ≠ 2"],
  },
  {
    num: [
      { id: "s1", src: "x^2" },
      { id: "s2", src: "+ x" },
    ],
    den: [
      { id: "t1", src: "x^2" },
      { id: "t2", src: "- 1" },
    ],
    fnum: [
      { id: "a", src: "x" },
      { id: "b", src: "(x + 1)" },
    ],
    fden: [
      { id: "c", src: "(x + 1)" },
      { id: "d", src: "(x - 1)" },
    ],
    how: ["x² + x = x(x + 1), and x² − 1 = (x + 1)(x − 1).", "x² + x = x(x + 1), und x² − 1 = (x + 1)(x − 1)."],
    result: "\\frac{x}{x - 1}",
    except: ["for x ≠ 1 and x ≠ −1", "für x ≠ 1 und x ≠ −1"],
  },
];

/** Pieces that can still be cancelled: same src in numerator and denominator, not yet used. */
function pairsLeft(ex: Example, gone: string[]) {
  const top = ex.fnum.filter((p) => !gone.includes(p.id));
  const bottom = ex.fden.filter((p) => !gone.includes(p.id));
  return top.some((p) => bottom.some((q) => q.src === p.src));
}

export function FractionsCancelWorkshop() {
  const t = usePick();
  const scope = useId();
  const [ei, setEi] = useState(0);
  const [factored, setFactored] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tone: "info" | "bad" | "good"; text: string } | null>(null);
  const [shakeRef, animate] = useAnimate();
  const ex = EXAMPLES[ei % EXAMPLES.length];
  const done = factored && !pairsLeft(ex, gone);

  const reset = (next: number) => {
    setEi(next);
    setFactored(false);
    setPick(null);
    setGone([]);
    setMsg(null);
  };
  const shake = () => {
    if (shakeRef.current) animate(shakeRef.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.35 });
  };

  const tap = (side: "num" | "den", p: Piece) => {
    if (!factored) {
      // Summands: tapping one on each side is the classic forbidden "cancelling".
      if (!pick) {
        setPick(`${side}:${p.id}`);
        setMsg({ tone: "info", text: t("Now tap a piece in the other row.", "Tipp jetzt ein Teil in der anderen Zeile an.") });
        return;
      }
      setPick(null);
      shake();
      setMsg({
        tone: "bad",
        text: t(
          "Stop! These are summands (joined by + or −), not factors. You may only cancel factors. Factorise first.",
          "Stopp! Das sind Summanden (mit + oder − verbunden), keine Faktoren. Kürzen darfst du nur Faktoren. Faktorisiere zuerst.",
        ),
      });
      return;
    }
    if (gone.includes(p.id)) return;
    const key = `${side}:${p.id}`;
    if (!pick || pick.startsWith(`${side}:`)) {
      setPick(key);
      setMsg({ tone: "info", text: t("Now tap the same factor in the other row.", "Tipp jetzt denselben Faktor in der anderen Zeile an.") });
      return;
    }
    const [, otherId] = pick.split(":");
    const other = [...ex.fnum, ...ex.fden].find((q) => q.id === otherId)!;
    setPick(null);
    if (other.src === p.src) {
      const next = [...gone, otherId, p.id];
      setGone(next);
      setMsg({
        tone: "good",
        text: pairsLeft(ex, next)
          ? t(`${p.src.replace(/[()]/g, "")} cancelled! Is there another common factor?`, `${p.src.replace(/[()]/g, "")} gekürzt! Gibt es noch einen gemeinsamen Faktor?`)
          : t("Fully simplified!", "Vollständig gekürzt!"),
      });
    } else {
      shake();
      setMsg({ tone: "bad", text: t("These two factors are different. Only the same factor cancels.", "Diese beiden Faktoren sind verschieden. Kürzen kannst du nur gleiche Faktoren.") });
    }
  };

  const row = (side: "num" | "den") => {
    const pieces = factored ? (side === "num" ? ex.fnum : ex.fden) : side === "num" ? ex.num : ex.den;
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {pieces.map((p) => {
          const out = gone.includes(p.id);
          const on = pick === `${side}:${p.id}`;
          return (
            <motion.button
              layout
              key={`${factored ? "f" : "s"}-${p.id}`}
              type="button"
              onClick={() => tap(side, p)}
              disabled={out}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: out ? 0.45 : 1, scale: 1 }}
              whileTap={{ scale: 0.94 }}
              className={cn(
                "relative rounded-lg border px-2 py-1 transition-colors",
                on ? "border-blob bg-blob-soft" : "border-line bg-raised hover:border-blob/50",
                out && "border-transparent bg-transparent",
              )}
            >
              <MathView src={p.src} size="md" animate={false} />
              {out && (
                <motion.span
                  aria-hidden
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  className="absolute left-1 right-1 top-1/2 h-[2px] origin-left -rotate-12 rounded bg-danger"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFactored(true);
            setPick(null);
            setMsg({ tone: "info", text: t(ex.how[0], ex.how[1]) });
          }}
          disabled={factored}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-paper hover:bg-ink/88 disabled:opacity-35"
        >
          <Wand2 className="size-3.5" /> {t("Factorise", "Faktorisieren")}
        </button>
        <button
          type="button"
          onClick={() => reset(ei)}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t("Reset", "Zurücksetzen")}
        </button>
        <button
          type="button"
          onClick={() => reset(ei + 1)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> {t("Another term", "Anderer Term")}
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface px-3 py-5 sm:flex-row sm:justify-center">
        <div ref={shakeRef} className="inline-flex min-w-[160px] flex-col items-stretch gap-1.5">
          {row("num")}
          <div className="h-[2.5px] rounded-full bg-ink" />
          {row("den")}
        </div>
        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center gap-1">
              <MathView src={`= ${ex.result}`} size="lg" scope={`${scope}-r`} />
              <span className="text-[12px] text-ink-3">{t(ex.except[0], ex.except[1])}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-[3em]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={msg?.text ?? "start"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("text-[13.5px] leading-relaxed", msg?.tone === "bad" ? "font-medium text-danger" : msg?.tone === "good" ? "font-medium text-ok" : "text-ink-2")}
          >
            {msg?.text ??
              t(
                "Tap a piece on top and one at the bottom to cancel them. Or press “Factorise” first: only factors may be cancelled.",
                "Tipp oben und unten ein Teil an, um sie zu kürzen. Oder drück zuerst auf „Faktorisieren“: Kürzen darfst du nur Faktoren.",
              )}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
