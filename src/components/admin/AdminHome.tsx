"use client";

import { motion } from "motion/react";
import { Activity, AppWindow, BookOpen, ChevronRight, Clock3, KeyRound, LogIn, Plus, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { AppMark } from "@/components/oauth/AppMark";
import { ConfirmDialog } from "@/components/oauth/ConfirmDialog";
import { CopyButton } from "@/components/oauth/Copy";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { useLocale, useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import type { AppSummary, KeyInfo, SignInStats } from "@/lib/oauth/admin-types";
import { cn } from "@/lib/utils";
import { rotateKey } from "@/app/(app)/admin/actions";
import { ago, host, shortDate } from "./format";
import { AdminPage, DisabledBadge, Panel, SignInChart, StatTile, TrustedBadge, TypeBadge } from "./parts";

type Props = { apps: AppSummary[]; stats: SignInStats; people: number; keys: KeyInfo[]; jwksUrl: string };

/** /admin: totals, the 30-day chart, every app as a card, and the signing keys. */
export function AdminHome({ apps, stats, people, keys, jwksUrl }: Props) {
  const t = useMessages(adminText);
  const off = apps.filter((a) => a.disabled).length;

  return (
    <>
      <TopBar crumbs={[{ label: t.nav, icon: <ShieldCheck className="size-3.5 text-ink-3" /> }, { label: t.title }]} />
      <AdminPage>
        <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.eyebrow}</p>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{t.title}</h1>
            <p className="mt-1 max-w-[560px] text-[13.5px] text-ink-2">{t.intro}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/developers"
              target="_blank"
              className="inline-flex h-8.5 items-center gap-2 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink [&_svg]:size-4"
            >
              <BookOpen /> {t.docs}
            </Link>
            <Link
              href="/admin/apps/new"
              className="inline-flex h-8.5 items-center gap-2 rounded-lg bg-blob px-3.5 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.1)] transition-[background,transform] hover:bg-blob-deep active:scale-[0.97] [&_svg]:size-4"
            >
              <Plus /> {t.newApp}
            </Link>
          </div>
        </motion.header>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<AppWindow />} label={t.stats.apps} value={apps.length} sub={t.stats.appsSub(off)} />
          <StatTile icon={<Users />} label={t.stats.people} value={people} sub={t.stats.peopleSub} delay={0.04} />
          <StatTile icon={<LogIn />} label={t.stats.signIns} value={stats.today} sub={t.stats.signInsSub(stats.week)} delay={0.08} />
          <StatTile icon={<Activity />} label={t.stats.errors} value={stats.errors} sub={<ErrorsNote count={stats.errors} />} delay={0.12} />
        </div>

        <SignInChart series={stats.series} className="mt-3" />

        <div className="mt-10 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">{t.list.title}</h2>
        </div>
        {apps.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {apps.map((app, i) => (
              <AppCard key={app.id} app={app} index={i} />
            ))}
          </div>
        ) : (
          <EmptyApps />
        )}

        <KeysPanel keys={keys} jwksUrl={jwksUrl} />
      </AdminPage>
    </>
  );
}

export function ErrorsNote({ count }: { count: number }) {
  const t = useMessages(adminText).stats;
  if (!count) return <>{`${t.errorsSub} · ${t.allQuiet}`}</>;
  return (
    <>
      <TriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden />
      <span className="text-ink-2">
        {t.errorsSub} · {t.lookAtEvents}
      </span>
    </>
  );
}

