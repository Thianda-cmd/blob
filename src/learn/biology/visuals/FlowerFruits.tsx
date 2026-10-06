"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { Bold } from "./FlowerKit";

// Fruit types in section: cherry (drupe), tomato (berry), hazelnut (nut), poppy (capsule) and
// strawberry (aggregate fruit of nutlets on a fleshy receptacle). Lesson widget with tabs, and
// single drawings as task pictures.

export type FruitId = "cherry" | "tomato" | "hazel" | "poppy" | "strawberry";

type FruitInfo = { name: Text; type: Text; what: Text; parts: FigurePart[]; draw: ReactNode };

const OUT = "var(--bio-outline)";

/** A fixed scatter for seeds and nutlets. */
const scatter = (seed: number, n: number, fn: (r: () => number, i: number) => ReactNode) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => fn(() => rng.next(), i));
};

const CHERRY_SKIN = "M 180 66 C 214 50, 272 70, 272 146 C 272 206, 230 242, 180 242 C 130 242, 88 206, 88 146 C 88 70, 146 50, 180 66 Z";
const CHERRY_FLESH = "M 180 75 C 211 61, 264 79, 264 146 C 264 200, 226 234, 180 234 C 134 234, 96 200, 96 146 C 96 79, 149 61, 180 75 Z";
const BERRY = "M 180 70 C 238 54, 274 80, 274 128 C 274 168, 254 206, 222 232 C 202 248, 158 248, 138 232 C 106 206, 86 168, 86 128 C 86 80, 122 54, 180 70 Z";

