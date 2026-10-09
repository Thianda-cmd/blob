"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ArrowUpRight, Play, Presentation, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deckPalette, normalizeDeck, sectionNumbers } from "@/components/deck/deck";
import { SlideView } from "@/components/deck/SlideView";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { createClient } from "@/lib/supabase/client";
import type { Deck } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { Picker } from "./Picker";
import { DeckEmbedSpec } from "./schema";

type Loaded = { deck: Deck; title: string } | "missing";

/** Presentations already loaded on this page (several embeds of one deck load it once). */
const cache = new Map<string, Promise<Loaded>>();

function loadDeck(id: string): Promise<Loaded> {
  let p = cache.get(id);
  if (!p) {
    p = Promise.resolve(
      createClient()
        .from("pages")
        .select("content, title, kind, trashed_at")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as { content: unknown; title: string; kind: string; trashed_at: string | null } | null;
          if (!row || row.kind !== "deck" || row.trashed_at) return "missing" as const;
          return { deck: normalizeDeck(row.content), title: row.title };
        }),
    );
    cache.set(id, p);
    // Fresh again after a while (the deck may change while the note stays open).
    setTimeout(() => cache.delete(id), 60_000);
  }
  return p;
}

function DeckEmbedView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText);
  const locale = useLocale();
  const router = useRouter();
  const { pages } = useWorkspace();
  const { canEdit } = useNoteBlocks();
  const id = (node.attrs.id as string | null) || null;
  const [changing, setChanging] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; value: Loaded } | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void loadDeck(id).then((value) => alive && setLoaded({ id, value }));
    return () => {
      alive = false;
    };
  }, [id]);

  const decks = useMemo(
    () =>
      pages
        .filter((p) => p.kind === "deck" && !p.trashed_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((p) => ({ key: p.id, label: pageTitle(p.title, "deck", locale), icon: <Presentation className="size-4" /> })),
    [pages, locale],
  );

  if (!id || changing) {
    return (
      <NodeViewWrapper className="blob-embed blob-object" contentEditable={false}>
        <div className="blob-embed-pick">
          <div className="blob-embed-pick-head">
            <Presentation className="size-4" />
            {t.deck.pick}
          </div>
          {canEdit ? (
            decks.length ? (
              <Picker
                items={decks}
                placeholder={t.deck.search}
                empty={t.deck.noMatch}
                onPick={(key) => {
                  setChanging(false);
                  updateAttributes({ id: key });
                }}
                onCancel={id ? () => setChanging(false) : undefined}
                listClassName="max-h-[260px]"
              />
            ) : (
              <p className="px-1 pb-1 text-[13px] text-ink-3">{t.deck.none}</p>
            )
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  const value = loaded?.id === id ? loaded.value : null;
  const meta = pages.find((p) => p.id === id);
  const title = pageTitle(meta?.title ?? (value && value !== "missing" ? value.title : ""), "deck", locale);
  const deck = value && value !== "missing" ? value.deck : null;
  const palette = deck ? deckPalette(deck.theme, deck.custom) : null;
  const first = deck?.slides[0];
  const ordinal = deck && first ? sectionNumbers(deck.slides).get(first.id) : undefined;

  return (
    <NodeViewWrapper className={cn("blob-embed blob-object", selected && "blob-node-selected")} contentEditable={false}>
      <div className="@container">
        <div className="blob-deck">
          <button type="button" className="blob-deck-thumb" onClick={() => router.push(`/p/${id}`)} aria-label={`${t.deck.open}: ${title}`} disabled={value === "missing"}>
            {first && palette ? (
              <SlideView slide={first} palette={palette} ordinal={ordinal} mode="thumb" frameClassName="rounded-lg" />
            ) : (
              <span className="blob-deck-thumb-empty">
                <Presentation className="size-6" />
              </span>
            )}
          </button>
          <div className="blob-deck-info">
            <span className="blob-deck-kind">
              <Presentation className="size-3.5" /> {t.deck.label}
            </span>
            <span className="blob-deck-title" title={title}>
              {title}
            </span>
            <span className="blob-deck-meta">{value === "missing" ? t.deck.missing : deck ? t.deck.slides(deck.slides.length) : " "}</span>
            {value !== "missing" && (
              <div className="blob-deck-actions">
                <button type="button" className="blob-btn-primary" onClick={() => router.push(`/present/${id}`)}>
                  <Play className="size-3 fill-current" /> {t.deck.present}
                </button>
                <button type="button" className="blob-btn" onClick={() => router.push(`/p/${id}`)}>
                  <ArrowUpRight className="size-3.5" /> {t.deck.open}
                </button>
                {canEdit && (
                  <button type="button" className="blob-btn is-quiet" onClick={() => setChanging(true)} title={t.deck.change}>
                    <RefreshCw className="size-3.5" /> <span className="max-sm:sr-only">{t.deck.change}</span>
                  </button>
                )}
              </div>
            )}
            {value === "missing" && canEdit && (
              <div className="blob-deck-actions">
                <button type="button" className="blob-btn" onClick={() => setChanging(true)}>
                  <RefreshCw className="size-3.5" /> {t.deck.change}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/** One of your presentations inside the note: its first slide, "Present" and "Open". */
export const DeckEmbed = DeckEmbedSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DeckEmbedView);
  },
});
