import { tx, type Text } from "@/i18n/text";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";
import { D, E, joinT, mathN, paras, sayN, wrong, wrongNumbers, wrongSolutions, type Wrong } from "./kit";
import { normalFrames, polyPlain, pqFrames, senseFrame } from "./quad";

// Level 3: quadratic word problems (frames and paths, rectangles, consecutive numbers,
// Pythagoras, throws) with the check which solution makes sense, and work-rate problems
// (1/a + 1/b = 1/t) that lead to fractional equations.

const QUAD = tx("Solve with a quadratic equation", "Löse mit einer quadratischen Gleichung");
const NEG_LENGTH = tx("Negative length", "Negative Länge");

/** A quadratic word problem: set up, A·x² + B·x + C = R, pq formula, which solution makes sense. */
export type QS = {
  text: Text;
  /** What x stands for ("Let $x$ be the width of the frame in cm."), shown with "Which solutions make sense?" and "Which equation fits?". */
  xIs: Text;
  hint: Text;
  setup: Frame[];
  /** The equation as set up from the story (display source). */
  eq: Text;
  eqNote: Text;
  /** Expanded: A·x² + B·x + C = R (shown when `expandNote` is given). */
  A: number;
  B: number;
  C: number;
  R: number;
  expandNote?: Text;
  sense: [boolean, boolean];
  senseNote: Text;
  /** For "Which solutions make sense?": how to see that a positive solution fails. */
  senseCheck?: Text;
  value: number;
  unit?: Text;
  label?: Text;
  /** An extra step when the question asks for something other than x. */
  derive?: Frame;
  answer: Text;
  wrongs: Wrong[];
  v?: string;
  /** Equations that look right but aren't, for "Which equation fits?". */
  traps?: { eq: string; title: Text; say: Text }[];
  /** The right equation without keys, for "Which equation fits?". */
  eqPlain?: string;
};

/** The worked solution of a quadratic story. */
export function quadFrames(s: QS): { frames: Frame[]; roots: [number, number] } {
  const v = s.v ?? "x";
  const frames: Frame[] = [...s.setup, { math: s.eq, note: s.eqNote }];
  const norm = normalFrames(s.A, s.B, s.C, s.R, v);
  // Multiplied out, the equation is the first step towards the normal form: one frame for both.
  if (s.expandNote) frames.push({ ...norm.frames[0], note: joinT(s.expandNote, norm.frames[0].note ?? "") }, ...norm.frames.slice(1));
  else frames.push(...norm.frames);
  const pq = pqFrames(norm.p, norm.q, v);
  frames.push(...pq.frames);
  frames.push(senseFrame(pq.roots, s.sense, s.senseNote, v));
  if (s.derive) frames.push(s.derive);
  const last = frames[frames.length - 1];
  frames[frames.length - 1] = { ...last, highlight: last.highlight, note: joinT(last.note ?? "", s.answer) };
  return { frames, roots: pq.roots };
}

export function quadExercise(s: QS): Exercise {
  const { frames } = quadFrames(s);
  const answer: AnswerSpec = { kind: "number", value: s.value, ...(s.unit ? { unit: s.unit } : {}), ...(s.label ? { label: s.label } : {}) };
  return { instruction: QUAD, text: s.text, answer, hint: s.hint, solution: frames, mistakes: wrongNumbers(answer, s.wrongs) };
}

// ---------------------------------------------------------------------------
// Frames and paths: (a + 2x)(b + 2x)

export type FrameCtx = "picture" | "pictureFrame" | "pool" | "lawn";

export function frameStory(ctx: FrameCtx, a: number, b: number, x: number): QS {
  const ab = a * b;
  const R = (a + 2 * x) * (b + 2 * x);
  const F = R - ab;
  const total = ctx === "picture" || ctx === "lawn";
  const unit = ctx === "picture" || ctx === "pictureFrame" ? "cm" : "m";
  const other = -(a + b) / 2 - x;
  const text =
    ctx === "picture"
      ? tx(
          `A picture is ${a} cm wide and ${b} cm high. It gets a frame that is equally wide all around. Picture and frame together cover ${R} cm². How wide is the frame?`,
          `Ein Bild ist ${a} cm breit und ${b} cm hoch. Es bekommt einen Rahmen, der ringsherum gleich breit ist. Bild und Rahmen bedecken zusammen ${R} cm². Wie breit ist der Rahmen?`,
        )
      : ctx === "pictureFrame"
        ? tx(
            `A photo is ${a} cm wide and ${b} cm high. A frame of the same width all around is added. The frame alone covers ${F} cm². How wide is the frame?`,
            `Ein Foto ist ${a} cm breit und ${b} cm hoch. Es bekommt ringsherum einen gleich breiten Rahmen. Der Rahmen allein hat eine Fläche von ${F} cm². Wie breit ist der Rahmen?`,
          )
        : ctx === "pool"
          ? tx(
              `A rectangular pool is ${a} m long and ${b} m wide. A path of the same width runs all around it. The path covers ${F} m². How wide is the path?`,
              `Ein rechteckiges Becken ist ${a} m lang und ${b} m breit. Ringsherum führt ein gleich breiter Weg. Der Weg hat eine Fläche von ${F} m². Wie breit ist der Weg?`,
            )
          : tx(
              `A rectangular lawn is ${a} m long and ${b} m wide. It gets a flower bed of the same width all around. Lawn and flower bed together cover ${R} m². How wide is the flower bed?`,
              `Ein rechteckiger Rasen ist ${a} m lang und ${b} m breit. Er bekommt ringsherum ein gleich breites Blumenbeet. Rasen und Beet bedecken zusammen ${R} m². Wie breit ist das Beet?`,
            );
  const what = ctx === "pool" ? tx("path", "Weg") : ctx === "lawn" ? tx("flower bed", "Beet") : tx("frame", "Rahmen");
  const outside = `(${a}#a +#p1 2#k1 x#x1)#B1 (${b}#b +#p2 2#k2 x#x2)#B2`;
  const xIs = tx(`Let $x$ be the width of the ${E(what)} in ${unit}.`, `Sei $x$ die Breite ${ctx === "pool" ? "des Wegs" : ctx === "lawn" ? "des Beets" : "des Rahmens"} in ${unit}.`);
  const setup: Frame[] = [
    {
      math: tx(`"outside:"#lo \\, (${a}#a +#p1 2#k1 x#x1)#B1 \\cdot#t (${b}#b +#p2 2#k2 x#x2)#B2`, `"außen:"#lo \\, (${a}#a +#p1 2#k1 x#x1)#B1 \\cdot#t (${b}#b +#p2 2#k2 x#x2)#B2`),
      note: joinT(
        xIs,
        tx(`It adds $x$ on **both** sides, so the outside is $${a} + 2x$ by $${b} + 2x$.`, `${ctx === "lawn" ? "Es" : "Er"} kommt auf **beiden** Seiten dazu, außen misst alles also $${a} + 2x$ mal $${b} + 2x$.`),
      ),
    },
  ];
  const traps = [
    {
      eq: total ? `(${a} + x)(${b} + x) = ${R}` : `(${a} + x)(${b} + x) - ${ab} = ${F}`,
      title: tx("Only on one side", "Nur auf einer Seite"),
      say: tx(`Nearly! The ${E(what)} is on **both** sides, left and right, top and bottom. So each length grows by $2x$.`, `Fast! ${D(what) === "Weg" ? "Der Weg" : D(what) === "Beet" ? "Das Beet" : "Der Rahmen"} liegt auf **beiden** Seiten, links und rechts, oben und unten. Jede Länge wächst also um $2x$.`),
    },
    {
      eq: total ? `${ab} + 4x = ${R}` : `4x = ${F}`,
      title: tx("Not an area", "Keine Fläche"),
      say: tx("Hmm, $4x$ looks like four strips of length 1. But the strips are as long as the sides: an area is length **times** width.", "Hm, $4x$ sieht aus wie vier Streifen der Länge 1. Die Streifen sind aber so lang wie die Seiten: Eine Fläche ist Länge **mal** Breite."),
    },
    {
      eq: total ? `2(${a} + 2x) + 2(${b} + 2x) = ${R}` : `2(${a} + 2x) + 2(${b} + 2x) = ${F}`,
      title: tx("That's the perimeter", "Das ist der Umfang"),
      say: tx("Careful: $2 \\cdot$ length $+ 2 \\cdot$ width is the **perimeter**. The story gives an **area**.", "Vorsicht: $2 \\cdot$ Länge $+ 2 \\cdot$ Breite ist der **Umfang**. In der Aufgabe geht es um eine **Fläche**."),
    },
  ];
  return {
    text,
    xIs,
    hint: tx(`Let $x$ be the width. The outside measures $${a} + 2x$ by $${b} + 2x$.`, `Sei $x$ die Breite. Außen misst alles $${a} + 2x$ mal $${b} + 2x$.`),
    setup,
    eq: total ? `${outside} =#eq ${R}#r` : `${outside} -#m ${ab}#ab =#eq ${F}#r`,
    eqNote: total
      ? tx(`Together they cover: outside width times outside height = ${R}.`, `Zusammen bedecken sie: Breite außen mal Höhe außen $= ${R}$.`)
      : tx(`The ${E(what)} alone: the big rectangle minus the inner one ($${a} \\cdot ${b} = ${ab}$).`, `${ctx === "pool" ? "Der Weg" : "Der Rahmen"} allein: das große Rechteck minus das innere ($${a} \\cdot ${b} = ${ab}$).`),
    A: 4,
    B: 2 * (a + b),
    C: total ? ab : 0,
    R: total ? R : F,
    expandNote: total
      ? tx(`Multiply out: $${ab} + ${2 * a}x + ${2 * b}x + 4x^2$, then combine.`, `Multipliziere aus: $${ab} + ${2 * a}x + ${2 * b}x + 4x^2$, dann zusammenfassen.`)
      : tx(`Multiply out: $${ab} + ${2 * a}x + ${2 * b}x + 4x^2 - ${ab}$. The ${ab} cancels.`, `Multipliziere aus: $${ab} + ${2 * a}x + ${2 * b}x + 4x^2 - ${ab}$. Die ${ab} fällt weg.`),
    sense: [true, false],
    senseNote: sayN(({ n }) => [
      `$x_2 = ${n(other)}$ makes no sense: a width can't be negative. Only $x_1 = ${x}$ fits.`,
      `$x_2 = ${n(other)}$ ist nicht sinnvoll: Eine Breite kann nicht negativ sein. Nur $x_1 = ${x}$ passt.`,
    ]),
    value: x,
    unit,
    answer: sayN(({ N }) => [
      `**Answer:** The ${N(what)} is ${x} ${unit} wide. Check: $${a + 2 * x} \\cdot ${b + 2 * x} = ${R}$${total ? "" : ` and $${R} - ${ab} = ${F}$`}.`,
      `**Antwort:** ${ctx === "pool" ? "Der Weg ist" : ctx === "lawn" ? "Das Beet ist" : "Der Rahmen ist"} ${x} ${unit} breit. Probe: $${a + 2 * x} \\cdot ${b + 2 * x} = ${R}$${total ? "" : ` und $${R} - ${ab} = ${F}$`}.`,
    ]),
    wrongs: [
      wrong(other, NEG_LENGTH, sayN(({ n }) => [`That's the second solution of the equation, $${n(other)}$. But a width can't be negative: check which solution makes sense!`, `Das ist die zweite Lösung der Gleichung, $${n(other)}$. Eine Breite kann aber nicht negativ sein: Prüf, welche Lösung sinnvoll ist!`]), true),
      wrong(-other, NEG_LENGTH, sayN(({ n }) => [`Hmm, ${n(-other)} is the second solution without its minus. A negative width makes no sense, so drop it completely.`, `Hm, ${n(-other)} ist die zweite Lösung ohne ihr Minus. Eine negative Breite ist nicht sinnvoll, die fällt also ganz weg.`])),
      wrong(a + 2 * x, tx("Outside length", "Länge außen"), tx(`Nearly! ${a + 2 * x} ${unit} is the length **outside**. The question asks how wide the strip itself is: $x$.`, `Fast! ${a + 2 * x} ${unit} ist die Länge **außen**. Gefragt ist, wie breit der Streifen selbst ist: $x$.`)),
      wrong(2 * x, tx("Both sides counted", "Beide Seiten gezählt"), tx(`So close! $2x = ${2 * x}$ is what both sides add together. One side is $x$.`, `Ganz knapp! $2x = ${2 * x}$ ist das, was beide Seiten zusammen dazugeben. Eine Seite ist $x$.`)),
    ],
    traps,
    eqPlain: total ? `(${a} + 2x)(${b} + 2x) = ${R}` : `(${a} + 2x)(${b} + 2x) - ${ab} = ${F}`,
  };
}

