"use client";

import { ArrowRight, AppWindow, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useSyncExternalStore } from "react";
import { confirmEmail } from "@/app/(auth)/auth/confirm/actions";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { blobApp } from "@/lib/native";
import { authText, type ConfirmKind } from "@/i18n/messages/auth";
import { AuthHeading, authLinkButton } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

const noSubscribe = () => () => {};

export function ConfirmCard({ tokenHash, type, next }: { tokenHash: string; type: string; next: string }) {
  const all = useMessages(authText);
  const t = all.confirm;
  const { blob } = useFieldReactions();
  const [state, action, pending] = useActionState(confirmEmail, { error: null });
  const known = Object.hasOwn(t.kinds, type);
  const copy = known ? t.kinds[type as ConfirmKind] : t.kinds.email;
  const valid = Boolean(tokenHash && known);
  // In a browser: the same link can open in the Blob app (it asks for the click there). Not in the app.
  const inApp = useSyncExternalStore(
    noSubscribe,
    () => blobApp() !== null,
    () => false,
  );
  const appLink = `blob://auth/confirm?${new URLSearchParams({ token_hash: tokenHash, type, next })}`;

  useEffect(() => {
    if (!valid) {
      blob.setMood("worried");
      blob.say(t.incompleteSay);
    } else {
      blob.setMood("happy");
      blob.say(copy.blob);
    }
  }, [blob, valid, copy.blob, t.incompleteSay]);

  useEffect(() => {
    if (pending) {
      blob.setMood("thinking");
      blob.say(t.checking);
    } else if (state.error) {
      blob.setMood("worried");
      blob.shake();
      blob.say(state.error);
    }
  }, [pending, state.error, blob, t.checking]);

  if (!valid) {
    return (
      <div>
        <AuthHeading title={t.badTitle} subtitle={t.badSubtitle} />
        <Link href="/login" className={authLinkButton}>
          {all.common.backToSignIn} <ArrowRight className="size-4" />
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
              {type === "recovery" ? t.newResetLink : all.common.backToSignIn}
            </Link>
          )}
        </FormError>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} autoFocus>
          {copy.button} <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-5 text-[12.5px] text-ink-3">{t.scanners}</p>
      {!inApp && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-ink-3">
          <AppWindow className="size-3.5" /> {t.inApp}{" "}
          <a href={appLink} className="font-medium text-blob-ink underline underline-offset-2">
            {t.openApp}
          </a>
        </p>
      )}
    </div>
  );
}
