"use client";

import { Dumbbell, GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { TopBar } from "@/components/shell/TopBar";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import { learnText } from "@/i18n/messages/learn";
import { resolveText } from "@/i18n/text";
import { useToday } from "@/learn/session";
import { cn } from "@/lib/utils";
import { unitOfWord, wordById } from "../course";
import type { WordRow } from "../server";
import { fold } from "../text";

/** Strength as shown: words not practised since they were due fade one step per missed interval. */
function shownStrength(row: WordRow, today: string | null) {
  if (!today || row.due_on >= today) return row.strength;
  const late = Math.round((Date.parse(today) - Date.parse(row.due_on)) / 864e5);
  return Math.max(0, row.strength - (late >= 14 ? 2 : 1));
}

/** Every word the student has met, how well it sits, and a way to practise the weak ones. */
export function WordList({ words }: { words: WordRow[] }) {
  const t = useMessages(frenchText);
  const lt = useMessages(learnText);
  const locale = useLocale();
  const today = useToday();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "weak">("all");

  const rows = useMemo(
    () =>
      words
        .map((row) => ({ row, word: wordById(row.word_id) }))
        .filter((x): x is { row: WordRow; word: NonNullable<ReturnType<typeof wordById>> } => !!x.word)
        .map((x) => ({ ...x, strength: shownStrength(x.row, today), due: !!today && x.row.due_on <= today })),
    [words, today],
  );
  const weak = rows.filter((r) => r.strength <= 2 || r.due);
  const q = fold(query, "fr");
  const shown = (filter === "weak" ? weak : rows)
    .filter((r) => !q || fold(r.word.fr, "fr").includes(q) || fold(r.word[locale], locale).includes(fold(query, locale)))
    .sort((a, b) => a.strength - b.strength || (unitOfWord(a.word.id)?.n ?? 0) - (unitOfWord(b.word.id)?.n ?? 0));

  return (
    <>
      <TopBar
        crumbs={[
          { label: lt.learn, icon: <GraduationCap className="size-3.5" />, href: "/learn" },
          { label: t.title, href: "/learn/french" },
          { label: t.words.title },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-5 pb-20 pt-4 sm:px-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-[560px]">
              <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{t.words.title}</h1>
              <p className="mt-1.5 text-[14.5px] text-ink-2">{t.words.intro}</p>
            </div>
            {weak.length > 0 && (
              <Link
                href="/study/french/practice"
                className="flex h-11 items-center gap-2 rounded-2xl bg-blob px-5 text-[14px] font-bold uppercase tracking-wide text-white shadow-[0_4px_0_var(--blob-deep)] active:translate-y-[2px] active:shadow-none"
              >
                <Dumbbell className="size-4" /> {t.words.practice}
              </Link>
            )}
          </header>

          {rows.length === 0 ? (
            <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line-2 px-6 py-12 text-center text-[15px] text-ink-2">
              <Blob size={100} mood="thinking" accessory="beret" />
              {t.words.empty}
              <Link href="/learn/french" className="font-semibold text-blob-ink hover:underline">
                {t.end.back}
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-raised px-3 focus-within:border-blob sm:max-w-[320px]">
                  <Search className="size-4 text-ink-3" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.words.search} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
                </label>
                <div className="flex rounded-xl border border-line bg-surface p-0.5">
                  {(["all", "weak"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={cn("h-9 rounded-lg px-3 text-[13.5px] font-medium", filter === f ? "bg-raised text-ink shadow-card" : "text-ink-2 hover:text-ink")}
                    >
                      {f === "all" ? `${t.words.all} · ${rows.length}` : `${t.words.weak} · ${weak.length}`}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="mt-8 text-center text-[14px] text-ink-3">{t.words.none}</p>
              ) : (
                <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
                  {shown.map(({ word, strength, due }) => (
                    <li key={word.id} className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-[22px]">{word.emoji ?? "💬"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span lang="fr" className="truncate font-medium text-ink" title={word.fr}>
                            {word.fr}
                          </span>
                          {due && <span className="shrink-0 rounded-full bg-[#c4653e]/12 px-1.5 py-px text-[11px] font-semibold text-[#a5532f]">{t.words.due}</span>}
                        </div>
                        <div className="truncate text-[13px] text-ink-3" title={word[locale]}>
                          {word[locale]} · {resolveText(unitOfWord(word.id)?.title ?? "", locale)}
                        </div>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex" title={t.words.strength[strength]}>
                        <Bars value={strength} />
                        <span className="text-[11.5px] text-ink-3">{t.words.strength[strength]}</span>
                      </div>
                      <div className="sm:hidden">
                        <Bars value={strength} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Bars({ value }: { value: number }) {
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("w-1.5 rounded-sm", i <= value ? "bg-blob" : "bg-line-2")} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  );
}