function frameTask(rng: Rng): QS {
  const ctx = rng.pick<FrameCtx>(["picture", "picture", "pictureFrame", "pool", "lawn"]);
  for (let i = 0; i < 60; i++) {
    const cm = ctx === "picture" || ctx === "pictureFrame";
    const a = cm ? rng.int(5, 20) * 2 : rng.int(6, 25);
    const b = cm ? rng.int(5, 15) * 2 : rng.int(4, 15);
    const x = cm ? rng.int(1, 6) : rng.int(1, 3);
    // p/2 = (a + b)/4 a whole number, and a root a student knows.
    if (a <= b || (a + b) % 4 !== 0) continue;
    const q = frameStory(ctx, a, b, x);
    if (friendly(q)) return q;
  }
  return frameStory("picture", 30, 18, 3);
}

// ---------------------------------------------------------------------------
// A strip inside: (a − 2x)(b − 2x). Both solutions are positive, but the larger one is too wide.

export type InnerCtx = "garden" | "margin";

export function innerStory(ctx: InnerCtx, a: number, b: number, x: number): QS {
  const R = (a - 2 * x) * (b - 2 * x);
  const big = (a + b) / 2 - x;
  const garden = ctx === "garden";
  const unit = garden ? "m" : "cm";
  const what = garden ? tx("path", "Weg") : tx("margin", "Rand");
  const Der = garden ? "Der Weg" : "Der Rand";
  const inner = garden ? tx("the lawn", "der Rasen") : tx("the printed area", "die bedruckte Fläche");
  const xIs = tx(`Let $x$ be the width of the ${E(what)} in ${unit}.`, `Sei $x$ die Breite ${garden ? "des Wegs" : "des Rands"} in ${unit}.`);
  return {
    text: garden
      ? tx(
          `A rectangular garden is ${a} m long and ${b} m wide. Inside the garden, a path of the same width runs all along its edge. The lawn left in the middle covers ${R} m². How wide is the path?`,
          `Ein rechteckiger Garten ist ${a} m lang und ${b} m breit. Innen am Rand entlang führt ringsherum ein gleich breiter Weg. Der Rasen, der in der Mitte übrig bleibt, ist ${R} m² groß. Wie breit ist der Weg?`,
        )
      : tx(
          `A poster is ${a} cm wide and ${b} cm high. A margin of the same width is left blank all around. The printed area in the middle covers ${R} cm². How wide is the margin?`,
          `Ein Plakat ist ${a} cm breit und ${b} cm hoch. Ringsherum bleibt ein gleich breiter Rand frei. Die bedruckte Fläche in der Mitte ist ${R} cm² groß. Wie breit ist der Rand?`,
        ),
    xIs,
    hint: tx(`Let $x$ be the width. Inside, ${E(inner)} measures $${a} - 2x$ by $${b} - 2x$.`, `Sei $x$ die Breite. Innen misst ${D(inner)} $${a} - 2x$ mal $${b} - 2x$.`),
    setup: [
      {
        math: tx(`"inside:"#lo \\, (${a}#a -#p1 2#k1 x#x1)#B1 \\cdot#t (${b}#b -#p2 2#k2 x#x2)#B2`, `"innen:"#lo \\, (${a}#a -#p1 2#k1 x#x1)#B1 \\cdot#t (${b}#b -#p2 2#k2 x#x2)#B2`),
        note: joinT(
          xIs,
          tx(`It takes $x$ away on **both** sides, so inside only $${a} - 2x$ by $${b} - 2x$ is left.`, `Er nimmt auf **beiden** Seiten $x$ weg, innen bleiben also nur $${a} - 2x$ mal $${b} - 2x$.`),
        ),
      },
    ],
    eq: `(${a}#a -#p1 2#k1 x#x1)#B1 (${b}#b -#p2 2#k2 x#x2)#B2 =#eq ${R}#r`,
    eqNote: tx(`Inside, ${E(inner)} covers ${R} ${unit}².`, `Innen ist ${D(inner)} ${R} ${unit}² groß.`),
    A: 4,
    B: -2 * (a + b),
    C: a * b,
    R,
    expandNote: tx(`Multiply out: $${a * b} - ${2 * a}x - ${2 * b}x + 4x^2$, then combine.`, `Multipliziere aus: $${a * b} - ${2 * a}x - ${2 * b}x + 4x^2$, dann zusammenfassen.`),
    sense: [false, true],
    senseNote: tx(
      `Both are positive, but $x_1 = ${big}$ is too wide: inside, $${b} - 2 \\cdot ${big} = ${b - 2 * big}$ ${unit} would be left. A length can't be negative. Only $x_2 = ${x}$ fits.`,
      `Beide sind positiv, aber $x_1 = ${big}$ ist zu breit: Innen blieben $${b} - 2 \\cdot ${big} = ${b - 2 * big}$ ${unit} übrig. Eine Länge kann nicht negativ sein. Nur $x_2 = ${x}$ passt.`,
    ),
    senseCheck: tx(`How much would be left inside, $${b} - 2x$?`, `Wie viel bliebe innen übrig, $${b} - 2x$?`),
    value: x,
    unit,
    answer: tx(
      `**Answer:** The ${E(what)} is ${x} ${unit} wide. Check: $${a - 2 * x} \\cdot ${b - 2 * x} = ${R}$.`,
      `**Antwort:** ${Der} ist ${x} ${unit} breit. Probe: $${a - 2 * x} \\cdot ${b - 2 * x} = ${R}$.`,
    ),
    wrongs: [
      wrong(big, tx("Too wide to fit", "Zu breit"), tx(`Hmm, $${big}$ solves the equation, but it's too wide: inside, $${b} - 2 \\cdot ${big}$ is less than nothing. Check which solution makes sense!`, `Hm, $${big}$ löst zwar die Gleichung, ist aber zu breit: Innen wäre $${b} - 2 \\cdot ${big}$ weniger als nichts. Prüf, welche Lösung sinnvoll ist!`)),
      wrong(2 * x, tx("Only on one side", "Nur auf einer Seite"), tx(`I think you used $(${a} - x)(${b} - x)$. But the ${E(what)} is on **both** sides, so each length shrinks by $2x$.`, `Ich glaub, du hast $(${a} - x)(${b} - x)$ gerechnet. ${Der} liegt aber auf **beiden** Seiten, jede Länge schrumpft also um $2x$.`)),
      wrong(b - 2 * x, tx("Inner length", "Länge innen"), tx(`Nearly! ${b - 2 * x} ${unit} is what's left **inside**. The question asks how wide the strip itself is: $x$.`, `Fast! ${b - 2 * x} ${unit} ist das, was **innen** übrig bleibt. Gefragt ist, wie breit der Streifen selbst ist: $x$.`)),
    ],
    traps: [
      { eq: `(${a} - x)(${b} - x) = ${R}`, title: tx("Only on one side", "Nur auf einer Seite"), say: tx(`Nearly! The ${E(what)} is on **both** sides, so each length shrinks by $2x$.`, `Fast! ${Der} liegt auf **beiden** Seiten, jede Länge schrumpft also um $2x$.`) },
      { eq: `(${a} + 2x)(${b} + 2x) = ${R}`, title: tx("Outside, not inside", "Außen statt innen"), say: tx(`Careful: the ${E(what)} is **inside**, so what's left in the middle gets smaller: $${a} - 2x$.`, `Vorsicht: ${Der} liegt **innen**, was in der Mitte übrig bleibt, wird also kleiner: $${a} - 2x$.`) },
      { eq: `${a * b} - 4x = ${R}`, title: tx("Not an area", "Keine Fläche"), say: tx("Hmm, $4x$ looks like four strips of length 1. But the strips are as long as the sides: an area is length **times** width.", "Hm, $4x$ sieht aus wie vier Streifen der Länge 1. Die Streifen sind aber so lang wie die Seiten: Eine Fläche ist Länge **mal** Breite.") },
    ],
    eqPlain: `(${a} - 2x)(${b} - 2x) = ${R}`,
  };
}

function innerTask(rng: Rng): QS {
  const ctx = rng.pick<InnerCtx>(["garden", "margin"]);
  for (let i = 0; i < 60; i++) {
    const cm = ctx === "margin";
    const a = cm ? rng.int(10, 30) * 2 : rng.int(10, 30);
    const b = cm ? rng.int(8, 20) * 2 : rng.int(8, 24);
    const x = cm ? rng.int(1, 5) : rng.int(1, 3);
    // p/2 = −(a + b)/4 a whole number, and something sensible left inside.
    if (a <= b || (a + b) % 4 !== 0 || b - 2 * x < 4) continue;
    const q = innerStory(ctx, a, b, x);
    if (friendly(q)) return q;
  }
  return innerStory("garden", 20, 16, 2);
}

/** The root in the pq formula is at most 25 (a square number students know). */
function friendly(q: QS): boolean {
  const p = q.B / q.A;
  const c = (q.C - q.R) / q.A;
  return Math.sqrt((p / 2) ** 2 - c) <= 25;
}

// ---------------------------------------------------------------------------
// Rectangles: one side longer, or perimeter and area

