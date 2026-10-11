"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { getSync, type Row, type Sync, type SyncTable } from "./sync";

const never = () => () => {};
const serverVersion = () => -1;

/** The account's offline-first rows on this device (null while rendering on the server). */
export function useSync(): Sync | null {
  const { userId } = useWorkspace();
  return typeof window === "undefined" ? null : getSync(userId);
}

/**
 * A table's rows as the screen should show them. Rows rendered on the server (`initial`) are
 * merged in (newer wins) and are what the server render and hydration show.
 */
export function useRows<T>(table: SyncTable, initial?: T[]): T[] {
  const sync = useSync();
  const [seeded, setSeeded] = useState<T[] | undefined>(undefined);
  if (sync && initial && seeded !== initial) {
    setSeeded(initial);
    sync.seed(table, initial as unknown as Row[], { quiet: true });
  }
  const version = useSyncExternalStore(sync?.subscribe ?? never, sync?.getVersion ?? serverVersion, serverVersion);
  return useMemo(() => (version === -1 || !sync ? (initial ?? []) : (sync.rows(table) as unknown as T[])), [version, sync, table, initial]);
}

/** Waiting changes (for the status pill). */
export function usePending(): number {
  const sync = useSync();
  const version = useSyncExternalStore(sync?.subscribe ?? never, sync?.getVersion ?? serverVersion, serverVersion);
  return useMemo(() => (version === -1 || !sync ? 0 : sync.pending()), [version, sync]);
}

/** Starts syncing for the signed-in account (once per page) and lets Blob explain refused changes. */
export function useStartSync() {
  const sync = useSync();
  const t = useMessages(offlineText);
  useEffect(() => {
    if (!sync) return;
    sync.start();
    return sync.onRefusal(({ change }) => {
      blob.say(t.refused[change.table], { mood: "worried" });
      blob.react("shake", "worried");
    });
  }, [sync, t]);
}
