"use client";

import type { ComponentType } from "react";
import { tx, txMap, type Text } from "@/i18n/text";
import { equivalentText } from "@/learn/engine/expr";
import type { Rng } from "@/learn/engine/rng";
import { plainPoly, plainTerms, showTerms } from "@/learn/engine/terms";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { EXPAND, EXPAND_SIMPLIFY, expandFrames, expandMistakes, m, resultPoly, type Factor } from "./level2";
import { ExpandingAreaPic, ExpandingSplitRect, ExpandingTiles } from "./widgets1";

// ---------------------------------------------------------------------------
// Linear terms with animation keys: sign s, coefficient c, variable v, each followed by the term's key.

type T = { c: number; v: string; k: string; s?: string };

const term = (c: number, v: string, k: string): T => ({ c, v, k });

/** "3x + 2 - 5x" with keys, so terms glide when they are sorted and combined. */
function tsrc(list: T[], continued = false): string {
  if (!list.length) return "0#zero";
  return list
    .map((t, i) => {
      const sk = t.s ?? `s${t.k}`;
      const abs = Math.abs(t.c);
      const sign = t.c < 0 ? `-#${sk} ` : i === 0 && !continued ? "" : `+#${sk} `;
      const coef = t.v && abs === 1 ? "" : `${abs}#c${t.k}`;
      const vr = t.v ? `${t.v}#v${t.k}` : "";
      return `${sign}${[coef, vr].filter(Boolean).join(" ")}`;
    })
    .join(" ");
}

/** Without keys, zero terms dropped: "3x + 2". */
const show = (list: { c: number; v: string }[]) => showTerms(list.map(({ c, v }) => ({ c, v })));
const plain = (list: { c: number; v: string }[]) => plainTerms(list.map(({ c, v }) => ({ c, v })));

/** Variables first (alphabetically), plain numbers last; stable, so each term keeps its place among its kind. */
const byKind = (a: { v: string }, b: { v: string }) => Number(a.v === "") - Number(b.v === "") || a.v.localeCompare(b.v);
const sortLike = (list: T[]) => [...list].sort(byKind);

function collect(list: T[]): T[] {
  const out: T[] = [];
  for (const t of sortLike(list)) {
    const prev = out.find((x) => x.v === t.v);
    if (prev) prev.c += t.c;
    else out.push({ ...t });
  }
  return out.filter((t) => t.c !== 0);
}

/** "Combine: $3x + 5x = 8x$ and $2 - 7 = -5$." */
function combineNote(list: T[]): Text {
  const kinds = [...new Set(sortLike(list).map((t) => t.v))];
  const parts = kinds
    .map((v) => list.filter((t) => t.v === v))
    .filter((g) => g.length > 1)
    .map((g) => `$${show(g)} = ${show([{ c: g.reduce((s, t) => s + t.c, 0), v: g[0].v }])}$`);
  const result = show(collect(list));
  return txMap((t) =>
    parts.length
      ? `${t("Combine", "Zusammenfassen")}: ${parts.join(t(" and ", " und "))}. ${t("Result", "Ergebnis")}: $${result}$.`
      : `${t("Nothing left to combine", "Nichts mehr zusammenzufassen")}: $${result}$.`,
  );
}

/** Like terms highlighted, sorted next to each other (if needed), then combined. */
function collectFrames(list: T[], intro?: Text): Frame[] {
  const sorted = sortLike(list);
  const firstKind = sorted[0]?.v ?? "";
  const lit = list.filter((t) => t.v === firstKind).flatMap((t) => [`c${t.k}`, `v${t.k}`, t.s ?? `s${t.k}`]);
  const frames: Frame[] = [
    {
      math: tsrc(list),
      note:
        intro ??
        tx(
          "Look for like terms: terms with exactly the same variable part. Plain numbers are like terms too.",
          "Such die gleichartigen Terme: Terme mit genau demselben Variablenteil. Zahlen ohne Variable sind untereinander auch gleichartig.",
        ),
      highlight: lit,
    },
  ];
  if (sorted.some((t, i) => t !== list[i])) {
    frames.push({
      math: tsrc(sorted),
      note: tx("Put like terms next to each other. Each term takes the sign in front of it along.", "Stell gleichartige Terme nebeneinander. Jeder Term nimmt das Vorzeichen vor sich mit."),
      highlight: lit,
    });
  }
  frames.push({ math: tsrc(collect(list)), note: combineNote(list) });
  return frames;
}

// A sum of brackets with a positive factor and plain terms: 3(2x + 1) + 2(x - 4), 4(x + 3) - 5.

type Part = { kind: "t"; t: T } | { kind: "b"; f: number; id: string; terms: T[] };

function partsSrc(parts: Part[], keys = true): string {
  if (!keys) {
    return parts
      .map((p, i) => {
        if (p.kind === "t") return i === 0 ? show([p.t]) : `${p.t.c < 0 ? "-" : "+"} ${show([{ c: Math.abs(p.t.c), v: p.t.v }])}`;
        return `${i === 0 ? "" : "+ "}${p.f}(${show(p.terms)})`;
      })
      .join(" ");
  }
  return parts
    .map((p, i) => {
      if (p.kind === "t") return tsrc([p.t], i > 0);
      return `${i === 0 ? "" : `+#s${p.id} `}${p.f}#f${p.id} (${tsrc(p.terms)})#b${p.id}`;
    })
    .join(" ");
}

function expandParts(parts: Part[], mode: "right" | "firstOnly" | "toAll" = "right"): T[] {
  let factor = 1;
  return parts.flatMap((p, i) => {
    if (p.kind === "t") return [{ ...p.t, c: p.t.c * (mode === "toAll" ? factor : 1) }];
    factor = p.f;
    return p.terms.map((t, j) => ({ ...t, c: mode === "firstOnly" && j > 0 ? t.c : t.c * p.f, s: j === 0 && i > 0 ? `s${p.id}` : t.s }));
  });
}

const signed = (t: { c: number; v: string }) => (t.c < 0 ? `(${show([t])})` : show([t]));

