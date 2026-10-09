// Checks every topic of the learning center (all subjects, all levels) before you commit.
//
//   npm run check:learn                            every topic, 200 practice tasks per level
//   npm run check:learn -- --seeds 50              fewer tasks per level (faster while writing)
//   npm run check:learn -- biology                 one subject
//   npm run check:learn -- cell genetics           some topics (slugs)
//   npm run check:learn -- --verbose               every problem with all its details
//   npm run check:learn -- --strict                warnings fail too
//
// For every topic in src/learn/catalog.ts it loads the full topic (src/learn/topics/index.ts) and checks:
//   - catalog: unique slugs, a registered loader, a live subject, bilingual names, a glyph that parses
//   - lessons and cheat sheets exist at every level the catalog promises (a level with `minutes`)
//   - every Text in lessons, cheat sheets and generated tasks has a non-empty English and German side
//   - display maths parses: frames, task maths, cheat-sheet examples and every inline $…$ in rich text
//     (no unknown \commands, no stray closing bracket or open quote that cuts the rest off, no glued keys);
//     plain-text fields (titles, instructions, mistake titles) hold no $…$ or **…**, which would show as typed
//   - practice: `--seeds` tasks per level (every level: practice is offered even without a lesson) are
//     generated without throwing, the same seed gives the same task, each task accepts its own right
//     answer, rejects each of its typical mistakes and shows Blob's line for it
//   - the check steps of the lessons get the same exercise checks
//   - public pictures (/show/…): ids unique per level and valid in a URL; links in the committed
//     manifest (src/learn/show-manifest.json) that would stop working
//
// Problems make the script exit with 1. Warnings (quality bars from docs/learning-center.md, style) don't,
// unless --strict. A practice problem names its rng seed: topic.generate(level, createRng(seed)) rebuilds
// the task. See docs/learning-center.md for how lessons are written.
import { resolveText, type Text } from "@/i18n/text";
import { CATALOG, SUBJECTS, type TopicMeta } from "@/learn/catalog";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { matchOptions, sameText } from "@/learn/engine/arrange";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import { equivalent, parse } from "@/learn/engine/expr";
import { createRng } from "@/learn/engine/rng";
import { showItems, slugify } from "@/learn/showcase";
import { manifestItems } from "@/learn/showManifest";
import { hasTopic, loadTopic } from "@/learn/topics";
import { AREAS, LEVELS, type AnswerSpec, type Exercise, type Level, type Topic } from "@/learn/types";

// ---------------------------------------------------------------------------
// Command line

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(readHelp());
  process.exit(0);
}
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i < 0) return undefined;
  return args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
};
const SEEDS = Math.max(1, Number(option("--seeds")) || 200);
const VERBOSE = flag("--verbose") || flag("-v");
const STRICT = flag("--strict");
const FILTERS = args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "--seeds");

