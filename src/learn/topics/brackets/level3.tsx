"use client";

import { tx, type Text } from "@/i18n/text";
import { equivalentText } from "@/learn/engine/expr";
import { gcd, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { FactorFinder } from "./FactorFinder";
import { GroupingPuzzle } from "./Grouping";
import { glued } from "./long";
import { divMono, factorFrames, isOne, mono, monoPlain, monoSrc, mulMono, negMono, polyPlain, polySrc, type Mono } from "./mono";

// ---------------------------------------------------------------------------
// Helpers

const nz = (rng: Rng, m: number) => rng.nonZero(-m, m);
const LETTERS: string[][] = [["x"], ["a"], ["x", "y"], ["a", "b"]];

/** "3xy", "-", "-2a" for the factor in front of a bracket. */
const front = (F: Mono, vars: string[]) => (F.c === -1 && F.e.every((e) => e === 0) ? "-" : monoSrc(F, vars, { first: true }));

/** Collects typical wrong answers for an expr task: only those that differ from the right one and each other. */
function exprMistakes(right: string, positive = false) {
  const list: Mistake[] = [];
  const add = (value: string, title: Text, say: Text) => {
    if (equivalentText(value, right, { positive }) || list.some((m) => m.when.kind === "expr" && equivalentText(m.when.value, value, { positive }))) return;
    list.push({ when: { kind: "expr", value, ...(positive ? { positive } : {}) }, title, say });
  };
  return { list, add };
}

/** "4, 6 and 12" */
const andList = (nums: number[], and: string) => (nums.length > 1 ? `${nums.slice(0, -1).join(", ")} ${and} ${nums[nums.length - 1]}` : String(nums[0]));

type Built = { vars: string[]; G: Mono; q: Mono[]; terms: Mono[] };

/**
 * Terms G·qᵢ with a known greatest common factor G (letters included): the qᵢ share no factor,
 * every letter is missing from at least one qᵢ, no like terms, highest power first.
 */
function buildTerms(rng: Rng, opts: { n?: number; one?: boolean; letters?: string[] } = {}): Built {
  for (;;) {
    const vars = opts.letters ?? rng.pick(LETTERS);
    const g = rng.pick([2, 2, 3, 3, 4, 4, 5, 6, 8]);
    const Ge = vars.map(() => rng.int(0, 2));
    if (Ge.every((e) => e === 0)) continue;
    const n = opts.n ?? (rng.chance(0.7) ? 2 : 3);
    const q: Mono[] = Array.from({ length: n }, (_, i) => {
      if (opts.one && i === n - 1) return mono(rng.sign(), ...vars.map(() => 0));
      return mono(i === 0 ? rng.int(1, 5) : nz(rng, 5), ...vars.map(() => rng.int(0, 2)));
    });
    if (q[0].c < 0) continue;
    if (q.reduce((a, m) => gcd(a, m.c), 0) !== 1) continue;
    if (vars.some((_, i) => Math.min(...q.map((m) => m.e[i])) !== 0)) continue;
    const keys = q.map((m) => m.e.join(","));
    if (new Set(keys).size !== keys.length) continue;
    const G = mono(g, ...Ge);
    const terms = q.map((m) => mulMono(m, G));
    if (terms.some((t) => Math.abs(t.c) > 40 || t.e.some((e) => e > 4))) continue;
    const deg = (m: Mono) => m.e.reduce((s, e) => s + e, 0);
    const order = terms.map((_, i) => i).sort((a, b) => deg(terms[b]) - deg(terms[a]));
    if (terms[order[0]].c < 0) continue;
    return { vars, G, q: order.map((i) => q[i]), terms: order.map((i) => terms[i]) };
  }
}

// ---------------------------------------------------------------------------
// Shapes

const GCF = tx("Find the greatest common factor", "Bestimme den größten gemeinsamen Faktor");

function gcfExercise(b: Built): Exercise {
  const { vars, G, terms } = b;
  const value = monoPlain(G, vars);
  const Gs = monoSrc(G, vars, { first: true });
  const m = exprMistakes(value);
  const nums = terms.map((t) => Math.abs(t.c));
  m.add(String(G.c), tx("Letters missing", "Buchstaben fehlen"), tx(`You found the number $${G.c}$. But some letters are in every term too: take them along, each with its smallest exponent.`, `Die Zahl $${G.c}$ hast du gefunden. Es stecken aber auch Buchstaben in jedem Term: Nimm sie mit, jeweils mit dem kleinsten Exponenten.`));
  if (G.c > 1) {
    m.add(monoPlain({ c: 1, e: G.e }, vars), tx("The number is missing", "Die Zahl fehlt"), tx(`The letters are right. But ${andList(nums, "and")} also share the factor $${G.c}$.`, `Die Buchstaben stimmen. Aber ${andList(nums, "und")} haben auch noch den gemeinsamen Teiler $${G.c}$.`));
  }
  const maxE = vars.map((_, i) => Math.max(...terms.map((t) => t.e[i])));
  m.add(monoPlain({ c: G.c, e: maxE }, vars), tx("Smallest exponent, not biggest", "Kleinster Exponent, nicht größter"), tx("Take the **smallest** exponent of each letter: the factor has to fit into **every** term.", "Nimm von jedem Buchstaben den **kleinsten** Exponenten: Der Faktor muss in **jeden** Term passen."));
  const small = Math.min(...nums);
  if (nums.some((x) => x % small !== 0)) {
    m.add(monoPlain({ c: small, e: G.e }, vars), tx("Smallest number instead of the gcd", "Kleinste Zahl statt ggT"), tx(`$${small}$ doesn't divide all the numbers. You need the **greatest number that divides** ${andList(nums, "and")}.`, `$${small}$ teilt nicht alle Zahlen. Du brauchst die **größte Zahl, die** ${andList(nums, "und")} **teilt**.`));
  }
  const frames = factorFrames(terms, vars, G);
  return {
    instruction: GCF,
    math: polySrc(terms, vars),
    answer: { kind: "expr", value },
    hint: tx("The gcd of the numbers, and every letter that is in **all** terms with its **smallest** exponent.", "Der ggT der Zahlen und jeder Buchstabe, der in **allen** Termen steckt, mit dem **kleinsten** Exponenten."),
    solution: [...frames.slice(0, 3), { ...frames[2], note: tx(`The greatest common factor is $${Gs}$.`, `Der größte gemeinsame Faktor ist $${Gs}$.`) }],
    mistakes: m.list,
  };
}

const FILL = tx("Factor out: what goes into the bracket?", "Klammere aus: Was steht in der Klammer?");

function bracketExercise(terms: Mono[], vars: string[], F: Mono): Exercise {
  const q = terms.map((t) => divMono(t, F));
  const value = polyPlain(q, vars);
  const Fs = front(F, vars);
  const Fname = F.c === -1 && F.e.every((e) => e === 0) ? "-1" : Fs;
  const m = exprMistakes(value);
  const neg = F.c < 0;
  if (neg) {
    m.add(polyPlain(q.map(negMono), vars), tx("Signs not flipped", "Vorzeichen nicht umgedreht"), tx("You factored out a **minus**. Then every sign in the bracket flips.", "Du hast ein **Minus** ausgeklammert. Dann dreht sich jedes Vorzeichen in der Klammer um."));
    if (q.length > 1) m.add(polyPlain([q[0], ...q.slice(1).map(negMono)], vars), tx("Only the first sign flipped", "Nur das erste Vorzeichen gedreht"), tx("Nearly! Factoring out a minus flips **every** sign in the bracket, not just the first one.", "Fast! Ein ausgeklammertes Minus dreht **jedes** Vorzeichen in der Klammer um, nicht nur das erste."));
  }
  if (Fs !== "-") m.add(polyPlain(terms, vars), tx("Only the bracket", "Nur die Klammer"), tx(`Type only what goes **into** the bracket. The $${Fs}$ is already in front of it.`, `Gib nur ein, was **in** die Klammer kommt. $${Fs}$ steht schon davor.`));
  const last = terms[terms.length - 1];
  const lastQ = q[q.length - 1];
  if (!isOne(F) && !(isOne(lastQ) && neg)) {
    m.add(polyPlain([...q.slice(0, -1), neg ? negMono(last) : last], vars), tx("Not every term divided", "Nicht jeden Term geteilt"), tx(`Every term has to be divided by $${Fname}$, also $${monoSrc(last, vars, { first: true })}$.`, `Jeder Term muss durch $${Fname}$ geteilt werden, auch $${monoSrc(last, vars, { first: true })}$.`));
  }
  const oneAt = q.findIndex(isOne);
  if (oneAt >= 0 && q.length > 1) {
    // A negative number after a times sign gets brackets: −3x · (−1), never −3x · −1.
    const qc = q[oneAt].c < 0 ? `(${q[oneAt].c})` : String(q[oneAt].c);
    const prod = `${monoSrc(terms[oneAt], vars, { first: true })} = ${Fs === "-" ? "-1" : Fs} \\cdot ${qc}`;
    // The term may be the factor itself (a 1 stays) or its negative (a −1 stays).
    const say =
      q[oneAt].c < 0
        ? tx(`When a term is the negative of the factor, a $-1$ stays in the bracket: $${prod}$.`, `Ist ein Term das Negative des Faktors, bleibt eine $-1$ in der Klammer: $${prod}$.`)
        : tx(`When a term is the factor itself, a $1$ stays in the bracket: $${prod}$.`, `Ist ein Term der Faktor selbst, bleibt eine $1$ in der Klammer: $${prod}$.`);
    m.add(polyPlain(q.filter((_, i) => i !== oneAt), vars), tx("The 1 is missing", "Die 1 fehlt"), say);
  }
  return {
    instruction: FILL,
    // "= 6y²(☐)" stays together: on a phone the line breaks before the equals sign, never after "6y²" or "−".
    math: `${polySrc(terms, vars)} \\group{= ${Fs}(\\,\\box{\\,?\\,}\\,)}`,
    answer: { kind: "expr", value },
    hint: neg
      ? tx(`Divide every term by $${Fname}$. Dividing by a negative number flips every sign.`, `Teile jeden Term durch $${Fname}$. Teilen durch eine negative Zahl dreht jedes Vorzeichen um.`)
      : tx(`Divide every term by $${Fs}$.`, `Teile jeden Term durch $${Fs}$.`),
    solution: factorFrames(terms, vars, F),
    mistakes: m.list,
  };
}

function bracketTask(rng: Rng): Exercise {
  const kind = rng.int(0, 3);
  if (kind === 0) {
    const b = buildTerms(rng, { one: rng.chance(0.3) });
    return bracketExercise(b.terms, b.vars, b.G);
  }
  if (kind === 1) {
    // −1 only: −x + 5 = −(x − 5)
    const v = rng.pick(["x", "a", "y"]);
    const terms = rng.chance(0.5) ? [mono(-rng.int(1, 9), 1), mono(nz(rng, 9), 0)] : [mono(-rng.int(1, 5), 2), mono(nz(rng, 9), 1), mono(nz(rng, 9), 0)];
    return bracketExercise(terms, [v], mono(-1, 0));
  }
  // a negative common factor: the first term is negative
  const b = buildTerms(rng, { one: kind === 3 && rng.chance(0.4) });
  return bracketExercise(b.terms.map(negMono), b.vars, negMono(b.G));
}

function fullyTask(rng: Rng): Exercise {
  for (;;) {
    const negative = rng.chance(0.3);
    const b = buildTerms(rng, { one: rng.chance(0.3) });
    const vars = b.vars;
    const terms = negative ? b.terms.map(negMono) : b.terms;
    const F = negative ? negMono(b.G) : b.G;
    const q = terms.map((t) => divMono(t, F));
    const opt = (f: Mono, list: Mono[]) => `$${front(f, vars)}(${polySrc(list, vars)})$`;
    const cands: { text: string; title?: Text; say?: Text }[] = [{ text: opt(F, q) }];
    // Not the greatest factor: one prime or one letter stays in the bracket.
    const prime = [2, 3, 5, 7].find((p) => b.G.c % p === 0);
    const letter = b.G.e.findIndex((e) => e > 0);
    const splits: Mono[] = [];
    if (prime && Math.abs(F.c) / prime > 1) splits.push(mono(prime, ...vars.map(() => 0)));
    if (letter >= 0) splits.push(mono(1, ...vars.map((_, i) => (i === letter ? 1 : 0))));
    for (const p of splits) {
      const F2 = divMono(F, p);
      if (isOne(F2)) continue;
      cands.push({
        text: opt(F2, q.map((x) => mulMono(x, p))),
        title: tx("Not fully factored", "Nicht vollständig ausgeklammert"),
        say: tx(`That's equal, but not **fully** factored: every term in the bracket still contains $${monoSrc(p, vars, { first: true })}$.`, `Das ist zwar gleich, aber nicht **vollständig** ausgeklammert: In jedem Term der Klammer steckt noch $${monoSrc(p, vars, { first: true })}$.`),
      });
    }
    const last = terms[terms.length - 1];
    if (!isOne(q[q.length - 1])) cands.push({ text: opt(F, [...q.slice(0, -1), last]), title: tx("Not every term divided", "Nicht jeden Term geteilt"), say: tx("Expand it to check: the last term doesn't come back. Every term has to be divided by the factor.", "Multiplizier zur Probe aus: Der letzte Term kommt nicht wieder heraus. Jeder Term muss durch den Faktor geteilt werden.") });
    cands.push({ text: opt(F, [...q.slice(0, -1), negMono(q[q.length - 1])]), title: tx("A sign slipped", "Ein Vorzeichen verrutscht"), say: tx("Check the signs by expanding: the last term comes back with the wrong sign.", "Prüf die Vorzeichen durch Ausmultiplizieren: Der letzte Term kommt mit dem falschen Vorzeichen heraus.") });
    const oneAt = q.findIndex(isOne);
    if (oneAt >= 0)
      cands.push({
        text: opt(F, q.filter((_, i) => i !== oneAt)),
        title: tx("The 1 is missing", "Die 1 fehlt"),
        say:
          q[oneAt].c < 0
            ? tx("A term that is the negative of the factor leaves a $-1$ in the bracket. Without it, that term is lost.", "Ein Term, der das Negative des Faktors ist, hinterlässt eine $-1$ in der Klammer. Ohne sie geht dieser Term verloren.")
            : tx("A term that equals the factor leaves a $1$ in the bracket. Without it, that term is lost.", "Ein Term, der gleich dem Faktor ist, hinterlässt eine $1$ in der Klammer. Ohne sie geht dieser Term verloren."),
      });
    const opts: typeof cands = [];
    for (const c of cands) if (!opts.some((o) => o.text === c.text)) opts.push(c);
    if (opts.length < 4) continue;
    const pick = [0, ...rng.shuffle(opts.slice(1).map((_, i) => i + 1)).slice(0, 3)];
    const order = rng.shuffle(pick);
    const options = order.map((i) => opts[i].text);
    const mistakes: Mistake[] = [];
    order.forEach((i, k) => {
      const o = opts[i];
      if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: k }, title: o.title, say: o.say });
    });
    return {
      instruction: tx("Where was the factor taken out correctly and completely?", "Wo wurde richtig und vollständig ausgeklammert?"),
      math: polySrc(terms, vars),
      answer: { kind: "choice", options, correct: order.indexOf(0) },
      hint: tx("Look for the greatest common factor, then check each option by expanding.", "Such den größten gemeinsamen Faktor und prüf jede Antwort durch Ausmultiplizieren."),
      solution: factorFrames(terms, vars, F),
      mistakes,
    };
  }
}

