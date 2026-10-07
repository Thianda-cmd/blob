"use client";

import { tx, type Text } from "@/i18n/text";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LessonStep, LevelLesson, Mistake, SummaryBlock } from "@/learn/types";
import { cat, clean, dec, localize, minusR, num, rootsOf, setKeyed, sideSrc, solutionMistakes, solutionsAnswer, T } from "./shared";
import { RootLab, ZeroProductLab } from "./widgets1";

// Level 1 (Klasse 8–9): quadratic equations without a formula. Pure equations by taking the
// root, a squared bracket, factoring out x, and the zero product rule.

/** "+#ks 7#k" or "-#ks 7#k": a number added to something in front of it. */
const signNum = (v: number, k: string) => (v < 0 ? `-#${k}s ${dec(-v)}#${k}` : `+#${k}s ${dec(v)}#${k}`);
/** A root that a student can write down exactly (at most two decimals). */
const niceRoot = (R: number) => R >= 0 && Math.abs(Math.sqrt(R) * 100 - Math.round(Math.sqrt(R) * 100)) < 1e-9;
const OR: Text = tx('"or"#or', '"oder"#or');
const T_MOVED = tx("Sign kept when moving", "Vorzeichen nicht gedreht");
const T_NEG = tx("The negative root is missing", "Die negative Wurzel fehlt");

// ---------------------------------------------------------------------------
// Worked solutions

/** From x² = R (already on the board) to the solution set. */
function rootFrames(R: number): Frame[] {
  if (R > 0) {
    const r = clean(Math.sqrt(R));
    if (!niceRoot(R)) {
      const r2 = clean(Math.round(r * 100) / 100);
      return [
        {
          math: `x#x _{1,2#i} =#eq \\pm#pm \\sqrt{${dec(R)}#m}#rt \\approx#ap \\pm#pm2 ${dec(r2)}#r`,
          note: tx(
            `Take the root, with plus **and** minus. $${dec(R)}$ isn't a square number, so the roots are about $\\pm ${dec(r2)}$.`,
            `Zieh die Wurzel, mit Plus **und** Minus. $${dec(R)}$ ist keine Quadratzahl, also sind die Wurzeln etwa $\\pm ${dec(r2)}$.`,
          ),
        },
        {
          math: `L#L =#Leq \\{#Llb -#Ls \\sqrt{${dec(R)}}#Lr1 ;#Lsc \\sqrt{${dec(R)}}#Lr2 \\}#Lrb`,
          note: tx("**Two** solutions.", "**Zwei** Lösungen."),
        },
      ];
    }
    return [
      {
        math: `x#x _{1,2#i} =#eq \\pm#pm ${dec(r)}#m`,
        note: tx(
          `Take the root, with plus **and** minus: $${dec(r)}^2 = ${dec(R)}$ and also $(-${dec(r)})^2 = ${dec(R)}$.`,
          `Zieh die Wurzel, mit Plus **und** Minus: $${dec(r)}^2 = ${dec(R)}$ und auch $(-${dec(r)})^2 = ${dec(R)}$.`,
        ),
      },
      { math: setKeyed([r, -r]), note: tx(`**Two** solutions: $x_1 = ${dec(r)}$ and $x_2 = -${dec(r)}$.`, `**Zwei** Lösungen: $x_1 = ${dec(r)}$ und $x_2 = -${dec(r)}$.`) },
    ];
  }
  if (R === 0)
    return [
      { math: "x#x =#eq 0#m", note: tx("Only $0 \\cdot 0 = 0$. So there's just **one** solution.", "Nur $0 \\cdot 0 = 0$. Es gibt also nur **eine** Lösung.") },
      { math: setKeyed([0]), note: tx("One solution: $x = 0$.", "Eine Lösung: $x = 0$.") },
    ];
  return [
    {
      math: `x#x ^{2#e} =#eq \\red{${num(R, "m")}}`,
      note: tx(
        "A square is never negative: $x \\cdot x$ is positive or $0$ for every $x$. So **no** number works.",
        "Ein Quadrat ist nie negativ: $x \\cdot x$ ist für jedes $x$ positiv oder $0$. Also passt **keine** Zahl.",
      ),
    },
    { math: setKeyed([]), note: tx("No solution: the solution set is empty.", "Keine Lösung: Die Lösungsmenge ist leer.") },
  ];
}

/** a·x² + k = m with a > 0: get x² alone, then take the root. */
function pureFrames(a: number, k: number, m: number, start?: Text): Frame[] {
  const R = clean((m - k) / a);
  const sq = `${a === 1 ? "" : `${dec(a)}#a `}x#x ^{2#e}`;
  const frames: Frame[] = [
    {
      math: `${sq}${k ? ` ${signNum(k, "k")}` : ""} =#eq ${num(m, "m")}`,
      note:
        start ??
        (k || a !== 1
          ? tx("First get $x^2$ on its own.", "Bring zuerst $x^2$ allein auf eine Seite.")
          : tx(`Which numbers give $${dec(R)}$ when you square them?`, `Welche Zahlen ergeben $${dec(R)}$, wenn du sie quadrierst?`)),
    },
  ];
  if (k) {
    const sum = m === 0 ? "" : `: $${dec(m)} ${k > 0 ? "-" : "+"} ${dec(Math.abs(k))} = ${dec(m - k)}$`;
    frames.push({
      math: `${sq} =#eq ${num(m - k, "m")}`,
      highlight: ["m", "ms"],
      note:
        k > 0
          ? tx(`Subtract $${dec(k)}$ on both sides${sum}.`, `Zieh auf beiden Seiten $${dec(k)}$ ab${sum}.`)
          : tx(`Add $${dec(-k)}$ on both sides${sum}.`, `Addiere auf beiden Seiten $${dec(-k)}$${sum}.`),
    });
  }
  if (a !== 1)
    frames.push({
      math: `x#x ^{2#e} =#eq ${num(R, "m")}`,
      note: tx(`Divide both sides by $${dec(a)}$.`, `Teile beide Seiten durch $${dec(a)}$.`),
    });
  return [...frames, ...rootFrames(R)];
}

/** c − x² = 0: bring x² over first. */
function reversedFrames(c: number): Frame[] {
  return [
    { math: `${dec(c)}#m -#xs x#x ^{2#e} =#eq 0#z`, note: tx("The $x^2$ has a minus in front.", "Vor $x^2$ steht ein Minus.") },
    { math: `${dec(c)}#m =#eq x#x ^{2#e}`, note: tx("Add $x^2$ on both sides.", "Addiere auf beiden Seiten $x^2$.") },
    { math: `x#x ^{2#e} =#eq ${dec(c)}#m`, note: tx("Swap the sides.", "Vertausche die Seiten.") },
    ...rootFrames(c),
  ];
}

/** (x − d)² + k = m: get the bracket alone, take the root, two simple equations. */
function bracketFrames(d: number, k: number, m: number, start?: Text): Frame[] {
  const R = clean(m - k);
  const ds = d > 0 ? "-" : "+";
  const ad = dec(Math.abs(d));
  const br = `(x#x ${ds}#ds ${ad}#d)#b ^{2#e}`;
  const frames: Frame[] = [
    {
      math: `${br}${k ? ` ${signNum(k, "k")}` : ""} =#eq ${num(m, "m")}`,
      note: start ?? tx("The whole bracket is squared. Treat it as one block.", "Die ganze Klammer ist quadriert. Behandle sie wie einen Block."),
    },
  ];
  if (k)
    frames.push({
      math: `${br} =#eq ${num(R, "m")}`,
      note: k > 0 ? tx(`Get the bracket alone: subtract $${dec(k)}$.`, `Bring die Klammer allein auf eine Seite: minus $${dec(k)}$.`) : tx(`Get the bracket alone: add $${dec(-k)}$.`, `Bring die Klammer allein auf eine Seite: plus $${dec(-k)}$.`),
    });
  if (R > 0) {
    const r = clean(Math.sqrt(R));
    const x1 = clean(d + r);
    const x2 = clean(d - r);
    const shift =
      d > 0
        ? tx(`Add $${ad}$: $x_1 = ${dec(r)} + ${ad} = ${dec(x1)}$ and $x_2 = -${dec(r)} + ${ad} = ${dec(x2)}$.`, `Addiere $${ad}$: $x_1 = ${dec(r)} + ${ad} = ${dec(x1)}$ und $x_2 = -${dec(r)} + ${ad} = ${dec(x2)}$.`)
        : tx(`Subtract $${ad}$: $x_1 = ${dec(r)} - ${ad} = ${dec(x1)}$ and $x_2 = -${dec(r)} - ${ad} = ${dec(x2)}$.`, `Subtrahiere $${ad}$: $x_1 = ${dec(r)} - ${ad} = ${dec(x1)}$ und $x_2 = -${dec(r)} - ${ad} = ${dec(x2)}$.`);
    frames.push(
      {
        math: `x#x ${ds}#ds ${ad}#d =#eq \\pm#pm ${dec(r)}#m`,
        note: tx(`Take the root: the bracket is $${dec(r)}$ or $-${dec(r)}$, because both squared give $${dec(R)}$.`, `Zieh die Wurzel: Die Klammer ist $${dec(r)}$ oder $-${dec(r)}$, denn beide ergeben quadriert $${dec(R)}$.`),
      },
      {
        math: cat(`x#x ${ds}#ds ${ad}#d =#eq ${dec(r)}#m \\quad `, OR, ` \\quad x#x2 ${ds}#ds2 ${ad}#d2 =#eq2 -#m2s ${dec(r)}#m2`),
        note: tx("That's two simple equations.", "Das sind zwei einfache Gleichungen."),
      },
      { math: `x#x _{1#i1} =#eq ${num(x1, "m")} \\quad x#x2 _{2#i2} =#eq2 ${num(x2, "m2")}`, note: shift },
      { math: setKeyed([x1, x2]), note: tx("Two solutions. Put them back in to check, if you like.", "Zwei Lösungen. Wenn du magst, mach die Probe.") },
    );
  } else if (R === 0) {
    frames.push(
      { math: `x#x ${ds}#ds ${ad}#d =#eq 0#m`, note: tx("Only $0^2 = 0$, so the bracket must be $0$.", "Nur $0^2 = 0$, also muss die Klammer $0$ sein.") },
      { math: `x#x =#eq ${num(d, "d")}`, note: tx(`So $x = ${dec(d)}$. Just **one** solution.`, `Also ist $x = ${dec(d)}$. Nur **eine** Lösung.`) },
      { math: setKeyed([d]), note: tx("One solution.", "Eine Lösung.") },
    );
  } else {
    frames.push(
      {
        math: `${br} =#eq \\red{${num(R, "m")}}`,
        note: tx("A squared bracket is never negative. So **no** number works.", "Eine quadrierte Klammer ist nie negativ. Also passt **keine** Zahl."),
      },
      { math: setKeyed([]), note: tx("No solution.", "Keine Lösung.") },
    );
  }
  return frames;
}

