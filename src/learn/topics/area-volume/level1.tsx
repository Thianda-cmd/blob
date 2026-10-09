"use client";

// Level 1 (Klasse 5–6): perimeter and area of rectangles and squares, area units (factor 100),
// composite shapes made of rectangles, and the cuboid: volume, volume units (factor 1000) and
// surface area from the net.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { figure, type FigureSpec, type P, type SideLabel } from "./figures";
import { choice, exact, mistakeList, say, weighted, type Opt } from "./kit";
import { AreaVolumeCuboidBuilder, AreaVolumeRectangleBuilder, AreaVolumeUnitTable } from "./widgets1";

const q = (unit: string) => `"${unit}"`;
const E = (t: Text) => (typeof t === "string" ? t : t.en);
const D = (t: Text) => (typeof t === "string" ? t : t.de);

// ---------------------------------------------------------------------------
// Perimeter and area of rectangles and squares

const PERIMETER = tx("Find the perimeter", "Berechne den Umfang");
const AREA = tx("Find the area", "Berechne den Flächeninhalt");

function rectFigure(a: number, b: number, unit: string, grid = false): FigureSpec {
  return { kind: "rect", a, b, la: say((f) => `${f.n(a)} ${unit}`), lb: say((f) => `${f.n(b)} ${unit}`), grid };
}

function perimeterFrames(a: number, b: number, unit: string, square: boolean): Frame[] {
  if (square)
    return [
      { math: "u#u =#e 4#k \\cdot#m a#a", note: tx("A square has four sides of the same length: $u = 4 \\cdot a$.", "Ein Quadrat hat vier gleich lange Seiten: $u = 4 \\cdot a$.") },
      { math: `u#u =#e 4#k \\cdot#m ${a}#a`, note: tx(`Put in $a = ${a} ${q(unit)}$.`, `Setz $a = ${a} ${q(unit)}$ ein.`) },
      { math: `u#u =#e ${4 * a}#a ${q(unit)}#un`, note: tx(`$4 \\cdot ${a} = ${4 * a}$. A perimeter is a length, so the unit is ${unit}.`, `$4 \\cdot ${a} = ${4 * a}$. Der Umfang ist eine Länge, also in ${unit}.`) },
    ];
  return [
    { math: "u#u =#e 2#k1 \\cdot#m1 a#a +#p 2#k2 \\cdot#m2 b#b", note: tx("The perimeter is all four sides. Two of them are always the same: $u = 2 \\cdot a + 2 \\cdot b$.", "Der Umfang sind alle vier Seiten. Je zwei sind gleich lang: $u = 2 \\cdot a + 2 \\cdot b$.") },
    { math: `u#u =#e 2#k1 \\cdot#m1 ${a}#a +#p 2#k2 \\cdot#m2 ${b}#b`, note: tx(`Put in $a = ${a} ${q(unit)}$ and $b = ${b} ${q(unit)}$.`, `Setz $a = ${a} ${q(unit)}$ und $b = ${b} ${q(unit)}$ ein.`) },
    { math: `u#u =#e ${2 * a}#a +#p ${2 * b}#b`, note: tx("Multiplication first, then add.", "Punkt vor Strich: erst die Produkte.") },
    { math: `u#u =#e ${2 * (a + b)}#a ${q(unit)}#un`, note: tx(`A perimeter is a length, so the unit is ${unit}. Done!`, `Der Umfang ist eine Länge, also in ${unit}. Fertig!`) },
  ];
}

function perimeterMistakes(a: number, b: number, unit: string, square: boolean): Mistake[] {
  const m = mistakeList(exact(2 * (a + b), unit, "u ="));
  m.add(
    a * b,
    tx("Area instead of perimeter", "Fläche statt Umfang"),
    tx(
      "Ah, you worked out the **area**: the squares inside. The perimeter is the edge, so add up all four sides.",
      "Ah, du hast den **Flächeninhalt** ausgerechnet, also die Kästchen innen. Der Umfang ist der Rand: Addiere alle vier Seiten.",
    ),
  );
  if (square) {
    m.add(2 * a, tx("Only two sides", "Nur zwei Seiten"), tx("A square has **four** sides of the same length, not two: $u = 4 \\cdot a$.", "Ein Quadrat hat **vier** gleich lange Seiten, nicht zwei: $u = 4 \\cdot a$."));
    m.add(a + 4, tx("Plus instead of times", "Plus statt mal"), tx("Four sides of the same length: that's $4 \\cdot a$, not $a + 4$.", "Vier gleich lange Seiten: Das ist $4 \\cdot a$, nicht $a + 4$."));
  } else {
    m.add(a + b, tx("Only two sides", "Nur zwei Seiten"), tx("You added only two sides. A rectangle has four: two long ones and two short ones.", "Du hast nur zwei Seiten addiert. Ein Rechteck hat vier: zwei lange und zwei kurze."));
    m.add(2 * a + b, tx("One side missing", "Eine Seite fehlt"), tx("Nearly! One short side is missing. Walk round once more: $a + b + a + b$.", "Fast! Eine kurze Seite fehlt. Geh noch mal ganz herum: $a + b + a + b$."), true);
  }
  return m.list;
}

const FENCE_STORIES: { unit: string; scale: number; text: (a: number, b: number) => Text }[] = [
  { unit: "m", scale: 1, text: (a, b) => tx(`A rectangular flower bed is ${a} m long and ${b} m wide. How many metres of fence go all the way round?`, `Ein rechteckiges Beet ist ${a} m lang und ${b} m breit. Wie viel Meter Zaun braucht man ringsherum?`) },
  { unit: "cm", scale: 1, text: (a, b) => tx(`A photo is ${a} cm long and ${b} cm wide. A ribbon is glued all the way round its edge. How long is the ribbon?`, `Ein Foto ist ${a} cm lang und ${b} cm breit. Rundherum wird ein Band an den Rand geklebt. Wie lang ist das Band?`) },
  { unit: "m", scale: 10, text: (a, b) => tx(`A sports field is ${a} m long and ${b} m wide. Tom runs once all the way round. How far does he run?`, `Ein Sportplatz ist ${a} m lang und ${b} m breit. Tom läuft einmal ganz herum. Wie weit läuft er?`) },
];

function perimeterTask(rng: Rng): Exercise {
  const square = rng.chance(0.3);
  const a0 = rng.int(3, 15);
  const b0 = square ? a0 : rng.int(2, a0 - 1);
  if (!square && rng.chance(0.4)) {
    const st = rng.pick(FENCE_STORIES);
    const a = a0 * st.scale;
    const b = b0 * st.scale;
    return {
      instruction: PERIMETER,
      text: st.text(a, b),
      answer: exact(2 * (a + b), st.unit, "u ="),
      hint: tx("All the way round means all four sides: $u = 2 \\cdot a + 2 \\cdot b$.", "Ganz herum heißt: alle vier Seiten. $u = 2 \\cdot a + 2 \\cdot b$."),
      solution: perimeterFrames(a, b, st.unit, false),
      mistakes: perimeterMistakes(a, b, st.unit, false),
    };
  }
  const unit = rng.pick(["cm", "m", "cm", "m", "mm", "dm"]);
  const a = a0;
  const b = b0;
  return {
    instruction: PERIMETER,
    text: square
      ? tx(`A square with side $a = ${a} ${q(unit)}$.`, `Ein Quadrat mit der Seitenlänge $a = ${a} ${q(unit)}$.`)
      : tx(`A rectangle with $a = ${a} ${q(unit)}$ and $b = ${b} ${q(unit)}$.`, `Ein Rechteck mit $a = ${a} ${q(unit)}$ und $b = ${b} ${q(unit)}$.`),
    visual: figure(square ? { kind: "rect", a, b: a, la: `${a} ${unit}` } : rectFigure(a, b, unit)),
    answer: exact(square ? 4 * a : 2 * (a + b), unit, "u ="),
    hint: square ? tx("Four sides of the same length.", "Vier gleich lange Seiten.") : tx("Add up all four sides: two long ones and two short ones.", "Addiere alle vier Seiten: zwei lange und zwei kurze."),
    solution: perimeterFrames(a, b, unit, square),
    mistakes: square ? squarePerimeterMistakes(a, unit) : perimeterMistakes(a, b, unit, false),
  };
}

function squarePerimeterMistakes(a: number, unit: string): Mistake[] {
  const m = mistakeList(exact(4 * a, unit, "u ="));
  m.add(a * a, tx("Area instead of perimeter", "Fläche statt Umfang"), tx("That's $a \\cdot a$, the **area**. For the perimeter, add the four sides: $u = 4 \\cdot a$.", "Das ist $a \\cdot a$, der **Flächeninhalt**. Für den Umfang addierst du die vier Seiten: $u = 4 \\cdot a$."));
  m.add(2 * a, tx("Only two sides", "Nur zwei Seiten"), tx("A square has **four** sides of the same length, not two.", "Ein Quadrat hat **vier** gleich lange Seiten, nicht zwei."));
  m.add(a + 4, tx("Plus instead of times", "Plus statt mal"), tx("Four sides of the same length: that's $4 \\cdot a$, not $a + 4$.", "Vier gleich lange Seiten: Das ist $4 \\cdot a$, nicht $a + 4$."));
  return m.list;
}

function areaFrames(a: number, b: number, unit: string, square: boolean): Frame[] {
  if (square)
    return [
      { math: "A#A =#e a#a \\cdot#m a#b", note: tx("A square: length times width, and both are $a$. So $A = a \\cdot a = a^2$.", "Ein Quadrat: Länge mal Breite, und beide sind $a$. Also $A = a \\cdot a = a^2$.") },
      { math: `A#A =#e ${a}#a \\cdot#m ${a}#b`, note: tx(`Put in $a = ${a} ${q(unit)}$.`, `Setz $a = ${a} ${q(unit)}$ ein.`) },
      { math: `A#A =#e ${a * a}#a ${q(`${unit}²`)}#un`, note: tx(`${a * a} squares of $1 ${q(`${unit}²`)}$. An area is measured in square units.`, `${a * a} Quadrate mit je $1 ${q(`${unit}²`)}$. Flächen misst man in Quadrateinheiten.`) },
    ];
  return [
    { math: "A#A =#e a#a \\cdot#m b#b", note: tx("Area of a rectangle: length times width.", "Flächeninhalt eines Rechtecks: Länge mal Breite.") },
    { math: `A#A =#e ${a}#a \\cdot#m ${b}#b`, note: tx(`$${b}$ rows of $${a}$ squares each.`, `$${b}$ Reihen mit je $${a}$ Quadraten.`) },
    { math: `A#A =#e ${a * b}#a ${q(`${unit}²`)}#un`, note: tx(`$${a} \\cdot ${b} = ${a * b}$. The unit is ${unit}², because ${unit} times ${unit} gives ${unit}².`, `$${a} \\cdot ${b} = ${a * b}$. Die Einheit ist ${unit}², denn ${unit} mal ${unit} ergibt ${unit}².`) },
  ];
}

function areaMistakes(a: number, b: number, unit: string, square: boolean): Mistake[] {
  const m = mistakeList(exact(a * b, `${unit}²`, "A ="));
  if (square) m.add(2 * a, tx("a² is not 2 · a", "a² ist nicht 2 · a"), tx("Squared means $a \\cdot a$, not $2 \\cdot a$.", "Hoch 2 heißt $a \\cdot a$, nicht $2 \\cdot a$."));
  m.add(
    2 * (a + b),
    tx("Perimeter instead of area", "Umfang statt Fläche"),
    tx("Ah, that's the **perimeter**, the edge around it. The area is the space inside: length **times** width.", "Ah, das ist der **Umfang**, also der Rand. Der Flächeninhalt ist das, was innen liegt: Länge **mal** Breite."),
  );
  m.add(a + b, tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("You added the sides. For the area you multiply: $A = a \\cdot b$.", "Du hast die Seiten addiert. Für den Flächeninhalt multiplizierst du: $A = a \\cdot b$."));
  return m.list;
}

