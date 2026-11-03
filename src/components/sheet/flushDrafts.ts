"use client";

// Spreadsheet work kept on this device whose editor was closed before it was saved (written
// offline, the app closed mid-save): sent in the background once Blob is online again, merged
// with whatever the server has by then. Loaded only when drafts.ts says there is something to send
// (src/lib/offline/useOfflineDevice.ts), since it brings the formula engine along.

import type { Locale } from "@/i18n/config";
import { mergeWorkbooks, sameJson } from "@/sheet/collab";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import { clearDraft, draftPages, isSheetOpen, markFlushed, readDraft } from "./drafts";
import { mergeTitle, saveOnce, supabaseApi, type SaverApi } from "./saver";

/**
 * Its editor takes the draft: open in this tab, or being opened (Blob was opened right at it, or
 * came back online there: its address shows while the editor is still on its way).
 */
const leftToEditor = (pageId: string) => isSheetOpen(pageId) || (typeof location !== "undefined" && location.pathname.startsWith(`/p/${pageId}`));

/** Send every waiting draft of spreadsheets that aren't open here. Returns how many were saved. */
export async function flushSheetDrafts(userId: string, locale: Locale, api: SaverApi = supabaseApi): Promise<number> {
  let saved = 0;
  for (const pageId of await draftPages(userId)) {
    if (leftToEditor(pageId)) continue;
    const d = await readDraft(userId, pageId);
    if (!d) continue;
    let base = normalizeWorkbook(d.base, locale);
    let mine = normalizeWorkbook(d.mine, locale);
    let baseTitle = d.baseTitle;
    let title = d.title;
    let rev = d.rev;
    if (sameJson(base, mine) && title === baseTitle) {
      clearDraft(userId, pageId);
      continue;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      // Opened in the meantime: its editor takes the draft from here.
      if (leftToEditor(pageId)) break;
      const r = await saveOnce(pageId, rev, mine, createCalc(mine, { locale }), title, locale, api);
      if (r.ok) {
        clearDraft(userId, pageId);
        markFlushed(pageId, r.rev);
        saved++;
        break;
      }
      if (r.reason === "behind") {
        const theirs = normalizeWorkbook(r.content, locale);
        mine = mergeWorkbooks(base, mine, theirs);
        title = mergeTitle(baseTitle, title, r.title);
        base = theirs;
        baseTitle = r.title;
        rev = r.rev;
        continue;
      }
      // No access any more (or the page is gone): nothing on this device can change that.
      if (r.reason === "denied") clearDraft(userId, pageId);
      // Offline: the others wait too. An error or too big: it waits for the editor or the next try.
      if (r.reason === "offline") return saved;
      break;
    }
  }
  return saved;
}
