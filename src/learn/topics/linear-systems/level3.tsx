"use client";

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { mistakeList, plain, pt, side, term, val, type Msg } from "../lines/level2";
import {
  backFrames,
  opText,
  backSolve,
  check3Note,
  combine,
  elimFactors,
  gaussFrames,
  gaussPlan,
  isZeroRow,
  products,
  rowSrc,
  solveFrames,
  stack,
  t3,
  tripleSrc,
  tripleText,
  V3S,
  XYZ,
  type Names,
  type Row,
  type V3,
} from "./gauss";
import { SystemCard } from "./board";
import { GaussLab, ParabolaLab } from "./lab3";
import { joinText, xyWhen, type Choice } from "./level2";

// ---------------------------------------------------------------------------
// Level 3: three equations with three unknowns. Step form and back substitution,
// the Gauss algorithm, special cases with a parameter, and the parabola through
// three points.

type Triple = [number, number, number];
const ROW = (x: number, y: number, z: number, c: number): Row => ({ x, y, z, c });
const through = (x: number, y: number, z: number, s: Triple): Row => ({ x, y, z, c: x * s[0] + y * s[1] + z * s[2] });
const scale = (r: Row, k: number): Row => ({ x: k * r.x, y: k * r.y, z: k * r.z, c: k * r.c });
const IDS = ["1", "2", "3"];
const LABELS = ["I", "II", "III"];

/** The system as plain display maths. */
const sysOf = (rows: Row[], labels = LABELS, names: Names = XYZ) => plain(stack(rows.map((r, i) => rowSrc(r, IDS[i], labels[i], names))));

/**
 * The system for the task card. Three rows are too wide for the fixed task maths size
 * at phone width, so they go into a card that scales with its width (see board.tsx).
 */
const sysCard = (rows: Row[]): Pick<Exercise, "visual"> => ({ visual: { component: SystemCard as never, props: { src: sysOf(rows) } } });

/** A row with every term shown, a 0 faded ("0x"), for a written calculation. */
function fullRowSrc(r: Row, id: string, label: string, names: Names = XYZ): string {
  // Non-breaking spaces: a label like "(−2 · I)" must not wrap onto two lines.
  const lab = label.replace(/ /g, "\u00a0");
  const parts: string[] = [];
  V3S.forEach((v, i) => {
    const k = r[v];
    const first = parts.length === 0;
    if (k === 0) parts.push(`${first ? "" : "+ "}\\fade{0 ${names[i]}}`);
    else parts.push(term(k, names[i], `${id}${v}`, first));
  });
  return `\\group{\\text{${lab}}#L${id} \\; ${parts.join(" ")} =#e${id} ${val(r.c, `${id}c`)}}#R${id}`;
}

const wrap = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/** Numbers a student would really type: whole numbers or halves. */
const nice = (v: number) => Number.isFinite(v) && Math.abs(v) < 200 && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const niceAll = (v: number[] | null): v is number[] => !!v && v.every(nice);

/** "2x^2-3x+1", "-t+3": a polynomial for the answer checker. */
function poly(terms: [number, string][]): string {
  let s = "";
  for (const [k, v] of terms) {
    if (k === 0) continue;
    const abs = Math.abs(k);
    const body = v ? (abs === 1 ? v : `${abs}${v}`) : `${abs}`;
    s += k < 0 ? `-${body}` : s ? `+${body}` : body;
  }
  return s || "0";
}

// ---------------------------------------------------------------------------
// Typical mistakes, simulated on the task's own numbers

/** Gauss with a typical slip, then back substitution (null if it breaks down). */
function slipSolve(rows: Row[], slip: "rhs" | "sign" | "back"): Triple | null {
  const cur = rows.map((r) => ({ ...r }));
  const plan: [number, number, V3][] = [
    [1, 0, "x"],
    [2, 0, "x"],
    [2, 1, "y"],
  ];
  let first = true;
  for (const [t, s, v] of plan) {
    if (cur[t][v] === 0) continue;
    const f = elimFactors(cur[t], cur[s], v);
    if (!f) return null;
    const [p, q] = f;
    let next = combine(p, cur[t], q, cur[s]);
    // The right sides are just added or subtracted, without the factors.
    if (slip === "rhs") next = { ...next, c: cur[t].c + Math.sign(q) * cur[s].c };
    // Subtracting, but only the eliminated term changes sign: the rest is added.
    if (slip === "sign" && first && q < 0) {
      const flip = combine(p, cur[t], -q, cur[s]);
      next = { ...flip, [v]: 0 };
    }
    first = false;
    cur[t] = next;
  }
  if (slip === "back") {
    const [A, B, C] = cur;
    if (!C.z || !B.y || !A.x) return null;
    const z = C.c / C.z;
    const y = (B.c + B.z * z) / B.y;
    return [(A.c - A.y * y - A.z * z) / A.x, y, z];
  }
  return backSolve(cur);
}

const RHS: Msg = [
  tx("Right side not multiplied", "Rechte Seite nicht multipliziert"),
  tx(
    "Ah, I see what happened! In a Gauss step you multiplied the coefficients, but the number on the **right side** has to be multiplied by the same factor.",
    "Ah, ich seh, was passiert ist! In einem Gauß-Schritt hast du die Koeffizienten multipliziert, aber die Zahl auf der **rechten Seite** muss mit demselben Faktor multipliziert werden.",
  ),
];
const SIGN: Msg = [
  tx("Not every sign flipped", "Nicht jedes Vorzeichen gedreht"),
  tx(
    "Close! When you subtract a multiple of an equation, **every** term of it changes sign, the right side too, not just the term that cancels.",
    "Knapp! Wenn du ein Vielfaches einer Gleichung abziehst, ändert **jeder** Term davon sein Vorzeichen, auch die rechte Seite, nicht nur der Term, der wegfällt.",
  ),
];
const BACK: Msg = [
  tx("Sign slip going back up", "Vorzeichenfehler beim Rückwärtseinsetzen"),
  tx(
    "Your elimination looks fine! But when you put $z$ into the middle row and solved for $y$, a term crossed the equals sign without changing its sign.",
    "Deine Elimination sieht gut aus! Aber als du $z$ in die mittlere Zeile eingesetzt und nach $y$ aufgelöst hast, ist ein Term ohne Vorzeichenwechsel über das Gleichheitszeichen gewandert.",
  ),
];

function gaussMistakes(rows: Row[], sol: Triple): Mistake[] {
  const mk = mistakeList(xyWhen(sol[0], sol[1]));
  const slips: ["rhs" | "sign" | "back", Msg][] = [
    ["sign", SIGN],
    ["rhs", RHS],
    ["back", BACK],
  ];
  for (const [slip, msg] of slips) {
    const v = slipSolve(rows, slip);
    if (niceAll(v)) mk.add(xyWhen(v[0], v[1]), ...msg);
  }
  return mk.list;
}

