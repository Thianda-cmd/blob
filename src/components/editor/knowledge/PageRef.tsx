"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { FilePlus2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PageIcon } from "@/components/shell/Sidebar";
import { Kbd } from "@/components/ui/Kbd";
import { useLocale, useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { filterItems } from "../blocks/Picker";
import type { SlashController, SlashSnapshot } from "../slash/SlashCommand";
import { pageRefPluginKey } from "../suggestKeys";

/** A row of the "[[" menu: a page to link, or a new page named like the query. */
export type PageRefItem = { kind: "page"; id: string; page: PageMeta; where: string } | { kind: "create"; id: "create"; title: string };

/** Pages for "[[query": recent ones first while nothing is typed, then the best title matches. */
export function pageRefItems(pages: PageMeta[], self: string, query: string, where: (p: PageMeta) => string, untitled: (p: PageMeta) => string): PageRefItem[] {
  const q = query.replace(/\]+$/, "").trim();
  const candidates = pages.filter((p) => p.id !== self && p.kind !== "cv" && !p.trashed_at);
  const ranked = q
    ? filterItems(
        candidates.map((p) => ({ key: p.id, label: p.title || untitled(p), page: p })),
        q,
      ).map((x) => x.page)
    : [...candidates].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const items: PageRefItem[] = ranked.slice(0, 8).map((p) => ({ kind: "page", id: p.id, page: p, where: where(p) }));
  const exact = candidates.some((p) => p.title.trim().toLocaleLowerCase() === q.toLocaleLowerCase());
  if (q && !exact) items.push({ kind: "create", id: "create", title: q.slice(0, 200) });
  return items;
}

/**
 * Insert "[[" link text: the page's title, linked to it (a normal link, so the words stay words).
 * `title` is the page's own title ("" when it has none, `text` then names it), remembered so the
 * words can follow when the page is renamed (linkTitles.ts).
 */
export function insertPageRef(editor: Editor, range: Range, id: string, title: string, text = title) {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      { type: "text", text, marks: [{ type: "link", attrs: { href: `/p/${id}`, pageTitle: title } }] },
      { type: "text", text: " " },
    ])
    .run();
}

/** Typing "[[" opens a search over your pages; picking one links to it in the text. */
export const PageRefSuggest = Extension.create<{
  controller: SlashController<PageRefItem> | null;
  items: (query: string) => PageRefItem[];
  run: (item: PageRefItem, editor: Editor, range: Range) => void;
}>({
  name: "pageRefSuggest",

  addOptions() {
    return { controller: null, items: () => [], run: () => {} };
  },

  addProseMirrorPlugins() {
    const { controller, items, run } = this.options;
    if (!controller) return [];
    return [
      Suggestion<PageRefItem, PageRefItem>({
        editor: this.editor,
        pluginKey: pageRefPluginKey,
        char: "[[",
        allowSpaces: true,
        allowedPrefixes: null,
        decorationClass: "blob-slash-query",
        placement: "bottom-start",
        offset: { mainAxis: 8, crossAxis: -4 },
        floatingUi: { strategy: "fixed" },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.spec.code) return false;
          return !$from.marks().some((m) => m.type.name === "code");
        },
        items: ({ query }) => items(query),
        command: ({ editor, range, props }) => run(props, editor, range),
        render: controller.renderer,
      }),
    ];
  },
});

/** The "[[" menu, drawn like the "/" menu. */
export function PageRefMenu({ controller }: { controller: SlashController<PageRefItem> }) {
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const host = controller.host;
  if (!snap.open || !host) return null;
  return createPortal(<PageRefPanel key={snap.session} controller={controller} snap={snap} />, host);
}

function PageRefPanel({ controller, snap }: { controller: SlashController<PageRefItem>; snap: SlashSnapshot<PageRefItem> }) {
  const t = useMessages(noteBlocksText).pageRef;
  const keys = useMessages(editorText).slash;
  const locale = useLocale();
  const { items, query, placement } = snap;
  const [active, setActive] = useState(0);
  const [seenQuery, setSeenQuery] = useState(query);
  const listRef = useRef<HTMLDivElement>(null);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setActive(0);
  }
  const current = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    controller.setKeyHandler((event) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((current + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((current - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        controller.choose(items[current]);
        return true;
      }
      return false;
    });
    return () => controller.setKeyHandler(null);
  }, [controller, items, current]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: placement === "top" ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 560, damping: 30, mass: 0.7 }}
      style={{ transformOrigin: placement === "top" ? "bottom left" : "top left" }}
      className="w-[min(320px,calc(100vw-16px))] overflow-hidden rounded-xl border border-line bg-raised text-ink shadow-pop"
      role="listbox"
      aria-label={t.label}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11.5px] font-medium text-ink-3">
        <span className="font-mono text-ink-2">[[</span> {query.trim() ? t.label : t.empty}
      </div>
      <div ref={listRef} className="max-h-[min(320px,46vh)] overflow-y-auto overscroll-contain p-1">
        {items.length === 0 ? (
          <div className="px-3 py-5 text-center text-[13px] text-ink-3">{t.noMatch}</div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.kind === "page" ? item.id : "create"}
              type="button"
              role="option"
              aria-selected={i === current}
              data-active={i === current}
              onMouseMove={() => i !== current && setActive(i)}
              onClick={() => controller.choose(item)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-100", i === current ? "bg-hover" : "hover:bg-hover/60")}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-2">
                {item.kind === "page" ? <PageIcon page={item.page} className="size-4" /> : <FilePlus2 className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">
                  {item.kind === "page" ? pageTitle(item.page.title, item.page.kind, locale) : t.create(item.title)}
                </span>
                {item.kind === "page" && item.where && <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-3">{item.where}</span>}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex h-8 items-center gap-3 border-t border-line bg-surface/60 px-2.5 text-[11px] text-ink-3 [@media(hover:none)]:hidden">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> {keys.navigate}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> {keys.insert}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> {keys.close}
        </span>
      </div>
    </motion.div>
  );
}
