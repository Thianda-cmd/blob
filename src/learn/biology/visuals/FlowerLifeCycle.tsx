"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

// Alternation of generations: diploid sporophyte → (meiosis) → haploid spores → gametophyte →
// (mitosis) → gametes → (fertilisation) → zygote → sporophyte. Compare moss, fern and seed plant:
// which generation dominates, and how small the gametophyte becomes.

type Group = "moss" | "fern" | "seed";
type NodeId = "sporophyte" | "spores" | "gametophyte" | "gametes" | "zygote";

const NODES: { id: NodeId; name: Text; ploidy: string; angle: number }[] = [
  { id: "sporophyte", name: tx("sporophyte", "Sporophyt"), ploidy: "2n", angle: -90 },
  { id: "spores", name: tx("spores", "Sporen"), ploidy: "n", angle: -18 },
  { id: "gametophyte", name: tx("gametophyte", "Gametophyt"), ploidy: "n", angle: 54 },
  { id: "gametes", name: tx("gametes", "Gameten"), ploidy: "n", angle: 126 },
  { id: "zygote", name: tx("zygote", "Zygote"), ploidy: "2n", angle: 198 },
];
const STEPS: Text[] = [tx("meiosis", "Meiose"), tx("mitoses", "Mitosen"), tx("mitosis", "Mitose"), tx("fertilisation", "Befruchtung"), tx("mitoses", "Mitosen")];

const GROUPS: Record<Group, { name: Text; size: Record<NodeId, number>; text: Record<NodeId, Text>; sum: Text }> = {
  moss: {
    name: tx("Moss", "Moos"),
    size: { sporophyte: 24, spores: 18, gametophyte: 40, gametes: 18, zygote: 18 },
    text: {
      sporophyte: tx("A spore capsule on a stalk. It grows on the moss plant and is fed by it.", "Eine Sporenkapsel auf einem Stiel. Sie wächst auf dem Moospflänzchen und wird von ihm ernährt."),
      spores: tx("Haploid spores, made by meiosis in the capsule and spread by the wind.", "Haploide Sporen, durch Meiose in der Kapsel gebildet und vom Wind verbreitet."),
      gametophyte: tx("The green moss plant you know: the dominant, long-lived generation.", "Das grüne Moospflänzchen, das du kennst: die dominante, langlebige Generation."),
      gametes: tx("Egg cell and swimming sperm (with flagella): they need water to meet.", "Eizelle und begeißelte Spermatozoiden: Sie brauchen Wasser, um zueinander zu kommen."),
      zygote: tx("Forms on the moss plant and grows into the spore capsule.", "Entsteht auf dem Moospflänzchen und wächst zur Sporenkapsel heran."),
    },
    sum: tx("Moss: the **gametophyte** dominates; the sporophyte lives on it.", "Moos: Der **Gametophyt** dominiert, der Sporophyt lebt auf ihm."),
  },
  fern: {
    name: tx("Fern", "Farn"),
    size: { sporophyte: 40, spores: 18, gametophyte: 24, gametes: 18, zygote: 18 },
    text: {
      sporophyte: tx("The fern plant with its fronds: the dominant generation.", "Die Farnpflanze mit ihren Wedeln: die dominante Generation."),
      spores: tx("Haploid spores from the sporangia under the fronds.", "Haploide Sporen aus den Sporangien unter den Wedeln."),
      gametophyte: tx("A small, independent green heart-shaped prothallus, a few millimetres big.", "Ein kleiner, eigenständiger grüner Vorkeim (Prothallium), herzförmig und wenige Millimeter groß."),
      gametes: tx("Egg cell and swimming sperm: fertilisation still needs water.", "Eizelle und begeißelte Spermatozoiden: Die Befruchtung braucht noch Wasser."),
      zygote: tx("Grows on the prothallus into a new fern plant.", "Wächst auf dem Vorkeim zu einer neuen Farnpflanze heran."),
    },
    sum: tx("Fern: the **sporophyte** dominates; the gametophyte is small but independent.", "Farn: Der **Sporophyt** dominiert, der Gametophyt ist klein, aber eigenständig."),
  },
  seed: {
    name: tx("Seed plant", "Samenpflanze"),
    size: { sporophyte: 42, spores: 16, gametophyte: 14, gametes: 18, zygote: 18 },
    text: {
      sporophyte: tx("The cherry tree: the only generation you can see. It carries flowers.", "Der Kirschbaum: die einzige Generation, die du siehst. Er trägt die Blüten."),
      spores: tx("Microspores in the anthers and a megaspore in the ovule, made by meiosis.", "Mikrosporen in den Staubbeuteln und eine Megaspore in der Samenanlage, durch Meiose gebildet."),
      gametophyte: tx("Tiny and dependent: the pollen grain (♂, 2 to 3 cells) and the embryo sac (♀, 7 cells, 8 nuclei).", "Winzig und abhängig: das Pollenkorn (♂, 2 bis 3 Zellen) und der Embryosack (♀, 7 Zellen, 8 Kerne)."),
      gametes: tx("Sperm cells without flagella and the egg cell. The pollen tube delivers the sperm: no water needed.", "Spermazellen ohne Geißel und die Eizelle. Der Pollenschlauch bringt die Spermazellen hin: Wasser ist nicht nötig."),
      zygote: tx("Grows into the embryo inside the seed: a new sporophyte.", "Wächst im Samen zum Embryo heran: ein neuer Sporophyt."),
    },
    sum: tx("Seed plant: the **sporophyte** dominates; the gametophytes are reduced to a few cells.", "Samenpflanze: Der **Sporophyt** dominiert, die Gametophyten sind auf wenige Zellen reduziert."),
  },
};

