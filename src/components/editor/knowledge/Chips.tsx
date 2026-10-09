"use client";

import { GraduationCap, Hash, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, topicHref } from "@/learn/catalog";
import { LevelBars } from "@/learn/components/LevelBars";
import type { Level } from "@/learn/types";
import type { PageMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SUBJECT_ICON, useTopicItems } from "../blocks/LessonLink";
import { Picker, filterItems } from "../blocks/Picker";

const MAX_TAGS = 20;

/** "#Prüfung " → "Prüfung" (tags are compared without case). */
export function cleanTag(raw: string) {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").slice(0, 32);
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** "fractions@2" → { slug: "fractions", level: 2 }. */
export function parseTopic(raw: string): { slug: string; level: Level | null } {
  const [slug, l] = raw.split("@");
  const n = Number(l);
  return { slug, level: n === 1 || n === 2 || n === 3 ? (n as Level) : null };
}

/** The note's tags and learning topics, as chips under the title. */
export function KnowledgeChips({ page, canEdit }: { page: PageMeta; canEdit: boolean }) {
  const t = useMessages(noteBlocksText).knowledge;
  const tl = useMessages(noteBlocksText).lesson;
  const locale = useLocale();
  const { pages, updatePage } = useWorkspace();
  const tags = page.tags ?? [];
  const topics = page.topics ?? [];
  const empty = !tags.length && !topics.length;

  // Your other tags, most used first: suggestions while typing a new one.
  const known = useMemo(() => {
    const counts = new Map<string, { tag: string; n: number }>();
    for (const p of pages) {
      if (p.id === page.id) continue;
      for (const tag of p.tags ?? []) {
        const key = tag.toLocaleLowerCase();
        const c = counts.get(key);
        counts.set(key, { tag: c?.tag ?? tag, n: (c?.n ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((c) => c.tag);
  }, [pages, page.id]);

  const addTag = (raw: string) => {
    const tag = cleanTag(raw);
    if (!tag || tags.some((x) => same(x, tag))) return;
    if (tags.length >= MAX_TAGS) {
      blob.say(t.tooManyTags, { mood: "thinking" });
      return;
    }
    void updatePage(page.id, { tags: [...tags, tag] });
  };
  const removeTag = (tag: string) => void updatePage(page.id, { tags: tags.filter((x) => x !== tag) });
  const addTopic = (slug: string) => {
    if (topics.some((x) => parseTopic(x).slug === slug) || topics.length >= MAX_TAGS) return;
    void updatePage(page.id, { topics: [...topics, slug] });
    blob.react("jump", "happy", 900);
  };
  const removeTopic = (raw: string) => void updatePage(page.id, { topics: topics.filter((x) => x !== raw) });

  if (empty && !canEdit) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", empty && "blob-chips-empty")}>
      {tags.map((tag) => (
        <span key={tag} className="blob-tag group/chip">
          <Link href={`/notes?tag=${encodeURIComponent(tag)}`} className="blob-tag-link" title={tag}>
            <Hash className="size-3 text-ink-3" strokeWidth={2.2} />
            <span className="max-w-[180px] truncate">{tag}</span>
          </Link>
          {canEdit && (
            <button type="button" onClick={() => removeTag(tag)} className="blob-chip-x" aria-label={t.removeTag(tag)} title={t.removeTag(tag)}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {topics.map((raw) => {
        const { slug, level } = parseTopic(raw);
        const meta = findTopicMeta(slug);
        if (!meta) return null;
        const Icon = SUBJECT_ICON[meta.subject];
        const title = resolveText(meta.title, locale);
        return (
          <span key={raw} className="blob-topic group/chip">
            <Link href={topicHref(meta, level ?? undefined)} className="blob-tag-link" title={`${tl.subjects[meta.subject]}: ${title}`}>
              <Icon className="size-3" strokeWidth={2.2} />
              <span className="max-w-[200px] truncate">{title}</span>
              {level && <LevelBars level={level} className="h-2.5" />}
            </Link>
            {canEdit && (
              <button type="button" onClick={() => removeTopic(raw)} className="blob-chip-x" aria-label={t.removeTopic(title)} title={t.removeTopic(title)}>
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {canEdit && (
        <>
          <TagAdder known={known} current={tags} onAdd={addTag} />
          <TopicAdder current={topics} onAdd={addTopic} />
        </>
      )}
    </div>
  );
}

function TagAdder({ known, current, onAdd }: { known: string[]; current: string[]; onAdd: (tag: string) => void }) {
  const t = useMessages(noteBlocksText).knowledge;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const clean = cleanTag(query);
  const options = filterItems(
    known.filter((k) => !current.some((c) => same(c, k))).map((k) => ({ key: k, label: k })),
    clean,
  ).slice(0, 8);
  const exact = options.some((o) => same(o.key, clean)) || current.some((c) => same(c, clean));
  const suggested = options.map((o) => ({ key: o.key, label: o.key, create: false }));
  const create = clean && !exact ? [{ key: clean, label: t.newTag(clean), create: true }] : [];
  // "Bio" + Enter makes "Bio", unless one of your tags starts with what you typed ("Biologie").
  const prefixed = suggested.some((o) => o.key.toLocaleLowerCase().startsWith(clean.toLocaleLowerCase()));
  const rows = prefixed ? [...suggested, ...create] : [...create, ...suggested];
  const current_ = Math.min(active, Math.max(rows.length - 1, 0));

  return (
    <Popover
      align="start"
      role="dialog"
      label={t.addTag}
      className="w-[240px] p-1.5"
      onOpenChange={(open) => {
        if (open) {
          setQuery("");
          setActive(0);
          requestAnimationFrame(() => input.current?.focus());
        }
      }}
      trigger={(props) => (
        <button {...props} type="button" className="blob-chip-add" title={t.addTag}>
          <Plus className="size-3" strokeWidth={2.2} /> {t.tag}
        </button>
      )}
    >
      {(close) => {
        const pick = (tag: string) => {
          onAdd(tag);
          setQuery("");
          setActive(0);
          close();
        };
        return (
          <>
            <div className="blob-picker-search h-9">
              <Hash className="size-3.5 shrink-0 text-ink-3" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((current_ + 1) % Math.max(rows.length, 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((current_ - 1 + rows.length) % Math.max(rows.length, 1));
                  } else if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const row = rows[current_];
                    if (row) pick(row.key);
                    else if (clean) pick(clean);
                  }
                }}
                placeholder={t.tagPlaceholder}
                aria-label={t.addTag}
                maxLength={40}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3/80"
              />
            </div>
            {rows.length > 0 && (
              <div className="mt-1 max-h-[220px] overflow-y-auto" role="listbox">
                {rows.map((row, i) => (
                  <button
                    key={`${row.create}-${row.key}`}
                    type="button"
                    role="option"
                    aria-selected={i === current_}
                    onMouseMove={() => i !== current_ && setActive(i)}
                    onClick={() => pick(row.key)}
                    className={cn("flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]", i === current_ ? "bg-hover text-ink" : "text-ink-2")}
                  >
                    {row.create ? <Plus className="size-3.5 text-ink-3" /> : <Hash className="size-3.5 text-ink-3" />}
                    <span className="truncate">{row.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        );
      }}
    </Popover>
  );
}

function TopicAdder({ current, onAdd }: { current: string[]; onAdd: (slug: string) => void }) {
  const t = useMessages(noteBlocksText).knowledge;
  const noMatch = useMessages(noteBlocksText).lesson.noMatch;
  const items = useTopicItems();
  const available = items.filter((i) => !current.some((c) => parseTopic(c).slug === i.key));
  return (
    <Popover
      align="start"
      role="dialog"
      label={t.addTopic}
      className="w-[min(320px,calc(100vw-16px))] p-1.5"
      trigger={(props) => (
        <button {...props} type="button" className="blob-chip-add" title={t.addTopic}>
          <GraduationCap className="size-3" strokeWidth={2.2} /> {t.topic}
        </button>
      )}
    >
      {(close) => (
        <Picker
          items={available}
          placeholder={t.topicSearch}
          empty={noMatch}
          onPick={(slug) => {
            onAdd(slug);
            close();
          }}
          onCancel={close}
          listClassName="max-h-[280px]"
        />
      )}
    </Popover>
  );
}
