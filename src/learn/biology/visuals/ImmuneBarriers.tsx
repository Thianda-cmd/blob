"use client";

// The body's first line of defence (äußere Barrieren) on a schematic upper body: skin, tears,
// mucous membranes, saliva, the cilia of the windpipe (with a magnified, animated inset) and
// stomach acid. Works as an explore widget and as a task picture.

import { motion, useReducedMotion } from "motion/react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const BARRIER_PARTS: FigurePart[] = [
  { id: "skin", label: tx("skin", "Haut"), at: [93, 262], tag: [34, 262], info: tx("A tight barrier: pathogens can't get through the horny outer layer. Its slightly acidic surface (acid mantle) slows bacteria down.", "Eine dichte Schranke: Durch die verhornte Oberhaut kommen Erreger nicht hindurch. Ihr leicht saurer Säureschutzmantel hemmt Bakterien.") },
  { id: "tears", label: tx("tears", "Tränenflüssigkeit"), at: [214, 94], tag: [296, 62], info: tx("Rinse the eye and contain lysozyme, an enzyme that breaks down the cell wall of bacteria.", "Spülen das Auge und enthalten Lysozym, ein Enzym, das die Zellwand von Bakterien auflöst.") },
  { id: "mucosa", label: tx("mucous membranes (nose, throat)", "Schleimhäute (Nase, Rachen)"), at: [190, 101], tag: [98, 72], info: tx("Covered with mucus that traps dust and pathogens. Hairs in the nose filter the air you breathe.", "Mit Schleim bedeckt, der Staub und Erreger festhält. Nasenhaare filtern die Atemluft.") },
  { id: "saliva", label: tx("saliva", "Speichel"), at: [190, 118], tag: [98, 128], info: tx("Rinses the mouth and also contains lysozyme.", "Spült den Mund und enthält ebenfalls Lysozym.") },
  { id: "cilia", label: tx("cilia in the windpipe", "Flimmerhärchen der Luftröhre"), at: [190, 196], tag: [330, 150], info: tx("Beat all the time and carry the mucus with the trapped pathogens up to the throat, where it is swallowed or coughed up.", "Schlagen ständig und befördern den Schleim mit den gefangenen Erregern nach oben zum Rachen. Dort wird er verschluckt oder abgehustet.") },
  { id: "acid", label: tx("stomach acid", "Magensäure"), at: [240, 382], tag: [318, 412], info: tx("Hydrochloric acid in the stomach (pH 1 to 2) kills most pathogens in food.", "Salzsäure im Magen (pH 1 bis 2) tötet die meisten Erreger in der Nahrung ab.") },
];

const CILIA = Array.from({ length: 9 }, (_, i) => 172 + i * 9);

function Inset() {
  const reduce = useReducedMotion();
  return (
    <g>
      <defs>
        <clipPath id="immune-barrier-inset">
          <circle cx={318} cy={214} r={42} />
        </clipPath>
      </defs>
      <line x1={198} y1={196} x2={277} y2={208} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 3" />
      <circle cx={318} cy={214} r={43} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.4} />
      <g clipPath="url(#immune-barrier-inset)">
        {/* epithelium (wall of the windpipe) on the left, lumen on the right */}
        <rect x={270} y={160} width={26} height={110} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} />
        {[172, 190, 208, 226, 244].map((y) => (
          <line key={y} x1={270} y1={y} x2={296} y2={y} stroke="var(--bio-flesh-deep)" strokeWidth={1} />
        ))}
        {/* mucus layer */}
        <rect x={310} y={160} width={16} height={110} fill="var(--bio-vacuole)" opacity={0.95} />
        {CILIA.map((y, i) => (
          <motion.line
            key={y}
            x1={296}
            y1={y}
            x2={312}
            y2={y - 3}
            stroke="var(--bio-flesh-deep)"
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ transformBox: "view-box", transformOrigin: `296px ${y}px` }}
            animate={reduce ? undefined : { rotate: [12, -28, 12] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <motion.g key={i} initial={{ y: 40 - i * 34 }} animate={reduce ? undefined : { y: [60 - i * 34, -50 - i * 34] }} transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}>
            <rect x={312} y={212} width={11} height={6} rx={3} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={1.1} />
          </motion.g>
        ))}
        <path d="M 340 238 L 340 196 M 334 204 L 340 194 L 346 204" fill="none" stroke="var(--blob)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** A schematic upper body with the outer barriers against pathogens. */
