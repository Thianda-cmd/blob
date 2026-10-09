// An extractive summary of a note: its structure (headings), the most important sentences of each
// section (ranked by the words the note keeps coming back to, bold terms, definitions, rules and
// position), the key terms with their meaning, dates and formulas. Nothing is made up: every line
// is the student's own text.

import { flatBlocks, plain, splitLines, toBlocks, type Block, type CalloutKind, type Line } from "../doc";
import { contentWords, detectLang, fold, needsContext, sentences, stem, type Lang } from "../text";
import { makeCards, type Card } from "./cards";

export type Point =
  | { kind: "sentence" | "item"; line: Line; depth: number }
  /** A rule, definition or warning from a callout (kept whole). */
  | { kind: "rule"; line: Line; depth: number; callout: CalloutKind }
  | { kind: "math"; src: string; label?: string }
  | { kind: "table"; rows: Line[][]; header: boolean };

export type Section = { heading: Line | null; level: number; points: Point[] };

export type Summary = {
  lang: Lang;
  /** The three sentences that say the most. */
  gist: Line[];
  sections: Section[];
  terms: { term: Line; meaning: Line }[];
  dates: { date: Line; event: Line }[];
  formulas: { label: string; src: string }[];
  stats: { words: number; keptWords: number; sentences: number; keptSentences: number };
};

/** Sections that are about organising, not about the subject. */
const SKIP_SECTIONS = /^(hausaufgaben?|aufgaben|todo|to do|homework|tasks|quellen|sources|literatur)$/i;

