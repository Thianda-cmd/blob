"use client";

import { motion } from "motion/react";
import { Fragment } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

// ---------------------------------------------------------------------------
// Genotype text: "Aa", "X^A X^a", "A0" (letters italic, superscripts small)

/** Splits "X^A X^a" into [base, sup] pieces. */
function genoParts(g: string): [string, string | null][] {
  const out: [string, string | null][] = [];
  // "X^A X^a" is written without the space; "b⁺b vg⁺vg" keeps it between genes.
  const s = g.replace(/(\^\S)\s+(?=X|Y)/g, "$1").replace(/\s+/g, " ");
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] === "^") {
      out.push([s[i], s[i + 2] ?? ""]);
      i += 2;
    } else out.push([s[i], null]);
  }
  return out;
}

/** A genotype in HTML: <Geno g="X^A X^a" />. */
export function Geno({ g, className }: { g: string; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap font-math", className)}>
      {genoParts(g).map(([b, sup], i) => (
        <Fragment key={i}>
          <span className={b === " " ? "inline-block w-[0.3em]" : /[A-Za-z]/.test(b) ? "italic" : undefined}>{b === " " ? "" : b}</span>
          {sup !== null && <sup className="text-[0.68em] italic">{sup}</sup>}
        </Fragment>
      ))}
    </span>
  );
}

