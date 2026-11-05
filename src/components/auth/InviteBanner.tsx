"use client";

import { motion } from "motion/react";
import { UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { useAuthBlob } from "./AuthStage";

/**
 * Above the sign-in / sign-up form when someone came from an invite link (/join/…): they were
 * invited to a page or a project, and signing in takes them straight there. (Signing up goes on to
 * the setup first, so there the line says to open the link again afterwards.) The same place and
 * look as the "Sign in with Blob" banner (oauth/OAuthBanner.tsx).
 */
export function InviteBanner({ mode }: { mode: "signin" | "signup" }) {
  const t = useMessages(authText).invite;
  const blob = useAuthBlob();
  // Blob mentions the invite, after the form's own greeting (on sign-up: account first, as the banner says).
  const line = mode === "signin" ? t.blob : t.blobSignUp;
  useEffect(() => {
    const timer = setTimeout(() => blob.say(line), 60);
    return () => clearTimeout(timer);
  }, [blob, line]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-raised px-3.5 py-3 shadow-card"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-blob-soft text-blob-ink">
        <UserPlus className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 leading-snug">
        <div className="text-[13.5px] font-semibold text-ink">{t.title}</div>
        <div className="text-[12.5px] text-ink-2">{mode === "signin" ? t.signIn : t.signUp}</div>
      </div>
    </motion.div>
  );
}
