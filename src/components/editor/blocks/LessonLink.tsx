"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Check, ChevronDown, Dumbbell, FlaskConical, GraduationCap, Leaf, Play, RefreshCw, Sigma } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { resolveText } from "@/i18n/text";
import { CATALOG, findTopicMeta, lessonLevels, studyHref, topicHref, type Subject, type TopicMeta } from "@/learn/catalog";
import { LevelBars } from "@/learn/components/LevelBars";
import { TopicGlyph } from "@/learn/components/TopicGlyph";
import { masteryLabel } from "@/learn/progress";
import type { Level } from "@/learn/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { Picker, type PickerItem } from "./Picker";

export const SUBJECT_ICON = { maths: Sigma, chemistry: FlaskConical, biology: Leaf } satisfies Record<Subject, unknown>;

/** Every learning-center topic as picker rows, grouped by subject (for lesson links and a note's topics). */
export function useTopicItems(): PickerItem[] {
  const locale = useLocale();
  const t = useMessages(noteBlocksText).lesson;
  return useMemo(
    () =>
      CATALOG.map((topic) => {
        const Icon = SUBJECT_ICON[topic.subject];
        const title = resolveText(topic.title, locale);
        return {
          key: topic.slug,
          label: title,
          sub: locale === "en" && topic.de !== title ? topic.de : undefined,
          icon: <Icon className="size-4" />,
          keywords: `${resolveText(topic.title, "en")} ${resolveText(topic.title, "de")} ${topic.de} ${t.subjects[topic.subject]}`,
          group: t.subjects[topic.subject],
        };
      }),
    [locale, t],
  );
}

type Progress = { mastery: number; done: boolean } | null;

/** Your progress on a topic (at a level): mastery and whether the lesson is done. */
function useProgress(slug: string | null, level: Level | null) {
  const [state, setState] = useState<{ key: string; value: Progress } | null>(null);
  const key = slug ? `${slug}@${level ?? 0}` : "";
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    const topic = level ? `${slug}@${level}` : slug;
    void createClient()
      .from("learn_progress")
      .select("mastery, lesson_done")
      .eq("topic", topic)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const row = data as { mastery: number; lesson_done: boolean } | null;
        setState({ key, value: row ? { mastery: row.mastery, done: row.lesson_done } : null });
      });
    return () => {
      alive = false;
    };
  }, [slug, level, key]);
  return state?.key === key ? state.value : undefined;
}

