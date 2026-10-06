"use client";

// Built for flying: the skeleton of a pigeon (light hollow bones, keel, wishbone, fused hand and
// pelvis, pygostyle) and the contour feather with its hooked barbules, plus a down feather.

import { useId } from "react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cos, sin } from "@/lib/stableMath";

const BONE = "var(--bio-bone)";
const LINE = "var(--bio-outline)";

export const BIRD_PARTS: FigurePart[] = [
  { id: "beak", label: tx("beak of horn, no teeth", "Hornschnabel ohne Zähne"), at: [78, 114], tag: [44, 72], info: tx("Light: a horny sheath instead of heavy jaws with teeth.", "Leicht: eine Hornscheide statt schwerer Kiefer mit Zähnen.") },
  { id: "neck", label: tx("long, flexible neck", "lange, bewegliche Halswirbelsäule"), at: [164, 158], tag: [118, 196], info: tx("Many neck vertebrae: the beak reaches every feather for preening.", "Viele Halswirbel: Der Schnabel erreicht jede Feder zum Putzen.") },
  { id: "humerus", label: tx("upper arm bone (hollow)", "Oberarmknochen (hohl)"), at: [242, 168], info: tx("A hollow bone filled with air: light but stable.", "Ein hohler, luftgefüllter Knochen: leicht, aber stabil.") },
  { id: "forearm", label: tx("ulna and radius", "Elle und Speiche"), at: [318, 102], info: tx("The forearm carries the secondary flight feathers.", "Der Unterarm trägt die Armschwingen.") },
  { id: "hand", label: tx("fused hand bones", "verwachsene Handknochen"), at: [410, 62], info: tx("Only three fingers, partly fused: a stiff base for the primary flight feathers.", "Nur drei Finger, teilweise verwachsen: eine starre Unterlage für die Handschwingen.") },
  { id: "furcula", label: tx("wishbone (furcula)", "Gabelbein"), at: [198, 252], tag: [150, 262], info: tx("The fused collarbones: a spring that keeps the shoulders apart during the wingbeat.", "Die verwachsenen Schlüsselbeine: eine Feder, die die Schultern beim Flügelschlag auseinanderhält.") },
  { id: "keel", label: tx("breastbone with keel", "Brustbein mit Brustbeinkamm"), at: [244, 322], info: tx("The large flight muscles are attached to the keel. Flightless birds like the ostrich have hardly any keel.", "Am Kamm setzen die großen Flugmuskeln an. Laufvögel wie der Strauß haben kaum einen Kamm.") },
  { id: "ribs", label: tx("ribs with hooked processes", "Rippen mit Hakenfortsätzen"), at: [266, 238], info: tx("Small hooks join the ribs: a light but stiff rib cage.", "Kleine Haken verbinden die Rippen: ein leichter, aber stabiler Brustkorb.") },
  { id: "pelvis", label: tx("pelvis fused with vertebrae", "Becken mit Wirbeln verwachsen"), at: [356, 204], tag: [372, 160], info: tx("Fused into one rigid plate: a stable frame for the legs and for landing.", "Zu einer starren Platte verwachsen: ein stabiler Rahmen für Beine und Landung.") },
  { id: "pygostyle", label: tx("tail stump (pygostyle)", "Steißknochen"), at: [442, 202], tag: [494, 214], info: tx("Fused tail vertebrae: carry the tail feathers for steering.", "Verwachsene Schwanzwirbel: tragen die Steuerfedern.") },
  { id: "leg", label: tx("leg with tarsus", "Bein mit Lauf"), at: [346, 352], tag: [404, 340], info: tx("Birds walk on their toes; the long tarsus is fused ankle and foot bones.", "Vögel gehen auf den Zehen; der lange Lauf besteht aus verwachsenen Fußwurzel- und Mittelfußknochen.") },
  { id: "hollow", label: tx("hollow bone in section", "Röhrenknochen im Längsschnitt"), at: [106, 318], tag: [106, 262], info: tx("Thin walls, air inside, braced by fine struts: like a framework, light and stable.", "Dünne Wand, innen Luft, durch feine Knochenbälkchen verstrebt: wie ein Fachwerk, leicht und stabil.") },
];

