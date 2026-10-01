"use client";

import { ArrowRight, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Input";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { passwordStrength } from "@/lib/auth/password";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { firstName } from "@/lib/utils";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { StrengthMeter } from "./StrengthMeter";
import { useFieldReactions } from "./useFieldReactions";

export function SignupForm() {
  const router = useRouter();
  const { textField, blob } = useFieldReactions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const strength = passwordStrength(password);
  const greeted = useRef("");

  useEffect(() => {
    blob.setMood("happy");
    blob.say("Ooh, a new friend! Let's make your space.");
  }, [blob]);

  // Greet by name once they pause typing.
  useEffect(() => {
    const first = firstName(name);
    if (!first || first === greeted.current) return;
    const t = setTimeout(() => {
      greeted.current = first;
      blob.setMood("love");
      blob.say(`Nice to meet you, ${first}!`);
    }, 650);
    return () => clearTimeout(t);
  }, [name, blob]);

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
    if (!name.trim()) return fail("What should I call you?");
    if (!isEmail(email)) return fail("That email address doesn't look right.");
    if (password.length < 8) return fail("Your password needs at least 8 characters.");
    if (strength.score < 2) return fail("That password is a bit easy to guess. Add numbers or symbols.");

    setLoading(true);
    blob.setMood("thinking");
    blob.say("Building your space…");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: callbackUrl("/onboarding"),
      },
    });

    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") setExists(true);
      return fail(authMessage(error));
    }
    // Supabase hides existing accounts by returning a user without identities.
    if (data.user && data.user.identities?.length === 0) {
      setExists(true);
      return fail("There's already an account with this email.");
    }

    blob.setMood("excited");
    blob.jump();
    if (data.session) {
      blob.say("Welcome to Blob!");
      resetBoot();
      setTimeout(() => {
        router.replace("/onboarding");
        router.refresh();
      }, 600);
    } else {
      blob.say("Almost there! Check your email.");
      setTimeout(() => router.push(`/check-email?email=${encodeURIComponent(email.trim())}`), 500);
    }
  }

  return (
    <div>
      <AuthHeading title="Create your Blob" subtitle="Notes, presentations and homework, all saved in one place." />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your name" htmlFor="name">
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            placeholder="Alex Morgan"
            icon={<User />}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            {...textField(name)}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@school.com"
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...textField(email)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            icon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => {
              setPwFocused(true);
              blob.setMood("shy");
              blob.look(null);
              blob.say(password ? strength.hint : "Eyes closed. Pick something only you know.");
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
            <Link href="/login" className="mt-1 inline-block font-medium underline underline-offset-2">
              Sign in instead
            </Link>
          )}
        </FormError>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-7 text-center text-[13.5px] text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
