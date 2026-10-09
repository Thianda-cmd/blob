"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BlobHelper } from "@/components/blob/BlobHelper";
import { watchTheme } from "@/components/theme";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";

type Shell = { sidebarOpen: boolean; toggleSidebar: () => void; openSearch: () => void };
const ShellCtx = createContext<Shell>({ sidebarOpen: true, toggleSidebar: () => {}, openSearch: () => {} });
export const useShell = () => useContext(ShellCtx);

export function AppShell({ children, isAdmin = false }: { children: ReactNode; isAdmin?: boolean }) {
  const pathname = usePathname();
  const { profile } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // The profile is the source of truth for the theme across devices.
  useEffect(() => watchTheme(profile.theme), [profile.theme]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore preference after mount
      if (localStorage.getItem("blob-sidebar") === "closed") setSidebarOpen(false);
    } catch {}
  }, []);

  // Close the mobile drawer whenever we navigate.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on route change
    setMobileNav(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileNav((v) => !v);
      return;
    }
    setSidebarOpen((open) => {
      try {
        localStorage.setItem("blob-sidebar", open ? "closed" : "open");
      } catch {}
      return !open;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const shell = useMemo(() => ({ sidebarOpen, toggleSidebar, openSearch: () => setSearchOpen(true) }), [sidebarOpen, toggleSidebar]);

  return (
    <ShellCtx.Provider value={shell}>
      <div className="flex h-dvh overflow-hidden bg-paper">
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          className="hidden shrink-0 overflow-hidden lg:block"
        >
          <div className="h-full w-[256px]">
            <Sidebar onCollapse={toggleSidebar} onSearch={() => setSearchOpen(true)} isAdmin={isAdmin} />
          </div>
        </motion.aside>

        <AnimatePresence>
          {mobileNav && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-[rgb(20_18_14/0.3)] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNav(false)}
              />
              <motion.aside
                className="fixed inset-y-0 left-0 z-50 w-[272px] bg-paper shadow-pop lg:hidden"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <Sidebar onCollapse={() => setMobileNav(false)} onSearch={() => setSearchOpen(true)} isAdmin={isAdmin} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-line lg:shadow-card",
            // With the sidebar hidden the card keeps the same gap on its left as on its right.
            !sidebarOpen && "lg:ml-2",
          )}
        >
          {children}
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <BlobHelper />
    </ShellCtx.Provider>
  );
}
