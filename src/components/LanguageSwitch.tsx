"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { useLocale } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Deutsch | English. Saves the choice (cookie + account) and re-renders the page in the
 * new language without a reload. `compact` shows DE | EN for headers and footers.
 */
export function LanguageSwitch({ compact, className }: { compact?: boolean; className?: string }) {
  const id = useId();
  const router = useRouter();
  const current = useLocale();
  const [shown, setShown] = useOptimistic(current);
  const [pending, start] = useTransition();

  function pick(locale: Locale) {
    if (locale === shown) return;
    start(async () => {
      setShown(locale);
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Sprache / Language"
      className={cn("inline-flex rounded-lg border border-line bg-surface p-0.5", pending && "opacity-80", className)}
    >
      {LOCALES.map((locale) => {
        const on = shown === locale;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={on}
            lang={locale}
            onClick={() => pick(locale)}
            className={cn(
              "relative rounded-md font-medium transition-colors",
              compact ? "px-2 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
              on ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-md bg-raised shadow-card"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{compact ? LOCALE_NAMES[locale].short : LOCALE_NAMES[locale].name}</span>
          </button>
        );
      })}
    </div>
  );
}
