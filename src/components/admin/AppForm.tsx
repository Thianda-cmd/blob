"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Check, Clock3, Database, Fingerprint, Globe, Info, Mail, Pipette, Server, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { FormError } from "@/components/auth/FormError";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { AppMark } from "@/components/oauth/AppMark";
import { SavedBadge, Switch } from "@/components/settings/primitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import { oauthText } from "@/i18n/messages/oauth";
import { DEFAULT_SCOPES, SCOPE_NAMES, type AdminApp, type AppErrors, type AppField, type AppInput, type SaveResult, type ScopeName } from "@/lib/oauth/admin-types";
import { cn } from "@/lib/utils";
import { createApp, updateApp } from "@/app/(app)/admin/actions";

const SWATCHES = ["#6d3df5", "#2563eb", "#0e7490", "#0f766e", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#1c1b18"];
const DEFAULT_COLOR = "#6d3df5";
const HEX = /^#[0-9a-fA-F]{6}$/;
const SCOPE_ICONS: Record<ScopeName, typeof Mail> = { openid: Fingerprint, profile: UserRound, email: Mail, data: Database, offline_access: Clock3 };
const FIELD_ORDER: AppField[] = ["name", "description", "homepage_url", "privacy_url", "mark", "color", "logo_url", "redirect_uris", "allowed_origins"];

const valuesOf = (app?: AdminApp): AppInput => ({
  name: app?.name ?? "",
  description: app?.description ?? "",
  homepage_url: app?.homepage_url ?? "",
  privacy_url: app?.privacy_url ?? "",
  logo_url: app?.logo_url ?? "",
  mark: app?.mark ?? "",
  color: app?.color ?? DEFAULT_COLOR,
  redirect_uris: app?.redirect_uris.join("\n") ?? "",
  allowed_origins: app?.allowed_origins.join("\n") ?? "",
  scopes: app?.scopes ?? [...DEFAULT_SCOPES],
  confidential: app?.confidential ?? false,
  trusted: app?.trusted ?? false,
});

/** Good enough to try loading as a logo in the preview; the server checks properly. */
const looksLikeImageUrl = (s: string) => /^https:\/\/[^\s/]+\.[^\s]+$/.test(s.trim()) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/.test(s.trim());

export type Saved = { id: string; name: string; clientId: string; secret: string | null; created: boolean };

/**
 * Create or edit an app. Without `app` it creates one. `after` renders below the form in the
 * same column (outside the <form>, so dialogs there can have their own forms).
 */
export function AppForm({ app, onSaved, saved, after }: { app?: AdminApp; onSaved: (result: Saved) => void; saved?: boolean; after?: ReactNode }) {
  const all = useMessages(adminText);
  const t = all.form;
  const [values, setValues] = useState<AppInput>(() => valuesOf(app));
  const [errors, setErrors] = useState<AppErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(valuesOf(app));

  function set<K extends keyof AppInput>(key: K, value: AppInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function errorText(field: AppField) {
    const e = errors[field];
    if (!e) return null;
    if (e.code === "redirect") return t.errors.redirect(e.value ?? "");
    if (e.code === "origin") return t.errors.origin(e.value ?? "");
    return t.errors[e.code];
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    start(async () => {
      let result: SaveResult;
      try {
        result = app ? await updateApp(app.id, values) : await createApp(values);
      } catch {
        result = { ok: false, error: "failed" };
      }
      if (result.ok) {
        setErrors({});
        onSaved({ id: result.id, name: values.name.trim().replace(/\s+/g, " "), clientId: result.clientId, secret: result.secret, created: !app });
        return;
      }
      if ("errors" in result) {
        setErrors(result.errors);
        setFormError(t.fix);
        blob.react("shake", "worried");
        const first = FIELD_ORDER.find((f) => result.errors[f]);
        if (first) requestAnimationFrame(() => document.getElementById(`app-${first}`)?.focus());
        return;
      }
      setFormError(all.failed);
    });
  }

  const color = HEX.test(values.color) ? values.color : DEFAULT_COLOR;
  const named = values.name.trim();
  const preview = {
    // Until there is a name, the preview borrows the placeholder (and looks like one).
    name: named || t.namePlaceholder,
    logo_url: looksLikeImageUrl(values.logo_url) ? values.logo_url.trim() : null,
    mark: values.mark.trim(),
    color,
  };
  const customColor = !SWATCHES.includes(values.color.toLowerCase());
  const typeNote = app && app.confidential !== values.confidential ? (values.confidential ? t.toConfidential : t.toPublic) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
      <div className="min-w-0 space-y-4">
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormCard title={t.about}>
            <Field label={t.name} htmlFor="app-name" hint={t.nameHint} error={errorText("name")}>
              <Input
                id="app-name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t.namePlaceholder}
                maxLength={60}
                autoFocus={!app}
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field label={t.description} htmlFor="app-description" hint={t.descriptionHint} error={errorText("description")}>
              <Textarea
                id="app-description"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder={t.descriptionPlaceholder}
                maxLength={300}
                rows={2}
                className="min-h-16"
                aria-invalid={!!errors.description}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.homepage} htmlFor="app-homepage_url" hint={t.optional} error={errorText("homepage_url")}>
                <Input
                  id="app-homepage_url"
                  type="url"
                  inputMode="url"
                  value={values.homepage_url}
                  onChange={(e) => set("homepage_url", e.target.value)}
                  placeholder="https://lernpfad.bojes.org"
                  maxLength={300}
                  aria-invalid={!!errors.homepage_url}
                />
              </Field>
              <Field label={t.privacy} htmlFor="app-privacy_url" hint={t.optional} error={errorText("privacy_url")}>
                <Input
                  id="app-privacy_url"
                  type="url"
                  inputMode="url"
                  value={values.privacy_url}
                  onChange={(e) => set("privacy_url", e.target.value)}
                  placeholder="https://lernpfad.bojes.org/datenschutz"
                  maxLength={300}
                  aria-invalid={!!errors.privacy_url}
                />
              </Field>
            </div>
          </FormCard>

          <FormCard title={t.look}>
            <div className="flex gap-4">
              <div className="pt-6">
                <AppMark app={preview} size={56} />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <Field label={t.mark} htmlFor="app-mark" hint={t.markHint} error={errorText("mark")}>
                  <Input
                    id="app-mark"
                    value={values.mark}
                    onChange={(e) => set("mark", e.target.value)}
                    placeholder={t.markPlaceholder}
                    maxLength={8}
                    className="max-w-[140px]"
                    aria-invalid={!!errors.mark}
                  />
                </Field>
                <div className="space-y-1.5">
                  <div id="app-color-label" className="text-[12.5px] font-medium text-ink-2">
                    {t.color}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-labelledby="app-color-label">
                    {SWATCHES.map((c) => {
                      const on = values.color.toLowerCase() === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={c}
                          title={c}
                          onClick={() => set("color", c)}
                          className={cn(
                            "grid size-7 place-items-center rounded-full text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-transform hover:scale-110 active:scale-95",
                            on && "ring-2 ring-ink ring-offset-2 ring-offset-raised",
                          )}
                          style={{ background: c }}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </button>
                      );
                    })}
                    <label
                      title={t.customColor}
                      className={cn(
                        "relative grid size-7 cursor-pointer place-items-center rounded-full text-white transition-transform hover:scale-110",
                        customColor && HEX.test(values.color) && "ring-2 ring-ink ring-offset-2 ring-offset-raised",
                      )}
                      style={{
                        background: customColor && HEX.test(values.color) ? values.color : "conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)",
                      }}
                    >
                      <Pipette className="size-3.5 drop-shadow-[0_1px_1px_rgb(0_0_0/0.4)]" />
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => set("color", e.target.value)}
                        aria-label={t.customColor}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                    <div className="ml-1 w-[92px]">
                      <Input
                        id="app-color"
                        value={values.color}
                        onChange={(e) => set("color", e.target.value.trim())}
                        aria-label={t.hex}
                        maxLength={7}
                        spellCheck={false}
                        className="!h-8 font-mono text-[13px]"
                        aria-invalid={!!errors.color}
                      />
                    </div>
                  </div>
                  {errors.color && (
                    <p className="text-[12px] text-danger" role="alert">
                      {errorText("color")}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Field label={t.logo} htmlFor="app-logo_url" hint={t.logoHint} error={errorText("logo_url")}>
              <Input
                id="app-logo_url"
                type="url"
                inputMode="url"
                value={values.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://lernpfad.bojes.org/logo.png"
                maxLength={500}
                aria-invalid={!!errors.logo_url}
              />
            </Field>
          </FormCard>

          <FormCard title={t.signIn}>
            <div className="space-y-1.5">
              <div id="app-type-label" className="text-[12.5px] font-medium text-ink-2">
                {t.type}
              </div>
              <div role="radiogroup" aria-labelledby="app-type-label" className="grid gap-2 sm:grid-cols-2">
                {[false, true].map((confidential) => {
                  const on = values.confidential === confidential;
                  const Icon = confidential ? Server : Globe;
                  return (
                    <button
                      key={String(confidential)}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set("confidential", confidential)}
                      className={cn(
                        "relative flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        on ? "border-transparent bg-blob-soft/40" : "border-line hover:border-line-2 hover:bg-hover/40",
                      )}
                    >
                      {on && (
                        <motion.span
                          layoutId="app-type-ring"
                          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-blob"
                          transition={{ type: "spring", stiffness: 520, damping: 38 }}
                        />
                      )}
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-blob text-white" : "bg-hover text-ink-2")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-ink">{confidential ? t.confidential : t.public}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{confidential ? t.confidentialSub : t.publicSub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <AnimatePresence initial={false}>
                {typeNote && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5 overflow-hidden text-[12px] text-blob-ink"
                  >
                    <Info className="size-3.5 shrink-0" /> {typeNote}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Field label={t.redirects} htmlFor="app-redirect_uris" hint={t.redirectsHint} error={errorText("redirect_uris")}>
              <Textarea
                id="app-redirect_uris"
                value={values.redirect_uris}
                onChange={(e) => set("redirect_uris", e.target.value)}
                placeholder="https://lernpfad.bojes.org/blob-callback.html"
                rows={3}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px] leading-relaxed"
                aria-invalid={!!errors.redirect_uris}
              />
            </Field>

            <Field label={t.origins} htmlFor="app-allowed_origins" hint={t.originsHint} error={errorText("allowed_origins")}>
              <Textarea
                id="app-allowed_origins"
                value={values.allowed_origins}
                onChange={(e) => set("allowed_origins", e.target.value)}
                placeholder="https://app.example.org"
                rows={2}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="min-h-16 font-mono text-[13px] leading-relaxed"
                aria-invalid={!!errors.allowed_origins}
              />
            </Field>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface px-3.5 py-3">
              <div className="min-w-0">
                <label htmlFor="app-trusted" className="block text-[13.5px] font-medium text-ink">
                  {t.trusted}
                </label>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{t.trustedHint}</p>
              </div>
              <Switch id="app-trusted" checked={values.trusted} onChange={(v) => set("trusted", v)} label={t.trusted} />
            </div>
          </FormCard>

          <FormCard title={t.access}>
            <div className="-mx-1 space-y-0.5">
              {SCOPE_NAMES.map((scope) => {
                const on = scope === "openid" || values.scopes.includes(scope);
                return (
                  <label key={scope} className={cn("relative flex items-start gap-3 rounded-lg px-1 py-1.5", scope !== "openid" && "cursor-pointer hover:bg-hover/50")}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={on}
                      disabled={scope === "openid"}
                      onChange={(e) =>
                        set("scopes", e.target.checked ? SCOPE_NAMES.filter((s) => s === scope || values.scopes.includes(s)) : values.scopes.filter((s) => s !== scope))
                      }
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blob",
                        on ? "border-blob bg-blob text-white" : "border-line-2 bg-raised",
                        scope === "openid" && "opacity-60",
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{t.scopes[scope].title}</span>
                      <span className="block text-[12px] leading-snug text-ink-3">{t.scopes[scope].body}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </FormCard>

          <FormError message={formError} />

          <div className="flex flex-wrap items-center justify-end gap-3">
            <SavedBadge show={!!saved && !dirty}>{t.saved}</SavedBadge>
            {!app && (
              <Link href="/admin" className="inline-flex h-10 items-center rounded-xl px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                {all.cancel}
              </Link>
            )}
            <Button type="submit" variant={app ? "primary" : "blob"} size={app ? "md" : "lg"} loading={pending} disabled={!!app && !dirty}>
              {app ? t.save : t.create}
            </Button>
          </div>
        </form>
        {after}
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:block">
        <ConsentPreview app={preview} scopes={values.scopes} trusted={values.trusted} placeholder={!named} />
      </aside>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-raised shadow-card">
      <h2 className="px-4 pt-4 text-[14px] font-semibold text-ink sm:px-5">{title}</h2>
      <div className="space-y-4 p-4 pt-3 sm:px-5 sm:pb-5">{children}</div>
    </section>
  );
}

/** A small copy of the consent screen, so you see what people will see. */
function ConsentPreview({
  app,
  scopes,
  trusted,
  placeholder,
}: {
  app: { name: string; logo_url: string | null; mark: string; color: string };
  scopes: string[];
  trusted: boolean;
  placeholder: boolean;
}) {
  const t = useMessages(adminText);
  const consent = useMessages(oauthText).consent;
  const shown = SCOPE_NAMES.filter((s) => s !== "openid" && scopes.includes(s));
  const list: ScopeName[] = shown.length ? shown : ["openid"];
  return (
    <div>
      <div className="mb-2 px-0.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t.form.preview}</div>
      <div className="rounded-2xl border border-line bg-raised p-4 shadow-card" aria-hidden>
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{consent.eyebrow}</div>
        <div className="relative mx-auto mt-1 flex h-[64px] max-w-[190px] items-center justify-between">
          <Blob size={60} mood="happy" interactive={false} track={false} />
          <span className="absolute inset-x-[58px] top-1/2 border-t-2 border-dotted border-line-2" />
          <span className={cn("relative transition-opacity", placeholder && "opacity-45")}>
            <AppMark app={app} size={40} />
            {trusted && (
              <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border-2 border-raised bg-blob text-white">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </span>
        </div>
        <div className={cn("transition-opacity", placeholder && "opacity-45")}>
          <div className="mt-1 text-center font-display text-[16px] font-bold leading-tight tracking-[-0.02em] text-balance">{t.form.previewTitle(app.name)}</div>
          <div className="mt-0.5 text-center text-[11.5px] text-ink-2">{t.form.previewSub(app.name)}</div>
        </div>
        <ul className="mt-3 space-y-1.5">
          {list.map((s) => {
            const Icon = SCOPE_ICONS[s];
            return (
              <li key={s} className="flex items-center gap-2 text-[12px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink">
                  <Icon className="size-3" />
                </span>
                <span className="truncate">{consent.scopes[s].title}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] font-medium">
          <span className="grid h-7 place-items-center rounded-lg border border-line">{consent.cancel}</span>
          <span className="grid h-7 place-items-center rounded-lg bg-blob text-white">{consent.allow}</span>
        </div>
      </div>
      {trusted && (
        <p className="mt-2.5 flex gap-1.5 px-0.5 text-[12px] leading-snug text-ink-3">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-blob-ink" /> {t.form.trustedHint}
        </p>
      )}
    </div>
  );
}
