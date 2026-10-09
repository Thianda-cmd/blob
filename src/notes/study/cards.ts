// Turns a note into flashcards. Deterministic: the same note always gives the same cards with the
// same ids, so spaced repetition (card_reviews) keeps working while the note grows.
//
// Where cards come from, best first (a card found twice keeps the better source):
//   flashcard blocks · toggles (summary → content) · definitions ("Begriff: Erklärung",
//   "Begriff – Erklärung", "**Osmose** ist …", "Indikatoren sind …" under the heading „Indikatoren“,
//   definition callouts, vocabulary lists, dates) · questions with their answer · table rows ·
//   formulas with a label · headings or "…:" lines with the list under them · bold or highlighted
//   terms in a sentence (cloze).

import { plainMath } from "@/learn/engine/display";
import { docText, flatBlocks, offsetText, plain, sliceLine, splitLines, toBlocks, trimLine, type Block, type Ctx, type Line } from "../doc";
import { detectLang, fold, hash, isStopword, needsContext, sentences, withoutArticle, type Lang } from "../text";

export type CardSource = "flashcard" | "toggle" | "definition" | "question" | "table" | "formula" | "list" | "cloze";

export type Card = {
  /** Stable id for card_reviews (≤ 64 characters). */
  id: string;
  source: CardSource;
  front: Line[];
  back: Line[];
  /** What the front asks for, shown small above it: a table column ("Funktion"), or "@when" for dates. */
  prompt?: string;
  /** The heading the card sits under (shown small above it). */
  context: string;
  /** A term and what it means (definitions, dates, table cells, formulas): used for quiz questions. */
  term?: string;
  meaning?: string;
  /** Which answers can stand in for each other in a quiz ("def", "date", "formula", "col:funktion"). */
  group?: string;
  /** Cloze cards: the hidden word(s). */
  answer?: string;
  /** Where in the note it comes from (cards are listed in the note's order). */
  order: number;
};

const RANK: Record<CardSource, number> = { flashcard: 0, toggle: 1, definition: 2, question: 3, table: 4, formula: 5, list: 6, cloze: 7 };

const set = (s: string) => new Set(s.split(" "));

/** Words before a colon that label a line instead of naming a term (folded: ö → oe). */
const LABELS = set(
  "achtung beispiel beispiele bsp hinweis tipp tipps merke merksatz wichtig hausaufgabe hausaufgaben aufgabe aufgaben loesung loesungen " +
    "quelle quellen fazit notiz notizen info frage antwort ergebnis datum thema seite buch arbeitsblatt ab test klassenarbeit " +
    "note example examples eg tip tips important homework task tasks solution answer question result date topic page source sources summary " +
    "zusammenfassung einleitung schluss vorteile nachteile pro contra kontra vorteil nachteil ziel ziele material materialien gegeben gesucht rechnung",
);

/** Headings that don't make a good question (folded). */
const GENERIC_HEADINGS = set(
  "einleitung zusammenfassung fazit hausaufgaben hausaufgabe aufgaben notizen quellen literatur inhalt inhaltsverzeichnis " +
    "ueberblick uebersicht wiederholung sonstiges allgemeines beispiele beispiel todo begriffe fachbegriffe grundbegriffe definitionen " +
    "glossar vokabeln woerter redewendungen phrasen formeln daten termine wichtige-begriffe wichtige-daten " +
    "introduction summary conclusion homework notes sources contents overview review misc examples example terms key-terms glossary " +
    "vocabulary words phrases formulas dates",
);

/** Verbs that make "X …: Y" a sentence rather than a term with its meaning. */
const VERBS = /(^|\s)(ist|sind|war|waren|gibt|hat|haben|wird|werden|kann|können|muss|müssen|soll|sollen|is|are|was|were|has|have|will|can|must|should|gilt|lautet)(\s|$)/i;

/** "**X** ist …": verbs after which the rest is the definition (the verb goes) … */
const COPULA = /^\s*(ist|sind|war|waren|is|are|was|were|is defined as|are defined as)\s+/i;
/** … or describes it (the verb stays: "Gibt an, wie sauer …"). */
const DESCRIBES = /^\s*(bezeichnet|bedeutet|beschreibt|gibt an|umfasst|meint|misst|means|describes|refers to|measures)(?=[\s,])/i;

