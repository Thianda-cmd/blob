"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { useAuthBlob } from "@/components/auth/AuthStage";
import { BlobMark } from "@/components/blob/BlobMark";
import { useMessages } from "@/i18n/client";
import { oauthText } from "@/i18n/messages/oauth";
import type { PublicApp } from "@/lib/oauth/apps";
import { AppMark } from "./AppMark";

/** Above the sign-in / sign-up form when someone came from "Sign in with Blob" on another site. */
export function OAuthBanner({ app, mode }: { app: PublicApp; mode: "signin" | "signup" }) {
  const t = useMessages(oauthText).banner;
  const blob = useAuthBlob();
  // Blob mentions the app, after the form's own greeting.
  useEffect(() => {
    const timer = setTimeout(() => blob.say(mode === "signin" ? t.blobHello(app.name) : t.blobHelloNew(app.name)), 60);
    return () => clearTimeout(timer);
  }, [blob, mode, app.name, t]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 shadow-card"
    >
      <div className="flex shrink-0 items-center">
        <span className="grid size-9 place-items-center rounded-[11px] bg-blob-soft">
          <BlobMark size={22} />
        </span>
        <span className="mx-1 flex gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1 rounded-full bg-blob"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
        <AppMark app={app} size={36} />
      </div>
      <div className="min-w-0 leading-snug">
        <div className="text-[13.5px] font-semibold">{mode === "signin" ? t.signIn : t.signUp}</div>
        <div className="truncate text-[12.5px] text-ink-2">{t.continueTo(app.name)}</div>
      </div>
    </motion.div>
  );
}
