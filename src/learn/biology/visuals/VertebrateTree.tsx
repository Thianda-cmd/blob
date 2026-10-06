"use client";

// The family tree of the vertebrates as a cladogram. Every branching point is a common ancestor
// with a new feature (Tetrapoda: four limbs; Amniota: amniotic egg...). Tap a node or a group to
// see the feature, the bridge animals (Tiktaalik, Archaeopteryx...) and which groups belong to it.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type Leaf = { id: string; name: Text; info: Text };
export const LEAVES: Leaf[] = [
  { id: "shark", name: tx("Cartilaginous fish (sharks, rays)", "Knorpelfische (Haie, Rochen)"), info: tx("Skeleton of cartilage, gill slits, tooth-like skin scales.", "Skelett aus Knorpel, Kiemenspalten, zahnähnliche Hautschuppen.") },
  { id: "ray", name: tx("Ray-finned fish (perch, trout)", "Strahlenflosser (Barsch, Forelle)"), info: tx("Most of today's fish: fins supported by thin rays, swim bladder.", "Die meisten heutigen Fische: Flossen mit dünnen Strahlen, Schwimmblase.") },
  { id: "lobe", name: tx("Coelacanth, lungfish", "Quastenflosser, Lungenfische"), info: tx("Fleshy fins with bones inside. The coelacanth (Latimeria) is a 'living fossil'.", "Fleischige Flossen mit Knochen darin. Der Quastenflosser (Latimeria) ist ein „lebendes Fossil“.") },
  { id: "amph", name: tx("Amphibians", "Amphibien"), info: tx("First land vertebrates, but still tied to water for breeding.", "Erste Landwirbeltiere, zur Fortpflanzung aber noch ans Wasser gebunden.") },
  { id: "mammal", name: tx("Mammals", "Säugetiere"), info: tx("Synapsid line: hair, milk glands, three ear ossicles. Mosaic form: the platypus still lays eggs.", "Linie der Synapsiden: Haare, Milchdrüsen, drei Gehörknöchelchen. Mosaikform: Das Schnabeltier legt noch Eier.") },
  { id: "squamate", name: tx("Lizards and snakes", "Echsen und Schlangen"), info: tx("Horny scales that are shed; the largest group of reptiles.", "Hornschuppen, die gehäutet werden; die größte Gruppe der Reptilien.") },
  { id: "croc", name: tx("Crocodiles", "Krokodile"), info: tx("Closer to birds than to lizards! Like birds, they have a complete septum in the heart.", "Mit Vögeln näher verwandt als mit Echsen! Wie Vögel haben sie eine vollständige Kammerscheidewand.") },
  { id: "bird", name: tx("Birds", "Vögel"), info: tx("Feathers, wings, beak. Birds are the living dinosaurs. Bridge animal: Archaeopteryx (about 150 million years ago).", "Federn, Flügel, Schnabel. Vögel sind die heute lebenden Dinosaurier. Brückentier: Archaeopteryx (vor etwa 150 Millionen Jahren).") },
];

export type Node = { id: string; name: Text; feature: Text; bridge?: Text; x: number; kids: [string, string] };
export const NODES: Node[] = [
  { id: "A", name: tx("Jawed vertebrates", "Kiefermäuler"), feature: tx("backbone, skull and jaws", "Wirbelsäule, Schädel und Kiefer"), x: 40, kids: ["shark", "B"] },
  { id: "B", name: tx("Bony fish (in the wide sense)", "Knochenfische (im weiteren Sinn)"), feature: tx("skeleton of bone; lung or swim bladder (the two are homologous)", "Skelett aus Knochen; Lunge bzw. Schwimmblase (beide sind homolog)"), x: 78, kids: ["ray", "C"] },
  { id: "C", name: tx("Lobe-finned fish", "Fleischflosser"), feature: tx("fleshy fins with bones that match upper arm, ulna and radius", "fleischige Flossen mit Knochen, die Oberarm, Elle und Speiche entsprechen"), bridge: tx("Living coelacanth (Latimeria); fossil Eusthenopteron", "Heute lebender Quastenflosser (Latimeria); fossil Eusthenopteron"), x: 116, kids: ["lobe", "D"] },
  { id: "D", name: tx("Tetrapods (four-limbed vertebrates)", "Tetrapoden (Landwirbeltiere)"), feature: tx("four limbs with fingers and toes", "vier Gliedmaßen mit Fingern und Zehen"), bridge: tx("Tiktaalik (about 375 million years ago): gills and scales, but a neck, lungs and fins with wrist bones", "Tiktaalik (vor etwa 375 Millionen Jahren): Kiemen und Schuppen, aber ein Hals, Lungen und Flossen mit Handwurzelknochen"), x: 154, kids: ["amph", "E"] },
  { id: "E", name: tx("Amniotes", "Amnioten"), feature: tx("the amniotic egg: breeding on land, independent of water", "das Amnion-Ei: Fortpflanzung an Land, unabhängig vom Wasser"), bridge: tx("Seymouria: a mosaic of amphibian and reptile features", "Seymouria: eine Mosaikform aus Amphibien- und Reptilienmerkmalen"), x: 192, kids: ["mammal", "F"] },
  { id: "F", name: tx("Sauropsids (reptiles and birds)", "Sauropsiden (Reptilien und Vögel)"), feature: tx("horny scales of a special keratin; birds' feathers developed from them", "Hornschuppen aus besonderem Keratin; die Federn der Vögel entstanden daraus"), x: 230, kids: ["squamate", "G"] },
  { id: "G", name: tx("Archosaurs", "Archosaurier"), feature: tx("crocodiles and dinosaurs, including birds", "Krokodile und Dinosaurier, einschließlich der Vögel"), bridge: tx("Archaeopteryx: feathers, wings and wishbone, but teeth, claws on the fingers and a long bony tail", "Archaeopteryx: Federn, Flügel und Gabelbein, aber Zähne, Krallen an den Fingern und eine lange Schwanzwirbelsäule"), x: 268, kids: ["croc", "bird"] },
];

