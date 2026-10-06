"use client";

// Dichotomous keys for the "plant-diversity" topic: one for native trees (level 1), one for plant
// families (level 2). The widget lets students identify a mystery plant step by step: at each
// couplet they choose a or b; a wrong turn ends at the wrong name, and they can step back.

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, RotateCcw, Shuffle, X } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { LeafShape, type TreeId } from "./DiversityLeaves";
import { ConiferTwig, type ConiferId } from "./DiversityNeedles";
import { DiversityFlower, FAMILY_NAMES, type FamilyId } from "./DiversityFlowers";

export type Lead = { text: Text; to: string };
export type Couplet = { a: Lead; b: Lead };
export type KeyDef = { couplets: Couplet[]; names: Record<string, Text> };

/** Leads point to a couplet number ("3") or a taxon ("=oak"). */
export const TREE_KEY: KeyDef = {
  couplets: [
    { a: { text: tx("Needle-shaped leaves (needles)", "Blätter nadelförmig (Nadeln)"), to: "2" }, b: { text: tx("Broad, flat leaves", "Blätter breit und flach (Laubblätter)"), to: "6" } },
    { a: { text: tx("Needles in pairs or in tufts", "Nadeln zu zweit oder in Büscheln"), to: "3" }, b: { text: tx("Needles single on the twig", "Nadeln einzeln am Zweig"), to: "4" } },
    { a: { text: tx("Long needles, always in pairs; hard woody cones", "Nadeln lang, immer zu zweit; harte, holzige Zapfen"), to: "=pine" }, b: { text: tx("Soft needles in tufts of many; yellow in autumn", "Nadeln weich, in Büscheln aus vielen Nadeln; im Herbst gelb"), to: "=larch" } },
    { a: { text: tx("Needles short, stiff and prickly, all round the twig; cones hang down", "Nadeln kurz, steif und stechend, rundum am Zweig; Zapfen hängen"), to: "=spruce" }, b: { text: tx("Needles flat and soft, in two rows", "Nadeln flach und weich, in zwei Reihen (gescheitelt)"), to: "5" } },
    { a: { text: tx("Two white stripes under the needles, tip notched; cones stand upright", "Nadeln unten mit zwei weißen Streifen, vorne eingekerbt; Zapfen stehen aufrecht"), to: "=fir" }, b: { text: tx("Needles pale green underneath without stripes, pointed; red seed cups instead of cones", "Nadeln unten hellgrün ohne Streifen, zugespitzt; rote Samenmäntel statt Zapfen"), to: "=yew" } },
    { a: { text: tx("Leaf compound (made of several leaflets)", "Blatt zusammengesetzt (aus mehreren Teilblättchen)"), to: "7" }, b: { text: tx("Leaf simple (one undivided blade)", "Blatt einfach (eine ungeteilte Spreite)"), to: "8" } },
    { a: { text: tx("Leaflets spread like fingers (palmate)", "Teilblättchen gefingert (wie die Finger einer Hand)"), to: "=chestnut" }, b: { text: tx("Leaflets in pairs along a central stalk (pinnate)", "Teilblättchen gefiedert (paarweise an einer Mittelachse)"), to: "=ash" } },
    { a: { text: tx("Leaf lobed", "Blatt gelappt"), to: "9" }, b: { text: tx("Leaf not lobed", "Blatt nicht gelappt"), to: "10" } },
    { a: { text: tx("Lobes round; leaf stalk very short", "Lappen rund; Blattstiel sehr kurz"), to: "=oak" }, b: { text: tx("Lobes pointed, spread like a hand; long leaf stalk", "Lappen spitz, handförmig angeordnet; Blattstiel lang"), to: "=maple" } },
    { a: { text: tx("Edge smooth (entire), slightly wavy", "Blattrand ganzrandig, leicht gewellt"), to: "=beech" }, b: { text: tx("Edge saw-toothed", "Blattrand gesägt"), to: "11" } },
    { a: { text: tx("Leaf heart-shaped, lopsided at the base", "Blatt herzförmig, am Grund schief"), to: "=lime" }, b: { text: tx("Leaf diamond-shaped to triangular, double saw-toothed", "Blatt rautenförmig bis dreieckig, doppelt gesägt"), to: "=birch" } },
  ],
  names: {
    oak: tx("oak", "Eiche"),
    beech: tx("beech", "Buche"),
    maple: tx("maple", "Ahorn"),
    lime: tx("lime", "Linde"),
    birch: tx("birch", "Birke"),
    chestnut: tx("horse chestnut", "Rosskastanie"),
    ash: tx("ash", "Esche"),
    spruce: tx("spruce", "Fichte"),
    fir: tx("fir", "Tanne"),
    pine: tx("pine", "Kiefer"),
    larch: tx("larch", "Lärche"),
    yew: tx("yew", "Eibe"),
  },
};

