"use client";

import { AnimatePresence, motion } from "motion/react";
import { Columns2 } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { blob } from "@/components/blob/bus";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { useIsMac, useMediaQuery } from "@/components/ui/useMediaQuery";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { panesText } from "@/i18n/messages/panes";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member, Page, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { pageIdOfPath, recentPages } from "./recent";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { PageIcon } from "./Sidebar";

// Two notes side by side, and moving between notes from the keyboard:
// - Ctrl/Cmd+Shift+L (or Ctrl+Tab in the desktop apps) switches to the last page. Held down, a list
//   of recent pages shows; each press goes one further back, letting go opens it. With two notes
//   side by side, a quick press jumps between them.
// - Ctrl/Cmd+Shift+D opens the last note beside the one you're in (and closes it again).
// - Ctrl/Cmd+/ lists every shortcut.

type Panes = {
  /** The note shown beside the page (wide screens), or null. */
  side: string | null;
  openBeside: (id: string) => void;
  closeBeside: () => void;
  /** The side note becomes the main page and the other way round. */
  swap: () => void;
  showShortcuts: () => void;
};

// The editor loads with the first note opened beside (most pages never need it).
const NoteEditor = dynamic(() => import("@/components/editor/NoteEditor").then((m) => m.NoteEditor), { ssr: false });

const PanesCtx = createContext<Panes>({ side: null, openBeside: () => {}, closeBeside: () => {}, swap: () => {}, showShortcuts: () => {} });
export const usePanes = () => useContext(PanesCtx);

const SIDE_KEY = "blob-side-page";
const RATIO_KEY = "blob-side-ratio";
const WIDE = "(min-width: 1024px)";

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

/** The editors' text areas in the main view and beside it (for jumping between them). */
function paneEditor(pane: "main" | "side") {
  return document.querySelector<HTMLElement>(`[data-pane="${pane}"] .ProseMirror`);
}