export function gardenStory(x: number, d: number, ask: "width" | "length", place: "garden" | "poster"): QS {
  const A = x * (x + d);
  const unit = place === "garden" ? "m" : "cm";
  const unit2 = place === "garden" ? "m²" : "cm²";
  const len = x + d;
  const xIs = place === "garden" ? tx("Let $x$ be the width of the garden in m.", "Sei $x$ die Breite des Gartens in m.") : tx("Let $x$ be the width of the poster in cm.", "Sei $x$ die Breite des Plakats in cm.");
  return {
    text:
      place === "garden"
        ? tx(
            `A rectangular garden is ${d} m longer than it is wide. Its area is ${A} m². How ${ask === "width" ? "wide" : "long"} is the garden?`,
            `Ein rechteckiger Garten ist ${d} m länger als breit. Seine Fläche beträgt ${A} m². Wie ${ask === "width" ? "breit" : "lang"} ist der Garten?`,
          )
        : tx(
            `A poster is ${d} cm higher than it is wide and covers ${A} cm². How ${ask === "width" ? "wide" : "high"} is the poster?`,
            `Ein Plakat ist ${d} cm höher als breit und hat eine Fläche von ${A} cm². Wie ${ask === "width" ? "breit" : "hoch"} ist das Plakat?`,
          ),
    xIs,
    hint: tx(`Let $x$ be the width. The other side is $x + ${d}$. Area = length times width.`, `Sei $x$ die Breite. Die andere Seite ist $x + ${d}$. Fläche = Länge mal Breite.`),
    setup: [
      {
        math: tx(`"width:"#lw \\, x#x1 \\quad "${place === "garden" ? "length" : "height"}:"#ll \\, x#x2 +#p ${d}#d`, `"Breite:"#lw \\, x#x1 \\quad "${place === "garden" ? "Länge" : "Höhe"}:"#ll \\, x#x2 +#p ${d}#d`),
        note: joinT(xIs, tx(`The other side is ${d} ${unit} more: $x + ${d}$.`, `Die andere Seite ist ${d} ${unit} länger: $x + ${d}$.`)),
      },
    ],
    eq: `x#x1 (x#x2 +#p ${d}#d)#B =#eq ${A}#r`,
    eqNote: tx(`Area = width times ${place === "garden" ? "length" : "height"}: ${A} ${unit2}.`, `Fläche = Breite mal ${place === "garden" ? "Länge" : "Höhe"}: ${A} ${unit2}.`),
    A: 1,
    B: d,
    C: 0,
    R: A,
    expandNote: tx(`Multiply out: $x \\cdot x + ${d}x = x^2 + ${d}x$.`, `Multipliziere aus: $x \\cdot x + ${d}x = x^2 + ${d}x$.`),
    sense: [true, false],
    senseNote: tx(`$x_2 = ${-len}$ is not a length. Only $x_1 = ${x}$ makes sense.`, `$x_2 = ${-len}$ ist keine Länge. Nur $x_1 = ${x}$ ist sinnvoll.`),
    value: ask === "width" ? x : len,
    unit,
    derive:
      ask === "length"
        ? { math: `x#vx +#p ${d}#d =#eq ${x}#x1 +#p2 ${d}#d2 =#e2 ${len}#res`, highlight: ["res"], note: tx(`The other side is $x + ${d} = ${len}$.`, `Die andere Seite ist $x + ${d} = ${len}$.`) }
        : undefined,
    answer: tx(
      `**Answer:** The ${place === "garden" ? "garden" : "poster"} is ${x} ${unit} wide and ${len} ${unit} ${place === "garden" ? "long" : "high"}. Check: $${x} \\cdot ${len} = ${A}$.`,
      `**Antwort:** ${place === "garden" ? "Der Garten" : "Das Plakat"} ist ${x} ${unit} breit und ${len} ${unit} ${place === "garden" ? "lang" : "hoch"}. Probe: $${x} \\cdot ${len} = ${A}$.`,
    ),
    wrongs: [
      wrong(-len, NEG_LENGTH, tx(`That's the second solution, $${-len}$. But a side can't be negative: only the positive solution makes sense.`, `Das ist die zweite Lösung, $${-len}$. Eine Seite kann aber nicht negativ sein: Nur die positive Lösung ist sinnvoll.`), true),
      ask === "width"
        ? wrong(len, tx("The other side", "Die andere Seite"), tx(`Nearly! ${len} ${unit} is the longer side. The question asks for the width.`, `Fast! ${len} ${unit} ist die längere Seite. Gefragt ist die Breite.`))
        : wrong(x, tx("The other side", "Die andere Seite"), tx(`Great, $x = ${x}$ is right! But $x$ is the width. The question asks for the other side: $x + ${d}$.`, `Super, $x = ${x}$ stimmt! Aber $x$ ist die Breite. Gefragt ist die andere Seite: $x + ${d}$.`)),
      wrong(A / d, tx("Area divided by the difference", "Fläche durch den Unterschied"), tx(`Hmm, ${A} : ${d} doesn't give a side. Set up $x(x + ${d}) = ${A}$ and solve the quadratic equation.`, `Hm, ${A} : ${d} ergibt keine Seite. Stell $x(x + ${d}) = ${A}$ auf und löse die quadratische Gleichung.`)),
      wrong(Math.sqrt(A), tx("Taken as a square", "Als Quadrat gerechnet"), tx(`$\\sqrt{${A}}$ would be the side of a **square**. But this rectangle is ${d} ${unit} longer one way.`, `$\\sqrt{${A}}$ wäre die Seite eines **Quadrats**. Dieses Rechteck ist aber in eine Richtung ${d} ${unit} länger.`)),
    ],
    traps: [
      { eq: `x + (x + ${d}) = ${A}`, title: tx("Added, not multiplied", "Addiert statt multipliziert"), say: tx("Careful: the area is length **times** width, not length plus width.", "Vorsicht: Die Fläche ist Länge **mal** Breite, nicht Länge plus Breite.") },
      { eq: `x \\cdot ${d} = ${A}`, title: tx("The difference isn't a side", "Der Unterschied ist keine Seite"), say: tx(`Hmm, ${d} is how much **longer** one side is, not the side itself. That side is $x + ${d}$.`, `Hm, ${d} ist, um wie viel eine Seite **länger** ist, nicht die Seite selbst. Diese Seite ist $x + ${d}$.`) },
      { eq: `x^2 + ${d} = ${A}`, title: tx("Bracket forgotten", "Klammer vergessen"), say: tx(`Nearly! $x \\cdot (x + ${d})$ means **both** parts get multiplied by $x$: $x^2 + ${d}x$.`, `Fast! $x \\cdot (x + ${d})$ heißt: **Beide** Teile werden mit $x$ multipliziert, $x^2 + ${d}x$.`) },
    ],
    eqPlain: `x(x + ${d}) = ${A}`,
  };
}

function garden(rng: Rng, ask?: "width" | "length"): QS {
  const place = rng.pick(["garden", "poster"] as const);
  for (let i = 0; i < 30; i++) {
    const d = place === "garden" ? rng.pick([2, 4, 6, 8, 10]) : rng.pick([2, 4, 6, 8, 10, 12, 20]);
    const x = place === "garden" ? rng.int(4, 18) : rng.int(10, 30);
    const q = gardenStory(x, d, ask ?? (rng.chance(0.6) ? "width" : "length"), place);
    if (friendly(q)) return q;
  }
  return gardenStory(8, 4, ask ?? "width", "garden");
}

/** ask "both": "How long are its sides?" (both solutions answer it). */
export function rectPAStory(u: number, w: number, ask: "short" | "long" | "both"): QS {
  const s = u + w;
  const P = 2 * s;
  const A = u * w;
  const question =
    ask === "both"
      ? tx("How long are its sides?", "Wie lang sind seine Seiten?")
      : tx(`How long is its ${ask === "short" ? "shorter" : "longer"} side?`, `Wie lang ist seine ${ask === "short" ? "kürzere" : "längere"} Seite?`);
  return {
    text: joinT(tx(`A rectangle has a perimeter of ${P} cm and an area of ${A} cm².`, `Ein Rechteck hat einen Umfang von ${P} cm und einen Flächeninhalt von ${A} cm².`), question),
    xIs: tx("Let $x$ be one side of the rectangle in cm.", "Sei $x$ eine Seite des Rechtecks in cm."),
    hint: tx(`Half the perimeter is one length plus one width: ${s} cm. So if one side is $x$, the other is $${s} - x$.`, `Der halbe Umfang ist eine Länge plus eine Breite: ${s} cm. Ist eine Seite $x$, dann ist die andere $${s} - x$.`),
    setup: [
      {
        math: `x#x1 +#p (${s}#s -#m x#x2)#B =#eq ${s}#h`,
        note: tx(`Half the perimeter, $${P} : 2 = ${s}$, is one side plus the other. Let $x$ be one side, then the other is $${s} - x$.`, `Der halbe Umfang, $${P} : 2 = ${s}$, ist eine Seite plus die andere. Sei $x$ eine Seite, dann ist die andere $${s} - x$.`),
      },
    ],
    eq: `x#x1 (${s}#s -#m x#x2)#B =#eq ${A}#r`,
    eqNote: tx(`The area: one side times the other is ${A}.`, `Der Flächeninhalt: Seite mal Seite ergibt ${A}.`),
    A: -1,
    B: s,
    C: 0,
    R: A,
    expandNote: tx(`Multiply out: $${s}x - x^2$, sorted: $-x^2 + ${s}x$.`, `Multipliziere aus: $${s}x - x^2$, sortiert: $-x^2 + ${s}x$.`),
    sense: [true, true],
    senseNote: tx(
      `Both make sense, and they give **the same** rectangle: if one side is ${w}, the other is $${s} - ${w} = ${u}$, and the other way round.`,
      `Beide sind sinnvoll, und sie ergeben **dasselbe** Rechteck: Ist eine Seite ${w}, dann ist die andere $${s} - ${w} = ${u}$, und umgekehrt.`,
    ),
    value: ask === "long" ? w : u,
    unit: "cm",
    answer:
      ask === "both"
        ? tx(
            `**Answer:** The sides are ${u} cm and ${w} cm long. Check: $2 \\cdot (${u} + ${w}) = ${P}$ and $${u} \\cdot ${w} = ${A}$.`,
            `**Antwort:** Die Seiten sind ${u} cm und ${w} cm lang. Probe: $2 \\cdot (${u} + ${w}) = ${P}$ und $${u} \\cdot ${w} = ${A}$.`,
          )
        : tx(
            `**Answer:** The rectangle is ${u} cm by ${w} cm, so the ${ask === "short" ? "shorter" : "longer"} side is ${ask === "short" ? u : w} cm. Check: $2 \\cdot (${u} + ${w}) = ${P}$ and $${u} \\cdot ${w} = ${A}$.`,
            `**Antwort:** Das Rechteck ist ${u} cm mal ${w} cm groß, die ${ask === "short" ? "kürzere" : "längere"} Seite ist also ${ask === "short" ? u : w} cm lang. Probe: $2 \\cdot (${u} + ${w}) = ${P}$ und $${u} \\cdot ${w} = ${A}$.`,
          ),
    wrongs: [
      ask !== "both" &&
        wrong(ask === "short" ? w : u, tx("The other side", "Die andere Seite"), tx(`Nearly! That's the ${ask === "short" ? "longer" : "shorter"} side. Both solutions belong to the same rectangle: pick the one that's asked for.`, `Fast! Das ist die ${ask === "short" ? "längere" : "kürzere"} Seite. Beide Lösungen gehören zum selben Rechteck: Nimm die gesuchte.`)),
      wrong(P / 4, tx("Taken as a square", "Als Quadrat gerechnet"), tx(`$${P} : 4$ would be right for a **square**. But then the area would be $${P / 4}^2 = ${(P / 4) ** 2}$, not ${A}.`, `$${P} : 4$ wäre richtig für ein **Quadrat**. Dann wäre der Flächeninhalt aber $${P / 4}^2 = ${(P / 4) ** 2}$, nicht ${A}.`)),
      wrong(P - (ask === "long" ? u : w), tx("Whole perimeter used", "Ganzen Umfang benutzt"), tx(`Careful: one side plus the other is only **half** the perimeter: ${s}, not ${P}.`, `Vorsicht: Eine Seite plus die andere ist nur der **halbe** Umfang: ${s}, nicht ${P}.`)),
    ],
    traps: [
      { eq: `x(${P} - x) = ${A}`, title: tx("Whole perimeter used", "Ganzen Umfang benutzt"), say: tx(`Nearly! One side plus the other is only **half** the perimeter, ${s} cm. So the other side is $${s} - x$.`, `Fast! Eine Seite plus die andere ist nur der **halbe** Umfang, ${s} cm. Die andere Seite ist also $${s} - x$.`) },
      { eq: `x + (${s} - x) = ${A}`, title: tx("Added, not multiplied", "Addiert statt multipliziert"), say: tx("Careful: the area is one side **times** the other.", "Vorsicht: Der Flächeninhalt ist Seite **mal** Seite.") },
      { eq: `x^2 = ${A}`, title: tx("Taken as a square", "Als Quadrat gerechnet"), say: tx("Hmm, $x^2$ would be a **square**. Nothing says the sides are equal.", "Hm, $x^2$ wäre ein **Quadrat**. Nirgends steht, dass die Seiten gleich lang sind.") },
    ],
    eqPlain: `x(${s} - x) = ${A}`,
  };
}