/** Back substitution in a system that is already in step form. */
function backMistakes(rows: Row[], sol: Triple): Mistake[] {
  const [A, B, C] = rows;
  const mk = mistakeList(xyWhen(sol[0], sol[1]));
  const xFrom = (y: number, z: number) => (A.c - A.y * y - A.z * z) / A.x;
  const Z = sol[2];
  if (B.z * Z !== 0) {
    const y = (B.c + B.z * Z) / B.y;
    if (nice(y) && nice(xFrom(y, Z))) mk.add(xyWhen(xFrom(y, Z), y), ...BACK);
  }
  if (Math.abs(B.y) !== 1) {
    const y = B.c - B.z * Z;
    mk.add(
      xyWhen(xFrom(y, Z), y),
      tx("Not divided yet", "Noch nicht geteilt"),
      tx(
        `Almost! In the middle row there's still $${t3(B.y, "y")}$ on the left. Divide by $${B.y}$ before you go on.`,
        `Fast! In der mittleren Zeile steht links noch $${t3(B.y, "y")}$. Teile durch $${B.y}$, bevor du weitermachst.`,
      ),
    );
  }
  if (C.z !== 1 && C.z !== 0) {
    const z = C.c;
    const y = (B.c - B.z * z) / B.y;
    if (nice(y) && nice(xFrom(y, z))) {
      mk.add(
        xyWhen(xFrom(y, z), y),
        tx("z not divided", "z nicht geteilt"),
        tx(
          `Careful at the start: the last row says $${t3(C.z, "z")} = ${C.c}$, so $z$ is $${wrap(C.c)} : ${wrap(C.z)}$, not $${C.c}$. Everything else builds on that.`,
          `Vorsicht ganz am Anfang: Die letzte Zeile sagt $${t3(C.z, "z")} = ${C.c}$, also ist $z = ${wrap(C.c)} : ${wrap(C.z)}$ und nicht $${C.c}$. Alles andere baut darauf auf.`,
        ),
      );
    }
  }
  const D = A.y * sol[1] + A.z * Z;
  if (D !== 0) {
    mk.add(
      xyWhen((A.c + D) / A.x, sol[1]),
      tx("Sign slip in the first row", "Vorzeichenfehler in der ersten Zeile"),
      tx(
        `$y = ${sol[1]}$ is right! But in (I), when the numbers moved to the right side to get $x$ alone, a sign didn't flip.`,
        `$y = ${sol[1]}$ stimmt! Aber in (I) hat beim Rüberbringen auf die rechte Seite ein Vorzeichen nicht gewechselt.`,
      ),
    );
  }
  return mk.list.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Task builders (lesson checks and practice)

const PAIR = (s: Triple): AnswerSpec => ({ kind: "pair", names: ["x", "y"], values: [s[0], s[1]] });
const GIVE_XY = tx("Give $x$ and $y$.", "Gib $x$ und $y$ an.");

function backExercise(rows: Row[]): Exercise {
  const sol = backSolve(rows) as Triple;
  const b = backFrames(rows, LABELS) as { frames: Frame[]; values: Triple };
  return {
    instruction: tx("Solve by back substitution", "Löse durch Rückwärtseinsetzen"),
    text: joinText(tx("The system is already in step form.", "Das LGS hat schon Stufenform."), GIVE_XY),
    ...sysCard(rows),
    answer: PAIR(sol),
    hint: tx(
      "Start at the bottom: the last row gives $z$. Put $z$ into the middle row to get $y$, then both into (I) to get $x$.",
      "Fang unten an: Die letzte Zeile liefert $z$. Setz $z$ in die mittlere Zeile ein, um $y$ zu bekommen, dann beides in (I) für $x$.",
    ),
    solution: [
      { math: stack(rows.map((r, i) => rowSrc(r, IDS[i], LABELS[i]))), note: tx("Step form: each row has one unknown fewer than the row above.", "Stufenform: Jede Zeile hat eine Unbekannte weniger als die darüber.") },
      ...b.frames,
      { math: tripleSrc(sol), note: tx(`So $L = \\{ ${tripleText(sol)} \\}$.`, `Also ist $L = \\{ ${tripleText(sol)} \\}$.`) },
    ],
    mistakes: backMistakes(rows, sol),
  };
}

function gaussExercise(rows: Row[]): Exercise {
  const s = solveFrames(rows) as { frames: Frame[]; values: Triple };
  return {
    instruction: tx("Solve with the Gauss algorithm", "Löse mit dem Gauß-Verfahren"),
    text: tx("Bring the system into step form, then solve it. Give $x$ and $y$ (you'll need $z$ on the way).", "Bring das LGS auf Stufenform und löse es. Gib $x$ und $y$ an (dafür brauchst du unterwegs auch $z$)."),
    ...sysCard(rows),
    answer: PAIR(s.values),
    hint: tx(
      "Use (I) to eliminate $x$ from (II) and (III). Then use the new second row to eliminate $y$ from the third. Then solve from the bottom up.",
      "Eliminiere mit (I) das $x$ aus (II) und (III). Eliminiere dann mit der neuen zweiten Zeile das $y$ aus der dritten. Dann von unten nach oben auflösen.",
    ),
    solution: s.frames,
    mistakes: gaussMistakes(rows, s.values),
  };
}

/** "Which equation does II − 2 · I give?" with the classic slips as wrong options. */
function stepExercise(rows: Row[], order: number[]): Exercise | null {
  const [I, II] = rows;
  const f = elimFactors(II, I, "x");
  if (!f) return null;
  const [p, q] = f;
  const right = combine(p, II, q, I);
  const noRhs = { ...right, c: p * II.c };
  const flip = { ...combine(p, II, -q, I), x: 0 };
  const onlyX = Math.abs(q) !== 1 ? { ...combine(p, II, Math.sign(q), I), x: 0 } : combine(p, II, -q, I);
  const eq = (r: Row) => plain(`${side([
    [r.x, "x", "x"],
    [r.y, "y", "y"],
    [r.z, "z", "z"],
  ])} = ${val(r.c, "c")}`);
  const all = [right, noRhs, flip, onlyX].map(eq);
  if (new Set(all).size < 4) return null;
  const opT = opText(p, "II", q, "I");
  const answer: Choice = { kind: "choice", options: order.map((i) => `$${all[i]}$`), correct: order.indexOf(0) };
  const signMsg: Msg =
    q < 0
      ? SIGN
      : [
          tx("Added everything?", "Alles addiert?"),
          tx(
            `In **${opT}** you **add** (I): every term keeps its sign. It looks like some terms were subtracted instead.`,
            `Bei **${opT}** wird (I) **addiert**: Jeder Term behält sein Vorzeichen. Sieht so aus, als hättest du manche Terme abgezogen.`,
          ),
        ];
  const msgs: Msg[] = [
    [
      tx("Right side forgotten", "Rechte Seite vergessen"),
      tx(
        "The left side is right! But the right side belongs to the equation too: it has to be combined in the same way.",
        "Die linke Seite stimmt! Aber die rechte Seite gehört auch zur Gleichung: Sie muss genauso verrechnet werden.",
      ),
    ],
    signMsg,
    Math.abs(q) !== 1
      ? [
          tx("Only one term multiplied", "Nur ein Term multipliziert"),
          tx(
            `You made the $x$-terms cancel, nice! But $${Math.abs(q)} \\cdot$ (I) means **every** term of (I) times $${Math.abs(q)}$, the right side too.`,
            `Die $x$-Terme fallen weg, gut! Aber $${Math.abs(q)} \\cdot$ (I) heißt: **jeder** Term von (I) mal $${Math.abs(q)}$, auch die rechte Seite.`,
          ),
        ]
      : [
          tx("Plus or minus?", "Plus oder minus?"),
          tx("Hmm, $x$ didn't cancel there. Look at the operation again: plus or minus?", "Hm, da ist $x$ ja gar nicht weggefallen. Schau dir die Rechenart noch mal an: plus oder minus?"),
        ],
  ];
  const mk = mistakeList(answer);
  msgs.forEach((m, k) => mk.add({ ...answer, correct: order.indexOf(k + 1) }, ...m));
  const scaledI = scale(I, q);
  const top = p === 1 ? fullRowSrc(II, "2", "(II)") : fullRowSrc(scale(II, p), "2", `(${p} · II)`);
  const qLabel = q === 1 ? "(I)" : q === -1 ? "(−I)" : `(${String(q).replace("-", "−")} · I)`;
  const intro: Text =
    p === 1 && q === 1
      ? tx(`**${opT}** means: add (I) to (II), term by term.`, `**${opT}** heißt: Addiere (I) zu (II), Term für Term.`)
      : p === 1 && q === -1
        ? tx(`**${opT}** means: subtract (I) from (II). That's the same as adding $-1 \\cdot$ (I).`, `**${opT}** heißt: Ziehe (I) von (II) ab. Das ist dasselbe, wie $-1 \\cdot$ (I) zu addieren.`)
        : tx(`**${opT}** means: add $${q}$ times (I) to ${p === 1 ? "(II)" : `$${p}$ times (II)`}.`, `**${opT}** heißt: Addiere das $${wrap(q)}$-Fache von (I) zu ${p === 1 ? "(II)" : `$${p} \\cdot$ (II)`}.`);
  const scaleNote: Text =
    q === 1
      ? tx("Write (I) under (II), column by column.", "Schreib (I) spaltenweise unter (II).")
      : q === -1
        ? tx("Subtracting (I) flips **every** sign of (I), the right side too.", "Wer (I) abzieht, dreht **jedes** Vorzeichen von (I) um, auch auf der rechten Seite.")
        : tx(`Multiply **every** term of (I) by $${q}$, the right side too.`, `Multipliziere **jeden** Term von (I) mit $${q}$, auch die rechte Seite.`);
  return {
    instruction: tx("One Gauss step", "Ein Gauß-Schritt"),
    text: tx(`Calculate **(IIa) = ${opT}**. Which equation do you get?`, `Berechne **(IIa) = ${opT}**. Welche Gleichung erhältst du?`),
    ...sysCard(rows),
    answer,
    hint: tx(
      `Write $${wrap(q)} \\cdot$ (I) term by term under ${p === 1 ? "(II)" : `$${p} \\cdot$ (II)`} and add column by column, the right side too.`,
      `Schreib $${wrap(q)} \\cdot$ (I) Term für Term unter ${p === 1 ? "(II)" : `$${p} \\cdot$ (II)`} und addiere spaltenweise, auch die rechten Seiten.`,
    ),
    solution: [
      { math: stack([rowSrc(I, "1", "I"), rowSrc(II, "2", "II")]), note: intro },
      { math: stack([top, fullRowSrc(scaledI, "m", qLabel)]), note: scaleNote },
      {
        math: stack([top, fullRowSrc(scaledI, "m", qLabel), fullRowSrc(right, "n", "(IIa)")]),
        note: tx(`Add column by column: $x$ cancels. (IIa) is $${all[0]}$.`, `Addiere spaltenweise: $x$ fällt weg. (IIa) lautet $${all[0]}$.`),
      },
    ],
    mistakes: mk.list,
  };
}

const COUNT3 = [tx("Exactly one solution", "Genau eine Lösung"), tx("No solution", "Keine Lösung"), tx("Infinitely many solutions", "Unendlich viele Lösungen")];

function specialExercise(rows: Row[]): Exercise | null {
  const g = gaussFrames(rows);
  if (!g) return null;
  const last = g.final[2];
  const kind = !isZeroRow(last) ? 0 : last.c !== 0 ? 1 : 2;
  const answer: Choice = { kind: "choice", options: COUNT3, correct: kind };
  const frames = [...g.frames];
  const tone = kind === 1 ? "red" : "green";
  const verdict: Text =
    kind === 0
      ? tx(
          `The last row still contains $z$: it fixes one value for $z$, then $y$ and $x$ follow. **Exactly one solution.**`,
          `Die letzte Zeile enthält noch $z$: Sie legt einen Wert für $z$ fest, dann folgen $y$ und $x$. **Genau eine Lösung.**`,
        )
      : kind === 1
        ? tx(
            `All unknowns cancelled and $0 = ${last.c}$ is **false**: a contradiction. No triple can fix that, so $L = \\{ \\}$.`,
            `Alle Unbekannten sind weggefallen und $0 = ${last.c}$ ist **falsch**: ein Widerspruch. Kein Zahlentripel hilft da, also ist $L = \\{ \\}$.`,
          )
        : tx(
            "All unknowns cancelled and $0 = 0$ is **always true**. Only two real conditions are left for three unknowns, so one stays free: **infinitely many** solutions.",
            "Alle Unbekannten sind weggefallen und $0 = 0$ ist **immer wahr**. Für drei Unbekannte bleiben nur zwei echte Bedingungen, eine Variable bleibt frei: **unendlich viele** Lösungen.",
          );
  frames.push({ math: stack(g.final.map((r, i) => rowSrc(r, IDS[i], g.labels[i], XYZ, i === 2 ? (kind === 0 ? "group" : tone) : "group"))), note: verdict });
  const mk = mistakeList(answer);
  const pick = (i: number): AnswerSpec => ({ ...answer, correct: i });
  const ONE_WRONG: Msg = [
    tx("Look at the last row", "Schau auf die letzte Zeile"),
    tx(
      "In step form the last row has lost **all** unknowns. A row like that can't fix a value for $z$.",
      "In der Stufenform hat die letzte Zeile **alle** Unbekannten verloren. So eine Zeile kann keinen Wert für $z$ festlegen.",
    ),
  ];
  if (kind === 0) {
    const msg: Msg = [
      tx("z is still there", "z ist noch da"),
      tx("Bring it to step form first: the last row still contains $z$, so you can solve for it.", "Bring es erst auf Stufenform: Die letzte Zeile enthält noch $z$, du kannst also danach auflösen."),
    ];
    mk.add(pick(1), ...msg);
    mk.add(pick(2), ...msg);
  } else if (kind === 1) {
    mk.add(pick(2), tx("True or false?", "Wahr oder falsch?"), tx(`Right, everything cancels! But $0 = ${last.c}$ is **false**, not always true. A false statement means no solution.`, `Stimmt, alles fällt weg! Aber $0 = ${last.c}$ ist **falsch** und nicht immer wahr. Eine falsche Aussage heißt: keine Lösung.`));
    mk.add(pick(0), ...ONE_WRONG);
  } else {
    mk.add(pick(1), tx("True or false?", "Wahr oder falsch?"), tx("Right, everything cancels! But $0 = 0$ is **true**: it rules nothing out. That means infinitely many, not none.", "Stimmt, alles fällt weg! Aber $0 = 0$ ist **wahr**: Das schließt nichts aus. Das heißt unendlich viele, nicht keine."));
    mk.add(pick(0), ...ONE_WRONG);
  }
  return {
    instruction: tx("How many solutions?", "Wie viele Lösungen?"),
    text: tx("Use the Gauss algorithm. How many solutions does the system have?", "Nutze das Gauß-Verfahren. Wie viele Lösungen hat das LGS?"),
    ...sysCard(rows),
    answer,
    hint: tx(
      "Bring it to step form. If the last row loses all three unknowns, read what's left: a true or a false statement?",
      "Bring es auf Stufenform. Verliert die letzte Zeile alle drei Unbekannten, schau, was übrig bleibt: eine wahre oder eine falsche Aussage?",
    ),
    solution: frames,
    mistakes: mk.list,
  };
}

/** y(t) = r + k·t as display maths and as text for the checker. */
const tSrc = (r: number, k: number, id: string) =>
  side([
    [r, "", `${id}0`],
    [k, "t", `${id}1`],
  ]);

/**
 * A system with infinitely many solutions, built backwards from its step form
 * (I) x + b·y + c·z = d and (IIa) y + m·z = r, so that y and x come out as whole-number terms in t.
 */
function paramExercise(rows: Row[], ask: "x" | "y"): Exercise | null {
  const g = gaussFrames(rows);
  if (!g) return null;
  const [A, B, C] = g.final;
  if (!isZeroRow(C) || C.c !== 0 || A.x !== 1 || B.y === 0 || B.z % B.y !== 0 || B.c % B.y !== 0) return null;
  // y = r0 + r1 t, x = s0 + s1 t
  const r0 = B.c / B.y;
  const r1 = -B.z / B.y;
  const s0 = A.c - A.y * r0;
  const s1 = -A.y * r1 - A.z;
  const frames: Frame[] = [...g.frames];
  frames.push({
    math: stack(g.final.map((r, i) => rowSrc(r, IDS[i], g.labels[i], XYZ, i === 2 ? "green" : "group"))),
    note: tx(
      "The last row became $0 = 0$: always true. Two conditions for three unknowns, so one unknown is **free**.",
      "Die letzte Zeile ist $0 = 0$ geworden: immer wahr. Zwei Bedingungen für drei Unbekannte, also ist eine Unbekannte **frei**.",
    ),
  });
  frames.push({ math: `z#v2z =#ez t#t`, note: tx("Set $z = t$, where $t$ can be any real number (a **parameter**).", "Setze $z = t$, wobei $t$ eine beliebige reelle Zahl ist (ein **Parameter**).") });
  frames.push({
    math: `${term(B.y, "y", "2y", true)} ${term(B.z, "t", "2t", false)} =#e2 ${val(B.c, "2c")}`,
    note: tx(`Put $z = t$ into (${g.labels[1]}).`, `Setze $z = t$ in (${g.labels[1]}) ein.`),
  });
  frames.push({ math: `y#v2y =#e2 ${tSrc(r0, r1, "y")}`, note: tx("Solve for $y$: the $t$-term moves to the right side.", "Löse nach $y$ auf: Der $t$-Term kommt auf die rechte Seite.") });
  const yBr = `(${tSrc(r0, r1, "y")})#yb`;
  const bTerm = A.y === 0 ? "" : `${A.y < 0 ? "-" : "+"} ${Math.abs(A.y) === 1 ? "" : `${Math.abs(A.y)} \\cdot `}${yBr}`;
  frames.push({
    math: `x#v1x ${bTerm} ${term(A.z, "t", "1t", false)} =#e1 ${val(A.c, "1c")}`,
    note: tx(`Put $y$ and $z = t$ into (I).`, `Setze $y$ und $z = t$ in (I) ein.`),
  });
  frames.push({ math: `x#v1x =#e1 ${tSrc(s0, s1, "x")}`, note: tx("Multiply out and solve for $x$.", "Multipliziere aus und löse nach $x$ auf.") });
  frames.push({
    math: `L = "{" (${tSrc(s0, s1, "x")} \\, | \\, ${tSrc(r0, r1, "y")} \\, | \\, t) \\, | \\, t \\in "ℝ" "}"`,
    note: tx("Every value of $t$ gives one solution, for example $t = 0$. Infinitely many!", "Jeder Wert von $t$ liefert eine Lösung, zum Beispiel $t = 0$. Unendlich viele!"),
  });
  const xVal = poly([
    [s1, "t"],
    [s0, ""],
  ]);
  const yVal = poly([
    [r1, "t"],
    [r0, ""],
  ]);
  const want = ask === "x" ? xVal : yVal;
  const answer: AnswerSpec = { kind: "expr", value: want, prefix: `${ask} =` };
  const mk = mistakeList(answer);
  if (ask === "x") {
    mk.add({ kind: "expr", value: yVal }, tx("That's y", "Das ist y"), tx("That's the term for $y$! Now put it into (I) and solve for $x$.", "Das ist der Term für $y$! Setz ihn jetzt in (I) ein und löse nach $x$ auf."));
    // y with the t-term moved without changing its sign
    const r1Bad = -r1;
    mk.add(
      {
        kind: "expr",
        value: poly([
          [-A.y * r1Bad - A.z, "t"],
          [s0, ""],
        ]),
      },
      ...BACK_T,
    );
    if (A.z !== 0) {
      mk.add(
        {
          kind: "expr",
          value: poly([
            [-A.y * r1, "t"],
            [s0, ""],
          ]),
        },
        tx("z forgotten", "z vergessen"),
        tx(`Don't forget the $z$-term in (I): with $z = t$ it becomes $${t3(A.z, "t")}$.`, `Vergiss den $z$-Term in (I) nicht: Mit $z = t$ wird daraus $${t3(A.z, "t")}$.`),
      );
    }
  } else {
    mk.add(
      {
        kind: "expr",
        value: poly([
          [-r1, "t"],
          [r0, ""],
        ]),
      },
      ...BACK_T,
    );
  }
  return {
    instruction: tx("Infinitely many solutions", "Unendlich viele Lösungen"),
    text: tx(
      `This system has infinitely many solutions. Use the Gauss algorithm, set $z = t$ and give $${ask}$ in terms of $t$.`,
      `Dieses LGS hat unendlich viele Lösungen. Nutze das Gauß-Verfahren, setze $z = t$ und gib $${ask}$ in Abhängigkeit von $t$ an.`,
    ),
    ...sysCard(rows),
    answer,
    hint: tx(
      `After Gauss the last row is $0 = 0$. Put $z = t$ into the middle row and solve for $y$${ask === "x" ? ", then put $y$ and $t$ into (I)" : ""}.`,
      `Nach Gauß ist die letzte Zeile $0 = 0$. Setz $z = t$ in die mittlere Zeile ein und löse nach $y$ auf${ask === "x" ? ", dann $y$ und $t$ in (I) einsetzen" : ""}.`,
    ),
    solution: frames,
    mistakes: mk.list,
  };
}
const BACK_T: Msg = [
  tx("Sign of the t-term", "Vorzeichen vom t-Term"),
  tx(
    "Nearly! When the $t$-term moves across the equals sign in the middle row, its sign has to change.",
    "Fast! Wenn der $t$-Term in der mittleren Zeile über das Gleichheitszeichen wandert, muss sich sein Vorzeichen ändern.",
  ),
];

// ---------------------------------------------------------------------------
// The parabola through three points

const ABC: Names = ["a", "b", "c"];
const fPoly = (a: number, b: number, c: number) =>
  poly([
    [a, "x^2"],
    [b, "x"],
    [c, ""],
  ]);
function fSrc(a: number, b: number, c: number): string {
  return `f(x) =#fe ${side([
    [a, "x^2", "fa"],
    [b, "x", "fb"],
    [c, "", "fc"],
  ])}`;
}

/** Solve the 3×3 system by Cramer's rule (for simulated mistakes; may give fractions). */
function cramer(rows: Row[]): Triple | null {
  const d3 = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = rows.map((r) => [r.x, r.y, r.z]);
  const D = d3(M);
  if (D === 0) return null;
  const col = (k: number) => d3(M.map((row, i) => row.map((v, j) => (j === k ? rows[i].c : v))));
  return [col(0) / D, col(1) / D, col(2) / D];
}

/** Rows for the points, the pivot row first (x = ±1 if possible) and the point with x = 0 last. */
function pointRows(P: [number, number][]): { rows: Row[]; order: number[] } {
  const idx = [0, 1, 2];
  const zero = idx.find((i) => P[i][0] === 0);
  const one = idx.find((i) => Math.abs(P[i][0]) === 1);
  const first = one ?? idx.find((i) => i !== zero)!;
  const order = [first, ...idx.filter((i) => i !== first && i !== zero), ...(zero !== undefined && zero !== first ? [zero] : [])];
  return { rows: order.map((i) => ROW(P[i][0] * P[i][0], P[i][0], 1, P[i][1])), order };
}

function parabolaExercise(P: [number, number][], coef: Triple): Exercise | null {
  const names = ["A", "B", "C"];
  const { rows, order } = pointRows(P);
  const g = gaussFrames(rows, ABC);
  if (!g) return null;
  const b = backFrames(g.final, g.labels, ABC);
  if (!b || b.values.some((v, i) => v !== coef[i])) return null;
  const [a, bb, c] = coef;
  const ptsText = P.map((p, i) => `$${pt(p[0], p[1], names[i])}$`).join(", ");
  const put = order
    .map((i, k) => {
      const [x, y] = P[i];
      const xs = x < 0 ? `(${x})` : `${x}`;
      return `(${LABELS[k]}) $${pt(x, y, names[i])}$: $a \\cdot ${xs}^2 + b \\cdot ${xs} + c = ${y}$`;
    })
    .join("; ");
  // The check with the point farthest from the y-axis.
  const q = P.reduce((m, p) => (Math.abs(p[0]) > Math.abs(m[0]) ? p : m));
  const parts = [a * q[0] * q[0], bb * q[0], c].filter((v) => v !== 0);
  const sum = parts.map((v, i) => (i === 0 ? `${v}` : v < 0 ? `- ${-v}` : `+ ${v}`)).join(" ");
  const probe = `$f(${q[0]}) = ${sum || 0} = ${q[1]}$`;
  const frames: Frame[] = [
    { math: `f(x) =#fe a#fa x^2 +#sb b#fb x +#sc c#fc`, note: tx("Three unknowns $a$, $b$, $c$: each point gives one equation.", "Drei Unbekannte $a$, $b$, $c$: Jeder Punkt liefert eine Gleichung.") },
    {
      ...g.frames[0],
      note: tx(`Put each point into $f(x) = y$. ${put}.`, `Setze jeden Punkt in $f(x) = y$ ein. ${put}.`),
    },
    ...g.frames.slice(1),
    ...b.frames,
    { math: fSrc(a, bb, c), note: tx(`So $${plain(fSrc(a, bb, c))}$. Check: ${probe}. True!`, `Also ist $${plain(fSrc(a, bb, c))}$. Probe: ${probe}. Stimmt!`) },
  ];
  const answer: AnswerSpec = { kind: "expr", value: fPoly(a, bb, c), prefix: "f(x) =" };
  const mk = mistakeList(answer);
  // (−2)² read as −4
  const neg = P.find((p) => p[0] < 0);
  if (neg) {
    const wrong = cramer(rows.map((r) => (r.y < 0 ? { ...r, x: -r.x } : r)));
    const n = neg[0];
    if (niceAll(wrong)) {
      mk.add(
        { kind: "expr", value: fPoly(wrong[0], wrong[1], wrong[2]) },
        tx("Squaring a negative number", "Negative Zahl quadriert"),
        tx(
          `Ooh, careful with the negative $x$: $(${n})^2 = +${n * n}$, not $${-n * n}$. A square is never negative, so the number in front of $a$ is always positive.`,
          `Ooh, Vorsicht beim negativen $x$: $(${n})^2 = +${n * n}$, nicht $${-n * n}$. Ein Quadrat ist nie negativ, die Zahl vor $a$ ist also immer positiv.`,
        ),
      );
    }
  }
  if (a !== c) {
    mk.add(
      { kind: "expr", value: fPoly(c, bb, a) },
      tx("a and c swapped", "a und c vertauscht"),
      tx("Your numbers are right, just in the wrong places: $a$ belongs to $x^2$ and $c$ is the number on its own.", "Deine Zahlen stimmen, nur an der falschen Stelle: $a$ gehört zu $x^2$, $c$ ist die Zahl ohne $x$."),
    );
  }
  if (bb !== 0) {
    mk.add(
      { kind: "expr", value: fPoly(a, -bb, c) },
      tx("Sign of b", "Vorzeichen von b"),
      tx("Nearly! Check the sign of $b$: put one of the points into your $f(x)$ and see whether it really fits.", "Fast! Prüf das Vorzeichen von $b$: Setz einen der Punkte in dein $f(x)$ ein und schau, ob er wirklich passt."),
    );
  }
  return {
    instruction: tx("Parabola through three points", "Parabel durch drei Punkte"),
    text: tx(
      `Find the parabola $f(x) = ax^2 + bx + c$ through ${ptsText}.`,
      `Bestimme die Parabel $f(x) = ax^2 + bx + c$ durch ${ptsText}.`,
    ),
    answer,
    hint: tx(
      "Put each point into $f(x) = ax^2 + bx + c$: that gives three equations for $a$, $b$, $c$. Solve them with the Gauss algorithm.",
      "Setz jeden Punkt in $f(x) = ax^2 + bx + c$ ein: Das ergibt drei Gleichungen für $a$, $b$, $c$. Löse sie mit dem Gauß-Verfahren.",
    ),
    solution: frames,
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Word problem: three prices

type Shop = { defs: Text; items: { en: string; de: string }[]; unit: Text; words: [[string, string], [string, string]][]; say: (en: string, de: string, total: number) => Text; ask: (i: number) => Text; answer: (i: number, v: number) => Text };

const SHOPS: Shop[] = [
  {
    defs: tx(`x ": notebook" \\quad y ": pen" \\quad z ": ruler"`, `x ": Heft" \\quad y ": Stift" \\quad z ": Lineal"`),
    items: [{ en: "a notebook", de: "ein Heft" }, { en: "a pen", de: "einen Stift" }, { en: "a ruler", de: "ein Lineal" }],
    unit: "€",
    words: [
      [
        ["notebook", "notebooks"],
        ["Heft", "Hefte"],
      ],
      [
        ["pen", "pens"],
        ["Stift", "Stifte"],
      ],
      [
        ["ruler", "rulers"],
        ["Lineal", "Lineale"],
      ],
    ],
    say: (en, de, total) => tx(`${en} cost ${total} €.`, `${de} kosten ${total} €.`),
    ask: (i) => [tx("What does one notebook cost?", "Was kostet ein Heft?"), tx("What does one pen cost?", "Was kostet ein Stift?"), tx("What does one ruler cost?", "Was kostet ein Lineal?")][i],
    answer: (i, v) => [tx(`One notebook costs ${v} €.`, `Ein Heft kostet ${v} €.`), tx(`One pen costs ${v} €.`, `Ein Stift kostet ${v} €.`), tx(`One ruler costs ${v} €.`, `Ein Lineal kostet ${v} €.`)][i],
  },
  {
    defs: tx(`x ": adult" \\quad y ": student" \\quad z ": child"`, `x ": Erwachsene" \\quad y ": Schüler" \\quad z ": Kinder"`),
    items: [{ en: "an adult ticket", de: "eine Erwachsenenkarte" }, { en: "a student ticket", de: "eine Schülerkarte" }, { en: "a child ticket", de: "eine Kinderkarte" }],
    unit: "€",
    words: [
      [
        ["adult", "adults"],
        ["Erwachsener", "Erwachsene"],
      ],
      [
        ["student", "students"],
        ["Schüler", "Schüler"],
      ],
      [
        ["child", "children"],
        ["Kind", "Kinder"],
      ],
    ],
    say: (en, de, total) => tx(`${en} pay ${total} € for the zoo.`, `${de} zahlen ${total} € für den Zoo.`),
    ask: (i) => [tx("What does an adult ticket cost?", "Was kostet eine Erwachsenenkarte?"), tx("What does a student ticket cost?", "Was kostet eine Schülerkarte?"), tx("What does a child ticket cost?", "Was kostet eine Kinderkarte?")][i],
    answer: (i, v) => [tx(`An adult ticket costs ${v} €.`, `Eine Erwachsenenkarte kostet ${v} €.`), tx(`A student ticket costs ${v} €.`, `Eine Schülerkarte kostet ${v} €.`), tx(`A child ticket costs ${v} €.`, `Eine Kinderkarte kostet ${v} €.`)][i],
  },
];

/** "2 notebooks, 1 pen and 3 rulers cost 17 €." (items with count 0 are left out) */
function purchase(shop: Shop, n: Triple, total: number): Text {
  const list = (lang: 0 | 1, and: string) => {
    const parts = n.flatMap((k, i) => (k === 0 ? [] : [`${k} ${shop.words[i][lang][k === 1 ? 0 : 1]}`]));
    return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}` : parts[0];
  };
  return shop.say(list(0, "and"), list(1, "und"), total);
}

function wordExercise(shop: Shop, counts: Triple[], prices: Triple, ask: number): Exercise | null {
  const rows = counts.map((n) => through(n[0], n[1], n[2], prices));
  const s = solveFrames(rows);
  if (!s || s.values.some((v, i) => v !== prices[i])) return null;
  const v = prices[ask];
  const names = ["x", "y", "z"];
  const frames = [{ math: shop.defs, note: tx("One letter for each price (in €), one equation for each purchase.", "Ein Buchstabe pro Preis (in €), eine Gleichung pro Einkauf.") }, ...s.frames];
  frames[frames.length - 1] = { ...frames[frames.length - 1], note: joinText(frames[frames.length - 1].note, shop.answer(ask, v)) };
  const mk = mistakeList({ kind: "number", value: v, unit: shop.unit });
  prices.forEach((p, i) => {
    if (i === ask) return;
    mk.add(
      { kind: "number", value: p, unit: shop.unit },
      tx("Another price", "Ein anderer Preis"),
      tx(`That's the value of $${names[i]}$, the price of ${shop.items[i].en}. The question asks for $${names[ask]}$.`, `Das ist der Wert von $${names[i]}$, der Preis für ${shop.items[i].de}. Gefragt ist nach $${names[ask]}$.`),
    );
  });
  return {
    instruction: tx("Word problem", "Textaufgabe"),
    text: joinText(...counts.map((n, k) => purchase(shop, n, rows[k].c)), shop.ask(ask)),
    answer: { kind: "number", value: v, unit: shop.unit },
    hint: tx(
      "One letter per price, one equation per sentence. Then the Gauss algorithm.",
      "Ein Buchstabe pro Preis, eine Gleichung pro Satz. Dann das Gauß-Verfahren.",
    ),
    solution: frames,
    mistakes: mk.list,
  };
}