/** a·x² + b·x = 0 (or a·x² = −b·x with `sides`): factor out, then the zero product rule. */
function factorFrames(a: number, b: number, sides = false): Frame[] {
  const x2 = clean(-b / a);
  const g = gcd(a, b) * Math.sign(a);
  const ia = a / g;
  const ib = b / g;
  const lhs = sideSrc([T("a", a, 2), T("b", b, 1)]);
  const frames: Frame[] = [];
  if (sides) {
    frames.push(
      {
        math: `${sideSrc([T("a", a, 2)])} =#eq ${sideSrc([T("b", -b, 1)])}`,
        note: tx(
          "Careful: **don't** divide by $x$, you'd lose a solution. Bring everything to one side instead.",
          "Vorsicht: Teile **nicht** durch $x$, sonst verlierst du eine Lösung. Bring lieber alles auf eine Seite.",
        ),
      },
      {
        math: `${lhs} =#eq 0#z`,
        highlight: ["sb", "cb"],
        note: tx("The $x$-term changes sides, so its sign flips.", "Der $x$-Term wechselt die Seite, also dreht sich sein Vorzeichen."),
      },
    );
  } else {
    frames.push({
      math: `${lhs} =#eq 0#z`,
      note: tx("No number on its own: both terms contain $x$.", "Keine Zahl ohne $x$: Beide Terme enthalten $x$."),
    });
  }
  const out = g === 1 ? "x#va" : g === -1 ? "-#sa x#va" : g < 0 ? `-#sa ${dec(-g)}#ca x#va` : `${dec(g)}#ca x#va`;
  const outPlain = g === 1 ? "x" : g === -1 ? "-x" : `${dec(g)}x`;
  const inner = `${ia === 1 ? "" : `${dec(ia)}#ia `}x#vb ${ib < 0 ? "-" : "+"}#sb ${dec(Math.abs(ib))}#cb`;
  const innerPlain = `${ia === 1 ? "" : dec(ia)}x ${ib < 0 ? "-" : "+"} ${dec(Math.abs(ib))}`;
  frames.push(
    {
      math: `${out} (${inner})#br =#eq 0#z`,
      note: tx(`Factor out $${outPlain}$: $${outPlain} \\cdot (${innerPlain})$.`, `Klammere $${outPlain}$ aus: $${outPlain} \\cdot (${innerPlain})$.`),
    },
    {
      math: cat(`${out} =#e1 0#z1 \\quad `, OR, ` \\quad ${inner} =#eq 0#z`),
      note: tx("A product is $0$ when one of its factors is $0$.", "Ein Produkt ist $0$, wenn einer der Faktoren $0$ ist."),
    },
    {
      math: `x#va _{1#i1} =#e1 0#z1 \\quad x#vb _{2#i2} =#eq ${num(x2, "cb")}`,
      note: cat(
        g === 1 ? tx("$x = 0$ is one solution already. ", "$x = 0$ ist schon eine Lösung. ") : tx(`$${outPlain} = 0$ gives $x = 0$. `, `Aus $${outPlain} = 0$ folgt $x = 0$. `),
        ia === 1
          ? tx(`And $${innerPlain} = 0$ gives $x = ${dec(x2)}$.`, `Aus $${innerPlain} = 0$ folgt $x = ${dec(x2)}$.`)
          : tx(`And $${innerPlain} = 0$ gives $${dec(ia)}x = ${dec(-ib)}$, so $x = ${dec(x2)}$.`, `Aus $${innerPlain} = 0$ folgt $${dec(ia)}x = ${dec(-ib)}$, also $x = ${dec(x2)}$.`),
      ),
    },
    { math: setKeyed([0, x2]), note: tx("Two solutions, and one of them is $0$.", "Zwei Lösungen, und eine davon ist $0$.") },
  );
  return frames;
}

/** A linear factor k·x − m (k > 0). m = 0, k = 1 is just "x". */
type Lin = { k: number; m: number };
const linRoot = (f: Lin) => clean(f.m / f.k);
const linPlain = (f: Lin) => (f.m === 0 && f.k === 1 ? "x" : `${f.k === 1 ? "" : dec(f.k)}x ${f.m > 0 ? "-" : "+"} ${dec(Math.abs(f.m))}`);
const linSrc = (f: Lin, id: string, bracket: boolean) => {
  if (f.m === 0 && f.k === 1) return `x#v${id}`;
  const body = `${f.k === 1 ? "" : `${dec(f.k)}#k${id} `}x#v${id} ${f.m > 0 ? "-" : "+"}#s${id} ${dec(Math.abs(f.m))}#m${id}`;
  return bracket ? `(${body})#b${id}` : body;
};
const productSrc = (c: number, f1: Lin, f2: Lin, keys = true) => {
  if (!keys) return `${c === 1 ? "" : c === -1 ? "-" : dec(c)}${[f1, f2].map((f) => (f.m === 0 && f.k === 1 ? "x" : `(${linPlain(f)})`)).join("")} = 0`;
  return `${c === 1 ? "" : c === -1 ? "-#cs " : `${dec(c)}#c `}${linSrc(f1, "1", true)} ${linSrc(f2, "2", true)} =#eq 0#z`;
};

function zeroFrames(c: number, f1: Lin, f2: Lin): Frame[] {
  const r1 = linRoot(f1);
  const r2 = linRoot(f2);
  const solveNote = (f: Lin, first: boolean): Text => {
    const aus = first ? "Aus" : "aus";
    if (f.m === 0 && f.k === 1) return tx(`${first ? "The" : "the"} factor $x$ gives $x = 0$`, `${first ? "Der" : "der"} Faktor $x$ liefert $x = 0$`);
    if (f.k === 1) return tx(`$${linPlain(f)} = 0$ gives $x = ${dec(linRoot(f))}$`, `${aus} $${linPlain(f)} = 0$ folgt $x = ${dec(linRoot(f))}$`);
    return tx(`$${linPlain(f)} = 0$ gives $${dec(f.k)}x = ${dec(f.m)}$, so $x = ${dec(linRoot(f))}$`, `${aus} $${linPlain(f)} = 0$ folgt $${dec(f.k)}x = ${dec(f.m)}$, also $x = ${dec(linRoot(f))}$`);
  };
  return [
    {
      math: productSrc(c, f1, f2),
      note: cat(
        tx("A product is $0$ only when one of its factors is $0$.", "Ein Produkt ist nur dann $0$, wenn einer der Faktoren $0$ ist."),
        c !== 1 ? tx(` The $${dec(c)}$ in front is never $0$, so look at the other factors.`, ` Die $${dec(c)}$ davor ist nie $0$, also schau auf die anderen Faktoren.`) : "",
      ),
    },
    {
      math: cat(`${linSrc(f1, "1", false)} =#e1 0#z1 \\quad `, OR, ` \\quad ${linSrc(f2, "2", false)} =#e2 0#z2`),
      note: tx("Set each factor to $0$.", "Setz jeden Faktor gleich $0$."),
    },
    {
      math: `x#v1 _{1#i1} =#e1 ${num(r1, "m1")} \\quad x#v2 _{2#i2} =#e2 ${num(r2, "m2")}`,
      note: cat(solveNote(f1, true), tx(" and ", " und "), solveNote(f2, false), "."),
    },
    { math: setKeyed([r1, r2]), note: tx("No formula, no multiplying out. Done!", "Keine Formel, kein Ausmultiplizieren. Fertig!") },
  ];
}

// ---------------------------------------------------------------------------
// Typical mistakes, simulated from the task's numbers.

