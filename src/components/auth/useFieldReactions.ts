"use client";

import { useAuthBlob } from "./AuthStage";

/**
 * Wires inputs to Blob: it watches the text you type and politely closes
 * its eyes while you type a password.
 */
export function useFieldReactions() {
  const blob = useAuthBlob();

  const textField = (value: string) => ({
    onFocus: () => {
      blob.setMood("idle");
      blob.look({ x: -0.95 + Math.min(1, value.length / 28) * 0.9, y: 0.25 });
    },
    onBlur: () => blob.look(null),
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      const len = e.currentTarget.value.length;
      blob.look({ x: -0.95 + Math.min(1, len / 28) * 0.9, y: 0.25 });
    },
  });

  const passwordField = (message = "Don't worry, I'm not peeking.") => ({
    onFocus: () => {
      blob.setMood("shy");
      blob.look(null);
      blob.say(message);
    },
    onBlur: () => blob.setMood("idle"),
  });

  return { textField, passwordField, blob };
}