// ---------------------------------------------------------------------------
// Practice

function pickTriple(rng: Rng, lo = -3, hi = 4): Triple {
  for (;;) {
    const t: Triple = [rng.int(lo, hi), rng.int(lo, hi), rng.int(lo, hi)];
    if (t.some((v) => v !== 0) && new Set(t).size > 1) return t;
  }
}

/** Nice intermediate numbers in every Gauss step. */
function tame(rows: Row[]): boolean {
  const plan = gaussPlan(rows);
  if (!plan || plan.steps.length < 2) return false;
  if (plan.steps.some((s) => s.p > 5 || Math.abs(s.q) > 6)) return false;
  const all = [...rows, ...plan.final];
  return all.every((r) => Math.abs(r.x) <= 20 && Math.abs(r.y) <= 20 && Math.abs(r.z) <= 30 && Math.abs(r.c) <= 60);
}

function randomSystem(rng: Rng, sol: Triple): Row[] {
  for (;;) {
    const lead = rng.pick([1, 1, 1, 2, -1]);
    const r1 = through(lead, rng.nonZero(-3, 3), rng.int(-3, 3), sol);
    const r2 = through(rng.nonZero(-3, 3), rng.int(-3, 3), rng.int(-3, 3), sol);
    const r3 = through(rng.nonZero(-3, 3), rng.int(-3, 3), rng.int(-3, 3), sol);
    const rows = [r1, r2, r3];
    if (!tame(rows)) continue;
    const plan = gaussPlan(rows)!;
    const v = backSolve(plan.final);
    if (!v || v.some((x, i) => x !== sol[i])) continue;
    return rows;
  }
}

