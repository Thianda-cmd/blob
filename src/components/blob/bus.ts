import type { BlobAccessory, BlobMood } from "./Blob";

/**
 * A tiny event bus so any part of the app can make the helper Blob react:
 *   blob.say("Saved!", { mood: "happy" })
 *   blob.react("jump", "excited")
 *   blob.react("celebrate", "excited", 3000, "cap")
 */
export type BlobReaction = "jump" | "squish" | "shake" | "poke" | "wave" | "celebrate" | "spin" | "dance" | "nod" | "wink" | "sneeze" | "yawn";

type Extras = { mood?: BlobMood; ms?: number; accessory?: BlobAccessory };

export type BlobEvent =
  | ({ type: "say"; text: string } & Extras)
  | ({ type: "react"; reaction: BlobReaction } & Extras)
  | { type: "mood"; mood: BlobMood | null };

type Listener = (event: BlobEvent) => void;
const listeners = new Set<Listener>();

function emit(event: BlobEvent) {
  listeners.forEach((fn) => fn(event));
}

export const blob = {
  say(text: string, opts: Extras = {}) {
    emit({ type: "say", text, ...opts });
  },
  react(reaction: BlobReaction, mood?: BlobMood, ms?: number, accessory?: BlobAccessory) {
    emit({ type: "react", reaction, mood, ms, accessory });
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
