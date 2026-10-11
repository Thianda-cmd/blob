"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useMessages } from "@/i18n/client";
import { nativeText } from "@/i18n/messages/native";
import { blobApp, isPhoneApp, openOutside, printPage } from "@/lib/native";

/**
 * Inside the Blob app (src-tauri/): links to other sites open in the system browser, pages the site
 * opens "in a new tab" work, printing goes through the system's print dialog, and the app answers
 * the keys and mouse buttons a browser would (back, forward, reload). In a browser it does nothing.
 */
export function NativeBridge() {
  const t = useMessages(nativeText);
  const [cantPrint, setCantPrint] = useState(false);

  useEffect(() => {
    const app = blobApp();
    if (!app) return;
    const phone = isPhoneApp(app);
    const root = document.documentElement;
    root.dataset.app = app.platform;

    // Phones: no pinch or double-tap zoom of the whole app (native apps don't zoom their screens).
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const viewportBefore = viewport?.content;
    if (phone && viewport && !/maximum-scale/.test(viewport.content)) viewport.content += ", maximum-scale=1, user-scalable=no";

    const own = (url: URL) => url.origin === location.origin;
    const outside = (url: URL) => ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) && !own(url);

    // Clicks on links: other sites go to the browser; "new tab" links of the site stay in the app
    // (desktop: an app window, made by the app; phones have one window, so the same one).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (outside(url)) {
        e.preventDefault();
        void openOutside(url.href);
      } else if (phone && own(url) && (a.target === "_blank" || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        location.assign(url.href);
      }
    };
    document.addEventListener("click", onClick, true);

    // window.open: the same rules. Pages that open a blank tab first and send it to a file link once
    // it's ready (files, cards) get a stand-in that passes the address on.
    const original = window.open.bind(window);
    const open = (url: URL, target?: string, features?: string): Window | null => {
      if (outside(url)) {
        void openOutside(url.href);
        return null;
      }
      if (phone) {
        location.assign(url.href);
        return null;
      }
      return original(url.href, target, features);
    };
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const href = url === undefined ? "" : String(url);
      if (href === "" || href === "about:blank") return standIn((later) => open(later));
      try {
        return open(new URL(href, location.href), target, features);
      } catch {
        return null;
      }
    };

    // Printing: Windows and Linux print on their own (and on Windows the app's print is
    // window.print itself). macOS, iOS and Android go through the app; if that fails, say so.
    const print = window.print;
    if (app.platform === "macos" || phone) {
      window.print = () => {
        void printPage().then((ok) => {
          if (ok) return;
          if (phone) setCantPrint(true);
          else print.call(window);
        });
      };
    }

    // Desktop keys and mouse buttons a browser has: back, forward, reload. (Windows' webview has
    // them already.) macOS: ⌘[ ⌘] ⌘R; Linux: Alt+← Alt+→ Ctrl+R F5.
    const desktopKeys = app.platform === "macos" || app.platform === "linux";
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const mac = app.platform === "macos";
      const mod = mac ? e.metaKey && !e.ctrlKey && !e.altKey : e.altKey && !e.ctrlKey && !e.metaKey;
      const back = mac ? e.key === "[" : e.key === "ArrowLeft";
      const forward = mac ? e.key === "]" : e.key === "ArrowRight";
      if (mod && !e.shiftKey && (back || forward)) {
        e.preventDefault();
        if (back) history.back();
        else history.forward();
      } else if (((mac ? e.metaKey : e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "r") || (!mac && e.key === "F5")) {
        e.preventDefault();
        location.reload();
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      if (e.button === 3) history.back();
      else history.forward();
    };
    if (desktopKeys) {
      window.addEventListener("keydown", onKey);
      window.addEventListener("mouseup", onMouse);
    }

    // No browser menu (Back, Reload, Inspect…) on a right-click outside text: the app's pages have
    // their own menus where they need one. Text, fields and selections keep the system menu.
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const el = e.target as Element | null;
      const editable = el?.closest?.("input, textarea, [contenteditable=''], [contenteditable='true']");
      const selected = (window.getSelection()?.toString() ?? "").length > 0;
      if (!editable && !selected) e.preventDefault();
    };
    if (!phone) window.addEventListener("contextmenu", onContextMenu);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
      window.removeEventListener("contextmenu", onContextMenu);
      window.open = original;
      window.print = print;
      if (viewport && viewportBefore !== undefined) viewport.content = viewportBefore;
      delete root.dataset.app;
    };
  }, []);

  return (
    <Dialog open={cantPrint} onClose={() => setCantPrint(false)} labelledBy="cant-print-title">
      <div className="p-5">
        <h2 id="cant-print-title" className="font-display text-[18px] font-semibold">
          {t.printTitle}
        </h2>
        <p className="mt-2 text-[14px] text-ink-2">{t.printBody}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCantPrint(false)}>
            {t.close}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setCantPrint(false);
              void openOutside(location.href);
            }}
          >
            {t.openBrowser}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** A pretend window for window.open("about:blank"): the address it's sent to opens for real. */
function standIn(go: (url: URL) => void): Window {
  let done = false;
  const send = (to: string | URL) => {
    if (done) return;
    done = true;
    try {
      go(new URL(String(to), location.href));
    } catch {
      // Not an address: nothing to open.
    }
  };
  const loc = {
    assign: send,
    replace: send,
    get href() {
      return "about:blank";
    },
    set href(to: string) {
      send(to);
    },
  };
  const win = {
    opener: null,
    get closed() {
      return done;
    },
    close() {
      done = true;
    },
    focus() {},
    blur() {},
  };
  // win.location.href = … and win.location = … both send it.
  Object.defineProperty(win, "location", { get: () => loc, set: send });
  return win as unknown as Window;
}
