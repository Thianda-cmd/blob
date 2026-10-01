import type { BlobMood } from "./Blob";

/**
 * A tiny event bus so any part of the app can make the helper Blob react:
 *   blob.say("Saved!", { mood: "happy" })
 *   blob.react("jump", "excited")
 */
export type BlobReaction = "jump" | "squish" | "shake" | "poke";

export type BlobEvent =
  | { type: "say"; text: string; mood?: BlobMood; ms?: number }
  | { type: "react"; reaction: BlobReaction; mood?: BlobMood; ms?: number }
  | { type: "mood"; mood: BlobMood | null };

type Listener = (event: BlobEvent) => void;
const listeners = new Set<Listener>();

function emit(event: BlobEvent) {
  listeners.forEach((fn) => fn(event));
}

export const blob = {
  say(text: string, opts: { mood?: BlobMood; ms?: number } = {}) {
    emit({ type: "say", text, ...opts });
  },
  react(reaction: BlobReaction, mood?: BlobMood, ms?: number) {
    emit({ type: "react", reaction, mood, ms });
  },
  /** Hold a mood until cleared with `blob.mood(null)`. */
  mood(mood: BlobMood | null) {
    emit({ type: "mood", mood });
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