/** A genotype inside an SVG <text>. */
export function SvgGeno({ g, fontSize }: { g: string; fontSize: number }) {
  const parts = genoParts(g);
  return (
    <>
      {parts.map(([b, sup], i) => (
        <Fragment key={i}>
          <tspan fontStyle={/[A-Za-z]/.test(b) ? "italic" : undefined} dy={i > 0 && parts[i - 1][1] !== null ? fontSize * 0.32 : 0}>
            {b}
          </tspan>
          {sup !== null && (
            <tspan fontSize={fontSize * 0.68} dy={-fontSize * 0.32} fontStyle="italic">
              {sup}
            </tspan>
          )}
        </Fragment>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Seeds

/** A pea seed: round or wrinkled, yellow or green. */
export function PeaSeed({ cx, cy, r, shape = "round", colour = "yellow" }: { cx: number; cy: number; r: number; shape?: "round" | "wrinkled"; colour?: "yellow" | "green" }) {
  const fill = colour === "yellow" ? "var(--bio-c)" : "var(--bio-chloro)";
  if (shape === "round")
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke="var(--bio-outline)" strokeWidth={Math.max(1, r * 0.12)} />
        <path d={`M ${cx - r * 0.55} ${cy - r * 0.15} A ${r * 0.6} ${r * 0.6} 0 0 1 ${cx - r * 0.1} ${cy - r * 0.6}`} fill="none" stroke="var(--bio-outline)" strokeOpacity={0.3} strokeWidth={Math.max(0.8, r * 0.1)} strokeLinecap="round" />
      </g>
    );
  // wrinkled: a lumpy, slightly angular outline with creases
  const pts: string[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.86 + 0.1 * sin(a * 5 + 0.7) + 0.04 * cos(a * 3));
    pts.push(`${(cx + rr * cos(a)).toFixed(2)} ${(cy + rr * sin(a)).toFixed(2)}`);
  }
  return (
    <g>
      <path d={`M ${pts.join(" L ")} Z`} fill={fill} stroke="var(--bio-outline)" strokeWidth={Math.max(1, r * 0.12)} strokeLinejoin="round" />
      <path
        d={`M ${cx - r * 0.5} ${cy - r * 0.2} q ${r * 0.3} ${r * 0.25} ${r * 0.55} ${r * 0.05} M ${cx + r * 0.05} ${cy + r * 0.15} q ${r * 0.2} ${r * 0.3} ${r * 0.45} ${r * 0.1} M ${cx - r * 0.3} ${cy + r * 0.45} q ${r * 0.15} -${r * 0.2} ${r * 0.35} -${r * 0.05}`}
        fill="none"
        stroke="var(--bio-outline)"
        strokeOpacity={0.55}
        strokeWidth={Math.max(0.8, r * 0.09)}
        strokeLinecap="round"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Flowers

/** A pea flower from the side: banner (Fahne) behind, wings (Flügel) and keel (Schiffchen) in front, green calyx. */
export function PeaFlower({ x, y, s = 1, colour = "purple", flip = false }: { x: number; y: number; s?: number; colour?: "purple" | "white"; flip?: boolean }) {
  const banner = colour === "purple" ? "var(--bio-u)" : "var(--bio-bone)";
  const wing = colour === "purple" ? "var(--bio-nucleus-deep)" : "var(--bio-bone)";
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {/* banner */}
      <path d="M -2 4 C -20 2 -22 -22 -6 -26 C 6 -29 14 -18 10 -6 C 8 2 4 5 -2 4 Z" fill={banner} stroke="var(--bio-outline)" strokeWidth={1.4} strokeLinejoin="round" />
      {/* wings */}
      <path d="M -4 2 C 6 -6 20 -4 22 4 C 20 12 6 13 -2 8 Z" fill={wing} stroke="var(--bio-outline)" strokeWidth={1.4} strokeLinejoin="round" />
      {/* keel */}
      <path d="M 2 7 C 10 9 18 10 22 6 C 20 13 10 15 2 11 Z" fill={wing} stroke="var(--bio-outline)" strokeWidth={1.2} strokeLinejoin="round" opacity={0.9} />
      {/* calyx */}
      <path d="M -8 3 L -2 -1 L 4 5 L -2 10 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  );
}

/** A four o'clock flower (Wunderblume) seen from above: five fused petals around a narrow throat. */
export function MirabilisFlower({ x, y, r = 22, colour = "red" }: { x: number; y: number; r?: number; colour?: "red" | "pink" | "white" }) {
  const fill = colour === "red" ? "var(--bio-blood)" : colour === "pink" ? "var(--bio-petal)" : "var(--bio-bone)";
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 5;
    const am = (a0 + a1) / 2;
    const p0 = [x + r * 0.78 * cos(a0), y + r * 0.78 * sin(a0)];
    const c = [x + r * 1.18 * cos(am), y + r * 1.18 * sin(am)];
    const p1 = [x + r * 0.78 * cos(a1), y + r * 0.78 * sin(a1)];
    if (i === 0) pts.push(`M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)}`);
    pts.push(`Q ${c[0].toFixed(2)} ${c[1].toFixed(2)} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
  }
  return (
    <g>
      <path d={`${pts.join(" ")} Z`} fill={fill} stroke="var(--bio-outline)" strokeWidth={1.5} strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + ((i + 0.5) / 5) * Math.PI * 2;
        return <line key={i} x1={x} y1={y} x2={x + r * 0.75 * cos(a)} y2={y + r * 0.75 * sin(a)} stroke="var(--bio-outline)" strokeOpacity={0.25} strokeWidth={1} />;
      })}
      <circle cx={x} cy={y} r={r * 0.2} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1} />
    </g>
  );
}

/** A drop of blood with its blood group. */
export function BloodDrop({ x, y, s = 1, group }: { x: number; y: number; s?: number; group: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 -18 C 6 -8 13 -1 13 7 C 13 15 7 20 0 20 C -7 20 -13 15 -13 7 C -13 -1 -6 -8 0 -18 Z" fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={1.3} strokeLinejoin="round" />
      <text x={0} y={9} textAnchor="middle" dominantBaseline="middle" fontSize={group.length > 1 ? 10 : 12} fontWeight={700} fill="var(--raised)" style={{ fontFamily: "var(--font-sans)" }}>
        {group}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// The pea plant

export type PeaLook = {
  flower?: "purple" | "white";
  seedShape?: "round" | "wrinkled";
  seedColour?: "yellow" | "green";
  tall?: boolean;
  pod?: "green" | "yellow";
  /** Draw a dashed ring around the organ that shows the trait. */
  focus?: "flower" | "seeds" | "stem" | "pod";
};

function Leaf({ x, y, side, s = 1 }: { x: number; y: number; side: 1 | -1; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${side * s} ${s})`}>
      {/* stipule at the node */}
      <path d="M 0 0 C 6 4 12 2 13 -4 C 8 -6 3 -4 0 0 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} />
      {/* petiole with two pairs of leaflets and a tendril */}
      <path d="M 0 -2 C 12 -8 24 -14 36 -22" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} strokeLinecap="round" />
      {[
        [13, -8],
        [25, -15],
      ].map(([lx, ly], i) => (
        <g key={i}>
          <ellipse cx={lx - 2} cy={ly - 9} rx={8} ry={4.6} transform={`rotate(-58 ${lx - 2} ${ly - 9})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} />
          <ellipse cx={lx + 5} cy={ly + 5} rx={8} ry={4.6} transform={`rotate(-20 ${lx + 5} ${ly + 5})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} />
        </g>
      ))}
      <path d="M 36 -22 C 42 -26 46 -22 44 -18 C 42 -15 38 -17 40 -20 C 41 -21 43 -20 42 -19" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

/** Pea plant drawing (viewBox 200 × 240): flowers, leaves with tendrils and an open pod with four seeds. */
export function PeaPlantSvg({ flower = "purple", seedShape = "round", seedColour = "yellow", tall = true, pod = "green", focus }: PeaLook) {
  const top = tall ? 40 : 128;
  const nodes = tall ? [198, 162, 128, 94] : [204, 172];
  const podNode = tall ? 128 : 172;
  const podFill = pod === "green" ? "var(--bio-leaf)" : "var(--bio-sun)";
  const stem = tall ? "M 100 224 C 97 200 103 186 100 162 C 97 140 103 120 100 96 C 98 76 102 58 100 40" : "M 100 224 C 97 206 103 190 100 172 C 98 156 102 142 100 128";
  const px = 112;
  const py = podNode + 6;
  const ring = (cx: number, cy: number, rx: number, ry: number) => (
    <motion.ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="none"
      stroke="var(--blob)"
      strokeWidth={2.2}
      strokeDasharray="5 4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
  return (
    <g>
      <ellipse cx={100} cy={226} rx={58} ry={8} fill="var(--bio-soil)" opacity={0.85} />
      <path d={stem} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
      {nodes.map((y, i) => (y === podNode ? <Leaf key={y} x={100} y={y} side={-1} /> : <Leaf key={y} x={100} y={y} side={i % 2 ? 1 : -1} />))}
      {/* pod on a short stalk, open, with four seeds */}
      <path d={`M 100 ${podNode} C 106 ${podNode} 110 ${py - 2} ${px} ${py}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
      <path
        d={`M ${px} ${py} C ${px + 14} ${py - 12} ${px + 52} ${py - 4} ${px + 70} ${py + 14} C ${px + 74} ${py + 20} ${px + 70} ${py + 26} ${px + 62} ${py + 25} C ${px + 40} ${py + 24} ${px + 12} ${py + 20} ${px} ${py} Z`}
        fill={podFill}
        stroke="var(--bio-leaf-deep)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d={`M ${px + 6} ${py + 3} C ${px + 22} ${py - 2} ${px + 48} ${py + 4} ${px + 64} ${py + 17}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1} opacity={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <PeaSeed key={i} cx={px + 16 + i * 14} cy={py + 9 + i * 2.6} r={6.2} shape={seedShape} colour={seedColour} />
      ))}
      {/* flowers at the top */}
      <path d={`M 100 ${top + 4} C 94 ${top} 90 ${top - 2} 84 ${top - 4}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      <path d={`M 100 ${top + 14} C 106 ${top + 12} 112 ${top + 10} 118 ${top + 10}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      <PeaFlower x={80} y={top - 2} colour={flower} flip />
      <PeaFlower x={122} y={top + 12} colour={flower} />
      {focus === "flower" && ring(101, top + 2, 42, 26)}
      {focus === "seeds" && ring(px + 37, py + 13, 34, 15)}
      {focus === "pod" && ring(px + 36, py + 11, 44, 22)}
      {focus === "stem" && ring(100, (top + 224) / 2, 16, (224 - top) / 2 + 6)}
    </g>
  );
}

/** A standalone pea plant picture (for tasks): <PeaPlant flower="white" focus="flower" />. */
export function PeaPlant(props: PeaLook & { caption?: string; className?: string }) {
  const t = useText();
  return (
    <svg viewBox="0 0 200 240" className={cn("mx-auto block h-auto w-full max-w-[200px]", props.className)} role="img" aria-label={t(tx("Pea plant", "Erbsenpflanze"))}>
      <PeaPlantSvg {...props} />
    </svg>
  );
}

/** Two pictures side by side with a × between them (a cross), each with a caption. */
export function GeneticsCrossPicture({ left, right, captions, counts }: { left: PeaLook; right: PeaLook; captions?: [string, string]; counts?: { look: PeaLook; n: number; label: Text }[] }) {
  const t = useText();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 sm:gap-6">
        <figure className="w-[120px] sm:w-[150px]">
          <PeaPlant {...left} />
          {captions && (
            <figcaption className="text-center text-[15px] text-ink-2">
              <Geno g={captions[0]} />
            </figcaption>
          )}
        </figure>
        <span className="font-math text-[28px] text-ink-3">×</span>
        <figure className="w-[120px] sm:w-[150px]">
          <PeaPlant {...right} />
          {captions && (
            <figcaption className="text-center text-[15px] text-ink-2">
              <Geno g={captions[1]} />
            </figcaption>
          )}
        </figure>
      </div>
      {counts && (
        <div className="flex flex-wrap items-end justify-center gap-4 border-t border-line pt-3">
          <span className="self-center text-[13px] text-ink-3">{t(tx("Offspring:", "Nachkommen:"))}</span>
          {counts.map((c, i) => (
            <figure key={i} className="flex items-center gap-1.5">
              <div className="w-[56px]">
                <PeaPlant {...c.look} focus={undefined} />
              </div>
              <figcaption className="text-[14px] text-ink">
                <span className="font-semibold tabular-nums">{c.n}</span> <span className="text-ink-2">{t(c.label)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
