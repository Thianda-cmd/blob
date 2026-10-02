"use client";

import { LanguageSwitch } from "@/components/LanguageSwitch";
import { applyTheme } from "@/components/theme";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { settingsText } from "@/i18n/messages/settings";
import type { Theme } from "@/lib/types";
import { Card, Section } from "./primitives";
import { ThemePicker } from "./ThemePicker";

export function AppearanceSection() {
  const { profile, setProfile } = useWorkspace();
  const t = useMessages(settingsText).appearance;

  function pick(theme: Theme) {
    if (theme === profile.theme) return;
    applyTheme(theme);
    setProfile({ theme });
  }

  return (
    <Section id="appearance" title={t.title} description={t.description}>
      <Card>
        <div className="p-5">
          <div className="mb-3.5">
            <div className="text-[13.5px] font-medium">{t.theme}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">{t.themeHint}</div>
          </div>
          <ThemePicker value={profile.theme} onChange={pick} className="max-w-[640px]" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-5">
          <div>
            <div className="text-[13.5px] font-medium">{t.language}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">{t.languageHint}</div>
          </div>
          <LanguageSwitch />
        </div>
      </Card>
    </Section>
  );
}