function backTask(rng: Rng): Exercise {
  for (;;) {
    const sol = pickTriple(rng);
    const A = through(rng.pick([1, 1, 2, -1]), rng.int(-3, 3), rng.int(-3, 3), sol);
    const B = through(0, rng.pick([1, 2, 3, -1, -2]), rng.nonZero(-3, 3), sol);
    const C = through(0, 0, rng.pick([1, 2, 3, 4, -1, -2]), sol);
    if (A.y === 0 && A.z === 0) continue;
    const v = backSolve([A, B, C]);
    if (!v || v.some((x, i) => x !== sol[i]) || Math.abs(A.c) > 30) continue;
    return backExercise([A, B, C]);
  }
}

function stepTask(rng: Rng): Exercise {
  for (;;) {
    const rows = randomSystem(rng, pickTriple(rng));
    const ex = stepExercise(rows, rng.shuffle([0, 1, 2, 3]));
    if (ex) return ex;
  }
}

function gaussTask(rng: Rng): Exercise {
  return gaussExercise(randomSystem(rng, pickTriple(rng)));
}

/** Step form first, then mixed up by row operations: the Gauss algorithm undoes them. */
function mixedUp(rng: Rng, I: Row, II: Row, III: Row): Row[] {
  const k = rng.nonZero(-3, 3);
  const u = rng.pick([1, 1, -1, 2]);
  const j = rng.nonZero(-2, 2);
  const l = rng.nonZero(-3, 3);
  const II2 = combine(u, II, k, I);
  const III2 = combine(1, combine(j, II, l, I), 1, III);
  return [I, II2, III2];
}