export const FAMILY_KEY: KeyDef = {
  couplets: [
    {
      a: { text: tx("Many tiny flowers packed into a head that looks like one flower", "Viele kleine Blüten dicht in einem Körbchen, das wie eine einzige Blüte aussieht"), to: "=asteraceae" },
      b: { text: tx("Single flowers (they may stand in clusters or ears)", "Einzelblüten (sie können in Trauben oder Ähren stehen)"), to: "2" },
    },
    {
      a: { text: tx("Flowers plain, without coloured petals, in spikelets; stem a hollow stalk with nodes", "Blüten unscheinbar, ohne bunte Kronblätter, in Ährchen; Stängel ein hohler Halm mit Knoten"), to: "=poaceae" },
      b: { text: tx("Flowers with showy, coloured petals", "Blüten mit auffälligen, bunten Kronblättern"), to: "3" },
    },
    {
      a: { text: tx("Flower radial (several planes of symmetry)", "Blüte radiärsymmetrisch (mehrere Symmetrieebenen)"), to: "4" },
      b: { text: tx("Flower zygomorphic (only one plane of symmetry)", "Blüte zygomorph (nur eine Symmetrieebene)"), to: "5" },
    },
    {
      a: { text: tx("4 petals in a cross, 6 stamens (4 long, 2 short); fruit a silique", "4 Kronblätter über Kreuz, 6 Staubblätter (4 lange, 2 kurze); Frucht eine Schote"), to: "=brassicaceae" },
      b: { text: tx("5 separate petals, many stamens", "5 freie Kronblätter, viele Staubblätter"), to: "=rosaceae" },
    },
    {
      a: { text: tx("Standard, two wings and a keel; fruit a legume", "Fahne, zwei Flügel und Schiffchen; Frucht eine Hülse"), to: "=fabaceae" },
      b: { text: tx("Upper and lower lip; square stem, opposite leaves", "Ober- und Unterlippe; Stängel vierkantig, Blätter gegenständig"), to: "=lamiaceae" },
    },
  ],
  names: FAMILY_NAMES,
};

export type KeyId = "trees" | "families";
export const KEYS: Record<KeyId, KeyDef> = { trees: TREE_KEY, families: FAMILY_KEY };

/** The way through a key to a taxon: [couplet number, "a" | "b"][]. */
export function keyPath(key: KeyDef, taxon: string): [number, "a" | "b"][] {
  const walk = (n: number): [number, "a" | "b"][] | null => {
    const c = key.couplets[n - 1];
    for (const side of ["a", "b"] as const) {
      const to = c[side].to;
      if (to === `=${taxon}`) return [[n, side]];
      if (!to.startsWith("=")) {
        const rest = walk(Number(to));
        if (rest) return [[n, side], ...rest];
      }
    }
    return null;
  };
  return walk(1) ?? [];
}

/** Where a path ends: a taxon id or null. */
export function keyEnd(key: KeyDef, path: [number, "a" | "b"][]): string | null {
  const last = path[path.length - 1];
  if (!last) return null;
  const to = key.couplets[last[0] - 1][last[1]].to;
  return to.startsWith("=") ? to.slice(1) : null;
}

const CONIFERS = ["spruce", "fir", "pine", "larch", "yew"];

/** The picture of a taxon from either key. */
export function Specimen({ id, className }: { id: string; className?: string }) {
  if (CONIFERS.includes(id)) return <ConiferTwig id={id as ConiferId} className={className} />;
  if (id in FAMILY_NAMES) return <DiversityFlower family={id as FamilyId} mode="plain" />;
  return <LeafShape id={id as TreeId} className={className} />;
}

const SPECIMENS: Record<KeyId, string[]> = {
  trees: ["lime", "spruce", "oak", "larch", "chestnut", "fir", "birch", "pine", "maple", "yew", "beech", "ash"],
  families: ["fabaceae", "brassicaceae", "asteraceae", "lamiaceae", "poaceae", "rosaceae"],
};

