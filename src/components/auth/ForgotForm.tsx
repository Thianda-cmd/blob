"use client";

import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLocale, useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { callbackUrl } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./AuthStage";
import { Envelope } from "./CheckEmail";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

export function ForgotForm() {
  const locale = useLocale();
  const all = useMessages(authText);
  const t = all.forgot;
  const common = all.common;
  const { textField, blob } = useFieldReactions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    blob.setMood("idle");
    blob.say(t.hello);
  }, [blob, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEmail(email)) {
      setError(common.badEmail);
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
      const message = authMessage(error, locale);
      setError(message);
      blob.setMood("worried");
      blob.shake();
      blob.say(message);
      return;
    }
    setSent(true);
    blob.setMood("love");
    blob.jump();
    blob.say(t.onItsWay);
  }

  if (sent) {
    return (
      <div>
        <Envelope />
        <AuthHeading
          title={common.checkInbox}
          subtitle={t.sent(<b className="font-medium text-ink">{email}</b>)}
        />
        <Link href="/login" className="-my-1.5 inline-flex items-center gap-1.5 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> {common.backToSignIn}
        </Link>
      </div>
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
            {...textField(email)}
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {t.submit} <ArrowRight className="size-4" />
        </Button>
      </form>
      <Link href="/login" className="mt-5.5 inline-flex items-center gap-1.5 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {common.backToSignIn}
      </Link>
    </div>
  );
}