const DEF_SEPARATOR = /\s*:\s+|\s+[–—-]\s+|\s+(?:=|→|->|⇒)\s+/;

/** Abbreviations that may end a vocabulary entry: "to rely on sb.", "sich auf jdn. verlassen". */
const VOCAB_END = /\b(sb|sth|jdn|jdm|jds|etw|usw|etc)\.$/i;

/** A date: "1920", "9. November 1918", "Mai 1945", "1914–1918", "800 n. Chr.". */
const DATE = /^(?:(?:ca\.|um|seit|ab|bis)\s+)?(?:\d{1,2}\.\s*(?:\d{1,2}\.\s*|\p{L}+\s+)?)?(?:\p{L}+\s+)?\d{2,4}(?:\s*[–-]\s*\d{2,4})?(?:\s*(?:v|n)\.\s*Chr\.)?$/u;

const MAX_CLOZES = 40;
const MAX_ITEMS_ON_BACK = 8;

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const key = (s: string) => fold(withoutArticle(s)).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A capital first letter for sentence-like meanings ("die Teilung des Kerns …" → "Die …"), not for single words. */
function capitalize(line: Line): Line {
  const out = line.map((s) => ({ ...s }));
  const first = out[0];
  if (first && !first.math && words(plain(line)).length >= 4) {
    first.text = first.text.replace(/^(\s*)(\p{Ll})/u, (_, sp: string, c: string) => sp + c.toUpperCase());
  }
  return out;
}

function dropFinalStop(line: Line): Line {
  const out = line.map((s) => ({ ...s }));
  const last = out[out.length - 1];
  if (last && !last.math && !VOCAB_END.test(last.text) && !/(Chr|bzw|z\. ?B)\.$/.test(last.text)) last.text = last.text.replace(/\.$/, "");
  return trimLine(out);
}

/** Text in the line outside maths (a term made only of maths is an example, not a term). */
const hasWords = (line: Line) => line.some((s) => !s.math && /[\p{L}\p{N}]/u.test(s.text));

/** Two different languages on both sides ("to achieve – erreichen"): a vocabulary entry. */
function translation(a: string, b: string) {
  const la = detectLang(a, "en");
  const lb = detectLang(b, "de");
  return la !== lb && detectLang(a, "de") === la && detectLang(b, "en") === lb;
}

export type Definition = { term: Line; meaning: Line; kind: "def" | "date" | "vocab" };

/**
 * "Begriff: Erklärung" (also with –, -, =, →): the term and its meaning, or null. `relaxed` (in a
 * list that is mostly definitions) also takes longer phrases ("I can't stand it when … – …").
 */
export function splitDefinition(line: Line, relaxed = false): Definition | null {
  const text = offsetText(line);
  // A colon is the clearest sign ("D = 0: eine Lösung"), so it wins over a dash or "=" before it.
  const m = /\s*:\s+/.exec(text) ?? DEF_SEPARATOR.exec(text);
  if (!m || m.index === 0) return null;
  const termLine = trimLine(sliceLine(line, 0, m.index));
  const meaningLine = trimLine(sliceLine(line, m.index + m[0].length));
  const term = plain(termLine);
  const meaning = plain(meaningLine);
  if (!meaningLine.length || !meaning.replace(/[^\p{L}\p{N}]/gu, "") || !hasWords(termLine)) return null;
  const arrow = /[=→>⇒]/.test(m[0]);
  // "carbon dioxide + water → glucose + oxygen" is an equation; "v = s / t" a formula.
  if (arrow && (/\s\+\s/.test(term) || /\s\+\s/.test(meaning) || term.replace(/[^\p{L}]/gu, "").length < 3)) return null;
  // Dates: "9. November 1918 – Ausrufung der Republik" asks for the date of the event.
  if (DATE.test(term) && /\d{3,4}/.test(term) && words(meaning).length <= 14) {
    return { term: dropFinalStop(meaningLine), meaning: termLine, kind: "date" };
  }
  if (LABELS.has(key(term))) return null;
  if (/^\d/.test(term) && !/\p{L}{3}/u.test(term)) return null;
  const vocab = /[–—-]/.test(m[0]) && words(term).length <= 10 && words(meaning).length <= 12 && translation(term, meaning);
  if (relaxed || vocab) {
    if (term.length > 100 || words(term).length > 12) return null;
    return { term: termLine, meaning: meaningLine, kind: vocab ? "vocab" : "def" };
  }
  if (term.length < 2 || term.length > 70 || words(term).length > 7) return null;
  if ((/[.!?;]$/.test(term) && !VOCAB_END.test(term)) || /[!?]\s|\.\s+\p{Lu}/u.test(term)) return null;
  if (words(term).length > 2 && VERBS.test(term)) return null;
  return { term: termLine, meaning: capitalize(meaningLine), kind: "def" };
}

