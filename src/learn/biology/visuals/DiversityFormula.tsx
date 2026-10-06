"use client";

// Floral formulas and floral diagrams for the "plant-diversity" topic. A formula is written as a
// short code: "*K4C4A2+4G(2)o" (* radial, v zygomorphic; K calyx, C corolla, P perianth, A stamens,
// G carpels; brackets = fused, x = many; after G: o superior, u inferior, m perigynous). It renders
// the way German textbooks print it (✱ K4 C4 A2+4 G(2) with a line under the ovary when it is superior).
// The builder widget lets students assemble the formula of a family while looking at its diagram.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

export type Whorl = { letter: "K" | "C" | "P" | "A" | "G"; body: string; pos?: "o" | "u" | "m" };
export type Parsed = { sym: "*" | "v"; whorls: Whorl[] };

export function parseFormula(code: string): Parsed {
  const sym = code[0] === "v" ? "v" : "*";
  const rest = code.slice(1);
  const whorls: Whorl[] = [];
  const re = /([KCPAG])([^KCPAG]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    let body = m[2];
    let pos: Whorl["pos"];
    if (m[1] === "G" && /[oum]$/.test(body)) {
      pos = body.slice(-1) as Whorl["pos"];
      body = body.slice(0, -1);
    }
    whorls.push({ letter: m[1] as Whorl["letter"], body, pos });
  }
  return { sym, whorls };
}

const SYM = { "*": "✱", v: "↓" };
const pretty = (body: string) => body.replace(/x/g, "∞");

/** The formula as plain text: "✱ K4 C4 A2+4 G(2)" (the ovary position is not shown). */
export function formulaPlain(code: string) {
  const p = parseFormula(code);
  return [SYM[p.sym], ...p.whorls.map((w) => `${w.letter}${pretty(w.body)}`)].join(" ");
}

/** Words for the ovary position. */
export const POSITION: Record<"o" | "u" | "m", Text> = {
  o: tx("superior", "oberständig"),
  u: tx("inferior", "unterständig"),
  m: tx("perigynous (free in a cup)", "mittelständig"),
};

