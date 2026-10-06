"use client";

// Food webs of a meadow, a forest and a lake. The builder lets students drag arrows from the
// eaten to the eater (or tap one species, then the other) and then remove a species to see
// what happens first. The picture shows a finished web for tasks.

import { AnimatePresence, motion } from "motion/react";
import { Eye, RotateCcw, Spline, Trash2 } from "lucide-react";
import { useId, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useLocale } from "@/i18n/client";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import {
  HABITAT_NAME,
  ORGS,
  WEBS,
  WEB_H,
  WEB_W,
  removalEffects,
  webArrows,
  type Effect,
  type EffectWhy,
  type Habitat,
  type OrgId,
  type Web,
} from "@/learn/biology/topics/ecosystems/data";
import { cos, sin } from "@/lib/stableMath";

const NW = 106;
const NH = 30;

const key = (a: OrgId, b: OrgId) => `${a}>${b}`;

/** Where the line between two node centres leaves the first node's box. */
function edgePoint(x0: number, y0: number, x1: number, y1: number, pad = 3): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const s = Math.min(dx ? (NW / 2 + pad) / Math.abs(dx) : Infinity, dy ? (NH / 2 + pad) / Math.abs(dy) : Infinity);
  return [x0 + dx * s, y0 + dy * s];
}

