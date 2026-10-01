"use client";

import { AnimatePresence, motion } from "motion/react";
import { KeyRound, LogOut, Mail, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormError } from "@/components/auth/FormError";
import { StrengthMeter } from "@/components/auth/StrengthMeter";
import { blob } from "@/components/blob/bus";
import { resetBoot } from "@/components/blob/BlobBoot";
import { Button } from "@/components/ui/Button";
import { Field, Input, PasswordInput } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { authMessage, isEmail } from "@/lib/auth/errors";
import { passwordStrength } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { Card, Reveal, Row, SavedBadge, Section } from "./primitives";

export function SecuritySection() {
  return (
    <Section id="security" title="Account & security" description="Your sign-in details. Only you can see these.">
      <Card>
        <EmailRow />
        <div className="h-px bg-line" />
        <PasswordRow />
      </Card>
      <Card>
        <SessionsRow />
      </Card>
    </Section>
  );
}

function EmailRow() {
  const { email } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show a change that is still waiting for confirmation (e.g. after a reload).
  useEffect(() => {
    let alive = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (alive && data.user?.new_email) setPending(data.user.new_email);
      });
    return () => {
      alive = false;
    };
  }, []);

  function toggle() {
    setOpen((o) => !o);
    setError(null);
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    setError(null);
    if (!isEmail(next)) return setError("That email address doesn't look right.");
    if (next.toLowerCase() === email.toLowerCase()) return setError("That's already your email.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser(
      { email: next },
      { emailRedirectTo: `${location.origin}/auth/callback?next=/settings` },
    );
    setLoading(false);
    if (error) return setError(authMessage(error));
    setPending(next);
    setOpen(false);
    setValue("");
    blob.say("Check both inboxes to confirm the switch.", { mood: "happy" });
  }

  return (
    <div>
      <Row
        title="Email address"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> <span className="text-ink-2">{email}</span>
          </span>
        }
      >
        <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
          {open ? "Cancel" : "Change email"}
        </Button>
      </Row>

      <Reveal open={!!pending && !open}>
        <div className="px-5 pb-4">
          <div className="flex gap-3 rounded-lg border border-blob/25 bg-blob-soft/60 px-3.5 py-3 text-[13px]">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-blob-ink" />
            <div className="min-w-0 leading-snug text-ink-2">
              <span className="font-medium text-ink">Confirm the change from both inboxes.</span> We sent a link to{" "}
              <span className="font-medium text-ink">{email}</span> and <span className="font-medium text-ink">{pending}</span>. Your email stays the
              same until both are confirmed.
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal open={open}>
        <form onSubmit={submit} className="space-y-3 px-5 pb-5" noValidate>
          <Field label="New email" htmlFor="new-email" hint="We'll send a confirmation link to your current and your new address.">
            <Input
              ref={inputRef}
              id="new-email"
              type="email"
              autoComplete="email"
              placeholder="you@school.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!error}
              className="max-w-[380px]"
            />
          </Field>
          <FormError message={error} />
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!value.trim()}>
            Send confirmation
          </Button>
        </form>
      </Reveal>
    </div>
  );
}

function PasswordRow() {
  const { email } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const strength = passwordStrength(next);
  const currentRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setError(null);
  }

  function toggle() {
    setOpen((o) => !o);
    setDone(false);
    reset();
    requestAnimationFrame(() => currentRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password first.");
    if (next.length < 8) return setError("Your new password needs at least 8 characters.");
    if (strength.score < 2) return setError("That password is a bit easy to guess. Add numbers or symbols.");
    if (next === current) return setError("Your new password must be different from the old one.");

    setLoading(true);
    const supabase = createClient();
    // Prove it's really you before changing anything.
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setLoading(false);
      blob.react("shake", "worried");
      return setError(check.error.code === "invalid_credentials" ? "Your current password isn't right." : authMessage(check.error));
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) return setError(authMessage(error));
    setOpen(false);
    reset();
    setDone(true);
    blob.say("New password saved. Nice and safe!", { mood: "happy" });
  }

  return (
    <div>
      <Row
        title="Password"
        description={
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="size-3.5" /> Use at least 8 characters, with numbers or symbols.
          </span>
        }
      >
        <SavedBadge show={done && !open}>Password updated</SavedBadge>
        <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
          {open ? "Cancel" : "Change password"}
        </Button>
      </Row>

      <Reveal open={open}>
        <form onSubmit={submit} className="space-y-3 px-5 pb-5" noValidate>
          <div className="grid max-w-[600px] gap-3 sm:grid-cols-2">
            <Field label="Current password" htmlFor="current-password">
              <PasswordInput
                ref={currentRef}
                id="current-password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label="New password" htmlFor="new-password">
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <StrengthMeter strength={strength} show={next.length > 0} />
            </Field>
          </div>
          <FormError message={error} />
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!current || !next}>
            Update password
          </Button>
        </form>
      </Reveal>
    </div>
  );
}

function SessionsRow() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOutEverywhere() {
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signOut({ scope: "global" });
    if (error) {
      setLoading(false);
      return setError(authMessage(error));
    }
    resetBoot();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <Row
        title="Sign out of all devices"
        description="Signs you out on every phone, tablet and computer, including this one."
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {confirming ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="flex items-center gap-2"
            >
              <span className="text-[12.5px] text-ink-2">Sure?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={signOutEverywhere} loading={loading}>
                <LogOut className="size-3.5" /> Sign out everywhere
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="ask"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
            >
              <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
                <LogOut className="size-3.5" /> Sign out everywhere
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Row>
      {error && (
        <div className="px-5 pb-4">
          <FormError message={error} />
        </div>
      )}
    </div>
  );
}
