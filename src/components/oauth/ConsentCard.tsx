"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Clock3, ExternalLink, Fingerprint, Lock, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { oauthText } from "@/i18n/messages/oauth";
import type { PublicApp } from "@/lib/oauth/apps";
import { cn } from "@/lib/utils";
import { decide, switchAccount } from "@/app/oauth/consent/actions";
import { AppMark } from "./AppMark";

type Scope = "openid" | "profile" | "email" | "offline_access";
type Props = {
  request: { id: string; app: PublicApp; scopes: Scope[]; redirectOrigin: string };
  account: { name: string; email: string; avatar: string | null };
};

const ICONS: Record<Scope, typeof Mail> = { openid: Fingerprint, profile: UserRound, email: Mail, offline_access: Clock3 };

/** "Continue to LernLabor": who is signing in, what the app will see, Allow / Cancel. */
export function ConsentCard({ request, account }: Props) {
  const t = useMessages(oauthText).consent;
  const router = useRouter();
  const { app } = request;
  const blob = useRef<BlobHandle>(null);
  const [mood, setMood] = useState<BlobMood>("happy");
  const [phase, setPhase] = useState<"ask" | "allowing" | "leaving" | "cancelled">("ask");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // "openid" alone is just the ID; show it only when nothing else is asked.
  const shown = request.scopes.filter((s) => s !== "openid" || request.scopes.length === 1);

  useEffect(() => {
    const t1 = setTimeout(() => blob.current?.wave(), 450);
    const t2 = setTimeout(() => blob.current?.point(), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  function go(allow: boolean) {
    setError(null);
    setPhase(allow ? "allowing" : "cancelled");
    setMood(allow ? "excited" : "shy");
    if (allow) blob.current?.celebrate();
    start(async () => {
      const result = await decide(request.id, allow);
      if ("error" in result) {
        setPhase("ask");
        setMood("worried");
        blob.current?.shake();
        setError(result.error === "expired" ? t.expired : result.error === "done" ? t.done : t.failed);
        if (result.error === "signed_out") router.replace(`/login?next=${encodeURIComponent(`/oauth/continue?request=${request.id}`)}`);
        return;
      }
      if (allow) setPhase("leaving");
      // Let the little celebration play before leaving.
      setTimeout(() => window.location.assign(result.url), allow ? 700 : 900);
    });
  }

  const busy = pending || phase === "leaving" || phase === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="w-full max-w-[440px] rounded-[28px] border border-line bg-raised p-5 shadow-pop sm:p-7"
    >
      <div className="text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.eyebrow}</div>

      <Bridge app={app} blob={blob} mood={mood} phase={phase} />

      <h1 className="mt-1 text-center font-display text-[26px] font-bold leading-tight tracking-[-0.025em] text-balance">{t.title(app.name)}</h1>
      <p className="mt-1.5 text-center text-[14px] text-ink-2">{t.subtitle(app.name)}</p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <Avatar name={account.name} src={account.avatar} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11.5px] text-ink-3">{t.signedInAs}</div>
          <div className="truncate text-[14px] font-semibold">{account.name}</div>
          <div className="truncate text-[12.5px] text-ink-2">{account.email}</div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              router.replace(await switchAccount(request.id));
              router.refresh();
            })
          }
          className="shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50"
          title={t.switchAccount}
        >
          {t.notYou}
        </button>
      </div>

      <div className="mt-5">
        <div className="text-[13px] font-semibold">{t.willSee(app.name)}</div>
        <ul className="mt-3 space-y-2.5">
          {shown.map((scope, i) => {
            const Icon = ICONS[scope];
            return (
              <motion.li
                key={scope}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.07, type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 leading-snug">
                  <div className="text-[14px] font-medium">{t.scopes[scope].title}</div>
                  <div className="text-[12.5px] text-ink-3">{t.scopes[scope].body}</div>
                </div>
              </motion.li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-hover/60 px-3 py-2.5 text-[12.5px] leading-snug text-ink-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {t.never(app.name)}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-center text-[13px] text-danger" role="alert">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" size="lg" onClick={() => go(false)} disabled={busy} loading={phase === "cancelled"}>
          {t.cancel}
        </Button>
        <Button variant="blob" size="lg" onClick={() => go(true)} disabled={busy} loading={phase === "allowing"} autoFocus>
          {phase === "leaving" ? <Check className="size-4" /> : null}
          {t.allow}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn("mt-4 text-center text-[12px]", phase === "ask" ? "text-ink-3" : "font-medium text-blob-ink")}
          role={phase === "ask" ? undefined : "status"}
        >
          {phase === "leaving" || phase === "allowing" ? t.redirecting(app.name) : phase === "cancelled" ? t.cancelled(app.name) : t.revokeHint}
        </motion.p>
      </AnimatePresence>

      {(app.homepage_url || app.privacy_url) && (
        <div className="mt-5 flex items-center justify-center gap-4 border-t border-line pt-4 text-[12px] text-ink-3">
          <span className="truncate">{request.redirectOrigin.replace(/^https?:\/\//, "")}</span>
          {app.homepage_url && (
            <a href={app.homepage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              {t.website} <ExternalLink className="size-3" />
            </a>
          )}
          {app.privacy_url && (
            <a href={app.privacy_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
              {t.privacy} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Blob on the left, the app on the right, and little dots travelling between them. */
function Bridge({ app, blob, mood, phase }: { app: PublicApp; blob: React.RefObject<BlobHandle | null>; mood: BlobMood; phase: string }) {
  const reduce = useReducedMotion();
  const fast = phase === "allowing" || phase === "leaving";
  const stopped = phase === "cancelled";
  return (
    <div className="relative mx-auto mt-2 flex h-[96px] max-w-[300px] items-center justify-between">
      <div className="relative z-10 -ml-2">
        <Blob ref={blob} size={92} mood={mood} interactive={false} />
      </div>
      <div className="absolute inset-x-[88px] top-1/2 h-px -translate-y-1/2 border-t-2 border-dotted border-line-2" aria-hidden />
      {!reduce && !stopped && (
        <div className="absolute inset-x-[88px] top-1/2 -translate-y-1/2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={`${i}-${fast}`}
              className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-blob"
              initial={{ left: "0%", opacity: 0, scale: 0.6 }}
              animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.6] }}
              transition={{ duration: fast ? 0.7 : 1.8, repeat: Infinity, delay: i * (fast ? 0.22 : 0.6), ease: "easeInOut" }}
            />
          ))}
        </div>
      )}
      <motion.div
        className="relative z-10"
        animate={fast ? { scale: [1, 1.12, 1], rotate: [0, -4, 0] } : { scale: 1 }}
        transition={{ duration: 0.5, repeat: fast ? Infinity : 0 }}
      >
        <AppMark app={app} size={64} />
        {app.trusted && (
          <span className="absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center rounded-full border-2 border-raised bg-blob text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </motion.div>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar from storage
    return <img src={src} alt="" className="size-10 shrink-0 rounded-full object-cover" />;
  }
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  return <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blob text-[15px] font-semibold text-white">{letter}</span>;
}

/** The request expired or was already used: nothing to do but go back to the app. */
export function RequestGone({ kind }: { kind: "expired" | "done" }) {
  const t = useMessages(oauthText);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px] rounded-[28px] border border-line bg-raised p-8 text-center shadow-pop">
      <div className="mx-auto w-fit">
        <Blob size={110} mood="sleepy" interactive={false} />
      </div>
      <h1 className="mt-3 font-display text-[22px] font-bold tracking-[-0.02em]">{kind === "expired" ? t.consent.expired : t.consent.done}</h1>
      <p className="mt-2 text-[14px] text-ink-2">{t.consent.expiredBody}</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl border border-line px-4 text-[14px] font-medium hover:bg-hover">
        {t.error.back}
      </Link>
    </motion.div>
  );
}