function Arrow({ from, to, faded, extra, animateIn }: { from: { x: number; y: number }; to: { x: number; y: number }; faded?: boolean; extra?: boolean; animateIn?: boolean }) {
  const [x0, y0] = edgePoint(from.x, from.y, to.x, to.y);
  const [x1, y1] = edgePoint(to.x, to.y, from.x, from.y, 5);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const len = 9;
  const head = `${x1},${y1} ${x1 - len * cos(ang - 0.42)},${y1 - len * sin(ang - 0.42)} ${x1 - len * cos(ang + 0.42)},${y1 - len * sin(ang + 0.42)}`;
  const color = faded ? "var(--line-2)" : "var(--bio-outline)";
  return (
    <motion.g initial={animateIn ? { opacity: 0 } : false} animate={{ opacity: faded ? 0.5 : 1 }} transition={{ duration: 0.3 }}>
      <motion.line
        x1={x0}
        y1={y0}
        x2={x1 - 6 * cos(ang)}
        y2={y1 - 6 * sin(ang)}
        stroke={color}
        strokeWidth={1.8}
        strokeDasharray={extra ? "5 4" : undefined}
        initial={animateIn ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
      <polygon points={head} fill={color} />
    </motion.g>
  );
}

const fill = (id: OrgId) => (ORGS[id].role === "producer" ? "var(--bio-leaf)" : "var(--bio-nucleus)");
const stroke = (id: OrgId) => (ORGS[id].role === "producer" ? "var(--bio-leaf-deep)" : "var(--bio-nucleus-deep)");

function Node({
  id,
  x,
  y,
  label,
  state,
  effect,
  ask,
}: {
  id: OrgId;
  x: number;
  y: number;
  label: string;
  state?: "pending" | "gone" | "lit" | "dim";
  effect?: Effect;
  ask?: boolean;
}) {
  const long = label.length > 13;
  const gone = state === "gone";
  return (
    <motion.g
      animate={{ scale: state === "pending" ? 1.08 : 1, opacity: gone ? 0.35 : state === "dim" ? 0.5 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    >
      {(state === "pending" || state === "lit" || ask) && <rect x={x - NW / 2 - 4} y={y - NH / 2 - 4} width={NW + 8} height={NH + 8} rx={19} fill="none" stroke="var(--blob)" strokeWidth={2.5} />}
      <rect x={x - NW / 2} y={y - NH / 2} width={NW} height={NH} rx={15} fill={fill(id)} stroke={stroke(id)} strokeWidth={1.6} strokeDasharray={gone ? "4 3" : undefined} />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill="var(--ink)"
        textLength={long ? NW - 12 : undefined}
        lengthAdjust={long ? "spacingAndGlyphs" : undefined}
        style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}
      >
        {ask ? "?" : label}
      </text>
      {gone && <line x1={x - NW / 2 + 8} y1={y + NH / 2 - 6} x2={x + NW / 2 - 8} y2={y - NH / 2 + 6} stroke="var(--bio-blood)" strokeWidth={2.5} strokeLinecap="round" />}
      <AnimatePresence>
        {effect && (
          <motion.g key={effect} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <circle cx={x + NW / 2 - 4} cy={y - NH / 2 + 1} r={10} fill={effect === "up" ? "var(--bio-leaf-deep)" : effect === "down" ? "var(--bio-blood)" : "var(--bio-sun)"} stroke="var(--raised)" strokeWidth={2} />
            <EffectGlyph effect={effect} x={x + NW / 2 - 4} y={y - NH / 2 + 1} />
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  );
}

function EffectGlyph({ effect, x, y }: { effect: Effect; x: number; y: number }) {
  const c = effect === "mixed" ? "var(--bio-outline)" : "var(--raised)";
  if (effect === "mixed")
    return <path d={`M${x} ${y - 6} l-3 3 m3 -3 l3 3 M${x} ${y - 6} v12 m0 0 l-3 -3 m3 3 l3 -3`} stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  const d = effect === "up" ? `M${x} ${y + 5} v-10 m-4 4 l4 -4 l4 4` : `M${x} ${y - 5} v10 m-4 -4 l4 4 l4 -4`;
  return <path d={d} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

function WebSvg({
  web,
  arrows,
  extraKeys,
  fresh,
  states,
  effects,
  ask,
  drag,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKey,
  label,
}: {
  web: Web;
  arrows: [OrgId, OrgId][];
  extraKeys?: Set<string>;
  fresh?: string | null;
  states?: Partial<Record<OrgId, "pending" | "gone" | "lit" | "dim">>;
  effects?: Map<OrgId, { effect: Effect }>;
  ask?: OrgId;
  drag?: { from: OrgId; x: number; y: number } | null;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: (id: OrgId, e: ReactPointerEvent) => void;
  onPointerMove?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onKey?: (id: OrgId) => void;
  label: string;
}) {
  const t = useText();
  const [focused, setFocused] = useState<OrgId | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const pos = (id: OrgId) => web.nodes.find((n) => n.id === id)!;
  const from = drag ? pos(drag.from) : null;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WEB_W} ${WEB_H}`}
      className="mx-auto block h-auto w-full select-none"
      style={{ maxWidth: 560 }}
      role="img"
      aria-label={label}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDownCapture={() => setKeyboard(false)}
      onKeyDownCapture={() => setKeyboard(true)}
    >
      {arrows.map(([a, b]) => (
        <Arrow key={key(a, b)} from={pos(a)} to={pos(b)} extra={extraKeys?.has(key(a, b))} faded={states?.[a] === "gone" || states?.[b] === "gone"} animateIn={fresh === key(a, b)} />
      ))}
      {from && drag && <line x1={from.x} y1={from.y} x2={drag.x} y2={drag.y} stroke="var(--blob)" strokeWidth={2.2} strokeDasharray="5 4" strokeLinecap="round" />}
      {web.nodes.map((n) => (
        <g
          key={n.id}
          role={onKey ? "button" : undefined}
          tabIndex={onKey ? 0 : undefined}
          aria-label={onKey ? t(ORGS[n.id].name) : undefined}
          className={cn(onPointerDown && "cursor-pointer", "outline-none")}
          style={onPointerDown ? { touchAction: "none" } : undefined}
          onFocus={onKey ? () => setFocused(n.id) : undefined}
          onBlur={onKey ? () => setFocused(null) : undefined}
          onPointerDown={onPointerDown ? (e) => onPointerDown(n.id, e) : undefined}
          onKeyDown={
            onKey
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onKey(n.id);
                  }
                }
              : undefined
          }
        >
          <Node id={n.id} x={n.x} y={n.y} label={t(ORGS[n.id].name)} state={states?.[n.id] ?? (focused === n.id && keyboard ? "lit" : undefined)} effect={effects?.get(n.id)?.effect} ask={ask === n.id} />
        </g>
      ))}
    </svg>
  );
}

/** A finished food web for tasks. `arrows`: "core" (default), "all" or "none". */
export function EcoFoodWebPicture({ habitat = "meadow", arrows = "core", highlight, ask }: { habitat?: Habitat; arrows?: "core" | "all" | "none"; highlight?: OrgId[]; ask?: OrgId }) {
  const t = useText();
  const web = WEBS[habitat];
  const list = arrows === "none" ? [] : arrows === "all" ? webArrows(web) : web.core;
  const states: Partial<Record<OrgId, "lit">> = {};
  for (const h of highlight ?? []) states[h] = "lit";
  return (
    <div className="space-y-2">
      <WebSvg web={web} arrows={list} extraKeys={new Set(web.extra.map(([a, b]) => key(a, b)))} states={states} ask={ask} label={t(tx(`Food web of a ${resolveText(HABITAT_NAME[habitat], "en")}`, `Nahrungsnetz: ${resolveText(HABITAT_NAME[habitat], "de")}`))} />
      <Legend />
    </div>
  );
}

function Legend() {
  const t = useText();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-full border" style={{ background: "var(--bio-leaf)", borderColor: "var(--bio-leaf-deep)" }} />
        {t(tx("producer", "Produzent"))}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-full border" style={{ background: "var(--bio-nucleus)", borderColor: "var(--bio-nucleus-deep)" }} />
        {t(tx("consumer", "Konsument"))}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="26" height="10" aria-hidden>
          <line x1="1" y1="5" x2="19" y2="5" stroke="var(--bio-outline)" strokeWidth="1.8" />
          <polygon points="25,5 17,1.5 17,8.5" fill="var(--bio-outline)" />
        </svg>
        {t(tx("is eaten by", "wird gefressen von"))}
      </span>
    </div>
  );
}

const WHY: Record<EffectWhy, Text> = {
  prey: tx("a predator is gone, so more of them survive", "ein Fressfeind fehlt, also überleben mehr"),
  food: tx("more animals feed on it now", "wird jetzt von mehr Tieren gefressen"),
  rival: tx("less competition for its prey, so more food", "weniger Konkurrenz um die Beute, also mehr Futter"),
  predator: tx("loses part of its food and has to switch", "verliert einen Teil seiner Nahrung und muss ausweichen"),
  only: tx("loses its only food in this web", "verliert seine einzige Nahrung im Netz"),
  mixed: tx("effects pull both ways, hard to predict", "Effekte wirken gegeneinander, schwer vorherzusagen"),
};

type Note = { tone: "ok" | "bad" | "info"; text: Text };

/** The food web builder: draw the arrows, then let a species disappear. */
export function EcoFoodWebBuilder({ start = "meadow" }: { start?: Habitat }) {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [habitat, setHabitat] = useState<Habitat>(start);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [mode, setMode] = useState<"draw" | "remove">("draw");
  const [gone, setGone] = useState<OrgId | null>(null);
  const [pending, setPending] = useState<OrgId | null>(null);
  const [drag, setDrag] = useState<{ from: OrgId; sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const web = WEBS[habitat];
  const all = webArrows(web);
  const coreKeys = new Set(web.core.map(([a, b]) => key(a, b)));
  const extraKeys = new Set(web.extra.map(([a, b]) => key(a, b)));
  const coreDone = web.core.filter(([a, b]) => drawn.includes(key(a, b))).length;
  const name = (id: OrgId) => ORGS[id].name;
  const L = (x: Text) => resolveText(x, locale);
  // Names in a given language (for building both languages of a note at once).
  const L2 = (id: OrgId, l: "en" | "de") => resolveText(name(id), l);
  const en = (x: Text) => resolveText(x, "en");
  const de = (x: Text) => resolveText(x, "de");

  const switchHabitat = (h: Habitat) => {
    setHabitat(h);
    setDrawn([]);
    setGone(null);
    setPending(null);
    setNote(null);
    setMode("draw");
  };

  const attempt = (a: OrgId, b: OrgId) => {
    if (a === b) return;
    const k = key(a, b);
    if (drawn.includes(k)) {
      setNote({ tone: "info", text: tx("You already drew that arrow.", "Diesen Pfeil hast du schon.") });
      return;
    }
    const pair = tx(`"${L2(a, "en")} → ${L2(b, "en")}"`, `„${L2(a, "de")} → ${L2(b, "de")}“`);
    if (coreKeys.has(k) || extraKeys.has(k)) {
      const next = [...drawn, k];
      setDrawn(next);
      setFresh(k);
      const done = web.core.every(([x, y]) => next.includes(key(x, y)));
      if (done && coreKeys.has(k))
        setNote({
          tone: "ok",
          text:
            habitat === "meadow"
              ? tx("Web complete! Now switch to \"Remove a species\" and let the fox disappear.", "Netz komplett! Schalte jetzt auf „Art entfernen“ und lass den Fuchs verschwinden.")
              : tx("Web complete! Now switch to \"Remove a species\" and see what happens.", "Netz komplett! Schalte jetzt auf „Art entfernen“ und schau, was passiert."),
        });
      else
        setNote({
          tone: "ok",
          text: extraKeys.has(k)
            ? tx(`True as well! ${en(pair)} also happens, an extra link.`, `Stimmt auch! ${de(pair)} gibt es ebenfalls, eine zusätzliche Verbindung.`)
            : tx(`Right! ${en(pair)}: the arrow points to the eater.`, `Richtig! ${de(pair)}: Der Pfeil zeigt zum Fresser.`),
        });
      return;
    }
    if (coreKeys.has(key(b, a)) || extraKeys.has(key(b, a))) {
      setNote({
        tone: "bad",
        text: tx(
          `Other way round! The arrow goes from the eaten to the eater: "${L2(b, "en")} → ${L2(a, "en")}". It shows where the energy flows.`,
          `Andersrum! Der Pfeil zeigt vom Gefressenen zum Fresser: „${L2(b, "de")} → ${L2(a, "de")}“. Er zeigt, wohin die Energie fließt.`,
        ),
      });
      return;
    }
    if (ORGS[b].role === "producer") {
      setNote({ tone: "bad", text: tx("Plants don't eat other living things: they make their own food by photosynthesis.", "Pflanzen fressen keine anderen Lebewesen: Sie stellen ihre Nährstoffe durch Fotosynthese selbst her.") });
      return;
    }
    setNote({ tone: "bad", text: tx(`${en(pair)} doesn't happen in this web. Who eats whom?`, `${de(pair)} gibt es in diesem Netz nicht. Wer frisst wen?`) });
  };

  const tap = (id: OrgId) => {
    if (mode === "remove") {
      setGone(gone === id ? null : id);
      return;
    }
    if (pending && pending !== id) {
      attempt(pending, id);
      setPending(null);
    } else setPending(pending === id ? null : id);
  };

  const toSvg = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const hit = (x: number, y: number) => web.nodes.find((n) => Math.abs(n.x - x) <= NW / 2 + 4 && Math.abs(n.y - y) <= NH / 2 + 6)?.id ?? null;

  const down = (id: OrgId, e: ReactPointerEvent) => {
    if (mode === "remove") return tap(id);
    const p = toSvg(e);
    if (!p) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ from: id, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false });
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    if (p) setDrag({ ...drag, x: p.x, y: p.y, moved: drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6 });
  };
  const up = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    const target = p ? hit(p.x, p.y) : null;
    const from = drag.from;
    setDrag(null);
    if (target && target !== from) {
      setPending(null);
      attempt(from, target);
    } else if (target === from) tap(from);
  };

  const effects = mode === "remove" && gone ? removalEffects(web, gone) : undefined;
  const states: Partial<Record<OrgId, "pending" | "gone">> = {};
  if (pending && mode === "draw") states[pending] = "pending";
  if (drag && mode === "draw") states[drag.from] = "pending";
  if (gone && mode === "remove") states[gone] = "gone";

  const shown: [OrgId, OrgId][] = mode === "remove" ? all : all.filter(([a, b]) => drawn.includes(key(a, b)));
  const effectList = effects ? [...effects].sort((a, b) => ["up", "down", "mixed"].indexOf(a[1].effect) - ["up", "down", "mixed"].indexOf(b[1].effect)) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["meadow", "forest", "lake"] as Habitat[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => switchHabitat(h)}
              className={cn("relative h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors", h === habitat ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {h === habitat && <motion.span layoutId={`${scope}-habitat`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
              <span className="relative">{t(capital(HABITAT_NAME[h]))}</span>
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-line p-0.5">
          {(["draw", "remove"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setPending(null);
                setNote(null);
              }}
              className={cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors", mode === m ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:text-ink")}
            >
              {m === "draw" ? <Spline className="size-3.5" /> : <Trash2 className="size-3.5" />}
              {m === "draw" ? t(tx("Draw arrows", "Pfeile ziehen")) : t(tx("Remove a species", "Art entfernen"))}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 py-3">
        <WebSvg
          web={web}
          arrows={shown}
          extraKeys={extraKeys}
          fresh={fresh}
          states={states}
          effects={effects}
          drag={drag && drag.moved ? drag : null}
          svgRef={svgRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onKey={tap}
          label={t(tx("Food web builder", "Nahrungsnetz-Baukasten"))}
        />
        <Legend />
      </div>

      {mode === "draw" ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto text-[13.5px] text-ink-2">
            <span className="font-semibold text-ink tabular-nums">
              {coreDone}/{web.core.length}
            </span>{" "}
            {t(tx("arrows", "Pfeile"))}
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-hover">
              <motion.div className="h-full rounded-full bg-blob" animate={{ width: `${(coreDone / web.core.length) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDrawn(web.core.map(([a, b]) => key(a, b)));
              setFresh(null);
              setNote({ tone: "info", text: tx("Here is the whole web. Dashed arrows would also be right.", "Hier ist das ganze Netz. Gestrichelte Pfeile wären auch richtig.") });
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Eye className="size-4" /> {t(tx("Show the web", "Netz zeigen"))}
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawn([]);
              setPending(null);
              setNote(null);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <RotateCcw className="size-4" /> {t(tx("Start again", "Von vorn"))}
          </button>
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {mode === "draw" ? (
          <motion.p
            key={note ? `n-${drawn.length}-${resolveText(note.text, "en").slice(0, 24)}` : "help"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            aria-live="polite"
            className={cn(
              "rounded-xl px-4 py-3 text-[14.5px] leading-relaxed",
              note?.tone === "ok" ? "bg-blob-soft/70 text-ink" : note?.tone === "bad" ? "border border-line bg-surface text-ink" : "bg-surface text-ink-2",
            )}
          >
            {note
              ? t(note.text)
              : t(
                  tx(
                    "Drag from the one that is eaten to the one that eats it (or tap one, then the other). Start with the plants at the bottom!",
                    "Zieh vom Gefressenen zu dem, der es frisst (oder tippe erst das eine, dann das andere an). Fang unten bei den Pflanzen an!",
                  ),
                )}
          </motion.p>
        ) : (
          <motion.div key={`remove-${gone ?? "none"}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }} aria-live="polite" className="rounded-xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
            {!gone ? (
              t(habitat === "meadow" ? tx("Tap a species that should disappear. Try the fox!", "Tippe eine Art an, die verschwinden soll. Probier den Fuchs!") : tx("Tap a species that should disappear.", "Tippe eine Art an, die verschwinden soll."))
            ) : effectList.length === 0 ? (
              t(tx("Nothing in this web depends directly on it.", "Davon hängt in diesem Netz direkt nichts ab."))
            ) : (
              <>
                <span className="font-semibold text-ink">{t(tx(`Without ${L2(gone, "en")}:`, `Ohne ${L2(gone, "de")}:`))}</span>
                <ul className="mt-1.5 space-y-1">
                  {effectList.map(([id, e]) => (
                    <li key={id} className="flex gap-2">
                      <span className={cn("w-4 shrink-0 text-center font-bold", e.effect === "up" ? "text-ok" : e.effect === "down" ? "text-danger" : "text-ink-3")}>{e.effect === "up" ? "↑" : e.effect === "down" ? "↓" : "↕"}</span>
                      <span>
                        <span className="font-medium text-ink">{L(name(id))}</span>: {L(WHY[e.why])}
                      </span>
                    </li>
                  ))}
                </ul>
                <span className="mt-2 block text-[13px] text-ink-3">
                  {t(tx("These are the first effects. In a web many animals can switch to other food, so things often settle into a new balance.", "Das sind die ersten Folgen. In einem Netz können viele Tiere auf andere Nahrung ausweichen, deshalb pendelt sich oft ein neues Gleichgewicht ein."))}
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const capital = (x: Text): Text => tx(cap(resolveText(x, "en")), resolveText(x, "de"));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
