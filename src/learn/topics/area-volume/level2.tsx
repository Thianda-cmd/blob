"use client";

// Level 2 (Klasse 7–8): triangle (any side as base), parallelogram, trapezium, composite shapes,
// the circle (u = 2πr = πd, A = πr², sectors), prisms (V = G · h, O = 2G + M) and the cylinder.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { figure, type FigureSpec } from "./figures";
import { exact, matchTask, mistakeList, rounded, say, weighted } from "./kit";

const gcdInt = (a: number, b: number): number => (b ? gcdInt(b, a % b) : a);
import { AreaVolumeBaseHeight, AreaVolumeCircleLab } from "./widgets2";

const PI = Math.PI;
const q = (unit: string) => `"${unit}"`;
const ROUND2 = tx("Round to 2 decimal places.", "Runde auf zwei Nachkommastellen.");
const ROUND1 = tx("Round to 1 decimal place.", "Runde auf eine Nachkommastelle.");
const E = (t: Text) => (typeof t === "string" ? t : t.en);
const D = (t: Text) => (typeof t === "string" ? t : t.de);
/** Joins texts with a space in both languages. */
const join = (...parts: (Text | undefined)[]): Text =>
  tx(parts.filter(Boolean).map((p) => E(p!)).join(" "), parts.filter(Boolean).map((p) => D(p!)).join(" "));

/** Pythagorean triples (leg, leg, hypotenuse) for slanted sides with whole lengths. */
const TRIPLES: [number, number, number][] = [
  [3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15], [8, 15, 17],
];

// ---------------------------------------------------------------------------
// Triangle, parallelogram, trapezium

const TRIANGLE = tx("Find the area of the triangle", "Berechne den Flächeninhalt des Dreiecks");
const PARALLELOGRAM = tx("Find the area of the parallelogram", "Berechne den Flächeninhalt des Parallelogramms");
const TRAPEZIUM = tx("Find the area of the trapezium", "Berechne den Flächeninhalt des Trapezes");
const HEIGHT = tx("Find the height", "Berechne die Höhe");

function triangleFrames(g: number, h: number, unit: string, legs = false): Frame[] {
  return [
    {
      math: "A#A =#e \\frac{g#g \\cdot#m h#h}{2#two}#fr",
      note: legs
        ? tx("In a right triangle the two legs are base and height at the same time.", "Im rechtwinkligen Dreieck sind die beiden Katheten zugleich Grundseite und Höhe.")
        : tx("Triangle: half of base times height. The height is at right angles to the base.", "Dreieck: die Hälfte von Grundseite mal Höhe. Die Höhe steht senkrecht auf der Grundseite."),
    },
    { math: say((f) => `A#A =#e \\frac{${f.n(g)}#g \\cdot#m ${f.n(h)}#h}{2#two}#fr`), note: say((f) => f.t(`Put in $g = ${f.n(g)} ${q(unit)}$ and $h = ${f.n(h)} ${q(unit)}$.`, `Setz $g = ${f.n(g)} ${q(unit)}$ und $h = ${f.n(h)} ${q(unit)}$ ein.`)) },
    { math: say((f) => `A#A =#e \\frac{${f.n(g * h)}#g}{2#two}#fr`), note: tx("Multiply first.", "Erst multiplizieren.") },
    { math: say((f) => `A#A =#e ${f.n((g * h) / 2)}#g ${q(`${unit}²`)}#u`), note: tx("Then halve. Done!", "Dann halbieren. Fertig!") },
  ];
}

function triangleTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm", "mm"]);
  if (rng.chance(0.3)) {
    // Right triangle: legs and the hypotenuse as a distractor.
    const [a, b, c] = rng.pick(TRIPLES.filter((t) => Number.isInteger(t[1])));
    const k = rng.pick([1, 1, 2]);
    const [A, B, C] = [a * k, b * k, c * k];
    const m = mistakeList(exact((A * B) / 2, `${unit}²`, "A ="));
    m.add(A * B, tx("Forgot to halve", "Halbieren vergessen"), tx("Nearly! $a \\cdot b$ is the whole rectangle. The triangle is only half of it.", "Fast! $a \\cdot b$ ist das ganze Rechteck. Das Dreieck ist nur die Hälfte davon."), true);
    m.add((C * A) / 2, tx("Hypotenuse is not the height", "Hypotenuse ist keine Höhe"), tx("The hypotenuse isn't at right angles to the other leg. Take the two legs: they are at right angles.", "Die Hypotenuse steht nicht senkrecht auf der anderen Kathete. Nimm die beiden Katheten: Die stehen senkrecht aufeinander."));
    m.add((C * B) / 2, tx("Hypotenuse is not the height", "Hypotenuse ist keine Höhe"), tx("The hypotenuse isn't at right angles to the other leg. Take the two legs: they are at right angles.", "Die Hypotenuse steht nicht senkrecht auf der anderen Kathete. Nimm die beiden Katheten: Die stehen senkrecht aufeinander."));
    m.add(A + B + C, tx("Perimeter instead of area", "Umfang statt Fläche"), tx("That's the perimeter. The area is half of base times height.", "Das ist der Umfang. Der Flächeninhalt ist die Hälfte von Grundseite mal Höhe."));
    return {
      instruction: TRIANGLE,
      visual: figure({ kind: "tri", pts: [[0, 0], [A, 0], [0, B]], right: 0, labels: [{ i: 0, text: `${A} ${unit}` }, { i: 1, text: `${C} ${unit}` }, { i: 2, text: `${B} ${unit}` }] }),
      answer: exact((A * B) / 2, `${unit}²`, "A ="),
      hint: tx("Which two sides are at right angles to each other?", "Welche zwei Seiten stehen senkrecht aufeinander?"),
      solution: triangleFrames(A, B, unit, true),
      mistakes: m.list,
    };
  }
  const [p, h, s] = rng.pick(TRIPLES.filter((t) => Number.isInteger(t[2]) && t[1] <= 12));
  const obtuse = p >= 4 && rng.chance(0.3);
  const g = obtuse ? rng.int(2, p - 1) : rng.int(p + 2, p + 9);
  const m = mistakeList(exact((g * h) / 2, `${unit}²`, "A ="));
  m.add(g * h, tx("Forgot to halve", "Halbieren vergessen"), tx("Nearly! $g \\cdot h$ is a whole parallelogram. A triangle is half of it.", "Fast! $g \\cdot h$ ist ein ganzes Parallelogramm. Ein Dreieck ist die Hälfte davon."), true);
  m.add((g * s) / 2, tx("Slanted side is not the height", "Schräge Seite ist keine Höhe"), tx(`The side $${s} ${q(unit)}$ is slanted. The height is the dashed line at right angles to the base.`, `Die Seite $${s} ${q(unit)}$ ist schräg. Die Höhe ist die gestrichelte Linie, senkrecht zur Grundseite.`));
  m.add(g * s, tx("Slanted side, no halving", "Schräge Seite, nicht halbiert"), tx(`Two slips: use the height (dashed), not the slanted side $${s} ${q(unit)}$, and halve the product.`, `Zwei Ausrutscher: Nimm die Höhe (gestrichelt), nicht die schräge Seite $${s} ${q(unit)}$, und halbiere das Produkt.`));
  return {
    instruction: TRIANGLE,
    text: obtuse ? tx("The height lies outside the triangle here.", "Die Höhe liegt hier außerhalb des Dreiecks.") : undefined,
    visual: figure({ kind: "tri", pts: [[0, 0], [g, 0], [p, h]], base: 0, lh: say((f) => `h = ${f.n(h)} ${unit}`), labels: [{ i: 0, text: `g = ${g} ${unit}` }, { i: 2, text: `${s} ${unit}` }] }),
    answer: exact((g * h) / 2, `${unit}²`, "A ="),
    hint: tx("Half of base times height. Which line is the height?", "Die Hälfte von Grundseite mal Höhe. Welche Linie ist die Höhe?"),
    solution: triangleFrames(g, h, unit),
    mistakes: m.list,
  };
}

function parallelogramTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm", "dm"]);
  const [p, h, s] = rng.pick(TRIPLES.filter((t) => Number.isInteger(t[2]) && t[0] <= 9));
  const g = rng.int(p + 2, p + 9);
  const m = mistakeList(exact(g * h, `${unit}²`, "A ="));
  m.add(g * s, tx("Slanted side is not the height", "Schräge Seite ist keine Höhe"), tx(`Careful: $${s} ${q(unit)}$ is the slanted side. If you cut and shift, the rectangle has the **height** $h$ as its width.`, `Vorsicht: $${s} ${q(unit)}$ ist die schräge Seite. Wenn du abschneidest und verschiebst, hat das Rechteck die **Höhe** $h$ als Breite.`));
  m.add((g * h) / 2, tx("Halved like a triangle", "Halbiert wie beim Dreieck"), tx("Halving belongs to the triangle. A parallelogram is a whole rectangle after cutting and shifting: $A = g \\cdot h$.", "Halbieren gehört zum Dreieck. Ein Parallelogramm wird durch Abschneiden und Verschieben zu einem ganzen Rechteck: $A = g \\cdot h$."));
  m.add(2 * (g + s), tx("Perimeter instead of area", "Umfang statt Fläche"), tx("That's the perimeter. The area is base times height.", "Das ist der Umfang. Der Flächeninhalt ist Grundseite mal Höhe."));
  return {
    instruction: PARALLELOGRAM,
    visual: figure({ kind: "para", g, h, off: p, lg: `g = ${g} ${unit}`, lh: say((f) => `h = ${f.n(h)} ${unit}`), ls: `${s} ${unit}` }),
    answer: exact(g * h, `${unit}²`, "A ="),
    hint: tx("Cut off a triangle and shift it: a rectangle. $A = g \\cdot h$.", "Schneide ein Dreieck ab und verschieb es: ein Rechteck. $A = g \\cdot h$."),
    solution: [
      { math: "A#A =#e g#g \\cdot#m h#h", note: tx("Parallelogram: base times height, like the rectangle you get after cutting and shifting.", "Parallelogramm: Grundseite mal Höhe, wie beim Rechteck nach dem Abschneiden und Verschieben.") },
      { math: `A#A =#e ${g}#g \\cdot#m ${h}#h`, note: tx(`The slanted side $${s} ${q(unit)}$ isn't needed.`, `Die schräge Seite $${s} ${q(unit)}$ brauchst du nicht.`) },
      { math: `A#A =#e ${g * h}#g ${q(`${unit}²`)}#u`, note: tx("Done!", "Fertig!") },
    ],
    mistakes: m.list,
  };
}

function trapFrames(a: number, c: number, h: number, unit: string): Frame[] {
  const mm = (a + c) / 2;
  return [
    { math: "A#A =#e \\frac{a#a +#p c#c}{2#two}#fr \\cdot#m h#h", note: tx("Trapezium: the average of the two parallel sides, times the height.", "Trapez: der Mittelwert der beiden parallelen Seiten, mal die Höhe.") },
    { math: say((f) => `A#A =#e \\frac{${f.n(a)}#a +#p ${f.n(c)}#c}{2#two}#fr \\cdot#m ${f.n(h)}#h`), note: tx("Put in the parallel sides and the height.", "Setz die parallelen Seiten und die Höhe ein.") },
    { math: say((f) => `A#A =#e ${f.n(mm)}#a \\cdot#m ${f.n(h)}#h`), note: say((f) => f.t(`$\\frac{${f.n(a + c)}}{2} = ${f.n(mm)}$: that's the midline $m$.`, `$\\frac{${f.n(a + c)}}{2} = ${f.n(mm)}$: Das ist die Mittellinie $m$.`)) },
    { math: say((f) => `A#A =#e ${f.n(mm * h)}#a ${q(`${unit}²`)}#u`), note: tx("Done!", "Fertig!") },
  ];
}

