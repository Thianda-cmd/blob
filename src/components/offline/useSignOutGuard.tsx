"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/trash/ConfirmDialog";
import { useLocale, useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { flushDevice } from "@/lib/offline/device";
import { isOnline } from "@/lib/offline/net";

/**
 * Before signing out: sends what this device still holds (src/lib/offline/device.ts: notes,
 * spreadsheets, calendar and task changes…). If some of it can't be sent (no connection, or online
 * for another reason: no access any more, too big, a server error), asks first, since signing out
 * deletes it from the device. `ready()` resolves to whether signing out may go on; render `dialog`
 * somewhere.
 */
export function useSignOutGuard() {
  const all = useMessages(offlineText);
  const t = all.signOut;
  const locale = useLocale();
  const [asking, setAsking] = useState<{ left: number; online: boolean; answer: (go: boolean) => void } | null>(null);

  const ready = useCallback(async () => {
    const left = await flushDevice(all.notes, locale);
    if (left === 0) return true;
    const online = isOnline();
    return new Promise<boolean>((answer) => setAsking({ left, online, answer }));
  }, [all.notes, locale]);

  const close = (go: boolean) => {
    asking?.answer(go);
    setAsking(null);
  };

  const dialog = (
    <ConfirmDialog open={!!asking} onClose={() => close(false)} onConfirm={() => close(true)} title={t.title} confirmLabel={t.confirm}>
      {(asking?.online ? t.bodyOnline : t.body)(asking?.left ?? 0)}
    </ConfirmDialog>
  );

  return { ready, dialog };
}
