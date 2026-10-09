"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { CvThumbnail } from "@/cv/CvDocument";
import { sampleCv } from "@/cv/samples";
import type { CvTemplateId } from "@/cv/types";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { useWidth } from "./useWidth";

const RATIO = 297 / 210;

/**
 * Three pages of the example CV fanned out like papers on a desk: left, front, right. The papers
 * spread a little when the pointer is over them; a design that moves to another place glides there.
 * Drawn in the browser only.
 */
export function SampleFan({
  lang,
  designs,
  maxPaper = 190,
  className,
}: {
  lang: Locale;
  /** Left, front, right. */
  designs: readonly [CvTemplateId, CvTemplateId, CvTemplateId];
  /** Width of one paper in px at most; smaller containers get smaller papers. */
  maxPaper?: number;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [spread, setSpread] = useState(false);
  const reduce = useReducedMotion();
  const [left, front, right] = designs;
  const samples = useMemo(() => [left, front, right].map((d) => ({ id: d, cv: sampleCv(lang, d) })), [lang, left, front, right]);
  const paper = Math.round(Math.min(maxPaper, width * 0.46));
  const height = Math.round(paper * RATIO);

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      // Until it is measured (and on the server), roughly the height it will have, so nothing jumps.
      style={{ height: height ? height + 28 : `min(64vw, ${Math.round(maxPaper * RATIO + 28)}px)` }}
      onPointerEnter={() => setSpread(true)}
      onPointerLeave={() => setSpread(false)}
      aria-hidden
    >
      {paper > 0 && (
        <AnimatePresence initial={!reduce}>
          {samples.map(({ id, cv }, i) => {
            const side = i - 1;
            return (
              <motion.div
                key={id}
                className="absolute left-1/2 top-3.5"
                style={{ marginLeft: -paper / 2, zIndex: side === 0 ? 2 : 1 }}
                initial={{ opacity: 0, y: 28, x: side * paper * 0.5, rotate: 0 }}
                animate={{ opacity: 1, x: side * paper * (spread ? 0.62 : 0.5), y: Math.abs(side) * 12, rotate: side * (spread ? 9 : 6) }}
                exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
              >
                <CvThumbnail
                  cv={cv}
                  width={paper}
                  className={cn(
                    "rounded-[3px] bg-white ring-1 ring-black/[0.04] transition-shadow duration-300",
                    side === 0 ? "shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_40px_-14px_rgb(0_0_0/0.35)]" : "shadow-[0_1px_3px_rgb(0_0_0/0.08),0_10px_24px_-12px_rgb(0_0_0/0.3)]",
                  )}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}
