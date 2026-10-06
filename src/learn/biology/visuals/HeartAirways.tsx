"use client";

// The airways (level 1): head in profile (nose, mouth, pharynx, larynx), then the chest from
// the front (trachea, bronchi, both lungs, diaphragm) and a zoom on a cluster of alveoli.
// The right lung (three lobes) is on the LEFT of the picture, the left lung (two lobes) has a
// notch for the heart.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const W = 480;
const H = 470;

const PARTS: FigurePart[] = [
  { id: "nose", label: tx("nose (nasal cavity)", "Nase (Nasenhöhle)"), at: [204, 92], tag: [120, 70], info: tx("Warms, moistens and cleans the air: hairs and mucus catch dust.", "Wärmt, befeuchtet und reinigt die Luft: Härchen und Schleim fangen Staub ab.") },
  { id: "mouth", label: tx("oral cavity", "Mundhöhle"), at: [204, 127], tag: [120, 134], info: tx("You can breathe through your mouth too, but then the air is not warmed and cleaned as well.", "Du kannst auch durch den Mund atmen, dann wird die Luft aber schlechter angewärmt und gereinigt.") },
  { id: "pharynx", label: tx("pharynx (throat)", "Rachen"), at: [257, 146], tag: [330, 120], info: tx("Here the airway and the food pipe cross.", "Hier kreuzen sich Luftweg und Speiseweg.") },
  { id: "larynx", label: tx("larynx", "Kehlkopf"), at: [236, 186], tag: [170, 196], info: tx("Its epiglottis closes the windpipe when you swallow. The vocal cords sit here.", "Sein Kehldeckel verschließt beim Schlucken die Luftröhre. Hier sitzen die Stimmbänder.") },
  { id: "trachea", label: tx("windpipe (trachea)", "Luftröhre"), at: [240, 240], tag: [306, 232], info: tx("A tube held open by rings of cartilage. Tiny hairs (cilia) carry mucus and dust upwards.", "Ein Rohr, das Knorpelspangen offen halten. Flimmerhärchen befördern Schleim und Staub nach oben.") },
  { id: "bronchi", label: tx("bronchi", "Bronchien"), at: [210, 292], tag: [160, 258], info: tx("The windpipe splits into two bronchi. In the lungs they branch finer and finer, like a tree.", "Die Luftröhre teilt sich in zwei Bronchien. In der Lunge verzweigen sie sich immer feiner, wie ein Baum.") },
  { id: "lung", label: tx("lung", "Lungenflügel"), at: [126, 384], tag: [70, 384], info: tx("Right lung with three lobes, left lung with two. Each is a sponge of millions of alveoli.", "Rechter Lungenflügel mit drei Lappen, linker mit zwei. Jeder ist ein Schwamm aus Millionen Lungenbläschen.") },
  { id: "alveoli", label: tx("alveoli (air sacs)", "Lungenbläschen"), at: [424, 300], tag: [440, 238], info: tx("Tiny air sacs wrapped in capillaries: oxygen passes into the blood, carbon dioxide into the air.", "Winzige Bläschen, umgeben von Kapillaren: Sauerstoff geht ins Blut über, Kohlenstoffdioxid in die Luft.") },
  { id: "diaphragm", label: tx("diaphragm", "Zwerchfell"), at: [176, 432], tag: [120, 456], info: tx("A muscle under the lungs. When it contracts, the chest gets bigger and air flows in.", "Ein Muskel unter der Lunge. Zieht er sich zusammen, wird der Brustraum größer und Luft strömt ein.") },
];

const HEAD =
  "M292 200 L290 150 C316 132 322 92 314 62 C304 22 262 4 226 8 C196 12 176 30 172 56 C170 66 168 72 166 78 L150 104 C148 108 152 110 158 110 L164 112 C162 118 160 122 162 126 C160 130 162 134 164 136 C162 146 168 156 180 158 C196 160 212 158 222 164 L226 200 Z";
const RIGHT_LUNG = "M174 214 C150 222 126 262 116 316 C108 362 108 410 114 436 C140 428 176 424 214 432 C222 400 224 340 226 300 C226 272 216 250 208 234 C200 222 188 212 174 214 Z";
const LEFT_LUNG = "M306 214 C330 222 350 262 358 316 C366 362 366 410 360 436 C336 428 312 426 296 432 C292 416 280 404 270 396 C262 380 262 360 268 344 C262 320 256 300 256 284 C256 262 262 248 272 234 C280 222 292 212 306 214 Z";

/** Bronchial tree: [path, width]. */
const TREE: [string, number][] = [
  ["M240 272 L206 300", 13],
  ["M240 272 L280 302", 12],
  ["M206 300 L184 330 L168 372", 8],
  ["M206 300 L196 270 L176 248", 6],
  ["M184 330 L150 348", 5],
  ["M168 372 L146 404", 4.5],
  ["M168 372 L188 410", 4.5],
  ["M150 348 L130 336", 3],
  ["M280 302 L300 336 L312 380", 7.5],
  ["M280 302 L300 268 L314 246", 6],
  ["M300 336 L330 350", 4.5],
  ["M312 380 L334 410", 4],
  ["M312 380 L296 412", 3.5],
  ["M330 350 L346 338", 3],
];

