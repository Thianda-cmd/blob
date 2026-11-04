"use client";

// Spreadsheet work kept on this device that this account can't save any more: access to the
// spreadsheet is gone (taken off a shared page, the page moved out of a shared folder) or the
// spreadsheet is. The background save marks such drafts and doesn't send them again
// (flushDrafts.ts), and so does an editor that was refused (its notice says so meanwhile, with the
// same way out). Blob asks what to do with the work: keep it as a spreadsheet of your own, or let it
// go. Once when the background save finds it refused, and again when the app starts while it still
// waits: "Später" leaves it on the device until then (signing out warns about it too). Without that
// reminder, work put off would have no way back: no list shows it, and the spreadsheet itself can't
// be opened any more. Mounted once in the app shell; the spreadsheet code loads only to make a copy.
//
// Nobody asked for the question right then, so it doesn't take the keys of someone typing: it waits
// while the keyboard is in a field (the cell editor, a text field, a note's text) or a key was just
// pressed, and while another question or a menu is open (signing out asks its own:
// holdDeniedDrafts). It comes once the keyboard is free, or with the next page. None of its buttons
// has the keyboard then: Enter and Space do nothing until one is chosen, Escape means "Später".

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Blob } from "@/components/blob/Blob";
import { useSaveAsCopy } from "@/components/page/useSaveAsCopy";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { sheetText } from "@/i18n/messages/sheet";
import { announceDenied, clearDraft, deniedDrafts, onDeniedDrafts, type SheetDraft } from "./drafts";

/** How long the keyboard rests before the question comes (ms). */
const QUIET_MS = 1200;

/** Inputs that take no typing (a key there doesn't go into text). */
const UNTYPED = new Set(["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image"]);

/** Whether the keyboard is in a field that takes typing: the cell editor, a text field, a note's text. */
function typingIn(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !UNTYPED.has(el.type));
}

/** Another question (a modal dialog) or a menu is open: this one waits for it. */
const otherOpen = () => !!document.querySelector('[aria-modal="true"], [role="menu"]');

/** Questions elsewhere this one waits for (`holds`), and how often signing out was called off (`again`). */
let hold = { holds: 0, again: 0 };
const holdListeners = new Set<() => void>();
const NO_HOLD = { holds: 0, again: 0 };

function subscribeHold(listener: () => void) {
  holdListeners.add(listener);
  return () => {
    holdListeners.delete(listener);
  };
}

/**
 * Signing out asks its own question about work that isn't saved (useSignOutGuard, which counts these
 * drafts too): this question waits meanwhile, and a draft found refused while sending what's left is
 * only counted. Returns the function that ends the wait; `calledOff`: signing out was called off,
 * so the work can still be kept as a copy first: the question comes, for drafts put off with
 * "Später" too.
 */
export function holdDeniedDrafts(): (calledOff: boolean) => void {
  hold = { ...hold, holds: hold.holds + 1 };
  for (const l of [...holdListeners]) l();
  let done = false;
  return (calledOff) => {
    if (done) return;
    done = true;
    hold = { holds: hold.holds - 1, again: hold.again + (calledOff ? 1 : 0) };
    for (const l of [...holdListeners]) l();
    // (What is left on the device now: after signing out, nothing.)
    announceDenied();
  };
}