const FRUITS: Record<FruitId, FruitInfo> = {
  cherry: {
    name: tx("cherry", "Kirsche"),
    type: tx("Drupe (stone fruit)", "Steinfrucht"),
    what: tx(
      "The fruit wall is **fleshy on the outside and hard on the inside** (the stone). The seed lies inside the stone. Also: plum, peach, apricot, mango.",
      "Die Fruchtwand ist **außen fleischig und innen hart** (Steinkern). Der Samen liegt im Steinkern. Auch: Pflaume, Pfirsich, Aprikose, Mango.",
    ),
    parts: [
      { id: "skin", label: tx("skin", "Fruchthaut"), at: [258, 112], tag: [318, 84], info: tx("Thin outer layer of the fruit wall.", "Dünne äußere Schicht der Fruchtwand.") },
      { id: "flesh", label: tx("flesh", "Fruchtfleisch"), at: [232, 190], tag: [318, 214], info: tx("Juicy middle layer of the fruit wall.", "Saftige mittlere Schicht der Fruchtwand.") },
      { id: "stone", label: tx("stone (hard inner fruit wall)", "Steinkern (harte innere Fruchtwand)"), at: [146, 168], tag: [42, 206], info: tx("Hard, woody inner layer: protects the seed.", "Harte, verholzte innere Schicht: schützt den Samen.") },
      { id: "seed", label: tx("seed", "Samen"), at: [180, 150], tag: [42, 120], info: tx("Developed from the ovule.", "Aus der Samenanlage entstanden.") },
      { id: "stalk", label: tx("stalk", "Stiel"), at: [178, 36], tag: [110, 28], info: tx("Was the flower stalk.", "War der Blütenstiel.") },
    ],
    draw: (
      <>
        <g data-part="stalk">
          <path d="M 196 6 C 188 22, 182 40, 180 64" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={6} strokeLinecap="round" />
          <path d="M 196 6 C 188 22, 182 40, 180 64" fill="none" stroke="var(--bio-leaf)" strokeWidth={3} strokeLinecap="round" />
        </g>
        <path data-part="skin" d={CHERRY_SKIN} fill="var(--bio-blood)" stroke={OUT} strokeWidth={2} />
        <g data-part="flesh">
          <path d={CHERRY_FLESH} fill="var(--raised)" />
          <path d={CHERRY_FLESH} fill="var(--bio-blood)" opacity={0.62} />
        </g>
        <ellipse data-part="stone" cx={180} cy={152} rx={40} ry={48} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={5} />
        <g data-part="seed">
          <ellipse cx={180} cy={152} rx={25} ry={33} fill="var(--bio-mito)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
          <path d="M 180 124 C 172 140, 172 164, 180 180" fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1} opacity={0.6} />
        </g>
      </>
    ),
  },
  tomato: {
    name: tx("tomato", "Tomate"),
    type: tx("Berry", "Beere"),
    what: tx(
      "The **whole fruit wall is fleshy**, and there are usually many seeds. Also: grape, blueberry, pepper, currant, banana.",
      "Die **ganze Fruchtwand ist fleischig**, meist mit vielen Samen. Auch: Weintraube, Heidelbeere, Paprika, Johannisbeere, Banane.",
    ),
    parts: [
      { id: "wall", label: tx("fruit wall (fleshy all through)", "Fruchtwand (ganz fleischig)"), at: [258, 160], tag: [324, 190], info: tx("All layers soft and juicy: that makes it a berry.", "Alle Schichten weich und saftig: Das macht die Beere aus.") },
      { id: "chamber", label: tx("chamber with jelly", "Fruchtfach mit Gallerte"), at: [140, 112], tag: [40, 84], info: tx("The ovary had several chambers. Now they are full of jelly.", "Der Fruchtknoten hatte mehrere Fächer. Jetzt sind sie voller Gallerte.") },
      { id: "seed", label: tx("seeds", "Samen"), at: [214, 176], tag: [324, 236], info: tx("Many seeds, each from one ovule.", "Viele Samen, jeder aus einer Samenanlage.") },
      { id: "sepals", label: tx("sepals", "Kelchblätter"), at: [208, 50], tag: [300, 30], info: tx("The sepals often stay on the berry.", "Die Kelchblätter bleiben oft an der Beere.") },
    ],
    draw: (
      <>
        <g data-part="wall">
          <path d={BERRY} fill="var(--bio-blood)" stroke={OUT} strokeWidth={2} />
          <path d={BERRY} transform="translate(180 152) scale(0.93) translate(-180 -152)" fill="var(--raised)" />
          <path d={BERRY} transform="translate(180 152) scale(0.93) translate(-180 -152)" fill="var(--bio-blood)" opacity={0.6} />
        </g>
        <g data-part="chamber">
          {[
            "M 176 140 C 150 112, 128 104, 116 118 C 104 134, 112 168, 138 182 C 154 172, 168 160, 176 140 Z",
            "M 184 140 C 210 112, 232 104, 244 118 C 256 134, 248 168, 222 182 C 206 172, 192 160, 184 140 Z",
            "M 180 154 C 194 170, 206 186, 206 204 C 194 222, 166 222, 154 204 C 154 186, 166 170, 180 154 Z",
          ].map((d) => (
            <g key={d}>
              <path d={d} fill="var(--raised)" />
              <path d={d} fill="var(--bio-leaf)" opacity={0.55} stroke="var(--bio-blood)" strokeWidth={1} />
            </g>
          ))}
        </g>
        <g data-part="seed">
          {[
            [140, 140, -30],
            [128, 152, -10],
            [150, 162, -50],
            [220, 140, 30],
            [232, 152, 10],
            [210, 162, 50],
            [172, 196, 70],
            [188, 196, -70],
            [180, 182, 0],
          ].map(([x, y, a]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx={5.5} ry={3.6} transform={`rotate(${a} ${x} ${y})`} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
          ))}
        </g>
        <g data-part="sepals">
          {[-60, -25, 10, 45, 80].map((a) => (
            <path key={a} d="M 180 64 C 186 56, 204 48, 222 50 C 206 56, 192 62, 182 66 Z" transform={`rotate(${a - 10} 180 64)`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
          ))}
          <path d="M 180 64 L 182 34" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
        </g>
      </>
    ),
  },
  hazel: {
    name: tx("hazelnut", "Haselnuss"),
    type: tx("Nut", "Nuss"),
    what: tx(
      "The **whole fruit wall is hard and woody**. It stays closed and holds one seed: the part you eat. Also: acorn, beechnut, sweet chestnut.",
      "Die **ganze Fruchtwand ist hart und verholzt**. Sie bleibt geschlossen und enthält einen Samen: den Teil, den du isst. Auch: Eichel, Buchecker, Esskastanie.",
    ),
    parts: [
      { id: "shell", label: tx("fruit wall (hard, woody)", "Fruchtwand (hart, verholzt)"), at: [236, 116], tag: [318, 80], info: tx("The nutshell is the fruit wall.", "Die Nussschale ist die Fruchtwand.") },
      { id: "seed", label: tx("seed (the kernel you eat)", "Samen (der essbare Kern)"), at: [180, 138], tag: [40, 110], info: tx("One seed, from one ovule.", "Ein Samen, aus einer Samenanlage.") },
      { id: "husk", label: tx("husk (leafy cup)", "Hülle (Fruchtbecher)"), at: [100, 200], tag: [40, 236], info: tx("Leafy bracts around the nut, not part of the fruit wall.", "Blattartige Hochblätter um die Nuss, kein Teil der Fruchtwand.") },
    ],
    draw: (
      <>
        <path data-part="husk" d="M 104 254 C 86 226, 84 196, 92 172 L 78 160 L 98 158 L 88 140 L 108 146 L 104 126 L 120 140 C 126 190, 150 236, 180 252 C 210 236, 234 190, 240 140 L 256 126 L 252 146 L 272 140 L 262 158 L 282 160 L 268 172 C 276 196, 274 226, 256 254 C 228 272, 132 272, 104 254 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} strokeLinejoin="round" />
        <g data-part="shell">
          <path d="M 180 46 C 226 46, 250 92, 250 140 C 250 196, 220 232, 180 232 C 140 232, 110 196, 110 140 C 110 92, 134 46, 180 46 Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
          <path d="M 180 60 C 216 60, 236 98, 236 140 C 236 188, 212 218, 180 218 C 148 218, 124 188, 124 140 C 124 98, 144 60, 180 60 Z" fill="var(--bio-wood-deep)" opacity={0.5} />
        </g>
        <g data-part="seed">
          <path d="M 180 66 C 212 66, 230 100, 230 140 C 230 184, 208 212, 180 212 C 152 212, 130 184, 130 140 C 130 100, 148 66, 180 66 Z" fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={2.4} />
          <path d="M 180 74 C 174 110, 174 170, 180 204" fill="none" stroke="var(--bio-wood)" strokeWidth={1.2} opacity={0.7} />
        </g>
        <path d="M 180 46 L 180 36" stroke="var(--bio-wood-deep)" strokeWidth={3} strokeLinecap="round" />
      </>
    ),
  },
  poppy: {
    name: tx("poppy", "Mohn"),
    type: tx("Capsule", "Kapsel"),
    what: tx(
      "The fruit wall is **dry** and **opens** to let out many seeds: in the poppy through little pores under the lid, like a salt shaker. Also: tulip, violet, touch-me-not. Similar but from a single carpel: the pod (legume) of peas and beans.",
      "Die Fruchtwand ist **trocken** und **öffnet sich**, um viele Samen freizugeben: beim Mohn durch kleine Poren unter dem Deckel, wie bei einem Salzstreuer. Auch: Tulpe, Veilchen, Springkraut. Ähnlich, aber aus nur einem Fruchtblatt: die Hülse von Erbse und Bohne.",
    ),
    parts: [
      { id: "capsule", label: tx("capsule (dry fruit wall)", "Kapsel (trockene Fruchtwand)"), at: [242, 186], tag: [320, 210], info: tx("Dries out when ripe.", "Trocknet bei der Reife aus.") },
      { id: "disc", label: tx("stigma disc (lid)", "Narbenscheibe (Deckel)"), at: [214, 76], tag: [312, 50], info: tx("What's left of the stigmas, a flat star on top.", "Der Rest der Narben, ein flacher Stern obendrauf.") },
      { id: "pores", label: tx("pores", "Poren"), at: [140, 97], tag: [40, 76], info: tx("Little openings: when the wind shakes the capsule, seeds trickle out.", "Kleine Öffnungen: Schüttelt der Wind die Kapsel, rieseln Samen heraus.") },
      { id: "seed", label: tx("seeds", "Samen"), at: [178, 170], tag: [40, 190], info: tx("Hundreds of tiny seeds.", "Hunderte winzige Samen.") },
    ],
    draw: (
      <>
        <path d="M 180 300 L 180 238" stroke="var(--bio-leaf-deep)" strokeWidth={7} strokeLinecap="round" />
        <path d="M 180 300 L 180 238" stroke="var(--bio-leaf)" strokeWidth={4} strokeLinecap="round" />
        <path data-part="capsule" d="M 120 96 C 98 120, 100 196, 136 228 C 160 248, 200 248, 224 228 C 260 196, 262 120, 240 96 Z" fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
        {/* cut-away window with partitions and seeds */}
        <path d="M 138 110 C 124 132, 126 190, 150 214 C 168 230, 192 230, 210 214 C 234 190, 236 132, 222 110 Z" fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={1.2} />
        {[150, 166, 180, 194, 210].map((x) => (
          <path key={x} d={`M ${x} 112 C ${x + (x - 180) * 0.25} 160, ${x + (x - 180) * 0.1} 200, ${180 + (x - 180) * 0.4} 222`} fill="none" stroke="var(--bio-wall-deep)" strokeWidth={1.2} opacity={0.7} />
        ))}
        <g data-part="seed">
          {scatter(5, 46, (r, i) => {
            const x = 140 + r() * 80;
            const y = 122 + r() * 96;
            const inside = Math.abs(x - 180) < 40 - Math.max(0, y - 190) * 0.9;
            return inside ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2.4} fill="var(--bio-blood-low)" stroke={OUT} strokeWidth={0.6} /> : null;
          })}
          {[
            [262, 112],
            [272, 128],
            [282, 106],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={2.4} fill="var(--bio-blood-low)" stroke={OUT} strokeWidth={0.6} />
          ))}
        </g>
        <g data-part="pores">
          {[132, 152, 172, 192, 212, 230].map((x) => (
            <ellipse key={x} cx={x} cy={98} rx={4.5} ry={3} fill={OUT} />
          ))}
        </g>
        <g data-part="disc">
          <ellipse cx={180} cy={86} rx={66} ry={14} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
          {[-48, -32, -16, 0, 16, 32, 48].map((dx) => (
            <line key={dx} x1={180} y1={84} x2={180 + dx} y2={dx === 0 ? 74 : 84 + Math.abs(dx) * 0.04} stroke="var(--bio-wall-deep)" strokeWidth={1.6} strokeLinecap="round" />
          ))}
        </g>
      </>
    ),
  },
  strawberry: {
    name: tx("strawberry", "Erdbeere"),
    type: tx("Aggregate fruit of nutlets", "Sammelnussfrucht"),
    what: tx(
      "The red flesh is the swollen **receptacle**, not the fruit wall! The real fruits are the tiny **nutlets** on its surface, one from each carpel. So it isn't a berry. Raspberries and blackberries are aggregate fruits too, made of many tiny drupes.",
      "Das rote Fruchtfleisch ist der angeschwollene **Blütenboden**, nicht die Fruchtwand! Die echten Früchte sind die winzigen **Nüsschen** auf der Oberfläche, eins aus jedem Fruchtblatt. Eine Beere ist sie also nicht. Himbeere und Brombeere sind Sammelsteinfrüchte aus vielen winzigen Steinfrüchtchen.",
    ),
    parts: [
      { id: "nutlets", label: tx("nutlets (the real fruits)", "Nüsschen (die eigentlichen Früchte)"), at: [263, 150], tag: [324, 150], info: tx("Each nutlet is a tiny nut with one seed.", "Jedes Nüsschen ist eine winzige Nuss mit einem Samen.") },
      { id: "receptacle", label: tx("receptacle (fleshy, red)", "Blütenboden (fleischig, rot)"), at: [214, 196], tag: [318, 236], info: tx("Grows big and juicy after fertilisation.", "Wird nach der Befruchtung groß und saftig.") },
      { id: "sepals", label: tx("sepals", "Kelchblätter"), at: [212, 63], tag: [316, 40], info: tx("The green leaves on top.", "Die grünen Blättchen oben.") },
    ],
    draw: (
      <>
        <g data-part="receptacle">
          <path d="M 180 66 C 250 62, 284 112, 268 162 C 254 208, 214 252, 180 258 C 146 252, 106 208, 92 162 C 76 112, 110 62, 180 66 Z" fill="var(--bio-blood)" stroke={OUT} strokeWidth={2} />
          <path d="M 180 76 C 242 72, 270 116, 256 160 C 244 200, 210 240, 180 246 C 150 240, 116 200, 104 160 C 90 116, 118 72, 180 76 Z" fill="var(--raised)" />
          <path d="M 180 76 C 242 72, 270 116, 256 160 C 244 200, 210 240, 180 246 C 150 240, 116 200, 104 160 C 90 116, 118 72, 180 76 Z" fill="var(--bio-blood)" opacity={0.5} />
          <path d="M 180 80 C 196 100, 198 170, 180 232 C 162 170, 164 100, 180 80 Z" fill="var(--bio-bone)" opacity={0.85} />
          {[
            [120, 120],
            [130, 180],
            [240, 120],
            [230, 180],
          ].map(([x, y]) => (
            <path key={`${x}${y}`} d={`M 180 ${y - 10} Q ${(180 + x) / 2} ${y - 4} ${x} ${y}`} fill="none" stroke="var(--bio-bone)" strokeWidth={1.4} opacity={0.8} />
          ))}
        </g>
        <g data-part="nutlets">
          {[
            [104, 112],
            [96, 150],
            [104, 186],
            [124, 218],
            [152, 244],
            [256, 112],
            [264, 150],
            [256, 186],
            [236, 218],
            [208, 244],
            [180, 257],
          ].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx={3.6} ry={5} transform={`rotate(${(x - 180) * 0.5} ${x} ${y})`} fill="var(--bio-sun)" stroke={OUT} strokeWidth={1} />
          ))}
        </g>
        <g data-part="sepals">
          {[-150, -115, -80, -45, -10].map((a) => (
            <path key={a} d="M 180 68 C 190 60, 214 54, 238 60 C 218 66, 198 70, 182 72 Z" transform={`rotate(${a + 80} 180 68)`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
          ))}
          <path d="M 180 66 L 184 30" stroke="var(--bio-leaf-deep)" strokeWidth={4.5} strokeLinecap="round" />
        </g>
      </>
    ),
  },
};