export function HeartAirways({ mode = "names", show, ask, highlight, legend, breath = 0 }: DrawingProps & { breath?: number }) {
  const s = 1 + 0.05 * breath;
  const lungT = `translate(240 300) scale(${s.toFixed(3)} ${(1 + 0.07 * breath).toFixed(3)}) translate(-240 -300)`;
  return (
    <Figure title={tx("The airways", "Die Atemwege")} width={W} height={H} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* Head in profile */}
      <path d={HEAD} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
      {/* food pipe behind the windpipe */}
      <path d="M262 150 L264 200" stroke="var(--bio-flesh-deep)" strokeWidth={12} opacity={0.45} strokeLinecap="round" />
      <g data-part="nose">
        <path d="M156 106 C168 92 190 84 214 82 C232 80 246 84 254 92 L254 104 C236 102 200 104 158 110 Z" fill="var(--bio-vacuole)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
        <path d="M196 90 C204 86 214 88 222 92 M206 98 C214 94 226 95 234 99 M226 88 C234 86 242 88 246 92" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <g data-part="mouth">
        <path d="M164 122 C190 117 230 117 252 121 L252 133 C224 137 194 135 164 131 Z" fill="var(--bio-vacuole)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
        <path d="M176 134 C200 126 228 126 250 130" fill="none" stroke="var(--bio-petal)" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      </g>
      <g data-part="pharynx">
        <path d="M248 88 C260 88 268 96 268 108 L266 172 L248 172 L250 132 C251 118 250 100 248 88 Z" fill="var(--bio-vacuole)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
      </g>
      <g data-part="larynx">
        <path d="M228 170 L252 170 L254 200 L226 200 Z" fill="var(--bio-vacuole)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
        <path d="M226 176 C220 182 220 190 226 196" fill="none" stroke="var(--bio-bone)" strokeWidth={5} strokeLinecap="round" />
        <path d="M226 176 C220 182 220 190 226 196" fill="none" stroke="var(--bio-outline)" strokeWidth={1} />
        <path d="M250 168 L258 158" stroke="var(--bio-flesh-deep)" strokeWidth={3} strokeLinecap="round" />
        <path d="M230 188 L238 186 M250 188 L242 186" stroke="var(--bio-flesh-deep)" strokeWidth={2} strokeLinecap="round" />
      </g>

      {/* Chest from the front */}
      <path d="M200 432 C210 380 226 366 248 360 C270 366 284 380 292 410 C280 432 230 444 200 432 Z" fill="var(--bio-blood)" opacity={0.3} />
      <g transform={lungT}>
        <g data-part="lung">
          <path d={RIGHT_LUNG} fill="var(--bio-petal)" opacity={0.55} stroke="var(--bio-petal-deep)" strokeWidth={2} />
          <path d={LEFT_LUNG} fill="var(--bio-petal)" opacity={0.55} stroke="var(--bio-petal-deep)" strokeWidth={2} />
          <path d={RIGHT_LUNG} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={2} />
          <path d={LEFT_LUNG} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={2} />
          {/* fissures between the lobes */}
          <path d="M118 300 C150 312 186 318 222 330 M146 350 C170 352 196 350 220 356" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.4} strokeDasharray="5 4" />
          <path d="M268 300 C300 316 330 340 360 372" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.4} strokeDasharray="5 4" />
        </g>
        <g data-part="bronchi">
          {TREE.map(([d, w]) => (
            <g key={d}>
              <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 2.6} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="var(--bio-bone)" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </g>
      </g>
      <g data-part="trachea">
        <rect x={228} y={198} width={24} height={78} rx={4} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.6} />
        {[206, 216, 226, 236, 246, 256, 266].map((y) => (
          <path key={y} d={`M229 ${y} L251 ${y}`} stroke="var(--bio-flesh-deep)" strokeWidth={1.6} />
        ))}
      </g>
      <g data-part="diaphragm">
        <path d="M96 452 C130 430 196 418 240 436 C284 418 350 430 384 452" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={8} strokeLinecap="round" />
      </g>

      {/* Zoom on alveoli */}
      <path d="M334 410 L388 336 M346 398 L430 352" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 4" fill="none" />
      <circle cx={424} cy={300} r={54} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.4} />
      <g data-part="alveoli">
        <path d="M384 270 L410 290" stroke="var(--bio-outline)" strokeWidth={10} strokeLinecap="round" />
        <path d="M384 270 L410 290" stroke="var(--bio-bone)" strokeWidth={7} strokeLinecap="round" />
        {[
          [420, 292, 15],
          [442, 284, 13],
          [446, 308, 14],
          [424, 318, 13],
          [404, 310, 11],
          [438, 330, 10],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-vacuole)" stroke="var(--bio-petal-deep)" strokeWidth={2} />
        ))}
        <path d="M398 296 C414 280 430 300 446 288 C456 282 462 296 466 300" fill="none" stroke="var(--bio-blood-low)" strokeWidth={2.4} />
        <path d="M400 326 C416 312 434 334 450 318 C458 312 464 320 468 318" fill="none" stroke="var(--bio-blood)" strokeWidth={2.4} />
      </g>
    </Figure>
  );
}
