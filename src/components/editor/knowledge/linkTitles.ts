import { Extension } from "@tiptap/core";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { LOCALES } from "@/i18n/config";
import type { PageKind } from "@/lib/types";
import { pageTitle } from "@/lib/utils";
import { pageIdFromHref } from "../links";

// "[[" links are words in the text linked to /p/<id>. They remember the title the page had when the
// link was made (the link mark's pageTitle), so when the page is renamed the words can follow, but
// only while they are still exactly that title: words you changed yourself stay as you wrote them.

/** A linked page as it is now (null: it doesn't exist any more, or you can't see it). */
export type LinkedPage = { title: string; kind: PageKind; trashed: boolean } | null;

/** One "[[" link in the text: where it is, the page, the words and the other marks on its first word. */
type PageRef = { from: number; to: number; id: string; text: string; mark: Mark; marks: readonly Mark[] };

/** Every link to a page in the text (the same link split over bold and plain words counts once). */
export function pageRefs(doc: PMNode): PageRef[] {
  const out: PageRef[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let open: PageRef | null = null;
    node.forEach((child, offset) => {
      const from = pos + 1 + offset;
      const mark = child.isText ? child.marks.find((m) => m.type.name === "link") : undefined;
      const id = mark ? pageIdFromHref(mark.attrs.href) : null;
      if (open && mark && open.mark.eq(mark)) {
        open.to = from + child.nodeSize;
        open.text += child.text ?? "";
        return;
      }
      if (open) out.push(open);
      open = mark && id ? { from, to: from + child.nodeSize, id, text: child.text ?? "", mark, marks: child.marks.filter((m) => m !== mark) } : null;
    });
    if (open) out.push(open);
    return false;
  });
  return out;
}

/** The words a link to an untitled page was made with ("Untitled", "Unbenannt" …). */
const untitledNames = (kind: PageKind) => LOCALES.map((l) => pageTitle("", kind, l));

/**
 * Links whose page was renamed since the link was made get the new title, when their words are
 * still the old one. Links from before links remembered titles start remembering once their words
 * are the page's title (`adopt`). Null when nothing changes.
 */
export function followRenames(state: EditorState, pages: Map<string, LinkedPage>, adopt: boolean): Transaction | null {
  const tr = state.tr;
  const linkType = state.schema.marks.link;
  // From the end, so earlier positions stay right.
  for (const ref of pageRefs(state.doc).reverse()) {
    const page = pages.get(ref.id);
    if (!page || page.trashed) continue;
    const remembered = ref.mark.attrs.pageTitle as string | null;
    if (remembered === null) {
      if (adopt && page.title.trim() && ref.text === page.title) tr.addMark(ref.from, ref.to, linkType.create({ ...ref.mark.attrs, pageTitle: page.title }));
      continue;
    }
    // Renamed to nothing: keep the words.
    if (page.title === remembered || !page.title.trim()) continue;
    const untouched = remembered.trim() ? ref.text === remembered : untitledNames(page.kind).includes(ref.text);
    if (!untouched) continue;
    // One replacement of exactly the link's words: two people opening the note at once end up with
    // the new title once (the second replacement lands on the first).
    tr.replaceWith(ref.from, ref.to, state.schema.text(page.title, [...ref.marks, linkType.create({ ...ref.mark.attrs, pageTitle: page.title })]));
  }
  return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
}

export const pageLinkStatusKey = new PluginKey<DecorationSet>("pageLinkStatus");

export type PageLinkStatusOptions = {
  status: (id: string) => "ok" | "trash" | "gone";
  label: (status: "trash" | "gone") => string;
  /**
   * When you write for the first time, older links start remembering their page's title (undefined:
   * the linked pages haven't loaded yet, ask again on the next change).
   */
  adopt: (state: EditorState) => Transaction | null | undefined;
};

/**
 * Links to pages that are gone (deleted, or not shared with you) or in the trash look quiet
 * instead of broken: muted, with a note on hover. `status` says how a page is; the editor asks
 * for a redraw (a pageLinkStatusKey meta) when that changes.
 */
export const PageLinkStatus = Extension.create<PageLinkStatusOptions>({
  name: "pageLinkStatus",

  addOptions() {
    return { status: () => "ok", label: () => "", adopt: () => undefined };
  },

  addProseMirrorPlugins() {
    const { status, label, adopt } = this.options;
    const draw = (doc: PMNode) => {
      const decos: Decoration[] = [];
      for (const ref of pageRefs(doc)) {
        const s = status(ref.id);
        if (s !== "ok") decos.push(Decoration.inline(ref.from, ref.to, { class: `blob-ref-${s}`, title: label(s) }));
      }
      return DecorationSet.create(doc, decos);
    };
    let adopted = false;
    return [
      new Plugin<DecorationSet>({
        key: pageLinkStatusKey,
        state: {
          init: (_, state) => draw(state.doc),
          apply: (tr, set, _old, state) => (tr.docChanged || tr.getMeta(pageLinkStatusKey) ? draw(state.doc) : set),
        },
        props: { decorations: (state) => pageLinkStatusKey.getState(state) },
        appendTransaction: (transactions, _old, state) => {
          if (adopted || !transactions.some((tr) => tr.docChanged && !tr.getMeta("collab$") && tr.getMeta("addToHistory") !== false)) return null;
          const tr = adopt(state);
          if (tr === undefined) return null;
          adopted = true;
          return tr;
        },
      }),
    ];
  },
});
