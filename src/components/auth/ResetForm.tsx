"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, PasswordInput } from "@/components/ui/Input";
import { useLocale, useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { authMessage } from "@/lib/auth/errors";
import { passwordStrength } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading, authLinkButton } from "./AuthStage";
import { FormError } from "./FormError";
import { StrengthMeter } from "./StrengthMeter";
import { useFieldReactions } from "./useFieldReactions";

export function ResetForm({ email }: { email: string | null }) {
  const router = useRouter();
  const locale = useLocale();
  const all = useMessages(authText);
  const t = all.reset;
  const { passwordField, blob } = useFieldReactions();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(password, locale);

  useEffect(() => {
    if (email) {
      blob.setMood("happy");
      blob.say(t.hello);
    } else {
      blob.setMood("worried");
      blob.say(t.expiredSay);
    }
  }, [blob, email, t]);

  if (!email) {
    return (
      <div>
        <AuthHeading title={t.expiredTitle} subtitle={t.expiredSubtitle} />
        <Link href="/forgot-password" className={authLinkButton}>
          {t.requestNew} <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem =
      password.length < 8
        ? t.tooShort
        : strength.score < 2
          ? t.tooEasy
          : password !== confirm
            ? t.mismatch
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
      setError(authMessage(error, locale));
      blob.setMood("worried");
      blob.shake();
      return;
    }
    blob.setMood("excited");
    blob.jump();
    blob.say(t.done);
    setTimeout(() => {
      router.replace("/home");
      router.refresh();
    }, 700);
  }

  return (
    <div>
      <AuthHeading title={t.title} subtitle={t.forEmail(<b className="font-medium text-ink">{email}</b>)} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.newPassword} htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            icon={<Lock />}
            placeholder={all.common.atLeast8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...passwordField()}
          />
          <StrengthMeter strength={strength} show={password.length > 0} />
        </Field>
        <Field label={t.confirmPassword} htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            icon={<Lock />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            {...passwordField(t.onceMore)}
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {t.submit} <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