function pureMistakes(a: number, k: number, m: number): Mistake[] {
  const R = clean((m - k) / a);
  const { list, add } = solutionMistakes(rootsOf(R));
  const r = Math.sqrt(Math.max(R, 0));
  if (R > 0)
    add(
      [r],
      T_NEG,
      tx(
        `Ooh, the classic trap! $${dec(clean(r))}$ is right, but $(-${dec(clean(r))})^2 = ${dec(R)}$ too. Squaring has **two** answers.`,
        `Ooh, die klassische Falle! $${dec(clean(r))}$ stimmt, aber auch $(-${dec(clean(r))})^2 = ${dec(R)}$. Beim Wurzelziehen gibt es **zwei** Lösungen.`,
      ),
      { part: true, close: true },
    );
  if (k)
    add(
      rootsOf(clean((m + k) / a)),
      T_MOVED,
      tx(
        `Ah, I see what happened! When the $${dec(Math.abs(k))}$ moves to the other side, its sign flips: ${k < 0 ? "minus becomes plus" : "plus becomes minus"}.`,
        `Ah, ich seh, was passiert ist! Wenn die $${dec(Math.abs(k))}$ auf die andere Seite wandert, dreht sich ihr Vorzeichen: Aus ${k < 0 ? "Minus wird Plus" : "Plus wird Minus"}.`,
      ),
    );
  if (a !== 1) {
    add(
      rootsOf(clean(m - k - a)),
      tx("Subtracted instead of divided", "Subtrahiert statt geteilt"),
      tx(
        `I think you subtracted $${dec(a)}$. But $${dec(a)}x^2$ means $${dec(a)} \\cdot x^2$, so you **divide** by $${dec(a)}$.`,
        `Ich glaub, du hast $${dec(a)}$ abgezogen. Aber $${dec(a)}x^2$ heißt $${dec(a)} \\cdot x^2$, also **teilst** du durch $${dec(a)}$.`,
      ),
    );
    add(
      rootsOf(clean(m - k)),
      tx("Not divided yet", "Noch nicht geteilt"),
      tx(
        `Nearly! Before taking the root, $x^2$ has to stand alone: divide by the $${dec(a)}$ in front first.`,
        `Fast! Bevor du die Wurzel ziehst, muss $x^2$ allein stehen: Teile zuerst durch die $${dec(a)}$ davor.`,
      ),
    );
  }
  if (R > 0)
    add(
      [R / 2, -R / 2],
      tx("A root isn't half", "Wurzel ist nicht die Hälfte"),
      tx(
        `You halved $${dec(R)}$. But the root asks which number **times itself** gives $${dec(R)}$.`,
        `Du hast $${dec(R)}$ halbiert. Aber die Wurzel fragt, welche Zahl **mal sich selbst** $${dec(R)}$ ergibt.`,
      ),
    );
  if (R < 0)
    add(
      rootsOf(-R),
      tx("A square is never negative", "Ein Quadrat ist nie negativ"),
      tx(
        `Careful! Put your answer back in: $${dec(clean(Math.sqrt(-R)))}^2 = ${dec(-R)}$, but you need $x^2 = ${dec(R)}$. Can a square be negative?`,
        `Vorsicht! Setz deine Lösung mal ein: $${dec(clean(Math.sqrt(-R)))}^2 = ${dec(-R)}$, du brauchst aber $x^2 = ${dec(R)}$. Kann ein Quadrat negativ sein?`,
      ),
    );
  if (R === 0)
    add([], tx("x = 0 works", "x = 0 passt"), tx("Not quite: $x = 0$ works, because $0^2 = 0$.", "Nicht ganz: $x = 0$ passt, denn $0^2 = 0$."));
  return list;
}

function bracketMistakes(d: number, k: number, m: number): Mistake[] {
  const R = clean(m - k);
  const r = Math.sqrt(Math.max(R, 0));
  const right = R > 0 ? [d + r, d - r] : R === 0 ? [d] : [];
  const { list, add } = solutionMistakes(right);
  const ad = dec(Math.abs(d));
  if (R > 0) {
    add(
      [d + r],
      tx("The second case is missing", "Der zweite Fall fehlt"),
      tx(
        `Nearly! The bracket can be $${dec(clean(r))}$ **or** $-${dec(clean(r))}$. Solve $x ${d > 0 ? "-" : "+"} ${ad} = -${dec(clean(r))}$ too.`,
        `Fast! Die Klammer kann $${dec(clean(r))}$ **oder** $-${dec(clean(r))}$ sein. Löse auch $x ${d > 0 ? "-" : "+"} ${ad} = -${dec(clean(r))}$.`,
      ),
      { part: true, close: true },
    );
    add(
      [r - d, -r - d],
      tx("Sign in the last step", "Vorzeichen im letzten Schritt"),
      tx(
        `Ah, I see! The root part is right. But to get $x$ alone, the $${ad}$ moves over and flips its sign: you have to ${d > 0 ? "**add**" : "**subtract**"} it.`,
        `Ah, ich seh's! Das Wurzelziehen stimmt. Aber damit $x$ allein steht, wandert die $${ad}$ hinüber und dreht ihr Vorzeichen: Du musst sie ${d > 0 ? "**addieren**" : "**abziehen**"}.`,
      ),
      { close: true },
    );
    add(
      [d + R, d - R],
      tx("Root forgotten", "Wurzel vergessen"),
      tx(
        `The bracket **squared** is $${dec(R)}$. So the bracket itself is $\\pm\\sqrt{${dec(R)}}$, not $\\pm ${dec(R)}$.`,
        `Die Klammer **zum Quadrat** ist $${dec(R)}$. Die Klammer selbst ist also $\\pm\\sqrt{${dec(R)}}$, nicht $\\pm ${dec(R)}$.`,
      ),
    );
  }
  if (R === 0)
    add([], tx("One solution", "Eine Lösung"), tx(`Not quite: $x = ${dec(d)}$ makes the bracket $0$, and $0^2 = 0$.`, `Nicht ganz: $x = ${dec(d)}$ macht die Klammer zu $0$, und $0^2 = 0$.`));
  if (R < 0) {
    const s = Math.sqrt(-R);
    add(
      [d + s, d - s],
      tx("A square is never negative", "Ein Quadrat ist nie negativ"),
      tx(
        `Careful! A squared bracket can't be $${dec(R)}$. Put your answer back in and see.`,
        `Vorsicht! Eine quadrierte Klammer kann nicht $${dec(R)}$ sein. Setz deine Lösung ein und schau.`,
      ),
    );
  }
  if (d !== 0 && R - d * d > 0)
    add(
      rootsOf(R - d * d),
      tx("Bracket squared wrongly", "Klammer falsch quadriert"),
      tx(
        `Ooh, classic trap! $(x ${d > 0 ? "-" : "+"} ${ad})^2$ is **not** $x^2 + ${dec(d * d)}$. Better: don't multiply out at all, take the root of the whole bracket.`,
        `Ooh, die klassische Falle! $(x ${d > 0 ? "-" : "+"} ${ad})^2$ ist **nicht** $x^2 + ${dec(d * d)}$. Besser: Gar nicht ausmultiplizieren, sondern die Wurzel aus der ganzen Klammer ziehen.`,
      ),
    );
  if (k)
    add(
      (() => {
        const R2 = m + k;
        return R2 > 0 ? [d + Math.sqrt(R2), d - Math.sqrt(R2)] : R2 === 0 ? [d] : [];
      })(),
      T_MOVED,
      tx(
        `When the $${dec(Math.abs(k))}$ moves to the other side, its sign flips. Get the bracket alone first.`,
        `Wenn die $${dec(Math.abs(k))}$ auf die andere Seite wandert, dreht sich ihr Vorzeichen. Bring zuerst die Klammer allein auf eine Seite.`,
      ),
    );
  return list;
}

function factorMistakes(a: number, b: number, sides = false): Mistake[] {
  const x2 = clean(-b / a);
  const { list, add } = solutionMistakes([0, x2]);
  add(
    [x2],
    tx("A solution got lost", "Eine Lösung ging verloren"),
    tx(
      "Nearly! Did you divide by $x$? That quietly throws away a solution. Factor out $x$ instead: a product is $0$ when **one** of its factors is $0$.",
      "Fast! Hast du durch $x$ geteilt? Dabei geht heimlich eine Lösung verloren. Klammere lieber $x$ aus: Ein Produkt ist $0$, wenn **einer** der Faktoren $0$ ist.",
    ),
    { part: true, close: true },
  );
  add(
    [0, -x2],
    sides ? T_MOVED : tx("Sign in the last step", "Vorzeichen im letzten Schritt"),
    sides
      ? tx(
          `$x = 0$ is right! But when $${dec(Math.abs(b))}x$ moves to the left, its sign flips. Check the second solution.`,
          `$x = 0$ stimmt! Aber wenn $${dec(Math.abs(b))}x$ nach links wandert, dreht sich sein Vorzeichen. Prüf die zweite Lösung.`,
        )
      : tx(
          "$x = 0$ is right! For the other one, solve the bracket $= 0$: the number changes sides, so its sign flips.",
          "$x = 0$ stimmt! Für die andere setz die Klammer $= 0$: Die Zahl wechselt die Seite, also dreht sich ihr Vorzeichen.",
        ),
    { close: true },
  );
  if (Math.abs(a) !== 1)
    add(
      [0, -b],
      tx("Not divided", "Nicht geteilt"),
      tx(
        `Nearly! From $${dec(a)}x ${b < 0 ? "-" : "+"} ${dec(Math.abs(b))} = 0$ you get $${dec(a)}x = ${dec(-b)}$. Now divide by $${dec(a)}$.`,
        `Fast! Aus $${dec(a)}x ${b < 0 ? "-" : "+"} ${dec(Math.abs(b))} = 0$ folgt $${dec(a)}x = ${dec(-b)}$. Jetzt noch durch $${dec(a)}$ teilen.`,
      ),
      { close: true },
    );
  return list;
}