export function PanesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pages } = useWorkspace();
  const t = useMessages(panesText);
  const mac = useIsMac();
  const wide = useMediaQuery(WIDE, true);
  const [side, setSide] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const current = pageIdOfPath(pathname);

  // Remember what was beside, across reloads.
  useEffect(() => {
    const stored = readStored(SIDE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore after mount
    if (stored) setSide(stored);
  }, []);
  useEffect(() => writeStored(SIDE_KEY, side), [side]);

  // Every page you open counts as recent.
  useEffect(() => {
    if (current) recentPages.visit(current);
  }, [current]);

  // The same note in both places, or a note that is gone: nothing beside any more.
  const sideMeta = side ? pages.find((p) => p.id === side) : undefined;
  const sideGone = !!side && pages.length > 0 && (!sideMeta || !!sideMeta.trashed_at);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the side note can't stay
    if (side && (side === current || sideGone)) setSide(null);
  }, [side, current, sideGone]);

  const openBeside = useCallback(
    (id: string) => {
      if (!window.matchMedia(WIDE).matches) {
        blob.say(t.split.narrow, { mood: "thinking" });
        router.push(`/p/${id}`);
        return;
      }
      if (id === current) return;
      recentPages.visit(id);
      setSide(id);
    },
    [current, router, t.split.narrow],
  );
  const closeBeside = useCallback(() => setSide(null), []);
  const swap = useCallback(() => {
    if (!side) return;
    setSide(current);
    router.push(`/p/${side}`);
  }, [side, current, router]);

  /** The pages you opened that still exist, newest first; then notes edited lately, so the list is never short. */
  const recent = useCallback((): PageMeta[] => {
    const live = pages.filter((p) => !p.trashed_at && p.kind !== "cv");
    const known = new Map(live.map((p) => [p.id, p]));
    const opened = recentPages
      .list()
      .map((id) => known.get(id))
      .filter((p): p is PageMeta => !!p);
    const edited = live
      .filter((p) => p.kind === "note" && !opened.includes(p))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return [...opened, ...edited].slice(0, Math.max(9, opened.length));
  }, [pages]);

  const toggleBeside = useCallback(() => {
    if (side) return setSide(null);
    const other = recent().find((p) => p.id !== current && p.kind === "note");
    if (!other) return blob.say(t.split.noOther, { mood: "thinking", ms: 6000 });
    openBeside(other.id);
    blob.say(t.split.opened(mac ? "⌘⇧L" : "Ctrl+Shift+L"), { mood: "happy" });
  }, [side, recent, current, openBeside, t.split, mac]);

  // The switcher ----------------------------------------------------------------------------
  /** `held`: the key that keeps the list open (letting go of it opens the pick). */
  const [switcher, setSwitcher] = useState<{ list: PageMeta[]; index: number; visible: boolean; sticky: boolean; held: "Meta" | "Control" } | null>(null);
  const switcherRef = useRef(switcher);
  useEffect(() => {
    switcherRef.current = switcher;
  });

  const openFromSwitcher = useCallback(
    (p: PageMeta | undefined, beside = false) => {
      setSwitcher(null);
      if (!p) return;
      if (beside) openBeside(p.id);
      else if (p.id === side) swap();
      else router.push(`/p/${p.id}`);
    },
    [openBeside, router, side, swap],
  );

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    const isMod = (e: KeyboardEvent) => (mac ? e.metaKey : e.ctrlKey);
    const onKeyDown = (e: KeyboardEvent) => {
      const s = switcherRef.current;
      const switchKey = (isMod(e) && e.shiftKey && !e.altKey && e.code === "KeyL") || (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab");
      if (switchKey) {
        e.preventDefault();
        const back = e.key === "Tab" && e.shiftKey;
        if (s) {
          setSwitcher({ ...s, visible: true, index: (s.index + (back ? -1 : 1) + s.list.length) % Math.max(1, s.list.length) });
          return;
        }
        const list = recent();
        // The open page first: one press goes to the page before it.
        const here = list.findIndex((p) => p.id === current);
        if (here > 0) list.unshift(...list.splice(here, 1));
        // Ctrl+Tab is held by Ctrl, also on a Mac; Cmd+Shift+L by Cmd.
        setSwitcher({ list, index: list.length > 1 ? 1 : 0, visible: false, sticky: false, held: e.key === "Tab" || !mac ? "Control" : "Meta" });
        clearTimeout(showTimer);
        showTimer = setTimeout(() => setSwitcher((x) => (x ? { ...x, visible: true } : x)), 220);
        return;
      }
      if (s) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSwitcher(null);
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const dir = e.key === "ArrowDown" ? 1 : -1;
          setSwitcher({ ...s, visible: true, sticky: true, index: (s.index + dir + s.list.length) % Math.max(1, s.list.length) });
        } else if (e.key === "Enter") {
          e.preventDefault();
          openFromSwitcher(s.list[s.index], e.shiftKey);
        } else if (e.code === "KeyD" && s.visible) {
          e.preventDefault();
          openFromSwitcher(s.list[s.index], true);
        }
        return;
      }
      if (isMod(e) && e.shiftKey && !e.altKey && e.code === "KeyD") {
        e.preventDefault();
        toggleBeside();
      } else if (isMod(e) && !e.shiftKey && !e.altKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setShortcuts((o) => !o);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const s = switcherRef.current;
      if (!s || s.sticky) return;
      // Letting go of Ctrl/Cmd opens what is picked.
      if (e.key !== s.held) return;
      clearTimeout(showTimer);
      const target = s.list[s.index];
      // Two notes side by side and a quick press: jump between them.
      if (!s.visible && side) {
        const inSide = document.activeElement?.closest('[data-pane="side"]');
        const other = paneEditor(inSide ? "main" : "side");
        if (other) {
          setSwitcher(null);
          other.focus();
          return;
        }
      }
      if (!target || target.id === current) return setSwitcher(null);
      openFromSwitcher(target);
    };
    const onBlur = () => {
      clearTimeout(showTimer);
      if (switcherRef.current && !switcherRef.current.sticky) setSwitcher(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      clearTimeout(showTimer);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [mac, recent, current, side, openFromSwitcher, toggleBeside]);

  const value = useMemo<Panes>(
    () => ({ side: wide ? side : null, openBeside, closeBeside, swap, showShortcuts: () => setShortcuts(true) }),
    [wide, side, openBeside, closeBeside, swap],
  );

  return (
    <PanesCtx.Provider value={value}>
      {children}
      <Switcher state={switcher} current={current} side={side} onPick={openFromSwitcher} onClose={() => setSwitcher(null)} />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
    </PanesCtx.Provider>
  );
}

/** The main page, and the note beside it on wide screens (with a handle to share the width). */
export function PanesLayout({ children }: { children: ReactNode }) {
  const { side } = usePanes();
  const t = useMessages(panesText).split;
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(0.5);
  useEffect(() => {
    const stored = Number(readStored(RATIO_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore after mount
    if (stored >= 0.25 && stored <= 0.75) setRatio(stored);
  }, []);

  const drag = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => setRatio(Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      setRatio((r) => {
        writeStored(RATIO_KEY, String(r));
        return r;
      });
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={box} className="flex min-h-0 min-w-0 flex-1">
      <div data-pane="main" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden" style={{ flex: side ? `${ratio} 1 0` : "1 1 0" }}>
        {children}
      </div>
      {side && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t.resize}
            title={t.resize}
            onPointerDown={drag}
            onDoubleClick={() => {
              setRatio(0.5);
              writeStored(RATIO_KEY, "0.5");
            }}
            className="group relative w-px shrink-0 cursor-col-resize bg-line"
          >
            <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
            <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-2 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div data-pane="side" className="relative flex min-h-0 min-w-0 flex-col overflow-hidden" style={{ flex: `${1 - ratio} 1 0` }}>
            <SidePane key={side} id={side} />
          </div>
        </>
      )}
    </div>
  );
}

