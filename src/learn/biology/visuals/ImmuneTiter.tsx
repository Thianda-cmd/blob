"use client";

// Antibody concentration over time (Antikörpertiter): the primary and the secondary immune
// response. The widget plays the days forward: an infection on day 40, with or without a
// vaccination on day 0 (and a serum for passive immunisation at level 2). Level 3 shows IgM and
// IgG on a log scale and a second contact with the same or a new antigen. `ImmuneTiterGraph`
// draws fixed versions of these curves for tasks.

import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { Pause, Play, RotateCcw, Syringe } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { CellIcon } from "./ImmuneCells";

// ---------------------------------------------------------------------------
// Curve model

/** A wave: starts `lag` days after `at`, rises for `up` days to `peak`, then falls towards `floor`·peak. */
type Wave = { at: number; lag: number; up: number; peak: number; floor: number; down: number };
const wave = (w: Wave) => (t: number) => {
  const u = t - w.at - w.lag;
  if (u <= 0) return 0;
  if (u <= w.up) {
    const x = u / w.up;
    return w.peak * x * x * (3 - 2 * x);
  }
  const x = (u - w.up) / w.down;
  return w.peak * (w.floor + (1 - w.floor) * Math.exp(-(x * x) / (1 + x)));
};
/** Ready-made antibodies (serum): there at once, then broken down. */
const serum = (at: number, peak: number, half: number) => (t: number) => (t < at ? 0 : peak * Math.min(1, (t - at) / 0.6) * Math.pow(0.5, (t - at) / half));
type Fn = (t: number) => number;
const sum =
  (...fs: Fn[]): Fn =>
  (t) =>
    fs.reduce((a, g) => a + g(t), 0);
const max =
  (...fs: Fn[]): Fn =>
  (t) =>
    Math.max(...fs.map((g) => g(t)));

const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Axes

type Box = { x0: number; x1: number; y0: number; y1: number; days: number; ymax: number; log?: boolean };
const X = (b: Box, d: number) => r1(b.x0 + (d / b.days) * (b.x1 - b.x0));
const Y = (b: Box, v: number) => r1(b.y1 - (Math.min(v, b.ymax) / b.ymax) * (b.y1 - b.y0));
function pathOf(b: Box, fn: Fn, from = 0, to = b.days) {
  let d = "";
  const n = 140;
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    d += `${i ? "L" : "M"} ${X(b, t)} ${Y(b, fn(t))} `;
  }
  return d.trim();
}

function Axes({ b, yLabel, xLabel, ticks }: { b: Box; yLabel: Text; xLabel: Text; ticks: number[] }) {
  const t = useText();
  const id = useId().replace(/:/g, "");
  return (
    <g style={{ fontFamily: "var(--font-sans)" }}>
      <defs>
        <marker id={`${id}-a`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {b.log &&
        [0, 1, 2, 3, 4, 5].map((e) => (
          <g key={e}>
            <line x1={b.x0} x2={b.x1} y1={Y(b, e)} y2={Y(b, e)} stroke="var(--line)" strokeWidth={1} />
            <text x={b.x0 - 7} y={Y(b, e) + 4} textAnchor="end" fontSize={12} fill="var(--ink-3)">
              10
              <tspan fontSize={9} dy={-5}>
                {e}
              </tspan>
            </text>
          </g>
        ))}
      <line x1={b.x0} y1={b.y1} x2={b.x0} y2={b.y0 - 14} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-a)`} />
      <line x1={b.x0} y1={b.y1} x2={b.x1 + 14} y2={b.y1} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-a)`} />
      {ticks.map((d) => (
        <g key={d}>
          <line x1={X(b, d)} x2={X(b, d)} y1={b.y1} y2={b.y1 + 5} stroke="var(--ink-3)" strokeWidth={1.2} />
          <text x={X(b, d)} y={b.y1 + 19} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
            {d}
          </text>
        </g>
      ))}
      <text x={b.x0 + 8} y={b.y0 - 6} fontSize={13} fill="var(--ink-2)">
        {t(yLabel)}
      </text>
      <text x={b.x1 + 12} y={b.y1 + 36} textAnchor="end" fontSize={13} fill="var(--ink-2)">
        {t(xLabel)}
      </text>
    </g>
  );
}

