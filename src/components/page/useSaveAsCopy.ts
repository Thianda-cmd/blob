"use client";

// "Als Kopie speichern" for spreadsheet work that can't be saved where it is (you can't edit that
// spreadsheet any more, or the database refused the save): a spreadsheet of your own with that
// work, "<title> (Kopie)" among your pages, opened right away, as "Duplizieren" does
// (useDuplicatePage). Used by the spreadsheet editor's notice (src/components/sheet/SheetEditor.tsx)
// and for work left on the device (src/components/sheet/DeniedDrafts.tsx). The copy's editor says
// what it is once it opens (takeJustCopied), at the bottom of the editor, where its notices show
// whether or not Blob's tips are on.

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import type { PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

/** A page's title has at most 200 characters (the database's limit). */
const TITLE_MAX = 200;

/** Copies made here whose editor hasn't said yet what they are (page ids). */
const justMade = new Set<string>();

/** Is spreadsheet `pageId` a copy just made by "Als Kopie speichern" that hasn't said so yet? Its editor asks once, as it opens. */
export function takeJustCopied(pageId: string): boolean {
  return justMade.delete(pageId);
}

/**
 * Returns the function that makes the copy: the new page, or null when it couldn't be made
 * (createPage says why). `beside`: the original, when it is among your own pages (the copy goes next
 * to it); otherwise the copy goes among your pages without a subject. `made` runs once the copy
 * exists, before it opens (the work kept elsewhere can go then).
 */
export function useSaveAsCopy() {
  const { createPage, pages, userId } = useWorkspace();
  const router = useRouter();
  const locale = useLocale();
  const tp = useMessages(pageText);

  return async (from: {
    title: string;
    content: unknown;
    plain_text: string;
    beside?: Pick<PageMeta, "user_id" | "subject_id" | "parent_id">;
    made?: () => void;
  }): Promise<PageMeta | null> => {
    // A long name is shortened before " (Kopie)" goes on, by characters as the database counts them.
    const room = TITLE_MAX - Array.from(tp.copyOf("")).length;
    const name = Array.from(pageTitle(from.title, "sheet", locale)).slice(0, room).join("").trimEnd();
    const at = from.beside;
    const parent = at?.parent_id ? pages.find((p) => p.id === at.parent_id) : undefined;
    const own = !!at && at.user_id === userId && (!at.parent_id || parent?.user_id === userId);
    const made = await createPage({
      kind: "sheet",
      title: tp.copyOf(name),
      content: from.content,
      plain_text: from.plain_text,
      subject_id: own ? at.subject_id : null,
      parent_id: own ? at.parent_id : null,
    });
    if (!made) return null;
    from.made?.();
    justMade.add(made.id);
    router.push(`/p/${made.id}`);
    return made;
  };
}
