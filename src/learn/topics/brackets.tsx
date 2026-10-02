"use client";

import { motion } from "motion/react";
import { Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import { showTerms, type Term } from "@/learn/engine/terms";
import { equivalentText } from "@/learn/engine/expr";
import type { Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// A small model of sums with brackets, rendered with stable token keys so each
// term glides to its new place when a bracket is removed.

type Item =
  | { kind: "t"; c: number; v: string; id: string; sk?: string }
  | { kind: "g"; sign: 1 | -1; open: "(" | "["; id: string; items: Item[]; sk?: string };

const term = (id: string, c: number, v = ""): Item => ({ kind: "t", c, v, id });
const group = (id: string, sign: 1 | -1, items: Item[], open: "(" | "[" = "("): Item => ({ kind: "g", sign, open, id, items });

/** Display-language source with keys: sign `s<id>`, coefficient `c<id>`, variable `v<id>`, bracket `b<id>`. */
export function render(items: Item[], keys = true): string {
  const k = (key: string) => (keys ? `#${key}` : "");
  if (items.length === 0) return "0";
  return items
    .map((it, i) => {
      const first = i === 0;
      if (it.kind === "t") {
        const sk = it.sk ?? `s${it.id}`;
        const sign = it.c < 0 ? `-${k(sk)}${first && !keys ? "" : " "}` : first ? "" : `+${k(sk)} `;
        const abs = Math.abs(it.c);
        const coef = it.v && abs === 1 ? "" : `${abs}${k(`c${it.id}`)}`;
        const v = it.v ? `${it.v}${k(`v${it.id}`)}` : "";
        return `${sign}${[coef, v].filter(Boolean).join(keys ? " " : "")}`;
      }
      const sk = it.sk ?? `p${it.id}`;
      const sign = it.sign < 0 ? `-${k(sk)}${first && !keys ? "" : " "}` : first ? "" : `+${k(sk)} `;
      const close = it.open === "(" ? ")" : "]";
      return `${sign}${it.open}${render(it.items, keys)}${close}${k(`b${it.id}`)}`;
    })
    .join(" ");
}

/** Plain text without keys, for notes and answers. */
const plain = (items: Item[]) => render(items, false);

function flip(it: Item, sign: 1 | -1): Item {
  if (sign === 1) return it;
  return it.kind === "t" ? { ...it, c: -it.c } : { ...it, sign: (it.sign * -1) as 1 | -1 };
}

/** Remove the bracket with id `gid`. The sign in front of it is handed to the first term inside. */
function flatten(items: Item[], gid: string): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (it.kind === "g" && it.id === gid) {
      it.items.forEach((inner, j) => {
        const next = flip(inner, it.sign);
        out.push(j === 0 ? { ...next, sk: it.sk ?? `p${it.id}` } : next);
      });
    } else if (it.kind === "g") out.push({ ...it, items: flatten(it.items, gid) });
    else out.push(it);
  }
  return out;
}

/** Keys of signs that flip when bracket `gid` is removed. */
function flippedKeys(items: Item[], gid: string): string[] {
  for (const it of items) {
    if (it.kind !== "g") continue;
    if (it.id === gid) {
      if (it.sign === 1) return [];
      return it.items.map((inner, j) => (j === 0 ? (it.sk ?? `p${it.id}`) : inner.kind === "t" ? (inner.sk ?? `s${inner.id}`) : (inner.sk ?? `p${inner.id}`)));
    }
    const deeper = flippedKeys(it.items, gid);
    if (deeper.length) return deeper;
  }
  return [];
}

const terms = (items: Item[]) => items.filter((x): x is Extract<Item, { kind: "t" }> => x.kind === "t");

/** Like terms next to each other, in order of first appearance. */
function sortLike(items: Item[]): Item[] {
  const order: string[] = [];
  for (const x of terms(items)) if (!order.includes(x.v)) order.push(x.v);
  return [...terms(items)].sort((a, b) => order.indexOf(a.v) - order.indexOf(b.v));
}