/** p(B) + r(B), p(a − b) + r(b − a), and grouping four terms. */
function commonBracketTask(rng: Rng): Exercise {
  const kind = rng.pick(["bracket", "bracket", "twist", "group", "group"] as const);
  // "= (x − 3)(☐)" stays together, so a phone breaks the line before the equals sign.
  const fill = (lhs: string, B: string) => `${lhs} \\group{= (${B})(\\,\\box{\\,?\\,}\\,)}`;
  if (kind === "bracket") {
    const w = rng.pick(["a", "x", "y", "b"]);
    const u = w === "x" ? "a" : "x";
    const b = nz(rng, 9);
    const B = `${w} ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
    const pc = rng.int(1, 6);
    const p = `${pc === 1 ? "" : pc}${u}`;
    const r = rng.chance(0.2) ? rng.sign() : nz(rng, 9);
    if (gcd(pc, r) !== 1) return commonBracketTask(rng);
    const rText = `${r < 0 ? "-" : "+"} ${Math.abs(r) === 1 ? "" : Math.abs(r)}`;
    const lhs = `${glued("", `${p}(${B})`, true)} ${glued(r < 0 ? "-" : "+", `${Math.abs(r) === 1 ? "" : Math.abs(r)}(${B})`, false)}`;
    const value = `${p}${r < 0 ? "-" : "+"}${Math.abs(r)}`;
    const m = exprMistakes(value);
    m.add(`${p}${r < 0 ? "+" : "-"}${Math.abs(r)}`, tx("Sign of the second factor", "Vorzeichen des zweiten Faktors"), tx(`The sign in front of the second bracket belongs to its factor: $${r < 0 ? "-" : "+"}${Math.abs(r)}$ goes into the new bracket.`, `Das Zeichen vor der zweiten Klammer gehört zu ihrem Faktor: $${r < 0 ? "-" : "+"}${Math.abs(r)}$ kommt in die neue Klammer.`));
    // Before the multiply mistake: for r = 1 both give p, and the forgotten 1 is the likelier slip.
    if (Math.abs(r) === 1) m.add(p, tx("The 1 is missing", "Die 1 fehlt"), tx(`$${r < 0 ? "-" : "+"}(${B})$ means $${r < 0 ? "-1" : "+1"} \\cdot (${B})$. That $1$ goes into the new bracket.`, `$${r < 0 ? "-" : "+"}(${B})$ heißt $${r < 0 ? "-1" : "+1"} \\cdot (${B})$. Diese $1$ kommt mit in die neue Klammer.`));
    m.add(`${r * pc}${u}`, tx("Added, not multiplied", "Addieren, nicht multiplizieren"), tx(`Treat the bracket like one letter $z$: $${p}z ${r < 0 ? "-" : "+"} ${Math.abs(r) === 1 ? "" : Math.abs(r)}z = (${p} ${r < 0 ? "-" : "+"} ${Math.abs(r)})z$. The factors are combined with their signs, not multiplied.`, `Behandle die Klammer wie einen Buchstaben $z$: $${p}z ${r < 0 ? "-" : "+"} ${Math.abs(r) === 1 ? "" : Math.abs(r)}z = (${p} ${r < 0 ? "-" : "+"} ${Math.abs(r)})z$. Die Faktoren werden mit ihren Vorzeichen zusammengefasst, nicht multipliziert.`));
    return {
      instruction: tx("Factor out the common bracket", "Klammere die gemeinsame Klammer aus"),
      math: fill(lhs, B),
      answer: { kind: "expr", value },
      hint: tx(`$(${B})$ is in both terms. Treat it like a single letter.`, `$(${B})$ steckt in beiden Termen. Behandle sie wie einen einzelnen Buchstaben.`),
      solution: [
        { math: `${p} \\hl{(${B})} ${rText} \\hl{(${B})}`, note: tx(`The bracket $(${B})$ is a factor of both terms.`, `Die Klammer $(${B})$ ist Faktor in beiden Termen.`) },
        { math: `(${B}) (${p} ${r < 0 ? "-" : "+"} ${Math.abs(r)})`, note: tx(`Factor it out. What's left of each term goes into the new bracket: $${p}$ and $${r < 0 ? "-" : "+"}${Math.abs(r)}$.`, `Klammere sie aus. Was von jedem Term übrig bleibt, kommt in die neue Klammer: $${p}$ und $${r < 0 ? "-" : "+"}${Math.abs(r)}$.`) },
      ],
      mistakes: m.list,
    };
  }
  if (kind === "twist") {
    const [w, z] = rng.pick([
      ["a", "b"],
      ["x", "y"],
      ["m", "n"],
    ]);
    const u = w === "x" ? "a" : "x";
    // p always has a letter: with a plain number, (m − n)(6 − 7) would still need working out.
    const pc = rng.int(1, 5);
    const p = `${pc === 1 ? "" : pc}${u}`;
    const r = rng.int(2, 9);
    if (gcd(pc, r) !== 1) return commonBracketTask(rng);
    const B = `${w} - ${z}`;
    const lhs = `${glued("", `${p}(${w} - ${z})`, true)} ${glued("+", `${r}(${z} - ${w})`, false)}`;
    const value = `${p}-${r}`;
    const m = exprMistakes(value);
    m.add(`${p}+${r}`, tx("The brackets are opposite", "Die Klammern sind entgegengesetzt"), tx(`Careful: $(${z} - ${w})$ is not the same bracket as $(${w} - ${z})$. $${z} - ${w} = -(${w} - ${z})$, so the sign of the $${r}$ flips.`, `Vorsicht: $(${z} - ${w})$ ist nicht dieselbe Klammer wie $(${w} - ${z})$. $${z} - ${w} = -(${w} - ${z})$, also dreht sich das Vorzeichen der $${r}$ um.`));
    return {
      instruction: tx("Factor out the common bracket", "Klammere die gemeinsame Klammer aus"),
      math: fill(lhs, B),
      answer: { kind: "expr", value },
      hint: tx(`$(${z} - ${w})$ is $-(${w} - ${z})$: factor out $-1$ first.`, `$(${z} - ${w})$ ist $-(${w} - ${z})$: Klammere zuerst $-1$ aus.`),
      solution: [
        { math: `${p}(${w} - ${z}) + ${r}\\hl{(${z} - ${w})}`, note: tx(`The second bracket is the first one backwards: $${z} - ${w} = -(${w} - ${z})$.`, `Die zweite Klammer ist die erste rückwärts: $${z} - ${w} = -(${w} - ${z})$.`) },
        { math: `${p}(${w} - ${z}) - ${r}(${w} - ${z})`, note: tx("Now both brackets are the same. The plus turned into a minus.", "Jetzt sind beide Klammern gleich. Aus dem Plus wurde ein Minus.") },
        { math: `(${w} - ${z})(${p} - ${r})`, note: tx("Factor out the common bracket.", "Klammere die gemeinsame Klammer aus.") },
      ],
      mistakes: m.list,
    };
  }
  // grouping: m·w + q·m + n·w + n·q = (w + q)(m + n)
  const w = rng.pick(["x", "y"]);
  const mm = w === "x" ? rng.pick(["a", "b", "y"]) : rng.pick(["a", "b"]);
  const q = nz(rng, 6);
  const n = nz(rng, 6);
  const sorted = (a: string, b: string) => [a, b].sort().join("");
  const s = (c: number, first = false) => (c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ");
  const coef = (c: number) => (Math.abs(c) === 1 ? "" : String(Math.abs(c)));
  const unit = (c: string, v: string) => (c ? `\\group{${c}${v}}` : v);
  const lhs = `\\group{${sorted(mm, w)}} ${s(q)}${unit(coef(q), mm)} ${s(n)}${unit(coef(n), w)} ${s(n * q)}${Math.abs(n * q)}`;
  const B = `${w} ${s(q)}${Math.abs(q)}`;
  const value = `${mm}${n < 0 ? "-" : "+"}${Math.abs(n)}`;
  const m = exprMistakes(value);
  m.add(`${mm}${n < 0 ? "+" : "-"}${Math.abs(n)}`, tx("Sign of the second pair", "Vorzeichen beim zweiten Paar"), tx(`Factor the second pair so that the **same** bracket appears: $${s(n, true)}${coef(n)}${w} ${s(n * q)}${Math.abs(n * q)} = ${n < 0 ? "-" : ""}${Math.abs(n)}(${B})$.`, `Klammere beim zweiten Paar so aus, dass **dieselbe** Klammer entsteht: $${s(n, true)}${coef(n)}${w} ${s(n * q)}${Math.abs(n * q)} = ${n < 0 ? "-" : ""}${Math.abs(n)}(${B})$.`));
  // Before the multiply mistake: for n = 1 both give the same value, and the forgotten 1 is the likelier slip.
  if (Math.abs(n) === 1) m.add(mm, tx("The 1 is missing", "Die 1 fehlt"), tx(`The second pair is $${s(n, true)}${w} ${s(n * q)}${Math.abs(n * q)} = ${n < 0 ? "-1" : "1"} \\cdot (${B})$. That $${n}$ goes into the new bracket: $(${B})(${mm} ${s(n)}1)$.`, `Das zweite Paar ist $${s(n, true)}${w} ${s(n * q)}${Math.abs(n * q)} = ${n < 0 ? "-1" : "1"} \\cdot (${B})$. Diese $${n}$ kommt mit in die neue Klammer: $(${B})(${mm} ${s(n)}1)$.`));
  m.add(`${n}${mm}`, tx("Added, not multiplied", "Addieren, nicht multiplizieren"), tx(`After grouping you have $${mm}(${B}) ${s(n)}${Math.abs(n)}(${B})$. The factors in front of the bracket are combined with their signs: $(${B})(${mm} ${s(n)}${Math.abs(n)})$.`, `Nach dem Gruppieren hast du $${mm}(${B}) ${s(n)}${Math.abs(n)}(${B})$. Die Faktoren vor der Klammer werden mit ihren Vorzeichen zusammengefasst: $(${B})(${mm} ${s(n)}${Math.abs(n)})$.`));
  return {
    instruction: tx("Factor by grouping", "Klammere durch Gruppieren aus"),
    math: fill(lhs, B),
    answer: { kind: "expr", value },
    hint: tx("Group the first two and the last two terms. Factor each pair so that the same bracket appears.", "Fasse die ersten beiden und die letzten beiden Terme zu Paaren zusammen. Klammere bei jedem Paar so aus, dass dieselbe Klammer entsteht."),
    solution: [
      { math: `(${sorted(mm, w)} ${s(q)}${coef(q)}${mm}) + (${s(n, true)}${coef(n)}${w} ${s(n * q)}${Math.abs(n * q)})`, note: tx("Group the terms in pairs.", "Fasse die Terme paarweise zusammen.") },
      { math: `${mm}\\hl{(${B})} ${s(n)}${Math.abs(n)}\\hl{(${B})}`, note: tx(`Factor $${mm}$ out of the first pair and $${n < 0 ? "-" : ""}${Math.abs(n)}$ out of the second: the same bracket appears twice.`, `Klammere aus dem ersten Paar $${mm}$ aus und aus dem zweiten $${n < 0 ? "-" : ""}${Math.abs(n)}$: Zweimal steht dieselbe Klammer.`) },
      { math: `(${B})(${mm} ${s(n)}${Math.abs(n)})`, note: tx("Factor out the common bracket. Done!", "Klammere die gemeinsame Klammer aus. Fertig!") },
    ],
    mistakes: m.list,
  };
}

