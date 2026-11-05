"use client";

import { motion } from "motion/react";
import { CalendarDays, House, ListChecks, Menu, NotebookPen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKeyboard } from "@/components/ui/useKeyboard";
import { useMessages } from "@/i18n/client";
import { shellText } from "@/i18n/messages/shell";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: LucideIcon; active: (path: string) => boolean };

/**
 * The icon gives a little under the finger (CSS on the tab's own press: a gesture on the icon would
 * make it a stop of its own for the keyboard, a nameless one, and the drawer would hand the
 * keyboard back to it).
 */
const PRESS = "inline-block transition-transform duration-150 ease-out group-active:scale-[0.86] motion-reduce:transition-none motion-reduce:group-active:scale-100";

/**
 * Phones: the places you go most, at the bottom where a thumb reaches them, like a phone app.
 * "More" opens the full sidebar (subjects, pages, settings) as a drawer (`moreOpen`: it is open).
 * Hidden while the keyboard is open. (Tablets have the rail instead: NavRail.tsx.)
 */
export function PhoneTabs({ onMore, moreOpen = false }: { onMore: () => void; moreOpen?: boolean }) {
  const t = useMessages(shellText).sidebar;
  const path = usePathname();
  const keyboard = useKeyboard();
  const tabs: Tab[] = [
    { href: "/home", label: t.home, icon: House, active: (p) => p === "/home" },
    { href: "/notes", label: t.notesHome, icon: NotebookPen, active: (p) => p === "/notes" || p.startsWith("/notes/") || p.startsWith("/p/") },
    { href: "/calendar", label: t.calendar, icon: CalendarDays, active: (p) => p.startsWith("/calendar") },
    { href: "/tasks", label: t.tasks, icon: ListChecks, active: (p) => p.startsWith("/tasks") },
  ];
  if (keyboard.open) return null;
  return (
    <nav
      className="relative z-30 shrink-0 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      aria-label={t.navigation}
    >
      <div className="grid h-14 grid-cols-5">
        {tabs.map((tab) => {
          const on = tab.active(path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blob",
                // (Not on: the mid-tone, lighter than ink-2 and still 4.5:1 for the small labels.)
                on ? "text-blob-ink" : "text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] active:text-ink-2",
              )}
            >
              {on && (
                <motion.span
                  layoutId="phone-tab"
                  className="absolute top-1.5 h-8 w-14 rounded-full bg-blob-soft"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span className={cn("relative", PRESS)}>
                <Icon className="size-[22px]" strokeWidth={on ? 2.3 : 1.9} />
              </span>
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? "app-drawer" : undefined}
          data-drawer-opener="tabs"
          className="group flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blob active:text-ink-2"
        >
          <span className={PRESS}>
            <Menu className="size-[22px]" strokeWidth={1.9} />
          </span>
          {t.more}
        </button>
      </div>
    </nav>
  );
}
