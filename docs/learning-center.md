# The learning center: how it is built and how to add lessons

Blob's learning center (`/learn`) teaches maths, chemistry and biology. Every topic has three levels
(1 Beginner / Einsteiger, 2 Intermediate / Fortgeschritten, 3 Expert / Experte), and each level has its own
lesson, cheat sheet (Spickzettel) and endless practice. This guide is for whoever writes the next topics,
people or AI agents. Run `npm run check:learn` before every commit (see [Checks](#checks-before-committing)).

## How it is built

| Where | What |
| --- | --- |
| `src/learn/catalog.ts` | Plain data about every topic (`TopicMeta`): slug, subject, title, German school name, area, card blurb, glyph or icon, and per level `depth`, `blurb`, `minutes`. Safe for server components. Also `SUBJECTS`, hrefs, `upNext`. |
| `src/learn/types.ts` | `Topic`, `LevelLesson`, `LessonStep`, `Exercise`, `AnswerSpec`, `Mistake`, `Frame`, `SummaryBlock`, `Level`/`LEVELS`, `Area` and `AREAS` (area names). |
| `src/learn/topics/index.ts` | The loader registry: `loadTopic(slug)` / `useTopic(slug)` import a topic's client chunk on demand. Maths loaders live here; `CHEMISTRY_LOADERS` (`src/learn/chemistry/topics/index.ts`) and `BIOLOGY_LOADERS` (`src/learn/biology/topics/index.ts`) are spread in. |
| `src/learn/topics/<slug>/` | Maths topics: `index.tsx` + `level1.tsx`, `level2.tsx`, `level3.tsx` + any helpers and widgets. |
| `src/learn/biology/topics/<slug>/` | Biology topics, same layout (often with `data.ts`, `kit.ts`, `levelN-tasks.ts`). Drawings and widgets in `src/learn/biology/visuals/<Topic><Name>.tsx`, built on `src/learn/biology/Figure.tsx`. |
| `src/learn/chemistry/topics/<slug>.tsx` | Chemistry topics, still one lesson each (`SingleLessonTopic`), plus the chemistry engine in `src/learn/chemistry/` (`elements.ts`, `formula.ts`, `check.ts`, `format.ts`) and `visuals/` (`PeriodicTable`, `AtomShells`…). |
| `src/learn/engine/` | `display.ts` (the maths display language), `expr.ts` (expressions), `answers.ts` (`check()`), `diagnose.ts` (generic mistake diagnosis), `arrange.ts` (order/match), `rng.ts` (seeded random), `terms.ts`, `poly.ts`, `frac.ts`. |
| `src/learn/components/` | UI: `LearnHome`, `TopicView`, `LessonPlayer`, `PracticePlayer`, `ExerciseCard`, `AnswerInput`, `ArrangeInputs`, `MathView`, `Rich`, `ShowViews`. |
| `src/learn/visuals/` | Shared maths pictures: `Graph.tsx`, `NumberLine.tsx`, `LinesGraph.tsx`. |
| `src/learn/showcase.ts`, `scripts/show-manifest.ts`, `src/learn/show-manifest.json` | Public picture pages (see [Public picture links](#public-picture-links)). |

Routes: `/learn` and `/learn/<subject>` (hub), `/learn/<subject>/<slug>?level=N` (topic page),
`/study/<subject>/<slug>/lesson?level=N`, `/study/<subject>/<slug>/practice?level=N` (`&mode=test`: quick
test of 8 tasks), `/show/<subject>/<slug>/<level>/<id>` and `/embed/…` (public pictures, no sign-in).

How the pieces meet:

- The catalog decides what exists and what is shown. **A level's lesson is visible only when its catalog
  entry has `minutes`**; without them the topic page says "coming soon". Practice and the quick test are
  offered at **every** level, so `generate(level, rng)` must give good tasks for 1, 2 and 3 from day one.
- The order of the entries is the suggested order (`upNext` picks the first lesson not done yet).
- Progress is stored per slug (`learn_progress.topic` = `<slug>`, per level `<slug>@<level>`), so slugs are
  unique across all subjects and must never change once live.
- A topic file spreads its catalog entry: `{ ...topicMeta("<slug>"), lessons, generate }`. Text lives in the
  topic, metadata in the catalog.
- The hub, the topic page, the landing topic grid, the command palette and the `/show` gallery all read
  `SUBJECTS`, `CATALOG`, `AREAS` and `LEVELS` instead of keeping their own lists, so a new topic or subject
  shows up everywhere once it is in the catalog.

## Add a topic to an existing subject

### 1. Catalog entry (`src/learn/catalog.ts`)

Add an entry to `MATHS_ENTRIES` or `BIOLOGY_ENTRIES` at the place it should be suggested:

```ts
{
  slug: "circle-theorems", title: L("Circle theorems", "Kreissätze"), de: "Satz des Thales", area: "geometry",
  glyph: "\\angle 90 \\deg",        // display-language picture for the card, or icon: "<name>" (biology)
  blurb: L("One sentence for the card.", "Ein Satz für die Karte."),
  levels: {
    1: { depth: G(7, 8), minutes: 9, blurb: L("What exactly level 1 teaches.", "Was Stufe 1 genau lehrt.") },
    2: { depth: G(8, 9), blurb: L("…", "…") },                 // no minutes yet: "coming soon", practice only
    3: { depth: UP10, blurb: L("…", "…") },
  },
},
```

- `slug`: lowercase words joined by `-`, unique across all subjects, never renamed later.
- `de`: the name German students know from class; English readers see it as a subtitle.
- `area`: one of the subject's areas (`SUBJECTS[…].areas`, names in `AREAS` in `types.ts`).
- Per level: `depth` (school year, built with `G(a, b)`, `UP`, `UP10`, `UPU`), `blurb` (one sentence: the
  lesson must deliver exactly this), `minutes` (only when the lesson is finished).
- `icon` names come from the `ICONS` map in `src/learn/components/TopicGlyph.tsx` (lucide icons); add one
  there if you need a new picture. Without `icon` the card shows `glyph`.

### 2. Files and loader

Maths: `src/learn/topics/<slug>/`; biology: `src/learn/biology/topics/<slug>/`. Every `.tsx` starts with
`"use client";`.

```tsx
// index.tsx
"use client";
import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";
import { generate1, level1 } from "./level1";
import { generate2, level2 } from "./level2";
import { generate3, level3 } from "./level3";

const topic: Topic = {
  ...topicMeta("<slug>"),
  lessons: { 1: level1, 2: level2, 3: level3 },  // leave a level out while it is not written
  generate: (level, rng) => (level === 1 ? generate1(rng) : level === 2 ? generate2(rng) : generate3(rng)),
};
export default topic;
```

Each `levelN.tsx` exports `levelN: LevelLesson` (`{ lesson: LessonStep[]; summary: SummaryBlock[] }`) and
`generateN(rng: Rng): Exercise`. Split big levels (`levelN-tasks.ts`, `data.ts`, widget files) inside the
folder. Register the loader in the subject's list, in catalog order:
`MATHS_LOADERS` in `src/learn/topics/index.ts`, `BIOLOGY_LOADERS` in `src/learn/biology/topics/index.ts`:
`"<slug>": () => import("./<slug>"),`.

While a level is unwritten, leave it out of `lessons` and let `generate` hand that level the nearest written
level's tasks. Never ship placeholder tasks (students see them in practice).

**Chemistry** topics are single-lesson topics: a `SingleEntry` in `CHEMISTRY_ENTRIES` (`minutes`,
`lessonLevel`) and a file `src/learn/chemistry/topics/<slug>.tsx` exporting a `SingleLessonTopic`
(`{ ...topicMeta(slug), summary, lesson, generate }`); `withLevels()` puts the lesson at `lessonLevel`.
To give a chemistry topic all three levels, do what maths did: turn its entry into a full entry with
`levels`, keep its old level in `LEGACY_LESSON_LEVEL` (like `MATHS_LEGACY`) so old progress keeps counting, and
turn the file into a folder with `index.tsx` and level files.

### 3. A level's lesson (`LessonStep[]`, 7–11 steps)

- `explain`: `title`, `body` (rich text), optional animated `frames` and an optional `visual`
  (`{ component, props }`, drawn above the frames). Each "Next" shows the next frame.
- `widget`: `title`, `body`, `widget: ComponentType` (no props): something the student can **do**. At least
  one per level, two is better.
- `check`: a fixed `exercise` with hint, worked solution and mistakes. 3–4 per level.
- `blob`: Blob's line when the step opens, on most steps: warm, short, a bit playful (Blob is a purple jelly
  with glasses, the tutor).
- Levels build on each other and never repeat the same lesson with bigger numbers. Level 3 really teaches the
  harder content (Oberstufe terms where they apply). Content is German school content (Kernlehrpläne).

**Frames** (`{ math, note?, highlight?, arrows? }`): tokens with the same key glide to their new place, new
ones fade in, removed ones fade out. Leaves get keys like `x#0`, `+#1`, `−#0` (the minus key uses `−`); set
your own with `3#a x#b` so the right tokens move, and **always put a space after a key** (`-#s 8#c`, never
`-#s8#c`). Brackets add `<key>(` and `<key>)`, fraction bars `<key>-bar`, roots `<key>-rad`. `highlight`
lists keys, `arrows` pairs `[fromKey, toKey]`. Every frame gets a `note` (one or two short sentences).

**Cheat sheet** (`SummaryBlock[]`, 4–6 blocks): `{ title, body?, examples?, tone: "rule" | "tip" | "warning" }`;
`examples` are display-language lines (short: they render big). The topic page prints it.

### 4. Practice: `generateN(rng)`

- Use **only** `rng` for randomness: `rng.int(a, b)`, `rng.nonZero(a, b)`, `rng.pick(list)`,
  `rng.shuffle(list)`, `rng.chance(p)`, `rng.sign()` (`src/learn/engine/rng.ts`). The server renders the
  first task from a seed and the browser rebuilds it from the same seed: no `Math.random`, `Date` or state
  outside the function.
- For coordinates of anything drawn use `sin`, `cos`, `pow` from `src/lib/stableMath.ts` (Node and browsers
  differ in the last bit; `Math.*` would break hydration). Other `Math` functions are fine.
- At least 3 task shapes per level (different `instruction`s: solve, find the mistake, which is equal, fill
  the gap, read the graph, a word problem…; biology aims for 6), drawn from curated banks, many different
  tasks. Friendly numbers unless the level is about calculator work (then say how to round and give
  `tolerance`). Reject degenerate tasks in a retry loop. Shuffle options so the right one moves.
- Level 1 tasks need only level 1 knowledge; level 3 tasks are exam style.
- Every exercise: `instruction` (short imperative), `math` and/or `text` (rich) and/or `visual`, `answer`,
  `hint` (a nudge), `solution` (frames: a full worked solution, each frame with a `note`), `mistakes`.

### 5. Answers and typical mistakes

`AnswerSpec` kinds (`src/learn/types.ts`, checked in `src/learn/engine/answers.ts`; read what each accepts
before relying on it):

| kind | fields | the student |
| --- | --- | --- |
| `number` | `value`, `tolerance?` (relative), `unit?`, `label?` | types a number (`2,5`, `2.5`, `5/2`, unit optional) |
| `fraction` | `n`, `d`, `mustReduce?` | fills numerator and denominator |
| `expr` | `value`, `form?` (`any`/`expanded`/`simplified`), `positive?`, `prefix?` (`"y ="`) | types an expression, compared by value |
| `solutions` | `variable`, `values` (`[]` = no solution), `allowNone?` | types all solutions |
| `inequality` | `variable`, `op`, `value` | picks < > ≤ ≥ and types the boundary |
| `pair` | `names`, `values` | types two values (x and y, m and b) |
| `choice` / `multi` | `options` (rich text), `correct` | picks one / all that apply |
| `formula` / `balance` | `value` / `equation`, `coefficients` | types a chemical formula / balances an equation |
| `word` | `accept` (`tx` spellings, extra entries for synonyms), `exact?` | types a term in either language |
| `order` | `items` in the **correct** order | sorts shuffled cards |
| `match` | `pairs`, `distractors?` | gives each left card its partner |

`mistakes: Mistake[]` (`{ when, title?, say, close? }`): the 1–4 misconceptions teachers really see for this
task shape, each **simulated from the task's own numbers**, so `when` is exactly what a student with that
misconception gets. `when` has the answer's `kind` (choice: the same options with the tempting wrong
`correct`; order: the wrongly ordered items as a subsequence; match: the wrong pairs). Add one only when it
differs from the right answer and from the other mistakes. `close: true` marks a small slip. Generic slips
(sign, like terms, rounding, swapped values, formula brackets, spelling…) are already diagnosed in
`engine/diagnose.ts`, `chemistry/check.ts` and `engine/arrange.ts`; add what only your topic knows.
References: `bracketMistakes()` in `src/learn/topics/brackets/level1.tsx`, `expandMistakes()` in
`src/learn/topics/expanding/level2.tsx`.

`say` is Blob speaking: start with recognition ("Ah, I see what happened!", „Ah, ich seh, was passiert ist!"),
name what the student did, point to the fix without giving the answer away, 1–2 sentences. `title` is a
2–5 word label ("Only one side divided" / „Nur eine Seite geteilt").

### 6. Widgets and pictures

- Self-contained: every widget and every explain `visual` gets its own public page, so it carries its own
  short labels and instructions and starts in a sensible state. The step `title` names it, the `body`
  explains it in two or three sentences.
- Smooth (`motion/react` springs), works with touch and keyboard, at 390 px, in light and dark mode;
  `useReducedMotion()` for loops. React Compiler lint rules apply: no `Math.random`/`Date.now` during render
  (randomness in event handlers or from a seeded rng), no ref reads in render, no setState in effects.
- Colours only from tokens: Tailwind (`bg-raised`, `bg-surface`, `border-line`, `text-ink`, `text-ink-2`,
  `text-ink-3`, `bg-blob`, `text-blob-ink`, `bg-blob-soft`, `text-ok`, `text-danger`, `shadow-card`) and CSS
  vars in SVG (`var(--ink)`, `var(--line)`, `var(--raised)`, `var(--blob)`, `var(--ok)`, `var(--danger)`,
  biology `var(--bio-…)`). Never fixed hex colours or greys. Text in SVG via `tx` and `useText()`.
- Reuse the kits: `Graph`, `NumberLine`, `LinesGraph` (maths), `Figure` with modes `names`/`explore`/
  `numbers`/`plain` and `ask` (biology), `PeriodicTable`, `AtomShells` (chemistry).
- Name new files after the topic: `src/learn/biology/visuals/<Topic><Name>.tsx`,
  `src/learn/chemistry/visuals/<Topic><Name>.tsx`, maths inside the topic folder or
  `src/learn/visuals/<Topic><Name>.tsx`.

### 7. The display language (`src/learn/engine/display.ts`)

Used by frames, `math`, cheat-sheet `examples`, glyphs, number labels, `expr` prefixes, and inline `$…$` in
rich text. Rich text (bodies, notes, hints, task texts, options, cards, Blob's lines, mistake messages) also
knows `**bold**`, and a blank line starts a paragraph. Titles, instructions, mistake titles, units and catalog
texts are plain text: write `a²`, not `$a^2$`, there.

```
3(x + 2) = 3x + 6      implicit products, ( ) [ ]          x^2  x^{n+1}  x_1      powers, subscripts
\frac{3}{4}  \sqrt{x}  \sqrt[3]{x}  \binom{n}{k}  \abs{x}  0,\overline{3}      "cm" "€"  plain text
* → ·   - → −   <= ≤   >= ≥   != ≠   +- ±   => ⇒   <=> ⇔   -> →
\pi \alpha \Delta \cdot \times \div \pm \le \ge \ne \approx \to \Rightarrow \infty \deg \in \Q \R …
\sin \cos \tan \log \lg \ln      \, \; \quad \\ (spaces, line break)     \{ 1; 2 \} (set)   \text{…}
\hl{..} \blob{..} \red{..} \green{..} \fade{..} \strike{..} \box{..} \group{..}   styles (keep keys)
\ce{2H2 + O2 -> 2H2O}  \ce{SO4^2-}  \ce{Ca(OH)2}  \ce{NaCl(aq)}      chemistry: subscripts, charges, states
```

Unknown commands render as their letters (`\leq` shows "leq"), and a closing bracket without its opening one
cuts off everything after it (German interval notation `]2; 5[` does that): `check:learn` finds both.

### 8. Two languages

Everything a student sees exists in German (the default) and English from the first line. German is the
primary language; English is the faithful school version (British terms are fine).

- `tx("English", "Deutsch")` makes a `Text` (`src/i18n/text.ts`); components resolve it with `useText()`
  (`src/i18n/useText.ts`), plain code with `resolveText(text, locale)`.
- A plain string only for text without words: maths, formulas, numbers, symbols, names.
- `txMap((t, locale) => …)` builds one sentence in both languages from parts:
  `` txMap((t) => `${t("Step", "Schritt")} ${n}`) ``. Use it for numbers and shared pieces; when word order
  or grammar differ, write two whole sentences with `tx` instead of gluing fragments.
- Decimal comma in German, point in English: `decText(v)` / `dec(v, locale)` in `src/learn/chemistry/format.ts`.
  Never put `2.5` into German text. Maths keeps both readable in answers (`2,5` and `2.5` are accepted).

German style:

- Address the student as **du**; friendly, short, natural German a 15-year-old would say, not a word-by-word
  translation. Blob stays Blob (a name, no article).
- Typography: „…“ quotes, „z. B.“, decimal comma, „Montag, 6. Oktober“, „14:30“. **No em dashes** (—) in
  either language: use a colon, a full stop or a spaced en dash ( – ). No emojis. Sentence case.
- German runs about 30 % longer: keep titles and option texts short.
- The terms German teachers use (Term, Klammer, ausklammern, Hauptnenner, Lösungsmenge L = {…},
  Diskriminante, Baumdiagramm, Gegenereignis, Stoffmenge, Edukte/Produkte, Zellkern, Mitose…). App words:
  Lektion, Üben, Schnelltest, Spickzettel, Stufe (Einsteiger, Fortgeschritten, Experte), Tipp, Lösungsweg,
  Prüfen, Weiter.

## Add a whole subject

Physics and English are listed as coming soon (`live: false`). To open one:

1. `src/learn/catalog.ts`: add the slug to `type Subject`, write `<SUBJECT>_ENTRIES: Entry[]` and
   `<SUBJECT>_CATALOG` (`.map((t) => ({ ...t, subject: "<slug>" }))`), and add it to `CATALOG` and
   `BY_SUBJECT`. In `SUBJECTS` set `live: true` and list `areas` in the order the hub shows them.
   `isSubject()` (routes) only lets live subjects through. Go live with at least one finished topic.
2. `src/learn/types.ts`: add the areas to `type Area` and give each a `title` and `blurb` in `AREAS`.
3. Topics in `src/learn/<subject>/topics/<slug>/` (as above), loaders in
   `src/learn/<subject>/topics/index.ts` (`export const <SUBJECT>_LOADERS`), spread into `LOADERS` in
   `src/learn/topics/index.ts`. Subject-wide engine code and drawings in `src/learn/<subject>/`.
4. Texts that name the subjects (both languages): `src/i18n/messages/landing.ts`: `meta.description`,
   `hero.body`, `learn.title`, `learn.body`, and `learn.topics.body` (one line per subject, a type error
   until it is there); `src/i18n/messages/show.ts`: `metaGalleryDescription`; the README.
5. Run `npm run check:learn -- <subject>`.

## Public picture links

Every `widget` step and every `explain` step with a `visual` has a public page at
`/show/<subject>/<slug>/<level>/<id>` (and `/embed/…` for iframes); teachers share these links. `showItems()`
in `src/learn/showcase.ts` lists them.

- The id is the step's `id`, or else the slug of its **English title** ("Drag the slope triangle" →
  `drag-the-slope-triangle`). Renaming a step therefore changes its link: give it `id: "<old id>"` to keep
  the link. Ids are unique per level (`check:learn` fails on two steps with the same id).
- Server pages (titles, link previews, the gallery, unknown ids) read `src/learn/show-manifest.json`, written by
  `scripts/show-manifest.ts`. It is rebuilt before every build (`prebuild`); after adding or renaming
  pictures run `npm run show-manifest` (it also lists links that would disappear) and commit the JSON.
  Never edit it by hand.

## Checks before committing

```bash
npm run check:learn                    # every topic, 200 tasks per level, ~25 s; exits 1 on problems
npm run check:learn -- <slug|subject>  # while writing (add --seeds 50 to be quicker, --verbose for details)
npm run typecheck
npx eslint <your files>
npm run show-manifest                  # after adding or renaming pictures; commit src/learn/show-manifest.json
```

`scripts/check-learn.ts` checks, for every topic in the catalog: the catalog entry (unique slug, a loader, a
live subject, bilingual names, a glyph that parses), a lesson and cheat sheet at every level that has
`minutes`, a non-empty English and German side for every text in lessons, cheat sheets and generated tasks,
that all display maths parses (frames, task maths, examples, inline `$…$`), that `--seeds` tasks per level
generate without throwing, are the same for the same seed, accept their own right answer and reject every
typical mistake while showing its message (also for the lesson's check steps), and that picture ids are unique
and valid. A practice problem names its rng seed: `topic.generate(level, createRng(seed))` rebuilds the task.
Warnings (a level without a widget, fewer than 2 checks, few task shapes, em dashes, a public link that
disappears) don't fail the run unless `--strict`; fix them unless you have a reason.

It can't judge facts, German quality, layout or how a widget feels. Before committing, open
`/study/<subject>/<slug>/lesson?level=N` and `/practice?level=N` for each level you wrote, in German and
English, in dark mode and at 390 px wide: frames morph sensibly, nothing overflows, widgets work, checks
accept the right answer and Blob's notes for 2–3 typical wrong answers read well.
