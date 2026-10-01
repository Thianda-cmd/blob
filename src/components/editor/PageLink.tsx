"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CornerDownRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageIcon } from "@/components/shell/Sidebar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cn, pageTitle } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageLink: {
      /** Insert a link block to another page. */
      insertPageLink: (attrs: { id: string; title?: string }) => ReturnType;
    };
  }
}

/** Live link to a sub-page: shows the page's current icon and title, opens it on click. */
function PageLinkView({ node, selected }: ReactNodeViewProps) {
  const router = useRouter();
  const { pages } = useWorkspace();
  const id = node.attrs.id as string | null;
  const page = pages.find((p) => p.id === id);
  const href = id ? `/p/${id}` : null;

  return (
    <NodeViewWrapper as="div" className="blob-pagelink-wrap" data-drag-handle>
      <a
        href={href ?? undefined}
        contentEditable={false}
        draggable={false}
        onClick={(e) => {
          e.preventDefault();
          if (href) router.push(href);
        }}
        className={cn("blob-pagelink", selected && "is-selected", !page && "is-missing")}
        title={page ? `Open ${pageTitle(page.title, page.kind)}` : "This page was moved to the trash"}
      >
        {page ? <PageIcon page={page} className="blob-pagelink-icon" /> : <CornerDownRight className="blob-pagelink-icon" />}
        <span className="blob-pagelink-title">{page ? pageTitle(page.title, page.kind) : (node.attrs.title as string) || "Untitled"}</span>
        {!page && <span className="blob-pagelink-note">in trash</span>}
      </a>
    </NodeViewWrapper>
  );
}

export const PageLink = Node.create({
  name: "pageLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-page-id"),
        renderHTML: (attrs) => ({ "data-page-id": attrs.id }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-page-link": "", href: `/p/${node.attrs.id}` }), (node.attrs.title as string) || "Untitled"];
  },

  renderText({ node }) {
    return (node.attrs.title as string) || "Untitled";
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { id: attrs.id, title: attrs.title ?? "" } })
            // Leave the caret on a fresh line below the link, ready to keep writing.
            .command(({ tr, state }) => {
              const sel = tr.selection;
              const after = sel instanceof NodeSelection ? sel.to : sel.$to.depth > 0 ? sel.$to.after(1) : sel.to;
              const next = tr.doc.resolve(after).nodeAfter;
              if (!(next?.type.name === "paragraph" && next.content.size === 0)) tr.insert(after, state.schema.nodes.paragraph.create());
              tr.setSelection(TextSelection.create(tr.doc, after + 1));
              return true;
            })
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name) return false;
        const dom = editor.view.nodeDOM(sel.from);
        (dom instanceof HTMLElement ? dom.querySelector("a") : null)?.click();
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});
