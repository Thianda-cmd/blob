"use client";

// Level 3 (Klasse 9–10): pyramid and cone (V = ⅓ · G · h, lateral surface, slant heights with
// Pythagoras), the sphere (V = 4/3 πr³, O = 4πr²), composite solids, and scaling: lengths × k,
// areas × k², volumes × k³.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson } from "@/learn/types";
import { figure, type FigureSpec } from "./figures";
import { exact, exactNum, matchTask, mistakeList, rounded, say, weighted } from "./kit";
import { AreaVolumePourLab, AreaVolumeScaleLab } from "./widgets3";

const PI = Math.PI;
const q = (unit: string) => `"${unit}"`;
const E = (t: Text) => (typeof t === "string" ? t : t.en);
const D = (t: Text) => (typeof t === "string" ? t : t.de);
const join = (...parts: (Text | undefined)[]): Text =>
  tx(parts.filter(Boolean).map((p) => E(p!)).join(" "), parts.filter(Boolean).map((p) => D(p!)).join(" "));
const ROUND1 = tx("Round to 1 decimal place.", "Runde auf eine Nachkommastelle.");

/** Pythagorean triples: leg, leg, hypotenuse. */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15],
  [8, 15, 17], [15, 8, 17], [12, 16, 20], [16, 12, 20], [7, 24, 25], [24, 7, 25], [20, 21, 29], [10, 24, 26],
];

// ---------------------------------------------------------------------------
// Pyramid volume

const PYR_V = tx("Find the volume of the pyramid", "Berechne das Volumen der Pyramide");

function pyramidVolumeTask(rng: Rng): Exercise {
  const kind = rng.pick(["square", "square", "slant", "rect", "story"] as const);
  if (kind === "story") {
    const st = rng.pick([
      { a: 230, h: 147, text: tx("The Great Pyramid of Giza originally had a square base with sides of about 230 m and was about 147 m high.", "Die Cheops-Pyramide hatte ursprünglich eine quadratische Grundfläche mit etwa 230 m Seitenlänge und war etwa 147 m hoch.") },
      { a: 35, h: 21, text: tx("The glass pyramid of the Louvre in Paris has a square base with sides of about 35 m and is about 21 m high.", "Die Glaspyramide des Louvre in Paris hat eine quadratische Grundfläche mit etwa 35 m Seitenlänge und ist etwa 21 m hoch.") },
    ]);
    const V = (st.a * st.a * st.h) / 3;
    const m = mistakeList(exact(V, "m³", "V ="));
    m.add(st.a * st.a * st.h, tx("Forgot the third", "Das Drittel vergessen"), tx("That's a whole prism. A pyramid holds only **a third** of it: $V = \\frac{1}{3} G h$.", "Das ist ein ganzes Prisma. Eine Pyramide fasst nur **ein Drittel** davon: $V = \\frac{1}{3} G h$."));
    m.add((st.a * st.h) / 3, tx("Base not squared", "Grundfläche nicht quadriert"), tx("The base is a square: $G = a^2 = a \\cdot a$.", "Die Grundfläche ist ein Quadrat: $G = a^2 = a \\cdot a$."));
    m.add((st.a * st.a * st.h) / 2, tx("Half instead of a third", "Hälfte statt Drittel"), tx("A pyramid is **a third** of the prism, not half of it.", "Eine Pyramide ist **ein Drittel** des Prismas, nicht die Hälfte."));
    return {
      instruction: PYR_V,
      text: st.text,
      answer: exact(V, "m³", "V ="),
      hint: tx("$V = \\frac{1}{3} \\cdot a^2 \\cdot h$.", "$V = \\frac{1}{3} \\cdot a^2 \\cdot h$."),
      solution: pyrVFrames(st.a, st.a, st.h, "m"),
      mistakes: m.list,
    };
  }
  const unit = rng.pick(["cm", "m", "cm"]);
  let a: number;
  let b: number;
  let h: number;
  let hs: number | null = null;
  if (kind === "slant") {
    const [half, hh, s] = rng.pick(TRIPLES.filter((t) => t[0] <= 12 && t[1] <= 16));
    a = 2 * half;
    b = a;
    h = hh;
    hs = s;
  } else {
    a = rng.int(2, 12);
    b = kind === "rect" ? rng.int(2, 10) : a;
    if (kind === "rect" && a === b) b = a + 1;
    h = rng.int(2, 15);
  }
  if ((a * b * h) % 3 !== 0) return pyramidVolumeTask(rng);
  const V = (a * b * h) / 3;
  const m = mistakeList(exact(V, `${unit}³`, "V ="));
  m.add(a * b * h, tx("Forgot the third", "Das Drittel vergessen"), tx("That's the prism around it. The pyramid holds only **a third**: $V = \\frac{1}{3} G h$.", "Das ist das Prisma drumherum. Die Pyramide fasst nur **ein Drittel**: $V = \\frac{1}{3} G h$."));
  if (hs) m.add((a * b * hs) / 3, tx("Slant height used", "Seitenhöhe genommen"), tx("$h_s$ is the height of a **side face**. The volume needs the height of the solid $h$: from the apex straight down.", "$h_s$ ist die Höhe einer **Seitenfläche**. Fürs Volumen brauchst du die Körperhöhe $h$: von der Spitze senkrecht nach unten."));
  m.add((a * b * h) / 2, tx("Half instead of a third", "Hälfte statt Drittel"), tx("A pyramid is **a third** of the prism, not half of it.", "Eine Pyramide ist **ein Drittel** des Prismas, nicht die Hälfte."));
  if (a === b) m.add((a * h) / 3, tx("Base not squared", "Grundfläche nicht quadriert"), tx("The base is a square: $G = a^2$.", "Die Grundfläche ist ein Quadrat: $G = a^2$."));
  const fig: FigureSpec = {
    kind: "pyr",
    a,
    b,
    h,
    la: `a = ${a} ${unit}`,
    ...(a !== b ? { lb: `b = ${b} ${unit}` } : {}),
    lh: `h = ${h} ${unit}`,
    ...(hs ? { lhs: `h_s = ${hs} ${unit}` } : {}),
  };
  return {
    instruction: PYR_V,
    text: a === b ? tx("A pyramid with a square base.", "Eine Pyramide mit quadratischer Grundfläche.") : tx("A pyramid with a rectangular base.", "Eine Pyramide mit rechteckiger Grundfläche."),
    visual: figure(fig),
    answer: exact(V, `${unit}³`, "V ="),
    hint: tx("$V = \\frac{1}{3} \\cdot G \\cdot h$ with the height of the solid.", "$V = \\frac{1}{3} \\cdot G \\cdot h$ mit der Körperhöhe."),
    solution: pyrVFrames(a, b, h, unit),
    mistakes: m.list,
  };
}

