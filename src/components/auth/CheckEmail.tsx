"use client";

import { motion } from "motion/react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocale, useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { authMessage } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

export function Envelope() {
  return (
    <motion.svg
      viewBox="0 0 120 90"
      className="mb-6 h-[72px] w-[96px]"
      initial={{ y: 16, opacity: 0, rotate: -8 }}
      animate={{ y: [16, -4, 0], opacity: 1, rotate: [-8, 3, 0] }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      aria-hidden
    >
      <rect x="6" y="14" width="108" height="70" rx="10" fill="var(--raised)" stroke="var(--line-2)" strokeWidth="2" />
      <motion.path
        d="M10 20 L60 54 L110 20"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.35, duration: 0.6 }}
      />
      <motion.circle
        cx="104"
        cy="18"
        r="11"
        fill="var(--blob)"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.25, 1] }}
        transition={{ delay: 0.8, duration: 0.45 }}
      />
      <motion.text x="104" y="22.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        1
      </motion.text>
    </motion.svg>
  );
}

export function CheckEmail({ email }: { email: string }) {
  const locale = useLocale();
  const all = useMessages(authText);
  const t = all.checkEmail;
  const { blob } = useFieldReactions();
  const [cooldown, setCooldown] = useState(30);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    blob.setMood("love");
    blob.say(t.say);
    blob.jump();
  }, [blob, t]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email) return;
    setSending(true);
    setError(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl("/onboarding") },
    });
    setSending(false);
    if (error) {
      const message = authMessage(error, locale);
      setError(message);
      blob.setMood("worried");
      blob.say(message);
      return;
    }
    setSent(true);
    setCooldown(60);
    blob.setMood("happy");
    blob.jump();
    blob.say(t.sentAgain);
  }

  return (
    <div>
      <Envelope />
      <AuthHeading
        title={t.title}
        subtitle={email ? t.sentTo(<b className="font-medium text-ink">{email}</b>) : t.sent}
      />
      <ul className="mb-6 space-y-1.5 text-[13px] text-ink-2">
        <li>• {t.spam}</li>
        <li>• {t.autoSignIn}</li>
      </ul>
      <FormError message={error} />
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={resend} loading={sending} disabled={!email || cooldown > 0}>
          <RotateCcw className="size-4" />
          {cooldown > 0 ? t.resendIn(cooldown) : sent ? t.resendAgain : t.resend}
        </Button>
      </div>
      <Link href="/login" className="mt-4.5 inline-flex items-center gap-1.5 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {all.common.backToSignIn}
      </Link>
    </div>
  );
}