/** "**Osmose** ist …", "Unter **Osmose** versteht man …": the bold term and its definition. */
function boldDefinition(sentence: Line): { term: Line; meaning: Line } | null {
  let offset = 0;
  let index = -1;
  for (let i = 0; i < sentence.length; i++) {
    const s = sentence[i];
    if (s.bold && !s.math && s.text.trim()) {
      index = i;
      break;
    }
    offset += s.math ? 1 : s.text.length;
    if (offset > 12) return null;
  }
  if (index < 0) return null;
  const text = offsetText(sentence);
  const before = text.slice(0, offset).trim();
  const termText = sentence[index].text;
  const after = text.slice(offset + termText.length);
  const term = trimLine([sentence[index]]);
  if (words(plain(term)).length > 6) return null;
  if (/^(unter|als)$/i.test(before)) {
    const rest = /^\s*(versteht man|bezeichnet man|wird|werden)\s+/i.exec(after);
    if (!rest) return null;
    return meaningAfter(sentence, term, offset + termText.length + rest[0].length, false);
  }
  if (before && !/^(der|die|das|ein|eine|the|a|an)$/i.test(before)) return null;
  return definitionAfter(sentence, term, offset + termText.length, after);
}

/** The definition after a term ending at `at`: "ist …" (the verb goes) or "gibt an, …" (the verb stays). */
function definitionAfter(sentence: Line, term: Line, at: number, after: string) {
  const copula = COPULA.exec(after);
  if (copula) return meaningAfter(sentence, term, at + copula[0].length, false);
  const describes = DESCRIBES.exec(after);
  if (describes) return meaningAfter(sentence, term, at + (after.length - after.trimStart().length), true);
  return null;
}

function meaningAfter(sentence: Line, term: Line, at: number, keepVerb: boolean) {
  const meaning = dropFinalStop(trimLine(sliceLine(sentence, at)));
  if (words(plain(meaning)).length < (keepVerb ? 3 : 2)) return null;
  if (!keepVerb) return { term, meaning: capitalize(meaning) };
  const first = meaning[0];
  const line = first && !first.math ? [{ ...first, text: first.text.replace(/^\p{Ll}/u, (c) => c.toUpperCase()) }, ...meaning.slice(1)] : meaning;
  return { term, meaning: line };
}

/** "Indikatoren sind Farbstoffe, …" right under the heading „Indikatoren“. */
function headingDefinition(sentence: Line, heading: string): { term: Line; meaning: Line } | null {
  const h = withoutArticle(heading.trim());
  if (!h || words(h).length > 5) return null;
  const text = offsetText(sentence);
  const m = new RegExp(`^(?:(?:der|die|das|ein|eine|the|a|an)\\s+)?${escape(h)}(?=[\\s,])`, "i").exec(text);
  if (!m) return null;
  return definitionAfter(sentence, [{ text: h }], m[0].length, text.slice(m[0].length));
}

/**
 * A short lead-in that names a term, explained by what follows: "Hinzu kam ein starker
 * **Nationalismus**. In vielen Ländern …" → Nationalismus: the next one or two sentences.
 */
function leadIn(sentence: Line, after: Line[]): { term: Line; meaning: Line } | null {
  const text = plain(sentence);
  if (words(text).length > 9 || !after.length) return null;
  const bold = sentence.filter((s) => s.bold && !s.math && s.text.trim());
  if (bold.length !== 1) return null;
  // The term ends the sentence (only punctuation after it).
  const lastWords = sentence.slice(sentence.indexOf(bold[0]) + 1);
  if (lastWords.some((s) => s.math || /[\p{L}\d]/u.test(s.text))) return null;
  const term = trimLine([bold[0]]);
  if (words(plain(term)).length > 4) return null;
  // One or two sentences of explanation, up to the next bold term.
  const explanation: Line[] = [];
  for (const next of after) {
    if (explanation.length && next.some((s) => s.bold)) break;
    explanation.push(next);
    if (explanation.length === 2 || plain(explanation.flat()).length > 160) break;
  }
  const meaning = explanation.reduce<Line>((acc, l, i) => (i ? [...acc, { text: " " }, ...l] : l), []);
  return words(plain(meaning)).length >= 5 ? { term, meaning: meaning.map((x) => ({ ...x, bold: false })) } : null;
}

