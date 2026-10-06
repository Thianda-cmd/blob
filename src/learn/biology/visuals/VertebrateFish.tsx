"use client";

// A bony fish (perch) seen from the side, body wall "transparent": gills under the gill cover,
// heart, liver, gut, kidney, swim bladder, backbone, lateral line, the five kinds of fins and scales.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const FISH_PARTS: FigurePart[] = [
  { id: "gills", label: tx("gills", "Kiemen"), at: [114, 186], tag: [62, 262], info: tx("Gas exchange: take oxygen out of the water and release carbon dioxide. Water and blood flow in opposite directions.", "Gasaustausch: nehmen Sauerstoff aus dem Wasser auf und geben Kohlenstoffdioxid ab. Wasser und Blut fließen gegeneinander.") },
  { id: "operculum", label: tx("gill cover", "Kiemendeckel"), at: [134, 120], tag: [150, 34], info: tx("A bony flap that protects the gills and pumps water over them.", "Knöcherne Klappe: schützt die Kiemen und pumpt Wasser über sie.") },
  { id: "heart", label: tx("heart", "Herz"), at: [146, 230], tag: [118, 296], info: tx("Pumps oxygen-poor blood to the gills: a single circulation.", "Pumpt sauerstoffarmes Blut zu den Kiemen: ein einfacher Kreislauf.") },
  { id: "liver", label: tx("liver", "Leber"), at: [186, 206], info: tx("Stores nutrients and produces bile for digestion.", "Speichert Nährstoffe und bildet Galle für die Verdauung.") },
  { id: "gut", label: tx("gut", "Darm"), at: [292, 214], info: tx("Digests the food; it ends at the anus in front of the anal fin.", "Verdaut die Nahrung; er endet am After vor der Afterflosse.") },
  { id: "kidney", label: tx("kidney", "Niere"), at: [236, 140], tag: [262, 34], info: tx("Lies right under the backbone and removes waste from the blood.", "Liegt direkt unter der Wirbelsäule und filtert Abfallstoffe aus dem Blut.") },
  { id: "bladder", label: tx("swim bladder", "Schwimmblase"), at: [262, 164], info: tx("Filled with gas. By changing the amount of gas the fish floats at any depth without swimming.", "Mit Gas gefüllt. Über die Gasmenge regelt der Fisch seinen Auftrieb und schwebt in jeder Tiefe, ohne zu schwimmen.") },
  { id: "spine", label: tx("backbone", "Wirbelsäule"), at: [402, 140], info: tx("Supports the body; the muscles that bend the tail pull on it.", "Stützt den Körper; an ihr ziehen die Muskeln, die den Schwanz hin und her schlagen.") },
  { id: "lateral", label: tx("lateral line", "Seitenlinienorgan"), at: [344, 104], info: tx("A sense organ along the side: feels currents and pressure waves from prey, enemies or obstacles, even in the dark.", "Sinnesorgan an der Körperseite: spürt Strömungen und Druckwellen von Beute, Feinden oder Hindernissen, sogar im Dunkeln.") },
  { id: "dorsal", label: tx("dorsal fin", "Rückenflosse"), at: [226, 52], info: tx("Keeps the fish upright and stops it rolling over.", "Hält den Fisch aufrecht und verhindert, dass er sich um die eigene Achse dreht.") },
  { id: "caudal", label: tx("tail fin", "Schwanzflosse"), at: [540, 168], info: tx("Drives the fish forward.", "Treibt den Fisch vorwärts an.") },
  { id: "pectoral", label: tx("pectoral fin", "Brustflosse"), at: [196, 184], tag: [196, 300], info: tx("Paired fin for steering, braking and turning.", "Paarige Flosse zum Steuern, Bremsen und Wenden.") },
  { id: "pelvic", label: tx("pelvic fin", "Bauchflosse"), at: [176, 270], info: tx("Paired fin for balance and fine steering.", "Paarige Flosse für Gleichgewicht und feines Steuern.") },
  { id: "anal", label: tx("anal fin", "Afterflosse"), at: [378, 244], info: tx("Keeps the fish stable, like a keel.", "Stabilisiert den Fisch wie ein Kiel.") },
  { id: "scales", label: tx("scales", "Schuppen"), at: [432, 170], tag: [470, 236], info: tx("Thin plates of bone, overlapping like roof tiles, covered with slimy skin: less friction in the water.", "Dünne Knochenplättchen, die sich wie Dachziegel überlappen, mit Schleimhaut überzogen: weniger Reibung im Wasser.") },
];