function trapMistakes(a: number, c: number, h: number, unit: string): Mistake[] {
  const m = mistakeList(exact(((a + c) / 2) * h, `${unit}²`, "A ="));
  m.add((a + c) * h, tx("Forgot to halve", "Halbieren vergessen"), tx("Nearly! $(a + c) \\cdot h$ is two trapeziums put together. Divide by 2.", "Fast! $(a + c) \\cdot h$ sind zwei Trapeze zusammen. Teil noch durch 2."), true);
  m.add(a * h, tx("Only one parallel side", "Nur eine parallele Seite"), tx("You used only side $a$. A trapezium needs **both** parallel sides: their average.", "Du hast nur die Seite $a$ genommen. Beim Trapez brauchst du **beide** parallelen Seiten: ihren Mittelwert."));
  m.add(a + (c * h) / 2, tx("Brackets missing", "Klammer vergessen"), tx("$a + c$ belongs in a bracket: first add, then divide by 2, then times $h$.", "$a + c$ gehört in eine Klammer: erst addieren, dann durch 2, dann mal $h$."));
  m.add(((a - c) / 2) * h, tx("Minus instead of plus", "Minus statt Plus"), tx("Add the parallel sides, don't subtract them: $\\frac{a + c}{2}$.", "Die parallelen Seiten werden addiert, nicht subtrahiert: $\\frac{a + c}{2}$."));
  return m.list;
}

function trapeziumTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm"]);
  const a = rng.int(7, 16);
  const c = rng.int(2, a - 3);
  const h = rng.int(2, 9);
  if (((a + c) * h) % 2 !== 0) return trapeziumTask(rng);
  const off = rng.int(0, a - c);
  return {
    instruction: TRAPEZIUM,
    visual: figure({ kind: "trap", a, c, h, off, la: `a = ${a} ${unit}`, lc: `c = ${c} ${unit}`, lh: `h = ${h} ${unit}` }),
    answer: exact(((a + c) / 2) * h, `${unit}²`, "A ="),
    hint: tx("$A = \\frac{a + c}{2} \\cdot h$: average of the parallel sides, times the height.", "$A = \\frac{a + c}{2} \\cdot h$: Mittelwert der parallelen Seiten mal Höhe."),
    solution: trapFrames(a, c, h, unit),
    mistakes: trapMistakes(a, c, h, unit),
  };
}

