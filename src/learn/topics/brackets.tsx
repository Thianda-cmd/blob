"use client";

import { motion } from "motion/react";
import { Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import { showTerms, type Term } from "@/learn/engine/terms";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";

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

/** "$4x + 2x = 6x$, $-7 + 2 = -5$" for every kind that actually gets combined. */
function combineNote(items: Item[]): string {
  const parts: string[] = [];
  const kinds = new Map<string, Term[]>();
  for (const x of terms(items)) kinds.set(x.v, [...(kinds.get(x.v) ?? []), { c: x.c, v: x.v }]);
  for (const [v, list] of kinds) {
    if (list.length < 2) continue;
    const sum = list.reduce((s, x) => s + x.c, 0);
    parts.push(`$${showTerms(list)} = ${showTerms([{ c: sum, v }], { keepZero: true })}$`);
  }
  return parts.join(" and ");
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
    // Same picture as the previous frame: just add the highlight and note to it.
    if (last && last.math === f.math && !last.highlight && !last.arrows) frames[frames.length - 1] = { ...f, note: f.note ?? last.note };
    else frames.push(f);
  };
  let cur = start;
  frames.push({ math: render(cur), note: "Look at the sign **in front of** each bracket." });
  for (let g = nextGroup(cur); g; g = nextGroup(cur)) {
    const flips = flippedKeys(cur, g.id);
    const what = g.open === "[" ? "square bracket" : "bracket";
    push({
      math: render(cur),
      highlight: [`p${g.id}`, g.sk ?? "", `b${g.id}(`, `b${g.id})`].filter(Boolean),
      note: g.sign === 1 ? `A **plus** (or nothing) in front of this ${what}, so the signs stay.` : `A **minus** in front of this ${what}: every sign inside flips.`,
    });
    cur = flatten(cur, g.id);
    frames.push({
      math: render(cur),
      highlight: flips,
      note: g.sign === 1 ? "Drop the brackets. Nothing else changes." : "Drop the brackets and flip: $+$ becomes $-$, $-$ becomes $+$.",
    });
    const messy = groupsInside(cur).find((x) => !x.items.some((y) => y.kind === "g") && combineLike(x.items).length < x.items.length);
    if (messy) {
      const note = `Tidy up inside the bracket first: ${combineNote(messy.items)}.`;
      cur = tidyInside(cur);
      frames.push({ math: render(cur), note });
    }
  }
  const sorted = sortLike(cur);
  if (!samePlaces(sorted, cur)) {
    frames.push({ math: render(sorted), note: "Put like terms next to each other. Each term takes its sign along." });
    cur = sorted;
  }
  const result = combineLike(cur);
  if (result.length < cur.length) frames.push({ math: render(result), note: `Combine like terms: ${combineNote(cur)}. Done!` });
  else frames[frames.length - 1] = { ...frames[frames.length - 1], note: `${frames[frames.length - 1].note} That's the result.` };
  return { frames, result };
}

// ---------------------------------------------------------------------------
// Exercise generator

const LETTERS = ["x", "x", "x", "a", "y", "b", "n"];

function coef(rng: Rng, max = 9) {
  return rng.nonZero(-max, max);
}

