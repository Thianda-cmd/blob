"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and non-secure contexts: the textarea trick.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Copies `value`; the icon turns into a tick for a moment. `withText` shows the label next to it. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  withText,
  className,
  onCopied,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  withText?: boolean;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    if (await writeClipboard(value)) {
      setCopied(true);
      onCopied?.();
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={withText ? undefined : label}
      title={withText ? undefined : label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink active:scale-95",
        withText ? "h-7 border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink-2 shadow-card" : "size-7",
        copied && "text-ok hover:text-ok",
        className,
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {copied ? (
            <motion.span key="done" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }}>
              <Check className="size-3.5" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }}>
              <Copy className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {withText && <span>{copied ? copiedLabel : label}</span>}
      <span className="sr-only" role="status">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}

/** A value in monospace with a copy button, e.g. a client id or an endpoint. */
export function CopyField({ value, label, copiedLabel, className }: { value: string; label: string; copiedLabel: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1 rounded-lg border border-line bg-surface py-0.5 pl-2.5 pr-0.5", className)}>
      <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink" title={value}>
        {value}
      </code>
      <CopyButton value={value} label={label} copiedLabel={copiedLabel} />
    </div>
  );
}