function EventMark({ b, day, label, color = "var(--ink-2)", icon, left }: { b: Box; day: number; label: Text; color?: string; icon?: "virus" | "syringe" | "serum"; left?: boolean }) {
  const t = useText();
  const x = X(b, day);
  return (
    <g style={{ fontFamily: "var(--font-sans)" }}>
      <line x1={x} x2={x} y1={b.y0 + 6} y2={b.y1} stroke={color} strokeWidth={1.3} strokeDasharray="4 4" />
      {icon === "virus" && <circle cx={x} cy={b.y0 + 4} r={5} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.4} />}
      {icon === "syringe" && <rect x={x - 5} y={b.y0} width={10} height={8} rx={2} fill="var(--blob)" />}
      {icon === "serum" && <rect x={x - 5} y={b.y0} width={10} height={8} rx={4} fill="var(--bio-water-deep)" />}
      <text x={left ? x - 6 : x + 6} y={b.y0 + 22} fontSize={12} fill={color} textAnchor={left ? "end" : "start"}>
        {t(label)}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scenarios for the widget

type Scenario = "none" | "vaccine" | "serum";
const INFECTION = 40;
const SICK = 0.35;

const PATHOGEN: Record<Scenario, Fn> = {
  none: wave({ at: INFECTION, lag: 0, up: 8, peak: 0.92, floor: 0, down: 2.5 }),
  vaccine: wave({ at: INFECTION, lag: 0, up: 2.5, peak: 0.2, floor: 0, down: 1.4 }),
  serum: wave({ at: INFECTION, lag: 0, up: 2, peak: 0.15, floor: 0, down: 1.2 }),
};
const ANTIBODY: Record<Scenario, Fn> = {
  none: wave({ at: INFECTION, lag: 4, up: 9, peak: 0.42, floor: 0.3, down: 10 }),
  vaccine: sum(wave({ at: 0, lag: 4, up: 10, peak: 0.26, floor: 0.3, down: 9 }), wave({ at: INFECTION, lag: 1, up: 5, peak: 0.9, floor: 0.6, down: 12 })),
  serum: sum(serum(37, 0.78, 12), wave({ at: INFECTION, lag: 5, up: 9, peak: 0.1, floor: 0.3, down: 8 })),
};

/** Days on which the pathogens are above the "sick" line, as [from, to]. */
function sickSpan(s: Scenario): [number, number] | null {
  let from = -1;
  let to = -1;
  for (let d = 0; d <= 70; d += 0.1) {
    if (PATHOGEN[s](d) > SICK) {
      if (from < 0) from = d;
      to = d;
    }
  }
  return from < 0 ? null : [from, to];
}

type Ev = { day: number; text: Text };
function eventsOf(s: Scenario, level: 1 | 2): Ev[] {
  const [antiEn, antiDe] = level === 1 ? ["defence substances (antibodies)", "Abwehrstoffe (Antikörper)"] : ["antibodies and memory cells", "Antikörper und Gedächtniszellen"];
  const ev: Ev[] = [];
  if (s === "none") ev.push({ day: 0, text: tx("Not vaccinated. Nothing happens for now.", "Nicht geimpft. Erst mal passiert nichts.") });
  if (s === "vaccine")
    ev.push(
      { day: 0, text: tx("Day 0: vaccination. The vaccine contains weakened or dead pathogens, or parts of them. They can't make you ill.", "Tag 0: Impfung. Der Impfstoff enthält abgeschwächte oder abgetötete Erreger oder Teile davon. Sie machen nicht krank.") },
      { day: 5, text: tx(`The body gets to know the pathogen and slowly makes ${antiEn}. You don't get ill.`, `Der Körper lernt den Erreger kennen und bildet langsam ${antiDe}. Du wirst nicht krank.`) },
    );
  if (s === "serum")
    ev.push(
      { day: 0, text: tx("No vaccination so far.", "Bisher keine Impfung.") },
      { day: 37, text: tx("Day 37: serum with ready-made antibodies (passive immunisation). They protect at once.", "Tag 37: Heilserum mit fertigen Antikörpern (passive Immunisierung). Sie schützen sofort.") },
    );
  ev.push({ day: INFECTION, text: tx("Day 40: infection with the real pathogen.", "Tag 40: Ansteckung mit dem echten Erreger.") });
  if (s === "none")
    ev.push(
      { day: 43, text: tx("The pathogens multiply faster than the defence can keep up: you are ill.", "Die Erreger vermehren sich schneller, als die Abwehr hinterherkommt: Du bist krank.") },
      {
        day: 50,
        text: level === 1 ? tx("After about a week there are enough antibodies. The pathogens disappear and you get better.", "Nach etwa einer Woche gibt es genug Antikörper. Die Erreger verschwinden, du wirst gesund.") : tx("Primary response: only after about a week are there enough antibodies. Memory cells are made too.", "Primärreaktion: Erst nach etwa einer Woche gibt es genug Antikörper. Dabei entstehen auch Gedächtniszellen."),
      },
    );
  if (s === "vaccine")
    ev.push({
      day: 41,
      text: level === 1 ? tx("The body knows this pathogen already: very quickly there are lots of antibodies. You don't even notice.", "Der Körper kennt den Erreger schon: Sehr schnell gibt es sehr viele Antikörper. Du merkst nichts davon.") : tx("Secondary response: memory cells recognise the pathogen at once. Faster, many more antibodies, no illness.", "Sekundärreaktion: Gedächtniszellen erkennen den Erreger sofort. Schneller, viel mehr Antikörper, keine Krankheit."),
    });
  if (s === "serum")
    ev.push(
      { day: 42, text: tx("The ready-made antibodies catch the pathogens: no illness.", "Die fertigen Antikörper fangen die Erreger ab: keine Krankheit.") },
      { day: 55, text: tx("But the foreign antibodies are broken down within weeks, and no memory cells are formed.", "Aber die fremden Antikörper werden in wenigen Wochen abgebaut, und es entstehen keine Gedächtniszellen.") },
    );
  return ev;
}

const DAYS = 70;

/** The widget: play the days and compare unvaccinated, vaccinated (and, at level 2, passive). */
export function ImmuneTiter({ level = 2 }: { level?: 1 | 2 | 3 }) {
  if (level === 3) return <TiterLog />;
  return <TiterLinear level={level} />;
}

function usePlayhead(total: number) {
  const day = useMotionValue(total);
  const [now, setNow] = useState(total);
  const [playing, setPlaying] = useState(false);
  useMotionValueEvent(day, "change", (v) => setNow(Math.round(v * 10) / 10));
  const play = () => {
    setPlaying(true);
    day.set(0);
    animate(day, total, { duration: 7, ease: "linear" }).then(() => setPlaying(false));
  };
  const stop = () => {
    day.stop();
    setPlaying(false);
  };
  const jump = (v: number) => {
    day.stop();
    setPlaying(false);
    day.set(v);
  };
  return { day, now, playing, play, stop, jump };
}

function Controls({ ph, total }: { ph: ReturnType<typeof usePlayhead>; total: number }) {
  const t = useText();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={ph.playing ? ph.stop : ph.play}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper active:scale-[0.97]"
      >
        {ph.playing ? <Pause className="size-4" /> : <Play className="size-4" />} {ph.playing ? t(tx("Pause", "Pause")) : t(tx("Play", "Abspielen"))}
      </button>
      <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-ink-2">
        <span className="w-[4.5rem] shrink-0 tabular-nums">
          {t(tx("Day", "Tag"))} {Math.round(ph.now)}
        </span>
        <input type="range" min={0} max={total} step={1} value={Math.round(ph.now)} onChange={(e) => ph.jump(Number(e.target.value))} className="w-full accent-[var(--blob)]" aria-label={t(tx("Day", "Tag"))} />
      </label>
      <button type="button" onClick={() => ph.jump(0)} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Back to day 0", "Zurück zu Tag 0"))}>
        <RotateCcw className="size-4" />
      </button>
    </div>
  );
}