function zeroMistakes(f1: Lin, f2: Lin): Mistake[] {
  const r1 = linRoot(f1);
  const r2 = linRoot(f2);
  const { list, add } = solutionMistakes([r1, r2]);
  const signed = [f1, f2].find((f) => f.m !== 0) ?? f1;
  add(
    [-r1, -r2],
    tx("Signs flipped", "Vorzeichen vertauscht"),
    tx(
      `Ah, I see! You took the numbers straight out of the brackets. But $${linPlain(signed)} = 0$ means the number moves over and **flips** its sign.`,
      `Ah, ich seh's! Du hast die Zahlen direkt aus den Klammern übernommen. Aber bei $${linPlain(signed)} = 0$ wandert die Zahl hinüber und **dreht** ihr Vorzeichen.`,
    ),
  );
  const steep = [f1, f2].find((f) => f.k !== 1);
  if (steep)
    add(
      [f1, f2].map((f) => (f === steep ? f.m : linRoot(f))),
      tx("Not divided", "Nicht geteilt"),
      tx(
        `Nearly! $${linPlain(steep)} = 0$ gives $${dec(steep.k)}x = ${dec(steep.m)}$. Now divide by $${dec(steep.k)}$.`,
        `Fast! Aus $${linPlain(steep)} = 0$ folgt $${dec(steep.k)}x = ${dec(steep.m)}$. Jetzt noch durch $${dec(steep.k)}$ teilen.`,
      ),
      { close: true },
    );
  const bare = [f1, f2].find((f) => f.m === 0 && f.k === 1);
  if (bare)
    add(
      [bare === f1 ? r2 : r1],
      tx("x = 0 forgotten", "x = 0 vergessen"),
      tx(
        "Nearly! The factor $x$ on its own counts too: $x = 0$ makes the whole product $0$.",
        "Fast! Der Faktor $x$ allein zählt auch: $x = 0$ macht das ganze Produkt zu $0$.",
      ),
      { part: true, close: true },
    );
  return list;
}

// ---------------------------------------------------------------------------
// Exercises

const SOLVE_ROOT = tx("Solve by taking the root", "Löse durch Wurzelziehen");
const SOLVE_FACTOR = tx("Solve by factoring out", "Löse durch Ausklammern");
const SOLVE_ZERO = tx("Solve with the zero product rule", "Löse mit dem Satz vom Nullprodukt");

/** "3x^2 - 48 = 0" as plain display source. */
const pureSrc = (a: number, k: number, m: number) => `${sideSrc([T("a", a, 2), T("k", k, 0)], false)} = ${dec(m)}`;
const bracketSrc = (d: number, k: number, m: number) => `(${minusR(d)})^2${k ? ` ${k < 0 ? "-" : "+"} ${dec(Math.abs(k))}` : ""} = ${dec(m)}`;

function pureTask(a: number, k: number, m: number, hint?: Text): Exercise {
  const R = clean((m - k) / a);
  return {
    instruction: SOLVE_ROOT,
    math: pureSrc(a, k, m),
    answer: solutionsAnswer(rootsOf(R)),
    hint:
      hint ??
      (k || a !== 1
        ? tx("Get $x^2$ alone first. Then take the root, with plus and minus.", "Bring zuerst $x^2$ allein auf eine Seite. Dann zieh die Wurzel, mit Plus und Minus.")
        : tx("Which numbers squared give the right side? Think of the negative one too.", "Welche Zahlen ergeben quadriert die rechte Seite? Denk auch an die negative.")),
    solution: pureFrames(a, k, m),
    mistakes: pureMistakes(a, k, m),
  };
}

function bracketTask(d: number, k: number, m: number): Exercise {
  const R = clean(m - k);
  const r = Math.sqrt(Math.max(R, 0));
  return {
    instruction: SOLVE_ROOT,
    math: bracketSrc(d, k, m),
    answer: solutionsAnswer(R > 0 ? [clean(d + r), clean(d - r)] : R === 0 ? [d] : []),
    hint: k
      ? tx("Get the bracket alone first. Then take the root: the bracket is plus or minus the root.", "Bring zuerst die Klammer allein auf eine Seite. Dann zieh die Wurzel: Die Klammer ist plus oder minus die Wurzel.")
      : tx("Don't multiply out. Take the root: the bracket is plus or minus the root.", "Nicht ausmultiplizieren. Zieh die Wurzel: Die Klammer ist plus oder minus die Wurzel."),
    solution: bracketFrames(d, k, m),
    mistakes: bracketMistakes(d, k, m),
  };
}

function factorTask(a: number, b: number, sides = false): Exercise {
  return {
    instruction: SOLVE_FACTOR,
    math: sides ? `${sideSrc([T("a", a, 2)], false)} = ${sideSrc([T("b", -b, 1)], false)}` : `${sideSrc([T("a", a, 2), T("b", b, 1)], false)} = 0`,
    answer: solutionsAnswer([0, clean(-b / a)]),
    hint: sides
      ? tx("Don't divide by $x$! Bring everything to one side, then factor out $x$.", "Nicht durch $x$ teilen! Bring alles auf eine Seite und klammere dann $x$ aus.")
      : tx("Factor out $x$. Then each factor can be $0$.", "Klammere $x$ aus. Dann kann jeder Faktor $0$ sein."),
    solution: factorFrames(a, b, sides),
    mistakes: factorMistakes(a, b, sides),
  };
}

function zeroTask(c: number, f1: Lin, f2: Lin): Exercise {
  return {
    instruction: SOLVE_ZERO,
    math: productSrc(c, f1, f2, false),
    answer: solutionsAnswer([linRoot(f1), linRoot(f2)]),
    hint: tx("Set each bracket equal to $0$ and solve it.", "Setz jede Klammer gleich $0$ und löse sie."),
    solution: zeroFrames(c, f1, f2),
    mistakes: zeroMistakes(f1, f2),
  };
}

// Shape 1: take the root (pure equations and squared brackets).
function rootShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  const r = rng.int(1, 12);
  if (roll < 0.14) return pureTask(1, 0, r * r);
  if (roll < 0.28) return pureTask(1, -r * r, 0);
  if (roll < 0.42) {
    const a = rng.int(2, 5);
    const s = rng.int(1, 6);
    return rng.chance(0.5) ? pureTask(a, -a * s * s, 0) : pureTask(a, 0, a * s * s);
  }
  if (roll < 0.5) return pureTask(rng.pick([1, 1, 2, 3]), rng.int(1, 30), 0);
  if (roll < 0.58) {
    const k = rng.nonZero(-20, 20);
    const s = rng.int(2, 9);
    return pureTask(1, k, s * s + k);
  }
  if (roll < 0.64) {
    const s = rng.int(2, 12);
    return {
      instruction: SOLVE_ROOT,
      math: `${s * s} - x^2 = 0`,
      answer: solutionsAnswer([s, -s]),
      hint: tx("Bring $x^2$ to the other side first.", "Bring zuerst $x^2$ auf die andere Seite."),
      solution: reversedFrames(s * s),
      mistakes: pureMistakes(1, -s * s, 0),
    };
  }
  if (roll < 0.69) {
    const s = rng.pick([0.5, 0.2, 0.3, 1.2, 1.5, 0.9, 1.1, 0.7]);
    return pureTask(1, 0, clean(s * s), tx("Decimals work the same way: $0,5^2 = 0,25$.", "Mit Dezimalzahlen geht es genauso: $0,5^2 = 0,25$."));
  }
  const d = rng.nonZero(-6, 6);
  const kind = rng.next();
  if (kind < 0.62) return bracketTask(d, 0, rng.int(1, 9) ** 2);
  if (kind < 0.82) {
    const k = rng.nonZero(-12, 12);
    return bracketTask(d, k, rng.int(1, 6) ** 2 + k);
  }
  return kind < 0.91 ? bracketTask(d, 0, 0) : bracketTask(d, 0, -rng.int(1, 16));
}

// Shape 2: factor out x.
function factorShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.4) return factorTask(1, rng.nonZero(-12, 12));
  if (roll < 0.65) {
    const a = rng.int(2, 6);
    const s = rng.nonZero(-6, 6);
    return factorTask(a, -a * s);
  }
  if (roll < 0.8) return factorTask(1, -rng.nonZero(-12, 12), true);
  if (roll < 0.9) {
    // a·x² + b·x = 0 with x = −b/a a half: 2x² − 5x = 0
    const a = rng.pick([2, 4]);
    const b = rng.pick([-1, 1]) * (2 * rng.int(1, 6) + 1) * (a / 2);
    return factorTask(a, b);
  }
  return factorTask(-1, rng.nonZero(-10, 10));
}