/** Add up like terms; the first term of each kind keeps its keys so it morphs into the sum. */
function combineLike(items: Item[]): Item[] {
  const out: Extract<Item, { kind: "t" }>[] = [];
  for (const x of sortLike(items) as Extract<Item, { kind: "t" }>[]) {
    const prev = out.find((o) => o.v === x.v);
    if (prev) prev.c += x.c;
    else out.push({ ...x });
  }
  return out.filter((x) => x.c !== 0);
}

/** "$4x + 2x = 6x$ and $-7 + 2 = -5$" for every kind that actually gets combined. */
function combineNote(items: Item[], and = " and "): string {
  const parts: string[] = [];
  const kinds = new Map<string, Term[]>();
  for (const x of terms(items)) kinds.set(x.v, [...(kinds.get(x.v) ?? []), { c: x.c, v: x.v }]);
  for (const [v, list] of kinds) {
    if (list.length < 2) continue;
    const sum = list.reduce((s, x) => s + x.c, 0);
    parts.push(`$${showTerms(list)} = ${showTerms([{ c: sum, v }], { keepZero: true })}$`);
  }
  return parts.join(and);
}

function samePlaces(a: Item[], b: Item[]) {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id);
}

function groupsInside(items: Item[]): Extract<Item, { kind: "g" }>[] {
  const out: Extract<Item, { kind: "g" }>[] = [];
  for (const it of items) if (it.kind === "g") out.push(it, ...groupsInside(it.items));
  return out;
}

/** Innermost bracket first (one without brackets inside), left to right. */
function nextGroup(items: Item[]) {
  return groupsInside(items).find((g) => !g.items.some((x) => x.kind === "g"));
}

/** Combine like terms inside every bracket that has no brackets left (for nested tasks). */
function tidyInside(items: Item[]): Item[] {
  return items.map((it) => {
    if (it.kind !== "g") return it;
    if (it.items.some((x) => x.kind === "g")) return { ...it, items: tidyInside(it.items) };
    return { ...it, items: combineLike(it.items) };
  });
}

/** The full worked solution: remove brackets inside-out, sort, combine. */
export function solve(start: Item[]): { frames: Frame[]; result: Item[] } {
  const frames: Frame[] = [];
  const push = (f: Frame) => {
    const last = frames[frames.length - 1];
    // The opening frame and the first bracket's frame show the same picture: merge them.
    // (Later frames keep their own notes, e.g. "tidy up inside the bracket first".)
    if (frames.length === 1 && last.math === f.math && !last.highlight && !last.arrows) frames[0] = { ...f, note: f.note ?? last.note };
    else frames.push(f);
  };
  let cur = start;
  frames.push({ math: render(cur), note: tx("Look at the sign **in front of** each bracket.", "Schau, welches Zeichen **vor** jeder Klammer steht.") });
  for (let g = nextGroup(cur); g; g = nextGroup(cur)) {
    const flips = flippedKeys(cur, g.id);
    const what = g.open === "[" ? "square bracket" : "bracket";
    const was = g.open === "[" ? "eckigen Klammer" : "Klammer";
    push({
      math: render(cur),
      highlight: [`p${g.id}`, g.sk ?? "", `b${g.id}(`, `b${g.id})`].filter(Boolean),
      note:
        g.sign === 1
          ? tx(`A **plus** (or nothing) in front of this ${what}, so the signs stay.`, `Vor dieser ${was} steht ein **Plus** (oder nichts), also bleiben die Vorzeichen.`)
          : tx(`A **minus** in front of this ${what}: every sign inside flips.`, `Vor dieser ${was} steht ein **Minus**: Jedes Vorzeichen darin dreht sich um.`),
    });
    cur = flatten(cur, g.id);
    frames.push({
      math: render(cur),
      highlight: flips,
      note:
        g.sign === 1
          ? tx("Drop the brackets. Nothing else changes.", "Lass die Klammern weg. Sonst ändert sich nichts.")
          : tx("Drop the brackets and flip: $+$ becomes $-$, $-$ becomes $+$.", "Lass die Klammern weg und dreh die Vorzeichen um: Aus $+$ wird $-$, aus $-$ wird $+$."),
    });
    const messy = groupsInside(cur).find((x) => !x.items.some((y) => y.kind === "g") && combineLike(x.items).length < x.items.length);
    if (messy) {
      const note = txMap((t) => `${t("Tidy up inside the bracket first:", "Fasse zuerst in der Klammer zusammen:")} ${combineNote(messy.items, t(" and ", " und "))}.`);
      cur = tidyInside(cur);
      frames.push({ math: render(cur), note });
    }
  }
  const sorted = sortLike(cur);
  if (!samePlaces(sorted, cur)) {
    frames.push({ math: render(sorted), note: tx("Put like terms next to each other. Each term takes its sign along.", "Stell gleichartige Terme nebeneinander. Jeder Term nimmt sein Vorzeichen mit.") });
    cur = sorted;
  }
  const result = combineLike(cur);
  if (result.length < cur.length) {
    const sums = (and: string) => combineNote(cur, and);
    frames.push({ math: render(result), note: tx(`Combine like terms: ${sums(" and ")}. Done!`, `Fasse gleichartige Terme zusammen: ${sums(" und ")}. Fertig!`) });
  } else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: txMap((t, locale) => `${resolveText(last.note, locale)} ${t("That's the result.", "Das ist das Ergebnis.")}`) };
  }
  return { frames, result };
}

