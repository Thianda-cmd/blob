"use client";

import { ArrowRight, Check, MonitorSmartphone, ShieldAlert, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { approveAppSignIn } from "@/app/(auth)/auth/app/actions";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { isChallenge, isState, type AppDevice } from "@/lib/auth/appSignIn";
import { AuthHeading, authLinkButton } from "./AuthStage";
import { FormError } from "./FormError";
import { useFieldReactions } from "./useFieldReactions";

/** In the browser: "Sign in the Blob app as you?" — one click hands the app a one-time code. */
export function AppApproveCard({ email, challenge, state, device }: { email: string; challenge: string; state: string; device: AppDevice | "other" }) {
  const all = useMessages(authText);
  const t = all.appSignIn;
  const { blob } = useFieldReactions();
  const valid = isChallenge(challenge) && isState(state);
  const [step, setStep] = useState<"ask" | "done" | "denied">("ask");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(valid ? null : t.badRequest);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!valid) {
      blob.setMood("worried");
      blob.say(t.badRequest);
    } else if (step === "done") {
      blob.setMood("excited");
      blob.jump();
      blob.say(t.doneSay);
    } else if (step === "ask") {
      blob.setMood("happy");
      blob.say(t.approveSay);
    }
  }, [blob, valid, step, t]);

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveAppSignIn(challenge, state).catch(() => ({ error: "failed" as const }));
      if ("link" in res) {
        setLink(res.link);
        setStep("done");
        // The browser asks whether it may open the app.
        window.location.href = res.link;
        return;
      }
      if (res.error === "signedOut") return window.location.reload();
      const message = res.error === "request" ? t.badRequest : all.errors.generic;
      setError(message);
      blob.setMood("worried");
      blob.shake();
      blob.say(message);
    });
  }

  if (step === "done") {
    return (
      <div>
        <Badge>
          <Check className="size-6" />
        </Badge>
        <AuthHeading title={t.doneTitle} subtitle={t.doneSubtitle} />
        <a href={link} className={authLinkButton}>
          {t.openApp} <ArrowRight className="size-4" />
        </a>
      </div>
    );
  }

  if (step === "denied") {
    return (
      <div>
        <Badge>
          <X className="size-6" />
        </Badge>
        <AuthHeading title={t.deniedTitle} subtitle={t.deniedSubtitle} />
      </div>
    );
  }

  return (
    <div>
      <Badge>
        <MonitorSmartphone className="size-6" />
      </Badge>
      <AuthHeading title={t.approveTitle} subtitle={t.approveSubtitle(<b className="font-medium text-ink">{email}</b>, t.devices[device])} />
      {valid && (
        <p className="mb-5 flex gap-2 rounded-xl border border-line bg-raised px-3.5 py-3 text-[13px] leading-snug text-ink-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink-3" />
          {t.approveWarning}
        </p>
      )}
      <FormError message={error} />
      {valid && (
        <div className="mt-4 space-y-2.5">
          <Button variant="primary" size="lg" className="w-full" loading={pending} onClick={approve} autoFocus>
            {t.approve} <ArrowRight className="size-4" />
          </Button>
          <Button variant="secondary" size="lg" className="w-full" disabled={pending} onClick={() => setStep("denied")}>
            {t.deny}
          </Button>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-blob-soft text-blob-ink">{children}</div>;
}
