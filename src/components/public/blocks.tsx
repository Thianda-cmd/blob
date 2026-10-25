"use client";

import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ArrowUpRight, Lock, Presentation } from "lucide-react";
import Link from "next/link";
import { DeckEmbedSpec, PageLinkSpec } from "@/components/editor/blocks/schema";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { publicText } from "@/i18n/messages/public";
import { publicHref } from "@/lib/publicLink";
import { cn, pageTitle } from "@/lib/utils";
import { PageGlyph, usePublicPages } from "./context";

// The note blocks that point at other pages, for public pages: a page the link also opens is a
// link to it (through the link), any other page stays a quiet line that says it isn't shared.

function PublicPageLinkView({ node }: ReactNodeViewProps) {
  const t = useMessages(publicText).view;
  const locale = useLocale();
  const { token, root, pages } = usePublicPages();
  const id = node.attrs.id as string | null;
  const page = id ? pages.get(id) : undefined;
  const title = page ? pageTitle(page.title, page.kind, locale) : t.privatePage;

  return (
    <NodeViewWrapper as="div" className="blob-pagelink-wrap">
      {page ? (
        <Link href={publicHref(token, page.id, root)} className="blob-pagelink" draggable={false} contentEditable={false}>
          <PageGlyph page={page} className="blob-pagelink-icon" />
          <span className="blob-pagelink-title">{title}</span>
        </Link>
      ) : (
        <span className="blob-pagelink is-missing" contentEditable={false}>
          <Lock className="blob-pagelink-icon" />
          <span className="blob-pagelink-title">{title}</span>
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const PublicPageLink = PageLinkSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PublicPageLinkView);
  },
});

function PublicDeckEmbedView({ node }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).deck;
  const tp = useMessages(publicText).view;
  const locale = useLocale();
  const { token, root, pages } = usePublicPages();
  const id = node.attrs.id as string | null;
  const page = id ? pages.get(id) : undefined;

  return (
    <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
      <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface p-3", !page && "opacity-75")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink">
          {page ? <PageGlyph page={page} className="size-5 text-blob-ink" /> : <Presentation className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-ink-3">{t.label}</span>
          <span className="block truncate text-[14.5px] font-semibold text-ink">{page ? pageTitle(page.title, "deck", locale) : tp.privatePage}</span>
        </span>
        {page && (
          <Link href={publicHref(token, page.id, root)} className="blob-btn shrink-0">
            <ArrowUpRight className="size-3.5" /> {t.open}
          </Link>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const PublicDeckEmbed = DeckEmbedSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PublicDeckEmbedView);
  },
});
