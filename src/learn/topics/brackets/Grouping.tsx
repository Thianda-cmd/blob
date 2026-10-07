"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Shuffle, X } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

/** One way to pair the first term with a partner: the pairs, each pair factored, the result (or why it fails). */
type Pairing = { grouped: string; factored?: string; result?: string; note: Text };
type Example = { terms: string[]; pairings: Record<number, Pairing> };

const EXAMPLES: Example[] = [
  {
    terms: ["ax", "+ ay", "+ bx", "+ by"],
    pairings: {
      1: {
        grouped: "(ax + ay) + (bx + by)",
        factored: "a\\hl{(x + y)} + b\\hl{(x + y)}",
        result: "(x + y)(a + b)",
        note: tx("Factor $a$ out of the first pair and $b$ out of the second: the same bracket $(x + y)$ appears twice.", "Klammere aus dem ersten Paar $a$ aus und aus dem zweiten $b$: Zweimal steht dieselbe Klammer $(x + y)$."),
      },
      2: {
        grouped: "(ax + bx) + (ay + by)",
        factored: "x\\hl{(a + b)} + y\\hl{(a + b)}",
        result: "(a + b)(x + y)",
        note: tx("This pairing works too: $x$ from the first pair, $y$ from the second, and $(a + b)$ is the common bracket.", "Diese Paare klappen auch: $x$ aus dem ersten Paar, $y$ aus dem zweiten, und $(a + b)$ ist die gemeinsame Klammer."),
      },
      3: { grouped: "(ax + by) + (ay + bx)", note: tx("$ax$ and $by$ have no letter in common: there's nothing to factor out. Try another partner.", "$ax$ und $by$ haben keinen gemeinsamen Buchstaben: Hier lässt sich nichts ausklammern. Probier einen anderen Partner.") },
    },
  },
  {
    terms: ["2x", "+ 6", "+ xy", "+ 3y"],
    pairings: {
      1: {
        grouped: "(2x + 6) + (xy + 3y)",
        factored: "2\\hl{(x + 3)} + y\\hl{(x + 3)}",
        result: "(x + 3)(2 + y)",
        note: tx("$2$ from the first pair, $y$ from the second: the bracket $(x + 3)$ appears twice.", "$2$ aus dem ersten Paar, $y$ aus dem zweiten: Die Klammer $(x + 3)$ steht zweimal da."),
      },
      2: {
        grouped: "(2x + xy) + (6 + 3y)",
        factored: "x\\hl{(2 + y)} + 3\\hl{(2 + y)}",
        result: "(2 + y)(x + 3)",
        note: tx("$x$ from the first pair, $3$ from the second: $(2 + y)$ is the common bracket. Same result, other order.", "$x$ aus dem ersten Paar, $3$ aus dem zweiten: $(2 + y)$ ist die gemeinsame Klammer. Gleiches Ergebnis, andere Reihenfolge."),
      },
      3: { grouped: "(2x + 3y) + (6 + xy)", note: tx("$2x$ and $3y$ have no common factor. This pairing leads nowhere.", "$2x$ und $3y$ haben keinen gemeinsamen Faktor. Diese Paare führen nicht weiter.") },
    },
  },
  {
    terms: ["3a", "- 6", "- ab", "+ 2b"],
    pairings: {
      1: {
        grouped: "(3a - 6) + (-ab + 2b)",
        factored: "3\\hl{(a - 2)} - b\\hl{(a - 2)}",
        result: "(a - 2)(3 - b)",
        note: tx("Factor $-b$ out of the second pair, so its signs flip: $-ab + 2b = -b(a - 2)$. Now both brackets match.", "Klammere aus dem zweiten Paar $-b$ aus, dann drehen sich die Vorzeichen um: $-ab + 2b = -b(a - 2)$. Jetzt passen beide Klammern."),
      },
      2: {
        grouped: "(3a - ab) + (-6 + 2b)",
        factored: "a\\hl{(3 - b)} - 2\\hl{(3 - b)}",
        result: "(3 - b)(a - 2)",
        note: tx("$a$ from the first pair and $-2$ from the second: $-6 + 2b = -2(3 - b)$. Same result again.", "$a$ aus dem ersten Paar und $-2$ aus dem zweiten: $-6 + 2b = -2(3 - b)$. Wieder dasselbe Ergebnis."),
      },
      3: { grouped: "(3a + 2b) + (-6 - ab)", note: tx("$3a$ and $2b$ have no common factor. Try another partner.", "$3a$ und $2b$ haben keinen gemeinsamen Faktor. Probier einen anderen Partner.") },
    },
  },
  {
    terms: ["x^2", "+ 3x", "+ 2x", "+ 6"],
    pairings: {
      1: {
        grouped: "(x^2 + 3x) + (2x + 6)",
        factored: "x\\hl{(x + 3)} + 2\\hl{(x + 3)}",
        result: "(x + 3)(x + 2)",
        note: tx("$x$ from the first pair, $2$ from the second. A product of two brackets: that's how you factorise many quadratic terms.", "$x$ aus dem ersten Paar, $2$ aus dem zweiten. Ein Produkt aus zwei Klammern: So zerlegst du viele quadratische Terme."),
      },
      2: {
        grouped: "(x^2 + 2x) + (3x + 6)",
        factored: "x\\hl{(x + 2)} + 3\\hl{(x + 2)}",
        result: "(x + 2)(x + 3)",
        note: tx("$x$ and $3$: the common bracket is $(x + 2)$. Same product as before.", "$x$ und $3$: Die gemeinsame Klammer ist $(x + 2)$. Dasselbe Produkt wie vorher."),
      },
      3: { grouped: "(x^2 + 6) + (3x + 2x)", note: tx("$x^2$ and $6$ have no common factor. Pairing like terms doesn't help here either.", "$x^2$ und $6$ haben keinen gemeinsamen Faktor. Gleichartige Terme zu paaren hilft hier auch nicht.") },
    },
  },
];

