"use client";

import { ArrowRight, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Input";
import { useLocale, useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { passwordStrength } from "@/lib/auth/password";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { firstName } from "@/lib/utils";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { StrengthMeter } from "./StrengthMeter";
import { useFieldReactions } from "./useFieldReactions";

/** `next`: where to go once the account exists (e.g. back into "Sign in with Blob"); default onboarding. */
export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const all = useMessages(authText);
  const t = all.signup;
  const common = all.common;
  const { textField, blob } = useFieldReactions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const strength = passwordStrength(password, locale);
  const greeted = useRef("");

  useEffect(() => {
    blob.setMood("happy");
    blob.say(t.hello);
  }, [blob, t]);

  // Greet by name once they pause typing.
  useEffect(() => {
    const first = firstName(name);
    if (!first || first === greeted.current) return;
    const timer = setTimeout(() => {
      greeted.current = first;
      blob.setMood("love");
      blob.say(t.niceToMeet(first));
    }, 650);
    return () => clearTimeout(timer);
  }, [name, blob, t]);

  // Coach while typing the password (eyes closed, of course).
  useEffect(() => {
    if (!pwFocused || !password) return;
    blob.say(strength.score >= 3 ? `${strength.label}! ${strength.hint}` : strength.hint);
  }, [pwFocused, password, strength.score, strength.label, strength.hint, blob]);

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
    setExists(false);
    if (!name.trim()) return fail(t.askName);
    if (!isEmail(email)) return fail(common.badEmail);
    if (password.length < 8) return fail(t.tooShort);
    if (strength.score < 2) return fail(t.tooEasy);

    setLoading(true);
    blob.setMood("thinking");
    blob.say(t.building);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // The language goes on the account, so emails (and other devices) use it too.
        data: { full_name: name.trim(), locale },
        emailRedirectTo: callbackUrl(next ?? "/onboarding"),
      },
    });

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") setExists(true);
      return fail(authMessage(error, locale));
    }
    // Supabase hides existing accounts by returning a user without identities.
    if (data.user && data.user.identities?.length === 0) {
      setExists(true);
      return fail(common.exists);
    }

    blob.setMood("excited");
    blob.jump();
    if (data.session) {
      blob.say(t.welcome);
      resetBoot();
      setTimeout(() => {
        if (next?.startsWith("/oauth/")) return window.location.assign(next);
        router.replace(next ?? "/onboarding");
        router.refresh();
      }, 600);
    } else {
      blob.say(t.almost);
      setTimeout(() => router.push(`/check-email?email=${encodeURIComponent(email.trim())}`), 500);
    }
  }

  return (
    <div>
      <AuthHeading title={t.title} subtitle={t.subtitle} />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.nameLabel} htmlFor="name">
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            placeholder={t.namePlaceholder}
            icon={<User />}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            {...textField(name)}
          />
        </Field>
        <Field label={common.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={common.emailPlaceholder}
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...textField(email)}
          />
        </Field>
        <Field label={common.password} htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={common.atLeast8}
            icon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => {
              setPwFocused(true);
              blob.setMood("shy");
              blob.look(null);
              blob.say(password ? strength.hint : t.eyesClosed);
            }}
            onBlur={() => {
              setPwFocused(false);
              blob.setMood(strength.score >= 3 ? "happy" : "idle");
            }}
          />
          <StrengthMeter strength={strength} show={password.length > 0} />
        </Field>

        <FormError message={error}>
          {exists && (
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="mt-1 inline-block font-medium underline underline-offset-2">
              {t.signInInstead}
            </Link>
          )}
        </FormError>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {t.submit} <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-7 text-center text-[13.5px] text-ink-2">
        {t.haveAccount}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink">
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