// ---------------------------------------------------------------------------
// Exercise generator

const LETTERS = ["x", "x", "x", "a", "y", "b", "n"];

function coef(rng: Rng, max = 9) {
  return rng.nonZero(-max, max);
}

const INSTRUCTION = tx("Remove the brackets and simplify", "Löse die Klammern auf und fasse zusammen");

/** Remove bracket `gid` the way a student with a misconception would. */
function flattenWrong(items: Item[], gid: string, mode: "firstOnly" | "noFlip"): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (it.kind === "g" && it.id === gid) {
      it.items.forEach((inner, j) => out.push(it.sign === -1 && mode === "firstOnly" && j === 0 ? flip(inner, -1) : inner));
    } else if (it.kind === "g") out.push({ ...it, items: flattenWrong(it.items, gid, mode) });
    else out.push(it);
  }
  return out;
}

/** The result a student gets with that misconception. */
function wrongResult(start: Item[], mode: "firstOnly" | "noFlip"): string {
  let cur = start;
  for (let g = nextGroup(cur); g; g = nextGroup(cur)) cur = flattenWrong(cur, g.id, mode);
  return plain(combineLike(cur)).replace(/\s+/g, "") || "0";
}

const hasMinusGroup = (items: Item[]): boolean => items.some((it) => it.kind === "g" && (it.sign === -1 || hasMinusGroup(it.items)));

/** Typical slips with a minus in front of a bracket, worked out for this task. */
function bracketMistakes(items: Item[], right: string): Mistake[] {
  if (!hasMinusGroup(items)) return [];
  const out: Mistake[] = [];
  const add = (value: string, title: Text, say: Text) => {
    if (equivalentText(value, right) || out.some((m) => m.when.kind === "expr" && equivalentText(m.when.value, value))) return;
    out.push({ when: { kind: "expr", value }, title, say });
  };
  add(
    wrongResult(items, "firstOnly"),
    tx("Only the first sign flipped", "Nur das erste Vorzeichen gedreht"),
    tx(
      "Ah, I see what happened! You flipped the first sign, but a minus in front of a bracket flips **every** sign inside, the last one too.",
      "Ah, ich seh, was passiert ist! Du hast das erste Vorzeichen umgedreht, aber ein Minus vor der Klammer dreht **jedes** Vorzeichen darin um, auch das letzte.",
    ),
  );
  add(
    wrongResult(items, "noFlip"),
    tx("The minus got ignored", "Minus übersehen"),
    tx(
      "Looks like you just dropped the brackets. But there's a minus in front! Then every sign inside has to flip.",
      "Sieht so aus, als hättest du die Klammern einfach weggelassen. Aber davor steht ein Minus! Dann dreht sich jedes Vorzeichen in der Klammer um.",
    ),
  );
  return out;
}

