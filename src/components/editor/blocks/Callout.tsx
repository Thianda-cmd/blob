"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { BookOpen, Check, Lightbulb, PencilLine, Pin, TriangleAlert, type LucideIcon } from "lucide-react";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";

export const CALLOUT_KINDS = ["idea", "definition", "rule", "example", "warning"] as const;
/** idea: a plain callout. definition: "Begriff: Erklärung". rule: a Merksatz. */
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const CALLOUT_ICONS: Record<CalloutKind, LucideIcon> = {
  idea: Lightbulb,
  definition: BookOpen,
  rule: Pin,
  example: PencilLine,
  warning: TriangleAlert,
};

export const calloutKind = (raw: unknown): CalloutKind => (CALLOUT_KINDS.includes(raw as CalloutKind) ? (raw as CalloutKind) : "idea");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the current block in a callout (of a kind), or unwrap it. */
      toggleCallout: (kind?: CalloutKind) => ReturnType;
      setCalloutKind: (kind: CalloutKind) => ReturnType;
    };
  }
}

function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).callout;
  const { canEdit } = useNoteBlocks();
  const kind = calloutKind(node.attrs.kind);
  const Icon = CALLOUT_ICONS[kind];
  const icon = <Icon className="size-[1.05em]" strokeWidth={2} aria-hidden />;

  return (
    <NodeViewWrapper className={cn("blob-callout", `is-${kind}`)} data-kind={kind}>
      <div className="blob-callout-side" contentEditable={false}>
        {canEdit ? (
          <Popover
            align="start"
            className="w-[200px]"
            label={t.change}
            trigger={(props) => (
              <button {...props} type="button" className="blob-callout-icon" aria-label={t.change} title={t.change}>
                {icon}
              </button>
            )}
          >
            {(close) =>
              CALLOUT_KINDS.map((k) => {
                const KIcon = CALLOUT_ICONS[k];
                return (
                  <MenuItem
                    key={k}
                    icon={<KIcon className="blob-callout-menu-icon" style={{ color: `var(--callout-${k})` }} />}
                    shortcut={k === kind ? <Check className="size-3.5" /> : undefined}
                    onSelect={() => {
                      updateAttributes({ kind: k });
                      close();
                    }}
                  >
                    {t.kinds[k]}
                  </MenuItem>
                );
              })
            }
          </Popover>
        ) : (
          <span className="blob-callout-icon">{icon}</span>
        )}
      </div>
      <div className="blob-callout-main">
        {kind !== "idea" && (
          <div className="blob-callout-label" contentEditable={false}>
            {t.kinds[kind]}
          </div>
        )}
        <NodeViewContent className="blob-callout-content" />
      </div>
    </NodeViewWrapper>
  );
}

/** A soft box that makes something stand out: a key idea, a definition, a Merksatz, an example, a warning. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "idea",
        parseHTML: (el) => calloutKind(el.getAttribute("data-kind")),
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "blob-callout" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addKeyboardShortcuts() {
    return {
      // Enter on an empty last line leaves the box.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.depth < 2 || $from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) return false;
        const box = $from.node($from.depth - 1);
        if (box.type.name !== this.name || $from.index($from.depth - 1) !== box.childCount - 1 || box.childCount < 2) return false;
        return editor.commands.lift("paragraph");
      },
    };
  },

  addCommands() {
    return {
      toggleCallout:
        (kind = "idea") =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { kind }),
      setCalloutKind:
        (kind) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { kind }),
    };
  },
});
