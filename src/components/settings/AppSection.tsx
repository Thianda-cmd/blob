"use client";

import { MonitorDown } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { nativeText } from "@/i18n/messages/native";
import { settingsText } from "@/i18n/messages/settings";
import { blobApp, canSelfUpdate, type AppPlatform } from "@/lib/native";
import { autoUpdates, check, install, serverUpdateState, setAutoUpdates, subscribeUpdate, tuck, updateState, download } from "@/lib/update/store";
import { Card, Row, Section, Switch } from "./primitives";

const PLATFORMS: Partial<Record<AppPlatform, string>> = { windows: "Windows", macos: "macOS", linux: "Linux" };

const noSubscribe = () => () => {};
const appVersion = () => blobApp()?.version ?? "";
const appPlatform = () => blobApp()?.platform ?? "linux";
const selfUpdating = () => canSelfUpdate(blobApp());

/** The Blob app on this computer: its version, updates, and whether it updates by itself. */
export function AppSection() {
  const t = useMessages(nativeText).update;
  const nav = useMessages(settingsText).nav;
  const s = useSyncExternalStore(subscribeUpdate, updateState, serverUpdateState);
  const version = useSyncExternalStore(noSubscribe, appVersion, () => "");
  const platform = useSyncExternalStore(noSubscribe, appPlatform, () => "linux" as AppPlatform);
  const canUpdate = useSyncExternalStore(noSubscribe, selfUpdating, () => false);
  const auto = useSyncExternalStore(subscribeUpdate, autoUpdates, () => false);
  const pct = s.total > 0 ? Math.round((s.downloaded / s.total) * 100) : 0;

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
      </Card>
    </Section>
  );
}
