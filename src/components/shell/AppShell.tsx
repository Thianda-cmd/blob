"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BlobHelper } from "@/components/blob/BlobHelper";
import { watchTheme } from "@/components/theme";
import { useModalFocus } from "@/components/ui/Dialog";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { shellText } from "@/i18n/messages/shell";
import { useOfflineDevice } from "@/lib/offline/useOfflineDevice";
import { useStartSync } from "@/lib/offline/useSync";
import { useNotifications } from "@/lib/notify/useNotifications";
import { FileDrop } from "@/components/notes/FileDrop";
import { DeniedDrafts } from "@/components/sheet/DeniedDrafts";
import { useOpenedFiles } from "@/components/notes/useOpenedFiles";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { NavRail } from "./NavRail";
import { PanesLayout, PanesProvider } from "./Panes";
import { PhoneTabs } from "./PhoneTabs";
import { Sidebar } from "./Sidebar";

type Shell = { sidebarOpen: boolean; toggleSidebar: () => void; openSearch: () => void };
const ShellCtx = createContext<Shell>({ sidebarOpen: true, toggleSidebar: () => {}, openSearch: () => {} });
export const useShell = () => useContext(ShellCtx);

export function AppShell({ children, isAdmin = false }: { children: ReactNode; isAdmin?: boolean }) {
  const pathname = usePathname();
  const { profile } = useWorkspace();
  const t = useMessages(shellText).sidebar;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Events, tasks and notes on this device, kept in step with the server (src/lib/offline).
  useStartSync();
  useOfflineDevice();
  // Reminders on this device (the apps only).
  useNotifications();
  // Blob files opened with the app come in as pages (the apps only).
  useOpenedFiles();

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

  // The drawer (phones, tablets) is a modal: the keyboard goes into it and stays there, comes back
  // to what opened it ("Mehr", the rail's Blob) when it closes, and Escape closes it (a menu open in
  // it closes first: its Escape stops there).
  const drawer = useRef<HTMLDivElement>(null);
  const drawerFocus = useModalFocus(mobileNav, drawer);
  useEffect(() => {
    if (!mobileNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) setMobileNav(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNav]);

  // What opened the drawer ("Mehr", the rail's Blob, the top bar's button): a search started in the
  // drawer gives the keyboard back to it when the search closes, since the drawer and its "Suchen…"
  // are gone by then. (A tap on an iPhone focuses nothing: then the opener that is on screen.)
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const searchInDrawerRef = useRef(false);
  const noteDrawerOpener = useCallback(() => {
    const at = document.activeElement;
    if (at instanceof HTMLElement && at !== document.body && !drawer.current?.contains(at)) drawerOpenerRef.current = at;
    else if (!drawer.current?.contains(at)) drawerOpenerRef.current = null;
  }, []);
  const openDrawer = useCallback(() => {
    noteDrawerOpener();
    setMobileNav(true);
  }, [noteDrawerOpener]);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      noteDrawerOpener();
      setMobileNav((v) => !v);
      return;
    }
    setSidebarOpen((open) => {
      try {
        localStorage.setItem("blob-sidebar", open ? "closed" : "open");
      } catch {}
      return !open;
    });
  }, [noteDrawerOpener]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInDrawerRef.current = false;
        setSearchOpen((o) => !o);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const openSearch = useCallback(() => {
    searchInDrawerRef.current = false;
    setSearchOpen(true);
  }, []);
  const shell = useMemo(() => ({ sidebarOpen, toggleSidebar, openSearch }), [sidebarOpen, toggleSidebar, openSearch]);
  // Search from the drawer: the drawer makes way for the palette.
  const searchFromDrawer = useCallback(() => {
    searchInDrawerRef.current = true;
    setMobileNav(false);
    setSearchOpen(true);
  }, []);
  // (The opener itself, else one of its kind ("Mehr" comes back as a new button after the
  // on-screen keyboard), else any on screen: on a phone while the keyboard is still up, the top
  // bar's, since the tabs hide then.)
  const backToDrawerOpener = useCallback(() => {
    if (!searchInDrawerRef.current) return;
    const shown = (el: HTMLElement | null | undefined): el is HTMLElement => !!el && el.isConnected && el.getClientRects().length > 0;
    const openers = [...document.querySelectorAll<HTMLElement>("[data-drawer-opener]")];
    const was = drawerOpenerRef.current;
    const kind = was?.dataset.drawerOpener;
    const el = shown(was) ? was : (openers.find((o) => shown(o) && o.dataset.drawerOpener === kind) ?? openers.find(shown));
    el?.focus({ preventScroll: true });
  }, []);

  return (
    <ShellCtx.Provider value={shell}>
      <PanesProvider>
      {/* safe-*: room for the iPhone's status bar, rounded corners and home indicator (zero elsewhere). */}
      <div className="safe-top safe-x flex h-dvh overflow-hidden bg-paper">
        {/* (A plain box: the sidebar inside is the labelled navigation landmark.) */}
        <motion.div
          initial={false}
          animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          className="note-focus-fade hidden shrink-0 overflow-hidden lg:block"
        >
          <div className="h-full w-[256px]">
            <Sidebar onCollapse={toggleSidebar} onSearch={openSearch} isAdmin={isAdmin} />
          </div>
        </motion.div>

        {/* Tablets and narrow windows: the rail (the sidebar opens from it as a drawer). */}
        <NavRail onMenu={openDrawer} menuOpen={mobileNav} onSearch={openSearch} />

        <AnimatePresence>
          {mobileNav && (
            <>
              <motion.div
                aria-hidden
                className="fixed inset-0 z-40 bg-[rgb(20_18_14/0.3)] lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileNav(false)}
              />
              <motion.div
                ref={drawer}
                id="app-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t.menu}
                tabIndex={-1}
                onFocus={drawerFocus.onFocus}
                onKeyDown={drawerFocus.onKeyDown}
                // A link followed in it closes it, also where the path stays the same (Notizen and
                // Blobxcel are /notes with another ?kind=, or the page you're on). A click with a key
                // held opens a new tab: the drawer stays.
                onClick={(e) => {
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (e.target as HTMLElement).closest("a[href]")) setMobileNav(false);
                }}
                className="safe-top safe-bottom fixed inset-y-0 left-0 z-50 w-[272px] max-w-[calc(100vw-48px)] bg-paper pl-[env(safe-area-inset-left)] shadow-pop outline-none lg:hidden"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <Sidebar onCollapse={() => setMobileNav(false)} onSearch={searchFromDrawer} isAdmin={isAdmin} drawer />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col sm:pb-[env(safe-area-inset-bottom)]">
          <main
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:border-line lg:shadow-card",
              // With the sidebar hidden the card keeps the same gap on its left as on its right.
              !sidebarOpen && "lg:ml-2",
            )}
          >
            <PanesLayout>{children}</PanesLayout>
          </main>
          <PhoneTabs onMore={openDrawer} moreOpen={mobileNav} />
        </div>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} returnFocus={backToDrawerOpener} />
      <BlobHelper />
      <DeniedDrafts />
      <FileDrop />
      </PanesProvider>
    </ShellCtx.Provider>
  );
}