/** The formula, typeset: numbers as subscripts, ∞, and a line under (superior) or over (inferior) the ovary. */
export function FloralFormula({ code, size = "md", lit, className }: { code: string; size?: "sm" | "md" | "lg"; lit?: string; className?: string }) {
  const p = parseFormula(code);
  const fs = size === "sm" ? 16 : size === "md" ? 22 : 30;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-[0.45em] font-math text-ink", className)} style={{ fontSize: fs }}>
      <span className={cn(lit === "sym" && "text-blob-ink")}>{SYM[p.sym]}</span>
      {p.whorls.map((w, i) => (
        <span key={i} className={cn("whitespace-nowrap", lit === w.letter && "text-blob-ink")}>
          <span className="italic">{w.letter}</span>
          <span
            style={{
              fontSize: "0.72em",
              textDecorationLine: w.pos === "o" ? "underline" : w.pos === "u" ? "overline" : undefined,
              textDecorationThickness: "0.09em",
              textUnderlineOffset: "0.18em",
            }}
          >
            {pretty(w.body)}
          </span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Floral diagrams

export type DiagramId = "brassicaceae" | "lamiaceae" | "fabaceae" | "rosaceae" | "liliaceae";

const rad = (a: number) => ((a - 90) * Math.PI) / 180;
const pol = (r: number, a: number): [number, number] => [r * cos(rad(a)), r * sin(rad(a))];
const f1 = (v: number) => Math.round(v * 10) / 10;

/** A crescent around the centre at radius r, centred on angle a, spanning w degrees, thickness th. */
function crescent(r: number, a: number, w: number, th: number) {
  const out: string[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    const [x, y] = pol(r + (th / 2) * (1 - t * t) + 1, a + (t * w) / 2);
    out.push(`${i ? "L" : "M"}${f1(x)} ${f1(y)}`);
  }
  for (let i = n; i >= 0; i--) {
    const t = -1 + (2 * i) / n;
    const [x, y] = pol(r - (th / 2) * (1 - t * t) * 0.6, a + (t * w) / 2);
    out.push(`L${f1(x)} ${f1(y)}`);
  }
  return `${out.join("")}Z`;
}

function Anther({ r, a, k = 1 }: { r: number; a: number; k?: number }) {
  const [x, y] = pol(r, a);
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${a}) scale(${k})`}>
      <path d="M-7 0C-7 -5 -2 -6 0 -2C2 -6 7 -5 7 0C7 5 2 6 0 2C-2 6 -7 5 -7 0Z" fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
    </g>
  );
}

function Ovary({ carpels, chambers = carpels, r = 15, single = false }: { carpels: number; chambers?: number; r?: number; single?: boolean }) {
  if (single) {
    // one carpel: a bean-shaped section with the ovules on one side
    return (
      <g>
        <path d={`M0 ${-r}C${r * 1.1} ${-r} ${r * 1.1} ${r} 0 ${r}C${-r * 0.6} ${r} ${-r * 0.5} ${r * 0.3} ${-r * 0.2} 0C${-r * 0.5} ${-r * 0.3} ${-r * 0.6} ${-r} 0 ${-r}Z`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} transform="rotate(-90)" />
        <circle cx={0} cy={-3} r={3} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />
      </g>
    );
  }
  const walls = Array.from({ length: chambers }, (_, i) => (360 / chambers) * i + (chambers === 2 ? 90 : 0));
  return (
    <g>
      <circle cx={0} cy={0} r={r} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      {walls.map((a) => {
        const [x, y] = pol(r, a);
        return <path key={a} d={`M0 0L${f1(x)} ${f1(y)}`} stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />;
      })}
      {walls.map((a) => {
        const [x, y] = pol(r * 0.52, a + 180 / chambers);
        return <circle key={`o${a}`} cx={f1(x)} cy={f1(y)} r={2.6} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />;
      })}
    </g>
  );
}

const sepalStyle = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 1.4, strokeLinejoin: "round" as const };
const petalStyle = { fill: "var(--bio-petal)", stroke: "var(--bio-petal-deep)", strokeWidth: 1.4, strokeLinejoin: "round" as const };
const ring = (r: number, colour: string) => <circle cx={0} cy={0} r={r} fill="none" stroke={colour} strokeWidth={2.2} />;

/** A floral diagram (ground plan of the flower). Top: towards the stem axis (dot). */
export function FloralDiagram({ id, lit, className }: { id: DiagramId; lit?: string; className?: string }) {
  const t = useText();
  const dim = (g: string) => (lit && lit !== g && !(lit === "P" && (g === "K" || g === "C")) ? 0.28 : 1);
  const body = (() => {
    switch (id) {
      case "brassicaceae":
        return (
          <>
            <g opacity={dim("K")}>
              {[0, 90, 180, 270].map((a) => (
                <path key={a} d={crescent(86, a, 52, 14)} {...sepalStyle} />
              ))}
            </g>
            <g opacity={dim("C")}>
              {[45, 135, 225, 315].map((a) => (
                <path key={a} d={crescent(66, a, 50, 12)} {...petalStyle} />
              ))}
            </g>
            <g opacity={dim("A")}>
              {[-18, 18, 162, 198].map((a) => (
                <Anther key={a} r={36} a={a} />
              ))}
              {[90, 270].map((a) => (
                <Anther key={a} r={46} a={a} k={0.8} />
              ))}
            </g>
            <g opacity={dim("G")}>
              <Ovary carpels={2} />
            </g>
          </>
        );
      case "lamiaceae":
        return (
          <>
            <g opacity={dim("K")}>
              {ring(86, "var(--bio-leaf-deep)")}
              {[0, 72, 144, 216, 288].map((a) => (
                <path key={a} d={crescent(86, a + 36, 50, 12)} {...sepalStyle} />
              ))}
            </g>
            <g opacity={dim("C")}>
              {ring(66, "var(--bio-petal-deep)")}
              {/* upper lip: 2 petals at the top; lower lip: 3 petals */}
              {[-36, 36].map((a) => (
                <path key={a} d={crescent(66, a, 56, 14)} {...petalStyle} />
              ))}
              {[108, 180, 252].map((a) => (
                <path key={a} d={crescent(66, a, 62, a === 180 ? 22 : 14)} {...petalStyle} />
              ))}
            </g>
            <g opacity={dim("A")}>
              {[-72, 72].map((a) => (
                <Anther key={a} r={40} a={a} k={0.8} />
              ))}
              {[144, 216].map((a) => (
                <Anther key={a} r={40} a={a} />
              ))}
              {/* the fifth stamen is missing */}
              <circle cx={0} cy={-42} r={3} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="2 2" />
            </g>
            <g opacity={dim("G")}>
              <Ovary carpels={2} chambers={4} />
            </g>
          </>
        );
      case "fabaceae":
        return (
          <>
            <g opacity={dim("K")}>
              {ring(88, "var(--bio-leaf-deep)")}
              {[36, 108, 180, 252, 324].map((a) => (
                <path key={a} d={crescent(88, a, 48, 12)} {...sepalStyle} />
              ))}
            </g>
            <g opacity={dim("C")}>
              {/* standard (top), two wings, keel of two fused petals */}
              <path d={crescent(68, 0, 110, 18)} {...petalStyle} />
              {[90, 270].map((a) => (
                <path key={a} d={crescent(62, a, 52, 14)} {...petalStyle} />
              ))}
              <path d={`M${pol(54, 150)[0]} ${pol(54, 150)[1]}A54 54 0 0 0 ${pol(54, 210)[0]} ${pol(54, 210)[1]}`} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={2.4} />
              {[156, 204].map((a) => (
                <path key={a} d={crescent(54, a, 40, 12)} {...petalStyle} />
              ))}
            </g>
            <g opacity={dim("A")}>
              {/* 9 fused stamens (tube) and 1 free one at the top */}
              <path d={`M${pol(36, 30)[0]} ${pol(36, 30)[1]}A36 36 0 1 1 ${pol(36, -30)[0]} ${pol(36, -30)[1]}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={2.2} />
              {Array.from({ length: 9 }, (_, i) => 40 + i * 35).map((a) => (
                <Anther key={a} r={36} a={a} k={0.62} />
              ))}
              <Anther r={36} a={0} k={0.62} />
            </g>
            <g opacity={dim("G")}>
              <Ovary carpels={1} single r={13} />
            </g>
          </>
        );
      case "rosaceae":
        return (
          <>
            <g opacity={dim("K")}>
              {[36, 108, 180, 252, 324].map((a) => (
                <path key={a} d={crescent(88, a, 50, 12)} {...sepalStyle} />
              ))}
            </g>
            <g opacity={dim("C")}>
              {[0, 72, 144, 216, 288].map((a) => (
                <path key={a} d={crescent(70, a, 54, 14)} {...petalStyle} />
              ))}
            </g>
            <g opacity={dim("A")}>
              {Array.from({ length: 20 }, (_, i) => i * 18).map((a) => (
                <Anther key={a} r={47} a={a} k={0.55} />
              ))}
              {Array.from({ length: 20 }, (_, i) => i * 18 + 9).map((a) => (
                <Anther key={`b${a}`} r={36} a={a} k={0.5} />
              ))}
            </g>
            <g opacity={dim("G")}>
              <Ovary carpels={1} single r={13} />
            </g>
          </>
        );
      case "liliaceae":
        return (
          <>
            <g opacity={dim("P")}>
              {[0, 120, 240].map((a) => (
                <path key={a} d={crescent(84, a, 70, 14)} {...petalStyle} />
              ))}
              {[60, 180, 300].map((a) => (
                <path key={a} d={crescent(66, a, 66, 13)} {...petalStyle} />
              ))}
            </g>
            <g opacity={dim("A")}>
              {[0, 120, 240].map((a) => (
                <Anther key={a} r={44} a={a} />
              ))}
              {[60, 180, 300].map((a) => (
                <Anther key={a} r={34} a={a} />
              ))}
            </g>
            <g opacity={dim("G")}>
              <Ovary carpels={3} />
            </g>
          </>
        );
    }
  })();
  return (
    <svg viewBox="-112 -118 224 228" className={cn("block h-auto w-full", className)} role="img" aria-label={t(tx("Floral diagram", "Blütendiagramm"))}>
      <circle cx={0} cy={-109} r={5} fill="var(--ink)" />
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The builder

type Slot = { key: "sym" | "K" | "C" | "P" | "A" | "G"; options: string[]; why: Text };
type Build = { id: DiagramId; name: Text; plant: Text; code: string; slots: Slot[] };

/** Option codes: "*" / "v" for symmetry; "K4", "C(2+3)", "G(2)o" for the rest. The first option of every slot is the right one. */
export const BUILDS: Build[] = [
  {
    id: "brassicaceae",
    name: tx("Crucifers", "Kreuzblütler"),
    plant: tx("oilseed rape", "Raps"),
    code: "*K4C4A2+4G(2)o",
    slots: [
      { key: "sym", options: ["*", "v"], why: tx("The four petals form a regular cross: several planes of symmetry, so radial (✱).", "Die vier Kronblätter bilden ein regelmäßiges Kreuz: mehrere Symmetrieebenen, also radiär (✱).") },
      { key: "K", options: ["K4", "K5", "K(4)", "K2"], why: tx("Count the green crescents: 4 separate sepals, so K4 without brackets.", "Zähl die grünen Sicheln: 4 freie Kelchblätter, also K4 ohne Klammer.") },
      { key: "C", options: ["C4", "C(4)", "C2+2", "C5"], why: tx("4 separate petals, set crosswise: C4.", "4 freie Kronblätter über Kreuz: C4.") },
      { key: "A", options: ["A2+4", "A6", "A4", "A(6)"], why: tx("6 stamens in two circles: 2 short outside, 4 long inside. Write A2+4.", "6 Staubblätter in zwei Kreisen: außen 2 kurze, innen 4 lange. Man schreibt A2+4.") },
      { key: "G", options: ["G(2)o", "G2o", "G(2)u", "G(4)o"], why: tx("2 fused carpels (brackets), ovary above the other parts: superior, line under the number.", "2 verwachsene Fruchtblätter (Klammer), Fruchtknoten über den anderen Teilen: oberständig, Strich unter der Zahl.") },
    ],
  },
  {
    id: "lamiaceae",
    name: tx("Mint family", "Lippenblütler"),
    plant: tx("dead-nettle", "Taubnessel"),
    code: "vK(5)C(2+3)A2+2G(2)o",
    slots: [
      { key: "sym", options: ["v", "*"], why: tx("Upper lip and lower lip: only one plane of symmetry, so zygomorphic (↓).", "Ober- und Unterlippe: nur eine Symmetrieebene, also zygomorph (↓).") },
      { key: "K", options: ["K(5)", "K5", "K(4)", "K2"], why: tx("5 sepals joined into a tube (the ring): K(5).", "5 Kelchblätter zu einer Röhre verwachsen (der Ring): K(5).") },
      { key: "C", options: ["C(2+3)", "C2+3", "C5", "C(4)"], why: tx("All 5 petals are fused: 2 form the upper lip, 3 the lower lip. Brackets round everything: C(2+3).", "Alle 5 Kronblätter sind verwachsen: 2 bilden die Oberlippe, 3 die Unterlippe. Klammer um alles: C(2+3).") },
      { key: "A", options: ["A2+2", "A5", "A(4)", "A2+4"], why: tx("4 stamens, 2 long and 2 short (the fifth is missing): A2+2, often also written A4.", "4 Staubblätter, 2 lange und 2 kurze (das fünfte fehlt): A2+2, oft auch A4 geschrieben.") },
      { key: "G", options: ["G(2)o", "G4o", "G(2)u", "G(5)o"], why: tx("2 fused carpels; the 4 chambers come from extra walls. Superior: G(2) with a line underneath.", "2 verwachsene Fruchtblätter; die 4 Kammern entstehen durch zusätzliche Wände. Oberständig: G(2) mit Strich darunter.") },
    ],
  },
  {
    id: "fabaceae",
    name: tx("Pea family", "Schmetterlingsblütler"),
    plant: tx("pea", "Erbse"),
    code: "vK(5)C1+2+(2)A(9)+1G1o",
    slots: [
      { key: "sym", options: ["v", "*"], why: tx("Standard, wings and keel: only one plane of symmetry, zygomorphic (↓).", "Fahne, Flügel und Schiffchen: nur eine Symmetrieebene, zygomorph (↓).") },
      { key: "K", options: ["K(5)", "K5", "K4", "K(2+3)"], why: tx("5 sepals fused into a cup: K(5).", "5 Kelchblätter zu einem Becher verwachsen: K(5).") },
      { key: "C", options: ["C1+2+(2)", "C(5)", "C1+2+2", "C5"], why: tx("1 standard + 2 wings + 2 fused keel petals: C1+2+(2).", "1 Fahne + 2 Flügel + 2 verwachsene Schiffchenblätter: C1+2+(2).") },
      { key: "A", options: ["A(9)+1", "A10", "A(10)", "A9"], why: tx("10 stamens: 9 fused into a tube, 1 free on top: A(9)+1.", "10 Staubblätter: 9 zu einer Röhre verwachsen, 1 frei obendrauf: A(9)+1.") },
      { key: "G", options: ["G1o", "G(2)o", "G1u", "G(10)o"], why: tx("A single carpel, superior: G1. It becomes the legume (pod).", "Ein einziges Fruchtblatt, oberständig: G1. Daraus wird die Hülse.") },
    ],
  },
  {
    id: "rosaceae",
    name: tx("Rose family", "Rosengewächse"),
    plant: tx("cherry", "Kirsche"),
    code: "*K5C5AxG1m",
    slots: [
      { key: "sym", options: ["*", "v"], why: tx("Five equal petals all round: radial (✱).", "Fünf gleiche Kronblätter rundherum: radiär (✱).") },
      { key: "K", options: ["K5", "K(5)", "K4", "Kx"], why: tx("5 separate sepals: K5.", "5 freie Kelchblätter: K5.") },
      { key: "C", options: ["C5", "C(5)", "Cx", "C4"], why: tx("5 separate petals: C5.", "5 freie Kronblätter: C5.") },
      { key: "A", options: ["Ax", "A5", "A10", "A(x)"], why: tx("Far too many stamens to count: A∞ (∞ = many).", "Viel zu viele Staubblätter zum Zählen: A∞ (∞ = viele).") },
      { key: "G", options: ["G1m", "Gxm", "G(5)u", "G1u"], why: tx("In the cherry: 1 carpel, free inside a cup-shaped flower base (mittelständig). It becomes the stone fruit.", "Bei der Kirsche: 1 Fruchtblatt, frei in einem becherförmigen Blütenboden (mittelständig). Daraus wird die Steinfrucht.") },
    ],
  },
  {
    id: "liliaceae",
    name: tx("Lily family", "Liliengewächse"),
    plant: tx("tulip", "Tulpe"),
    code: "*P3+3A3+3G(3)o",
    slots: [
      { key: "sym", options: ["*", "v"], why: tx("Six equal tepals all round: radial (✱).", "Sechs gleiche Blütenhüllblätter rundherum: radiär (✱).") },
      { key: "P", options: ["P3+3", "P6", "P(3+3)", "K3C3"], why: tx("Calyx and corolla look the same: a perianth (P) of 2 circles of 3 free tepals: P3+3.", "Kelch und Krone sehen gleich aus: eine Blütenhülle (P) aus 2 Kreisen mit je 3 freien Blättern: P3+3.") },
      { key: "A", options: ["A3+3", "A6", "A3", "A(6)"], why: tx("6 stamens in 2 circles of 3: A3+3.", "6 Staubblätter in 2 Kreisen zu je 3: A3+3.") },
      { key: "G", options: ["G(3)o", "G3o", "G(3)u", "G(6)o"], why: tx("3 fused carpels, superior: G(3) with a line underneath. Everything in threes: a monocot.", "3 verwachsene Fruchtblätter, oberständig: G(3) mit Strich darunter. Alles dreizählig: eine einkeimblättrige Pflanze.") },
    ],
  },
];

const SLOT_NAMES: Record<Slot["key"], Text> = {
  sym: tx("Symmetry", "Symmetrie"),
  K: tx("Calyx (K)", "Kelch (K)"),
  C: tx("Corolla (C)", "Krone (C)"),
  P: tx("Perianth (P)", "Blütenhülle (P)"),
  A: tx("Stamens (A)", "Staubblätter (A)"),
  G: tx("Carpels (G)", "Fruchtblätter (G)"),
};

const SLOT_HINTS: Record<Slot["key"], Text> = {
  sym: tx("How many planes of symmetry does the flower have? Several: ✱. Only one: ↓.", "Wie viele Symmetrieebenen hat die Blüte? Mehrere: ✱. Nur eine: ↓."),
  K: tx("Count the green crescents on the outside. If a ring joins them, they are fused: use brackets.", "Zähl die grünen Sicheln außen. Verbindet sie ein Ring, sind sie verwachsen: Klammer."),
  C: tx("Count the pink petals. Joined by a ring = fused = brackets. Different groups are added with +.", "Zähl die rosa Kronblätter. Durch einen Ring verbunden = verwachsen = Klammer. Verschiedene Gruppen verbindest du mit +."),
  P: tx("Calyx and corolla look alike here. How many circles, how many tepals in each?", "Kelch und Krone sehen hier gleich aus. Wie viele Kreise, wie viele Blätter je Kreis?"),
  A: tx("Count the anthers. If they come in groups (long and short, fused and free), write the groups with +.", "Zähl die Staubbeutel. Bilden sie Gruppen (lang und kurz, verwachsen und frei), schreibst du die Gruppen mit + auf."),
  G: tx("How many carpels are there, are they fused, and where does the ovary sit? Careful: chambers are not always carpels.", "Wie viele Fruchtblätter sind es, sind sie verwachsen, und wo sitzt der Fruchtknoten? Vorsicht: Kammern sind nicht immer Fruchtblätter."),
};

/** One chip label for an option code. */
function OptionLabel({ code }: { code: string }) {
  const t = useText();
  if (code === "*" || code === "v") return <span>{code === "*" ? `✱ ${t(tx("radial", "radiär"))}` : `↓ ${t(tx("zygomorphic", "zygomorph"))}`}</span>;
  const w = parseFormula(`*${code}`).whorls;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <FloralFormula code={`*${code}`.replace("*", "*")} size="sm" className="[&>span:first-child]:hidden" />
      {w.length === 1 && w[0].pos && <span className="text-[12px] text-ink-3">{t(POSITION[w[0].pos])}</span>}
    </span>
  );
}

