"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { settingsText } from "@/i18n/messages/settings";
import { cn } from "@/lib/utils";

/** A titled group of cards. The id doubles as the scroll-spy anchor. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Below md the sticky chip row covers the top of the scroller, so stop a bit lower there.
    <section id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} className="scroll-mt-16 md:scroll-mt-6">
      <div className="mb-3 px-0.5">
        <h2 id={`settings-${id}-title`} className="font-display text-[17px] font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Card({
  children,
  footer,
  tone,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  tone?: "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-raised shadow-card",
        tone === "danger" ? "border-danger/30" : "border-line",
        className,
      )}
    >
      {children}
      {footer && (
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-2.5">{footer}</div>
      )}
    </div>
  );
}

/** Label + description on the left, a control on the right. Stacks on small screens. */
export function Row({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        {description && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/** Height-animated container for inline forms that open inside a card. */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 38, opacity: { duration: 0.16 } }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small "Saved" confirmation that pops in and fades. */
export function SavedBadge({ show, children }: { show: boolean; children?: ReactNode }) {
  const t = useMessages(settingsText);
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 600, damping: 24 }}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ok"
          role="status"
        >
          <Check className="size-3.5" strokeWidth={2.5} />
          {children ?? t.saved}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Accessible on/off switch with a jelly knob. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 disabled:opacity-50",
        // A 32 px tall hit area around the small switch.
        "after:absolute after:-inset-x-1 after:-inset-y-[5px] after:content-['']",
        checked ? "bg-blob" : "bg-line-2",
      )}
    >
      <motion.span
        layout
        initial={false}
        transition={{ type: "spring", stiffness: 700, damping: 28 }}
        whileTap={{ scaleX: 1.25 }}
        className={cn("block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]", checked && "ml-auto")}
      />
    </button>
  );
}