type Scored = { line: Line; score: number; order: number; prev?: Scored; depth: number; para: number };

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function summarize(doc: unknown, title = "", cards?: Card[]): Summary {
  const blocks = toBlocks(doc);
  const flat = flatBlocks(blocks);
  const allText = flat.map((b) => ("line" in b ? plain(b.line) : "")).join(" ");
  const lang = detectLang(allText);

  // How often the note uses each word (stems): the words it keeps coming back to matter.
  const freq = new Map<string, number>();
  for (const w of contentWords(`${title} ${allText}`)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const max = Math.max(1, ...freq.values());
  const titleWords = new Set(contentWords(title));

  const scoreSentence = (s: Line, headingWords: Set<string>, first: boolean, inRule: boolean) => {
    const text = plain(s);
    const ws = contentWords(text);
    const unique = new Set(ws);
    let score = 0;
    unique.forEach((w) => {
      score += (freq.get(w) ?? 0) / max;
      if (headingWords.has(w)) score += 0.4;
      if (titleWords.has(w)) score += 0.3;
    });
    score /= Math.sqrt(Math.max(4, words(text)));
    score += s.filter((x) => (x.bold || x.mark) && !x.math).length * 0.6;
    if (s.some((x) => x.math)) score += 0.3;
    if (/\d{3,4}/.test(text)) score += 0.2;
    if (/\s(ist|sind|bezeichnet|heißt|nennt man|is|are|means|is called)\s/i.test(text)) score += 0.35;
    // "Diesen Vorgang nennt man **Plasmolyse**.": a name for something is worth keeping.
    if (/(nennt man|heißt|bezeichnet man als|spricht man von|is called|are called|is known as)\s+\S*\s*$/i.test(text.replace(/[.!]$/, "")) && s.some((x) => x.bold || x.mark)) score += 1;
    if (first) score += 0.5;
    if (inRule) score += 1.5;
    if (text.endsWith("?")) score -= 0.8;
    if (needsContext(text)) score -= 0.15;
    if (words(text) < 4) score -= 0.6;
    if (words(text) > 40) score -= 0.4;
    return score;
  };

  // Sections: everything under a heading, until the next one.
  type Raw = { heading: Line | null; level: number; blocks: Block[] };
  const raw: Raw[] = [{ heading: null, level: 0, blocks: [] }];
  for (const b of blocks) {
    if (b.type === "heading") raw.push({ heading: b.line, level: b.level, blocks: [] });
    else raw[raw.length - 1].blocks.push(b);
  }

  let totalSentences = 0;
  let keptSentences = 0;
  let totalWords = 0;
  let keptWords = 0;
  const gistPool: Scored[] = [];
  let order = 0;
  let paraId = 0;

  const sections: Section[] = [];
  for (const sec of raw) {
    const headingText = sec.heading ? plain(sec.heading) : "";
    if (SKIP_SECTIONS.test(headingText.replace(/[:.]$/, ""))) continue;
    const headingWords = new Set(headingText ? contentWords(headingText).map(stem) : []);
    // Each point with its place in the note, so the kept sentences slot back in between the lists.
    const points: { order: number; point: Point }[] = [];
    const candidates: Scored[] = [];
    // Paragraphs right before a list.
    const introduces = new Set<number>();
    let firstSentence = true;

    const visit = (b: Block, rule: CalloutKind | null, depth: number) => {
      const inRule = rule !== null;
      switch (b.type) {
        case "para": {
          const para = paraId++;
          for (const l of splitLines(b.line)) {
            let prev: Scored | undefined;
            for (const s of sentences(l)) {
              const text = plain(s);
              totalSentences++;
              totalWords += words(text);
              const sc = { line: s, score: scoreSentence(s, headingWords, firstSentence, inRule), order: order++, depth, prev, para };
              prev = sc;
              firstSentence = false;
              if (inRule) {
                points.push({ order: sc.order, point: { kind: "rule", line: s, depth, callout: rule } });
                keptSentences++;
                keptWords += words(text);
              } else candidates.push(sc);
              gistPool.push(sc);
            }
          }
          break;
        }
        case "item": {
          if (b.task) break;
          const text = plain(b.line);
          totalWords += words(text);
          // Long items keep their first sentence.
          const first = sentences(b.line)[0] ?? b.line;
          const line = words(text) > 30 ? first : b.line;
          keptWords += words(plain(line));
          points.push({ order: order++, point: rule ? { kind: "rule", line, depth: b.ctx.depth + depth, callout: rule } : { kind: "item", line, depth: b.ctx.depth + depth } });
          break;
        }
        case "math":
          points.push({ order: order++, point: { kind: "math", src: b.src } });
          break;
        case "table":
          points.push({ order: order++, point: { kind: "table", rows: b.rows, header: b.header } });
          break;
        case "callout":
          // Rules, definitions and warnings always stay; examples go (the summary keeps the idea, not the practice).
          if (b.kind === "example") break;
          b.body.forEach((x) => visit(x, b.kind === "idea" ? rule : b.kind, depth));
          break;
        case "toggle":
          if (b.summary.length) points.push({ order: order++, point: { kind: "item", line: b.summary, depth: 0 } });
          b.body.forEach((x) => visit(x, rule, depth + 1));
          break;
        case "flashcard":
          if (b.front.length && b.back.length) points.push({ order: order++, point: { kind: "item", line: [...b.front[0], { text: " – " }, ...b.back.flatMap((l, i) => (i ? [{ text: " " }, ...l] : l))], depth: 0 } });
          break;
        default:
          break;
      }
    };
    sec.blocks.forEach((b, i) => {
      visit(b, null, 0);
      if (b.type === "para" && sec.blocks[i + 1]?.type === "item") introduces.add(paraId - 1);
    });

    // About two in five sentences of the section. Each paragraph is usually one idea, so first comes
    // the best sentence of every paragraph (with its next best when it's just a short lead-in like
    // "Hinzu kam ein starker Nationalismus."), then the best of the rest.
    const budget = Math.max(candidates.length ? 1 : 0, Math.round(candidates.length * 0.42));
    const byPara = new Map<number, Scored[]>();
    for (const c of candidates) byPara.set(c.para, [...(byPara.get(c.para) ?? []), c]);
    const firsts: Scored[] = [];
    for (const list of byPara.values()) {
      const ranked = [...list].sort((a, b) => b.score - a.score);
      firsts.push(ranked[0]);
      // A short lead-in brings the sentence that explains it (the one right after it).
      const follow = list[list.indexOf(ranked[0]) + 1] ?? ranked[1];
      if (words(plain(ranked[0].line)) < 9 && follow) firsts.push({ ...follow, score: ranked[0].score - 0.001 });
    }
    const queue = [...firsts.sort((a, b) => b.score - a.score), ...[...candidates].sort((a, b) => b.score - a.score)];
    const chosen = new Set<Scored>();
    const orders = new Set<number>();
    for (const c of queue) {
      if (chosen.size >= budget) break;
      if (orders.has(c.order)) continue;
      orders.add(c.order);
      chosen.add(candidates.find((x) => x.order === c.order)!);
    }
    for (const c of [...chosen]) if (c.prev && needsContext(plain(c.line))) chosen.add(c.prev);
    // A line that introduces a list ("Nur Pflanzenzellen haben:") stays with its list.
    for (const c of candidates) if (plain(c.line).endsWith(":") && introduces.has(c.para)) chosen.add(c);
    for (const s of chosen) {
      points.push({ order: s.order, point: { kind: "sentence", line: s.line, depth: 0 } });
      keptSentences++;
      keptWords += words(plain(s.line));
    }
    points.sort((a, b) => a.order - b.order);
    sections.push({ heading: sec.heading, level: sec.level, points: points.map((p) => p.point) });
  }
  // Headings stay when something is under them (in the section or a sub-section).
  const pruned = sections.filter((s, i) => {
    if (s.points.length) return true;
    if (!s.heading) return false;
    for (let j = i + 1; j < sections.length && sections[j].level > s.level; j++) if (sections[j].points.length) return true;
    return false;
  });

  const all = cards ?? makeCards(doc, title);
  const terms = all.filter((c) => c.source === "definition" && c.group !== "date").map((c) => ({ term: c.front[0], meaning: c.back[0] }));
  const dates = all.filter((c) => c.group === "date").map((c) => ({ date: c.back[0], event: c.front[0] }));
  const formulas: Summary["formulas"] = [];
  const seenFormula = new Set<string>();
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    if (b.type !== "math" || seenFormula.has(fold(b.src))) continue;
    seenFormula.add(fold(b.src));
    const card = all.find((c) => c.group === "formula" && c.back[0]?.[0]?.text === b.src);
    formulas.push({ label: card?.term ?? "", src: b.src });
  }

  const gist = [...gistPool]
    .filter((s) => words(plain(s.line)) >= 8 && !/[?:]$/.test(plain(s.line)) && !needsContext(plain(s.line)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order)
    .map((s) => s.line);

  return {
    lang,
    gist,
    sections: pruned,
    terms,
    dates,
    formulas,
    stats: { words: totalWords, keptWords: Math.min(keptWords, totalWords), sentences: totalSentences, keptSentences },
  };
}
