"use client";

// Alternation of generations for the "plant-diversity" topic: the life cycles of a moss and a fern
// as a ring of stages. The haploid phase (n, gametophyte) and the diploid phase (2n, sporophyte)
// are coloured bands; meiosis and fertilisation mark where they meet. The dominant generation is
// drawn larger. As a task picture the colours and names hide and one stage carries a "?".

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type CyclePlant = "moss" | "fern";
export type Stage = { id: string; name: Text; ploidy: "n" | "2n"; at: number; info: Text; big?: boolean };

export const CYCLES: Record<CyclePlant, { stages: Stage[]; meiosis: number; fertilisation: number }> = {
  moss: {
    meiosis: -100,
    fertilisation: 92,
    stages: [
      { id: "spore", name: tx("spores", "Sporen"), ploidy: "n", at: -62, info: tx("Formed by meiosis in the capsule, spread by the wind.", "Entsteht durch Meiose in der Kapsel und wird vom Wind verbreitet.") },
      { id: "protonema", name: tx("protonema (green thread)", "Vorkeim (Protonema)"), ploidy: "n", at: -20, info: tx("A branched green thread grows from the spore; buds on it become moss plants.", "Aus der Spore wächst ein verzweigter grüner Faden; aus seinen Knospen werden Moospflänzchen.") },
      { id: "gametophyte", name: tx("moss plant = gametophyte", "Moospflänzchen = Gametophyt"), ploidy: "n", at: 26, big: true, info: tx("The green moss plant you know is haploid. It forms the sex organs: antheridia (male) and archegonia (female).", "Die grüne Moospflanze, die du kennst, ist haploid. Sie bildet die Geschlechtsorgane: Antheridien (männlich) und Archegonien (weiblich).") },
      { id: "gametes", name: tx("egg cell and swimming sperm", "Eizelle und Spermatozoid"), ploidy: "n", at: 62, info: tx("The gametes form by mitosis. Sperm cells swim through a film of water to the egg: no water, no fertilisation.", "Die Keimzellen entstehen durch Mitose. Die Spermatozoiden schwimmen durch einen Wasserfilm zur Eizelle: ohne Wasser keine Befruchtung.") },
      { id: "zygote", name: tx("zygote (fertilised egg)", "Zygote (befruchtete Eizelle)"), ploidy: "2n", at: 124, info: tx("Fertilisation gives a diploid zygote inside the archegonium.", "Die Befruchtung ergibt eine diploide Zygote im Archegonium.") },
      { id: "sporophyte", name: tx("sporophyte (stalk and capsule)", "Sporophyt (Stiel und Kapsel)"), ploidy: "2n", at: 172, info: tx("Grows on the moss plant and is fed by it: the sporophyte is small and dependent.", "Wächst auf dem Moospflänzchen und wird von ihm ernährt: Der Sporophyt ist klein und abhängig.") },
      { id: "capsule", name: tx("spore capsule", "Sporenkapsel"), ploidy: "2n", at: 222, info: tx("Inside, spore mother cells divide by meiosis: haploid spores are released.", "Darin teilen sich Sporenmutterzellen durch Meiose: Haploide Sporen werden frei."),
      },
    ],
  },
  fern: {
    meiosis: -82,
    fertilisation: 86,
    stages: [
      { id: "spore", name: tx("spores", "Sporen"), ploidy: "n", at: -56, info: tx("Formed by meiosis in the sporangia, spread by the wind.", "Entsteht durch Meiose in den Sporangien und wird vom Wind verbreitet.") },
      { id: "prothallium", name: tx("prothallium = gametophyte", "Vorkeim (Prothallium) = Gametophyt"), ploidy: "n", at: -6, info: tx("A tiny green heart, under 1 cm, living on its own on moist soil. It is haploid.", "Ein winziges grünes Herz, unter 1 cm groß, das selbstständig auf feuchtem Boden lebt. Es ist haploid.") },
      { id: "gametes", name: tx("egg cell and swimming sperm", "Eizelle und Spermatozoid"), ploidy: "n", at: 46, info: tx("On the underside of the prothallium. Sperm cells swim through water to the egg cell.", "An der Unterseite des Vorkeims. Spermatozoiden schwimmen durch Wasser zur Eizelle.") },
      { id: "zygote", name: tx("zygote (fertilised egg)", "Zygote (befruchtete Eizelle)"), ploidy: "2n", at: 122, info: tx("Fertilisation gives a diploid zygote in the archegonium.", "Die Befruchtung ergibt eine diploide Zygote im Archegonium.") },
      { id: "young", name: tx("young fern", "junger Farn"), ploidy: "2n", at: 164, info: tx("The young sporophyte grows out of the prothallium, roots in the soil and soon lives on its own. The prothallium dies.", "Der junge Sporophyt wächst aus dem Vorkeim, wurzelt im Boden und lebt bald selbstständig. Der Vorkeim stirbt ab.") },
      { id: "fern", name: tx("fern plant = sporophyte", "Farnpflanze = Sporophyt"), ploidy: "2n", at: 210, big: true, info: tx("The fern with fronds, rhizome and roots is diploid: the sporophyte is the dominant generation.", "Der Farn mit Wedeln, Rhizom und Wurzeln ist diploid: Der Sporophyt ist die vorherrschende Generation.") },
      { id: "sori", name: tx("sori with sporangia", "Sporangienhäufchen (Sori)"), ploidy: "2n", at: 252, info: tx("Brown dots under the fronds. In the sporangia, meiosis makes haploid spores.", "Braune Häufchen unter den Wedeln. In den Sporangien entstehen durch Meiose haploide Sporen.") },
    ],
  },
};