function expandPartsFrames(parts: Part[]): Frame[] {
  const brackets = parts.filter((p): p is Extract<Part, { kind: "b" }> => p.kind === "b");
  const arrows = brackets.flatMap((p) => p.terms.map((t) => [`f${p.id}`, t.v && Math.abs(t.c) === 1 ? `v${t.k}` : `c${t.k}`] as [string, string]));
  const products = brackets.flatMap((p) => p.terms.map((t) => `$${p.f} \\cdot ${signed(t)} = ${show([{ c: p.f * t.c, v: t.v }])}$`));
  const expanded = expandParts(parts);
  const rest = collectFrames(expanded);
  return [
    {
      math: partsSrc(parts),
      note:
        brackets.length > 1
          ? tx("Two brackets, each with a factor in front. First expand, then combine.", "Zwei Klammern mit je einem Faktor davor. Erst ausmultiplizieren, dann zusammenfassen.")
          : tx("First get rid of the bracket, then combine.", "Erst die Klammer auflösen, dann zusammenfassen."),
    },
    { math: partsSrc(parts), arrows, note: tx("Each factor multiplies **every** term in its bracket.", "Jeder Faktor wird mit **jedem** Term in seiner Klammer multipliziert.") },
    {
      math: tsrc(expanded),
      note: txMap((t) => `${products.join(", ")}. ${brackets.length > 1 ? t("The brackets are gone.", "Die Klammern sind weg.") : t("The bracket is gone.", "Die Klammer ist weg.")}`),
      highlight: rest[0].highlight,
    },
    ...rest.slice(1),
  ];
}

// ---------------------------------------------------------------------------
// Typical mistakes

function mistakeList(right: string) {
  const out: Mistake[] = [];
  const add = (value: string, title: Text, say: Text, close?: boolean) => {
    if (!value || equivalentText(value, right) || out.some((x) => x.when.kind === "expr" && equivalentText(x.when.value, value))) return;
    out.push({ when: { kind: "expr", value }, title, say, ...(close ? { close } : {}) });
  };
  return { out, add };
}

function numberMistakes(right: number) {
  const out: Mistake[] = [];
  const add = (value: number, title: Text, say: Text) => {
    if (value === right || out.some((x) => x.when.kind === "number" && x.when.value === value)) return;
    out.push({ when: { kind: "number", value }, title, say });
  };
  return { out, add };
}