function exercise(items: Item[], hint: Text): Exercise {
  const { frames, result } = solve(items);
  const value = plain(result).replace(/\s+/g, "") || "0";
  return {
    instruction: INSTRUCTION,
    math: plain(items),
    answer: { kind: "expr", value, form: "simplified" },
    hint,
    solution: frames,
    mistakes: bracketMistakes(items, value),
  };
}

function level1(rng: Rng): Exercise {
  const v = rng.pick(LETTERS);
  const sign: 1 | -1 = rng.chance(0.7) ? -1 : 1;
  const a = rng.int(2, 9);
  const b = rng.int(1, 9);
  const c = coef(rng);
  const shape = rng.int(0, 2);
  let items: Item[];
  if (shape === 0) items = [term("a", a, v), group("g", sign, [term("b", b, v), term("c", c)])];
  else if (shape === 1) items = [term("a", rng.int(5, 20)), group("g", sign, [term("b", b, v), term("c", c)])];
  else items = [term("a", a, v), group("g", sign, [term("c", coef(rng)), term("b", rng.sign() * b, v)])];
  const hint =
    sign === 1
      ? tx("A plus in front: you can simply leave the brackets out.", "Plus vor der Klammer: Du kannst die Klammern einfach weglassen.")
      : tx("A minus in front flips **every** sign inside the bracket.", "Ein Minus vor der Klammer dreht **jedes** Vorzeichen in der Klammer um.");
  return exercise(items, hint);
}

function level2(rng: Rng): Exercise {
  const v = rng.pick(LETTERS);
  const shape = rng.int(0, 2);
  let items: Item[];
  if (shape === 0) {
    items = [group("g", 1, [term("a", rng.int(2, 9), v), term("b", coef(rng))]), group("h", -1, [term("c", rng.int(1, 9), v), term("d", coef(rng))])];
  } else if (shape === 1) {
    items = [term("k", rng.int(4, 25)), group("g", -1, [term("a", rng.int(1, 9), v), term("b", coef(rng))]), group("h", rng.chance(0.5) ? 1 : -1, [term("c", rng.int(1, 9), v), term("d", coef(rng))])];
  } else {
    items = [term("k", rng.int(2, 9), v), group("g", -1, [term("a", rng.int(1, 9)), term("b", coef(rng), v)]), group("h", -1, [term("c", rng.int(1, 9), v), term("d", coef(rng))])];
  }
  return exercise(items, tx("Take one bracket at a time and look at the sign right in front of it.", "Nimm dir eine Klammer nach der anderen vor und schau auf das Zeichen direkt davor."));
}

function level3(rng: Rng): Exercise {
  if (rng.chance(0.6)) {
    // nested: k ± [a·v − (b ± c·v)]
    const v = rng.pick(LETTERS);
    const items: Item[] = [
      term("k", rng.int(5, 30)),
      group(
        "o",
        -1,
        [term("a", rng.int(1, 9), v), group("i", rng.chance(0.8) ? -1 : 1, [term("b", rng.int(1, 12)), term("c", coef(rng), v)])],
        "[",
      ),
    ];
    if (rng.chance(0.4)) items.push(term("m", coef(rng), v));
    return exercise(items, tx("Nested brackets: start with the **innermost** one and work your way out.", "Verschachtelte Klammern: Fang mit der **innersten** an und arbeite dich nach außen vor."));
  }
  // two variables
  const [p, q] = rng.pick([
    ["a", "b"],
    ["x", "y"],
    ["m", "n"],
  ]);
  const items: Item[] = [
    group("g", 1, [term("a", rng.int(2, 9), p), term("b", coef(rng), q)]),
    group("h", -1, [term("c", rng.int(1, 9), p), term("d", coef(rng), q), term("e", coef(rng))]),
    term("k", coef(rng), q),
  ];
  return exercise(items, tx(`Only like terms go together: ${p}-terms with ${p}-terms, ${q}-terms with ${q}-terms.`, `Nur gleichartige Terme gehören zusammen: ${p}-Terme zu ${p}-Termen, ${q}-Terme zu ${q}-Termen.`));
}

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const ex = level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
    // Avoid trivial results (everything cancels) and very long answers.
    const value = ex.answer.kind === "expr" ? ex.answer.value : "";
    if (/[a-z]/.test(value) && value.length <= 14) return ex;
  }
  return level1(rng);
}

