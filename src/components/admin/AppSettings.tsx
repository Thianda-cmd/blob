"use client";

import { motion } from "motion/react";
import { KeyRound, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FormError } from "@/components/auth/FormError";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { ConfirmDialog } from "@/components/oauth/ConfirmDialog";
import { Card, Row, Switch } from "@/components/settings/primitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import type { AdminApp } from "@/lib/oauth/admin-types";
import { deleteApp, rotateAppSecret, setAppDisabled } from "@/app/(app)/admin/actions";
import { AppForm } from "./AppForm";
import { SecretDialog, type Credentials } from "./SecretDialog";

/** The Settings tab: the full form, the client secret, on/off and delete. */
export function AppSettings({ app }: { app: AdminApp }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <>
      <AppForm
        // A fresh form once the saved app comes back from the server (normalised values).
        key={app.updated_at}
        app={app}
        saved={saved}
        onSaved={(r) => {
          setSaved(true);
          if (r.secret) setCredentials({ kind: "added", appName: r.name, clientId: r.clientId, secret: r.secret });
        }}
        after={
          <div className="space-y-4 pt-6">
            {app.confidential && <SecretCard app={app} onNewSecret={(secret) => setCredentials({ kind: "rotated", appName: app.name, clientId: app.client_id, secret })} />}
            <StatusCard app={app} />
            <DeleteCard app={app} />
          </div>
        }
      />
      <SecretDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function SecretCard({ app, onNewSecret }: { app: AdminApp; onNewSecret: (secret: string) => void }) {
  const t = useMessages(adminText);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rotate() {
    setError(null);
    start(async () => {
      const result = await rotateAppSecret(app.id).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (!result.ok) return setError(t.failed);
      setConfirm(false);
      onNewSecret(result.secret);
    });
  }

  return (
    <Card>
      <Row
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-4 text-ink-3" aria-hidden /> {t.settings.secretTitle}
          </span>
        }
        description={
          app.secret_hint ? (
            <>
              <span className="mr-1.5 font-mono text-ink-2">••••{app.secret_hint}</span>
              {t.settings.secretKept}
            </>
          ) : (
            t.settings.secretMissing
          )
        }
      >
        <Button variant="secondary" size="sm" onClick={() => setConfirm(true)}>
          {t.settings.rotate}
        </Button>
      </Row>
      <ConfirmDialog
        id="rotate-secret"
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={rotate}
        title={t.settings.rotateTitle}
        confirmLabel={t.settings.rotateConfirm}
        cancelLabel={t.cancel}
        loading={pending}
        tone="primary"
        mood="thinking"
      >
        {t.settings.rotateBody}
        {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      </ConfirmDialog>
    </Card>
  );
}

function StatusCard({ app }: { app: AdminApp }) {
  const t = useMessages(adminText);
  // Optimistic: flips at once, flips back if the server says no.
  const [on, setOn] = useState(!app.disabled);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    start(async () => {
      const result = await setAppDisabled(app.id, !next).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (!result.ok) {
        setOn(!next);
        blob.say(t.failed, { mood: "worried" });
        return;
      }
      blob.say(next ? t.settings.switchedOn : t.settings.switchedOff, { mood: next ? "happy" : "sleepy" });
    });
  }

  return (
    <Card>
      <Row title={on ? t.settings.onTitle : t.settings.offTitle} description={on ? t.settings.onHint : t.settings.offHint}>
        <Switch id="app-enabled" checked={on} onChange={toggle} label={t.settings.onTitle} disabled={pending} />
      </Row>
    </Card>
  );
}

function DeleteCard({ app }: { app: AdminApp }) {
  const t = useMessages(adminText);
  const [open, setOpen] = useState(false);
  return (
    <Card tone="danger">
      <Row title={t.settings.deleteTitle} description={t.settings.deleteHint}>
        <Button variant="secondary" size="sm" className="text-danger hover:border-danger/40 hover:bg-danger/[0.06]" onClick={() => setOpen(true)}>
          <Trash2 className="size-3.5" /> {t.settings.deleteButton}
        </Button>
      </Row>
      <DeleteDialog app={app} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function DeleteDialog({ app, open, onClose }: { app: AdminApp; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const noop = useCallback(() => {}, []);
  return (
    <Dialog open={open} onClose={busy ? noop : onClose} className="max-w-[420px] overflow-hidden" labelledBy="delete-app-title">
      <DeleteBody app={app} onClose={onClose} onBusy={setBusy} />
    </Dialog>
  );
}

function DeleteBody({ app, onClose, onBusy }: { app: AdminApp; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const t = useMessages(adminText).settings;
  const all = useMessages(adminText);
  const blobRef = useRef<BlobHandle>(null);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = text.trim() === app.name.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!ready || deleting) return;
    setError(null);
    setDeleting(true);
    onBusy(true);
    // On success the action redirects to /admin, so this only returns on failure.
    let failure: string | null = null;
    try {
      const result = await deleteApp(app.id, text);
      if (!result.ok) failure = result.error === "confirm" ? t.confirmMismatch : all.failed;
    } catch {
      failure = all.failed;
    }
    if (failure) {
      setDeleting(false);
      onBusy(false);
      setError(failure);
      blobRef.current?.shake();
    }
  }

  return (
    <div>
      <div className="relative flex h-[120px] items-end justify-center overflow-hidden border-b border-line bg-paper">
        <div className="bg-dots absolute inset-0 opacity-50" />
        <motion.div
          className="relative"
          style={{ transformOrigin: "50% 86%" }}
          animate={deleting ? { scaleY: 0.5, scaleX: 1.3, opacity: 0.8 } : { scaleY: 1, scaleX: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <Blob ref={blobRef} size={104} mood={deleting ? "sleepy" : ready ? "surprised" : "worried"} track={false} look={{ x: 0, y: 0.6 }} interactive={false} />
        </motion.div>
      </div>
      <form onSubmit={submit} className="p-5" noValidate>
        <h2 id="delete-app-title" className="font-display text-[19px] font-semibold tracking-[-0.015em] text-balance">
          {t.deleteDialog(app.name)}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{t.deleteBody}</p>
        <label htmlFor="delete-app-confirm" className="mt-4 block text-[12.5px] font-medium text-ink-2">
          {t.typeBefore} <span className="rounded bg-hover px-1 py-0.5 font-mono text-[12px] text-ink">{app.name}</span> {t.typeAfter}
        </label>
        <Input
          id="delete-app-confirm"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1.5"
          aria-invalid={!!error}
        />
        {error && (
          <div className="mt-3">
            <FormError message={error} />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>
            {t.keep}
          </Button>
          <Button type="submit" variant="danger" disabled={!ready} loading={deleting}>
            {t.deleteForever}
          </Button>
        </div>
      </form>
    </div>
  );
}
