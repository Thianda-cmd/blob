"use client";

import { AnimatePresence, motion } from "motion/react";
import { EyeOff, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { CopyButton } from "@/components/oauth/Copy";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";

export type Credentials = { kind: "created" | "rotated" | "added"; appName: string; clientId: string; secret: string | null };

/**
 * Shows a new app's client id and, once and only once, its client secret. Blob puts on its
 * glasses for this one: closing before the secret was copied gets a second look.
 */
export function SecretDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  // The backdrop doesn't close this one; Escape and the button go through Body's check.
  const noop = useCallback(() => {}, []);
  return (
    <Dialog open={!!credentials} onClose={noop} className="max-w-[460px] overflow-hidden" labelledBy="secret-dialog-title">
      {credentials && <Body credentials={credentials} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const t = useMessages(adminText);
  const s = t.secret;
  const blobRef = useRef<BlobHandle>(null);
  const [copied, setCopied] = useState(false);
  const [nagged, setNagged] = useState(false);
  const { kind, appName, clientId, secret } = credentials;
  const mood: BlobMood = copied || !secret ? "happy" : nagged ? "worried" : "thinking";

  const tryClose = useCallback(() => {
    if (secret && !copied && !nagged) {
      setNagged(true);
      blobRef.current?.shake();
      return;
    }
    onClose();
  }, [secret, copied, nagged, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && tryClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryClose]);

  return (
    <div>
      <div className="relative flex h-[128px] items-end gap-3 overflow-hidden border-b border-line bg-paper px-5">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <div className="relative -mb-1 shrink-0">
          <Blob ref={blobRef} size={104} mood={mood} accessory="glasses" track={false} look={copied ? null : { x: 0.5, y: 0.3 }} interactive={false} />
        </div>
        {secret && (
          <AnimatePresence mode="wait">
            <motion.div
              key={copied ? "ok" : nagged ? "nag" : "hint"}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="relative mb-9 rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[13px] leading-snug text-ink shadow-pop"
              role="status"
            >
              {copied ? t.copied : nagged ? s.copyFirst : s.blobSays}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="p-5">
        <h2 id="secret-dialog-title" className="font-display text-[19px] font-semibold tracking-[-0.015em]">
          {kind === "created" ? s.readyTitle : kind === "added" ? s.addedTitle : s.newTitle}
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{kind === "created" ? s.readyBody(appName) : kind === "added" ? s.addedBody : s.newBody}</p>

        {kind === "created" && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-ink-2">{s.clientId}</span>
              <span className="text-[11.5px] text-ink-3">{s.clientIdHint}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 rounded-lg border border-line bg-surface py-0.5 pl-3 pr-0.5">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{clientId}</code>
              <CopyButton value={clientId} label={t.copyWhat(s.clientId)} copiedLabel={t.copied} />
            </div>
          </div>
        )}

        {secret && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-ink-2">{s.secret}</span>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blob-ink">
                <EyeOff className="size-3" aria-hidden /> {s.onlyNow}
              </span>
            </div>
            <div className="mt-1.5 rounded-lg border-2 border-blob/40 bg-blob-soft/40 p-2.5">
              <code className="block break-all font-mono text-[13px] leading-relaxed text-ink">{secret}</code>
              <div className="mt-2 flex justify-end">
                <CopyButton
                  value={secret}
                  label={t.copyWhat(s.secret)}
                  copiedLabel={t.copied}
                  withText
                  onCopied={() => {
                    setCopied(true);
                    setNagged(false);
                    blobRef.current?.jump(0.6);
                  }}
                />
              </div>
            </div>
            <p className="mt-3 flex gap-2 text-[12.5px] leading-snug text-ink-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
              {s.warning}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {nagged && !copied && (
            <Button variant="ghost" onClick={onClose}>
              {s.closeAnyway}
            </Button>
          )}
          <Button variant="primary" onClick={tryClose} autoFocus={!secret}>
            {kind === "created" ? s.next : s.done}
          </Button>
        </div>
      </div>
    </div>
  );
}