/** Two rows that are multiples of each other make a task too obvious. */
const proportional = (a: Row, b: Row) => a.x * b.y === a.y * b.x && a.x * b.z === a.z * b.x && a.y * b.z === a.z * b.y;
const anyProportional = (rows: Row[]) => proportional(rows[0], rows[1]) || proportional(rows[0], rows[2]) || proportional(rows[1], rows[2]);

function specialTask(rng: Rng): Exercise {
  const kind = rng.pick([0, 1, 1, 2, 2]);
  for (;;) {
    const sol = pickTriple(rng);
    const I = through(1, rng.nonZero(-3, 3), rng.int(-3, 3), sol);
    const II = through(0, 1, rng.nonZero(-3, 3), sol);
    const III = kind === 0 ? through(0, 0, rng.nonZero(-3, 3), sol) : ROW(0, 0, 0, kind === 1 ? rng.nonZero(-4, 4) : 0);
    const rows = mixedUp(rng, I, II, III);
    if (anyProportional(rows) || rows.some((r) => isZeroRow(r) || Math.abs(r.c) > 40 || Math.abs(r.x) > 9 || Math.abs(r.y) > 9 || Math.abs(r.z) > 9)) continue;
    const ex = specialExercise(rows);
    if (ex && (ex.answer as Choice).correct === kind) return ex;
  }
}