/** x² − 5x = 0, 3x² + 12x = 0, 2x² = 10x: factor out x, zero product rule. */
function solveTask(rng: Rng): Exercise {
  const a = rng.chance(0.55) ? 1 : rng.int(2, 5);
  const r = rng.nonZero(-9, 9);
  // a·x² − a·r·x = 0 has the solutions 0 and r
  const b = -a * r;
  const moved = rng.chance(0.3);
  const ax = a === 1 ? "x^2" : `\\group{${a}x^2}`;
  const bx = (c: number, first = false) => {
    const sign = c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
    const body = `${Math.abs(c) === 1 ? "" : Math.abs(c)}x`;
    return first && c < 0 ? `\\group{-${body}}` : `${sign}${Math.abs(c) === 1 ? body : `\\group{${body}}`}`;
  };
  const eq = moved ? `${ax} = ${bx(-b, true)}` : `${ax} ${bx(b)} = 0`;
  const std = `${ax} ${bx(b)} = 0`;
  const F = a === 1 ? "x" : `${a}x`;
  const inner = `x ${r < 0 ? "+" : "-"} ${Math.abs(r)}`;
  const mistakes: Mistake[] = [
    {
      when: { kind: "solutions", variable: "x", values: [r] },
      title: tx("Lost x = 0", "x = 0 verloren"),
      say: tx("Did you divide by $x$? That throws away the solution $x = 0$. Factor out $x$ instead: a product is $0$ if **one** factor is $0$.", "Hast du durch $x$ geteilt? Dabei geht die Lösung $x = 0$ verloren. Klammere lieber $x$ aus: Ein Produkt ist $0$, wenn **ein** Faktor $0$ ist."),
    },
    {
      when: { kind: "solutions", variable: "x", values: [0, -r] },
      title: tx("Sign of the second solution", "Vorzeichen der zweiten Lösung"),
      say: tx(`Careful: $${inner} = 0$ gives $x = ${r}$, not $${-r}$.`, `Vorsicht: $${inner} = 0$ ergibt $x = ${r}$, nicht $${-r}$.`),
    },
  ];
  if (a !== 1) {
    mistakes.push({
      when: { kind: "solutions", variable: "x", values: [0, -b] },
      title: tx("Forgot to divide", "Teilen vergessen"),
      say: tx(`From $${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = 0$ you get $x = ${r}$: divide by $${a}$ too. Easiest: factor out $${a}x$ right away.`, `Aus $${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = 0$ folgt $x = ${r}$: Du musst noch durch $${a}$ teilen. Am einfachsten klammerst du gleich $${a}x$ aus.`),
    });
  }
  const solution: Frame[] = [];
  if (moved) solution.push({ math: eq, note: tx("Bring everything to one side first, so that $0$ is on the other side. Don't divide by $x$!", "Bring zuerst alles auf eine Seite, sodass auf der anderen $0$ steht. Teile nicht durch $x$!") });
  solution.push(
    {
      math: std,
      note: moved
        ? -b > 0
          ? tx(`Subtract $${bx(-b, true)}$ on both sides.`, `Subtrahiere auf beiden Seiten $${bx(-b, true)}$.`)
          : tx(`Add $${bx(b, true)}$ on both sides.`, `Addiere auf beiden Seiten $${bx(b, true)}$.`)
        : tx("Don't divide by $x$, you'd lose a solution. Factor out instead.", "Teile nicht durch $x$, sonst verlierst du eine Lösung. Klammere lieber aus."),
    },
    { math: `${F}(${inner}) = 0`, note: tx(`Factor out $${F}$. Now there is a product on the left.`, `Klammere $${F}$ aus. Links steht jetzt ein Produkt.`) },
    {
      math: tx(`${F} = 0 \\quad "or" \\quad ${inner} = 0`, `${F} = 0 \\quad "oder" \\quad ${inner} = 0`),
      note: tx("A product is $0$ exactly when one of its factors is $0$ (zero product rule).", "Ein Produkt ist genau dann $0$, wenn einer seiner Faktoren $0$ ist (Satz vom Nullprodukt)."),
    },
    { math: tx(`x_1 = 0 \\quad x_2 = ${r}`, `x_1 = 0 \\quad x_2 = ${r} \\quad L = \\{ ${Math.min(0, r)}; ${Math.max(0, r)} \\}`), note: tx(`Two solutions: $x = 0$ and $x = ${r}$.`, `Zwei Lösungen: $L = \\{ ${Math.min(0, r)}; ${Math.max(0, r)} \\}$.`) },
  );
  return {
    instruction: tx("Solve by factoring out", "Löse durch Ausklammern"),
    math: eq,
    answer: { kind: "solutions", variable: "x", values: [0, r] },
    hint: tx(`Bring everything to one side and factor out $${F}$. Then use: a product is $0$ if one factor is $0$.`, `Bring alles auf eine Seite und klammere $${F}$ aus. Dann gilt: Ein Produkt ist $0$, wenn ein Faktor $0$ ist.`),
    solution,
    mistakes,
  };
}

