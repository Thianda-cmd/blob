"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lock, Mail, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Input";
import { useLocale, useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

/**
 * `initialError` and `notice` come from the URL (/login?error=…&notice=…): either a code from
 * /auth/callback (see `authText.linkCodes`) or, for errors we can't name, Supabase's own message.
 */
export function LoginForm({ next, initialError, notice }: { next: string; initialError?: string; notice?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const all = useMessages(authText);
  const t = all.login;
  const common = all.common;
  const fromUrl = (value: string | undefined) => (value ? (all.linkCodes[value] ?? value) : undefined);
  const noticeText = fromUrl(notice);
  const { textField, passwordField, blob } = useFieldReactions();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(fromUrl(initialError) ?? null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    if (initialError) {
      blob.setMood("worried");
      blob.say(t.linkProblem);
    } else if (noticeText) {
      blob.setMood("excited");
      blob.say(noticeText);
    } else {
      blob.setMood("happy");
      blob.say(t.hello);
    }
  }, [blob, initialError, noticeText, t]);

  function fail(message: string) {
    setError(message);
    setLoading(false);
    blob.setMood("worried");
    blob.shake();
    blob.say(message);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    if (!isEmail(email)) return fail(common.badEmail);
    if (mode === "password" && !password) return fail(t.needPassword);

    setLoading(true);
    blob.setMood("thinking");
    blob.say(t.checking);
    const supabase = createClient();

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: false },
      });
      if (error) {
        const notFound = /signups? not allowed|not found/i.test(error.message);
        return fail(notFound ? common.noAccount : authMessage(error, locale));
      }
      setLoading(false);
      setMagicSent(true);
      blob.setMood("love");
      blob.jump();
      blob.say(t.linkSent);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.code === "email_not_confirmed") setUnconfirmed(true);
      return fail(authMessage(error, locale));
    }
    blob.setMood("excited");
    blob.jump();
    blob.say(t.signedIn);
    resetBoot();
    setTimeout(() => {
      router.replace(next);
      router.refresh();
    }, 650);
  }

  async function resend() {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl("/onboarding") },
    });
    if (error) return fail(authMessage(error, locale));
    router.push(`/check-email?email=${encodeURIComponent(email.trim())}`);
  }

  if (magicSent) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <AuthHeading title={common.checkInbox} subtitle={t.magicSent(<b className="font-medium text-ink">{email}</b>)} />
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setMagicSent(false)}>
          {t.otherMethod}
        </Button>
      </motion.div>
    );
  }

  return (
    <div>
      <AuthHeading title={t.title} subtitle={t.subtitle} />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={common.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder={common.emailPlaceholder}
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error) && !isEmail(email)}
            {...textField(email)}
          />
        </Field>

        <AnimatePresence initial={false}>
          {mode === "password" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Field
                label={common.password}
                htmlFor="password"
                action={
                  <Link href="/forgot-password" className="text-[12.5px] text-ink-3 hover:text-ink">
                    {t.forgot}
                  </Link>
                }
              >
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  icon={<Lock />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...passwordField()}
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        <FormError message={error}>
          {unconfirmed && (
            <button type="button" onClick={resend} className="mt-1 font-medium underline underline-offset-2">
              {t.resend}
            </button>
          )}
        </FormError>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {mode === "password" ? t.submit : t.submitMagic}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[12px] text-ink-3">
        <span className="h-px flex-1 bg-line" /> {t.or} <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => {
          setError(null);
          setMode(mode === "password" ? "magic" : "password");
          blob.setMood("happy");
          blob.say(mode === "password" ? t.sayMagic : t.sayPassword);
        }}
      >
        {mode === "password" ? (
          <>
            <Wand2 className="size-4" /> {t.useMagic}
          </>
        ) : (
          <>
            <Lock className="size-4" /> {t.usePassword}
          </>
        )}
      </Button>

      <p className="mt-7 text-center text-[13.5px] text-ink-2">
        {t.newHere}{" "}
        <Link href={next !== "/home" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink">
          {t.createAccount}
        </Link>
      </p>
    </div>
  );
}
