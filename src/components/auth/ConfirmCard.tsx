"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { confirmEmail } from "@/app/(auth)/auth/confirm/actions";
import { Button } from "@/components/ui/Button";
import { AuthHeading } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

const COPY: Record<string, { title: string; subtitle: string; button: string; blob: string }> = {
  signup: { title: "Confirm your email", subtitle: "One click and your Blob space is ready.", button: "Confirm and continue", blob: "Almost there! Just one click." },
  email: { title: "Confirm your email", subtitle: "One click and you're in.", button: "Continue to Blob", blob: "Welcome! Click the button and we're off." },
  magiclink: { title: "Sign in to Blob", subtitle: "Use this one-time link to sign in.", button: "Sign me in", blob: "Your magic link is ready!" },
  recovery: { title: "Reset your password", subtitle: "Continue to choose a new password.", button: "Choose a new password", blob: "Let's get you a fresh password." },
  email_change: { title: "Confirm your new email", subtitle: "Confirm to finish switching your email address.", button: "Confirm new email", blob: "New address, same Blob." },
  invite: { title: "You're invited", subtitle: "Accept to create your Blob space.", button: "Accept invite", blob: "Ooh, someone invited you!" },
};

export function ConfirmCard({ tokenHash, type, next }: { tokenHash: string; type: string; next: string }) {
  const { blob } = useFieldReactions();
  const [state, action, pending] = useActionState(confirmEmail, { error: null });
  const copy = COPY[type] ?? COPY.email;
  const valid = Boolean(tokenHash && COPY[type]);

  useEffect(() => {
    if (!valid) {
      blob.setMood("worried");
      blob.say("Hmm, this link looks incomplete.");
    } else {
      blob.setMood("happy");
      blob.say(copy.blob);
    }
  }, [blob, valid, copy.blob]);

  useEffect(() => {
    if (pending) {
      blob.setMood("thinking");
      blob.say("Checking your link…");
    } else if (state.error) {
      blob.setMood("worried");
      blob.shake();
      blob.say(state.error);
    }
  }, [pending, state.error, blob]);

  if (!valid) {
    return (
      <div>
        <AuthHeading title="That link doesn't look right" subtitle="It may have been cut off by your email app. Request a new email and try again." />
        <Link href="/login">
          <Button variant="primary" size="lg" className="w-full">
            Back to sign in <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-blob-soft text-blob-ink">
        <MailCheck className="size-6" />
      </div>
      <AuthHeading title={copy.title} subtitle={copy.subtitle} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <FormError message={state.error}>
          {state.error && (
            <Link href={type === "recovery" ? "/forgot-password" : "/login"} className="mt-1 inline-block font-medium underline underline-offset-2">
              {type === "recovery" ? "Request a new reset link" : "Back to sign in"}
            </Link>
          )}
        </FormError>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} autoFocus>
          {copy.button} <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-3">This extra click keeps your link safe from email scanners that open links automatically.</p>
    </div>
  );
}
