"use client";

import { motion } from "motion/react";
import { BookPlus, Check, Keyboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BlobHandle } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { acceptedOf, targetOf } from "../generate";
import { accentWords, explainFrench, fold, grade, norm, spotTokens } from "../text";
import type { Exercise, Lang, Sentence, Word } from "../types";
import { ALL_WORDS, bare } from "../course";
import { OptionCards, TileBoard, TypeBox } from "./inputs";
import { BlobSays, Prompt, Tappable, type Outcome } from "./parts";

/** What every exercise gets from the lesson. */
export type ExProps<K extends Exercise["kind"]> = {
  ex: Extract<Exercise, { kind: K }>;
  lang: Lang;
  /** Answered: no more changes. */
  locked: boolean;
  /** Ready to check (or not yet): the lesson's Check button runs this. */
  setCheck: (check: (() => Outcome) | null) => void;
  /** For exercises that finish on their own (pairs, speaking). */
  finish: (o: Outcome) => void;
  /** Check now (Enter in a text box). */
  submit: () => void;
  nouns: Map<string, Word>;
  blobRef: RefObject<BlobHandle | null>;
};

/** Grade a translation or dictation, with Blob's notes. */
export function gradeSentence(answer: string, s: Sentence, dir: "toFr" | "fromFr", lang: Lang, nouns: Map<string, Word>, notes: { accent: (w: string) => string; typo: (w: string) => string }): Outcome {
  const target = dir === "toFr" ? "fr" : lang;
  const g = grade(answer, acceptedOf(s, dir, lang), target);
  const meaning = dir === "toFr" ? s[lang] : undefined;
  switch (g.verdict) {
    case "correct":
      return { correct: true, verdict: "correct", meaning };
    case "accent":
      return { correct: true, verdict: "accent", solution: g.best, marks: g.marks, note: notes.accent(accentWords(answer, g.best, target).join(", ")), meaning };
    case "typo":
      return { correct: true, verdict: "typo", solution: g.best, marks: g.marks, note: notes.typo(accentWords(answer, g.best, target).join(", ")), meaning };
    default:
      return { correct: false, verdict: "wrong", solution: g.best, marks: g.marks, explain: target === "fr" ? explainFrench(answer, g.best, nouns) : null, meaning };
  }
}

/* -------------------------------------------------------------------------------------------
   A new word
   ------------------------------------------------------------------------------------------- */

