"use client";

// The brain for the "nervous-system" topic (level 2): a side view (front on the left) with the
// parts of the brain (the diencephalon lies inside and is drawn dashed) and a second set of
// labels for the cortical areas. The widget lights up the part that is busy with an activity.

import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { chain, cubic, Note, pathOf, Segmented, type Pt } from "./NerveKit";

const W = 520;
const H = 360;

const CEREBRUM =
  "M78 200 C62 150 80 85 150 58 C200 38 280 30 340 48 C400 66 450 110 452 160 C454 195 438 218 410 224 C380 228 350 224 330 222 C300 238 255 252 215 246 C180 241 158 230 156 214 C154 204 120 214 90 210 C82 208 77 205 78 200 Z";
const CEREBELLUM = "M330 226 C342 218 410 218 432 234 C448 250 436 284 398 291 C362 298 326 286 318 264 C313 248 318 233 330 226 Z";
const STEM = "M276 214 C266 236 264 260 272 278 C277 290 282 300 285 314 L307 314 C307 298 312 280 316 264 C319 248 314 228 304 214 Z";
const CORD = "M285 312 L307 312 C306 330 305 346 304 360 L288 360 C287 346 286 330 285 312 Z";
const LATERAL = "M158 207 C200 192 250 176 302 170";
const CENTRAL_PTS = cubic([288, 35], [280, 72], [262, 112], [236, 172], 18);
const shift = (pts: Pt[], dx: number): Pt[] => pts.map(([x, y]) => [x + dx, y]);
const GYRI = [
  "M108 112 C128 100 150 114 172 104",
  "M98 152 C122 140 150 158 182 146",
  "M132 78 C152 66 176 82 200 70",
  "M192 124 C208 112 220 128 236 116",
  "M118 186 C138 176 160 186 176 178",
  "M318 68 C338 84 332 106 354 116",
  "M302 120 C322 134 350 128 372 146",
  "M376 88 C394 108 410 114 422 140",
  "M206 226 C236 216 266 228 304 214",
  "M396 178 C412 170 424 188 442 180",
  "M340 176 C356 186 370 176 384 192",
  "M214 62 C226 80 218 96 232 108",
];
const FOLIA = ["M332 240 C360 232 404 232 428 244", "M324 254 C356 246 410 248 436 258", "M324 268 C354 262 404 266 430 272", "M334 281 C360 278 392 282 414 284"];

export type BrainView = "parts" | "cortex";

const PARTS: FigurePart[] = [
  { id: "grosshirn", label: tx("cerebrum", "Großhirn"), at: [168, 120], info: tx("The largest part. Consciousness, thinking, learning, memory and voluntary movements. Its surface, the cortex, is divided into areas with different jobs.", "Der größte Teil. Bewusstsein, Denken, Lernen, Gedächtnis und willkürliche Bewegungen. Seine Rinde ist in Rindenfelder mit verschiedenen Aufgaben gegliedert.") },
  { id: "zwischenhirn", label: tx("diencephalon", "Zwischenhirn"), at: [286, 178], info: tx("Lies deep inside (drawn dashed). The thalamus filters which sensory signals reach the cerebrum. The hypothalamus controls body temperature, hunger, thirst and hormones.", "Liegt tief innen (gestrichelt). Der Thalamus filtert, welche Sinnesmeldungen zum Großhirn gelangen. Der Hypothalamus regelt Körpertemperatur, Hunger, Durst und Hormone.") },
  { id: "kleinhirn", label: tx("cerebellum", "Kleinhirn"), at: [384, 262], info: tx("Coordinates movements, keeps your balance and stores practised movements (cycling, writing).", "Koordiniert Bewegungen, hält das Gleichgewicht und speichert eingeübte Bewegungsabläufe (Radfahren, Schreiben).") },
  { id: "hirnstamm", label: tx("brain stem", "Hirnstamm"), at: [292, 268], info: tx("Midbrain, pons and medulla. Controls vital processes without you noticing: breathing, heartbeat, blood pressure, swallowing and coughing.", "Mittelhirn, Brücke und verlängertes Mark. Steuert lebenswichtige Vorgänge, ohne dass du es merkst: Atmung, Herzschlag, Blutdruck, Schlucken und Husten.") },
  { id: "rueckenmark", label: tx("spinal cord", "Rückenmark"), at: [296, 340], info: tx("Carries signals between the brain and the body and switches many reflexes directly.", "Leitet Erregungen zwischen Gehirn und Körper und schaltet viele Reflexe direkt um.") },
];