function areaTask(rng: Rng): Exercise {
  const kind = rng.pick(["rect", "rect", "square", "story", "mixed"] as const);
  if (kind === "mixed") {
    const a = rng.int(2, 9);
    const b = rng.int(3, 9);
    const right = 10 * a * b;
    const m = mistakeList(exact(right, "dm²", "A ="));
    m.add(a * b, tx("Units not matched", "Einheiten nicht angepasst"), tx(`You multiplied m by dm. First write both sides in the same unit: $${a} "m" = ${10 * a} "dm"$.`, `Du hast m mal dm gerechnet. Schreib erst beide Seiten in derselben Einheit: $${a} "m" = ${10 * a} "dm"$.`));
    m.add(100 * a * b, tx("Converted twice", "Doppelt umgerechnet"), tx(`Only the side in metres has to be converted: $${a} "m" = ${10 * a} "dm"$, that's times 10 for a length.`, `Nur die Seite in Metern musst du umrechnen: $${a} "m" = ${10 * a} "dm"$, bei Längen ist das mal 10.`));
    m.add(2 * (10 * a + b), tx("Perimeter instead of area", "Umfang statt Fläche"), tx("That's the perimeter. For the area, multiply length and width.", "Das ist der Umfang. Für den Flächeninhalt multiplizierst du Länge und Breite."));
    return {
      instruction: AREA,
      text: tx(`A rectangle is $${a} "m"$ long and $${b} "dm"$ wide. Give the area in dm².`, `Ein Rechteck ist $${a} "m"$ lang und $${b} "dm"$ breit. Gib den Flächeninhalt in dm² an.`),
      answer: exact(right, "dm²", "A ="),
      hint: tx("Different units! Convert the length into dm first.", "Verschiedene Einheiten! Rechne zuerst die Länge in dm um."),
      solution: [
        { math: `a#a =#e ${a}#av "m"#au =#e2 ${10 * a}#aw "dm"#ax`, note: tx('Both sides need the same unit. $1 "m" = 10 "dm"$.', 'Beide Seiten brauchen dieselbe Einheit. $1 "m" = 10 "dm"$.') },
        { math: `A#A =#e ${10 * a}#aw "dm"#ax \\cdot#m ${b}#b "dm"#bu`, note: tx("Now length times width.", "Jetzt Länge mal Breite.") },
        { math: `A#A =#e ${right}#aw "dm²"#ax`, note: tx(`$${10 * a} \\cdot ${b} = ${right}$. dm times dm gives dm².`, `$${10 * a} \\cdot ${b} = ${right}$. dm mal dm ergibt dm².`) },
      ],
      mistakes: m.list,
    };
  }
  if (kind === "story") {
    const a = rng.int(3, 9);
    const b = rng.int(2, a - 1);
    const s = rng.pick([
      tx(`A room is ${a} m long and ${b} m wide. How many square metres of carpet are needed to cover the floor?`, `Ein Zimmer ist ${a} m lang und ${b} m breit. Wie viel Quadratmeter Teppich braucht man für den Boden?`),
      tx(`A vegetable patch is ${a} m long and ${b} m wide. How big is its area?`, `Ein Gemüsebeet ist ${a} m lang und ${b} m breit. Wie groß ist seine Fläche?`),
      tx(`A wall is ${a} m wide and ${b} m high. How many square metres have to be painted?`, `Eine Wand ist ${a} m breit und ${b} m hoch. Wie viel Quadratmeter müssen gestrichen werden?`),
    ]);
    return {
      instruction: AREA,
      text: s,
      answer: exact(a * b, "m²", "A ="),
      hint: tx("Area of a rectangle: length times width.", "Flächeninhalt eines Rechtecks: Länge mal Breite."),
      solution: areaFrames(a, b, "m", false),
      mistakes: areaMistakes(a, b, "m", false),
    };
  }
  const unit = rng.pick(["cm", "m", "mm", "dm", "km"]);
  if (kind === "square") {
    const a = rng.int(3, 15);
    return {
      instruction: AREA,
      text: tx(`A square with side $a = ${a} ${q(unit)}$.`, `Ein Quadrat mit der Seitenlänge $a = ${a} ${q(unit)}$.`),
      visual: figure({ kind: "rect", a, b: a, la: `${a} ${unit}`, grid: a <= 8 && rng.chance(0.5) }),
      answer: exact(a * a, `${unit}²`, "A ="),
      hint: tx("A square: $A = a \\cdot a$.", "Ein Quadrat: $A = a \\cdot a$."),
      solution: areaFrames(a, a, unit, true),
      mistakes: areaMistakes(a, a, unit, true),
    };
  }
  const a = rng.int(3, 15);
  const b = rng.int(2, Math.min(12, a));
  if (a === b) return areaTask(rng);
  return {
    instruction: AREA,
    text: tx(`A rectangle with $a = ${a} ${q(unit)}$ and $b = ${b} ${q(unit)}$.`, `Ein Rechteck mit $a = ${a} ${q(unit)}$ und $b = ${b} ${q(unit)}$.`),
    visual: figure(rectFigure(a, b, unit, a <= 8 && b <= 6 && rng.chance(0.5))),
    answer: exact(a * b, `${unit}²`, "A ="),
    hint: tx("Length times width.", "Länge mal Breite."),
    solution: areaFrames(a, b, unit, false),
    mistakes: areaMistakes(a, b, unit, false),
  };
}

// ---------------------------------------------------------------------------
// Missing side

const MISSING = tx("Find the missing side", "Berechne die fehlende Seitenlänge");

