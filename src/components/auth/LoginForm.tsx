"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Lock, Mail, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Input";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

export function LoginForm({ next, initialError, notice }: { next: string; initialError?: string; notice?: string }) {
  const router = useRouter();
  const { textField, passwordField, blob } = useFieldReactions();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    if (initialError) {
      blob.setMood("worried");
      blob.say("Hmm, that link didn't work. Let's try again.");
    } else if (notice) {
      blob.setMood("excited");
      blob.say(notice);
    } else {
      blob.setMood("happy");
      blob.say("Welcome back! Your notes missed you.");
    }
  }, [blob, initialError, notice]);

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
    if (!isEmail(email)) return fail("That email address doesn't look right.");
    if (mode === "password" && !password) return fail("Type your password to continue.");

    setLoading(true);
    blob.setMood("thinking");
    blob.say("Checking your details…");
    const supabase = createClient();

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: false },
      });
      if (error) {
        const notFound = /signups? not allowed|not found/i.test(error.message);
        return fail(notFound ? "We couldn't find an account with that email." : authMessage(error));
      }
      setLoading(false);
      setMagicSent(true);
      blob.setMood("love");
      blob.jump();
      blob.say("Link sent! Check your inbox.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.code === "email_not_confirmed") setUnconfirmed(true);
      return fail(authMessage(error));
    }
    blob.setMood("excited");
    blob.jump();
    blob.say("Yay, you're in!");
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
    if (error) return fail(authMessage(error));
    router.push(`/check-email?email=${encodeURIComponent(email.trim())}`);
  }

  if (magicSent) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <AuthHeading title="Check your inbox" subtitle={<>We sent a sign-in link to <b className="font-medium text-ink">{email}</b>. It works once and expires soon.</>} />
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setMagicSent(false)}>
          Use a different method
        </Button>
      </motion.div>
    );
  }

  return (
    <div>
      <AuthHeading title="Welcome back" subtitle="Sign in to pick up where you left off." />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@school.com"
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
                label="Password"
                htmlFor="password"
                action={
                  <Link href="/forgot-password" className="text-[12.5px] text-ink-3 hover:text-ink">
                    Forgot password?
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
              Resend confirmation email
            </button>
          )}
        </FormError>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {mode === "password" ? "Sign in" : "Email me a sign-in link"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[12px] text-ink-3">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => {
          setError(null);
          setMode(mode === "password" ? "magic" : "password");
          blob.setMood("happy");
          blob.say(mode === "password" ? "No password needed, I'll email you a magic link." : "Classic email and password it is.");
        }}
      >
        {mode === "password" ? (
          <>
            <Wand2 className="size-4" /> Sign in with a magic link
          </>
        ) : (
          <>
            <Lock className="size-4" /> Sign in with password
          </>
        )}
      </Button>

      <p className="mt-7 text-center text-[13.5px] text-ink-2">
        New to Blob?{" "}
        <Link href={next !== "/home" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