export function DeniedDrafts() {
  const { userId } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(sheetText);
  const tp = useMessages(pageText);
  const saveAsCopy = useSaveAsCopy();
  const [drafts, setDrafts] = useState<SheetDraft[]>([]);
  /** Drafts (by their editor's id) put off until the app starts again. */
  const [later, setLater] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** The copy couldn't be made (the spreadsheet code didn't load, say): said in the dialog, which stays. */
  const [failed, setFailed] = useState(false);
  /** The question's moment came (see above); it stays while there is a draft to ask about. */
  const [asking, setAsking] = useState(false);
  const { holds, again } = useSyncExternalStore(subscribeHold, () => hold, () => NO_HOLD);
  // Signing out called off: drafts put off with "Später" are asked about again (signing out deletes them).
  const [seenAgain, setSeenAgain] = useState(again);
  if (again !== seenAgain) {
    setSeenAgain(again);
    setLater([]);
  }

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const look = () => {
      void deniedDrafts(userId)
        .then((list) => {
          if (alive) setDrafts(list);
        })
        .catch(() => {});
    };
    look();
    const off = onDeniedDrafts(look);
    return () => {
      alive = false;
      off();
    };
  }, [userId]);

  // One at a time, the oldest first.
  const draft = drafts.find((d) => !later.includes(d.writer)) ?? null;
  const title = draft ? draft.title.trim() || draft.baseTitle.trim() || t.untitled : "";
  const done = (d: SheetDraft) => setDrafts((list) => list.filter((x) => x.writer !== d.writer));

  // Nothing (left) to ask about: the next draft waits for its moment again.
  if (!draft && asking) setAsking(false);
  // Another page: the moment has come (the question never waits for the next start while you stay).
  const path = usePathname();
  const [seenPath, setSeenPath] = useState(path);
  if (path !== seenPath) {
    setSeenPath(path);
    if (draft && !asking && !holds) setAsking(true);
  }
  // Else once the keyboard has rested a moment outside the fields, with no other question or menu open.
  useEffect(() => {
    if (!draft || asking || holds) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (typingIn(document.activeElement) || otherOpen()) wait();
        else setAsking(true);
      }, QUIET_MS);
    };
    wait();
    window.addEventListener("keydown", wait, true);
    document.addEventListener("focusin", wait);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", wait, true);
      document.removeEventListener("focusin", wait);
    };
  }, [draft, asking, holds]);

  const copy = async (d: SheetDraft) => {
    setBusy(true);
    setFailed(false);
    try {
      // (The formula engine works out the copy's preview and search text.)
      const { draftAsPage } = await import("./flushDrafts");
      // (Once the copy exists, the work on the device has gone into it. Should it not be made,
      // createPage says why and the work stays here.)
      await saveAsCopy({
        title,
        ...draftAsPage(d, locale),
        made: () => {
          clearDraft(userId, d.pageId, d.writer);
          done(d);
        },
      });
    } catch (e) {
      console.error("sheet: keeping the work as a copy failed", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const discard = (d: SheetDraft) => {
    clearDraft(userId, d.pageId, d.writer);
    done(d);
  };

  const putOff = (d: SheetDraft) => {
    setFailed(false);
    setLater((l) => [...l, d.writer]);
  };

  return (
    <Dialog
      open={!!draft && asking}
      onClose={() => !busy && draft && putOff(draft)}
      className="max-w-[440px]"
      role="alertdialog"
      labelledBy="sheet-denied-title"
      describedBy="sheet-denied-text"
    >
      {draft && (
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="-ml-1 -mt-1 shrink-0">
              <Blob size={60} mood="worried" track={false} look={{ x: 0.3, y: 0.4 }} />
            </div>
            <div className="min-w-0 pt-1">
              <h2 id="sheet-denied-title" className="font-display text-[17px] font-semibold leading-snug tracking-[-0.015em]">
                {t.deniedDrafts.title}
              </h2>
              <p id="sheet-denied-text" className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
                {t.deniedDrafts.body(title)}
              </p>
              {failed && (
                <p role="alert" className="mt-2 text-[13px] text-danger">
                  {tp.duplicateFailed}
                </p>
              )}
            </div>
          </div>
          {/* (On phones one under the other, the copy on top.) */}
          <div className="mt-5 flex justify-end gap-2 max-sm:flex-col-reverse">
            <Button type="button" variant="ghost" onClick={() => discard(draft)} disabled={busy} className="mr-auto max-sm:mr-0">
              {t.deniedDrafts.discard}
            </Button>
            <Button type="button" variant="ghost" onClick={() => putOff(draft)} disabled={busy}>
              {t.deniedDrafts.later}
            </Button>
            {/* (Not the keyboard's: a key meant for something else must not make a copy and open it.) */}
            <Button type="button" variant="primary" onClick={() => void copy(draft)} loading={busy}>
              {t.saveAsCopy}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
