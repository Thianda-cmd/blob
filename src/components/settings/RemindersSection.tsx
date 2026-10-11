"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { weekdayName } from "@/components/calendar/describe";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { notifyText } from "@/i18n/messages/notify";
import { settingsText } from "@/i18n/messages/settings";
import { blobApp, isPhoneApp } from "@/lib/native";
import { prefsOf, type NotifyPrefs } from "@/lib/notify/plan";
import { notifyPermission, requestNotifyPermission, type Permission } from "@/lib/notify/scheduler";
import { Card, Row, Section, Switch } from "./primitives";

const KINDS: (keyof NotifyPrefs)[] = ["events", "homework", "exams", "reminders", "cards", "streak", "morning"];

/** Calendar and reminders: the week's first day, and which notifications this account gets. */
export function RemindersSection() {
  const { profile, setProfile } = useWorkspace();
  const t = useMessages(notifyText).settings;
  const nav = useMessages(settingsText).nav;
  const locale = useLocale();
  const prefs = prefsOf(profile.notify);
  const [permission, setPermission] = useState<Permission | null>(null);
  const app = typeof window !== "undefined" ? blobApp() : null;

  useEffect(() => {
    let alive = true;
    void notifyPermission().then((p) => alive && setPermission(p));
    return () => {
      alive = false;
    };
  }, []);

  const set = (k: keyof NotifyPrefs, v: boolean) => void setProfile({ notify: { ...prefs, [k]: v } });
  const week = profile.week_starts_on ?? 1;

  return (
    <Section id="reminders" title={nav.reminders} description={t.intro}>
      <Card>
        <Row title={t.weekStart}>
          <Segmented
            value={String(week)}
            options={[1, 0, 6].map((d) => ({ value: String(d), label: weekdayName(d, locale) }))}
            onChange={(v) => void setProfile({ week_starts_on: Number(v) })}
            label={t.weekStart}
            size="sm"
          />
        </Row>
      </Card>
      <Card
        footer={
          <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <BellRing className="size-3.5 shrink-0" />
            {!app ? t.browser : permission === "denied" ? t.blocked : !isPhoneApp(app) ? t.desktopNote : permission === "granted" ? t.allowed : t.intro}
          </p>
        }
      >
        {app && permission === "prompt" && (
          <Row title={t.title} description={t.intro}>
            <Button variant="blob" size="sm" onClick={async () => setPermission(await requestNotifyPermission())}>
              {t.allow}
            </Button>
          </Row>
        )}
        <div className="divide-y divide-line">
          {KINDS.map((k) => (
            <Row key={k} title={t[k]} description={t[`${k}Hint` as const]}>
              <Switch checked={prefs[k]} onChange={(v) => set(k, v)} label={t[k]} />
            </Row>
          ))}
        </div>
      </Card>
    </Section>
  );
}
