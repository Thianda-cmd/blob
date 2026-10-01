"use client";

import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { Envelope } from "./CheckEmail";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

export function ForgotForm() {
  const { textField, blob } = useFieldReactions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    blob.setMood("idle");
    blob.say("Forgot it? Happens to the best of us.");
  }, [blob]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEmail(email)) {
      setError("That email address doesn't look right.");
      blob.setMood("worried");
      blob.shake();
      return;
    }
    setLoading(true);
    blob.setMood("thinking");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callbackUrl("/reset-password"),
    });
    setLoading(false);
    if (error) {
      setError(authMessage(error));
      blob.setMood("worried");
      blob.shake();
      blob.say(authMessage(error));
      return;
    }
    setSent(true);
    blob.setMood("love");
    blob.jump();
    blob.say("Reset link is on its way!");
  }

  if (sent) {
    return (
      <div>
        <Envelope />
        <AuthHeading
          title="Check your inbox"
          subtitle={
            <>
              If an account exists for <b className="font-medium text-ink">{email}</b>, you&apos;ll get a link to choose a new password.
            </>
          }
        />
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Reset your password" subtitle="Enter your email and we'll send you a link to set a new one." />
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
            {...textField(email)}
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          Send reset link <ArrowRight className="size-4" />
        </Button>
      </form>
      <Link href="/login" className="mt-7 inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  );
}