function rectPA(rng: Rng, ask?: "short" | "long" | "both"): QS {
  for (let i = 0; i < 30; i++) {
    const u = rng.int(3, 14);
    const w = rng.int(u + 1, 20);
    if ((u + w) % 2 === 0 && friendly(rectPAStory(u, w, "short"))) return rectPAStory(u, w, ask ?? (rng.chance(0.5) ? "short" : "long"));
  }
  return rectPAStory(6, 8, ask ?? "long");
}

// ---------------------------------------------------------------------------
// Numbers: consecutive numbers with a product, a riddle with a square

export type ConsecKind = "next" | "even" | "odd";

/** Even or odd numbers in a row are 2 apart, not 1. */
const stepTitle = (kind: ConsecKind) => (kind === "even" ? tx("Even numbers go up by 2", "Gerade Zahlen: Schritt 2") : tx("Odd numbers go up by 2", "Ungerade Zahlen: Schritt 2"));
const stepSay = (kind: ConsecKind, en: string, de: string) =>
  kind === "even"
    ? tx(`${en}I think you used $x + 1$. But the next **even** number is $x + 2$: $x + 1$ would be odd.`, `${de}Ich glaub, du hast $x + 1$ genommen. Die nächste **gerade** Zahl ist aber $x + 2$: $x + 1$ wäre ungerade.`)
    : tx(`${en}I think you used $x + 1$. But the next **odd** number is $x + 2$: $x + 1$ would be even.`, `${de}Ich glaub, du hast $x + 1$ genommen. Die nächste **ungerade** Zahl ist aber $x + 2$: $x + 1$ wäre gerade.`);

export function consecStory(kind: ConsecKind, x: number, ask: "small" | "large", integers = false): QS {
  const step = kind === "next" ? 1 : 2;
  const y = x + step;
  const P = x * y;
  const other = -x - step;
  const words = kind === "next" ? ["consecutive"] : kind === "even" ? ["consecutive even"] : ["consecutive odd"];
  const set = integers ? ["whole numbers"] : ["natural numbers"];
  return {
    text: tx(
      `The product of two ${words[0]} ${set[0]} is ${P}. What is the ${ask === "small" ? "smaller" : "larger"} number?`,
      `Das Produkt zweier ${kind === "next" ? "aufeinanderfolgender" : kind === "even" ? "aufeinanderfolgender gerader" : "aufeinanderfolgender ungerader"} ${integers ? "ganzer" : "natürlicher"} Zahlen ist ${P}. Wie heißt die ${ask === "small" ? "kleinere" : "größere"} Zahl?`,
    ),
    xIs: tx("Let $x$ be the smaller number.", "Sei $x$ die kleinere Zahl."),
    hint: tx(`Let $x$ be the smaller number. The next one is $x + ${step}$.`, `Sei $x$ die kleinere Zahl. Die nächste ist $x + ${step}$.`),
    setup: [
      {
        math: `x#x1 ,#c \\quad x#x2 +#p ${step}#k`,
        note: tx(
          `Let $x$ be the smaller number. ${kind === "next" ? "The next number is $x + 1$." : `${kind === "even" ? "Even" : "Odd"} numbers come in steps of 2: the next is $x + 2$.`}`,
          `Sei $x$ die kleinere Zahl. ${kind === "next" ? "Die nächste Zahl ist $x + 1$." : `${kind === "even" ? "Gerade" : "Ungerade"} Zahlen kommen in Zweierschritten: Die nächste ist $x + 2$.`}`,
        ),
      },
    ],
    eq: `x#x1 (x#x2 +#p ${step}#k)#B =#eq ${P}#r`,
    eqNote: tx(`Their product is ${P}.`, `Ihr Produkt ist ${P}.`),
    A: 1,
    B: step,
    C: 0,
    R: P,
    expandNote: tx(`Multiply out: $x^2 + ${step === 1 ? "" : step}x$.`, `Multipliziere aus: $x^2 + ${step === 1 ? "" : step}x$.`),
    sense: integers ? [true, true] : [true, false],
    senseNote: integers
      ? tx(
          `Both make sense for whole numbers: the pairs ${x} and ${y}, or ${other} and ${other + step}. Both products are ${P}.`,
          `Bei ganzen Zahlen sind beide sinnvoll: das Paar ${x} und ${y} oder ${other} und ${other + step}. Beide Produkte sind ${P}.`,
        )
      : tx(`$x_2 = ${other}$ is not a natural number. Only $x_1 = ${x}$ makes sense.`, `$x_2 = ${other}$ ist keine natürliche Zahl. Nur $x_1 = ${x}$ ist sinnvoll.`),
    value: ask === "small" ? x : y,
    derive: ask === "large" ? { math: `x#x1 +#p ${step}#k =#eq ${x}#v1 +#p2 ${step}#k2 =#e2 ${y}#res`, highlight: ["res"], note: tx(`The larger number is $x + ${step} = ${y}$.`, `Die größere Zahl ist $x + ${step} = ${y}$.`) } : undefined,
    answer: tx(`**Answer:** The numbers are ${x} and ${y}. Check: $${x} \\cdot ${y} = ${P}$.`, `**Antwort:** Die Zahlen heißen ${x} und ${y}. Probe: $${x} \\cdot ${y} = ${P}$.`),
    wrongs: [
      wrong(ask === "small" ? other : other + step, tx("Not a natural number", "Keine natürliche Zahl"), tx(`That's from the second solution, $x_2 = ${other}$. But natural numbers can't be negative.`, `Das kommt aus der zweiten Lösung, $x_2 = ${other}$. Natürliche Zahlen sind aber nie negativ.`), true),
      wrong(ask === "small" ? y : x, tx("The other number", "Die andere Zahl"), tx(`Nearly! That's the ${ask === "small" ? "larger" : "smaller"} number. The question asks for the ${ask === "small" ? "smaller" : "larger"} one.`, `Fast! Das ist die ${ask === "small" ? "größere" : "kleinere"} Zahl. Gefragt ist die ${ask === "small" ? "kleinere" : "größere"}.`)),
      wrong(P / 2, tx("Halved the product", "Produkt halbiert"), tx(`Hmm, halving works for sums, not for products. Set up $x(x + ${step}) = ${P}$ and solve.`, `Hm, halbieren klappt bei Summen, nicht bei Produkten. Stell $x(x + ${step}) = ${P}$ auf und löse.`)),
      // Even or odd numbers taken one apart: x(x + 1) = P gives no whole number.
      step === 2 && wrong((-1 + Math.sqrt(1 + 4 * P)) / 2 + (ask === "small" ? 0 : 1), stepTitle(kind), stepSay(kind, "Not a whole number? ", "Keine ganze Zahl? ")),
    ],
    traps: [
      step === 2
        ? { eq: `x(x + 1) = ${P}`, title: stepTitle(kind), say: stepSay(kind, "Nearly! ", "Fast! ") }
        : { eq: `x \\cdot 2x = ${P}`, title: tx("Not x and 2x", "Nicht x und 2x"), say: tx("The next number is $x + 1$, not $2x$: it is only 1 more.", "Die nächste Zahl ist $x + 1$, nicht $2x$: Sie ist nur 1 größer.") },
      { eq: `x + (x + ${step}) = ${P}`, title: tx("Sum, not product", "Summe statt Produkt"), say: tx("Careful: the story talks about the **product**, so multiply.", "Vorsicht: In der Aufgabe geht es um das **Produkt**, also multiplizieren.") },
      { eq: `x^2 + ${step} = ${P}`, title: tx("Bracket forgotten", "Klammer vergessen"), say: tx(`Nearly! $x(x + ${step})$ means both parts are multiplied by $x$: $x^2 + ${step === 1 ? "" : step}x$.`, `Fast! $x(x + ${step})$ heißt: Beide Teile werden mit $x$ multipliziert, $x^2 + ${step === 1 ? "" : step}x$.`) },
    ],
    eqPlain: `x(x + ${step}) = ${P}`,
  };
}

function consec(rng: Rng, integers = false, ask?: "small" | "large"): QS {
  const kind = rng.pick<ConsecKind>(["next", "even", "odd"]);
  const x = kind === "next" ? rng.int(6, 24) : kind === "even" ? rng.int(3, 12) * 2 : rng.int(3, 12) * 2 + 1;
  return consecStory(kind, x, ask ?? (rng.chance(0.6) ? "small" : "large"), integers);
}

// ---------------------------------------------------------------------------
// Pythagoras: legs x and x + d, hypotenuse c

/**
 * Legs u < w with an even difference d = w − u: then p/2 = d/2 and the root (u + w)/2 are whole
 * numbers (an odd d gives roots like √132,25). The root stays at most 25, like friendly().
 */
const TRIPLES: [number, number, number][] = [
  [6, 8, 10], [12, 16, 20], [10, 24, 26], [18, 24, 30], [16, 30, 34],
];

