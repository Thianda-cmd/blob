"use client";

// What screen readers hear about the bar under the spreadsheet's top bar (SheetEditor: no access
// any more, too big to save, refused as sent, close to the size limit, view only, unreadable).
//
// Each problem is said once, from a status that is always there (a bar inserted already filled
// isn't said by every screen reader). Most of the bar's problems come with a save state that the
// top bar's indicator says itself ("Nicht gespeichert", "Zu groß zum Speichern": SaveIndicator,
// whose saveAnnouncement this follows): then the bar says nothing more, and its words are read where
// it is, with its buttons. It speaks when the indicator doesn't: close to the size limit, or another
// reason while the save state stays (no access any more, after a save refused as sent). A bar there
// from the start (view only, unreadable) is read with the page, and words that change while it is
// about the same thing (the size, which copy is in the way) aren't said again.

import { useEffect, useState } from "react";
import { saveAnnouncement } from "@/components/page/SaveIndicator";
import type { SaveState } from "@/components/page/useAutosave";
import type { SaveNotice } from "./saver";

/** What the bar is about: the save notice, or a spreadsheet that is only there to look at. */
export type BannerKind = "unreadable" | "viewOnly" | SaveNotice;

/**
 * What the bar last said and what it goes by: its kind, the save state and the problem the
 * indicator last said (saveAnnouncement). `say`: the words screen readers get now (null: none),
 * new each time `n` grows.
 */
export type BannerHeard = { kind: BannerKind | null; state: SaveState; heard: SaveState | null; say: string | null; n: number };

/** As the spreadsheet opens: nothing said (a bar there from the start is read with the page). */
export function bannerAtStart(kind: BannerKind | null, state: SaveState): BannerHeard {
  return { kind, state, heard: saveAnnouncement(null, state).heard, say: null, n: 0 };
}

/**
 * Whether what the indicator has just said (`say`: saveAnnouncement) is the bar's problem `kind`
 * in its own words: "Nicht gespeichert" for no access or a save refused as sent, "Zu groß zum
 * Speichern" for too big. Anything else it says (the work is on this device, a server problem,
 * saved again) is other news, and the bar's is said all the same.
 */
const toldBy = (say: SaveState | null | undefined, kind: BannerKind) => (kind === "tooBig" ? say === "tooBig" : (kind === "denied" || kind === "rejected") && say === "refused");

/** The bar's kind (with its words, `text`) or the save state changed: what is said now. */
export function bannerNext(was: BannerHeard, kind: BannerKind | null, text: string | null, state: SaveState): BannerHeard {
  const indicator = was.state === state ? null : saveAnnouncement(was.heard, state);
  const fresh = !!kind && kind !== was.kind && !!text && !toldBy(indicator?.say, kind);
  return { kind, state, heard: indicator ? indicator.heard : was.heard, say: fresh ? text : kind === was.kind ? was.say : null, n: fresh ? was.n + 1 : was.n };
}

/** How long the words stay for screen readers (then they go: the bar itself is read where it is). */
const SPOKEN_MS = 7000;

export function BannerVoice({ kind, text, state }: { kind: BannerKind | null; text: string | null; state: SaveState }) {
  const [voice, setVoice] = useState(() => bannerAtStart(kind, state));
  if (voice.kind !== kind || voice.state !== state) setVoice(bannerNext(voice, kind, text, state));
  const { say, n } = voice;
  useEffect(() => {
    if (!say) return;
    const timer = setTimeout(() => setVoice((v) => ({ ...v, say: null })), SPOKEN_MS);
    return () => clearTimeout(timer);
  }, [say, n]);
  // (A new element for each, so the same words twice are said twice.)
  return (
    <div role="status" className="sr-only">
      {say && <span key={n}>{say}</span>}
    </div>
  );
}