// Shape 3: the zero product rule.
function zeroShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  const r1 = rng.nonZero(-9, 9);
  const r2 = rng.nonZero(-9, 9);
  if (roll < 0.45) return r1 === r2 ? null : zeroTask(1, { k: 1, m: r1 }, { k: 1, m: r2 });
  if (roll < 0.65) return zeroTask(rng.pick([1, 1, 2, 3, -1]), { k: 1, m: 0 }, { k: 1, m: r2 });
  const k = rng.pick([2, 3, 4, 5]);
  const s = rng.nonZero(-5, 5);
  if (s === r2) return null;
  return zeroTask(1, { k, m: k * s }, { k: 1, m: r2 });
}

// Shape 4: how many solutions?
const COUNT_OPTS: Text[] = [tx("two solutions", "zwei Lösungen"), tx("exactly one solution", "genau eine Lösung"), tx("no solution", "keine Lösung")];

function countShape(rng: Rng): Exercise | null {
  const kind = rng.pick(["pure", "pure", "plus", "bracket", "bracket", "scaled"] as const);
  const sign = rng.pick([1, 1, 0, -1, -1]);
  let math: string;
  let frames: Frame[];
  let R: number;
  let moved = false;
  if (kind === "pure") {
    R = sign * rng.int(2, 40);
    math = `x^2 = ${dec(R)}`;
    frames = pureFrames(1, 0, R);
  } else if (kind === "plus") {
    const c = rng.int(1, 30);
    const k = sign >= 0 ? -c : c;
    R = -k;
    moved = k < 0;
    math = pureSrc(1, k, 0);
    frames = pureFrames(1, k, 0);
  } else if (kind === "bracket") {
    const d = rng.nonZero(-6, 6);
    const k = rng.chance(0.5) ? rng.nonZero(-9, 9) : 0;
    R = sign > 0 ? rng.int(1, 6) ** 2 : sign === 0 ? 0 : -rng.int(1, 25);
    math = bracketSrc(d, k, R + k);
    frames = bracketFrames(d, k, R + k);
    moved = k < 0 && R > 0;
  } else {
    const a = rng.int(2, 5);
    const c = rng.int(1, 12) * a;
    const k = sign >= 0 ? -c : c;
    R = sign === 0 ? 0 : -k / a;
    math = sign === 0 ? `${a}x^2 = 0` : pureSrc(a, k, 0);
    frames = sign === 0 ? pureFrames(a, 0, 0) : pureFrames(a, k, 0);
    moved = k < 0 && sign !== 0;
  }
  const right = R > 0 ? 0 : R === 0 ? 1 : 2;
  const order = rng.shuffle([0, 1, 2]);
  const options = order.map((i) => COUNT_OPTS[i]);
  const at = (i: number) => order.indexOf(i);
  const say: Record<number, Text> = {};
  if (R > 0) {
    say[1] = tx("Don't forget the negative root: a positive number has **two** square roots, like $3$ and $-3$ for $9$.", "Vergiss die negative Wurzel nicht: Eine positive Zahl hat **zwei** Wurzeln, z. B. $3$ und $-3$ bei $9$.");
    say[2] = moved
      ? tx("Ah, I see! When the number moves to the other side, its sign flips. Then the square equals a **positive** number.", "Ah, ich seh's! Wenn die Zahl auf die andere Seite wandert, dreht sich ihr Vorzeichen. Dann ist das Quadrat gleich einer **positiven** Zahl.")
      : tx("The right side is positive, so there are roots: a plus one and a minus one.", "Die rechte Seite ist positiv, also gibt es Wurzeln: eine positive und eine negative.");
  } else if (R === 0) {
    say[0] = tx("Plus $0$ and minus $0$ are the **same** number. So there's only one solution.", "Plus $0$ und minus $0$ sind **dieselbe** Zahl. Es gibt also nur eine Lösung.");
    say[2] = tx("There is one: the square is $0$ exactly when the base is $0$.", "Es gibt eine: Das Quadrat ist genau dann $0$, wenn die Basis $0$ ist.");
  } else {
    const t = tx("Careful! A square is never negative, so it can't equal a negative number.", "Vorsicht! Ein Quadrat ist nie negativ, kann also nicht gleich einer negativen Zahl sein.");
    say[0] = t;
    say[1] = t;
  }
  const mistakes: Mistake[] = [0, 1, 2]
    .filter((i) => i !== right && say[i])
    .map((i) => ({ when: { kind: "choice" as const, options, correct: at(i) }, title: tx("Look at the sign", "Schau aufs Vorzeichen"), say: say[i] }));
  return {
    instruction: tx("How many solutions does the equation have?", "Wie viele Lösungen hat die Gleichung?"),
    math,
    answer: { kind: "choice", options, correct: at(right) },
    hint: tx(
      "Bring it into the form $x^2 = c$ (or bracket$^2 = c$). Is $c$ positive, zero or negative?",
      "Bring die Gleichung in die Form $x^2 = c$ (oder Klammer$^2 = c$). Ist $c$ positiv, null oder negativ?",
    ),
    solution: frames,
    mistakes,
  };
}

// Shape 5: find the mistake in a classmate's work.
const NAMES = ["Lea", "Ben", "Mia", "Tom", "Emma", "Paul", "Finn", "Lena", "Leon", "Anna", "Jonas", "Elif", "Can", "Sara"];

type Statement = { text: Text; why?: Text };

