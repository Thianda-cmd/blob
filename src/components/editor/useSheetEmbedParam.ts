"use client";

import type { Editor } from "@tiptap/core";
import { useSearchParams } from "next/navigation";
import { createElement, useEffect, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { areaName } from "@/sheet/a1";
import { embedFromParam, embedFromToken, forgetEmbedToken, isEmbedToken, readEmbedItem, sameItem, type SheetEmbedAttrs } from "@/sheet/embedAttrs";
import { privateSheets } from "./blocks/sheetEmbedData";
import { SheetEmbedOffer } from "./SheetEmbedOffer";

/** Requests already carried out in this tab (React may run the effect twice, a rebuilt editor again). */
const handled = new Set<string>();

/**
 * The address without the request. The History API keeps Next's router in step (useSearchParams
 * follows) without asking the server for the page again.
 */
function cleanAddress() {
  const rest = new URLSearchParams(window.location.search);
  rest.delete("sheetEmbed");
  const query = rest.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

/**
 * "Add to note" in a spreadsheet opens the note at /p/<id>?sheetEmbed=<one-time token> (see
 * src/sheet/embedAttrs.ts). Once the note can take changes, the chart, table or cells go at its
 * end through the editor's own commands (a normal edit: saved, and sent to the others when working
 * together, like typing), the block is scrolled to and selected, and the address loses the
 * parameter. Each request is carried out once.
 *
 * Any other ?sheetEmbed= (attributes in an address someone sent) adds nothing by itself: the bar
 * this returns asks first, for spreadsheets of your own workspace (render it above the note). The
 * address keeps such a request until it is answered.
 *
 * `ready`: the note can be edited now (working together: once it has caught up). `blocked`: it
 * can't be at all (you only view it): a word says so and nothing is added.
 */
export function useSheetEmbedParam({ editor, pageId, ready, blocked, enabled }: { editor: Editor | null; pageId: string; ready: boolean; blocked: boolean; enabled: boolean }): ReactNode {
  const params = useSearchParams();
  const t = useMessages(noteBlocksText).sheet;
  const { pages } = useWorkspace();
  const [answered, setAnswered] = useState<string | null>(null);
  const raw = enabled ? params.get("sheetEmbed") : null;
  const key = raw === null ? null : `${pageId}\n${raw}`;

  // Blob's own request (a token this tab keeps): added without asking.
  useEffect(() => {
    if (raw === null || key === null || !editor || editor.isDestroyed) return;
    if (!isEmbedToken(raw)) {
      // Attributes that can't be read, or a note you only view: nothing to offer.
      if (!embedFromParam(raw) || blocked) cleanAddress();
      return;
    }
    if (handled.has(key)) return cleanAddress();
    // Used up already (the page was reloaded) or another tab's: nothing to do.
    const attrs = embedFromToken(raw);
    if (!attrs) {
      handled.add(key);
      return cleanAddress();
    }
    if (blocked) {
      handled.add(key);
      forgetEmbedToken(raw);
      blob.say(t.viewOnly, { mood: "thinking", ms: 6000 });
      return cleanAddress();
    }
    if (!ready) return;
    // A moment later, not inside the effect: Tiptap draws the new block with React right away
    // (flushSync), which React refuses while it is still committing ("flushSync was called from
    // inside a lifecycle method"). Marked as done only when it happens, so React running the
    // effect twice still inserts it once.
    const timer = setTimeout(() => {
      if (editor.isDestroyed || handled.has(key)) return;
      handled.add(key);
      forgetEmbedToken(raw);
      addBlock(editor, attrs, t);
      cleanAddress();
    }, 0);
    return () => clearTimeout(timer);
  }, [raw, key, editor, ready, blocked, t]);

  // Anything else: offered, never added unasked.
  const offered = raw !== null && !isEmbedToken(raw) && answered !== key ? embedFromParam(raw) : null;
  const sheet = offered ? pages.find((p) => p.id === offered.pageId && String(p.kind) === "sheet" && !p.trashed_at) : undefined;
  if (!offered?.item || !sheet || !editor || !ready || blocked) return null;
  const item = offered.item;
  const title = sheet.title?.trim() || t.untitled;
  const question = item.kind === "chart" ? t.offer.chart(title) : item.kind === "table" ? t.offer.table(title) : t.offer.range(title, areaName(item.area));
  const answer = (add: boolean) => {
    setAnswered(key);
    if (add && !editor.isDestroyed) addBlock(editor, offered, t);
    cleanAddress();
  };
  return createElement(SheetEmbedOffer, { question, add: t.offer.add, no: t.offer.no, onAnswer: answer });
}

/** The block at the end of the note, selected and scrolled to, and a word that it is there. */
function addBlock(editor: Editor, attrs: SheetEmbedAttrs, t: NoteBlocksText["sheet"]) {
  const at = insertAtEnd(editor, attrs);
  if (at === null) return;
  blob.say(t.added, { mood: "happy" });
  // The spreadsheet may still have been saving when its page closed: look again in a moment.
  const pageOfSheet = attrs.pageId;
  if (pageOfSheet) setTimeout(() => void privateSheets.ensure(pageOfSheet, 0), 2500);
  // Once the block has drawn: bring it into view.
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.nodeDOM(at);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

/**
 * Put the block at the end of the note (before the empty line kept there for typing) and select it.
 * When the note already ends with this very block (the page was reloaded before the address was
 * cleaned), that one is selected instead. Returns the block's position.
 */
function insertAtEnd(editor: Editor, attrs: SheetEmbedAttrs): number | null {
  const { doc } = editor.state;
  let lastIndex = doc.childCount - 1;
  let last = doc.lastChild;
  const emptyLine = (n: typeof last) => !!n && n.type.name === "paragraph" && n.content.size === 0;
  if (emptyLine(last) && lastIndex > 0) {
    lastIndex--;
    last = doc.child(lastIndex);
  }
  let end = doc.content.size;
  if (emptyLine(doc.lastChild)) end -= doc.lastChild!.nodeSize;
  if (last && last.type.name === "sheetEmbed" && last.attrs.pageId === attrs.pageId && sameItem(readEmbedItem(last.attrs.item), attrs.item)) {
    const pos = end - last.nodeSize;
    editor.commands.setNodeSelection(pos);
    return pos;
  }
  const ok = editor
    .chain()
    .insertContentAt(end, { type: "sheetEmbed", attrs: { pageId: attrs.pageId, item: attrs.item, size: "m", caption: "" } })
    .setNodeSelection(end)
    .run();
  if (!ok) return null;
  // Typing in the note goes on after it (no keyboard popping up on touch screens, though).
  if (!matchMedia("(hover: none) and (pointer: coarse)").matches) editor.view.focus();
  return end;
}
