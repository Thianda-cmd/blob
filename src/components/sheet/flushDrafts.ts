"use client";

// Spreadsheet work kept on this device whose editor was closed before it was saved (written
// offline, the app or tab closed mid-save, two tabs offline at once): sent in the background once
// Blob is online again, merged with whatever the server has by then. Only drafts whose editor is
// gone are taken (drafts.ts), one taker at a time, so an editor that is open saves its own, and no
// draft is sent twice. Loaded only when drafts.ts says there is something to send
// (src/lib/offline/useOfflineDevice.ts, signing out), since it brings the formula engine along.
//
// A draft this account can't save any more (access gone, or the page is) stays on the device,
// marked, and isn't sent again: Blob asks whether to keep it as a spreadsheet of your own
// (draftAsPage) or to let it go (DeniedDrafts.tsx). Not copied by itself: an owner who took
// someone off a page didn't mean them to keep a copy of all of it.

import { blob } from "@/components/blob/bus";
import type { Locale } from "@/i18n/config";
import { sheetText } from "@/i18n/messages/sheet";
import { mergeWorkbooks, sameJson, type MergeReport } from "@/sheet/collab";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import { announceDenied, clearDraft, draftPages, markFlushed, randomUuid, takeDrafts, writeDraft, writeLastSave, type SheetDraft } from "./drafts";
import { mergeTitle, saveOnce, storedContent, supabaseApi, type SaverApi } from "./saver";

/** What a new spreadsheet of your own gets from a draft (its work as it is on the device): content and search text. */
export function draftAsPage(d: SheetDraft, locale: Locale): { content: unknown; plain_text: string } {
  const wb = normalizeWorkbook(d.mine, locale);
  const { content, plain } = storedContent(wb, createCalc(wb, { locale }), locale);
  return { content, plain_text: plain };
}

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

/** One waiting draft: saved (or found saved already), kept for later, or offline. */
async function sendDraft(userId: string, d: SheetDraft, locale: Locale, api: SaverApi): Promise<"saved" | "kept" | "offline"> {
  const { pageId, writer } = d;
  // Refused for good already: it waits for you to decide (DeniedDrafts.tsx), not for the server.
  if (d.denied) return "kept";
  let base = normalizeWorkbook(d.base, locale);
  let mine = normalizeWorkbook(d.mine, locale);
  let baseTitle = d.baseTitle;
  let title = d.title;
  let rev = d.rev;
  let lastSave = d.lastSave ?? null;
  // Its save that got no answer: if it landed, the draft's own changes start from what it sent.
  if (d.sending) {
    const landed = await api.landed(pageId, d.sending.id);
    // (Not found out now: no connection, or the server has a problem: saver.ts landedFrom.)
    if (landed == null) return "offline";
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
      writeLastSave(userId, pageId, saveId);
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
    // No access any more (or the page is gone): nothing on this device can change that, so it isn't
    // sent again. The work stays, as merged so far, until you decide what happens to it.
    if (r.reason === "denied") {
      writeDraft(userId, { ...d, rev, base, mine, baseTitle, title, at: Date.now(), sending: undefined, lastSave: lastSave ?? undefined, denied: true });
      announceDenied();
      return "kept";
    }
    if (r.reason === "offline") {
      keep({ id: saveId, title });
      return "offline";
    }
    // An error, refused as sent, or too big: it waits for the editor or the next try. (A server
    // error may come from a gateway after the save went through: the draft says so, as for "offline".)
    keep(r.reason === "error" && r.unsure ? { id: saveId, title } : undefined);
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
