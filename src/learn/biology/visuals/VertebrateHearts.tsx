"use client";

// Hearts in evolution: fish (one atrium, one ventricle, single circulation), amphibian (two atria,
// one ventricle: mixing), reptile (partial septum), bird and mammal (four chambers, double
// circulation, no mixing). Seen from the front: the heart's right side is on the left of the picture.

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";

export type HeartType = "fish" | "amph" | "rept" | "mammal";
export const HEART_TYPES: HeartType[] = ["fish", "amph", "rept", "mammal"];

export const HEART_INFO: Record<HeartType, { name: Text; group: Text; chambers: Text; circ: Text; mix: Text; result: Text }> = {
  fish: {
    name: tx("Fish", "Fisch"),
    group: tx("Fish", "Fische"),
    chambers: tx("1 atrium + 1 ventricle (two-chambered heart)", "1 Vorhof + 1 Kammer (zweikammeriges Herz)"),
    circ: tx("single: heart → gills → body → heart", "einfach: Herz → Kiemen → Körper → Herz"),
    mix: tx("none: the heart only holds oxygen-poor blood", "keine: Im Herzen ist nur sauerstoffarmes Blut"),
    result: tx("after the gill capillaries the pressure is low: the body is supplied slowly", "nach den Kiemenkapillaren ist der Druck niedrig: Der Körper wird nur langsam versorgt"),
  },
  amph: {
    name: tx("Amphibian", "Amphib"),
    group: tx("Amphibians", "Amphibien"),
    chambers: tx("2 atria + 1 ventricle (three-chambered heart)", "2 Vorhöfe + 1 Kammer (dreikammeriges Herz)"),
    circ: tx("double: pulmonary (and skin) circulation and body circulation", "doppelt: Lungen- (und Haut-)Kreislauf und Körperkreislauf"),
    mix: tx("strong: both kinds of blood meet in the one ventricle", "stark: Beide Blutsorten treffen in der einen Kammer zusammen"),
    result: tx("the body gets mixed blood; skin breathing helps out", "der Körper bekommt Mischblut; die Hautatmung hilft aus"),
  },
  rept: {
    name: tx("Reptile", "Reptil"),
    group: tx("Reptiles", "Reptilien"),
    chambers: tx("2 atria + 1 ventricle with an incomplete septum", "2 Vorhöfe + 1 Kammer mit unvollständiger Scheidewand"),
    circ: tx("double", "doppelt"),
    mix: tx("little: the partial septum separates most of the blood", "gering: Die Teilscheidewand trennt das Blut größtenteils"),
    result: tx("better supply than in amphibians (crocodiles even have a complete septum)", "bessere Versorgung als bei Amphibien (Krokodile haben sogar eine vollständige Scheidewand)"),
  },
  mammal: {
    name: tx("Bird and mammal", "Vogel und Säuger"),
    group: tx("Birds and mammals", "Vögel und Säugetiere"),
    chambers: tx("2 atria + 2 ventricles (four-chambered heart)", "2 Vorhöfe + 2 Kammern (vierkammeriges Herz)"),
    circ: tx("double, completely separated", "doppelt, vollständig getrennt"),
    mix: tx("none: complete septum", "keine: vollständige Scheidewand"),
    result: tx("oxygen-rich blood at high pressure for the body: enough for a high metabolism and a constant body temperature", "sauerstoffreiches Blut mit hohem Druck für den Körper: genug für einen hohen Stoffwechsel und eine konstante Körpertemperatur"),
  },
};

const RED = "var(--bio-blood)";
const BLUE = "var(--bio-blood-low)";
const mix = (p: number) => `color-mix(in oklab, var(--bio-blood) ${p}%, var(--bio-blood-low))`;

const P = {
  lungs: { id: "lungs", label: tx("lungs (and skin)", "Lunge (und Haut)"), at: [280, 47] as [number, number], info: tx("Capillaries where the blood takes up oxygen.", "Kapillaren, in denen das Blut Sauerstoff aufnimmt.") },
  gills: { id: "lungs", label: tx("gills", "Kiemen"), at: [280, 47] as [number, number], info: tx("Gill capillaries: the blood takes up oxygen from the water.", "Kiemenkapillaren: Das Blut nimmt Sauerstoff aus dem Wasser auf.") },
  body: { id: "body", label: tx("body", "Körper"), at: [280, 293] as [number, number], info: tx("Body capillaries: the blood gives off oxygen to the organs.", "Körperkapillaren: Das Blut gibt Sauerstoff an die Organe ab.") },
  ra: { id: "ra", label: tx("right atrium", "rechter Vorhof"), at: [205, 134] as [number, number], info: tx("Receives oxygen-poor blood from the body.", "Empfängt sauerstoffarmes Blut aus dem Körper.") },
  la: { id: "la", label: tx("left atrium", "linker Vorhof"), at: [355, 134] as [number, number], info: tx("Receives oxygen-rich blood from the lungs.", "Empfängt sauerstoffreiches Blut aus der Lunge.") },
  atrium: { id: "ra", label: tx("atrium", "Vorhof"), at: [205, 134] as [number, number], info: tx("Collects the oxygen-poor blood coming back from the body.", "Sammelt das sauerstoffarme Blut aus dem Körper.") },
};