export function ImmuneBarriers({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("The body's barriers", "Die Schutzbarrieren des Körpers")} width={380} height={450} parts={BARRIER_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="skin">
        <path
          d="M 120 164 C 150 154 230 154 260 164 C 284 172 292 192 290 222 L 280 420 C 279 434 270 442 258 442 L 122 442 C 110 442 101 434 100 420 L 90 222 C 88 192 96 172 120 164 Z"
          fill="var(--bio-flesh)"
          stroke="var(--bio-flesh-deep)"
          strokeWidth={4}
        />
        <rect x={172} y={128} width={36} height={34} fill="var(--bio-flesh)" />
        <path d="M 172 128 L 172 160 M 208 128 L 208 160" stroke="var(--bio-flesh-deep)" strokeWidth={4} />
        <ellipse cx={190} cy={82} rx={48} ry={56} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={4} />
        <ellipse cx={172} cy={74} rx={6} ry={4.5} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        <circle cx={172} cy={74} r={2.2} fill="var(--bio-outline)" />
        <ellipse cx={208} cy={74} rx={6} ry={4.5} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        <circle cx={208} cy={74} r={2.2} fill="var(--bio-outline)" />
      </g>
      {/* lungs and food pipe (context, not a barrier) */}
      <path d="M 180 206 C 150 196 118 214 116 262 C 114 300 122 330 150 334 C 172 336 178 320 178 296 Z" fill="var(--bio-petal)" fillOpacity={0.35} stroke="var(--bio-petal-deep)" strokeOpacity={0.5} strokeWidth={1.6} />
      <path d="M 200 206 C 230 196 262 214 264 262 C 266 296 258 318 240 324 C 222 330 204 318 202 296 Z" fill="var(--bio-petal)" fillOpacity={0.35} stroke="var(--bio-petal-deep)" strokeOpacity={0.5} strokeWidth={1.6} />
      <path d="M 199 160 L 201 300 Q 203 330 222 336" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={5} strokeOpacity={0.45} strokeLinecap="round" />
      <g data-part="cilia">
        <rect x={182} y={146} width={16} height={84} rx={4} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.4} />
        {[154, 164, 174, 184, 194, 204, 214, 224].map((y) => (
          <line key={y} x1={183} y1={y} x2={197} y2={y} stroke="var(--bio-outline)" strokeWidth={1} opacity={0.6} />
        ))}
        <path d="M 186 228 Q 178 242 164 252 M 194 228 Q 202 242 216 252" fill="none" stroke="var(--bio-outline)" strokeWidth={5} strokeLinecap="round" opacity={0.75} />
        <Inset />
      </g>
      <g data-part="acid">
        <path d="M 216 336 C 198 352 206 400 240 400 C 270 400 278 368 264 346 C 256 334 242 336 236 346 C 230 354 224 346 224 336 Z" fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={2} />
        <path d="M 208 378 Q 222 372 238 378 T 270 374 L 268 384 C 262 396 252 400 240 400 C 222 400 212 392 208 378 Z" fill="var(--bio-c)" opacity={0.75} />
        {[
          [230, 366],
          [248, 362],
          [240, 356],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill="var(--bio-c)" />
        ))}
      </g>
      <g data-part="tears">
        <path d="M 214 84 C 210 92 210 98 214 99 C 218 98 218 92 214 84 Z" fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1} />
      </g>
      <g data-part="mucosa">
        <path d="M 190 80 L 183 100 Q 190 105 197 100" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx={186} cy={101} rx={3} ry={2} fill="var(--bio-petal-deep)" />
        <ellipse cx={194} cy={101} rx={3} ry={2} fill="var(--bio-petal-deep)" />
      </g>
      <g data-part="saliva">
        <path d="M 176 114 Q 190 126 204 114 Q 190 120 176 114 Z" fill="var(--bio-petal-deep)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
        <circle cx={203} cy={123} r={2} fill="var(--bio-water)" />
      </g>
    </Figure>
  );
}