/** A cloze term worth asking for: a name or a noun, not "nicht" or "immer". */
function goodClozeTerm(term: string, lang: Lang) {
  const ws = words(term);
  if (!ws.length || ws.length > 6 || term.length > 60) return false;
  const meaningful = ws.filter((w) => !isStopword(w.toLowerCase().replace(/[^\p{L}]/gu, "")) && /[\p{L}\d]{2}/u.test(w));
  if (!meaningful.length) return false;
  if (lang === "de" && ws.length === 1 && !/^[\p{Lu}\d]/u.test(term) && term.length < 8) return false;
  return true;
}

const headingText = (line: Line) => plain(line).replace(/[:.]$/, "");
const genericHeading = (h: string) => GENERIC_HEADINGS.has(key(h).replace(/ /g, "-")) || GENERIC_HEADINGS.has(key(h)) || /^(beispiel|example)/i.test(h.trim());

/** The lines of a block (for card backs): paragraphs, list items, maths, table rows. */
function blockLines(b: Block): Line[] {
  switch (b.type) {
    case "para":
    case "item":
      return splitLines(b.line);
    case "heading":
      return [b.line];
    case "math":
      return [[{ text: b.src, math: true }]];
    case "table":
      return b.rows.map((r) => r.reduce<Line>((acc, c, i) => (i ? [...acc, { text: " · " }, ...c] : c), []));
    case "flashcard":
      return [...b.front, ...b.back];
    case "toggle":
      return [b.summary, ...b.body.flatMap(blockLines)];
    case "callout":
      return b.body.flatMap(blockLines);
    default:
      return [];
  }
}

type TextBlock = Extract<Block, { type: "para" | "item" }>;
const isText = (b: Block | undefined): b is TextBlock => b?.type === "para" || b?.type === "item";