/** Lesson widget: identify a mystery plant with the key. */
export function DiversityKeyWalk({ which = "trees" }: { which?: KeyId }) {
  const t = useText();
  const key = KEYS[which];
  const list = SPECIMENS[which];
  const [si, setSi] = useState(0);
  const [path, setPath] = useState<[number, "a" | "b"][]>([]);
  const mystery = list[si % list.length];
  const end = keyEnd(key, path);
  const current = end ? null : path.length ? Number(key.couplets[path[path.length - 1][0] - 1][path[path.length - 1][1]].to) : 1;
  const right = end === mystery;
  const next = () => {
    setSi((i) => i + 1);
    setPath([]);
  };
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start">
      <div className="space-y-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Mystery plant", "Unbekannte Pflanze"))}</div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mystery} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="mx-auto w-full max-w-[300px] rounded-xl border border-line bg-surface p-2">
            <Specimen id={mystery} />
          </motion.div>
        </AnimatePresence>
        <button type="button" onClick={next} className="mx-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" />
          {t(tx("Another plant", "Andere Pflanze"))}
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex min-h-[30px] flex-wrap items-center gap-1.5 text-[13px]">
          {path.length === 0 && <span className="text-ink-3">{t(tx("Start at couplet 1: which description fits?", "Beginne bei Schritt 1: Welche Beschreibung passt?"))}</span>}
          {path.map(([n, side], i) => (
            <button key={i} type="button" onClick={() => setPath(path.slice(0, i))} className="rounded-full bg-hover px-2 py-0.5 font-math font-semibold text-ink hover:bg-blob-soft" title={t(tx("Go back to here", "Hierher zurück"))}>
              {n}
              {side}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {current !== null ? (
            <motion.div key={`c${current}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14, transition: { duration: 0.1 } }} className="space-y-2">
              {(["a", "b"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setPath([...path, [current, side]])}
                  className="flex w-full items-start gap-3 rounded-xl border border-line bg-raised px-3.5 py-3 text-left text-[14.5px] leading-snug text-ink transition-colors hover:border-blob/60 hover:bg-blob-soft/40"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-blob-soft px-1.5 font-math text-[13px] font-bold text-blob-ink">
                    {current}
                    {side}
                  </span>
                  <span className="min-w-0 flex-1">{t(key.couplets[current - 1][side].text)}</span>
                  <span className="shrink-0 text-[12.5px] text-ink-3">{key.couplets[current - 1][side].to.startsWith("=") ? "→ ?" : `→ ${key.couplets[current - 1][side].to}`}</span>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div key={`end-${end}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("space-y-3 rounded-xl border px-4 py-3", right ? "border-ok/40 bg-ok/5" : "border-danger/30 bg-danger/5")}>
              <div className="flex items-center gap-2">
                {right ? <Check className="size-5 text-ok" /> : <X className="size-5 text-danger" />}
                <span className="font-display text-[20px] font-semibold text-ink">{t(key.names[end!])}</span>
              </div>
              {right ? (
                <p className="text-[14px] leading-snug text-ink-2">{t(tx("Identified! Every step matched the plant.", "Bestimmt! Jeder Schritt hat zur Pflanze gepasst."))}</p>
              ) : (
                <>
                  <p className="text-[14px] leading-snug text-ink-2">{t(tx("This doesn't match the mystery plant. Compare it with the picture, then tap a step above to go back and check that feature again.", "Das passt nicht zur unbekannten Pflanze. Vergleich mit dem Bild und tipp oben auf einen Schritt, um dort das Merkmal noch mal zu prüfen."))}</p>
                  <div className="mx-auto w-full max-w-[160px] opacity-90">
                    <Specimen id={end!} />
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {!right && (
                  <button type="button" onClick={() => setPath(path.slice(0, -1))} className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-hover">
                    <ArrowLeft className="size-3.5" />
                    {t(tx("One step back", "Einen Schritt zurück"))}
                  </button>
                )}
                {right && (
                  <button type="button" onClick={next} className="flex items-center gap-1.5 rounded-lg bg-blob px-3 py-1.5 text-[13px] font-semibold text-white">
                    <RotateCcw className="size-3.5" />
                    {t(tx("Next plant", "Nächste Pflanze"))}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Lesson widget wrappers (a widget step takes a component without props). */
export const DiversityTreeKey = () => <DiversityKeyWalk which="trees" />;
export const DiversityFamilyKey = () => <DiversityKeyWalk which="families" />;

/** Task picture: the key as a table (only the couplets listed), optionally with a specimen. */
export function DiversityKeyTable({ which = "trees", couplets, specimen }: { which?: KeyId; couplets?: number[]; specimen?: string }) {
  const t = useText();
  const key = KEYS[which];
  const show = couplets ?? key.couplets.map((_, i) => i + 1);
  return (
    <div className={cn("grid gap-3", specimen && "sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-center")}>
      {specimen && (
        <div className="mx-auto w-full max-w-[200px]">
          <Specimen id={specimen} />
        </div>
      )}
      <table className="w-full border-collapse text-[13.5px] leading-snug">
        <tbody>
          {show.map((n) =>
            (["a", "b"] as const).map((side) => {
              const lead = key.couplets[n - 1][side];
              return (
                <tr key={`${n}${side}`} className={cn(side === "b" && "border-b border-line")}>
                  <td className="py-1 pr-2 align-top font-math font-semibold text-blob-ink">
                    {n}
                    {side}
                  </td>
                  <td className="py-1 pr-2 align-top text-ink">{t(lead.text)}</td>
                  <td className="whitespace-nowrap py-1 align-top text-right font-semibold text-ink-2">{lead.to.startsWith("=") ? t(key.names[lead.to.slice(1)]) : `→ ${lead.to}`}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