type Loaded = { page: Page; role: AccessRole; members: Member[] } | "missing" | null;

/** The note beside the page: loaded here (the route only loads the main page). */
function SidePane({ id }: { id: string }) {
  const t = useMessages(panesText).split;
  const router = useRouter();
  const { closeBeside, swap } = usePanes();
  const [loaded, setLoaded] = useState<Loaded>(null);

  const load = useCallback(async () => {
    const db = createClient();
    const [row, role, members] = await Promise.all([
      db.from("pages").select("*").eq("id", id).maybeSingle(),
      db.rpc("page_role", { p_page: id }),
      db.rpc("member_profiles", { p_type: "page", p_target: id }),
    ]);
    const page = row.data as Page | null;
    if (!page || page.trashed_at) return setLoaded("missing");
    const list = ((members.data ?? []) as Member[]).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
    setLoaded({ page, role: (role.data as AccessRole | null) ?? "owner", members: list });
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the note, then shows it
    void load();
  }, [load]);

  if (loaded === null)
    return (
      <div className="grid flex-1 place-items-center">
        <GooSpinner size={48} label={t.loading} />
      </div>
    );
  if (loaded === "missing" || loaded.page.kind !== "note")
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div className="max-w-[300px] space-y-3">
          <p className="text-[13.5px] text-ink-2">{loaded === "missing" ? t.notFound : t.notNote}</p>
          <div className="flex justify-center gap-2">
            {loaded !== "missing" && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  closeBeside();
                  router.push(`/p/${id}`);
                }}
              >
                {t.openMain}
              </Button>
            )}
            <Button size="sm" onClick={closeBeside}>
              {t.close}
            </Button>
          </div>
        </div>
      </div>
    );
  return <NoteEditor key={loaded.page.id} page={loaded.page} role={loaded.role} members={loaded.members} pane={{ onClose: closeBeside, onSwap: swap, onRefresh: () => void load() }} />;
}

/** The list of recent pages while the switch keys are held. */
function Switcher({
  state,
  current,
  side,
  onPick,
  onClose,
}: {
  state: { list: PageMeta[]; index: number; visible: boolean } | null;
  current: string | null;
  side: string | null;
  onPick: (p: PageMeta | undefined, beside?: boolean) => void;
  onClose: () => void;
}) {
  const t = useMessages(panesText).switcher;
  const locale = useLocale();
  const mac = useIsMac();
  const { subjects } = useWorkspace();
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {state?.visible && (
        <div className="fixed inset-0 z-[90] grid place-items-start justify-center px-4 pt-[14vh]" onMouseDown={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-raised shadow-pop"
            role="listbox"
            aria-label={t.label}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-line px-4 py-2.5 text-[11.5px] font-medium text-ink-3">{t.label}</div>
            {state.list.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">{t.empty}</p>
            ) : (
              <ul className="max-h-[50vh] overflow-y-auto p-1.5">
                {state.list.map((p, i) => {
                  const subject = subjects.find((s) => s.id === p.subject_id);
                  const on = i === state.index;
                  return (
                    <li key={p.id} role="option" aria-selected={on}>
                      <div className={cn("group flex items-center gap-1 rounded-lg", on ? "bg-blob-soft" : "hover:bg-hover")}>
                        <button type="button" onClick={() => onPick(p)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left">
                          <PageIcon page={p} className="size-4 shrink-0" />
                          <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", on ? "font-medium text-blob-ink" : "text-ink")}>{pageTitle(p.title, p.kind, locale)}</span>
                          <span className="shrink-0 text-[11.5px] text-ink-3">{p.id === current ? t.current : p.id === side ? t.beside : subject?.name}</span>
                        </button>
                        {p.kind === "note" && p.id !== current && p.id !== side && (
                          <button
                            type="button"
                            onClick={() => onPick(p, true)}
                            title={t.openBeside}
                            aria-label={t.openBeside}
                            className={cn("mr-1 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-raised hover:text-ink", !on && "opacity-0 group-hover:opacity-100")}
                          >
                            <Columns2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11.5px] text-ink-3">
              <span>{t.hint(mac ? "⌘" : "Ctrl")}</span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> {t.keys.open}
              </span>
              <span className="flex items-center gap-1">
                <Kbd>D</Kbd> {t.keys.beside}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