function missingTask(rng: Rng): Exercise {
  const kind = rng.int(0, 3);
  const unit = rng.pick(["cm", "m"]);
  if (kind === 0) {
    const a = rng.int(3, 12);
    const b = rng.int(2, 12);
    if (a === b) return missingTask(rng);
    const A = a * b;
    const m = mistakeList(exact(b, unit, "b ="));
    m.add(A - a, tx("Subtracted instead of divided", "Subtrahiert statt dividiert"), tx(`The area is $a$ **times** $b$. To undo a multiplication, divide: $b = A : a$.`, `Der Flächeninhalt ist $a$ **mal** $b$. Eine Multiplikation machst du mit Geteilt rückgängig: $b = A : a$.`));
    m.add(A * a, tx("Multiplied instead of divided", "Multipliziert statt dividiert"), tx(`Your side is much too long. Ask: $${a} \\cdot \\, ? = ${A}$. That's a division.`, `Deine Seite ist viel zu lang. Frag dich: $${a} \\cdot \\, ? = ${A}$. Das ist eine Division.`));
    m.add(A / 2, tx("Halved", "Halbiert"), tx(`Halving doesn't help here: divide the area by the known side $${a} ${q(unit)}$.`, `Halbieren hilft hier nicht: Teil den Flächeninhalt durch die bekannte Seite $${a} ${q(unit)}$.`));
    return {
      instruction: MISSING,
      text: tx(
        `A rectangle has the area $A = ${A} ${q(`${unit}²`)}$. One side is $a = ${a} ${q(unit)}$ long. How long is the other side $b$?`,
        `Ein Rechteck hat den Flächeninhalt $A = ${A} ${q(`${unit}²`)}$. Eine Seite ist $a = ${a} ${q(unit)}$ lang. Wie lang ist die andere Seite $b$?`,
      ),
      answer: exact(b, unit, "b ="),
      hint: tx(`$${a} \\cdot b = ${A}$. Which number times ${a} gives ${A}?`, `$${a} \\cdot b = ${A}$. Welche Zahl mal ${a} ergibt ${A}?`),
      solution: [
        { math: "A#A =#e a#a \\cdot#m b#b", note: tx("Start with the formula for the area.", "Fang mit der Formel für den Flächeninhalt an.") },
        { math: `${A}#A =#e ${a}#a \\cdot#m b#b`, note: tx("Put in what you know.", "Setz ein, was du kennst.") },
        { math: `b#b =#e ${A}#A :#m ${a}#a`, note: tx(`Undo the multiplication: divide by $${a}$.`, `Mach die Multiplikation rückgängig: Teil durch $${a}$.`) },
        { math: `b#b =#e ${b}#r ${q(unit)}#u`, note: tx(`Check: $${a} \\cdot ${b} = ${A}$. Fits!`, `Probe: $${a} \\cdot ${b} = ${A}$. Passt!`) },
      ],
      mistakes: m.list,
    };
  }
  if (kind === 1) {
    const a = rng.int(4, 14);
    const b = rng.int(2, a - 1);
    const u = 2 * (a + b);
    const m = mistakeList(exact(b, unit, "b ="));
    m.add(u - 2 * a, tx("Forgot to halve", "Halbieren vergessen"), tx(`Nearly! $${u - 2 * a}$ is **both** sides $b$ together: $2 \\cdot b = ${u - 2 * a}$. Now halve it.`, `Fast! $${u - 2 * a}$ sind **beide** Seiten $b$ zusammen: $2 \\cdot b = ${u - 2 * a}$. Jetzt noch halbieren.`), true);
    m.add(u - a, tx("Only one side a taken off", "Nur ein a abgezogen"), tx("The perimeter contains side $a$ **twice**. Take off $2 \\cdot a$, then halve.", "Im Umfang steckt die Seite $a$ **zweimal**. Zieh $2 \\cdot a$ ab und halbiere dann."));
    m.add(u / 2, tx("Half the perimeter", "Halber Umfang"), tx(`Half the perimeter is $a + b = ${u / 2}$. Now take off $a = ${a}$.`, `Der halbe Umfang ist $a + b = ${u / 2}$. Jetzt noch $a = ${a}$ abziehen.`));
    m.add(u / a, tx("Divided like for the area", "Geteilt wie bei der Fläche"), tx("Dividing by $a$ works for the **area**. The perimeter is a sum: $u = 2 \\cdot a + 2 \\cdot b$.", "Durch $a$ teilen klappt beim **Flächeninhalt**. Der Umfang ist eine Summe: $u = 2 \\cdot a + 2 \\cdot b$."));
    return {
      instruction: MISSING,
      text: tx(
        `A rectangle has the perimeter $u = ${u} ${q(unit)}$. Side $a$ is $${a} ${q(unit)}$ long. How long is side $b$?`,
        `Ein Rechteck hat den Umfang $u = ${u} ${q(unit)}$. Die Seite $a$ ist $${a} ${q(unit)}$ lang. Wie lang ist die Seite $b$?`,
      ),
      answer: exact(b, unit, "b ="),
      hint: tx("$u = 2 \\cdot a + 2 \\cdot b$. Take off both sides $a$, then halve.", "$u = 2 \\cdot a + 2 \\cdot b$. Zieh beide Seiten $a$ ab und halbiere dann."),
      solution: [
        { math: "u#u =#e 2#k1 \\cdot#m1 a#a +#p 2#k2 \\cdot#m2 b#b", note: tx("The perimeter formula.", "Die Formel für den Umfang.") },
        { math: `${u}#u =#e 2#k1 \\cdot#m1 ${a}#a +#p 2#k2 \\cdot#m2 b#b`, note: tx("Put in $u$ and $a$.", "Setz $u$ und $a$ ein.") },
        { math: `${u}#u =#e ${2 * a}#a +#p 2#k2 \\cdot#m2 b#b`, note: tx(`$2 \\cdot ${a} = ${2 * a}$.`, `$2 \\cdot ${a} = ${2 * a}$.`) },
        { math: `2#k2 \\cdot#m2 b#b =#e ${u - 2 * a}#u`, note: tx(`Take off ${2 * a}: $${u} - ${2 * a} = ${u - 2 * a}$. That's both sides $b$.`, `${2 * a} abziehen: $${u} - ${2 * a} = ${u - 2 * a}$. Das sind beide Seiten $b$.`) },
        { math: `b#b =#e ${b}#u ${q(unit)}#un`, note: tx(`Halve: $${u - 2 * a} : 2 = ${b}$. Check: $2 \\cdot ${a} + 2 \\cdot ${b} = ${u}$.`, `Halbieren: $${u - 2 * a} : 2 = ${b}$. Probe: $2 \\cdot ${a} + 2 \\cdot ${b} = ${u}$.`) },
      ],
      mistakes: m.list,
    };
  }
  if (kind === 2) {
    const a = rng.int(3, 12);
    const A = a * a;
    const m = mistakeList(exact(a, unit, "a ="));
    m.add(A / 2, tx("Halved", "Halbiert"), tx(`$a^2$ means $a \\cdot a$, not $2 \\cdot a$. Look for the number that gives ${A} when multiplied by itself.`, `$a^2$ heißt $a \\cdot a$, nicht $2 \\cdot a$. Such die Zahl, die mit sich selbst malgenommen ${A} ergibt.`));
    m.add(A / 4, tx("Divided by 4", "Durch 4 geteilt"), tx(`Dividing by 4 works for the **perimeter** of a square. Here you have the area: $a \\cdot a = ${A}$.`, `Durch 4 teilen klappt beim **Umfang** eines Quadrats. Hier hast du den Flächeninhalt: $a \\cdot a = ${A}$.`));
    return {
      instruction: MISSING,
      text: tx(`A square has the area $A = ${A} ${q(`${unit}²`)}$. How long is one side?`, `Ein Quadrat hat den Flächeninhalt $A = ${A} ${q(`${unit}²`)}$. Wie lang ist eine Seite?`),
      answer: exact(a, unit, "a ="),
      hint: tx(`Which number times itself gives ${A}?`, `Welche Zahl mal sich selbst ergibt ${A}?`),
      solution: [
        { math: "A#A =#e a#a \\cdot#m a#b", note: tx("For a square, $A = a \\cdot a$.", "Beim Quadrat gilt $A = a \\cdot a$.") },
        { math: `${A}#A =#e a#a \\cdot#m a#b`, note: tx(`So look for a number that gives ${A} when multiplied by itself.`, `Gesucht ist also eine Zahl, die mit sich selbst malgenommen ${A} ergibt.`) },
        { math: `${A}#A =#e ${a}#a \\cdot#m ${a}#b`, note: tx(`$${a} \\cdot ${a} = ${A}$. Found it!`, `$${a} \\cdot ${a} = ${A}$. Gefunden!`) },
        { math: `a#a =#e ${a}#r ${q(unit)}#u`, note: tx(`Each side is ${a} ${unit} long.`, `Jede Seite ist ${a} ${unit} lang.`) },
      ],
      mistakes: m.list,
    };
  }
  const a = rng.int(3, 25);
  const u = 4 * a;
  const m = mistakeList(exact(a, unit, "a ="));
  m.add(u / 2, tx("Divided by 2", "Durch 2 geteilt"), tx("A square has **four** sides, so divide the perimeter by 4.", "Ein Quadrat hat **vier** Seiten, also teilst du den Umfang durch 4."));
  m.add(u - 4, tx("Minus instead of divided", "Minus statt geteilt"), tx("$u = 4 \\cdot a$ is a product. Undo it by dividing by 4.", "$u = 4 \\cdot a$ ist ein Produkt. Du machst es mit Geteilt durch 4 rückgängig."));
  if (Number.isInteger(Math.sqrt(u))) m.add(Math.sqrt(u), tx("Treated like an area", "Wie eine Fläche behandelt"), tx("Taking the root works for the **area** of a square. This is the perimeter: $u = 4 \\cdot a$.", "Die Wurzel hilft beim **Flächeninhalt** eines Quadrats. Hier ist der Umfang gegeben: $u = 4 \\cdot a$."));
  return {
    instruction: MISSING,
    text: tx(`A square has the perimeter $u = ${u} ${q(unit)}$. How long is one side?`, `Ein Quadrat hat den Umfang $u = ${u} ${q(unit)}$. Wie lang ist eine Seite?`),
    answer: exact(a, unit, "a ="),
    hint: tx("Four sides of the same length make up the perimeter.", "Der Umfang besteht aus vier gleich langen Seiten."),
    solution: [
      { math: "u#u =#e 4#k \\cdot#m a#a", note: tx("The perimeter of a square is four equal sides.", "Der Umfang eines Quadrats: vier gleiche Seiten.") },
      { math: `${u}#u =#e 4#k \\cdot#m a#a`, note: tx("Put in the perimeter.", "Setz den Umfang ein.") },
      { math: `a#a =#e ${u}#u :#m 4#k`, note: tx("Divide by 4.", "Teil durch 4.") },
      { math: `a#a =#e ${a}#u ${q(unit)}#un`, note: tx(`Check: $4 \\cdot ${a} = ${u}$.`, `Probe: $4 \\cdot ${a} = ${u}$.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Converting units

const CONVERT = tx("Convert", "Rechne um");
const AREA_UNITS = ["mm²", "cm²", "dm²", "m²", "a", "ha", "km²"];
const VOL_UNITS = ["mm³", "cm³", "dm³", "m³"];

/** Friendly values in the bigger unit. */
const BIG_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 20, 25, 30, 45, 0.5, 1.5, 2.5, 3.5, 4.5, 7.5, 0.8, 1.2, 0.4, 0.25, 0.75, 12.5];

function convertTask(rng: Rng): Exercise {
  const volume = rng.chance(0.4);
  const units = volume ? VOL_UNITS : AREA_UNITS;
  const factor = volume ? 1000 : 100;
  const steps = !volume && rng.chance(0.25) ? 2 : 1;
  const lo = rng.int(volume ? 1 : 0, units.length - 1 - steps);
  const hi = lo + steps;
  const F = factor ** steps;
  const big = rng.pick(BIG_VALUES.filter((v) => (steps === 2 ? v >= 0.5 : true)));
  const small = Math.round(big * F * 1e6) / 1e6;
  // Litres and millilitres instead of dm³ and cm³, sometimes.
  const alias = (i: number) => (volume && rng.chance(0.5) ? (units[i] === "dm³" ? "l" : units[i] === "cm³" ? "ml" : units[i]) : units[i]);
  const bigU = alias(hi);
  const smallU = alias(lo);
  const down = rng.chance(0.5);
  const from = down ? big : small;
  const fromU = down ? bigU : smallU;
  const toU = down ? smallU : bigU;
  const right = down ? small : big;
  const m = mistakeList(exact(right, toU));
  const tooFew = down ? from * (volume ? 100 : 10) ** steps : from / (volume ? 100 : 10) ** steps;
  m.add(
    tooFew,
    volume ? tx("Factor 100 instead of 1000", "Faktor 100 statt 1000") : tx("Factor 10 instead of 100", "Faktor 10 statt 100"),
    volume
      ? tx("For volume units the factor is **1000**: a cube with 1 dm edges holds $10 \\cdot 10 \\cdot 10 = 1000$ small cubes of 1 cm³.", "Bei Volumeneinheiten ist die Umrechnungszahl **1000**: In einen Würfel mit 1 dm Kantenlänge passen $10 \\cdot 10 \\cdot 10 = 1000$ Würfel mit 1 cm³.")
      : tx("Classic trap! For area units the factor is **100**, not 10: a square with 1 dm sides holds $10 \\cdot 10 = 100$ squares of 1 cm².", "Die klassische Falle! Bei Flächeneinheiten ist die Umrechnungszahl **100**, nicht 10: In ein Quadrat mit 1 dm Seitenlänge passen $10 \\cdot 10 = 100$ Quadrate mit 1 cm²."),
  );
  if (!volume) m.add(down ? from * 1000 ** steps : from / 1000 ** steps, tx("Factor 1000 is for volume", "Faktor 1000 gehört zum Volumen"), tx("1000 is the factor for **volume** units. Area units go in steps of 100.", "1000 ist die Umrechnungszahl für **Volumen**. Flächeneinheiten gehen in 100er-Schritten."));
  m.add(
    down ? from / F : from * F,
    tx("Wrong direction", "Falsche Richtung"),
    down
      ? tx(`To a **smaller** unit, the number gets **bigger**: many small ${toU} fit into one ${fromU}. Multiply.`, `Zur **kleineren** Einheit wird die Zahl **größer**: Viele kleine ${toU} passen in ein ${fromU}. Also mal rechnen.`)
      : tx(`To a **bigger** unit, the number gets **smaller**. Divide.`, `Zur **größeren** Einheit wird die Zahl **kleiner**. Also teilen.`),
  );
  if (steps === 2) m.add(down ? from * factor : from / factor, tx("Only one step", "Nur eine Stufe"), tx(`From ${units[hi]} to ${units[lo]} are **two** steps, so the factor is $100 \\cdot 100 = 10\\,000$.`, `Von ${units[hi]} zu ${units[lo]} sind es **zwei** Stufen, also ist die Umrechnungszahl $100 \\cdot 100 = 10\\,000$.`));

  const chain = say((f) => {
    const parts = [];
    for (let i = hi; i >= lo; i--) parts.push(`${f.n(factor ** (hi - i))} ${q(units[i])}`);
    const extra = volume && (units[hi] === "dm³" || units[lo] === "cm³") ? ` \\quad 1 "l" = 1 "dm³" , \\; 1 "ml" = 1 "cm³"` : "";
    return `${parts.join(" = ")}${extra}`;
  });
  return {
    instruction: CONVERT,
    math: say((f) => `${f.n(from)} ${q(fromU)} = \\box{?} \\, ${q(toU)}`),
    answer: exact(right, toU),
    hint: volume ? tx("Volume units: factor 1000 per step. Litre = dm³, millilitre = cm³.", "Volumeneinheiten: Umrechnungszahl 1000 pro Stufe. Liter = dm³, Milliliter = cm³.") : tx("Area units: factor 100 per step.", "Flächeneinheiten: Umrechnungszahl 100 pro Stufe."),
    solution: [
      {
        math: chain,
        note: steps === 2 ? tx(`Two steps: the factor is $100 \\cdot 100 = 10\\,000$.`, `Zwei Stufen: Die Umrechnungszahl ist $100 \\cdot 100 = 10\\,000$.`) : volume ? tx("One step for volume units: factor 1000.", "Eine Stufe bei Volumeneinheiten: Umrechnungszahl 1000.") : tx("One step for area units: factor 100.", "Eine Stufe bei Flächeneinheiten: Umrechnungszahl 100."),
      },
      {
        math: say((f) => `${f.n(from)}#v ${q(fromU)}#u =#e ${f.n(from)}#w ${down ? "\\cdot" : ":"}#m ${f.n(F)}#f ${q(toU)}#t`),
        note: down ? tx("To the smaller unit: multiply.", "Zur kleineren Einheit: mal rechnen.") : tx("To the bigger unit: divide.", "Zur größeren Einheit: teilen."),
      },
      {
        math: say((f) => `${f.n(from)}#v ${q(fromU)}#u =#e ${f.n(right)}#w ${q(toU)}#t`),
        note: tx(
          `The comma moves ${String(Math.log10(F))} places to the ${down ? "right" : "left"}.`,
          `Das Komma rückt ${String(Math.log10(F))} Stellen nach ${down ? "rechts" : "links"}.`,
        ),
      },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Composite shapes made of rectangles

const COMPOSITE = tx("Find the area of the shape", "Berechne den Flächeninhalt der Figur");

function perimeterOf(pts: P[]) {
  return pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0);
}

type Composite = { pts: P[]; labels: SideLabel[]; split?: [P, P][]; ghost?: P[]; A: number; box: number; frames: Frame[]; extra: { value: number; title: Text; say: Text }[]; hint: Text };

function lShape(W: number, H: number, w: number, h: number, unit: string): Composite {
  const pts: P[] = [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]];
  const A1 = W * (H - h);
  const A2 = (W - w) * h;
  const u = q(`${unit}²`);
  return {
    pts,
    labels: [
      { i: 0, text: `${W} ${unit}` },
      { i: 1, text: `${H - h} ${unit}` },
      { i: 4, text: `${W - w} ${unit}` },
      { i: 5, text: `${H} ${unit}` },
    ],
    split: [[[0, H - h], [W - w, H - h]]],
    A: A1 + A2,
    box: W * H,
    hint: tx("Split the shape into two rectangles along the dashed line. You get a missing side by subtracting.", "Zerleg die Figur entlang der gestrichelten Linie in zwei Rechtecke. Eine fehlende Seite bekommst du durch Subtrahieren."),
    frames: [
      { math: "A#A =#e A_1#a1 +#p A_2#a2", note: tx("Split along the dashed line: a rectangle at the bottom and one on top.", "Zerleg entlang der gestrichelten Linie: ein Rechteck unten und eins oben.") },
      { math: `A#A =#e ${W}#w \\cdot#m1 ${H - h}#h1 +#p ${W - w}#w2 \\cdot#m2 ${h}#h2`, note: tx(`Bottom: $${W} \\cdot ${H - h}$. The top part is $${H} - ${H - h} = ${h}$ high.`, `Unten: $${W} \\cdot ${H - h}$. Das obere Teil ist $${H} - ${H - h} = ${h}$ hoch.`) },
      { math: `A#A =#e ${A1}#a1 +#p ${A2}#a2`, note: tx("Work out both rectangles.", "Rechne beide Rechtecke aus.") },
      { math: `A#A =#e ${A1 + A2}#a1 ${u}#u`, note: tx(`Check the other way: $${W} \\cdot ${H} - ${w} \\cdot ${h} = ${W * H - w * h}$. Same!`, `Probe andersherum: $${W} \\cdot ${H} - ${w} \\cdot ${h} = ${W * H - w * h}$. Gleich!`) },
    ],
    extra: [
      { value: A1 + (W - w) * H, title: tx("A piece counted twice", "Ein Stück doppelt gezählt"), say: tx(`Your two rectangles overlap. The top part is only $${H} - ${H - h} = ${h}$ high, not ${H}.`, `Deine beiden Rechtecke überlappen sich. Das obere Teil ist nur $${H} - ${H - h} = ${h}$ hoch, nicht ${H}.`) },
    ],
  };
}

function uShape(W: number, H: number, p: number, s: number, d: number, unit: string): Composite {
  const qq = W - p - s;
  const pts: P[] = [[0, 0], [W, 0], [W, H], [W - qq, H], [W - qq, H - d], [p, H - d], [p, H], [0, H]];
  const u = q(`${unit}²`);
  return {
    pts,
    labels: [
      { i: 0, text: `${W} ${unit}` },
      { i: 7, text: `${H} ${unit}` },
      { i: 4, text: `${s} ${unit}` },
      { i: 3, text: `${d} ${unit}` },
    ],
    ghost: [[p, H - d], [W - qq, H - d], [W - qq, H], [p, H]],
    A: W * H - s * d,
    box: W * H,
    hint: tx("Think of the whole rectangle and take away the gap.", "Denk dir das ganze Rechteck und zieh die Lücke ab."),
    frames: [
      { math: "A#A =#e A_1#a1 -#p A_2#a2", note: tx("Easiest: the big rectangle minus the missing piece (dashed).", "Am einfachsten: großes Rechteck minus das fehlende Stück (gestrichelt).") },
      { math: `A#A =#e ${W}#w \\cdot#m1 ${H}#h1 -#p ${s}#w2 \\cdot#m2 ${d}#h2`, note: tx(`Big rectangle $${W} \\cdot ${H}$, gap $${s} \\cdot ${d}$.`, `Großes Rechteck $${W} \\cdot ${H}$, Lücke $${s} \\cdot ${d}$.`) },
      { math: `A#A =#e ${W * H}#a1 -#p ${s * d}#a2`, note: tx("Work out both.", "Rechne beides aus.") },
      { math: `A#A =#e ${W * H - s * d}#a1 ${u}#u`, note: tx("Done!", "Fertig!") },
    ],
    extra: [{ value: W * H + s * d, title: tx("Added the gap", "Lücke addiert"), say: tx("The gap is missing from the shape, so **subtract** it.", "Die Lücke fehlt in der Figur, also **ziehst** du sie **ab**.") }],
  };
}

function tShape(W: number, t: number, s: number, stem: number, unit: string): Composite {
  const p = (W - s) / 2;
  const H = t + stem;
  const pts: P[] = [[p, 0], [p + s, 0], [p + s, stem], [W, stem], [W, H], [0, H], [0, stem], [p, stem]];
  const u = q(`${unit}²`);
  return {
    pts,
    labels: [
      { i: 0, text: `${s} ${unit}` },
      { i: 1, text: `${stem} ${unit}` },
      { i: 4, text: `${W} ${unit}` },
      { i: 5, text: `${t} ${unit}` },
    ],
    split: [[[p, stem], [p + s, stem]]],
    A: W * t + s * stem,
    box: W * H,
    hint: tx("Split it into the bar on top and the stem below.", "Zerleg die Figur in den Balken oben und den Fuß unten."),
    frames: [
      { math: "A#A =#e A_1#a1 +#p A_2#a2", note: tx("The bar on top plus the stem below.", "Der Balken oben plus der Fuß unten.") },
      { math: `A#A =#e ${W}#w \\cdot#m1 ${t}#h1 +#p ${s}#w2 \\cdot#m2 ${stem}#h2`, note: tx(`Bar: $${W} \\cdot ${t}$. Stem: $${s} \\cdot ${stem}$.`, `Balken: $${W} \\cdot ${t}$. Fuß: $${s} \\cdot ${stem}$.`) },
      { math: `A#A =#e ${W * t}#a1 +#p ${s * stem}#a2`, note: tx("Work out both rectangles.", "Rechne beide Rechtecke aus.") },
      { math: `A#A =#e ${W * t + s * stem}#a1 ${u}#u`, note: tx("Done!", "Fertig!") },
    ],
    extra: [{ value: W * t + s * H, title: tx("Stem too long", "Fuß zu lang"), say: tx(`The stem is only $${stem}$ high. If you take the full height $${H}$, the bar is counted twice.`, `Der Fuß ist nur $${stem}$ hoch. Nimmst du die ganze Höhe $${H}$, zählst du den Balken doppelt.`) }],
  };
}

function compositeMistakes(c: Composite, unit: string): Mistake[] {
  const m = mistakeList(exact(c.A, `${unit}²`, "A ="));
  m.add(c.box, tx("The whole rectangle", "Das ganze Rechteck"), tx("You worked out the whole rectangle around it. But a piece is missing: take it away, or split the shape into rectangles.", "Du hast das ganze umgebende Rechteck berechnet. Aber ein Stück fehlt: Zieh es ab oder zerleg die Figur in Rechtecke."));
  for (const e of c.extra) m.add(e.value, e.title, e.say);
  m.add(perimeterOf(c.pts), tx("Perimeter instead of area", "Umfang statt Fläche"), tx("That's the length of the edge, the perimeter. The area is the inside: split into rectangles and multiply.", "Das ist die Länge des Randes, also der Umfang. Die Fläche ist das Innere: zerlegen und malnehmen."));
  return m.list;
}

function compositeTask(rng: Rng): Exercise {
  const unit = rng.pick(["m", "cm"]);
  const kind = rng.int(0, 2);
  let c: Composite;
  if (kind === 0) {
    const W = rng.int(6, 12);
    const H = rng.int(5, 10);
    c = lShape(W, H, rng.int(2, W - 2), rng.int(2, H - 2), unit);
  } else if (kind === 1) {
    const W = rng.int(8, 14);
    const H = rng.int(5, 9);
    const s = rng.int(2, W - 4);
    const p = rng.int(2, W - s - 2);
    c = uShape(W, H, p, s, rng.int(2, H - 2), unit);
  } else {
    const s = rng.int(1, 4) * 2;
    const W = s + 2 * rng.int(2, 4);
    c = tShape(W, rng.int(2, 4), s, rng.int(3, 8), unit);
  }
  return {
    instruction: COMPOSITE,
    visual: figure({ kind: "poly", pts: c.pts, labels: c.labels, split: c.split, ghost: c.ghost }),
    answer: exact(c.A, `${unit}²`, "A ="),
    hint: c.hint,
    solution: c.frames,
    mistakes: compositeMistakes(c, unit),
  };
}

// ---------------------------------------------------------------------------
// Cuboid: volume and surface area

const VOLUME = tx("Find the volume", "Berechne das Volumen");
const SURFACE = tx("Find the surface area", "Berechne die Oberfläche");

function cuboidFigure(a: number, b: number, c: number, unit: string): FigureSpec {
  return { kind: "cuboid", a, b, c, la: `${a} ${unit}`, lb: `${b} ${unit}`, lc: `${c} ${unit}` };
}

function volumeFrames(a: number, b: number, c: number, unit: string, cube: boolean): Frame[] {
  const u = q(`${unit}³`);
  if (cube)
    return [
      { math: "V#V =#e a#a \\cdot#m1 a#b \\cdot#m2 a#c", note: tx("A cube: length, width and height are all $a$. So $V = a^3$.", "Ein Würfel: Länge, Breite und Höhe sind alle $a$. Also $V = a^3$.") },
      { math: `V#V =#e ${a}#a \\cdot#m1 ${a}#b \\cdot#m2 ${a}#c`, note: tx("Put in the edge length.", "Setz die Kantenlänge ein.") },
      { math: `V#V =#e ${a * a}#a \\cdot#m2 ${a}#c`, note: tx(`One layer: $${a} \\cdot ${a} = ${a * a}$ cubes.`, `Eine Schicht: $${a} \\cdot ${a} = ${a * a}$ Würfel.`) },
      { math: `V#V =#e ${a ** 3}#a ${u}#u`, note: tx(`${a} layers: $${a * a} \\cdot ${a} = ${a ** 3}$.`, `${a} Schichten: $${a * a} \\cdot ${a} = ${a ** 3}$.`) },
    ];
  return [
    { math: "V#V =#e a#a \\cdot#m1 b#b \\cdot#m2 c#c", note: tx("Volume of a cuboid: length times width times height.", "Volumen eines Quaders: Länge mal Breite mal Höhe.") },
    { math: `V#V =#e ${a}#a \\cdot#m1 ${b}#b \\cdot#m2 ${c}#c`, note: tx("Put in the three edges.", "Setz die drei Kanten ein.") },
    { math: `V#V =#e ${a * b}#a \\cdot#m2 ${c}#c`, note: tx(`One layer at the bottom: $${a} \\cdot ${b} = ${a * b}$ unit cubes.`, `Eine Schicht am Boden: $${a} \\cdot ${b} = ${a * b}$ Einheitswürfel.`) },
    { math: `V#V =#e ${a * b * c}#a ${u}#u`, note: tx(`${c} layers: $${a * b} \\cdot ${c} = ${a * b * c}$. Volume has cubic units: ${unit}³.`, `${c} Schichten: $${a * b} \\cdot ${c} = ${a * b * c}$. Volumen hat Kubikeinheiten: ${unit}³.`) },
  ];
}

function volumeMistakes(a: number, b: number, c: number, right: number, unit: string, cube: boolean): Mistake[] {
  const m = mistakeList(exact(right, unit, "V ="));
  const scale = right / (a * b * c);
  m.add((a + b + c) * scale, tx("Added the edges", "Kanten addiert"), tx("You added the edges. Volume counts cubes: length **times** width **times** height.", "Du hast die Kanten addiert. Das Volumen zählt Würfel: Länge **mal** Breite **mal** Höhe."));
  if (cube) {
    m.add(a * a * scale, tx("Only one layer", "Nur eine Schicht"), tx("$a \\cdot a$ is only the bottom layer. Stack $a$ layers: $V = a \\cdot a \\cdot a$.", "$a \\cdot a$ ist nur die unterste Schicht. Staple $a$ Schichten: $V = a \\cdot a \\cdot a$."));
    m.add(3 * a * scale, tx("$a^3$ is not $3 \\cdot a$", "$a^3$ ist nicht $3 \\cdot a$"), tx("Cubed means $a \\cdot a \\cdot a$, not $3 \\cdot a$.", "Hoch 3 heißt $a \\cdot a \\cdot a$, nicht $3 \\cdot a$."));
    m.add(6 * a * a * scale, tx("Surface instead of volume", "Oberfläche statt Volumen"), tx("$6 \\cdot a^2$ is the surface area, the six faces. The volume is the space inside: $a^3$.", "$6 \\cdot a^2$ ist die Oberfläche, die sechs Flächen. Das Volumen ist der Raum innen: $a^3$."));
  } else {
    m.add(a * b * scale, tx("Only one layer", "Nur eine Schicht"), tx(`$${a} \\cdot ${b}$ is only the bottom layer. There are ${c} layers on top of each other.`, `$${a} \\cdot ${b}$ ist nur die unterste Schicht. Es liegen ${c} Schichten übereinander.`));
    m.add(2 * (a * b + a * c + b * c) * scale, tx("Surface instead of volume", "Oberfläche statt Volumen"), tx("That's the surface area, the six faces. The volume is the space inside: $a \\cdot b \\cdot c$.", "Das ist die Oberfläche, die sechs Flächen. Das Volumen ist der Raum innen: $a \\cdot b \\cdot c$."));
  }
  return m.list;
}

function volumeTask(rng: Rng): Exercise {
  const kind = rng.pick(["cuboid", "cuboid", "cube", "litres", "dm"] as const);
  if (kind === "litres") {
    const a = rng.int(3, 8) * 10;
    const b = rng.int(2, 5) * 10;
    const c = rng.int(2, 5) * 10;
    const V = a * b * c;
    const L = V / 1000;
    const m = mistakeList(exact(L, "l", "V ="));
    m.add(V, tx("Still in cm³", "Noch in cm³"), tx(`That's the volume in cm³. Now convert: $1000 "cm³" = 1 "l"$.`, `Das ist das Volumen in cm³. Jetzt noch umrechnen: $1000 "cm³" = 1 "l"$.`), true);
    m.add(V / 100, tx("Factor 100 instead of 1000", "Faktor 100 statt 1000"), tx('Volume units go in steps of **1000**: $1 "l" = 1 "dm³" = 1000 "cm³"$.', 'Volumeneinheiten gehen in **1000er**-Schritten: $1 "l" = 1 "dm³" = 1000 "cm³"$.'));
    m.add(V / 10, tx("Factor 10 instead of 1000", "Faktor 10 statt 1000"), tx('Volume units go in steps of **1000**: $1 "l" = 1000 "cm³"$.', 'Volumeneinheiten gehen in **1000er**-Schritten: $1 "l" = 1000 "cm³"$.'));
    m.add(a + b + c, tx("Added the edges", "Kanten addiert"), tx("For volume, multiply: length times width times height.", "Beim Volumen wird multipliziert: Länge mal Breite mal Höhe."));
    const what = rng.pick([tx("A fish tank", "Ein Aquarium"), tx("A water tank", "Ein Wassertank"), tx("A box-shaped planter", "Ein Pflanzkasten")]);
    return {
      instruction: VOLUME,
      text: tx(`${E(what)} is ${a} cm long, ${b} cm wide and ${c} cm high. How many litres fit into it?`, `${D(what)} ist ${a} cm lang, ${b} cm breit und ${c} cm hoch. Wie viele Liter passen hinein?`),
      visual: figure(cuboidFigure(a, b, c, "cm")),
      answer: exact(L, "l", "V ="),
      hint: tx('Work out the volume in cm³ first. Then: $1000 "cm³" = 1 "l"$.', 'Rechne zuerst das Volumen in cm³ aus. Dann gilt: $1000 "cm³" = 1 "l"$.'),
      solution: [
        ...volumeFrames(a, b, c, "cm", false).slice(1),
        { math: say((f) => `V#V =#e ${f.n(V)}#a "cm³"#u =#e2 ${f.n(L)}#l "l"#lu`), note: tx(`$1000 "cm³" = 1 "l"$, so divide by 1000.`, `$1000 "cm³" = 1 "l"$, also durch 1000 teilen.`) },
      ],
      mistakes: m.list,
    };
  }
  if (kind === "dm") {
    const a = rng.int(2, 9);
    const b = rng.int(2, 6);
    const c = rng.int(2, 6);
    return {
      instruction: VOLUME,
      text: tx(`A box is $${a} "dm"$ long, $${b} "dm"$ wide and $${c} "dm"$ high. How many litres does it hold?`, `Eine Kiste ist $${a} "dm"$ lang, $${b} "dm"$ breit und $${c} "dm"$ hoch. Wie viele Liter passen hinein?`),
      answer: exact(a * b * c, "l", "V ="),
      hint: tx('$1 "dm³" = 1 "l"$.', '$1 "dm³" = 1 "l"$.'),
      solution: [...volumeFrames(a, b, c, "dm", false), { math: `V#V =#e ${a * b * c}#a "l"#u`, note: tx('And $1 "dm³" = 1 "l"$: the number stays the same.', 'Und $1 "dm³" = 1 "l"$: Die Zahl bleibt gleich.') }],
      mistakes: volumeMistakes(a, b, c, a * b * c, "l", false),
    };
  }
  const unit = rng.pick(["cm", "m", "cm", "mm", "dm"]);
  if (kind === "cube") {
    const a = rng.int(2, 10);
    return {
      instruction: VOLUME,
      text: tx(`A cube with edge length $a = ${a} ${q(unit)}$.`, `Ein Würfel mit der Kantenlänge $a = ${a} ${q(unit)}$.`),
      visual: figure({ kind: "cuboid", a, b: a, c: a, la: `${a} ${unit}` }),
      answer: exact(a ** 3, `${unit}³`, "V ="),
      hint: tx("A cube: $V = a \\cdot a \\cdot a$.", "Ein Würfel: $V = a \\cdot a \\cdot a$."),
      solution: volumeFrames(a, a, a, unit, true),
      mistakes: volumeMistakes(a, a, a, a ** 3, `${unit}³`, true),
    };
  }
  const a = rng.int(3, 12);
  const b = rng.int(2, 8);
  const c = rng.int(2, 9);
  return {
    instruction: VOLUME,
    text: tx(`A cuboid with $a = ${a} ${q(unit)}$, $b = ${b} ${q(unit)}$ and $c = ${c} ${q(unit)}$.`, `Ein Quader mit $a = ${a} ${q(unit)}$, $b = ${b} ${q(unit)}$ und $c = ${c} ${q(unit)}$.`),
    visual: figure(cuboidFigure(a, b, c, unit)),
    answer: exact(a * b * c, `${unit}³`, "V ="),
    hint: tx("Length times width times height.", "Länge mal Breite mal Höhe."),
    solution: volumeFrames(a, b, c, unit, false),
    mistakes: volumeMistakes(a, b, c, a * b * c, `${unit}³`, false),
  };
}

function surfaceFrames(a: number, b: number, c: number, unit: string, cube: boolean): Frame[] {
  const u = q(`${unit}²`);
  if (cube)
    return [
      { math: "O#O =#e 6#k \\cdot#m a#a^{2#e}", note: tx("A cube has 6 faces, all squares with area $a^2$.", "Ein Würfel hat 6 Flächen, alles Quadrate mit $a^2$.") },
      { math: `O#O =#e 6#k \\cdot#m ${a}#a^{2#e}`, note: tx("Put in the edge length.", "Setz die Kantenlänge ein.") },
      { math: `O#O =#e 6#k \\cdot#m ${a * a}#a`, note: tx(`One face: $${a} \\cdot ${a} = ${a * a}$.`, `Eine Fläche: $${a} \\cdot ${a} = ${a * a}$.`) },
      { math: `O#O =#e ${6 * a * a}#k ${u}#u`, note: tx("Six faces together. Done!", "Sechs Flächen zusammen. Fertig!") },
    ];
  return [
    { math: "O#O =#e 2#k \\cdot#m (a#a \\cdot#m1 b#b +#p1 a#a2 \\cdot#m2 c#c +#p2 b#b2 \\cdot#m3 c#c2)#br", note: tx("The net has 6 rectangles, always 2 the same: top and bottom, front and back, left and right.", "Das Netz hat 6 Rechtecke, immer 2 gleiche: oben und unten, vorne und hinten, links und rechts.") },
    { math: `O#O =#e 2#k \\cdot#m (${a}#a \\cdot#m1 ${b}#b +#p1 ${a}#a2 \\cdot#m2 ${c}#c +#p2 ${b}#b2 \\cdot#m3 ${c}#c2)#br`, note: tx("Put in the edges.", "Setz die Kanten ein.") },
    { math: `O#O =#e 2#k \\cdot#m (${a * b}#a +#p1 ${a * c}#a2 +#p2 ${b * c}#b2)#br`, note: tx("The three different faces.", "Die drei verschiedenen Flächen.") },
    { math: `O#O =#e 2#k \\cdot#m ${a * b + a * c + b * c}#a`, note: tx("Add them up.", "Zusammenzählen.") },
    { math: `O#O =#e ${2 * (a * b + a * c + b * c)}#a ${u}#u`, note: tx("Times 2, because each face is there twice. Done!", "Mal 2, weil jede Fläche zweimal vorkommt. Fertig!") },
  ];
}

function surfaceTask(rng: Rng): Exercise {
  const cube = rng.chance(0.3);
  const unit = rng.pick(["cm", "m", "dm", "cm"]);
  const a = cube ? rng.int(2, 12) : rng.int(3, 10);
  const b = cube ? a : rng.int(2, 8);
  const c = cube ? a : rng.int(2, 9);
  const O = 2 * (a * b + a * c + b * c);
  const m = mistakeList(exact(O, `${unit}²`, "O ="));
  if (cube) {
    m.add(a * a, tx("Only one face", "Nur eine Fläche"), tx("That's just one face. A cube has **six** of them.", "Das ist nur eine Fläche. Ein Würfel hat **sechs** davon."));
    m.add(4 * a * a, tx("Top and bottom missing", "Deckel und Boden fehlen"), tx("You counted the four sides. Top and bottom belong to the surface too: 6 faces.", "Du hast die vier Seiten gezählt. Deckel und Boden gehören auch zur Oberfläche: 6 Flächen."));
    m.add(a ** 3, tx("Volume instead of surface", "Volumen statt Oberfläche"), tx("$a^3$ is the volume. The surface area is the six square faces: $6 \\cdot a^2$.", "$a^3$ ist das Volumen. Die Oberfläche sind die sechs Quadrate: $6 \\cdot a^2$."));
  } else {
    m.add(a * b + a * c + b * c, tx("Only three faces", "Nur drei Flächen"), tx("Nearly! Each face appears **twice** (top and bottom, front and back, left and right). Times 2!", "Fast! Jede Fläche kommt **zweimal** vor (oben und unten, vorne und hinten, links und rechts). Mal 2!"), true);
    m.add(a * b * c, tx("Volume instead of surface", "Volumen statt Oberfläche"), tx("$a \\cdot b \\cdot c$ is the volume. The surface area is the six faces of the net added up.", "$a \\cdot b \\cdot c$ ist das Volumen. Die Oberfläche sind die sechs Flächen des Netzes zusammen."));
    m.add(2 * (a * b + a * c), tx("One pair missing", "Ein Flächenpaar fehlt"), tx("Two of the six faces are missing: the left and right faces ($b \\cdot c$).", "Zwei der sechs Flächen fehlen: links und rechts ($b \\cdot c$)."));
  }
  const gift = !cube && rng.chance(0.3) && unit === "cm";
  return {
    instruction: SURFACE,
    text: gift
      ? tx(`A present is wrapped in a box ${a} cm long, ${b} cm wide and ${c} cm high. How much paper covers it exactly (no overlap)?`, `Ein Geschenk steckt in einem Karton, ${a} cm lang, ${b} cm breit und ${c} cm hoch. Wie viel Papier bedeckt ihn genau (ohne Überlappung)?`)
      : cube
        ? tx(`A cube with edge length $a = ${a} ${q(unit)}$.`, `Ein Würfel mit der Kantenlänge $a = ${a} ${q(unit)}$.`)
        : tx(`A cuboid with $a = ${a} ${q(unit)}$, $b = ${b} ${q(unit)}$ and $c = ${c} ${q(unit)}$.`, `Ein Quader mit $a = ${a} ${q(unit)}$, $b = ${b} ${q(unit)}$ und $c = ${c} ${q(unit)}$.`),
    visual: figure(cube ? { kind: "cuboid", a, b: a, c: a, la: `${a} ${unit}` } : cuboidFigure(a, b, c, unit)),
    answer: exact(O, `${unit}²`, "O ="),
    hint: cube ? tx("Six squares of the same size.", "Sechs gleich große Quadrate.") : tx("Six rectangles, always two the same: $O = 2 \\cdot (ab + ac + bc)$.", "Sechs Rechtecke, immer zwei gleiche: $O = 2 \\cdot (ab + ac + bc)$."),
    solution: surfaceFrames(a, b, c, unit, cube),
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Which unit fits?

type Kind = "len" | "area" | "vol";
const UNIT_INFO: Record<string, { kind: Kind; size: number }> = {
  mm: { kind: "len", size: 0.001 }, cm: { kind: "len", size: 0.01 }, dm: { kind: "len", size: 0.1 }, m: { kind: "len", size: 1 }, km: { kind: "len", size: 1000 },
  "mm²": { kind: "area", size: 1e-6 }, "cm²": { kind: "area", size: 1e-4 }, "dm²": { kind: "area", size: 0.01 }, "m²": { kind: "area", size: 1 },
  a: { kind: "area", size: 100 }, ha: { kind: "area", size: 1e4 }, "km²": { kind: "area", size: 1e6 },
  "mm³": { kind: "vol", size: 1e-6 }, ml: { kind: "vol", size: 0.001 }, "cm³": { kind: "vol", size: 0.001 }, l: { kind: "vol", size: 1 }, "dm³": { kind: "vol", size: 1 }, "m³": { kind: "vol", size: 1000 },
};

type Thing = { text: Text; value: string; right: string; wrong: string[]; why: Text };
const THINGS: Thing[] = [
  { text: tx("A classroom floor is about {v}.", "Der Boden eines Klassenzimmers ist etwa {v} groß."), value: "60", right: "m²", wrong: ["cm²", "km²", "m", "m³", "ha"], why: tx('About 10 m long and 6 m wide: $10 \\cdot 6 = 60 "m²"$.', 'Etwa 10 m lang und 6 m breit: $10 \\cdot 6 = 60 "m²"$.') },
  { text: tx("A stamp has an area of about {v}.", "Eine Briefmarke hat eine Fläche von etwa {v}."), value: "6", right: "cm²", wrong: ["m²", "km²", "cm", "cm³", "dm²"], why: tx('About 3 cm by 2 cm: $6 "cm²"$.', 'Etwa 3 cm mal 2 cm: $6 "cm²"$.') },
  { text: tx("Lake Constance has an area of about {v}.", "Der Bodensee hat eine Fläche von etwa {v}."), value: "536", right: "km²", wrong: ["m²", "cm²", "km", "m³", "a"], why: tx("A big lake: it's measured in square kilometres.", "Ein großer See: Den misst man in Quadratkilometern.") },
  { text: tx("A football pitch covers about {v}.", "Ein Fußballfeld ist etwa {v} groß."), value: "70", right: "a", wrong: ["m²", "cm²", "km²", "m", "mm²"], why: tx(`About 105 m by 68 m, that's about $7000 "m²" = 70 "a"$.`, 'Etwa 105 m mal 68 m, das sind etwa $7000 "m²" = 70 "a"$.') },
  { text: tx("A farmer's field covers {v}.", "Ein Acker ist {v} groß."), value: "12", right: "ha", wrong: ["m²", "cm²", "dm²", "m³", "mm²"], why: tx('Fields are measured in hectares: $1 "ha"$ is a square with 100 m sides.', 'Äcker misst man in Hektar: $1 "ha"$ ist ein Quadrat mit 100 m Seitenlänge.') },
  { text: tx("A phone screen has an area of about {v}.", "Ein Handydisplay hat eine Fläche von etwa {v}."), value: "90", right: "cm²", wrong: ["m²", "km²", "mm", "dm³", "ha"], why: tx('About 15 cm by 6 cm: $90 "cm²"$.', 'Etwa 15 cm mal 6 cm: $90 "cm²"$.') },
  { text: tx("A pinhead has an area of about {v}.", "Ein Stecknadelkopf hat eine Fläche von etwa {v}."), value: "2", right: "mm²", wrong: ["cm²", "m²", "dm²", "mm", "mm³"], why: tx("Tiny: a few square millimetres.", "Winzig: ein paar Quadratmillimeter.") },
  { text: tx("A bathtub holds about {v}.", "Eine Badewanne fasst etwa {v}."), value: "150", right: "l", wrong: ["ml", "m³", "cm²", "cm³", "mm³"], why: tx("Bathtubs hold about 150 litres of water.", "Eine Badewanne fasst etwa 150 Liter Wasser.") },
  { text: tx("A drinking glass holds about {v}.", "Ein Trinkglas fasst etwa {v}."), value: "200", right: "ml", wrong: ["l", "m³", "cm²", "dm³", "m"], why: tx("A glass holds a fifth of a litre: 200 ml.", "Ein Glas fasst ein Fünftel Liter: 200 ml.") },
  { text: tx("A swimming pool holds about {v}.", "Ein Schwimmbecken fasst etwa {v}."), value: "600", right: "m³", wrong: ["l", "ml", "cm³", "m²", "dm³"], why: tx('25 m long, 12 m wide and 2 m deep: $600 "m³"$.', '25 m lang, 12 m breit und 2 m tief: $600 "m³"$.') },
  { text: tx("A sugar cube has a volume of about {v}.", "Ein Würfelzucker hat ein Volumen von etwa {v}."), value: "2", right: "cm³", wrong: ["m³", "l", "cm²", "dm³", "km"], why: tx("Its edges are a bit more than 1 cm long.", "Seine Kanten sind etwas länger als 1 cm.") },
  { text: tx("A classroom holds about {v} of air.", "In einem Klassenzimmer sind etwa {v} Luft."), value: "180", right: "m³", wrong: ["l", "cm³", "m²", "ml", "mm³"], why: tx('10 m by 6 m by 3 m: $180 "m³"$.', '10 m mal 6 m mal 3 m: $180 "m³"$.') },
];

function unitTask(rng: Rng): Exercise {
  const th = rng.pick(THINGS);
  const wrong = rng.shuffle(th.wrong).slice(0, 3);
  const r = UNIT_INFO[th.right];
  const opts: Opt[] = [{ text: th.right }];
  for (const w of wrong) {
    const info = UNIT_INFO[w];
    let title: Text;
    let sayText: Text;
    if (info.kind === "len") {
      title = tx("That's a length", "Das ist eine Länge");
      sayText =
        r.kind === "area"
          ? tx(`$"${w}"$ measures a **length**. An area needs square units like $"m²"$.`, `$"${w}"$ misst eine **Länge**. Für eine Fläche brauchst du Quadrateinheiten wie $"m²"$.`)
          : tx(`$"${w}"$ measures a **length**. A volume needs cubic units or litres.`, `$"${w}"$ misst eine **Länge**. Für ein Volumen brauchst du Kubikeinheiten oder Liter.`);
    } else if (info.kind !== r.kind) {
      title = info.kind === "vol" ? tx("That's a volume", "Das ist ein Volumen") : tx("That's an area", "Das ist eine Fläche");
      sayText =
        info.kind === "vol"
          ? tx("Cubed units (and litres) measure **volume**. An area has squared units.", "Kubikeinheiten (und Liter) messen ein **Volumen**. Eine Fläche hat Quadrateinheiten.")
          : tx("Squared units measure an **area**. For how much fits inside, you need cubed units or litres.", "Quadrateinheiten messen eine **Fläche**. Für das, was hineinpasst, brauchst du Kubikeinheiten oder Liter.");
    } else {
      const small = info.size < r.size;
      title = small ? tx("Much too small", "Viel zu klein") : tx("Much too big", "Viel zu groß");
      sayText = small
        ? tx(`Right kind of unit, but ${th.value} ${w} would be tiny. Picture how big it really is.`, `Die Art der Einheit stimmt, aber ${th.value} ${w} wären winzig. Stell dir vor, wie groß es wirklich ist.`)
        : tx(`Right kind of unit, but ${th.value} ${w} would be huge. Picture how big it really is.`, `Die Art der Einheit stimmt, aber ${th.value} ${w} wären riesig. Stell dir vor, wie groß es wirklich ist.`);
    }
    opts.push({ text: w, title, say: sayText });
  }
  const c = choice(rng, opts);
  return {
    instruction: tx("Which unit fits?", "Welche Einheit passt?"),
    text: tx(E(th.text).replace("{v}", `${th.value} ___`), D(th.text).replace("{v}", `${th.value} ___`)),
    answer: c.answer,
    hint: r.kind === "area" ? tx("An area needs a squared unit. Then think about the size.", "Eine Fläche braucht eine Quadrateinheit. Dann überleg die Größe.") : tx("A volume needs a cubed unit or litres. Then think about the size.", "Ein Volumen braucht eine Kubikeinheit oder Liter. Dann überleg die Größe."),
    solution: [{ math: `${th.value} ${q(th.right)}`, note: th.why }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [14, () => perimeterTask(rng)],
    [16, () => areaTask(rng)],
    [12, () => missingTask(rng)],
    [18, () => convertTask(rng)],
    [12, () => compositeTask(rng)],
    [14, () => volumeTask(rng)],
    [10, () => surfaceTask(rng)],
    [8, () => unitTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const L_SHAPE = lShape(8, 6, 4, 3, "m");
const CHECK_L = lShape(7, 8, 4, 5, "m");

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Perimeter and area", "Umfang und Flächeninhalt"),
      blob: tx("Two questions for every rectangle: how long is its edge, and how much fits inside?", "Zwei Fragen an jedes Rechteck: Wie lang ist sein Rand und wie viel passt hinein?"),
      body: tx(
        'The **perimeter** $u$ is the length of the edge: once all the way round. The **area** $A$ tells you how many unit squares fit inside. Here every square is $1 "cm²"$: a square with $1 "cm"$ sides.',
        'Der **Umfang** $u$ ist die Länge des Randes: einmal ganz herum. Der **Flächeninhalt** $A$ sagt, wie viele Einheitsquadrate hineinpassen. Hier ist jedes Kästchen $1 "cm²"$ groß: ein Quadrat mit $1 "cm"$ Seitenlänge.',
      ),
      visual: figure({ kind: "rect", a: 5, b: 3, la: "a = 5 cm", lb: "b = 3 cm", grid: true }, tx("Rectangle 5 cm by 3 cm on squared paper", "Rechteck 5 cm mal 3 cm auf Kästchenpapier")),
      frames: [
        { math: "u#u =#e 5#a1 +#p1 3#b1 +#p2 5#a2 +#p3 3#b2", note: tx("Perimeter: walk once round the rectangle and add all four sides.", "Umfang: Geh einmal um das Rechteck herum und addiere alle vier Seiten.") },
        { math: "u#u =#e 2#k1 \\cdot#m1 5#a1 +#p1 2#k2 \\cdot#m2 3#b1", note: tx("Opposite sides are equally long: $u = 2 \\cdot a + 2 \\cdot b$.", "Gegenüberliegende Seiten sind gleich lang: $u = 2 \\cdot a + 2 \\cdot b$.") },
        { math: 'u#u =#e 16#a1 "cm"#cm', note: tx("$10 + 6 = 16$. A perimeter is a length, so it's in cm.", "$10 + 6 = 16$. Der Umfang ist eine Länge, also in cm.") },
        { math: "A#A =#e 5#a1 \\cdot#m1 3#b1", note: tx("Area: 3 rows of 5 squares. So length times width: $A = a \\cdot b$.", "Flächeninhalt: 3 Reihen mit je 5 Kästchen. Also Länge mal Breite: $A = a \\cdot b$.") },
        { math: 'A#A =#e 15#a1 "cm²"#cm', note: tx('15 squares of $1 "cm²"$. Areas are measured in square units: $"cm"$ times $"cm"$ gives $"cm²"$.', '15 Kästchen mit je $1 "cm²"$. Flächen misst man in Quadrateinheiten: $"cm"$ mal $"cm"$ ergibt $"cm²"$.') },
        { math: "A#A =#e a#a1 \\cdot#m1 a#b1 =#e2 a#a3^{2#sq}", note: tx("For a **square** all sides are equal: $A = a \\cdot a = a^2$ and $u = 4 \\cdot a$.", "Beim **Quadrat** sind alle Seiten gleich: $A = a \\cdot a = a^2$ und $u = 4 \\cdot a$.") },
      ],
    },
    {
      type: "widget",
      title: tx("Rectangle builder", "Rechteck-Baukasten"),
      blob: tx("Same area, different perimeter? Try it out!", "Gleiche Fläche, anderer Umfang? Probier's aus!"),
      body: tx(
        "Drag the corner of the rectangle on squared paper and watch area and perimeter change. Then solve the five building challenges.",
        "Zieh die Ecke des Rechtecks auf dem Kästchenpapier und beobachte, wie sich Fläche und Umfang ändern. Dann löse die fünf Bauaufträge.",
      ),
      widget: AreaVolumeRectangleBuilder,
    },
    {
      type: "check",
      blob: tx("All the way round. Don't forget any side!", "Einmal ganz herum. Vergiss keine Seite!"),
      exercise: {
        instruction: PERIMETER,
        text: tx('A rectangle is $9 "cm"$ long and $4 "cm"$ wide.', 'Ein Rechteck ist $9 "cm"$ lang und $4 "cm"$ breit.'),
        visual: figure(rectFigure(9, 4, "cm")),
        answer: exact(26, "cm", "u ="),
        hint: tx("$u = 2 \\cdot a + 2 \\cdot b$.", "$u = 2 \\cdot a + 2 \\cdot b$."),
        solution: perimeterFrames(9, 4, "cm", false),
        mistakes: perimeterMistakes(9, 4, "cm", false),
      },
    },
    {
      type: "explain",
      title: tx("Area units: the factor is 100", "Flächeneinheiten: Umrechnungszahl 100"),
      blob: tx("Careful, this is where many people slip!", "Vorsicht, hier rutschen viele aus!"),
      body: tx(
        'A square with $1 "cm"$ sides is split into millimetre squares: 10 rows of 10. So the next smaller area unit is always **100 times** as many, not 10.',
        'Ein Quadrat mit $1 "cm"$ Seitenlänge wird in Millimeter-Quadrate zerlegt: 10 Reihen mit je 10. Die nächstkleinere Flächeneinheit passt also immer **100-mal** hinein, nicht 10-mal.',
      ),
      visual: figure({ kind: "unitsq", la: "1 cm", lsmall: "1 mm²" }, tx("1 cm² split into 100 mm²", "1 cm² zerlegt in 100 mm²")),
      frames: [
        { math: '1#a "cm"#u =#e 10#b "mm"#v', note: tx('One side of $1 "cm"$ is $10 "mm"$ long.', 'Eine Seite von $1 "cm"$ ist $10 "mm"$ lang.') },
        { math: '1#a "cm²"#u =#e 10#b "mm"#v \\cdot#m 10#c "mm"#w', note: tx("So the square holds 10 rows of 10 small squares.", "Das Quadrat hat also 10 Reihen mit je 10 kleinen Quadraten.") },
        { math: '1#a "cm²"#u =#e 100#b "mm²"#v', note: tx(`That's why $1 "cm²" = 100 "mm²"$. For areas the factor is **100**.`, 'Darum ist $1 "cm²" = 100 "mm²"$. Bei Flächen ist die Umrechnungszahl **100**.') },
        {
          math: '1 "km²" = 100 "ha" \\\\ 1 "ha" = 100 "a" \\\\ 1 "a" = 100 "m²" \\\\ 1 "m²" = 100 "dm²" \\\\ 1 "dm²" = 100 "cm²"',
          note: tx('Big areas have their own names: **are** (a) and **hectare** (ha). A football pitch is about $70 "a"$.', 'Für große Flächen gibt es eigene Namen: **Ar** (a) und **Hektar** (ha). Ein Fußballfeld ist etwa $70 "a"$ groß.'),
        },
        { math: tx('3.5#a "m²"#u =#e 3.5#b \\cdot#m 100#c "dm²"#v', '3,5#a "m²"#u =#e 3,5#b \\cdot#m 100#c "dm²"#v'), note: tx("To the next smaller unit: multiply by 100.", "Zur nächstkleineren Einheit: mal 100.") },
        { math: tx('3.5#a "m²"#u =#e 350#b "dm²"#v', '3,5#a "m²"#u =#e 350#b "dm²"#v'), note: tx("The comma moves 2 places to the right. The other way round you divide by 100.", "Das Komma rückt 2 Stellen nach rechts. Andersherum teilst du durch 100.") },
      ],
    },
    {
      type: "widget",
      title: tx("The unit table", "Die Einheitentafel"),
      blob: tx("Times 100, divided by 100: watch the comma jump!", "Mal 100, geteilt durch 100: Schau, wie das Komma hüpft!"),
      body: tx(
        "In the place-value table every unit gets two places for areas and three for volumes. The digits stay where they are, only the comma moves. Tap a unit to convert.",
        "In der Stellenwerttafel bekommt jede Einheit zwei Stellen bei Flächen und drei bei Volumen. Die Ziffern bleiben stehen, nur das Komma wandert. Tippe eine Einheit an, um umzurechnen.",
      ),
      widget: AreaVolumeUnitTable,
    },
    {
      type: "check",
      blob: tx("One step down: how many times as many?", "Eine Stufe nach unten: Wie viel mal so viel?"),
      exercise: {
        instruction: CONVERT,
        math: tx('7.5 "m²" = \\box{?} \\, "dm²"', '7,5 "m²" = \\box{?} \\, "dm²"'),
        answer: exact(750, "dm²"),
        hint: tx('$1 "m²" = 100 "dm²"$.', '$1 "m²" = 100 "dm²"$.'),
        solution: [
          { math: '1 "m²" = 100 "dm²"', note: tx("From m² to dm² is one step down: factor 100.", "Von m² zu dm² ist es eine Stufe nach unten: Umrechnungszahl 100.") },
          { math: tx('7.5#v "m²"#u =#e 7.5#w \\cdot#m 100#f "dm²"#t', '7,5#v "m²"#u =#e 7,5#w \\cdot#m 100#f "dm²"#t'), note: tx("To the smaller unit: multiply.", "Zur kleineren Einheit: mal rechnen.") },
          { math: tx('7.5#v "m²"#u =#e 750#w "dm²"#t', '7,5#v "m²"#u =#e 750#w "dm²"#t'), note: tx('The comma moves 2 places to the right: $750 "dm²"$.', 'Das Komma rückt 2 Stellen nach rechts: $750 "dm²"$.') },
        ],
        mistakes: (() => {
          const m = mistakeList(exact(750, "dm²"));
          m.add(75, tx("Factor 10 instead of 100", "Faktor 10 statt 100"), tx("Classic trap! For area units the factor is **100**: a square metre holds $10 \\cdot 10 = 100$ square decimetres.", "Die klassische Falle! Bei Flächeneinheiten ist die Umrechnungszahl **100**: In einen Quadratmeter passen $10 \\cdot 10 = 100$ Quadratdezimeter."));
          m.add(7500, tx("Factor 1000 is for volume", "Faktor 1000 gehört zum Volumen"), tx("1000 is the factor for volume units. Area units go in steps of 100.", "1000 ist die Umrechnungszahl für Volumen. Flächeneinheiten gehen in 100er-Schritten."));
          m.add(0.075, tx("Wrong direction", "Falsche Richtung"), tx("dm² is the **smaller** unit, so the number gets **bigger**. Multiply.", "dm² ist die **kleinere** Einheit, also wird die Zahl **größer**. Mal rechnen."));
          return m.list;
        })(),
      },
    },
    {
      type: "explain",
      title: tx("Shapes made of rectangles", "Zusammengesetzte Flächen"),
      blob: tx("Cut it up or fill it in: both work!", "Zerlegen oder ergänzen: Beides klappt!"),
      body: tx(
        "Split the shape into rectangles and add their areas. Or complete it to a big rectangle and subtract the missing piece. Missing sides you get by subtracting.",
        "Zerleg die Figur in Rechtecke und addiere ihre Flächen. Oder ergänze sie zu einem großen Rechteck und zieh das fehlende Stück ab. Fehlende Seiten bekommst du durch Subtrahieren.",
      ),
      visual: figure({ kind: "poly", pts: L_SHAPE.pts, labels: L_SHAPE.labels, split: L_SHAPE.split }, tx("L-shaped garden", "L-förmiger Garten")),
      frames: [
        ...L_SHAPE.frames.slice(0, 3),
        { math: 'A#A =#e 36#a1 "m²"#u', note: tx('Together: $24 + 12 = 36 "m²"$.', 'Zusammen: $24 + 12 = 36 "m²"$.') },
        { math: 'A#A =#e 8#w \\cdot#m1 6#h1 -#p 4#w2 \\cdot#m2 3#h2 =#e2 36#a1 "m²"#u', note: tx("The other way: the big rectangle $8 \\cdot 6$ minus the missing corner $4 \\cdot 3$. Same result!", "Andersherum: das große Rechteck $8 \\cdot 6$ minus die fehlende Ecke $4 \\cdot 3$. Gleiches Ergebnis!") },
      ],
    },
    {
      type: "check",
      blob: tx("First find the missing sides.", "Such zuerst die fehlenden Seiten."),
      exercise: {
        instruction: COMPOSITE,
        visual: figure({ kind: "poly", pts: CHECK_L.pts, labels: CHECK_L.labels, split: CHECK_L.split }),
        answer: exact(CHECK_L.A, "m²", "A ="),
        hint: CHECK_L.hint,
        solution: CHECK_L.frames,
        mistakes: compositeMistakes(CHECK_L, "m"),
      },
    },
    {
      type: "explain",
      title: tx("The cuboid: volume and surface area", "Der Quader: Volumen und Oberfläche"),
      blob: tx("Now we go 3D: stacking cubes!", "Jetzt wird's räumlich: Würfel stapeln!"),
      body: tx(
        'The **volume** $V$ says how many unit cubes fit inside. A unit cube with $1 "cm"$ edges has the volume $1 "cm³"$. The **surface area** $O$ is all six faces together.',
        'Das **Volumen** $V$ sagt, wie viele Einheitswürfel hineinpassen. Ein Einheitswürfel mit $1 "cm"$ Kantenlänge hat das Volumen $1 "cm³"$. Die **Oberfläche** $O$ sind alle sechs Flächen zusammen.',
      ),
      visual: figure({ kind: "cuboid", a: 4, b: 3, c: 2, la: "a = 4 cm", lb: "b = 3 cm", lc: "c = 2 cm", cubes: true }, tx("Cuboid made of 24 unit cubes", "Quader aus 24 Einheitswürfeln")),
      frames: [
        { math: "V#V =#e 4#a \\cdot#m1 3#b", note: tx('One layer at the bottom: $4 \\cdot 3 = 12$ cubes of $1 "cm³"$.', 'Eine Schicht am Boden: $4 \\cdot 3 = 12$ Würfel mit je $1 "cm³"$.') },
        { math: "V#V =#e 4#a \\cdot#m1 3#b \\cdot#m2 2#c", note: tx("There are 2 layers, so times 2. In general: $V = a \\cdot b \\cdot c$.", "Es gibt 2 Schichten, also mal 2. Allgemein: $V = a \\cdot b \\cdot c$.") },
        { math: 'V#V =#e 24#a "cm³"#u', note: tx('24 unit cubes. Volume has cubic units: $"cm³"$, $"dm³"$, $"m³"$.', '24 Einheitswürfel. Volumen hat Kubikeinheiten: $"cm³"$, $"dm³"$, $"m³"$.') },
        { math: '1#a "dm³"#u =#e 1000#b "cm³"#v =#e2 1#c "l"#w', note: tx('A cube with $1 "dm"$ edges holds $10 \\cdot 10 \\cdot 10 = 1000$ small cubes: for volumes the factor is **1000**. Exactly 1 litre fits inside.', 'In einen Würfel mit $1 "dm"$ Kantenlänge passen $10 \\cdot 10 \\cdot 10 = 1000$ kleine Würfel: Bei Volumen ist die Umrechnungszahl **1000**. Genau 1 Liter passt hinein.') },
        { math: "O#O =#e 2#k \\cdot#m (a#a1 \\cdot#m1 b#b1 +#p1 a#a2 \\cdot#m2 c#c1 +#p2 b#b2 \\cdot#m3 c#c2)#br", note: tx("Surface area: the six faces come in three pairs. Top and bottom, front and back, left and right.", "Oberfläche: Die sechs Flächen kommen in drei Paaren vor. Oben und unten, vorne und hinten, links und rechts.") },
        { math: 'O#O =#e 2#k \\cdot#m (12#a1 +#p1 8#a2 +#p2 6#b2)#br =#e2 52#r "cm²"#u', note: tx('$2 \\cdot 26 = 52 "cm²"$. The surface is an area, so its unit is $"cm²"$.', '$2 \\cdot 26 = 52 "cm²"$. Die Oberfläche ist eine Fläche, also in $"cm²"$.') },
      ],
    },
    {
      type: "widget",
      title: tx("Cuboid from cubes, and its net", "Quader aus Würfeln und sein Netz"),
      blob: tx("A cuboid has 6 faces, but only 3 different ones!", "Ein Quader hat 6 Flächen, aber nur 3 verschiedene!"),
      body: tx(
        "Set length, width and height. On the left you count the volume in unit cubes, on the right you see the net: six rectangles, always two the same. Tap a pair of faces to find it on the cuboid.",
        "Stell Länge, Breite und Höhe ein. Links zählst du das Volumen in Einheitswürfeln, rechts siehst du das Netz: sechs Rechtecke, immer zwei gleiche. Tippe ein Flächenpaar an, um es am Quader zu finden.",
      ),
      widget: AreaVolumeCuboidBuilder,
    },
    {
      type: "check",
      blob: tx("Volume first, then into litres.", "Erst das Volumen, dann in Liter."),
      exercise: {
        instruction: VOLUME,
        text: tx("A fish tank is 50 cm long, 30 cm wide and 40 cm high. How many litres of water fit into it?", "Ein Aquarium ist 50 cm lang, 30 cm breit und 40 cm hoch. Wie viele Liter Wasser passen hinein?"),
        visual: figure(cuboidFigure(50, 30, 40, "cm")),
        answer: exact(60, "l", "V ="),
        hint: tx('$V = a \\cdot b \\cdot c$ in cm³, then $1000 "cm³" = 1 "l"$.', '$V = a \\cdot b \\cdot c$ in cm³, dann gilt $1000 "cm³" = 1 "l"$.'),
        solution: [
          { math: "V#V =#e 50#a \\cdot#m1 30#b \\cdot#m2 40#c", note: tx("Length times width times height.", "Länge mal Breite mal Höhe.") },
          { math: "V#V =#e 1500#a \\cdot#m2 40#c", note: tx("The bottom layer: $50 \\cdot 30 = 1500$.", "Die unterste Schicht: $50 \\cdot 30 = 1500$.") },
          { math: tx('V#V =#e 60\\,000#a "cm³"#u', 'V#V =#e 60\\,000#a "cm³"#u'), note: tx("Times the height 40.", "Mal die Höhe 40.") },
          { math: 'V#V =#e 60#a "l"#u', note: tx('$1000 "cm³" = 1 "l"$, so divide by 1000: 60 litres.', '$1000 "cm³" = 1 "l"$, also durch 1000 teilen: 60 Liter.') },
        ],
        mistakes: (() => {
          const m = mistakeList(exact(60, "l", "V ="));
          m.add(60000, tx("Still in cm³", "Noch in cm³"), tx(`That's the volume in cm³. Now convert: $1000 "cm³" = 1 "l"$.`, 'Das ist das Volumen in cm³. Jetzt noch umrechnen: $1000 "cm³" = 1 "l"$.'), true);
          m.add(600, tx("Factor 100 instead of 1000", "Faktor 100 statt 1000"), tx('Volume units go in steps of **1000**: $1 "l" = 1000 "cm³"$.', 'Volumeneinheiten gehen in **1000er**-Schritten: $1 "l" = 1000 "cm³"$.'));
          m.add(120, tx("Added the edges", "Kanten addiert"), tx("For volume, multiply: length times width times height.", "Beim Volumen wird multipliziert: Länge mal Breite mal Höhe."));
          m.add(6000, tx("Factor 10 instead of 1000", "Faktor 10 statt 1000"), tx('Volume units go in steps of **1000**: $1 "l" = 1000 "cm³"$.', 'Volumeneinheiten gehen in **1000er**-Schritten: $1 "l" = 1000 "cm³"$.'));
          return m.list;
        })(),
      },
    },
  ],
  summary: [
    {
      title: tx("Rectangle and square", "Rechteck und Quadrat"),
      body: tx("Perimeter = the edge all the way round. Area = how many unit squares fit inside.", "Umfang = der Rand einmal herum. Flächeninhalt = wie viele Einheitsquadrate hineinpassen."),
      examples: ["u = 2 \\cdot a + 2 \\cdot b", "A = a \\cdot b", tx('\"square:\" \\; u = 4 \\cdot a, \\; A = a^2', '\"Quadrat:\" \\; u = 4 \\cdot a, \\; A = a^2')],
      tone: "rule",
    },
    {
      title: tx("Area units: factor 100", "Flächeneinheiten: Umrechnungszahl 100"),
      body: tx("One step to a smaller unit: times 100. To a bigger unit: divided by 100.", "Eine Stufe zur kleineren Einheit: mal 100. Zur größeren Einheit: geteilt durch 100."),
      examples: ['1 "km²" = 100 "ha" , \\; 1 "ha" = 100 "a" , \\; 1 "a" = 100 "m²"', '1 "m²" = 100 "dm²" , \\; 1 "dm²" = 100 "cm²" , \\; 1 "cm²" = 100 "mm²"'],
      tone: "rule",
    },
    {
      title: tx("Composite shapes", "Zusammengesetzte Flächen"),
      body: tx("Split into rectangles and add, or complete to a big rectangle and subtract the missing piece.", "In Rechtecke zerlegen und addieren oder zu einem großen Rechteck ergänzen und das fehlende Stück abziehen."),
      examples: ["A = A_1 + A_2", "A = A_1 - A_2"],
      tone: "tip",
    },
    {
      title: tx("Cuboid and cube", "Quader und Würfel"),
      body: tx("Volume = how many unit cubes fit inside. Surface area = the six faces of the net.", "Volumen = wie viele Einheitswürfel hineinpassen. Oberfläche = die sechs Flächen des Netzes."),
      examples: ["V = a \\cdot b \\cdot c", "O = 2 \\cdot (a \\cdot b + a \\cdot c + b \\cdot c)", tx('\"cube:\" \\; V = a^3, \\; O = 6 \\cdot a^2', '\"Würfel:\" \\; V = a^3, \\; O = 6 \\cdot a^2')],
      tone: "rule",
    },
    {
      title: tx("Volume units: factor 1000", "Volumeneinheiten: Umrechnungszahl 1000"),
      body: tx("One litre is one cubic decimetre.", "Ein Liter ist ein Kubikdezimeter."),
      examples: ['1 "m³" = 1000 "dm³" , \\; 1 "dm³" = 1000 "cm³"', '1 "l" = 1 "dm³" , \\; 1 "ml" = 1 "cm³"'],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Don't mix up perimeter (cm) and area (cm²). Areas convert with 100, volumes with 1000, never with 10.", "Verwechsle nicht Umfang (cm) und Flächeninhalt (cm²). Flächen rechnest du mit 100 um, Volumen mit 1000, nie mit 10."),
      examples: ['1 "m²" \\ne 10 "dm²"', '1 "m²" = 100 "dm²"'],
      tone: "warning",
    },
  ],
};
