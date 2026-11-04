"use client";

// The note block that shows a chart, smart table or cells from one of your spreadsheets. Its view
// (SheetEmbedView.tsx: charts, tables and the formula engine behind them) loads only when a note
// has such a block, so notes without one stay light. Until it has loaded, a placeholder like the
// block's own "loading" stands in; a note printed meanwhile waits for it (data-print-wait,
// src/components/editor/notePrint.ts). Should loading fail (offline, a dropped connection), the
// block says so and tries again when asked to or when the device is back online.

import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Component, lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { SheetEmbedSpec } from "./schema";
import "./sheetEmbed.css";

type View = LazyExoticComponent<ComponentType<ReactNodeViewProps>>;

// React keeps a lazy component that failed to load failed for good: after a failure, the next
// block (or the next try) gets a new one, which loads the code again.
let loadFailed = false;
const load = () =>
  import("./SheetEmbedView").catch((e: unknown) => {
    loadFailed = true;
    throw e;
  });
let current: View = lazy(load);

/** The view to render: the one already loaded (or loading), or a new try after a failure. */
function lazyView(): View {
  if (loadFailed) {
    loadFailed = false;
    current = lazy(load);
  }
  return current;
}

function Placeholder({ onRetry }: { onRetry?: () => void }) {
  const t = useMessages(noteBlocksText).sheet;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const Icon = offline ? CloudOff : TriangleAlert;
  return (
    <NodeViewWrapper className="blob-embed blob-object blob-sheet-embed" contentEditable={false}>
      <div className="blob-sheet">
        <div className="blob-sheet-card">
          {onRetry ? (
            <div className="blob-sheet-notice" role="status">
              <Icon className="size-4" />
              <div className="min-w-0">
                <p className="m-0">{offline ? t.offline : t.failed}</p>
                <div className="blob-sheet-notice-actions">
                  <button type="button" className="blob-btn" onClick={onRetry}>
                    <RefreshCw className="size-3.5" /> {t.retry}
                  </button>
                </div>
              </div>
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

/**
 * The block: its view once the code has loaded. If it couldn't be loaded, the block says so (the
 * rest of the note stays) and tries again on "Nochmal versuchen" or when the device is online again.
 */
class SheetEmbedNode extends Component<ReactNodeViewProps, { View: View; failed: boolean }> {
  state = { View: lazyView(), failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidMount() {
    window.addEventListener("online", this.retry);
  }

  componentWillUnmount() {
    window.removeEventListener("online", this.retry);
  }

  retry = () => {
    if (this.state.failed) this.setState({ View: lazyView(), failed: false });
  };

  render() {
    const { View, failed } = this.state;
    if (failed) return <Placeholder onRetry={this.retry} />;
    return (
      <Suspense fallback={<Placeholder />}>
        <View {...this.props} />
      </Suspense>
    );
  }
}

/** A chart, smart table or cells of one of your spreadsheets, live in the note. */
export const SheetEmbed = SheetEmbedSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SheetEmbedNode);
  },
});

/** The same block for public pages: it notices the public link and reads through it. */
export const PublicSheetEmbed = SheetEmbed;