function paramTask(rng: Rng): Exercise {
  for (;;) {
    const sol = pickTriple(rng);
    const I = through(1, rng.nonZero(-3, 3), rng.nonZero(-3, 3), sol);
    const II = through(0, 1, rng.nonZero(-3, 3), sol);
    const rows = mixedUp(rng, I, II, ROW(0, 0, 0, 0));
    if (anyProportional(rows) || rows.some((r) => isZeroRow(r) || Math.abs(r.c) > 40 || Math.abs(r.x) > 9 || Math.abs(r.y) > 9 || Math.abs(r.z) > 9)) continue;
    const ex = paramExercise(rows, rng.chance(0.6) ? "x" : "y");
    if (ex) return ex;
  }
}

function parabolaTask(rng: Rng): Exercise {
  for (;;) {
    const a = rng.pick([-2, -1, 1, 1, 2, 3]);
    const b = rng.int(-4, 4);
    const c = rng.int(-4, 5);
    // One point with x = ±1 keeps the Gauss steps small; often one with x = 0 gives c at once.
    const one = rng.pick([-1, 1]);
    const rest = rng.shuffle([-2, -1, 0, 0, 1, 2, 3].filter((x) => x !== one));
    const xs = [one, rest[0], rest.find((x) => x !== rest[0])!];
    const P = xs.sort((p, q) => p - q).map((x): [number, number] => [x, a * x * x + b * x + c]);
    if (P.some((p) => Math.abs(p[1]) > 15)) continue;
    const ex = parabolaExercise(P, [a, b, c]);
    if (ex) return ex;
  }
}

function wordTask(rng: Rng): Exercise {
  const shop = rng.pick(SHOPS);
  for (;;) {
    const prices: Triple = [rng.int(2, 9), rng.int(1, 6), rng.int(1, 5)];
    if (new Set(prices).size < 3) continue;
    const counts: Triple[] = [
      [1, rng.int(1, 3), rng.int(1, 3)],
      [rng.int(1, 3), rng.int(0, 3), rng.int(1, 3)],
      [rng.int(1, 3), rng.int(1, 3), rng.int(0, 2)],
    ];
    const rows = counts.map((n) => through(n[0], n[1], n[2], prices));
    if (!tame(rows)) continue;
    const ex = wordExercise(shop, counts, prices, rng.int(0, 2));
    if (ex) return ex;
  }
}

/** Level 3 practice: back substitution, one Gauss step, full Gauss, special cases, parameters, parabolas, word problems. */
export function generate3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.13) return backTask(rng);
  if (r < 0.25) return stepTask(rng);
  if (r < 0.45) return gaussTask(rng);
  if (r < 0.57) return specialTask(rng);
  if (r < 0.69) return paramTask(rng);
  if (r < 0.88) return parabolaTask(rng);
  return wordTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const S0: Row[] = [ROW(1, 1, 1, 6), ROW(2, -1, 1, 3), ROW(1, 2, -1, 2)];
const STEP0: Row[] = [ROW(1, 1, 1, 6), ROW(0, 1, 2, 8), ROW(0, 0, 3, 9)];
const SOL0: Triple = [1, 2, 3];

const probeRow = (r: Row, id: string, label: string) =>
  `\\green{\\text{(${label})}#L${id} \\; ${products([
    [r.x, SOL0[0], `${id}x`],
    [r.y, SOL0[1], `${id}y`],
    [r.z, SOL0[2], `${id}z`],
  ])} =#e${id} ${val(r.c, `${id}c`)}}#R${id}`;

const introFrames: Frame[] = (() => {
  const back = backFrames(STEP0, LABELS)!;
  // S0 gets its own token keys: the step-form system is a different one, so its rows
  // appear fresh instead of gliding out of S0.
  const A0 = ["a1", "a2", "a3"];
  return [
    {
      math: stack(S0.map((r, i) => rowSrc(r, A0[i], LABELS[i]))),
      note: tx(
        "Three unknowns need three equations. A solution is a **triple** of numbers $(x | y | z)$ that makes **all three** equations true.",
        "Drei Unbekannte brauchen drei Gleichungen. Eine Lösung ist ein **Zahlentripel** $(x | y | z)$, das **alle drei** Gleichungen erfüllt.",
      ),
    },
    {
      math: stack(S0.map((r, i) => probeRow(r, A0[i], LABELS[i]))),
      note: tx(
        "Try $(1 | 2 | 3)$: put it into every equation. All three are true, so $L = \\{ (1 | 2 | 3) \\}$. But how do you find it without guessing?",
        "Probier $(1 | 2 | 3)$: Setz es in jede Gleichung ein. Alle drei stimmen, also ist $L = \\{ (1 | 2 | 3) \\}$. Aber wie findest du das ohne Raten?",
      ),
    },
    {
      math: stack(STEP0.map((r, i) => rowSrc(r, IDS[i], LABELS[i]))),
      note: tx(
        "Here is a **different** system with the same solution. It's easy because it has **step form** (Stufenform): the last row only has $z$, the middle one only $y$ and $z$.",
        "Hier ein **anderes** LGS mit derselben Lösung. Es ist leicht, weil es **Stufenform** hat: Die letzte Zeile enthält nur $z$, die mittlere nur $y$ und $z$.",
      ),
    },
    ...back.frames,
    {
      math: tripleSrc(SOL0),
      note: tx(
        "Solving from the bottom up is called **back substitution** (Rückwärtseinsetzen). $L = \\{ (1 | 2 | 3) \\}$, the same as for the first system. Next: how to bring the first system into step form.",
        "Von unten nach oben auflösen heißt **Rückwärtseinsetzen**. $L = \\{ (1 | 2 | 3) \\}$, wie beim ersten LGS. Gleich siehst du, wie du das erste LGS auf Stufenform bringst.",
      ),
    },
  ];
})();

