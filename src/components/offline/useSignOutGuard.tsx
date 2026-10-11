"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/trash/ConfirmDialog";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { flushDevice } from "@/lib/offline/device";

/**
 * Before signing out: sends what this device still holds (src/lib/offline/device.ts). If some of
 * it can't be sent (no connection), asks first, since signing out deletes it from the device.
 * `ready()` resolves to whether signing out may go on; render `dialog` somewhere.
 */
export function useSignOutGuard() {
  const all = useMessages(offlineText);
  const t = all.signOut;
  const [asking, setAsking] = useState<{ left: number; answer: (go: boolean) => void } | null>(null);

  const ready = useCallback(async () => {
    const left = await flushDevice(all.notes);
    if (left === 0) return true;
    return new Promise<boolean>((answer) => setAsking({ left, answer }));
  }, [all.notes]);

  const close = (go: boolean) => {
    asking?.answer(go);
    setAsking(null);
  };

  const dialog = (
    <ConfirmDialog open={!!asking} onClose={() => close(false)} onConfirm={() => close(true)} title={t.title} confirmLabel={t.confirm}>
      {t.body(asking?.left ?? 0)}
    </ConfirmDialog>
  );

  return { ready, dialog };
}