function LessonView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).lesson;
  const locale = useLocale();
  const router = useRouter();
  const { canEdit } = useNoteBlocks();
  const items = useTopicItems();
  const slug = (node.attrs.slug as string | null) || null;
  const rawLevel = Number(node.attrs.level);
  const level = rawLevel === 1 || rawLevel === 2 || rawLevel === 3 ? (rawLevel as Level) : null;
  const meta: TopicMeta | undefined = slug ? findTopicMeta(slug) : undefined;
  const progress = useProgress(meta ? slug : null, level);
  const [changing, setChanging] = useState(false);

  if (!slug || changing) {
    return (
      <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
        <div className="blob-embed-pick">
          <div className="blob-embed-pick-head">
            <GraduationCap className="size-4" />
            {t.pick}
          </div>
          {canEdit && (
            <Picker
              items={items}
              placeholder={t.search}
              empty={t.noMatch}
              onPick={(key) => {
                setChanging(false);
                updateAttributes({ slug: key, level: null });
              }}
              onCancel={slug ? () => setChanging(false) : undefined}
              listClassName="max-h-[280px]"
            />
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  if (!meta) {
    return (
      <NodeViewWrapper className={cn("blob-embed blob-object", selected && "blob-node-selected")} contentEditable={false}>
        <div className="blob-lesson is-missing">
          <span className="blob-lesson-glyph">
            <GraduationCap className="size-6" />
          </span>
          <div className="blob-lesson-info">
            <span className="blob-deck-meta">{t.missing}</span>
            {canEdit && (
              <div className="blob-deck-actions">
                <button type="button" className="blob-btn" onClick={() => setChanging(true)}>
                  <RefreshCw className="size-3.5" /> {t.change}
                </button>
              </div>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  const title = resolveText(meta.title, locale);
  const levels = lessonLevels(meta);
  const lessonLevel = level ?? levels[0] ?? 1;
  const depth = level ? resolveText(meta.levels[level].depth, locale) : null;
  const mastery = progress?.mastery ?? 0;
  const Subject = SUBJECT_ICON[meta.subject];

  const levelLabel = (
    <>
      {level ? <LevelBars level={level} className="h-3" /> : null}
      <span>{level ? t.levels[level] : t.subjects[meta.subject]}</span>
    </>
  );

  return (
    <NodeViewWrapper className={cn("blob-embed blob-object", selected && "blob-node-selected")} contentEditable={false}>
      <div className="blob-lesson">
        <button type="button" className="blob-lesson-glyph" onClick={() => router.push(topicHref(meta, level ?? undefined))} aria-label={title}>
          <TopicGlyph topic={meta} size="sm" />
        </button>
        <div className="blob-lesson-info">
          <div className="blob-lesson-kicker">
            <Subject className="size-3.5" />
            <span>{t.subjects[meta.subject]}</span>
            <span aria-hidden>·</span>
            {canEdit ? (
              <Popover
                align="start"
                className="w-[230px]"
                label={t.level}
                trigger={(props) => (
                  <button {...props} type="button" className="blob-lesson-level" title={t.level}>
                    {level ? <LevelBars level={level} className="h-3" /> : null}
                    <span>{level ? t.levels[level] : t.anyLevel}</span>
                    <ChevronDown className="size-3" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem
                      shortcut={!level ? <Check className="size-3.5" /> : undefined}
                      onSelect={() => {
                        updateAttributes({ level: null });
                        close();
                      }}
                    >
                      {t.anyLevel}
                    </MenuItem>
                    {levels.map((l) => (
                      <MenuItem
                        key={l}
                        icon={<LevelBars level={l} className="h-3.5" />}
                        shortcut={level === l ? <Check className="size-3.5" /> : <span>{resolveText(meta.levels[l].depth, locale)}</span>}
                        onSelect={() => {
                          updateAttributes({ level: l });
                          close();
                        }}
                      >
                        {t.levels[l]}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Popover>
            ) : (
              <span className="blob-lesson-level is-static">{level ? levelLabel : t.anyLevel}</span>
            )}
            {depth && <span className="blob-lesson-depth">{depth}</span>}
          </div>
          <button type="button" className="blob-lesson-title" onClick={() => router.push(topicHref(meta, level ?? undefined))}>
            {title}
          </button>
          <div className="blob-lesson-progress" aria-live="polite">
            {progress === undefined ? (
              <span className="opacity-0">·</span>
            ) : progress === null ? (
              <span>{t.notStarted}</span>
            ) : (
              <>
                <span className="blob-lesson-bar" aria-hidden>
                  <span style={{ width: `${Math.max(4, Math.min(100, mastery))}%` }} />
                </span>
                <span>{masteryLabel(mastery, locale)}</span>
                {progress.done && (
                  <span className="blob-lesson-done">
                    <Check className="size-3.5" strokeWidth={2.5} /> {t.done}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="blob-deck-actions">
            <button type="button" className="blob-btn-primary" onClick={() => router.push(studyHref(meta, "lesson", lessonLevel))}>
              <Play className="size-3 fill-current" /> {t.lesson}
            </button>
            <button type="button" className="blob-btn" onClick={() => router.push(studyHref(meta, "practice", level ?? undefined))}>
              <Dumbbell className="size-3.5" /> {t.practice}
            </button>
            {canEdit && (
              <button type="button" className="blob-btn is-quiet" onClick={() => setChanging(true)} title={t.change}>
                <RefreshCw className="size-3.5" /> <span className="max-sm:sr-only">{t.change}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/** A lesson of the learning center, with your progress, to jump into from the note. */
export const LessonLink = Node.create({
  name: "lessonLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      slug: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-topic"),
        renderHTML: (attrs) => (attrs.slug ? { "data-topic": attrs.slug } : {}),
      },
      level: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-level")) || null,
        renderHTML: (attrs) => (attrs.level ? { "data-level": attrs.level } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-lesson-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lesson-link": "" })];
  },

  renderText({ node }) {
    const meta = node.attrs.slug ? findTopicMeta(node.attrs.slug as string) : undefined;
    return meta ? resolveText(meta.title, "de") : "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(LessonView);
  },
});
