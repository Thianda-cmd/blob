import type { subjectsText } from "@/i18n/messages/subjects";
import type { PageKind, PageMeta } from "@/lib/types";

type Text = (typeof subjectsText)["en"];
type CountText = "noteCount" | "sheetCount" | "inkCount" | "deckCount" | "folderCount";

/** The kinds a subject's counts name, in the order of every create menu and list. */
const COUNTED: readonly (readonly [PageKind, CountText])[] = [
  ["note", "noteCount"],
  ["sheet", "sheetCount"],
  ["ink", "inkCount"],
  ["deck", "deckCount"],
  ["folder", "folderCount"],
];

/**
 * What a subject holds, the same on Start's subject cards and in the subject page's meta line:
 * "5 Notizen · 4 Tabellen · 1 Handschrift · 2 Ordner". Only the kinds it has; nothing at all is
 * "0 Notizen".
 */
export function subjectCounts(pages: readonly Pick<PageMeta, "kind">[], t: Text): string[] {
  const parts: string[] = [];
  for (const [kind, text] of COUNTED) {
    const n = pages.filter((p) => p.kind === kind).length;
    if (n) parts.push(t[text](n));
  }
  return parts.length ? parts : [t.noteCount(0)];
}