export function IntroEx({ ex, lang, setCheck, blobRef }: ExProps<"intro">) {
  const t = useMessages(frenchText);
  const locale = useLocale();
  const w = ex.word;
  useEffect(() => {
    setCheck(() => ({ correct: true }));
    blobRef.current?.wave();
  }, [setCheck, blobRef]);
  const translation = [w[lang], ...(w.alt?.[lang] ?? []).slice(0, 2)].join(", ");
  return (
    <div>
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-blob-soft px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-blob-ink">
        <BookPlus className="size-3.5" /> {t.player.newWord}
      </span>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        className="flex flex-col items-center gap-4 rounded-3xl border-2 border-line bg-raised px-6 py-7 text-center shadow-card"
      >
        <div className="grid size-28 place-items-center rounded-3xl bg-blob-soft text-[64px] leading-none">{w.emoji ?? "💬"}</div>
        <div>
          <div lang="fr" className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em]">
            {w.fr}
          </div>
          {w.g && <div className={cn("mt-1 text-[12.5px] font-semibold uppercase tracking-wide", w.g === "f" ? "text-[#c05475]" : "text-[#3f78b3]")}>{t.genders[w.g]}</div>}
          <div className="mt-2 text-[18px] text-ink-2">{translation}</div>
        </div>
      </motion.div>
      {w.note && (
        <BlobSays className="mt-5" size={70} blobRef={blobRef}>
          <p className="text-[14.5px] leading-snug text-ink-2">{resolveText(w.note, locale)}</p>
        </BlobSays>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Which picture?
   ------------------------------------------------------------------------------------------- */

export function PictureEx({ ex, lang, locked, setCheck }: ExProps<"picture">) {
  const t = useMessages(frenchText).player;
  const [chosen, setChosen] = useState<number | null>(null);
  const right = ex.options.findIndex((o) => o.id === ex.word.id);
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      setCheck(() => (i === right ? { correct: true } : { correct: false, solution: `${ex.word.fr} = ${ex.word[lang]}` }));
    },
    [locked, ex, right, lang, setCheck],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!locked && n >= 1 && n <= ex.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, locked, ex.options.length]);
  return (
    <div>
      <Prompt>
        {t.whichPicture(ex.word.fr)}
      </Prompt>
      <div className={cn("grid gap-3", ex.options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        {ex.options.map((o, i) => {
          const on = chosen === i;
          const showRight = locked && i === right;
          const showWrong = locked && on && i !== right;
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => pick(i)}
              className={cn(
                "flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-b-[4px] p-3 transition-colors",
                showRight ? "border-ok bg-ok/10" : showWrong ? "border-danger/70 bg-danger/10" : on ? "border-blob bg-blob-soft" : "border-line bg-raised hover:bg-hover",
              )}
            >
              <span className="text-[52px] leading-none sm:text-[58px]">{o.emoji}</span>
              <span className={cn("text-[14.5px] font-medium", on ? "text-blob-ink" : "text-ink-2")}>{o[lang]}</span>
              <span className="text-[11px] text-ink-3">{i + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Pick the translation
   ------------------------------------------------------------------------------------------- */

export function ChoiceEx({ ex, lang, locked, setCheck, blobRef }: ExProps<"choice">) {
  const t = useMessages(frenchText).player;
  const [chosen, setChosen] = useState<number | null>(null);
  const s = ex.sentence;
  const right = ex.options.findIndex((o) => fold(o, ex.dir === "toFr" ? "fr" : lang) === fold(targetOf(s, ex.dir, lang), ex.dir === "toFr" ? "fr" : lang));
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      setCheck(() => (i === right ? { correct: true } : { correct: false, solution: ex.options[right] }));
    },
    [locked, right, ex.options, setCheck],
  );
  return (
    <div>
      <Prompt>{t.pickTranslation}</Prompt>
      {ex.dir === "fromFr" ? (
        <BlobSays blobRef={blobRef} className="mb-6">
          <Tappable text={s.fr} className="text-[19px] leading-relaxed" />
        </BlobSays>
      ) : (
        <BlobSays blobRef={blobRef} className="mb-6">
          <p className="text-[19px] leading-relaxed">{s[lang]}</p>
        </BlobSays>
      )}
      <OptionCards options={ex.options} chosen={chosen} locked={locked} onPick={pick} lang={ex.dir === "toFr" ? "fr" : lang} result={locked ? right : null} />
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Translate with tiles or by typing
   ------------------------------------------------------------------------------------------- */

export function SentenceEx({ ex, lang, locked, setCheck, submit, nouns, blobRef }: ExProps<"tiles"> | ExProps<"type">) {
  const t = useMessages(frenchText).player;
  const [keyboard, setKeyboard] = useState(ex.kind === "type");
  const s = ex.sentence;
  const toFr = ex.dir === "toFr";
  const notes = useMemo(() => ({ accent: t.accentNote, typo: t.typoNote }), [t]);
  const onAnswer = useCallback(
    (answer: string) => setCheck(answer.trim() ? () => gradeSentence(answer, s, ex.dir, lang, nouns, notes) : null),
    [setCheck, s, ex.dir, lang, nouns, notes],
  );
  return (
    <div>
      <Prompt>{toFr ? t.writeFrench : ex.kind === "type" ? t.writeOwn : t.translate}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-6">
        {toFr ? (
          <p className="text-[19px] leading-relaxed">{s[lang]}</p>
        ) : (
          <Tappable text={s.fr} className="text-[19px] leading-relaxed" />
        )}
      </BlobSays>
      {keyboard ? (
        <TypeBox french={toFr} locked={locked} onChange={onAnswer} onEnter={submit} placeholder={toFr ? t.typeFrench : t.typeHere} />
      ) : (
        <TileBoard tiles={(ex as Extract<Exercise, { kind: "tiles" }>).tiles} locked={locked} lang={toFr ? "fr" : lang} onChange={onAnswer} />
      )}
      {ex.kind === "tiles" && !locked && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setKeyboard((k) => !k);
              setCheck(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:hidden"
          >
            <Keyboard className="size-4" /> {keyboard ? t.useTiles : t.useKeyboard}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Fill the gap
   ------------------------------------------------------------------------------------------- */

export function BlankEx({ ex, lang, locked, setCheck, blobRef }: ExProps<"blank">) {
  const t = useMessages(frenchText).player;
  const locale = useLocale();
  const d = ex.drill;
  const [chosen, setChosen] = useState<number | null>(null);
  const [before, after] = d.fr.split("___");
  const full = `${before}${d.options[d.answer]}${after ?? ""}`;
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      setCheck(() =>
        i === d.answer
          ? { correct: true, meaning: d[lang] }
          : { correct: false, solution: full, explain: d.why, meaning: d[lang] },
      );
    },
    [locked, d, lang, full, setCheck],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!locked && n >= 1 && n <= d.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, locked, d.options.length]);
  return (
    <div>
      <Prompt>{t.blank}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-7">
        <div>
          <p lang="fr" className="text-[20px] leading-relaxed">
            {before}
            <span
              className={cn(
                "mx-0.5 inline-block min-w-[4.5rem] rounded-lg border-b-[3px] px-2 text-center font-semibold",
                chosen === null ? "border-ink-3 text-transparent" : locked ? (chosen === d.answer ? "border-ok text-ok" : "border-danger text-danger") : "border-blob text-blob-ink",
              )}
            >
              {chosen === null ? "____" : d.options[chosen]}
            </span>
            {after}
          </p>
        </div>
      </BlobSays>
      <div className="flex flex-wrap justify-center gap-2.5" lang="fr">
        {d.options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={locked}
            onClick={() => pick(i)}
            className={cn(
              "min-w-[5.5rem] rounded-xl border-2 border-b-[4px] px-4 py-2 text-[17px] font-medium transition-colors",
              chosen === i ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink hover:bg-hover",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {locked && chosen !== d.answer && <p className="sr-only">{resolveText(d.why, locale)}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Matching pairs
   ------------------------------------------------------------------------------------------- */

export function MatchEx({ ex, lang, finish, blobRef }: ExProps<"match">) {
  const t = useMessages(frenchText).player;
  const [left] = useState(() => ex.words);
  const [right] = useState(() => [...ex.words].sort((a, b) => (a[lang] < b[lang] ? -1 : 1)));
  const [pickL, setPickL] = useState<string | null>(null);
  const [pickR, setPickR] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<{ l: string; r: string; n: number } | null>(null);
  const mistakes = useRef(0);

  /** Both sides picked: a pair, or not. */
  function pair(l: string, r: string) {
    setPickL(null);
    setPickR(null);
    if (l === r) {
      const next = [...done, l];
      setDone(next);
      if (next.length === left.length) {
        blobRef.current?.jump(0.8);
        finish({ correct: mistakes.current === 0 });
      }
      return;
    }
    mistakes.current++;
    setBad({ l, r, n: mistakes.current });
    blobRef.current?.shake();
  }

  const cell = (id: string, side: "l" | "r") => {
    const matched = done.includes(id);
    const picked = side === "l" ? pickL === id : pickR === id;
    const wrong = bad && (side === "l" ? bad.l : bad.r) === id;
    return cn(
      "flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-b-[4px] px-3 py-2 text-center text-[16px] font-medium transition-colors",
      matched ? "border-line bg-hover text-ink-3 opacity-50" : wrong ? "border-danger/70 bg-danger/10" : picked ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink hover:bg-hover",
    );
  };
  // A wrong pair shakes once (keyed by the mistake number so it can shake again).
  const shake = (id: string, side: "l" | "r") => (bad && (side === "l" ? bad.l : bad.r) === id ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 });

  return (
    <div>
      <Prompt>{t.match}</Prompt>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2.5" lang="fr">
          {left.map((w) => (
            <motion.button
              key={`${w.id}-${bad?.n ?? 0}`}
              type="button"
              animate={shake(w.id, "l")}
              transition={{ duration: 0.4 }}
              disabled={done.includes(w.id)}
              onClick={() => {
                setBad(null);
                if (pickR) pair(w.id, pickR);
                else setPickL(w.id);
              }}
              className={cell(w.id, "l")}
            >
              {w.fr}
            </motion.button>
          ))}
        </div>
        <div className="grid gap-2.5">
          {right.map((w) => (
            <motion.button
              key={`${w.id}-${bad?.n ?? 0}`}
              type="button"
              animate={shake(w.id, "r")}
              transition={{ duration: 0.4 }}
              disabled={done.includes(w.id)}
              onClick={() => {
                setBad(null);
                if (pickL) pair(pickL, w.id);
                else setPickR(w.id);
              }}
              className={cell(w.id, "r")}
            >
              {w[lang]}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   A short story
   ------------------------------------------------------------------------------------------- */

const SPEAKER_STYLE: Record<string, { emoji: string; tone: string }> = {
  blob: { emoji: "🟣", tone: "bg-blob-soft text-blob-ink" },
  lea: { emoji: "👧", tone: "bg-[#c05475]/12 text-[#a23d60]" },
  hugo: { emoji: "👦", tone: "bg-[#3f78b3]/12 text-[#2f5f93]" },
  madame: { emoji: "👩", tone: "bg-[#5d8a4c]/14 text-[#476d39]" },
  serveur: { emoji: "🤵", tone: "bg-[#b48e38]/15 text-[#8a6a22]" },
  maman: { emoji: "👩‍🦰", tone: "bg-[#c4653e]/14 text-[#9c4b29]" },
  papa: { emoji: "👨", tone: "bg-[#2f6f6a]/14 text-[#245853]" },
  prof: { emoji: "👩‍🏫", tone: "bg-[#8a5a9c]/14 text-[#6e4580]" },
  vendeur: { emoji: "🧑‍💼", tone: "bg-[#3f78b3]/12 text-[#2f5f93]" },
  medecin: { emoji: "🧑‍⚕️", tone: "bg-[#2f7f8f]/14 text-[#23626f]" },
  chloe: { emoji: "👩‍🦱", tone: "bg-[#b4508a]/13 text-[#933d6f]" },
};

export function DialogueEx({ ex, lang, locked, setCheck }: ExProps<"dialogue">) {
  const t = useMessages(frenchText);
  const locale = useLocale();
  const d = ex.dialogue;
  const [shown, setShown] = useState<number[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => d.questions.map(() => null));

  useEffect(() => {
    if (answers.some((a) => a === null)) return setCheck(null);
    setCheck(() => {
      const wrong = d.questions.map((q, i) => (answers[i] === q.answer ? null : resolveText(q.options[q.answer], locale))).filter((x): x is string => !!x);
      return wrong.length ? { correct: false, solution: wrong.join(" · ") } : { correct: true };
    });
  }, [answers, d.questions, locale, setCheck]);

  return (
    <div>
      <Prompt
        badge={<span className="mb-2 inline-flex rounded-full bg-blob-soft px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-blob-ink">{resolveText(d.title, locale)}</span>}
      >
        {t.player.story}
      </Prompt>
      <p className="-mt-3 mb-4 text-[13.5px] text-ink-3">{t.player.storyHint}</p>
      <ol className="space-y-2.5">
        {d.lines.map((line, i) => {
          const style = SPEAKER_STYLE[line.who] ?? SPEAKER_STYLE.blob;
          const open = shown.includes(i);
          return (
            <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.06 }} className="flex items-start gap-2.5">
              <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[18px]", style.tone)} title={t.speakers[line.who]}>
                {style.emoji}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border-2 border-line bg-raised px-3.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11.5px] font-semibold uppercase tracking-wide", style.tone.split(" ").find((c) => c.startsWith("text-")))}>{t.speakers[line.who]}</span>
                </div>
                <button type="button" onClick={() => setShown((s) => (open ? s.filter((x) => x !== i) : [...s, i]))} className="block w-full text-left">
                  <span lang="fr" className="text-[16.5px] leading-snug text-ink">
                    {line.fr}
                  </span>
                  {open && <span className="mt-0.5 block text-[14px] text-ink-2">{line[lang]}</span>}
                </button>
              </div>
            </motion.li>
          );
        })}
      </ol>
      <div className="mt-7 space-y-6">
        {d.questions.map((q, qi) => (
          <div key={qi}>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.player.question(qi + 1, d.questions.length)}</div>
            <p className="mb-3 text-[17px] font-medium">{resolveText(q.q, locale)}</p>
            <OptionCards
              options={q.options.map((o) => resolveText(o, locale))}
              chosen={answers[qi]}
              locked={locked}
              onPick={(i) => setAnswers((a) => a.map((x, j) => (j === qi ? i : x)))}
              result={locked ? q.answer : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Le or la?
   ------------------------------------------------------------------------------------------- */

/** "pomme" of "la pomme", "école" of "l'école". */
const nounOf = (fr: string) => fr.replace(/^(?:(?:le|la)\s+|l')/i, "");

export function ArticleEx({ ex, lang, locked, setCheck, blobRef }: ExProps<"article">) {
  const t = useMessages(frenchText).player;
  const [chosen, setChosen] = useState<number | null>(null);
  const w = ex.word;
  const noun = nounOf(w.fr);
  const indefinite = ex.options[0] === "un";
  const meaning = w[lang].replace(/^(the|a|an|der|die|das)\s+/i, "");
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      const indef = `${w.g === "m" ? "un" : "une"} ${noun}`;
      const right = indefinite ? indef : w.fr;
      setCheck(() =>
        i === ex.answer
          ? { correct: true, solution: right, meaning: w[lang] }
          : { correct: false, solution: right, meaning: w[lang], explain: t.gender(noun, w.g!, w.fr, indef) },
      );
    },
    [locked, w, noun, indefinite, ex.answer, lang, setCheck, t],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!locked && n >= 1 && n <= ex.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, locked, ex.options.length]);
  return (
    <div>
      <Prompt>{t.article(ex.options[0], ex.options[1])}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-7">
        <div className="flex items-center gap-3">
          {w.emoji && <span className="text-[38px] leading-none">{w.emoji}</span>}
          <div className="min-w-0">
            <p lang="fr" className="text-[24px] font-semibold leading-tight">
              <span
                className={cn(
                  "mr-1.5 inline-block min-w-[3.2rem] rounded-lg border-b-[3px] px-1.5 text-center",
                  chosen === null ? "border-ink-3 text-transparent" : locked ? (chosen === ex.answer ? "border-ok text-ok" : "border-danger text-danger") : "border-blob text-blob-ink",
                )}
              >
                {chosen === null ? "___" : ex.options[chosen]}
              </span>
              {noun}
            </p>
            <p className="mt-0.5 text-[14px] text-ink-3">{meaning}</p>
          </div>
        </div>
      </BlobSays>
      <div className="grid grid-cols-2 gap-3" lang="fr">
        {ex.options.map((o, i) => (
          <button
            key={o}
            type="button"
            disabled={locked}
            onClick={() => pick(i)}
            className={cn(
              "flex h-20 flex-col items-center justify-center rounded-2xl border-2 border-b-[4px] font-display text-[26px] font-bold transition-colors",
              locked && i === ex.answer
                ? "border-ok bg-ok/10 text-ok"
                : locked && chosen === i
                  ? "border-danger/70 bg-danger/10 text-danger"
                  : chosen === i
                    ? "border-blob bg-blob-soft text-blob-ink"
                    : "border-line bg-raised text-ink hover:bg-hover",
            )}
          >
            {o}
            <span className="font-sans text-[11px] font-medium text-ink-3">{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-3">{t.articleHint}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Spell the word
   ------------------------------------------------------------------------------------------- */

/** The word's French forms, and those of other course words that mean the same (hello: bonjour, salut). */
function spellingsFor(w: Word, lang: Lang): string[] {
  const meaning = norm(w[lang]);
  const same = ALL_WORDS.filter((x) => x.id !== w.id && [x[lang], ...(x.alt?.[lang] ?? [])].some((m) => norm(m) === meaning));
  return [w.fr, ...(w.alt?.fr ?? []), ...same.flatMap((x) => [x.fr, ...(x.alt?.fr ?? [])])];
}

export function SpellEx({ ex, lang, setCheck, locked, submit, blobRef }: ExProps<"spell">) {
  const t = useMessages(frenchText).player;
  const w = ex.word;
  const onAnswer = useCallback(
    (answer: string) => {
      if (!answer.trim()) return setCheck(null);
      setCheck(() => {
        // The noun without its article: wrong, but say exactly why.
        if (w.kind === "noun" && fold(answer, "fr") === fold(bare(w.fr), "fr") && fold(answer, "fr") !== fold(w.fr, "fr")) {
          return { correct: false, solution: w.fr, explain: t.needArticle(w.fr), meaning: w[lang] };
        }
        const g = grade(answer, spellingsFor(w, lang), "fr");
        if (g.verdict === "correct") return { correct: true, verdict: "correct", meaning: w[lang] };
        if (g.verdict === "accent" || g.verdict === "typo")
          return { correct: true, verdict: g.verdict, solution: g.best, marks: g.marks, note: (g.verdict === "accent" ? t.accentNote : t.typoNote)(accentWords(answer, g.best, "fr").join(", ")), meaning: w[lang] };
        return { correct: false, verdict: "wrong", solution: g.best, marks: g.marks, meaning: w[lang] };
      });
    },
    [w, lang, setCheck, t],
  );
  return (
    <div>
      <Prompt>{t.writeFrench}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-6">
        <div className="flex items-center gap-3">
          {w.emoji && <span className="text-[40px] leading-none">{w.emoji}</span>}
          <p className="text-[20px] font-medium leading-snug">{w[lang]}</p>
        </div>
      </BlobSays>
      <TypeBox french locked={locked} onChange={onAnswer} onEnter={submit} placeholder={t.typeFrench} />
      {w.kind === "noun" && <p className="mt-3 text-[13px] text-ink-3">{t.spellHint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Spot the mistake
   ------------------------------------------------------------------------------------------- */

export function SpotEx({ ex, lang, locked, setCheck, blobRef }: ExProps<"spot">) {
  const t = useMessages(frenchText).player;
  const d = ex.drill;
  const tokens = useMemo(() => spotTokens(d.fr, d.options[ex.wrong]), [d, ex.wrong]);
  const full = d.fr.replace("___", d.options[d.answer]);
  const [chosen, setChosen] = useState<number | null>(null);
  function pick(i: number) {
    if (locked) return;
    setChosen(i);
    setCheck(() => (tokens[i].wrong ? { correct: true, solution: full, explain: d.why, meaning: d[lang] } : { correct: false, solution: full, explain: d.why, meaning: d[lang] }));
  }
  return (
    <div>
      <Prompt>{t.spot}</Prompt>
      <BlobSays blobRef={blobRef} mood="thinking" className="mb-6">
        <p className="text-[14px] text-ink-3">{t.spotHint}</p>
      </BlobSays>
      <div lang="fr" className="flex flex-wrap items-center justify-center gap-2 rounded-3xl border-2 border-line bg-raised px-4 py-6 shadow-card">
        {tokens.map((tok, i) =>
          tok.word ? (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => pick(i)}
              className={cn(
                "rounded-xl border-2 border-b-[4px] px-3 py-1.5 text-[18px] font-medium transition-colors",
                locked && tok.wrong
                  ? "border-danger/70 bg-danger/10 text-danger line-through decoration-2"
                  : locked && chosen === i
                    ? "border-line bg-hover text-ink-3"
                    : chosen === i
                      ? "border-blob bg-blob-soft text-blob-ink"
                      : "border-line bg-paper text-ink hover:bg-hover",
              )}
            >
              {tok.text}
            </button>
          ) : (
            <span key={i} className="text-[18px] text-ink-3">
              {tok.text}
            </span>
          ),
        )}
      </div>
      {locked && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[15px] font-medium text-ok" lang="fr">
          <Check className="size-4" strokeWidth={3} /> {full}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   The best reply
   ------------------------------------------------------------------------------------------- */

export function ReplyEx({ ex, lang, locked, setCheck }: ExProps<"reply">) {
  const t = useMessages(frenchText);
  const [chosen, setChosen] = useState<number | null>(null);
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      setCheck(() =>
        i === ex.answer ? { correct: true, meaning: ex.meaning[lang] } : { correct: false, solution: ex.options[ex.answer], meaning: ex.meaning[lang] },
      );
    },
    [locked, ex, lang, setCheck],
  );
  const style = SPEAKER_STYLE[ex.line.who] ?? SPEAKER_STYLE.blob;
  return (
    <div>
      <Prompt>{t.player.reply}</Prompt>
      <div className="mb-6 flex items-start gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-[24px]", style.tone)}>{style.emoji}</span>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border-2 border-line bg-raised px-4 py-3 shadow-card">
          <div className={cn("mb-0.5 text-[12px] font-semibold uppercase tracking-wide", style.tone.split(" ").find((c) => c.startsWith("text-")))}>{t.player.says(t.speakers[ex.line.who])}</div>
          <Tappable text={ex.line.fr} className="text-[19px] leading-relaxed" />
        </div>
      </div>
      <OptionCards options={ex.options} chosen={chosen} locked={locked} onPick={pick} lang="fr" result={locked ? ex.answer : null} />
    </div>
  );
}