const ROW = 40;
const TOP = 26;
const LEAF_X = 300;
const leafY = (i: number) => TOP + i * ROW;

function layout() {
  const y: Record<string, number> = {};
  LEAVES.forEach((l, i) => (y[l.id] = leafY(i)));
  for (const n of [...NODES].reverse()) y[n.id] = (y[n.kids[0]] + y[n.kids[1]]) / 2;
  return y;
}
const Y = layout();
const X: Record<string, number> = Object.fromEntries([...NODES.map((n) => [n.id, n.x]), ...LEAVES.map((l) => [l.id, LEAF_X])]);
const under = (id: string): string[] => {
  const n = NODES.find((x) => x.id === id);
  return n ? [...under(n.kids[0]), ...under(n.kids[1])] : [id];
};

/** The tree on its own (also a task picture). `mark` lights up a node's group. */
export function VertebrateTreeDiagram({ sel = null, onSelect }: { sel?: string | null; onSelect?: (id: string | null) => void }) {
  const t = useText();
  const lit = sel ? under(sel) : [];
  /** A node is lit when its whole group lies inside the selected group. */
  const nodeLit = (id: string) => !!sel && under(id).length > 1 && under(id).every((l) => lit.includes(l));
  const font = { fontFamily: "var(--font-sans)" };
  const h = TOP + (LEAVES.length - 1) * ROW + 26;
  return (
    <svg viewBox={`0 0 600 ${h}`} className="block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(tx("Family tree of the vertebrates", "Stammbaum der Wirbeltiere"))}>
      <line x1={12} x2={NODES[0].x} y1={Y.A} y2={Y.A} stroke="var(--ink-2)" strokeWidth={2.4} />
      {NODES.map((n) => {
        const on = nodeLit(n.id);
        return (
          <g key={n.id}>
            <line x1={n.x} x2={n.x} y1={Y[n.kids[0]]} y2={Y[n.kids[1]]} stroke={on ? "var(--blob)" : "var(--ink-2)"} strokeWidth={on ? 3.4 : 2.4} />
            {n.kids.map((k) => (
              <line key={k} x1={n.x} x2={X[k]} y1={Y[k]} y2={Y[k]} stroke={on ? "var(--blob)" : "var(--ink-2)"} strokeWidth={on ? 3.4 : 2.4} />
            ))}
          </g>
        );
      })}
      {LEAVES.map((l) => {
        const on = lit.includes(l.id) || sel === l.id;
        return (
          <g key={l.id} onClick={onSelect ? () => onSelect(sel === l.id ? null : l.id) : undefined} className={onSelect ? "cursor-pointer" : undefined}>
            <rect x={LEAF_X - 4} y={Y[l.id] - 16} width={296} height={32} rx={9} fill={on ? "var(--blob-soft)" : "transparent"} />
            <circle cx={LEAF_X} cy={Y[l.id]} r={4.5} fill={on ? "var(--blob)" : "var(--ink-2)"} />
            <text x={LEAF_X + 12} y={Y[l.id]} dominantBaseline="central" fontSize={15} fontWeight={on ? 700 : 500} fill="var(--ink)" style={font}>
              {t(l.name)}
            </text>
          </g>
        );
      })}
      {NODES.map((n) => {
        const on = sel === n.id;
        return (
          <g key={n.id} onClick={onSelect ? () => onSelect(on ? null : n.id) : undefined} className={onSelect ? "cursor-pointer" : undefined}>
            {on && <motion.circle cx={n.x} cy={Y[n.id]} r={16} fill="none" stroke="var(--blob)" strokeWidth={2} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />}
            <circle cx={n.x} cy={Y[n.id]} r={11} fill={on ? "var(--blob)" : "var(--raised)"} stroke={on ? "var(--blob)" : "var(--ink)"} strokeWidth={1.6} />
            <text x={n.x} y={Y[n.id]} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={on ? "var(--paper)" : "var(--ink)"} style={{ ...font, pointerEvents: "none" }}>
              {n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function VertebrateTree() {
  const t = useText();
  const [sel, setSel] = useState<string | null>("D");
  const node = NODES.find((n) => n.id === sel);
  const leaf = LEAVES.find((l) => l.id === sel);
  return (
    <div className="space-y-3">
      <VertebrateTreeDiagram sel={sel} onSelect={setSel} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sel ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} className="min-h-[7rem] rounded-xl border border-line bg-surface px-4 py-3 text-[15px]">
          {node ? (
            <div className="space-y-1.5">
              <div className="font-display text-[18px] font-bold">
                <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-blob text-[12px] text-white">{node.id}</span>
                {t(node.name)}
              </div>
              <div>
                <span className="font-semibold">{t(tx("New feature: ", "Neues Merkmal: "))}</span>
                {t(node.feature)}
              </div>
              {node.bridge && (
                <div className={cn("text-ink-2")}>
                  <span className="font-semibold text-ink">{t(tx("Bridge animal: ", "Brückentier: "))}</span>
                  {t(node.bridge)}
                </div>
              )}
            </div>
          ) : leaf ? (
            <div className="space-y-1.5">
              <div className="font-display text-[18px] font-bold">{t(leaf.name)}</div>
              <div className="text-ink-2">{t(leaf.info)}</div>
            </div>
          ) : (
            <span className="text-ink-3">{t(tx("Tap a branching point (A to G) or a group.", "Tipp auf einen Verzweigungspunkt (A bis G) oder eine Gruppe."))}</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