export function pythStory(u: number, w: number, c: number, ask: "short" | "long"): QS {
  const d = w - u;
  return {
    text: tx(
      `The diagonal of a rectangle is ${c} cm long. One side is ${d} cm longer than the other. How long is the ${ask === "short" ? "shorter" : "longer"} side?`,
      `Die Diagonale eines Rechtecks ist ${c} cm lang. Eine Seite ist ${d} cm länger als die andere. Wie lang ist die ${ask === "short" ? "kürzere" : "längere"} Seite?`,
    ),
    xIs: tx("Let $x$ be the shorter side in cm.", "Sei $x$ die kürzere Seite in cm."),
    hint: tx("The diagonal splits the rectangle into two right-angled triangles: Pythagoras!", "Die Diagonale teilt das Rechteck in zwei rechtwinklige Dreiecke: Satz des Pythagoras!"),
    setup: [
      {
        math: tx(`"short:"#ls \\, x#x1 \\quad "long:"#ll \\, x#x2 +#p ${d}#d`, `"kurz:"#ls \\, x#x1 \\quad "lang:"#ll \\, x#x2 +#p ${d}#d`),
        note: tx(`Let $x$ be the shorter side in cm. The longer side is $x + ${d}$. The diagonal is the hypotenuse of a right-angled triangle.`, `Sei $x$ die kürzere Seite in cm. Die längere ist $x + ${d}$. Die Diagonale ist die Hypotenuse eines rechtwinkligen Dreiecks.`),
      },
    ],
    eq: `x#x1^{2#e1} +#p (x#x2 +#p2 ${d}#d)#B^{2#e2} =#eq ${c}#c^{2#e3}`,
    eqNote: tx("Pythagoras: $a^2 + b^2 = c^2$.", "Satz des Pythagoras: $a^2 + b^2 = c^2$."),
    A: 2,
    B: 2 * d,
    C: d * d,
    R: c * c,
    expandNote: tx(`Binomial formula: $(x + ${d})^2 = x^2 + ${2 * d}x + ${d * d}$. With the other $x^2$: $2x^2 + ${2 * d}x + ${d * d}$, and $${c}^2 = ${c * c}$.`, `Binomische Formel: $(x + ${d})^2 = x^2 + ${2 * d}x + ${d * d}$. Mit dem anderen $x^2$: $2x^2 + ${2 * d}x + ${d * d}$, und $${c}^2 = ${c * c}$.`),
    sense: [true, false],
    senseNote: tx(`$x_2 = ${-w}$ is not a length. Only $x_1 = ${u}$ makes sense.`, `$x_2 = ${-w}$ ist keine Länge. Nur $x_1 = ${u}$ ist sinnvoll.`),
    value: ask === "short" ? u : w,
    unit: "cm",
    derive: ask === "long" ? { math: `x#x1 +#p ${d}#d =#eq ${u}#v1 +#p2 ${d}#d2 =#e2 ${w}#res`, highlight: ["res"], note: tx(`The longer side is $x + ${d} = ${w}$.`, `Die längere Seite ist $x + ${d} = ${w}$.`) } : undefined,
    answer: tx(`**Answer:** The sides are ${u} cm and ${w} cm. Check: $${u}^2 + ${w}^2 = ${u * u} + ${w * w} = ${c * c} = ${c}^2$.`, `**Antwort:** Die Seiten sind ${u} cm und ${w} cm lang. Probe: $${u}^2 + ${w}^2 = ${u * u} + ${w * w} = ${c * c} = ${c}^2$.`),
    wrongs: [
      wrong(-w, NEG_LENGTH, tx(`That's the second solution, $${-w}$. But a side can't be negative.`, `Das ist die zweite Lösung, $${-w}$. Eine Seite kann aber nicht negativ sein.`), true),
      wrong(ask === "short" ? w : u, tx("The other side", "Die andere Seite"), tx(`Nearly! That's the ${ask === "short" ? "longer" : "shorter"} side.`, `Fast! Das ist die ${ask === "short" ? "längere" : "kürzere"} Seite.`)),
      wrong((c - d) / 2 + (ask === "short" ? 0 : d), tx("Squares forgotten", "Quadrate vergessen"), tx(`I think you used $x + (x + ${d}) = ${c}$. But in a right-angled triangle the **squares** add up: $a^2 + b^2 = c^2$.`, `Ich glaub, du hast $x + (x + ${d}) = ${c}$ gerechnet. Im rechtwinkligen Dreieck addieren sich aber die **Quadrate**: $a^2 + b^2 = c^2$.`)),
      wrong(Math.sqrt((c * c - d * d) / 2) + (ask === "short" ? 0 : d), tx("Binomial formula", "Binomische Formel"), tx(`Careful: $(x + ${d})^2 \\ne x^2 + ${d * d}$. There's a middle term: $x^2 + ${2 * d}x + ${d * d}$.`, `Vorsicht: $(x + ${d})^2 \\ne x^2 + ${d * d}$. Da fehlt das Mittelglied: $x^2 + ${2 * d}x + ${d * d}$.`)),
    ],
    traps: [
      { eq: `x^2 + x^2 + ${d * d} = ${c * c}`, title: tx("Binomial formula", "Binomische Formel"), say: tx(`Careful: $(x + ${d})^2 \\ne x^2 + ${d * d}$. The middle term $${2 * d}x$ is missing.`, `Vorsicht: $(x + ${d})^2 \\ne x^2 + ${d * d}$. Es fehlt das Mittelglied $${2 * d}x$.`) },
      { eq: `x + (x + ${d}) = ${c}`, title: tx("Squares forgotten", "Quadrate vergessen"), say: tx("In a right-angled triangle the **squares** of the sides add up, not the sides.", "Im rechtwinkligen Dreieck addieren sich die **Quadrate** der Seiten, nicht die Seiten.") },
      { eq: `x^2 + (x + ${d})^2 = ${c}`, title: tx("Right side not squared", "Rechte Seite nicht quadriert"), say: tx(`Nearly! The diagonal has to be squared too: $${c}^2 = ${c * c}$.`, `Fast! Auch die Diagonale wird quadriert: $${c}^2 = ${c * c}$.`) },
    ],
    eqPlain: `x^2 + (x + ${d})^2 = ${c}^2`,
  };
}

function pyth(rng: Rng, ask?: "short" | "long"): QS {
  const [u, w, c] = rng.pick(TRIPLES);
  return pythStory(u, w, c, ask ?? (rng.chance(0.6) ? "short" : "long"));
}

// ---------------------------------------------------------------------------
// Throws: h(t) = h₀ + v·t − 5t² (in m, t in s, with g ≈ 10 m/s²)

const hSrc = (h0: number, v: number) => `${h0 ? `${h0} + ` : ""}${v}t - 5t^2`;

export function landingStory(T: number, r: number, place: 0 | 1 | 2): QS {
  const v = 5 * (T - r);
  const h0 = 5 * T * r;
  const where = [
    ["from a tower", "von einem Turm"],
    ["from a balcony", "von einem Balkon"],
    ["from a cliff", "von einer Klippe"],
  ][place];
  return {
    text: tx(
      `A ball is thrown upwards ${where[0]}. Its height above the ground (in m) after $t$ seconds is $h(t) = ${hSrc(h0, v)}$. After how many seconds does it hit the ground?`,
      `Ein Ball wird ${where[1]} nach oben geworfen. Seine Höhe über dem Boden (in m) nach $t$ Sekunden ist $h(t) = ${hSrc(h0, v)}$. Nach wie vielen Sekunden schlägt er auf dem Boden auf?`,
    ),
    xIs: tx("$t$ is the time in seconds after the throw.", "$t$ ist die Zeit in Sekunden nach dem Wurf."),
    hint: tx("On the ground the height is 0: solve $h(t) = 0$.", "Am Boden ist die Höhe 0: Löse $h(t) = 0$."),
    setup: [{ math: `h#h (t#t1)#B =#eq 0#r`, note: tx("On the ground, the height is 0.", "Am Boden ist die Höhe 0.") }],
    eq: `${h0}#c +#sb ${v}#cb t#vb -#sa 5#ca t#va^{2#ea} =#eq 0#r`,
    eqNote: tx(`Put in the formula and sort: $-5t^2 + ${v}t + ${h0} = 0$.`, `Setz die Formel ein und sortiere: $-5t^2 + ${v}t + ${h0} = 0$.`),
    A: -5,
    B: v,
    C: h0,
    R: 0,
    sense: [true, false],
    senseNote: tx(`$t_2 = ${-r}$ would be **before** the throw. Only $t_1 = ${T}$ makes sense.`, `$t_2 = ${-r}$ wäre **vor** dem Wurf. Nur $t_1 = ${T}$ ist sinnvoll.`),
    value: T,
    unit: "s",
    v: "t",
    answer: tx(`**Answer:** The ball hits the ground after ${T} seconds. Check: $h(${T}) = ${h0} + ${v * T} - ${5 * T * T} = 0$.`, `**Antwort:** Der Ball schlägt nach ${T} Sekunden auf. Probe: $h(${T}) = ${h0} + ${v * T} - ${5 * T * T} = 0$.`),
    wrongs: [
      wrong(-r, tx("Before the throw", "Vor dem Wurf"), tx(`$t = ${-r}$ is a solution of the equation, but it lies **before** the throw. Time after the throw can't be negative.`, `$t = ${-r}$ löst zwar die Gleichung, liegt aber **vor** dem Wurf. Die Zeit nach dem Wurf kann nicht negativ sein.`), true),
      wrong(r, tx("Sign dropped", "Vorzeichen weggelassen"), tx(`Hmm, ${r} is the second solution without its minus. That solution makes no sense: drop it and keep the other one.`, `Hm, ${r} ist die zweite Lösung ohne ihr Minus. Diese Lösung ist nicht sinnvoll: Lass sie weg und nimm die andere.`)),
      v > 0 && wrong(v / 10, tx("That's the top", "Das ist der höchste Punkt"), sayN(({ n }) => [`At $t = ${n(v / 10)}$ the ball is at its **highest** point. It still has to fall down after that.`, `Bei $t = ${n(v / 10)}$ ist der Ball am **höchsten** Punkt. Danach fällt er erst noch herunter.`])),
    ],
  };
}

function landing(rng: Rng): QS {
  const T = rng.int(2, 5);
  const r = rng.int(1, T - 1);
  // A balcony is at most about 20 m high; higher starts are a tower or a cliff.
  return landingStory(T, r, 5 * T * r <= 20 ? rng.pick([0, 1] as const) : rng.pick([0, 2] as const));
}

/** The thrown object: a ball or a stone is thrown, a model rocket is launched. */
const THROWN = [
  { en: "A ball", de: "Ein Ball", enVerb: "thrown", deVerb: "geworfen", pron: "er", poss: "Seine" },
  { en: "A stone", de: "Ein Stein", enVerb: "thrown", deVerb: "geworfen", pron: "er", poss: "Seine" },
  { en: "A model rocket", de: "Eine Modellrakete", enVerb: "launched", deVerb: "geschossen", pron: "sie", poss: "Ihre" },
];

/** "When is the ball exactly H m high?" Both times make sense: on the way up and down. */
export function throwBoth(t1: number, t2: number, objectIndex = 0): Exercise {
  const v = 5 * (t1 + t2);
  const H = 5 * t1 * t2;
  const obj = THROWN[objectIndex];
  const answer: AnswerSpec = { kind: "solutions", variable: "t", values: [t1, t2] };
  const norm = normalFrames(-5, v, 0, H, "t");
  const pq = pqFrames(norm.p, norm.q, "t");
  const frames: Frame[] = [
    { math: mathN((n) => `${n(v)}#cb t#vb -#sa 5#ca t#va^{2#ea} =#eq ${n(H)}#r`), note: sayN(({ n }) => [`Set the height equal to ${n(H)}: $h(t) = ${n(H)}$.`, `Setz die Höhe gleich ${n(H)}: $h(t) = ${n(H)}$.`]) },
    ...norm.frames.slice(0),
    ...pq.frames,
    senseFrame(pq.roots, [true, true], sayN(({ n }) => [
      `Both make sense! At $t = ${n(t1)}$ s the ${obj.en.toLowerCase().replace("a ", "")} is on its way **up**, at $t = ${n(t2)}$ s on its way **down**. **Answer:** after ${n(t1)} s and after ${n(t2)} s.`,
      `Beide sind sinnvoll! Bei $t = ${n(t1)}$ s ist ${obj.pron} auf dem Weg **nach oben**, bei $t = ${n(t2)}$ s auf dem Weg **nach unten**. **Antwort:** nach ${n(t1)} s und nach ${n(t2)} s.`,
    ]), "t"),
  ];
  // The first normal-form step repeats the equation: merge it.
  const merged = [frames[0], ...frames.slice(2)];
  merged[0] = { ...merged[0], math: frames[1].math, note: joinT(frames[0].note ?? "", frames[1].note ?? "") };
  const P = obj.pron;
  return {
    instruction: tx("Find both times", "Bestimme beide Zeitpunkte"),
    text: sayN(({ n }) => [
      `${obj.en} is ${obj.enVerb} straight up. Its height (in m) after $t$ seconds is $h(t) = ${n(v)}t - 5t^2$. At which times is it exactly ${n(H)} m high?`,
      `${obj.de} wird senkrecht nach oben ${obj.deVerb}. ${obj.poss} Höhe (in m) nach $t$ Sekunden ist $h(t) = ${n(v)}t - 5t^2$. Zu welchen Zeitpunkten ist ${P} genau ${n(H)} m hoch?`,
    ]),
    answer,
    hint: sayN(({ n }) => [`Solve $${n(v)}t - 5t^2 = ${n(H)}$. Up **and** down!`, `Löse $${n(v)}t - 5t^2 = ${n(H)}$. Hoch **und** runter!`]),
    solution: merged,
    mistakes: wrongSolutions(answer, [
      { v: [t1], title: tx("Only on the way up", "Nur auf dem Weg nach oben"), say: sayN(({ n }) => [`Right, it's ${n(H)} m high on the way up! But it comes down again and passes ${n(H)} m a **second** time.`, `Stimmt, auf dem Weg nach oben ist ${P} ${n(H)} m hoch! Aber ${P} kommt wieder herunter und ist ein **zweites** Mal ${n(H)} m hoch.`]) },
      { v: [t2], title: tx("Only on the way down", "Nur auf dem Weg nach unten"), say: sayN(({ n }) => [`Right, on the way down! But before that, on the way **up**, it was already ${n(H)} m high once.`, `Stimmt, auf dem Weg nach unten! Aber vorher, auf dem Weg **nach oben**, war ${P} schon einmal ${n(H)} m hoch.`]) },
      { v: [0, t1 + t2], title: tx("That's take-off and landing", "Das sind Start und Landung"), say: sayN(({ n }) => [`Those are the times when the height is **0**: the start and the landing. You need $h(t) = ${n(H)}$.`, `Das sind die Zeitpunkte mit Höhe **0**: Start und Landung. Gesucht ist $h(t) = ${n(H)}$.`]) },
      { v: [-t1, -t2], title: tx("Signs flipped", "Vorzeichen vertauscht"), say: tx(`Both times are negative? Check the sign of $-\\frac{p}{2}$ in the pq formula.`, `Beide Zeiten negativ? Prüf das Vorzeichen von $-\\frac{p}{2}$ in der pq-Formel.`) },
    ]),
  };
}

