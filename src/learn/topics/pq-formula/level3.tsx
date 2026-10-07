"use client";

import { resolveText, tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LessonStep, LevelLesson, Mistake, SummaryBlock } from "@/learn/types";
import { cat, clean, dec, localize, minusR, NO_SOLUTION, num, par, ptSrc, quadSrc, rootsOf, setKeyed, solutionMistakes, solutionsAnswer } from "./shared";
import { ParamLab, VertexLab, vertexSrc } from "./widgets3";

// Level 3 (Klasse 10 and Oberstufe): parabolas in vertex form by completing the square, the
// abc formula, factorised form with Vieta, biquadratic equations and a parameter.

const F = "f#f (x#fx)#fb =#feq";
const sgn = (v: number) => (v < 0 ? "-" : "+");
/** A keyed term c·x^p after something: "+#s 4#c x#v". */
function keyedTerm(c: number, v: string, k: string, first = false): string {
  const abs = Math.abs(c);
  const sign = c < 0 ? `-#s${k} ` : first ? "" : `+#s${k} `;
  const coef = v && abs === 1 ? "" : `${dec(abs)}#c${k} `;
  return `${sign}${coef}${v}`.trim();
}
/** "2#ca " or "-#sa " or "" for the factor in front. */
const leadKeyed = (a: number) => (a === 1 ? "" : a === -1 ? "-#sa " : a < 0 ? `-#sa ${dec(-a)}#ca ` : `${dec(a)}#ca `);
const lead = (a: number) => (a === 1 ? "" : a === -1 ? "-" : dec(a));
/** "-#qs 4#h2": a signed number after something, with fixed keys so it can morph. */
const signedKeyed = (v: number, sk: string, nk: string) => `${v < 0 ? "-" : "+"}#${sk} ${dec(Math.abs(v))}#${nk}`;
/** "lhs = 0" that breaks before the "=" on a phone, never between "=" and "0". */
const eq0 = (lhs: string) => `\\group{${lhs}} \\group{= 0}`;
const isNice = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;
const T_SIGN_D = tx("Sign of d", "Vorzeichen von d");

// ---------------------------------------------------------------------------
// Completing the square: f(x) = ax² + bx + c → a(x − d)² + e

function vertexFrames(a: number, b: number, c: number): Frame[] {
  const p = clean(b / a);
  const h = clean(p / 2);
  const hx = Math.abs(h);
  const hs = sgn(h);
  const d = -h;
  const hq = clean(h * h);
  const e = clean(c - a * hq);
  const cTerm = c ? ` ${keyedTerm(c, "", "c")}` : "";
  const sq = `(x#x ${hs}#sb ${dec(hx)}#h1)#B ^{2#e}`;
  const plus = `+#qa ${dec(hx)}#h1 ^{2#h1e} -#qs ${dec(hx)}#h2 ^{2#h2e}`;
  const frames: Frame[] = [];
  const eTerm = e ? ` ${signedKeyed(e, "qs", "h2")}` : "";
  const sFrame = (form: string): Frame => ({
    math: `${form} \\quad S#S (${num(d, "sd")} \\, |#sbar \\, ${e < 0 ? `\\group{${num(e, "se")}}` : num(e, "se")})#SB`,
    highlight: ["sd", "sds", "se", "ses"],
    note: tx(
      `Read off the vertex: $S${ptSrc(d, e)}$. Careful: $(x ${hs} ${dec(hx)})$ means $d = ${dec(d)}$, the opposite sign.`,
      `Lies den Scheitelpunkt ab: $S${ptSrc(d, e)}$. Vorsicht: $(x ${hs} ${dec(hx)})$ bedeutet $d = ${dec(d)}$, also das umgekehrte Vorzeichen.`,
    ),
  });
  if (a === 1) {
    frames.push(
      {
        math: `${F} x#x ^{2#e} ${keyedTerm(b, "x#vb", "b")}${cTerm}`,
        highlight: ["sb", "cb", "vb"],
        note: tx(
          `Look at the $x$-term: $${dec(b)}x$. Half of $${dec(b)}$ is $${dec(h)}$.`,
          `Schau auf den $x$-Term: $${dec(b)}x$. Die Hälfte von $${dec(b)}$ ist $${dec(h)}$.`,
        ),
      },
      {
        math: `${F} x#x ^{2#e} ${keyedTerm(b, "x#vb", "b")} ${plus}${cTerm}`,
        highlight: ["qa", "h1", "h1e", "qs", "h2", "h2e"],
        note: tx(
          `Add $${dec(hx)}^2$ and subtract it straight away. That adds $0$, so nothing changes. This is **completing the square**.`,
          `Addiere $${dec(hx)}^2$ und zieh es sofort wieder ab. Das ist plus $0$, es ändert sich also nichts. Das ist die **quadratische Ergänzung**.`,
        ),
      },
      {
        math: `${F} ${sq} -#qs ${dec(hx)}#h2 ^{2#h2e}${cTerm}`,
        note: tx(
          `The first three terms are a binomial formula: $x^2 ${sgn(b)} ${dec(Math.abs(b)) === "1" ? "" : dec(Math.abs(b))}x + ${dec(hx)}^2 = (x ${hs} ${dec(hx)})^2$.`,
          `Die ersten drei Terme sind eine binomische Formel: $x^2 ${sgn(b)} ${dec(Math.abs(b)) === "1" ? "" : dec(Math.abs(b))}x + ${dec(hx)}^2 = (x ${hs} ${dec(hx)})^2$.`,
        ),
      },
    );
    if (c) {
      frames.push({ math: `${F} ${sq} -#qs ${dec(hq)}#h2${cTerm}`, note: tx(`$${dec(hx)}^2 = ${dec(hq)}$.`, `$${dec(hx)}^2 = ${dec(hq)}$.`) });
      frames.push({
        math: `${F} ${sq}${eTerm}`,
        note: tx(`$-${dec(hq)} ${sgn(c)} ${dec(Math.abs(c))} = ${dec(e)}$. That's the **vertex form**.`, `$-${dec(hq)} ${sgn(c)} ${dec(Math.abs(c))} = ${dec(e)}$. Das ist die **Scheitelpunktform**.`),
      });
    } else {
      frames.push({ math: `${F} ${sq} -#qs ${dec(hq)}#h2`, note: tx(`$${dec(hx)}^2 = ${dec(hq)}$. That's the **vertex form**.`, `$${dec(hx)}^2 = ${dec(hq)}$. Das ist die **Scheitelpunktform**.`) });
    }
    frames.push(sFrame(`${F} ${sq}${eTerm}`));
    return frames;
  }
  const A = leadKeyed(a);
  const inner = `x#x ^{2#e} ${keyedTerm(p, "x#vb", "b")}`;
  const ah = clean(-a * hq);
  frames.push(
    {
      math: `${F} ${A}x#x ^{2#e} ${keyedTerm(b, "x#vb", "b")}${cTerm}`,
      note: tx(
        `There's a $${dec(a)}$ in front of $x^2$. Factor it out of the two $x$-terms first.`,
        `Vor $x^2$ steht $${dec(a)}$. Klammere diese Zahl zuerst aus den beiden $x$-Termen aus.`,
      ),
    },
    {
      math: `${F} ${A}(${inner})#B1${cTerm}`,
      note: tx(
        `$${quadSrc(a, b, 0)} = ${lead(a)}(x^2 ${sgn(p)} ${Math.abs(p) === 1 ? "" : dec(Math.abs(p))}x)$.${c ? ` The $${dec(c)}$ stays outside.` : ""}`,
        `$${quadSrc(a, b, 0)} = ${lead(a)}(x^2 ${sgn(p)} ${Math.abs(p) === 1 ? "" : dec(Math.abs(p))}x)$.${c ? ` Die $${dec(c)}$ bleibt draußen.` : ""}`,
      ),
    },
    {
      math: `${F} ${A}(${inner} ${plus})#B1${cTerm}`,
      highlight: ["qa", "h1", "h1e", "qs", "h2", "h2e"],
      note: tx(
        `Complete the square inside the bracket: half of $${dec(p)}$ is $${dec(h)}$, so add and subtract $${dec(hx)}^2$.`,
        `Quadratische Ergänzung in der Klammer: Die Hälfte von $${dec(p)}$ ist $${dec(h)}$, also $${dec(hx)}^2$ addieren und wieder abziehen.`,
      ),
    },
    {
      math: `${F} ${A}[${sq} -#qs ${dec(hq)}#h2]#B1${cTerm}`,
      note: tx(
        `Binomial formula inside, and $${dec(hx)}^2 = ${dec(hq)}$.`,
        `Innen die binomische Formel, und $${dec(hx)}^2 = ${dec(hq)}$.`,
      ),
    },
    {
      math: `${F} ${A}${sq} ${signedKeyed(ah, "qs", "h2")}${cTerm}`,
      highlight: ["h2", "qs"],
      note: tx(
        `Multiply the $${dec(a)}$ into the square bracket: $${dec(a)} \\cdot (-${dec(hq)}) = ${dec(ah)}$. Don't forget this step!`,
        `Multipliziere die $${dec(a)}$ in die eckige Klammer hinein: $${dec(a)} \\cdot (-${dec(hq)}) = ${dec(ah)}$. Diesen Schritt bloß nicht vergessen!`,
      ),
    },
  );
  if (c)
    frames.push({
      math: `${F} ${A}${sq}${eTerm}`,
      note: tx(`$${dec(ah)} ${sgn(c)} ${dec(Math.abs(c))} = ${dec(e)}$. That's the **vertex form**.`, `$${dec(ah)} ${sgn(c)} ${dec(Math.abs(c))} = ${dec(e)}$. Das ist die **Scheitelpunktform**.`),
    });
  frames.push(sFrame(`${F} ${A}${sq}${eTerm}`));
  return frames;
}