/** Gauss, part 1: II − 2 · I written out, then III − I. */
const gauss1Frames: Frame[] = (() => {
  const [I, II, III] = S0;
  const IIa = combine(1, II, -2, I);
  const IIIa = combine(1, III, -1, I);
  return [
    {
      math: stack(S0.map((r, i) => rowSrc(r, IDS[i], LABELS[i]))),
      note: tx(
        "No step form yet. The **Gauss algorithm** gets there with moves that don't change the solutions: multiply an equation by a number $≠ 0$, and add a multiple of one equation to another.",
        "Noch keine Stufenform. Das **Gauß-Verfahren** bringt das LGS dorthin, mit Umformungen, die die Lösungen nicht ändern: eine Gleichung mit einer Zahl $≠ 0$ multiplizieren und ein Vielfaches einer Gleichung zu einer anderen addieren.",
      ),
    },
    {
      math: stack([fullRowSrc(II, "2", "(II)"), fullRowSrc(scale(I, -2), "m", "(−2 · I)")]),
      note: tx(
        "To eliminate $x$ from (II): add $-2$ times (I). Multiply **every** term of (I) by $-2$, the right side too.",
        "Um $x$ aus (II) zu eliminieren, addierst du das $(-2)$-Fache von (I). Multipliziere **jeden** Term von (I) mit $-2$, auch die rechte Seite.",
      ),
    },
    {
      math: stack([fullRowSrc(II, "2", "(II)"), fullRowSrc(scale(I, -2), "m", "(−2 · I)"), fullRowSrc(IIa, "2a", "(IIa)")]),
      note: tx(
        "Add column by column: $2x - 2x = 0$, $-y - 2y = -3y$, $z - 2z = -z$ and $3 - 12 = -9$. The $x$ is gone!",
        "Addiere spaltenweise: $2x - 2x = 0$, $-y - 2y = -3y$, $z - 2z = -z$ und $3 - 12 = -9$. Das $x$ ist weg!",
      ),
      highlight: ["L2a"],
    },
    {
      math: stack([rowSrc(I, "1", "I"), rowSrc(IIa, "2a", "IIa", XYZ, "blob"), rowSrc(III, "3", "III")]),
      note: tx("In short: **(IIa) = II − 2 · I**. It replaces (II) in the system.", "Kurz: **(IIa) = II − 2 · I**. Sie ersetzt (II) im LGS."),
    },
    {
      math: stack([rowSrc(I, "1", "I"), rowSrc(IIa, "2a", "IIa"), rowSrc(IIIa, "3", "IIIa", XYZ, "blob")]),
      note: tx(
        "Same for (III): **III − I** eliminates $x$ there. Now (I) is the only row with $x$.",
        "Genauso bei (III): **III − I** eliminiert dort das $x$. Jetzt ist (I) die einzige Zeile mit $x$.",
      ),
    },
  ];
})();

/** Gauss, part 2: 3 · IIIa + IIa, then back substitution. */
const gauss2Frames: Frame[] = (() => {
  const [I] = S0;
  const IIa = combine(1, S0[1], -2, I);
  const IIIa = combine(1, S0[2], -1, I);
  const IIIb = combine(3, IIIa, 1, IIa);
  const final = [I, IIa, IIIb];
  const labels = ["I", "IIa", "IIIb"];
  const back = backFrames(final, labels)!;
  return [
    {
      math: stack([rowSrc(I, "1", "I"), rowSrc(IIa, "2", "IIa"), rowSrc(IIIa, "3", "IIIa")]),
      highlight: ["c2y", "s2y", "v2y", "v3y"],
      note: tx(
        "Now (IIa) and (IIIa) form a system with only $y$ and $z$. Eliminate $y$ from (IIIa): $-3y$ and $y$ cancel if you take **3 times** (IIIa).",
        "Jetzt bilden (IIa) und (IIIa) ein LGS nur mit $y$ und $z$. Eliminiere $y$ aus (IIIa): $-3y$ und $y$ heben sich weg, wenn du (IIIa) **dreimal** nimmst.",
      ),
    },
    {
      math: stack(final.map((r, i) => rowSrc(r, IDS[i], labels[i], XYZ, i === 2 ? "blob" : "group"))),
      note: tx(
        "**(IIIb) = 3 · IIIa + IIa**: $3y - 3y = 0$, $-6z - z = -7z$, $-12 - 9 = -21$. **Step form!**",
        "**(IIIb) = 3 · IIIa + IIa**: $3y - 3y = 0$, $-6z - z = -7z$, $-12 - 9 = -21$. **Stufenform!**",
      ),
    },
    ...back.frames,
    { math: tripleSrc(back.values), note: joinText(tx("So $L = \\{ (1 | 2 | 3) \\}$.", "Also ist $L = \\{ (1 | 2 | 3) \\}$."), check3Note(S0[2], back.values, "(III)")) },
  ];
})();

const NONE: Row[] = [ROW(1, 1, 1, 3), ROW(1, 2, 3, 5), ROW(2, 3, 4, 9)];
const MANY: Row[] = [ROW(1, 1, 1, 3), ROW(1, 2, 3, 5), ROW(2, 3, 4, 8)];

const specialFrames: Frame[] = (() => {
  const gn = gaussFrames(NONE)!;
  const gm = gaussFrames(MANY)!;
  const show = (g: typeof gn, tone: "red" | "green") => stack(g.final.map((r, i) => rowSrc(r, IDS[i], g.labels[i], XYZ, i === 2 ? tone : "group")));
  return [
    {
      math: stack(NONE.map((r, i) => rowSrc(r, IDS[i], LABELS[i]))),
      note: tx("First system. Gauss as usual: **II − I**, **III − 2 · I**, then **IIIa − IIa**.", "Erstes LGS. Gauß wie immer: **II − I**, **III − 2 · I**, dann **IIIa − IIa**."),
    },
    {
      math: show(gn, "red"),
      note: tx(
        "The last row lost **all** unknowns: $0 = 1$. That's **false**, a contradiction (Widerspruch). No triple fits: $L = \\{ \\}$.",
        "Die letzte Zeile hat **alle** Unbekannten verloren: $0 = 1$. Das ist **falsch**, ein Widerspruch. Kein Tripel passt: $L = \\{ \\}$.",
      ),
    },
    {
      math: stack(MANY.map((r, i) => rowSrc(r, IDS[i], LABELS[i]))),
      note: tx("Second system: only the right side of (III) is different.", "Zweites LGS: Nur die rechte Seite von (III) ist anders."),
      highlight: ["c3c"],
    },
    {
      math: show(gm, "green"),
      note: tx(
        "Now the last row is $0 = 0$: **always true**. Only two real conditions are left for three unknowns, so one unknown is free.",
        "Jetzt ist die letzte Zeile $0 = 0$: **immer wahr**. Für drei Unbekannte bleiben nur zwei echte Bedingungen, eine Unbekannte ist also frei.",
      ),
    },
    { math: `z#v2z =#ez t#t`, note: tx("Set $z = t$. The **parameter** $t$ can be any real number.", "Setze $z = t$. Der **Parameter** $t$ darf jede reelle Zahl sein.") },
    {
      math: `y#v2y +#s2t 2#c2t t#v2t =#e2 2#c2c`,
      note: tx("Put $z = t$ into (IIa): $y + 2t = 2$, so $y = 2 - 2t$.", "Setze $z = t$ in (IIa) ein: $y + 2t = 2$, also $y = 2 - 2t$."),
    },
    {
      math: `x#v1x +#s1y (2 - 2 t)#yb +#s1t t#v1t =#e1 3#c1c`,
      note: tx("Put $y$ and $z$ into (I): $x + 2 - 2t + t = 3$, so $x = 1 + t$.", "Setze $y$ und $z$ in (I) ein: $x + 2 - 2t + t = 3$, also $x = 1 + t$."),
    },
    {
      math: `L = "{" (1 + t \\, | \\, 2 - 2t \\, | \\, t) \\, | \\, t \\in "ℝ" "}"`,
      note: tx(
        "Every $t$ gives a solution: $t = 0$ gives $(1 | 2 | 0)$, $t = 1$ gives $(2 | 0 | 1)$. **Infinitely many** solutions.",
        "Jedes $t$ liefert eine Lösung: $t = 0$ ergibt $(1 | 2 | 0)$, $t = 1$ ergibt $(2 | 0 | 1)$. **Unendlich viele** Lösungen.",
      ),
    },
  ];
})();

const PARA_P: [number, number][] = [
  [0, 1],
  [1, 0],
  [2, 3],
];
const paraFrames: Frame[] = (() => {
  const ex = parabolaExercise(PARA_P, [2, -3, 1])!;
  return ex.solution;
})();