function readHelp() {
  return [
    "check:learn: checks every topic of the learning center (what exactly: the top of scripts/check-learn.ts).",
    "  npm run check:learn [-- <subject|slug>…] [--seeds N] [--verbose] [--strict]",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Findings

type Severity = "problem" | "warning";
type Finding = { severity: Severity; level?: Level; where: string; what: string; detail?: string; seed?: number; count: number };
/** Reports a finding about one field; `detail` is the offending value or answer. */
type Report = (what: string, detail?: string, severity?: Severity) => void;

class Findings {
  private byKey = new Map<string, Finding>();

  add(severity: Severity, where: string, what: string, opts: { level?: Level; detail?: string; seed?: number } = {}) {
    // Practice findings are grouped over all seeds: "37 of 200 tasks", with the first seed and detail.
    const key = `${severity}|${opts.level ?? ""}|${where}|${what}`;
    const known = this.byKey.get(key);
    if (known) known.count++;
    else this.byKey.set(key, { severity, where, what, count: 1, ...opts });
  }

  /** A Report for one place (a lesson step, the practice of a level…). */
  at(where: string, level?: Level, seed?: number): Report {
    return (what, detail, severity = "problem") => this.add(severity, where, what, { level, detail, seed });
  }

  list(severity: Severity) {
    return [...this.byKey.values()].filter((f) => f.severity === severity);
  }
}

const short = (v: unknown, max = 160) => {
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v, (_k, x) => (typeof x === "function" ? `ƒ ${x.name}` : x));
  } catch {
    s = String(v);
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// ---------------------------------------------------------------------------
// Display maths (engine/display.ts)

const CHILDREN = ["num", "den", "base", "exp", "sub", "body", "index"] as const;
function hasKey(nodes: DNode[], key: string): boolean {
  return nodes.some((n) => {
    if (n.k === key) return true;
    const node = n as unknown as Record<string, unknown>;
    return CHILDREN.some((f) => Array.isArray(node[f]) && hasKey(node[f] as DNode[], key));
  });
}

const commandCache = new Map<string, boolean>();
/** parseDisplay turns an unknown \command into plain text with the command's name ("\leq" shows "leq"). */
function knownCommand(cmd: string) {
  let known = commandCache.get(cmd);
  if (known === undefined) {
    const nodes = parseDisplay(`\\${cmd}`);
    known = !(nodes.length === 1 && nodes[0].type === "text" && nodes[0].v === cmd);
    commandCache.set(cmd, known);
  }
  return known;
}

/** The \commands of a display-language source, outside "quoted text", \text{…} and \ce{…}. */
function commands(src: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '"') {
      const j = src.indexOf('"', i + 1);
      if (j < 0) break;
      i = j;
      continue;
    }
    if (src[i] !== "\\") continue;
    const cmd = /^[A-Za-z]+/.exec(src.slice(i + 1))?.[0];
    if (!cmd) {
      i++; // \, \; \\ \{ \} …
      continue;
    }
    i += cmd.length;
    if (cmd === "text" || cmd === "ce") {
      // Their argument is not display language: skip it (\ce nests braces, \text ends at the first }).
      const open = src.slice(i + 1).search(/\S/) + i + 1;
      if (src[open] !== "{") continue;
      let depth = 0;
      let j = open;
      for (; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}" && (cmd === "text" || --depth === 0)) break;
      }
      i = j;
      continue;
    }
    out.push(cmd);
  }
  return out;
}

