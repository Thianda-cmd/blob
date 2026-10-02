"use client";

import { rewriteUnknownContent, type Content, type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, type UseEditorOptions } from "@tiptap/react";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { blob } from "@/components/blob/bus";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave } from "@/components/page/useAutosave";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { editorText, type EditorText } from "@/i18n/messages/editor";
import { createClient } from "@/lib/supabase/client";
import type { Page } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { BubbleToolbar } from "./BubbleToolbar";
import { buildExtensions } from "./extensions";
import { IconPicker } from "./IconPicker";
import { IMAGE_TYPES, dropPos, imageFiles, uploadImages } from "./imageUpload";
import styles from "./NoteEditor.module.css";
import { noteCache } from "./noteCache";
import { NoteMeta } from "./NoteMeta";
import { PageOutline } from "./PageOutline";
import { QuickStart } from "./QuickStart";
import { SlashController } from "./slash/SlashCommand";
import { SlashMenu } from "./slash/SlashMenu";

type NotePatch = { title: string; content: JSONContent; plain_text: string };

const PLAIN_TEXT_LIMIT = 20_000;

function initialContent(content: unknown, plain: string): Content | undefined {
  if (content && typeof content === "object" && (content as JSONContent).type === "doc") return content as JSONContent;
  if (typeof content === "string" && content.trim()) return content;
  // Never open a note as blank when we know it has words in it.
  if (plain.trim()) return plainDoc(plain);
  return undefined;
}

function plainDoc(plain: string): JSONContent {
  return {
    type: "doc",
    content: plain.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
  };
}

/** The document without the empty paragraph the editor keeps at the end for typing. */
function contentToSave(editor: Editor): JSONContent {
  const json = editor.getJSON();
  const blocks = json.content ?? [];
  const last = blocks[blocks.length - 1];
  if (blocks.length > 1 && last?.type === "paragraph" && !last.content?.length) return { ...json, content: blocks.slice(0, -1) };
  return json;
}

function plainText(editor: Editor) {
  return editor
    .getText({ blockSeparator: "\n" })
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, PLAIN_TEXT_LIMIT);
}

/** Holder for what the long-lived editor callbacks need from the latest render. */
class Latest<T> {
  current: T | null = null;
  set(value: T) {
    this.current = value;
  }
}

type Live = {
  locale: Locale;
  text: EditorText;
  schedule: (patch: Partial<NotePatch>) => void;
  userId: string;
  openHref: (href: string) => void;
  pickImage: () => void;
  createSubPage: (editor: Editor) => Promise<void>;
  focusTitle: () => void;
  markBroken: () => void;
};