const CX = 210;
const CY = 190;
const RING = 126;
const pos = (deg: number, r = RING) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r] as const;

function arc(a1: number, a2: number, r = RING) {
  const [x1, y1] = pos(a1, r);
  const [x2, y2] = pos(a2, r);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function sector(a1: number, a2: number, r1: number, r2: number) {
  const [x1, y1] = pos(a1, r2);
  const [x2, y2] = pos(a2, r2);
  const [x3, y3] = pos(a2, r1);
  const [x4, y4] = pos(a1, r1);
  const large = (a2 - a1 + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r2} ${r2} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${r1} ${r1} 0 ${large} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}

export function FlowerLifeCycle({ start = "seed" }: { start?: Group }) {
  const t = useText();
  const [group, setGroup] = useState<Group>(start);
  const [picked, setPicked] = useState<NodeId>("gametophyte");
  const g = GROUPS[group];
  const arrowId = `lc-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(["moss", "fern", "seed"] as Group[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={group === id}
            onClick={() => setGroup(id)}
            className={cn("flex h-9 items-center rounded-lg border px-3 text-[13.5px] font-medium transition-colors", group === id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(GROUPS[id].name)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] md:items-center">
        <svg viewBox="0 -6 420 372" className="mx-auto block h-auto w-full" style={{ maxWidth: 460 }} role="img" aria-label={t(tx("Alternation of generations", "Generationswechsel"))}>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--ink-2)" />
            </marker>
          </defs>
          {/* haploid and diploid halves */}
          <path d={sector(-54, 162, 60, 168)} fill="var(--bio-nucleus)" opacity={0.35} />
          <path d={sector(162, 306, 60, 168)} fill="var(--bio-leaf)" opacity={0.35} />
          <text x={CX + 18} y={CY + 14} textAnchor="middle" fontSize={26} fontWeight={700} fill="var(--bio-nucleus-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            n
          </text>
          <text x={CX - 26} y={CY - 6} textAnchor="middle" fontSize={26} fontWeight={700} fill="var(--bio-leaf-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            2n
          </text>
          {/* arrows with the process names */}
          {NODES.map((n, i) => {
            const next = NODES[(i + 1) % NODES.length];
            const a1 = n.angle + 17;
            const a2 = (next.angle < n.angle ? next.angle + 360 : next.angle) - 17;
            const mid = (a1 + a2) / 2;
            const [lx, ly] = pos(mid, RING + 30);
            return (
              <g key={n.id}>
                <path d={arc(a1, a2)} fill="none" stroke="var(--ink-2)" strokeWidth={2} markerEnd={`url(#${arrowId})`} />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={600} fill={i === 0 || i === 3 ? "var(--blob-ink)" : "var(--ink-2)"} style={{ fontFamily: "var(--font-sans)" }}>
                  {t(STEPS[i])}
                </text>
              </g>
            );
          })}
          {/* the five stages */}
          {NODES.map((n) => {
            const [x, y] = pos(n.angle);
            const r = g.size[n.id];
            const on = picked === n.id;
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={t(n.name)}
                aria-pressed={on}
                onClick={() => setPicked(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPicked(n.id);
                  }
                }}
                className="cursor-pointer outline-none"
                data-own-keys
              >
                <motion.circle
                  cx={x}
                  cy={y}
                  initial={false}
                  animate={{ r }}
                  transition={{ type: "spring", stiffness: 160, damping: 16 }}
                  fill={n.ploidy === "n" ? "var(--bio-nucleus)" : "var(--bio-leaf)"}
                  stroke={on ? "var(--blob)" : n.ploidy === "n" ? "var(--bio-nucleus-deep)" : "var(--bio-leaf-deep)"}
                  strokeWidth={on ? 3.5 : 1.8}
                />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
                  {n.ploidy}
                </text>
                {(() => {
                  const top = n.angle === -90;
                  const c = Math.cos((n.angle * Math.PI) / 180);
                  const [lx, ly] = top ? [x, y - r - 11] : pos(n.angle, RING + r + 9);
                  return (
                    <text
                      x={lx}
                      y={ly + (!top && Math.sin((n.angle * Math.PI) / 180) > 0.5 ? 6 : 0)}
                      textAnchor={top ? "middle" : c > 0.3 ? "start" : c < -0.3 ? "end" : "middle"}
                      dominantBaseline="central"
                      fontSize={13.5}
                      fontWeight={on ? 700 : 600}
                      fill="var(--ink)"
                      style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
                    >
                      {t(n.name)}
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </svg>

        <div className="space-y-2">
          <p className="rounded-xl border border-blob/40 bg-blob-soft/50 px-3 py-2 text-[13.5px] leading-snug text-ink-2">
            {t(g.sum)
              .split(/(\*\*[^*]+\*\*)/g)
              .map((p, i) => (p.startsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
          </p>
          <ul className="space-y-1">
            {NODES.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setPicked(n.id)}
                  className={cn("w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors", picked === n.id ? "bg-blob-soft text-ink" : "text-ink-2 hover:bg-hover")}
                >
                  <span className="font-semibold text-ink">
                    {t(n.name)} ({n.ploidy})
                  </span>
                  {picked === n.id && <span className="block pt-0.5">{t(g.text[n.id])}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
