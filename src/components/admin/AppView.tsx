"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clock3,
  ExternalLink,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Unplug,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { oauthText } from "@/i18n/messages/oauth";
import { APP_TABS, type AdminApp, type AppEvent, type AppTab, type Connection, type EventKind, type Person, type SignInStats } from "@/lib/oauth/admin-types";
import { cn } from "@/lib/utils";
import { revokePersonAccess } from "@/app/(app)/admin/actions";
import { ErrorsNote } from "./AdminHome";
import { AppIntegration } from "./AppIntegration";
import { AppSettings } from "./AppSettings";
import { ago, dateTime, host, shortDate } from "./format";
import { AdminPage, Avatar, DisabledBadge, Panel, SignInChart, StatTile, TrustedBadge, TypeBadge } from "./parts";

type Tab = AppTab;

type Props = {
  app: AdminApp;
  stats: SignInStats;
  events: AppEvent[];
  connections: Connection[];
  people: Record<string, Person>;
  issuer: string;
  endpoints: Record<string, string>;
  initialTab: Tab;
};

/** /admin/apps/[id]: one app with Overview, Settings, People and Integration tabs. */
export function AppView({ app, stats, events, connections, people, issuer, endpoints, initialTab }: Props) {
  const t = useMessages(adminText);
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>(initialTab);
  // People removed here disappear at once, before the server confirms.
  const [removed, setRemoved] = useState<string[]>([]);
  const active = connections.filter((c) => !removed.includes(c.user_id));

  function pick(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <TopBar
        crumbs={[
          { label: t.nav, icon: <ShieldCheck className="size-3.5 text-ink-3" />, href: "/admin" },
          { label: t.title, href: "/admin" },
          { label: app.name },
        ]}
      />
      <AdminPage>
        <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-start gap-4">
          <AppMark app={app} size={56} className={cn(app.disabled && "opacity-50 grayscale")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 break-words font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">{app.name}</h1>
              {app.trusted && <TrustedBadge />}
              {app.disabled && <DisabledBadge />}
            </div>
            {app.description && <p className="mt-0.5 text-[13.5px] text-ink-2">{app.description}</p>}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-3">
              <span className="flex min-w-0 max-w-full items-center gap-0.5 rounded-lg bg-hover/70 py-0.5 pl-2 pr-0.5">
                <code className="min-w-0 truncate font-mono text-[12px] text-ink-2">{app.client_id}</code>
                <CopyButton value={app.client_id} label={t.copyWhat(t.secret.clientId)} copiedLabel={t.copied} className="size-6" />
              </span>
              <TypeBadge confidential={app.confidential} />
              {app.homepage_url && (
                <a href={app.homepage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                  {host(app.homepage_url)} <ExternalLink className="size-3" />
                </a>
              )}
              <span suppressHydrationWarning>{t.detail.created(shortDate(app.created_at, locale))}</span>
            </div>
          </div>
        </motion.header>

        <div role="tablist" aria-label={t.detail.tabsLabel} className="mt-7 flex gap-1 overflow-x-auto border-b border-line">
          {APP_TABS.map((id) => {
            const on = tab === id;
            return (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${id}`}
                onClick={() => pick(id)}
                className={cn(
                  "relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-[13.5px] transition-colors",
                  on ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.detail.tabs[id]}
                {id === "people" && <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium leading-[18px] text-ink-2">{active.length}</span>}
                {on && <motion.span layoutId="admin-app-tab" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-blob" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="pt-6"
          >
            {tab === "overview" && <Overview stats={stats} events={events} people={people} connected={active.length} />}
            {tab === "settings" && <AppSettings app={app} />}
            {tab === "people" && (
              <PeopleList app={app} connections={active} people={people} onRemoved={(id) => setRemoved((r) => [...r, id])} onRestore={(id) => setRemoved((r) => r.filter((x) => x !== id))} />
            )}
            {tab === "integration" && <AppIntegration app={app} issuer={issuer} endpoints={endpoints} />}
          </motion.div>
        </AnimatePresence>
      </AdminPage>
    </>
  );
}

const EVENT_ICONS: Record<EventKind, LucideIcon> = {
  consent: Check,
  authorize: Check,
  token: LogIn,
  refresh: RefreshCw,
  denied: X,
  revoked: Unplug,
  error: TriangleAlert,
  reuse: ShieldAlert,
};

function Overview({ stats, events, people, connected }: { stats: SignInStats; events: AppEvent[]; people: Record<string, Person>; connected: number }) {
  const t = useMessages(adminText);
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon={<Users />} label={t.detail.people} value={connected} sub={t.detail.peopleSub} />
        <StatTile icon={<LogIn />} label={t.stats.signIns} value={stats.today} sub={t.stats.signInsSub(stats.week)} delay={0.04} />
        <StatTile icon={<TriangleAlert />} label={t.stats.errors} value={stats.errors} sub={<ErrorsNote count={stats.errors} />} delay={0.08} />
      </div>
      <SignInChart series={stats.series} />
      <Panel title={t.events.title} className="!mt-6">
        {events.length === 0 ? (
          <p className="px-4 pb-5 pt-1 text-[13px] text-ink-3 sm:px-5">{t.events.empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {events.map((e) => {
              const Icon = EVENT_ICONS[e.kind] ?? Clock3;
              const problem = e.kind === "error" || e.kind === "reuse";
              const person = e.user_id ? people[e.user_id] : null;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                      problem ? "bg-danger/10 text-danger" : e.kind === "token" ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className={cn("text-[13px] font-medium", problem ? "text-danger" : "text-ink")}>{t.events.kinds[e.kind] ?? e.kind}</span>
                      <span className="min-w-0 truncate text-[12.5px] text-ink-2">
                        {person ? (
                          <>
                            {person.name || person.email}
                            {person.name && person.email && <span className="text-ink-3"> · {person.email}</span>}
                          </>
                        ) : e.user_id ? (
                          t.people.unknown
                        ) : (
                          <span className="text-ink-3">{t.events.noPerson}</span>
                        )}
                      </span>
                    </div>
                    {e.detail && <div className="mt-0.5 text-[12px] leading-snug text-ink-3">{t.events.details[e.detail] ?? e.detail}</div>}
                  </div>
                  <time dateTime={e.created_at} title={dateTime(e.created_at, locale)} className="shrink-0 pt-0.5 text-[12px] text-ink-3" suppressHydrationWarning>
                    {ago(e.created_at, locale)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function PeopleList({
  app,
  connections,
  people,
  onRemoved,
  onRestore,
}: {
  app: AdminApp;
  connections: Connection[];
  people: Record<string, Person>;
  onRemoved: (userId: string) => void;
  onRestore: (userId: string) => void;
}) {
  const t = useMessages(adminText);
  const scopeShort = useMessages(oauthText).connected.scopeShort;
  const locale = useLocale();
  const [confirm, setConfirm] = useState<Connection | null>(null);
  const [pending, start] = useTransition();
  const nameOf = (c: Connection) => people[c.user_id]?.name || people[c.user_id]?.email || t.people.unknown;

  function remove(c: Connection) {
    const who = nameOf(c);
    start(async () => {
      onRemoved(c.user_id);
      let result: Awaited<ReturnType<typeof revokePersonAccess>>;
      try {
        result = await revokePersonAccess(app.id, c.user_id);
      } catch {
        result = { ok: false, error: "failed" };
      }
      setConfirm(null);
      if (!result.ok && result.error !== "not_found") {
        onRestore(c.user_id);
        blob.say(t.failed, { mood: "worried" });
        return;
      }
      blob.say(t.people.removed(who), { mood: "happy" });
    });
  }

  return (
    <Panel title={t.people.title} sub={t.people.sub(app.name)}>
      {connections.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
          <Blob size={84} mood="sleepy" />
          <p className="mt-2 text-[14px] font-medium">{t.people.empty}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{t.people.emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-2 border-t border-line">
          <AnimatePresence initial={false}>
            {connections.map((c) => {
              const p = people[c.user_id];
              return (
                <motion.li
                  key={c.user_id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-nowrap sm:px-5"
                >
                  <Avatar name={nameOf(c)} src={p?.avatar ?? null} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{nameOf(c)}</div>
                    {p?.email && p.email !== nameOf(c) && <div className="truncate text-[12.5px] text-ink-3">{p.email}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
                      <span suppressHydrationWarning>
                        {t.people.since(shortDate(c.created_at, locale))} · {c.last_used_at ? t.people.lastUsed(ago(c.last_used_at, locale)) : t.people.neverUsed}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {c.scopes
                          .filter((s) => s !== "openid")
                          .map((s) => (
                            <span key={s} className="rounded-md bg-hover px-1.5 text-[11.5px] leading-[18px] text-ink-2">
                              {scopeShort[s] ?? s}
                            </span>
                          ))}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-auto hover:bg-danger/[0.08] hover:text-danger" onClick={() => setConfirm(c)}>
                    <Unplug className="size-3.5" /> {t.people.remove}
                  </Button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <ConfirmDialog
        id="remove-person"
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && remove(confirm)}
        title={confirm ? t.people.removeTitle(nameOf(confirm)) : ""}
        confirmLabel={t.people.remove}
        cancelLabel={t.cancel}
        loading={pending}
      >
        {t.people.removeBody(app.name)}
      </ConfirmDialog>
    </Panel>
  );
}