const mathCache = new Map<string, string[]>();
/** What's wrong with one display-language source (empty when it renders as written). */
function mathIssues(src: string): string[] {
  let issues = mathCache.get(src);
  if (issues) return issues;
  issues = [];
  try {
    parseDisplay(src);
    // The parser stops quietly at a closing bracket it didn't open and runs an open quote to the end:
    // everything after it is missing on screen. A keyed marker at the end must survive.
    if (!hasKey(parseDisplay(`${src} §#zzend`), "zzend")) issues.push("maths is cut off: a closing bracket without its opening one (or an open quote)");
  } catch (e) {
    issues.push(`maths doesn't parse: ${(e as Error).message}`);
  }
  const unknown = [...new Set(commands(src).filter((c) => !knownCommand(c)))];
  if (unknown.length) issues.push(`unknown command ${unknown.map((c) => `\\${c}`).join(", ")} (shown as plain letters)`);
  if (/#[A-Za-z0-9_-]+#/.test(src)) issues.push("glued keys: put a space after a #key (`-#s 8#c`, not `-#s8#c`)");
  mathCache.set(src, issues);
  return issues;
}

// ---------------------------------------------------------------------------
// Text (src/i18n/text.ts): a plain string (no words) or { en, de }

/** "text": rich text ($…$ maths, **bold**); "plain": shown as is (titles, instructions); "math": display language. */
type TextKind = "text" | "plain" | "math";

/** One language's content: display maths must parse, and so must the inline $…$ of rich text. */
function checkContent(s: string, field: string, kind: TextKind, report: Report) {
  if (kind === "math") for (const issue of mathIssues(s)) report(`${field}: ${issue}`, s);
  else if (kind === "plain") {
    if (/\$|\*\*/.test(s)) report(`${field}: $…$ and **…** show as typed here (titles and instructions are plain text)`, s);
  } else {
    for (const [, inline] of s.matchAll(/\$([^$]+)\$/g)) for (const issue of mathIssues(inline)) report(`${field} (inline $…$): ${issue}`, s);
    if ((s.match(/\$/g)?.length ?? 0) % 2) report(`${field}: a $ without its partner (inline maths isn't closed)`, s);
  }
  if (s.includes("—")) report(`${field}: em dash (use a colon, a full stop or " – ")`, s, "warning");
}

function checkText(value: unknown, field: string, report: Report, opts: { kind?: TextKind; required?: boolean } = {}) {
  const kind = opts.kind ?? "text";
  if (value == null) {
    if (opts.required) report(`${field} is missing`);
    return;
  }
  if (typeof value === "string") {
    if (!value.trim()) report(`${field} is empty`);
    else checkContent(value, field, kind, report);
    return;
  }
  if (typeof value === "object" && "en" in value && "de" in value) {
    const { en, de } = value as { en: unknown; de: unknown };
    for (const [lang, s] of [["English", en], ["German", de]] as const) {
      if (typeof s !== "string" || !s.trim()) report(`${field} has no ${lang}`, short(value));
      else checkContent(s, `${field} (${lang === "English" ? "en" : "de"})`, kind, report);
    }
    return;
  }
  report(`${field} is not a Text (a string or tx(en, de))`, short(value));
}

// ---------------------------------------------------------------------------
// Answers (engine/answers.ts)

/** The right answer as the answer UI hands it to the checker (all accepted spellings for words). */
function rightAnswers(spec: AnswerSpec): AnswerValue[] {
  switch (spec.kind) {
    case "number": {
      const text = String(spec.value);
      return text.includes(".") ? [{ kind: "text", text }, { kind: "text", text: text.replace(".", ",") }] : [{ kind: "text", text }];
    }
    case "fraction":
      return [{ kind: "fraction", n: String(spec.n), d: String(spec.d) }];
    case "expr":
    case "formula":
      return [{ kind: "text", text: spec.value }];
    case "solutions":
      return [{ kind: "list", values: spec.values.map(String), none: spec.values.length === 0 }];
    case "inequality":
      return [{ kind: "inequality", op: spec.op, text: String(spec.value) }];
    case "pair":
      return [{ kind: "list", values: spec.values.map(String) }];
    case "choice":
      return [{ kind: "choice", index: spec.correct }];
    case "multi":
      return [{ kind: "multi", indices: spec.correct }];
    case "balance":
      return [{ kind: "list", values: spec.coefficients.map(String) }];
    case "word": {
      const spellings = new Set(spec.accept.flatMap((w) => (typeof w === "string" ? [w] : [w.en, w.de])));
      return [...spellings].map((text) => ({ kind: "text", text }));
    }
    case "order":
      return [{ kind: "order", order: spec.items.map((_, i) => i) }];
    case "match":
      return [{ kind: "match", picks: spec.pairs.map((_, i) => i) }];
  }
}

/**
 * The answer a typical mistake stands for, given to this task. Orders and matchings name their wrong
 * items in words; null when the mistake names an item the task doesn't have.
 */
function mistakeAnswer(spec: AnswerSpec, when: AnswerSpec): AnswerValue | null {
  if (when.kind === "order" && spec.kind === "order") {
    const idx = when.items.map((w) => spec.items.findIndex((it) => sameText(it, w)));
    if (idx.some((i) => i < 0)) return null;
    // The named items in the mistake's order, on the places they take in the right order.
    const order = spec.items.map((_, i) => i);
    [...idx].sort((a, b) => a - b).forEach((slot, k) => (order[slot] = idx[k]));
    return { kind: "order", order };
  }
  if (when.kind === "match" && spec.kind === "match") {
    const options = matchOptions(spec);
    const picks: (number | null)[] = spec.pairs.map((_, i) => i);
    for (const [left, right] of when.pairs) {
      const i = spec.pairs.findIndex((p) => sameText(p[0], left));
      const j = options.findIndex((o) => sameText(o, right));
      if (i < 0 || j < 0) return null;
      picks[i] = j;
    }
    return { kind: "match", picks };
  }
  return rightAnswers(when)[0];
}

const en = (t: Text | undefined) => resolveText(t, "en");
const distinct = (texts: Text[]) => new Set(texts.map((t) => en(t).trim())).size === texts.length;

/** The answer's own texts and whether it can be answered at all. */
function checkAnswer(a: AnswerSpec, report: Report) {
  switch (a.kind) {
    case "number":
      if (!Number.isFinite(a.value)) report("number answer is not a finite number", short(a));
      checkText(a.unit, "unit", report, { kind: "plain" });
      checkText(a.label, "answer label", report, { kind: "math" });
      break;
    case "fraction":
      if (!Number.isInteger(a.n) || !Number.isInteger(a.d) || a.d === 0) report("fraction answer needs whole numbers and a denominator that isn't 0", short(a));
      break;
    case "expr":
      checkText(a.prefix, "answer prefix", report, { kind: "math" });
      break;
    case "pair":
      a.names.forEach((n) => checkText(n, "answer name", report, { kind: "plain", required: true }));
      break;
    case "choice":
    case "multi": {
      if (a.options.length < 2) report(`${a.kind} has fewer than 2 options`, short(a));
      const right = a.kind === "choice" ? [a.correct] : a.correct;
      if (right.some((i) => !Number.isInteger(i) || i < 0 || i >= a.options.length)) report(`${a.kind}: the right option's index is out of range`, short(a));
      if (!distinct(a.options)) report(`${a.kind} has two options with the same text`, short(a.options));
      a.options.forEach((o) => checkText(o, "option", report, { required: true }));
      break;
    }
    case "formula":
      checkText(a.label, "answer label", report, { kind: "plain" });
      break;
    case "word":
      if (!a.accept.length) report("word answer accepts nothing");
      a.accept.forEach((w) => checkText(w, "accepted word", report, { required: true }));
      checkText(a.label, "answer label", report, { kind: "plain" });
      checkText(a.placeholder, "placeholder", report, { kind: "plain" });
      break;
    case "order":
      if (a.items.length < 2) report("order has fewer than 2 items", short(a));
      if (!distinct(a.items)) report("order has two items with the same text (the right order is ambiguous)", short(a.items));
      a.items.forEach((t) => checkText(t, "order item", report, { required: true }));
      checkText(a.label, "answer label", report, { kind: "plain" });
      break;
    case "match": {
      if (a.pairs.length < 2) report("match has fewer than 2 pairs", short(a));
      if (!distinct(a.pairs.map((p) => p[0]))) report("match has two left cards with the same text", short(a.pairs));
      if (!distinct(matchOptions(a))) report("match has two right cards with the same text (the right partner is ambiguous)", short(matchOptions(a)));
      a.pairs.forEach(([l, r]) => {
        checkText(l, "match card", report, { required: true });
        checkText(r, "match card", report, { required: true });
      });
      a.distractors?.forEach((d) => checkText(d, "match distractor", report, { required: true }));
      checkText(a.label, "answer label", report, { kind: "plain" });
      break;
    }
    case "solutions":
    case "inequality":
    case "balance":
      break;
  }
}

/** A task: its texts and maths, its own right answer, and each typical mistake. Returns the mistakes checked. */
function checkExercise(ex: Exercise, report: Report): number {
  checkText(ex.instruction, "instruction", report, { kind: "plain", required: true });
  checkText(ex.text, "task text", report);
  checkText(ex.math, "task maths", report, { kind: "math" });
  checkText(ex.hint, "hint", report);
  if (ex.visual && !ex.visual.component) report("task visual has no component");
  if (!ex.solution?.length) report("no worked solution (solution frames)");
  for (const f of ex.solution ?? []) {
    checkText(f.math, "solution maths", report, { kind: "math", required: true });
    checkText(f.note, "solution note", report);
  }
  const a = ex.answer;
  if (!a) {
    report("no answer");
    return 0;
  }
  checkAnswer(a, report);

  for (const value of rightAnswers(a)) {
    const fb = check(a, value);
    if (!fb.correct) report("the task doesn't accept its own right answer", `${short(a)} ← ${short(value)}${fb.message ? `: ${en(fb.message)}` : ""}`);
  }
  // An expression answer to a plain term ("Expand 3(x + 2)") must have the same value as the term.
  if (a.kind === "expr" && ex.math) {
    const task = en(ex.math);
    if (!/[=<>≤≥]/.test(task) && !/\\(blob|box|text)|"/.test(task)) {
      const t = parse(task.replace(/\[/g, "(").replace(/\]/g, ")"));
      const r = parse(a.value);
      if (t.ok && r.ok && !equivalent(t.ast, r.ast, { positive: a.positive })) report("the expression answer has another value than the task's term", `${task} ≠ ${a.value}`);
    }
  }

  const mistakes = ex.mistakes ?? [];
  for (const m of mistakes) {
    checkText(m.title, "mistake title", report, { kind: "plain" });
    checkText(m.say, "mistake message", report, { required: true });
    if (m.when.kind !== a.kind) {
      report(`a typical mistake is a "${m.when.kind}" answer, the task wants "${a.kind}"`, short(m.when));
      continue;
    }
    const wrong = mistakeAnswer(a, m.when);
    if (!wrong) {
      report("a typical mistake names an item the task doesn't have", short(m.when));
      continue;
    }
    const fb = check(a, wrong, { mistakes });
    if (fb.correct) report("a typical mistake is accepted as right", short(m.when));
    // Another mistake with the same answer may speak first; then its line is shown, which is fine.
    else if (!mistakes.some((o) => JSON.stringify(o.say) === JSON.stringify(fb.message)))
      report("a typical mistake never shows its message (the checker doesn't match it)", `${short(m.when)} → ${short(fb.message ?? "no message")}`);
  }
  return mistakes.length;
}

/** The whole task as text, for "same seed, same task" and for counting different tasks. */
function signature(ex: Exercise): string | null {
  try {
    return JSON.stringify(ex, (_k, v) => (typeof v === "function" ? `ƒ ${v.name}` : v));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Topics

type LevelRow = { steps: number; blocks: number; shapes: number; tasks: number; lesson: boolean };
type Row = { meta: TopicMeta; levels: Partial<Record<Level, LevelRow>>; pictures: number; mistakes: number; ms: number; problems: number; warnings: number };

const LIVE = new Set(SUBJECTS.filter((s) => s.live).map((s) => s.slug));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** What /show/<subject>/<topic>/<level>/<id> accepts (src/app/show/[subject]/[topic]/[level]/[id]/page.tsx). */
const PICTURE_ID = /^[a-z0-9-]{1,80}$/;

function checkCatalog(meta: TopicMeta, seen: Set<string>, f: Findings) {
  const report = f.at("catalog");
  if (!SLUG.test(meta.slug)) report("slug must be lowercase words joined by -", meta.slug);
  if (seen.has(meta.slug)) report("slug is used twice (progress is stored per slug, across subjects)", meta.slug);
  seen.add(meta.slug);
  if (!LIVE.has(meta.subject)) report(`subject "${meta.subject}" is not live in SUBJECTS (its pages are not found)`);
  if (!AREAS[meta.area]) report(`area "${meta.area}" has no entry in AREAS (src/learn/types.ts)`);
  else if (!SUBJECTS.find((s) => s.slug === meta.subject)?.areas?.includes(meta.area))
    report(`area "${meta.area}" is not in the subject's areas (SUBJECTS): it is listed after them`, undefined, "warning");
  if (!hasTopic(meta.slug)) report("no loader: add the topic to its subject's loaders (see docs/learning-center.md)");
  checkText(meta.title, "title", report, { kind: "plain", required: true });
  checkText(meta.blurb, "blurb", report, { kind: "plain", required: true });
  checkText(meta.de, "German school name (de)", report, { kind: "plain", required: true });
  checkText(meta.glyph, "glyph", report, { kind: "math", required: true });
  for (const level of LEVELS) {
    const lm = meta.levels[level];
    const r = f.at("catalog", level);
    if (!lm) {
      r("level is missing in the catalog");
      continue;
    }
    checkText(lm.depth, "depth", r, { kind: "plain", required: true });
    checkText(lm.blurb, "level blurb", r, { kind: "plain" });
    if (lm.minutes !== undefined && !(lm.minutes > 0)) r("minutes must be a positive number (leave it out while the lesson is being written)", String(lm.minutes));
  }
}

function checkLesson(topic: Topic, level: Level, f: Findings): Pick<LevelRow, "steps" | "blocks"> & { mistakes: number } {
  const promised = !!topic.levels[level]?.minutes;
  const content = topic.lessons[level];
  if (!content) {
    if (promised) f.add("problem", "lesson", "the catalog promises a lesson (minutes) but the topic has none at this level", { level });
    return { steps: 0, blocks: 0, mistakes: 0 };
  }
  if (!promised) f.add("warning", "lesson", "a lesson is written but hidden: give the level `minutes` in the catalog to show it", { level });
  if (!content.lesson?.length) f.add("problem", "lesson", "the lesson has no steps", { level });
  if (!content.summary?.length) f.add("problem", "cheat sheet", "the cheat sheet has no blocks", { level });

  let mistakes = 0;
  const lesson = content.lesson ?? [];
  lesson.forEach((step, i) => {
    const report = f.at(`lesson step ${i + 1} (${step.type})`, level);
    checkText(step.blob, "Blob's line", report);
    if (step.type === "check") {
      checkText(step.title, "title", report, { kind: "plain" });
      if (!step.exercise) report("check step without an exercise");
      else mistakes += checkExercise(step.exercise, report);
      return;
    }
    checkText(step.title, "title", report, { kind: "plain", required: true });
    checkText(step.body, "body", report);
    if (step.type === "widget") {
      if (!step.widget) report("widget step without a widget component");
      return;
    }
    if (step.visual && !step.visual.component) report("visual without a component");
    (step.frames ?? []).forEach((fr, k) => {
      checkText(fr.math, `frame ${k + 1} maths`, report, { kind: "math", required: true });
      checkText(fr.note, `frame ${k + 1} note`, report);
    });
  });
  (content.summary ?? []).forEach((b, i) => {
    const report = f.at(`cheat sheet block ${i + 1}`, level);
    checkText(b.title, "title", report, { kind: "plain", required: true });
    checkText(b.body, "body", report);
    (b.examples ?? []).forEach((e, k) => checkText(e, `example ${k + 1}`, report, { kind: "math", required: true }));
  });

  // Quality bars from docs/learning-center.md (warnings: a short intro level may have a reason).
  const widgets = lesson.filter((s) => s.type === "widget").length;
  const checks = lesson.filter((s) => s.type === "check").length;
  if (lesson.length && !widgets) f.add("warning", "lesson", "no widget step (every level should let the student play with the idea)", { level });
  if (lesson.length && checks < 2) f.add("warning", "lesson", `only ${checks} check step${checks === 1 ? "" : "s"} (aim for 3–4)`, { level });
  return { steps: lesson.length, blocks: content.summary?.length ?? 0, mistakes };
}

function checkPractice(topic: Topic, level: Level, f: Findings): Pick<LevelRow, "shapes" | "tasks"> & { mistakes: number } {
  const tasks = new Set<string>();
  const shapes = new Set<string>();
  let mistakes = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const seed = s * 7919 + level;
    const report = f.at("practice", level, seed);
    let ex: Exercise;
    try {
      ex = topic.generate(level, createRng(seed));
    } catch (e) {
      report(`generate() throws: ${(e as Error).message}`, (e as Error).stack?.split("\n")[1]?.trim());
      continue;
    }
    if (!ex || typeof ex !== "object") {
      report("generate() returned no exercise");
      continue;
    }
    // Server and browser build the first task from the same seed: generate must use only `rng`.
    const sig = signature(ex);
    if (sig !== null) {
      tasks.add(sig);
      let again: string | null = null;
      try {
        again = signature(topic.generate(level, createRng(seed)));
      } catch {
        // Throwing the second time is "a different task" too.
      }
      if (again !== sig) report("the same seed gave a different task: use only `rng` (no Math.random, Date or outside state)");
    }
    shapes.add(en(ex.instruction));
    mistakes += checkExercise(ex, report);
  }
  // Rough variety bars (see docs/learning-center.md): many tasks, several task shapes.
  if (tasks.size < Math.min(SEEDS, 40) * 0.6) f.add("warning", "practice", `only ${tasks.size} different tasks in ${SEEDS}`, { level });
  if (SEEDS >= 50 && shapes.size < 3) f.add("warning", "practice", `only ${shapes.size} task shape${shapes.size === 1 ? "" : "s"} (different instructions); aim for 3 or more`, { level });
  return { shapes: shapes.size, tasks: tasks.size, mistakes };
}

function checkPictures(topic: Topic, f: Findings): number {
  const items = showItems(topic);
  for (const level of LEVELS) {
    const lesson = topic.lessons[level]?.lesson ?? [];
    const bases = new Map<string, number>();
    lesson.forEach((step, i) => {
      if (step.type === "check" || (step.type === "explain" && !step.visual)) return;
      const base = slugify(step.id ?? en(step.title));
      const first = bases.get(base);
      if (first !== undefined)
        f.add("problem", "pictures", `steps ${first + 1} and ${i + 1} have the same picture id "${base}": give one of them its own \`id\``, { level });
      else bases.set(base, i);
    });
    for (const item of items.filter((x) => x.level === level))
      if (!PICTURE_ID.test(item.id)) f.add("problem", "pictures", `picture id "${item.id}" is not a valid link (a–z, 0–9 and -, at most 80 characters)`, { level });
  }
  // Links shared from the committed manifest must keep working: a renamed step keeps its old id with `id`.
  for (const old of manifestItems(topic.slug) ?? []) {
    if (!items.some((x) => x.level === old.level && x.id === old.id))
      f.add("warning", "pictures", `the public link /show/${topic.subject}/${topic.slug}/${old.level}/${old.id} stops working: give the step \`id: "${old.id}"\` if it was renamed`, { level: old.level });
  }
  return items.length;
}

async function checkTopic(meta: TopicMeta, f: Findings): Promise<Omit<Row, "problems" | "warnings">> {
  const started = performance.now();
  const row: Omit<Row, "problems" | "warnings"> = { meta, levels: {}, pictures: 0, mistakes: 0, ms: 0 };
  let topic: Topic;
  try {
    topic = await loadTopic(meta.slug);
  } catch (e) {
    f.add("problem", "topic", `the topic doesn't load: ${(e as Error).message}`);
    return row;
  }
  if (topic.slug !== meta.slug || topic.subject !== meta.subject)
    f.add("problem", "topic", `the topic file spreads topicMeta("${topic.slug}") (${topic.subject}), not its own catalog entry`);
  if (typeof topic.generate !== "function") {
    f.add("problem", "topic", "the topic has no generate(level, rng)");
    return row;
  }
  for (const level of LEVELS) {
    const lesson = checkLesson(topic, level, f);
    const practice = checkPractice(topic, level, f);
    row.mistakes += lesson.mistakes + practice.mistakes;
    row.levels[level] = { steps: lesson.steps, blocks: lesson.blocks, shapes: practice.shapes, tasks: practice.tasks, lesson: !!topic.lessons[level] };
  }
  row.pictures = checkPictures(topic, f);
  row.ms = performance.now() - started;
  return row;
}

// ---------------------------------------------------------------------------
// Output

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
const num = (n: number) => n.toLocaleString("en").replace(/,/g, " ");

function printTable(rows: Row[]) {
  const name = (r: Row) => `${r.meta.subject}/${r.meta.slug}`;
  const w = Math.max(24, ...rows.map((r) => name(r).length)) + 2;
  const cell = (l?: LevelRow) => (!l ? "?" : `${l.lesson ? `${l.steps}/${l.blocks}` : "–/–"}/${l.shapes}`);
  console.log(`\n${pad("topic", w)}${LEVELS.map((l) => pad(`L${l}`, 12)).join("")}${lpad("pictures", 9)}${lpad("mistakes", 10)}${lpad("time", 8)}  result`);
  for (const r of rows) {
    const result = r.problems ? `${r.problems} problem${r.problems === 1 ? "" : "s"}` : "ok";
    const warn = r.warnings ? `, ${r.warnings} warning${r.warnings === 1 ? "" : "s"}` : "";
    console.log(
      `${pad(name(r), w)}${LEVELS.map((l) => pad(cell(r.levels[l]), 12)).join("")}${lpad(r.pictures, 9)}${lpad(num(r.mistakes), 10)}${lpad(`${(r.ms / 1000).toFixed(1)}s`, 8)}  ${result}${warn}`,
    );
  }
  console.log("Ln: lesson steps / cheat-sheet blocks / practice task shapes (–/– no lesson: practice only). mistakes: typical mistakes checked.");
}

function printFindings(title: string, rows: { meta: TopicMeta; findings: Finding[] }[]) {
  const withAny = rows.filter((r) => r.findings.length);
  if (!withAny.length) return;
  console.log(`\n${title}`);
  for (const { meta, findings } of withAny) {
    console.log(`  ${meta.subject}/${meta.slug}`);
    const shown = VERBOSE ? findings : findings.slice(0, 12);
    for (const x of shown) {
      const where = `${x.level ? `L${x.level} ` : ""}${x.where}`;
      const times = x.seed !== undefined ? ` (${x.count} of ${SEEDS} tasks, first rng seed ${x.seed})` : x.count > 1 ? ` (${x.count}×)` : "";
      console.log(`    ${where}${times}: ${x.what}`);
      if (x.detail) console.log(`      ${VERBOSE ? x.detail : short(x.detail, 200)}`);
    }
    if (findings.length > shown.length) console.log(`    … ${findings.length - shown.length} more (--verbose lists all)`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const topics = CATALOG.filter((t) => !FILTERS.length || FILTERS.some((x) => x === t.slug || x === t.subject));
  if (!topics.length) {
    console.error(`check:learn: no topic matches ${FILTERS.join(", ")}`);
    return 2;
  }
  console.log(`check:learn: ${topics.length} topics, ${SEEDS} practice tasks per level`);

  const seen = new Set<string>();
  const results: { row: Row; findings: Finding[] }[] = [];
  for (const meta of CATALOG) {
    const f = new Findings();
    checkCatalog(meta, seen, f);
    if (!topics.includes(meta)) continue;
    const base = await checkTopic(meta, f);
    const problems = f.list("problem");
    const warnings = f.list("warning");
    results.push({ row: { ...base, problems: problems.length, warnings: warnings.length }, findings: [...problems, ...warnings] });
  }

  const rows = results.map((r) => r.row);
  printTable(rows);
  const problems = rows.reduce((n, r) => n + r.problems, 0);
  const warnings = rows.reduce((n, r) => n + r.warnings, 0);
  printFindings("Problems", results.map((r) => ({ meta: r.row.meta, findings: r.findings.filter((x) => x.severity === "problem") })));
  printFindings("Warnings", results.map((r) => ({ meta: r.row.meta, findings: r.findings.filter((x) => x.severity === "warning") })));

  const levels = rows.reduce((n, r) => n + Object.values(r.levels).filter((l) => l.lesson).length, 0);
  const tasks = rows.length * LEVELS.length * SEEDS;
  console.log(
    `\n${rows.length} topics · ${levels} lessons · ${num(tasks)} tasks · ${num(rows.reduce((n, r) => n + r.mistakes, 0))} typical mistakes · ${num(rows.reduce((n, r) => n + r.pictures, 0))} pictures · ${problems} problems · ${warnings} warnings`,
  );
  return problems || (STRICT && warnings) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