/** (6x + 9) : 3, (x² − 5x) : x, (4x + 8) : (x + 2): factor first, then cancel factors. */
function fractionTask(rng: Rng): Exercise {
  // Mostly kinds 1 and 2: there a letter (or a whole bracket) has to be factored out, not just a number.
  const kind = rng.pick([0, 1, 1, 2, 2]);
  const instruction = tx("Factor out, then simplify the fraction", "Klammere aus und kürze dann den Bruch");
  const hint = tx("Factor the numerator first. You may only cancel **factors**, never single summands.", "Klammere zuerst im Zähler aus. Kürzen darfst du nur **Faktoren**, nie einzelne Summanden.");
  /**
   * Kinds 0 and 1 are choices: a typed answer like "(3x - 18)/3" has the right value, and the checker
   * can't tell an uncancelled fraction from the result. The options are the result and typical slips.
   */
  const choose = (cands: { value: string; text: string; title?: Text; say?: Text }[]) => {
    const opts: typeof cands = [];
    for (const c of cands) if (!opts.some((o) => equivalentText(o.value, c.value))) opts.push(c);
    const order = rng.shuffle([0, ...rng.shuffle(opts.slice(1).map((_, i) => i + 1)).slice(0, 3)]);
    const options = order.map((i) => opts[i].text);
    const mistakes: Mistake[] = [];
    order.forEach((i, k) => {
      const o = opts[i];
      if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: k }, title: o.title, say: o.say });
    });
    return { answer: { kind: "choice" as const, options, correct: order.indexOf(0) }, mistakes };
  };
  const pick = tx("Factor out and simplify: which result is right?", "Klammere aus und kürze: Welches Ergebnis stimmt?");
  const opt = (list: Mono[]) => ({ value: polyPlain(list, ["x"]), text: `$${polySrc(list, ["x"])}$` });
  const SUMMAND = tx("Only one summand divided", "Nur einen Summanden geteilt");
  const UNCANCELLED = tx("Not cancelled yet", "Noch nicht gekürzt");
  if (kind === 0) {
    // (g·a·x + g·b) / g
    const g = rng.int(2, 6);
    const a = rng.int(1, 5);
    const b = nz(rng, 7);
    if (gcd(a, b) !== 1 && a !== 1) return fractionTask(rng);
    const num = polySrc([mono(g * a, 1), mono(g * b, 0)], ["x"]);
    const inner = polySrc([mono(a, 1), mono(b, 0)], ["x"]);
    const { answer, mistakes } = choose([
      opt([mono(a, 1), mono(b, 0)]),
      { ...opt([mono(a, 1), mono(g * b, 0)]), title: SUMMAND, say: tx(`The fraction bar divides the **whole** numerator. Factor out $${g}$ first: then $${g}$ cancels completely.`, `Der Bruchstrich teilt den **ganzen** Zähler. Klammere zuerst $${g}$ aus: Dann kürzt sich $${g}$ ganz weg.`) },
      { ...opt([mono(g * a, 1), mono(b, 0)]), title: SUMMAND, say: tx(`The fraction bar divides the **whole** numerator, so every summand gets divided by $${g}$.`, `Der Bruchstrich teilt den **ganzen** Zähler, also wird jeder Summand durch $${g}$ geteilt.`) },
      {
        value: polyPlain([mono(g * a, 1), mono(g * b, 0)], ["x"]),
        text: `$${g}(${inner})$`,
        title: UNCANCELLED,
        say: tx(`That's only the numerator with $${g}$ factored out. The fraction bar still divides by $${g}$: cancel it.`, `Das ist nur der Zähler, aus dem du $${g}$ ausgeklammert hast. Der Bruchstrich teilt aber noch durch $${g}$: Kürze noch durch $${g}$.`),
      },
    ]);
    return {
      instruction: pick,
      math: `\\frac{${num}}{${g}}`,
      answer,
      hint,
      solution: [
        { math: `\\frac{${num}}{${g}#d}`, note: tx(`Both terms of the numerator contain the factor $${g}$.`, `Beide Terme im Zähler enthalten den Faktor $${g}$.`) },
        { math: `\\frac{${g}#n (${inner})#br}{${g}#d}`, note: tx(`Factor out $${g}$: now it's a factor of the whole numerator.`, `Klammere $${g}$ aus: Jetzt ist sie Faktor des ganzen Zählers.`) },
        { math: `\\frac{\\strike{${g}#n} (${inner})#br}{\\strike{${g}#d}} = ${inner}`, note: tx(`Cancel $${g}$. Result: $${inner}$.`, `Kürze $${g}$. Ergebnis: $${inner}$.`) },
      ],
      mistakes,
    };
  }
  if (kind === 1) {
    // (c·a·x² + c·b·x) / (c·x)
    const c = rng.pick([1, 1, 2, 3, 4]);
    const a = rng.int(1, 4);
    const b = nz(rng, 9);
    const num = polySrc([mono(c * a, 2), mono(c * b, 1)], ["x"]);
    const den = monoSrc(mono(c, 1), ["x"], { first: true });
    const inner = polySrc([mono(a, 1), mono(b, 0)], ["x"]);
    const { answer, mistakes } = choose([
      opt([mono(a, 1), mono(b, 0)]),
      // ax + cbx shown combined (as a student would write it), and only when it isn't 0.
      ...(a + c * b !== 0 ? [{ ...opt([mono(a + c * b, 1)]), title: SUMMAND, say: tx(`You divided only the first summand by $${den}$. Factor out $${den}$ in the numerator first, then it cancels as a whole.`, `Du hast nur den ersten Summanden durch $${den}$ geteilt. Klammere im Zähler zuerst $${den}$ aus, dann kürzt es sich als Ganzes.`) }] : []),
      { ...opt([mono(c * a, 2), mono(b, 0)]), title: SUMMAND, say: tx(`You divided only the second summand by $${den}$. The fraction bar divides the **whole** numerator: factor out $${den}$ first.`, `Du hast nur den zweiten Summanden durch $${den}$ geteilt. Der Bruchstrich teilt den **ganzen** Zähler: Klammere zuerst $${den}$ aus.`) },
      ...(c > 1
        ? [{ ...opt([mono(a, 2), mono(b, 1)]), title: tx("Only the number cancelled", "Nur die Zahl gekürzt"), say: tx(`You cancelled only the $${c}$. The $x$ in the denominator is a factor of the numerator too: factor out $${den}$ and cancel it as a whole.`, `Du hast nur die $${c}$ gekürzt. Das $x$ im Nenner steckt auch als Faktor im Zähler: Klammere $${den}$ aus und kürze es als Ganzes.`) }]
        : []),
      {
        value: polyPlain([mono(c * a, 2), mono(c * b, 1)], ["x"]),
        text: `$${den}(${inner})$`,
        title: UNCANCELLED,
        say: tx(`That's only the numerator with $${den}$ factored out. The fraction bar still divides by $${den}$: cancel it.`, `Das ist nur der Zähler, aus dem du $${den}$ ausgeklammert hast. Der Bruchstrich teilt aber noch durch $${den}$: Kürze noch durch $${den}$.`),
      },
    ]);
    return {
      instruction: pick,
      text: tx("Assume $x \\ne 0$.", "Es gilt $x \\ne 0$."),
      math: `\\frac{${num}}{${den}}`,
      answer,
      hint,
      solution: [
        { math: `\\frac{${num}}{${den}}`, note: tx(`Both terms of the numerator contain $${den}$.`, `Beide Terme im Zähler enthalten $${den}$.`) },
        { math: `\\frac{${den} (${inner})}{${den}}`, note: tx(`Factor out $${den}$.`, `Klammere $${den}$ aus.`) },
        { math: `\\frac{\\strike{${den}} (${inner})}{\\strike{${den}}} = ${inner}`, note: tx(`Cancel $${den}$ (allowed because $x \\ne 0$). Result: $${inner}$.`, `Kürze $${den}$ (erlaubt, weil $x \\ne 0$). Ergebnis: $${inner}$.`) },
      ],
      mistakes,
    };
  }
  // (k·x + k·b) / (x + b) = k
  const k = rng.int(2, 9);
  const b = nz(rng, 6);
  const v = rng.pick(["x", "a"]);
  const den = polySrc([mono(1, 1), mono(b, 0)], [v]);
  const num = polySrc([mono(k, 1), mono(k * b, 0)], [v]);
  // Cancelling summand by summand (kx : x and kb : b) gives k + k.
  const mistakes: Mistake[] = [
    {
      when: { kind: "number", value: 2 * k },
      title: tx("Summands cancelled", "Summanden gekürzt"),
      say: tx(`You cancelled summand by summand. That's not allowed: only **factors** cancel. Factor out $${k}$ in the numerator first.`, `Du hast Summand für Summand gekürzt. Das ist nicht erlaubt: Kürzen darfst du nur **Faktoren**. Klammere zuerst im Zähler $${k}$ aus.`),
    },
  ];
  return {
    instruction,
    text: tx(`Assume $${v} \\ne ${-b}$.`, `Es gilt $${v} \\ne ${-b}$.`),
    math: `\\frac{${num}}{${den}}`,
    answer: { kind: "number", value: k },
    hint,
    solution: [
      { math: `\\frac{${num}}{${den}}`, note: tx(`Look at the numerator: both terms contain $${k}$.`, `Schau auf den Zähler: Beide Terme enthalten $${k}$.`) },
      { math: `\\frac{${k} \\hl{(${den})}}{\\hl{${den}}}`, note: tx(`Factor out $${k}$: the bracket is exactly the denominator.`, `Klammere $${k}$ aus: Die Klammer ist genau der Nenner.`) },
      { math: `\\frac{${k} \\strike{(${den})}}{\\strike{${den}}} = ${k}`, note: tx(`Cancel the whole bracket. Result: $${k}$.`, `Kürze die ganze Klammer. Ergebnis: $${k}$.`) },
    ],
    mistakes,
  };
}

