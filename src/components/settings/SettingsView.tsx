"use client";

import { motion } from "motion/react";
import { Link2, Palette, Settings, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { TopBar } from "@/components/shell/TopBar";
import { useMessages } from "@/i18n/client";
import { settingsText } from "@/i18n/messages/settings";
import type { ConnectedApp } from "@/lib/oauth/connected";
import { cn } from "@/lib/utils";
import { AppearanceSection } from "./AppearanceSection";
import { BlobSection } from "./BlobSection";
import { ConnectedAppsSection } from "./ConnectedAppsSection";
import { DangerSection } from "./DangerSection";
import { ProfileSection } from "./ProfileSection";
import { SecuritySection } from "./SecuritySection";

type SectionId = keyof (typeof settingsText)["en"]["nav"];

// Labels come from the dictionary (`t.nav[id]`), so they follow the language.
const SECTIONS: { id: SectionId; icon: ReactNode }[] = [
  { id: "profile", icon: <UserRound /> },
  { id: "appearance", icon: <Palette /> },
  { id: "security", icon: <ShieldCheck /> },
  { id: "connected", icon: <Link2 /> },
  { id: "blob", icon: <BlobMark size={16} className="grayscale-[0.2]" /> },
  { id: "danger", icon: <TriangleAlert /> },
];

/** How far below the top of the scroller a section has to reach to count as "current". */
const SPY_OFFSET = 140;

export function SettingsView({ connectedApps }: { connectedApps: ConnectedApp[] }) {
  const t = useMessages(settingsText);
  const scroller = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  // While a nav click is smooth-scrolling, don't let the spy fight it.
  const steering = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    let scrolled = false;
    const spy = () => {
      raf = 0;
      const byUser = scrolled;
      scrolled = false;
      if (steering.current) return;
      const top = el.getBoundingClientRect().top;
      let current: string = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const node = document.getElementById(`settings-${s.id}`);
        if (node && node.getBoundingClientRect().top - top <= SPY_OFFSET) current = s.id;
      }
      // The last section can't reach the top, so scrolling all the way down selects it.
      // (Only for real scrolling: a form collapsing near the bottom shouldn't jump the nav.)
      if (byUser && el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        current = SECTIONS[SECTIONS.length - 1].id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(spy);
    };
    const onScroll = () => {
      scrolled = true;
      schedule();
    };
    // The smooth scroll finished, or the user grabbed the wheel: let the spy take over again.
    const release = () => {
      steering.current = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Forms opening and closing move the sections without scrolling.
    const resize = new ResizeObserver(schedule);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    el.addEventListener("scrollend", release);
    el.addEventListener("wheel", release, { passive: true });
    el.addEventListener("touchstart", release, { passive: true });

    // Deep links such as /settings#appearance.
    const hash = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) {
      document.getElementById(`settings-${hash}`)?.scrollIntoView({ block: "start" });
    }

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", release);
      el.removeEventListener("wheel", release);
      el.removeEventListener("touchstart", release);
    };
  }, []);

  // Keep the current chip in view in the phone nav.
  useEffect(() => {
    const row = chips.current;
    const chip = row?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!row || !chip || row.offsetParent === null) return;
    row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  function go(id: string) {
    const node = document.getElementById(`settings-${id}`);
    if (!node) return;
    setActive(id);
    steering.current = true;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    // Fallback for browsers without `scrollend`.
    setTimeout(() => (steering.current = false), 900);
  }

  return (
    <>
      <TopBar crumbs={[{ label: t.title, icon: <Settings className="size-3.5 text-ink-3" /> }]} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pt-10">
          <motion.header
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 md:mb-8 md:pl-[232px]"
          >
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em]">{t.title}</h1>
            <p className="mt-1 text-[13.5px] text-ink-2">{t.intro}</p>
          </motion.header>

          {/* Phones and small tablets: the sections as a sticky, swipeable row of chips. */}
          <nav
            ref={chips}
            aria-label={t.navLabel}
            className="sticky top-0 z-10 -mx-4 mb-4 flex gap-1.5 overflow-x-auto bg-surface/95 px-4 py-2 backdrop-blur-sm [scrollbar-width:none] sm:-mx-8 sm:px-8 md:hidden [&::-webkit-scrollbar]:hidden"
          >
            {SECTIONS.map((s) => {
              const current = active === s.id;
              return (
                <button
                  key={s.id}
                  data-section={s.id}
                  onClick={() => go(s.id)}
                  aria-current={current ? "location" : undefined}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
                    current ? "border-ink bg-ink font-medium text-paper" : s.id === "danger" ? "border-line bg-raised text-danger" : "border-line bg-raised text-ink-2",
                  )}
                >
                  {s.icon}
                  {t.nav[s.id]}
                </button>
              );
            })}
          </nav>

          <div className="flex gap-8">
            <nav aria-label={t.navLabel} className="sticky top-6 hidden w-[200px] shrink-0 self-start pt-0.5 md:block">
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => {
                  const current = active === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => go(s.id)}
                        aria-current={current ? "location" : undefined}
                        className={cn(
                          "relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                          current ? "font-medium text-ink" : "text-ink-2 hover:bg-hover/60 hover:text-ink",
                          s.id === "danger" && (current ? "text-danger" : "text-ink-2 hover:text-danger"),
                        )}
                      >
                        {current && (
                          <motion.span
                            layoutId="settings-nav-pill"
                            className="absolute inset-0 rounded-lg bg-hover"
                            transition={{ type: "spring", stiffness: 520, damping: 40 }}
                          >
                            <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-full", s.id === "danger" ? "bg-danger" : "bg-blob")} />
                          </motion.span>
                        )}
                        <span className={cn("relative", current ? (s.id === "danger" ? "text-danger" : "text-ink") : "text-ink-3")}>{s.icon}</span>
                        <span className="relative truncate">{t.nav[s.id]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="min-w-0 max-w-[760px] flex-1 space-y-10">
              <ProfileSection />
              <AppearanceSection />
              <SecuritySection />
              <ConnectedAppsSection apps={connectedApps} />
              <BlobSection />
              <DangerSection />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