export const FRUIT_IDS = Object.keys(FRUITS) as FruitId[];
export const fruitInfo = (id: FruitId) => FRUITS[id];

/** One fruit in section (task picture or lesson figure). */
export function FlowerFruitSection({ fruit, mode = "names", show, ask, highlight, legend }: DrawingProps & { fruit: FruitId }) {
  const f = FRUITS[fruit];
  return (
    <Figure title={f.name} width={360} height={300} parts={f.parts} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {f.draw}
    </Figure>
  );
}

/** Lesson widget: tabs for the fruit types, each fruit to explore. */
export function FlowerFruits() {
  const t = useText();
  const [fruit, setFruit] = useState<FruitId>("cherry");
  const f = FRUITS[fruit];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {FRUIT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={fruit === id}
            onClick={() => setFruit(id)}
            className={cn(
              "flex h-9 items-center rounded-lg border px-3 text-[13.5px] font-medium transition-colors",
              fruit === id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {t(FRUITS[id].name).charAt(0).toUpperCase() + t(FRUITS[id].name).slice(1)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={fruit} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug text-ink-2">
            <span className="font-semibold text-blob-ink">{t(f.type)}:</span> <Bold text={t(f.what)} />
          </div>
          <FlowerFruitSection fruit={fruit} mode="explore" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
