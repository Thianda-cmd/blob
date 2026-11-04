"use client";

// Spreadsheet work kept on this device whose editor was closed before it was saved (written
// offline, the app or tab closed mid-save, two tabs offline at once): sent in the background once
// Blob is online again, merged with whatever the server has by then. Only drafts whose editor is
// gone are taken (drafts.ts), one taker at a time, so an editor that is open saves its own, and no
// draft is sent twice. Loaded only when drafts.ts says there is something to send
// (src/lib/offline/useOfflineDevice.ts, signing out), since it brings the formula engine along.

import { blob } from "@/components/blob/bus";
import type { Locale } from "@/i18n/config";
import { sheetText } from "@/i18n/messages/sheet";
import { mergeWorkbooks, sameJson, type MergeReport } from "@/sheet/collab";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import { clearDraft, draftPages, markFlushed, randomUuid, takeDrafts, writeDraft, type SheetDraft } from "./drafts";
import { mergeTitle, saveOnce, supabaseApi, type SaverApi } from "./saver";

/** Send every waiting draft. Returns how many were saved. */
export async function flushSheetDrafts(userId: string, locale: Locale, api: SaverApi = supabaseApi): Promise<number> {
  let saved = 0;
  for (const pageId of await draftPages(userId)) {
    const { n, offline } = await takeDrafts(userId, pageId, async (drafts) => {
      let n = 0;
      for (const d of drafts) {
        const done = await sendDraft(userId, d, locale, api);
        // Offline: the others wait too.
        if (done === "offline") return { n, offline: true };
        if (done === "saved") n++;
      }
      return { n, offline: false };
    });
    saved += n;
    if (offline) break;
  }
  return saved;
}

/** One waiting draft: saved (or found saved already), dropped, kept for later, or offline. */
async function sendDraft(userId: string, d: SheetDraft, locale: Locale, api: SaverApi): Promise<"saved" | "dropped" | "kept" | "offline"> {
  const { pageId, writer } = d;
  let base = normalizeWorkbook(d.base, locale);
  let mine = normalizeWorkbook(d.mine, locale);
  let baseTitle = d.baseTitle;
  let title = d.title;
  let rev = d.rev;
  let lastSave = d.lastSave ?? null;
  // Its save that got no answer: if it landed, the draft's own changes start from what it sent.
  if (d.sending) {
    const landed = await api.landed(pageId, d.sending.id);
    if (landed === null) return "offline";
    if (landed) {
      base = normalizeWorkbook(d.sending.wb ?? d.mine, locale);
      baseTitle = d.sending.title;
      rev = d.rev + 1;
      lastSave = d.sending.id;
    }
  }
  const start = mine;
  /**
   * Kept for the next try, as it is now: merged with what came in (when it did), and with the save
   * that got no answer in it (it may have landed).
   */
  const keep = (sending?: { id: string; title: string }) => {
    if (sending || d.sending || rev !== d.rev || mine !== start) {
      writeDraft(userId, { ...d, rev, base, mine, baseTitle, title, at: Date.now(), sending, lastSave: lastSave ?? undefined });
    }
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    // Nothing (left) to save: the server has all of it.
    if (sameJson(base, mine) && title === baseTitle) {
      clearDraft(userId, pageId, writer);
      if (rev !== d.rev) markFlushed(pageId, rev);
      return "saved";
    }
    const saveId = randomUuid();
    const r = await saveOnce({ pageId, rev, wb: mine, calc: createCalc(mine, { locale }), title, baseTitle, saveId, lastSave, locale }, api);
    if (r.ok) {
      clearDraft(userId, pageId, writer);
      markFlushed(pageId, r.rev);
      return "saved";
    }
    if (r.reason === "behind") {
      const theirs = normalizeWorkbook(r.content, locale);
      const report: MergeReport = { conflicts: [] };
      mine = mergeWorkbooks(base, mine, theirs, report, locale);
      if (report.conflicts.length) sayConflict(locale, title || r.title, report);
      title = mergeTitle(baseTitle, title, r.title);
      base = theirs;
      baseTitle = r.title;
      rev = r.rev;
      continue;
    }
    // No access any more (or the page is gone): nothing on this device can change that.
    if (r.reason === "denied") {
      clearDraft(userId, pageId, writer);
      return "dropped";
    }
    if (r.reason === "offline") {
      keep({ id: saveId, title });
      return "offline";
    }
    // An error or too big: it waits for the editor or the next try.
    keep();
    return "kept";
  }
  keep();
  return "kept";
}

/** Merging kept both versions of sheets whose rows or columns both sides had moved (mine on a copy, while there is room for one): said, since no editor is open to show it. */
function sayConflict(locale: Locale, pageTitle: string, report: MergeReport) {
  const t = sheetText[locale];
  blob.say(t.conflictElsewhere(pageTitle.trim() || t.untitled, report.conflicts), { mood: "thinking", ms: 12000 });
}