function throwBothTask(rng: Rng): Exercise {
  const pairs: [number, number][] = [
    [1, 2], [1, 3], [1, 4], [2, 3], [1, 5], [2, 4], [0.5, 2], [0.5, 3], [1.5, 2], [1, 1.5], [0.5, 1.5], [2, 5], [3, 4],
  ];
  const [t1, t2] = rng.pick(pairs);
  return throwBoth(t1, t2, rng.pick([0, 1, 2] as const));
}

// ---------------------------------------------------------------------------
// Number riddle with a square

export function riddleStory(r: number, k: number, plus: boolean): QS {
  // plus: x² + kx = c (roots r and −r−k); minus: x² − kx = c (roots r and k − r < 0)
  const c = plus ? r * r + k * r : r * r - k * r;
  const other = plus ? -r - k : k - r;
  return {
    text: plus
      ? tx(`If you add ${k} times a natural number to its square, you get ${c}. What is the number?`, `Addiert man zum Quadrat einer natürlichen Zahl das ${k}-Fache der Zahl, erhält man ${c}. Wie heißt die Zahl?`)
      : tx(`If you subtract ${k} times a natural number from its square, you get ${c}. What is the number?`, `Subtrahiert man vom Quadrat einer natürlichen Zahl das ${k}-Fache der Zahl, erhält man ${c}. Wie heißt die Zahl?`),
    xIs: tx("Let $x$ be the number.", "Sei $x$ die gesuchte Zahl."),
    hint: tx(`Let $x$ be the number: its square is $x^2$, ${k} times the number is $${k}x$.`, `Sei $x$ die Zahl: Ihr Quadrat ist $x^2$, das ${k}-Fache ist $${k}x$.`),
    setup: [{ math: "x#va", note: tx("Let $x$ be the number.", "Sei $x$ die gesuchte Zahl.") }],
    eq: `x#va^{2#ea} ${plus ? "+" : "-"}#sb ${k}#cb x#vb =#eq ${c}#r`,
    eqNote: tx(`The square: $x^2$. ${plus ? "Plus" : "Minus"} ${k} times the number: $${plus ? "+" : "-"} ${k}x$. That makes ${c}.`, `Das Quadrat: $x^2$. ${plus ? "Plus" : "Minus"} das ${k}-Fache: $${plus ? "+" : "-"} ${k}x$. Das ergibt ${c}.`),
    A: 1,
    B: plus ? k : -k,
    C: 0,
    R: c,
    sense: [true, false],
    senseNote: tx(`$x_2 = ${other}$ is not a natural number. Only $x_1 = ${r}$ fits.`, `$x_2 = ${other}$ ist keine natürliche Zahl. Nur $x_1 = ${r}$ passt.`),
    value: r,
    label: "x =",
    answer: tx(`**Answer:** The number is ${r}. Check: $${r}^2 ${plus ? "+" : "-"} ${k} \\cdot ${r} = ${r * r} ${plus ? "+" : "-"} ${k * r} = ${c}$.`, `**Antwort:** Die Zahl ist ${r}. Probe: $${r}^2 ${plus ? "+" : "-"} ${k} \\cdot ${r} = ${r * r} ${plus ? "+" : "-"} ${k * r} = ${c}$.`),
    wrongs: [
      wrong(other, tx("Not a natural number", "Keine natürliche Zahl"), tx(`$${other}$ solves the equation, but it's not a natural number.`, `$${other}$ löst zwar die Gleichung, ist aber keine natürliche Zahl.`), true),
      wrong(-other, tx("Sign dropped", "Vorzeichen weggelassen"), tx(`Hmm, ${-other} is the second solution without its minus. Put it in: $${-other}^2 ${plus ? "+" : "-"} ${k} \\cdot ${-other}$ isn't ${c}.`, `Hm, ${-other} ist die zweite Lösung ohne ihr Minus. Setz sie ein: $${-other}^2 ${plus ? "+" : "-"} ${k} \\cdot ${-other}$ ergibt nicht ${c}.`)),
      wrong(Math.sqrt(c), tx("Root of the result", "Wurzel aus dem Ergebnis"), tx(`$\\sqrt{${c}}$ ignores the $${plus ? "+" : "-"} ${k}x$. Bring everything to one side and use the pq formula.`, `$\\sqrt{${c}}$ übersieht das $${plus ? "+" : "-"} ${k}x$. Bring alles auf eine Seite und nimm die pq-Formel.`)),
    ],
  };
}

function riddle(rng: Rng): QS {
  const plus = rng.chance(0.5);
  const k = rng.pick([2, 4, 6, 8, 3, 5]);
  const r = plus ? rng.int(3, 14) : rng.int(k + 2, k + 12);
  return riddleStory(r, k, plus);
}

// ---------------------------------------------------------------------------
// Work-rate problems: 1/a + 1/b = 1/t

export type WorkCtx = 0 | 1 | 2 | 3;
const WORK: { en: [string, string, string]; de: [string, string, string]; job: [string, string]; unit: "h" | "min" }[] = [
  { en: ["Pump A", "Pump B", "the pool"], de: ["Pumpe A", "Pumpe B", "das Becken"], job: ["fill the pool", "das Becken zu füllen"], unit: "h" },
  { en: ["The cold tap", "The hot tap", "the bathtub"], de: ["Der Kaltwasserhahn", "Der Warmwasserhahn", "die Badewanne"], job: ["fill the bathtub", "die Badewanne zu füllen"], unit: "min" },
  { en: ["Printer A", "Printer B", "the school newspaper"], de: ["Drucker A", "Drucker B", "die Schülerzeitung"], job: ["print the school newspaper", "die Schülerzeitung zu drucken"], unit: "min" },
  { en: ["Lea", "Tom", "the fence"], de: ["Lea", "Tom", "den Zaun"], job: ["paint the fence", "den Zaun zu streichen"], unit: "h" },
];

/** "The hot tap" in the middle of a sentence: "the hot tap" (names stay as they are). */
const mid = (s: string) => s.replace(/^The /, "the ").replace(/^Der /, "der ");
const unitWord = (u: "h" | "min", l: "en" | "de", plural = true) => (u === "h" ? (l === "en" ? (plural ? "hours" : "hour") : plural ? "Stunden" : "Stunde") : l === "en" ? (plural ? "minutes" : "minute") : plural ? "Minuten" : "Minute");
const WORK_INSTR = tx("Solve the work problem", "Löse die Arbeitsaufgabe");

/** Together: 1/a + 1/b = 1/t. */
export function workTogether(ctx: WorkCtx, a: number, b: number): Exercise {
  const w = WORK[ctx];
  const T = (a * b) / (a + b);
  const L = (a * b) / gcd(a, b);
  const na = L / a;
  const nb = L / b;
  const answer: AnswerSpec = { kind: "number", value: T, unit: w.unit };
  const U = (l: "en" | "de") => unitWord(w.unit, l);
  const frames: Frame[] = [
    {
      math: `\\frac{1}{${a}}#A +#p \\frac{1}{${b}}#B`,
      note: tx(
        `In 1 ${unitWord(w.unit, "en", false)}, ${mid(w.en[0])} does $\\frac{1}{${a}}$ of the job, ${mid(w.en[1])} does $\\frac{1}{${b}}$.`,
        `In 1 ${unitWord(w.unit, "de", false)} schafft ${mid(w.de[0])} $\\frac{1}{${a}}$ der Arbeit, ${mid(w.de[1])} $\\frac{1}{${b}}$.`,
      ),
    },
    {
      math: `\\frac{1}{${a}}#A +#p \\frac{1}{${b}}#B =#eq \\frac{1}{t}#T`,
      note: tx(`Together they do $\\frac{1}{t}$ of the job per ${unitWord(w.unit, "en", false)}, if they need $t$ ${U("en")} together.`, `Zusammen schaffen sie $\\frac{1}{t}$ pro ${unitWord(w.unit, "de", false)}, wenn sie zusammen $t$ ${U("de")} brauchen.`),
    },
    {
      math: `\\frac{${na}}{${L}}#A +#p \\frac{${nb}}{${L}}#B =#eq \\frac{${na + nb}}{${L}}#S =#e2 \\frac{1}{${T}}#T`,
      note: tx(`Common denominator ${L}: $\\frac{${na}}{${L}} + \\frac{${nb}}{${L}} = \\frac{${na + nb}}{${L}}$, reduced $\\frac{1}{${T}}$.`, `Hauptnenner ${L}: $\\frac{${na}}{${L}} + \\frac{${nb}}{${L}} = \\frac{${na + nb}}{${L}}$, gekürzt $\\frac{1}{${T}}$.`),
    },
    {
      math: `t#T =#eq ${T}#res`,
      highlight: ["T", "eq", "res"],
      note: tx(
        `Together they do $\\frac{1}{${T}}$ of the job per ${unitWord(w.unit, "en", false)}, so they need ${T} ${U("en")}. **Answer:** Together they need ${T} ${U("en")}. That's less than either of them needs alone, as it should be!`,
        `Zusammen schaffen sie $\\frac{1}{${T}}$ pro ${unitWord(w.unit, "de", false)}, brauchen also ${T} ${U("de")}. **Antwort:** Zusammen brauchen sie ${T} ${U("de")}. Das ist weniger, als jeder allein braucht. So muss es sein!`,
      ),
    },
  ];
  return {
    instruction: WORK_INSTR,
    text: tx(
      `${w.en[0]} alone needs ${a} ${U("en")} to ${w.job[0]}, ${mid(w.en[1])} alone needs ${b} ${U("en")}. How long does it take with both together?`,
      `${w.de[0]} allein braucht ${a} ${U("de")}, um ${w.job[1]}, ${mid(w.de[1])} allein ${b} ${U("de")}. Wie lange dauert es mit beiden zusammen?`,
    ),
    answer,
    hint: tx(`Per ${unitWord(w.unit, "en", false)}: $\\frac{1}{${a}}$ and $\\frac{1}{${b}}$ of the job. Together: $\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{1}{t}$.`, `Pro ${unitWord(w.unit, "de", false)}: $\\frac{1}{${a}}$ und $\\frac{1}{${b}}$ der Arbeit. Zusammen: $\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{1}{t}$.`),
    solution: frames,
    mistakes: wrongNumbers(answer, [
      wrong((a + b) / 2, tx("The average", "Der Durchschnitt"), tx(`Hmm, that's the average of ${a} and ${b}. But together it must be **quicker** than either of them alone!`, `Hm, das ist der Durchschnitt von ${a} und ${b}. Zusammen geht es aber **schneller**, als jeder allein braucht!`)),
      wrong(a + b, tx("Times added", "Zeiten addiert"), tx(`Whoa, together they'd take **longer** than each alone? Add the parts of the job they do per ${unitWord(w.unit, "en", false)}, not the times.`, `Huch, zusammen bräuchten sie **länger** als jeder allein? Addiere die Anteile pro ${unitWord(w.unit, "de", false)}, nicht die Zeiten.`)),
      wrong(Math.abs(a - b), tx("Times subtracted", "Zeiten subtrahiert"), tx(`Subtracting the times doesn't work. Think per ${unitWord(w.unit, "en", false)}: $\\frac{1}{${a}} + \\frac{1}{${b}}$ of the job.`, `Die Zeiten zu subtrahieren klappt nicht. Denk pro ${unitWord(w.unit, "de", false)}: $\\frac{1}{${a}} + \\frac{1}{${b}}$ der Arbeit.`)),
      wrong(Math.min(a, b) / 2, tx("Both equally fast?", "Beide gleich schnell?"), tx(`Halving the faster time would be right if **both** were that fast. But one of them is slower.`, `Die schnellere Zeit zu halbieren wäre richtig, wenn **beide** so schnell wären. Einer ist aber langsamer.`)),
    ]),
  };
}