function mistakeShape(rng: Rng): Exercise | null {
  const name = rng.pick(NAMES);
  const kind = rng.pick(["neg", "div", "square", "bracket", "zero", "moved", "subtract"] as const);
  const OK: Statement = { text: tx("Everything is right.", "Alles ist richtig.") };
  let work: string;
  let right: Statement;
  let others: Statement[];
  let okWhy: Text;
  let solution: Frame[];
  if (kind === "neg") {
    const r = rng.int(3, 12);
    work = `x^2 = ${r * r} \\Rightarrow L = \\{ ${r} \\}`;
    right = { text: tx(`The solution $x = -${r}$ is missing.`, `Die Lösung $x = -${r}$ fehlt.`) };
    others = [
      { text: tx(`It should be $x = ${dec((r * r) / 2)}$, half of $${r * r}$.`, `Es müsste $x = ${dec((r * r) / 2)}$ heißen, die Hälfte von $${r * r}$.`), why: tx("The root isn't half of the number: $" + r + " \\cdot " + r + " = " + r * r + "$ is right.", "Die Wurzel ist nicht die Hälfte: $" + r + " \\cdot " + r + " = " + r * r + "$ stimmt.") },
      { text: tx(`$x^2 = ${r * r}$ has no solution.`, `$x^2 = ${r * r}$ hat keine Lösung.`) },
    ];
    okWhy = tx(`$(-${r})^2 = ${r * r}$ as well.`, `Auch $(-${r})^2 = ${r * r}$.`);
    solution = pureFrames(1, 0, r * r);
  } else if (kind === "div") {
    const b = rng.nonZero(-9, 9);
    work = `x^2 = ${dec(b)}x \\quad | : x \\Rightarrow x = ${dec(b)}`;
    right = { text: tx("Dividing by $x$ loses the solution $x = 0$.", "Beim Teilen durch $x$ geht die Lösung $x = 0$ verloren.") };
    others = [
      { text: tx(`The solution $x = ${dec(-b)}$ is missing.`, `Die Lösung $x = ${dec(-b)}$ fehlt.`), why: tx(`Try it: $(${dec(-b)})^2 = ${b * b}$, but $${dec(b)} \\cdot (${dec(-b)}) = ${dec(-b * b)}$. That doesn't fit.`, `Probier's: $(${dec(-b)})^2 = ${b * b}$, aber $${dec(b)} \\cdot (${dec(-b)}) = ${dec(-b * b)}$. Das passt nicht.`) },
      { text: tx(`You have to take the root: $x = \\pm\\sqrt{${dec(b)}}$.`, `Man muss die Wurzel ziehen: $x = \\pm\\sqrt{${dec(b)}}$.`) },
    ];
    okWhy = tx("Put $x = 0$ in: $0^2 = 0$ and $" + dec(b) + " \\cdot 0 = 0$. That's a solution too!", "Setz $x = 0$ ein: $0^2 = 0$ und $" + dec(b) + " \\cdot 0 = 0$. Das ist auch eine Lösung!");
    solution = factorFrames(1, -b, true);
  } else if (kind === "square") {
    const r = rng.int(2, 9);
    work = `x^2 + ${r * r} = 0 \\Rightarrow x^2 = -${r * r} \\Rightarrow x = \\pm ${r}`;
    right = { text: tx(`$x^2 = -${r * r}$ has no solution: a square is never negative.`, `$x^2 = -${r * r}$ hat keine Lösung: Ein Quadrat ist nie negativ.`) };
    others = [
      {
        text: tx(`The $${r * r}$ keeps its plus sign on the other side.`, `Die $${r * r}$ behält auf der anderen Seite ihr Plus.`),
        why: tx(`No: a number that changes sides flips its sign. So $x^2 = -${r * r}$ was right.`, `Nein: Eine Zahl, die die Seite wechselt, dreht ihr Vorzeichen. $x^2 = -${r * r}$ war also richtig.`),
      },
      { text: tx(`Only $x = ${r}$ is right, not $x = -${r}$.`, `Nur $x = ${r}$ stimmt, nicht $x = -${r}$.`) },
    ];
    okWhy = tx(`Put $x = ${r}$ in: $${r}^2 + ${r * r} = ${2 * r * r}$, not $0$.`, `Setz $x = ${r}$ ein: $${r}^2 + ${r * r} = ${2 * r * r}$, nicht $0$.`);
    solution = pureFrames(1, r * r, 0);
  } else if (kind === "bracket") {
    const d = rng.nonZero(-5, 5);
    const r = rng.int(1, 6);
    if (r === Math.abs(d)) return null;
    const w1 = r - d;
    const w2 = -r - d;
    work = `(${minusR(d)})^2 = ${r * r} \\Rightarrow ${minusR(d)} = \\pm ${r} \\Rightarrow L = \\{ ${[w1, w2].sort((u, v) => u - v).map(dec).join("; ")} \\}`;
    right = {
      text:
        d > 0
          ? tx(`In the last step the $${d}$ has to be **added**, not subtracted.`, `Im letzten Schritt muss die $${d}$ **addiert** werden, nicht abgezogen.`)
          : tx(`In the last step the $${-d}$ has to be **subtracted**, not added.`, `Im letzten Schritt muss die $${-d}$ **abgezogen** werden, nicht addiert.`),
    };
    others = [
      r >= 3
        ? { text: tx(`$\\sqrt{${r * r}}$ is $${dec((r * r) / 2)}$, not $${r}$.`, `$\\sqrt{${r * r}}$ ist $${dec((r * r) / 2)}$, nicht $${r}$.`) }
        : {
            text: tx("You have to multiply out the bracket first.", "Man muss die Klammer zuerst ausmultiplizieren."),
            why: tx("You could, but you don't have to: taking the root of the whole bracket is right and faster.", "Kann man, muss man aber nicht: Die Wurzel aus der ganzen Klammer zu ziehen ist richtig und schneller."),
          },
      { text: tx("A squared bracket only gives one solution.", "Eine quadrierte Klammer ergibt nur eine Lösung."), why: tx(`No: the bracket can be $${r}$ or $-${r}$, so there are two.`, `Nein: Die Klammer kann $${r}$ oder $-${r}$ sein, also gibt es zwei.`) },
    ];
    okWhy = tx(`Put $x = ${dec(w1)}$ in: $(${dec(w1)} ${d > 0 ? "-" : "+"} ${Math.abs(d)})^2 = ${(w1 - d) ** 2}$, not $${r * r}$.`, `Setz $x = ${dec(w1)}$ ein: $(${dec(w1)} ${d > 0 ? "-" : "+"} ${Math.abs(d)})^2 = ${(w1 - d) ** 2}$, nicht $${r * r}$.`);
    solution = bracketFrames(d, 0, r * r);
  } else if (kind === "zero") {
    const u = rng.nonZero(-8, 8);
    const v = rng.nonZero(-8, 8);
    if (u === v || u === -v) return null;
    work = `(${minusR(u)})(${minusR(v)}) = 0 \\Rightarrow L = \\{ ${[-u, -v].sort((p, q) => p - q).map(dec).join("; ")} \\}`;
    right = { text: tx("The signs are flipped: each bracket gives the opposite number.", "Die Vorzeichen sind vertauscht: Jede Klammer liefert die Gegenzahl.") };
    others = [
      { text: tx("You have to multiply out the brackets first.", "Man muss zuerst die Klammern ausmultiplizieren."), why: tx("You could, but you don't have to: the zero product rule works directly on the brackets.", "Kann man, muss man aber nicht: Der Satz vom Nullprodukt funktioniert direkt mit den Klammern.") },
      { text: tx("A product is $0$ only if **both** factors are $0$.", "Ein Produkt ist nur $0$, wenn **beide** Faktoren $0$ sind.") },
    ];
    okWhy = tx(`Put $x = ${dec(-u)}$ in: $(${dec(-u)} ${u > 0 ? "-" : "+"} ${Math.abs(u)}) = ${dec(-2 * u)}$, not $0$.`, `Setz $x = ${dec(-u)}$ ein: $(${dec(-u)} ${u > 0 ? "-" : "+"} ${Math.abs(u)}) = ${dec(-2 * u)}$, nicht $0$.`);
    solution = zeroFrames(1, { k: 1, m: u }, { k: 1, m: v });
  } else if (kind === "moved") {
    const r = rng.int(2, 11);
    work = `x^2 - ${r * r} = 0 \\Rightarrow x^2 = -${r * r} \\Rightarrow L = \\{ \\}`;
    right = { text: tx(`When $${r * r}$ changes sides, its sign flips: $x^2 = ${r * r}$.`, `Wenn $${r * r}$ die Seite wechselt, dreht sich das Vorzeichen: $x^2 = ${r * r}$.`) };
    others = [
      { text: tx(`$x^2 = -${r * r}$ gives $x = -${r}$.`, `$x^2 = -${r * r}$ ergibt $x = -${r}$.`) },
      { text: tx("You have to divide by $x$ first.", "Man muss zuerst durch $x$ teilen.") },
    ];
    okWhy = tx(`Put $x = ${r}$ in: $${r}^2 - ${r * r} = 0$. So there **is** a solution.`, `Setz $x = ${r}$ ein: $${r}^2 - ${r * r} = 0$. Es **gibt** also eine Lösung.`);
    solution = pureFrames(1, -r * r, 0);
  } else {
    const a = rng.int(2, 5);
    const s = rng.int(2, 6);
    work = `${a}x^2 = ${a * s * s} \\Rightarrow x^2 = ${a * s * s - a}`;
    right = { text: tx(`$${a}x^2$ means $${a} \\cdot x^2$: divide by $${a}$, don't subtract.`, `$${a}x^2$ heißt $${a} \\cdot x^2$: durch $${a}$ teilen, nicht abziehen.`) };
    others = [
      { text: tx(`The $${a * s * s}$ has to change its sign.`, `Die $${a * s * s}$ muss ihr Vorzeichen ändern.`), why: tx("Nothing changed sides here, so no sign flips.", "Hier hat nichts die Seite gewechselt, also dreht sich kein Vorzeichen.") },
      { text: tx("You have to take the root first.", "Man muss zuerst die Wurzel ziehen.") },
    ];
    okWhy = tx(`Check: $${a} \\cdot ${a * s * s - a}$ isn't $${a * s * s}$.`, `Prüf nach: $${a} \\cdot ${a * s * s - a}$ ist nicht $${a * s * s}$.`);
    solution = pureFrames(a, 0, a * s * s);
  }
  const all = rng.shuffle([right, ...others, OK]);
  const options = all.map((s) => s.text);
  const mistakes: Mistake[] = all
    .map((s, i): Mistake | null =>
      s === OK
        ? { when: { kind: "choice", options, correct: i }, title: tx("There is a mistake", "Da steckt ein Fehler"), say: cat(tx("Hmm, look again. ", "Hm, schau noch mal. "), okWhy) }
        : s.why
          ? { when: { kind: "choice", options, correct: i }, title: tx("That step was fine", "Der Schritt war richtig"), say: s.why }
          : null,
    )
    .filter((m): m is Mistake => m !== null);
  return {
    instruction: tx("Find the mistake", "Finde den Fehler"),
    text: tx(`${name} solved an equation like this. What went wrong?`, `${name} hat eine Gleichung so gelöst. Was ist schiefgegangen?`),
    math: work,
    answer: { kind: "choice", options, correct: all.indexOf(right) },
    hint: tx("Put the solutions back into the equation. Does every step hold?", "Setz die Lösungen in die Gleichung ein. Stimmt jeder Schritt?"),
    solution: [{ math: work, note: cat(tx(`${name}'s work. `, `${name}s Rechnung. `), right.text) }, ...solution],
    mistakes,
  };
}

