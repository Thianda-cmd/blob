"use client";

import { motion } from "motion/react";
import { Thermometer } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { alkaneName, BOIL, MELT, STATE_NAME, stateAt, type State } from "../alkanes-core";

// Melting and boiling points of methane to decane as floating bars (the liquid range).
// Drag the temperature line (or use the slider) and read which alkanes are solid, liquid
// or gaseous at that temperature.

const T_MIN = -200;
const T_MAX = 200;
const W = 360;
const LEFT = 60;
const RIGHT = 286;
const TOP = 30;
const ROW = 22;
const N = 10;
const H = TOP + N * ROW + 26;
const x = (temp: number) => LEFT + ((temp - T_MIN) / (T_MAX - T_MIN)) * (RIGHT - LEFT);
const round = (v: number) => Math.round(v * 100) / 100;
const TICKS = [-200, -100, 0, 100, 200];

const deg = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v)} °C`;

/** "methane to butane" from a run of indices. */
function runs(ids: number[], l: "de" | "en") {
  if (!ids.length) return "";
  const name = (i: number) => resolveText(alkaneName(i + 1), l);
  const out: string[] = [];
  let a = ids[0];
  let b = ids[0];
  const flush = () => out.push(a === b ? name(a) : b === a + 1 ? `${name(a)}${l === "de" ? " und " : " and "}${name(b)}` : `${name(a)}${l === "de" ? " bis " : " to "}${name(b)}`);
  for (const i of ids.slice(1)) {
    if (i === b + 1) b = i;
    else {
      flush();
      a = b = i;
    }
  }
  flush();
  return out.join(", ");
}

export function AlkanesBoiling() {
  const t = useText();
  const locale = useLocale();
  const [temp, setTemp] = useState(20);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const states = Array.from({ length: N }, (_, i) => stateAt(i + 1, temp));
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const vx = ((e.clientX - box.left) / box.width) * W;
    const v = T_MIN + ((vx - LEFT) / (RIGHT - LEFT)) * (T_MAX - T_MIN);
    setTemp(Math.max(T_MIN, Math.min(T_MAX, Math.round(v))));
  };

  const group = (s: State) => states.map((st, i) => (st === s ? i : -1)).filter((i) => i >= 0);
  const summary = (["gas", "liquid", "solid"] as State[])
    .map((s) => ({ s, ids: group(s) }))
    .filter((g) => g.ids.length)
    .map((g) => `${resolveText(STATE_NAME[g.s], locale)}: ${runs(g.ids, locale)}`)
    .join(" · ");

  const detail: Text | null =
    hover === null
      ? null
      : tx(
          `${resolveText(alkaneName(hover + 1), "en")}: melts at ${deg(MELT[hover])}, boils at ${deg(BOIL[hover])}.`,
          `${resolveText(alkaneName(hover + 1), "de")}: schmilzt bei ${deg(MELT[hover])}, siedet bei ${deg(BOIL[hover])}.`,
        );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-6 rounded-[4px] bg-blob/80" /> {t(tx("liquid between melting and boiling point", "flüssig zwischen Schmelz- und Siedetemperatur"))}
        </span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto block w-full min-w-[320px] max-w-[540px] touch-none select-none"
          role="img"
          aria-label={t(tx("Melting and boiling points of methane to decane", "Schmelz- und Siedetemperaturen von Methan bis Decan"))}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => dragging.current && fromPointer(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* grid and axis */}
          {TICKS.map((v) => (
            <g key={v}>
              <line x1={round(x(v))} x2={round(x(v))} y1={TOP - 4} y2={TOP + N * ROW} stroke="var(--line)" strokeWidth={1} />
              <text x={round(x(v))} y={TOP + N * ROW + 15} textAnchor="middle" fontSize={10.5} className="fill-ink-3 tabular-nums">
                {deg(v)}
              </text>
            </g>
          ))}
          <text x={RIGHT + 7} y={TOP - 12} fontSize={11} fontWeight={600} className="fill-ink-3">
            {t(tx("at", "bei"))} {deg(temp)}
          </text>

          {/* rows */}
          {Array.from({ length: N }, (_, i) => {
            const y = TOP + i * ROW + ROW / 2;
            const st = states[i];
            const lit = hover === i;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))}>
                <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill={lit ? "var(--hover)" : "transparent"} />
                <text x={LEFT - 7} y={y} dy="0.35em" textAnchor="end" fontSize={12} className={cn(lit ? "fill-ink" : "fill-ink-2")}>
                  {t(alkaneName(i + 1))}
                </text>
                <rect x={round(x(MELT[i]))} y={y - 5} width={round(x(BOIL[i]) - x(MELT[i]))} height={10} rx={4} fill="var(--blob)" opacity={st === "liquid" ? 0.95 : 0.55}>
                  <title>{`${t(alkaneName(i + 1))}: ${deg(MELT[i])} … ${deg(BOIL[i])}`}</title>
                </rect>
                <text x={RIGHT + 7} y={y} dy="0.35em" fontSize={11.5} fontWeight={st === "liquid" ? 600 : 500} className={st === "gas" ? "fill-ink-3" : "fill-ink"}>
                  {t(STATE_NAME[st])}
                </text>
              </g>
            );
          })}

          {/* temperature line */}
          <motion.g initial={false} animate={{ x: round(x(temp)) }} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
            <line x1={0} x2={0} y1={TOP - 6} y2={TOP + N * ROW + 2} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />
            <circle cx={0} cy={TOP - 8} r={6} fill="var(--ink)" stroke="var(--raised)" strokeWidth={2} />
            {Array.from({ length: N }, (_, i) => (
              <circle key={i} cx={0} cy={TOP + i * ROW + ROW / 2} r={4} fill={states[i] === "liquid" ? "var(--blob)" : "var(--raised)"} stroke={states[i] === "liquid" ? "var(--raised)" : "var(--ink-2)"} strokeWidth={states[i] === "liquid" ? 2 : 1.5} />
            ))}
          </motion.g>
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <Thermometer className="size-4 shrink-0 text-ink-3" />
        <input
          type="range"
          min={T_MIN}
          max={T_MAX}
          step={1}
          value={temp}
          onChange={(e) => setTemp(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-[var(--blob)]"
          aria-label={t(tx("Temperature", "Temperatur"))}
        />
        <span className="w-[68px] shrink-0 text-right font-math text-[17px] tabular-nums text-ink">{deg(temp)}</span>
        <button
          type="button"
          onClick={() => setTemp(20)}
          className={cn("shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors", temp === 20 ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {t(tx("Room temp.", "Raumtemp."))}
        </button>
      </div>

      <p className="min-h-[3em] rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">{detail ? t(detail) : summary}</p>

      <table className="sr-only">
        <caption>{t(tx("Melting and boiling points", "Schmelz- und Siedetemperaturen"))}</caption>
        <tbody>
          {MELT.map((m, i) => (
            <tr key={i}>
              <th>{t(alkaneName(i + 1))}</th>
              <td>{deg(m)}</td>
              <td>{deg(BOIL[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