/** One alone, unknown: 1/a + 1/x = 1/t. */
export function workAlone(ctx: WorkCtx, a: number, b: number): Exercise {
  const w = WORK[ctx];
  const T = (a * b) / (a + b);
  const U = (l: "en" | "de") => unitWord(w.unit, l);
  const L = (a * T) / gcd(a, T);
  const answer: AnswerSpec = { kind: "number", value: b, unit: w.unit };
  const frames: Frame[] = [
    {
      math: `\\frac{1}{${a}}#A +#p \\frac{1}{x}#X =#eq \\frac{1}{${T}}#T`,
      note: tx(`Let $x$ be the time ${mid(w.en[1])} needs alone. Per ${unitWord(w.unit, "en", false)}: $\\frac{1}{${a}} + \\frac{1}{x} = \\frac{1}{${T}}$.`, `Sei $x$ die Zeit, die ${mid(w.de[1])} allein braucht. Pro ${unitWord(w.unit, "de", false)}: $\\frac{1}{${a}} + \\frac{1}{x} = \\frac{1}{${T}}$.`),
    },
    {
      math: `\\frac{1}{x}#X =#eq \\frac{1}{${T}}#T -#m \\frac{1}{${a}}#A`,
      note: tx(`Subtract $\\frac{1}{${a}}$ on both sides.`, `Subtrahiere auf beiden Seiten $\\frac{1}{${a}}$.`),
    },
    {
      math: `\\frac{1}{x}#X =#eq \\frac{${L / T}}{${L}}#T -#m \\frac{${L / a}}{${L}}#A =#e2 \\frac{${L / T - L / a}}{${L}}#S`,
      note: tx(`Common denominator ${L}.`, `Hauptnenner ${L}.`),
    },
    {
      math: `x#X =#eq ${b}#res`,
      highlight: ["X", "eq", "res"],
      note: tx(
        `$\\frac{${L / T - L / a}}{${L}} = \\frac{1}{${b}}$, so $x = ${b}$. **Answer:** ${w.en[1]} alone needs ${b} ${U("en")}. Check: $\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{1}{${T}}$.`,
        `$\\frac{${L / T - L / a}}{${L}} = \\frac{1}{${b}}$, also $x = ${b}$. **Antwort:** ${w.de[1]} braucht allein ${b} ${U("de")}. Probe: $\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{1}{${T}}$.`,
      ),
    },
  ];
  return {
    instruction: WORK_INSTR,
    text: tx(
      `${w.en[0]} and ${mid(w.en[1])} together need ${T} ${U("en")} to ${w.job[0]}. ${w.en[0]} alone needs ${a} ${U("en")}. How long does ${mid(w.en[1])} need alone?`,
      `${w.de[0]} und ${mid(w.de[1])} brauchen zusammen ${T} ${U("de")}, um ${w.job[1]}. ${w.de[0]} allein braucht ${a} ${U("de")}. Wie lange braucht ${mid(w.de[1])} allein?`,
    ),
    answer,
    hint: tx(`$\\frac{1}{${a}} + \\frac{1}{x} = \\frac{1}{${T}}$: what is left for $\\frac{1}{x}$?`, `$\\frac{1}{${a}} + \\frac{1}{x} = \\frac{1}{${T}}$: Was bleibt für $\\frac{1}{x}$ übrig?`),
    solution: frames,
    mistakes: wrongNumbers(answer, [
      wrong(a - T, tx("Times subtracted", "Zeiten subtrahiert"), tx(`Subtracting the times doesn't work. Subtract the parts of the job per ${unitWord(w.unit, "en", false)}: $\\frac{1}{${T}} - \\frac{1}{${a}}$.`, `Die Zeiten zu subtrahieren klappt nicht. Subtrahiere die Anteile pro ${unitWord(w.unit, "de", false)}: $\\frac{1}{${T}} - \\frac{1}{${a}}$.`)),
      wrong(2 * T - a, tx("Average used", "Mit dem Durchschnitt gerechnet"), tx("Hmm, the time together isn't the average of the two times. Work with the parts of the job per unit of time.", "Hm, die gemeinsame Zeit ist nicht der Durchschnitt der beiden Zeiten. Rechne mit den Anteilen pro Zeiteinheit.")),
      wrong((L / T - L / a) / L, tx("Reciprocal forgotten", "Kehrwert vergessen"), tx(`So close! $\\frac{1}{x} = \\frac{1}{${b}}$, so $x$ itself is the **reciprocal**: ${b}.`, `Ganz knapp! $\\frac{1}{x} = \\frac{1}{${b}}$, also ist $x$ selbst der **Kehrwert**: ${b}.`)),
    ]),
  };
}

/** B alone needs d longer than A: 1/x + 1/(x + d) = 1/t → quadratic. */
export function workQuad(ctx: WorkCtx, x: number, d: number, ask: "fast" | "slow"): QS {
  const w = WORK[ctx];
  const T = (x * (x + d)) / (2 * x + d);
  const other = -(T * d) / x;
  const U = (l: "en" | "de") => unitWord(w.unit, l);
  const slow = x + d;
  return {
    text: tx(
      `Working together, ${mid(w.en[0])} and ${mid(w.en[1])} need ${T} ${U("en")} to ${w.job[0]}. Alone, ${mid(w.en[1])} would need ${d} ${U("en")} longer than ${mid(w.en[0])}. How long does ${mid(ask === "fast" ? w.en[0] : w.en[1])} need alone?`,
      `Zusammen brauchen ${mid(w.de[0])} und ${mid(w.de[1])} ${T} ${U("de")}, um ${w.job[1]}. Allein bräuchte ${mid(w.de[1])} ${d} ${U("de")} länger als ${mid(w.de[0])}. Wie lange braucht ${mid(ask === "fast" ? w.de[0] : w.de[1])} allein?`,
    ),
    xIs: tx(`Let $x$ be the time ${mid(w.en[0])} needs alone, in ${U("en")}.`, `Sei $x$ die Zeit in ${U("de")}, die ${mid(w.de[0])} allein braucht.`),
    hint: tx(`Let $x$ be the faster time. Then $\\frac{1}{x} + \\frac{1}{x + ${d}} = \\frac{1}{${T}}$. Multiply by the common denominator.`, `Sei $x$ die schnellere Zeit. Dann ist $\\frac{1}{x} + \\frac{1}{x + ${d}} = \\frac{1}{${T}}$. Multipliziere mit dem Hauptnenner.`),
    setup: [
      {
        math: `\\frac{1}{x}#A +#p \\frac{1}{x + ${d}}#B =#eq \\frac{1}{${T}}#T`,
        note: tx(
          `Let $x$ be the time ${mid(w.en[0])} needs alone. Then ${mid(w.en[1])} needs $x + ${d}$. Per ${unitWord(w.unit, "en", false)} they do $\\frac{1}{x}$ and $\\frac{1}{x + ${d}}$ of the job. Domain: $x \\ne 0$ and $x \\ne -${d}$.`,
          `Sei $x$ die Zeit, die ${mid(w.de[0])} allein braucht. Dann braucht ${mid(w.de[1])} $x + ${d}$. Pro ${unitWord(w.unit, "de", false)} schaffen sie $\\frac{1}{x}$ und $\\frac{1}{x + ${d}}$. Definitionsmenge: $x \\ne 0$ und $x \\ne -${d}$.`,
        ),
      },
    ],
    eq: `${T}#t1 (x#x1 +#p ${d}#d)#B +#p2 ${T}#t2 x#x2 =#eq x#x3 (x#x4 +#p3 ${d}#d2)#B2`,
    eqNote: tx(`Multiply **every** term by the common denominator $${T}x(x + ${d})$. The fractions are gone!`, `Multipliziere **jeden** Term mit dem Hauptnenner $${T}x(x + ${d})$. Die Brüche sind weg!`),
    A: -1,
    B: 2 * T - d,
    C: T * d,
    R: 0,
    expandNote: tx(`Multiply out: $${T}x + ${T * d} + ${T}x = x^2 + ${d}x$. Then bring everything to the left: $${polyPlain(-1, 2 * T - d, T * d, String)} = 0$.`, `Multipliziere aus: $${T}x + ${T * d} + ${T}x = x^2 + ${d}x$. Dann alles nach links: $${polyPlain(-1, 2 * T - d, T * d, String)} = 0$.`),
    sense: [true, false],
    senseNote: tx(`$x_2 = ${other}$ is a negative time: not possible. And $x_1 = ${x}$ is in the domain.`, `$x_2 = ${other}$ wäre eine negative Zeit: unmöglich. Und $x_1 = ${x}$ liegt in der Definitionsmenge.`),
    value: ask === "fast" ? x : slow,
    unit: w.unit,
    derive: ask === "slow" ? { math: `x#x1 +#p ${d}#d =#eq ${x}#v1 +#p2 ${d}#d2 =#e2 ${slow}#res`, highlight: ["res"], note: tx(`${w.en[1]} needs $x + ${d} = ${slow}$.`, `${w.de[1]} braucht $x + ${d} = ${slow}$.`) } : undefined,
    answer: tx(
      `**Answer:** ${w.en[0]} alone needs ${x} ${U("en")}, ${mid(w.en[1])} ${slow} ${U("en")}. Check: $\\frac{1}{${x}} + \\frac{1}{${slow}} = \\frac{1}{${T}}$.`,
      `**Antwort:** ${w.de[0]} braucht allein ${x} ${U("de")}, ${mid(w.de[1])} ${slow} ${U("de")}. Probe: $\\frac{1}{${x}} + \\frac{1}{${slow}} = \\frac{1}{${T}}$.`,
    ),
    wrongs: [
      wrong(other, tx("Negative time", "Negative Zeit"), tx(`$${other}$ solves the equation, but a time can't be negative. Take the other solution.`, `$${other}$ löst zwar die Gleichung, aber eine Zeit kann nicht negativ sein. Nimm die andere Lösung.`), true),
      ask === "fast"
        ? wrong(slow, tx("The other time", "Die andere Zeit"), tx(`Nearly! ${slow} is the **slower** time. The question asks for the faster one.`, `Fast! ${slow} ist die **langsamere** Zeit. Gefragt ist die schnellere.`))
        : wrong(x, tx("The other time", "Die andere Zeit"), tx(`Great, $x = ${x}$ is right! But $x$ is the faster time. Add the ${d}.`, `Super, $x = ${x}$ stimmt! Aber $x$ ist die schnellere Zeit. Rechne die ${d} noch dazu.`)),
      // (x + (x + d)) / 2 = T: the time together taken as the average of the two times.
      wrong((2 * T - d) / 2 + (ask === "fast" ? 0 : d), tx("Averaged the times", "Mit dem Durchschnitt gerechnet"), tx(`I think you used $\\frac{x + (x + ${d})}{2} = ${T}$. But the time together isn't the average: together they're **faster** than each of them alone. Add the parts of the job per ${unitWord(w.unit, "en", false)}.`, `Ich glaub, du hast $\\frac{x + (x + ${d})}{2} = ${T}$ gerechnet. Die gemeinsame Zeit ist aber nicht der Durchschnitt: Zusammen sind sie **schneller** als jeder allein. Addiere die Anteile pro ${unitWord(w.unit, "de", false)}.`)),
      // x + (x + d) = T: the times added (only possible when T > d).
      T > d && wrong((T - d) / 2 + (ask === "fast" ? 0 : d), tx("Times added", "Zeiten addiert"), tx(`I think you used $x + (x + ${d}) = ${T}$. But adding the times would make them **slower** together. Add the parts of the job per ${unitWord(w.unit, "en", false)}, not the times.`, `Ich glaub, du hast $x + (x + ${d}) = ${T}$ gerechnet. Mit addierten Zeiten wären sie zusammen **langsamer**. Addiere die Anteile pro ${unitWord(w.unit, "de", false)}, nicht die Zeiten.`)),
    ],
    traps: [
      { eq: `x + (x + ${d}) = ${T}`, title: tx("Times added", "Zeiten addiert"), say: tx("Together they're faster, not slower: add the **parts of the job** per unit of time, not the times.", "Zusammen sind sie schneller, nicht langsamer: Addiere die **Anteile** pro Zeiteinheit, nicht die Zeiten.") },
      { eq: `\\frac{1}{x} + \\frac{1}{x + ${d}} = ${T}`, title: tx("Together time not inverted", "Kehrwert vergessen"), say: tx(`Nearly! Together they do $\\frac{1}{${T}}$ of the job per unit of time, not ${T} jobs.`, `Fast! Zusammen schaffen sie pro Zeiteinheit $\\frac{1}{${T}}$ der Arbeit, nicht ${T} ganze Arbeiten.`) },
      { eq: `\\frac{x + (x + ${d})}{2} = ${T}`, title: tx("The average", "Der Durchschnitt"), say: tx("The time together isn't the average: together they're faster than each one alone.", "Die gemeinsame Zeit ist nicht der Durchschnitt: Zusammen sind sie schneller als jeder allein.") },
    ],
    eqPlain: `\\frac{1}{x} + \\frac{1}{x + ${d}} = \\frac{1}{${T}}`,
  };
}