function exercise(items: Item[], hint: string): Exercise {
  const { frames, result } = solve(items);
  return {
    instruction: "Remove the brackets and simplify",
    math: plain(items),
    answer: { kind: "expr", value: plain(result).replace(/\s+/g, "") || "0", form: "simplified" },
    hint,
    solution: frames,
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
  const hint = sign === 1 ? "A plus in front: you can simply leave the brackets out." : "A minus in front flips **every** sign inside the bracket.";
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
  return exercise(items, "Take one bracket at a time and look at the sign right in front of it.");
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
    return exercise(items, "Nested brackets: start with the **innermost** one and work your way out.");
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
  return exercise(items, `Only like terms go together: ${p}-terms with ${p}-terms, ${q}-terms with ${q}-terms.`);
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
        <span className="text-[13px] text-ink-2">Sign in front of the bracket:</span>
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
          <Shuffle className="size-3.5" /> Another example
        </button>
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
        <Row label="With brackets">
          <MathView src={render(start)} size="lg" scope={`${scope}-a`} highlight={["pg", "bg(", "bg)"]} />
        </Row>
        <Row label="Without">
          <MathView src={render(flat)} size="lg" scope={`${scope}-b`} highlight={sign === -1 ? flippedKeys(start, "g") : []} />
        </Row>
        <Row label="Simplified">
          <MathView src={render(result)} size="lg" scope={`${scope}-c`} />
        </Row>
      </div>
      <p className="text-[13.5px] text-ink-2">
        {sign === 1 ? "With a plus, the brackets just disappear. Every sign stays as it is." : "With a minus, every highlighted sign flips. Toggle back and forth to see it."}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center gap-x-5 gap-y-1">
      <span className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

const plusFrames: Frame[] = [
  { math: "4#a x#ax +#p (2#b x#bx -#q 7#c)#g", note: "A **plus** sits in front of the bracket.", highlight: ["p", "g(", "g)"] },
  { math: "4#a x#ax +#p 2#b x#bx -#q 7#c", note: "So the brackets can simply go. Every sign stays." },
  { math: "\\hl{4#a x#ax +#p 2#b x#bx} -#q 7#c", note: "Now combine the like terms: $4x + 2x = 6x$." },
  { math: "6#a x#ax -#q 7#c", note: "That's it: $4x + (2x - 7) = 6x - 7$." },
];

const minusFrames: Frame[] = [
  { math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g", note: "Now a **minus** in front. It means: take away the *whole* bracket.", highlight: ["m"] },
  { math: "7#a x#ax -#m (3#b x#bx -#s 5#c)#g", note: "It hits **every** term inside: the $3x$ and the $-5$.", arrows: [["m", "b"], ["m", "c"]] },
  { math: "7#a x#ax -#m 3#b x#bx +#s 5#c", note: "Drop the brackets and flip each sign: $+3x$ becomes $-3x$, and $-5$ becomes $+5$.", highlight: ["m", "s"] },
  { math: "4#a x#ax +#s 5#c", note: "Combine: $7x - 3x = 4x$. Result: $4x + 5$." },
];

const loneMinusFrames: Frame[] = [
  { math: "-#m (x#x -#s 4#c)#g", note: "A minus with nothing else in front of the bracket." },
  { math: "-#m 1#one \\cdot#dot (x#x -#s 4#c)#g", note: "It's really $-1 \\cdot$ the bracket, a hidden $1$.", highlight: ["one"] },
  { math: "-#m x#x +#s 4#c", note: "So the same rule applies: every sign inside flips.", highlight: ["m", "s"] },
];

const nestedFrames: Frame[] = [
  { math: "20#k -#o [5#a -#i (3#b -#s x#c)#in]#out", note: "Brackets inside brackets. Work from the **inside out**.", highlight: ["in(", "in)"] },
  { math: "20#k -#o [5#a -#i 3#b +#s x#c]#out", note: "Minus in front of $(3 - x)$: drop it and flip the signs.", highlight: ["i", "s"] },
  { math: "20#k -#o [2#a +#s x#c]#out", note: "Tidy up inside: $5 - 3 = 2$." },
  { math: "20#k -#o 2#a -#s x#c", note: "Now the outer bracket. Minus in front again, so flip.", highlight: ["o", "s"] },
  { math: "18#k -#s x#c", note: "Finally $20 - 2 = 18$. Result: $18 - x$." },
];

const brackets: Topic = {
  ...topicMeta("brackets"),
  summary: [
    { title: "Plus in front", body: "Leave the brackets out. All signs inside stay the same.", examples: ["a + (b - c) = a + b - c"], tone: "rule" },
    { title: "Minus in front", body: "Leave the brackets out and flip **every** sign inside.", examples: ["a - (b - c) = a - b + c", "a - (-b + c) = a + b - c"], tone: "rule" },
    { title: "A lone minus", body: "$-(…)$ means $-1 \\cdot (…)$. Same rule: flip everything.", examples: ["-(x - 4) = -x + 4"], tone: "tip" },
    { title: "Nested brackets", body: "Start with the innermost bracket and work outwards. Tidy up after each step.", examples: ["20 - [5 - (3 - x)] = 18 - x"], tone: "tip" },
    { title: "Don't forget", body: "After removing brackets, combine like terms: only the same letter goes together.", examples: ["3x + 2y - x = 2x + 2y"], tone: "warning" },
  ],
  lesson: [
    {
      type: "explain",
      title: "Plus in front: brackets just vanish",
      blob: "Let's start easy. A plus in front of a bracket is the friendly case!",
      body: "Brackets group terms together. To simplify, we want them gone. What happens depends only on the sign **in front of** the bracket.",
      frames: plusFrames,
    },
    {
      type: "explain",
      title: "Minus in front: flip every sign",
      blob: "Now the tricky one. Watch the signs inside the bracket!",
      body: "A minus means you take away everything inside. So each term inside changes its sign.",
      frames: minusFrames,
    },
    {
      type: "widget",
      title: "Try it yourself",
      blob: "Flip the sign in front and watch what happens inside.",
      body: "Switch between $+$ and $-$. The highlighted signs are the ones that change.",
      widget: SignFlipper,
    },
    {
      type: "check",
      blob: "Your turn! Minus in front, so…",
      exercise: {
        instruction: "Remove the brackets and simplify",
        math: "5a - (2a + 3)",
        answer: { kind: "expr", value: "3a-3", form: "simplified" },
        hint: "Flip both signs inside: $+2a$ becomes $-2a$, $+3$ becomes $-3$.",
        solution: [
          { math: "5#a a#va -#m (2#b a#vb +#s 3#c)#g", note: "Minus in front of the bracket.", highlight: ["m"] },
          { math: "5#a a#va -#m 2#b a#vb -#s 3#c", note: "Flip every sign inside.", highlight: ["m", "s"] },
          { math: "3#a a#va -#s 3#c", note: "$5a - 2a = 3a$." },
        ],
      },
    },
    {
      type: "explain",
      title: "The hidden −1",
      blob: "Sometimes the minus looks lonely. It still flips everything!",
      frames: loneMinusFrames,
    },
    {
      type: "check",
      blob: "Two kinds of terms this time. Keep them apart!",
      exercise: {
        instruction: "Remove the brackets and simplify",
        math: "-(4 - 3y) + 2y",
        answer: { kind: "expr", value: "5y-4", form: "simplified" },
        hint: "First $-(4 - 3y) = -4 + 3y$. Then combine the $y$-terms.",
        solution: [
          { math: "-#m (4#a -#s 3#b y#vb)#g +#p 2#c y#vc", note: "A lone minus in front: flip everything inside.", highlight: ["m"] },
          { math: "-#m 4#a +#s 3#b y#vb +#p 2#c y#vc", note: "$4$ becomes $-4$, $-3y$ becomes $+3y$.", highlight: ["m", "s"] },
          { math: "-#m 4#a +#s 5#b y#vb", note: "$3y + 2y = 5y$." },
          { math: "5#b y#vb -#m 4#a", note: "Nicer with the $y$ first: $5y - 4$." },
        ],
      },
    },
    {
      type: "explain",
      title: "Brackets inside brackets",
      blob: "Like opening boxes inside boxes: start with the smallest one.",
      body: "Square brackets $[\\,]$ work exactly like round ones. They just make nesting easier to read.",
      frames: nestedFrames,
    },
    {
      type: "check",
      blob: "Last one! Inside out, remember?",
      exercise: {
        instruction: "Remove the brackets and simplify",
        math: "12 - [x - (4 - 2x)]",
        answer: { kind: "expr", value: "16-3x", form: "simplified" },
        hint: "Innermost first: $x - (4 - 2x) = x - 4 + 2x = 3x - 4$.",
        solution: [
          { math: "12#k -#o [x#a -#i (4#b -#s 2#c x#vc)#in]#out", note: "Start with the inner bracket.", highlight: ["in(", "in)"] },
          { math: "12#k -#o [x#a -#i 4#b +#s 2#c x#vc]#out", note: "Minus in front: flip.", highlight: ["i", "s"] },
          { math: "12#k -#o [3#c x#vc -#i 4#b]#out", note: "Tidy up: $x + 2x = 3x$." },
          { math: "12#k -#o 3#c x#vc +#i 4#b", note: "Outer bracket, minus in front: flip.", highlight: ["o", "i"] },
          { math: "16#k -#o 3#c x#vc", note: "$12 + 4 = 16$. Result: $16 - 3x$." },
        ],
      },
    },
  ],
  generate,
};

export default brackets;