/** Level 3: the Gauss algorithm for three equations, special cases with a parameter, and the parabola through three points. */
export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Step form and back substitution", "Stufenform und Rückwärtseinsetzen"),
      body: tx(
        "In step form each row has one unknown fewer. Solve from the bottom up: $z$, then $y$, then $x$.",
        "In Stufenform hat jede Zeile eine Unbekannte weniger. Löse von unten nach oben: erst $z$, dann $y$, dann $x$.",
      ),
      examples: ['"(I)" \\; x + y + z = 6 \\\\ "(II)" \\; y + 2z = 8 \\\\ "(III)" \\; 3z = 9', "z = 3 , \\; y = 2 , \\; x = 1"],
      tone: "rule",
    },
    {
      title: tx("The Gauss algorithm", "Das Gauß-Verfahren"),
      body: tx(
        "Use (I) to eliminate $x$ from (II) and (III). Then use (IIa) to eliminate $y$ from (IIIa). Step form reached: back substitution.",
        "Eliminiere mit (I) das $x$ aus (II) und (III). Eliminiere dann mit (IIa) das $y$ aus (IIIa). Stufenform erreicht: rückwärts einsetzen.",
      ),
      examples: ["\\text{IIa} = \\text{II} - 2 \\cdot \\text{I} , \\quad \\text{IIIa} = \\text{III} - \\text{I}", "\\text{IIIb} = 3 \\cdot \\text{IIIa} + \\text{IIa}"],
      tone: "rule",
    },
    {
      title: tx("Allowed moves", "Erlaubte Umformungen"),
      body: tx(
        "Swap two equations, multiply an equation by a number $\\ne 0$, add a multiple of one equation to another. Always **every** term, the right side too.",
        "Zwei Gleichungen tauschen, eine Gleichung mit einer Zahl $\\ne 0$ multiplizieren, ein Vielfaches einer Gleichung zu einer anderen addieren. Immer **jeder** Term, auch die rechte Seite.",
      ),
      tone: "tip",
    },
    {
      title: tx("Special cases", "Sonderfälle"),
      body: tx(
        "The last row loses all unknowns? A false statement like $0 = 1$: no solution, $L = \\{ \\}$. A true one, $0 = 0$: infinitely many. Set $z = t$ and write $x$ and $y$ with $t$.",
        "Die letzte Zeile verliert alle Unbekannten? Eine falsche Aussage wie $0 = 1$: keine Lösung, $L = \\{ \\}$. Eine wahre, $0 = 0$: unendlich viele. Setze $z = t$ und drück $x$ und $y$ mit $t$ aus.",
      ),
      examples: ['L = "{" (1 + t \\, | \\, 2 - 2t \\, | \\, t) \\, | \\, t \\in "ℝ" "}"'],
      tone: "rule",
    },
    {
      title: tx("Parabola through three points", "Parabel durch drei Punkte"),
      body: tx(
        "Put each point into $f(x) = ax^2 + bx + c$. That gives a system for $a$, $b$, $c$. A point with $x = 0$ gives $c$ directly.",
        "Setz jeden Punkt in $f(x) = ax^2 + bx + c$ ein. Das ergibt ein LGS für $a$, $b$, $c$. Ein Punkt mit $x = 0$ liefert $c$ sofort.",
      ),
      examples: ["A(-1 \\, | \\, 6): \\quad a - b + c = 6", "B(0 \\, | \\, 3): \\quad c = 3"],
      tone: "tip",
    },
    {
      title: tx("Classic slips", "Typische Fehler"),
      body: tx(
        "$(-2)^2 = 4$, not $-4$. When you subtract a multiple of an equation, every sign of it flips, the right side too.",
        "$(-2)^2 = 4$, nicht $-4$. Wenn du ein Vielfaches einer Gleichung abziehst, dreht sich jedes Vorzeichen davon um, auch auf der rechten Seite.",
      ),
      examples: ["(-2)^2 = 4 \\ne -4"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Three unknowns, step form", "Drei Unbekannte, Stufenform"),
      blob: tx("Three unknowns? No problem, we just go step by step!", "Drei Unbekannte? Kein Problem, wir gehen Stufe für Stufe vor!"),
      body: tx(
        "Each equation with three unknowns describes a plane in space. The solution of the system is what all three have in common.",
        "Jede Gleichung mit drei Unbekannten beschreibt eine Ebene im Raum. Die Lösung des LGS ist das, was alle drei gemeinsam haben.",
      ),
      frames: introFrames,
    },
    {
      type: "check",
      blob: tx("Bottom up: z first!", "Von unten nach oben: zuerst z!"),
      exercise: backExercise([ROW(1, 2, -1, -1), ROW(0, 3, 2, 1), ROW(0, 0, 4, 8)]),
    },
    {
      type: "explain",
      title: tx("The Gauss algorithm: eliminate x", "Das Gauß-Verfahren: x eliminieren"),
      blob: tx("Make the x disappear from the lower rows. Watch the columns!", "Lass das x aus den unteren Zeilen verschwinden. Achte auf die Spalten!"),
      body: tx(
        "Carl Friedrich Gauss used this method about 200 years ago. Step 1: use (I) to eliminate $x$ from (II) and (III).",
        "Carl Friedrich Gauß hat dieses Verfahren schon vor rund 200 Jahren benutzt. Schritt 1: Eliminiere mit (I) das $x$ aus (II) und (III).",
      ),
      frames: gauss1Frames,
    },
    {
      type: "explain",
      title: tx("The Gauss algorithm: step form", "Das Gauß-Verfahren: Stufenform"),
      blob: tx("One more zero, then it's downhill from there!", "Noch eine Null, dann geht's bergab!"),
      body: tx(
        "Step 2: use the new second row to eliminate $y$ from the third. Then back substitution, and finally a check in an original equation.",
        "Schritt 2: Eliminiere mit der neuen zweiten Zeile das $y$ aus der dritten. Dann rückwärts einsetzen und zum Schluss die Probe mit einer Ausgangsgleichung.",
      ),
      frames: gauss2Frames,
    },
    {
      type: "widget",
      title: tx("The Gauss workshop", "Die Gauß-Werkstatt"),
      blob: tx("Your turn at the controls: make the dashed cells zero!", "Jetzt steuerst du: Mach die gestrichelten Felder zu null!"),
      body: tx(
        "Pick a row, combine it with another one and choose the factors. When the three cells below the diagonal are zero, the system has step form. Try all four systems: two of them hold a surprise.",
        "Wähl eine Zeile, kombinier sie mit einer anderen und stell die Faktoren ein. Sind die drei Felder unter der Diagonale null, hat das LGS Stufenform. Probier alle vier LGS aus: Zwei davon haben eine Überraschung.",
      ),
      widget: GaussLab,
    },
    {
      type: "check",
      blob: tx("The full algorithm. Take it one row at a time.", "Das ganze Verfahren. Zeile für Zeile."),
      exercise: gaussExercise([ROW(1, 1, 1, 2), ROW(2, 1, -1, 2), ROW(1, -2, 3, 7)]),
    },
    {
      type: "explain",
      title: tx("No solution or infinitely many", "Keine oder unendlich viele Lösungen"),
      blob: tx("Sometimes the last row loses everything. Then read what's left!", "Manchmal verliert die letzte Zeile alles. Dann lies, was übrig bleibt!"),
      body: tx(
        "If a row loses all three unknowns, look at the statement that's left. **False** (like $0 = 1$): no solution. **True** ($0 = 0$): infinitely many, described with a parameter $t$.",
        "Verliert eine Zeile alle drei Unbekannten, schau dir die Aussage an, die übrig bleibt. **Falsch** (wie $0 = 1$): keine Lösung. **Wahr** ($0 = 0$): unendlich viele, beschrieben mit einem Parameter $t$.",
      ),
      frames: specialFrames,
    },
    {
      type: "check",
      blob: tx("Infinitely many: write them all down with t.", "Unendlich viele: Schreib sie alle mit t auf."),
      exercise: paramExercise([ROW(1, -1, 2, 1), ROW(2, -1, 3, 4), ROW(1, 0, 1, 3)], "x")!,
    },
    {
      type: "explain",
      title: tx("The parabola through three points", "Die Parabel durch drei Punkte"),
      blob: tx("Here's what all this is good for: finding a function from points!", "Und dafür ist das alles gut: eine Funktion aus Punkten bestimmen!"),
      body: tx(
        "Which parabola $f(x) = ax^2 + bx + c$ runs through $A(0 | 1)$, $B(1 | 0)$ and $C(2 | 3)$? Each point gives one equation, so we get a system for $a$, $b$ and $c$.",
        "Welche Parabel $f(x) = ax^2 + bx + c$ geht durch $A(0 | 1)$, $B(1 | 0)$ und $C(2 | 3)$? Jeder Punkt liefert eine Gleichung, so entsteht ein LGS für $a$, $b$ und $c$.",
      ),
      frames: paraFrames,
    },
    {
      type: "widget",
      title: tx("A parabola through three points", "Eine Parabel durch drei Punkte"),
      blob: tx("Drag the points and the parabola follows. Can you make a straight line?", "Zieh die Punkte, die Parabel folgt. Schaffst du eine Gerade?"),
      body: tx(
        "Three points with different $x$-values always fix exactly one parabola (or a line). Drag them and watch the system and $f(x)$ change.",
        "Drei Punkte mit verschiedenen $x$-Werten legen immer genau eine Parabel fest (oder eine Gerade). Zieh sie und beobachte, wie sich das LGS und $f(x)$ ändern.",
      ),
      widget: ParabolaLab,
    },
    {
      type: "check",
      blob: tx("Last one: set it up and solve it!", "Die letzte: aufstellen und lösen!"),
      exercise: parabolaExercise(
        [
          [-1, 6],
          [1, 2],
          [2, 3],
        ],
        [1, -2, 3],
      )!,
    },
  ],
};