function Bone({ d, w, part }: { d: string; w: number; part?: string }) {
  return (
    <g data-part={part}>
      <path d={d} fill="none" stroke={LINE} strokeWidth={w + 2.4} strokeLinecap="round" />
      <path d={d} fill="none" stroke={BONE} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
}

/** Small rounded blocks along a cubic bezier (vertebrae). */
function Chain({ p, n, w, h, part }: { p: [number, number, number, number, number, number, number, number]; n: number; w: number; h: number; part?: string }) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const at = (t: number) => {
    const u = 1 - t;
    return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3];
  };
  return (
    <g data-part={part}>
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        const [x, y] = at(t);
        const [xa, ya] = at(Math.max(0, t - 0.01));
        const [xb, yb] = at(Math.min(1, t + 0.01));
        const a = (Math.atan2(yb - ya, xb - xa) * 180) / Math.PI;
        return <rect key={i} x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 3} transform={`rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={BONE} stroke={LINE} strokeWidth={1.2} />;
      })}
    </g>
  );
}

export function VertebrateBirdSkeleton({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Skeleton of a pigeon", "Skelett einer Taube")} width={600} height={400} parts={BIRD_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* ghost outline of the bird */}
        <path
          d="M58 117 C 80 98, 104 86, 130 88 C 154 92, 160 116, 170 140 C 180 160, 196 176, 214 190 C 230 150, 250 100, 290 60 C 340 30, 420 18, 560 20 C 520 50, 470 80, 420 100 C 380 130, 360 160, 350 190 C 380 196, 430 184, 500 190 C 470 214, 430 226, 400 232 C 370 262, 300 300, 240 330 C 200 316, 190 270, 186 240 C 170 210, 150 160, 120 136 C 100 128, 78 124, 58 117 Z"
          fill="color-mix(in oklab, var(--bio-mito) 14%, transparent)"
          stroke="var(--bio-mito-deep)"
          strokeWidth={1.2}
          strokeDasharray="4 5"
          opacity={0.8}
        />

        {/* skull and beak */}
        <path data-part="beak" d="M110 102 C 94 104, 76 110, 58 117 C 76 119, 94 123, 112 128 Z" fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.6} />
        <g>
          <ellipse cx={130} cy={112} rx={24} ry={20} fill={BONE} stroke={LINE} strokeWidth={1.6} />
          <circle cx={120} cy={108} r={10} fill="var(--raised)" stroke={LINE} strokeWidth={1.4} />
        </g>

        {/* neck */}
        <Chain part="neck" p={[148, 126, 176, 146, 158, 174, 206, 196]} n={10} w={10} h={9} />

        {/* scapula and back */}
        <Bone d="M218 206 C 244 200, 274 198, 304 200" w={4.5} />
        <Chain p={[206, 198, 240, 202, 270, 204, 296, 206]} n={6} w={11} h={10} />

        {/* ribs with uncinate processes */}
        <g data-part="ribs">
          {[0, 1, 2, 3, 4].map((k) => {
            const x = 220 + k * 18;
            return (
              <g key={k}>
                <path d={`M${x} 206 C ${x - 4} 236, ${x - 6} 262, ${x - 2} ${284 + k * 2}`} fill="none" stroke={LINE} strokeWidth={5.2} />
                <path d={`M${x} 206 C ${x - 4} 236, ${x - 6} 262, ${x - 2} ${284 + k * 2}`} fill="none" stroke={BONE} strokeWidth={3} />
                {k < 4 && <path d={`M${x - 4} 238 L ${x + 12} 232`} stroke={LINE} strokeWidth={1.6} />}
              </g>
            );
          })}
        </g>

        {/* pelvis + synsacrum, tail, pygostyle */}
        <g data-part="pelvis">
          <path d="M292 198 C 320 184, 382 188, 412 204 C 406 222, 372 232, 332 228 C 310 226, 296 214, 292 198 Z" fill={BONE} stroke={LINE} strokeWidth={1.6} />
          <path d="M342 226 C 370 238, 400 244, 430 242" fill="none" stroke={LINE} strokeWidth={4.4} />
          <path d="M342 226 C 370 238, 400 244, 430 242" fill="none" stroke={BONE} strokeWidth={2.4} />
          <circle cx={338} cy={214} r={5.5} fill="var(--raised)" stroke={LINE} strokeWidth={1.2} />
        </g>
        <Chain p={[410, 206, 418, 204, 424, 202, 432, 200]} n={3} w={8} h={8} />
        <path data-part="pygostyle" d="M432 192 L 456 186 L 448 214 Z" fill={BONE} stroke={LINE} strokeWidth={1.5} />

        {/* coracoid, sternum and keel */}
        <Bone d="M216 212 L 208 284" w={7} />
        <g data-part="keel">
          <path d="M204 282 L 334 294 L 332 302 L 206 294 Z" fill={BONE} stroke={LINE} strokeWidth={1.5} />
          <path d="M206 294 L 332 302 C 302 318, 262 338, 222 350 C 212 334, 206 314, 206 294 Z" fill={BONE} stroke={LINE} strokeWidth={1.6} />
          <path d="M214 304 L 300 308" stroke={LINE} strokeWidth={1} opacity={0.4} />
        </g>
        <Bone part="furcula" d="M214 212 C 194 236, 190 272, 210 300" w={3.2} />

        {/* wing: humerus, radius + ulna, hand */}
        <Bone part="humerus" d="M220 206 L 268 128" w={11} />
        <g data-part="forearm">
          <Bone d="M268 128 C 300 102, 330 90, 368 80" w={7} />
          <Bone d="M272 120 C 302 96, 332 84, 366 72" w={3.6} />
        </g>
        <g data-part="hand">
          <circle cx={370} cy={76} r={6} fill={BONE} stroke={LINE} strokeWidth={1.4} />
          <Bone d="M374 74 L 442 52" w={6} />
          <Bone d="M378 82 C 402 80, 424 68, 442 58" w={3} />
          <Bone d="M372 70 L 388 56" w={3.4} />
          <Bone d="M446 50 L 472 40" w={4.4} />
          <Bone d="M476 38 L 496 30" w={3.2} />
          <Bone d="M448 58 L 460 56" w={2.6} />
        </g>
        <circle cx={268} cy={127} r={6.5} fill={BONE} stroke={LINE} strokeWidth={1.4} />

        {/* leg */}
        <g data-part="leg">
          <Bone d="M338 214 L 316 262" w={9} />
          <Bone d="M318 264 L 352 330" w={7} />
          <Bone d="M322 268 L 334 296" w={2.4} />
          <Bone d="M352 332 L 342 372" w={5.5} />
          <Bone d="M340 374 L 318 380 L 298 382" w={3.2} />
          <Bone d="M340 377 L 320 388 L 304 391" w={3.2} />
          <Bone d="M343 377 L 364 385" w={3} />
          <circle cx={317} cy={263} r={5.5} fill={BONE} stroke={LINE} strokeWidth={1.3} />
          <circle cx={352} cy={331} r={4.5} fill={BONE} stroke={LINE} strokeWidth={1.3} />
        </g>

        {/* inset: hollow bone in section */}
        <g data-part="hollow">
          <rect x={22} y={274} width={168} height={100} rx={14} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.3} strokeDasharray="5 4" />
          <path d="M38 300 C 52 288, 64 296, 76 300 L 138 300 C 150 296, 162 288, 176 300 L 176 344 C 162 356, 150 348, 138 344 L 76 344 C 64 348, 52 356, 38 344 Z" fill={BONE} stroke={LINE} strokeWidth={1.6} />
          <rect x={52} y={306} width={110} height={32} rx={6} fill="var(--bio-vacuole)" stroke={LINE} strokeWidth={1} />
          <g stroke={LINE} strokeWidth={1.6}>
            {[60, 82, 104, 126, 148].map((x) => (
              <g key={x}>
                <line x1={x - 6} y1={307} x2={x + 10} y2={337} />
                <line x1={x + 10} y1={307} x2={x - 6} y2={337} />
              </g>
            ))}
          </g>
        </g>
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Feathers

export const FEATHER_PARTS: FigurePart[] = [
  { id: "calamus", label: tx("quill (calamus)", "Spule (Federkiel)"), at: [84, 290], tag: [40, 250], info: tx("The hollow base sits in the skin.", "Der hohle untere Teil steckt in der Haut.") },
  { id: "rachis", label: tx("shaft (rachis)", "Schaft"), at: [222, 132], tag: [168, 70], info: tx("The stiff middle axis that carries the barbs.", "Die steife Mittelachse, die die Äste trägt.") },
  { id: "vane", label: tx("vane", "Fahne"), at: [258, 160], info: tx("A closed, light surface: it holds the air in flight.", "Eine geschlossene, leichte Fläche: Sie hält beim Fliegen die Luft.") },
  { id: "barb", label: tx("barb", "Ast"), at: [452, 118], tag: [452, 30], info: tx("Hundreds of barbs branch off the shaft.", "Vom Schaft gehen Hunderte Äste ab.") },
  { id: "hooks", label: tx("hooked barbules", "Hakenstrahlen"), at: [420, 158], tag: [370, 238], info: tx("Tiny hooks grip the curved barbules of the next barb, like a zip. If the vane tears, preening hooks it back together.", "Winzige Häkchen greifen in die Bogenstrahlen des nächsten Astes, wie ein Reißverschluss. Reißt die Fahne auf, hakt der Vogel sie beim Putzen wieder zusammen.") },
  { id: "bows", label: tx("curved barbules", "Bogenstrahlen"), at: [500, 176], tag: [556, 238], info: tx("Smooth, curved barbules: the hooks catch on them.", "Glatte, gebogene Strahlen: An ihnen haken sich die Häkchen fest.") },
  { id: "down", label: tx("down feather", "Daunenfeder"), at: [510, 292], tag: [440, 312], info: tx("Soft, without hooks: the loose barbs trap a lot of air and keep the bird warm.", "Weich, ohne Häkchen: Die lockeren Äste halten viel Luft fest und wärmen den Vogel.") },
];

const VANE = "color-mix(in oklab, var(--bio-nucleus) 55%, var(--raised))";
const VANE_LINE = "var(--bio-nucleus-deep)";

/** Points of the contour feather (rachis from (90,270) to (330,30)). */
function featherGeom() {
  const R = (t: number) => [90 + 240 * t, 270 - 240 * t + 18 * sin(Math.PI * t)];
  const nx = -0.707;
  const ny = -0.707;
  const w1 = (t: number) => (t < 0.18 ? 0 : 34 * sin((Math.PI * (t - 0.18)) / 0.82) ** 0.6);
  const w2 = (t: number) => (t < 0.18 ? 0 : 58 * sin((Math.PI * (t - 0.18)) / 0.82) ** 0.55);
  const pts = (side: 1 | -1, w: (t: number) => number) => {
    const out: string[] = [];
    for (let t = 0.18; t <= 1.0001; t += 0.02) {
      const [x, y] = R(t);
      out.push(`${(x + side * nx * w(t)).toFixed(1)} ${(y + side * ny * w(t)).toFixed(1)}`);
    }
    return out;
  };
  const rachis = Array.from({ length: 41 }, (_, i) => R(0.18 + (0.82 * i) / 40).map((v) => v.toFixed(1)).join(" "));
  const outer = `M${rachis[0]} L ${pts(1, w1).join(" L ")} L ${rachis.slice().reverse().join(" L ")} Z`;
  const inner = `M${rachis[0]} L ${pts(-1, w2).join(" L ")} L ${rachis.slice().reverse().join(" L ")} Z`;
  const barbs: string[] = [];
  for (let t = 0.2; t < 0.96; t += 0.035) {
    const [x, y] = R(t);
    const t2 = Math.min(1, t + 0.07);
    const [x2, y2] = R(t2);
    barbs.push(`M${x.toFixed(1)} ${y.toFixed(1)} L ${(x2 + nx * w1(t2) * 0.98).toFixed(1)} ${(y2 + ny * w1(t2) * 0.98).toFixed(1)}`);
    barbs.push(`M${x.toFixed(1)} ${y.toFixed(1)} L ${(x2 - nx * w2(t2) * 0.98).toFixed(1)} ${(y2 - ny * w2(t2) * 0.98).toFixed(1)}`);
  }
  return { R, outer, inner, barbs, rachis: `M${rachis.join(" L ")}` };
}

export function VertebrateFeather({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const g = featherGeom();
  const clip = `vt-zoom-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [qx, qy] = g.R(0.18);
  const [bx, by] = g.R(0.55);
  return (
    <Figure title={tx("Contour feather and down feather", "Konturfeder und Daunenfeder")} width={600} height={340} parts={FEATHER_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* zoom guide */}
        <line x1={bx + 36} y1={by + 30} x2={392} y2={196} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 4" />
        <line x1={bx + 30} y1={by + 10} x2={380} y2={110} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 4" />
        <circle cx={bx + 32} cy={by + 22} r={12} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} />

        <g data-part="vane">
          <path d={g.outer} fill={VANE} stroke={VANE_LINE} strokeWidth={1.4} />
          <path d={g.inner} fill={VANE} stroke={VANE_LINE} strokeWidth={1.4} />
          <g stroke={VANE_LINE} strokeWidth={0.9} opacity={0.55}>
            {g.barbs.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </g>
        {/* fluffy part near the quill */}
        <g stroke={VANE_LINE} strokeWidth={1} fill="none" opacity={0.7}>
          {[0, 1, 2, 3, 4].map((k) => {
            const [x, y] = g.R(0.1 + k * 0.018);
            return (
              <g key={k}>
                <path d={`M${x} ${y} c -8 -10, -18 -8, -22 -18`} />
                <path d={`M${x} ${y} c 10 6, 12 16, 22 20`} />
              </g>
            );
          })}
        </g>
        <g data-part="rachis">
          <path d={g.rachis} fill="none" stroke="var(--bio-outline)" strokeWidth={4.4} />
          <path d={g.rachis} fill="none" stroke={BONE} strokeWidth={2.2} />
        </g>
        <g data-part="calamus">
          <path d={`M66 296 L ${qx} ${qy}`} stroke="var(--bio-outline)" strokeWidth={8} />
          <path d={`M66 296 L ${qx} ${qy}`} stroke={BONE} strokeWidth={5.4} />
          <path d={`M70 292 L ${qx - 4} ${qy + 4}`} stroke="var(--bio-vacuole)" strokeWidth={1.6} />
        </g>

        {/* magnified barbs with barbules */}
        <g>
          <circle cx={470} cy={150} r={104} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.6} />
          <clipPath id={clip}>
            <circle cx={470} cy={150} r={102} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <g data-part="bows" stroke="var(--bio-petal-deep)" strokeWidth={2} fill="none">
              {[0, 1].map((r) =>
                Array.from({ length: 10 }, (_, i) => {
                  const x = 372 + i * 22;
                  const y = 196 + r * 64 - i * 12;
                  return <path key={`${r}-${i}`} d={`M${x} ${y} q 6 -22, 26 -34`} />;
                }),
              )}
            </g>
            <g data-part="hooks" stroke="var(--bio-water-deep)" strokeWidth={2} fill="none">
              {[0, 1].map((r) =>
                Array.from({ length: 10 }, (_, i) => {
                  const x = 352 + i * 22;
                  const y = 108 + r * 64 - i * 12;
                  return <path key={`${r}-${i}`} d={`M${x} ${y} l 22 30 m 0 0 c 4 3, 8 -1, 5 -5`} />;
                }),
              )}
            </g>
            <g data-part="barb" stroke={VANE_LINE} strokeWidth={6}>
              {[0, 1, 2].map((r) => (
                <line key={r} x1={340} y1={110 + r * 64} x2={600} y2={-46 + r * 64} />
              ))}
            </g>
          </g>
        </g>

        {/* down feather */}
        <g data-part="down">
          <path d="M520 318 L 512 292" stroke="var(--bio-outline)" strokeWidth={5} />
          <path d="M520 318 L 512 292" stroke={BONE} strokeWidth={3} />
          <g stroke={VANE_LINE} strokeWidth={1.3} fill="none" opacity={0.85}>
            {[-70, -45, -20, 0, 20, 45, 70, -100, 100].map((a, i) => {
              const r = (a * Math.PI) / 180;
              const ex = 512 + sin(r) * 38;
              const ey = 292 - cos(r) * 32;
              return <path key={i} d={`M512 292 Q ${(512 + ex) / 2 + (i % 2 ? 8 : -8)} ${(292 + ey) / 2}, ${ex.toFixed(1)} ${ey.toFixed(1)}`} />;
            })}
          </g>
        </g>
      </g>
    </Figure>
  );
}