// Shape 6: word problems.
function wordShape(rng: Rng): Exercise | null {
  const kind = rng.pick(["field", "field", "think", "think", "same", "rect"] as const);
  const name = rng.pick(NAMES);
  if (kind === "field") {
    const s = rng.int(3, 15);
    const unit = rng.pick(["m", "cm"] as const);
    const what = rng.pick([tx("A square garden", "Ein quadratischer Garten"), tx("A square tile", "Eine quadratische Fliese"), tx("A square field", "Ein quadratisches Feld")]);
    const A = s * s;
    const neg: Mistake = {
      when: { kind: "number", value: -s },
      title: tx("A length is positive", "Eine Länge ist positiv"),
      say: tx(`The equation has $-${s}$ as a solution too, but a side can't be negative.`, `Die Gleichung hat auch $-${s}$ als Lösung, aber eine Seite kann nicht negativ sein.`),
    };
    const half: Mistake = {
      when: { kind: "number", value: A / 2 },
      title: tx("A root isn't half", "Wurzel ist nicht die Hälfte"),
      say: tx(`You halved $${A}$. But you need the number that **times itself** gives $${A}$.`, `Du hast $${A}$ halbiert. Gesucht ist aber die Zahl, die **mal sich selbst** $${A}$ ergibt.`),
    };
    const quarter: Mistake = {
      when: { kind: "number", value: A / 4 },
      title: tx("That's the perimeter idea", "Das wäre der Umfang"),
      say: tx("Dividing by $4$ works for the perimeter. For the area, side times side gives $A$: take the root.", "Durch $4$ teilen passt beim Umfang. Beim Flächeninhalt gilt Seite mal Seite: Zieh die Wurzel."),
    };
    return {
      instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
      text: cat(
        what,
        tx(` has an area of $${A}$ ${unit}². How long is one side?`, ` hat einen Flächeninhalt von $${A}$ ${unit}². Wie lang ist eine Seite?`),
      ),
      answer: { kind: "number", value: s, unit },
      hint: tx("Call the side $x$. Then $x \\cdot x = x^2$ is the area.", "Nenne die Seite $x$. Dann ist $x \\cdot x = x^2$ der Flächeninhalt."),
      solution: [
        ...pureFrames(1, 0, A, tx(`Side $x$: the area is $x^2 = ${A}$.`, `Seite $x$: Der Flächeninhalt ist $x^2 = ${A}$.`)),
        {
          math: `x#x =#eq ${s}#Lv1 "${unit}"#u`,
          note: tx(`A side can't be negative, so only $${s}$ fits. Each side is $${s}$ ${unit} long.`, `Eine Seite kann nicht negativ sein, also passt nur $${s}$. Jede Seite ist $${s}$ ${unit} lang.`),
        },
      ],
      mistakes: [neg, half, quarter].filter((m) => m.when.kind === "number" && m.when.value !== s),
    };
  }
  if (kind === "think") {
    const s = rng.int(2, 12);
    const k = rng.nonZero(-20, 20);
    const m = s * s + k;
    const op = k > 0 ? tx(`adds $${k}$`, `addiert $${k}$`) : tx(`subtracts $${-k}$`, `zieht $${-k}$ ab`);
    return {
      instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
      text: cat(
        tx(`${name} thinks of a number, squares it and `, `${name} denkt sich eine Zahl, quadriert sie und `),
        op,
        tx(`. The result is $${m}$. Which numbers can it be?`, `. Das Ergebnis ist $${m}$. Welche Zahlen kommen infrage?`),
      ),
      answer: solutionsAnswer([s, -s]),
      hint: tx("Write it as an equation with $x^2$. There may be two numbers!", "Schreib es als Gleichung mit $x^2$. Es kann zwei Zahlen geben!"),
      solution: pureFrames(1, k, m, tx(`The number is $x$: $x^2 ${k > 0 ? "+" : "-"} ${Math.abs(k)} = ${m}$.`, `Die Zahl heißt $x$: $x^2 ${k > 0 ? "+" : "-"} ${Math.abs(k)} = ${m}$.`)),
      mistakes: pureMistakes(1, k, m),
    };
  }
  if (kind === "same") {
    const b = rng.int(2, 12);
    return {
      instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
      text: tx(
        `${name} multiplies a number by itself and gets the same as $${b}$ times the number. Which numbers work?`,
        `${name} multipliziert eine Zahl mit sich selbst und erhält dasselbe wie das $${b}$-Fache der Zahl. Welche Zahlen passen?`,
      ),
      answer: solutionsAnswer([0, b]),
      hint: tx(`$x^2 = ${b}x$. Don't divide by $x$!`, `$x^2 = ${b}x$. Nicht durch $x$ teilen!`),
      solution: factorFrames(1, -b, true),
      mistakes: factorMistakes(1, -b, true),
    };
  }
  const k = rng.int(2, 5);
  const w = rng.int(2, 9);
  const A = k * w * w;
  const rectMistakes: Mistake[] = [
    { when: { kind: "number", value: k * w }, title: tx("That's the length", "Das ist die Länge"), say: tx("That's the long side. The question asks for the width.", "Das ist die lange Seite. Gefragt ist die Breite.") },
    {
      when: { kind: "number", value: w * w },
      title: tx("Root forgotten", "Wurzel vergessen"),
      say: tx(`Nearly! $${w * w}$ is $x^2$, the width squared. Now take the root.`, `Fast! $${w * w}$ ist $x^2$, also die Breite zum Quadrat. Jetzt noch die Wurzel ziehen.`),
    },
    {
      when: { kind: "number", value: A / (k + 1) },
      title: tx("Length times width", "Länge mal Breite"),
      say: tx(`The area is length **times** width: $x \\cdot ${k}x = ${k}x^2$, not $x + ${k}x$.`, `Der Flächeninhalt ist Länge **mal** Breite: $x \\cdot ${k}x = ${k}x^2$, nicht $x + ${k}x$.`),
    },
  ];
  return {
    instruction: tx("Solve the word problem", "Löse die Textaufgabe"),
    text: tx(
      `A rectangle is $${k}$ times as long as it is wide. Its area is $${A}$ cm². How wide is it?`,
      `Ein Rechteck ist $${k}$-mal so lang wie breit. Sein Flächeninhalt ist $${A}$ cm². Wie breit ist es?`,
    ),
    answer: { kind: "number", value: w, unit: "cm" },
    hint: tx(`Width $x$, length $${k}x$. Then $x \\cdot ${k}x = ${A}$.`, `Breite $x$, Länge $${k}x$. Dann gilt $x \\cdot ${k}x = ${A}$.`),
    solution: [
      ...pureFrames(k, 0, A, tx(`Width $x$, length $${k}x$: $x \\cdot ${k}x = ${k}x^2 = ${A}$.`, `Breite $x$, Länge $${k}x$: $x \\cdot ${k}x = ${k}x^2 = ${A}$.`)),
      { math: `x#x =#eq ${w}#Lv1 "cm"#u`, note: tx(`Only the positive solution makes sense: the rectangle is $${w}$ cm wide (and $${k * w}$ cm long).`, `Nur die positive Lösung ist sinnvoll: Das Rechteck ist $${w}$ cm breit (und $${k * w}$ cm lang).`) },
    ],
    mistakes: rectMistakes.filter(
      (m, i) =>
        m.when.kind === "number" &&
        Number.isInteger(m.when.value) &&
        m.when.value !== w &&
        rectMistakes.findIndex((o) => o.when.kind === "number" && m.when.kind === "number" && o.when.value === m.when.value) === i,
    ),
  };
}

function raw1(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.27) return rootShape(rng);
  if (roll < 0.43) return factorShape(rng);
  if (roll < 0.59) return zeroShape(rng);
  if (roll < 0.72) return countShape(rng);
  if (roll < 0.86) return mistakeShape(rng);
  return wordShape(rng);
}

export function generate1(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const ex = raw1(rng);
    if (ex) return localize(ex);
  }
  return localize(pureTask(1, 0, 25));
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  {
    math: "x#x ^{2#e} =#eq 25#c",
    note: tx("An equation with $x^2$ is a **quadratic equation**. Which number times itself gives $25$?", "Eine Gleichung mit $x^2$ heißt **quadratische Gleichung**. Welche Zahl mal sich selbst ergibt $25$?"),
  },
  { math: "5#a \\cdot#d 5#b =#eq 25#c", note: tx("$5$ works: $5 \\cdot 5 = 25$.", "$5$ passt: $5 \\cdot 5 = 25$.") },
  {
    math: "(-#as 5#a)#ab \\cdot#d (-#bs 5#b)#bb =#eq 25#c",
    highlight: ["as", "bs"],
    note: tx("But $-5$ works too! Minus times minus is plus: $(-5) \\cdot (-5) = 25$.", "Aber $-5$ passt auch! Minus mal Minus ist Plus: $(-5) \\cdot (-5) = 25$."),
  },
  {
    math: "x#x _{1#i1} =#eq 5#a \\quad x#x2 _{2#i2} =#eq2 -#bs 5#b",
    note: tx("So there are **two** solutions: $x_1 = 5$ and $x_2 = -5$.", "Es gibt also **zwei** Lösungen: $x_1 = 5$ und $x_2 = -5$."),
  },
  {
    math: "L#L =#Leq \\{#Llb -#bs 5#b ;#Lsc 5#a \\}#Lrb",
    note: tx(
      "Write them as a **solution set**: $L = \\{ -5; 5 \\}$. Short form: $x = \\pm 5$.",
      "Du schreibst sie als **Lösungsmenge**: $L = \\{ -5; 5 \\}$. Kurz auch $x = \\pm 5$.",
    ),
  },
];

const pureLessonFrames: Frame[] = [
  ...pureFrames(2, -18, 0, tx("$2x^2 - 18 = 0$: there's more than $x^2$ on the left.", "$2x^2 - 18 = 0$: Links steht mehr als nur $x^2$.")),
  { math: "x#x ^{2#e} +#ks 4#k =#eq 0#m", note: tx("Now try $x^2 + 4 = 0$.", "Jetzt probier $x^2 + 4 = 0$.") },
  ...pureFrames(1, 4, 0).slice(1),
];

const bracketLessonFrames: Frame[] = [
  ...bracketFrames(2, 0, 9, tx("$(x - 2)^2 = 9$. Don't multiply out! The whole bracket is squared, so treat it like one block.", "$(x - 2)^2 = 9$. Nicht ausmultiplizieren! Die ganze Klammer ist quadriert, also behandle sie wie einen Block.")),
];

const zeroLessonFrames: Frame[] = [
  {
    math: "a#a \\cdot#d b#b =#eq 0#z",
    note: tx(
      "A product is $0$ only if **at least one** factor is $0$. ($3 \\cdot 5$ is never $0$, but $3 \\cdot 0$ is.)",
      "Ein Produkt ist nur dann $0$, wenn **mindestens ein** Faktor $0$ ist. ($3 \\cdot 5$ ist nie $0$, $3 \\cdot 0$ schon.)",
    ),
  },
  ...zeroFrames(1, { k: 1, m: -1 }, { k: 1, m: 4 }).map((f, i) =>
    i === 0 ? { ...f, note: tx("Here the factors are $x + 1$ and $x - 4$.", "Hier sind die Faktoren $x + 1$ und $x - 4$.") } : f,
  ),
];