const spring = { type: "spring", stiffness: 420, damping: 32 } as const;

/** Factoring by grouping: choose a partner for the first term and see whether a common bracket appears. */
export function GroupingPuzzle() {
  const t = useText();
  const scope = useId();
  const [n, setN] = useState(0);
  const [partner, setPartner] = useState<number | null>(null);
  const ex = EXAMPLES[n % EXAMPLES.length];
  const p = partner ? ex.pairings[partner] : null;
  const group = (i: number) => (i === 0 || i === partner ? 1 : partner ? 2 : 0);
  const start = ex.terms.join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={tx(
              "Four terms, but no factor is in all of them. Pick a partner for the first term. The other two form the second pair. Does the same bracket appear in both pairs?",
              "Vier Terme, aber kein Faktor steckt in allen. Such dem ersten Term einen Partner aus. Die anderen beiden bilden das zweite Paar. Taucht in beiden Paaren dieselbe Klammer auf?",
            )}
          />
        </p>
        <button
          onClick={() => {
            setN((v) => v + 1);
            setPartner(null);
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> {t(tx("Another term", "Anderer Term"))}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-4">
        {ex.terms.map((term, i) => {
          const g = group(i);
          return (
            <motion.button
              key={`${n}-${i}`}
              layout
              transition={spring}
              onClick={() => i > 0 && setPartner(i)}
              disabled={i === 0}
              aria-pressed={i > 0 ? partner === i : undefined}
              aria-label={i === 0 ? t(tx("First term", "Erster Term")) : t(tx(`Pair the first term with term ${i + 1}`, `Ersten Term mit Term ${i + 1} paaren`))}
              className={cn(
                "grid min-h-12 min-w-[64px] place-items-center rounded-xl border px-3 py-1.5 transition-colors",
                g === 1 && "border-transparent bg-blob text-white",
                g === 2 && "border-blob/40 bg-blob-soft text-ink",
                g === 0 && "border-line bg-raised text-ink hover:border-blob hover:bg-hover",
              )}
            >
              <MathView src={term} size="md" animate={false} />
            </motion.button>
          );
        })}
      </div>

      <div className="min-h-[150px] space-y-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {!p && (
            <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-1 text-[13.5px] text-ink-3">
              {t(tx("Tap one of the other three terms.", "Tippe auf einen der anderen drei Terme."))}
            </motion.p>
          )}
          {p && (
            <motion.div key={`${n}-${partner}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="space-y-2">
              <Line label={t(tx("Pairs", "Paare"))} src={`${start} = ${p.grouped}`} scope={`${scope}-a`} delay={0} />
              {p.factored && <Line label={t(tx("Factor out", "Ausklammern"))} src={`= ${p.factored}`} scope={`${scope}-b`} delay={0.12} />}
              {p.result && <Line label={t(tx("Common bracket", "Gemeinsame Klammer"))} src={`= ${p.result}`} scope={`${scope}-c`} delay={0.24} strong />}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className={cn("flex items-start gap-2 rounded-xl px-4 py-3 text-[14px] leading-relaxed", p.result ? "bg-ok/10" : "bg-danger/10")}>
                {p.result ? <Check className="mt-0.5 size-4 shrink-0 text-ok" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" />}
                <span>
                  <Inline text={p.note} />
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Line({ label, src, scope, delay, strong }: { label: string; src: string; scope: string; delay: number; strong?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay }} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-2.5">
      <span className="w-full shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:w-36">{label}</span>
      <MathView src={src} size="md" scope={scope} className={strong ? "font-semibold" : undefined} />
    </motion.div>
  );
}
