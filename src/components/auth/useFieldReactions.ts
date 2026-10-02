"use client";

import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { useAuthBlob } from "./AuthStage";

/**
 * Wires inputs to Blob: it watches the text you type and politely closes
 * its eyes while you type a password.
 */
export function useFieldReactions() {
  const blob = useAuthBlob();
  const noPeeking = useMessages(authText).common.noPeeking;

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

  const passwordField = (message = noPeeking) => ({
    onFocus: () => {
      blob.setMood("shy");
      blob.look(null);
      blob.say(message);
    },
    onBlur: () => blob.setMood("idle"),
  });

  return { textField, passwordField, blob };
}
