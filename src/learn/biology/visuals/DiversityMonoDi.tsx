"use client";

// Monocots and dicots side by side for the "plant-diversity" topic: seedling, leaf veins, vascular
// bundles in the stem, flower parts and roots. A comparison widget and single-feature task pictures.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { petalPath } from "./DiversityShapes";
import { cos, sin } from "@/lib/stableMath";

export type MonoDiFeature = "seedling" | "veins" | "stem" | "flower" | "roots";
export type Group = "mono" | "di";

export const FEATURES: { id: MonoDiFeature; name: Text; mono: Text; di: Text }[] = [
  { id: "seedling", name: tx("Seed leaves", "Keimblätter"), mono: tx("one seed leaf (cotyledon)", "ein Keimblatt"), di: tx("two seed leaves", "zwei Keimblätter") },
  { id: "veins", name: tx("Leaf veins", "Blattnerven"), mono: tx("parallel veins, leaf often without a stalk", "parallelnervig, Blatt oft ohne Stiel"), di: tx("net veins, leaf with blade and stalk", "netznervig, Blatt mit Spreite und Stiel") },
  { id: "stem", name: tx("Vascular bundles in the stem", "Leitbündel im Stängel"), mono: tx("scattered; no secondary thickening", "zerstreut; kein sekundäres Dickenwachstum"), di: tx("in a ring; a cambium can make the stem thicker (wood)", "ringförmig; ein Kambium kann den Stängel verdicken (Holz)") },
  { id: "flower", name: tx("Flower parts", "Blütenteile"), mono: tx("in threes (often 3 + 3)", "dreizählig (oft 3 + 3)"), di: tx("mostly in fours or fives", "meist vier- oder fünfzählig") },
  { id: "roots", name: tx("Roots", "Wurzeln"), mono: tx("many roots of equal size (fibrous roots)", "viele gleich starke Wurzeln (Büschelwurzeln)"), di: tx("a main root with side roots (taproot)", "Hauptwurzel mit Seitenwurzeln (Pfahlwurzel)") },
];

const g = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 1.5, strokeLinejoin: "round" as const };
const root = { fill: "none", stroke: "var(--bio-wood-deep)", strokeWidth: 1.5, strokeLinecap: "round" as const };

