"use client";

import { motion } from "motion/react";
import { Ear, Keyboard, Mic, MicOff, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { BlobHandle } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { acceptedOf, targetOf } from "../generate";
import { prefs, say, sounds, listenOnce, canRecognize } from "../speech";
import { accentWords, explainFrench, fold, grade, tilesOf } from "../text";
import type { Exercise, Lang, Sentence, Word } from "../types";
import { OptionCards, TileBoard, TypeBox } from "./inputs";
import { BlobSays, PlayButtons, Prompt, Tappable, type Outcome } from "./parts";

/** What every exercise gets from the lesson. */
export type ExProps<K extends Exercise["kind"]> = {
  ex: Extract<Exercise, { kind: K }>;
  lang: Lang;
  /** A French voice is available. */
  voice: boolean;
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

export function IntroEx({ ex, lang, voice, setCheck, blobRef }: ExProps<"intro">) {
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
        <Sparkles className="size-3.5" /> {t.player.newWord}
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
        <PlayButtons text={w.fr} auto voice={voice} />
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

export function PictureEx({ ex, lang, voice, locked, setCheck }: ExProps<"picture">) {
  const t = useMessages(frenchText).player;
  const [chosen, setChosen] = useState<number | null>(null);
  const right = ex.options.findIndex((o) => o.id === ex.word.id);
  const pick = useCallback(
    (i: number) => {
      if (locked) return;
      setChosen(i);
      if (voice && prefs.soundOn()) void say(ex.options[i].fr);
      setCheck(() => (i === right ? { correct: true } : { correct: false, solution: `${ex.word.fr} = ${ex.word[lang]}` }));
    },
    [locked, voice, ex, right, lang, setCheck],
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
        <span className="inline-flex flex-wrap items-center gap-3">
          {t.whichPicture(ex.word.fr)} <PlayButtons text={ex.word.fr} auto voice={voice} />
        </span>
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

export function ChoiceEx({ ex, lang, voice, locked, setCheck, blobRef }: ExProps<"choice">) {
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
          <div className="flex items-center gap-3">
            <PlayButtons text={s.fr} auto voice={voice} />
            <Tappable text={s.fr} className="text-[19px] leading-relaxed" />
          </div>
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

export function SentenceEx({ ex, lang, voice, locked, setCheck, submit, nouns, blobRef }: ExProps<"tiles"> | ExProps<"type">) {
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
          <div className="flex items-center gap-3">
            <PlayButtons text={s.fr} auto voice={voice} />
            <Tappable text={s.fr} className="text-[19px] leading-relaxed" />
          </div>
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
   Listening
   ------------------------------------------------------------------------------------------- */

export function ListenEx({ ex, lang, voice, locked, setCheck, submit, finish, nouns, blobRef }: ExProps<"listen">) {
  const t = useMessages(frenchText).player;
  const s = ex.sentence;
  const notes = useMemo(() => ({ accent: t.accentNote, typo: t.typoNote }), [t]);
  const onAnswer = useCallback(
    (answer: string) => setCheck(answer.trim() ? () => gradeSentence(answer, s, "toFr", lang, nouns, notes) : null),
    [setCheck, s, lang, nouns, notes],
  );
  return (
    <div>
      <Prompt>{ex.mode === "tiles" ? t.listenTiles : t.listenType}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-6">
        <div className="flex items-center gap-3 py-1">
          <PlayButtons text={s.fr} auto big voice={voice} />
          <Ear className="size-5 text-ink-3" />
        </div>
      </BlobSays>
      {ex.mode === "tiles" ? (
        <TileBoard tiles={ex.tiles} locked={locked} lang="fr" onChange={onAnswer} />
      ) : (
        <TypeBox french locked={locked} onChange={onAnswer} onEnter={submit} placeholder={t.typeFrench} />
      )}
      {!locked && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              prefs.pauseListening();
              finish({ correct: true, skipped: true });
            }}
            className="rounded-lg px-2 py-1 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink"
          >
            {t.cantListen}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
   Speaking
   ------------------------------------------------------------------------------------------- */

/** How much of the sentence was understood: share of its words heard, in any order. */
function heardShare(heard: string, target: string) {
  const want = tilesOf(target, "fr").map((w) => fold(w, "fr"));
  const got = new Set(fold(heard, "fr").split(" "));
  return want.filter((w) => got.has(w)).length / Math.max(1, want.length);
}

export function SpeakEx({ ex, lang, voice, locked, finish, blobRef }: ExProps<"speak">) {
  const t = useMessages(frenchText).player;
  const s = ex.sentence;
  const [state, setState] = useState<"idle" | "listening" | "heard" | "missed">("idle");
  const [heard, setHeard] = useState("");
  const tries = useRef(0);
  const stop = useRef<(() => void) | null>(null);

  async function listen() {
    if (state === "listening") {
      stop.current?.();
      return;
    }
    setState("listening");
    const run = listenOnce();
    stop.current = run.stop;
    const guesses = await run.result;
    stop.current = null;
    tries.current++;
    const best = guesses.sort((a, b) => heardShare(b, s.fr) - heardShare(a, s.fr))[0] ?? "";
    setHeard(best);
    if (best && heardShare(best, s.fr) >= 0.75) {
      setState("heard");
      finish({ correct: true, meaning: s[lang] });
    } else if (tries.current >= 3) {
      // Speech recognition isn't perfect: after three tries it doesn't count against you.
      setState("missed");
      finish({ correct: true, skipped: true, solution: s.fr, meaning: s[lang] });
    } else {
      setState("missed");
      blobRef.current?.shake();
    }
  }

  return (
    <div>
      <Prompt>{t.speak}</Prompt>
      <BlobSays blobRef={blobRef} className="mb-8">
        <div className="flex items-center gap-3">
          <PlayButtons text={s.fr} auto voice={voice} />
          <Tappable text={s.fr} className="text-[19px] leading-relaxed" />
        </div>
      </BlobSays>
      <div className="flex flex-col items-center gap-3">
        <motion.button
          type="button"
          disabled={locked}
          onClick={() => void listen()}
          animate={state === "listening" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={state === "listening" ? { repeat: Infinity, duration: 1.1 } : undefined}
          className={cn(
            "flex h-16 w-full max-w-[420px] items-center justify-center gap-3 rounded-2xl border-2 border-b-[4px] text-[16px] font-semibold transition-colors",
            state === "listening" ? "border-blob bg-blob text-white" : "border-line bg-raised text-blob-ink hover:bg-hover",
          )}
        >
          <Mic className="size-6" /> {state === "listening" ? t.listening : t.tapToSpeak}
        </motion.button>
        {heard && <p className="text-[14px] text-ink-2">{t.heard(heard)}</p>}
        {state === "missed" && !locked && <p className="text-[14px] text-ink-2">{t.notHeard}</p>}
        {!locked && (
          <button
            type="button"
            onClick={() => {
              prefs.pauseSpeaking();
              finish({ correct: true, skipped: true });
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink"
          >
            <MicOff className="size-4" /> {t.cantSpeak}
          </button>
        )}
      </div>
    </div>
  );
}

export const speakingPossible = () => canRecognize() && !prefs.speakingOff();

/* -------------------------------------------------------------------------------------------
   Fill the gap
   ------------------------------------------------------------------------------------------- */

export function BlankEx({ ex, lang, voice, locked, setCheck, blobRef }: ExProps<"blank">) {
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
      if (prefs.soundOn()) sounds.tap();
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
        <div className="flex items-center gap-3">
          {locked && <PlayButtons text={full} voice={voice} />}
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

export function MatchEx({ ex, lang, voice, finish, blobRef }: ExProps<"match">) {
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
      if (prefs.soundOn()) sounds.tap();
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
                if (voice && prefs.soundOn()) void say(w.fr);
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
};

export function DialogueEx({ ex, lang, voice, locked, setCheck }: ExProps<"dialogue">) {
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
                  {voice && (
                    <button type="button" onClick={() => void say(line.fr)} className="text-ink-3 hover:text-blob-ink" aria-label={t.player.play}>
                      <Ear className="size-3.5" />
                    </button>
                  )}
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