const FIELDS: FigurePart[] = [
  { id: "motor", label: tx("motor cortex", "Motorisches Rindenfeld"), at: [262, 84], tag: [222, 22], info: tx("Commands for voluntary movements start here, for every part of the body.", "Hier starten die Befehle für willkürliche Bewegungen, für jeden Körperteil.") },
  { id: "sensory", label: tx("sensory cortex", "Sensorisches Rindenfeld"), at: [300, 90], tag: [340, 18], info: tx("Messages from skin and muscles arrive here: touch, pressure, temperature, pain.", "Hier kommen Meldungen von Haut und Muskeln an: Berührung, Druck, Temperatur, Schmerz.") },
  { id: "visual", label: tx("visual cortex", "Sehrinde (Sehzentrum)"), at: [434, 188], tag: [488, 210], info: tx("At the back of the head. It analyses the signals from the eyes: we see with the brain.", "Im Hinterkopf. Sie wertet die Signale der Augen aus: Gesehen wird im Gehirn.") },
  { id: "auditory", label: tx("auditory cortex", "Hörrinde (Hörzentrum)"), at: [258, 198], tag: [200, 290], info: tx("In the temporal lobe. It analyses the signals from the ears.", "Im Schläfenlappen. Sie wertet die Signale der Ohren aus.") },
  { id: "broca", label: tx("speech centre (Broca)", "Sprachzentrum (Broca)"), at: [188, 176], tag: [96, 262], info: tx("Plans the movements for speaking. A second speech centre (Wernicke) in the temporal lobe is needed to understand language.", "Hier werden die Bewegungen beim Sprechen geplant. Ein zweites Sprachzentrum (Wernicke) im Schläfenlappen brauchst du, um Sprache zu verstehen.") },
];

export const BRAIN_PARTS = PARTS;
export const BRAIN_FIELDS = FIELDS;

export function NerveBrain({ mode = "names", show, ask, highlight, legend, view = "parts", selected, onSelect }: DrawingProps & { view?: BrainView; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const all = view === "parts" ? PARTS : FIELDS;
  const parts = show ? all.filter((p) => show.includes(p.id)) : all;
  const motorBand = pathOf(chain(shift(CENTRAL_PTS, -2), [...shift(CENTRAL_PTS, -26)].reverse())) + " Z";
  const sensoryBand = pathOf(chain(shift(CENTRAL_PTS, 2), [...shift(CENTRAL_PTS, 26)].reverse())) + " Z";
  return (
    <Figure
      title={view === "parts" ? tx("The brain from the side (front on the left)", "Das Gehirn von der Seite (vorn ist links)") : tx("Areas of the cerebral cortex", "Rindenfelder des Großhirns")}
      width={W}
      height={H}
      parts={parts}
      mode={mode}
      ask={ask}
      highlight={highlight}
      legend={legend}
      selected={selected}
      onSelect={onSelect}
    >
      <defs>
        <clipPath id={`${uid}-cx`}>
          <path d={CEREBRUM} />
        </clipPath>
      </defs>
      <g data-part="rueckenmark">
        <path d={CORD} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M296 316 L296 360" stroke="var(--bio-nerve-deep)" strokeWidth={1} opacity={0.6} />
      </g>
      <g data-part="hirnstamm">
        <path d={STEM} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
        <path d="M271 262 C282 270 296 270 312 262" fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.2} opacity={0.7} />
        <path d="M268 244 C280 238 300 238 315 244" fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.2} opacity={0.7} />
      </g>
      <g data-part="kleinhirn">
        <path d={CEREBELLUM} fill="var(--bio-mito)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
        {FOLIA.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1.3} strokeLinecap="round" opacity={0.75} />
        ))}
      </g>
      <g data-part="grosshirn">
        <path d={CEREBRUM} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
        {GYRI.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
        ))}
        <path d={LATERAL} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2.4} strokeLinecap="round" />
        <path d={pathOf(CENTRAL_PTS)} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {view === "cortex" && (
        <g clipPath={`url(#${uid}-cx)`}>
          <g data-part="motor">
            <path d={motorBand} fill="var(--bio-blood)" opacity={0.5} />
          </g>
          <g data-part="sensory">
            <path d={sensoryBand} fill="var(--bio-water)" opacity={0.55} />
          </g>
          <g data-part="visual">
            <ellipse cx={446} cy={186} rx={34} ry={42} fill="var(--bio-sun)" opacity={0.6} />
          </g>
          <g data-part="auditory">
            <ellipse cx={258} cy={198} rx={32} ry={11} transform="rotate(-14 258 198)" fill="var(--bio-leaf)" opacity={0.75} />
          </g>
          <g data-part="broca">
            <ellipse cx={188} cy={177} rx={23} ry={15} fill="var(--bio-nucleus-deep)" opacity={0.45} />
          </g>
          <path d={pathOf(CENTRAL_PTS)} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )}
      {view === "parts" && (
        <g data-part="zwischenhirn">
          <ellipse cx={286} cy={178} rx={30} ry={20} fill="var(--bio-nucleus)" fillOpacity={0.7} stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeDasharray="5 4" />
        </g>
      )}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Widget: which part of the brain is busy?

type Activity = { id: string; part: string; what: Text; why: Text };

