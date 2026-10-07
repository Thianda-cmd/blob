"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { add, div, mul, neg, sub, type Frac } from "@/learn/engine/frac";
import { alongLine, crossing, Plane, PlaneDot, PlaneHandle, PlaneLine, PlanePath, PlaneTag, planeGeo, StepSlider, TONE, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { atanDeg, numIn } from "./kit";
import { Caption, lineSrc, num, plain, pt, q, qv, side, term, val } from "./level2";

// Widgets for level 3: where two lines meet, the slope angle and the angle between two
// lines, and the distance from a point to a line via the foot of the perpendicular.
// Each one stands on its own (it gets its own public page).

const dir = (a: number): Pt => [cos(a), sin(a)];
const ONE = q(1);

function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13.5px] leading-relaxed text-ink-2", className)}>{children}</p>;
}

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, Text][]; onChange: (v: T) => void }) {
  const t = useText();
  const scope = useId();
  return (
    <div className="flex w-fit rounded-lg border border-line p-0.5" role="tablist">
      {options.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === key ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === key && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

/** A Frac for the panel: integers and short decimals as decimals ("2,5"), else as a fraction. */
function nice(f: Frac, l: Locale): string {
  if ([1, 2, 4, 5, 10].includes(f.d)) return numIn(f.n / f.d, l);
  return num(f);
}

// ---------------------------------------------------------------------------
// Intersection lab: two lines with sliders for m and b; S and the equalising follow.

const SLOPES: Frac[] = [q(-3), q(-2), q(-3, 2), q(-1), q(-2, 3), q(-1, 2), q(-1, 3), q(0), q(1, 3), q(1, 2), q(2, 3), q(1), q(3, 2), q(2), q(3)];
const S0 = 7;
/** y-intercepts −6 … 6, so the starting line h: y = −x + 5 sits on the slider. */
const BS = Array.from({ length: 13 }, (_, i) => i - 6);
const idxOf = (m: Frac) => SLOPES.findIndex((s) => s.n === m.n && s.d === m.d);

function LineSliders({ name, mi, b, onM, onB, tone }: { name: string; mi: number; b: number; onM: (i: number) => void; onB: (b: number) => void; tone: "blob" | "ink" }) {
  const t = useText();
  const l = useLocale();
  const m = SLOPES[mi];
  return (
    <div className="space-y-2 rounded-xl border border-line px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="whitespace-nowrap">
          <Caption>{t(tx(`Line ${name}`, `Gerade ${name}`))}</Caption>
        </span>
        <span className={cn("whitespace-nowrap", tone === "blob" ? "text-blob-ink" : "text-ink")}>
          <MathView src={`m = ${nice(m, l)} \\quad b = ${b}`} size="sm" animate={false} />
        </span>
      </div>
      {/* Inset, so a thumb at either end stays inside the card. */}
      <div className="px-2">
        <StepSlider value={mi} count={SLOPES.length} onChange={onM} zero={S0} tone={tone} label={tx(`Slope of ${name}`, `Steigung von ${name}`)} valueText={`m = ${m.d === 1 || [2, 4, 5, 10].includes(m.d) ? numIn(qv(m), l) : `${m.n}/${m.d}`}`} />
        <StepSlider value={b + 6} count={BS.length} onChange={(i) => onB(BS[i])} zero={6} tone={tone} label={tx(`y-intercept of ${name}`, `y-Achsenabschnitt von ${name}`)} valueText={`b = ${b}`} />
      </div>
    </div>
  );
}

export function IntersectionLab() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const [gi, setGi] = useState(idxOf(q(2)));
  const [gb, setGb] = useState(-1);
  const [hi, setHi] = useState(idxOf(q(-1)));
  const [hb, setHb] = useState(5);
  const mg = SLOPES[gi];
  const mh = SLOPES[hi];
  const ag = useSpringTo(Math.atan(qv(mg)));
  const ah = useSpringTo(Math.atan(qv(mh)));
  const gbS = useSpringTo(gb);
  const hbS = useSpringTo(hb);
  const geo = planeGeo([-6, 6], [-6, 6]);
  const meet = () => crossing([0, gbS.get()], dir(ag.get()), [0, hbS.get()], dir(ah.get()));

  const same = mg.n === mh.n && mg.d === mh.d;
  const dm = sub(mg, mh);
  const db = q(hb - gb);
  const X = same ? null : div(db, dm);
  const Y = X ? add(mul(mg, X), q(gb)) : null;
  const outside = X && Y ? Math.abs(qv(X)) > 6 || Math.abs(qv(Y)) > 6 : false;
  const gSide = side([
    [mg, "x", "g"],
    [q(gb), "", "gb"],
  ]);
  const hSide = side([
    [mh, "x", "h"],
    [q(hb), "", "hb"],
  ]);

  let steps: string[];
  let verdict: Text;
  if (!X || !Y) {
    steps = [`${gSide} =#EQ ${hSide}`, `${val(q(gb), "gb")} =#EQ ${val(q(hb), "hb")}`];
    verdict =
      gb === hb
        ? tx("Same slope **and** same $b$: the lines are **identical**. Every point is a common point.", "Gleiche Steigung **und** gleiches $b$: Die Geraden sind **identisch**. Jeder Punkt ist ein gemeinsamer Punkt.")
        : tx(
            `Same slope, different $b$: the $x$-terms cancel and $${gb} = ${hb}$ is false. The lines are **parallel**, there is **no** intersection point.`,
            `Gleiche Steigung, verschiedenes $b$: Die $x$-Terme fallen weg, und $${gb} = ${hb}$ ist falsch. Die Geraden sind **parallel**, es gibt **keinen** Schnittpunkt.`,
          );
  } else {
    const dec = X.d !== 1 && [2, 4, 5, 10].includes(X.d) ? ` = ${numIn(qv(X), l)}` : "";
    steps = [`${gSide} =#EQ ${hSide}`, `${term(dm, "x", "g", true)} =#EQ ${val(db, "hb")}`, `x#vg =#EQ ${val(X, "hb")}${dec}`];
    verdict = tx(
      `Put $x$ into $g$: $y = ${nice(Y, "en")}$. The lines meet in $S${pt(nice(X, "en"), nice(Y, "en"))}$.${outside ? " That's outside the picture, but they do meet." : ""}`,
      `$x$ in $g$ einsetzen: $y = ${nice(Y, "de")}$. Die Geraden schneiden sich in $S${pt(nice(X, "de"), nice(Y, "de"))}$.${outside ? " Das liegt außerhalb des Bildes, aber sie schneiden sich." : ""}`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
          <Plane
            xRange={[-6, 6]}
            yRange={[-6, 6]}
            label={tx("Two lines g and h and their intersection point S", "Zwei Geraden g und h und ihr Schnittpunkt S")}
            overlay={
              <>
                <PlaneTag at={() => alongLine(geo, [0, gbS.get()], dir(ag.get()), 0.9)} dy={-14}>
                  <MathView src="g" size="sm" animate={false} className="text-blob-ink" />
                </PlaneTag>
                <PlaneTag at={() => alongLine(geo, [0, hbS.get()], dir(ah.get()), 0.1)} dy={-14}>
                  <MathView src="h" size="sm" animate={false} className="text-ink" />
                </PlaneTag>
                {X && Y && (
                  <PlaneTag at={meet} anchor="left" dx={10} dy={14}>
                    <MathView src={pt(nice(X, l), nice(Y, l), "S")} size="sm" animate={false} className="text-ink" />
                  </PlaneTag>
                )}
              </>
            }
          >
            <PlaneLine through={() => [[0, gbS.get()], dir(ag.get())]} width={1.1} />
            <PlaneLine through={() => [[0, hbS.get()], dir(ah.get())]} tone="ink" width={1} dashed={same && gb === hb} />
            <PlaneDot at={() => (same ? null : meet())} tone="blob" r={1.5} pulse={`${gi},${gb},${hi},${hb}`} />
          </Plane>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-4 font-math text-[18px] italic text-blob-ink">g</span>
              <MathView src={lineSrc(mg, q(gb))} size="md" scope={`${scope}-g`} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 font-math text-[18px] italic text-ink">h</span>
              <MathView src={lineSrc(mh, q(hb))} size="md" scope={`${scope}-h`} />
            </div>
          </div>
          <div className="space-y-1 rounded-xl bg-blob-soft/50 px-4 py-3">
            <Caption>{t(tx("Set equal", "Gleichsetzen"))}</Caption>
            {steps.map((s, i) => (
              <div key={i} className={cn("text-ink", !X && i === 1 && "text-danger")}>
                <MathView src={s} size="sm" scope={`${scope}-s${i}`} />
              </div>
            ))}
            <p className="pt-1 text-[13.5px] leading-relaxed text-ink">
              <Inline text={verdict} />
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <LineSliders name="g" mi={gi} b={gb} onM={setGi} onB={setGb} tone="blob" />
        <LineSliders name="h" mi={hi} b={hb} onM={setHi} onB={setHb} tone="ink" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Angle lab: tan α = m. One line, or two lines and the angle between them.

const ANGLE_M = [-3, -2, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3];
/** A label without the chip, for small letters right on the drawing. */
const BARE = "bg-transparent! shadow-none! backdrop-blur-none! px-0! py-0!";

/** An arc of radius r from angle a to b (radians), as world points. */
function arc(a: number, b: number, r: number): Pt[] {
  const n = 28;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a + ((b - a) * i) / n;
    return [r * cos(t), r * sin(t)] as Pt;
  });
}

/** The acute angle between two directions (radians in (−π/2, π/2)), as [from, to] for drawing. */
function acuteSpan(a: number, b: number): [number, number] {
  let d = b - a;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d < -Math.PI / 2) d += Math.PI;
  return [a, a + d];
}

const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
const rel = (v: number) => (isWhole(v) ? "=" : "\\approx");
const deg = (v: number, l: Locale) => `${isWhole(v) ? numIn(Math.round(v), l) : numIn(v, l, 1)} \\deg`;
/** Slope angles with two decimals: the one-decimal result below always comes from the exact angles. */
const deg2 = (v: number, l: Locale) => `${isWhole(v) ? numIn(Math.round(v), l) : numIn(v, l, 2)} \\deg`;

export function AngleLab() {
  const t = useText();
  const l = useLocale();
  const [mode, setMode] = useState<"one" | "two">("one");
  const [gi, setGi] = useState(7);
  const [hi, setHi] = useState(3);
  const mg = ANGLE_M[gi];
  const mh = ANGLE_M[hi];
  const ag = useSpringTo(Math.atan(mg));
  const ah = useSpringTo(Math.atan(mh));
  const two = mode === "two";
  const aG = atanDeg(mg);
  const aH = atanDeg(mh);
  const diff = Math.abs(aG - aH);
  const delta = diff > 90 ? 180 - diff : diff;
  const perp = Math.abs(mg * mh + 1) < 1e-9;
  const parallel = mg === mh;

  const mS = numIn(mg, l);
  let lines: string[];
  let note: Text;
  if (!two) {
    lines = [`\\tan \\alpha = m = ${mS}`, `\\alpha = \\tan^{-1}(${mS}) ${rel(aG)} ${deg(aG, l)}`];
    note =
      mg > 0
        ? tx(
            `The line **rises** at $${deg(aG, "en")}$. Run $1$, rise $${mS}$: the steeper the line, the closer $\\alpha$ gets to $90 \\deg$.`,
            `Die Gerade **steigt** unter $${deg(aG, "de")}$. $1$ nach rechts, $${mS}$ nach oben: Je steiler die Gerade, desto näher kommt $\\alpha$ an $90 \\deg$.`,
          )
        : mg < 0
          ? tx(
              `Negative angle: the line **falls** at $${deg(-aG, "en")}$ to the $x$-axis. Measured from the positive $x$-axis counterclockwise it's $180 \\deg - ${deg(-aG, "en")} = ${deg(180 + aG, "en")}$.`,
              `Negativer Winkel: Die Gerade **fällt** unter $${deg(-aG, "de")}$ gegen die $x$-Achse. Von der positiven $x$-Achse gegen den Uhrzeigersinn gemessen sind es $180 \\deg - ${deg(-aG, "de")} = ${deg(180 + aG, "de")}$.`,
            )
          : tx("$m = 0$: the line is horizontal, $\\alpha = 0 \\deg$.", "$m = 0$: Die Gerade verläuft waagerecht, $\\alpha = 0 \\deg$.");
  } else {
    lines = [`\\alpha_g ${rel(aG)} ${deg2(aG, l)} \\quad \\alpha_h ${rel(aH)} ${deg2(aH, l)}`];
    if (parallel) {
      lines.push("\\varphi = 0 \\deg");
      note = tx("Same slope: the lines are parallel and never meet.", "Gleiche Steigung: Die Geraden sind parallel und schneiden sich nie.");
    } else {
      lines.push(`|${deg2(aG, l)} - ${aH < 0 ? `(${deg2(aH, l)})` : deg2(aH, l)}| ${rel(diff)} ${deg(diff, l)}`);
      if (diff > 90) lines.push(`\\varphi ${rel(diff)} 180 \\deg - ${deg(diff, l)} = ${deg(delta, l)}`);
      else lines.push(`\\varphi ${rel(delta)} ${deg(delta, l)}`);
      note = perp
        ? tx(`$m_g \\cdot m_h = -1$: the lines are **perpendicular**, $\\varphi = 90 \\deg$.`, `$m_g \\cdot m_h = -1$: Die Geraden sind **orthogonal**, $\\varphi = 90 \\deg$.`)
        : diff > 90
          ? tx("The difference is more than $90 \\deg$. The angle of intersection is the **acute** one, so take $180 \\deg$ minus it.", "Die Differenz ist größer als $90 \\deg$. Der Schnittwinkel ist der **spitze** Winkel, also rechnest du $180 \\deg$ minus die Differenz.")
          : tx("The angle of intersection $\\varphi$ is the difference of the two slope angles.", "Der Schnittwinkel $\\varphi$ ist die Differenz der beiden Steigungswinkel.");
    }
  }

  const span = (): Pt[] => {
    const [a, b] = acuteSpan(ag.get(), ah.get());
    return arc(a, b, 0.95);
  };

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          xRange={[-3, 3]}
          yRange={[-3, 3]}
          label={tx("Lines through the origin with their slope angles", "Ursprungsgeraden mit ihren Steigungswinkeln")}
          overlay={
            <>
              <PlaneTag at={() => [(two ? 0.98 : 0.92) * cos(ag.get() / 2), (two ? 0.98 : 0.92) * sin(ag.get() / 2)]} className={BARE}>
                <MathView src={two ? "\\alpha_g" : "\\alpha"} size="sm" animate={false} className="text-blob-ink" />
              </PlaneTag>
              {!two && mg !== 0 && (
                <>
                  <PlaneTag at={() => [0.5, 0]} dy={mg > 0 ? 11 : -11} className={BARE}>
                    <MathView src="1" size="sm" animate={false} className="text-ink" />
                  </PlaneTag>
                  <PlaneTag at={() => [1, Math.tan(ag.get()) / 2]} anchor="left" dx={5} className={BARE}>
                    <MathView src="m" size="sm" animate={false} className="text-blob-ink" />
                  </PlaneTag>
                </>
              )}
              {two && (
                <>
                  <PlaneTag at={() => [1.75 * cos(ah.get() / 2), 1.75 * sin(ah.get() / 2)]} className={BARE}>
                    <MathView src={"\\alpha_h"} size="sm" animate={false} className="text-ink" />
                  </PlaneTag>
                  {!parallel && (
                    <PlaneTag
                      at={() => {
                        const [a, b] = acuteSpan(ag.get(), ah.get());
                        const mid = (a + b) / 2;
                        return [-1.3 * cos(mid), -1.3 * sin(mid)];
                      }}
                      className={BARE}
                    >
                      <MathView src={"\\varphi"} size="sm" animate={false} className="text-ok" />
                    </PlaneTag>
                  )}
                </>
              )}
            </>
          }
        >
          {!two && <PlanePath shape={() => [[0, 0], [1, 0], [1, Math.tan(ag.get())]]} closed fill="color-mix(in oklab, var(--blob) 15%, transparent)" stroke={TONE.blob} width={0.45} dashed />}
          <PlanePath shape={() => arc(0, ag.get(), two ? 0.7 : 0.6)} stroke={TONE.blob} width={0.7} />
          {two && <PlanePath shape={() => arc(0, ah.get(), 1.4)} stroke={TONE.ink} width={0.6} />}
          {two && !parallel && (
            <>
              <PlanePath shape={span} stroke={TONE.ok} width={0.8} />
              <PlanePath shape={() => span().map(([x, y]) => [-x, -y] as Pt)} stroke={TONE.ok} width={0.8} />
            </>
          )}
          <PlaneLine through={() => [[0, 0], dir(ag.get())]} width={1.1} />
          {two && <PlaneLine through={() => [[0, 0], dir(ah.get())]} tone="ink" width={1} />}
          <PlaneDot at={() => [0, 0]} tone="ink" r={0.8} />
        </Plane>
      </div>

      <div className="space-y-4">
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            ["one", tx("Slope angle", "Steigungswinkel")],
            ["two", tx("Two lines", "Zwei Geraden")],
          ]}
        />
        <div className="space-y-1 rounded-xl border border-line bg-surface px-4 py-3">
          {lines.map((s, i) => (
            <div key={`${mode}-${i}`} className="text-ink">
              <MathView src={s} size="sm" animate={false} />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>{t(two ? tx("Slope of g", "Steigung von g") : tx("Slope m", "Steigung m"))}</Caption>
            <MathView src={`m${two ? "_g" : ""} = ${mS}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={gi} count={ANGLE_M.length} onChange={setGi} zero={4} label={two ? tx("Slope of g", "Steigung von g") : tx("Slope m", "Steigung m")} valueText={`m = ${mS}`} />
        </div>
        {two && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Caption>{t(tx("Slope of h", "Steigung von h"))}</Caption>
              <MathView src={`m_h = ${numIn(mh, l)}`} size="sm" animate={false} className="text-ink" />
            </div>
            <StepSlider value={hi} count={ANGLE_M.length} onChange={setHi} zero={4} tone="ink" label={tx("Slope of h", "Steigung von h")} valueText={`m = ${numIn(mh, l)}`} />
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={`${mode}-${gi}-${hi}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="min-h-[3em] text-[14px] leading-relaxed text-ink-2">
            <Inline text={note} />
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distance lab: the perpendicular through P, its foot F on g, and the distance |PF|.

type G = { m: Frac; b: Frac };
const GS: G[] = [
  { m: q(1, 2), b: q(1) },
  { m: q(-1), b: q(2) },
  { m: q(2), b: q(-3) },
  { m: q(-1, 3), b: q(-1) },
];
const STEP_NAMES: Text[] = [tx("Perpendicular", "Lotgerade"), tx("Foot", "Lotfußpunkt"), tx("Distance", "Abstand")];

export function DistanceLab() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const [gi, setGi] = useState(0);
  const [P, setP] = useState<Pt>([4, -2]);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState(false);
  const g = GS[gi];
  const ag = useSpringTo(Math.atan(qv(g.m)));
  const bS = useSpringTo(qv(g.b));
  const px = useSpringTo(P[0]);
  const py = useSpringTo(P[1]);

  const mh = neg(div(ONE, g.m));
  const bh = sub(q(P[1]), mul(mh, q(P[0])));
  const Fx = div(sub(bh, g.b), sub(g.m, mh));
  const Fy = add(mul(g.m, Fx), g.b);
  const dx = sub(q(P[0]), Fx);
  const dy = sub(q(P[1]), Fy);
  const d2 = add(mul(dx, dx), mul(dy, dy));
  const d = Math.sqrt(qv(d2));
  const onLine = d2.n === 0;

  const foot = () => crossing([0, bS.get()], dir(ag.get()), [px.get(), py.get()], dir(ag.get() + Math.PI / 2));
  const marker = (): Pt[] | null => {
    const F = foot();
    if (!F) return null;
    const u = dir(ag.get());
    const vx = px.get() - F[0];
    const vy = py.get() - F[1];
    const len = Math.hypot(vx, vy);
    if (len < 0.3) return null;
    const v: Pt = [vx / len, vy / len];
    const r = 0.45;
    return [
      [F[0] + u[0] * r, F[1] + u[1] * r],
      [F[0] + u[0] * r + v[0] * r, F[1] + u[1] * r + v[1] * r],
      [F[0] + v[0] * r, F[1] + v[1] * r],
    ];
  };

  const sq = (f: Frac) => (f.n < 0 ? `(${nice(f, l)})^2` : `${nice(f, l)}^2`);
  const rhs = (m: Frac, b: Frac) => plain(lineSrc(m, b)).replace(/^y = /, "");
  const rows: { n: number; parts: [string | null, string][] }[] = [
    {
      n: 1,
      parts: [
        [null, `m_h = -\\frac{1}{m_g} = ${nice(mh, l)}`],
        ["h", plain(lineSrc(mh, bh))],
      ],
    },
    {
      n: 2,
      parts: [
        [null, `${rhs(g.m, g.b)} = ${rhs(mh, bh)}`],
        [null, `F${pt(nice(Fx, l), nice(Fy, l))}`],
      ],
    },
    { n: 3, parts: [[null, `d = \\sqrt{${sq(dx)} + ${sq(dy)}} ${Number.isInteger(d) ? "=" : "\\approx"} ${numIn(d, l, Number.isInteger(d) ? undefined : 2)}`]] },
  ];

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          xRange={[-5, 5]}
          yRange={[-5, 5]}
          label={tx("The line g, the point P and the perpendicular from P to g", "Die Gerade g, der Punkt P und das Lot von P auf g")}
          onMove={(_, p) => {
            setTouched(true);
            setP(p);
          }}
          overlay={
            <>
              <PlaneTag at={() => [px.get(), py.get()]} anchor={P[0] >= 2 ? "right" : "left"} dx={P[0] >= 2 ? -12 : 12} dy={-14}>
                <MathView src={pt(P[0], P[1], "P")} size="sm" animate={false} className="text-ink" />
              </PlaneTag>
              {step >= 2 && !onLine && (
                <PlaneTag at={foot} anchor="right" dx={-10} dy={14}>
                  <MathView src="F" size="sm" animate={false} className="text-ink" />
                </PlaneTag>
              )}
              {step >= 3 && !onLine && (
                <PlaneTag
                  at={() => {
                    const F = foot();
                    return F ? [(F[0] + px.get()) / 2, (F[1] + py.get()) / 2] : null;
                  }}
                  anchor="left"
                  dx={8}
                >
                  <MathView src={`d ${Number.isInteger(d) ? "=" : "\\approx"} ${numIn(d, l, Number.isInteger(d) ? undefined : 2)}`} size="sm" animate={false} className="text-ok" />
                </PlaneTag>
              )}
              <PlaneTag at={() => alongLine(planeGeo([-5, 5], [-5, 5]), [0, bS.get()], dir(ag.get()), 0.08)} dy={-14}>
                <MathView src="g" size="sm" animate={false} className="text-blob-ink" />
              </PlaneTag>
            </>
          }
        >
          <PlaneLine through={() => [[0, bS.get()], dir(ag.get())]} width={1.1} />
          <PlaneLine through={() => [[px.get(), py.get()], dir(ag.get() + Math.PI / 2)]} tone="ink" width={0.7} dashed opacity={step >= 1 ? 0.8 : 0} />
          <PlanePath shape={marker} stroke={TONE.ink} width={0.45} opacity={step >= 2 ? 1 : 0} />
          <PlanePath shape={() => [[px.get(), py.get()], foot() ?? [px.get(), py.get()]]} stroke={TONE.ok} width={1.4} opacity={step >= 3 ? 1 : 0} />
          <PlaneDot at={() => (step >= 2 ? foot() : null)} tone="ink" r={1.1} />
          <PlaneHandle id="P" x={px} y={py} at={P} tone="ink" label={tx("Point P", "Punkt P")} hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1">
            <Caption>{t(tx("Line g", "Gerade g"))}</Caption>
          </span>
          {GS.map((o, i) => (
            <button
              key={i}
              onClick={() => setGi(i)}
              aria-pressed={i === gi}
              className={cn("rounded-lg border px-2.5 py-1 transition-colors", i === gi ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover")}
            >
              <MathView src={plain(lineSrc(o.m, o.b))} size="sm" animate={false} />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {STEP_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors", step >= i + 1 ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-3 hover:text-ink")}
            >
              <span className="font-semibold">{i + 1}</span>
              {t(name)}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
          {onLine ? (
            <p className="text-[14px] text-ink">{t(tx("P lies on g: the distance is 0.", "P liegt auf g: Der Abstand ist 0."))}</p>
          ) : (
            <AnimatePresence initial={false}>
              {rows
                .filter((r) => r.n <= step)
                .map((r) => (
                  <motion.div key={r.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2.5">
                    <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-blob-soft text-[11px] font-bold text-blob-ink">{r.n}</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-ink">
                      {r.parts.map(([label, src], k) => (
                        <span key={k} className="flex items-center gap-1.5">
                          {label && <span className="font-math text-[17px] italic">{label}:</span>}
                          <MathView src={src} size="sm" scope={`${scope}-r${r.n}-${k}`} />
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step >= 3} className="rounded-lg bg-blob px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {t(tx("Next step", "Nächster Schritt"))}
          </button>
          <button onClick={() => setStep(1)} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-hover">
            {t(tx("From the start", "Von vorn"))}
          </button>
        </div>

        <Note>
          {t(
            step === 1
              ? tx("Step 1: the perpendicular h through P. Its slope is the negative reciprocal of g's slope.", "Schritt 1: die Lotgerade h durch P. Ihre Steigung ist der negative Kehrwert der Steigung von g.")
              : step === 2
                ? tx("Step 2: the foot F is where h meets g. Set the two equations equal.", "Schritt 2: Der Lotfußpunkt F ist der Schnittpunkt von h und g. Setz die beiden Gleichungen gleich.")
                : tx("Step 3: the distance from P to g is the length of PF. Drag P and watch d change.", "Schritt 3: Der Abstand von P zu g ist die Länge von PF. Zieh P und beobachte, wie sich d ändert."),
          )}
        </Note>
      </div>
    </div>
  );
}