/** All flashcards of a note. `title` names the note (the context for cards above the first heading). */
export function makeCards(doc: unknown, title = ""): Card[] {
  const flat = flatBlocks(toBlocks(doc));
  const lang = detectLang(flat.map((b) => ("line" in b ? plain(b.line) : "")).join(" "));
  const cards: Card[] = [];
  const used = new WeakSet<Line>();
  const defined = new Set<string>();
  let clozes = 0;

  const position = new Map(flat.map((b, i) => [b, i]));
  const add = (from: Block, card: Omit<Card, "id" | "order">, id?: string) => {
    if (!card.front.length || !card.back.length) return;
    const front = plain(card.front.flat());
    if (!front) return;
    const k = card.source === "cloze" ? `c|${fold(front)}|${fold(card.answer ?? "")}` : `t|${fold(front)}|${card.prompt ?? ""}`;
    cards.push({ ...card, id: id ?? `${card.source.slice(0, 2)}-${hash(k)}`, order: (position.get(from) ?? 0) * 1000 + cards.length });
  };

  // The heading above each block, and the paragraph right under a heading.
  const contextOf = new Map<Block, string>();
  const headingOf = new Map<Block, string>();
  {
    let current = title;
    let heading = "";
    for (const b of flat) {
      if (b.type === "heading") {
        current = headingText(b.line) || title;
        heading = headingText(b.line);
      } else {
        if (heading && b.type === "para" && !b.ctx.callout) headingOf.set(b, heading);
        heading = "";
      }
      contextOf.set(b, current);
    }
  }
  const ctx = (b: Block) => contextOf.get(b) ?? title;

  // Lists that are mostly "term – meaning" read every item that way (vocabulary lists).
  const relaxed = new WeakSet<Block>();
  {
    let run: TextBlock[] = [];
    let runCtx: Ctx | null = null;
    const close = () => {
      const defs = run.filter((b) => splitDefinition(b.line));
      if (defs.length >= 2 && defs.length >= run.length / 2) run.forEach((b) => relaxed.add(b));
      run = [];
      runCtx = null;
    };
    for (const b of flat) {
      if (b.type === "item" && runCtx && b.ctx.depth > runCtx.depth) continue;
      if (b.type === "item" && (!runCtx || b.ctx === runCtx)) {
        run.push(b);
        runCtx = b.ctx;
        continue;
      }
      close();
      if (b.type === "item") {
        run.push(b);
        runCtx = b.ctx;
      }
    }
    close();
  }

  // 1. Flashcard blocks and toggles: the student made these on purpose.
  for (const b of flat) {
    if (b.type === "flashcard" && b.front.length && b.back.length) {
      add(b, { source: "flashcard", front: b.front, back: b.back, context: ctx(b) }, b.id ? `fc-${b.id}`.slice(0, 64) : undefined);
    }
    if (b.type === "toggle" && b.summary.length) {
      const back = b.body.flatMap(blockLines).slice(0, MAX_ITEMS_ON_BACK + 2);
      if (back.length) add(b, { source: "toggle", front: [b.summary], back, context: ctx(b) });
    }
  }

  // 2. Definitions.
  for (const b of flat) {
    // Examples ("Beispiel: …") show how, they don't define anything.
    if (!isText(b) || b.ctx.toggle || /^(beispiel|example)/i.test(ctx(b))) continue;
    const lines = splitLines(b.line);
    const many = lines.length > 1 && lines.filter((l) => splitDefinition(l)).length >= lines.length / 2;
    for (const line of lines) {
      const def = splitDefinition(line, relaxed.has(b) || many);
      if (def) {
        const date = def.kind === "date";
        const term = plain(def.term);
        defined.add(key(term));
        used.add(b.line);
        add(b, {
          source: "definition",
          front: [def.term],
          back: [def.meaning],
          context: ctx(b),
          ...(date && { prompt: "@when" }),
          term,
          meaning: plain(def.meaning),
          group: date ? "date" : def.kind === "vocab" ? "vocab" : "def",
        });
        continue;
      }
      const heading = headingOf.get(b);
      const all = sentences(line);
      all.forEach((s, i) => {
        const found = boldDefinition(s) ?? (i === 0 && heading && !genericHeading(heading) ? headingDefinition(s, heading) : null) ?? leadIn(s, all.slice(i + 1));
        if (!found) return;
        const term = plain(found.term);
        if (defined.has(key(term))) return;
        defined.add(key(term));
        used.add(b.line);
        add(b, { source: "definition", front: [found.term], back: found.meaning.length ? [found.meaning] : [], context: ctx(b), term, meaning: plain(found.meaning), group: "def" });
      });
    }
  }
  // Definition callouts without a pattern: their bold term and the text.
  for (const b of flat) {
    if (b.type !== "callout" || b.kind !== "definition") continue;
    const lines = b.body.flatMap(blockLines);
    if (!lines.length || b.body.some((x) => isText(x) && used.has(x.line))) continue;
    const bold = lines.flat().find((s) => s.bold && !s.math && words(s.text).length <= 5);
    const front = bold ? trimLine([bold]) : [];
    if (!front.length || defined.has(key(plain(front)))) continue;
    defined.add(key(plain(front)));
    add(b, { source: "definition", front: [front], back: lines.slice(0, 4), context: ctx(b), term: plain(front), meaning: lines.map(plain).join(" "), group: "def" });
  }

  // 3. Questions and their answers: a line ending in "?" and what follows it.
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    if (!isText(b) || b.ctx.toggle) continue;
    const q = plain(b.line);
    if (!q.endsWith("?") || q.length > 200 || q.length < 6) continue;
    const answer: Line[] = [];
    for (let j = i + 1; j < flat.length && answer.length < MAX_ITEMS_ON_BACK; j++) {
      const n = flat[j];
      if (!isText(n) && n.type !== "math") break;
      if (isText(n) && plain(n.line).endsWith("?")) break;
      if (n.type === "item" && b.type === "item" && n.ctx.depth <= b.ctx.depth) break;
      answer.push(n.type === "math" ? [{ text: n.src, math: true }] : n.line);
      if (n.type === "para") break;
    }
    if (!answer.length) continue;
    used.add(b.line);
    add(b, { source: "question", front: [b.line], back: answer, context: ctx(b) });
  }

  // 4. Tables: the first column, asked for each other column.
  for (const b of flat) {
    if (b.type !== "table" || b.rows.length < 2) continue;
    const width = Math.max(...b.rows.map((r) => r.length));
    if (width < 2) continue;
    const head = b.header || b.rows[0].every((c) => c.length && c.every((s) => s.bold)) ? b.rows[0] : null;
    const body = head ? b.rows.slice(1) : b.rows;
    const firstHead = head ? plain(head[0] ?? []) : "";
    for (const row of body) {
      const cell0 = row[0] ?? [];
      const term = plain(cell0);
      if (!term || term.length > 80) continue;
      // A number in the first column ("0–6") reads better with its column's name: "pH-Wert 0–6".
      const front: Line = firstHead && /^[\d\s–\-.,<>≤≥%]+$/.test(term) ? [{ text: `${firstHead} ` }, ...cell0] : cell0;
      if (!head) {
        const rest = row.slice(1).filter((c) => c.length);
        if (!rest.length) continue;
        const back = [rest.reduce<Line>((acc, c, i) => (i ? [...acc, { text: " · " }, ...c] : c), [])];
        add(b, { source: "table", front: [front], back, context: ctx(b), term, meaning: plain(back[0]), group: "col:" });
        continue;
      }
      for (let c = 1; c < row.length; c++) {
        const cell = row[c];
        const prompt = plain(head[c] ?? []);
        if (!cell?.length || !prompt) continue;
        add(b, { source: "table", front: [front], back: [cell], prompt, context: ctx(b), term: plain(front), meaning: plain(cell), group: `col:${key(prompt)}` });
      }
    }
  }

  // 5. Formulas with a name: "Ohmsches Gesetz:" (or the heading) above a formula.
  for (let i = 1; i < flat.length; i++) {
    const b = flat[i];
    if (b.type !== "math") continue;
    const prev = flat[i - 1];
    const prevText = isText(prev) ? plain(prev.line) : "";
    const heading = ctx(b);
    let label = "";
    // A word equation above its formula ("Kohlenstoffdioxid + Wasser → Glucose + Sauerstoff") asks for the formula.
    if (isText(prev) && prev.line.every((x) => !x.math) && prevText.length <= 140 && /\s(\+|→|->)\s/.test(prevText)) label = prevText.replace(/[:.]$/, "");
    else if (prevText && prevText.length <= 50 && words(prevText).length <= 5 && (prevText.endsWith(":") || !VERBS.test(prevText))) label = prevText.replace(/[:.]$/, "");
    else if (heading && heading !== title && !genericHeading(heading)) label = heading;
    if (!label || label.endsWith("?")) continue;
    add(b, { source: "formula", front: [[{ text: label }]], back: [[{ text: b.src, math: true }]], context: heading, term: label, meaning: plainMath(b.src), group: "formula" });
  }

  // 6. Lists under a heading or a "…:" line: "Phasen der Mitose" → the four phases.
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    let front: Line;
    let depth = 0;
    let question = false;
    let j = i + 1;
    const items: Line[] = [];
    if (b.type === "heading") {
      const h = headingText(b.line);
      if (!h || h.length > 80 || genericHeading(h) || key(h) === key(title)) continue;
      front = b.line;
      question = h.endsWith("?");
      // An intro line ("Nur Pflanzenzellen haben:") belongs to the heading's card.
      const next = flat[j];
      if (isText(next) && next.type === "para" && plain(next.line).endsWith(":") && !splitDefinition(next.line)) {
        items.push(next.line);
        j++;
      }
    } else if (isText(b) && !b.ctx.toggle && plain(b.line).endsWith(":") && !splitDefinition(b.line)) {
      const prev = flat[i - 1];
      if (prev?.type === "heading" && !genericHeading(headingText(prev.line)) && key(headingText(prev.line)) !== key(title)) continue;
      const intro = plain(b.line).slice(0, -1);
      if (intro.length < 3 || intro.length > 100 || LABELS.has(key(intro))) continue;
      front = trimLine(sliceLine(b.line, 0, offsetText(b.line).lastIndexOf(":")));
      depth = b.type === "item" ? b.ctx.depth + 1 : 0;
    } else continue;
    const intro = items.length;
    let defs = 0;
    for (; j < flat.length; j++) {
      const n = flat[j];
      if (n.type === "item") {
        if (n.ctx.depth < depth) break;
        if (n.ctx.depth > depth) continue;
        // Items that define something show just their terms: their definitions are cards of their own.
        const def = splitDefinition(n.line, relaxed.has(n));
        if (def) defs++;
        items.push(def ? def.term : n.line);
      } else if (question && n.type === "para" && items.length < 2 && plain(n.line).length < 600) {
        // An answer of three sentences at most: a card is for remembering, not for rereading.
        const ss = sentences(n.line);
        items.push(ss.length > 3 ? ss.slice(0, 3).reduce<Line>((acc, l, k) => (k ? [...acc, { text: " " }, ...l] : l), []) : n.line);
      } else break;
    }
    const listed = items.length - intro;
    if (!(listed >= 2 || (question && listed >= 1))) continue;
    // A glossary ("Begriffe", vocabulary, dates) is better learned item by item.
    if (defs === listed && (listed > 4 || b.type !== "heading")) continue;
    const back = items.slice(0, MAX_ITEMS_ON_BACK + intro);
    if (items.length > back.length) back.push([{ text: "…" }]);
    add(b, { source: question ? "question" : "list", front: [front], back, context: b.type === "heading" ? (contextOf.get(flat[i - 1] ?? b) ?? title) : ctx(b) });
  }

  // 7. Cloze: bold or highlighted words in a sentence ("Diesen Vorgang nennt man ___" keeps the sentence before it).
  for (const b of flat) {
    if (!isText(b) || b.ctx.toggle) continue;
    for (const line of splitLines(b.line)) {
      const all = sentences(line);
      const isDefinition = Boolean(splitDefinition(line, relaxed.has(b)));
      all.forEach((s, si) => {
        const text = plain(s);
        if (words(text).length < 4 || text.length > 320 || text.endsWith("?")) return;
        const before = si > 0 && needsContext(text) ? all[si - 1] : null;
        s.forEach((seg, i) => {
          if (clozes >= MAX_CLOZES || seg.math || !(seg.bold || seg.mark)) return;
          const term = seg.text.trim();
          if (!goodClozeTerm(term, lang) || term.length > text.length * 0.6) return;
          // The term of a "Begriff: Erklärung" line is a card already.
          if (isDefinition && defined.has(key(term))) return;
          const lead = seg.text.match(/^\s*/)?.[0] ?? "";
          const tail = seg.text.match(/\s*$/)?.[0] ?? "";
          const gap: Line = s.flatMap((x, k): Line => (k === i ? [{ text: lead }, { text: term, blank: true }, { text: tail }] : [{ ...x, mark: false }]));
          const shown: Line = s.map((x, k) => (k === i ? { ...x, bold: true, mark: true } : { ...x, mark: false }));
          const prefix = before ? [before.map((x) => ({ ...x, mark: false }))] : [];
          clozes++;
          add(b, { source: "cloze", front: [...prefix, trimLine(gap)], back: [...prefix, trimLine(shown)], context: ctx(b), answer: term });
        });
      });
    }
  }

  // The same question twice keeps the better source; a cloze asking for a defined term goes.
  const best = new Map<string, Card>();
  const dedupe = (c: Card) => (c.source === "cloze" ? c.id : `${fold(withoutArticle(plain(c.front.flat()))).replace(/[\s.,;:!?]+/g, " ").trim()}|${c.prompt ?? ""}`);
  for (const c of cards) {
    const k = dedupe(c);
    const seen = best.get(k);
    if (!seen || RANK[c.source] < RANK[seen.source]) best.set(k, c);
  }
  const ids = new Set<string>();
  cards.sort((a, b) => a.order - b.order);
  return cards.filter((c) => {
    if (best.get(dedupe(c)) !== c || ids.has(c.id)) return false;
    if (c.source === "cloze" && c.answer && defined.has(key(c.answer))) return false;
    ids.add(c.id);
    return true;
  });
}

/** Term and meaning pairs of a note, with its language (quiz answers from other notes). */
export function termsOf(doc: unknown, title = ""): { term: string; meaning: string; group: string; lang: Lang }[] {
  const cards = makeCards(doc, title);
  const lang = detectLang(docText(doc));
  return cards.filter((c) => c.term && c.meaning && c.group).map((c) => ({ term: c.term!, meaning: c.meaning!, group: c.group!, lang }));
}