const PARTS: Record<HeartType, FigurePart[]> = {
  fish: [P.gills, P.body, P.atrium, { id: "v", label: tx("ventricle", "Kammer"), at: [245, 197], info: tx("Pumps the oxygen-poor blood to the gills.", "Pumpt das sauerstoffarme Blut zu den Kiemen.") }],
  amph: [P.lungs, P.body, P.ra, P.la, { id: "v", label: tx("ventricle (mixed blood)", "Kammer (Mischblut)"), at: [280, 197], info: tx("Only one ventricle: oxygen-rich and oxygen-poor blood partly mix.", "Nur eine Kammer: Sauerstoffreiches und sauerstoffarmes Blut mischen sich teilweise.") }],
  rept: [P.lungs, P.body, P.ra, P.la, { id: "v", label: tx("ventricle", "Kammer"), at: [230, 205], info: tx("One ventricle, but divided in part.", "Eine Kammer, aber teilweise unterteilt.") }, { id: "septum", label: tx("incomplete septum", "unvollständige Scheidewand"), at: [280, 210], tag: [462, 214], info: tx("Separates the two kinds of blood in large part.", "Trennt die beiden Blutsorten größtenteils.") }],
  mammal: [
    P.lungs,
    P.body,
    P.ra,
    P.la,
    { id: "rv", label: tx("right ventricle", "rechte Kammer"), at: [232, 200], info: tx("Pumps oxygen-poor blood into the lungs (pulmonary circulation).", "Pumpt sauerstoffarmes Blut in die Lunge (Lungenkreislauf).") },
    { id: "lv", label: tx("left ventricle", "linke Kammer"), at: [328, 200], info: tx("Pumps oxygen-rich blood into the body (body circulation). Its wall is the thickest.", "Pumpt sauerstoffreiches Blut in den Körper (Körperkreislauf). Ihre Wand ist am dicksten.") },
    { id: "septum", label: tx("complete septum", "vollständige Scheidewand"), at: [280, 214], tag: [462, 214], info: tx("No mixing at all.", "Keinerlei Vermischung.") },
  ],
};

function Flow({ d, color, w = 9 }: { d: string; color: string; w?: number }) {
  const reduce = useReducedMotion();
  return (
    <g>
      <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 2.4} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--raised)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray="2 16"
        opacity={0.85}
        animate={reduce ? undefined : { strokeDashoffset: [0, -36] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
    </g>
  );
}

function Bed({ y, from, to, part }: { y: number; from: string; to: string; part: string }) {
  const id = `hb-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g data-part={part}>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.1" stopColor={from} />
          <stop offset="0.9" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x={200} y={y} width={160} height={50} rx={16} fill={`url(#${id})`} stroke="var(--bio-outline)" strokeWidth={1.6} />
      <g fill="none" stroke="var(--raised)" strokeWidth={1.6} opacity={0.75}>
        {[0, 1, 2].map((k) => (
          <path key={k} d={`M214 ${y + 13 + k * 12} c 12 -8, 22 8, 34 0 s 22 -8, 34 0 s 22 8, 34 0 s 22 -8, 34 0`} />
        ))}
      </g>
    </g>
  );
}

