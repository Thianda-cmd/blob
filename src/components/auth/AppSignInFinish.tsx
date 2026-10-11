"use client";

import { ArrowRight, LoaderCircle, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { finishAppSignIn } from "@/app/(auth)/auth/app/actions";
import { resetBoot } from "@/components/blob/BlobBoot";
import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { APP_SIGN_IN_KEY, isCode, isState, REQUEST_TTL_MS, type AppSignInRequest } from "@/lib/auth/appSignIn";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/utils";
import { AuthHeading, authLinkButton } from "./AuthStage";
import { useFieldReactions } from "./useFieldReactions";

/** Codes already on their way (React runs effects twice in development; a code works once). */
const started = new Set<string>();

function takeRequest(state: string): AppSignInRequest | null {
  try {
    const raw = localStorage.getItem(APP_SIGN_IN_KEY);
    if (!raw) return null;
    const req = JSON.parse(raw) as AppSignInRequest;
    if (req.state !== state || Date.now() - req.at > REQUEST_TTL_MS) return null;
    localStorage.removeItem(APP_SIGN_IN_KEY);
    return req;
  } catch {
    return null;
  }
}

/** In the app: trades the browser's one-time code (and this app's own secret) for a session. */
export function AppSignInFinish({ code, state }: { code: string; state: string }) {
  const all = useMessages(authText);
  const t = all.appSignIn;
  const { blob } = useFieldReactions();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (started.has(code)) return;
    started.add(code);
    // The code is in the address: out of the history right away.
    window.history.replaceState(null, "", window.location.pathname);
    const req = isCode(code) && isState(state) ? takeRequest(state) : null;
    if (!req) {
      // The app may have picked the sign-in up itself already (it asks while it waits): then on.
      void createClient()
        .auth.getSession()
        .then(({ data }) => {
          if (data.session) window.location.replace("/home");
          else setProblem(t.notHere);
        });
      return;
    }
    blob.setMood("thinking");
    blob.say(t.finishing);
    void finishAppSignIn(code, req.verifier)
      .catch(() => ({ error: navigator.onLine ? ("failed" as const) : ("offline" as const) }))
      .then((res) => {
        if ("ok" in res) {
          blob.setMood("excited");
          blob.jump();
          blob.say(all.login.signedIn);
          resetBoot();
          // A full load: the whole site starts again with the new session.
          setTimeout(() => window.location.replace(safeNext(req.next)), 500);
          return;
        }
        // Used up already, by the app itself while it waited: signed in all the same.
        void createClient()
          .auth.getSession()
          .then(({ data }) => {
            if (data.session) window.location.replace(safeNext(req.next));
            else setProblem(res.error === "offline" ? t.offline : t.failed);
          });
      });
  }, [code, state, blob, t, all.login.signedIn]);

  useEffect(() => {
    if (!problem) return;
    blob.setMood("worried");
    blob.shake();
    blob.say(problem);
  }, [problem, blob]);

  return (
    <div>
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-blob-soft text-blob-ink">
        {problem ? <MonitorSmartphone className="size-6" /> : <LoaderCircle className="size-6 animate-spin" />}
      </div>
      <AuthHeading title={problem ? t.failedTitle : t.finishing} subtitle={problem ?? undefined} />
      {problem && (
        <Link href="/login" className={authLinkButton}>
          {all.common.backToSignIn} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
