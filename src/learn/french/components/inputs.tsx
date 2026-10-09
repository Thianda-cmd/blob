"use client";

import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { cn } from "@/lib/utils";
import { prefs, sounds } from "../speech";

const TILE =
  "select-none rounded-xl border-2 border-line border-b-[4px] bg-raised px-3 py-1.5 text-[16px] font-medium text-ink transition-colors sm:text-[17px] [@media(hover:hover)]:hover:bg-hover";

/**
 * Word tiles: tap one in the bank to add it to the answer line, tap it there to put it back. The
 * answer is the tiles in order, joined by spaces.
 */
export function TileBoard({ tiles, locked, lang, onChange }: { tiles: string[]; locked: boolean; lang: string; onChange: (answer: string) => void }) {
  const [picked, setPicked] = useState<number[]>([]);

  function toggle(i: number) {
    if (locked) return;
    if (prefs.soundOn()) sounds.tap();
    const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
    setPicked(next);
    onChange(next.map((x) => tiles[x]).join(" "));
  }

  return (
    <LayoutGroup>
      <div lang={lang} className="relative mb-8 min-h-[116px] rounded-2xl" aria-live="polite">
        {/* Writing lines under the answer, like a notebook. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-around">
          <span className="h-px bg-line-2" />
          <span className="h-px bg-line-2" />
        </div>
        <div className="relative flex min-h-[116px] flex-wrap content-start gap-2 py-2">
          {picked.map((i) => (
            <motion.button
              key={i}
              layoutId={`tile-${i}`}
              type="button"
              onClick={() => toggle(i)}
              transition={{ type: "spring", stiffness: 700, damping: 40 }}
              className={cn(TILE, "h-11")}
            >
              {tiles[i]}
            </motion.button>
          ))}
        </div>
      </div>
      <div lang={lang} className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile, i) =>
          picked.includes(i) ? (
            // The empty spot keeps the bank from jumping around.
            <span key={i} className={cn(TILE, "h-11 border-transparent bg-line text-transparent")} aria-hidden>
              {tile}
            </span>
          ) : (
            <motion.button
              key={i}
              layoutId={`tile-${i}`}
              type="button"
              disabled={locked}
              onClick={() => toggle(i)}
              transition={{ type: "spring", stiffness: 700, damping: 40 }}
              className={cn(TILE, "h-11")}
            >
              {tile}
            </motion.button>
          ),
        )}
      </div>
    </LayoutGroup>
  );
}

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "ù", "û", "î", "ï", "ô", "œ", "ë"];

/** A text box for typed answers; for French with accent buttons. Enter checks (no new lines). */
export function TypeBox({
  french,
  locked,
  onChange,
  onEnter,
  placeholder,
}: {
  french: boolean;
  locked: boolean;
  onChange: (answer: string) => void;
  onEnter: () => void;
  placeholder: string;
}) {
  const t = useMessages(frenchText).player;
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Keyboard ready at once on computers (on phones the keyboard would cover the exercise).
    if (window.matchMedia("(hover: hover)").matches) ref.current?.focus();
  }, []);

  function set(v: string) {
    setValue(v);
    onChange(v);
  }

  function insert(ch: string) {
    const el = ref.current;
    if (!el || locked) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    set(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        disabled={locked}
        lang={french ? "fr" : undefined}
        rows={3}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => set(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        className="block w-full resize-none rounded-2xl border-2 border-line bg-raised px-4 py-3 text-[17px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-blob disabled:opacity-80"
      />
      {french && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label={t.accents}>
          {ACCENTS.map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={locked}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(ch)}
              className="grid h-9 min-w-9 place-items-center rounded-lg border-2 border-line border-b-[3px] bg-raised px-2 text-[16px] font-medium text-ink hover:bg-hover"
            >
              {ch}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Answer options as big cards; keys 1–9 pick them. */
export function OptionCards({
  options,
  chosen,
  locked,
  onPick,
  lang,
  result,
}: {
  options: string[];
  chosen: number | null;
  locked: boolean;
  onPick: (i: number) => void;
  lang?: string;
  /** After checking: the right option, to show it in green. */
  result?: number | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.closest("input, textarea")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, options.length, onPick]);

  return (
    <div className="grid gap-2.5" role="radiogroup">
      {options.map((o, i) => {
        const on = chosen === i;
        const right = result === i;
        const wrong = locked && on && result !== undefined && result !== null && result !== i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={locked}
            onClick={() => onPick(i)}
            lang={lang}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-2xl border-2 border-b-[4px] px-4 py-2.5 text-left text-[16.5px] transition-colors",
              right ? "border-ok bg-ok/10 text-ink" : wrong ? "border-danger/70 bg-danger/10" : on ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink hover:bg-hover",
            )}
          >
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 text-[13px] font-semibold", on ? "border-blob text-blob-ink" : "border-line text-ink-3")}>{i + 1}</span>
            <span className="min-w-0 flex-1">{o}</span>
          </button>
        );
      })}
    </div>
  );
}