const factorLessonFrames: Frame[] = [
  ...factorFrames(1, -5),
  {
    math: "x#x ^{2#e} =#eq 5#c x#v \\quad \\red{|#bar :#dv x#dx}",
    note: tx(
      "The same equation as $x^2 = 5x$? **Never** divide by $x$: you'd get only $x = 5$ and lose $x = 0$. Bring everything to one side and factor out.",
      "Dieselbe Gleichung als $x^2 = 5x$? Teile **nie** durch $x$: Du bekämst nur $x = 5$ und verlierst $x = 0$. Bring alles auf eine Seite und klammere aus.",
    ),
  },
];

const summary: SummaryBlock[] = [
  {
    title: tx("x² = c: take the root", "x² = c: Wurzel ziehen"),
    body: tx("A positive number has **two** square roots. Zero has one, a negative number none.", "Eine positive Zahl hat **zwei** Wurzeln. Null hat eine, eine negative Zahl keine."),
    examples: ["x^2 = 25 \\Rightarrow x = \\pm 5", "x^2 = 0 \\Rightarrow x = 0", tx('x^2 = -4 \\Rightarrow "no solution"', 'x^2 = -4 \\Rightarrow "keine Lösung"')],
    tone: "rule",
  },
  {
    title: tx("Get x² alone first", "Erst x² allein"),
    body: tx("Move the number, divide by the factor in front, then take the root.", "Zahl rüberbringen, durch den Faktor davor teilen, dann die Wurzel ziehen."),
    examples: ["2x^2 - 18 = 0 \\quad | + 18", "2x^2 = 18 \\quad | : 2", "x^2 = 9 \\Rightarrow L = \\{ -3; 3 \\}"],
    tone: "rule",
  },
  {
    title: tx("A squared bracket", "Eine Klammer zum Quadrat"),
    body: tx("Don't multiply out. The bracket is plus or minus the root.", "Nicht ausmultiplizieren. Die Klammer ist plus oder minus die Wurzel."),
    examples: ["(x - 2)^2 = 9 \\Rightarrow x - 2 = \\pm 3", "x_1 = 5 \\quad x_2 = -1"],
    tone: "rule",
  },
  {
    title: tx("The zero product rule", "Der Satz vom Nullprodukt"),
    body: tx("A product is $0$ when one of its factors is $0$.", "Ein Produkt ist $0$, wenn einer der Faktoren $0$ ist."),
    examples: [tx('a \\cdot b = 0 \\Leftrightarrow a = 0 "or" b = 0', 'a \\cdot b = 0 \\Leftrightarrow a = 0 "oder" b = 0'), "(x + 1)(x - 4) = 0 \\Rightarrow L = \\{ -1; 4 \\}"],
    tone: "rule",
  },
  {
    title: tx("No number on its own? Factor out x", "Keine Zahl ohne x? x ausklammern"),
    body: tx("Then one solution is always $0$.", "Dann ist eine Lösung immer $0$."),
    examples: ["x^2 - 5x = 0 \\Rightarrow x(x - 5) = 0", "L = \\{ 0; 5 \\}"],
    tone: "tip",
  },
  {
    title: tx("Classic mistakes", "Typische Fehler"),
    body: tx(
      "Forgetting the negative root, and dividing by $x$ (that loses $x = 0$).",
      "Die negative Wurzel vergessen und durch $x$ teilen (dabei geht $x = 0$ verloren).",
    ),
    examples: [tx('x^2 = 16 \\Rightarrow x = 4 "and" x = -4', 'x^2 = 16 \\Rightarrow x = 4 "und" x = -4'), "x^2 = 3x \\quad \\strike{| : x}"],
    tone: "warning",
  },
];

const lesson: LessonStep[] = [
  {
    type: "explain",
    title: tx("Two numbers, one square", "Zwei Zahlen, ein Quadrat"),
    blob: tx("Quadratic equations! Let's start without any formula at all.", "Quadratische Gleichungen! Wir starten ganz ohne Formel."),
    body: tx(
      "In a quadratic equation $x$ appears squared. The simplest kind looks like $x^2 = 25$.",
      "In einer quadratischen Gleichung kommt $x$ zum Quadrat vor. Die einfachste Sorte sieht so aus: $x^2 = 25$.",
    ),
    frames: introFrames,
  },
  {
    type: "widget",
    title: tx("Square roots on the parabola", "Wurzelziehen an der Parabel"),
    blob: tx("Drag the line up and down. When are there two points, when one, when none?", "Zieh die Gerade hoch und runter. Wann gibt es zwei Punkte, wann einen, wann keinen?"),
    body: tx(
      "The solutions of $x^2 = c$ are where the parabola $y = x^2$ meets the line $y = c$. Move the line and watch how many crossing points there are.",
      "Die Lösungen von $x^2 = c$ liegen dort, wo die Parabel $y = x^2$ die Gerade $y = c$ trifft. Verschieb die Gerade und schau, wie viele Schnittpunkte es gibt.",
    ),
    widget: RootLab,
  },
  {
    type: "explain",
    title: tx("First get x² alone", "Erst x² allein, dann die Wurzel"),
    blob: tx("Tidy up first, then take the root. Like clearing your desk before homework.", "Erst aufräumen, dann Wurzel ziehen. Wie den Schreibtisch, bevor du Hausaufgaben machst."),
    body: tx(
      "If there's more than $x^2$ on one side, rearrange first: move the number, then divide by the factor in front of $x^2$.",
      "Steht mehr als $x^2$ auf einer Seite, stellst du zuerst um: Zahl auf die andere Seite bringen, dann durch den Faktor vor $x^2$ teilen.",
    ),
    frames: pureLessonFrames,
  },
  {
    type: "check",
    blob: tx("Your turn! Two solutions, remember?", "Du bist dran! Zwei Lösungen, schon vergessen?"),
    exercise: pureTask(3, -48, 0, tx("Add $48$, then divide by $3$. Then take the root.", "Addiere $48$, teile dann durch $3$. Dann zieh die Wurzel.")),
  },
  {
    type: "explain",
    title: tx("A squared bracket", "Eine Klammer zum Quadrat"),
    blob: tx("Brackets? No need to multiply out. Watch this shortcut.", "Klammern? Kein Ausmultiplizieren nötig. Schau dir diese Abkürzung an."),
    body: tx(
      "With $(x - 2)^2 = 9$ you take the root of the whole bracket. That gives two simple equations.",
      "Bei $(x - 2)^2 = 9$ ziehst du die Wurzel aus der ganzen Klammer. Das ergibt zwei einfache Gleichungen.",
    ),
    frames: bracketLessonFrames,
  },
  {
    type: "check",
    blob: tx("The bracket is plus or minus something. Go!", "Die Klammer ist plus oder minus etwas. Los!"),
    exercise: bracketTask(-3, 0, 16),
  },
  {
    type: "explain",
    title: tx("The zero product rule", "Der Satz vom Nullprodukt"),
    blob: tx("Zero is a very special number. Watch what it does to a product.", "Die Null ist eine ganz besondere Zahl. Schau, was sie mit einem Produkt macht."),
    body: tx(
      "If a product equals $0$, you can split the equation: each factor gets its own little equation.",
      "Ist ein Produkt gleich $0$, kannst du die Gleichung aufteilen: Jeder Faktor bekommt seine eigene kleine Gleichung.",
    ),
    frames: zeroLessonFrames,
  },
  {
    type: "widget",
    title: tx("The zero product detector", "Der Nullprodukt-Detektor"),
    blob: tx("Slide x and hunt for the zeros. Can you find both?", "Schieb x und such die Nullstellen. Findest du beide?"),
    body: tx(
      "Pick the numbers in the brackets with $-$ and $+$, then slide $x$. The product is $0$ exactly where one of the brackets is $0$.",
      "Stell die Zahlen in den Klammern mit $-$ und $+$ ein und schieb dann $x$. Das Produkt ist genau dort $0$, wo eine der Klammern $0$ ist.",
    ),
    widget: ZeroProductLab,
  },
  {
    type: "check",
    blob: tx("Each bracket on its own. Careful with the 2!", "Jede Klammer einzeln. Vorsicht mit der 2!"),
    exercise: zeroTask(1, { k: 2, m: 6 }, { k: 1, m: -5 }),
  },
  {
    type: "explain",
    title: tx("Factor out x", "x ausklammern"),
    blob: tx("No number on its own? Then x itself can be pulled out.", "Keine Zahl ohne x? Dann kannst du x selbst ausklammern."),
    body: tx(
      "If every term contains $x$, factor it out. Then the zero product rule does the rest.",
      "Enthält jeder Term ein $x$, klammerst du es aus. Den Rest erledigt der Satz vom Nullprodukt.",
    ),
    frames: factorLessonFrames,
  },
  {
    type: "check",
    blob: tx("Last one! What can you factor out?", "Letzte Aufgabe! Was kannst du ausklammern?"),
    exercise: factorTask(1, 6),
  },
];

/** Level 1 (Klasse 8–9): quadratic equations without a formula. */
export const level1: LevelLesson = localize({ lesson, summary });

