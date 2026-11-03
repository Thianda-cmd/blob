"use client";

// Small controls of the table panel and the column menu, in the same look as the chart panel:
// labelled fields, switches, text that is saved when you leave the field, compact selects and
// the buttons at the bottom of the panel. Touch targets grow on touch screens.

import { motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/** A labelled part of the panel. */
export function Group({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 border-b border-line px-4 py-4", className)} aria-label={title}>
      <div className="flex min-h-6 items-center gap-2">
        {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
        <h3 className="flex-1 text-[12px] font-semibold uppercase tracking-wide text-ink-2">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A label above a control. */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[12px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] leading-snug text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

/** An on/off switch with its label; the whole row is the button. */
export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-9 w-full items-center gap-3 rounded-lg text-left text-[13px] text-ink-2 disabled:opacity-50 [@media(hover:none)]:min-h-11"
    >
      <span className="min-w-0 flex-1">
        <span className="block leading-snug text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{hint}</span>}
      </span>
      <span className={cn("relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200", checked ? "bg-blob" : "bg-line-2")}>
        <motion.span layout initial={false} transition={{ type: "spring", stiffness: 700, damping: 30 }} className={cn("block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]", checked && "ml-auto")} />
      </span>
    </button>
  );
}

// 16 px text on touch screens: an iPhone zooms into any field with smaller text when it gets the keyboard.
export const fieldClass = cn(inputClass, "h-9 text-[13px] [@media(hover:none)]:h-10 [@media(hover:none)]:text-[16px]");

/**
 * Text saved when you leave the field or press Enter; Escape goes back. `check` says what is
 * wrong with a draft (shown under the field; nothing is saved while it says something).
 */
export function TextField({
  id,
  value,
  onCommit,
  check,
  label,
  placeholder,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onCommit: (v: string) => void;
  check?: (v: string) => string | null;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const problem = draft !== null && check ? check(draft) : null;
  return (
    <div className="space-y-1">
      <input
        id={id}
        aria-label={label}
        aria-invalid={!!problem || undefined}
        value={draft ?? value}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        className={cn(fieldClass, className)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== value && !(check && check(draft))) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape" && draft !== null) {
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
      {problem && (
        <p className="text-[12px] leading-snug text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

/** A native select in the panel's look (on a tablet it opens the system's picker). */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  className,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(fieldClass, "cursor-pointer appearance-none pr-8 disabled:cursor-default")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 6.5 8 10l3.5-3.5" />
      </svg>
    </span>
  );
}

/**
 * A full-width action button of the panel. Its words are its name (also for screen readers and
 * voice control); `hint` says more, as a tooltip and as its description, and `describedBy` points
 * at a hint shown next to it instead.
 */
export function ActionButton({
  onClick,
  icon,
  children,
  tone = "plain",
  disabled,
  hint,
  describedBy,
  className,
  autoFocus,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  tone?: "plain" | "primary" | "danger";
  disabled?: boolean;
  hint?: string;
  describedBy?: string;
  className?: string;
  /** Takes the keyboard when it appears (the safe choice of a question that replaces a button). */
  autoFocus?: boolean;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      title={hint}
      aria-describedby={describedBy ?? (hint ? hintId : undefined)}
      className={cn(
        "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-50 [@media(hover:none)]:h-11 [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "primary" && "border-transparent bg-blob text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.1)] hover:bg-blob-deep",
        tone === "plain" && "border-line bg-raised text-ink-2 shadow-card hover:border-line-2 hover:text-ink",
        tone === "danger" && "border-transparent text-danger hover:bg-danger/10",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {hint && (
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
    </button>
  );
}

/** A short note (hints, what just happened). */
export function Note({ icon, children, tone = "plain" }: { icon?: ReactNode; children: ReactNode; tone?: "plain" | "accent" | "warn" }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg px-3 py-2 text-[12px] leading-snug",
        tone === "accent" ? "bg-blob-soft text-ink" : tone === "warn" ? "bg-danger/8 text-danger" : "bg-hover/70 text-ink-2",
      )}
    >
      {icon && <span className="mt-px shrink-0 [&_svg]:size-3.5">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
