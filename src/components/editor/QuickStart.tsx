"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BookOpen, ClipboardList, FlaskConical, GraduationCap, Heading1, ImagePlus, Languages, Layers, LayoutTemplate, ListTodo, NotebookPen, Scale, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { templatesText } from "@/i18n/messages/templates";
import { TEMPLATES, templateDoc, type TemplateId } from "@/notes/templates";
import { insertFlashcard } from "./blocks/Flashcard";

const TEMPLATE_ICONS: Record<TemplateId, LucideIcon> = { lecture: NotebookPen, lab: FlaskConical, vocab: Languages, essay: Scale, exam: GraduationCap, book: BookOpen };
const CHIP =
  "flex h-7 items-center gap-1.5 rounded-lg border border-line bg-raised/70 px-2 text-[12.5px] text-ink-3 [@media(hover:none)]:h-8 shadow-[0_1px_0_var(--line)] transition-[color,border,background,transform] duration-150 hover:border-line-2 hover:bg-raised hover:text-ink active:scale-[0.97]";

/**
 * A quiet row of starters under the placeholder of an empty note. Gone as soon as the note has
 * anything in it: a word, a checkbox, a flashcard, even a second empty line.
 */
export function QuickStart({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const t = useMessages(editorText).quickStart;
  const tt = useMessages(templatesText);
  const locale = useLocale();
  // Not editor.isEmpty: that only looks for text, so an empty checklist or flashcard still counts as
  // empty and the row would sit on top of it.
  const empty = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const doc = e.state.doc;
      return doc.childCount === 1 && doc.firstChild?.type.name === "paragraph" && doc.firstChild.content.size === 0;
    },
  });

  const items: { id: string; label: string; icon: LucideIcon; run: () => void }[] = [
    { id: "heading", label: t.heading, icon: Heading1, run: () => editor.chain().focus("start").setNode("heading", { level: 1 }).run() },
    { id: "checklist", label: t.checklist, icon: ListTodo, run: () => editor.chain().focus("start").toggleTaskList().run() },
    {
      id: "flashcard",
      label: t.flashcard,
      icon: Layers,
      run: () => {
        editor.commands.focus("start");
        insertFlashcard(editor, null);
      },
    },
    {
      id: "image",
      label: t.image,
      icon: ImagePlus,
      run: () => {
        editor.commands.focus("start");
        onImage();
      },
    },
  ];

  return (
    <AnimatePresence>
      {empty && (
        <motion.div
          key="quick"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, y: 2, transition: { duration: 0.1 } }}
          className="absolute left-0 top-[2.35em] flex flex-wrap items-center gap-1.5 text-[15.5px]"
        >
          {items.map(({ id, label, icon: Icon, run }) => (
            <button
              key={id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className={CHIP}
            >
              <Icon className="size-3.5" strokeWidth={1.9} />
              {label}
            </button>
          ))}
          <Popover
            align="start"
            label={tt.menu}
            className="w-[280px] p-1.5"
            trigger={(props) => (
              <button {...props} type="button" onMouseDown={(e) => e.preventDefault()} className={CHIP}>
                <LayoutTemplate className="size-3.5" strokeWidth={1.9} />
                {tt.chip}
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2 pb-1.5 pt-1 text-[11.5px] text-ink-3">{tt.menu}</div>
                {TEMPLATES.map((id) => {
                  const Icon = TEMPLATE_ICONS[id] ?? ClipboardList;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        editor.chain().setContent(templateDoc(id, locale)).focus("start").run();
                      }}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-2 group-hover:text-blob-ink">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium leading-tight text-ink">{tt[id].name}</span>
                        <span className="block truncate text-[11.5px] leading-tight text-ink-3">{tt[id].hint}</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </Popover>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