function vertexMistakes(a: number, b: number, c: number): Mistake[] {
  const h = b / (2 * a);
  const d = clean(-h);
  const e = clean(c - a * h * h);
  const names: [Text, Text] = ["x_S", "y_S"];
  const list: Mistake[] = [];
  const add = (v: [number, number], title: Text, say: Text, close = false) => {
    const vals = v.map(clean) as [number, number];
    if (vals.some((x) => !isNice(x)) || (vals[0] === d && vals[1] === e) || list.some((m) => m.when.kind === "pair" && m.when.values[0] === vals[0] && m.when.values[1] === vals[1])) return;
    list.push({ when: { kind: "pair", names, values: vals }, title, say, ...(close ? { close } : {}) });
  };
  const bracket = `(x ${sgn(-d)} ${dec(Math.abs(d))})`;
  add(
    [-d, e],
    T_SIGN_D,
    tx(
      `Nearly! In $a(x - d)^2 + e$ there's a **minus** before $d$. So $${bracket}^2$ means $d = ${dec(d)}$, not $${dec(-d)}$.`,
      `Fast! In $a(x - d)^2 + e$ steht ein **Minus** vor $d$. $${bracket}^2$ bedeutet also $d = ${dec(d)}$, nicht $${dec(-d)}$.`,
    ),
    true,
  );
  add(
    [d, clean(c + a * h * h)],
    tx("Added instead of subtracted", "Addiert statt abgezogen"),
    tx(
      "Ah, I see! You added the square to complete it, but it has to be **taken away** again right after. Otherwise the term changes.",
      "Ah, ich seh's! Du hast das Quadrat zum Ergänzen addiert, musst es aber sofort wieder **abziehen**. Sonst ändert sich der Term.",
    ),
  );
  add(
    [d, c],
    tx("The square never came back out", "Das Quadrat kam nie wieder raus"),
    tx(
      "You added the square inside but never subtracted it. Completing the square means $+h^2 - h^2$: the $-h^2$ moves out of the bracket.",
      "Du hast das Quadrat ergänzt, aber nie wieder abgezogen. Quadratische Ergänzung heißt $+h^2 - h^2$: Das $-h^2$ wandert aus der Klammer heraus.",
    ),
  );
  if (a !== 1) {
    add(
      [d, clean(c - h * h)],
      tx("Factor a forgotten", "Faktor a vergessen"),
      tx(
        `Nearly! When the $-${dec(clean(h * h))}$ leaves the bracket, it gets multiplied by the $${dec(a)}$ in front: $${dec(a)} \\cdot (-${dec(clean(h * h))})$.`,
        `Fast! Wenn die $-${dec(clean(h * h))}$ die Klammer verlässt, wird sie mit der $${dec(a)}$ davor multipliziert: $${dec(a)} \\cdot (-${dec(clean(h * h))})$.`,
      ),
      true,
    );
    add(
      [clean(-b / 2), clean(c - (b * b) / 4)],
      tx("a not factored out", "a nicht ausgeklammert"),
      tx(
        `Ah, I see! You completed the square as if there were no $${dec(a)}$ in front of $x^2$. Factor out the $${dec(a)}$ first.`,
        `Ah, ich seh's! Du hast ergänzt, als stünde vor $x^2$ keine $${dec(a)}$. Klammere die $${dec(a)}$ zuerst aus.`,
      ),
    );
  }
  return list;
}

const VERTEX = tx("Complete the square: find the vertex", "Bestimme den Scheitelpunkt mit quadratischer Ergänzung");

function vertexTask(a: number, b: number, c: number): Exercise {
  const h = b / (2 * a);
  return {
    instruction: VERTEX,
    math: `f(x) = \\group{${quadSrc(a, b, c)}}`,
    answer: { kind: "pair", names: ["x_S", "y_S"], values: [clean(-h), clean(c - a * h * h)] },
    hint:
      a === 1
        ? tx("Halve the number in front of $x$, add its square and subtract it again.", "Halbiere die Zahl vor $x$, addiere ihr Quadrat und zieh es wieder ab.")
        : tx(`Factor $${dec(a)}$ out of the $x$-terms first. Then complete the square in the bracket.`, `Klammere zuerst $${dec(a)}$ aus den $x$-Termen aus. Dann ergänze in der Klammer.`),
    solution: vertexFrames(a, b, c),
    mistakes: vertexMistakes(a, b, c),
  };
}

// ---------------------------------------------------------------------------
// The abc formula

function abcFrames(a: number, b: number, c: number): Frame[] {
  const D = clean(b * b - 4 * a * c);
  const lead = "x#xx _{1,2#xs} =#eq";
  const den = `${dec(2 * a)}#t`;
  const m4 = clean(-4 * a * c);
  const frames: Frame[] = [
    {
      math: `${quadSrc(a, b, c)} = 0`,
      note: tx(`Read off $a = ${dec(a)}$, $b = ${dec(b)}$ and $c = ${dec(c)}$, signs included.`, `Lies $a = ${dec(a)}$, $b = ${dec(b)}$ und $c = ${dec(c)}$ ab, mit Vorzeichen.`),
    },
    {
      math: `${lead} \\frac{-#nbs ${par(b)}#nb \\pm#pm \\sqrt{${par(b)}#b2 ^{2#two} -#m4 4#four \\cdot#d1 ${par(a)}#A \\cdot#d2 ${par(c)}#C}#R}{2#t \\cdot#d3 ${par(a)}#A2}#F`,
      note: tx("Put them into the abc formula. Negative numbers go in brackets.", "Setz sie in die abc-Formel ein. Negative Zahlen kommen in Klammern."),
    },
    {
      math: `${lead} \\frac{${num(-b, "nb")} \\pm#pm \\sqrt{${dec(b * b)}#b2 ${m4 < 0 ? "-" : "+"}#m4 ${dec(Math.abs(m4))}#four}#R}{${den}}#F`,
      note: tx(
        `$-${par(b)} = ${dec(-b)}$, $${par(b)}^2 = ${dec(b * b)}$ and $-4 \\cdot ${par(a)} \\cdot ${par(c)} = ${dec(m4)}$.`,
        `$-${par(b)} = ${dec(-b)}$, $${par(b)}^2 = ${dec(b * b)}$ und $-4 \\cdot ${par(a)} \\cdot ${par(c)} = ${dec(m4)}$.`,
      ),
    },
    {
      math: `${lead} \\frac{${num(-b, "nb")} \\pm#pm \\sqrt{${num(D, "D")}}#R}{${den}}#F`,
      highlight: ["D", "Ds"],
      note:
        D > 0
          ? tx(`Under the root is the discriminant $D = b^2 - 4ac = ${dec(D)}$. Positive: **two** solutions.`, `Unter der Wurzel steht die Diskriminante $D = b^2 - 4ac = ${dec(D)}$. Positiv: **zwei** Lösungen.`)
          : D === 0
            ? tx("The discriminant is $D = 0$: plus or minus $0$ is the same, so **one** solution.", "Die Diskriminante ist $D = 0$: Plus oder minus $0$ ist dasselbe, also **eine** Lösung.")
            : tx(`The discriminant $D = ${dec(D)}$ is negative: no root, **no** solution.`, `Die Diskriminante $D = ${dec(D)}$ ist negativ: keine Wurzel, **keine** Lösung.`),
    },
  ];
  if (D > 0) {
    const r = clean(Math.sqrt(D));
    const x1 = clean((-b + r) / (2 * a));
    const x2 = clean((-b - r) / (2 * a));
    frames.push(
      { math: `${lead} \\frac{${num(-b, "nb")} \\pm#pm ${dec(r)}#R}{${den}}#F`, note: `$\\sqrt{${dec(D)}} = ${dec(r)}$.` },
      {
        math: `x#xx _{1#xs} =#eq \\frac{${num(clean(-b + r), "nb")}}{${den}}#F =#e1 ${num(x1, "v1")} \\quad x#x2 _{2#x2s} =#eq2 \\frac{${num(clean(-b - r), "n2")}}{${dec(2 * a)}#t2}#F2 =#e2 ${num(x2, "v2")}`,
        note: tx(
          `With plus: $\\frac{${dec(clean(-b + r))}}{${dec(2 * a)}} = ${dec(x1)}$. With minus: $\\frac{${dec(clean(-b - r))}}{${dec(2 * a)}} = ${dec(x2)}$.`,
          `Mit Plus: $\\frac{${dec(clean(-b + r))}}{${dec(2 * a)}} = ${dec(x1)}$. Mit Minus: $\\frac{${dec(clean(-b - r))}}{${dec(2 * a)}} = ${dec(x2)}$.`,
        ),
      },
      { math: setKeyed([x1, x2]), note: tx("Two solutions.", "Zwei Lösungen.") },
    );
  } else if (D === 0) {
    const x0 = clean(-b / (2 * a));
    frames.push(
      { math: `x#xx =#eq \\frac{${num(-b, "nb")}}{${den}}#F =#e1 ${num(x0, "v1")}`, note: tx(`$x = ${dec(x0)}$.`, `$x = ${dec(x0)}$.`) },
      { math: setKeyed([x0]), note: tx("One solution.", "Eine Lösung.") },
    );
  } else {
    frames.push({ math: NO_SOLUTION, note: tx("So $L = \\{ \\}$.", "Also $L = \\{ \\}$.") });
  }
  return frames;
}