function pyrVFrames(a: number, b: number, h: number, unit: string): Frame[] {
  const G = a * b;
  return [
    { math: "V#V =#e \\frac{1}{3}#f \\cdot#m G#G \\cdot#m2 h#h", note: tx("Pyramid: a third of base times height.", "Pyramide: ein Drittel von Grundfläche mal Höhe.") },
    { math: say((f) => `G#G =#e ${a === b ? `${a}#a^{2#sq}` : `${a}#a \\cdot#mg ${b}#b`} =#eg ${f.n(G)}#gv ${q(`${unit}²`)}#ug`), note: a === b ? tx("The base is a square.", "Die Grundfläche ist ein Quadrat.") : tx("The base is a rectangle.", "Die Grundfläche ist ein Rechteck.") },
    { math: say((f) => `V#V =#e \\frac{1}{3}#f \\cdot#m ${f.n(G)}#G \\cdot#m2 ${f.n(h)}#h`), note: tx("Put in $G$ and $h$.", "Setz $G$ und $h$ ein.") },
    { math: say((f) => `V#V =#e ${exactNum(f, (G * h) / 3)}#G ${q(`${unit}³`)}#u`), note: say((f) => f.t(`$${f.n(G)} \\cdot ${f.n(h)} = ${f.n(G * h)}$, a third of it is $${exactNum(f, (G * h) / 3)}$.`, `$${f.n(G)} \\cdot ${f.n(h)} = ${f.n(G * h)}$, ein Drittel davon ist $${exactNum(f, (G * h) / 3)}$.`)) },
  ];
}

// ---------------------------------------------------------------------------
// Heights with Pythagoras

const MISSING_LEN = tx("Find the missing length", "Berechne die fehlende Länge");

function pythagorasTask(rng: Rng): Exercise {
  const kind = rng.pick(["pyrHs", "coneS", "coneH", "pyrH"] as const);
  const unit = rng.pick(["cm", "m", "cm"]);
  const [x, y, z] = rng.pick(TRIPLES);
  if (kind === "pyrHs" || kind === "pyrH") {
    const a = 2 * x;
    const h = y;
    const hs = z;
    const findHs = kind === "pyrHs";
    const right = exact(findHs ? hs : h, unit, findHs ? "h_s =" : "h =");
    const m = mistakeList(right);
    if (findHs) {
      m.add(h + x, tx("Added the sides", "Seiten addiert"), tx("In a right triangle you can't just add the sides. Use $h_s^2 = h^2 + (\\frac{a}{2})^2$.", "Im rechtwinkligen Dreieck darfst du die Seiten nicht einfach addieren. Nimm $h_s^2 = h^2 + (\\frac{a}{2})^2$."));
      m.add(Math.sqrt(h * h + a * a), tx("Forgot to halve a", "a nicht halbiert"), tx("The triangle inside goes from the middle of the base to the edge: that's **half** of $a$.", "Das Dreieck im Inneren reicht von der Mitte der Grundfläche bis zur Kante: Das ist die **Hälfte** von $a$."), false, 2);
      m.add(h * h + x * x, tx("Square root missing", "Wurzel vergessen"), tx("That's $h_s^2$. Take the square root to get $h_s$.", "Das ist $h_s^2$. Zieh noch die Wurzel, dann hast du $h_s$."), true);
      if (h > x) m.add(Math.sqrt(h * h - x * x), tx("Subtracted", "Subtrahiert"), tx("$h_s$ is the **hypotenuse**, the longest side: add the squares.", "$h_s$ ist die **Hypotenuse**, die längste Seite: Die Quadrate werden addiert."), false, 2);
    } else {
      m.add(Math.sqrt(hs * hs + x * x), tx("Added instead of subtracted", "Addiert statt subtrahiert"), tx("$h_s$ is the hypotenuse here. For a leg, subtract: $h^2 = h_s^2 - (\\frac{a}{2})^2$.", "$h_s$ ist hier die Hypotenuse. Für eine Kathete subtrahierst du: $h^2 = h_s^2 - (\\frac{a}{2})^2$."), false, 2);
      if (hs > a) m.add(Math.sqrt(hs * hs - a * a), tx("Forgot to halve a", "a nicht halbiert"), tx("The leg at the bottom is **half** of $a$: from the middle to the edge.", "Die Kathete unten ist die **Hälfte** von $a$: von der Mitte bis zur Kante."), false, 2);
      m.add(hs * hs - x * x, tx("Square root missing", "Wurzel vergessen"), tx("That's $h^2$. Take the square root.", "Das ist $h^2$. Zieh noch die Wurzel."), true);
      m.add(hs - x, tx("Subtracted the sides", "Seiten subtrahiert"), tx("Subtract the **squares**, then take the root.", "Subtrahiere die **Quadrate** und zieh dann die Wurzel."));
    }
    return {
      instruction: MISSING_LEN,
      text: findHs
        ? tx(`A square pyramid has $a = ${a} ${q(unit)}$ and the height $h = ${h} ${q(unit)}$. Find the height $h_s$ of a side face.`, `Eine quadratische Pyramide hat $a = ${a} ${q(unit)}$ und die Höhe $h = ${h} ${q(unit)}$. Berechne die Höhe $h_s$ einer Seitenfläche.`)
        : tx(`A square pyramid has $a = ${a} ${q(unit)}$ and side faces with the height $h_s = ${hs} ${q(unit)}$. Find the height $h$ of the pyramid.`, `Eine quadratische Pyramide hat $a = ${a} ${q(unit)}$ und Seitenflächen mit der Höhe $h_s = ${hs} ${q(unit)}$. Berechne die Körperhöhe $h$.`),
      visual: figure({ kind: "pyr", a, h, la: `a = ${a} ${unit}`, lh: findHs ? `h = ${h} ${unit}` : "h = ?", lhs: findHs ? "h_s = ?" : `h_s = ${hs} ${unit}`, tri: true }),
      answer: right,
      hint: tx("Look at the shaded right triangle: $h$, half of $a$ and $h_s$.", "Schau auf das gefärbte rechtwinklige Dreieck: $h$, die Hälfte von $a$ und $h_s$."),
      solution: findHs
        ? [
            { math: "h_s#s^{2#q1} =#e h#h^{2#q2} +#p (\\frac{a#a}{2#two})#br^{2#q3}", note: tx("Height $h$ and half the base edge are the legs, $h_s$ is the hypotenuse.", "Höhe $h$ und halbe Grundkante sind die Katheten, $h_s$ ist die Hypotenuse.") },
            { math: `h_s#s^{2#q1} =#e ${h}#h^{2#q2} +#p ${x}#a^{2#q3}`, note: tx(`Half of $${a}$ is $${x}$.`, `Die Hälfte von $${a}$ ist $${x}$.`) },
            { math: `h_s#s^{2#q1} =#e ${h * h}#h +#p ${x * x}#a =#e2 ${z * z}#r`, note: tx("Square and add.", "Quadrieren und addieren.") },
            { math: `h_s#s =#e \\sqrt{${z * z}}#rt =#e2 ${z}#r ${q(unit)}#u`, note: tx("Take the square root. Done!", "Wurzel ziehen. Fertig!") },
          ]
        : [
            { math: "h#h^{2#q2} =#e h_s#s^{2#q1} -#p (\\frac{a#a}{2#two})#br^{2#q3}", note: tx("$h_s$ is the hypotenuse, so for the leg $h$ subtract.", "$h_s$ ist die Hypotenuse, also subtrahierst du für die Kathete $h$.") },
            { math: `h#h^{2#q2} =#e ${z}#s^{2#q1} -#p ${x}#a^{2#q3}`, note: tx(`Half of $${a}$ is $${x}$.`, `Die Hälfte von $${a}$ ist $${x}$.`) },
            { math: `h#h^{2#q2} =#e ${z * z}#s -#p ${x * x}#a =#e2 ${y * y}#r`, note: tx("Square and subtract.", "Quadrieren und subtrahieren.") },
            { math: `h#h =#e \\sqrt{${y * y}}#rt =#e2 ${y}#r ${q(unit)}#u`, note: tx("Take the square root. Done!", "Wurzel ziehen. Fertig!") },
          ],
      mistakes: m.list,
    };
  }
  const r = x;
  const h = y;
  const s = z;
  const findS = kind === "coneS";
  const right = exact(findS ? s : h, unit, findS ? "s =" : "h =");
  const m = mistakeList(right);
  if (findS) {
    m.add(r + h, tx("Added the sides", "Seiten addiert"), tx("You can't just add the sides. Pythagoras: $s^2 = h^2 + r^2$.", "Die Seiten darfst du nicht einfach addieren. Pythagoras: $s^2 = h^2 + r^2$."));
    m.add(r * r + h * h, tx("Square root missing", "Wurzel vergessen"), tx("That's $s^2$. Take the square root.", "Das ist $s^2$. Zieh noch die Wurzel."), true);
    if (h !== r) m.add(Math.sqrt(Math.abs(h * h - r * r)), tx("Subtracted", "Subtrahiert"), tx("$s$ is the hypotenuse, the longest side: add the squares.", "$s$ ist die Hypotenuse, die längste Seite: Die Quadrate werden addiert."), false, 2);
    m.add(Math.sqrt(h * h + 4 * r * r), tx("Diameter used", "Durchmesser genommen"), tx("The triangle inside uses the **radius**, not the diameter.", "Das Dreieck im Inneren hat den **Radius** als Kathete, nicht den Durchmesser."), false, 2);
  } else {
    m.add(Math.sqrt(s * s + r * r), tx("Added instead of subtracted", "Addiert statt subtrahiert"), tx("$s$ is the hypotenuse here. For the leg $h$: $h^2 = s^2 - r^2$.", "$s$ ist hier die Hypotenuse. Für die Kathete $h$: $h^2 = s^2 - r^2$."), false, 2);
    m.add(s * s - r * r, tx("Square root missing", "Wurzel vergessen"), tx("That's $h^2$. Take the square root.", "Das ist $h^2$. Zieh noch die Wurzel."), true);
    m.add(s - r, tx("Subtracted the sides", "Seiten subtrahiert"), tx("Subtract the **squares**, then take the root.", "Subtrahiere die **Quadrate** und zieh dann die Wurzel."));
  }
  return {
    instruction: MISSING_LEN,
    text: findS
      ? tx(`A cone has the radius $r = ${r} ${q(unit)}$ and the height $h = ${h} ${q(unit)}$. Find the slant height $s$.`, `Ein Kegel hat den Radius $r = ${r} ${q(unit)}$ und die Höhe $h = ${h} ${q(unit)}$. Berechne die Mantellinie $s$.`)
      : tx(`A cone has the radius $r = ${r} ${q(unit)}$ and the slant height $s = ${s} ${q(unit)}$. Find its height $h$.`, `Ein Kegel hat den Radius $r = ${r} ${q(unit)}$ und die Mantellinie $s = ${s} ${q(unit)}$. Berechne seine Höhe $h$.`),
    visual: figure({ kind: "cone", r, h, lr: `r = ${r} ${unit}`, lh: findS ? `h = ${h} ${unit}` : "h = ?", ls: findS ? "s = ?" : `s = ${s} ${unit}` }),
    answer: right,
    hint: tx("Height, radius and slant height form a right triangle. $s$ is the hypotenuse.", "Höhe, Radius und Mantellinie bilden ein rechtwinkliges Dreieck. $s$ ist die Hypotenuse."),
    solution: findS
      ? [
          { math: "s#s^{2#q1} =#e h#h^{2#q2} +#p r#r^{2#q3}", note: tx("Height and radius are the legs, the slant height is the hypotenuse.", "Höhe und Radius sind die Katheten, die Mantellinie ist die Hypotenuse.") },
          { math: `s#s^{2#q1} =#e ${h}#h^{2#q2} +#p ${r}#r^{2#q3}`, note: tx("Put in.", "Einsetzen.") },
          { math: `s#s^{2#q1} =#e ${h * h}#h +#p ${r * r}#r =#e2 ${s * s}#v`, note: tx("Square and add.", "Quadrieren und addieren.") },
          { math: `s#s =#e \\sqrt{${s * s}}#rt =#e2 ${s}#v ${q(unit)}#u`, note: tx("Take the square root. Done!", "Wurzel ziehen. Fertig!") },
        ]
      : [
          { math: "h#h^{2#q2} =#e s#s^{2#q1} -#p r#r^{2#q3}", note: tx("$s$ is the hypotenuse: for the leg $h$ subtract.", "$s$ ist die Hypotenuse: Für die Kathete $h$ wird subtrahiert.") },
          { math: `h#h^{2#q2} =#e ${s}#s^{2#q1} -#p ${r}#r^{2#q3}`, note: tx("Put in.", "Einsetzen.") },
          { math: `h#h^{2#q2} =#e ${s * s}#s -#p ${r * r}#r =#e2 ${h * h}#v`, note: tx("Square and subtract.", "Quadrieren und subtrahieren.") },
          { math: `h#h =#e \\sqrt{${h * h}}#rt =#e2 ${h}#v ${q(unit)}#u`, note: tx("Take the square root. Done!", "Wurzel ziehen. Fertig!") },
        ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Cone volume and surface

const CONE_V = tx("Find the volume of the cone", "Berechne das Volumen des Kegels");
const CONE_O = tx("Find the surface area of the cone", "Berechne die Oberfläche des Kegels");
const CONE_M = tx("Find the curved surface of the cone", "Berechne die Mantelfläche des Kegels");

function coneVolumeTask(rng: Rng): Exercise {
  const kind = rng.pick(["rh", "rh", "dh", "rs"] as const);
  const unit = rng.pick(["cm", "m", "cm"]);
  let r: number;
  let h: number;
  let s = 0;
  if (kind === "rs") {
    [r, h, s] = rng.pick(TRIPLES.filter((t) => t[0] <= 12));
  } else {
    r = rng.pick([2, 3, 4, 5, 6, 8, 10, 1.5, 2.5]);
    h = rng.pick([3, 4, 5, 6, 8, 9, 10, 12, 15]);
  }
  const V = (PI * r * r * h) / 3;
  const right = rounded(V, 1, `${unit}³`, "V =");
  const m = mistakeList(right, 1);
  m.add(PI * r * r * h, tx("Forgot the third", "Das Drittel vergessen"), tx("That's the cylinder around the cone. A cone holds only **a third**: $V = \\frac{1}{3} \\pi r^2 h$.", "Das ist der Zylinder drumherum. Ein Kegel fasst nur **ein Drittel**: $V = \\frac{1}{3} \\pi r^2 h$."));
  if (kind === "dh") m.add((PI * 4 * r * r * h) / 3, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("The formula needs the **radius**: half the diameter.", "Die Formel braucht den **Radius**: den halben Durchmesser."));
  if (kind === "rs") m.add((PI * r * r * s) / 3, tx("Slant height used", "Mantellinie genommen"), tx("$s$ is the slant height along the side. The volume needs the height $h$: from the apex straight down. Pythagoras!", "$s$ ist die Mantellinie an der Seite. Fürs Volumen brauchst du die Höhe $h$: von der Spitze senkrecht nach unten. Pythagoras!"));
  m.add((PI * r * h) / 3, tx("Forgot the square", "Quadrat vergessen"), tx("The base is a circle: $\\pi r^2$, radius squared.", "Die Grundfläche ist ein Kreis: $\\pi r^2$, Radius quadriert."));
  const fig: FigureSpec =
    kind === "dh"
      ? { kind: "cone", r, h, lr: say((f) => `d = ${f.n(2 * r)} ${unit}`), lh: `h = ${h} ${unit}`, diameter: true }
      : kind === "rs"
        ? { kind: "cone", r, h, lr: `r = ${r} ${unit}`, ls: `s = ${s} ${unit}`, hideH: false, lh: "h" }
        : { kind: "cone", r, h, lr: say((f) => `r = ${f.n(r)} ${unit}`), lh: `h = ${h} ${unit}` };
  const story = kind === "rh" && unit === "m" && rng.chance(0.4);
  const frames: Frame[] = [{ math: "V#V =#e \\frac{1}{3}#f \\cdot#m \\pi#pi r#r^{2#sq} \\cdot#m2 h#h", note: tx("Cone: a third of the cylinder with the same base and height.", "Kegel: ein Drittel des Zylinders mit gleicher Grundfläche und Höhe.") }];
  if (kind === "dh") frames.push({ math: say((f) => `r#r =#e ${f.n(2 * r)}#d :#m 2#two =#e2 ${f.n(r)}#rv ${q(unit)}#u`), note: tx("Halve the diameter first.", "Erst den Durchmesser halbieren.") });
  if (kind === "rs") frames.push({ math: `h#h =#e \\sqrt{${s}^2 - ${r}^2}#rt =#e2 \\sqrt{${h * h}}#rt2 =#e3 ${h}#hv ${q(unit)}#u`, note: tx("The height isn't given: Pythagoras with the slant height $s$ as the hypotenuse.", "Die Höhe ist nicht gegeben: Pythagoras mit der Mantellinie $s$ als Hypotenuse.") });
  frames.push(
    { math: say((f) => `V#V =#e \\frac{1}{3}#f \\cdot#m \\pi#pi \\cdot#m3 ${f.n(r)}#r^{2#sq} \\cdot#m2 ${h}#h`), note: tx("Put in radius and height.", "Setz Radius und Höhe ein.") },
    { math: say((f) => `V#V =#e ${exactNum(f, (r * r * h) / 3)}#r \\pi#pi`), note: say((f) => f.t(`$\\frac{1}{3} \\cdot ${f.n(r * r)} \\cdot ${h} = ${exactNum(f, (r * r * h) / 3)}$.`, `$\\frac{1}{3} \\cdot ${f.n(r * r)} \\cdot ${h} = ${exactNum(f, (r * r * h) / 3)}$.`)) },
    { math: say((f) => `V#V \\approx#e ${f.d(V, 1)}#r ${q(`${unit}³`)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
  );
  return {
    instruction: CONE_V,
    text: story
      ? join(
          say((f) => f.t(`A pile of sand has the shape of a cone with the radius ${f.w(r)} m and the height ${h} m. How much sand is it?`, `Ein Sandhaufen hat die Form eines Kegels mit dem Radius ${f.w(r)} m und der Höhe ${h} m. Wie viel Sand ist das?`)),
          ROUND1,
        )
      : ROUND1,
    visual: story ? undefined : figure(fig),
    answer: right,
    hint: kind === "rs" ? tx("First the height with Pythagoras, then $V = \\frac{1}{3} \\pi r^2 h$.", "Erst die Höhe mit Pythagoras, dann $V = \\frac{1}{3} \\pi r^2 h$.") : tx("$V = \\frac{1}{3} \\pi r^2 h$.", "$V = \\frac{1}{3} \\pi r^2 h$."),
    solution: frames,
    mistakes: m.list,
  };
}

function coneSurfaceTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm"]);
  const [r, h, s] = rng.pick(TRIPLES.filter((t) => t[0] <= 12));
  const givenS = rng.chance(0.55);
  const onlyM = rng.chance(0.35);
  const O = PI * r * r + PI * r * s;
  const M = PI * r * s;
  const right = rounded(onlyM ? M : O, 1, `${unit}²`, onlyM ? "M =" : "O =");
  const m = mistakeList(right, 1);
  if (!givenS) m.add(onlyM ? PI * r * h : PI * r * r + PI * r * h, tx("Height instead of slant height", "Höhe statt Mantellinie"), tx("The curved surface needs the slant height $s$ (along the side), not the height $h$. Find $s$ with Pythagoras first.", "Der Mantel braucht die Mantellinie $s$ (an der Seite entlang), nicht die Höhe $h$. Berechne $s$ zuerst mit Pythagoras."));
  if (!onlyM) m.add(M, tx("Base missing", "Grundfläche fehlt"), tx("That's only the curved surface. The surface area includes the circle at the bottom: $O = \\pi r^2 + \\pi r s$.", "Das ist nur der Mantel. Zur Oberfläche gehört noch der Kreis unten: $O = \\pi r^2 + \\pi r s$."));
  else m.add(O, tx("Base included", "Grundfläche dazugerechnet"), tx("The curved surface is only the side, without the circle at the bottom: $M = \\pi r s$.", "Der Mantel ist nur die Seitenfläche, ohne den Kreis unten: $M = \\pi r s$."));
  m.add(onlyM ? 2 * PI * r * s : PI * r * r + 2 * PI * r * s, tx("Like a cylinder's surface", "Wie ein Zylindermantel"), tx("$2 \\pi r \\cdot s$ would be a whole rectangle, like the curved surface of a cylinder. The unrolled cone is only a sector: $M = \\pi r s$.", "$2 \\pi r \\cdot s$ wäre ein ganzes Rechteck wie beim Zylindermantel. Der abgewickelte Kegelmantel ist nur ein Kreisausschnitt: $M = \\pi r s$."));
  const text = givenS
    ? tx(`A cone has the radius $r = ${r} ${q(unit)}$ and the slant height $s = ${s} ${q(unit)}$.`, `Ein Kegel hat den Radius $r = ${r} ${q(unit)}$ und die Mantellinie $s = ${s} ${q(unit)}$.`)
    : tx(`A cone has the radius $r = ${r} ${q(unit)}$ and the height $h = ${h} ${q(unit)}$.`, `Ein Kegel hat den Radius $r = ${r} ${q(unit)}$ und die Höhe $h = ${h} ${q(unit)}$.`);
  const frames: Frame[] = [];
  if (!givenS) frames.push({ math: `s#s =#e \\sqrt{${h}^2 + ${r}^2}#rt =#e2 \\sqrt{${s * s}}#rt2 =#e3 ${s}#sv ${q(unit)}#u`, note: tx("The curved surface needs the slant height $s$: Pythagoras first.", "Der Mantel braucht die Mantellinie $s$: zuerst Pythagoras.") });
  frames.push(
    onlyM
      ? { math: "M#M =#e \\pi#pi \\cdot#m r#r \\cdot#m2 s#s", note: tx("Curved surface of the cone: $M = \\pi r s$.", "Mantel des Kegels: $M = \\pi r s$.") }
      : { math: "O#O =#e \\pi#G r#r^{2#sq} +#p \\pi#pi \\cdot#m r#r2 \\cdot#m2 s#s", note: tx("Surface area: base circle plus curved surface.", "Oberfläche: Grundkreis plus Mantel.") },
    onlyM
      ? { math: `M#M =#e \\pi#pi \\cdot#m ${r}#r \\cdot#m2 ${s}#s =#e2 ${r * s}#v \\pi#pi2`, note: tx("Put in.", "Einsetzen.") }
      : { math: `O#O =#e ${r * r}#G \\pi#g2 +#p ${r * s}#r2 \\pi#pi =#e2 ${r * r + r * s}#v \\pi#pi2`, note: tx("Both parts are multiples of π: add them.", "Beide Teile sind Vielfache von π: zusammenzählen.") },
    { math: say((f) => `${onlyM ? "M#M" : "O#O"} \\approx#e ${f.d(onlyM ? M : O, 1)}#v ${q(`${unit}²`)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
  );
  return {
    instruction: onlyM ? CONE_M : CONE_O,
    text: join(text, ROUND1),
    visual: figure({ kind: "cone", r, h, lr: `r = ${r} ${unit}`, ...(givenS ? { ls: `s = ${s} ${unit}`, hideH: true } : { lh: `h = ${h} ${unit}`, ls: "s" }) }),
    answer: right,
    hint: onlyM ? tx("$M = \\pi r s$ with the slant height $s$.", "$M = \\pi r s$ mit der Mantellinie $s$.") : tx("$O = \\pi r^2 + \\pi r s$ with the slant height $s$.", "$O = \\pi r^2 + \\pi r s$ mit der Mantellinie $s$."),
    solution: frames,
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Pyramid surface

const PYR_O = tx("Find the surface area of the pyramid", "Berechne die Oberfläche der Pyramide");

function pyrSurfaceFrames(a: number, hs: number, unit: string): Frame[] {
  return [
    { math: "O#O =#e G#G +#p M#M", note: tx("Surface area: the square base plus four triangles.", "Oberfläche: die quadratische Grundfläche plus vier Dreiecke.") },
    { math: "O#O =#e a#a^{2#sq} +#p 4#k \\cdot#m \\frac{a#a2 \\cdot#m2 h_s#hs}{2#two}#fr", note: tx("Each side face is a triangle with base $a$ and height $h_s$.", "Jede Seitenfläche ist ein Dreieck mit der Grundseite $a$ und der Höhe $h_s$.") },
    { math: `O#O =#e ${a}#a^{2#sq} +#p 4#k \\cdot#m \\frac{${a}#a2 \\cdot#m2 ${hs}#hs}{2#two}#fr`, note: tx("Put in.", "Einsetzen.") },
    { math: `O#O =#e ${a * a}#a +#p ${2 * a * hs}#k`, note: tx(`$4 \\cdot \\frac{${a} \\cdot ${hs}}{2} = 2 \\cdot ${a} \\cdot ${hs} = ${2 * a * hs}$.`, `$4 \\cdot \\frac{${a} \\cdot ${hs}}{2} = 2 \\cdot ${a} \\cdot ${hs} = ${2 * a * hs}$.`) },
    { math: `O#O =#e ${a * a + 2 * a * hs}#a ${q(`${unit}²`)}#u`, note: tx("Done!", "Fertig!") },
  ];
}

function pyramidSurfaceTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm"]);
  const [x, h, hs] = rng.pick(TRIPLES.filter((t) => t[0] <= 12 && t[1] <= 24));
  const a = 2 * x;
  const givenHs = rng.chance(0.5);
  const O = a * a + 2 * a * hs;
  const m = mistakeList(exact(O, `${unit}²`, "O ="));
  if (!givenHs) m.add(a * a + 2 * a * h, tx("Height of the solid used", "Körperhöhe genommen"), tx("The triangles need **their** height $h_s$ (on the side face), not the height $h$ of the pyramid. Pythagoras first!", "Die Dreiecke brauchen **ihre** Höhe $h_s$ (auf der Seitenfläche), nicht die Körperhöhe $h$. Erst Pythagoras!"));
  m.add(2 * a * hs, tx("Base missing", "Grundfläche fehlt"), tx("That's only the four triangles (the lateral surface). Add the square base $a^2$.", "Das sind nur die vier Dreiecke (der Mantel). Dazu kommt noch die Grundfläche $a^2$."));
  m.add(a * a + 4 * a * hs, tx("Triangles not halved", "Dreiecke nicht halbiert"), tx("Each side face is a **triangle**: $\\frac{a \\cdot h_s}{2}$.", "Jede Seitenfläche ist ein **Dreieck**: $\\frac{a \\cdot h_s}{2}$."));
  m.add(a * a + (a * hs) / 2, tx("Only one triangle", "Nur ein Dreieck"), tx("A square pyramid has **four** side faces.", "Eine quadratische Pyramide hat **vier** Seitenflächen."));
  return {
    instruction: PYR_O,
    text: givenHs
      ? tx(`A square pyramid has the base edge $a = ${a} ${q(unit)}$ and side faces with the height $h_s = ${hs} ${q(unit)}$.`, `Eine quadratische Pyramide hat die Grundkante $a = ${a} ${q(unit)}$ und Seitenflächen mit der Höhe $h_s = ${hs} ${q(unit)}$.`)
      : tx(`A square pyramid has the base edge $a = ${a} ${q(unit)}$ and the height $h = ${h} ${q(unit)}$.`, `Eine quadratische Pyramide hat die Grundkante $a = ${a} ${q(unit)}$ und die Höhe $h = ${h} ${q(unit)}$.`),
    visual: figure(givenHs ? { kind: "pyr", a, h, la: `a = ${a} ${unit}`, lhs: `h_s = ${hs} ${unit}`, hideH: true } : { kind: "pyr", a, h, la: `a = ${a} ${unit}`, lh: `h = ${h} ${unit}`, lhs: "h_s", tri: true }),
    answer: exact(O, `${unit}²`, "O ="),
    hint: givenHs ? tx("Base square plus four triangles.", "Grundquadrat plus vier Dreiecke.") : tx("You need $h_s$ for the triangles: $h_s^2 = h^2 + (\\frac{a}{2})^2$.", "Für die Dreiecke brauchst du $h_s$: $h_s^2 = h^2 + (\\frac{a}{2})^2$."),
    solution: [
      ...(givenHs ? [] : [{ math: `h_s#hs =#e \\sqrt{${h}^2 + ${x}^2}#rt =#e2 \\sqrt{${hs * hs}}#rt2 =#e3 ${hs}#hv ${q(unit)}#u`, note: tx("First the height of a side face, with Pythagoras.", "Zuerst die Höhe einer Seitenfläche, mit Pythagoras.") }]),
      ...pyrSurfaceFrames(a, hs, unit),
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Sphere

const SPH_V = tx("Find the volume of the sphere", "Berechne das Volumen der Kugel");
const SPH_O = tx("Find the surface area of the sphere", "Berechne die Oberfläche der Kugel");
const RADIUS = tx("Find the radius", "Berechne den Radius");

function sphereTask(rng: Rng): Exercise {
  const kind = rng.pick(["V", "V", "O", "O", "rV", "rO"] as const);
  const unit = rng.pick(["cm", "m", "cm", "mm"]);
  if (kind === "rV" || kind === "rO") {
    const r = kind === "rV" ? rng.pick([3, 6, 9, 12, 15]) : rng.int(2, 12);
    const k = kind === "rV" ? (4 * r ** 3) / 3 : 4 * r * r;
    const m = mistakeList(exact(r, unit, "r ="));
    if (kind === "rV") {
      m.add(r ** 3, tx("Cube root missing", "Kubikwurzel vergessen"), tx(`That's $r^3$. Take the **cube root**: which number cubed gives ${r ** 3}?`, `Das ist $r^3$. Zieh noch die **dritte Wurzel**: Welche Zahl hoch 3 ergibt ${r ** 3}?`), true);
      m.add(Math.sqrt(r ** 3), tx("Square root instead of cube root", "Quadratwurzel statt dritter Wurzel"), tx("$r$ is **cubed** in the volume, so take the cube root $\\sqrt[3]{\\,}$.", "Im Volumen steht $r$ **hoch 3**, also brauchst du die dritte Wurzel $\\sqrt[3]{\\,}$."), false, 2);
      m.add(Math.cbrt(k), tx("Forgot the 4/3", "4/3 vergessen"), tx("First divide by $\\frac{4}{3}$ (times $\\frac{3}{4}$), then take the cube root.", "Teil erst durch $\\frac{4}{3}$ (also mal $\\frac{3}{4}$), dann die dritte Wurzel."), false, 2);
    } else {
      m.add(r * r, tx("Square root missing", "Wurzel vergessen"), tx(`That's $r^2$. Take the square root.`, `Das ist $r^2$. Zieh noch die Wurzel.`), true);
      m.add(Math.sqrt(k), tx("Forgot the 4", "Die 4 vergessen"), tx("Divide by $4 \\pi$ first: $r^2 = \\frac{O}{4 \\pi}$.", "Teil zuerst durch $4 \\pi$: $r^2 = \\frac{O}{4 \\pi}$."), false, 2);
      m.add(k / 4, tx("Square root missing", "Wurzel vergessen"), tx("That's $r^2$. Take the square root.", "Das ist $r^2$. Zieh noch die Wurzel."), true);
    }
    return {
      instruction: RADIUS,
      math: kind === "rV" ? `V = ${k} \\pi ${q(`${unit}³`)}` : `O = ${k} \\pi ${q(`${unit}²`)}`,
      text: kind === "rV" ? tx("A sphere has this volume. How big is its radius?", "Eine Kugel hat dieses Volumen. Wie groß ist ihr Radius?") : tx("A sphere has this surface area. How big is its radius?", "Eine Kugel hat diese Oberfläche. Wie groß ist ihr Radius?"),
      answer: exact(r, unit, "r ="),
      hint: kind === "rV" ? tx("$\\frac{4}{3} \\pi r^3 = V$: divide by π, multiply by $\\frac{3}{4}$, then cube root.", "$\\frac{4}{3} \\pi r^3 = V$: durch π teilen, mal $\\frac{3}{4}$, dann dritte Wurzel.") : tx("$4 \\pi r^2 = O$: divide by $4\\pi$, then square root.", "$4 \\pi r^2 = O$: durch $4 \\pi$ teilen, dann Wurzel ziehen."),
      solution:
        kind === "rV"
          ? [
              { math: `\\frac{4}{3}#f \\pi#pi r#r^{3#c} =#e ${k}#k \\pi#pi2`, note: tx("Set the formula equal to the volume.", "Setz die Formel gleich dem Volumen.") },
              { math: `\\frac{4}{3}#f r#r^{3#c} =#e ${k}#k`, note: tx("Divide both sides by π.", "Beide Seiten durch π teilen.") },
              { math: `r#r^{3#c} =#e ${k}#k \\cdot#m \\frac{3}{4}#f2 =#e2 ${r ** 3}#v`, note: tx("Times $\\frac{3}{4}$.", "Mal $\\frac{3}{4}$.") },
              { math: `r#r =#e \\sqrt[3]{${r ** 3}}#rt =#e2 ${r}#v2 ${q(unit)}#u`, note: tx(`Cube root: $${r}^3 = ${r ** 3}$. Done!`, `Dritte Wurzel: $${r}^3 = ${r ** 3}$. Fertig!`) },
            ]
          : [
              { math: `4#f \\pi#pi r#r^{2#c} =#e ${k}#k \\pi#pi2`, note: tx("Set the formula equal to the surface area.", "Setz die Formel gleich der Oberfläche.") },
              { math: `r#r^{2#c} =#e ${k}#k :#m 4#f2 =#e2 ${r * r}#v`, note: tx("Divide by $4 \\pi$.", "Durch $4 \\pi$ teilen.") },
              { math: `r#r =#e \\sqrt{${r * r}}#rt =#e2 ${r}#v2 ${q(unit)}#u`, note: tx("Square root. Done!", "Wurzel ziehen. Fertig!") },
            ],
      mistakes: m.list,
    };
  }
  const r = rng.pick([2, 3, 4, 5, 6, 7, 8, 10, 1.5, 2.5, 12]);
  const useD = rng.chance(0.35);
  const vol = kind === "V";
  const value = vol ? (4 / 3) * PI * r ** 3 : 4 * PI * r * r;
  const right = rounded(value, 1, vol ? `${unit}³` : `${unit}²`, vol ? "V =" : "O =");
  const m = mistakeList(right, 1);
  if (useD) m.add(vol ? (4 / 3) * PI * 8 * r ** 3 : 16 * PI * r * r, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("The formula needs the **radius**: half the diameter.", "Die Formel braucht den **Radius**: den halben Durchmesser."));
  if (vol) {
    m.add(PI * r ** 3, tx("Forgot the 4/3", "4/3 vergessen"), tx("The sphere formula has the factor $\\frac{4}{3}$: $V = \\frac{4}{3} \\pi r^3$.", "In der Kugelformel steckt der Faktor $\\frac{4}{3}$: $V = \\frac{4}{3} \\pi r^3$."));
    m.add((4 / 3) * PI * r * r, tx("Squared instead of cubed", "Hoch 2 statt hoch 3"), tx("A volume has three lengths: $r^3$, not $r^2$.", "Ein Volumen hat drei Längen: $r^3$, nicht $r^2$."));
    m.add(4 * PI * r * r, tx("Surface instead of volume", "Oberfläche statt Volumen"), tx("$4 \\pi r^2$ is the surface area. The volume is $\\frac{4}{3} \\pi r^3$.", "$4 \\pi r^2$ ist die Oberfläche. Das Volumen ist $\\frac{4}{3} \\pi r^3$."));
    m.add((3 / 4) * PI * r ** 3, tx("3/4 instead of 4/3", "3/4 statt 4/3"), tx("The fraction is upside down: it's $\\frac{4}{3}$.", "Der Bruch steht auf dem Kopf: Es ist $\\frac{4}{3}$."));
  } else {
    m.add(PI * r * r, tx("Only one circle", "Nur ein Kreis"), tx("The surface of a sphere is **four** circles with the same radius: $4 \\pi r^2$.", "Die Kugeloberfläche ist so groß wie **vier** Kreise mit dem gleichen Radius: $4 \\pi r^2$."));
    m.add(4 * PI * r ** 3, tx("Cubed instead of squared", "Hoch 3 statt hoch 2"), tx("An area has two lengths: $r^2$, not $r^3$.", "Eine Fläche hat zwei Längen: $r^2$, nicht $r^3$."));
    m.add((4 / 3) * PI * r ** 3, tx("Volume instead of surface", "Volumen statt Oberfläche"), tx("$\\frac{4}{3} \\pi r^3$ is the volume. The surface is $4 \\pi r^2$.", "$\\frac{4}{3} \\pi r^3$ ist das Volumen. Die Oberfläche ist $4 \\pi r^2$."));
  }
  const story = vol && rng.chance(0.3);
  const ball = rng.pick([
    { d: 22, text: tx("A football has a diameter of about 22 cm. How much air is inside?", "Ein Fußball hat einen Durchmesser von etwa 22 cm. Wie viel Luft ist darin?") },
    { d: 24, text: tx("A basketball has a diameter of about 24 cm. Find its volume.", "Ein Basketball hat einen Durchmesser von etwa 24 cm. Berechne sein Volumen.") },
    { d: 4, text: tx("A table tennis ball has a diameter of 4 cm. Find its volume.", "Ein Tischtennisball hat einen Durchmesser von 4 cm. Berechne sein Volumen.") },
  ]);
  if (story) {
    const R = ball.d / 2;
    const V = (4 / 3) * PI * R ** 3;
    const right2 = rounded(V, 1, "cm³", "V =");
    const m2 = mistakeList(right2, 1);
    m2.add((4 / 3) * PI * ball.d ** 3, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("The formula needs the **radius**: half the diameter.", "Die Formel braucht den **Radius**: den halben Durchmesser."));
    m2.add(PI * R ** 3, tx("Forgot the 4/3", "4/3 vergessen"), tx("$V = \\frac{4}{3} \\pi r^3$: don't forget $\\frac{4}{3}$.", "$V = \\frac{4}{3} \\pi r^3$: Vergiss das $\\frac{4}{3}$ nicht."));
    m2.add(4 * PI * R * R, tx("Surface instead of volume", "Oberfläche statt Volumen"), tx("$4 \\pi r^2$ is the surface area. The volume is $\\frac{4}{3} \\pi r^3$.", "$4 \\pi r^2$ ist die Oberfläche. Das Volumen ist $\\frac{4}{3} \\pi r^3$."));
    return {
      instruction: SPH_V,
      text: join(ball.text, ROUND1),
      answer: right2,
      hint: tx("Halve the diameter, then $V = \\frac{4}{3} \\pi r^3$.", "Halbiere den Durchmesser, dann $V = \\frac{4}{3} \\pi r^3$."),
      solution: sphereFrames(R, true, "cm", true),
      mistakes: m2.list,
    };
  }
  return {
    instruction: vol ? SPH_V : SPH_O,
    text: ROUND1,
    visual: figure({ kind: "sphere", r, lr: say((f) => (useD ? `d = ${f.n(2 * r)} ${unit}` : `r = ${f.n(r)} ${unit}`)), diameter: useD }),
    answer: right,
    hint: vol ? tx("$V = \\frac{4}{3} \\pi r^3$.", "$V = \\frac{4}{3} \\pi r^3$.") : tx("$O = 4 \\pi r^2$.", "$O = 4 \\pi r^2$."),
    solution: sphereFrames(r, vol, unit, useD),
    mistakes: m.list,
  };
}

function sphereFrames(r: number, vol: boolean, unit: string, useD: boolean): Frame[] {
  const out: Frame[] = [
    vol
      ? { math: "V#V =#e \\frac{4}{3}#f \\pi#pi r#r^{3#e}", note: tx("Volume of a sphere: $V = \\frac{4}{3} \\pi r^3$.", "Volumen der Kugel: $V = \\frac{4}{3} \\pi r^3$.") }
      : { math: "O#V =#e 4#f \\pi#pi r#r^{2#e}", note: tx("Surface of a sphere: four circles, $O = 4 \\pi r^2$.", "Oberfläche der Kugel: vier Kreise, $O = 4 \\pi r^2$.") },
  ];
  if (useD) out.push({ math: say((f) => `r#r =#e ${f.n(2 * r)}#d :#m 2#two =#e2 ${f.n(r)}#rv ${q(unit)}#u`), note: tx("Halve the diameter first.", "Erst den Durchmesser halbieren.") });
  const value = vol ? (4 / 3) * PI * r ** 3 : 4 * PI * r * r;
  out.push(
    { math: say((f) => (vol ? `V#V =#e \\frac{4}{3}#f \\pi#pi \\cdot#m ${f.n(r)}#r^{3#e}` : `O#V =#e 4#f \\pi#pi \\cdot#m ${f.n(r)}#r^{2#e}`)), note: tx("Put in the radius.", "Setz den Radius ein.") },
    { math: say((f) => `${vol ? "V#V" : "O#V"} =#e ${exactNum(f, vol ? (4 / 3) * r ** 3 : 4 * r * r)}#r \\pi#pi`), note: say((f) => f.t(vol ? `$${f.n(r)}^3 = ${f.n(r ** 3)}$, times $\\frac{4}{3}$.` : `$${f.n(r)}^2 = ${f.n(r * r)}$, times 4.`, vol ? `$${f.n(r)}^3 = ${f.n(r ** 3)}$, mal $\\frac{4}{3}$.` : `$${f.n(r)}^2 = ${f.n(r * r)}$, mal 4.`)) },
    { math: say((f) => `${vol ? "V#V" : "O#V"} \\approx#e ${f.d(value, 1)}#r ${q(vol ? `${unit}³` : `${unit}²`)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
  );
  return out;
}

// ---------------------------------------------------------------------------
// Composite solids

const SOLID_V = tx("Find the volume of the solid", "Berechne das Volumen des Körpers");

function compositeSolidTask(rng: Rng): Exercise {
  const kind = rng.pick(["cylcone", "cylhemi", "conehemi", "cubepyr"] as const);
  const unit = kind === "conehemi" ? "cm" : "m";
  const u3 = `${unit}³`;
  const L = (v: number) => say((f) => `${f.n(v)} ${unit}`);
  if (kind === "cubepyr") {
    const a = rng.int(2, 8);
    const h1 = rng.int(3, 10);
    const h2 = rng.int(1, 4) * 3;
    const V = a * a * h1 + (a * a * h2) / 3;
    const m = mistakeList(exact(V, u3, "V ="));
    m.add(a * a * (h1 + h2), tx("Roof without the third", "Dach ohne Drittel"), tx("The roof is a **pyramid**: only a third of $G \\cdot h$.", "Das Dach ist eine **Pyramide**: nur ein Drittel von $G \\cdot h$."));
    m.add(a * a * h1, tx("Roof missing", "Dach fehlt"), tx("Don't forget the pyramid on top!", "Vergiss die Pyramide oben nicht!"));
    m.add((a * a * (h1 + h2)) / 3, tx("A third of everything", "Ein Drittel von allem"), tx("Only the pyramid gets the $\\frac{1}{3}$, the cuboid is a whole prism.", "Nur die Pyramide bekommt das $\\frac{1}{3}$, der Quader ist ein ganzes Prisma."));
    return {
      instruction: SOLID_V,
      text: tx("A tower: a cuboid with a square base and a pyramid roof.", "Ein Turm: ein Quader mit quadratischer Grundfläche und einem Pyramidendach."),
      visual: figure({ kind: "cubepyr", a, h1, h2, la: L(a), lh1: L(h1), lh2: L(h2) }),
      answer: exact(V, u3, "V ="),
      hint: tx("Cuboid plus pyramid with the same base.", "Quader plus Pyramide mit gleicher Grundfläche."),
      solution: [
        { math: tx('V#V =#e V_{"cuboid"}#a +#p V_{"pyramid"}#b', 'V#V =#e V_{"Quader"}#a +#p V_{"Pyramide"}#b'), note: tx("Split the tower into two solids.", "Zerleg den Turm in zwei Körper.") },
        { math: `V#V =#e ${a}#a1^{2#s1} \\cdot#m1 ${h1}#h1 +#p \\frac{1}{3}#f \\cdot#m2 ${a}#a2^{2#s2} \\cdot#m3 ${h2}#h2`, note: tx("Both have the base $a^2$.", "Beide haben die Grundfläche $a^2$.") },
        { math: `V#V =#e ${a * a * h1}#a1 +#p ${(a * a * h2) / 3}#f`, note: tx("Work out both parts.", "Rechne beide Teile aus.") },
        { math: `V#V =#e ${V}#a1 ${q(u3)}#u`, note: tx("Done!", "Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  const r = rng.pick([2, 3, 4, 5, 6]);
  let V: number;
  let fig: FigureSpec;
  let text: Text;
  let frames: Frame[];
  const wrong: [number, Text, Text][] = [];
  if (kind === "cylcone") {
    const h1 = rng.pick([4, 5, 6, 8, 10]);
    const h2 = rng.pick([3, 4, 6]);
    V = PI * r * r * h1 + (PI * r * r * h2) / 3;
    fig = { kind: "cylcone", r, h1, h2, lr: L(r), lh1: L(h1), lh2: L(h2) };
    text = tx("A silo: a cylinder with a cone on top.", "Ein Silo: ein Zylinder mit einem Kegel oben drauf.");
    frames = [
      { math: tx('V#V =#e V_{"cyl"}#a +#p V_{"cone"}#b', 'V#V =#e V_{"Zylinder"}#a +#p V_{"Kegel"}#b'), note: tx("Cylinder plus cone with the same radius.", "Zylinder plus Kegel mit gleichem Radius.") },
      { math: `V#V =#e \\pi#p1 \\cdot#m1 ${r}#r1^{2#s1} \\cdot#m2 ${h1}#h1 +#p \\frac{1}{3}#f \\pi#p2 \\cdot#m3 ${r}#r2^{2#s2} \\cdot#m4 ${h2}#h2`, note: tx("Only the cone gets the $\\frac{1}{3}$.", "Nur der Kegel bekommt das $\\frac{1}{3}$.") },
      { math: say((f) => `V#V =#e ${r * r * h1}#r1 \\pi#p1 +#p ${exactNum(f, (r * r * h2) / 3)}#r2 \\pi#p2 =#e2 ${exactNum(f, r * r * h1 + (r * r * h2) / 3)}#v \\pi#p3`), note: tx("Both parts are multiples of π.", "Beide Teile sind Vielfache von π.") },
      { math: say((f) => `V#V \\approx#e ${f.d(V, 1)}#v ${q(u3)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
    ];
    wrong.push([PI * r * r * (h1 + h2), tx("Cone without the third", "Kegel ohne Drittel"), tx("The roof is a **cone**: a third of the cylinder with the same base.", "Das Dach ist ein **Kegel**: ein Drittel des Zylinders mit gleicher Grundfläche.")]);
    wrong.push([PI * r * r * h1, tx("Cone missing", "Kegel fehlt"), tx("Don't forget the cone on top!", "Vergiss den Kegel oben nicht!")]);
    wrong.push([(PI * r * r * (h1 + h2)) / 3, tx("A third of everything", "Ein Drittel von allem"), tx("Only the cone gets the $\\frac{1}{3}$.", "Nur der Kegel bekommt das $\\frac{1}{3}$.")]);
  } else if (kind === "cylhemi") {
    const h1 = rng.pick([4, 5, 6, 8, 10, 12]);
    V = PI * r * r * h1 + (2 / 3) * PI * r ** 3;
    fig = { kind: "cylhemi", r, h1, lr: L(r), lh1: L(h1) };
    text = tx("A tank: a cylinder with a hemisphere on top.", "Ein Tank: ein Zylinder mit einer Halbkugel oben drauf.");
    frames = [
      { math: tx('V#V =#e V_{"cyl"}#a +#p \\frac{1}{2}#hf V_{"sphere"}#b', 'V#V =#e V_{"Zylinder"}#a +#p \\frac{1}{2}#hf V_{"Kugel"}#b'), note: tx("Cylinder plus half a sphere with the same radius.", "Zylinder plus eine halbe Kugel mit gleichem Radius.") },
      { math: `V#V =#e \\pi#p1 \\cdot#m1 ${r}#r1^{2#s1} \\cdot#m2 ${h1}#h1 +#p \\frac{1}{2}#hf \\cdot#m5 \\frac{4}{3}#f \\pi#p2 \\cdot#m3 ${r}#r2^{3#s2}`, note: tx("Half of $\\frac{4}{3}$ is $\\frac{2}{3}$.", "Die Hälfte von $\\frac{4}{3}$ ist $\\frac{2}{3}$.") },
      { math: say((f) => `V#V =#e ${r * r * h1}#r1 \\pi#p1 +#p ${exactNum(f, (2 / 3) * r ** 3)}#r2 \\pi#p2`), note: tx("Both parts as multiples of π.", "Beide Teile als Vielfache von π.") },
      { math: say((f) => `V#V \\approx#e ${f.d(V, 1)}#v ${q(u3)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
    ];
    wrong.push([PI * r * r * h1 + (4 / 3) * PI * r ** 3, tx("A whole sphere", "Eine ganze Kugel"), tx("Only **half** a sphere sits on top: $\\frac{1}{2} \\cdot \\frac{4}{3} \\pi r^3$.", "Oben sitzt nur eine **halbe** Kugel: $\\frac{1}{2} \\cdot \\frac{4}{3} \\pi r^3$.")]);
    wrong.push([PI * r * r * h1, tx("Dome missing", "Kuppel fehlt"), tx("Don't forget the hemisphere on top!", "Vergiss die Halbkugel oben nicht!")]);
  } else {
    const h = rng.pick([8, 9, 10, 12, 15]);
    V = (PI * r * r * h) / 3 + (2 / 3) * PI * r ** 3;
    fig = { kind: "conehemi", r, h, lr: L(r), lh: L(h) };
    text = tx("An ice cream: a cone, filled to the top, with a hemisphere of ice cream on it.", "Ein Eis: eine Waffel (Kegel), bis oben gefüllt, mit einer Halbkugel Eis darauf.");
    frames = [
      { math: tx('V#V =#e V_{"cone"}#a +#p \\frac{1}{2}#hf V_{"sphere"}#b', 'V#V =#e V_{"Kegel"}#a +#p \\frac{1}{2}#hf V_{"Kugel"}#b'), note: tx("Cone plus hemisphere with the same radius.", "Kegel plus Halbkugel mit gleichem Radius.") },
      { math: `V#V =#e \\frac{1}{3}#f1 \\pi#p1 \\cdot#m1 ${r}#r1^{2#s1} \\cdot#m2 ${h}#h1 +#p \\frac{2}{3}#f2 \\pi#p2 \\cdot#m3 ${r}#r2^{3#s2}`, note: tx("A third for the cone, half of $\\frac{4}{3}$ for the hemisphere.", "Ein Drittel beim Kegel, die Hälfte von $\\frac{4}{3}$ bei der Halbkugel.") },
      { math: say((f) => `V#V =#e ${exactNum(f, (r * r * h) / 3)}#r1 \\pi#p1 +#p ${exactNum(f, (2 / 3) * r ** 3)}#r2 \\pi#p2`), note: tx("Both parts as multiples of π.", "Beide Teile als Vielfache von π.") },
      { math: say((f) => `V#V \\approx#e ${f.d(V, 1)}#v ${q(u3)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
    ];
    wrong.push([(PI * r * r * h) / 3 + (4 / 3) * PI * r ** 3, tx("A whole sphere", "Eine ganze Kugel"), tx("Only **half** a sphere of ice cream sits on top.", "Oben sitzt nur eine **halbe** Kugel Eis.")]);
    wrong.push([PI * r * r * h + (2 / 3) * PI * r ** 3, tx("Cone without the third", "Kegel ohne Drittel"), tx("A cone holds only a third of the cylinder: $\\frac{1}{3} \\pi r^2 h$.", "Ein Kegel fasst nur ein Drittel des Zylinders: $\\frac{1}{3} \\pi r^2 h$.")]);
    wrong.push([(PI * r * r * h) / 3, tx("Ice cream missing", "Eis vergessen"), tx("That's only the cone. Add the hemisphere on top!", "Das ist nur die Waffel. Die Halbkugel oben gehört dazu!")]);
  }
  const right = rounded(V, 1, u3, "V =");
  const m = mistakeList(right, 1);
  for (const [v, t, s] of wrong) m.add(v, t, s);
  return { instruction: SOLID_V, text: join(text, ROUND1), visual: figure(fig), answer: right, hint: tx("Split the solid into parts you know and add their volumes.", "Zerleg den Körper in bekannte Teile und addiere ihre Volumen."), solution: frames, mistakes: m.list };
}

// ---------------------------------------------------------------------------
// Scaling

const pow3 = (p: number) => (p === 2 ? "²" : "³");
const HOW_MANY = tx("How many times as big?", "Wie viel mal so groß?");
const ORIGINAL = tx("Find the value for the original", "Berechne den Wert für das Original");

function scalingTask(rng: Rng): Exercise {
  const kind = rng.pick(["forward", "forward", "model", "reverse"] as const);
  if (kind === "forward") {
    const k = rng.pick([2, 3, 4, 5, 10]);
    const what = rng.pick(["area", "volume", "paint", "mass"] as const);
    const solid = rng.pick([tx("a cube", "eines Würfels"), tx("a sphere", "einer Kugel"), tx("a cone", "eines Kegels"), tx("a pyramid", "einer Pyramide"), tx("a cylinder", "eines Zylinders")]);
    const sup = pow3(what === "area" || what === "paint" ? 2 : 3);
    const pow = what === "area" || what === "paint" ? 2 : 3;
    const right = exact(k ** pow);
    const m = mistakeList(right);
    m.add(k, tx("Only the lengths grow like that", "So wachsen nur die Längen"), tx(`$${k}$ is the factor for **lengths**. ${pow === 2 ? "An area grows in two directions" : "A volume grows in three directions"}: $k^${pow}$.`, `$${k}$ ist der Faktor für **Längen**. ${pow === 2 ? "Eine Fläche wächst in zwei Richtungen" : "Ein Volumen wächst in drei Richtungen"}: $k^${pow}$.`));
    if (pow === 3) m.add(k * k, tx("That's for areas", "Das gilt für Flächen"), tx(`$k^2 = ${k * k}$ is the factor for **areas**. Volumes grow with $k^3$.`, `$k^2 = ${k * k}$ ist der Faktor für **Flächen**. Volumen wachsen mit $k^3$.`));
    if (pow === 2) m.add(k ** 3, tx("That's for volumes", "Das gilt für Volumen"), tx(`$k^3$ is the factor for **volumes**. A surface grows with $k^2$.`, `$k^3$ ist der Faktor für **Volumen**. Eine Oberfläche wächst mit $k^2$.`));
    m.add(pow * k, tx(`${pow} · k instead of k${sup}`, `${pow} · k statt k${sup}`), tx(`$k^${pow}$ means $${Array(pow).fill("k").join(" \\cdot ")}$, not $${pow} \\cdot k$.`, `$k^${pow}$ heißt $${Array(pow).fill("k").join(" \\cdot ")}$, nicht $${pow} \\cdot k$.`));
    const qs: Record<typeof what, Text> = {
      area: tx(`All lengths of ${E(solid)} are multiplied by ${k}. How many times as big is its surface area?`, `Alle Längen ${D(solid)} werden mit ${k} multipliziert. Wie viel mal so groß wird die Oberfläche?`),
      paint: tx(`A model is built ${k} times as big in every direction. How many times as much paint does its surface need?`, `Ein Modell wird in jeder Richtung ${k}-mal so groß gebaut. Wie viel mal so viel Farbe braucht seine Oberfläche?`),
      volume: tx(`All lengths of ${E(solid)} are multiplied by ${k}. How many times as big is its volume?`, `Alle Längen ${D(solid)} werden mit ${k} multipliziert. Wie viel mal so groß wird das Volumen?`),
      mass: tx(`A statue is ${k} times as tall as its model, made of the same material. How many times as heavy is it?`, `Eine Statue ist ${k}-mal so hoch wie ihr Modell aus demselben Material. Wie viel mal so schwer ist sie?`),
    };
    return {
      instruction: HOW_MANY,
      text: qs[what],
      answer: right,
      hint: pow === 2 ? tx("Areas grow with $k^2$.", "Flächen wachsen mit $k^2$.") : tx(what === "mass" ? "Same material: the mass grows like the volume, with $k^3$." : "Volumes grow with $k^3$.", what === "mass" ? "Gleiches Material: Die Masse wächst wie das Volumen, mit $k^3$." : "Volumen wachsen mit $k^3$."),
      solution: [
        { math: `k#k =#e ${k}#kv`, note: tx("Every length is multiplied by $k$.", "Jede Länge wird mit $k$ multipliziert.") },
        {
          math: `k#k^{${pow}#p} =#e ${k}#kv^{${pow}#p2} =#e2 ${k ** pow}#r`,
          note: pow === 2 ? tx("An area has two lengths that both grow: $k \\cdot k = k^2$.", "Eine Fläche hat zwei Längen, die beide wachsen: $k \\cdot k = k^2$.") : tx(`A volume has three lengths that all grow: $k^3$.${what === "mass" ? " With the same material, the mass grows the same way." : ""}`, `Ein Volumen hat drei Längen, die alle wachsen: $k^3$.${what === "mass" ? " Bei gleichem Material wächst die Masse genauso." : ""}`),
        },
      ],
      mistakes: m.list,
    };
  }
  if (kind === "model") {
    const k = rng.pick([2, 5, 10, 20]);
    const area = rng.chance(0.5);
    const base = area ? rng.pick([3, 4, 5, 6, 8, 12, 15]) : rng.pick([2, 3, 4, 5, 6]);
    const value = area ? base * k * k : base * k ** 3;
    const unit = area ? "cm²" : "cm³";
    const right = exact(value, unit, area ? "O =" : "V =");
    const m = mistakeList(right);
    m.add(base * k, tx("Lengths factor used", "Längenfaktor genommen"), tx(`The scale $1 : ${k}$ is for **lengths**. ${area ? "Areas grow with $k^2$" : "Volumes grow with $k^3$"}.`, `Der Maßstab $1 : ${k}$ gilt für **Längen**. ${area ? "Flächen wachsen mit $k^2$" : "Volumen wachsen mit $k^3$"}.`));
    if (!area) m.add(base * k * k, tx("That's for areas", "Das gilt für Flächen"), tx("$k^2$ is for areas. A volume grows with $k^3$.", "$k^2$ gilt für Flächen. Ein Volumen wächst mit $k^3$."));
    else m.add(base * k ** 3, tx("That's for volumes", "Das gilt für Volumen"), tx("$k^3$ is for volumes. A surface grows with $k^2$.", "$k^3$ gilt für Volumen. Eine Oberfläche wächst mit $k^2$."));
    return {
      instruction: ORIGINAL,
      text: area
        ? tx(`A model of a car is built at the scale $1 : ${k}$. Its surface is $${base} "cm²"$. How big is the surface of the real car in cm²?`, `Ein Automodell ist im Maßstab $1 : ${k}$ gebaut. Seine Oberfläche ist $${base} "cm²"$ groß. Wie groß ist die Oberfläche des echten Autos in cm²?`)
        : tx(`A model of a statue at the scale $1 : ${k}$ has a volume of $${base} "cm³"$. How big is the volume of the statue in cm³?`, `Ein Modell einer Statue im Maßstab $1 : ${k}$ hat ein Volumen von $${base} "cm³"$. Wie groß ist das Volumen der Statue in cm³?`),
      answer: right,
      hint: area ? tx("Areas grow with $k^2$.", "Flächen wachsen mit $k^2$.") : tx("Volumes grow with $k^3$.", "Volumen wachsen mit $k^3$."),
      solution: [
        { math: `k#k =#e ${k}#kv`, note: tx(`Scale $1 : ${k}$: every length of the original is ${k} times as long.`, `Maßstab $1 : ${k}$: Jede Länge des Originals ist ${k}-mal so lang.`) },
        { math: say((f) => `${area ? "O_2" : "V_2"}#O =#e ${k}#kv^{${area ? 2 : 3}#p} \\cdot#m ${base}#b =#e2 ${f.n(k ** (area ? 2 : 3))}#f \\cdot#m2 ${base}#b2`), note: area ? tx("Surface: times $k^2$.", "Oberfläche: mal $k^2$.") : tx("Volume: times $k^3$.", "Volumen: mal $k^3$.") },
        { math: say((f) => `${area ? "O_2" : "V_2"}#O =#e ${f.n(value)}#r ${q(unit)}#u`), note: tx("Done!", "Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  const k = rng.pick([2, 3, 4, 5, 10]);
  const fromVol = rng.chance(0.6);
  const F = fromVol ? k ** 3 : k * k;
  const m = mistakeList(exact(k));
  m.add(F, tx("That's the factor you were given", "Das ist der gegebene Faktor"), tx(`The ${fromVol ? "volume" : "area"} grows by ${F}, but the lengths grow less: take the ${fromVol ? "cube" : "square"} root.`, `${fromVol ? "Das Volumen" : "Die Fläche"} wächst um ${F}, aber die Längen wachsen weniger: Zieh die ${fromVol ? "dritte Wurzel" : "Wurzel"}.`));
  if (fromVol) m.add(Math.sqrt(F), tx("Square root instead of cube root", "Quadratwurzel statt dritter Wurzel"), tx("Volumes grow with $k^3$, so take the **cube** root.", "Volumen wachsen mit $k^3$, also brauchst du die **dritte** Wurzel."), false, 2);
  m.add(F / (fromVol ? 3 : 2), tx(`Divided by ${fromVol ? 3 : 2}`, `Durch ${fromVol ? 3 : 2} geteilt`), tx(`$k^${fromVol ? 3 : 2}$ is not $${fromVol ? 3 : 2} \\cdot k$. Undo the power with a root.`, `$k^${fromVol ? 3 : 2}$ ist nicht $${fromVol ? 3 : 2} \\cdot k$. Eine Potenz machst du mit einer Wurzel rückgängig.`));
  return {
    instruction: HOW_MANY,
    text: fromVol
      ? tx(`A cube holds ${F} times as much as a smaller cube. How many times as long are its edges?`, `Ein Würfel fasst ${F}-mal so viel wie ein kleinerer Würfel. Wie viel mal so lang sind seine Kanten?`)
      : tx(`A sphere has ${F} times the surface area of a smaller sphere. How many times as big is its radius?`, `Eine Kugel hat die ${F}-fache Oberfläche einer kleineren Kugel. Wie viel mal so groß ist ihr Radius?`),
    answer: exact(k),
    hint: fromVol ? tx("$k^3 = " + F + "$: which number cubed gives " + F + "?", "$k^3 = " + F + "$: Welche Zahl hoch 3 ergibt " + F + "?") : tx("$k^2 = " + F + "$: which number squared gives " + F + "?", "$k^2 = " + F + "$: Welche Zahl hoch 2 ergibt " + F + "?"),
    solution: [
      { math: `k#k^{${fromVol ? 3 : 2}#p} =#e ${F}#F`, note: fromVol ? tx("Volumes grow with $k^3$.", "Volumen wachsen mit $k^3$.") : tx("Areas grow with $k^2$.", "Flächen wachsen mit $k^2$.") },
      { math: `k#k =#e ${fromVol ? `\\sqrt[3]{${F}}` : `\\sqrt{${F}}`}#F =#e2 ${k}#r`, note: tx(`Check: $${k}^${fromVol ? 3 : 2} = ${F}$.`, `Probe: $${k}^${fromVol ? 3 : 2} = ${F}$.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Matching formulas

type Fm = { id: string; name: Text; f: Text };
const FORMULAS: Fm[] = [
  { id: "pyr", name: tx("Pyramid: volume", "Pyramide: Volumen"), f: "$V = \\frac{1}{3} G h$" },
  { id: "coneV", name: tx("Cone: volume", "Kegel: Volumen"), f: "$V = \\frac{1}{3} \\pi r^2 h$" },
  { id: "coneM", name: tx("Cone: curved surface", "Kegel: Mantel"), f: "$M = \\pi r s$" },
  { id: "sphV", name: tx("Sphere: volume", "Kugel: Volumen"), f: "$V = \\frac{4}{3} \\pi r^3$" },
  { id: "sphO", name: tx("Sphere: surface area", "Kugel: Oberfläche"), f: "$O = 4 \\pi r^2$" },
  { id: "cylV", name: tx("Cylinder: volume", "Zylinder: Volumen"), f: "$V = \\pi r^2 h$" },
];
/** A wrong formula, and Blob's note for each solid a student may wrongly match it with. */
type Distractor = { f: Text; wrongFor: { id: string; title: Text; say: Text }[] };
const DISTRACTORS: Distractor[] = [
  {
    f: "$V = \\frac{4}{3} \\pi r^2$",
    wrongFor: [
      { id: "sphV", title: tx("Check the power", "Prüf die Potenz"), say: tx("A volume needs three lengths: $r^3$.", "Ein Volumen braucht drei Längen: $r^3$.") },
      { id: "sphO", title: tx("The 4/3 belongs to the volume", "Das 4/3 gehört zum Volumen"), say: tx("The surface of a sphere is four circles: $O = 4 \\pi r^2$. The $\\frac{4}{3}$ belongs to the volume.", "Die Kugeloberfläche ist so groß wie vier Kreise: $O = 4 \\pi r^2$. Das $\\frac{4}{3}$ gehört zum Volumen.") },
    ],
  },
  {
    f: "$M = 2 \\pi r s$",
    wrongFor: [
      { id: "coneM", title: tx("Like a cylinder's surface", "Wie ein Zylindermantel"), say: tx("$2 \\pi r \\cdot s$ would be a whole rectangle, like the curved surface of a cylinder. The unrolled cone is only a sector: $M = \\pi r s$.", "$2 \\pi r \\cdot s$ wäre ein ganzes Rechteck wie beim Zylindermantel. Der abgewickelte Kegelmantel ist nur ein Kreisausschnitt: $M = \\pi r s$.") },
    ],
  },
  {
    f: "$V = \\frac{1}{2} G h$",
    wrongFor: [
      { id: "pyr", title: tx("Half instead of a third", "Hälfte statt Drittel"), say: tx("A pyramid is **a third** of the prism, not half of it: $V = \\frac{1}{3} G h$.", "Eine Pyramide ist **ein Drittel** des Prismas, nicht die Hälfte: $V = \\frac{1}{3} G h$.") },
      { id: "coneV", title: tx("Half instead of a third", "Hälfte statt Drittel"), say: tx("A cone holds **a third** of the cylinder, not half of it: $V = \\frac{1}{3} \\pi r^2 h$.", "Ein Kegel fasst **ein Drittel** des Zylinders, nicht die Hälfte: $V = \\frac{1}{3} \\pi r^2 h$.") },
    ],
  },
];

function matchSolidsTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(FORMULAS).slice(0, 4);
  const has = (id: string) => chosen.find((c) => c.id === id);
  const extra = rng.pick(DISTRACTORS);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("coneV") && has("cylV")) wrong.push({ pairs: [[has("coneV")!.name, has("cylV")!.f]], title: tx("The third is missing", "Das Drittel fehlt"), say: tx("A cone holds only a third of the cylinder: $\\frac{1}{3} \\pi r^2 h$.", "Ein Kegel fasst nur ein Drittel des Zylinders: $\\frac{1}{3} \\pi r^2 h$.") });
  if (has("sphV") && has("sphO")) wrong.push({ pairs: [[has("sphV")!.name, has("sphO")!.f]], title: tx("Volume and surface swapped", "Volumen und Oberfläche vertauscht"), say: tx("A volume has $r^3$ (three lengths), a surface $r^2$.", "Ein Volumen hat $r^3$ (drei Längen), eine Oberfläche $r^2$.") });
  for (const w of extra.wrongFor) {
    const c = has(w.id);
    if (c) wrong.push({ pairs: [[c.name, extra.f]], title: w.title, say: w.say });
  }
  const m = matchTask(chosen.map((c) => [c.name, c.f] as [Text, Text]), [extra.f], wrong);
  return {
    instruction: tx("Match the formulas", "Ordne die Formeln zu"),
    text: tx("Which formula belongs to which solid? One formula is left over.", "Welche Formel gehört zu welchem Körper? Eine Formel bleibt übrig."),
    answer: m.answer,
    hint: tx("Pointed solids get $\\frac{1}{3}$. Volumes have three lengths, areas two.", "Spitze Körper bekommen $\\frac{1}{3}$. Volumen haben drei Längen, Flächen zwei."),
    solution: chosen.map((c, i) => ({
      math: E(c.f).slice(1, -1),
      note: i === chosen.length - 1 ? tx(`${E(c.name)}. The formula left over is wrong.`, `${D(c.name)}. Die übrige Formel ist falsch.`) : tx(`${E(c.name)}.`, `${D(c.name)}.`),
    })),
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [12, () => pyramidVolumeTask(rng)],
    [12, () => pythagorasTask(rng)],
    [10, () => coneVolumeTask(rng)],
    [9, () => pyramidSurfaceTask(rng)],
    [8, () => coneSurfaceTask(rng)],
    [13, () => sphereTask(rng)],
    [12, () => compositeSolidTask(rng)],
    [14, () => scalingTask(rng)],
    [6, () => matchSolidsTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const ICE_V = 48 * PI;

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Pyramid and cone: a third", "Pyramide und Kegel: ein Drittel"),
      blob: tx("Pointed solids are lightweights: exactly a third!", "Spitze Körper sind Leichtgewichte: genau ein Drittel!"),
      body: tx(
        "A pyramid holds exactly **a third** of a prism with the same base $G$ and the same height $h$. The height $h$ goes from the apex straight down to the base.",
        "Eine Pyramide fasst genau **ein Drittel** eines Prismas mit gleicher Grundfläche $G$ und gleicher Höhe $h$. Die Höhe $h$ geht von der Spitze senkrecht nach unten auf die Grundfläche.",
      ),
      visual: figure({ kind: "pyr", a: 6, h: 5, la: "a = 6 cm", lh: "h = 5 cm" }, tx("Square pyramid with a = 6 cm and h = 5 cm", "Quadratische Pyramide mit a = 6 cm und h = 5 cm")),
      frames: [
        ...pyrVFrames(6, 6, 5, "cm"),
        { math: "V#V =#e \\frac{1}{3}#f \\cdot#m \\pi#G r#r^{2#sq} \\cdot#m2 h#h", note: tx("A cone works the same way: its base is a circle, $G = \\pi r^2$.", "Beim Kegel genauso: Seine Grundfläche ist ein Kreis, $G = \\pi r^2$.") },
      ],
    },
    {
      type: "widget",
      title: tx("Why a third?", "Warum ein Drittel?"),
      blob: tx("Guess first: how many times?", "Rate erst: Wie oft?"),
      body: tx(
        "Fill the pyramid with water and pour it into the prism with the same base and the same height. How many fillings until the prism is full? Then try cone and cylinder.",
        "Füll die Pyramide mit Wasser und schütte sie in das Prisma mit gleicher Grundfläche und gleicher Höhe. Wie viele Füllungen, bis das Prisma voll ist? Dann probier Kegel und Zylinder.",
      ),
      widget: AreaVolumePourLab,
    },
    {
      type: "explain",
      title: tx("Heights with Pythagoras", "Höhen mit dem Satz des Pythagoras"),
      blob: tx("There's a right triangle hiding inside every pyramid!", "In jeder Pyramide versteckt sich ein rechtwinkliges Dreieck!"),
      body: tx(
        "Quick reminder: in a right triangle $a^2 + b^2 = c^2$, where $c$ is the **hypotenuse**, the longest side opposite the right angle. In the pyramid: the height $h$, half the base edge $\\frac{a}{2}$ and the height of a side face $h_s$.",
        "Kurz zur Erinnerung: Im rechtwinkligen Dreieck gilt $a^2 + b^2 = c^2$. Dabei ist $c$ die **Hypotenuse**, die längste Seite gegenüber dem rechten Winkel. In der Pyramide: die Höhe $h$, die halbe Grundkante $\\frac{a}{2}$ und die Höhe einer Seitenfläche $h_s$.",
      ),
      visual: figure({ kind: "pyr", a: 6, h: 4, la: "a = 6 cm", lh: "h = 4 cm", lhs: "h_s", tri: true }, tx("Pyramid with the right triangle inside", "Pyramide mit dem rechtwinkligen Dreieck darin")),
      frames: [
        { math: "a#a^{2#q1} +#p b#b^{2#q2} =#e c#c^{2#q3}", note: tx("Pythagoras: the two legs squared add up to the hypotenuse squared.", "Pythagoras: Die Quadrate der Katheten ergeben zusammen das Quadrat der Hypotenuse.") },
        { math: "h#a^{2#q1} +#p (\\frac{a}{2})#b^{2#q2} =#e h_s#c^{2#q3}", note: tx("In the pyramid the legs are $h$ and $\\frac{a}{2}$, the hypotenuse is $h_s$.", "In der Pyramide sind $h$ und $\\frac{a}{2}$ die Katheten, $h_s$ ist die Hypotenuse.") },
        { math: "4#a^{2#q1} +#p 3#b^{2#q2} =#e h_s#c^{2#q3}", note: tx("With $h = 4$ cm and $\\frac{a}{2} = 3$ cm.", "Mit $h = 4$ cm und $\\frac{a}{2} = 3$ cm.") },
        { math: "25#a =#e h_s#c^{2#q3}", note: tx("$16 + 9 = 25$.", "$16 + 9 = 25$.") },
        { math: 'h_s#c =#e 5#a "cm"#u', note: tx("Take the square root: $h_s = \\sqrt{25} = 5$ cm.", "Wurzel ziehen: $h_s = \\sqrt{25} = 5$ cm.") },
        { math: "s#c^{2#q3} =#e h#a^{2#q1} +#p r#b^{2#q2}", note: tx("The cone has the same triangle: height $h$, radius $r$ and the **slant height** $s$ as the hypotenuse.", "Beim Kegel steckt dasselbe Dreieck drin: Höhe $h$, Radius $r$ und die **Mantellinie** $s$ als Hypotenuse.") },
      ],
    },
    {
      type: "check",
      blob: tx("Find the right triangle first.", "Such zuerst das rechtwinklige Dreieck."),
      exercise: {
        instruction: MISSING_LEN,
        text: tx('A cone has the radius $r = 5 "cm"$ and the height $h = 12 "cm"$. Find the slant height $s$.', 'Ein Kegel hat den Radius $r = 5 "cm"$ und die Höhe $h = 12 "cm"$. Berechne die Mantellinie $s$.'),
        visual: figure({ kind: "cone", r: 5, h: 12, lr: "r = 5 cm", lh: "h = 12 cm", ls: "s = ?" }),
        answer: exact(13, "cm", "s ="),
        hint: tx("$s^2 = h^2 + r^2$.", "$s^2 = h^2 + r^2$."),
        solution: [
          { math: "s#s^{2#q1} =#e h#h^{2#q2} +#p r#r^{2#q3}", note: tx("Height and radius are the legs, the slant height is the hypotenuse.", "Höhe und Radius sind die Katheten, die Mantellinie ist die Hypotenuse.") },
          { math: "s#s^{2#q1} =#e 12#h^{2#q2} +#p 5#r^{2#q3}", note: tx("Put in.", "Einsetzen.") },
          { math: "s#s^{2#q1} =#e 144#h +#p 25#r =#e2 169#v", note: tx("Square and add.", "Quadrieren und addieren.") },
          { math: 's#s =#e \\sqrt{169}#rt =#e2 13#v "cm"#u', note: tx("Square root. Done!", "Wurzel ziehen. Fertig!") },
        ],
        mistakes: (() => {
          const m = mistakeList(exact(13, "cm", "s ="));
          m.add(17, tx("Added the sides", "Seiten addiert"), tx("You can't just add the sides. Pythagoras: $s^2 = h^2 + r^2$.", "Die Seiten darfst du nicht einfach addieren. Pythagoras: $s^2 = h^2 + r^2$."));
          m.add(169, tx("Square root missing", "Wurzel vergessen"), tx("That's $s^2$. Take the square root.", "Das ist $s^2$. Zieh noch die Wurzel."), true);
          m.add(Math.sqrt(119), tx("Subtracted", "Subtrahiert"), tx("$s$ is the hypotenuse, the longest side: add the squares.", "$s$ ist die Hypotenuse, die längste Seite: Die Quadrate werden addiert."), false, 2);
          m.add(Math.sqrt(244), tx("Diameter used", "Durchmesser genommen"), tx("The triangle inside uses the **radius**, not the diameter.", "Das Dreieck im Inneren hat den **Radius** als Kathete, nicht den Durchmesser."), false, 2);
          return m.list;
        })(),
      },
    },
    {
      type: "explain",
      title: tx("Surface area of pyramid and cone", "Oberfläche von Pyramide und Kegel"),
      blob: tx("Unfold it and you'll see what to add up.", "Klapp es auf, dann siehst du, was du addieren musst."),
      body: tx(
        "Surface area = base + lateral surface ($O = G + M$). A square pyramid has four triangles as side faces. A cone's curved surface unrolls into a **sector** with radius $s$: its arc is the circumference $2 \\pi r$ of the base.",
        "Oberfläche = Grundfläche + Mantel ($O = G + M$). Eine quadratische Pyramide hat vier Dreiecke als Seitenflächen. Der Mantel eines Kegels ist abgewickelt ein **Kreisausschnitt** mit dem Radius $s$: Sein Bogen ist der Umfang $2 \\pi r$ der Grundfläche.",
      ),
      visual: figure({ kind: "conenet", r: 5, s: 13, lr: "r", ls: "s", lb: "b = 2πr" }, tx("Net of a cone: sector and circle", "Netz eines Kegels: Kreisausschnitt und Kreis")),
      frames: [
        { math: "O#O =#e G#G +#p M#M", note: tx("Every pointed solid: base plus lateral surface.", "Jeder spitze Körper: Grundfläche plus Mantel.") },
        { math: "M#M =#e 4#k \\cdot#m \\frac{a \\cdot h_s}{2}#tri =#e2 2#k2 a#a h_s#hs", note: tx("Square pyramid: four triangles with base $a$ and height $h_s$.", "Quadratische Pyramide: vier Dreiecke mit der Grundseite $a$ und der Höhe $h_s$.") },
        { math: "M#M =#e \\pi#pi \\cdot#m r#r \\cdot#m2 s#s", note: tx("Cone: the sector is the share $\\frac{r}{s}$ of a whole circle with radius $s$: $\\frac{r}{s} \\cdot \\pi s^2 = \\pi r s$.", "Kegel: Der Ausschnitt ist der Anteil $\\frac{r}{s}$ eines ganzen Kreises mit Radius $s$: $\\frac{r}{s} \\cdot \\pi s^2 = \\pi r s$.") },
        { math: "O#O =#e \\pi#G r#r^{2#sq} +#p \\pi#pi r#r2 s#s", note: tx("Surface of the cone: base circle plus curved surface.", "Oberfläche des Kegels: Grundkreis plus Mantel.") },
        { math: "O#O =#e 25#G \\pi#g2 +#p 65#r2 \\pi#pi =#e2 90#v \\pi#pi2", note: tx("Example with $r = 5$ cm and $s = 13$ cm.", "Beispiel mit $r = 5$ cm und $s = 13$ cm.") },
        { math: tx('O#O \\approx#e 282.7#v "cm²"#u', 'O#O \\approx#e 282,7#v "cm²"#u'), note: tx("$90 \\pi \\approx 282.7$.", "$90 \\pi \\approx 282,7$.") },
      ],
    },
    {
      type: "check",
      blob: tx("Two steps: Pythagoras first, then the surface.", "Zwei Schritte: erst Pythagoras, dann die Oberfläche."),
      exercise: {
        instruction: PYR_O,
        text: tx('A square pyramid has the base edge $a = 10 "cm"$ and the height $h = 12 "cm"$.', 'Eine quadratische Pyramide hat die Grundkante $a = 10 "cm"$ und die Höhe $h = 12 "cm"$.'),
        visual: figure({ kind: "pyr", a: 10, h: 12, la: "a = 10 cm", lh: "h = 12 cm", lhs: "h_s", tri: true }),
        answer: exact(360, "cm²", "O ="),
        hint: tx("$h_s^2 = h^2 + (\\frac{a}{2})^2$, then $O = a^2 + 2 a h_s$.", "$h_s^2 = h^2 + (\\frac{a}{2})^2$, dann $O = a^2 + 2 a h_s$."),
        solution: [{ math: 'h_s#hs =#e \\sqrt{12^2 + 5^2}#rt =#e2 \\sqrt{169}#rt2 =#e3 13#hv "cm"#u', note: tx("First the height of a side face, with Pythagoras.", "Zuerst die Höhe einer Seitenfläche, mit Pythagoras.") }, ...pyrSurfaceFrames(10, 13, "cm")],
        mistakes: (() => {
          const m = mistakeList(exact(360, "cm²", "O ="));
          m.add(340, tx("Height of the solid used", "Körperhöhe genommen"), tx("The triangles need **their** height $h_s$, not the height $h$ of the pyramid. Pythagoras first!", "Die Dreiecke brauchen **ihre** Höhe $h_s$, nicht die Körperhöhe $h$. Erst Pythagoras!"));
          m.add(260, tx("Base missing", "Grundfläche fehlt"), tx("That's only the four triangles. Add the square base $a^2$.", "Das sind nur die vier Dreiecke. Dazu kommt noch die Grundfläche $a^2$."));
          m.add(620, tx("Triangles not halved", "Dreiecke nicht halbiert"), tx("Each side face is a **triangle**: $\\frac{a \\cdot h_s}{2}$.", "Jede Seitenfläche ist ein **Dreieck**: $\\frac{a \\cdot h_s}{2}$."));
          m.add(100 + 20 * Math.sqrt(244), tx("Forgot to halve a", "a nicht halbiert"), tx("In the inner triangle the leg at the bottom is **half** of $a$: 5 cm.", "Im inneren Dreieck ist die Kathete unten die **Hälfte** von $a$: 5 cm."), false, 1);
          return m.list;
        })(),
      },
    },
    {
      type: "explain",
      title: tx("The sphere", "Die Kugel"),
      blob: tx("Archimedes was so proud of this that he had it put on his gravestone!", "Archimedes war darauf so stolz, dass er es auf seinen Grabstein setzen ließ!"),
      body: tx(
        "A sphere has the volume $V = \\frac{4}{3} \\pi r^3$ and the surface area $O = 4 \\pi r^2$: exactly four circles with the same radius. Archimedes found: a sphere holds $\\frac{2}{3}$ of the cylinder that fits tightly around it.",
        "Eine Kugel hat das Volumen $V = \\frac{4}{3} \\pi r^3$ und die Oberfläche $O = 4 \\pi r^2$: genau vier Kreise mit dem gleichen Radius. Archimedes fand heraus: Eine Kugel fasst $\\frac{2}{3}$ des Zylinders, der genau um sie herum passt.",
      ),
      visual: figure({ kind: "sphere", r: 3, lr: "r = 3 cm" }, tx("Sphere with radius 3 cm", "Kugel mit dem Radius 3 cm")),
      frames: [
        ...sphereFrames(3, true, "cm", false),
        { math: "O#V =#e 4#f \\pi#pi \\cdot#m 3#r^{2#e} =#e2 36#v \\pi#pi2", note: tx("The surface area: $4 \\pi \\cdot 9 = 36 \\pi \\approx 113.1$ cm².", "Die Oberfläche: $4 \\pi \\cdot 9 = 36 \\pi \\approx 113,1$ cm².") },
        { math: tx('O#V \\approx#e 113.1#v "cm²"#u', 'O#V \\approx#e 113,1#v "cm²"#u'), note: tx("Funny: for $r = 3$ volume and surface have the same number, but different units!", "Witzig: Bei $r = 3$ haben Volumen und Oberfläche dieselbe Zahl, aber verschiedene Einheiten!") },
      ],
    },
    {
      type: "check",
      blob: tx("Split the ice cream into solids you know.", "Zerleg das Eis in Körper, die du kennst."),
      exercise: {
        instruction: SOLID_V,
        text: join(tx("An ice cream cone (a cone with $r = 3$ cm and $h = 10$ cm) is filled to the top, with a hemisphere of ice cream on it.", "Eine Eiswaffel (ein Kegel mit $r = 3$ cm und $h = 10$ cm) ist bis oben gefüllt, darauf sitzt eine Halbkugel Eis."), ROUND1),
        visual: figure({ kind: "conehemi", r: 3, h: 10, lr: "3 cm", lh: "10 cm" }),
        answer: rounded(ICE_V, 1, "cm³", "V ="),
        hint: tx("Cone: $\\frac{1}{3} \\pi r^2 h$. Hemisphere: half of $\\frac{4}{3} \\pi r^3$.", "Kegel: $\\frac{1}{3} \\pi r^2 h$. Halbkugel: die Hälfte von $\\frac{4}{3} \\pi r^3$."),
        solution: [
          { math: tx('V#V =#e V_{"cone"}#a +#p \\frac{1}{2}#hf V_{"sphere"}#b', 'V#V =#e V_{"Kegel"}#a +#p \\frac{1}{2}#hf V_{"Kugel"}#b'), note: tx("Cone plus hemisphere.", "Kegel plus Halbkugel.") },
          { math: "V#V =#e \\frac{1}{3}#f1 \\pi#p1 \\cdot#m1 3#r1^{2#s1} \\cdot#m2 10#h1 +#p \\frac{2}{3}#f2 \\pi#p2 \\cdot#m3 3#r2^{3#s2}", note: tx("Half of $\\frac{4}{3}$ is $\\frac{2}{3}$.", "Die Hälfte von $\\frac{4}{3}$ ist $\\frac{2}{3}$.") },
          { math: "V#V =#e 30#r1 \\pi#p1 +#p 18#r2 \\pi#p2 =#e2 48#v \\pi#p3", note: tx("$\\frac{1}{3} \\cdot 9 \\cdot 10 = 30$ and $\\frac{2}{3} \\cdot 27 = 18$.", "$\\frac{1}{3} \\cdot 9 \\cdot 10 = 30$ und $\\frac{2}{3} \\cdot 27 = 18$.") },
          { math: tx('V#V \\approx#e 150.8#v "cm³"#u', 'V#V \\approx#e 150,8#v "cm³"#u'), note: tx("About 150 ml of ice cream. Yummy!", "Etwa 150 ml Eis. Lecker!") },
        ],
        mistakes: (() => {
          const m = mistakeList(rounded(ICE_V, 1, "cm³", "V ="), 1);
          m.add(66 * PI, tx("A whole sphere", "Eine ganze Kugel"), tx("Only **half** a sphere of ice cream sits on top.", "Oben sitzt nur eine **halbe** Kugel Eis."));
          m.add(108 * PI, tx("Cone without the third", "Kegel ohne Drittel"), tx("A cone holds only a third of the cylinder: $\\frac{1}{3} \\pi r^2 h$.", "Ein Kegel fasst nur ein Drittel des Zylinders: $\\frac{1}{3} \\pi r^2 h$."));
          m.add(30 * PI, tx("Ice cream missing", "Eis vergessen"), tx("That's only the cone. Add the hemisphere on top!", "Das ist nur die Waffel. Die Halbkugel oben gehört dazu!"));
          return m.list;
        })(),
      },
    },
    {
      type: "widget",
      title: tx("Scaling: k, k², k³", "Vergrößern: k, k², k³"),
      blob: tx("Twice as tall doesn't mean twice as heavy!", "Doppelt so groß heißt nicht doppelt so schwer!"),
      body: tx(
        "Scale the cube by the factor $k$. Count: how many small squares make up one face, how many small cubes fit inside? The bars show how fast lengths, areas and volumes grow.",
        "Vergrößere den Würfel mit dem Faktor $k$. Zähl nach: Aus wie vielen kleinen Quadraten besteht eine Seitenfläche, wie viele kleine Würfel passen hinein? Die Balken zeigen, wie schnell Längen, Flächen und Volumen wachsen.",
      ),
      widget: AreaVolumeScaleLab,
    },
    {
      type: "explain",
      title: tx("Similar solids: lengths, areas, volumes", "Ähnliche Körper: Längen, Flächen, Volumen"),
      blob: tx("This is why elephants have thick legs and ants can carry so much.", "Darum haben Elefanten dicke Beine und Ameisen können so viel tragen."),
      body: tx(
        "If every length of a solid is multiplied by $k$ (a model and the original, for example), all areas grow by $k^2$ and the volume grows by $k^3$. With the same material, the mass grows like the volume. Index 1 marks the small solid, index 2 the big one.",
        "Wird jede Länge eines Körpers mit $k$ multipliziert (zum Beispiel Modell und Original), wachsen alle Flächen mit $k^2$ und das Volumen mit $k^3$. Bei gleichem Material wächst die Masse wie das Volumen. Index 1 steht für den kleinen Körper, Index 2 für den großen.",
      ),
      frames: [
        { math: "a_2#a =#e k#k \\cdot#m a_1#a2", note: tx("Every length times $k$.", "Jede Länge mal $k$.") },
        { math: "A_2#A =#e k#k^{2#p2} \\cdot#m A_1#a2", note: tx("Areas stretch in two directions: times $k^2$.", "Flächen werden in zwei Richtungen gestreckt: mal $k^2$.") },
        { math: "V_2#V =#e k#k^{3#p3} \\cdot#m V_1#a2", note: tx("Volumes stretch in three directions: times $k^3$.", "Volumen werden in drei Richtungen gestreckt: mal $k^3$.") },
        { math: "k#k =#e 10#kv \\Rightarrow#i k^2#A =#e2 100#A2 , \\; k^3#V =#e3 1000#V2", note: tx("A model car at the scale 1 : 10: the real car needs 100 times as much paint and has 1000 times the volume.", "Ein Modellauto im Maßstab 1 : 10: Das echte Auto braucht 100-mal so viel Lack und hat das 1000-fache Volumen.") },
        { math: "k^3#V =#e 8#F \\Rightarrow#i k#k =#e2 \\sqrt[3]{8}#rt =#e3 2#kv", note: tx("Backwards: 8 times the volume means only twice the lengths.", "Rückwärts: Das 8-fache Volumen heißt nur doppelte Längen.") },
      ],
    },
    {
      type: "check",
      blob: tx("Length, area or volume?", "Länge, Fläche oder Volumen?"),
      exercise: {
        instruction: HOW_MANY,
        text: tx("A ball is replaced by a ball with three times the radius. How many times as much air fits into it?", "Ein Ball wird durch einen Ball mit dem dreifachen Radius ersetzt. Wie viel mal so viel Luft passt hinein?"),
        answer: exact(27),
        hint: tx("Air fills the volume.", "Luft füllt das Volumen."),
        solution: [
          { math: "k#k =#e 3#kv", note: tx("Every length times 3.", "Jede Länge mal 3.") },
          { math: "k#k^{3#p} =#e 3#kv^{3#p2} =#e2 27#r", note: tx("The volume grows by $k^3 = 27$. You could also check it: $\\frac{4}{3} \\pi (3r)^3 = 27 \\cdot \\frac{4}{3} \\pi r^3$.", "Das Volumen wächst um $k^3 = 27$. Du kannst es auch nachrechnen: $\\frac{4}{3} \\pi (3r)^3 = 27 \\cdot \\frac{4}{3} \\pi r^3$.") },
        ],
        mistakes: (() => {
          const m = mistakeList(exact(27));
          m.add(3, tx("Only the lengths grow like that", "So wachsen nur die Längen"), tx("3 is the factor for the radius. The volume grows in three directions: $3^3$.", "3 ist der Faktor für den Radius. Das Volumen wächst in drei Richtungen: $3^3$."));
          m.add(9, tx("That's for areas", "Das gilt für Flächen"), tx("$3^2 = 9$ is the factor for the **surface**. Air fills the volume: $3^3$.", "$3^2 = 9$ ist der Faktor für die **Oberfläche**. Luft füllt das Volumen: $3^3$."));
          m.add(6, tx("3 · 2 isn't a power", "3 · 2 ist keine Potenz"), tx("Cubed means $3 \\cdot 3 \\cdot 3$.", "Hoch 3 heißt $3 \\cdot 3 \\cdot 3$."));
          return m.list;
        })(),
      },
    },
  ],
  summary: [
    {
      title: tx("Pyramid and cone", "Pyramide und Kegel"),
      body: tx("Pointed solids hold a third of the prism or cylinder with the same base and height.", "Spitze Körper fassen ein Drittel des Prismas oder Zylinders mit gleicher Grundfläche und Höhe."),
      examples: [tx('V_{"pyramid"} = \\frac{1}{3} \\cdot G \\cdot h', 'V_{"Pyramide"} = \\frac{1}{3} \\cdot G \\cdot h'), tx('V_{"cone"} = \\frac{1}{3} \\pi r^2 h', 'V_{"Kegel"} = \\frac{1}{3} \\pi r^2 h')],
      tone: "rule",
    },
    {
      title: tx("Surface areas", "Oberflächen"),
      body: tx("Base plus lateral surface. Use the slant height, not the height of the solid.", "Grundfläche plus Mantel. Nimm die Seitenhöhe, nicht die Körperhöhe."),
      examples: [tx('O_{"pyramid"} = a^2 + 2 a h_s', 'O_{"Pyramide"} = a^2 + 2 a h_s'), tx('M_{"cone"} = \\pi r s , \\; O_{"cone"} = \\pi r^2 + \\pi r s', 'M_{"Kegel"} = \\pi r s , \\; O_{"Kegel"} = \\pi r^2 + \\pi r s')],
      tone: "rule",
    },
    {
      title: tx("Pythagoras inside the solid", "Pythagoras im Körper"),
      body: tx("Find the right triangle: height, half the base edge (or radius) and the slanted line.", "Such das rechtwinklige Dreieck: Höhe, halbe Grundkante (oder Radius) und die schräge Linie."),
      examples: ["h_s^2 = h^2 + (\\frac{a}{2})^2", "s^2 = h^2 + r^2"],
      tone: "tip",
    },
    {
      title: tx("Sphere", "Kugel"),
      body: tx("Volume with $r^3$, surface with $r^2$.", "Volumen mit $r^3$, Oberfläche mit $r^2$."),
      examples: ["V = \\frac{4}{3} \\pi r^3", "O = 4 \\pi r^2"],
      tone: "rule",
    },
    {
      title: tx("Scaling with the factor k", "Strecken mit dem Faktor k"),
      body: tx("Lengths times $k$, areas times $k^2$, volumes (and masses) times $k^3$.", "Längen mal $k$, Flächen mal $k^2$, Volumen (und Massen) mal $k^3$."),
      examples: ["A_2 = k^2 \\cdot A_1", "V_2 = k^3 \\cdot V_1"],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Don't forget the $\\frac{1}{3}$. $h$ and $h_s$ (or $s$) are different lines. Halve the diameter. Twice as long means 8 times the volume.", "Vergiss das $\\frac{1}{3}$ nicht. $h$ und $h_s$ (oder $s$) sind verschiedene Linien. Halbiere den Durchmesser. Doppelt so lang heißt 8-faches Volumen."),
      examples: ["h \\ne h_s", "k = 2 \\Rightarrow V_2 = 8 \\cdot V_1"],
      tone: "warning",
    },
  ],
};
