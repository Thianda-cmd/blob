// A live quiz from a note: the same questions the note's own quiz asks (src/notes/study/quiz.ts),
// as live questions. Multiple choice stays multiple choice, a short gap is typed, "true or false"
// stays that. Formulas are left out (the big screen doesn't draw maths), and so is anything too
// long for a tile. The wording follows the note's language, not the screen's.

import { plain, type Line } from "@/notes/doc";
import { makeCards } from "@/notes/study/cards";
import { makeQuiz, type Question as StudyQuestion } from "@/notes/study/quiz";
import { detectLang, type Lang } from "@/notes/text";
import { quizText } from "@/i18n/messages/quiz";
import { LIMITS, newId, type Question } from "./model";

const MAX_QUESTIONS = 20;

const text = (lines: Line[]) => lines.map(plain).filter(Boolean).join(" · ");

const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

function convert(s: StudyQuestion, lang: Lang): Question | null {
  const w = quizText[lang];
  const prompt = text(s.prompt);
  if (!prompt) return null;
  const base: Question = { id: newId(), type: "quiz", text: "", image: null, time: 20, points: "standard", choices: [], multi: false, accepted: [], slider: null, explain: "" };
  const c = s.card;
  // Shown with the answer: the whole definition or sentence.
  const explain = c.term && c.meaning ? `${c.term}: ${c.meaning}` : text(c.back);
  base.explain = explain.length <= LIMITS.explain ? explain : "";

  if (s.kind === "choice") {
    if (s.ask === "formula") return null;
    const options = s.options.map(plain);
    if (options.some((o) => !o || o.length > LIMITS.choice)) return null;
    const ask = w.fromNote.ask;
    base.text = s.ask === "term" ? ask.term(prompt) : s.ask === "meaning" ? ask.meaning(prompt) : s.ask === "column" ? ask.column(s.column ?? "", prompt) : s.ask === "date" ? ask.date(prompt) : prompt;
    base.choices = options.map((o, i) => ({ id: newId(), text: o, correct: i === s.correct }));
  } else if (s.kind === "type") {
    if (s.answer.length > LIMITS.acceptedLength) return null;
    base.type = "type";
    base.time = 30;
    base.text = prompt;
    base.accepted = [s.answer];
  } else {
    const statement = text(s.statement);
    if (!statement) return null;
    base.type = "truefalse";
    base.time = 20;
    base.text = w.fromNote.ask.truefalse(prompt, statement);
    // A true statement is its own explanation.
    if (s.truth) base.explain = "";
    base.choices = [
      { id: newId(), text: w.true, correct: s.truth },
      { id: newId(), text: w.false, correct: !s.truth },
    ];
  }
  if (base.text.length > LIMITS.text) return null;
  return base;
}

/** Up to 20 live questions from a note, in the note's language (empty when it has nothing to ask). */
export function quizFromNote(content: unknown, title: string, seed = Date.now() % 100_000): { lang: Lang; title: string; description: string; questions: Question[] } {
  const cards = makeCards(content, title).filter((c) => c.front.length && c.back.length);
  const lang = detectLang(cards.map((c) => `${text(c.front)} ${text(c.back)}`).join(" "));
  const questions = makeQuiz(cards, [], { seed, count: MAX_QUESTIONS + 10, lang })
    .map((q) => convert(q, lang))
    .filter((q): q is Question => q !== null)
    .slice(0, MAX_QUESTIONS);
  const name = title.trim() || quizText[lang].untitled;
  return { lang, title: cut(name, LIMITS.title), description: cut(quizText[lang].fromNote.description(name), LIMITS.description), questions };
}