const ACT_PARTS: Activity[] = [
  { id: "balance", part: "kleinhirn", what: tx("balancing on a wall", "auf einer Mauer balancieren"), why: tx("The **cerebellum** fine-tunes your movements and keeps you in balance.", "Das **Kleinhirn** stimmt deine Bewegungen fein ab und hält dich im Gleichgewicht.") },
  { id: "breathe", part: "hirnstamm", what: tx("breathing while you sleep", "atmen, während du schläfst"), why: tx("The **brain stem** controls breathing, heartbeat and circulation, without you thinking about it.", "Der **Hirnstamm** steuert Atmung, Herzschlag und Kreislauf, ohne dass du darüber nachdenkst.") },
  { id: "learn", part: "grosshirn", what: tx("learning vocabulary", "Vokabeln lernen"), why: tx("Learning, thinking and remembering happen in the **cerebrum**. It is also where consciousness arises.", "Lernen, Denken und Erinnern: Das macht das **Großhirn**. Hier entsteht auch das Bewusstsein.") },
  { id: "sweat", part: "zwischenhirn", what: tx("sweating when it's hot", "schwitzen, wenn es heiß ist"), why: tx("The **diencephalon** (hypothalamus) keeps your body temperature at about 37 °C.", "Das **Zwischenhirn** (Hypothalamus) hält deine Körpertemperatur bei etwa 37 °C.") },
  { id: "hot", part: "rueckenmark", what: tx("pulling your hand off a hot plate", "die Hand von der heißen Herdplatte ziehen"), why: tx("A reflex: the **spinal cord** switches the signal straight back to the muscles, before your cerebrum even knows.", "Ein Reflex: Das **Rückenmark** schaltet das Signal direkt zu den Muskeln um, noch bevor dein Großhirn davon weiß.") },
];

const ACT_FIELDS: Activity[] = [
  { id: "arm", part: "motor", what: tx("raising your hand", "die Hand heben"), why: tx("The command starts in the **motor cortex**, just in front of the central sulcus.", "Der Befehl startet im **motorischen Rindenfeld**, direkt vor der Zentralfurche.") },
  { id: "touch", part: "sensory", what: tx("someone taps your shoulder", "jemand tippt dir auf die Schulter"), why: tx("Touch is registered in the **sensory cortex**, just behind the central sulcus.", "Die Berührung kommt im **sensorischen Rindenfeld** an, direkt hinter der Zentralfurche.") },
  { id: "read", part: "visual", what: tx("reading this text", "diesen Text lesen"), why: tx("The eyes only deliver signals. You see in the **visual cortex** at the back of your head.", "Die Augen liefern nur Signale. Gesehen wird in der **Sehrinde** im Hinterkopf.") },
  { id: "music", part: "auditory", what: tx("listening to music", "Musik hören"), why: tx("The signals from the ears are analysed in the **auditory cortex** in the temporal lobe.", "Die Signale der Ohren werden in der **Hörrinde** im Schläfenlappen ausgewertet.") },
  { id: "talk", part: "broca", what: tx("saying a sentence", "einen Satz sagen"), why: tx("The **speech centre (Broca)** plans the movements of tongue, lips and larynx.", "Im **Sprachzentrum (Broca)** werden die Bewegungen von Zunge, Lippen und Kehlkopf geplant.") },
];

export function NerveBrainLab() {
  const t = useText();
  const [view, setView] = useState<BrainView>("parts");
  const [picked, setPicked] = useState<string | null>(null);
  const [act, setAct] = useState<string | null>(null);
  const acts = view === "parts" ? ACT_PARTS : ACT_FIELDS;
  const current = acts.find((a) => a.id === act);
  return (
    <div className="space-y-4">
      <Segmented
        value={view}
        onChange={(v) => {
          setView(v);
          setPicked(null);
          setAct(null);
        }}
        label={tx("View", "Ansicht")}
        options={[
          { id: "parts", label: tx("Parts of the brain", "Hirnteile") },
          { id: "cortex", label: tx("Cortical areas", "Rindenfelder") },
        ]}
      />
      <NerveBrain
        mode="explore"
        view={view}
        selected={picked}
        onSelect={(id) => {
          setPicked(id);
          setAct(null);
        }}
      />
      <div className="space-y-2">
        <div className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("What's busy when you're…", "Was arbeitet, wenn du …"))}</div>
        <div className="flex flex-wrap gap-1.5">
          {acts.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={act === a.id}
              onClick={() => {
                setAct(act === a.id ? null : a.id);
                setPicked(act === a.id ? null : a.part);
              }}
              className={cn("rounded-lg border px-3 py-1.5 text-[13.5px] transition-colors", act === a.id ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {t(a.what)}
            </button>
          ))}
        </div>
      </div>
      {current && <Note id={current.id} text={current.why} accent />}
    </div>
  );
}
