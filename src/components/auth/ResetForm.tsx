"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, PasswordInput } from "@/components/ui/Input";
import { authMessage } from "@/lib/auth/errors";
import { passwordStrength } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { StrengthMeter } from "./StrengthMeter";
import { useFieldReactions } from "./useFieldReactions";

export function ResetForm({ email }: { email: string | null }) {
  const router = useRouter();
  const { passwordField, blob } = useFieldReactions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password);

  useEffect(() => {
    if (email) {
      blob.setMood("happy");
      blob.say("Let's pick a fresh password.");
    } else {
      blob.setMood("worried");
      blob.say("This reset link has expired.");
    }
  }, [blob, email]);

  if (!email) {
    return (
      <div>
        <AuthHeading title="Link expired" subtitle="Password reset links only work once and expire after a while. Request a new one." />
        <Link href="/forgot-password">
          <Button variant="primary" size="lg" className="w-full">
            Request a new link <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem =
      password.length < 8
        ? "Use at least 8 characters."
        : strength.score < 2
          ? "That password is a bit easy to guess."
          : password !== confirm
            ? "The passwords don't match."
            : null;
    if (problem) {
      setError(problem);
      blob.setMood("worried");
      blob.shake();
      return;
    }
    setLoading(true);
    blob.setMood("thinking");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(authMessage(error));
      blob.setMood("worried");
      blob.shake();
      return;
    }
    blob.setMood("excited");
    blob.jump();
    blob.say("All set! Taking you home.");
    setTimeout(() => {
      router.replace("/home");
      router.refresh();
    }, 700);
  }

  return (
    <div>
      <AuthHeading title="Choose a new password" subtitle={<>For <b className="font-medium text-ink">{email}</b></>} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            icon={<Lock />}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...passwordField()}
          />
          <StrengthMeter strength={strength} show={password.length > 0} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            icon={<Lock />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            {...passwordField("Type it once more.")}
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          Save password <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