function TiterLinear({ level }: { level: 1 | 2 }) {
  const t = useText();
  const id = useId().replace(/:/g, "");
  const [sc, setSc] = useState<Scenario>("none");
  const ph = usePlayhead(DAYS);
  const b: Box = { x0: 52, x1: 560, y0: 46, y1: 236, days: DAYS, ymax: 1.05 };
  const clipW = useTransform(ph.day, (d) => Math.max(0, X(b, d) - b.x0 + 1));
  const cursorX = useTransform(ph.day, (d) => X(b, d));
  const sick = sickSpan(sc);
  const ev = eventsOf(sc, level);
  const current = [...ev].reverse().find((e) => e.day <= ph.now + 0.01) ?? ev[0];
  const memAt = sc === "vaccine" ? 14 : sc === "none" ? INFECTION + 13 : null;
  const choose = (s: Scenario) => {
    setSc(s);
    ph.jump(DAYS);
  };
  const options: { id: Scenario; name: Text }[] =
    level === 1
      ? [
          { id: "none", name: tx("Not vaccinated", "Ohne Impfung") },
          { id: "vaccine", name: tx("Vaccinated", "Geimpft") },
        ]
      : [
          { id: "none", name: tx("Not vaccinated", "Ohne Impfung") },
          { id: "vaccine", name: tx("Active: vaccine", "Aktiv: Impfung") },
          { id: "serum", name: tx("Passive: serum", "Passiv: Heilserum") },
        ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {sc === "none" && (
          <motion.button
            type="button"
            onClick={() => choose("vaccine")}
            whileTap={{ scale: 0.96 }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-blob px-3.5 text-[13px] font-semibold text-white shadow-card"
          >
            <Syringe className="size-4" /> {t(tx("Vaccinate on day 0", "An Tag 0 impfen"))}
          </motion.button>
        )}
        <div className="flex flex-wrap rounded-lg border border-line p-0.5">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", sc === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {sc === o.id && <motion.span layoutId={`titer-sc-${level}`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(o.name)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 600 290" className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(tx("Antibodies and pathogens over time", "Antikörper und Erreger im Zeitverlauf"))}>
          <defs>
            <clipPath id={`${id}-clip`}>
              <motion.rect x={b.x0 - 2} y={0} height={290} width={clipW} />
            </clipPath>
          </defs>
          <Axes b={b} yLabel={tx("Amount in the blood", "Menge im Blut")} xLabel={tx("time in days", "Zeit in Tagen")} ticks={[0, 10, 20, 30, 40, 50, 60, 70]} />
          {/* illness line and span */}
          <line x1={b.x0} x2={b.x1} y1={Y(b, SICK)} y2={Y(b, SICK)} stroke="var(--bio-blood)" strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
          <text x={b.x0 + 8} y={Y(b, SICK) - 5} textAnchor="start" fontSize={11.5} fill="var(--bio-blood)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("pathogens above this line: ill", "Erreger über dieser Linie: krank"))}
          </text>
          {sc === "vaccine" && <EventMark b={b} day={0} label={tx("vaccination", "Impfung")} color="var(--blob)" icon="syringe" />}
          {sc === "serum" && <EventMark b={b} day={37} label={tx("serum", "Serum")} color="var(--bio-water-deep)" icon="serum" left />}
          <EventMark b={b} day={INFECTION} label={sc === "serum" ? "" : tx("infection", "Ansteckung")} color="var(--bio-petal-deep)" icon="virus" left />
          <g clipPath={`url(#${id}-clip)`}>
            {sick && <rect x={X(b, sick[0])} width={X(b, sick[1]) - X(b, sick[0])} y={b.y1 - 12} height={10} rx={5} fill="var(--bio-blood)" opacity={0.75} />}
            <motion.path key={`p-${sc}`} d={pathOf(b, PATHOGEN[sc], INFECTION - 0.5)} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={2.4} strokeDasharray="6 5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            <motion.path key={`a-${sc}`} d={pathOf(b, ANTIBODY[sc])} fill="none" stroke="var(--bio-water-deep)" strokeWidth={3.2} strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            {level === 2 && sc !== "serum" && (
              <g fontSize={12} fontWeight={600} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
                {sc === "vaccine" ? (
                  <>
                    <text x={X(b, 14)} y={Y(b, 0.26) - 8} textAnchor="middle">
                      {t(tx("primary", "primär"))}
                    </text>
                    <text x={X(b, 57)} y={Y(b, 0.82) - 6} textAnchor="start">
                      {t(tx("secondary response", "Sekundärreaktion"))}
                    </text>
                  </>
                ) : (
                  <text x={X(b, 53)} y={Y(b, 0.42) - 8} textAnchor="middle">
                    {t(tx("primary response", "Primärreaktion"))}
                  </text>
                )}
              </g>
            )}
          </g>
          <motion.line x1={cursorX} x2={cursorX} y1={b.y0 - 6} y2={b.y1} stroke="var(--blob)" strokeWidth={1.5} opacity={ph.now < DAYS ? 0.9 : 0} />
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded bg-[var(--bio-water-deep)]" /> {t(tx("antibodies", "Antikörper"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-[var(--bio-petal-deep)]" /> {t(tx("pathogens", "Erreger"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded bg-[var(--bio-blood)] opacity-75" /> {t(tx("ill", "krank"))}
          </span>
          {level === 2 && (
            <span className="flex items-center gap-1.5">
              <CellIcon kind="mem" size={18} />
              <AnimatePresence mode="popLayout">
                <motion.span key={String(memAt !== null && ph.now >= memAt)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {memAt !== null && ph.now >= memAt ? t(tx("memory cells: yes", "Gedächtniszellen: ja")) : t(tx("memory cells: none yet", "Gedächtniszellen: noch keine"))}
                </motion.span>
              </AnimatePresence>
            </span>
          )}
        </div>
      </div>

      <Controls ph={ph} total={DAYS} />

      <motion.p key={`${sc}-${current.day}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        {ph.now >= DAYS ? t(summaryOf(sc, level)) : t(current.text)}
      </motion.p>
    </div>
  );
}

function summaryOf(s: Scenario, level: 1 | 2): Text {
  if (s === "none")
    return level === 1
      ? tx("Without vaccination the body meets the pathogen for the first time on day 40. It needs about a week to make enough antibodies, and meanwhile you are ill. Press Vaccinate!", "Ohne Impfung trifft der Körper an Tag 40 zum ersten Mal auf den Erreger. Er braucht etwa eine Woche, bis genug Antikörper da sind, und so lange bist du krank. Drück auf Impfen!")
      : tx("First contact on day 40: a slow, weak primary response. The pathogens get the upper hand for a while: you are ill.", "Erstkontakt an Tag 40: eine langsame, schwache Primärreaktion. Die Erreger sind eine Zeit lang überlegen: Du bist krank.");
  if (s === "vaccine")
    return level === 1
      ? tx("The vaccination taught the body the pathogen. On day 40 it reacts at once and much more strongly: no illness. That's the idea of vaccination!", "Die Impfung hat dem Körper den Erreger gezeigt. An Tag 40 reagiert er sofort und viel stärker: keine Krankheit. Das ist die Idee des Impfens!")
      : tx("Active immunisation: the vaccine triggers a primary response with memory cells. On day 40 the secondary response is faster and much stronger: no illness, protection for years.", "Aktive Immunisierung: Der Impfstoff löst eine Primärreaktion mit Gedächtniszellen aus. An Tag 40 ist die Sekundärreaktion schneller und viel stärker: keine Krankheit, Schutz für Jahre.");
  return tx("Passive immunisation: the serum's ready-made antibodies protect at once, but they disappear within weeks. No memory cells: next time the body starts from scratch.", "Passive Immunisierung: Die fertigen Antikörper aus dem Heilserum schützen sofort, verschwinden aber nach wenigen Wochen. Keine Gedächtniszellen: Beim nächsten Mal fängt der Körper von vorn an.");
}

// ---------------------------------------------------------------------------
// Level 3: IgM and IgG on a log scale

const LOG_DAYS = 80;
const PRIM_M = (at: number) => wave({ at, lag: 4, up: 6, peak: 2.2, floor: 0.25, down: 6 });
const PRIM_G = (at: number) => wave({ at, lag: 6, up: 9, peak: 2.6, floor: 0.55, down: 12 });
const SEC_M = (at: number) => wave({ at, lag: 2, up: 4, peak: 1.6, floor: 0.2, down: 4 });
const SEC_G = (at: number) => wave({ at, lag: 1.5, up: 6, peak: 4.6, floor: 0.75, down: 22 });

function TiterLog() {
  const t = useText();
  const id = useId().replace(/:/g, "");
  const [second, setSecond] = useState<"A" | "B">("A");
  const ph = usePlayhead(LOG_DAYS);
  const b: Box = { x0: 58, x1: 560, y0: 46, y1: 236, days: LOG_DAYS, ymax: 5, log: true };
  const clipW = useTransform(ph.day, (d) => Math.max(0, X(b, d) - b.x0 + 1));
  const cursorX = useTransform(ph.day, (d) => X(b, d));
  const aM = second === "A" ? max(PRIM_M(0), SEC_M(40)) : PRIM_M(0);
  const aG = second === "A" ? max(PRIM_G(0), SEC_G(40)) : PRIM_G(0);
  const bM = PRIM_M(40);
  const bG = PRIM_G(40);
  const ev: Ev[] = [
    { day: 0, text: tx("Day 0: first contact with antigen A. Lag phase: the matching B cells must first be selected and multiply.", "Tag 0: Erstkontakt mit Antigen A. Latenzphase: Die passenden B-Zellen müssen erst ausgewählt werden und sich vermehren.") },
    { day: 8, text: tx("Primary response: IgM comes first, IgG follows a few days later. The titre stays low.", "Primärantwort: Zuerst erscheint IgM, IgG folgt einige Tage später. Der Titer bleibt niedrig.") },
    second === "A"
      ? { day: 40, text: tx("Day 40: second contact with antigen A. Memory cells respond at once: short lag, hardly any IgM, about 100 times more IgG that stays high for long.", "Tag 40: Zweitkontakt mit Antigen A. Gedächtniszellen reagieren sofort: kurze Latenz, kaum IgM, etwa 100-mal mehr IgG, das lange hoch bleibt.") }
      : { day: 40, text: tx("Day 40: contact with a new antigen B. The memory cells for A don't fit: again a slow primary response. Immunological memory is specific.", "Tag 40: Kontakt mit einem neuen Antigen B. Die Gedächtniszellen für A passen nicht: wieder eine langsame Primärantwort. Das immunologische Gedächtnis ist spezifisch.") },
  ];
  const current = [...ev].reverse().find((e) => e.day <= ph.now + 0.01) ?? ev[0];
  const curve = (fn: Fn, color: string, dashed: boolean, key: string) => (
    <motion.path key={key} d={pathOf(b, fn)} fill="none" stroke={color} strokeWidth={dashed ? 2.4 : 3.2} strokeDasharray={dashed ? "6 5" : undefined} strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>{t(tx("Second contact on day 40 with:", "Zweitkontakt an Tag 40 mit:"))}</span>
        <div className="flex rounded-lg border border-line p-0.5">
          {(["A", "B"] as const).map((k) => (
            <button key={k} type="button" onClick={() => {
                setSecond(k);
                ph.jump(LOG_DAYS);
              }} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", second === k ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {second === k && <motion.span layoutId="titer-log-ag" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{k === "A" ? t(tx("antigen A (same)", "Antigen A (gleich)")) : t(tx("antigen B (new)", "Antigen B (neu)"))}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 600 290" className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(tx("Antibody titre on a log scale", "Antikörpertiter, logarithmisch"))}>
          <defs>
            <clipPath id={`${id}-clip`}>
              <motion.rect x={b.x0 - 2} y={0} height={290} width={clipW} />
            </clipPath>
          </defs>
          <Axes b={b} yLabel={tx("antibody titre", "Antikörpertiter")} xLabel={tx("time in days", "Zeit in Tagen")} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80]} />
          <EventMark b={b} day={0} label={tx("antigen A", "Antigen A")} color="var(--bio-water-deep)" />
          <EventMark b={b} day={40} label={second === "A" ? tx("antigen A", "Antigen A") : tx("antigen B", "Antigen B")} color={second === "A" ? "var(--bio-water-deep)" : "var(--bio-mito-deep)"} />
          <g clipPath={`url(#${id}-clip)`}>
            {curve(aM, "var(--bio-water-deep)", true, `am-${second}`)}
            {curve(aG, "var(--bio-water-deep)", false, `ag-${second}`)}
            {second === "B" && curve(bM, "var(--bio-mito-deep)", true, "bm")}
            {second === "B" && curve(bG, "var(--bio-mito-deep)", false, "bg")}
          </g>
          <motion.line x1={cursorX} x2={cursorX} y1={b.y0 - 6} y2={b.y1} stroke="var(--blob)" strokeWidth={1.5} opacity={ph.now < LOG_DAYS ? 0.9 : 0} />
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-ink-2" /> IgM
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded bg-ink-2" /> IgG
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--bio-water-deep)]" /> {t(tx("against A", "gegen A"))}
          </span>
          {second === "B" && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--bio-mito-deep)]" /> {t(tx("against B", "gegen B"))}
            </span>
          )}
        </div>
      </div>
      <Controls ph={ph} total={LOG_DAYS} />
      <motion.p key={`${second}-${current.day}-${ph.now >= LOG_DAYS}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        {ph.now >= LOG_DAYS
          ? second === "A"
            ? t(tx("Compare the peaks: the secondary response comes sooner, is about 100 times higher (note the log scale) and consists mainly of IgG.", "Vergleich die Maxima: Die Sekundärantwort kommt früher, ist etwa 100-mal höher (logarithmische Achse!) und besteht vor allem aus IgG."))
            : t(tx("Against B the body reacts like the first time: memory only works for the antigen it was made for.", "Gegen B reagiert der Körper wie beim ersten Mal: Das Gedächtnis gilt nur für das Antigen, gegen das es gebildet wurde."))
          : t(current.text)}
      </motion.p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static graphs for tasks

export type TiterPreset = "overlay" | "activePassive" | "igm" | "log" | "twoAntigens" | "course";

function Tag({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g style={{ fontFamily: "var(--font-sans)" }}>
      <circle cx={x} cy={y} r={11} fill="var(--raised)" stroke={color} strokeWidth={2} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)">
        {label}
      </text>
    </g>
  );
}

/**
 * Fixed antibody curves for tasks. `swap` exchanges which curve gets label 1/A and which 2/B.
 * - overlay: primary and secondary response after an infection on day 0 (curves 1, 2)
 * - activePassive: active vaccination and serum on day 0 (curves 1, 2)
 * - igm: IgM and IgG in a primary and secondary response, log scale (curves 1, 2)
 * - log: total antibodies, log scale, primary peak 10^p1, secondary peak 10^p2
 * - twoAntigens: antigen A on day 0 and 40, antigen B on day 40 (log scale)
 * - course: first infection on day 0, second on day 40
 */
export function ImmuneTiterGraph({ preset, swap = false, p1 = 2, p2 = 4 }: { preset: TiterPreset; swap?: boolean; p1?: number; p2?: number }) {
  const t = useText();
  const log = preset === "igm" || preset === "log" || preset === "twoAntigens";
  const days = preset === "overlay" ? 30 : preset === "activePassive" ? 60 : 80;
  const b: Box = { x0: 58, x1: 540, y0: 40, y1: 220, days, ymax: log ? 5 : 1.05, log };
  const ticks = Array.from({ length: days / 10 + 1 }, (_, i) => i * 10);
  const c1 = "var(--bio-water-deep)";
  const c2 = "var(--bio-mito-deep)";
  const curves: { fn: Fn; color: string; dashed?: boolean; label?: string; at: number }[] = [];
  const labels = swap ? ["2", "1"] : ["1", "2"];
  if (preset === "overlay") {
    curves.push({ fn: wave({ at: 0, lag: 5, up: 9, peak: 0.36, floor: 0.35, down: 8 }), color: c1, label: labels[0], at: 16 });
    curves.push({ fn: wave({ at: 0, lag: 1.5, up: 5, peak: 0.95, floor: 0.6, down: 10 }), color: c2, label: labels[1], at: 7 });
  } else if (preset === "activePassive") {
    curves.push({ fn: wave({ at: 0, lag: 5, up: 10, peak: 0.62, floor: 0.75, down: 30 }), color: c1, label: labels[0], at: 40 });
    curves.push({ fn: serum(0, 0.85, 10), color: c2, label: labels[1], at: 8 });
  } else if (preset === "igm") {
    curves.push({ fn: max(PRIM_M(0), SEC_M(40)), color: c1, dashed: true, label: labels[0], at: 8 });
    curves.push({ fn: max(PRIM_G(0), SEC_G(40)), color: c2, label: labels[1], at: 50 });
  } else if (preset === "log") {
    const prim = wave({ at: 0, lag: 5, up: 9, peak: p1, floor: 0.6, down: 10 });
    const sec = wave({ at: 40, lag: 1.5, up: 6, peak: p2, floor: 0.8, down: 25 });
    curves.push({ fn: max(prim, sec), color: c1, at: -1 });
  } else if (preset === "twoAntigens") {
    curves.push({ fn: max(PRIM_G(0), SEC_G(40)), color: c1, label: "A", at: 50 });
    curves.push({ fn: PRIM_G(40), color: c2, label: "B", at: 58 });
  } else {
    curves.push({ fn: sum(wave({ at: 0, lag: 5, up: 9, peak: 0.36, floor: 0.3, down: 8 }), wave({ at: 40, lag: 1.5, up: 5, peak: 0.95, floor: 0.6, down: 12 })), color: c1, at: -1 });
  }
  const events: { day: number; label: Text }[] =
    preset === "course"
      ? [
          { day: 0, label: tx("1st infection", "1. Infektion") },
          { day: 40, label: tx("2nd infection", "2. Infektion") },
        ]
      : preset === "overlay"
        ? [{ day: 0, label: tx("infection", "Infektion") }]
        : preset === "activePassive"
          ? [{ day: 0, label: tx("immunisation", "Immunisierung") }]
          : preset === "twoAntigens"
            ? [
                { day: 0, label: tx("A", "A") },
                { day: 40, label: tx("A and B", "A und B") },
              ]
            : [
                { day: 0, label: tx("1st contact", "1. Kontakt") },
                { day: 40, label: tx("2nd contact", "2. Kontakt") },
              ];
  return (
    <svg viewBox="0 0 580 270" className="mx-auto block h-auto w-full max-w-[580px]" role="img" aria-label={t(tx("Antibody concentration over time", "Antikörperkonzentration im Zeitverlauf"))}>
      <Axes b={b} yLabel={log ? tx("antibody titre", "Antikörpertiter") : tx("antibody concentration", "Antikörperkonzentration")} xLabel={tx("time in days", "Zeit in Tagen")} ticks={ticks} />
      {events.map((e) => (
        <EventMark key={e.day} b={b} day={e.day} label={e.label} />
      ))}
      {curves.map((c, i) => (
        <path key={i} d={pathOf(b, c.fn)} fill="none" stroke={c.color} strokeWidth={c.dashed ? 2.6 : 3.2} strokeDasharray={c.dashed ? "6 5" : undefined} strokeLinecap="round" />
      ))}
      {curves.map((c, i) => (c.label && c.at >= 0 ? <Tag key={`t${i}`} x={X(b, c.at) + 14} y={Y(b, c.fn(c.at)) - 16} label={c.label} color={c.color} /> : null))}
    </svg>
  );
}