function Ventricle({ type }: { type: HeartType }) {
  const id = `hv-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (type === "fish") return <rect data-part="v" x={190} y={164} width={110} height={66} rx={22} fill={BLUE} stroke="var(--bio-outline)" strokeWidth={2} />;
  if (type === "mammal")
    return (
      <g>
        <rect data-part="rv" x={190} y={164} width={86} height={68} rx={22} fill={BLUE} stroke="var(--bio-outline)" strokeWidth={2} />
        <rect data-part="lv" x={284} y={164} width={86} height={68} rx={22} fill={RED} stroke="var(--bio-outline)" strokeWidth={3.4} />
        <rect data-part="septum" x={276} y={166} width={8} height={64} rx={3} fill="var(--bio-flesh-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      </g>
    );
  const stops = type === "amph" ? [BLUE, mix(40), mix(60), RED] : [BLUE, BLUE, RED, RED];
  const offs = type === "amph" ? [0.05, 0.4, 0.6, 0.95] : [0.05, 0.44, 0.56, 0.95];
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          {stops.map((c, i) => (
            <stop key={i} offset={offs[i]} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect data-part="v" x={190} y={164} width={180} height={68} rx={24} fill={`url(#${id})`} stroke="var(--bio-outline)" strokeWidth={2} />
      {type === "rept" && <rect data-part="septum" x={276} y={192} width={8} height={38} rx={3} fill="var(--bio-flesh-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />}
    </g>
  );
}

export function VertebrateHeart({ type = "mammal", mode = "names", show, ask, highlight, legend }: DrawingProps & { type?: HeartType }) {
  const fish = type === "fish";
  const pulm = type === "amph" ? mix(45) : type === "rept" ? mix(15) : BLUE;
  const aorta = type === "amph" ? mix(60) : type === "rept" ? mix(85) : RED;
  return (
    <Figure
      title={tx(`Heart and circulation: ${(HEART_INFO[type].name as { en: string }).en}`, `Herz und Kreislauf: ${(HEART_INFO[type].name as { de: string }).de}`)}
      width={560}
      height={330}
      parts={PARTS[type]}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <g strokeLinejoin="round">
        <Bed y={22} from={BLUE} to={RED} part="lungs" />
        <Bed y={268} from={BLUE} to={RED} part="body" />
        {/* veins from the body to the (right) atrium */}
        <Flow d="M222 268 C 150 262, 136 176, 172 134" color={BLUE} />
        {fish ? (
          <>
            <Flow d="M245 164 L 245 72" color={BLUE} />
            <Flow d="M338 72 C 440 86, 440 256, 338 268" color={RED} />
          </>
        ) : (
          <>
            <Flow d="M338 72 C 420 80, 424 120, 388 134" color={RED} />
            <Flow d="M246 164 C 248 130, 246 100, 246 72" color={pulm} />
            <Flow d="M330 232 C 332 246, 336 256, 338 268" color={aorta} />
          </>
        )}
        <rect data-part="ra" x={170} y={112} width={70} height={44} rx={16} fill={BLUE} stroke="var(--bio-outline)" strokeWidth={2} />
        {!fish && <rect data-part="la" x={320} y={112} width={70} height={44} rx={16} fill={RED} stroke="var(--bio-outline)" strokeWidth={2} />}
        <Ventricle type={type} />
        {/* atrium to ventricle */}
        <path d="M205 152 L 212 170" stroke="var(--raised)" strokeWidth={2.4} strokeLinecap="round" />
        {!fish && <path d="M355 152 L 348 170" stroke="var(--raised)" strokeWidth={2.4} strokeLinecap="round" />}
      </g>
    </Figure>
  );
}

export function VertebrateHearts() {
  const t = useText();
  const [type, setType] = useState<HeartType>("fish");
  const info = HEART_INFO[type];
  const rows: { label: Text; v: Text }[] = [
    { label: tx("Chambers", "Kammern"), v: info.chambers },
    { label: tx("Circulation", "Kreislauf"), v: info.circ },
    { label: tx("Mixing", "Durchmischung"), v: info.mix },
    { label: tx("Result", "Folge"), v: info.result },
  ];
  return (
    <div className="space-y-3">
      <div className="flex w-fit max-w-full flex-wrap rounded-full border border-line bg-surface p-0.5 text-[13.5px] font-semibold" role="tablist">
        {HEART_TYPES.map((h) => (
          <button key={h} type="button" role="tab" aria-selected={h === type} onClick={() => setType(h)} className={cn("rounded-full px-3 py-1 transition-colors", h === type ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
            {t(HEART_INFO[h].name)}
          </button>
        ))}
      </div>
      <motion.div key={type} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <VertebrateHeart type={type} mode="explore" />
      </motion.div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: RED }} /> {t(tx("oxygen-rich", "sauerstoffreich"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: BLUE }} /> {t(tx("oxygen-poor", "sauerstoffarm"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: mix(50) }} /> {t(tx("mixed", "gemischt"))}
        </span>
        <span>{t(tx("Seen from the front: the heart's right side is on the left of the picture.", "Ansicht von vorn: Die rechte Herzhälfte ist links im Bild."))}</span>
      </div>
      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map((r) => (
          <div key={t(r.label)} className="grid gap-0.5 px-4 py-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3">
            <dt className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(r.label)}</dt>
            <dd className="text-[15px] text-ink">{t(r.v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