const CX = 260;
const CY = 226;
const R = 158;
const pos = (deg: number, r = R): [number, number] => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)];
function arc(from: number, to: number, r = R) {
  const [x1, y1] = pos(from, r);
  const [x2, y2] = pos(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const greenS = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 1.4, strokeLinejoin: "round" as const };
const brownS = { fill: "none", stroke: "var(--bio-wood-deep)", strokeWidth: 1.2, strokeLinecap: "round" as const };

/** Little drawings of each stage, in a box of about −34…34. */
function Icon({ plant, id }: { plant: CyclePlant; id: string }) {
  switch (id) {
    case "spore":
      return (
        <g>
          {[
            [-10, -4],
            [8, -10],
            [4, 10],
            [-12, 14],
            [18, 6],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5.5} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
          ))}
        </g>
      );
    case "protonema":
      return (
        <g fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round">
          <circle cx={-24} cy={16} r={4.5} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
          <path d="M-20 14L-4 6L14 8L28 -2M-4 6L0 -12L-6 -24M14 8L20 22" />
          <path d="M-2 4l2 4M10 6l2 4" stroke="var(--bio-leaf)" strokeWidth={1} />
          <path d="M0 -14C-4 -20 4 -22 4 -16Z" fill="var(--bio-leaf)" strokeWidth={1.4} />
        </g>
      );
    case "gametophyte":
      // a small cushion of leafy moss shoots with rhizoids; tiny leaves all round the stems
      return (
        <g>
          {[
            [-14, 4, -8],
            [0, -4, 0],
            [14, 6, 8],
          ].map(([x, top, tilt]) => (
            <g key={x} transform={`translate(${x} 0) rotate(${tilt} 0 26)`}>
              <path d={`M0 26L0 ${top - 22}`} stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
              {Array.from({ length: 9 }, (_, i) => {
                const y = 22 - i * 5.4 + top * 0.3;
                const s2 = i % 2 ? 1 : -1;
                return <path key={i} d={`M0 ${y}l${s2 * 6} ${-5}`} stroke="var(--bio-leaf-deep)" strokeWidth={2.6} strokeLinecap="round" />;
              })}
              {Array.from({ length: 9 }, (_, i) => {
                const y = 22 - i * 5.4 + top * 0.3;
                const s2 = i % 2 ? 1 : -1;
                return <path key={`l${i}`} d={`M0 ${y}l${s2 * 6} ${-5}`} stroke="var(--bio-leaf)" strokeWidth={1.2} strokeLinecap="round" />;
              })}
            </g>
          ))}
          <path d="M-14 26l-4 8M-12 26l2 9M0 26l-2 9M2 26l4 8M14 26l2 9M16 26l6 7" {...brownS} />
        </g>
      );
    case "prothallium":
      return (
        <g>
          <path d="M0 18C-22 6 -30 -12 -20 -22C-12 -28 -4 -22 0 -14C4 -22 12 -28 20 -22C30 -12 22 6 0 18Z" transform="rotate(180)" {...greenS} />
          <path d="M-6 -16l-4 -10M0 -18l0 -12M6 -16l4 -10" {...brownS} />
        </g>
      );
    case "gametes":
      return (
        <g>
          {/* archegonium with the egg cell */}
          <path d="M-22 20C-30 20 -30 4 -22 0L-20 -20L-14 -20L-12 0C-4 4 -4 20 -12 20Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <circle cx={-17} cy={10} r={5.5} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
          {/* water drop with a swimming sperm cell */}
          <path d="M14 -22C22 -10 28 0 28 8C28 18 20 24 12 24C4 24 -2 18 -2 8C-2 0 6 -10 14 -22Z" fill="var(--bio-water)" opacity={0.35} stroke="var(--bio-water-deep)" strokeWidth={1} />
          <path d="M10 8C12 4 16 4 18 8C16 12 12 12 10 8Z" fill="var(--bio-nucleus-deep)" />
          <path d="M18 8C22 4 24 10 28 4M17 9C21 12 22 6 26 14" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
          <path d="M4 10L-6 12" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} strokeDasharray="2 2" />
        </g>
      );
    case "zygote":
      return (
        <g>
          <path d="M-12 26C-24 26 -24 2 -12 -4L-8 -28L8 -28L12 -4C24 2 24 26 12 26Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <circle cx={0} cy={12} r={10} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
          <circle cx={0} cy={12} r={3.5} fill="var(--bio-mito-deep)" />
        </g>
      );
    case "sporophyte":
      return (
        <g transform="translate(0 6)">
          <path d="M0 28L0 4" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
          {[22, 14, 6].map((y) => (
            <path key={y} d={`M0 ${y}C-6 ${y - 2} -10 ${y - 6} -11 ${y - 10}M0 ${y}C6 ${y - 2} 10 ${y - 6} 11 ${y - 10}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
          ))}
          <path d="M0 4C1 -10 4 -22 6 -30" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.8} />
          <ellipse cx={8} cy={-36} rx={6} ry={9} transform="rotate(20 8 -36)" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
        </g>
      );
    case "capsule":
      return (
        <g>
          <path d="M-8 30C-4 14 -2 4 0 -6" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.8} />
          <path d="M-8 -6C-10 -18 -4 -28 4 -28C12 -28 14 -18 10 -6Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} transform="rotate(14 0 -6)" />
          {[
            [16, -30],
            [24, -20],
            [20, -38],
            [28, -32],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.6} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
          ))}
        </g>
      );
    case "young":
      return (
        <g>
          <path d="M0 22C-20 14 -26 0 -18 -8C-12 -12 -4 -8 0 -2C4 -8 12 -12 18 -8C26 0 20 14 0 22Z" {...greenS} opacity={0.75} />
          <path d="M2 12C2 0 4 -14 10 -26" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
          <path d="M10 -26C16 -30 22 -24 18 -18C14 -14 10 -20 12 -22" {...greenS} />
          <path d="M2 12L-2 30M2 14L8 30" {...brownS} />
        </g>
      );
    case "fern":
      return (
        <g transform="translate(0 4)">
          {[-1, 0, 1].map((s) => (
            <g key={s} transform={`rotate(${s * 30} 0 22)`}>
              <path d="M0 22L0 -30" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
              {[-24, -16, -8, 0, 8].map((y, i) => (
                <g key={y}>
                  <path d={`M0 ${y}l${-10 + i} ${-4}`} stroke="var(--bio-leaf-deep)" strokeWidth={4.5} strokeLinecap="round" />
                  <path d={`M0 ${y}l${10 - i} ${-4}`} stroke="var(--bio-leaf-deep)" strokeWidth={4.5} strokeLinecap="round" />
                  <path d={`M0 ${y}l${-10 + i} ${-4}`} stroke="var(--bio-leaf)" strokeWidth={2.6} strokeLinecap="round" />
                  <path d={`M0 ${y}l${10 - i} ${-4}`} stroke="var(--bio-leaf)" strokeWidth={2.6} strokeLinecap="round" />
                </g>
              ))}
            </g>
          ))}
          <path d="M-14 24L14 24" stroke="var(--bio-wood-deep)" strokeWidth={5} strokeLinecap="round" />
          <path d="M-10 26l-4 8M0 26l0 9M10 26l4 8" {...brownS} />
        </g>
      );
    case "sori":
      return (
        <g>
          <path d="M-28 6C-14 -14 14 -14 28 6C14 18 -14 18 -28 6Z" {...greenS} />
          <path d="M-26 6L26 6" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          {[-16, -4, 8, 18].map((x) => (
            <g key={x}>
              <circle cx={x} cy={0} r={3.6} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
              <circle cx={x} cy={12} r={3.6} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
            </g>
          ))}
          {plant === "fern" && <path d="M18 -6l6 -10M22 -4l10 -6" stroke="var(--bio-wood-deep)" strokeWidth={1} strokeDasharray="1.5 2" />}
        </g>
      );
  }
  return null;
}

/** The life-cycle ring. quiz: no colours or names, one stage asked. */
export function LifeCycleRing({ plant, selected, onSelect, quiz = false, ask }: { plant: CyclePlant; selected?: string | null; onSelect?: (id: string) => void; quiz?: boolean; ask?: string }) {
  const t = useText();
  const c = CYCLES[plant];
  const fz = (s: number) => ({ fontSize: s, fontFamily: "var(--font-sans)" });
  const hapFrom = c.meiosis;
  const hapTo = c.fertilisation;
  return (
    <svg viewBox="0 0 520 452" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(plant === "moss" ? tx("Life cycle of a moss", "Entwicklungszyklus eines Mooses") : tx("Life cycle of a fern", "Entwicklungszyklus eines Farns"))}>
      <defs>
        <marker id={`lc-arrow-${plant}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10Z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {/* phase bands */}
      <path d={arc(hapFrom, hapTo)} fill="none" stroke={quiz ? "var(--line-2)" : "var(--bio-nucleus)"} strokeWidth={22} opacity={quiz ? 0.6 : 0.55} />
      <path d={arc(hapTo, hapFrom + 360)} fill="none" stroke={quiz ? "var(--line-2)" : "var(--bio-mito)"} strokeWidth={22} opacity={quiz ? 0.6 : 0.55} />
      {/* arrows between stages */}
      {c.stages.map((s, i) => {
        const nxt = c.stages[(i + 1) % c.stages.length];
        const to = nxt.at > s.at ? nxt.at : nxt.at + 360;
        return <path key={s.id} d={arc(s.at + 17, to - 17, R)} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} markerEnd={`url(#lc-arrow-${plant})`} />;
      })}
      {!quiz && (
        <>
          <text x={CX} y={CY - 18} textAnchor="middle" fill="var(--bio-nucleus-deep)" fontWeight={700} style={fz(15)}>
            {t(tx("n: gametophyte", "n: Gametophyt"))}
          </text>
          <text x={CX} y={CY + 30} textAnchor="middle" fill="var(--bio-mito-deep)" fontWeight={700} style={fz(15)}>
            {t(tx("2n: sporophyte", "2n: Sporophyt"))}
          </text>
          <text x={CX} y={CY + 6} textAnchor="middle" fill="var(--ink-3)" style={fz(12)}>
            {t(plant === "moss" ? tx("dominant: gametophyte", "vorherrschend: Gametophyt") : tx("dominant: sporophyte", "vorherrschend: Sporophyt"))}
          </text>
        </>
      )}
      {/* meiosis and fertilisation */}
      {[
        [c.meiosis, tx("meiosis", "Meiose")],
        [c.fertilisation, tx("fertilisation", "Befruchtung")],
      ].map(([deg, label]) => {
        const d = deg as number;
        const [x, y] = pos(d, R);
        const right = Math.sin((d * Math.PI) / 180) > 0;
        return (
          <g key={String(deg)}>
            <rect x={x - 5} y={y - 14} width={10} height={28} rx={3} fill="var(--ink)" transform={`rotate(${d} ${x} ${y})`} />
            <text x={right ? x + 22 : x - 22} y={y + 5} textAnchor={right ? "start" : "end"} fill="var(--ink)" fontWeight={700} style={fz(13)}>
              {t(label as Text)}
            </text>
          </g>
        );
      })}
      {c.stages.map((s, i) => {
        const [x, y] = pos(s.at);
        const on = selected === s.id;
        const isAsk = ask === s.id;
        const k = s.big ? 1.32 : 1;
        return (
          <g key={s.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} onClick={onSelect ? () => onSelect(s.id) : undefined} className={cn(onSelect && "cursor-pointer")}>
            <circle r={36 * k} fill="var(--raised)" stroke={on || isAsk ? "var(--blob)" : "var(--line-2)"} strokeWidth={on || isAsk ? 3 : 1.5} />
            <g transform={`scale(${k})`}>
              <Icon plant={plant} id={s.id} />
            </g>
            {quiz && (
              <g transform={`translate(${26 * k} ${-26 * k})`}>
                <circle r={11} fill={isAsk ? "var(--blob)" : "var(--raised)"} stroke={isAsk ? "var(--blob)" : "var(--ink)"} strokeWidth={1.4} />
                <text textAnchor="middle" dominantBaseline="central" fill={isAsk ? "#fff" : "var(--ink)"} fontWeight={700} style={fz(12)}>
                  {isAsk ? "?" : i + 1}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Lesson widget: step through the moss and the fern life cycle. */
export function DiversityLifeCycle() {
  const t = useText();
  const scope = useId();
  const [plant, setPlant] = useState<CyclePlant>("moss");
  const [i, setI] = useState(0);
  const stages = CYCLES[plant].stages;
  const s = stages[i % stages.length];
  const go = (d: number) => setI((v) => (v + d + stages.length) % stages.length);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {(["moss", "fern"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlant(p);
                setI(0);
              }}
              className={cn("relative rounded-md px-3 py-1.5 text-[13.5px] font-medium", plant === p ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {plant === p && <motion.span layoutId={`${scope}-p`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(p === "moss" ? tx("Moss", "Moos") : tx("Fern", "Farn"))}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} className="grid size-9 place-items-center rounded-lg border border-line bg-raised text-ink hover:bg-hover" aria-label={t(tx("Previous stage", "Vorheriges Stadium"))}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => go(1)} className="grid size-9 place-items-center rounded-lg border border-line bg-raised text-ink hover:bg-hover" aria-label={t(tx("Next stage", "Nächstes Stadium"))}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <LifeCycleRing plant={plant} selected={s.id} onSelect={(id) => setI(stages.findIndex((x) => x.id === id))} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${plant}-${s.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{t(s.name)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", s.ploidy === "n" ? "bg-[var(--bio-nucleus)] text-ink" : "bg-[var(--bio-mito)] text-ink")}>{s.ploidy === "n" ? "haploid (n)" : "diploid (2n)"}</span>
          </div>
          <p className="text-[14px] leading-snug text-ink-2">{t(s.info)}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Task picture: the ring without colours or names, one stage asked. */
export function DiversityCyclePicture({ plant, ask }: { plant: CyclePlant; ask?: string }) {
  return <LifeCycleRing plant={plant} quiz ask={ask} />;
}
