"use client";

import { useEffect } from "react";
import { blobApp, isPhoneApp, openOutside, printPage } from "@/lib/native";

/**
 * Inside the Blob app (src-tauri/): links to other sites open in the system browser, pages the site
 * opens "in a new tab" work, and printing works where the webview can't do it alone. In a browser
 * it does nothing.
 */
export function NativeBridge() {
  useEffect(() => {
    const app = blobApp();
    if (!app) return;
    const phone = isPhoneApp(app);
    document.documentElement.dataset.app = app.platform;

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

    // macOS's webview ignores window.print: the app prints instead. (Windows and Linux print fine on
    // their own, and on Windows the app's print is window.print itself.)
    const print = window.print;
    if (app.platform === "macos") {
      window.print = () => {
        void printPage().then((ok) => {
          if (!ok) print.call(window);
        });
      };
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      window.open = original;
      window.print = print;
      delete document.documentElement.dataset.app;
    };
  }, []);
  return null;
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