function abcMistakes(a: number, b: number, c: number, values: number[]): Mistake[] {
  const D = b * b - 4 * a * c;
  const { list, add } = solutionMistakes(values);
  const both = (num: (s: 1 | -1) => number, den: number) => (D < 0 ? null : D === 0 ? [num(1) / den] : [num(1) / den, num(-1) / den]);
  const r = Math.sqrt(Math.max(D, 0));
  if (D >= 0) {
    add(
      both((s) => -b + s * r, 2),
      tx("Only divided by 2", "Nur durch 2 geteilt"),
      tx(
        `Nearly! The denominator is $2a = 2 \\cdot ${par(a)} = ${dec(2 * a)}$, not just $2$.`,
        `Fast! Im Nenner steht $2a = 2 \\cdot ${par(a)} = ${dec(2 * a)}$, nicht nur $2$.`,
      ),
      { close: true },
    );
    add(
      both((s) => b + s * r, 2 * a),
      tx("Sign of −b", "Vorzeichen von −b"),
      tx(
        `The formula starts with $-b$. With $b = ${dec(b)}$ that's $${dec(-b)}$.`,
        `Die Formel beginnt mit $-b$. Mit $b = ${dec(b)}$ ist das $${dec(-b)}$.`,
      ),
      { close: true },
    );
    add(
      D === 0 ? [-b / (2 * a)] : [-b / (2 * a) + r, -b / (2 * a) - r],
      tx("Fraction bar too short", "Bruchstrich zu kurz"),
      tx(
        "The fraction bar goes under the **whole** numerator: $-b \\pm \\sqrt{D}$ is divided by $2a$ together.",
        "Der Bruchstrich steht unter dem **ganzen** Zähler: $-b \\pm \\sqrt{D}$ wird zusammen durch $2a$ geteilt.",
      ),
    );
  }
  const D2 = b * b + 4 * a * c;
  if (c !== 0 && D2 >= 0)
    add(
      D2 === 0 ? [-b / (2 * a)] : [(-b + Math.sqrt(D2)) / (2 * a), (-b - Math.sqrt(D2)) / (2 * a)],
      tx("Sign under the root", "Vorzeichen unter der Wurzel"),
      tx(
        `Under the root it's $b^2 - 4ac$. With $a = ${dec(a)}$ and $c = ${dec(c)}$: $-4 \\cdot ${par(a)} \\cdot ${par(c)} = ${dec(-4 * a * c)}$. Watch the signs.`,
        `Unter der Wurzel steht $b^2 - 4ac$. Mit $a = ${dec(a)}$ und $c = ${dec(c)}$: $-4 \\cdot ${par(a)} \\cdot ${par(c)} = ${dec(-4 * a * c)}$. Achte auf die Vorzeichen.`,
      ),
    );
  if (D < 0)
    add(
      [(-b + Math.sqrt(-D)) / (2 * a), (-b - Math.sqrt(-D)) / (2 * a)],
      tx("Negative under the root", "Negativ unter der Wurzel"),
      tx(`Careful! $D = ${dec(D)}$ is negative. There's no root of a negative number.`, `Vorsicht! $D = ${dec(D)}$ ist negativ. Aus einer negativen Zahl gibt es keine Wurzel.`),
    );
  return list;
}

const ABC = tx("Solve with the abc formula", "Löse mit der abc-Formel");

function abcTask(a: number, b: number, c: number): Exercise {
  const D = b * b - 4 * a * c;
  const values = D < 0 ? [] : D === 0 ? [clean(-b / (2 * a))] : [clean((-b + Math.sqrt(D)) / (2 * a)), clean((-b - Math.sqrt(D)) / (2 * a))];
  return {
    instruction: ABC,
    math: eq0(quadSrc(a, b, c)),
    answer: solutionsAnswer(values),
    hint: tx(
      "$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. Read off $a$, $b$, $c$ with their signs.",
      "$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. Lies $a$, $b$, $c$ mit Vorzeichen ab.",
    ),
    solution: abcFrames(a, b, c),
    mistakes: abcMistakes(a, b, c, values),
  };
}

// ---------------------------------------------------------------------------
// Factorised form and Vieta