// ---------------------------------------------------------------------------
// Interactive: flip the sign in front of the bracket.

const FLIP_EXAMPLES: Item[][] = [
  [term("a", 3, "x"), group("g", 1, [term("b", 2, "x"), term("c", -5)])],
  [term("a", 9), group("g", 1, [term("b", -4, "a"), term("c", 6)])],
  [term("a", 5, "y"), group("g", 1, [term("b", 1, "y"), term("c", 8), term("d", -3, "x")])],
];

function SignFlipper() {
  const t = useText();
  const scope = useId();
  const [sign, setSign] = useState<1 | -1>(-1);
  const [n, setN] = useState(0);
  const base = FLIP_EXAMPLES[n % FLIP_EXAMPLES.length];
  const start = base.map((it) => (it.kind === "g" ? { ...it, sign } : it));
  const flat = flatten(start, "g");
  const result = combineLike(flat);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-2">{t(tx("Sign in front of the bracket:", "Zeichen vor der Klammer:"))}</span>
        {([1, -1] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSign(s)}
            className={
              "relative grid h-9 w-12 place-items-center rounded-lg border text-[20px] font-semibold transition-colors " +
              (sign === s ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")
            }
          >
            {sign === s && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{s === 1 ? "+" : "−"}</span>
          </button>
        ))}
        <button onClick={() => setN((x) => x + 1)} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another example", "Anderes Beispiel"))}
        </button>
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
        <Row label={t(tx("With brackets", "Mit Klammern"))}>
          <MathView src={render(start)} size="lg" scope={`${scope}-a`} highlight={["pg", "bg(", "bg)"]} />
        </Row>
        <Row label={t(tx("Without", "Ohne"))}>
          <MathView src={render(flat)} size="lg" scope={`${scope}-b`} highlight={sign === -1 ? flippedKeys(start, "g") : []} />
        </Row>
        <Row label={t(tx("Simplified", "Vereinfacht"))}>
          <MathView src={render(result)} size="lg" scope={`${scope}-c`} />
        </Row>
      </div>
      <p className="text-[13.5px] text-ink-2">
        {sign === 1
          ? t(tx("With a plus, the brackets just disappear. Every sign stays as it is.", "Bei einem Plus verschwinden die Klammern einfach. Jedes Vorzeichen bleibt, wie es ist."))
          : t(tx("With a minus, every highlighted sign flips. Toggle back and forth to see it.", "Bei einem Minus dreht sich jedes markierte Vorzeichen um. Schalte hin und her, um es zu sehen."))}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-5 gap-y-1">
      <span className="w-full shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:w-28">{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

const plusFrames: Frame[] = [
  { math: "4#a x#ax +#p (2#b x#bx -#q 7#c)#g", note: tx("A **plus** sits in front of the bracket.", "Vor der Klammer steht ein **Plus**."), highlight: ["p", "g(", "g)"] },
  { math: "4#a x#ax +#p 2#b x#bx -#q 7#c", note: tx("So the brackets can simply go. Every sign stays.", "Also können die Klammern einfach weg. Alle Vorzeichen bleiben.") },
  { math: "\\hl{4#a x#ax +#p 2#b x#bx} -#q 7#c", note: tx("Now combine the like terms: $4x + 2x = 6x$.", "Jetzt fasst du die gleichartigen Terme zusammen: $4x + 2x = 6x$.") },
  { math: "6#a x#ax -#q 7#c", note: tx("That's it: $4x + (2x - 7) = 6x - 7$.", "Fertig: $4x + (2x - 7) = 6x - 7$.") },
];

const minusFrames: Frame[] = [
  {
    math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g",
    note: tx("Now a **minus** in front. It means: take away the **whole** bracket.", "Jetzt steht ein **Minus** davor. Das heißt: Du ziehst die **ganze** Klammer ab."),
    highlight: ["m"],
  },
  {
    math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g",
    note: tx("It hits **every** term inside: the $3x$ and the $-5$.", "Es trifft **jeden** Term in der Klammer: die $3x$ und die $-5$."),
    arrows: [["m", "b"], ["m", "c"]],
  },
  {
    math: "7#a x#ax -#m 3#b x#bx +#s 5#c",
    note: tx(
      "Drop the brackets and flip each sign: $+3x$ becomes $-3x$, and $-5$ becomes $+5$.",
      "Lass die Klammern weg und dreh jedes Vorzeichen um: Aus $+3x$ wird $-3x$ und aus $-5$ wird $+5$.",
    ),
    highlight: ["m", "s"],
  },
  { math: "4#a x#ax +#s 5#c", note: tx("Combine: $7x - 3x = 4x$. Result: $4x + 5$.", "Zusammenfassen: $7x - 3x = 4x$. Ergebnis: $4x + 5$.") },
];

const loneMinusFrames: Frame[] = [
  { math: "-#m (x#x -#s 4#c)#g", note: tx("A minus with nothing else in front of the bracket.", "Vor der Klammer steht nur ein Minus, sonst nichts.") },
  { math: "-#m 1#one \\cdot#dot (x#x -#s 4#c)#g", note: tx("It's really $-1 \\cdot$ the bracket, a hidden $1$.", "Eigentlich heißt das $-1 \\cdot$ Klammer, mit einer versteckten $1$."), highlight: ["one"] },
  { math: "-#m x#x +#s 4#c", note: tx("So the same rule applies: every sign inside flips.", "Also gilt dieselbe Regel: Jedes Vorzeichen in der Klammer dreht sich um."), highlight: ["m", "s"] },
];

const nestedFrames: Frame[] = [
  { math: "20#k -#o [5#a -#i (3#b -#s x#c)#in]#out", note: tx("Brackets inside brackets. Work from the **inside out**.", "Klammern in Klammern. Arbeite dich **von innen nach außen** vor."), highlight: ["in(", "in)"] },
  { math: "20#k -#o [5#a -#i 3#b +#s x#c]#out", note: tx("Minus in front of $(3 - x)$: drop it and flip the signs.", "Minus vor $(3 - x)$: Klammer weglassen und Vorzeichen umdrehen."), highlight: ["i", "s"] },
  { math: "20#k -#o [2#a +#s x#c]#out", note: tx("Tidy up inside: $5 - 3 = 2$.", "Innen zusammenfassen: $5 - 3 = 2$.") },
  { math: "20#k -#o 2#a -#s x#c", note: tx("Now the outer bracket. Minus in front again, so flip.", "Jetzt die äußere Klammer. Wieder ein Minus davor, also umdrehen."), highlight: ["o", "s"] },
  { math: "18#k -#s x#c", note: tx("Finally $20 - 2 = 18$. Result: $18 - x$.", "Zum Schluss $20 - 2 = 18$. Ergebnis: $18 - x$.") },
];

const brackets: Topic = {
  ...topicMeta("brackets"),
  summary: [
    {
      title: tx("Plus in front", "Plus vor der Klammer"),
      body: tx("Leave the brackets out. All signs inside stay the same.", "Lass die Klammern weg. Alle Vorzeichen in der Klammer bleiben gleich."),
      examples: ["a + (b - c) = a + b - c"],
      tone: "rule",
    },
    {
      title: tx("Minus in front", "Minus vor der Klammer"),
      body: tx("Leave the brackets out and flip **every** sign inside.", "Lass die Klammern weg und dreh **jedes** Vorzeichen in der Klammer um."),
      examples: ["a - (b - c) = a - b + c", "a - (-b + c) = a + b - c"],
      tone: "rule",
    },
    {
      title: tx("A lone minus", "Ein Minus ganz allein"),
      body: tx("$-(…)$ means $-1 \\cdot (…)$. Same rule: flip everything.", "$-(…)$ bedeutet $-1 \\cdot (…)$. Gleiche Regel: Alle Vorzeichen umdrehen."),
      examples: ["-(x - 4) = -x + 4"],
      tone: "tip",
    },
    {
      title: tx("Nested brackets", "Verschachtelte Klammern"),
      body: tx(
        "Start with the innermost bracket and work outwards. Tidy up after each step.",
        "Fang mit der innersten Klammer an und arbeite dich nach außen vor. Fasse nach jedem Schritt zusammen.",
      ),
      examples: ["20 - [5 - (3 - x)] = 18 - x"],
      tone: "tip",
    },
    {
      title: tx("Don't forget", "Nicht vergessen"),
      body: tx(
        "After removing brackets, combine like terms: only the same letter goes together.",
        "Fasse nach dem Auflösen gleichartige Terme zusammen: Nur gleiche Buchstaben gehören zusammen.",
      ),
      examples: ["3x + 2y - x = 2x + 2y"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Plus in front: brackets just vanish", "Plus davor: Die Klammern verschwinden einfach"),
      blob: tx("Let's start easy. A plus in front of a bracket is the friendly case!", "Wir fangen leicht an. Ein Plus vor der Klammer ist der freundliche Fall!"),
      body: tx(
        "Brackets group terms together. To simplify, we want them gone. What happens depends only on the sign **in front of** the bracket.",
        "Klammern fassen Terme zusammen. Zum Vereinfachen wollen wir sie loswerden. Was dabei passiert, hängt nur vom Zeichen **vor** der Klammer ab.",
      ),
      frames: plusFrames,
    },
    {
      type: "explain",
      title: tx("Minus in front: flip every sign", "Minus davor: Alle Vorzeichen umdrehen"),
      blob: tx("Now the tricky one. Watch the signs inside the bracket!", "Jetzt wird's kniffliger. Achte auf die Vorzeichen in der Klammer!"),
      body: tx(
        "A minus means you take away everything inside. So each term inside changes its sign.",
        "Ein Minus heißt: Du ziehst alles in der Klammer ab. Deshalb ändert jeder Term darin sein Vorzeichen.",
      ),
      frames: minusFrames,
    },
    {
      type: "widget",
      title: tx("Try it yourself", "Probier's selbst"),
      blob: tx("Flip the sign in front and watch what happens inside.", "Wechsle das Zeichen vor der Klammer und schau, was darin passiert."),
      body: tx("Switch between $+$ and $-$. The highlighted signs are the ones that change.", "Schalte zwischen $+$ und $-$ um. Die markierten Vorzeichen sind die, die sich ändern."),
      widget: SignFlipper,
    },
    {
      type: "check",
      blob: tx("Your turn! Minus in front, so…", "Du bist dran! Minus davor, also…"),
      exercise: {
        instruction: INSTRUCTION,
        math: "5a - (2a + 3)",
        mistakes: bracketMistakes([term("a", 5, "a"), group("g", -1, [term("b", 2, "a"), term("c", 3)])], "3a-3"),
        answer: { kind: "expr", value: "3a-3", form: "simplified" },
        hint: tx("Flip both signs inside: $+2a$ becomes $-2a$, $+3$ becomes $-3$.", "Dreh beide Vorzeichen in der Klammer um: Aus $+2a$ wird $-2a$, aus $+3$ wird $-3$."),
        solution: [
          { math: "5#a a#va -#m (2#b a#vb +#s 3#c)#g", note: tx("Minus in front of the bracket.", "Minus vor der Klammer."), highlight: ["m"] },
          { math: "5#a a#va -#m 2#b a#vb -#s 3#c", note: tx("Flip every sign inside.", "Dreh jedes Vorzeichen in der Klammer um."), highlight: ["m", "s"] },
          { math: "3#a a#va -#s 3#c", note: "$5a - 2a = 3a$." },
        ],
      },
    },
    {
      type: "explain",
      title: tx("The hidden −1", "Die versteckte −1"),
      blob: tx("Sometimes the minus looks lonely. It still flips everything!", "Manchmal steht das Minus ganz allein. Es dreht trotzdem alles um!"),
      frames: loneMinusFrames,
    },
    {
      type: "check",
      blob: tx("Two kinds of terms this time. Keep them apart!", "Diesmal gibt es zwei Sorten Terme. Halte sie auseinander!"),
      exercise: {
        instruction: INSTRUCTION,
        math: "-(4 - 3y) + 2y",
        mistakes: bracketMistakes([group("g", -1, [term("a", 4), term("b", -3, "y")]), term("c", 2, "y")], "5y-4"),
        answer: { kind: "expr", value: "5y-4", form: "simplified" },
        hint: tx("First $-(4 - 3y) = -4 + 3y$. Then combine the $y$-terms.", "Erst $-(4 - 3y) = -4 + 3y$. Dann fasst du die $y$-Terme zusammen."),
        solution: [
          { math: "-#m (4#a -#s 3#b y#vb)#g +#p 2#c y#vc", note: tx("A lone minus in front: flip everything inside.", "Nur ein Minus davor: Dreh alles in der Klammer um."), highlight: ["m"] },
          { math: "-#m 4#a +#s 3#b y#vb +#p 2#c y#vc", note: tx("$4$ becomes $-4$, $-3y$ becomes $+3y$.", "Aus $4$ wird $-4$, aus $-3y$ wird $+3y$."), highlight: ["m", "s"] },
          { math: "-#m 4#a +#s 5#b y#vb", note: "$3y + 2y = 5y$." },
          { math: "5#b y#vb -#m 4#a", note: tx("Nicer with the $y$ first: $5y - 4$.", "Schöner mit dem $y$ vorne: $5y - 4$.") },
        ],
      },
    },
    {
      type: "explain",
      title: tx("Brackets inside brackets", "Klammern in Klammern"),
      blob: tx("Like opening boxes inside boxes: start with the smallest one.", "Wie Kisten in Kisten auspacken: Fang mit der kleinsten an."),
      body: tx(
        "Square brackets $[\\,]$ work exactly like round ones. They just make nesting easier to read.",
        "Eckige Klammern $[\\,]$ funktionieren genau wie runde. Sie machen Verschachtelungen nur besser lesbar.",
      ),
      frames: nestedFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Inside out, remember?", "Die letzte! Von innen nach außen, weißt du noch?"),
      exercise: {
        instruction: INSTRUCTION,
        math: "12 - [x - (4 - 2x)]",
        mistakes: bracketMistakes([term("k", 12), group("o", -1, [term("a", 1, "x"), group("i", -1, [term("b", 4), term("c", -2, "x")])], "[")], "16-3x"),
        answer: { kind: "expr", value: "16-3x", form: "simplified" },
        hint: tx("Innermost first: $x - (4 - 2x) = x - 4 + 2x = 3x - 4$.", "Die innerste zuerst: $x - (4 - 2x) = x - 4 + 2x = 3x - 4$."),
        solution: [
          { math: "12#k -#o [x#a -#i (4#b -#s 2#c x#vc)#in]#out", note: tx("Start with the inner bracket.", "Fang mit der inneren Klammer an."), highlight: ["in(", "in)"] },
          { math: "12#k -#o [x#a -#i 4#b +#s 2#c x#vc]#out", note: tx("Minus in front: flip.", "Minus davor: umdrehen."), highlight: ["i", "s"] },
          { math: "12#k -#o [3#c x#vc -#i 4#b]#out", note: tx("Tidy up: $x + 2x = 3x$.", "Zusammenfassen: $x + 2x = 3x$.") },
          { math: "12#k -#o 3#c x#vc +#i 4#b", note: tx("Outer bracket, minus in front: flip.", "Äußere Klammer, Minus davor: umdrehen."), highlight: ["o", "i"] },
          { math: "16#k -#o 3#c x#vc", note: tx("$12 + 4 = 16$. Result: $16 - 3x$.", "$12 + 4 = 16$. Ergebnis: $16 - 3x$.") },
        ],
      },
    },
  ],
  generate,
};

export default brackets;
