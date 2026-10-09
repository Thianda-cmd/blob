"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { fileKind, fileUrl, formatSize } from "@/lib/files";
import { cn } from "@/lib/utils";
import { FileSpec } from "./schema";

type Kind = ReturnType<typeof fileKind>;

const ICONS: Record<Kind, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  text: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  other: FileIcon,
};
/** A colour per kind of file, so a PDF looks like a PDF at a glance. */
const TINT: Record<Kind, string> = {
  pdf: "var(--subject-clay)",
  doc: "var(--subject-sky)",
  text: "var(--ink-2)",
  sheet: "var(--subject-moss)",
  slides: "var(--subject-sand)",
  image: "var(--subject-plum)",
  audio: "var(--subject-rose)",
  video: "var(--subject-teal)",
  archive: "var(--ink-2)",
  other: "var(--ink-2)",
};
const PREVIEW: Kind[] = ["pdf", "image", "audio", "video"];

/** Signed links last an hour; ask again a little before that. */
const LINK_LIFETIME = 50 * 60 * 1000;

function FileView({ node, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).file;
  const locale = useLocale();
  const path = (node.attrs.path as string) ?? "";
  const name = (node.attrs.name as string) || "file";
  const size = Number(node.attrs.size) || 0;
  const mime = (node.attrs.mime as string) ?? "";
  const kind = fileKind(mime, name);
  const Icon = ICONS[kind];
  const previewable = PREVIEW.includes(kind);
  // Pictures show right away; PDFs, audio and video when asked (they load a lot).
  const [open, setOpen] = useState(kind === "image");
  const [link, setLink] = useState<{ href: string; at: number } | null>(null);
  const [missing, setMissing] = useState(false);

  const fresh = link?.href ?? null;
  // A link that is about to run out is forgotten (and fetched again when it's needed).
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(() => setLink(null), LINK_LIFETIME);
    return () => clearTimeout(timer);
  }, [link]);
  useEffect(() => {
    if (!open || !path || link) return;
    let alive = true;
    void fileUrl(path).then((href) => {
      if (!alive) return;
      if (href) setLink({ href, at: Date.now() });
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [open, path, link]);

  const openInTab = async () => {
    // Opened before the link arrives, so the browser doesn't treat it as a popup.
    const win = window.open("about:blank", "_blank");
    const href = fresh ?? (await fileUrl(path));
    if (!href) {
      win?.close();
      setMissing(true);
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = href;
    }
  };

  const download = async () => {
    const href = await fileUrl(path, { download: name });
    if (!href) {
      setMissing(true);
      return;
    }
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };

  return (
    <NodeViewWrapper className={cn("blob-file blob-object", selected && "blob-node-selected", missing && "is-missing")} style={{ ["--tint" as string]: TINT[kind] }}>
      <div contentEditable={false}>
        <div className="blob-file-row">
          <span className="blob-file-icon" aria-hidden>
            <Icon className="size-[18px]" strokeWidth={1.8} />
          </span>
          <button type="button" data-open-editor className="blob-file-name" onClick={() => void openInTab()} title={`${t.open}: ${name}`} disabled={missing}>
            <span className="blob-file-title">{name}</span>
            <span className="blob-file-meta">{missing ? t.missing : `${t.kinds[kind]} · ${formatSize(size, locale)}`}</span>
          </button>
          <div className="blob-file-actions">
            {previewable && !missing && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={open ? t.hidePreview : t.preview}
                title={open ? t.hidePreview : t.preview}
                className={cn("blob-file-btn", open && "is-on")}
              >
                <ChevronDown className="size-4 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} />
              </button>
            )}
            <button type="button" onClick={() => void openInTab()} aria-label={t.open} title={t.open} className="blob-file-btn" disabled={missing}>
              <ExternalLink className="size-4" />
            </button>
            <button type="button" onClick={() => void download()} aria-label={t.download} title={t.download} className="blob-file-btn" disabled={missing}>
              <Download className="size-4" />
            </button>
          </div>
        </div>
        {open && previewable && !missing && (
          <div className={cn("blob-file-preview", `is-${kind}`)}>
            {!fresh ? (
              <div className="blob-file-loading">
                <span className="blob-upload-spinner" />
              </div>
            ) : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not an optimisable asset
              <img src={fresh} alt={name} loading="lazy" />
            ) : kind === "pdf" ? (
              <iframe src={fresh} title={name} loading="lazy" />
            ) : kind === "audio" ? (
              <audio src={fresh} controls preload="metadata" />
            ) : (
              <video src={fresh} controls preload="metadata" playsInline />
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** A file attached to the note: a card that opens or downloads it; PDFs, pictures, audio and video preview inside. */
export const FileBlock = FileSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },

  addKeyboardShortcuts() {
    return {
      // Enter on a selected file opens it.
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name) return false;
        const dom = editor.view.nodeDOM(sel.from);
        (dom instanceof HTMLElement ? dom.querySelector<HTMLElement>("[data-open-editor]") : null)?.click();
        return true;
      },
    };
  },
});