function Drawing({ f, group }: { f: MonoDiFeature; group: Group }) {
  const mono = group === "mono";
  switch (f) {
    case "seedling":
      return mono ? (
        <>
          <path d="M0 70L120 70" stroke="var(--bio-soil)" strokeWidth={2} />
          <ellipse cx={60} cy={80} rx={14} ry={9} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
          <path d="M60 74C58 50 60 30 66 8C70 30 66 52 63 74Z" {...g} />
          <path d="M58 86l-6 8M62 88l2 8M66 86l6 7" {...root} />
        </>
      ) : (
        <>
          <path d="M0 70L120 70" stroke="var(--bio-soil)" strokeWidth={2} />
          <path d="M60 92L60 34" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} />
          <path d="M60 36C46 22 28 24 22 34C30 44 48 44 60 36Z" {...g} />
          <path d="M60 36C74 22 92 24 98 34C90 44 72 44 60 36Z" {...g} />
          <path d="M60 32C56 24 60 18 64 22C64 26 62 30 60 32Z" {...g} />
          <path d="M60 92l-6 6M60 96l5 4" {...root} />
        </>
      );
    case "veins":
      return mono ? (
        <>
          <path d="M60 96C48 70 50 30 60 4C70 30 72 70 60 96Z" {...g} />
          {[-6, -3, 0, 3, 6].map((d) => (
            <path key={d} d={`M${60 + d * 0.6} 92C${60 + d * 1.6} 66 ${60 + d * 1.6} 32 ${60 + d * 0.3} 10`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.9} />
          ))}
        </>
      ) : (
        <>
          <path d="M60 86C30 74 26 40 60 8C94 40 90 74 60 86Z" {...g} />
          <path d="M60 98L60 12" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
          {[24, 40, 56, 70].map((y) => (
            <path key={y} d={`M60 ${y + 8}L${42 - (y - 40) * 0.1} ${y}M60 ${y + 8}L${78 + (y - 40) * 0.1} ${y}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          ))}
          <path d="M44 44L48 52L42 58M76 44L72 52L78 58M46 64L52 70M74 64L68 70M50 30L54 36M70 30L66 36" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.7} />
        </>
      );
    case "stem": {
      const ring = Array.from({ length: 10 }, (_, i) => [60 + 30 * cos((i * Math.PI) / 5), 52 + 30 * sin((i * Math.PI) / 5)]);
      const scattered = [
        [44, 30],
        [66, 26],
        [80, 40],
        [52, 46],
        [70, 52],
        [38, 56],
        [84, 62],
        [58, 66],
        [46, 76],
        [72, 78],
        [60, 38],
        [30, 44],
        [88, 50],
        [60, 88],
        [36, 70],
      ];
      return (
        <>
          <circle cx={60} cy={56} r={44} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          {(mono ? scattered : ring).map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={4.6} ry={5.6} transform={mono ? undefined : `rotate(${i * 36 + 90} ${x} ${y})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
            </g>
          ))}
          {!mono && <circle cx={60} cy={52} r={30} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} strokeDasharray="2 3" />}
        </>
      );
    }
    case "flower":
      return mono ? (
        <>
          {[0, 120, 240].map((a) => (
            <path key={a} d={petalPath(60, 52, 42, 26, a)} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
          ))}
          {[60, 180, 300].map((a) => (
            <path key={a} d={petalPath(60, 52, 36, 22, a)} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
          ))}
          <circle cx={60} cy={52} r={6} fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
        </>
      ) : (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} d={petalPath(60, 52, 42, 30, a)} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
          ))}
          <circle cx={60} cy={52} r={7} fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
        </>
      );
    case "roots":
      return mono ? (
        <>
          <path d="M0 14L120 14" stroke="var(--bio-soil)" strokeWidth={2} />
          <path d="M60 0L60 16" stroke="var(--bio-leaf-deep)" strokeWidth={4} />
          {[-34, -22, -10, 0, 10, 22, 34].map((d) => (
            <path key={d} d={`M60 16C${60 + d * 0.5} 40 ${60 + d} 70 ${60 + d * 1.1} 96`} {...root} />
          ))}
        </>
      ) : (
        <>
          <path d="M0 14L120 14" stroke="var(--bio-soil)" strokeWidth={2} />
          <path d="M60 0L60 16" stroke="var(--bio-leaf-deep)" strokeWidth={4} />
          <path d="M60 16C61 44 58 70 60 100" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={4.5} strokeLinecap="round" />
          {[30, 46, 62, 78].map((y, i) => (
            <path key={y} d={`M60 ${y}C${48 - i} ${y + 4} ${40 - i * 2} ${y + 10} ${34 + i * 3} ${y + 16}M60 ${y + 6}C${72 + i} ${y + 10} ${80 + i * 2} ${y + 16} ${86 - i * 3} ${y + 22}`} {...root} />
          ))}
        </>
      );
  }
}

/** One feature drawn for one group. */
export function MonoDiDrawing({ f, group, className }: { f: MonoDiFeature; group: Group; className?: string }) {
  return (
    <svg viewBox="0 0 120 104" className={cn("block h-auto w-full", className)} aria-hidden>
      <Drawing f={f} group={group} />
    </svg>
  );
}

