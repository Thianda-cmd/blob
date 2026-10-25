"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo } from "react";
import { Callout } from "@/components/editor/blocks/Callout";
import { NoteBlocksProvider, type NoteBlocks } from "@/components/editor/blocks/context";
import { Diagram } from "@/components/editor/blocks/Diagram";
import { FileBlock } from "@/components/editor/blocks/File";
import { Flashcard, FlashcardBack, FlashcardFront } from "@/components/editor/blocks/Flashcard";
import { LessonLink } from "@/components/editor/blocks/LessonLink";
import { MathBlock, MathInline } from "@/components/editor/blocks/Math";
import { Plot } from "@/components/editor/blocks/Plot";
import { Sketch } from "@/components/editor/blocks/Sketch";
import { Toggle, ToggleContent, ToggleReveal, ToggleSummary } from "@/components/editor/blocks/Toggle";
import { documentExtensions } from "@/components/editor/schema";
import { publicFileHref } from "@/lib/publicLink";
import { PublicDeckEmbed, PublicPageLink } from "./blocks";
import { usePublicPages } from "./context";

/** A stored note's content, or an empty note when there is none (a page made but never written in). */
function asDoc(content: unknown): JSONContent {
  const doc = content as JSONContent | null;
  return doc && doc.type === "doc" && Array.isArray(doc.content) && doc.content.length ? doc : { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * A note as anyone with its public link sees it: the editor's own blocks (formulas, diagrams,
 * flashcards, toggles…), read-only. Files come through the link, links to pages lead to the pages
 * the link also opens.
 */
export function PublicNote({ pageId, content }: { pageId: string; content: unknown }) {
  const { token } = usePublicPages();
  const blocks = useMemo<NoteBlocks>(
    () => ({ pageId, canEdit: false, fileUrl: async (path, opts) => publicFileHref(token, pageId, path, typeof opts?.download === "string" ? opts.download : null) }),
    [pageId, token],
  );
  const doc = useMemo(() => asDoc(content), [content]);
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      content: doc,
      extensions: [
        ...documentExtensions(
          {
            callout: Callout,
            mathInline: MathInline,
            mathBlock: MathBlock,
            toggle: Toggle,
            toggleSummary: ToggleSummary,
            toggleContent: ToggleContent,
            flashcard: Flashcard,
            flashcardFront: FlashcardFront,
            flashcardBack: FlashcardBack,
            diagram: Diagram,
            sketch: Sketch,
            plot: Plot,
            file: FileBlock,
            deckEmbed: PublicDeckEmbed,
            lessonLink: LessonLink,
            pageLink: PublicPageLink,
          },
          true,
        ),
        ToggleReveal,
      ],
      editorProps: { attributes: { class: "prose-blob" } },
    },
    [doc],
  );

  return (
    <NoteBlocksProvider value={blocks}>
      <EditorContent editor={editor} className="relative min-h-[3em]" />
    </NoteBlocksProvider>
  );
}
