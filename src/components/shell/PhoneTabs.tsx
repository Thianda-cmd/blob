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
 * Phones: the places you go most, at the bottom where a thumb reaches them, like a phone app.
 * "More" opens the full sidebar (subjects, pages, settings). Hidden while the keyboard is open.
 */
export function PhoneTabs({ onMore }: { onMore: () => void }) {
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
              className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors", on ? "text-blob-ink" : "text-ink-3 active:text-ink-2")}
            >
              {on && (
                <motion.span
                  layoutId="phone-tab"
                  className="absolute top-1.5 h-8 w-14 rounded-full bg-blob-soft"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <motion.span className="relative" whileTap={{ scale: 0.86 }}>
                <Icon className="size-[22px]" strokeWidth={on ? 2.3 : 1.9} />
              </motion.span>
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className="flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-ink-3 active:text-ink-2">
          <motion.span whileTap={{ scale: 0.86 }}>
            <Menu className="size-[22px]" strokeWidth={1.9} />
          </motion.span>
          {t.more}
        </button>
      </div>
    </nav>
  );
}