/** Naked or enclosed ovules: a cone scale and a pistil, side by side. */
function SeedCompare() {
  const t = useText();
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="space-y-1 text-center">
        <svg viewBox="0 0 120 96" className="mx-auto block h-auto w-full max-w-[150px]" role="img" aria-label={t(tx("Cone scale with two open ovules", "Samenschuppe mit zwei freien Samenanlagen"))}>
          <path d="M60 90L60 70" stroke="var(--bio-wood-deep)" strokeWidth={4} strokeLinecap="round" />
          <path d="M60 72C30 70 14 52 18 30C34 22 86 22 102 30C106 52 90 70 60 72Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.8} />
          {[44, 76].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={44} rx={9} ry={12} fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
              <ellipse cx={x} cy={46} rx={4} ry={6} fill="var(--bio-nucleus)" />
            </g>
          ))}
        </svg>
        <div className="text-[13px] font-semibold text-ink">{t(tx("Gymnosperms", "Nacktsamer"))}</div>
        <p className="text-[12.5px] leading-snug text-ink-2">{t(tx("ovules lie open on a scale: no ovary, no fruit", "Samenanlagen liegen frei auf einer Schuppe: kein Fruchtknoten, keine Frucht"))}</p>
      </div>
      <div className="space-y-1 text-center">
        <svg viewBox="0 0 120 96" className="mx-auto block h-auto w-full max-w-[150px]" role="img" aria-label={t(tx("Pistil with ovules inside the ovary", "Stempel mit Samenanlagen im Fruchtknoten"))}>
          <path d="M60 90L60 80" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
          <path d="M60 80C34 80 30 56 40 44C48 36 54 34 56 22L64 22C66 34 72 36 80 44C90 56 86 80 60 80Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          <path d="M56 22L56 10M64 22L64 10" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
          <ellipse cx={60} cy={9} rx={10} ry={4} fill="var(--bio-leaf-deep)" />
          <path d="M60 76L60 46" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
          {[52, 62, 72].map((y) => (
            <g key={y}>
              <ellipse cx={52} cy={y} rx={5} ry={4} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
              <ellipse cx={68} cy={y} rx={5} ry={4} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
            </g>
          ))}
        </svg>
        <div className="text-[13px] font-semibold text-ink">{t(tx("Angiosperms", "Bedecktsamer"))}</div>
        <p className="text-[12.5px] leading-snug text-ink-2">{t(tx("ovules enclosed in the ovary, which becomes the fruit", "Samenanlagen im Fruchtknoten eingeschlossen, aus ihm wird die Frucht"))}</p>
      </div>
    </div>
  );
}

/** Lesson widget: gymnosperms vs angiosperms, then monocots vs dicots feature by feature. */
export function DiversitySeedPlants() {
  return (
    <div className="space-y-4">
      <SeedCompare />
      <DiversityMonoDi />
    </div>
  );
}

/** Lesson widget: compare monocots and dicots feature by feature. */
export function DiversityMonoDi() {
  const t = useText();
  const [open, setOpen] = useState<MonoDiFeature>("seedling");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1 text-center text-[13px] font-semibold text-ink">
        <span>
          {t(tx("Monocots", "Einkeimblättrige"))}
          <span className="block text-[11.5px] font-normal text-ink-3">{t(tx("grasses, lilies, orchids", "Gräser, Lilien, Orchideen"))}</span>
        </span>
        <span>
          {t(tx("Dicots", "Zweikeimblättrige"))}
          <span className="block text-[11.5px] font-normal text-ink-3">{t(tx("roses, beans, oaks", "Rosen, Bohnen, Eichen"))}</span>
        </span>
      </div>
      {FEATURES.map((F) => {
        const on = open === F.id;
        return (
          <button key={F.id} type="button" onClick={() => setOpen(F.id)} className={cn("block w-full rounded-xl border px-3 py-2 text-left transition-colors", on ? "border-blob/50 bg-blob-soft/40" : "border-line bg-raised hover:bg-hover")}>
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(F.name)}</div>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 pt-1.5">
                    {(["mono", "di"] as const).map((gr) => (
                      <div key={gr} className="space-y-1">
                        <div className="mx-auto w-full max-w-[150px]">
                          <MonoDiDrawing f={F.id} group={gr} />
                        </div>
                        <p className="text-center text-[13px] leading-snug text-ink">{t(F[gr])}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

/** Task picture: one feature of one group. */
export function DiversityMonoDiPicture({ f, group }: { f: MonoDiFeature; group: Group }) {
  return (
    <div className="mx-auto w-full max-w-[200px]">
      <MonoDiDrawing f={f} group={group} />
    </div>
  );
}