const OUT = "var(--bio-water-deep)";
const FIN = "color-mix(in oklab, var(--bio-water) 55%, var(--raised))";
const BODY = "color-mix(in oklab, var(--bio-water) 20%, var(--raised))";

const BODY_PATH = "M40 165 C 50 120, 110 82, 200 74 C 290 68, 380 100, 460 140 L 470 146 L 470 184 L 460 190 C 380 230, 290 258, 200 252 C 110 246, 50 210, 40 165 Z";

function Rays({ from, to }: { from: [number, number][]; to: [number, number][] }) {
  return (
    <g stroke={OUT} strokeWidth={1} opacity={0.6}>
      {from.map(([x, y], i) => (
        <line key={i} x1={x} y1={y} x2={to[i][0]} y2={to[i][1]} />
      ))}
    </g>
  );
}

export function VertebrateFish({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Bony fish (perch): inner organs", "Knochenfisch (Barsch): innere Organe")} width={600} height={320} parts={FISH_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* fins behind the body */}
        <g data-part="dorsal">
          <path d="M176 79 L 181 34 Q 189 46 197 30 Q 205 44 214 32 Q 222 46 231 36 Q 239 50 247 43 Q 255 56 263 51 Q 271 64 279 63 L 296 82 Z" fill={FIN} stroke={OUT} strokeWidth={1.8} />
          <Rays from={[[186, 78], [204, 77], [222, 77], [240, 78], [258, 79], [276, 80]]} to={[[181, 36], [197, 32], [214, 34], [231, 38], [247, 45], [263, 53]]} />
          <path d="M306 86 C 314 52, 352 44, 392 72 L 398 112 Z" fill={FIN} stroke={OUT} strokeWidth={1.8} />
          <Rays from={[[318, 88], [334, 92], [350, 97], [366, 102], [382, 107]]} to={[[318, 58], [336, 52], [354, 54], [370, 60], [386, 68]]} />
        </g>
        <g data-part="caudal">
          <path d="M462 150 C 498 122, 536 92, 576 70 C 558 120, 558 210, 576 262 C 536 240, 498 210, 462 182 Z" fill={FIN} stroke={OUT} strokeWidth={1.8} />
          <Rays from={[[470, 150], [474, 156], [476, 164], [476, 172], [474, 178], [470, 184]]} to={[[566, 80], [556, 112], [552, 146], [552, 186], [556, 222], [566, 252]]} />
        </g>
        <g data-part="anal">
          <path d="M346 236 C 356 276, 392 274, 406 214 Z" fill={FIN} stroke={OUT} strokeWidth={1.8} />
          <Rays from={[[356, 233], [370, 228], [384, 222], [396, 218]]} to={[[360, 262], [374, 266], [388, 258], [398, 240]]} />
        </g>
        <g data-part="pelvic">
          <path d="M150 244 C 152 290, 188 292, 200 252 Z" fill={FIN} stroke={OUT} strokeWidth={1.8} />
          <Rays from={[[160, 246], [172, 248], [186, 250]]} to={[[160, 280], [172, 284], [186, 274]]} />
        </g>

        {/* body */}
        <path d={BODY_PATH} fill={BODY} stroke={OUT} strokeWidth={2.4} />

        {/* scales on the tail part */}
        <g data-part="scales" fill="none" stroke={OUT} strokeWidth={1.1} opacity={0.75}>
          {[
            [412, 140, 6],
            [428, 148, 5],
            [444, 155, 4],
            [404, 158, 6],
            [420, 165, 5],
            [436, 170, 4],
            [452, 174, 3],
            [410, 178, 6],
            [426, 184, 5],
            [442, 186, 4],
            [404, 196, 5],
            [420, 200, 5],
            [436, 198, 4],
          ].map(([x, y, n]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y} a ${n + 2} ${n + 2} 0 0 1 0 ${2 * n + 4}`} />
          ))}
        </g>

        {/* backbone with vertebrae */}
        <g data-part="spine">
          <path d="M132 120 C 220 116, 340 122, 470 164" fill="none" stroke="var(--bio-outline)" strokeWidth={7} opacity={0.25} />
          {Array.from({ length: 22 }, (_, i) => {
            const t = (i + 0.5) / 22;
            const x = (1 - t) ** 3 * 132 + 3 * (1 - t) ** 2 * t * 220 + 3 * (1 - t) * t ** 2 * 340 + t ** 3 * 470;
            const y = (1 - t) ** 3 * 120 + 3 * (1 - t) ** 2 * t * 116 + 3 * (1 - t) * t ** 2 * 122 + t ** 3 * 164;
            const a = (Math.atan2(48 * t + 4, 338) * 180) / Math.PI;
            return <rect key={i} x={x - 6} y={y - 4.5} width={12} height={9} rx={3} transform={`rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.1} />;
          })}
        </g>

        {/* kidney under the backbone */}
        <path data-part="kidney" d="M160 131 C 220 132, 290 136, 340 146 C 342 150, 340 153, 336 153 C 290 146, 220 142, 162 141 C 156 139, 156 133, 160 131 Z" fill="var(--bio-mito-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />

        {/* swim bladder */}
        <g data-part="bladder">
          <path d="M166 162 C 176 147, 334 150, 350 166 C 334 182, 176 180, 166 162 Z" fill="var(--raised)" stroke={OUT} strokeWidth={1.8} />
          <path d="M190 158 C 230 153, 290 154, 320 158" fill="none" stroke={OUT} strokeWidth={1.2} opacity={0.4} />
        </g>

        {/* liver, gut */}
        <path data-part="liver" d="M160 190 C 176 180, 214 182, 226 194 C 230 206, 214 218, 196 220 C 180 222, 162 214, 158 204 C 156 198, 156 194, 160 190 Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <g data-part="gut">
          <path d="M226 200 C 250 192, 268 194, 270 206 C 272 222, 240 222, 246 232 C 252 242, 300 240, 306 226 C 312 210, 290 196, 316 194 C 340 192, 344 212, 340 232" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={9} />
          <path d="M226 200 C 250 192, 268 194, 270 206 C 272 222, 240 222, 246 232 C 252 242, 300 240, 306 226 C 312 210, 290 196, 316 194 C 340 192, 344 212, 340 232" fill="none" stroke="var(--bio-flesh)" strokeWidth={5} />
          <circle cx={341} cy={236} r={3.5} fill="var(--bio-flesh-deep)" />
        </g>

        {/* heart: two chambers behind the gills */}
        <g data-part="heart">
          <ellipse cx={156} cy={226} rx={13} ry={10} fill="var(--bio-blood-low)" stroke="var(--bio-outline)" strokeWidth={1.3} />
          <path d="M132 232 C 132 220, 146 218, 150 228 C 152 238, 140 244, 134 240 Z" fill="var(--bio-blood-low)" stroke="var(--bio-outline)" strokeWidth={1.3} />
          <path d="M136 230 C 128 224, 124 214, 120 206" fill="none" stroke="var(--bio-blood-low)" strokeWidth={4} />
        </g>

        {/* gills: four arches with filaments under the cover */}
        <g data-part="gills">
          {[0, 1, 2, 3].map((k) => {
            const x = 100 + k * 7;
            return (
              <g key={k}>
                <path d={`M${x} ${142 + k * 2} C ${x + 14} ${168}, ${x + 14} ${204}, ${x} ${228 - k * 3}`} fill="none" stroke="var(--bio-blood)" strokeWidth={3} />
                {Array.from({ length: 9 }, (_, j) => {
                  const yy = 150 + j * 8.5;
                  return <line key={j} x1={x + 6} y1={yy} x2={x + 12} y2={yy + 1} stroke="var(--bio-blood)" strokeWidth={1.4} opacity={0.75} />;
                })}
              </g>
            );
          })}
        </g>

        {/* gill cover edge */}
        <path data-part="operculum" d="M122 96 C 146 130, 148 196, 128 240 C 120 236, 116 230, 114 222 C 132 186, 130 136, 112 102 Z" fill={BODY} fillOpacity={0.35} stroke={OUT} strokeWidth={2} />

        {/* pectoral fin (on the near side) */}
        <g data-part="pectoral">
          <path d="M150 182 C 172 166, 208 168, 224 186 C 204 200, 174 200, 150 192 Z" fill={FIN} fillOpacity={0.4} stroke={OUT} strokeWidth={1.6} />
          <Rays from={[[154, 185], [154, 188], [154, 190]]} to={[[212, 177], [222, 187], [210, 196]]} />
        </g>

        {/* lateral line */}
        <path data-part="lateral" d="M134 112 C 220 92, 340 100, 466 152" fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={2.4} strokeDasharray="2 5" />

        {/* head: eye and mouth */}
        <circle cx={82} cy={140} r={13} fill="var(--raised)" stroke={OUT} strokeWidth={1.8} />
        <circle cx={80} cy={140} r={7} fill="var(--bio-outline)" />
        <circle cx={77} cy={137} r={2} fill="var(--raised)" />
        <path d="M41 166 C 48 170, 56 172, 64 170" fill="none" stroke={OUT} strokeWidth={2} />
      </g>
    </Figure>
  );
}

export const VertebrateFishExplore = () => <VertebrateFish mode="explore" />;
