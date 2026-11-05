"use client";

import { ChevronRight, PanelLeft } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { shellText } from "@/i18n/messages/shell";
import { OfflinePill } from "@/components/offline/OfflinePill";
import { cn } from "@/lib/utils";
import { useModKey } from "@/components/ui/ModKey";
import { useShell } from "./AppShell";

/** `title` is the full text for a tooltip when `label` is not plain text. */
export type Crumb = { label: ReactNode; href?: string; icon?: ReactNode; title?: string };

/** Thin bar at the top of every workspace page: sidebar toggle, breadcrumbs, actions. */
export function TopBar({ crumbs, actions, className, inPane = false }: { crumbs: Crumb[]; actions?: ReactNode; className?: string; inPane?: boolean }) {
  const { sidebarOpen, toggleSidebar } = useShell();
  const t = useMessages(shellText).topBar;
  const mod = useModKey();
  return (
    <header className={cn("flex h-11 shrink-0 items-center gap-1 px-3", className)}>
      <button
        onClick={toggleSidebar}
        data-drawer-opener="topbar"
        className={cn("grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink sm:max-lg:hidden [@media(hover:none)]:size-9", (sidebarOpen || inPane) && "lg:hidden")}
        aria-label={t.show}
        title={t.showTitle(mod)}
      >
        <PanelLeft className="size-4" />
      </button>
      {/* (A container: when the actions leave the crumbs less than 240 px, as on tablets beside the
          rail or a page's many buttons, a parent with an icon shows just the icon, its name staying
          for screen readers and as the tooltip, so the current page's own name keeps the room.) */}
      <nav className="@container flex min-w-0 flex-1 items-center gap-0.5 text-[13px]" aria-label={t.breadcrumb}>
        {crumbs.map((c, i) => {
          const title = c.title ?? (typeof c.label === "string" ? c.label : undefined);
          const parent = i < crumbs.length - 1;
          // Parents give way first (at most 40 % each), so the current page's own title keeps the room.
          const width = parent ? "max-w-[40%] shrink-0" : "min-w-0";
          const label = <span className={cn("truncate", parent && c.icon && "@max-[15rem]:sr-only")}>{c.label}</span>;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-3/70" />}
              {c.href ? (
                <Link href={c.href} title={title} className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-1 text-ink-2 hover:bg-hover hover:text-ink [@media(hover:none)]:py-2", width)}>
                  {c.icon}
                  {label}
                </Link>
              ) : (
                <span title={title} className={cn("flex items-center gap-1.5 px-1.5 py-1 text-ink", width)}>
                  {c.icon}
                  {label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <OfflinePill />
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
