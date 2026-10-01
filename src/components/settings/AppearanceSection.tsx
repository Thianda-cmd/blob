"use client";

import { applyTheme } from "@/components/theme";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { Theme } from "@/lib/types";
import { Card, Section } from "./primitives";
import { ThemePicker } from "./ThemePicker";

export function AppearanceSection() {
  const { profile, setProfile } = useWorkspace();

  function pick(theme: Theme) {
    if (theme === profile.theme) return;
    applyTheme(theme);
    setProfile({ theme });
  }

  return (
    <Section id="appearance" title="Appearance" description="Pick how Blob looks. Changes apply right away.">
      <Card>
        <div className="p-5">
          <div className="mb-3.5">
            <div className="text-[13.5px] font-medium">Theme</div>
            <div className="mt-0.5 text-[12.5px] text-ink-3">System matches the light or dark setting on your device.</div>
          </div>
          <ThemePicker value={profile.theme} onChange={pick} className="max-w-[640px]" />
        </div>
      </Card>
    </Section>
  );
}
