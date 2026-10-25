"use client";

import { MonitorDown } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { blob } from "@/components/blob/bus";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { nativeText } from "@/i18n/messages/native";
import { settingsText } from "@/i18n/messages/settings";
import { autostartEnabled, blobApp, canSelfUpdate, setAutostart, type AppPlatform } from "@/lib/native";
import { autoUpdates, check, install, serverUpdateState, setAutoUpdates, subscribeUpdate, tuck, updateState, download } from "@/lib/update/store";
import { Card, Row, Section, Switch } from "./primitives";

const PLATFORMS: Partial<Record<AppPlatform, string>> = { windows: "Windows", macos: "macOS", linux: "Linux" };

const noSubscribe = () => () => {};
const appVersion = () => blobApp()?.version ?? "";
const appPlatform = () => blobApp()?.platform ?? "linux";
const selfUpdating = () => canSelfUpdate(blobApp());

/** The Blob app on this computer: its version, updates, whether it updates by itself and starts with the computer. */
export function AppSection() {
  const t = useMessages(nativeText).update;
  const nav = useMessages(settingsText).nav;
  const s = useSyncExternalStore(subscribeUpdate, updateState, serverUpdateState);
  const version = useSyncExternalStore(noSubscribe, appVersion, () => "");
  const platform = useSyncExternalStore(noSubscribe, appPlatform, () => "linux" as AppPlatform);
  const canUpdate = useSyncExternalStore(noSubscribe, selfUpdating, () => false);
  const auto = useSyncExternalStore(subscribeUpdate, autoUpdates, () => false);
  const pct = s.total > 0 ? Math.round((s.downloaded / s.total) * 100) : 0;
  // Whether Blob starts at login; null until known, and in apps older than 0.5.0 (the row stays away).
  const [startup, setStartup] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void autostartEnabled().then((on) => alive && setStartup(on));
    return () => {
      alive = false;
    };
  }, []);

  async function toggleStartup(on: boolean) {
    setStartup(on);
    const now = await setAutostart(on);
    if (now === null) {
      setStartup(!on);
      blob.say(t.startupFailed, { mood: "worried" });
    } else {
      setStartup(now);
    }
  }

  const status =
    s.phase === "checking"
      ? t.checking
      : s.phase === "current"
        ? t.current
        : s.phase === "available" && s.update
          ? t.available(s.update.version)
          : s.phase === "downloading"
            ? t.downloading(pct)
            : s.phase === "ready"
              ? t.ready
              : s.phase === "error" && !s.update
                ? t.failed
                : null;

  const action =
    s.phase === "available" && s.update?.installable ? (
      <Button variant="blob" size="sm" onClick={() => void download()}>
        {t.updateNow}
      </Button>
    ) : s.phase === "ready" ? (
      <Button variant="blob" size="sm" onClick={() => void install()}>
        {t.restart}
      </Button>
    ) : s.phase === "downloading" ? (
      <Button size="sm" onClick={() => tuck(false)}>
        {t.show}
      </Button>
    ) : (
      <Button size="sm" loading={s.phase === "checking"} disabled={s.phase === "checking" || s.phase === "installing"} onClick={() => void check({ manual: true })}>
        {t.check}
      </Button>
    );

  return (
    <Section id="app" title={nav.app}>
      <Card>
        <Row
          title={
            <span className="flex items-center gap-2">
              <MonitorDown className="size-4 text-ink-3" />
              {t.app(PLATFORMS[platform] ?? platform)}
            </span>
          }
          description={
            <>
              {t.version(version)}
              {status && <> · {status}</>}
            </>
          }
        >
          {action}
        </Row>
        <div className="border-t border-line">
          <Row title={t.auto} description={canUpdate ? t.autoHint : t.autoLegacy}>
            <Switch checked={canUpdate && auto} onChange={setAutoUpdates} label={t.auto} disabled={!canUpdate} />
          </Row>
        </div>
        {startup !== null && (
          <div className="border-t border-line">
            <Row title={t.startup} description={t.startupHint(PLATFORMS[platform] ?? platform)}>
              <Switch checked={startup} onChange={(on) => void toggleStartup(on)} label={t.startup} />
            </Row>
          </div>
        )}
      </Card>
    </Section>
  );
}