export function NoteEditor({ page }: { page: Page }) {
  const t = useMessages(editorText);
  const locale = useLocale();
  const router = useRouter();
  const { pages, userId, updatePage, createPage } = useWorkspace();
  const meta = pages.find((p) => p.id === page.id);
  const icon = meta ? meta.icon : page.icon;
  // Back/forward can hand us cached (older) props: start from what this tab last wrote.
  const [initial] = useState(() => noteCache.freshest(page));

  const [title, setTitle] = useState(initial.title);
  const [broken, setBroken] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  const save = useCallback(
    async (patch: Partial<NotePatch>) => {
      const version = noteCache.version(page.id);
      const { data, error } = await createClient().from("pages").update(patch).eq("id", page.id).select("updated_at").maybeSingle();
      if (error) return false;
      noteCache.saved(page.id, version, (data as { updated_at?: string } | null)?.updated_at);
      // Bump updated_at locally so "Edited …" and recent lists stay honest.
      void updatePage(page.id, {}, { local: true });
      return true;
    },
    [page.id, updatePage],
  );
  const { state: saveState, schedule, flush } = useAutosave<NotePatch>(save);

  const focusTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const [live] = useState(() => new Latest<Live>());
  useEffect(() => {
    live.set({
      locale,
      text: t,
      schedule,
      userId,
      focusTitle,
      markBroken: () => setBroken(true),
      openHref: (href) => {
        if (href.startsWith("/")) router.push(href);
        else window.open(href, "_blank", "noopener,noreferrer");
      },
      pickImage: () => fileRef.current?.click(),
      createSubPage: async (editor) => {
        const created = await createPage({ kind: "note", parent_id: page.id, subject_id: meta ? meta.subject_id : page.subject_id });
        if (!created || editor.isDestroyed) return;
        // No stored title: the link shows the page's live title, or "Untitled" in the reader's language.
        editor.chain().focus().insertPageLink({ id: created.id, title: "" }).run();
        blob.react("jump", "happy");
      },
    });
  });

  const [slash] = useState(() => new SlashController());
  const [options] = useState<UseEditorOptions & { immediatelyRender: false }>(() => ({
    immediatelyRender: false,
    content: initialContent(initial.content, initial.plain_text ?? ""),
    // Content we can't read must never be silently replaced by an empty doc and autosaved.
    enableContentCheck: true,
    onContentError: ({ editor }) => {
      editor.setEditable(false, false);
      live.current?.markBroken();
    },
    extensions: buildExtensions({
      slash,
      runSlash: (item, editor, range) =>
        item.run({
          editor,
          range,
          ctx: {
            pickImage: () => live.current?.pickImage(),
            createSubPage: async (e) => live.current?.createSubPage(e),
          },
        }),
      onExitTop: () => live.current?.focusTitle(),
      getLocale: () => live.current?.locale ?? locale,
    }),
    editorProps: {
      attributes: { class: "prose-blob", spellcheck: "true", "aria-label": t.contentLabel },
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length || !live.current) return false;
        // Rich content (e.g. from Word) also carries a picture of itself: prefer the text.
        if (event.clipboardData?.getData("text/plain").trim()) return false;
        event.preventDefault();
        uploadImages(view, files, live.current.userId, live.current.text.upload);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !live.current) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        uploadImages(view, files, live.current.userId, live.current.text.upload, dropPos(view, event));
        return true;
      },
      handleClick: (view, _pos, event) => {
        // Plain clicks open links (like Notion); shift/alt-clicks keep editing the selection.
        if (event.button !== 0 || event.shiftKey || event.altKey) return false;
        const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
        if (!link || !view.dom.contains(link)) return false;
        const href = link.getAttribute("href");
        if (!href) return false;
        event.preventDefault();
        live.current?.openHref(href);
        return true;
      },
    },
    onUpdate: ({ editor, transaction }) => {
      // Only real edits: skip transactions that merely append the trailing paragraph.
      if (!transaction.docChanged || !live.current) return;
      const content = contentToSave(editor);
      noteCache.touch(page.id, { content });
      live.current.schedule({ content, plain_text: plainText(editor) });
    },
  }));
  const editor = useEditor(options, []);

  // Unreadable stored content: show a best-effort, read-only rendering (never saved).
  useEffect(() => {
    if (!broken || !editor) return;
    let doc: JSONContent | null = null;
    if (initial.content && typeof initial.content === "object") {
      try {
        doc = rewriteUnknownContent(initial.content as JSONContent, editor.schema).json;
      } catch {}
    }
    try {
      editor.commands.setContent(doc ?? plainDoc(initial.plain_text ?? ""), { emitUpdate: false, errorOnInvalidContent: false });
    } catch {}
  }, [broken, editor, initial]);

  // Title ---------------------------------------------------------------------
  const resizeTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(resizeTitle, [title, resizeTitle]);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const ro = new ResizeObserver(resizeTitle);
    ro.observe(el);
    return () => ro.disconnect();
  }, [resizeTitle]);

  useEffect(() => {
    document.title = `${pageTitle(title, "note", locale)} · Blob`;
  }, [title, locale]);

  const changeTitle = (value: string) => {
    const next = value.replace(/[\r\n]+/g, " ").slice(0, 300);
    setTitle(next);
    noteCache.touch(page.id, { title: next });
    schedule({ title: next });
    void updatePage(page.id, { title: next }, { local: true });
  };

  /** Move the caret to the top of the body (synchronously, so fast typists don't lose keys). */
  const enterBody = (newBlock: boolean) => {
    if (!editor) return;
    const first = editor.state.doc.firstChild;
    const firstIsEmptyText = first?.type.name === "paragraph" && first.content.size === 0;
    const chain = editor.chain();
    if (newBlock && !firstIsEmptyText) chain.insertContentAt(0, { type: "paragraph" });
    chain.setTextSelection(0).run();
    editor.view.focus();
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (e.key === "Enter") {
      e.preventDefault();
      enterBody(el.selectionStart === el.value.length && el.value.length > 0);
    } else if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      e.preventDefault();
      enterBody(false);
    }
  };

  const changeIcon = (next: string | null) => {
    void updatePage(page.id, { icon: next });
    if (next) blob.react("poke", "happy", 900);
  };

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void flush();
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", styles.root)} onKeyDownCapture={onKeyDownCapture}>
      <PageTopBar pageId={page.id} saveState={saveState} />

      <div ref={setScroller} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="relative min-h-full">
          <article className="px-6 pb-[28vh] pt-8 sm:px-12 sm:pt-[8vh]">
            <div className="mx-auto w-full max-w-[720px]">
              <header className="group/header">
                <div className={cn("flex items-end", icon ? "mb-2" : "mb-1.5")}>
                  <IconPicker icon={icon} onChange={changeIcon} />
                </div>
                <textarea
                  ref={titleRef}
                  value={title}
                  rows={1}
                  onChange={(e) => changeTitle(e.target.value)}
                  onKeyDown={onTitleKeyDown}
                  placeholder={t.untitled}
                  aria-label={t.titleLabel}
                  spellCheck
                  className="block w-full resize-none overflow-hidden bg-transparent font-display text-[34px] font-bold leading-[1.15] tracking-[-0.025em] text-ink outline-none placeholder:text-ink-3/45 sm:text-[40px]"
                />
                <div className="mt-3">
                  <NoteMeta page={meta ?? page} editor={editor} />
                </div>
              </header>

              {broken && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-3 text-[13px] text-ink-2 shadow-card" role="status">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-blob-ink" />
                  <p>{t.broken}</p>
                </div>
              )}

              <div className="relative mt-7 min-h-[1.7em]">
                <EditorContent editor={editor} className={cn("relative transition-opacity duration-300", editor ? "opacity-100" : "opacity-0")} />
                {editor && !broken && <QuickStart editor={editor} onImage={() => fileRef.current?.click()} />}
              </div>
              <div
                aria-hidden
                className="h-[18vh] cursor-text"
                onMouseDown={(e) => {
                  if (!editor) return;
                  e.preventDefault();
                  editor.commands.focus("end");
                }}
              />
            </div>
          </article>

          {editor && (
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden xl:block">
              <div className="pointer-events-auto sticky top-[16vh] pr-4">
                <PageOutline editor={editor} scroller={scroller} />
              </div>
            </div>
          )}
        </div>
      </div>

      {editor && <BubbleToolbar editor={editor} />}
      <SlashMenu controller={slash} />
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = imageFiles(e.target.files);
          e.target.value = "";
          if (editor && files.length) uploadImages(editor.view, files, userId, t.upload);
        }}
      />
    </div>
  );
}