function heightTask(rng: Rng): Exercise {
  const kind = rng.pick(["tri", "tri", "para", "trap"] as const);
  const unit = rng.pick(["cm", "m"]);
  const u2 = q(`${unit}²`);
  if (kind === "tri") {
    const g = rng.int(3, 14);
    const h = rng.int(2, 12);
    const A = (g * h) / 2;
    const m = mistakeList(exact(h, unit, "h ="));
    m.add(A / g, tx("Forgot the 2", "Die 2 vergessen"), tx("The triangle formula has a $: 2$. Undo it too: $h = \\frac{2 \\cdot A}{g}$.", "In der Dreiecksformel steckt ein $: 2$. Das musst du auch rückgängig machen: $h = \\frac{2 \\cdot A}{g}$."));
    m.add(A * g * 2, tx("Multiplied instead of divided", "Multipliziert statt dividiert"), tx("To get $h$ alone, divide by $g$.", "Um $h$ allein zu bekommen, teilst du durch $g$."));
    m.add(A / (2 * g), tx("Divided by 2 again", "Noch mal durch 2 geteilt"), tx("Undo the $: 2$ with **times** 2, not another $: 2$.", "Das $: 2$ machst du mit **mal** 2 rückgängig, nicht mit noch einem $: 2$."));
    return {
      instruction: HEIGHT,
      text: say((f) => f.t(`A triangle has the area $A = ${f.n(A)} ${u2}$ and the base $g = ${g} ${q(unit)}$. How long is the height $h$?`, `Ein Dreieck hat den Flächeninhalt $A = ${f.n(A)} ${u2}$ und die Grundseite $g = ${g} ${q(unit)}$. Wie lang ist die Höhe $h$?`)),
      answer: exact(h, unit, "h ="),
      hint: tx("$A = \\frac{g \\cdot h}{2}$. Multiply by 2, then divide by $g$.", "$A = \\frac{g \\cdot h}{2}$. Mal 2, dann durch $g$ teilen."),
      solution: [
        { math: "A#A =#e \\frac{g#g \\cdot#m h#h}{2#two}#fr", note: tx("Start with the formula.", "Fang mit der Formel an.") },
        { math: say((f) => `${f.n(A)}#A =#e \\frac{${g}#g \\cdot#m h#h}{2#two}#fr`), note: tx("Put in what you know.", "Setz ein, was du kennst.") },
        { math: say((f) => `${f.n(2 * A)}#A =#e ${g}#g \\cdot#m h#h`), note: tx("Times 2 on both sides.", "Beide Seiten mal 2.") },
        { math: say((f) => `h#h =#e ${f.n(2 * A)}#A :#m ${g}#g =#e2 ${h}#r ${q(unit)}#u`), note: tx("Divide by $g$. Done!", "Durch $g$ teilen. Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  if (kind === "para") {
    const g = rng.int(3, 14);
    const h = rng.int(2, 12);
    const A = g * h;
    const m = mistakeList(exact(h, unit, "h ="));
    m.add((2 * A) / g, tx("Treated like a triangle", "Wie ein Dreieck behandelt"), tx("The parallelogram formula has no $: 2$: $A = g \\cdot h$, so $h = A : g$.", "In der Parallelogrammformel steckt kein $: 2$: $A = g \\cdot h$, also $h = A : g$."));
    m.add(A - g, tx("Subtracted instead of divided", "Subtrahiert statt dividiert"), tx("$A$ is $g$ **times** $h$. Undo it with a division.", "$A$ ist $g$ **mal** $h$. Das machst du mit Geteilt rückgängig."));
    return {
      instruction: HEIGHT,
      text: tx(`A parallelogram has the area $A = ${A} ${u2}$ and the base $g = ${g} ${q(unit)}$. How long is the height $h$?`, `Ein Parallelogramm hat den Flächeninhalt $A = ${A} ${u2}$ und die Grundseite $g = ${g} ${q(unit)}$. Wie lang ist die Höhe $h$?`),
      answer: exact(h, unit, "h ="),
      hint: tx("$A = g \\cdot h$, so divide by $g$.", "$A = g \\cdot h$, also durch $g$ teilen."),
      solution: [
        { math: "A#A =#e g#g \\cdot#m h#h", note: tx("Parallelogram: base times height.", "Parallelogramm: Grundseite mal Höhe.") },
        { math: `${A}#A =#e ${g}#g \\cdot#m h#h`, note: tx("Put in.", "Einsetzen.") },
        { math: `h#h =#e ${A}#A :#m ${g}#g =#e2 ${h}#r ${q(unit)}#u`, note: tx("Divide by $g$. Done!", "Durch $g$ teilen. Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  const a = rng.int(6, 14);
  const c = rng.int(2, a - 2);
  const h = rng.int(2, 10);
  const A = ((a + c) / 2) * h;
  const m = mistakeList(exact(h, unit, "h ="));
  m.add(A / (a + c), tx("Forgot the 2", "Die 2 vergessen"), tx("Don't forget the halving in $\\frac{a + c}{2}$: divide by the **average** of $a$ and $c$.", "Vergiss das Halbieren in $\\frac{a + c}{2}$ nicht: Teil durch den **Mittelwert** von $a$ und $c$."));
  m.add(A / a, tx("Only one side", "Nur eine Seite"), tx("Use the average of **both** parallel sides, not just $a$.", "Nimm den Mittelwert **beider** parallelen Seiten, nicht nur $a$."));
  return {
    instruction: HEIGHT,
    text: say((f) => f.t(`A trapezium has the parallel sides $a = ${a} ${q(unit)}$ and $c = ${c} ${q(unit)}$ and the area $A = ${f.n(A)} ${u2}$. How high is it?`, `Ein Trapez hat die parallelen Seiten $a = ${a} ${q(unit)}$ und $c = ${c} ${q(unit)}$ und den Flächeninhalt $A = ${f.n(A)} ${u2}$. Wie hoch ist es?`)),
    answer: exact(h, unit, "h ="),
    hint: tx("Work out the midline $m = \\frac{a + c}{2}$ first. Then $h = A : m$.", "Berechne zuerst die Mittellinie $m = \\frac{a + c}{2}$. Dann gilt $h = A : m$."),
    solution: [
      { math: "A#A =#e \\frac{a#a +#p c#c}{2#two}#fr \\cdot#m h#h", note: tx("The trapezium formula.", "Die Trapezformel.") },
      { math: say((f) => `${f.n(A)}#A =#e ${f.n((a + c) / 2)}#a \\cdot#m h#h`), note: say((f) => f.t(`Midline: $\\frac{${a} + ${c}}{2} = ${f.n((a + c) / 2)}$.`, `Mittellinie: $\\frac{${a} + ${c}}{2} = ${f.n((a + c) / 2)}$.`)) },
      { math: say((f) => `h#h =#e ${f.n(A)}#A :#m ${f.n((a + c) / 2)}#a =#e2 ${h}#r ${q(unit)}#u`), note: tx("Divide by the midline. Done!", "Durch die Mittellinie teilen. Fertig!") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Circle and sector

const CIRC_U = tx("Find the circumference", "Berechne den Umfang des Kreises");
const CIRC_A = tx("Find the area of the circle", "Berechne den Flächeninhalt des Kreises");
const RADII = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 1.5, 2.5, 4.5, 0.5];

function circleFig(r: number, useD: boolean, unit: string): FigureSpec {
  return useD ? { kind: "circle", r, show: "d", label: say((f) => `d = ${f.n(2 * r)} ${unit}`) } : { kind: "circle", r, show: "r", label: say((f) => `r = ${f.n(r)} ${unit}`) };
}

function radiusFrame(r: number, unit: string): Frame {
  return { math: say((f) => `r#r =#e d#d :#m 2#two =#e2 ${f.n(2 * r)}#dv :#m2 2#two2 =#e3 ${f.n(r)}#rv ${q(unit)}#u`), note: tx("The formula needs the radius: half the diameter.", "Die Formel braucht den Radius: den halben Durchmesser.") };
}

function circleAreaParts(r: number, useD: boolean, unit: string, digits: number) {
  const A = PI * r * r;
  const right = rounded(A, digits, `${unit}²`, "A =");
  const m = mistakeList(right, digits);
  if (useD) m.add(PI * 4 * r * r, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("Classic trap! $d$ is the diameter. The formula needs the **radius**, half of it.", "Die klassische Falle! $d$ ist der Durchmesser. Die Formel braucht den **Radius**, also die Hälfte."));
  m.add(2 * PI * r, tx("Circumference instead of area", "Umfang statt Fläche"), tx("$2 \\pi r$ is the circumference, the edge. The area is $\\pi r^2$.", "$2 \\pi r$ ist der Umfang, also der Rand. Der Flächeninhalt ist $\\pi r^2$."));
  m.add(PI * r, tx("Forgot the square", "Quadrat vergessen"), tx("$\\pi r$ is not enough: the radius is **squared**: $A = \\pi \\cdot r \\cdot r$.", "$\\pi r$ reicht nicht: Der Radius wird **quadriert**: $A = \\pi \\cdot r \\cdot r$."));
  m.add(PI * 2 * r, tx("2r instead of r²", "2r statt r²"), tx("$r^2$ means $r \\cdot r$, not $2 \\cdot r$.", "$r^2$ heißt $r \\cdot r$, nicht $2 \\cdot r$."));
  m.add((PI * r) ** 2, tx("π squared too", "π mit quadriert"), tx("Only the radius is squared, not π: $\\pi \\cdot r^2$.", "Nur der Radius wird quadriert, nicht π: $\\pi \\cdot r^2$."));
  const frames: Frame[] = [
    { math: "A#A =#e \\pi#pi \\cdot#m r#r^{2#sq}", note: tx("Area of a circle: $A = \\pi r^2$.", "Flächeninhalt eines Kreises: $A = \\pi r^2$.") },
    ...(useD ? [radiusFrame(r, unit)] : []),
    { math: say((f) => `A#A =#e \\pi#pi \\cdot#m ${f.n(r)}#r^{2#sq}`), note: tx("Put in the radius.", "Setz den Radius ein.") },
    { math: say((f) => `A#A =#e ${f.n(r * r)}#r \\pi#pi`), note: say((f) => f.t(`$${f.n(r)}^2 = ${f.n(r * r)}$. Square first, then times π.`, `$${f.n(r)}^2 = ${f.n(r * r)}$. Erst quadrieren, dann mal π.`)) },
    { math: say((f) => `A#A \\approx#e ${f.d(A, digits)}#r ${q(`${unit}²`)}#u`), note: tx("Use the π key and round at the very end.", "Nimm die π-Taste und runde erst ganz am Ende.") },
  ];
  return { right, mistakes: m.list, frames };
}

function circleAreaTask(rng: Rng): Exercise {
  const story = rng.chance(0.2);
  const r = story ? rng.pick([0.4, 0.45, 0.5, 0.6, 0.7, 0.75]) : rng.pick(RADII);
  const unit = story ? "m" : rng.pick(["cm", "m", "cm", "mm"]);
  const useD = story || rng.chance(0.45);
  const p = circleAreaParts(r, useD, unit, 2);
  return {
    instruction: CIRC_A,
    text: story
      ? join(say((f) => f.t(`A round table top has a diameter of $${f.n(2 * r)} ${q(unit)}$.`, `Eine runde Tischplatte hat einen Durchmesser von $${f.n(2 * r)} ${q(unit)}$.`)), ROUND2)
      : ROUND2,
    visual: story ? undefined : figure(circleFig(r, useD, unit)),
    answer: p.right,
    hint: useD ? tx("Halve the diameter first: $r = d : 2$. Then $A = \\pi r^2$.", "Halbiere zuerst den Durchmesser: $r = d : 2$. Dann $A = \\pi r^2$.") : tx("$A = \\pi \\cdot r^2$.", "$A = \\pi \\cdot r^2$."),
    solution: p.frames,
    mistakes: p.mistakes,
  };
}

function circleUTask(rng: Rng): Exercise {
  const story = rng.chance(0.3);
  const useD = story ? rng.chance(0.5) : rng.chance(0.45);
  const r = story ? (useD ? rng.pick([25, 30, 33, 35]) : rng.pick([1.5, 2, 2.5, 3, 4])) : rng.pick(RADII);
  const unit = story ? (useD ? "cm" : "m") : rng.pick(["cm", "m", "cm", "mm"]);
  const u = 2 * PI * r;
  const right = rounded(u, 2, unit, "u =");
  const m = mistakeList(right, 2);
  if (useD) m.add(2 * PI * 2 * r, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("With the diameter it's simply $u = \\pi \\cdot d$. With $2 \\pi$ you would need the radius.", "Mit dem Durchmesser gilt einfach $u = \\pi \\cdot d$. Mit $2 \\pi$ brauchst du den Radius."));
  else m.add(PI * r, tx("Radius used as diameter", "Radius statt Durchmesser"), tx("$\\pi \\cdot d$ needs the diameter. With the radius: $u = 2 \\pi r$.", "$\\pi \\cdot d$ braucht den Durchmesser. Mit dem Radius: $u = 2 \\pi r$."));
  m.add(PI * r * r, tx("Area instead of circumference", "Fläche statt Umfang"), tx("$\\pi r^2$ is the area. The circumference is the edge: $u = 2 \\pi r$.", "$\\pi r^2$ ist der Flächeninhalt. Der Umfang ist der Rand: $u = 2 \\pi r$."));
  m.add(3 * 2 * r, tx("π is not 3", "π ist nicht 3"), tx("Close, but π is a bit more than 3: use the π key (or $3.14$).", "Nah dran, aber π ist etwas mehr als 3: Nimm die π-Taste (oder $3,14$)."), true);
  const text = story
    ? useD
      ? say((f) => f.t(`A bicycle wheel has a diameter of $${f.n(2 * r)} ${q(unit)}$. How far does it roll in one full turn?`, `Ein Fahrradreifen hat einen Durchmesser von $${f.n(2 * r)} ${q(unit)}$. Wie weit rollt er bei einer ganzen Umdrehung?`))
      : say((f) => f.t(`A round flower bed has a radius of $${f.n(r)} ${q(unit)}$. How long is its edge?`, `Ein rundes Beet hat einen Radius von $${f.n(r)} ${q(unit)}$. Wie lang ist sein Rand?`))
    : undefined;
  return {
    instruction: CIRC_U,
    text: join(text, ROUND2),
    visual: story ? undefined : figure(circleFig(r, useD, unit)),
    answer: right,
    hint: useD ? tx("With the diameter: $u = \\pi \\cdot d$.", "Mit dem Durchmesser: $u = \\pi \\cdot d$.") : tx("With the radius: $u = 2 \\pi r$.", "Mit dem Radius: $u = 2 \\pi r$."),
    solution: useD
      ? [
          { math: "u#u =#e \\pi#pi \\cdot#m d#d", note: tx("With the diameter: $u = \\pi \\cdot d$.", "Mit dem Durchmesser: $u = \\pi \\cdot d$.") },
          { math: say((f) => `u#u =#e \\pi#pi \\cdot#m ${f.n(2 * r)}#d`), note: tx("Put in the diameter.", "Setz den Durchmesser ein.") },
          { math: say((f) => `u#u \\approx#e ${f.d(u, 2)}#d ${q(unit)}#un`), note: tx("π key, then round.", "π-Taste, dann runden.") },
        ]
      : [
          { math: "u#u =#e 2#two \\cdot#m2 \\pi#pi \\cdot#m r#d", note: tx("With the radius: $u = 2 \\pi r$ (the diameter is $2r$).", "Mit dem Radius: $u = 2 \\pi r$ (der Durchmesser ist $2r$).") },
          { math: say((f) => `u#u =#e 2#two \\cdot#m2 \\pi#pi \\cdot#m ${f.n(r)}#d`), note: tx("Put in the radius.", "Setz den Radius ein.") },
          { math: say((f) => `u#u =#e ${f.n(2 * r)}#d \\pi#pi`), note: tx("$2 \\cdot r$ first.", "Erst $2 \\cdot r$.") },
          { math: say((f) => `u#u \\approx#e ${f.d(u, 2)}#d ${q(unit)}#un`), note: tx("π key, then round.", "π-Taste, dann runden.") },
        ],
    mistakes: m.list,
  };
}

const ANGLES = [90, 180, 60, 120, 45, 30, 270, 150, 72, 240];
const PARTS: Record<number, [string, string]> = { 2: ["half", "die Hälfte"], 3: ["a third", "ein Drittel"], 4: ["a quarter", "ein Viertel"], 5: ["a fifth", "ein Fünftel"], 6: ["a sixth", "ein Sechstel"], 8: ["an eighth", "ein Achtel"], 12: ["a twelfth", "ein Zwölftel"] };
const SECTOR_A = tx("Find the area of the sector", "Berechne den Flächeninhalt des Kreisausschnitts");
const ARC = tx("Find the arc length", "Berechne die Bogenlänge");

function sectorTask(rng: Rng): Exercise {
  const al = rng.pick(ANGLES);
  const r = rng.pick([3, 4, 5, 6, 8, 10, 12]);
  const unit = rng.pick(["cm", "m"]);
  const area = rng.chance(0.6);
  const frac = al / 360;
  const value = area ? frac * PI * r * r : frac * 2 * PI * r;
  const right = rounded(value, 2, area ? `${unit}²` : unit, area ? "A =" : "b =");
  const m = mistakeList(right, 2);
  m.add(area ? PI * r * r : 2 * PI * r, tx("The whole circle", "Der ganze Kreis"), tx(`That's the whole circle. The sector is only the part $\\frac{${al}°}{360°}$ of it.`, `Das ist der ganze Kreis. Der Ausschnitt ist nur der Anteil $\\frac{${al}°}{360°}$ davon.`));
  m.add(area ? frac * 2 * PI * r : frac * PI * r * r, area ? tx("Arc instead of area", "Bogen statt Fläche") : tx("Area instead of arc", "Fläche statt Bogen"), area ? tx("You used the circumference $2 \\pi r$. For the area of the sector take $\\pi r^2$.", "Du hast den Umfang $2 \\pi r$ genommen. Für die Fläche des Ausschnitts nimmst du $\\pi r^2$.") : tx("You used the area $\\pi r^2$. The arc is part of the circumference $2 \\pi r$.", "Du hast die Fläche $\\pi r^2$ genommen. Der Bogen ist ein Teil vom Umfang $2 \\pi r$."));
  m.add((al / 100) * (area ? PI * r * r : 2 * PI * r), tx("A full turn is 360°", "Ein Vollkreis hat 360°"), tx(`The share is $\\frac{${al}°}{360°}$, because a full circle has 360°, not 100.`, `Der Anteil ist $\\frac{${al}°}{360°}$, denn ein Vollkreis hat 360°, nicht 100.`));
  if (area) m.add(frac * PI * r, tx("Forgot the square", "Quadrat vergessen"), tx("The circle area is $\\pi r^2$: square the radius.", "Die Kreisfläche ist $\\pi r^2$: Quadrier den Radius."));
  const whole = area ? "\\pi#pi \\cdot#m r#r^{2#sq}" : "2#two \\cdot#m0 \\pi#pi \\cdot#m r#r";
  const sym = area ? "A#A" : "b#A";
  return {
    instruction: area ? SECTOR_A : ARC,
    text: ROUND2,
    visual: figure({ kind: "circle", r, show: "r", label: `r = ${r} ${unit}`, sector: al, la: `${al}°` }),
    answer: right,
    hint: tx(`The sector is the part $\\frac{${al}°}{360°}$ of the whole circle.`, `Der Ausschnitt ist der Anteil $\\frac{${al}°}{360°}$ vom ganzen Kreis.`),
    solution: [
      { math: `${sym} =#e \\frac{\\alpha#al}{360\\deg#f}#fr \\cdot#m1 ${whole}`, note: area ? tx("A sector is the share $\\frac{\\alpha}{360°}$ of the circle area.", "Ein Kreisausschnitt ist der Anteil $\\frac{\\alpha}{360°}$ von der Kreisfläche.") : tx("The arc is the share $\\frac{\\alpha}{360°}$ of the circumference.", "Der Bogen ist der Anteil $\\frac{\\alpha}{360°}$ vom Umfang.") },
      { math: `${sym} =#e \\frac{${al}\\deg#al}{360\\deg#f}#fr \\cdot#m1 ${area ? `\\pi#pi \\cdot#m ${r}#r^{2#sq}` : `2#two \\cdot#m0 \\pi#pi \\cdot#m ${r}#r`}`, note: tx("Put in angle and radius.", "Setz Winkel und Radius ein.") },
      {
        math: say((f) => `${sym} \\approx#e ${f.d(value, 2)}#r ${q(area ? `${unit}²` : unit)}#u`),
        note: say((f) => {
          const g = gcdInt(al, 360);
          const part = al === 180 ? PARTS[2] : 360 / g === 360 / al && Number.isInteger(360 / al) ? PARTS[360 / al] : undefined;
          const share = `\\frac{${al}}{360} = \\frac{${al / g}}{${360 / g}}`;
          return f.t(
            `$${share}$${part ? `: the sector is ${part[0]} of the circle` : " of the circle"}. Use the π key and round.`,
            `$${share}$${part ? `: Der Ausschnitt ist ${part[1]} des Kreises` : " des Kreises"}. π-Taste und runden.`,
          );
        }),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Composite shapes with circles

const COMPOSITE = tx("Find the area of the shape", "Berechne den Flächeninhalt der Figur");

function compositeTask(rng: Rng): Exercise {
  const kind = rng.pick(["window", "hole", "quarter", "track", "house"] as const);
  const unit = rng.pick(["cm", "m"]);
  const u2 = `${unit}²`;
  const L = (v: number) => say((f) => `${f.n(v)} ${unit}`);
  if (kind === "house") {
    const w = rng.int(3, 7) * 2;
    const h = rng.int(3, 8);
    const t = rng.int(2, 6);
    const A = w * h + (w * t) / 2;
    const m = mistakeList(exact(A, u2, "A ="));
    m.add(w * h + w * t, tx("Roof not halved", "Dach nicht halbiert"), tx("The roof is a triangle: half of base times height.", "Das Dach ist ein Dreieck: die Hälfte von Grundseite mal Höhe."));
    m.add(w * (h + t), tx("The whole rectangle", "Das ganze Rechteck"), tx("The roof isn't a rectangle. Split the shape: rectangle plus triangle.", "Das Dach ist kein Rechteck. Zerleg die Figur: Rechteck plus Dreieck."));
    m.add(w * h, tx("Roof missing", "Dach fehlt"), tx("Don't forget the triangle on top!", "Vergiss das Dreieck oben nicht!"));
    return {
      instruction: COMPOSITE,
      visual: figure({ kind: "house", w, h, t, lw: L(w), lh: L(h), lt: L(t) }),
      answer: exact(A, u2, "A ="),
      hint: tx("Rectangle plus triangle.", "Rechteck plus Dreieck."),
      solution: [
        { math: tx('A#A =#e A_{"rect"}#a1 +#p A_{"tri"}#a2', 'A#A =#e A_{"Rechteck"}#a1 +#p A_{"Dreieck"}#a2'), note: tx("Split the shape: a rectangle and a triangle on top.", "Zerleg die Figur: ein Rechteck und oben ein Dreieck.") },
        { math: `A#A =#e ${w}#w \\cdot#m ${h}#h +#p \\frac{${w}#w2 \\cdot#m2 ${t}#t}{2#two}#fr`, note: tx("The roof triangle has base $" + w + "$ and height $" + t + "$.", "Das Dachdreieck hat die Grundseite $" + w + "$ und die Höhe $" + t + "$.") },
        { math: `A#A =#e ${w * h}#w +#p ${(w * t) / 2}#w2`, note: tx("Work out both parts.", "Rechne beide Teile aus.") },
        { math: `A#A =#e ${A}#w ${q(u2)}#u`, note: tx("Done!", "Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  let A: number;
  let fig: FigureSpec;
  let frames: Frame[];
  let hint: Text;
  const m0: { v: number; title: Text; say: Text }[] = [];
  if (kind === "window") {
    const w = rng.int(2, 6) * 2;
    const h = rng.int(3, 9);
    const r = w / 2;
    A = w * h + (PI * r * r) / 2;
    fig = { kind: "window", w, h, lw: L(w), lh: L(h) };
    hint = tx("Rectangle plus half a circle. The radius is half the width.", "Rechteck plus Halbkreis. Der Radius ist die halbe Breite.");
    frames = [
      { math: tx('A#A =#e A_{"rect"}#a1 +#p A_{"semicircle"}#a2', 'A#A =#e A_{"Rechteck"}#a1 +#p A_{"Halbkreis"}#a2'), note: tx("A rectangle with a semicircle on top.", "Ein Rechteck mit einem Halbkreis oben drauf.") },
      { math: `A#A =#e ${w}#w \\cdot#m ${h}#h +#p \\frac{1}{2}#hf \\cdot#m2 \\pi#pi \\cdot#m3 ${r}#r^{2#sq}`, note: tx(`The semicircle has the diameter $${w}$, so $r = ${r}$.`, `Der Halbkreis hat den Durchmesser $${w}$, also $r = ${r}$.`) },
      { math: say((f) => `A#A \\approx#e ${w * h}#w +#p ${f.d((PI * r * r) / 2, 2)}#hf`), note: tx("Work out both parts.", "Rechne beide Teile aus.") },
      { math: say((f) => `A#A \\approx#e ${f.d(A, 2)}#w ${q(u2)}#u`), note: tx("Add and round. Done!", "Addieren und runden. Fertig!") },
    ];
    m0.push({ v: w * h + PI * r * r, title: tx("Whole circle", "Ganzer Kreis"), say: tx("Only **half** a circle sits on top: $\\frac{1}{2} \\pi r^2$.", "Oben sitzt nur ein **halber** Kreis: $\\frac{1}{2} \\pi r^2$.") });
    m0.push({ v: w * h + (PI * w * w) / 2, title: tx("Diameter used as radius", "Durchmesser statt Radius"), say: tx(`The width $${w}$ is the **diameter** of the semicircle. The radius is $${r}$.`, `Die Breite $${w}$ ist der **Durchmesser** des Halbkreises. Der Radius ist $${r}$.`) });
    m0.push({ v: w * h, title: tx("Semicircle missing", "Halbkreis fehlt"), say: tx("Don't forget the semicircle on top!", "Vergiss den Halbkreis oben nicht!") });
  } else if (kind === "hole") {
    const w = rng.int(4, 10) * 2;
    const r = rng.int(1, w / 2 - 1);
    A = w * w - PI * r * r;
    fig = { kind: "hole", w, h: w, r, lw: L(w), lh: L(w), lr: L(r) };
    hint = tx("Square minus the circular hole.", "Quadrat minus das runde Loch.");
    frames = [
      { math: tx('A#A =#e A_{"square"}#a1 -#p A_{"circle"}#a2', 'A#A =#e A_{"Quadrat"}#a1 -#p A_{"Kreis"}#a2'), note: tx("The hole is missing, so subtract it.", "Das Loch fehlt, also ziehst du es ab.") },
      { math: `A#A =#e ${w}#w^{2#s1} -#p \\pi#pi \\cdot#m ${r}#r^{2#sq}`, note: tx("Square and circle.", "Quadrat und Kreis.") },
      { math: say((f) => `A#A \\approx#e ${w * w}#w -#p ${f.d(PI * r * r, 2)}#pi`), note: tx("Work out both.", "Beides ausrechnen.") },
      { math: say((f) => `A#A \\approx#e ${f.d(A, 2)}#w ${q(u2)}#u`), note: tx("Subtract and round. Done!", "Subtrahieren und runden. Fertig!") },
    ];
    m0.push({ v: w * w + PI * r * r, title: tx("Added the hole", "Loch addiert"), say: tx("The hole is missing from the plate, so **subtract** it.", "Das Loch fehlt in der Platte, also **ziehst** du es **ab**.") });
    m0.push({ v: w * w, title: tx("Hole forgotten", "Loch vergessen"), say: tx("That's the square without the hole. Subtract the circle.", "Das ist das Quadrat ohne Loch. Zieh noch den Kreis ab.") });
    m0.push({ v: w * w - 2 * PI * r, title: tx("Circumference subtracted", "Umfang abgezogen"), say: tx("Subtract the circle's **area** $\\pi r^2$, not its circumference.", "Zieh die **Fläche** des Kreises $\\pi r^2$ ab, nicht seinen Umfang.") });
  } else if (kind === "quarter") {
    const w = rng.int(2, 12);
    A = w * w - (PI * w * w) / 4;
    fig = { kind: "quarter", w, lw: L(w) };
    hint = tx("The square minus a quarter circle. Its radius is the side of the square.", "Das Quadrat minus einen Viertelkreis. Sein Radius ist die Quadratseite.");
    frames = [
      { math: tx('A#A =#e A_{"square"}#a1 -#p A_{"quarter"}#a2', 'A#A =#e A_{"Quadrat"}#a1 -#p A_{"Viertelkreis"}#a2'), note: tx("The shaded part is what's left of the square after cutting out a quarter circle.", "Die gefärbte Fläche ist der Rest des Quadrats, wenn man einen Viertelkreis herausschneidet.") },
      { math: `A#A =#e ${w}#w^{2#s1} -#p \\frac{1}{4}#qf \\cdot#m2 \\pi#pi \\cdot#m ${w}#r^{2#sq}`, note: tx("The radius of the quarter circle is the side of the square.", "Der Radius des Viertelkreises ist die Quadratseite.") },
      { math: say((f) => `A#A \\approx#e ${w * w}#w -#p ${f.d((PI * w * w) / 4, 2)}#qf`), note: tx("Work out both.", "Beides ausrechnen.") },
      { math: say((f) => `A#A \\approx#e ${f.d(A, 2)}#w ${q(u2)}#u`), note: tx("Done!", "Fertig!") },
    ];
    m0.push({ v: (PI * w * w) / 4, title: tx("The wrong part", "Der falsche Teil"), say: tx("That's the quarter circle itself. The shaded part is the square **minus** the quarter circle.", "Das ist der Viertelkreis selbst. Gefärbt ist das Quadrat **minus** den Viertelkreis.") });
    m0.push({ v: w * w - PI * w * w, title: tx("A whole circle subtracted", "Ganzen Kreis abgezogen"), say: tx("Only a **quarter** of the circle is cut out: $\\frac{1}{4} \\pi r^2$.", "Nur ein **Viertel** des Kreises wird herausgeschnitten: $\\frac{1}{4} \\pi r^2$.") });
  } else {
    const h = rng.int(2, 6) * 2;
    const w = rng.int(h, 20);
    const r = h / 2;
    A = w * h + PI * r * r;
    fig = { kind: "track", w, h, lw: L(w), lh: L(h) };
    hint = tx("Rectangle plus two semicircles: together a whole circle.", "Rechteck plus zwei Halbkreise: zusammen ein ganzer Kreis.");
    frames = [
      { math: tx('A#A =#e A_{"rect"}#a1 +#p A_{"circle"}#a2', 'A#A =#e A_{"Rechteck"}#a1 +#p A_{"Kreis"}#a2'), note: tx("The two semicircles at the ends make one whole circle.", "Die beiden Halbkreise an den Enden ergeben einen ganzen Kreis.") },
      { math: `A#A =#e ${w}#w \\cdot#m1 ${h}#h +#p \\pi#pi \\cdot#m ${r}#r^{2#sq}`, note: tx(`The diameter is $${h}$, so $r = ${r}$.`, `Der Durchmesser ist $${h}$, also $r = ${r}$.`) },
      { math: say((f) => `A#A \\approx#e ${w * h}#w +#p ${f.d(PI * r * r, 2)}#pi`), note: tx("Work out both.", "Beides ausrechnen.") },
      { math: say((f) => `A#A \\approx#e ${f.d(A, 2)}#w ${q(u2)}#u`), note: tx("Done!", "Fertig!") },
    ];
    m0.push({ v: w * h + (PI * r * r) / 2, title: tx("Only one semicircle", "Nur ein Halbkreis"), say: tx("There are **two** semicircles, one at each end: together a whole circle.", "Es sind **zwei** Halbkreise, an jedem Ende einer: zusammen ein ganzer Kreis.") });
    m0.push({ v: w * h + PI * h * h, title: tx("Diameter used as radius", "Durchmesser statt Radius"), say: tx(`$${h}$ is the diameter of the circle. The radius is $${r}$.`, `$${h}$ ist der Durchmesser des Kreises. Der Radius ist $${r}$.`) });
  }
  const right = rounded(A, 2, u2, "A =");
  const m = mistakeList(right, 2);
  for (const x of m0) m.add(x.v, x.title, x.say);
  return { instruction: COMPOSITE, text: ROUND2, visual: figure(fig), answer: right, hint, solution: frames, mistakes: m.list };
}

// ---------------------------------------------------------------------------
// Prism and cylinder

const PRISM = tx("Find the volume of the prism", "Berechne das Volumen des Prismas");
const CYL_V = tx("Find the volume of the cylinder", "Berechne das Volumen des Zylinders");
const CYL_O = tx("Find the surface area of the cylinder", "Berechne die Oberfläche des Zylinders");

function prismTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm"]);
  const u3 = `${unit}³`;
  if (rng.chance(0.3)) {
    // A trench with a trapezium cross-section.
    const a = rng.int(3, 8);
    const c = rng.int(1, a - 1);
    const h = rng.int(1, 4);
    if (((a + c) * h) % 2 !== 0) return prismTask(rng);
    const L = rng.int(2, 12) * 5;
    const G = ((a + c) / 2) * h;
    const m = mistakeList(exact(G * L, "m³", "V ="));
    m.add((a + c) * h * L, tx("Cross-section not halved", "Querschnitt nicht halbiert"), tx("The cross-section is a trapezium: $\\frac{a + c}{2} \\cdot h$. You forgot the halving.", "Der Querschnitt ist ein Trapez: $\\frac{a + c}{2} \\cdot h$. Du hast das Halbieren vergessen."));
    m.add(G, tx("Only the base", "Nur die Grundfläche"), tx("That's only the cross-section $G$. The trench goes on for its whole length: $V = G \\cdot h_K$.", "Das ist nur der Querschnitt $G$. Der Graben geht über die ganze Länge: $V = G \\cdot h_K$."));
    m.add(a * h * L, tx("Only one parallel side", "Nur eine parallele Seite"), tx("The trapezium needs the average of top and bottom width.", "Beim Trapez brauchst du den Mittelwert aus oberer und unterer Breite."));
    return {
      instruction: PRISM,
      text: tx(
        `A trench is ${L} m long. Its cross-section is a trapezium: ${a} m wide at the top, ${c} m wide at the bottom and ${h} m deep. How many m³ of soil were dug out?`,
        `Ein Graben ist ${L} m lang. Sein Querschnitt ist ein Trapez: oben ${a} m breit, unten ${c} m breit und ${h} m tief. Wie viel m³ Erde wurden ausgehoben?`,
      ),
      answer: exact(G * L, "m³", "V ="),
      hint: tx("The cross-section is the base $G$, the length of the trench is the height of the prism.", "Der Querschnitt ist die Grundfläche $G$, die Länge des Grabens ist die Höhe des Prismas."),
      solution: [
        { math: "V#V =#e G#G \\cdot#m h_K#h", note: tx("Prism: base times height. The trench is a lying prism: its height $h_K$ is the length.", "Prisma: Grundfläche mal Höhe. Der Graben ist ein liegendes Prisma: Seine Körperhöhe $h_K$ ist die Länge.") },
        { math: say((f) => `G#G =#e \\frac{${a}#a +#p ${c}#c}{2#two}#fr \\cdot#m2 ${h}#hh =#e2 ${f.n(G)}#g "m²"#u2`), note: tx("The base is the trapezium cross-section.", "Die Grundfläche ist der trapezförmige Querschnitt.") },
        { math: say((f) => `V#V =#e ${f.n(G)}#G \\cdot#m ${L}#h`), note: tx("Times the length.", "Mal die Länge.") },
        { math: say((f) => `V#V =#e ${f.n(G * L)}#G "m³"#u`), note: tx("Done!", "Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  const [p, ht] = rng.pick([[3, 4], [2, 3], [4, 3], [3, 5], [2, 6], [4, 4], [5, 3]] as [number, number][]);
  const g = rng.int(Math.max(3, p + 1), 10);
  const L = rng.int(4, 15);
  if ((g * ht) % 2 !== 0) return prismTask(rng);
  const G = (g * ht) / 2;
  const m = mistakeList(exact(G * L, u3, "V ="));
  m.add(g * ht * L, tx("Triangle not halved", "Dreieck nicht halbiert"), tx("The base is a **triangle**: $G = \\frac{g \\cdot h}{2}$. Don't forget the halving.", "Die Grundfläche ist ein **Dreieck**: $G = \\frac{g \\cdot h}{2}$. Vergiss das Halbieren nicht."));
  m.add(G, tx("Only the base", "Nur die Grundfläche"), tx("That's only the triangle $G$. Stack it along the whole length: $V = G \\cdot h_K$.", "Das ist nur das Dreieck $G$. Stapel es über die ganze Länge: $V = G \\cdot h_K$."));
  m.add(G + L, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("$V = G$ **times** $h_K$.", "$V = G$ **mal** $h_K$."));
  return {
    instruction: PRISM,
    text: tx("The prism lies on one of its faces. Its height $h_K$ is the distance between the two triangles.", "Das Prisma liegt auf einer Seitenfläche. Seine Körperhöhe $h_K$ ist der Abstand der beiden Dreiecke."),
    visual: figure({ kind: "prism", g, ht, px: p, L, lg: `${g} ${unit}`, lht: `${ht} ${unit}`, lL: `h_K = ${L} ${unit}` }),
    answer: exact(G * L, u3, "V ="),
    hint: tx("First the triangle $G$, then $V = G \\cdot h_K$.", "Erst das Dreieck $G$, dann $V = G \\cdot h_K$."),
    solution: [
      { math: "V#V =#e G#G \\cdot#m h_K#h", note: tx("Prism: base times height. Here the base is the triangle at the front.", "Prisma: Grundfläche mal Höhe. Die Grundfläche ist hier das Dreieck vorne.") },
      { math: say((f) => `G#G =#e \\frac{${g}#g \\cdot#m2 ${ht}#hh}{2#two}#fr =#e2 ${f.n(G)}#gv ${q(`${unit}²`)}#u2`), note: tx("Area of the triangle.", "Flächeninhalt des Dreiecks.") },
      { math: say((f) => `V#V =#e ${f.n(G)}#G \\cdot#m ${L}#h`), note: tx("Times the height of the prism.", "Mal die Körperhöhe.") },
      { math: say((f) => `V#V =#e ${f.n(G * L)}#G ${q(u3)}#u`), note: tx("Done!", "Fertig!") },
    ],
    mistakes: m.list,
  };
}

const PRISM_O = tx("Find the surface area of the prism", "Berechne die Oberfläche des Prismas");

function prismSurfaceTask(rng: Rng): Exercise {
  const unit = rng.pick(["cm", "m", "cm"]);
  const u2 = `${unit}²`;
  // A lying prism whose base is a right triangle with whole sides, wider than tall (room for the labels).
  const [a, b, c] = rng.pick(TRIPLES.filter((t) => t[0] <= 12 && t[0] > t[1]));
  const L = rng.int(3, 12);
  const G = (a * b) / 2;
  const per = a + b + c;
  const M = per * L;
  const O = 2 * G + M;
  const m = mistakeList(exact(O, u2, "O ="));
  m.add(G + M, tx("One base missing", "Eine Grundfläche fehlt"), tx("A prism has **two** triangles, front and back: $O = 2 \\cdot G + M$.", "Ein Prisma hat **zwei** Dreiecke, vorne und hinten: $O = 2 \\cdot G + M$."));
  m.add(M, tx("Only the rectangles", "Nur die Rechtecke"), tx("That's the lateral surface $M$. Add the two triangles too.", "Das ist der Mantel $M$. Dazu kommen noch die beiden Dreiecke."));
  m.add(2 * a * b + M, tx("Triangle not halved", "Dreieck nicht halbiert"), tx("The base is a triangle: $G = \\frac{g \\cdot h}{2}$. Don't forget the halving.", "Die Grundfläche ist ein Dreieck: $G = \\frac{g \\cdot h}{2}$. Vergiss das Halbieren nicht."));
  m.add(2 * G + (a + b) * L, tx("Slanted face missing", "Schräge Fläche vergessen"), tx(`The lateral surface has **three** rectangles, one for each side of the triangle. The slanted one (${c} ${unit}) counts too.`, `Der Mantel hat **drei** Rechtecke, eins für jede Dreiecksseite. Das schräge (${c} ${unit}) zählt auch.`));
  m.add(G * L, tx("Volume instead of surface", "Volumen statt Oberfläche"), tx("$G \\cdot h_K$ is the volume. The surface is the two triangles plus the rectangles around them.", "$G \\cdot h_K$ ist das Volumen. Die Oberfläche sind die beiden Dreiecke plus die Rechtecke rundherum."));
  return {
    instruction: PRISM_O,
    text: tx("The prism lies on one of its faces. Its base is a right triangle.", "Das Prisma liegt auf einer Seitenfläche. Seine Grundfläche ist ein rechtwinkliges Dreieck."),
    visual: figure({ kind: "prism", g: a, ht: b, px: 0, L, lg: `${a} ${unit}`, lht: `${b} ${unit}`, lL: `h_K = ${L} ${unit}`, ls: `${c} ${unit}`, sideS: 1, lsInside: true }),
    answer: exact(O, u2, "O ="),
    hint: tx("Two triangles plus three rectangles: $O = 2 \\cdot G + M$ with $M = u \\cdot h_K$.", "Zwei Dreiecke plus drei Rechtecke: $O = 2 \\cdot G + M$ mit $M = u \\cdot h_K$."),
    solution: [
      { math: "O#O =#e 2#k \\cdot#m G#G +#p M#M", note: tx("Surface area: two bases (the triangles) plus the lateral surface $M$ (the rectangles).", "Oberfläche: zwei Grundflächen (die Dreiecke) plus der Mantel $M$ (die Rechtecke).") },
      { math: `G#G =#e \\frac{${a}#a \\cdot#m2 ${b}#b}{2#two}#fr =#e2 ${G}#gv ${q(u2)}#u2`, note: tx("A right triangle: leg times leg, divided by 2.", "Ein rechtwinkliges Dreieck: Kathete mal Kathete durch 2.") },
      { math: `u#u =#e ${a}#a +#p ${b}#b +#p2 ${c}#c =#e2 ${per}#uv ${q(unit)}#un`, note: tx("The perimeter of the triangle: all three sides.", "Der Umfang des Dreiecks: alle drei Seiten.") },
      { math: `M#M =#e ${per}#uv \\cdot#m ${L}#h =#e2 ${M}#mv ${q(u2)}#u2`, note: tx("Unfolded, the three rectangles make one long rectangle: perimeter times $h_K$.", "Aufgeklappt ergeben die drei Rechtecke ein langes Rechteck: Umfang mal $h_K$.") },
      { math: `O#O =#e 2#k \\cdot#m ${G}#gv +#p ${M}#mv`, note: tx("Put both into the formula.", "Beides in die Formel einsetzen.") },
      { math: `O#O =#e ${O}#gv ${q(u2)}#u`, note: tx(`$2 \\cdot ${G} = ${2 * G}$, plus ${M}. Done!`, `$2 \\cdot ${G} = ${2 * G}$, plus ${M}. Fertig!`) },
    ],
    mistakes: m.list,
  };
}

function cylinderTask(rng: Rng): Exercise {
  const r = rng.pick([2, 3, 4, 5, 6, 8, 10, 1.5, 2.5]);
  const h = rng.pick([3, 4, 5, 6, 8, 10, 12, 15, 20]);
  const unit = rng.pick(["cm", "m", "cm"]);
  const useD = rng.chance(0.35);
  const surface = rng.chance(0.4);
  const fig: FigureSpec = useD ? { kind: "cyl", r, h, lr: say((f) => `d = ${f.n(2 * r)} ${unit}`), lh: `h = ${h} ${unit}`, diameter: true } : { kind: "cyl", r, h, lr: say((f) => `r = ${f.n(r)} ${unit}`), lh: `h = ${h} ${unit}` };
  const dFrames = useD ? [radiusFrame(r, unit)] : [];
  if (surface) {
    const O = 2 * PI * r * r + 2 * PI * r * h;
    const right = rounded(O, 1, `${unit}²`, "O =");
    const m = mistakeList(right, 1);
    m.add(PI * r * r + 2 * PI * r * h, tx("One lid missing", "Ein Deckel fehlt"), tx("A cylinder has **two** circles: base and lid. $O = 2 \\pi r^2 + 2 \\pi r h$.", "Ein Zylinder hat **zwei** Kreise: Boden und Deckel. $O = 2 \\pi r^2 + 2 \\pi r h$."));
    m.add(2 * PI * r * h, tx("Only the curved surface", "Nur der Mantel"), tx("That's the curved surface $M$. Add the two circles too.", "Das ist der Mantel $M$. Dazu kommen noch die beiden Kreise."));
    m.add(PI * r * r * h, tx("Volume instead of surface", "Volumen statt Oberfläche"), tx("$\\pi r^2 h$ is the volume. The surface is two circles plus the curved surface.", "$\\pi r^2 h$ ist das Volumen. Die Oberfläche sind zwei Kreise plus der Mantel."));
    if (useD) m.add(2 * PI * 4 * r * r + 2 * PI * 2 * r * h, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("The formula needs the **radius**, half the diameter.", "Die Formel braucht den **Radius**, den halben Durchmesser."));
    return {
      instruction: CYL_O,
      text: ROUND1,
      visual: figure(fig),
      answer: right,
      hint: tx("Two circles plus the curved surface: $O = 2 \\pi r^2 + 2 \\pi r h$.", "Zwei Kreise plus Mantel: $O = 2 \\pi r^2 + 2 \\pi r h$."),
      solution: [
        { math: "O#O =#e 2#k \\cdot#m G#G +#p M#M", note: tx("Two circles (base and lid) plus the curved surface.", "Zwei Kreise (Boden und Deckel) plus der Mantel.") },
        ...dFrames,
        { math: say((f) => `O#O =#e 2#k \\cdot#m \\pi#G \\cdot#m1 ${f.n(r)}#r^{2#sq} +#p 2#k2 \\cdot#m2 \\pi#M \\cdot#m3 ${f.n(r)}#r2 \\cdot#m4 ${h}#h`), note: tx("The curved surface unrolls into a rectangle: circumference $2 \\pi r$ times height $h$.", "Der Mantel ist abgerollt ein Rechteck: Umfang $2 \\pi r$ mal Höhe $h$.") },
        { math: say((f) => `O#O \\approx#e ${f.d(2 * PI * r * r, 2)}#G +#p ${f.d(2 * PI * r * h, 2)}#M`), note: tx("Both parts with the π key.", "Beide Teile mit der π-Taste.") },
        { math: say((f) => `O#O \\approx#e ${f.d(O, 1)}#G ${q(`${unit}²`)}#u`), note: tx("Add and round. Done!", "Addieren und runden. Fertig!") },
      ],
      mistakes: m.list,
    };
  }
  const V = PI * r * r * h;
  const right = rounded(V, 1, `${unit}³`, "V =");
  const m = mistakeList(right, 1);
  if (useD) m.add(PI * 4 * r * r * h, tx("Diameter used as radius", "Durchmesser statt Radius"), tx("Classic trap! The formula needs the **radius**, half the diameter.", "Die klassische Falle! Die Formel braucht den **Radius**, den halben Durchmesser."));
  m.add(PI * r * h, tx("Forgot the square", "Quadrat vergessen"), tx("The base is a circle: $G = \\pi r^2$, with the radius **squared**.", "Die Grundfläche ist ein Kreis: $G = \\pi r^2$, mit **quadriertem** Radius."));
  m.add(2 * PI * r * h, tx("Curved surface instead of volume", "Mantel statt Volumen"), tx("$2 \\pi r h$ is the curved surface. The volume is base times height: $\\pi r^2 \\cdot h$.", "$2 \\pi r h$ ist der Mantel. Das Volumen ist Grundfläche mal Höhe: $\\pi r^2 \\cdot h$."));
  m.add(PI * r * r, tx("Only the base", "Nur die Grundfläche"), tx("That's just the circle at the bottom. Multiply by the height.", "Das ist nur der Kreis unten. Multiplizier noch mit der Höhe."));
  return {
    instruction: CYL_V,
    text: ROUND1,
    visual: figure(fig),
    answer: right,
    hint: tx("Base times height: $V = \\pi r^2 \\cdot h$.", "Grundfläche mal Höhe: $V = \\pi r^2 \\cdot h$."),
    solution: [
      { math: "V#V =#e \\pi#pi \\cdot#m r#r^{2#sq} \\cdot#m2 h#h", note: tx("Cylinder: circle area times height.", "Zylinder: Kreisfläche mal Höhe.") },
      ...dFrames,
      { math: say((f) => `V#V =#e \\pi#pi \\cdot#m ${f.n(r)}#r^{2#sq} \\cdot#m2 ${h}#h`), note: tx("Put in radius and height.", "Setz Radius und Höhe ein.") },
      { math: say((f) => `V#V =#e ${f.n(r * r * h)}#r \\pi#pi`), note: say((f) => f.t(`$${f.n(r * r)} \\cdot ${h} = ${f.n(r * r * h)}$.`, `$${f.n(r * r)} \\cdot ${h} = ${f.n(r * r * h)}$.`)) },
      { math: say((f) => `V#V \\approx#e ${f.d(V, 1)}#r ${q(`${unit}³`)}#u`), note: tx("π key, then round.", "π-Taste, dann runden.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Matching formulas

type Fm = { id: string; name: Text; f: Text };
const FORMULAS: Fm[] = [
  { id: "tri", name: tx("Triangle: area", "Dreieck: Flächeninhalt"), f: "$A = \\frac{g \\cdot h}{2}$" },
  { id: "para", name: tx("Parallelogram: area", "Parallelogramm: Flächeninhalt"), f: "$A = g \\cdot h$" },
  { id: "trap", name: tx("Trapezium: area", "Trapez: Flächeninhalt"), f: "$A = \\frac{a + c}{2} \\cdot h$" },
  { id: "circA", name: tx("Circle: area", "Kreis: Flächeninhalt"), f: "$A = \\pi r^2$" },
  { id: "circU", name: tx("Circle: circumference", "Kreis: Umfang"), f: "$u = 2 \\pi r$" },
  { id: "cylV", name: tx("Cylinder: volume", "Zylinder: Volumen"), f: "$V = \\pi r^2 h$" },
  { id: "cylM", name: tx("Cylinder: curved surface", "Zylinder: Mantel"), f: "$M = 2 \\pi r h$" },
  { id: "prism", name: tx("Prism: volume", "Prisma: Volumen"), f: "$V = G \\cdot h$" },
];
/** A wrong formula, and Blob's note for each shape a student may wrongly match it with. */
type Distractor = { f: Text; wrongFor: { id: string; title: Text; say: Text }[] };
const DISTRACTORS: Distractor[] = [
  {
    f: "$A = g \\cdot h \\cdot 2$",
    wrongFor: [
      { id: "tri", title: tx("Doubled instead of halved", "Verdoppelt statt halbiert"), say: tx("A triangle is **half** a parallelogram: divide $g \\cdot h$ by 2, don't multiply.", "Ein Dreieck ist ein **halbes** Parallelogramm: $g \\cdot h$ durch 2 teilen, nicht mal 2 nehmen.") },
      { id: "para", title: tx("A factor 2 too many", "Ein Faktor 2 zu viel"), say: tx("A parallelogram is simply base times height: $A = g \\cdot h$.", "Ein Parallelogramm ist einfach Grundseite mal Höhe: $A = g \\cdot h$.") },
    ],
  },
  {
    f: "$A = 2 \\pi r^2$",
    wrongFor: [
      { id: "circA", title: tx("Formulas mixed up", "Formeln vermischt"), say: tx("The area of a circle is $\\pi r^2$. The 2 belongs to the circumference $2 \\pi r$.", "Der Flächeninhalt des Kreises ist $\\pi r^2$. Die 2 gehört zum Umfang $2 \\pi r$.") },
    ],
  },
  {
    f: "$V = \\frac{1}{3} G \\cdot h$",
    wrongFor: [
      { id: "prism", title: tx("The third belongs to pyramids", "Das Drittel gehört zur Pyramide"), say: tx("$\\frac{1}{3}$ is for pointed solids (pyramid, cone). A prism is simply $G \\cdot h$.", "$\\frac{1}{3}$ gehört zu spitzen Körpern (Pyramide, Kegel). Ein Prisma ist einfach $G \\cdot h$.") },
      { id: "cylV", title: tx("The third belongs to cones", "Das Drittel gehört zum Kegel"), say: tx("$\\frac{1}{3}$ is for pointed solids (pyramid, cone). A cylinder is base times height: $V = \\pi r^2 h$.", "$\\frac{1}{3}$ gehört zu spitzen Körpern (Pyramide, Kegel). Ein Zylinder ist Grundfläche mal Höhe: $V = \\pi r^2 h$.") },
    ],
  },
  {
    f: "$u = \\pi r^2$",
    wrongFor: [
      { id: "circU", title: tx("Circumference with r²", "Umfang mit r²"), say: tx("$r^2$ gives square units, so $\\pi r^2$ is an area. The circumference is a length: $u = 2 \\pi r$.", "$r^2$ ergibt Quadrateinheiten, $\\pi r^2$ ist also eine Fläche. Der Umfang ist eine Länge: $u = 2 \\pi r$.") },
      { id: "circA", title: tx("Look at the letter", "Schau auf den Buchstaben"), say: tx("$u$ stands for the circumference. The area of a circle is $A = \\pi r^2$.", "$u$ steht für den Umfang. Den Flächeninhalt schreibst du $A = \\pi r^2$.") },
    ],
  },
];

function matchFormulaTask(rng: Rng): Exercise {
  const chosen = rng.shuffle(FORMULAS).slice(0, 4);
  const has = (id: string) => chosen.find((c) => c.id === id);
  const extra = rng.pick(DISTRACTORS);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("tri") && has("para")) wrong.push({ pairs: [[has("tri")!.name, has("para")!.f]], title: tx("Triangle without the half", "Dreieck ohne Hälfte"), say: tx("A triangle is **half** a parallelogram: $\\frac{g \\cdot h}{2}$.", "Ein Dreieck ist ein **halbes** Parallelogramm: $\\frac{g \\cdot h}{2}$.") });
  if (has("circA") && has("circU")) wrong.push({ pairs: [[has("circA")!.name, has("circU")!.f]], title: tx("Area and circumference swapped", "Fläche und Umfang vertauscht"), say: tx("$r^2$ belongs to the **area** (square units), $2 \\pi r$ to the circumference (a length).", "$r^2$ gehört zur **Fläche** (Quadrateinheiten), $2 \\pi r$ zum Umfang (eine Länge).") });
  if (has("cylV") && has("cylM")) wrong.push({ pairs: [[has("cylV")!.name, has("cylM")!.f]], title: tx("Volume and curved surface swapped", "Volumen und Mantel vertauscht"), say: tx("The volume is base times height: $\\pi r^2 \\cdot h$. $2 \\pi r h$ is the unrolled curved surface.", "Das Volumen ist Grundfläche mal Höhe: $\\pi r^2 \\cdot h$. $2 \\pi r h$ ist der abgerollte Mantel.") });
  for (const w of extra.wrongFor) {
    const c = has(w.id);
    if (c) wrong.push({ pairs: [[c.name, extra.f]], title: w.title, say: w.say });
  }
  const m = matchTask(chosen.map((c) => [c.name, c.f] as [Text, Text]), [extra.f], wrong);
  return {
    instruction: tx("Match the formulas", "Ordne die Formeln zu"),
    text: tx("Which formula belongs to which shape? One formula is left over.", "Welche Formel gehört zu welcher Figur? Eine Formel bleibt übrig."),
    answer: m.answer,
    hint: tx("Areas have a squared length, volumes three lengths multiplied, a circumference only one length.", "Flächen haben eine quadrierte Länge, Volumen drei Längen malgenommen, ein Umfang nur eine Länge."),
    solution: chosen.map((c, i) => ({
      math: E(c.f).slice(1, -1),
      note: i === chosen.length - 1 ? tx(`${E(c.name)}. The formula left over doesn't belong to any of them.`, `${D(c.name)}. Die übrige Formel gehört zu keiner Figur.`) : tx(`${E(c.name)}.`, `${D(c.name)}.`),
    })),
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  return weighted(rng, [
    [12, () => triangleTask(rng)],
    [8, () => parallelogramTask(rng)],
    [10, () => trapeziumTask(rng)],
    [8, () => heightTask(rng)],
    [8, () => circleUTask(rng)],
    [10, () => circleAreaTask(rng)],
    [8, () => sectorTask(rng)],
    [10, () => compositeTask(rng)],
    [8, () => prismTask(rng)],
    [6, () => prismSurfaceTask(rng)],
    [12, () => cylinderTask(rng)],
    [6, () => matchFormulaTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const tableCheck = circleAreaParts(0.6, true, "m", 2);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Parallelogram: cut and shift", "Parallelogramm: abschneiden und verschieben"),
      blob: tx("A parallelogram is a rectangle in disguise!", "Ein Parallelogramm ist ein verkleidetes Rechteck!"),
      body: tx(
        "Cut off the triangle on the left and move it to the right: you get a rectangle with length $g$ and width $h$. The **height** $h$ is the distance between the parallel sides, at right angles to the base $g$.",
        "Schneide das Dreieck links ab und setz es rechts an: Es entsteht ein Rechteck mit der Länge $g$ und der Breite $h$. Die **Höhe** $h$ ist der Abstand der parallelen Seiten, senkrecht zur Grundseite $g$.",
      ),
      visual: figure({ kind: "para", g: 6, h: 4, off: 3, lg: "g = 6 cm", lh: "h = 4 cm", ls: "5 cm", cut: true }, tx("Parallelogram with the cut-off triangle", "Parallelogramm mit abgeschnittenem Dreieck")),
      frames: [
        { math: "A#A =#e g#g \\cdot#m h#h", note: tx("After cutting and shifting it's a rectangle: base times height.", "Nach dem Abschneiden und Verschieben ist es ein Rechteck: Grundseite mal Höhe.") },
        { math: 'A#A =#e 6#g "cm"#u1 \\cdot#m 4#h "cm"#u2', note: tx('Take the **height** $4 "cm"$, not the slanted side $5 "cm"$.', 'Nimm die **Höhe** $4 "cm"$, nicht die schräge Seite $5 "cm"$.') },
        { math: 'A#A =#e 24#g "cm²"#u1', note: tx("Done: the same area as a 6 by 4 rectangle.", "Fertig: dieselbe Fläche wie ein Rechteck mit 6 mal 4.") },
      ],
    },
    {
      type: "widget",
      title: tx("Base and height", "Grundseite und Höhe"),
      blob: tx("Slanted or straight: only the height counts!", "Schräg oder gerade: Nur die Höhe zählt!"),
      body: tx(
        "Drag the top corner of a triangle or a parallelogram. As long as base and height stay the same, the area doesn't change. For the triangle you can also pick another side as the base.",
        "Zieh die obere Ecke eines Dreiecks oder Parallelogramms. Solange Grundseite und Höhe gleich bleiben, ändert sich der Flächeninhalt nicht. Beim Dreieck kannst du auch eine andere Seite als Grundseite wählen.",
      ),
      widget: AreaVolumeBaseHeight,
    },
    {
      type: "explain",
      title: tx("Triangle: half a parallelogram", "Dreieck: ein halbes Parallelogramm"),
      blob: tx("Every side can be the base. Pick the one you know the height for!", "Jede Seite kann Grundseite sein. Nimm die, zu der du die Höhe kennst!"),
      body: tx(
        "Two copies of a triangle make a parallelogram, so $A = \\frac{g \\cdot h}{2}$. Any side can be the base $g$, as long as you take the height that belongs to it.",
        "Zwei gleiche Dreiecke ergeben ein Parallelogramm, also gilt $A = \\frac{g \\cdot h}{2}$. Jede Seite kann die Grundseite $g$ sein, wenn du die passende Höhe dazu nimmst.",
      ),
      visual: figure(
        { kind: "tri", pts: [[0, 0], [10, 0], [6.4, 4.8]], base: 0, lh: tx("h = 4.8 cm", "h = 4,8 cm"), labels: [{ i: 0, text: "10 cm" }, { i: 1, text: "6 cm" }, { i: 2, text: "8 cm" }], right: 2 },
        tx("Right triangle with sides 6, 8 and 10 cm", "Rechtwinkliges Dreieck mit den Seiten 6, 8 und 10 cm"),
      ),
      frames: [
        { math: "A#A =#e \\frac{g#g \\cdot#m h#h}{2#two}#fr", note: tx("Triangle: half of base times height.", "Dreieck: die Hälfte von Grundseite mal Höhe.") },
        { math: 'A#A =#e \\frac{8#g \\cdot#m 6#h}{2#two}#fr =#e2 24#r "cm²"#u', note: tx("The right angle is at the top: the legs 8 cm and 6 cm are base and height for each other.", "Der rechte Winkel liegt oben: Die Katheten 8 cm und 6 cm sind füreinander Grundseite und Höhe.") },
        { math: tx('A#A =#e \\frac{10#g \\cdot#m 4.8#h}{2#two}#fr =#e2 24#r "cm²"#u', 'A#A =#e \\frac{10#g \\cdot#m 4,8#h}{2#two}#fr =#e2 24#r "cm²"#u'), note: tx("Now the long side 10 cm is the base. Its height is 4.8 cm. Same area!", "Jetzt ist die lange Seite 10 cm die Grundseite. Ihre Höhe ist 4,8 cm. Gleiche Fläche!") },
      ],
    },
    {
      type: "check",
      blob: tx("Careful, one number is a trap.", "Vorsicht, eine Zahl ist eine Falle."),
      exercise: {
        instruction: TRIANGLE,
        visual: figure({ kind: "tri", pts: [[0, 0], [7, 0], [3, 4]], base: 0, lh: "h = 4 cm", labels: [{ i: 0, text: "g = 7 cm" }, { i: 2, text: "5 cm" }] }),
        answer: exact(14, "cm²", "A ="),
        hint: tx("Which line is at right angles to the base?", "Welche Linie steht senkrecht auf der Grundseite?"),
        solution: triangleFrames(7, 4, "cm"),
        mistakes: (() => {
          const m = mistakeList(exact(14, "cm²", "A ="));
          m.add(28, tx("Forgot to halve", "Halbieren vergessen"), tx("Nearly! $7 \\cdot 4$ is a whole parallelogram. The triangle is half of it.", "Fast! $7 \\cdot 4$ ist ein ganzes Parallelogramm. Das Dreieck ist die Hälfte davon."), true);
          m.add(17.5, tx("Slanted side is not the height", "Schräge Seite ist keine Höhe"), tx('The side $5 "cm"$ is slanted. The height is the dashed line at right angles to the base.', 'Die Seite $5 "cm"$ ist schräg. Die Höhe ist die gestrichelte Linie, senkrecht zur Grundseite.'));
          m.add(35, tx("Slanted side, no halving", "Schräge Seite, nicht halbiert"), tx("Two slips: take the dashed height, not the slanted side, and halve.", "Zwei Ausrutscher: Nimm die gestrichelte Höhe, nicht die schräge Seite, und halbiere."));
          return m.list;
        })(),
      },
    },
    {
      type: "explain",
      title: tx("The trapezium", "Das Trapez"),
      blob: tx("Two parallel sides: take their average!", "Zwei parallele Seiten: Nimm ihren Mittelwert!"),
      body: tx(
        "A trapezium has two parallel sides $a$ and $c$. Turn a copy upside down and put it next to it: you get a parallelogram with base $a + c$. The trapezium is half of it.",
        "Ein Trapez hat zwei parallele Seiten $a$ und $c$. Dreh eine Kopie um und leg sie daneben: Es entsteht ein Parallelogramm mit der Grundseite $a + c$. Das Trapez ist die Hälfte davon.",
      ),
      visual: figure({ kind: "trap", a: 9, c: 5, h: 4, off: 2, la: "a = 9 cm", lc: "c = 5 cm", lh: "h = 4 cm" }, tx("Trapezium with a = 9 cm, c = 5 cm, h = 4 cm", "Trapez mit a = 9 cm, c = 5 cm, h = 4 cm")),
      frames: trapFrames(9, 5, 4, "cm"),
    },
    {
      type: "explain",
      title: tx("The circle and π", "Der Kreis und π"),
      id: "the-circle-and-pi",
      blob: tx("π is the most famous number in maths: 3.14159…", "π ist die berühmteste Zahl der Mathematik: 3,14159…"),
      body: tx(
        "Every circle has a radius $r$ (centre to edge) and a diameter $d = 2r$ (straight across). The circumference is always a bit more than 3 diameters: exactly $\\pi \\approx 3.14$ times.",
        "Jeder Kreis hat einen Radius $r$ (Mittelpunkt bis Rand) und einen Durchmesser $d = 2r$ (einmal quer durch). Der Umfang ist immer etwas mehr als 3 Durchmesser: genau $\\pi \\approx 3,14$-mal.",
      ),
      visual: figure({ kind: "circle", r: 3, show: "rd", label: "r", ld: "d" }, tx("Circle with radius and diameter", "Kreis mit Radius und Durchmesser")),
      frames: [
        { math: "u#u =#e \\pi#pi \\cdot#m d#d", note: tx("Circumference: π times the diameter.", "Umfang: π mal der Durchmesser.") },
        { math: "u#u =#e 2#two \\cdot#m2 \\pi#pi \\cdot#m r#d", note: tx("The diameter is twice the radius: $d = 2r$. So $u = 2 \\pi r$.", "Der Durchmesser ist doppelt so lang wie der Radius: $d = 2r$. Also $u = 2 \\pi r$.") },
        { math: "A#A =#e \\pi#pi \\cdot#m r#d^{2#sq}", note: tx("Area: $A = \\pi r^2$. Here it's the **radius**, and it is squared.", "Flächeninhalt: $A = \\pi r^2$. Hier steht der **Radius**, und er wird quadriert.") },
        { math: 'A#A =#e \\pi#pi \\cdot#m 3#d^{2#sq} "cm²"#u', note: tx("Example: $r = 3$ cm.", "Beispiel: $r = 3$ cm.") },
        { math: 'A#A =#e 9#d \\pi#pi "cm²"#u', note: tx("$3^2 = 9$. Square first, then times π.", "$3^2 = 9$. Erst quadrieren, dann mal π.") },
        { math: tx('A#A \\approx#e 28.27#d "cm²"#u', 'A#A \\approx#e 28,27#d "cm²"#u'), note: tx("With the π key: $9 \\pi \\approx 28.27$. Round only at the end.", "Mit der π-Taste: $9 \\pi \\approx 28,27$. Runde erst am Ende.") },
      ],
    },
    {
      type: "widget",
      title: tx("Discovering π", "π entdecken"),
      id: "discovering-pi",
      blob: tx("The more pieces, the more it looks like a rectangle!", "Je mehr Stücke, desto mehr sieht es aus wie ein Rechteck!"),
      body: tx(
        "First roll a wheel once along the ground: the track is π times the diameter. Then cut a circle into pieces and lay them side by side: a nearly-rectangle with sides $\\pi r$ and $r$ appears.",
        "Roll zuerst ein Rad einmal über den Boden: Die Strecke ist π-mal der Durchmesser. Dann schneide einen Kreis in Stücke und leg sie nebeneinander: Es entsteht fast ein Rechteck mit den Seiten $\\pi r$ und $r$.",
      ),
      widget: AreaVolumeCircleLab,
    },
    {
      type: "check",
      blob: tx("Diameter or radius? Look closely!", "Durchmesser oder Radius? Schau genau hin!"),
      exercise: {
        instruction: CIRC_A,
        text: join(tx('A round table top has a diameter of $1.2 "m"$.', 'Eine runde Tischplatte hat einen Durchmesser von $1,2 "m"$.'), ROUND2),
        visual: figure(circleFig(0.6, true, "m")),
        answer: tableCheck.right,
        hint: tx("Halve the diameter first.", "Halbiere zuerst den Durchmesser."),
        solution: tableCheck.frames,
        mistakes: tableCheck.mistakes,
      },
    },
    {
      type: "explain",
      title: tx("Parts of circles and composite shapes", "Kreisteile und zusammengesetzte Flächen"),
      blob: tx("Split it up, work out each part, add or subtract.", "Zerlegen, Teile ausrechnen, addieren oder abziehen."),
      body: tx(
        "A window: a rectangle with a semicircle on top. A semicircle is half a circle, a quarter circle a quarter. In general a **sector** with angle $\\alpha$ is the share $\\frac{\\alpha}{360°}$ of the circle. If a piece is missing (a hole), subtract it.",
        "Ein Fenster: ein Rechteck mit einem Halbkreis oben. Ein Halbkreis ist ein halber Kreis, ein Viertelkreis ein Viertel. Allgemein ist ein **Kreisausschnitt** mit dem Mittelpunktswinkel $\\alpha$ der Anteil $\\frac{\\alpha}{360°}$ vom Kreis. Fehlt ein Stück (ein Loch), ziehst du es ab.",
      ),
      visual: figure({ kind: "window", w: 8, h: 5, lw: "8 dm", lh: "5 dm" }, tx("Window: rectangle with a semicircle", "Fenster: Rechteck mit Halbkreis")),
      frames: [
        { math: tx('A#A =#e A_{"rect"}#a1 +#p A_{"semicircle"}#a2', 'A#A =#e A_{"Rechteck"}#a1 +#p A_{"Halbkreis"}#a2'), note: tx("Split the window into two parts.", "Zerleg das Fenster in zwei Teile.") },
        { math: "A#A =#e 8#w \\cdot#m 5#h +#p \\frac{1}{2}#hf \\cdot#m2 \\pi#pi \\cdot#m3 4#r^{2#sq}", note: tx("The semicircle's diameter is the width 8 dm, so $r = 4$ dm.", "Der Durchmesser des Halbkreises ist die Breite 8 dm, also $r = 4$ dm.") },
        { math: "A#A =#e 40#w +#p 8#hf \\pi#pi", note: tx("$\\frac{1}{2} \\cdot 16 = 8$.", "$\\frac{1}{2} \\cdot 16 = 8$.") },
        { math: tx('A#A \\approx#e 65.13#w "dm²"#u', 'A#A \\approx#e 65,13#w "dm²"#u'), note: tx("Add with the π key. Done!", "Mit der π-Taste addieren. Fertig!") },
        { math: "A#A =#e \\frac{\\alpha#al}{360\\deg#f}#fr \\cdot#m \\pi#pi r#r^{2#sq}", note: tx("Any sector: the share $\\frac{\\alpha}{360°}$ of the circle. Semicircle: $\\alpha = 180°$, quarter circle: $\\alpha = 90°$.", "Jeder Kreisausschnitt: der Anteil $\\frac{\\alpha}{360°}$ vom Kreis. Halbkreis: $\\alpha = 180°$, Viertelkreis: $\\alpha = 90°$.") },
        { math: "b#A =#e \\frac{\\alpha#al}{360\\deg#f}#fr \\cdot#m 2#two \\pi#pi r#r", note: tx("The arc $b$ works the same way: a share of the circumference.", "Der Bogen $b$ geht genauso: ein Anteil vom Umfang.") },
      ],
    },
    {
      type: "explain",
      title: tx("Prism and cylinder", "Prisma und Zylinder"),
      blob: tx("Stack the base, slice by slice!", "Staple die Grundfläche, Scheibe für Scheibe!"),
      body: tx(
        "A **prism** has two equal, parallel bases. Its height $h$ is their distance, even if the prism lies on its side. A **cylinder** is the same with a circle as the base. The **curved surface** (Mantel) unrolls into a rectangle.",
        "Ein **Prisma** hat zwei gleiche, parallele Grundflächen. Seine Höhe $h$ ist ihr Abstand, auch wenn das Prisma liegt. Ein **Zylinder** ist dasselbe mit einem Kreis als Grundfläche. Der **Mantel** lässt sich zu einem Rechteck abrollen.",
      ),
      visual: figure(
        { kind: "pair", items: [{ kind: "prism", g: 6, ht: 4, px: 3, L: 8, lg: "g", lL: "h" }, { kind: "cylnet", r: 1.6, h: 5, lr: "r", lh: "h", lu: "u = 2πr" }] },
        tx("A lying prism and the net of a cylinder", "Ein liegendes Prisma und das Netz eines Zylinders"),
      ),
      frames: [
        { math: "V#V =#e G#G \\cdot#m h#h", note: tx("Volume: base times height. The base is stacked $h$ times.", "Volumen: Grundfläche mal Höhe. Die Grundfläche wird $h$-mal gestapelt.") },
        { math: "V#V =#e \\pi#G r#r^{2#sq} \\cdot#m h#h", note: tx("For the cylinder the base is a circle: $G = \\pi r^2$.", "Beim Zylinder ist die Grundfläche ein Kreis: $G = \\pi r^2$.") },
        { math: "O#O =#e 2#two \\cdot#m2 G#G +#p M#M", note: tx("Surface area: two bases plus the curved surface $M$.", "Oberfläche: zwei Grundflächen plus der Mantel $M$.") },
        { math: "M#M =#e u#u \\cdot#m3 h#h", note: tx("Unrolled, the curved surface is a rectangle: the circumference of the base times the height.", "Abgerollt ist der Mantel ein Rechteck: Umfang der Grundfläche mal Höhe.") },
        { math: "O#O =#e 2#two \\pi#G r#r^{2#sq} +#p 2#t2 \\pi#pi r#r2 h#h", note: tx("So for the cylinder: $O = 2 \\pi r^2 + 2 \\pi r h$.", "Für den Zylinder also: $O = 2 \\pi r^2 + 2 \\pi r h$.") },
      ],
    },
    {
      type: "check",
      blob: tx("Base times height, with a circle as the base.", "Grundfläche mal Höhe, mit einem Kreis als Grundfläche."),
      exercise: {
        instruction: CYL_V,
        text: tx("A tin has the radius 4 cm and the height 10 cm. Round to a whole number of cm³.", "Eine Dose hat den Radius 4 cm und die Höhe 10 cm. Runde auf ganze cm³."),
        visual: figure({ kind: "cyl", r: 4, h: 10, lr: "r = 4 cm", lh: "h = 10 cm" }),
        answer: rounded(160 * PI, 0, "cm³", "V ="),
        hint: tx("$V = \\pi r^2 \\cdot h$.", "$V = \\pi r^2 \\cdot h$."),
        solution: [
          { math: "V#V =#e \\pi#pi \\cdot#m r#r^{2#sq} \\cdot#m2 h#h", note: tx("Cylinder: circle area times height.", "Zylinder: Kreisfläche mal Höhe.") },
          { math: "V#V =#e \\pi#pi \\cdot#m 4#r^{2#sq} \\cdot#m2 10#h", note: tx("Put in $r = 4$ and $h = 10$.", "Setz $r = 4$ und $h = 10$ ein.") },
          { math: "V#V =#e 160#r \\pi#pi", note: tx("$16 \\cdot 10 = 160$.", "$16 \\cdot 10 = 160$.") },
          { math: 'V#V \\approx#e 503#r "cm³"#u', note: tx("$160 \\pi \\approx 502.65$, rounded 503 cm³. That's about half a litre.", "$160 \\pi \\approx 502,65$, gerundet 503 cm³. Das ist ungefähr ein halber Liter.") },
        ],
        mistakes: (() => {
          const m = mistakeList(rounded(160 * PI, 0, "cm³", "V ="), 0);
          m.add(40 * PI, tx("Forgot the square", "Quadrat vergessen"), tx("The base is a circle: $\\pi r^2$, with the radius **squared**.", "Die Grundfläche ist ein Kreis: $\\pi r^2$, mit **quadriertem** Radius."));
          m.add(80 * PI, tx("Curved surface instead of volume", "Mantel statt Volumen"), tx("$2 \\pi r h$ is the curved surface. The volume is $\\pi r^2 \\cdot h$.", "$2 \\pi r h$ ist der Mantel. Das Volumen ist $\\pi r^2 \\cdot h$."));
          m.add(16 * PI, tx("Only the base", "Nur die Grundfläche"), tx("That's just the circle at the bottom. Multiply by the height.", "Das ist nur der Kreis unten. Multiplizier noch mit der Höhe."));
          m.add(640 * PI, tx("Radius doubled", "Radius verdoppelt"), tx("The radius is 4 cm already: you don't have to double it.", "Der Radius ist schon 4 cm: Den musst du nicht verdoppeln."));
          return m.list;
        })(),
      },
    },
  ],
  summary: [
    {
      title: tx("Triangle, parallelogram, trapezium", "Dreieck, Parallelogramm, Trapez"),
      body: tx("The height always stands at right angles on the base (or its extension). Any side can be the base.", "Die Höhe steht immer senkrecht auf der Grundseite (oder ihrer Verlängerung). Jede Seite kann Grundseite sein."),
      examples: [tx('A_{"tri"} = \\frac{g \\cdot h}{2}', 'A_{"Dreieck"} = \\frac{g \\cdot h}{2}'), tx('A_{"para"} = g \\cdot h', 'A_{"Parallelogramm"} = g \\cdot h'), tx('A_{"trap"} = \\frac{a + c}{2} \\cdot h', 'A_{"Trapez"} = \\frac{a + c}{2} \\cdot h')],
      tone: "rule",
    },
    {
      title: tx("Circle", "Kreis"),
      body: tx("Radius $r$, diameter $d = 2r$, $\\pi \\approx 3.14$.", "Radius $r$, Durchmesser $d = 2r$, $\\pi \\approx 3,14$."),
      examples: ["u = 2 \\pi r = \\pi d", "A = \\pi r^2"],
      tone: "rule",
    },
    {
      title: tx("Sector", "Kreisausschnitt"),
      body: tx("The share $\\frac{\\alpha}{360°}$ of the whole circle.", "Der Anteil $\\frac{\\alpha}{360°}$ vom ganzen Kreis."),
      examples: ["A = \\frac{\\alpha}{360\\deg} \\cdot \\pi r^2", "b = \\frac{\\alpha}{360\\deg} \\cdot 2 \\pi r"],
      tone: "rule",
    },
    {
      title: tx("Prism and cylinder", "Prisma und Zylinder"),
      body: tx("Volume: base times height. Surface: two bases plus the curved surface.", "Volumen: Grundfläche mal Höhe. Oberfläche: zwei Grundflächen plus Mantel."),
      examples: ["V = G \\cdot h , \\; O = 2 G + M", tx('V_{"cyl"} = \\pi r^2 h , \\; O_{"cyl"} = 2 \\pi r^2 + 2 \\pi r h', 'V_{"Zyl"} = \\pi r^2 h , \\; O_{"Zyl"} = 2 \\pi r^2 + 2 \\pi r h')],
      tone: "rule",
    },
    {
      title: tx("Composite shapes", "Zusammengesetzte Flächen"),
      body: tx("Split into known shapes and add. A hole or a missing piece is subtracted.", "In bekannte Figuren zerlegen und addieren. Ein Loch oder ein fehlendes Stück wird abgezogen."),
      examples: [tx('A = A_{"rect"} + \\frac{1}{2} \\pi r^2', 'A = A_{"Rechteck"} + \\frac{1}{2} \\pi r^2')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("A slanted side is not the height. Halve the diameter before using $\\pi r^2$. $\\pi r$ is not $\\pi r^2$.", "Eine schräge Seite ist keine Höhe. Halbiere den Durchmesser, bevor du $\\pi r^2$ nimmst. $\\pi r$ ist nicht $\\pi r^2$."),
      examples: ["r = d : 2", "\\pi r \\ne \\pi r^2"],
      tone: "warning",
    },
  ],
};
