// Starting points for a new note (the "Template" chip of an empty note): lesson notes, Cornell notes,
// a lab report, a vocabulary list, an essay plan, a talk, exam prep and a book report, in the
// reader's language. Built as
// note content (Tiptap JSON) with the same blocks the editor makes.

import type { JSONContent } from "@tiptap/core";
import type { Locale } from "@/i18n/config";
import { templatesText } from "@/i18n/messages/templates";
import type { JNode } from "./doc";
import { callout, doc, heading, paragraph, table } from "./tiptap";

export type TemplateId = "lecture" | "cornell" | "lab" | "vocab" | "essay" | "talk" | "exam" | "book";
export const TEMPLATES: TemplateId[] = ["lecture", "cornell", "lab", "vocab", "essay", "talk", "exam", "book"];

const line = (text: string) => [{ text }];
const p = (text = "") => paragraph(text ? line(text) : []);
const h2 = (text: string) => heading(2, line(text));
const italic = (text: string): JNode => paragraph([{ text, italic: true }]);
const items = (type: "bulletList" | "orderedList", texts: string[]): JNode => ({ type, content: texts.map((t) => ({ type: "listItem", content: [p(t)] })) });
const todos = (texts: string[]): JNode => ({ type: "taskList", content: texts.map((t) => ({ type: "taskItem", attrs: { checked: false }, content: [p(t)] })) });
const card = (front: string, back: string): JNode => ({
  type: "flashcard",
  content: [
    { type: "flashcardFront", content: [p(front)] },
    { type: "flashcardBack", content: [p(back)] },
  ],
});

/** The template's content, ready to put into an empty note. */
export function templateDoc(id: TemplateId, locale: Locale): JSONContent {
  return build(id, templatesText[locale]) as JSONContent;
}

function build(id: TemplateId, t: (typeof templatesText)["en"]): JNode {
  switch (id) {
    case "lecture": {
      const x = t.lecture;
      return doc([p(x.date), h2(x.points), items("bulletList", [x.point, x.point, x.point]), h2(x.questions), todos([x.question]), callout("rule", [p(x.summary)])]);
    }
    case "cornell": {
      // Cues on the left, notes on the right; the summary goes underneath once the lesson is over.
      const x = t.cornell;
      const row = () => [[], []];
      const grid = table([x.columns.map(line), row(), row(), row(), row()], true);
      // A narrow cue column; the notes column takes the rest.
      for (const r of grid.content ?? []) {
        const cue = r.content?.[0];
        if (cue) cue.attrs = { ...cue.attrs, colwidth: [180] };
      }
      return doc([p(x.date), grid, h2(x.summary), italic(x.summaryHint)]);
    }
    case "lab": {
      const x = t.lab;
      return doc([
        h2(x.question),
        italic(x.questionHint),
        h2(x.hypothesis),
        italic(x.hypothesisHint),
        h2(x.materials),
        items("bulletList", ["", ""]),
        h2(x.procedure),
        items("orderedList", [`${x.step} 1`, `${x.step} 2`, `${x.step} 3`]),
        h2(x.observation),
        italic(x.observationHint),
        table([x.table.map(line), x.table.map(() => []), x.table.map(() => [])], true),
        h2(x.result),
        callout("rule", [p(x.conclusion)]),
      ]);
    }
    case "vocab": {
      const x = t.vocab;
      const empty = x.columns.map(() => []);
      return doc([table([x.columns.map(line), empty, empty, empty, empty], true), h2(x.cards), card(x.front, x.back), card(x.front, x.back)]);
    }
    case "essay": {
      const x = t.essay;
      return doc([
        h2(x.question),
        p(),
        callout("idea", [p(x.thesis)]),
        h2(x.intro),
        italic(x.introHint),
        h2(x.pro),
        items("orderedList", [x.argument, x.argument]),
        h2(x.contra),
        items("orderedList", [x.argument, x.argument]),
        h2(x.conclusion),
        italic(x.conclusionHint),
      ]);
    }
    case "talk": {
      const x = t.talk;
      return doc([
        h2(x.topic),
        italic(x.topicHint),
        h2(x.outline),
        items("orderedList", [x.intro, x.main, x.end]),
        h2(x.sources),
        items("bulletList", ["", ""]),
        h2(x.cards),
        callout("idea", [p(x.cardsHint)]),
        h2(x.questions),
        todos([x.question]),
      ]);
    }
    case "exam": {
      const x = t.exam;
      return doc([p(x.date), h2(x.topics), todos([`${x.topic} 1`, `${x.topic} 2`, `${x.topic} 3`]), h2(x.rules), callout("rule", [p(x.rule)]), h2(x.cards), card(x.front, x.back), card(x.front, x.back)]);
    }
    case "book": {
      const x = t.book;
      return doc([
        h2(x.facts),
        items("bulletList", [x.author, x.year, x.genre]),
        h2(x.characters),
        items("bulletList", ["", ""]),
        h2(x.plot),
        p(),
        h2(x.quote),
        { type: "blockquote", content: [p()] },
        h2(x.opinion),
        p(),
      ]);
    }
  }
}