const WORK_PAIRS: [number, number][] = [[3, 6], [4, 12], [5, 20], [6, 12], [6, 30], [8, 24], [9, 18], [10, 15], [10, 40], [12, 24], [12, 36], [14, 35], [15, 30], [18, 36], [20, 30], [21, 28], [24, 40]];
const WORK_QUAD: [number, number][] = [[3, 3], [4, 8], [5, 15], [6, 6], [8, 16], [9, 9], [10, 5], [12, 12], [12, 24], [14, 21], [15, 15], [20, 10], [21, 7]];

/** Times that fit the job: a bathtub takes minutes (10 or more), a pool or a fence at most a day. */
const fits = (ctx: WorkCtx, times: number[]) => (WORK[ctx].unit === "min" ? Math.min(...times) >= 10 : Math.max(...times) <= 24);
const workPair = (ctx: WorkCtx, rng: Rng) => rng.pick(WORK_PAIRS.filter(([a, b]) => fits(ctx, [a, b])));
const workQuadPair = (ctx: WorkCtx, rng: Rng) => rng.pick(WORK_QUAD.filter(([x, d]) => fits(ctx, [x, x + d])));

function work(rng: Rng): Exercise {
  const ctx = rng.pick([0, 1, 2, 3] as const);
  const r = rng.next();
  if (r < 0.4) {
    const [a, b] = workPair(ctx, rng);
    return rng.chance(0.5) ? workTogether(ctx, a, b) : workTogether(ctx, b, a);
  }
  if (r < 0.65) {
    const [a, b] = workPair(ctx, rng);
    return rng.chance(0.5) ? workAlone(ctx, a, b) : workAlone(ctx, b, a);
  }
  const [x, d] = workQuadPair(ctx, rng);
  return { ...quadExercise(workQuad(ctx, x, d, rng.chance(0.5) ? "fast" : "slow")), instruction: WORK_INSTR };
}

// ---------------------------------------------------------------------------
// "Which solutions make sense?" and "Which equation fits?"

export function senseTask(s: QS, rng: Rng): Exercise {
  const v = s.v ?? "x";
  const { frames, roots } = quadFrames(s);
  const fmt = (r: number) => ({ en: String(r), de: String(r).replace(".", ",") });
  const r = [fmt(roots[0]), fmt(roots[1])];
  const opts = [
    tx(`only $${v}_1 = ${r[0].en}$`, `nur $${v}_1 = ${r[0].de}$`),
    tx(`only $${v}_2 = ${r[1].en}$`, `nur $${v}_2 = ${r[1].de}$`),
    tx("both", "beide"),
    tx("neither", "keine von beiden"),
  ];
  const right = s.sense[0] && s.sense[1] ? 2 : s.sense[0] ? 0 : 1;
  const order = rng.shuffle([0, 1, 2, 3]);
  const options = order.map((i) => opts[i]);
  const at = (i: number) => order.indexOf(i);
  /** The solutions an option keeps: only x₁, only x₂, both, neither. */
  const kept = [[0], [1], [0, 1], []];
  const name = (k: number, l: "en" | "de") => `$${v}_${k + 1} = ${r[k][l]}$`;
  const say = (i: number): Text => {
    if (i === 3) return tx("Hmm, at least one solution fits here. Put each one back into the story.", "Hm, mindestens eine Lösung passt hier. Setz jede in die Geschichte ein.");
    const bad = kept[i].find((k) => !s.sense[k]);
    if (bad !== undefined) {
      // Kept a solution that fails: negative, or positive but too big for the story.
      if (roots[bad] < 0)
        return i === 2
          ? tx(`Careful: ${name(bad, "en")} solves the equation, but does it fit the **story**? Lengths, times and natural numbers are never negative.`, `Vorsicht: ${name(bad, "de")} löst die Gleichung, aber passt es zur **Geschichte**? Längen, Zeiten und natürliche Zahlen sind nie negativ.`)
          : tx(`Hmm, ${name(bad, "en")} is negative. Can that be the answer to this story?`, `Hm, ${name(bad, "de")} ist negativ. Kann das die Antwort auf diese Aufgabe sein?`);
      const check = s.senseCheck ?? tx("Put it back into the story and check every length.", "Setz sie in die Geschichte ein und prüf jede Länge.");
      return joinT(tx(`Careful: ${name(bad, "en")} is positive, but does it fit the **story**?`, `Vorsicht: ${name(bad, "de")} ist zwar positiv, aber passt diese Lösung zur **Geschichte**?`), check);
    }
    // Left out a solution that makes sense too.
    const missed = [0, 1].find((k) => s.sense[k] && !kept[i].includes(k)) ?? 0;
    return tx(`Nearly! Look again at ${name(missed, "en")}: here it makes sense too. Put it into the story!`, `Fast! Schau dir ${name(missed, "de")} noch mal an: Hier ist sie auch sinnvoll. Setz sie in die Geschichte ein!`);
  };
  const mistakes: Mistake[] = [];
  for (const i of [0, 1, 2, 3]) {
    if (i === right) continue;
    mistakes.push({ when: { kind: "choice", options, correct: at(i) }, title: tx("Check the story", "Prüf die Geschichte"), say: say(i) });
  }
  return {
    instruction: tx("Which solutions make sense?", "Welche Lösungen sind sinnvoll?"),
    text: paras(
      s.text,
      joinT(
        s.xIs,
        tx(
          `The equation for this story has the solutions ${name(0, "en")} and ${name(1, "en")}. Which solutions of the equation make sense in the story?`,
          `Die Gleichung zu dieser Aufgabe hat die Lösungen ${name(0, "de")} und ${name(1, "de")}. Welche Lösungen der Gleichung sind im Sachzusammenhang sinnvoll?`,
        ),
      ),
    ),
    answer: { kind: "choice", options, correct: at(right) },
    hint: tx("Put each solution back into the story. Can a length, a time or a natural number be negative? Does every length that depends on it stay positive?", "Setz jede Lösung in die Geschichte ein. Kann eine Länge, eine Zeit oder eine natürliche Zahl negativ sein? Bleibt jede Länge, die davon abhängt, positiv?"),
    solution: frames,
    mistakes,
  };
}

export function equationTask(s: QS, rng: Rng): Exercise {
  const right = `$${s.eqPlain}$`;
  const traps = (s.traps ?? []).map((t) => ({ ...t, o: `$${t.eq}$` })).filter((t) => t.o !== right);
  const options = rng.shuffle([right, ...traps.map((t) => t.o)]);
  const { frames } = quadFrames(s);
  return {
    instruction: tx("Which equation fits?", "Welche Gleichung passt?"),
    text: paras(s.text, s.xIs),
    answer: { kind: "choice", options, correct: options.indexOf(right) },
    hint: s.hint,
    solution: frames,
    mistakes: traps.map((t) => ({ when: { kind: "choice", options, correct: options.indexOf(t.o) }, title: t.title, say: t.say })),
  };
}

// ---------------------------------------------------------------------------

const QUAD_STORIES = [frameTask, frameTask, innerTask, garden, rectPA, (r: Rng) => consec(r), pyth, landing, riddle];

/**
 * The stories for "Which solutions make sense?". Each one asks for $x$ itself (the width, the
 * smaller number, the shorter side, the time; for perimeter and area both sides), so "makes
 * sense in the story" and "answers the question" are the same thing.
 */
export function senseStory(rng: Rng): QS {
  const pick = rng.pick<(q: Rng) => QS>([
    frameTask,
    innerTask,
    innerTask,
    (q) => garden(q, "width"),
    (q) => rectPA(q, "both"),
    (q) => consec(q, true, "small"),
    (q) => consec(q, false, "small"),
    landing,
    (q) => pyth(q, "short"),
  ]);
  return pick(rng);
}

/** Level 3 practice: quadratic stories, both times of a throw, which solution makes sense, which equation fits, work-rate. */
export function generate3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.36) return quadExercise(rng.pick(QUAD_STORIES)(rng));
  if (r < 0.46) return throwBothTask(rng);
  if (r < 0.58) return senseTask(senseStory(rng), rng);
  if (r < 0.72) {
    const pick = rng.pick([frameTask, innerTask, garden, rectPA, (q: Rng) => consec(q), pyth, (q: Rng) => {
        const ctx = q.pick([0, 1, 2, 3] as const);
        return workQuad(ctx, ...workQuadPair(ctx, q), "fast");
      }]);
    return equationTask(pick(rng), rng);
  }
  return work(rng);
}