/** Lesson widget: build the floral formula of a family from its diagram. */
export function DiversityFormulaBuilder() {
  const t = useText();
  const scope = useId();
  const [fi, setFi] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<Slot["key"]>("sym");
  const [checked, setChecked] = useState(false);
  const B = BUILDS[fi];
  const right = (s: Slot) => s.options[0];
  const done = B.slots.every((s) => picks[s.key]);
  const allRight = done && B.slots.every((s) => picks[s.key] === right(s));
  const code = (picks.sym ?? "*") + B.slots.filter((s) => s.key !== "sym" && picks[s.key]).map((s) => picks[s.key]).join("");
  const choose = (k: number) => {
    setFi(k);
    setPicks({});
    setChecked(false);
    setFocus("sym");
  };
  // Shown order of the options: fixed per slot, not always with the right one first.
  const shown = (s: Slot, i: number) => {
    const n = s.options.length;
    const shift = (i * 3 + fi) % n;
    return s.options.map((_, k) => s.options[(k + shift) % n]);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {BUILDS.map((b, k) => (
          <button key={b.id} type="button" onClick={() => choose(k)} className={cn("relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", fi === k ? "text-white" : "bg-hover text-ink-2 hover:text-ink")}>
            {fi === k && <motion.span layoutId={`${scope}-fam`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(b.name)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-start">
        <div className="space-y-2">
          <div className="mx-auto w-full max-w-[250px]">
            <FloralDiagram id={B.id} lit={focus === "sym" ? undefined : focus} />
          </div>
          <p className="text-center text-[12.5px] leading-snug text-ink-3">
            {t(tx("Floral diagram of the ", "Blütendiagramm: "))}
            {t(B.plant)}
            {t(tx(". The dot marks the stem side. Rings = fused.", ". Der Punkt zeigt zur Sprossachse. Ringe = verwachsen."))}
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5">
            {B.slots.map((s) => {
              const v = picks[s.key];
              const bad = checked && v && v !== right(s);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFocus(s.key)}
                  className={cn("rounded-lg px-1.5 py-0.5 transition-colors", focus === s.key && "bg-blob-soft", bad && "ring-2 ring-danger/60", checked && v === right(s) && "ring-2 ring-ok/50")}
                >
                  {v ? (
                    s.key === "sym" ? (
                      <span className="font-math text-[22px] text-ink">{v === "*" ? "✱" : "↓"}</span>
                    ) : (
                      <FloralFormula code={`*${v}`} className="[&>span:first-child]:hidden" />
                    )
                  ) : (
                    <span className="inline-block min-w-[2.2em] rounded border border-dashed border-line-2 px-1 text-center font-math text-[18px] text-ink-3">{s.key === "sym" ? "?" : `${s.key}?`}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="space-y-2.5">
            {B.slots.map((s, i) => (
              <div key={s.key} className={cn("rounded-xl px-2 py-1.5 transition-colors", focus === s.key && "bg-hover/60")} onFocus={() => setFocus(s.key)}>
                <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(SLOT_NAMES[s.key])}</div>
                <div className="flex flex-wrap gap-1.5">
                  {shown(s, i).map((o) => {
                    const on = picks[s.key] === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => {
                          setPicks((p) => ({ ...p, [s.key]: o }));
                          setFocus(s.key);
                          setChecked(false);
                        }}
                        className={cn("rounded-lg border px-2.5 py-1 text-[14px] transition-colors", on ? "border-blob bg-blob-soft text-ink" : "border-line bg-raised text-ink-2 hover:border-blob/50 hover:text-ink")}
                      >
                        <OptionLabel code={o} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={!done} onClick={() => setChecked(true)} className="rounded-xl bg-blob px-4 py-2 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40">
              {t(tx("Check formula", "Formel prüfen"))}
            </button>
            {!done && <span className="text-[12.5px] text-ink-3">{t(tx("Pick one chip in every row.", "Wähle in jeder Zeile einen Baustein."))}</span>}
          </div>
          <AnimatePresence mode="wait">
            {checked && (
              <motion.div key={`${fi}-${code}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("space-y-1.5 rounded-xl border px-3.5 py-3 text-[14px] leading-snug", allRight ? "border-ok/40 bg-ok/5" : "border-line bg-surface")}>
                {allRight ? (
                  <>
                    <div className="font-semibold text-ink">
                      {t(tx("Correct! ", "Richtig! "))}
                      <FloralFormula code={B.code} size="sm" />
                    </div>
                    {B.slots.map((s) => (
                      <p key={s.key} className="text-ink-2">
                        {t(s.why)}
                      </p>
                    ))}
                  </>
                ) : (
                  B.slots
                    .filter((s) => picks[s.key] !== right(s))
                    .slice(0, 2)
                    .map((s) => (
                      <p key={s.key} className="text-ink">
                        <span className="font-semibold">{t(SLOT_NAMES[s.key])}: </span>
                        {t(SLOT_HINTS[s.key])}
                      </p>
                    ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Task picture: a floral formula, big. */
export function DiversityFormulaPicture({ code, diagram }: { code: string; diagram?: DiagramId }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <FloralFormula code={code} size="lg" />
      {diagram && (
        <div className="w-full max-w-[200px]">
          <FloralDiagram id={diagram} />
        </div>
      )}
    </div>
  );
}

/** Task picture: a floral diagram only. */
export function DiversityDiagramPicture({ id }: { id: DiagramId }) {
  return (
    <div className="mx-auto w-full max-w-[230px]">
      <FloralDiagram id={id} />
    </div>
  );
}
