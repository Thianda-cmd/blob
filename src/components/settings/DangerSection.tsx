"use client";

import { AnimatePresence, motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteAccount } from "@/app/(app)/settings/actions";
import { FormError } from "@/components/auth/FormError";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { isConfirmWord, settingsText } from "@/i18n/messages/settings";
import { Card, Row, Section } from "./primitives";

export function DangerSection() {
  const t = useMessages(settingsText).danger;
  const [open, setOpen] = useState(false);
  return (
    <Section id="danger" title={t.title} description={t.description}>
      <Card tone="danger">
        <Row title={t.deleteAccount} description={t.deleteAccountHint}>
          <Button variant="secondary" size="sm" className="text-danger hover:border-danger/40 hover:bg-danger/[0.06]" onClick={() => setOpen(true)}>
            <Trash2 className="size-3.5" /> {t.deleteAccountButton}
          </Button>
        </Row>
      </Card>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </Section>
  );
}

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const noop = useCallback(() => {}, []);
  return (
    <Dialog open={open} onClose={busy ? noop : onClose} className="max-w-[420px] overflow-hidden" labelledBy="delete-account-title">
      {/* The dialog only renders its children while open, so Blob starts fresh every time. */}
      <DeleteAccountBody onClose={onClose} onBusy={setBusy} />
    </Dialog>
  );
}

function DeleteAccountBody({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const { pages, subjects } = useWorkspace();
  const t = useMessages(settingsText).danger;
  const blobRef = useRef<BlobHandle>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"confirm" | "deleting">("confirm");
  const [error, setError] = useState<string | null>(null);
  const [startled, setStartled] = useState(true);
  const ready = isConfirmWord(text, t.confirmWord);
  const wasReady = useRef(false);

  // A little gasp when the dialog opens, then a sad face.
  useEffect(() => {
    const t = setTimeout(() => setStartled(false), 900);
    return () => clearTimeout(t);
  }, []);

  // Tremble once the word is typed.
  useEffect(() => {
    if (ready && !wasReady.current) blobRef.current?.shake();
    wasReady.current = ready;
  }, [ready]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || phase === "deleting") return;
    setError(null);
    setPhase("deleting");
    onBusy(true);
    resetBoot();
    // On success the action signs out and redirects, so this only returns on failure.
    let failure: string | undefined;
    try {
      failure = (await deleteAccount(text))?.error;
    } catch {
      failure = t.unreachable;
    }
    if (failure) {
      onBusy(false);
      setPhase("confirm");
      setError(failure);
      requestAnimationFrame(() => blobRef.current?.shake());
    }
  }

  const deleting = phase === "deleting";
  const mood: BlobMood = deleting ? "sleepy" : startled ? "surprised" : "worried";
  const notes = pages.filter((p) => p.kind === "note").length;
  const decks = pages.length - notes;
  const summary = [t.notes(notes), decks ? t.decks(decks) : null, t.subjects(subjects.length)]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <div className="relative flex h-[150px] items-end justify-center overflow-hidden border-b border-line bg-paper">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <motion.div
          className="relative"
          // Squash around the line Blob stands on, so it melts into a puddle on the floor.
          style={{ transformOrigin: "50% 86%" }}
          animate={
            deleting
              ? { scaleY: [1, 1.1, 0.34], scaleX: [1, 0.92, 1.45], y: [0, -8, 0], opacity: [1, 1, 0.9] }
              : { scaleY: 1, scaleX: 1, y: 0, opacity: 1 }
          }
          transition={deleting ? { duration: 1.4, times: [0, 0.2, 1], ease: [0.5, 0, 0.3, 1] } : { type: "spring", stiffness: 300, damping: 20 }}
        >
          <Blob ref={blobRef} size={124} mood={mood} look={ready || deleting ? null : { x: 0, y: 0.6 }} track={false} />
        </motion.div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {deleting ? (
          <motion.div
            key="bye"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="px-6 py-8 text-center"
            role="status"
          >
            <div className="font-display text-[18px] font-semibold tracking-[-0.015em]">{t.packing}</div>
            <p className="mt-1 text-[13px] text-ink-2">{t.bye}</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="p-5" noValidate>
            <h2 id="delete-account-title" className="font-display text-[19px] font-semibold tracking-[-0.015em]">
              {t.dialogTitle}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
              {pages.length || subjects.length ? t.deletesSpace(summary) : t.deletesAccount} {t.noWayBack}
            </p>
            <label htmlFor="delete-confirm" className="mt-4 block text-[12.5px] font-medium text-ink-2">
              {t.typeBefore} <span className="rounded bg-hover px-1 py-0.5 font-mono text-[12px] text-ink">{t.confirmWord}</span> {t.typeAfter}
            </label>
            <Input
              id="delete-confirm"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1.5"
              aria-invalid={!!error}
            />
            <div className="mt-3">
              <FormError message={error} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t.keep}
              </Button>
              <Button type="submit" variant="danger" disabled={!ready}>
                {t.deleteForever}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