function AppCard({ app, index }: { app: AppSummary; index: number }) {
  const t = useMessages(adminText);
  const locale = useLocale();
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, delay: 0.05 + index * 0.04 }}
      className={cn(
        "group relative min-w-0 rounded-xl border border-line bg-raised p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-pop",
        app.disabled && "bg-surface",
      )}
    >
      <Link href={`/admin/apps/${app.id}`} className="absolute inset-0 rounded-xl" aria-label={t.list.open(app.name)} />
      <div className="flex items-start gap-3">
        <AppMark app={app} size={42} className={cn(app.disabled && "opacity-50 grayscale")} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className={cn("truncate text-[14.5px] font-semibold", app.disabled && "text-ink-2")}>{app.name}</h3>
            {app.trusted && <TrustedBadge />}
          </div>
          <p className="truncate text-[12.5px] text-ink-3">{app.description || host(app.homepage_url) || host(app.redirect_uris[0] ?? null)}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>

      <div className="relative z-10 mt-3 flex w-fit max-w-full items-center gap-0.5 rounded-lg bg-hover/70 py-0.5 pl-2 pr-0.5">
        <code className="min-w-0 truncate font-mono text-[12px] text-ink-2">{app.client_id}</code>
        <CopyButton value={app.client_id} label={t.copyWhat("Client ID")} copiedLabel={t.copied} className="size-6" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-ink-3">
        <TypeBadge confidential={app.confidential} />
        {app.disabled && <DisabledBadge />}
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden /> {t.list.people(app.people)}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1" title={app.lastSignIn ? shortDate(app.lastSignIn, locale) : undefined}>
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate" suppressHydrationWarning>
            {app.lastSignIn ? t.list.lastSignIn(ago(app.lastSignIn, locale)) : t.list.never}
          </span>
        </span>
      </div>
    </motion.article>
  );
}

function EmptyApps() {
  const t = useMessages(adminText);
  return (
    <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-line-2 bg-surface px-6 py-10 text-center">
      <Blob size={96} mood="idle" />
      <h3 className="mt-2 font-display text-[17px] font-semibold tracking-[-0.015em]">{t.list.emptyTitle}</h3>
      <p className="mt-1 max-w-[380px] text-[13px] text-ink-2">{t.list.emptyBody}</p>
      <Link
        href="/admin/apps/new"
        className="mt-5 inline-flex h-8.5 items-center gap-2 rounded-lg bg-blob px-3.5 text-[13.5px] font-medium text-white hover:bg-blob-deep [&_svg]:size-4"
      >
        <Plus /> {t.newApp}
      </Link>
    </div>
  );
}

function KeysPanel({ keys, jwksUrl }: { keys: KeyInfo[]; jwksUrl: string }) {
  const t = useMessages(adminText);
  const locale = useLocale();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rotate() {
    setError(null);
    start(async () => {
      const result = await rotateKey();
      if (!result.ok) return setError(t.failed);
      setConfirm(false);
      blob.say(t.keys.rotated, { mood: "happy" });
    });
  }

  return (
    <Panel
      id="keys"
      className="mt-10"
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-ink-3" aria-hidden /> {t.keys.title}
        </span>
      }
      sub={
        <>
          {t.keys.body}{" "}
          <a href={jwksUrl} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink">
            /oauth/jwks
          </a>
        </>
      }
      action={
        <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
          {t.keys.rotate}
        </Button>
      }
    >
      <ul className="mt-2 divide-y divide-line border-t border-line">
        {keys.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3 sm:px-5">{t.keys.none}</li>}
        {keys.map((k) => (
          <li key={k.kid} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
            <code className={cn("font-mono text-[12.5px]", k.active ? "text-ink" : "text-ink-3")}>{k.kid}</code>
            <span className="text-[11.5px] text-ink-3">{k.alg}</span>
            {k.active ? (
              <span className="inline-flex h-5.5 items-center gap-1 rounded-md bg-blob-soft px-1.5 text-[11.5px] font-medium text-blob-ink">
                <span className="size-1.5 rounded-full bg-blob" /> {t.keys.active}
              </span>
            ) : (
              <span className="text-[12px] text-ink-3">{k.retired_at ? t.keys.retired(shortDate(k.retired_at, locale)) : null}</span>
            )}
            <span className="ml-auto text-[12px] text-ink-3" suppressHydrationWarning>
              {t.keys.created(shortDate(k.created_at, locale))}
            </span>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        id="rotate-key"
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={rotate}
        title={t.keys.rotateTitle}
        confirmLabel={t.keys.rotateConfirm}
        cancelLabel={t.cancel}
        loading={pending}
        tone="primary"
        mood="thinking"
      >
        {t.keys.rotateBody}
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      </ConfirmDialog>
    </Panel>
  );
}
