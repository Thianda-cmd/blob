"use client";

// The note block that shows a chart, smart table or cells from one of your spreadsheets. Its view
// (SheetEmbedView.tsx: charts, tables and the formula engine behind them) loads only when a note
// has such a block, so notes without one stay light. Until it has loaded, a placeholder like the
// block's own "loading" stands in; a note printed meanwhile waits for it (data-print-wait,
// src/components/editor/notePrint.ts).

import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CloudOff, TriangleAlert } from "lucide-react";
import { Component, lazy, Suspense, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { SheetEmbedSpec } from "./schema";
import "./sheetEmbed.css";

const SheetEmbedView = lazy(() => import("./SheetEmbedView"));

function Placeholder({ failed }: { failed?: boolean }) {
  const t = useMessages(noteBlocksText).sheet;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const Icon = offline ? CloudOff : TriangleAlert;
  return (
    <NodeViewWrapper className="blob-embed blob-object blob-sheet-embed" contentEditable={false}>
      <div className="blob-sheet">
        <div className="blob-sheet-card">
          {failed ? (
            <div className="blob-sheet-notice" role="status">
              <Icon className="size-4" />
              <p className="m-0">{offline ? t.offline : t.failed}</p>
            </div>
          ) : (
            <div className="blob-sheet-loading" role="status" aria-live="polite" data-print-wait="">
              <span className="blob-sheet-shimmer" />
              <span>{t.loading}</span>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/** The view's code couldn't be loaded (offline, say): the block says so, the rest of the note stays. */
class ViewFailed extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Placeholder failed /> : this.props.children;
  }
}

function SheetEmbedNode(props: ReactNodeViewProps) {
  return (
    <ViewFailed>
      <Suspense fallback={<Placeholder />}>
        <SheetEmbedView {...props} />
      </Suspense>
    </ViewFailed>
  );
}

/** A chart, smart table or cells of one of your spreadsheets, live in the note. */
export const SheetEmbed = SheetEmbedSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SheetEmbedNode);
  },
});

/** The same block for public pages: it notices the public link and reads through it. */
export const PublicSheetEmbed = SheetEmbed;