/** Collecting slips: signs ignored, everything thrown together, a lone x forgotten. */
function collectMistakes(list: T[], add: ReturnType<typeof mistakeList>["add"]) {
  if (list.some((t) => t.c < 0)) {
    add(
      plain(collect(list.map((t) => ({ ...t, c: Math.abs(t.c) })))),
      tx("The minus signs got lost", "Die Minuszeichen sind verloren gegangen"),
      tx("You added everything, but some terms have a **minus** in front. The sign belongs to the term after it: subtract those.", "Du hast alles addiert, aber vor manchen Termen steht ein **Minus**. Das Vorzeichen gehört zum Term dahinter: Den musst du abziehen."),
    );
  }
  const vars = [...new Set(list.map((t) => t.v).filter(Boolean))];
  if (vars.length === 1) {
    const total = list.reduce((s, t) => s + t.c, 0);
    add(
      plain([{ c: total, v: vars[0] }]),
      tx("Unlike terms combined", "Ungleichartige Terme zusammengefasst"),
      tx(
        `$${vars[0]}$-terms and plain numbers are different kinds, like apples and oranges. You can only combine terms of the **same** kind.`,
        `$${vars[0]}$-Terme und Zahlen ohne Variable sind verschiedene Sorten, wie Äpfel und Birnen. Zusammenfassen darfst du nur Terme der **gleichen** Sorte.`,
      ),
    );
  }
  const lone = list.find((t) => t.v && Math.abs(t.c) === 1);
  if (lone) {
    // "-x" means "-1x", "x" means "1x".
    const sg = lone.c < 0 ? "-" : "";
    add(
      plain(collect(list.filter((t) => t !== lone))),
      tx(`A lone ${lone.v} counts too`, `Ein einzelnes ${lone.v} zählt mit`),
      tx(
        `I think the $${sg}${lone.v}$ slipped through. A lone $${sg}${lone.v}$ means $${sg}1${lone.v}$, so it changes the result.`,
        `Ich glaub, das $${sg}${lone.v}$ ist dir durchgerutscht. Ein einzelnes $${sg}${lone.v}$ heißt $${sg}1${lone.v}$, es verändert also das Ergebnis.`,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Task builders (shared by the lesson checks and the practice)

const CLEVER = tx("Calculate cleverly", "Rechne geschickt");
const COLLECT = tx("Collect like terms", "Fasse gleichartige Terme zusammen");
const AREA = tx("Write the area as a term", "Gib den Flächeninhalt als Term an");
const EQUAL = tx("Which term is equivalent?", "Welcher Term ist gleichwertig?");

const pic = (props: Record<string, unknown>) => ({ component: ExpandingAreaPic as ComponentType<Record<string, unknown>>, props });

/** n · (base ± d), e.g. 7 · 103 = 7 · 100 + 7 · 3. */
function cleverTask(n: number, base: number, d: number, sg: 1 | -1): Exercise {
  const N = base + sg * d;
  const right = n * N;
  const s = sg > 0 ? "+" : "-";
  const { out, add } = numberMistakes(right);
  add(n * base + sg * d, tx("Only the first part multiplied", "Nur den ersten Teil multipliziert"), tx(`The $${n}$ has to multiply **both** parts: $${n} \\cdot ${base}$ **and** $${n} \\cdot ${d}$.`, `Die $${n}$ muss **beide** Teile multiplizieren: $${n} \\cdot ${base}$ **und** $${n} \\cdot ${d}$.`));
  if (sg < 0) add(n * base + n * d, tx("Plus instead of minus", "Plus statt Minus"), tx(`$${N} = ${base} - ${d}$, so $${n} \\cdot ${d}$ has to be **subtracted**, not added.`, `$${N} = ${base} - ${d}$, also musst du $${n} \\cdot ${d}$ **abziehen**, nicht addieren.`));
  add(n * base, tx(`The ${d} got lost`, `Die ${d} ging verloren`), tx(`$${n} \\cdot ${base}$ is the right start, but $${N}$ is not $${base}$. Don't forget $${n} \\cdot ${d}$.`, `$${n} \\cdot ${base}$ ist der richtige Anfang, aber $${N}$ ist nicht $${base}$. Vergiss $${n} \\cdot ${d}$ nicht.`));
  return {
    instruction: CLEVER,
    math: `${n} \\cdot ${N}`,
    answer: { kind: "number", value: right },
    hint: tx(`Write $${N}$ as $${base} ${s} ${d}$ and multiply both parts.`, `Schreib $${N}$ als $${base} ${s} ${d}$ und multipliziere beide Teile.`),
    solution: [
      { math: `${n}#n \\cdot#d ${N}#h`, note: tx(`$${N}$ is awkward. But it's close to $${base}$: $${N} = ${base} ${s} ${d}$.`, `Mit $${N}$ rechnet es sich schlecht. Aber es liegt nah an $${base}$: $${N} = ${base} ${s} ${d}$.`) },
      { math: `${n}#n \\cdot#d (${base}#h ${s}#p ${d}#u)#b`, note: tx(`The $${n}$ multiplies **both** parts.`, `Die $${n}$ wird mit **beiden** Teilen multipliziert.`), arrows: [["n", "h"], ["n", "u"]] },
      { math: `${n}#n \\cdot#d ${base}#h ${s}#p ${n}#n2 \\cdot#d2 ${d}#u`, note: tx("That's the distributive law.", "Das ist das Distributivgesetz.") },
      { math: `${n * base}#h ${s}#p ${n * d}#u`, note: tx("Both products are easy in your head.", "Beide Produkte gehen leicht im Kopf.") },
      { math: `${right}#h`, note: tx(`So $${n} \\cdot ${N} = ${right}$.`, `Also ist $${n} \\cdot ${N} = ${right}$.`) },
    ],
    mistakes: out,
  };
}

/** n · a ± n · b, with a ± b a round number: the distributive law backwards. */
function cleverBackTask(n: number, a: number, b: number, sg: 1 | -1): Exercise {
  const R = a + sg * b;
  const right = n * R;
  const s = sg > 0 ? "+" : "-";
  const { out, add } = numberMistakes(right);
  add(2 * n * R, tx("The factor counts once", "Der Faktor zählt nur einmal"), tx(`Both products share the factor $${n}$, but in front of the bracket it stands only **once**: $${n} \\cdot (${a} ${s} ${b})$.`, `Beide Produkte haben den Faktor $${n}$, aber vor der Klammer steht er nur **einmal**: $${n} \\cdot (${a} ${s} ${b})$.`));
  add(R, tx("The factor is missing", "Der Faktor fehlt"), tx(`$${a} ${s} ${b} = ${R}$ is right. Now multiply by the $${n}$ too.`, `$${a} ${s} ${b} = ${R}$ stimmt. Jetzt noch mal $${n}$ nehmen.`));
  return {
    instruction: CLEVER,
    math: `${n} \\cdot ${a} ${s} ${n} \\cdot ${b}`,
    answer: { kind: "number", value: right },
    hint: tx(`Both products contain the factor $${n}$. Put it in front of a bracket.`, `Beide Produkte enthalten den Faktor $${n}$. Setz ihn vor eine Klammer.`),
    solution: [
      { math: `${n}#n \\cdot#d ${a}#a ${s}#p ${n}#n2 \\cdot#d2 ${b}#b`, note: tx(`Both products contain the factor $${n}$.`, `Beide Produkte enthalten den Faktor $${n}$.`), highlight: ["n", "n2"] },
      { math: `${n}#n \\cdot#d (${a}#a ${s}#p ${b}#b)#br`, note: tx(`The distributive law backwards: write the $${n}$ only once, in front of a bracket.`, `Das Distributivgesetz rückwärts: Schreib die $${n}$ nur einmal, vor eine Klammer.`) },
      { math: `${n}#n \\cdot#d ${R}#a`, note: tx(`In the bracket: $${a} ${s} ${b} = ${R}$. Nice and round!`, `In der Klammer: $${a} ${s} ${b} = ${R}$. Schön rund!`) },
      { math: `${right}#a`, note: tx(`So the result is $${right}$.`, `Das Ergebnis ist also $${right}$.`) },
    ],
    mistakes: out,
  };
}

/** k(px ± q) with a positive factor. */
function expandTask(k: number, inner: Factor, v: string, hint?: Text): Exercise {
  const a: Factor = [m(k)];
  const right = plainPoly(resultPoly(a, inner), v);
  const { out, add } = mistakeList(right);
  for (const x of expandMistakes(a, inner, v, right, false)) if (x.when.kind === "expr") add(x.when.value, x.title ?? "", x.say);
  const num = inner.find((x) => x.p === 0);
  const varT = inner.find((x) => x.p === 1);
  if (num && varT && num.c > 0) {
    add(
      plainPoly([num.c + k, k * varT.c], v),
      tx("Added instead of multiplied", "Addiert statt multipliziert"),
      tx(`Ah, you **added** the $${k}$ to the $${num.c}$. But a number in front of a bracket means **times**: $${k} \\cdot ${num.c}$.`, `Ah, du hast die $${k}$ zur $${num.c}$ **addiert**. Eine Zahl vor der Klammer heißt aber **mal**: $${k} \\cdot ${num.c}$.`),
    );
  }
  if (varT) {
    add(
      plainPoly([k * (num?.c ?? 0), varT.c], v),
      tx("The variable term was skipped", "Der Variablenterm wurde übersprungen"),
      tx(`The $${k}$ multiplies the $${v}$-term too: $${k} \\cdot ${varT.c === 1 ? v : `${varT.c}${v}`} = ${k * varT.c}${v}$.`, `Die $${k}$ wird auch mit dem $${v}$-Term multipliziert: $${k} \\cdot ${varT.c === 1 ? v : `${varT.c}${v}`} = ${k * varT.c}${v}$.`),
    );
  }
  return {
    instruction: EXPAND,
    math: `${k}(${show(inner.map((x) => ({ c: x.c, v: x.p ? v : "" })))})`,
    answer: { kind: "expr", value: right, form: "simplified" },
    hint: hint ?? tx(`Multiply $${k}$ by each term in the bracket.`, `Multipliziere $${k}$ mit jedem Term in der Klammer.`),
    solution: expandFrames(a, inner, v),
    mistakes: out,
  };
}

function collectTask(list: T[], hint?: Text): Exercise {
  const right = plain(collect(list));
  const { out, add } = mistakeList(right);
  collectMistakes(list, add);
  return {
    instruction: COLLECT,
    math: tsrcPlain(list),
    answer: { kind: "expr", value: right, form: "simplified" },
    hint: hint ?? tx("Collect the terms with the same variable, and the plain numbers. Each term keeps its sign.", "Fasse die Terme mit derselben Variablen zusammen und die Zahlen ohne Variable. Jeder Term behält sein Vorzeichen."),
    solution: collectFrames(list),
    mistakes: out,
  };
}

/** The term exactly as listed (no terms dropped or merged): "3x + 2 + 5x - 7". */
function tsrcPlain(list: T[]): string {
  return list
    .map((t, i) => {
      const abs = Math.abs(t.c);
      const body = t.v ? `${abs === 1 ? "" : abs}${t.v}` : String(abs);
      return t.c < 0 ? (i === 0 ? `-${body}` : `- ${body}`) : i === 0 ? body : `+ ${body}`;
    })
    .join(" ");
}

function expandCollectTask(parts: Part[], hint?: Text): Exercise {
  const right = plain(collect(expandParts(parts)));
  const { out, add } = mistakeList(right);
  add(
    plain(collect(expandParts(parts, "firstOnly"))),
    tx("Only the first term multiplied", "Nur den ersten Term multipliziert"),
    tx("The factor in front has to multiply **every** term in its bracket, not just the first one.", "Der Faktor davor muss **jeden** Term in seiner Klammer multiplizieren, nicht nur den ersten."),
  );
  if (parts[0].kind === "b" && parts.slice(1).some((p) => p.kind === "t")) {
    add(
      plain(collect(expandParts(parts, "toAll"))),
      tx("The factor only belongs to its bracket", "Der Faktor gehört nur zu seiner Klammer"),
      tx(`The $${parts[0].f}$ only multiplies what's **inside** its bracket. The terms after the bracket stay as they are.`, `Die $${parts[0].f}$ multipliziert nur, was **in** ihrer Klammer steht. Die Terme hinter der Klammer bleiben, wie sie sind.`),
    );
  }
  const all = expandParts(parts);
  if (all.some((t) => t.c < 0)) {
    add(
      plain(collect(all.map((t) => ({ ...t, c: Math.abs(t.c) })))),
      tx("The minus signs got lost", "Die Minuszeichen sind verloren gegangen"),
      tx("After expanding, some terms have a **minus**. Keep it when you combine.", "Nach dem Ausmultiplizieren haben manche Terme ein **Minus**. Das bleibt beim Zusammenfassen dran."),
    );
  }
  return {
    instruction: EXPAND_SIMPLIFY,
    math: partsSrc(parts, false),
    answer: { kind: "expr", value: right, form: "simplified" },
    hint: hint ?? tx("First expand the brackets, then combine like terms.", "Erst die Klammern ausmultiplizieren, dann gleichartige Terme zusammenfassen."),
    solution: expandPartsFrames(parts),
    mistakes: out,
  };
}

/** A rectangle with height h and widths p·v and b (or height v and widths a and b). */
function areaTask(rng: Rng): Exercise {
  const v = rng.pick(["x", "x", "a", "y"]);
  if (rng.chance(0.3)) {
    const a = rng.int(2, 6);
    const b = rng.int(2, 6);
    const right = plain([{ c: a + b, v }]);
    const { out, add } = mistakeList(right);
    add(plain([{ c: 2, v }, { c: 2 * (a + b), v: "" }]), tx("That's the perimeter", "Das ist der Umfang"), tx("You added up the sides: that gives the **perimeter**. The area is width **times** height.", "Du hast die Seiten addiert: Das ergibt den **Umfang**. Der Flächeninhalt ist Breite **mal** Höhe."));
    add(plain([{ c: a, v }, { c: b, v: "" }]), tx("Only one part multiplied", "Nur einen Teil multipliziert"), tx(`Both parts have the height $${v}$: their areas are $${a}${v}$ **and** $${b}${v}$.`, `Beide Teile haben die Höhe $${v}$: Ihre Flächen sind $${a}${v}$ **und** $${b}${v}$.`));
    add(plain([{ c: 1, v }, { c: a + b, v: "" }]), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("Area means multiplying: height **times** width.", "Flächeninhalt heißt multiplizieren: Höhe **mal** Breite."));
    return {
      instruction: AREA,
      text: tx("The rectangle is split into two parts. Write the area of the **whole** rectangle as a term without brackets, as short as possible.", "Das Rechteck ist in zwei Teile zerlegt. Gib den Flächeninhalt des **ganzen** Rechtecks als Term ohne Klammern an, so kurz wie möglich."),
      visual: pic({ h: v, w: [String(a), String(b)] }),
      answer: { kind: "expr", value: right, form: "simplified" },
      hint: tx("Area = height · width. Here the height is a variable.", "Flächeninhalt = Höhe · Breite. Hier ist die Höhe eine Variable."),
      solution: [
        { math: `A = ${v}#h \\cdot#d (${a}#a +#p ${b}#b)#br`, note: tx(`Area = height · width = $${v} \\cdot (${a} + ${b})$.`, `Flächeninhalt = Höhe · Breite = $${v} \\cdot (${a} + ${b})$.`) },
        { math: `A = ${a}#a ${v}#h +#p ${b}#b ${v}#h2`, note: tx(`The two parts: $${a}${v}$ and $${b}${v}$.`, `Die beiden Teile: $${a}${v}$ und $${b}${v}$.`) },
        { math: `A = ${a + b}#a ${v}#h`, note: tx(`Like terms, so combine them: $${a}${v} + ${b}${v} = ${a + b}${v}$.`, `Gleichartige Terme, also zusammenfassen: $${a}${v} + ${b}${v} = ${a + b}${v}$.`) },
      ],
      mistakes: out,
    };
  }
  const h = rng.int(2, 9);
  const p = rng.pick([1, 1, 2, 3]);
  const b = rng.int(1, 9);
  const right = plain([{ c: h * p, v }, { c: h * b, v: "" }]);
  const { out, add } = mistakeList(right);
  add(plain([{ c: 2 * p, v }, { c: 2 * (h + b), v: "" }]), tx("That's the perimeter", "Das ist der Umfang"), tx("You added up the sides: that gives the **perimeter**. The area is width **times** height.", "Du hast die Seiten addiert: Das ergibt den **Umfang**. Der Flächeninhalt ist Breite **mal** Höhe."));
  add(plain([{ c: h * p, v }, { c: b, v: "" }]), tx("Only one part multiplied", "Nur einen Teil multipliziert"), tx(`The right part is a rectangle too: $${h} \\cdot ${b}$.`, `Der rechte Teil ist auch ein Rechteck: $${h} \\cdot ${b}$.`));
  add(plain([{ c: p, v }, { c: h + b, v: "" }]), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx("Area means multiplying: height **times** width.", "Flächeninhalt heißt multiplizieren: Höhe **mal** Breite."));
  const pv = p === 1 ? v : `${p}${v}`;
  return {
    instruction: AREA,
    text: tx("The rectangle is split into two parts. Write the area of the **whole** rectangle as a term without brackets.", "Das Rechteck ist in zwei Teile zerlegt. Gib den Flächeninhalt des **ganzen** Rechtecks als Term ohne Klammern an."),
    visual: pic({ h: String(h), w: [pv, String(b)] }),
    answer: { kind: "expr", value: right, form: "simplified" },
    hint: tx("Area = height · width. Find the area of each part, then add.", "Flächeninhalt = Höhe · Breite. Berechne jeden Teil und addiere dann."),
    solution: [
      { math: `A = ${h} \\cdot (${pv} + ${b})`, note: tx(`The whole rectangle: height $${h}$, width $${pv} + ${b}$.`, `Das ganze Rechteck: Höhe $${h}$, Breite $${pv} + ${b}$.`) },
      ...expandFrames([m(h)], [m(p, 1), m(b)], v),
    ],
    mistakes: out,
  };
}

/** Multiple choice: which term equals k(px ± q), or a term to collect? */
function equalTask(rng: Rng): Exercise {
  const v = rng.pick(["x", "a", "y", "b"]);
  type Opt = { value: string; title?: Text; say?: Text };
  let math: string;
  let right = "";
  let solution: Frame[];
  const wrong: Opt[] = [];
  const push = (value: string, title?: Text, say?: Text) => {
    if (!equivalentText(value, right) && !wrong.some((w) => equivalentText(w.value, value))) wrong.push({ value, title, say });
  };
  if (rng.chance(0.5)) {
    const k = rng.int(2, 9);
    const p = rng.int(1, 5);
    const q = rng.int(1, 9) * rng.sign();
    math = `${k}(${show([{ c: p, v }, { c: q, v: "" }])})`;
    right = plain([{ c: k * p, v }, { c: k * q, v: "" }]);
    solution = expandFrames([m(k)], [m(p, 1), m(q)], v);
    push(plain([{ c: k * p, v }, { c: q, v: "" }]), tx("Only the first term multiplied", "Nur den ersten Term multipliziert"), tx(`The $${k}$ has to multiply the $${Math.abs(q)}$ too.`, `Die $${k}$ muss auch die $${Math.abs(q)}$ multiplizieren.`));
    push(plain([{ c: p, v }, { c: k * q, v: "" }]), tx("Only the number multiplied", "Nur die Zahl multipliziert"), tx(`The $${k}$ has to multiply the $${v}$-term too.`, `Die $${k}$ muss auch den $${v}$-Term multiplizieren.`));
    push(plain([{ c: k * p, v }, { c: -k * q, v: "" }]), tx("Sign flipped", "Vorzeichen gedreht"), tx(`The factor $${k}$ is positive, so every sign in the bracket stays as it is.`, `Der Faktor $${k}$ ist positiv, also bleibt jedes Vorzeichen in der Klammer, wie es ist.`));
    if (q > 0) push(plain([{ c: k * p, v }, { c: k + q, v: "" }]), tx("Added instead of multiplied", "Addiert statt multipliziert"), tx(`A number in front of a bracket means **times**: $${k} \\cdot ${q}$, not $${k} + ${q}$.`, `Eine Zahl vor der Klammer heißt **mal**: $${k} \\cdot ${q}$, nicht $${k} + ${q}$.`));
  } else {
    const list = randomCollect(rng, v, false);
    math = tsrcPlain(list);
    right = plain(collect(list));
    solution = collectFrames(list);
    const { out, add } = mistakeList(right);
    collectMistakes(list, add);
    for (const x of out) if (x.when.kind === "expr") push(x.when.value, x.title, x.say);
    const c = collect(list);
    push(plain(c.map((t) => (t.v ? t : { ...t, c: -t.c }))), tx("Sign of the number", "Vorzeichen der Zahl"), tx("Check the plain numbers again: add the ones with plus, subtract the ones with minus.", "Prüf die Zahlen ohne Variable noch mal: Die mit Plus addieren, die mit Minus abziehen."));
  }
  // Always four options: fill up with near misses if a misconception didn't give a new term.
  for (let d = 1; wrong.length < 3 && d < 6; d++) {
    const p = parseLinear(right, v);
    push(plain([{ c: p[1] + d, v }, { c: p[0], v: "" }]));
    if (wrong.length < 3) push(plain([{ c: p[1], v }, { c: p[0] + d, v: "" }]));
  }
  const picked = wrong.slice(0, 3);
  const options = rng.shuffle([{ value: right } as Opt, ...picked]);
  const correct = options.findIndex((o) => o.value === right);
  const display = (value: string) => `$${showLinear(value, v)}$`;
  return {
    instruction: EQUAL,
    math,
    answer: { kind: "choice", options: options.map((o) => display(o.value)), correct },
    hint: tx("Work it out yourself first, then look for your result.", "Rechne es erst selbst aus und such dann dein Ergebnis."),
    solution,
    mistakes: options.flatMap((o, i) => (o.say ? [{ when: { kind: "choice" as const, options: options.map((x) => display(x.value)), correct: i }, title: o.title, say: o.say }] : [])),
  };
}

/** [constant, x-coefficient] of a plain linear term like "3x-5". */
function parseLinear(text: string, v: string): [number, number] {
  let c0 = 0;
  let c1 = 0;
  for (const m of text.replace(/\s+/g, "").matchAll(/([+-]?)(\d*)([a-z]?)/g)) {
    if (!m[0]) continue;
    const sign = m[1] === "-" ? -1 : 1;
    if (m[3] === v) c1 += sign * (m[2] ? Number(m[2]) : 1);
    else if (m[2]) c0 += sign * Number(m[2]);
  }
  return [c0, c1];
}

/** "3x-5" → "3x - 5" for display. */
function showLinear(text: string, v: string): string {
  const [c0, c1] = parseLinear(text, v);
  return show([{ c: c1, v }, { c: c0, v: "" }]);
}

// ---------------------------------------------------------------------------
// Practice generators

function randomCollect(rng: Rng, v: string, two: boolean): T[] {
  for (;;) {
    const list: T[] = [];
    if (two) {
      const w = v === "a" ? "b" : v === "x" ? "y" : "a";
      for (let i = 0; i < 2; i++) list.push(term(rng.nonZero(-7, 9), v, `t${list.length}`));
      for (let i = 0; i < 2; i++) list.push(term(rng.nonZero(-7, 9), w, `t${list.length}`));
      if (rng.chance(0.4)) list.push(term(rng.nonZero(-9, 9), "", `t${list.length}`));
    } else {
      const nv = rng.int(2, 3);
      const nn = rng.int(1, 2);
      for (let i = 0; i < nv; i++) list.push(term(rng.chance(0.25) ? rng.sign() : rng.nonZero(-8, 9), v, `t${list.length}`));
      for (let i = 0; i < nn; i++) list.push(term(rng.nonZero(-9, 9), "", `t${list.length}`));
    }
    const order = rng.shuffle(list).map((t, i) => ({ ...t, k: `t${i}` }));
    if (order[0].c < 0 && rng.chance(0.7)) continue;
    const res = collect(order);
    const kinds = new Set(order.map((t) => t.v));
    // every kind survives, at least one term moves, numbers stay small
    if (res.length !== kinds.size || sortLike(order).every((t, i) => t === order[i]) || res.some((t) => Math.abs(t.c) > 20)) continue;
    return order;
  }
}

function genClever(rng: Rng): Exercise {
  if (rng.chance(0.35)) {
    const n = rng.pick([3, 4, 5, 6, 7, 8, 9, 12, 25]);
    const sg = rng.chance(0.65) ? 1 : -1;
    if (sg > 0) {
      // With R = 10 (8 · 9 + 8 · 1) direct calculation is just as quick, so the round number is 20 or 100.
      const R = rng.pick([20, 100, 100]);
      const a = R === 100 ? rng.int(51, 97) : rng.int(R / 2 + 1, R - 1);
      return cleverBackTask(n, a, R - a, 1);
    }
    const R = rng.pick([10, 100]);
    const b = rng.int(2, 9);
    return cleverBackTask(n, R + b, b, -1);
  }
  const n = rng.int(3, 9);
  const base = rng.pick([20, 30, 40, 50, 100, 100, 100, 200, 1000]);
  const sg = rng.chance(0.6) ? 1 : -1;
  const d = rng.int(1, base >= 100 ? 9 : 4);
  return cleverTask(n, base, d, sg);
}

function genExpand(rng: Rng): Exercise {
  const v = rng.pick(["x", "x", "a", "y", "b"]);
  const k = rng.int(2, 9);
  const p = rng.pick([1, 1, 2, 3, 4, 5]);
  const q = rng.int(1, 9) * (rng.chance(0.5) ? 1 : -1);
  const inner: Factor = rng.chance(0.75) ? [m(p, 1), m(q)] : [m(Math.abs(q)), m(rng.sign() * p, 1)];
  return expandTask(k, inner, v);
}

function genCollect(rng: Rng): Exercise {
  const v = rng.pick(["x", "x", "a", "y", "b"]);
  return collectTask(randomCollect(rng, v, rng.chance(0.3)));
}

function genExpandCollect(rng: Rng): Exercise {
  const v = rng.pick(["x", "x", "a", "y"]);
  for (;;) {
    const bracket = (id: string): Part => {
      const p = rng.pick([1, 1, 2, 3]);
      const q = rng.nonZero(-6, 6);
      return { kind: "b", f: rng.int(2, 6), id, terms: [term(p, v, `${id}a`), term(q, "", `${id}b`)] };
    };
    const form = rng.int(0, 3);
    let parts: Part[];
    if (form === 0) parts = [bracket("A"), { kind: "t", t: term(rng.nonZero(-5, 6), v, "P") }, { kind: "t", t: term(rng.nonZero(-9, 9), "", "Q") }];
    else if (form === 1) parts = [{ kind: "t", t: term(rng.int(1, 6), v, "P") }, bracket("A")];
    else if (form === 2) parts = [bracket("A"), bracket("B")];
    else parts = [bracket("A"), { kind: "t", t: term(rng.nonZero(-9, 9), "", "Q") }];
    const res = collect(expandParts(parts));
    if (res.length !== 2 || res.some((t) => Math.abs(t.c) > 40)) continue;
    return expandCollectTask(parts);
  }
}

/** Level 1 practice: mental maths with the distributive law, expanding, collecting, both, the area model and multiple choice. */
export function generate1(rng: Rng): Exercise {
  const r = rng.int(1, 100);
  if (r <= 17) return genClever(rng);
  if (r <= 35) return genExpand(rng);
  if (r <= 55) return genCollect(rng);
  if (r <= 72) return genExpandCollect(rng);
  if (r <= 85) return areaTask(rng);
  return equalTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const clever7: Frame[] = [
  ...cleverTask(7, 100, 3, 1).solution.map((f, i) =>
    i === 0
      ? { ...f, note: tx("$7 \\cdot 103$ in your head? Tricky. But $103 = 100 + 3$, and with $100$ everything is easy.", "$7 \\cdot 103$ im Kopf? Knifflig. Aber $103 = 100 + 3$, und mit $100$ ist alles leicht.") }
      : i === 2
        ? { ...f, note: tx("$7 \\cdot (100 + 3) = 7 \\cdot 100 + 7 \\cdot 3$. That's the **distributive law**: the factor in front multiplies each part.", "$7 \\cdot (100 + 3) = 7 \\cdot 100 + 7 \\cdot 3$. Das ist das **Distributivgesetz**: Der Faktor davor wird mit jedem Teil multipliziert.") }
        : f,
  ),
  // The same law backwards: a common factor goes in front of a bracket.
  { math: "7#n \\cdot#d 13#a +#p 7#n2 \\cdot#d2 7#b", note: tx("It also works **backwards**: in $7 \\cdot 13 + 7 \\cdot 7$ both products contain the factor $7$.", "Das geht auch **rückwärts**: In $7 \\cdot 13 + 7 \\cdot 7$ enthalten beide Produkte den Faktor $7$."), highlight: ["n", "n2"] },
  { math: "7#n \\cdot#d (13#a +#p 7#b)#br", note: tx("Write the $7$ only once, in front of a bracket: $7 \\cdot (13 + 7)$.", "Schreib die $7$ nur einmal, vor eine Klammer: $7 \\cdot (13 + 7)$.") },
  { math: "7#n \\cdot#d 20#a = 140#r", note: tx("$13 + 7 = 20$, and $7 \\cdot 20 = 140$. Much quicker than $91 + 49$!", "$13 + 7 = 20$, und $7 \\cdot 20 = 140$. Viel schneller als $91 + 49$!") },
];

const variableFrames: Frame[] = [
  { math: "3#k (x#x +#p 4#n)#b", note: tx("Now there's a variable inside. We can't add $x + 4$, because we don't know $x$.", "Jetzt steht eine Variable in der Klammer. $x + 4$ können wir nicht ausrechnen, wir kennen $x$ ja nicht.") },
  { math: "3#k (x#x +#p 4#n)#b", note: tx("But the distributive law still works: the $3$ multiplies **each** term, the $x$ and the $4$.", "Aber das Distributivgesetz gilt trotzdem: Die $3$ wird mit **jedem** Term multipliziert, mit $x$ und mit $4$."), arrows: [["k", "x"], ["k", "n"]] },
  { math: "3#k \\cdot#d1 x#x +#p 3#k2 \\cdot#d2 4#n", note: tx("Two products, just like with $7 \\cdot 103$.", "Zwei Produkte, genau wie bei $7 \\cdot 103$.") },
  { math: "3#k x#x +#p 12#n", note: tx("$3 \\cdot x = 3x$ and $3 \\cdot 4 = 12$. The bracket is gone: $3(x + 4) = 3x + 12$.", "$3 \\cdot x = 3x$ und $3 \\cdot 4 = 12$. Die Klammer ist weg: $3(x + 4) = 3x + 12$.") },
  { math: "3 \\cdot (2 + 4) = 18 = 3 \\cdot 2 + 12", note: tx("Check with $x = 2$: both sides give $18$. It works for every number!", "Probe mit $x = 2$: Beide Seiten ergeben $18$. Das klappt mit jeder Zahl!") },
];

const likeList: T[] = [term(3, "x", "a"), term(2, "", "b"), term(5, "x", "c"), term(-7, "", "d")];
const likeFrames: Frame[] = collectFrames(
  likeList,
  tx("$3x$ and $5x$ are **like terms**: both are a number times $x$. The plain numbers $2$ and $-7$ are like terms too.", "$3x$ und $5x$ sind **gleichartige Terme**: Beide sind eine Zahl mal $x$. Auch die Zahlen $2$ und $-7$ sind gleichartig."),
);

const comboParts: Part[] = [{ kind: "b", f: 2, id: "A", terms: [term(3, "x", "Aa"), term(4, "", "Ab")] }, { kind: "t", t: term(5, "x", "P") }, { kind: "t", t: term(-1, "", "Q") }];

const check1 = cleverTask(6, 100, 2, -1);
const check2 = expandTask(5, [m(2, 1), m(-1)], "a", tx("$5 \\cdot 2a$ and $5 \\cdot 1$. The minus stays.", "$5 \\cdot 2a$ und $5 \\cdot 1$. Das Minus bleibt."));
const check3 = collectTask([term(4, "a", "a"), term(7, "", "b"), term(-1, "a", "c"), term(3, "", "d")], tx("The lone $-a$ means $-1a$.", "Das einzelne $-a$ heißt $-1a$."));
const check4 = expandCollectTask(
  [
    { kind: "b", f: 3, id: "A", terms: [term(2, "x", "Aa"), term(1, "", "Ab")] },
    { kind: "b", f: 2, id: "B", terms: [term(1, "x", "Ba"), term(-4, "", "Bb")] },
  ],
  tx("Expand both brackets: $3 \\cdot 2x$, $3 \\cdot 1$, $2 \\cdot x$, $2 \\cdot (-4)$. Then combine.", "Löse beide Klammern auf: $3 \\cdot 2x$, $3 \\cdot 1$, $2 \\cdot x$, $2 \\cdot (-4)$. Dann zusammenfassen."),
);

export const level1: LevelLesson = {
  summary: [
    {
      title: tx("Distributive law", "Distributivgesetz"),
      body: tx("A factor in front of a bracket multiplies **every** term inside.", "Ein Faktor vor der Klammer wird mit **jedem** Term in der Klammer multipliziert."),
      examples: ["a \\cdot (b + c) = a \\cdot b + a \\cdot c", "7 \\cdot 103 = 7 \\cdot 100 + 7 \\cdot 3 = 721", "3(x + 4) = 3x + 12"],
      tone: "rule",
    },
    {
      title: tx("Calculating cleverly", "Geschickt rechnen"),
      body: tx("Write an awkward number as a round number plus or minus a little bit. It also works backwards: a common factor goes in front of a bracket.", "Zerleg eine unhandliche Zahl in eine runde Zahl plus oder minus einen kleinen Rest. Es geht auch rückwärts: Ein gemeinsamer Faktor kommt vor eine Klammer."),
      examples: ["6 \\cdot 98 = 600 - 12 = 588", "7 \\cdot 13 + 7 \\cdot 7 = 7 \\cdot 20 = 140"],
      tone: "tip",
    },
    {
      title: tx("Like terms", "Gleichartige Terme"),
      body: tx(
        "Like terms have exactly the same variable part. Only they can be combined: add the numbers in front, keep the variable.",
        "Gleichartige Terme haben genau denselben Variablenteil. Nur sie lassen sich zusammenfassen: Addiere die Zahlen davor, die Variable bleibt.",
      ),
      examples: ["3x + 5x = 8x", "4a - a = 3a", tx("2x + 3y \\quad \\text{(stays as it is)}", "2x + 3y \\quad \\text{(bleibt so)}")],
      tone: "rule",
    },
    {
      title: tx("The sign belongs to the term", "Das Vorzeichen gehört zum Term"),
      body: tx("When you reorder a term, each part takes the sign in front of it along.", "Wenn du umsortierst, nimmt jeder Teil das Vorzeichen vor sich mit."),
      examples: ["3x + 2 + 5x - 7 = 3x + 5x + 2 - 7 = 8x - 5"],
      tone: "tip",
    },
    {
      title: tx("First expand, then collect", "Erst ausmultiplizieren, dann zusammenfassen"),
      body: tx("Get rid of the brackets first. Then combine like terms.", "Löse zuerst die Klammern auf. Dann fasst du gleichartige Terme zusammen."),
      examples: ["3(2x + 1) + 2(x - 4) = 6x + 3 + 2x - 8 = 8x - 5"],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Every term in the bracket gets multiplied, and unlike terms stay apart.", "Jeder Term in der Klammer wird multipliziert, und ungleichartige Terme bleiben getrennt."),
      examples: ["5(2a - 1) \\ne 10a - 1", "3x + 2 \\ne 5x"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Clever calculating: 7 · 103", "Geschickt rechnen: 7 · 103"),
      blob: tx("Bet I can work out 7 · 103 in my head in three seconds. Watch!", "Wetten, ich rechne 7 · 103 in drei Sekunden im Kopf? Schau zu!"),
      body: tx(
        "Instead of multiplying $103$ in one go, split it into $100 + 3$. Multiply **each** part and add the results. It also works backwards: $7 \\cdot 13 + 7 \\cdot 7 = 7 \\cdot (13 + 7)$.",
        "Statt $103$ auf einmal zu multiplizieren, zerlegst du es in $100 + 3$. Multipliziere **jeden** Teil und addiere die Ergebnisse. Das geht auch rückwärts: $7 \\cdot 13 + 7 \\cdot 7 = 7 \\cdot (13 + 7)$.",
      ),
      frames: clever7,
    },
    {
      type: "widget",
      id: "split-the-rectangle",
      title: tx("Split the rectangle", "Teil das Rechteck"),
      blob: tx("Drag the purple line and watch the two parts!", "Zieh an der lila Linie und schau dir die beiden Teile an!"),
      body: tx(
        "A rectangle of unit squares shows a product: height times width. Split it into two parts: the two smaller products always add up to the whole. That's why the distributive law works.",
        "Ein Rechteck aus Kästchen zeigt ein Produkt: Höhe mal Breite. Teilst du es in zwei Teile, ergeben die beiden kleineren Produkte zusammen immer das Ganze. Darum funktioniert das Distributivgesetz.",
      ),
      widget: ExpandingSplitRect,
    },
    {
      type: "check",
      blob: tx("Your turn! 98 is close to a very round number.", "Du bist dran! 98 liegt nah an einer sehr runden Zahl."),
      exercise: check1,
    },
    {
      type: "explain",
      id: "rectangle-3-times-x-plus-4",
      title: tx("A variable in the bracket", "Eine Variable in der Klammer"),
      blob: tx("Same trick, now with x. Let's expand!", "Derselbe Trick, jetzt mit x. Ausmultiplizieren!"),
      body: tx(
        "$3(x + 4)$ means $3 \\cdot (x + 4)$. Think of a rectangle with height $3$ and width $x + 4$: its area is $3 \\cdot x$ plus $3 \\cdot 4$. Getting rid of the bracket like this is called **expanding**.",
        "$3(x + 4)$ heißt $3 \\cdot (x + 4)$. Stell dir ein Rechteck mit der Höhe $3$ und der Breite $x + 4$ vor: Seine Fläche ist $3 \\cdot x$ plus $3 \\cdot 4$. Die Klammer so aufzulösen heißt **Ausmultiplizieren**.",
      ),
      visual: pic({ h: "3", w: ["x", "4"], inner: ["3x", "12"], caption: tx("Area: 3 · (x + 4) = 3x + 12", "Flächeninhalt: 3 · (x + 4) = 3x + 12") }),
      frames: variableFrames,
    },
    {
      type: "check",
      blob: tx("Multiply the 5 by both terms. Careful with the minus!", "Multipliziere die 5 mit beiden Termen. Achtung beim Minus!"),
      exercise: check2,
    },
    {
      type: "explain",
      title: tx("Like terms", "Gleichartige Terme"),
      blob: tx("Apples with apples, oranges with oranges!", "Äpfel zu Äpfeln, Birnen zu Birnen!"),
      body: tx(
        "Terms with the same variable part are **like terms**: $3x$ and $5x$, or $2$ and $-7$. You can combine them into one. $3x$ and $2$ are different kinds, so they stay apart.",
        "Terme mit demselben Variablenteil sind **gleichartig**: $3x$ und $5x$ oder $2$ und $-7$. Du kannst sie zu einem Term zusammenfassen. $3x$ und $2$ sind verschiedene Sorten, die bleiben getrennt.",
      ),
      frames: likeFrames,
    },
    {
      type: "widget",
      id: "algebra-tiles",
      title: tx("Algebra tiles", "Algebra-Kacheln"),
      blob: tx("Build a term with tiles and let them sort themselves.", "Bau einen Term aus Kacheln und lass sie sich sortieren."),
      body: tx(
        "A long tile stands for $x$, a small tile for $1$, red tiles are negative. Collecting like terms means: put the same kind together, and let a plus and a minus tile cancel out.",
        "Eine lange Kachel steht für $x$, eine kleine für $1$, rote Kacheln sind negativ. Gleichartige Terme zusammenfassen heißt: Gleiche Sorten zusammenlegen, und eine Plus- und eine Minus-Kachel heben sich auf.",
      ),
      widget: ExpandingTiles,
    },
    {
      type: "check",
      blob: tx("Watch the lone a!", "Pass auf das einzelne a auf!"),
      exercise: check3,
    },
    {
      type: "explain",
      title: tx("First expand, then collect", "Erst ausmultiplizieren, dann zusammenfassen"),
      blob: tx("Now both skills together. You've got this!", "Jetzt beides zusammen. Das schaffst du!"),
      body: tx("If a term has brackets and other terms, first expand the brackets. Then combine like terms.", "Hat ein Term Klammern und weitere Terme, löst du zuerst die Klammern auf. Dann fasst du gleichartige Terme zusammen."),
      frames: expandPartsFrames(comboParts),
    },
    {
      type: "check",
      blob: tx("Last one: two brackets, then combine.", "Die letzte: zwei Klammern, dann zusammenfassen."),
      exercise: check4,
    },
  ],
};
