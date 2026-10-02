"use client";

import { AnimatePresence, motion } from "motion/react";
import { Database, ExternalLink, Trash2, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteConnectedAppData, removeConnectedApp } from "@/app/(app)/settings/actions";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { AppMark } from "@/components/oauth/AppMark";
import { ConfirmDialog } from "@/components/oauth/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale, formatBytes } from "@/i18n/format";
import { oauthText } from "@/i18n/messages/oauth";
import { settingsText } from "@/i18n/messages/settings";
import type { ConnectedApp } from "@/lib/oauth/connected";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Card, Section } from "./primitives";

/** Settings › Connected apps: websites where you sign in with Blob, and "Remove access". */
export function ConnectedAppsSection({ apps }: { apps: ConnectedApp[] }) {
  const t = useMessages(oauthText).connected;
  const cancel = useMessages(settingsText).cancel;
  const locale = useLocale();
  // Removed rows disappear right away; they come back if the server says no.
  const [removed, setRemoved] = useState<string[]>([]);
  const [wiped, setWiped] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ app: ConnectedApp; kind: "access" | "data" } | null>(null);
  const [alsoData, setAlsoData] = useState(false);
  const [pending, start] = useTransition();
  const visible = apps
    .map((a) => (wiped.includes(a.app_id) ? { ...a, data: null } : a))
    .filter((a) => !removed.includes(a.app_id) && (a.connected || a.data));
  const size = (app: ConnectedApp) => (app.data ? formatBytes(app.data.bytes, locale) : "");

  function remove(app: ConnectedApp) {
    const withData = alsoData && !!app.data;
    // Outside the transition, so the row changes right away rather than when the server answers.
    // Without its data deleted, a removed app stays listed (so the data can still be deleted).
    if (withData || !app.data) setRemoved((r) => [...r, app.app_id]);
    start(async () => {
      const result = await removeConnectedApp(app.app_id, withData).catch(() => ({ ok: false as const }));
      setConfirm(null);
      if (!result.ok) {
        setRemoved((r) => r.filter((id) => id !== app.app_id));
        blob.react("shake", "worried");
        return;
      }
      blob.say(t.removed(app.name), { mood: "happy" });
    });
  }

  function wipe(app: ConnectedApp) {
    setWiped((w) => [...w, app.app_id]);
    start(async () => {
      const result = await deleteConnectedAppData(app.app_id).catch(() => ({ ok: false as const }));
      setConfirm(null);
      if (!result.ok) {
        setWiped((w) => w.filter((id) => id !== app.app_id));
        blob.react("shake", "worried");
        return;
      }
      blob.say(t.dataDeleted(app.name), { mood: "happy" });
    });
  }

  return (
    <Section id="connected" title={t.title} description={t.description}>
      <Card>
        {visible.length === 0 ? (
          <div className="flex items-center gap-4 px-5 py-5">
            <div className="-my-2 shrink-0">
              <Blob size={64} mood="idle" track={false} look={{ x: 0.4, y: 0.1 }} />
            </div>
            <p className="text-[13px] leading-snug text-ink-2">{t.empty}</p>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {visible.map((app) => (
                <Row
                  key={app.app_id}
                  app={app}
                  size={size(app)}
                  onRemove={() => {
                    setAlsoData(false);
                    setConfirm({ app, kind: "access" });
                  }}
                  onDeleteData={() => setConfirm({ app, kind: "data" })}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>
      <ConfirmDialog
        id="remove-connected-app"
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && (confirm.kind === "access" ? remove(confirm.app) : wipe(confirm.app))}
        title={confirm ? (confirm.kind === "access" ? t.removeTitle(confirm.app.name) : t.deleteDataTitle(confirm.app.name)) : ""}
        confirmLabel={confirm?.kind === "data" ? t.deleteData : t.remove}
        cancelLabel={cancel}
        loading={pending}
      >
        {confirm?.kind === "access" ? (
          <>
            {t.removeBody(confirm.app.name)}
            {confirm.app.data && !alsoData && ` ${t.dataStays}`}
            {confirm.app.data && (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--blob)]" checked={alsoData} onChange={(e) => setAlsoData(e.target.checked)} />
                {t.alsoDelete(size(confirm.app))}
              </label>
            )}
          </>
        ) : confirm ? (
          <>
            {t.deleteDataBody(confirm.app.name, size(confirm.app))}
            {confirm.app.connected && <span className="mt-2 block">{t.savesAgain(confirm.app.name)}</span>}
          </>
        ) : null}
      </ConfirmDialog>
    </Section>
  );
}

function Row({ app, size, onRemove, onDeleteData }: { app: ConnectedApp; size: string; onRemove: () => void; onDeleteData: () => void }) {
  const t = useMessages(oauthText).connected;
  const locale = useLocale();
  const can = app.scopes.filter((s) => s !== "openid" || app.scopes.length === 1).map((s) => t.scopeCan[s] ?? s);
  const since = format(new Date(app.since), locale === "de" ? "d. MMM yyyy" : "d MMM yyyy", { locale: dateLocale(locale) });
  const lastUsed = app.last_used ? formatDistanceToNowStrict(new Date(app.last_used), { addSuffix: true, locale: dateLocale(locale) }) : null;

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      className="flex flex-col gap-3 overflow-hidden border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AppMark app={app} size={40} />
        <div className="min-w-0 leading-snug">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium text-ink">{app.name}</span>
            {app.homepage_url && (
              <a href={app.homepage_url} target="_blank" rel="noreferrer" className="shrink-0 text-ink-3 hover:text-ink" aria-label={app.homepage_url}>
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          {app.connected ? (
            <>
              <div className="mt-0.5 text-[12.5px] text-pretty text-ink-2">
                <span className="text-ink-3">{t.can}:</span> {can.join(", ")}
              </div>
              <div className="mt-0.5 text-[12px] text-pretty text-ink-3" suppressHydrationWarning>
                {t.since(since)}
                {lastUsed && ` · ${t.lastUsed(lastUsed)}`}
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-[12.5px] text-ink-3">{t.noAccess}</div>
          )}
          {app.data && (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
              <Database className="size-3.5 shrink-0 text-ink-3" /> {app.connected ? t.stores(size) : t.stillKeeps(size)}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-center">
        {app.data && (
          <Button variant="ghost" size="sm" className="-ml-2.5 sm:ml-0" onClick={onDeleteData}>
            <Trash2 className="size-3.5" /> {t.deleteData}
          </Button>
        )}
        {app.connected && (
          <Button variant="secondary" size="sm" onClick={onRemove}>
            <Unplug className="size-3.5" /> {t.remove}
          </Button>
        )}
      </div>
    </motion.li>
  );
}