/** Match terms and their factorised forms: the signs decide. */
function matchTask(rng: Rng): Exercise {
  const g = rng.int(2, 6);
  let a = rng.int(1, 5);
  let b = rng.int(1, 7);
  while (gcd(a, b) !== 1 || a === b) {
    a = rng.int(1, 5);
    b = rng.int(1, 7);
  }
  const v = rng.pick(["x", "a", "y"]);
  const P = (c1: number, e1: number, c0: number, e0: number) => polySrc([mono(c1, e1), mono(c0, e0)], [v]);
  const ax = monoSrc(mono(a, 1), [v], { first: true });
  const all: [string, string][] = [
    [P(g * a, 1, g * b, 0), `${g}(${ax} + ${b})`],
    [P(g * a, 1, -g * b, 0), `${g}(${ax} - ${b})`],
    [P(-g * a, 1, -g * b, 0), `-${g}(${ax} + ${b})`],
    [P(g * a, 2, g * b, 1), `${g}${v}(${ax} + ${b})`],
  ];
  const chosen = rng.shuffle([0, 1, 2, 3]).slice(0, 3).sort();
  const pairs = chosen.map((i) => [`$${all[i][0]}$`, `$${all[i][1]}$`] as [string, string]);
  const distractor = `$-${g}(${ax} - ${b})$`;
  const mistakes: Mistake[] = [];
  if (chosen.includes(2)) {
    mistakes.push({
      when: { kind: "match", pairs: [[`$${all[2][0]}$`, distractor]] },
      title: tx("Every sign flips", "Jedes Vorzeichen dreht sich"),
      say: tx(`Factoring out $-${g}$ flips **every** sign: $${-g * b} : (-${g}) = +${b}$.`, `Klammerst du $-${g}$ aus, dreht sich **jedes** Vorzeichen um: $${-g * b} : (-${g}) = +${b}$.`),
    });
  }
  if (chosen.includes(0) && chosen.includes(1)) {
    mistakes.push({
      when: { kind: "match", pairs: [[`$${all[0][0]}$`, `$${all[1][1]}$`]] },
      title: tx("Check the sign of the number", "Prüf das Vorzeichen der Zahl"),
      say: tx(`Expand to check: $${g}(${ax} - ${b}) = ${all[1][0]}$. The sign in the bracket is the sign of the number term.`, `Multiplizier zur Probe aus: $${g}(${ax} - ${b}) = ${all[1][0]}$. Das Vorzeichen in der Klammer ist das Vorzeichen der Zahl.`),
    });
  }
  if (chosen.includes(3) && chosen.includes(0)) {
    mistakes.push({
      when: { kind: "match", pairs: [[`$${all[3][0]}$`, `$${all[0][1]}$`]] },
      title: tx("A letter is missing", "Ein Buchstabe fehlt"),
      say: tx(`Expand to check: $${all[0][1]}$ gives $${all[0][0]}$, without $${v}^2$. In $${all[3][0]}$ every term also contains $${v}$.`, `Multiplizier zur Probe aus: $${all[0][1]}$ ergibt $${all[0][0]}$, ohne $${v}^2$. In $${all[3][0]}$ steckt in jedem Term auch noch $${v}$.`),
    });
  }
  return {
    instruction: tx("Match each term with its factorised form", "Ordne jedem Term seine ausgeklammerte Form zu"),
    text: tx("One form is left over.", "Eine Form bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [distractor] },
    hint: tx("Expand each form in your head and compare the signs.", "Multiplizier jede Form im Kopf aus und vergleiche die Vorzeichen."),
    solution: chosen.map((i) => ({ math: `${all[i][0]} = ${all[i][1]}`, note: tx(`Expand to check: $${all[i][1]} = ${all[i][0]}$.`, `Probe durch Ausmultiplizieren: $${all[i][1]} = ${all[i][0]}$.`) })),
    mistakes,
  };
}

/** Level 3 practice: factoring out in all its forms, and what it's good for. */
export function generate3(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.15) return gcfExercise(buildTerms(rng));
  if (r < 0.35) return bracketTask(rng);
  if (r < 0.48) return fullyTask(rng);
  if (r < 0.63) return commonBracketTask(rng);
  if (r < 0.77) return solveTask(rng);
  if (r < 0.89) return fractionTask(rng);
  return matchTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const basicsFrames: Frame[] = [
  { math: "6#a x#x +#p 15#b", note: tx("$6x$ and $15$: is there a number that goes into both?", "$6x$ und $15$: Gibt es eine Zahl, die in beiden steckt?") },
  { math: "3#g1 \\cdot#d1 2#a x#x +#p 3#g2 \\cdot#d2 5#b", note: tx("Yes, the $3$: $6x = 3 \\cdot 2x$ and $15 = 3 \\cdot 5$.", "Ja, die $3$: $6x = 3 \\cdot 2x$ und $15 = 3 \\cdot 5$."), highlight: ["g1", "g2"] },
  { math: "3#g1 (2#a x#x +#p 5#b)#br", note: tx("Put the common factor $3$ in front of a bracket. That's **factoring out**.", "Setz den gemeinsamen Faktor $3$ vor eine Klammer. Das ist **Ausklammern**."), highlight: ["br(", "br)"] },
  {
    math: "3#g1 (2#a x#x +#p 5#b)#br =#eq 6#a2 x#x2 +#p2 15#b2",
    note: tx("Expanding gives $6x + 15$ again. Factoring out is expanding **backwards**.", "Ausmultiplizieren ergibt wieder $6x + 15$. Ausklammern ist Ausmultiplizieren **rückwärts**."),
    arrows: [["g1", "a"], ["g1", "b"]],
  },
];

const xy = ["x", "y"];
const gcfFrames: Frame[] = [
  ...factorFrames([mono(6, 2, 1), mono(-9, 1, 2)], xy, mono(3, 1, 1)),
  {
    math: "\\red{3x(2xy - 3y^2)} \\quad 3xy(2x - 3y)",
    note: tx("Only $3x$ in front? Correct, but not finished: every term in the bracket still contains $y$. Always take the **greatest** common factor.", "Nur $3x$ davor? Richtig, aber nicht fertig: In jedem Term der Klammer steckt noch $y$. Nimm immer den **größten** gemeinsamen Faktor."),
  },
];

const negativeFrames: Frame[] = [
  { math: "-#s0 4#c0 x#x0 -#s1 8#c1", note: tx("Both terms are negative. Factor out $-4$, then the bracket starts with a plus.", "Beide Terme sind negativ. Klammere $-4$ aus, dann beginnt die Klammer mit Plus.") },
  {
    math: "(-#s0 4#g0)#p0 \\cdot#d0 x#x0 +#plus (-#s1 4#g1)#p1 \\cdot#d1 2#c1",
    note: tx("$-4x = (-4) \\cdot x$ and $-8 = (-4) \\cdot 2$.", "$-4x = (-4) \\cdot x$ und $-8 = (-4) \\cdot 2$."),
    highlight: ["g0", "g1", "s0", "s1"],
  },
  { math: "-#s0 4#g0 (x#x0 +#plus 2#c1)#br", note: tx("So $-4x - 8 = -4(x + 2)$. Dividing by $-4$ flipped the sign of the $8$.", "Also $-4x - 8 = -4(x + 2)$. Das Teilen durch $-4$ hat das Vorzeichen der $8$ umgedreht."), highlight: ["plus"] },
  { math: "-#n0 x#y0 +#n1 5#y1", note: tx("And a lone minus? In $-x + 5$, factor out $-1$.", "Und ein Minus ganz allein? Bei $-x + 5$ klammerst du $-1$ aus.") },
  { math: "-#n0 (x#y0 -#n1 5#y1)#br2", note: tx("Every sign in the bracket flips: $-x + 5 = -(x - 5)$. That's level 1 backwards!", "Jedes Vorzeichen in der Klammer dreht sich um: $-x + 5 = -(x - 5)$. Das ist Stufe 1 rückwärts!"), highlight: ["n0", "n1"] },
];

const bracketFrames: Frame[] = [
  { math: "3#a x#ax (a#b1 -#s1 2#c1)#B1 -#p 5#d (a#b2 -#s2 2#c2)#B2", note: tx("The bracket $(a - 2)$ is a factor in **both** terms.", "Die Klammer $(a - 2)$ ist Faktor in **beiden** Termen."), highlight: ["B1(", "B1)", "B2(", "B2)"] },
  { math: "(a#b1 -#s1 2#c1)#B1 (3#a x#ax -#p 5#d)#N", note: tx("Factor it out like a single letter, just as $3xz - 5z = z(3x - 5)$.", "Klammere sie aus wie einen einzelnen Buchstaben, genau wie $3xz - 5z = z(3x - 5)$.") },
  { math: "a#m1 x#x1 -#s1 3#c1 a#a1 +#p 2#m2 x#x2 -#s2 6#c2", note: tx("Four terms, but no factor is in all of them. Group them in pairs!", "Vier Terme, aber kein Faktor steckt in allen. Bilde Paare!") },
  {
    math: "a#m1 (x#x1 -#s1 3#c1)#B1 +#p 2#m2 (x#x2 -#s2 3#c2)#B2",
    note: tx("Factor $a$ out of the first pair and $2$ out of the second: $(x - 3)$ appears twice.", "Klammere aus dem ersten Paar $a$ aus und aus dem zweiten $2$: $(x - 3)$ steht zweimal da."),
    highlight: ["B1(", "B1)", "B2(", "B2)"],
  },
  { math: "(x#x1 -#s1 3#c1)#B1 (a#m1 +#p 2#m2)#N", note: tx("Now factor out the common bracket. That's **factoring by grouping**.", "Jetzt klammerst du die gemeinsame Klammer aus. Das ist **Ausklammern durch Gruppieren**.") },
];

const usesFrames: Frame[] = [
  { math: "\\frac{x#n1^{2#e} -#s 5#c x#n2}{x#d}", note: tx("Simplifying a fraction: you may only cancel **factors**, never parts of a sum.", "Einen Bruch kürzen: Kürzen darfst du nur **Faktoren**, nie Teile einer Summe.") },
  { math: "\\frac{x#f (x#n1 -#s 5#c)#br}{x#d}", note: tx("Factor out $x$ in the numerator. Now $x$ is a factor of the whole numerator.", "Klammere im Zähler $x$ aus. Jetzt ist $x$ Faktor des ganzen Zählers.") },
  { math: "\\frac{\\strike{x#f} (x#n1 -#s 5#c)#br}{\\strike{x#d}} =#eq x#r1 -#rs 5#r2", note: tx("Cancel $x$ (for $x \\ne 0$). Result: $x - 5$.", "Kürze $x$ (für $x \\ne 0$). Ergebnis: $x - 5$.") },
  { math: "x#n1^{2#e} -#s 5#c x#n2 =#eq 0#z", note: tx("An equation: don't divide by $x$, you would lose a solution! Factor out instead.", "Eine Gleichung: Teile nicht durch $x$, sonst verlierst du eine Lösung! Klammere lieber aus.") },
  { math: "x#f (x#n1 -#s 5#c)#br =#eq 0#z", note: tx("A product is $0$ exactly when one of its factors is $0$: the **zero product rule**.", "Ein Produkt ist genau dann $0$, wenn einer seiner Faktoren $0$ ist: der **Satz vom Nullprodukt**.") },
  {
    math: tx("x_1 = 0 \\quad x_2 = 5", "x_1 = 0 \\quad x_2 = 5 \\quad L = \\{ 0; 5 \\}"),
    note: tx("Either $x = 0$ or $x - 5 = 0$, so $x = 5$. Two solutions!", "Entweder $x = 0$ oder $x - 5 = 0$, also $x = 5$. Zwei Lösungen!"),
  },
];

const twoX: Built = { vars: ["a"], G: mono(6, 2), q: [mono(2, 1), mono(-3, 0)], terms: [mono(12, 3), mono(-18, 2)] };

function groupingCheck(): Exercise {
  const value = "x+2";
  const m = exprMistakes(value);
  m.add("x-2", tx("Sign of the second pair", "Vorzeichen beim zweiten Paar"), tx("Expand to check: $(y + 3)(x - 2)$ gives $-2y - 6$, but the term has $+2y + 6$.", "Multiplizier zur Probe aus: $(y + 3)(x - 2)$ ergibt $-2y - 6$, im Term steht aber $+2y + 6$."));
  m.add("2x", tx("Added, not multiplied", "Addieren, nicht multiplizieren"), tx("After grouping you have $x(y + 3) + 2(y + 3)$. The factors in front are added: $(y + 3)(x + 2)$.", "Nach dem Gruppieren hast du $x(y + 3) + 2(y + 3)$. Die Faktoren davor werden addiert: $(y + 3)(x + 2)$."));
  m.add("xy+3x+2y+6", tx("Only the bracket", "Nur die Klammer"), tx("Type only what goes into the second bracket. $(y + 3)$ is already there.", "Gib nur ein, was in die zweite Klammer kommt. $(y + 3)$ steht schon da."));
  return {
    instruction: tx("Factor by grouping", "Klammere durch Gruppieren aus"),
    math: "\\group{xy} + \\group{3x} + \\group{2y} + 6 \\group{= (y + 3)(\\,\\box{\\,?\\,}\\,)}",
    answer: { kind: "expr", value },
    hint: tx("Pair $xy + 3x$ and $2y + 6$. What can you factor out of each pair?", "Bilde die Paare $xy + 3x$ und $2y + 6$. Was kannst du aus jedem Paar ausklammern?"),
    solution: [
      { math: "(xy#t1 +#p1 3#t2c x#t2)#g1 +#p (2#t3c y#t3 +#p3 6#t4)#g2", note: tx("Group the terms in pairs.", "Fasse die Terme paarweise zusammen.") },
      { math: "x#t2 (y#t1 +#p1 3#t2c)#B1 +#p 2#t3c (y#t3 +#p3 3#t4)#B2", note: tx("Factor $x$ out of the first pair and $2$ out of the second.", "Klammere aus dem ersten Paar $x$ aus und aus dem zweiten $2$."), highlight: ["B1(", "B1)", "B2(", "B2)"] },
      { math: "(y#t1 +#p1 3#t2c)#B1 (x#t2 +#p 2#t3c)#N", note: tx("Factor out the common bracket $(y + 3)$. In the second bracket: $x + 2$.", "Klammere die gemeinsame Klammer $(y + 3)$ aus. In der zweiten Klammer: $x + 2$.") },
    ],
    mistakes: m.list,
  };
}

function solveCheck(): Exercise {
  return {
    instruction: tx("Solve by factoring out", "Löse durch Ausklammern"),
    math: "2x^2 - 8x = 0",
    answer: { kind: "solutions", variable: "x", values: [0, 4] },
    hint: tx("Factor out $2x$. When is a product $0$?", "Klammere $2x$ aus. Wann ist ein Produkt $0$?"),
    solution: [
      { math: "2#a x#x1^{2#e} -#s 8#b x#x2 =#eq 0#z", note: tx("Don't divide by $x$! Factor out $2x$.", "Nicht durch $x$ teilen! Klammere $2x$ aus.") },
      { math: "2#a x#x1 (x#x2 -#s 4#b)#br =#eq 0#z", note: tx("$2x^2 : 2x = x$ and $-8x : 2x = -4$.", "$2x^2 : 2x = x$ und $-8x : 2x = -4$.") },
      { math: tx('2x = 0 \\quad "or" \\quad x - 4 = 0', '2x = 0 \\quad "oder" \\quad x - 4 = 0'), note: tx("Zero product rule: one of the factors must be $0$.", "Satz vom Nullprodukt: Einer der Faktoren muss $0$ sein.") },
      { math: tx("x_1 = 0 \\quad x_2 = 4", "x_1 = 0 \\quad x_2 = 4 \\quad L = \\{ 0; 4 \\}"), note: tx("Two solutions: $x = 0$ and $x = 4$.", "Zwei Lösungen: $x = 0$ und $x = 4$.") },
    ],
    mistakes: [
      { when: { kind: "solutions", variable: "x", values: [4] }, title: tx("Lost x = 0", "x = 0 verloren"), say: tx("Did you divide by $x$? That throws away $x = 0$. With $2x(x - 4) = 0$ you see both solutions.", "Hast du durch $x$ geteilt? Dabei geht $x = 0$ verloren. Bei $2x(x - 4) = 0$ siehst du beide Lösungen.") },
      { when: { kind: "solutions", variable: "x", values: [0, 8] }, title: tx("Forgot to divide", "Teilen vergessen"), say: tx("From $2x - 8 = 0$ you get $x = 4$, not $8$. Or factor out $2x$ right away.", "Aus $2x - 8 = 0$ folgt $x = 4$, nicht $8$. Oder klammere gleich $2x$ aus.") },
      { when: { kind: "solutions", variable: "x", values: [0, -4] }, title: tx("Sign of the second solution", "Vorzeichen der zweiten Lösung"), say: tx("$x - 4 = 0$ gives $x = +4$.", "$x - 4 = 0$ ergibt $x = +4$.") },
    ],
  };
}

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Factoring out: expanding backwards", "Ausklammern: Ausmultiplizieren rückwärts"),
      blob: tx("You know how to get rid of brackets. Now we put them back on purpose!", "Klammern auflösen kannst du. Jetzt setzen wir sie absichtlich wieder!"),
      body: tx(
        "**Factoring out** turns a sum into a product: a factor that is in **every** term goes in front of a bracket. It's the distributive law read from right to left.",
        "**Ausklammern** macht aus einer Summe ein Produkt: Ein Faktor, der in **jedem** Term steckt, kommt vor eine Klammer. Das ist das Distributivgesetz, von rechts nach links gelesen.",
      ),
      frames: basicsFrames,
    },
    {
      type: "explain",
      title: tx("The greatest common factor", "Der größte gemeinsame Faktor"),
      blob: tx("Numbers, letters, powers: we take out as much as we can!", "Zahlen, Buchstaben, Potenzen: Wir klammern so viel aus, wie geht!"),
      body: tx(
        "Take the greatest common divisor of the numbers (gcd) and every letter that is in **all** terms, each with its **smallest** exponent. Then divide every term by this factor.",
        "Nimm den größten gemeinsamen Teiler (ggT) der Zahlen und jeden Buchstaben, der in **allen** Termen steckt, jeweils mit dem **kleinsten** Exponenten. Dann teilst du jeden Term durch diesen Faktor.",
      ),
      frames: gcfFrames,
    },
    {
      type: "widget",
      title: tx("Build the greatest common factor", "Baue den größten gemeinsamen Faktor"),
      blob: tx("Your turn to build. Can you make the bracket as small as possible?", "Jetzt baust du. Schaffst du es, die Klammer so klein wie möglich zu machen?"),
      body: tx(
        "Choose the number, the sign and the power of each letter for the factor in front. If the factor doesn't fit into a term, that term turns red. The goal: a bracket with no common factor left.",
        "Wähl für den Faktor davor die Zahl, das Vorzeichen und den Exponenten jedes Buchstabens. Passt der Faktor in einen Term nicht hinein, wird dieser Term rot. Das Ziel: eine Klammer ohne gemeinsamen Faktor.",
      ),
      widget: FactorFinder,
    },
    {
      type: "check",
      blob: tx("Numbers and powers: find the biggest factor!", "Zahlen und Potenzen: Finde den größten Faktor!"),
      exercise: gcfExercise(twoX),
    },
    {
      type: "explain",
      title: tx("Factoring out a minus", "Ein Minus ausklammern"),
      blob: tx("Remember level 1? A minus in front of a bracket flips every sign. That works backwards too!", "Weißt du noch, Stufe 1? Ein Minus vor der Klammer dreht jedes Vorzeichen um. Das klappt auch rückwärts!"),
      body: tx(
        "If the first term is negative, factor out a **negative** factor. Dividing by a negative number flips **every** sign in the bracket.",
        "Ist der erste Term negativ, klammerst du einen **negativen** Faktor aus. Durch eine negative Zahl teilen dreht **jedes** Vorzeichen in der Klammer um.",
      ),
      frames: negativeFrames,
    },
    {
      type: "check",
      blob: tx("Minus outside, so every sign inside flips.", "Minus draußen, also dreht sich jedes Vorzeichen drinnen um."),
      exercise: bracketExercise([mono(-6, 1), mono(15, 0)], ["x"], mono(-3, 0)),
    },
    {
      type: "explain",
      title: tx("A bracket as the common factor", "Eine Klammer als gemeinsamer Faktor"),
      blob: tx("Sometimes the common factor is a whole bracket. Treat it like a single letter!", "Manchmal ist der gemeinsame Faktor eine ganze Klammer. Behandle sie wie einen einzelnen Buchstaben!"),
      body: tx(
        "A bracket that appears in every term can be factored out as a whole. With four terms and no common factor, **group** them in pairs first: then a common bracket often appears.",
        "Eine Klammer, die in jedem Term vorkommt, kannst du als Ganzes ausklammern. Bei vier Termen ohne gemeinsamen Faktor bildest du zuerst **Paare**: Dann taucht oft eine gemeinsame Klammer auf.",
      ),
      frames: bracketFrames,
    },
    {
      type: "widget",
      title: tx("Factoring by grouping: pair up the terms", "Ausklammern durch Gruppieren: Paare bilden"),
      blob: tx("Pick the partners. Some pairs work, some don't. Find out which!", "Such die Partner aus. Manche Paare klappen, manche nicht. Find heraus, welche!"),
      body: tx(
        "Choose a partner for the first term. Each pair gets its own factor out. If the same bracket appears in both pairs, you can factor it out and the term becomes a product.",
        "Wähl einen Partner für den ersten Term. Aus jedem Paar wird ein Faktor ausgeklammert. Taucht in beiden Paaren dieselbe Klammer auf, klammerst du sie aus, und der Term wird zum Produkt.",
      ),
      widget: GroupingPuzzle,
    },
    {
      type: "check",
      blob: tx("Four terms, two pairs, one common bracket.", "Vier Terme, zwei Paare, eine gemeinsame Klammer."),
      exercise: groupingCheck(),
    },
    {
      type: "explain",
      title: tx("What factoring out is good for", "Wofür Ausklammern gut ist"),
      blob: tx("Factoring out is a superpower: it simplifies fractions and solves equations!", "Ausklammern ist eine Superkraft: Es kürzt Brüche und löst Gleichungen!"),
      body: tx(
        "In a fraction you may only cancel **factors**. Factoring out turns a sum into a product, and then you can cancel. In an equation with $0$ on one side, a product helps too: it is $0$ exactly when one factor is $0$.",
        "In einem Bruch darfst du nur **Faktoren** kürzen. Ausklammern macht aus einer Summe ein Produkt, und dann kannst du kürzen. Bei einer Gleichung mit $0$ auf einer Seite hilft ein Produkt auch: Es ist genau dann $0$, wenn ein Faktor $0$ ist.",
      ),
      frames: usesFrames,
    },
    {
      type: "check",
      blob: tx("Last one! How many solutions do you find?", "Die letzte! Wie viele Lösungen findest du?"),
      exercise: solveCheck(),
    },
  ],
  summary: [
    {
      title: tx("Factoring out", "Ausklammern"),
      body: tx("Expanding backwards: a factor that is in every term goes in front of the bracket.", "Ausmultiplizieren rückwärts: Ein Faktor, der in jedem Term steckt, kommt vor die Klammer."),
      examples: ["6x + 15 = 3(2x + 5)"],
      tone: "rule",
    },
    {
      title: tx("Greatest common factor", "Größter gemeinsamer Faktor"),
      body: tx("The gcd of the numbers and every common letter with its **smallest** exponent. Check by expanding.", "Der ggT der Zahlen und jeder gemeinsame Buchstabe mit dem **kleinsten** Exponenten. Probe durch Ausmultiplizieren."),
      examples: ["6x^2y - 9xy^2 = 3xy(2x - 3y)", "12a^3 - 18a^2 = 6a^2(2a - 3)"],
      tone: "rule",
    },
    {
      title: tx("Negative factor", "Negativer Faktor"),
      body: tx("Factoring out a minus flips **every** sign in the bracket.", "Ein ausgeklammertes Minus dreht **jedes** Vorzeichen in der Klammer um."),
      examples: ["-4x - 8 = -4(x + 2)", "-x + 5 = -(x - 5)"],
      tone: "rule",
    },
    {
      title: tx("Common bracket and grouping", "Gemeinsame Klammer und Gruppieren"),
      body: tx("Treat a common bracket like a letter. Four terms: make pairs, factor each pair, then factor out the common bracket.", "Behandle eine gemeinsame Klammer wie einen Buchstaben. Vier Terme: Paare bilden, jedes Paar ausklammern, dann die gemeinsame Klammer ausklammern."),
      examples: ["3x(a - 2) - 5(a - 2) = (a - 2)(3x - 5)", "ax - 3a + 2x - 6 = (x - 3)(a + 2)"],
      tone: "tip",
    },
    {
      title: tx("Fractions and equations", "Brüche und Gleichungen"),
      body: tx("Factor out, then cancel factors. For $= 0$: factor out and use the zero product rule.", "Ausklammern, dann Faktoren kürzen. Bei $= 0$: ausklammern und den Satz vom Nullprodukt nutzen."),
      examples: ["\\frac{x^2 - 5x}{x} = x - 5", "x^2 - 5x = 0 \\Rightarrow x(x - 5) = 0 \\Rightarrow x_1 = 0, \\; x_2 = 5"],
      tone: "tip",
    },
    {
      title: tx("Don't lose anything", "Nichts verlieren"),
      body: tx("A term that equals the factor leaves a $1$. Never divide an equation by $x$: you'd lose $x = 0$.", "Ein Term, der gleich dem Faktor ist, hinterlässt eine $1$. Teile eine Gleichung nie durch $x$: Dann verlierst du $x = 0$."),
      examples: ["3x^2 + x = x(3x + 1)", "\\frac{x + 6}{6} \\ne x + 1"],
      tone: "warning",
    },
  ],
};
