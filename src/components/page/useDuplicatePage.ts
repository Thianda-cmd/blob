"use client";

// "Duplizieren" (the page menu in PageTopBar, the right-click menu in lists): a copy called
// "<title> (Kopie)" next to the original, opened right away, so last week's lab sheet can take this
// week's measurements. Spreadsheets only for now: a note's copy would share the original's files
// (FileSweep deletes them once nobody uses them) and its links, which needs a design of its own.

import { useRouter } from "next/navigation";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

/** What the copy starts with: the content and its searchable text. */
type Snapshot = { content: unknown; plain_text: string };

/** A page's title has at most 200 characters (the database's limit). */
const TITLE_MAX = 200;

/**
 * The spreadsheets open in this tab, read as they are on screen (unsaved changes and what is being
 * typed in a cell included). Their editor puts them here while they are open (OpenSheetCopy).
 * null: a formula with a mistake is still in its cell, which now says what is wrong.
 */
const openSheets = new Map<string, () => Snapshot | null>();

/** Makes an open spreadsheet's content reachable for a copy; returns the function that takes it back. */
export function keepOpenSheet(pageId: string, read: () => Snapshot | null): () => void {
  openSheets.set(pageId, read);
  return () => {
    if (openSheets.get(pageId) === read) openSheets.delete(pageId);
  };
}

/** Which pages "Duplizieren" is offered for. */
export const canDuplicate = (page: Pick<PageMeta, "kind">) => page.kind === "sheet";

export function useDuplicatePage() {
  const { pages, userId, createPage } = useWorkspace();
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages(pageText);

  return async (page: PageMeta) => {
    // Open here: as it is on screen. Otherwise what is saved (the editors save as you type).
    const read = openSheets.get(page.id);
    let snapshot = read ? read() : null;
    // A formula with a mistake still in its cell (which now says what is wrong): no copy. Opening the
    // copy would close that cell, and what was typed there would be lost in both.
    if (read && !snapshot) return;
    if (!snapshot) {
      const { data } = await createClient().from("pages").select("content, plain_text").eq("id", page.id).maybeSingle();
      if (data) snapshot = { content: data.content, plain_text: data.plain_text ?? "" };
    }
    if (!snapshot) return blob.say(t.duplicateFailed, { mood: "worried" });
    // The copy is yours: next to the original when that is among your own pages, otherwise (a page
    // shared with you, or yours inside someone else's) in your pages without a subject.
    const parent = pages.find((p) => p.id === page.parent_id);
    const beside = page.user_id === userId && (!parent || parent.user_id === userId);
    // A long name is shortened before " (Kopie)" goes on, never the " (Kopie)": the copy must not
    // get the original's very name. (By characters, as the database counts them.)
    const room = TITLE_MAX - Array.from(t.copyOf("")).length;
    const name = Array.from(pageTitle(page.title, page.kind, locale)).slice(0, room).join("").trimEnd();
    const made = await createPage({
      kind: page.kind,
      title: t.copyOf(name),
      subject_id: beside ? page.subject_id : null,
      parent_id: beside ? page.parent_id : null,
      icon: page.icon,
      tags: page.tags,
      content: snapshot.content,
      plain_text: snapshot.plain_text,
    });
    // (When that fails, createPage says so itself.)
    if (!made) return;
    router.push(`/p/${made.id}`);
    // Long enough to still be there once the copy is on screen: the student knows which one is open.
    blob.say(t.duplicated, { mood: "happy", ms: 5000 });
  };
}