/** "2(x - 3)(x + 2)" */
const factoredSrc = (a: number, r1: number, r2: number) =>
  `${lead(a)}${[r1, r2].map((r) => (r === 0 ? "x" : `(${minusR(r)})`)).join(" ")}`.replace(/^(-?)x (\()/, "$1x$2");

function factorisedFrames(a: number, r1: number, r2: number): Frame[] {
  const p = clean(-(r1 + r2));
  const q = clean(r1 * r2);
  const b = a * p;
  const c = a * q;
  const frames: Frame[] = [{ math: `f(x) = ${quadSrc(a, b, c)}`, note: tx("To factorise, find the zeros first.", "Zum Faktorisieren brauchst du zuerst die Nullstellen.") }];
  if (a !== 1)
    frames.push({
      math: `f(x) = ${lead(a)}(${quadSrc(1, p, q)})`,
      note: tx(`Factor out $${dec(a)}$. Inside is the normal form with $p = ${dec(p)}$ and $q = ${dec(q)}$.`, `Klammere $${dec(a)}$ aus. Innen steht die Normalform mit $p = ${dec(p)}$ und $q = ${dec(q)}$.`),
    });
  frames.push(
    {
      math: `x_1 \\cdot x_2 = ${dec(q)} \\quad x_1 + x_2 = ${dec(-p)}`,
      note: tx(
        `Vieta: two numbers with product $q = ${dec(q)}$ and sum $-p = ${dec(-p)}$. That's $${dec(r1)}$ and $${dec(r2)}$.`,
        `Vieta: Zwei Zahlen mit dem Produkt $q = ${dec(q)}$ und der Summe $-p = ${dec(-p)}$. Das sind $${dec(r1)}$ und $${dec(r2)}$.`,
      ),
    },
    {
      math: `f(x) = ${factoredSrc(a, r1, r2)}`,
      note: tx(
        `Factorised form $a(x - x_1)(x - x_2)$: each zero appears with the **opposite** sign in its bracket, and $a = ${dec(a)}$ stays in front.`,
        `Faktorisierte Form $a(x - x_1)(x - x_2)$: Jede Nullstelle steht mit **umgekehrtem** Vorzeichen in ihrer Klammer, und $a = ${dec(a)}$ bleibt vorne.`,
      ),
    },
  );
  return frames;
}

function factorisedTask(rng: Rng): Exercise | null {
  const a = rng.pick([1, 1, 2, 3, -1, -2, 4]);
  const r1 = rng.int(-6, 6);
  const r2 = rng.int(-6, 6);
  if (r1 === r2 || r1 + r2 === 0 || Math.abs(a * r1 * r2) > 60) return null;
  type Opt = { text: string; why?: Text };
  const right: Opt = { text: factoredSrc(a, r1, r2) };
  const cands: Opt[] = [
    {
      text: factoredSrc(a, -r1, -r2),
      why: tx(
        "The zeros are right, but the signs in the brackets aren't: a zero $x_1$ belongs in the bracket $(x - x_1)$. Put a zero in and the bracket must become $0$.",
        "Die Nullstellen stimmen, aber die Vorzeichen in den Klammern nicht: Eine Nullstelle $x_1$ gehört in die Klammer $(x - x_1)$. Setz sie ein, dann muss die Klammer $0$ werden.",
      ),
    },
    ...(a !== 1
      ? [
          {
            text: factoredSrc(1, r1, r2),
            why: tx(
              `Multiply it out: it starts with $x^2$, but $f$ starts with $${lead(a)}x^2$. The factor $${dec(a)}$ has to stay in front.`,
              `Multiplizier es aus: Es beginnt mit $x^2$, aber $f$ beginnt mit $${lead(a)}x^2$. Der Faktor $${dec(a)}$ muss vorne stehen bleiben.`,
            ),
          },
        ]
      : []),
    { text: factoredSrc(a, r1, -r2), why: tx("One bracket has the wrong sign. Check with Vieta: the product of the zeros must be $q$.", "Eine Klammer hat das falsche Vorzeichen. Prüf mit Vieta: Das Produkt der Nullstellen muss $q$ sein.") },
    { text: factoredSrc(a, -r1, r2), why: tx("One bracket has the wrong sign. Check with Vieta: the product of the zeros must be $q$.", "Eine Klammer hat das falsche Vorzeichen. Prüf mit Vieta: Das Produkt der Nullstellen muss $q$ sein.") },
  ];
  const seen = new Set([right.text]);
  const distract: Opt[] = [];
  for (const o of cands) {
    if (seen.has(o.text) || distract.length >= 3) continue;
    seen.add(o.text);
    distract.push(o);
  }
  if (distract.length < 3) return null;
  const all = rng.shuffle([right, ...distract]);
  const options = all.map((o) => `$f(x) = ${o.text}$`);
  const mistakes: Mistake[] = all.flatMap((o, i) => (o.why ? [{ when: { kind: "choice" as const, options, correct: i }, title: tx("Multiply it out to check", "Zur Probe ausmultiplizieren"), say: o.why }] : []));
  return {
    instruction: tx("Which is the factorised form?", "Welche faktorisierte Form ist richtig?"),
    math: `f(x) = \\group{${quadSrc(a, a * -(r1 + r2), a * r1 * r2)}}`,
    answer: { kind: "choice", options, correct: all.indexOf(right) },
    hint: tx("Find the zeros (Vieta or a formula). Then $f(x) = a(x - x_1)(x - x_2)$.", "Bestimme die Nullstellen (Vieta oder eine Formel). Dann gilt $f(x) = a(x - x_1)(x - x_2)$."),
    solution: factorisedFrames(a, r1, r2),
    mistakes,
  };
}

/** One solution is given; find the other one and p (or q) with Vieta. */
function vietaTask(rng: Rng): Exercise | null {
  const x1 = rng.nonZero(-8, 8);
  const x2 = rng.nonZero(-8, 8);
  if (x1 === x2 || x1 + x2 === 0 || Math.abs(x1 * x2) > 48) return null;
  const p = -(x1 + x2);
  const q = x1 * x2;
  const askP = rng.chance(0.5);
  const names: [Text, Text] = ["x_2", askP ? "p" : "q"];
  const values: [number, number] = [x2, askP ? p : q];
  const list: Mistake[] = [];
  const add = (v: [number, number], title: Text, say: Text) => {
    if ((v[0] === values[0] && v[1] === values[1]) || list.some((m) => m.when.kind === "pair" && m.when.values[0] === v[0] && m.when.values[1] === v[1])) return;
    list.push({ when: { kind: "pair", names, values: v }, title, say });
  };
  let math: string;
  let frames: Frame[];
  if (askP) {
    math = eq0(`x^2 + px ${sgn(q)} ${dec(Math.abs(q))}`);
    add(
      [x2, x1 + x2],
      tx("Sign of p", "Vorzeichen von p"),
      tx(`$x_2$ is right! But Vieta says $x_1 + x_2 = -p$, so $p$ is the **negative** sum.`, `$x_2$ stimmt! Aber nach Vieta gilt $x_1 + x_2 = -p$, also ist $p$ die **negative** Summe.`),
    );
    add(
      [-x2, -(x1 - x2)],
      tx("Sign in the division", "Vorzeichen beim Teilen"),
      tx(`Check the product: $${par(x1)} \\cdot x_2$ has to be $${dec(q)}$. Watch the signs when you divide.`, `Prüf das Produkt: $${par(x1)} \\cdot x_2$ muss $${dec(q)}$ ergeben. Achte beim Teilen auf die Vorzeichen.`),
    );
    frames = [
      {
        math: `${math} \\quad x_1 = ${dec(x1)}`,
        note: tx("Vieta: $x_1 \\cdot x_2 = q$ and $x_1 + x_2 = -p$. Start with the product, because $q$ is known.", "Vieta: $x_1 \\cdot x_2 = q$ und $x_1 + x_2 = -p$. Fang mit dem Produkt an, denn $q$ ist bekannt."),
      },
      { math: `${dec(x1)}#a \\cdot#d x#x _{2#i} =#eq ${num(q, "q")}`, note: tx(`Product: $${dec(x1)} \\cdot x_2 = ${dec(q)}$.`, `Produkt: $${dec(x1)} \\cdot x_2 = ${dec(q)}$.`) },
      { math: `x#x _{2#i} =#eq ${num(x2, "q")}`, note: tx(`Divide by $${dec(x1)}$: $x_2 = ${dec(x2)}$.`, `Teile durch $${dec(x1)}$: $x_2 = ${dec(x2)}$.`) },
      {
        math: `-#ps p#p =#eq ${dec(x1)} + ${par(x2)} = ${dec(x1 + x2)}`,
        note: tx(`Sum: $x_1 + x_2 = ${dec(x1 + x2)} = -p$.`, `Summe: $x_1 + x_2 = ${dec(x1 + x2)} = -p$.`),
      },
      { math: `p#p =#eq ${num(p, "pv")}`, note: tx(`So $p = ${dec(p)}$. Check: $${quadSrc(1, p, q)} = ${factoredSrc(1, x1, x2)}$.`, `Also $p = ${dec(p)}$. Probe: $${quadSrc(1, p, q)} = ${factoredSrc(1, x1, x2)}$.`) },
    ];
  } else {
    math = eq0(`x^2 ${sgn(p)} ${Math.abs(p) === 1 ? "" : dec(Math.abs(p))}x + q`);
    add(
      [p - x1, x1 * (p - x1)],
      tx("Sign of p", "Vorzeichen von p"),
      tx("Vieta says $x_1 + x_2 = -p$, with a **minus**. I think you used $+p$.", "Nach Vieta gilt $x_1 + x_2 = -p$, mit **Minus**. Ich glaub, du hast $+p$ genommen."),
    );
    add(
      [x2, -q],
      tx("Sign of q", "Vorzeichen von q"),
      tx(`$x_2$ is right! Now $q = x_1 \\cdot x_2 = ${par(x1)} \\cdot ${par(x2)}$. Check the sign of the product.`, `$x_2$ stimmt! Jetzt ist $q = x_1 \\cdot x_2 = ${par(x1)} \\cdot ${par(x2)}$. Prüf das Vorzeichen des Produkts.`),
    );
    frames = [
      {
        math: `${math} \\quad x_1 = ${dec(x1)}`,
        note: tx("Vieta: $x_1 + x_2 = -p$ and $x_1 \\cdot x_2 = q$. Start with the sum, because $p$ is known.", "Vieta: $x_1 + x_2 = -p$ und $x_1 \\cdot x_2 = q$. Fang mit der Summe an, denn $p$ ist bekannt."),
      },
      { math: `${dec(x1)}#a +#d x#x _{2#i} =#eq ${num(-p, "s")}`, note: tx(`Sum: $${dec(x1)} + x_2 = -p = ${dec(-p)}$.`, `Summe: $${dec(x1)} + x_2 = -p = ${dec(-p)}$.`) },
      { math: `x#x _{2#i} =#eq ${num(x2, "s")}`, note: tx(`So $x_2 = ${dec(-p)} - ${par(x1)} = ${dec(x2)}$.`, `Also $x_2 = ${dec(-p)} - ${par(x1)} = ${dec(x2)}$.`) },
      { math: `q#q =#eq ${dec(x1)} \\cdot ${par(x2)} =#e2 ${num(q, "qv")}`, note: tx(`Product: $q = x_1 \\cdot x_2 = ${dec(q)}$. Check: $${quadSrc(1, p, q)} = ${factoredSrc(1, x1, x2)}$.`, `Produkt: $q = x_1 \\cdot x_2 = ${dec(q)}$. Probe: $${quadSrc(1, p, q)} = ${factoredSrc(1, x1, x2)}$.`) },
    ];
  }
  return {
    instruction: askP ? tx("Use Vieta: find the second solution and p", "Nutze Vieta: Bestimme die zweite Lösung und p") : tx("Use Vieta: find the second solution and q", "Nutze Vieta: Bestimme die zweite Lösung und q"),
    text: tx(`One solution of the equation is $x_1 = ${dec(x1)}$.`, `Eine Lösung der Gleichung ist $x_1 = ${dec(x1)}$.`),
    math,
    answer: { kind: "pair", names, values },
    hint: tx("Vieta: $x_1 + x_2 = -p$ and $x_1 \\cdot x_2 = q$.", "Vieta: $x_1 + x_2 = -p$ und $x_1 \\cdot x_2 = q$."),
    solution: frames,
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Biquadratic equations: x⁴ + Bx² + C = 0 with z = x²

function biquadSrc(B: number, C: number) {
  return eq0(`x^4 ${B ? `${sgn(B)} ${Math.abs(B) === 1 ? "" : dec(Math.abs(B))}x^2` : ""}${C ? ` ${sgn(C)} ${dec(Math.abs(C))}` : ""}`);
}

/** The real x for each z (sorted), and the z values. */
function biquadSolve(B: number, C: number) {
  const D = (B / 2) ** 2 - C;
  const zs = D < 0 ? [] : D === 0 ? [-B / 2] : [-B / 2 + Math.sqrt(D), -B / 2 - Math.sqrt(D)].map(clean);
  const xs = [...new Set(zs.flatMap(rootsOf))].sort((u, v) => u - v);
  return { zs, xs };
}

function biquadFrames(B: number, C: number): Frame[] {
  const { zs, xs } = biquadSolve(B, C);
  const hq = clean((B / 2) ** 2);
  const D = clean(hq - C);
  const r = clean(Math.sqrt(Math.max(D, 0)));
  const xTerm = (v: string, k: string) => `${keyedTerm(B, v, k)}`;
  const frames: Frame[] = [
    {
      math: `x#x ^{4#e4} ${xTerm("x#x2 ^{2#e2}", "B")} ${keyedTerm(C, "", "C")} =#eq 0#z`,
      note: tx(
        "Only $x^4$, $x^2$ and a number: a **biquadratic** equation. Since $x^4 = (x^2)^2$, substitute $z = x^2$.",
        "Nur $x^4$, $x^2$ und eine Zahl: eine **biquadratische** Gleichung. Weil $x^4 = (x^2)^2$ ist, substituierst du $z = x^2$.",
      ),
    },
    {
      math: `z#x ^{2#e4} ${xTerm("z#x2", "B")} ${keyedTerm(C, "", "C")} =#eq 0#z`,
      note: tx(
        `With $z = x^2$ it's a quadratic equation in $z$, with $p = ${dec(B)}$ and $q = ${dec(C)}$.`,
        `Mit $z = x^2$ wird daraus eine quadratische Gleichung in $z$ mit $p = ${dec(B)}$ und $q = ${dec(C)}$.`,
      ),
    },
    {
      math: `z#zz _{1,2#zs} =#eq ${num(clean(-B / 2), "h")} \\pm#pm \\sqrt{${dec(hq)}#hq ${C < 0 ? "+" : "-"}#m2 ${dec(Math.abs(C))}#cq}#R`,
      note: tx(
        `pq formula: $-\\frac{p}{2} = ${dec(clean(-B / 2))}$ and $(\\frac{p}{2})^2 = ${dec(hq)}$.`,
        `pq-Formel: $-\\frac{p}{2} = ${dec(clean(-B / 2))}$ und $(\\frac{p}{2})^2 = ${dec(hq)}$.`,
      ),
    },
  ];
  if (D < 0) {
    frames.push({ math: NO_SOLUTION, note: tx(`$D = ${dec(D)} < 0$: no $z$, so no $x$ either. $L = \\{ \\}$.`, `$D = ${dec(D)} < 0$: kein $z$, also auch kein $x$. $L = \\{ \\}$.`) });
    return frames;
  }
  frames.push(
    { math: `z#zz _{1,2#zs} =#eq ${num(clean(-B / 2), "h")} \\pm#pm ${dec(r)}#R`, note: `$\\sqrt{${dec(D)}} = ${dec(r)}$.` },
    {
      math: zs.length === 2 ? `z#zz _{1#zs} =#eq ${num(zs[0], "z1")} \\quad z#z2 _{2#z2s} =#eq2 ${num(zs[1], "z2")}` : `z#zz =#eq ${num(zs[0], "z1")}`,
      note: zs.length === 2 ? tx(`$z_1 = ${dec(zs[0])}$ and $z_2 = ${dec(zs[1])}$.`, `$z_1 = ${dec(zs[0])}$ und $z_2 = ${dec(zs[1])}$.`) : tx(`$z = ${dec(zs[0])}$.`, `$z = ${dec(zs[0])}$.`),
    },
    {
      math: zs.map((z, i) => `x#xb${i} ^{2#xe${i}} =#q${i} ${num(z, `z${i + 1}`)}`).join(" \\quad "),
      note: tx("Now back to $x$: $x^2 = z$. Don't stop at $z$!", "Jetzt zurück zu $x$: $x^2 = z$. Nicht bei $z$ stehen bleiben!"),
    },
  );
  const per = zs.map((z) => (z > 0 ? `\\pm ${dec(Math.sqrt(z))}` : z === 0 ? "0" : ""));
  const parts: Text[] = zs.map((z, i) =>
    z > 0
      ? `x#xb${i} =#q${i} \\pm#pm${i} ${dec(clean(Math.sqrt(z)))}#z${i + 1}`
      : z === 0
        ? `x#xb${i} =#q${i} 0#z${i + 1}`
        : tx(`x#xb${i} ^{2#xe${i}} =#q${i} \\red{${num(z, `z${i + 1}`)}} \\Rightarrow "none"`, `x#xb${i} ^{2#xe${i}} =#q${i} \\red{${num(z, `z${i + 1}`)}} \\Rightarrow "keine"`),
  );
  const neg = zs.filter((z) => z < 0);
  const pos = zs.filter((z) => z >= 0);
  const negList = neg.map((z) => `$x^2 = ${dec(z)}$`);
  frames.push({
    math: cat(...parts.flatMap((p, i) => (i ? [" \\quad ", p] : [p]))),
    note: cat(
      pos.length
        ? tx(
            `Take the roots: ${pos.map((z) => `$x^2 = ${dec(z)}$ gives $x = ${per[zs.indexOf(z)]}$`).join(" and ")}. `,
            `Wurzel ziehen: ${pos.map((z, i) => `${i ? "aus" : "Aus"} $x^2 = ${dec(z)}$ folgt $x = ${per[zs.indexOf(z)]}$`).join(", und ")}. `,
          )
        : "",
      neg.length === 1
        ? tx(`${negList[0]} has no solution: a square is never negative.`, `${negList[0]} hat keine Lösung: Ein Quadrat ist nie negativ.`)
        : neg.length === 2
          ? tx(`${negList.join(" and ")} have no solution: a square is never negative.`, `${negList.join(" und ")} haben keine Lösung: Ein Quadrat ist nie negativ.`)
          : "",
    ),
  });
  frames.push({ math: setKeyed(xs), note: xs.length ? tx(`${xs.length} solutions in total.`, `Insgesamt ${xs.length} Lösungen.`) : tx("No solution.", "Keine Lösung.") });
  return frames;
}

const BIQUAD_HINT = tx("Substitute $z = x^2$, solve for $z$, then go back: $x^2 = z$.", "Substituiere $z = x^2$, löse nach $z$ und geh dann zurück: $x^2 = z$.");

function biquadTask(B: number, C: number): Exercise {
  const { zs, xs } = biquadSolve(B, C);
  const { list, add } = solutionMistakes(xs);
  add(
    zs,
    tx("Stopped at z", "Bei z stehen geblieben"),
    tx("Nearly! Those are the values of $z$. But $z = x^2$: take the roots to get $x$.", "Fast! Das sind die Werte für $z$. Aber $z = x^2$: Zieh noch die Wurzeln, um $x$ zu bekommen."),
    { close: true },
  );
  add(
    xs.filter((x) => x > 0),
    tx("The negative solutions are missing", "Die negativen Lösungen fehlen"),
    tx("Nearly! $x^2 = z$ has **two** solutions for $z > 0$: plus and minus the root.", "Fast! $x^2 = z$ hat für $z > 0$ **zwei** Lösungen: plus und minus die Wurzel."),
    { part: true, close: true },
  );
  const neg = zs.find((z) => z < 0);
  if (neg !== undefined)
    add(
      [...xs, Math.sqrt(-neg), -Math.sqrt(-neg)],
      tx("Root of a negative number", "Wurzel aus einer negativen Zahl"),
      tx(`Careful! $x^2 = ${dec(neg)}$ has no solution: a square is never negative.`, `Vorsicht! $x^2 = ${dec(neg)}$ hat keine Lösung: Ein Quadrat ist nie negativ.`),
    );
  return {
    instruction: tx("Solve: substitute z = x²", "Löse durch Substitution z = x²"),
    math: biquadSrc(B, C),
    answer: solutionsAnswer(xs),
    hint: BIQUAD_HINT,
    solution: biquadFrames(B, C),
    mistakes: list,
  };
}

/** Four (or three) real solutions: pick them all from a list. */
function biquadMultiTask(rng: Rng): Exercise | null {
  const r1 = rng.int(2, 5);
  const r2 = rng.chance(0.2) ? 0 : rng.int(1, 5);
  if (r1 === r2) return null;
  const z1 = r1 * r1;
  const z2 = r2 * r2;
  const B = -(z1 + z2);
  const C = z1 * z2;
  const { xs } = biquadSolve(B, C);
  // Distractors from real mistakes: z itself ("stopped at z") and ±z ("x² = z ⇒ x = ±z", root forgotten).
  // Shuffled, so the right answers aren't always the middle of a sorted row.
  const pool = rng.shuffle([...new Set([...xs, z1, z2, -z1, -z2].map(clean))]);
  if (pool.length < (r2 === 0 ? 5 : 6)) return null;
  const options = pool.map((v) => `$${dec(v)}$`);
  const idx = (vals: number[]) => vals.map((v) => pool.indexOf(v)).filter((i) => i >= 0).sort((u, v) => u - v);
  const correct = idx(xs);
  const mistakes: Mistake[] = [];
  const add = (vals: number[], title: Text, say: Text) => {
    const c = idx(vals);
    if (c.length !== vals.length || !c.length || (c.length === correct.length && c.every((v, i) => v === correct[i]))) return;
    mistakes.push({ when: { kind: "multi", options, correct: c }, title, say });
  };
  add([z1, z2].filter((z, i, all) => all.indexOf(z) === i), tx("Stopped at z", "Bei z stehen geblieben"), tx("Those are the values of $z = x^2$. Go back to $x$: take the roots.", "Das sind die Werte von $z = x^2$. Geh zurück zu $x$: Zieh die Wurzeln."));
  add(
    xs.filter((x) => x >= 0),
    tx("The negative solutions are missing", "Die negativen Lösungen fehlen"),
    tx("Nearly! $x^2 = z$ has **two** solutions for $z > 0$: plus and minus the root.", "Fast! $x^2 = z$ hat für $z > 0$ **zwei** Lösungen: plus und minus die Wurzel."),
  );
  add(
    [...new Set([z1, -z1, z2, -z2].map(clean))],
    tx("Root forgotten", "Wurzel vergessen"),
    tx(
      `Plus and minus is right! But $x^2 = ${dec(z1)}$ doesn't give $x = \\pm ${dec(z1)}$: take the root, $x = \\pm ${dec(r1)}$.`,
      `Plus und Minus stimmt! Aber $x^2 = ${dec(z1)}$ ergibt nicht $x = \\pm ${dec(z1)}$: Zieh die Wurzel, $x = \\pm ${dec(r1)}$.`,
    ),
  );
  return {
    instruction: tx("Substitute z = x² and select all solutions", "Substituiere z = x² und wähle alle Lösungen aus"),
    math: biquadSrc(B, C),
    answer: { kind: "multi", options, correct },
    hint: BIQUAD_HINT,
    solution: biquadFrames(B, C),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// A parameter t

const PARAM = tx("Find the parameter t", "Bestimme den Parameter t");

/** x² + tx + k² = 0 has exactly one solution: t = ±2k. */
function paramPTask(k: number): Exercise {
  const c = k * k;
  const frames: Frame[] = [
    {
      math: `x^2 + tx + ${c} = 0`,
      note: tx(`Exactly one solution means $D = 0$. Here $p = t$ and $q = ${c}$.`, `Genau eine Lösung heißt $D = 0$. Hier ist $p = t$ und $q = ${c}$.`),
    },
    { math: `D#D =#eq (\\frac{t#t}{2#two})#br ^{2#e} -#m ${c}#q =#eq2 0#z`, note: tx("Set $D = (\\frac{p}{2})^2 - q$ equal to $0$.", "Setz $D = (\\frac{p}{2})^2 - q$ gleich $0$.") },
    { math: `(\\frac{t#t}{2#two})#br ^{2#e} =#eq2 ${c}#q`, note: tx(`Add $${c}$ on both sides.`, `Addiere auf beiden Seiten $${c}$.`) },
    { math: `\\frac{t#t}{2#two} =#eq2 \\pm#pm ${k}#q`, note: tx(`Take the root, plus **and** minus: $\\frac{t}{2} = \\pm ${k}$.`, `Zieh die Wurzel, mit Plus **und** Minus: $\\frac{t}{2} = \\pm ${k}$.`) },
    {
      math: `t#t _{1#i1} =#eq2 ${2 * k}#q \\quad t#t2 _{2#i2} =#eq3 -#q2s ${2 * k}#q2`,
      note: tx(
        `Times $2$: $t = ${2 * k}$ or $t = -${2 * k}$. Check: $x^2 + ${2 * k}x + ${c} = (x + ${k})^2$, the parabola just touches the $x$-axis.`,
        `Mal $2$: $t = ${2 * k}$ oder $t = -${2 * k}$. Probe: $x^2 + ${2 * k}x + ${c} = (x + ${k})^2$, die Parabel berührt die $x$-Achse.`,
      ),
    },
  ];
  const { list, add } = solutionMistakes([2 * k, -2 * k], "t");
  add([2 * k], tx("The negative t is missing", "Das negative t fehlt"), tx("Nearly! $\\frac{t}{2}$ can be plus **or** minus the root. There's a second value.", "Fast! $\\frac{t}{2}$ kann plus **oder** minus die Wurzel sein. Es gibt einen zweiten Wert."), { part: true, close: true });
  add([k, -k], tx("t instead of t/2", "t statt t/2"), tx("Close! $D = (\\frac{t}{2})^2 - q$: you get $\\frac{t}{2}$ first, then you still have to multiply by $2$.", "Knapp! $D = (\\frac{t}{2})^2 - q$: Du erhältst zuerst $\\frac{t}{2}$ und musst dann noch mit $2$ multiplizieren."));
  add([4 * c, -4 * c], tx("Root forgotten", "Wurzel vergessen"), tx(`From $(\\frac{t}{2})^2 = ${c}$ you take the **root**: $\\frac{t}{2} = \\pm ${k}$.`, `Aus $(\\frac{t}{2})^2 = ${c}$ ziehst du die **Wurzel**: $\\frac{t}{2} = \\pm ${k}$.`));
  return {
    instruction: PARAM,
    text: tx("For which $t$ does the equation have **exactly one** solution?", "Für welche $t$ hat die Gleichung **genau eine** Lösung?"),
    math: eq0(`x^2 + tx + ${c}`),
    answer: solutionsAnswer([2 * k, -2 * k], "t"),
    hint: tx("Exactly one solution means $D = 0$. Write $D$ with $t$ and solve.", "Genau eine Lösung heißt $D = 0$. Schreib $D$ mit $t$ auf und löse."),
    solution: frames,
    mistakes: list,
  };
}

/** x² + bx + t = 0: one solution (t = (b/2)²), two (t < …) or none (t > …). */
function paramQTask(b: number, want: 0 | 1 | 2): Exercise {
  const h = clean(b / 2);
  const hq = clean(h * h);
  const eq = eq0(`x^2 ${sgn(b)} ${Math.abs(b) === 1 ? "" : dec(Math.abs(b))}x + t`);
  const rel = want === 1 ? "=" : want === 2 ? ">" : "<";
  const text: Text =
    want === 1
      ? tx("For which $t$ does the equation have **exactly one** solution?", "Für welches $t$ hat die Gleichung **genau eine** Lösung?")
      : want === 2
        ? tx("For which $t$ does the equation have **two** solutions?", "Für welche $t$ hat die Gleichung **zwei** Lösungen?")
        : tx("For which $t$ does the equation have **no** solution?", "Für welche $t$ hat die Gleichung **keine** Lösung?");
  const frames: Frame[] = [
    {
      math: eq,
      note:
        want === 1
          ? tx(`Exactly one solution means $D = 0$. Here $p = ${dec(b)}$ and $q = t$.`, `Genau eine Lösung heißt $D = 0$. Hier ist $p = ${dec(b)}$ und $q = t$.`)
          : want === 2
            ? tx(`Two solutions means $D > 0$. Here $p = ${dec(b)}$ and $q = t$.`, `Zwei Lösungen heißt $D > 0$. Hier ist $p = ${dec(b)}$ und $q = t$.`)
            : tx(`No solution means $D < 0$. Here $p = ${dec(b)}$ and $q = t$.`, `Keine Lösung heißt $D < 0$. Hier ist $p = ${dec(b)}$ und $q = t$.`),
    },
    { math: `D#D =#eq (\\frac{${dec(b)}}{2})#br ^{2#e} -#m t#t ${rel}#rel 0#z`, note: tx("$D = (\\frac{p}{2})^2 - q$.", "$D = (\\frac{p}{2})^2 - q$.") },
    { math: `${dec(hq)}#br -#m t#t ${rel}#rel 0#z`, note: tx(`$(\\frac{${dec(b)}}{2})^2 = ${par(h)}^2 = ${dec(hq)}$.`, `$(\\frac{${dec(b)}}{2})^2 = ${par(h)}^2 = ${dec(hq)}$.`) },
    {
      math: `t#t ${want === 1 ? "=" : want === 2 ? "<" : ">"}#rel ${dec(hq)}#br`,
      note:
        want === 1
          ? tx(`Add $t$: $t = ${dec(hq)}$. Check: $${quadSrc(1, b, hq)} = (${minusR(-h)})^2$.`, `Addiere $t$: $t = ${dec(hq)}$. Probe: $${quadSrc(1, b, hq)} = (${minusR(-h)})^2$.`)
          : tx(
              `Add $t$ on both sides: $${dec(hq)} ${rel} t$, so $t ${want === 2 ? "<" : ">"} ${dec(hq)}$.`,
              `Addiere auf beiden Seiten $t$: $${dec(hq)} ${rel} t$, also $t ${want === 2 ? "<" : ">"} ${dec(hq)}$.`,
            ),
    },
  ];
  let answer: AnswerSpec;
  const mistakes: Mistake[] = [];
  if (want === 1) {
    answer = solutionsAnswer([hq], "t");
    const { list, add } = solutionMistakes([hq], "t");
    add([b * b], tx("p instead of p/2", "p statt p/2"), tx("Close! In $D$ it's $(\\frac{p}{2})^2$, not $p^2$. Halve first, then square.", "Knapp! In $D$ steht $(\\frac{p}{2})^2$, nicht $p^2$. Erst halbieren, dann quadrieren."));
    add([h], tx("Square forgotten", "Quadrat vergessen"), tx("Nearly! It's $(\\frac{p}{2})^2$: square the half.", "Fast! Es heißt $(\\frac{p}{2})^2$: Die Hälfte noch quadrieren."));
    add(
      [-hq],
      tx("Sign of t", "Vorzeichen von t"),
      tx(`Nearly! In $${dec(hq)} - t = 0$ the $t$ has a minus. Bring it to the other side: its sign flips.`, `Fast! In $${dec(hq)} - t = 0$ steht vor $t$ ein Minus. Bring $t$ auf die andere Seite: Dabei dreht sich das Vorzeichen.`),
    );
    mistakes.push(...list);
  } else {
    const op = want === 2 ? "<" : ">";
    answer = { kind: "inequality", variable: "t", op, value: hq };
    mistakes.push({
      when: { kind: "inequality", variable: "t", op, value: b * b },
      title: tx("p instead of p/2", "p statt p/2"),
      say: tx("The direction is right! But in $D$ it's $(\\frac{p}{2})^2$, not $p^2$.", "Die Richtung stimmt! Aber in $D$ steht $(\\frac{p}{2})^2$, nicht $p^2$."),
    });
    mistakes.push({
      when: { kind: "inequality", variable: "t", op: want === 2 ? ">" : "<", value: hq },
      title: tx("Wrong direction", "Falsche Richtung"),
      say:
        want === 2
          ? tx(`The bigger $t$, the smaller $D = ${dec(hq)} - t$. For $D > 0$, $t$ has to stay **below** $${dec(hq)}$.`, `Je größer $t$, desto kleiner wird $D = ${dec(hq)} - t$. Für $D > 0$ muss $t$ **unter** $${dec(hq)}$ bleiben.`)
          : tx(`The bigger $t$, the smaller $D = ${dec(hq)} - t$. For $D < 0$, $t$ has to be **above** $${dec(hq)}$.`, `Je größer $t$, desto kleiner wird $D = ${dec(hq)} - t$. Für $D < 0$ muss $t$ **über** $${dec(hq)}$ liegen.`),
    });
  }
  return {
    instruction: PARAM,
    text,
    math: eq,
    answer,
    hint: tx("Write the discriminant $D = (\\frac{p}{2})^2 - q$ with $t$.", "Schreib die Diskriminante $D = (\\frac{p}{2})^2 - q$ mit $t$ auf."),
    solution: frames,
    mistakes: mistakes.filter((m) => !(m.when.kind === "inequality" && answer.kind === "inequality" && m.when.op === answer.op && m.when.value === answer.value)),
  };
}

// ---------------------------------------------------------------------------
// How many zeros? Read it from the vertex form.

const ZERO_OPTS: Text[] = [tx("two zeros", "zwei Nullstellen"), tx("exactly one zero", "genau eine Nullstelle"), tx("no zeros", "keine Nullstellen")];

function zerosTask(rng: Rng): Exercise | null {
  const a = rng.pick([1, 2, 3, 0.5, -1, -2, -0.5, -3]);
  const d = rng.int(-5, 5);
  const e = rng.pick([-1, -1, 0, 1, 1]) * rng.int(1, 6) || 0;
  const right = e === 0 ? 1 : a * e < 0 ? 0 : 2;
  const order = rng.shuffle([0, 1, 2]);
  const options = order.map((i) => ZERO_OPTS[i]);
  const at = (i: number) => order.indexOf(i);
  const up = a > 0;
  const where: Text = e === 0 ? tx("on the $x$-axis", "auf der $x$-Achse") : e > 0 ? tx("above the $x$-axis", "über der $x$-Achse") : tx("below the $x$-axis", "unter der $x$-Achse");
  const mistakes: Mistake[] = [];
  if (right !== 1) {
    const say: Text =
      right === 2
        ? up
          ? tx("The vertex is **above** the $x$-axis and the parabola opens upward: it never comes down to the axis.", "Der Scheitel liegt **über** der $x$-Achse und die Parabel ist nach oben geöffnet: Sie kommt nie bis zur Achse herunter.")
          : tx("Look at $a$: it's negative, so the parabola opens **downward**. From a vertex below the axis it never reaches the $x$-axis.", "Schau auf $a$: Es ist negativ, also ist die Parabel nach **unten** geöffnet. Von einem Scheitel unter der Achse aus erreicht sie die $x$-Achse nie.")
        : up
          ? tx("The vertex is **below** the $x$-axis and the parabola opens upward: it has to cross the axis on both sides.", "Der Scheitel liegt **unter** der $x$-Achse und die Parabel ist nach oben geöffnet: Sie muss die Achse auf beiden Seiten schneiden.")
          : tx("Look at $a$: it's negative, so the parabola opens **downward**. From a vertex above the axis it crosses the $x$-axis twice.", "Schau auf $a$: Es ist negativ, also ist die Parabel nach **unten** geöffnet. Von einem Scheitel über der Achse aus schneidet sie die $x$-Achse zweimal.");
    mistakes.push({ when: { kind: "choice", options, correct: at(right === 0 ? 2 : 0) }, title: tx("Which way does it open?", "Wohin ist sie geöffnet?"), say });
  } else {
    mistakes.push({
      when: { kind: "choice", options, correct: at(0) },
      title: tx("The vertex is on the axis", "Der Scheitel liegt auf der Achse"),
      say: tx("With $e = 0$ the vertex lies on the $x$-axis: the parabola only touches it once.", "Mit $e = 0$ liegt der Scheitel auf der $x$-Achse: Die Parabel berührt sie nur einmal."),
    });
  }
  return {
    instruction: tx("How many zeros does the parabola have?", "Wie viele Nullstellen hat die Parabel?"),
    math: `f(x) = \\group{${vertexSrc(a, d, e)}}`,
    answer: { kind: "choice", options, correct: at(right) },
    hint: tx("Where is the vertex $S(d \\, | \\, e)$, and which way does the parabola open?", "Wo liegt der Scheitelpunkt $S(d \\, | \\, e)$, und wohin ist die Parabel geöffnet?"),
    solution: [
      { math: `f(x) = ${vertexSrc(a, d, e)}`, note: tx(`Vertex form with $a = ${dec(a)}$, $d = ${dec(d)}$ and $e = ${dec(e)}$.`, `Scheitelpunktform mit $a = ${dec(a)}$, $d = ${dec(d)}$ und $e = ${dec(e)}$.`) },
      {
        math: `S${ptSrc(d, e)}`,
        note: cat(tx("The vertex lies ", "Der Scheitelpunkt liegt "), where, tx(", and the parabola opens ", ", und die Parabel ist nach "), up ? tx("upward.", "oben geöffnet.") : tx("downward.", "unten geöffnet.")),
      },
      {
        math: tx(`"${resolveText(ZERO_OPTS[right], "en")}"`, `"${resolveText(ZERO_OPTS[right], "de")}"`),
        note:
          right === 1
            ? tx("It touches the $x$-axis at the vertex: exactly one zero.", "Sie berührt die $x$-Achse im Scheitelpunkt: genau eine Nullstelle.")
            : right === 0
              ? tx("It has to cross the $x$-axis on both sides of the vertex: two zeros.", "Sie muss die $x$-Achse auf beiden Seiten des Scheitels schneiden: zwei Nullstellen.")
              : tx("It moves away from the $x$-axis on both sides: no zeros.", "Sie entfernt sich auf beiden Seiten von der $x$-Achse: keine Nullstellen."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Practice

function vertexShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.45) {
    const d = rng.nonZero(-6, 6);
    const e = rng.int(-9, 9);
    const c = d * d + e;
    if (Math.abs(c) > 40) return null;
    return vertexTask(1, -2 * d, c);
  }
  if (roll < 0.62) {
    const b = rng.pick([-1, 1]) * (2 * rng.int(0, 4) + 1);
    const c = rng.int(-8, 8);
    return vertexTask(1, b, c);
  }
  const a = rng.pick([2, 3, -1, -2, 4]);
  const d = rng.nonZero(-4, 4);
  const e = rng.int(-8, 8);
  const b = -2 * a * d;
  const c = a * d * d + e;
  if (Math.abs(b) > 24 || Math.abs(c) > 40) return null;
  return vertexTask(a, b, c);
}

function abcShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.8) {
    const k1 = rng.pick([1, 2, 2]);
    const k2 = rng.pick([1, 2]);
    const s = rng.pick([1, 1, 1, -1, 2, 3]);
    const m1 = rng.nonZero(-7, 7);
    const m2 = rng.nonZero(-7, 7);
    const a = s * k1 * k2;
    const b = -s * (k1 * m2 + k2 * m1);
    const c = s * m1 * m2;
    if (Math.abs(a) < 2 || m1 * k2 === m2 * k1 || Math.abs(b) > 16 || Math.abs(c) > 24 || b === 0 || b * b - 4 * a * c > 256) return null;
    return abcTask(a, b, c);
  }
  if (roll < 0.88) {
    // D = 0: s(kx − m)²
    const k = rng.pick([2, 3]);
    const m = rng.nonZero(-5, 5);
    // The solution is m/k: with k = 3 only m = ±3 gives a number that ends (no 1,333…).
    if (k === 3 && m % 3 !== 0) return null;
    return abcTask(k * k, -2 * k * m, m * m);
  }
  const a = rng.pick([2, 3, -2, 4]);
  const b = rng.nonZero(-6, 6);
  const c = rng.nonZero(-9, 9);
  if (b * b - 4 * a * c >= 0) return null;
  return abcTask(a, b, c);
}

function biquadShape(rng: Rng): Exercise | null {
  if (rng.chance(0.85)) {
    const r = rng.int(1, 6);
    const s = rng.int(1, 12);
    const z1 = r * r;
    const z2 = -s;
    const B = -(z1 + z2);
    const C = z1 * z2;
    if (B === 0 || Math.abs(C) > 100) return null;
    return biquadTask(B, C);
  }
  const z1 = -rng.int(1, 5);
  const z2 = -rng.int(1, 6);
  if (z1 === z2) return null;
  return biquadTask(-(z1 + z2), z1 * z2);
}

function paramShape(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.4) return paramPTask(rng.int(1, 8));
  const b = rng.chance(0.75) ? 2 * rng.nonZero(-6, 6) : rng.pick([-1, 1]) * (2 * rng.int(0, 3) + 1);
  return paramQTask(b, roll < 0.65 ? 1 : roll < 0.83 ? 2 : 0);
}

function raw3(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.18) return vertexShape(rng);
  if (roll < 0.36) return abcShape(rng);
  if (roll < 0.46) return factorisedTask(rng);
  if (roll < 0.56) return vietaTask(rng);
  if (roll < 0.66) return biquadShape(rng);
  if (roll < 0.73) return biquadMultiTask(rng);
  if (roll < 0.88) return paramShape(rng);
  return zerosTask(rng);
}

export function generate3(rng: Rng): Exercise {
  for (let i = 0; i < 60; i++) {
    const ex = raw3(rng);
    if (ex) return localize(ex);
  }
  return localize(vertexTask(1, -6, 5));
}

// ---------------------------------------------------------------------------
// Lesson

const abcLessonFrames: Frame[] = [
  {
    math: "x#xx _{1,2#xs} =#eq \\frac{-#nbs b#nb \\pm#pm \\sqrt{b#b2 ^{2#two} -#m4 4#four a#A c#C}#R}{2#t a#A2}#F",
    note: tx(
      "The **abc formula** solves $ax^2 + bx + c = 0$ for any $a \\ne 0$, no dividing first. It's also called the midnight formula: you should know it even if someone wakes you at midnight.",
      "Die **abc-Formel** löst $ax^2 + bx + c = 0$ für jedes $a \\ne 0$, ohne vorher zu teilen. Sie heißt auch Mitternachtsformel: Du sollst sie können, selbst wenn man dich um Mitternacht weckt.",
    ),
  },
  ...abcFrames(2, 3, -2).map((f, i) => (i === 0 ? { ...f, note: tx("Example: $2x^2 + 3x - 2 = 0$. Read off $a = 2$, $b = 3$ and $c = -2$, signs included.", "Beispiel: $2x^2 + 3x - 2 = 0$. Lies $a = 2$, $b = 3$ und $c = -2$ ab, mit Vorzeichen.") } : f)),
  {
    math: "D#D =#eq b#b2 ^{2#two} -#m4 4#four a#A c#C",
    note: tx(
      "As with the pq formula, the **discriminant** $D = b^2 - 4ac$ decides: $D > 0$ two solutions, $D = 0$ one, $D < 0$ none.",
      "Wie bei der pq-Formel entscheidet die **Diskriminante** $D = b^2 - 4ac$: $D > 0$ zwei Lösungen, $D = 0$ eine, $D < 0$ keine.",
    ),
  },
];

const vietaLessonFrames: Frame[] = [
  {
    math: "f(x) =#eq a#a (x#x1 -#s1 x#v1 _{1#i1})#b1 (x#x2 -#s2 x#v2 _{2#i2})#b2",
    note: tx(
      "**Factorised form**: with zeros $x_1$ and $x_2$ every parabola can be written like this. Put in $x = x_1$ and the first bracket is $0$.",
      "**Faktorisierte Form** (Linearfaktorzerlegung): Mit den Nullstellen $x_1$ und $x_2$ lässt sich jede Parabel so schreiben. Setzt du $x = x_1$ ein, wird die erste Klammer $0$.",
    ),
  },
  {
    math: "x#v1 _{1#i1} +#pl x#v2 _{2#i2} =#se -#ms p#p \\quad x#w1 _{1#j1} \\cdot#dt x#w2 _{2#j2} =#pe q#q",
    note: tx(
      "Multiply out $(x - x_1)(x - x_2)$ and compare with $x^2 + px + q$: that's **Vieta's theorem**. The zeros add up to $-p$ and multiply to $q$.",
      "Multiplizierst du $(x - x_1)(x - x_2)$ aus und vergleichst mit $x^2 + px + q$, erhältst du den **Satz von Vieta**: Die Summe der Nullstellen ist $-p$, ihr Produkt ist $q$.",
    ),
  },
  ...factorisedFrames(2, 3, -2).map((f, i) =>
    i === 0 ? { ...f, note: tx("Example: $f(x) = 2x^2 - 2x - 12$. Let's factorise it.", "Beispiel: $f(x) = 2x^2 - 2x - 12$. Wir zerlegen sie in Faktoren.") } : f,
  ),
];

/** f(x) = x² − 6x + 5 = (x − 3)² − 4: vertex, then the zeros straight from the vertex form. */
const vertexLessonFrames: Frame[] = [
  ...vertexFrames(1, -6, 5),
  {
    math: "(x#x -#sb 3#h1)#B ^{2#e} -#qs 4#h2 =#feq 0#zr",
    note: tx(
      "Now the zeros: set $f(x) = 0$. With the vertex form you don't need a formula for that.",
      "Jetzt die Nullstellen: Setz $f(x) = 0$. Mit der Scheitelpunktform brauchst du dafür keine Formel.",
    ),
  },
  { math: "(x#x -#sb 3#h1)#B ^{2#e} =#feq 4#h2", note: tx("Add $4$ on both sides.", "Addiere auf beiden Seiten $4$.") },
  {
    math: "x#x -#sb 3#h1 =#feq \\pm#pm 2#r",
    note: tx("Take the root, with plus **and** minus: the bracket is $2$ or $-2$.", "Zieh die Wurzel, mit Plus **und** Minus: Die Klammer ist $2$ oder $-2$."),
  },
  {
    math: "x#x _{1#i1} =#feq 5#v1 \\quad x#x2 _{2#i2} =#eq2 1#v2",
    note: tx(
      "Add $3$: the zeros are $x_1 = 3 + 2 = 5$ and $x_2 = 3 - 2 = 1$. That fits: $S$ lies **below** the $x$-axis and the parabola opens **upward**, so it crosses twice.",
      "Addiere $3$: Die Nullstellen sind $x_1 = 3 + 2 = 5$ und $x_2 = 3 - 2 = 1$. Das passt: $S$ liegt **unter** der $x$-Achse und die Parabel ist nach **oben** geöffnet, also schneidet sie zweimal.",
    ),
  },
];

const summary: SummaryBlock[] = [
  {
    title: tx("Completing the square", "Quadratische Ergänzung"),
    body: tx(
      "Halve the $x$-coefficient, add and subtract its square, use a binomial formula. With $a \\ne 1$, factor out $a$ first.",
      "Die Zahl vor $x$ halbieren, ihr Quadrat addieren und wieder abziehen, binomische Formel anwenden. Bei $a \\ne 1$ zuerst $a$ ausklammern.",
    ),
    examples: ["x^2 - 6x + 5 = x^2 - 6x + 3^2 - 3^2 + 5", `= (x - 3)^2 - 4 \\Rightarrow S${ptSrc(3, -4)}`],
    tone: "rule",
  },
  {
    title: tx("Vertex form", "Scheitelpunktform"),
    body: tx(
      "$f(x) = a(x - d)^2 + e$ has the vertex $S(d \\, | \\, e)$. $a > 0$ opens upward, $|a| > 1$ is narrower. Zeros: set $f(x) = 0$ and take the root. $a \\cdot e < 0$ gives two zeros, $e = 0$ one, otherwise none.",
      "$f(x) = a(x - d)^2 + e$ hat den Scheitelpunkt $S(d \\, | \\, e)$. $a > 0$: nach oben geöffnet, $|a| > 1$: schmaler. Nullstellen: $f(x) = 0$ setzen und die Wurzel ziehen. $a \\cdot e < 0$ ergibt zwei Nullstellen, $e = 0$ eine, sonst keine.",
    ),
    examples: ["2x^2 - 12x + 10 = 2(x - 3)^2 - 8", "(x - 3)^2 - 4 = 0 \\Rightarrow x - 3 = \\pm 2", "x_1 = 5 \\quad x_2 = 1"],
    tone: "rule",
  },
  {
    title: tx("The abc formula", "Die abc-Formel"),
    body: tx("For $ax^2 + bx + c = 0$. The discriminant $D = b^2 - 4ac$ counts the solutions.", "Für $ax^2 + bx + c = 0$. Die Diskriminante $D = b^2 - 4ac$ zählt die Lösungen."),
    examples: ["x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"],
    tone: "rule",
  },
  {
    title: tx("Factorised form and Vieta", "Faktorisierte Form und Vieta"),
    body: tx("Zeros $x_1$, $x_2$ give the factors. For $x^2 + px + q$: sum $-p$, product $q$.", "Die Nullstellen $x_1$, $x_2$ liefern die Faktoren. Für $x^2 + px + q$: Summe $-p$, Produkt $q$."),
    examples: ["f(x) = a(x - x_1)(x - x_2)", "x_1 + x_2 = -p \\quad x_1 \\cdot x_2 = q"],
    tone: "rule",
  },
  {
    title: tx("Biquadratic: substitute", "Biquadratisch: substituieren"),
    body: tx("$z = x^2$, solve for $z$, then $x = \\pm\\sqrt{z}$. A negative $z$ gives no $x$.", "$z = x^2$, nach $z$ lösen, dann $x = \\pm\\sqrt{z}$. Ein negatives $z$ liefert kein $x$."),
    examples: ["x^4 - 13x^2 + 36 = 0 \\Rightarrow z^2 - 13z + 36 = 0", "z = 4; 9 \\Rightarrow L = \\{ -3; -2; 2; 3 \\}"],
    tone: "tip",
  },
  {
    title: tx("Signs and parameters", "Vorzeichen und Parameter"),
    body: tx(
      "$(x + 3)^2$ means $d = -3$. Exactly one solution means $D = 0$: solve that for the parameter.",
      "$(x + 3)^2$ bedeutet $d = -3$. Genau eine Lösung heißt $D = 0$: Löse das nach dem Parameter auf.",
    ),
    examples: ["x^2 + tx + 4 = 0 \\quad D = (\\frac{t}{2})^2 - 4 = 0 \\Rightarrow t = \\pm 4"],
    tone: "warning",
  },
];

const lesson: LessonStep[] = [
  {
    type: "explain",
    title: tx("Completing the square", "Quadratische Ergänzung"),
    blob: tx("Every parabola has a secret address: its vertex. Let's find it!", "Jede Parabel hat eine geheime Adresse: ihren Scheitelpunkt. Den finden wir jetzt!"),
    body: tx(
      "Any $f(x) = x^2 + bx + c$ can be rewritten in **vertex form** $f(x) = (x - d)^2 + e$. Then you read off the vertex $S(d \\, | \\, e)$ straight away, and you get the zeros by taking a root.",
      "Jedes $f(x) = x^2 + bx + c$ lässt sich in die **Scheitelpunktform** $f(x) = (x - d)^2 + e$ umschreiben. Dann liest du den Scheitelpunkt $S(d \\, | \\, e)$ direkt ab, und die Nullstellen bekommst du durch Wurzelziehen.",
    ),
    frames: vertexLessonFrames,
  },
  {
    type: "widget",
    title: tx("Stretch and shift the parabola", "Parabeln strecken und verschieben"),
    blob: tx("Three sliders, three jobs. Try a negative a!", "Drei Regler, drei Aufgaben. Probier mal ein negatives a!"),
    body: tx(
      "In $f(x) = a(x - d)^2 + e$ every letter has one job. Move the sliders or drag the vertex $S$ and compare with the normal parabola $y = x^2$. Watch the zeros too: if $a$ and $e$ have opposite signs there are two, with $e = 0$ one, otherwise none.",
      "In $f(x) = a(x - d)^2 + e$ hat jeder Buchstabe eine Aufgabe. Beweg die Regler oder zieh den Scheitelpunkt $S$ und vergleich mit der Normalparabel $y = x^2$. Achte auch auf die Nullstellen: Haben $a$ und $e$ verschiedene Vorzeichen, gibt es zwei, bei $e = 0$ eine, sonst keine.",
    ),
    widget: VertexLab,
  },
  {
    type: "explain",
    title: tx("With a number in front of x²", "Mit einer Zahl vor x²"),
    blob: tx("A factor in front? Pull it out first, and don't lose it on the way.", "Ein Faktor davor? Erst ausklammern und unterwegs nicht verlieren."),
    body: tx(
      "Factor $a$ out of the $x$-terms, complete the square inside the bracket, and multiply $a$ back in at the end.",
      "Klammere $a$ aus den $x$-Termen aus, ergänze in der Klammer quadratisch und multipliziere $a$ am Ende wieder hinein.",
    ),
    frames: vertexFrames(2, -12, 10),
  },
  {
    type: "check",
    blob: tx("Your turn: where's the vertex?", "Du bist dran: Wo liegt der Scheitelpunkt?"),
    exercise: vertexTask(2, -8, 3),
  },
  {
    type: "explain",
    title: tx("The abc formula", "Die abc-Formel"),
    blob: tx("No dividing needed: this formula takes any quadratic equation as it is.", "Kein Teilen nötig: Diese Formel nimmt jede quadratische Gleichung, wie sie ist."),
    body: tx(
      "The pq formula needs $x^2$ alone. The abc formula works directly with $ax^2 + bx + c = 0$.",
      "Die pq-Formel braucht $x^2$ allein. Die abc-Formel arbeitet direkt mit $ax^2 + bx + c = 0$.",
    ),
    frames: abcLessonFrames,
  },
  {
    type: "check",
    blob: tx("Careful with the signs of b and c!", "Vorsicht mit den Vorzeichen von b und c!"),
    exercise: abcTask(2, -5, -3),
  },
  {
    type: "explain",
    title: tx("Factorised form and Vieta", "Faktorisierte Form und Vieta"),
    blob: tx("Know the zeros, know the factors. It works both ways.", "Kennst du die Nullstellen, kennst du die Faktoren. Das klappt in beide Richtungen."),
    body: tx(
      "The zeros of a parabola are its building blocks. Vieta's theorem connects them with $p$ and $q$, so you can often guess them.",
      "Die Nullstellen einer Parabel sind ihre Bausteine. Der Satz von Vieta verbindet sie mit $p$ und $q$, so kannst du sie oft erraten.",
    ),
    frames: vietaLessonFrames,
  },
  {
    type: "explain",
    title: tx("Biquadratic equations", "Biquadratische Gleichungen"),
    blob: tx("x to the power of 4? Looks scary, but it's a quadratic equation in disguise.", "x hoch 4? Sieht gruselig aus, ist aber eine verkleidete quadratische Gleichung."),
    body: tx(
      "In $x^4 - 13x^2 + 36 = 0$ only $x^4$ and $x^2$ appear. Substitute $z = x^2$, solve, and go back.",
      "In $x^4 - 13x^2 + 36 = 0$ kommen nur $x^4$ und $x^2$ vor. Substituiere $z = x^2$, löse und kehr zurück.",
    ),
    frames: biquadFrames(-13, 36),
  },
  {
    type: "check",
    blob: tx("Substitute, solve, go back. Watch out for negative z!", "Substituieren, lösen, zurück. Achtung bei negativem z!"),
    exercise: biquadTask(-5, -36),
  },
  {
    type: "widget",
    title: tx("Hunt for the parameter t", "Jagd auf den Parameter t"),
    blob: tx("Slide t and find the exact spots where the parabola only touches the axis.", "Schieb t und finde genau die Stellen, an denen die Parabel die Achse nur berührt."),
    body: tx(
      "A letter like $t$ in the equation is a **parameter**: each value gives a different equation. Slide $t$, watch the discriminant, and find every $t$ with exactly one solution.",
      "Ein Buchstabe wie $t$ in der Gleichung ist ein **Parameter**: Jeder Wert ergibt eine andere Gleichung. Schieb $t$, beobachte die Diskriminante und finde jedes $t$ mit genau einer Lösung.",
    ),
    widget: ParamLab,
  },
  {
    type: "check",
    blob: tx("Now without the slider. What has to be 0?", "Jetzt ohne Regler. Was muss 0 sein?"),
    exercise: paramPTask(3),
  },
];

/** Level 3 (Klasse 10 and Oberstufe): vertex form, abc formula, Vieta, biquadratic equations, parameters. */
export const level3: LevelLesson = localize({ lesson, summary });

