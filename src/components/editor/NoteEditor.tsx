"use client";

import { rewriteUnknownContent, type Content, type Editor, type JSONContent, type Range } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState, type UseEditorOptions } from "@tiptap/react";
import { getVersion, sendableSteps } from "prosemirror-collab";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { CloudOff, Eye, Info, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { blob } from "@/components/blob/bus";
import { useDueCards } from "@/components/notes/useDueCards";
import { PageTopBar } from "@/components/page/PageTopBar";
import { useAutosave, type SaveState } from "@/components/page/useAutosave";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { editorText, type EditorText } from "@/i18n/messages/editor";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { useTableChanges } from "@/lib/live";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member, Page, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { NoteBlocksProvider, type NoteBlocks } from "./blocks/context";
import { uploadNoteFiles } from "./blocks/fileUpload";
import { TableMenu } from "./blocks/Table";
import { BubbleToolbar } from "./BubbleToolbar";
import { localChange, sliceOf, type LocalChange } from "./collab/conflict";
import { useNoteCollab } from "./collab/useNoteCollab";
import { buildExtensions } from "./extensions";
import { IconPicker } from "./IconPicker";
import { IMAGE_TYPES, dropPos, imageFiles, uploadImages } from "./imageUpload";
import { KnowledgeChips } from "./knowledge/Chips";
import { NoteConnections } from "./knowledge/Connections";
import { followRenames, pageLinkStatusKey, pageRefs, type LinkedPage } from "./knowledge/linkTitles";
import { PageRefMenu, insertPageRef, pageRefItems, type PageRefItem } from "./knowledge/PageRef";
import { collectLinks, pageIdFromHref } from "./links";
import { noteCache } from "./noteCache";
import { NoteMeta } from "./NoteMeta";
import { PageOutline } from "./PageOutline";
import { EditorContextMenu } from "./EditorContextMenu";
import { QuickStart } from "./QuickStart";
import { plainDoc, plainTextOf } from "./schema";
import { SlashController } from "./slash/SlashCommand";
import { SlashMenu } from "./slash/SlashMenu";
import { StudyMenu } from "./StudyMenu";

type NotePatch = { title: string; content: JSONContent; plain_text: string; links: string[] };

function initialContent(content: unknown, plain: string): Content | undefined {
  if (content && typeof content === "object" && (content as JSONContent).type === "doc") return content as JSONContent;
  if (typeof content === "string" && content.trim()) return content;
  // Never open a note as blank when we know it has words in it.
  if (plain.trim()) return plainDoc(plain);
  return undefined;
}

/** The document without the empty paragraph the editor keeps at the end for typing. */
function contentToSave(editor: Editor): JSONContent {
  const json = editor.getJSON();
  const blocks = json.content ?? [];
  const last = blocks[blocks.length - 1];
  if (blocks.length > 1 && last?.type === "paragraph" && !last.content?.length) return { ...json, content: blocks.slice(0, -1) };
  return json;
}

/** The note's plain text (the server works it out the same way when it settles a note). */
function plainText(editor: Editor) {
  return plainTextOf(editor.state.doc);
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
  /** Working together: the document is saved by useNoteCollab, not by us. */
  collab: boolean;
  readOnly: boolean;
  userId: string;
  pageId: string;
  openHref: (href: string) => void;
  pickImage: () => void;
  pickFile: () => void;
  blocksText: NoteBlocksText;
  pages: PageMeta[];
  /** Where a page lives, for the "[[" menu (its parent page or subject). */
  where: (p: PageMeta) => string;
  createLinkedPage: (editor: Editor, range: Range, title: string) => Promise<void>;
  createSubPage: (editor: Editor) => Promise<void>;
  /** Switch to working together, bringing over what was written on its own. */
  joinTogether: () => Promise<void>;
  focusTitle: () => void;
  markBroken: () => void;
  /** How a page linked from the text is now (gone: deleted, or not shared with you). */
  linkStatus: (id: string) => "ok" | "trash" | "gone";
  /** At your first edit, links from before links remembered titles start remembering them (undefined: not looked up yet). */
  adoptTitles: (state: EditorState) => Transaction | null | undefined;
};

/** The document an editor is created with: the stored content, and its plain text as a fallback. */
type Source = { content: unknown; plain: string };

/**
 * `role` is your role on the page ("viewer": read only); `members` everyone on it (more than one:
 * the note is shared, and edits go through useNoteCollab).
 */
export function NoteEditor({ page, role = "owner", members = [] }: { page: Page; role?: AccessRole; members?: Member[] }) {
  const t = useMessages(editorText);
  const tb = useMessages(noteBlocksText);
  const locale = useLocale();
  const router = useRouter();
  const { pages, subjects, userId, profile, updatePage, createPage } = useWorkspace();
  const meta = pages.find((p) => p.id === page.id);
  const icon = meta ? meta.icon : page.icon;
  const shared = members.length > 1;
  const readOnly = role === "viewer";
  // Back/forward can hand us cached (older) props: start from what this tab last wrote. A shared note
  // must start exactly at its saved version (the others' steps build on it), so it never does.
  const [initial] = useState(() => (shared ? page : noteCache.freshest(page)));

  const [title, setTitle] = useState(initial.title);
  const [broken, setBroken] = useState(false);
  /** The note is being reloaded from the server (switching to working together, or catching up). */
  const [reloading, setReloading] = useState(false);
  /** Working together: the step version the current editor started at (null: the note saves on its own). */
  const [together, setTogether] = useState<{ version: number } | null>(() => (shared ? { version: page.doc_version ?? 0 } : null));
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const titleEditedAt = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  // Working together is on for shared notes, and for a note that has steps nobody saved yet.
  const collabOn = together !== null;
  /** What the server holds from this tab's point of view (the last content saved alone, at baseVersion). */
  const lastSaved = useRef<JSONContent | null>(initial.content && typeof initial.content === "object" ? (initial.content as JSONContent) : null);
  const baseVersion = useRef(page.doc_version ?? 0);
  /** reloadTogether (declared further down, with the editor). */
  const reloadRef = useRef<(keepLocal?: boolean) => Promise<void>>(async () => {});
  /** The pages the text links to ("[["), as they are now: looked up when the note opens and when links are added. */
  const linked = useRef(new Map<string, LinkedPage>());
  /** The titles were looked up fresh since the note opened. */
  const freshTitles = useRef(false);

  const save = useCallback(
    async (patch: Partial<NotePatch>) => {
      const version = noteCache.version(page.id);
      const { data, error } = await createClient().from("pages").update(patch).eq("id", page.id).select("updated_at").maybeSingle();
      if (error?.code === "BL409") {
        // Others wrote to this note together meanwhile (their steps aren't in the saved text yet): the
        // title is saved on its own, and the note switches to working together, bringing your text over.
        if (patch.title !== undefined) await createClient().from("pages").update({ title: patch.title }).eq("id", page.id);
        void reloadRef.current(true);
        return true;
      }
      if (error) return false;
      if (patch.content) lastSaved.current = patch.content;
      noteCache.saved(page.id, version, (data as { updated_at?: string } | null)?.updated_at);
      // Bump updated_at locally so "Edited …" and recent lists stay honest.
      void updatePage(page.id, {}, { local: true });
      return true;
    },
    [page.id, updatePage],
  );
  const { state: autosaveState, schedule, flush } = useAutosave<NotePatch>(save);

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
      collab: collabOn,
      readOnly,
      userId,
      pageId: page.id,
      focusTitle,
      joinTogether: () => reloadRef.current(true),
      markBroken: () => setBroken(true),
      linkStatus: (id) => {
        const known = pages.find((p) => p.id === id);
        if (known) return known.trashed_at ? "trash" : "ok";
        // Not looked up yet: nothing to say.
        if (!linked.current.has(id)) return "ok";
        const found = linked.current.get(id);
        return !found ? "gone" : found.trashed ? "trash" : "ok";
      },
      adoptTitles: (state) => (readOnly ? null : freshTitles.current ? followRenames(state, linked.current, true) : undefined),
      openHref: (href) => {
        if (href.startsWith("/")) router.push(href);
        else window.open(href, "_blank", "noopener,noreferrer");
      },
      pickImage: () => fileRef.current?.click(),
      pickFile: () => attachRef.current?.click(),
      blocksText: tb,
      pages,
      where: (p) => {
        const parent = p.parent_id ? pages.find((x) => x.id === p.parent_id) : undefined;
        if (parent) return pageTitle(parent.title, parent.kind, locale);
        return subjects.find((x) => x.id === p.subject_id)?.name ?? "";
      },
      createLinkedPage: async (editor, range, title) => {
        // The new page sits next to this note: in its subject (when the note is yours).
        let root: PageMeta | undefined = meta;
        for (let i = 0; i < 8 && root?.parent_id; i++) root = pages.find((x) => x.id === root!.parent_id);
        const mine = (meta ?? page).user_id === userId;
        const at = range.from;
        editor.chain().focus().deleteRange(range).run();
        const created = await createPage({ kind: "note", title, subject_id: mine ? (root ?? page).subject_id : null });
        if (!created || editor.isDestroyed) return;
        insertPageRef(editor, { from: Math.min(at, editor.state.doc.content.size), to: Math.min(at, editor.state.doc.content.size) }, created.id, title);
        blob.react("jump", "happy");
      },
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
  const [refs] = useState(() => new SlashController<PageRefItem>());
  /** Editor options for a document. A new options object creates a new editor (see useEditor below). */
  const [makeOptions] = useState(() => (source: Source): UseEditorOptions & { immediatelyRender: false } => {
    const viewer = live.current?.readOnly ?? readOnly;
    return {
      immediatelyRender: false,
      content: initialContent(source.content, source.plain),
      editable: !viewer,
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
              pickFile: () => live.current?.pickFile(),
              createSubPage: async (e) => live.current?.createSubPage(e),
            },
          }),
        onExitTop: () => live.current?.focusTitle(),
        getLocale: () => live.current?.locale ?? locale,
        readOnly: viewer,
        pageRef: {
          controller: refs,
          items: (query) => {
            const l = live.current;
            if (!l) return [];
            return pageRefItems(l.pages, l.pageId, query, l.where, (p) => pageTitle("", p.kind, l.locale));
          },
          run: (item, editor, range) => {
            if (item.kind === "page") insertPageRef(editor, range, item.id, item.page.title, item.page.title || pageTitle("", item.page.kind, live.current?.locale ?? locale));
            else void live.current?.createLinkedPage(editor, range, item.title);
          },
        },
        pageStatus: {
          status: (id) => live.current?.linkStatus(id) ?? "ok",
          label: (status) => (live.current?.text ?? t).pageLink[status === "gone" ? "missing" : "trashed"],
          adopt: (state) => live.current?.adoptTitles(state),
        },
      }),
      editorProps: {
        attributes: { class: "prose-blob", spellcheck: "true", "aria-label": t.contentLabel },
        handlePaste: (view, event) => {
          const l = live.current;
          const all = Array.from(event.clipboardData?.files ?? []);
          if (!all.length || !l) return false;
          // Rich content (e.g. from Word) also carries a picture of itself: prefer the text.
          if (event.clipboardData?.getData("text/plain").trim()) return false;
          event.preventDefault();
          const images = imageFiles(event.clipboardData?.files);
          if (images.length) uploadImages(view, images, l.userId, l.text.upload);
          const others = all.filter((f) => !images.includes(f));
          if (others.length) uploadNoteFiles(view, others, l.pageId, l.blocksText.file);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          const l = live.current;
          if (moved || !l) return false;
          const all = Array.from(event.dataTransfer?.files ?? []);
          if (!all.length) return false;
          event.preventDefault();
          const at = dropPos(view, event);
          // Pictures become images in the text; anything else (PDFs, worksheets…) a file card.
          const images = imageFiles(event.dataTransfer?.files);
          if (images.length) uploadImages(view, images, l.userId, l.text.upload, at);
          const others = all.filter((f) => !images.includes(f));
          if (others.length) uploadNoteFiles(view, others, l.pageId, l.blocksText.file, at);
          return true;
        },
        handleClick: (view, _pos, event) => {
          // Plain clicks open links (like Notion); shift/alt-clicks keep editing the selection.
          if (event.button !== 0 || event.shiftKey || event.altKey) return false;
          const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
          if (!link || !view.dom.contains(link)) return false;
          const href = link.getAttribute("href");
          if (!href) return false;
          // A page that's gone would only show "not found": the click just puts the caret there.
          const target = pageIdFromHref(href);
          if (target && live.current?.linkStatus(target) === "gone") return false;
          event.preventDefault();
          live.current?.openHref(href);
          return true;
        },
      },
      onUpdate: ({ editor, transaction }) => {
        // Only real edits: skip transactions that merely append the trailing paragraph.
        const l = live.current;
        if (!transaction.docChanged || !l || l.collab || !editor.isEditable) return;
        const content = contentToSave(editor);
        noteCache.touch(l.pageId, { content });
        l.schedule({ content, plain_text: plainText(editor), links: collectLinks(editor.state.doc, l.pageId) });
      },
    };
  });
  const [options, setOptions] = useState(() => makeOptions({ content: initial.content, plain: initial.plain_text ?? "" }));
  // Reloading the note hands the editor new options, which builds a fresh editor on the new document.
  const built = useEditor(options, [options]);
  // The editor being replaced: nothing on the page touches it any more (it is destroyed during the swap).
  const [stale, setStale] = useState<Editor | null>(null);
  const editor = stale !== null && built === stale ? null : built;

  // Unreadable stored content: show a best-effort, read-only rendering (never saved).
  useEffect(() => {
    if (!broken || !editor) return;
    const raw = options.content;
    let doc: JSONContent | null = null;
    if (raw && typeof raw === "object") {
      try {
        doc = rewriteUnknownContent(raw as JSONContent, editor.schema).json;
      } catch {}
    }
    try {
      editor.commands.setContent(doc ?? plainDoc(initial.plain_text ?? ""), { emitUpdate: false, errorOnInvalidContent: false });
    } catch {}
  }, [broken, editor, options, initial]);

  // Working together ----------------------------------------------------------

  const canEdit = !readOnly && !broken && !reloading;
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== canEdit) editor.setEditable(canEdit, false);
  }, [editor, canEdit]);

  /** Where the caret was before the editor was rebuilt (restored when the document is the same). */
  const restore = useRef<{ json: string; from: number; to: number; focus: boolean } | null>(null);

  /** A change written on its own, waiting to be brought over once the rebuilt editor has caught up. */
  const pendingChange = useRef<{ change: LocalChange; focus: boolean } | null>(null);
  const reloadBusy = useRef(false);
  const [carryFailed, setCarryFailed] = useState(false);

  /**
   * Start (again) from the saved note at its current version and work on it together. `keepLocal`:
   * coming from saving on its own, what you wrote since your last save is brought over on top of
   * what the others wrote (it may not have been saved: a save is refused while others' steps wait).
   */
  const reloadTogether = useCallback(
    async (keepLocal = false) => {
      if (reloadBusy.current) return;
      reloadBusy.current = true;
      try {
        await flush();
        // Changes still on their way go out first (the rebuilt editor starts from what the server has).
        for (let i = 0; i < 30 && editor && !editor.isDestroyed; i++) {
          try {
            if (!sendableSteps(editor.state)) break;
          } catch {
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        setReloading(true);
        const current = editor && !editor.isDestroyed ? editor : null;
        if (current) {
          const { from, to } = current.state.selection;
          restore.current = { json: JSON.stringify(current.getJSON()), from, to, focus: current.view.hasFocus() };
        }
        const { data } = await createClient().from("pages").select("content, plain_text, doc_version").eq("id", page.id).maybeSingle();
        if (!data) {
          setReloading(false);
          return;
        }
        const local = keepLocal && current && !current.isDestroyed && !together && !readOnly ? contentToSave(current) : null;
        const row = data as { content: unknown; plain_text: string | null; doc_version: number | null };
        // What you wrote since your last save, as one change on the stored note (it can't be worked
        // out when the stored note isn't the one you last saved: then a calm note says so).
        const change = local && current ? localChange(current.schema, row.content, lastSaved.current, local) : "same";
        pendingChange.current = change && change !== "same" ? { change, focus: !!restore.current?.focus } : null;
        setCarryFailed(change === null);
        setStale(current);
        setBroken(false);
        setOptions(makeOptions({ content: row.content, plain: row.plain_text ?? "" }));
        setTogether({ version: row.doc_version ?? 0 });
        setReloading(false);
      } finally {
        reloadBusy.current = false;
      }
    },
    [flush, editor, page.id, makeOptions, together, readOnly],
  );
  useEffect(() => {
    reloadRef.current = reloadTogether;
  }, [reloadTogether]);
  // The note about a change that couldn't be brought over goes away after a while.
  useEffect(() => {
    if (!carryFailed) return;
    const id = setTimeout(() => setCarryFailed(false), 15_000);
    return () => clearTimeout(id);
  }, [carryFailed]);

  /**
   * The rebuilt editor is plugged in at the stored version: what you wrote on your own goes in now,
   * as your change, and is rebased over the others' steps as they arrive (nobody's text is lost).
   */
  const onStart = useCallback((e: Editor) => {
    const pending = pendingChange.current;
    if (!pending || e.isDestroyed) return;
    pendingChange.current = null;
    const c = pending.change;
    try {
      const slice = sliceOf(e.schema, c.slice);
      const tr = e.state.tr.replace(c.from, c.to, slice).setMeta("addToHistory", false);
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(c.from + slice.size, tr.doc.content.size))));
      e.view.dispatch(tr);
      if (pending.focus) e.view.focus();
    } catch {
      setCarryFailed(true);
    }
  }, []);

  const serialize = useCallback(
    (e: Editor) => ({
      // Exactly the document at this version (with its trailing paragraph): the others' steps build on it.
      content: e.getJSON(),
      plain: plainText(e),
      links: collectLinks(e.state.doc, page.id),
    }),
    [page.id],
  );
  const me = useMemo(() => ({ user_id: userId, name: profile.full_name ?? "", avatar_url: profile.avatar_url }), [userId, profile.full_name, profile.avatar_url]);
  const collab = useNoteCollab({
    editor: reloading ? null : editor,
    pageId: page.id,
    enabled: collabOn,
    version: together?.version ?? 0,
    serialize,
    me,
    onResync: () => void reloadTogether(),
    onStart,
  });

  const collabFlush = collab.flush;
  /** Working together: send everything and store a snapshot now. */
  const flushTogether = useCallback(async () => {
    await flush();
    return collabFlush();
  }, [flush, collabFlush]);

  // The note was shared (or stopped being shared) while open, or your role changed: switch modes cleanly.
  const modeRef = useRef({ shared, readOnly });
  useEffect(() => {
    const before = modeRef.current;
    if (before.shared === shared && before.readOnly === readOnly) return;
    modeRef.current = { shared, readOnly };
    if (shared && (!together || before.readOnly !== readOnly)) {
      // (A new role rebuilds the editor too: viewers' editors are set up a little differently.)
      void reloadTogether(true);
    } else if (!shared && together) {
      // Back on its own: everything is sent and stored as a snapshot first (the plain saves that
      // follow build on it), then the note saves itself the usual way. Offline, it stays together.
      void (async () => {
        if (!(await flushTogether())) return;
        if (!editor || editor.isDestroyed) return;
        let version: number | null = null;
        try {
          version = getVersion(editor.state);
        } catch {}
        setTogether(null);
        if (version !== null) baseVersion.current = version;
        lastSaved.current = editor.getJSON();
        if (readOnly) return;
        schedule({ content: contentToSave(editor), plain_text: plainText(editor), links: collectLinks(editor.state.doc, page.id) });
      })();
    }
  }, [shared, together, reloadTogether, flushTogether, editor, readOnly, schedule, page.id]);

  // A note opened on its own whose last steps nobody saved (someone typed and left within a moment):
  // work on it together, which takes those steps in and stores them.
  useEffect(() => {
    if (shared) return;
    let alive = true;
    void createClient()
      .from("page_steps")
      .select("version")
      .eq("page_id", page.id)
      .gte("version", page.doc_version ?? 0)
      .limit(1)
      .then(({ data }) => {
        if (alive && data?.length) void live.current?.joinTogether();
      });
    return () => {
      alive = false;
    };
    // Once, when the note opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Put the caret back where it was after a rebuild with the same document.
  useEffect(() => {
    const r = restore.current;
    if (!editor || editor.isDestroyed || !r || reloading) return;
    restore.current = null;
    if (JSON.stringify(editor.getJSON()) !== r.json) return;
    const size = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(r.from, size), to: Math.min(r.to, size) });
    if (r.focus) editor.view.focus();
  }, [editor, reloading]);

  // Someone joined through an invite link (or was added): reload the members so the note switches to
  // working together. Members of a page above this one count too.
  const chain = useMemo(() => {
    const ids = [page.id];
    let parent = pages.find((p) => p.id === (meta ?? page).parent_id);
    while (parent && ids.length < 32) {
      ids.push(parent.id);
      parent = pages.find((p) => p.id === parent!.parent_id);
    }
    return ids.join(",");
  }, [pages, meta, page]);
  useTableChanges("page_members", `page_id=in.(${chain})`, () => router.refresh());
  // Without Realtime (blocked networks) a note on its own still notices someone joining: a quick
  // count now and then. Saving on its own while others work together would undo their changes.
  const memberCount = useRef<number | null>(null);
  useEffect(() => {
    if (shared) return;
    const check = async () => {
      if (document.hidden) return;
      const { count, error } = await createClient().from("page_members").select("user_id", { count: "exact", head: true }).in("page_id", chain.split(","));
      if (error || count === null) return;
      if (count > 0 && memberCount.current !== count) router.refresh();
      memberCount.current = count;
    };
    const timer = setInterval(() => void check(), 8000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [shared, chain, router]);

  // The others' title, tags and topics, live.
  useTableChanges<Pick<PageMeta, "title" | "tags" | "topics">>("pages", shared ? `id=eq.${page.id}` : null, (payload) => {
    if (payload.eventType !== "UPDATE") return;
    const row = payload.new as Partial<PageMeta>;
    const patch: Partial<PageMeta> = {};
    if (Array.isArray(row.tags)) patch.tags = row.tags;
    if (Array.isArray(row.topics)) patch.topics = row.topics;
    const typing = document.activeElement === titleRef.current || Date.now() - titleEditedAt.current < 4000;
    if (typeof row.title === "string" && !typing) {
      patch.title = row.title;
      setTitle(row.title);
    }
    void updatePage(page.id, patch, { local: true });
  });

  // Links to other pages ("[[") --------------------------------------------------

  /** Look up linked pages (false when that failed). */
  const lookUp = useCallback(async (ids: string[]) => {
    const { data, error } = await createClient().from("pages").select("id, title, kind, trashed_at").in("id", ids);
    if (error) return false;
    for (const id of ids) linked.current.set(id, null);
    for (const row of (data ?? []) as Pick<PageMeta, "id" | "title" | "kind" | "trashed_at">[]) {
      linked.current.set(row.id, { title: row.title ?? "", kind: row.kind, trashed: !!row.trashed_at });
    }
    return true;
  }, []);
  /** Redraw how links look. Only that: it must not count as an edit (no empty line added at the end either). */
  const redrawLinks = useCallback((e: Editor) => {
    if (!e.isDestroyed) e.view.dispatch(e.state.tr.setMeta(pageLinkStatusKey, true).setMeta("addToHistory", false).setMeta("skipTrailingNode", true));
  }, []);

  // Links to pages that are gone or in the trash look quiet: find out which, now and when links are added.
  useEffect(() => {
    if (!editor) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (editor.isDestroyed) return;
      const ids = [...new Set(pageRefs(editor.state.doc).map((r) => r.id))].filter((id) => !linked.current.has(id));
      if (ids.length && (await lookUp(ids)) && alive) redrawLinks(editor);
    };
    void refresh();
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 1500);
    };
    editor.on("update", onChange);
    return () => {
      alive = false;
      clearTimeout(timer);
      editor.off("update", onChange);
    };
  }, [editor, lookUp, redrawLinks]);

  // Your pages changed (one created, trashed or restored): links to them may look different now.
  const pageSet = useMemo(() => pages.map((p) => (p.trashed_at ? `${p.id}:t` : p.id)).join(","), [pages]);
  useEffect(() => {
    if (editor) redrawLinks(editor);
  }, [pageSet, editor, redrawLinks]);

  // When someone who can edit opens the note (once it has caught up with the others), links whose
  // page was renamed follow the new title, unless their words were changed. A normal change: it
  // is saved, and sent to the others when working together.
  const followed = useRef<Editor | null>(null);
  const canFollow = !!editor && canEdit && (!collabOn || collab.status === "live");
  useEffect(() => {
    if (!canFollow || !editor || followed.current === editor) return;
    followed.current = editor;
    void (async () => {
      // Fresh titles: the sidebar's may be older than the database's.
      const ids = [...new Set(pageRefs(editor.state.doc).map((r) => r.id))];
      if (ids.length && !(await lookUp(ids))) return;
      freshTitles.current = true;
      if (editor.isDestroyed || !editor.isEditable) return;
      const tr = ids.length ? followRenames(editor.state, linked.current, false) : null;
      if (tr) editor.view.dispatch(tr);
      else redrawLinks(editor);
    })();
  }, [canFollow, editor, lookUp, redrawLinks]);

  // Save state: our own saves (title, or the whole note on its own), then the steps still on their way.
  const unsent = useEditorState({
    editor: collabOn ? editor : null,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) return false;
      try {
        return sendableSteps(e.state) !== null;
      } catch {
        return false;
      }
    },
  });
  const saveState: SaveState = autosaveState !== "saved" ? autosaveState : !collabOn ? "saved" : collab.status === "offline" ? "error" : unsent ? "saving" : "saved";

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
    if (readOnly) return;
    const next = value.replace(/[\r\n]+/g, " ").slice(0, 300);
    setTitle(next);
    titleEditedAt.current = Date.now();
    if (!collabOn) noteCache.touch(page.id, { title: next });
    schedule({ title: next });
    void updatePage(page.id, { title: next }, { local: true });
  };

  /** Move the caret to the top of the body (synchronously, so fast typists don't lose keys). */
  const enterBody = (newBlock: boolean) => {
    if (!editor) return;
    const first = editor.state.doc.firstChild;
    const firstIsEmptyText = first?.type.name === "paragraph" && first.content.size === 0;
    const chain = editor.chain();
    if (newBlock && !firstIsEmptyText && editor.isEditable) chain.insertContentAt(0, { type: "paragraph" });
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

  // Flashcards of this note that are due again today (Builder B's study mode keeps track).
  const due = useDueCards(page.id);

  const blocks = useMemo<NoteBlocks>(() => ({ pageId: page.id, canEdit }), [page.id, canEdit]);

  const notice = readOnly
    ? { icon: <Eye className="size-3.5 shrink-0" />, text: t.together.viewOnly, tone: "calm" as const }
    : reloading || collab.status === "resyncing"
      ? { icon: <span className="blob-upload-spinner shrink-0" />, text: shared && !together ? t.together.switching : t.together.catchingUp, tone: "calm" as const }
      : collab.status === "offline"
        ? { icon: <CloudOff className="size-3.5 shrink-0" />, text: t.together.offline, tone: "warn" as const }
        : carryFailed
          ? { icon: <Info className="size-3.5 shrink-0" />, text: t.together.carryFailed, tone: "calm" as const }
          : null;

  return (
    <div className={"flex min-h-0 flex-1 flex-col"} onKeyDownCapture={onKeyDownCapture}>
      <PageTopBar
        pageId={page.id}
        saveState={readOnly ? "saved" : saveState}
        peers={collab.peers}
        role={role}
        members={members}
        actions={
          <StudyMenu
            pageId={page.id}
            // The study mode, search and backlinks read the stored note: store the latest first.
            beforeOpen={async () => {
              if (collabOn) await flushTogether();
              else await flush();
            }}
            due={due ?? 0}
          />
        }
      />
      {notice && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 border-t border-line px-4 py-2 text-[13px]",
            notice.tone === "warn" ? "bg-danger/8 text-danger" : "bg-blob-soft/60 text-blob-ink",
          )}
        >
          {notice.icon}
          <span className="min-w-0">{notice.text}</span>
        </p>
      )}

      <div ref={setScroller} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="relative min-h-full">
          <article className="px-4 pb-[28vh] pt-6 sm:px-12 sm:pt-[8vh]">
            <div className="mx-auto w-full max-w-[720px]">
              <header className="group/header">
                <div className={cn("flex items-end", icon ? "mb-2" : "mb-1.5")}>
                  <IconPicker icon={icon} onChange={changeIcon} />
                </div>
                <textarea
                  ref={titleRef}
                  value={title}
                  rows={1}
                  readOnly={readOnly}
                  onChange={(e) => changeTitle(e.target.value)}
                  onKeyDown={onTitleKeyDown}
                  placeholder={t.untitled}
                  aria-label={t.titleLabel}
                  spellCheck
                  className="block w-full resize-none overflow-hidden bg-transparent font-display text-[34px] font-bold leading-[1.15] tracking-[-0.025em] text-ink outline-none placeholder:text-ink-3/45 sm:text-[40px]"
                />
                <div className="mt-3 space-y-2">
                  <NoteMeta page={meta ?? page} editor={editor} />
                  <KnowledgeChips page={meta ?? page} canEdit={!readOnly} />
                </div>
              </header>

              {broken && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line bg-raised px-3.5 py-3 text-[13px] text-ink-2 shadow-card" role="status">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-blob-ink" />
                  <p>{t.broken}</p>
                </div>
              )}

              <NoteBlocksProvider value={blocks}>
                <div className="relative mt-7 min-h-[1.7em]">
                  <EditorContent
                    editor={built}
                    className={cn("relative transition-opacity duration-300", !built ? "opacity-0" : reloading || !editor ? "opacity-60" : "opacity-100")}
                  />
                  {editor && canEdit && <QuickStart editor={editor} onImage={() => fileRef.current?.click()} />}
                  {editor && (
                    <EditorContextMenu
                      editor={editor}
                      canEdit={canEdit}
                      pageId={page.id}
                      runSlash={(item, e, range) =>
                        item.run({
                          editor: e,
                          range,
                          ctx: {
                            pickImage: () => live.current?.pickImage(),
                            pickFile: () => live.current?.pickFile(),
                            createSubPage: async (x) => live.current?.createSubPage(x),
                          },
                        })
                      }
                    />
                  )}
                </div>
              </NoteBlocksProvider>
              <NoteConnections page={meta ?? page} title={title} />
              <div
                aria-hidden
                className="h-[18vh] cursor-text"
                onMouseDown={(e) => {
                  if (!editor || !canEdit) return;
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

      {editor && canEdit && <BubbleToolbar editor={editor} />}
      {editor && canEdit && <TableMenu editor={editor} />}
      <SlashMenu controller={slash} />
      <PageRefMenu controller={refs} />
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
      <input
        ref={attachRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (editor && files.length) uploadNoteFiles(editor.view, files, page.id, tb.file);
        }}
      />
    </div>
  );
}
