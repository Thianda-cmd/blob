"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { INDICATORS, NATURE, PH_EXAMPLES, natureOf, shade, type IndicatorId } from "../acids-bases-data";
import { dec } from "../format";

// The pH slider: a test tube with an indicator changes colour as the pH changes, and the
// oxonium ion concentration is shown as a power of ten.

/** Liquid colour for an indicator shade; colourless liquids are a faint tint of ink. */
export const liquid = (hex: string | null) => (hex ? `color-mix(in oklab, ${hex} 90%, var(--raised))` : "color-mix(in oklab, var(--ink) 7%, var(--raised))");

/** A test tube filled with a coloured (or colourless) solution. */
export function IndicatorTube({ hex, caption, size = 1, className }: { hex: string | null; caption?: Text; size?: number; className?: string }) {
  const t = useText();
  const clip = useId();
  const W = 74;
  const H = 210;
  const tube = `M14 10 L14 ${H - 37} A23 23 0 0 0 60 ${H - 37} L60 10`;
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} role="img" aria-label={caption ? t(caption) : t(tx("Test tube", "Reagenzglas"))}>
        <defs>
          <clipPath id={clip}>
            <path d={`${tube} Z`} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x={0} y={62} width={W} height={H} style={{ fill: liquid(hex), transition: "fill 0.55s ease" }} />
          <rect x={0} y={62} width={W} height={5} style={{ fill: "color-mix(in oklab, var(--raised) 35%, transparent)" }} />
          <rect x={21} y={74} width={6} height={H - 120} rx={3} style={{ fill: "color-mix(in oklab, white 30%, transparent)" }} />
        </g>
        <path d={tube} fill="none" stroke="var(--ink-3)" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M8 10 L66 10" stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" />
      </svg>
      {caption && <span className="text-center text-[13px] font-medium text-ink-2">{t(caption)}</span>}
    </div>
  );
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** "10⁻⁷" as text, for aria labels. */
const power = (k: number) => `10${k < 0 ? "⁻" : ""}${String(Math.abs(k)).replace(/\d/g, (d) => SUP[Number(d)])}`;

export function AcidsBasesPh() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [ph, setPh] = useState(7);
  const [ind, setInd] = useState<IndicatorId>("universal");
  const now = shade(ind, ph);
  const nature = natureOf(ph);
  const example = PH_EXAMPLES[ph];
  const k = Math.abs(7 - ph);
  const factor = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB").format(10 ** k);

  const conc: Text = txMap((_, l) => {
    const unit = l === "de" ? '"mol/l"' : '"mol/L"';
    const decimal = ph >= 1 && ph <= 3 ? ` = ${dec(10 ** -ph, l, 3)} ${unit}` : "";
    return `c(\\ce{H3O+}) = 10^{${ph === 0 ? "0" : `-${ph}`}} ${unit}${decimal}`;
  });

  const compare: Text =
    ph === 7
      ? tx("Pure water: just as many $\\ce{H3O+}$ as $\\ce{OH-}$ ions.", "Wie reines Wasser: genauso viele $\\ce{H3O+}$- wie $\\ce{OH-}$-Ionen.")
      : ph < 7
        ? tx(`**${factor} times** as many $\\ce{H3O+}$ ions as in pure water.`, `**${factor}-mal** so viele $\\ce{H3O+}$-Ionen wie in reinem Wasser.`)
        : tx(`**${factor} times** fewer $\\ce{H3O+}$ ions than in pure water, but more $\\ce{OH-}$ ions.`, `**${factor}-mal** weniger $\\ce{H3O+}$-Ionen als in reinem Wasser, dafür mehr $\\ce{OH-}$-Ionen.`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Indicator", "Indikator"))}>
        {INDICATORS.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            aria-selected={ind === i.id}
            onClick={() => setInd(i.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", ind === i.id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {ind === i.id && <motion.span layoutId={`${scope}-ind`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(i.short)}</span>
          </button>
        ))}
      </div>

      <div className="grid items-center gap-5 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div className="flex justify-center">
          <IndicatorTube hex={now.hex} caption={txMap((_, l) => `${l === "de" ? "Farbe" : "Colour"}: ${resolveText(now.name, l)}`)} />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-[34px] font-bold tabular-nums leading-none">
              pH{" "}
              <motion.span key={ph} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block">
                {ph}
              </motion.span>
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={nature}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn("rounded-full px-2.5 py-1 text-[13px] font-semibold", nature === "neutral" ? "bg-hover text-ink-2" : "bg-blob-soft text-blob-ink")}
              >
                {t(NATURE[nature])}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={14}
              step={1}
              value={ph}
              onChange={(e) => setPh(Number(e.target.value))}
              aria-label={t(tx("pH value", "pH-Wert"))}
              aria-valuetext={`pH ${ph}`}
              className="w-full accent-blob"
            />
            <div className="flex gap-[2px] overflow-hidden rounded-md">
              {Array.from({ length: 15 }, (_, i) => {
                const c = shade(ind, i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPh(i)}
                    aria-label={`pH ${i}`}
                    className={cn("h-6 flex-1 text-[10.5px] font-semibold tabular-nums transition-[outline] sm:text-[11px]", i === ph ? "outline-2 -outline-offset-2 outline-ink" : "")}
                    style={{ background: liquid(c.hex), color: c.hex ? "white" : "var(--ink-3)" }}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[12px] text-ink-3">
              <span>{t(tx("← more acidic", "← saurer"))}</span>
              <span>{t(tx("neutral", "neutral"))}</span>
              <span>{t(tx("more alkaline →", "alkalischer →"))}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="overflow-x-auto" aria-label={`c(H₃O⁺) = ${power(-ph)} mol/L`}>
              <MathView src={conc} size="md" scope={`${scope}-c`} />
            </div>
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              <Inline text={compare} />
            </p>
          </div>

          <p className="text-[13.5px] text-ink-2">
            {t(tx("For example:", "Zum Beispiel:"))} <span className="font-medium text-ink">{t(example.name)}</span>{" "}
            <span className="text-ink-3">(pH {t(example.label)})</span>
          </p>
        </div>
      </div>
    </div>
  );
}
