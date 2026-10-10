# Blob as a desktop and phone app

Decision (October 2026): **Tauri v2 for all five platforms** (Windows, macOS, Linux, Android, iOS),
as a thin native shell around the live site, blob.bojes.org. The shell is in `src-tauri/`; the
site's side of it is `src/lib/native.ts` and `src/components/NativeBridge.tsx`.

## What the app has to deal with

Taken from the codebase, not from a wish list:

- **The site can't be bundled.** It is server-rendered: server components, server actions, API
  routes, the Supabase session proxy (`src/proxy.ts`), and secrets that only the server may hold
  (`SUPABASE_SECRET_KEY`, the OIDC keys). A static export would mean rewriting the app. So every
  option below means *a native window showing blob.bojes.org*, plus native extras around it.
- **Sign-in** is email + password and email links (`/auth/confirm?token_hash=…`, which signs in only
  after a click). There is no Google/Apple sign-in, which embedded webviews would block.
- **`window.print()`** makes the CV PDF, note summaries and topic sheets.
- **`window.open()`**: the presenter's speaker window (must keep talking to its opener), and file
  links that open a blank tab first and set its address once the signed link is ready.
- **Files**: uploads (`<input type=file>`), downloads, PDF previews in an iframe from Supabase Storage.
- **Realtime** (collaborative notes) over websockets: works in every webview.

## The options

| | Tauri v2 (2.12, Sep 2026) | Electron (44.x; 45 due Oct 2026) | Capacitor 8 (Dec 2025) |
|---|---|---|---|
| Platforms | Windows, macOS, Linux, Android, iOS | Windows, macOS, Linux | Android, iOS (web as PWA) |
| Engine | The system's webview: WebView2 (Chromium) on Windows, WebKit on macOS/iOS/Linux, Chromium on Android | Its own Chromium everywhere | The system's webview |
| App size | ~5–15 MB | ~100 MB+ | ~5–10 MB |
| Showing a live site | First-class: windows can load an external URL, and capabilities grant native commands to named remote origins only | Yes (`loadURL`), with careful hardening (contextIsolation, no nodeIntegration) | `server.url` works, but the docs say it's meant for live reload, not production |
| Native side | Rust; official plugins: deep links, notifications, updater, opener, window state, single instance, dialog, haptics, biometrics, barcode, … | Node.js; the biggest ecosystem | Swift/Kotlin; the most mature phone plugins (push, local notifications, share, keyboard, status bar) |
| Phones | Stable since 2.0 (Oct 2024), younger than desktop. Multi-window and file associations came in 2.11. Push only via community plugins | — | Its home turf |
| Updates | Official updater (signed) on desktop | electron-updater | App stores (+ live updates services) |

Not considered further: **React Native / Expo / Flutter** (a rewrite of the whole UI), and a
**PWA alone** (no app stores and weak on iOS, but a manifest is a cheap extra later).

### Why Tauri

1. **One shell, five platforms.** One Rust crate of ~350 lines and one config. Electron covers only
   the desktop and Capacitor only phones, so either means maintaining two shells.
2. **It fits "a native window around a server-rendered site".** Tauri's permission system is built
   for this: blob.bojes.org may call exactly three commands (open a link outside, print, app info)
   and nothing else, enforced by Tauri for remote origins (tested, see below).
3. **Small and frugal.** 5–15 MB instead of 100 MB+, and it uses less memory. That matters on school
   laptops and cheap phones.
4. **Actively developed**, with releases every few months in 2025–26 (2.8 → 2.12).

**The trade-offs, and what to do about them:**

- **Different webviews.** WebKit on macOS, iOS and Linux, and Chromium on Windows and Android.
  The site already works in Safari, so this is mostly fine. Linux's WebKitGTK is the weakest of them.
- **Phones are Tauri's younger side.**
  - No pop-up windows on phones: the bridge opens such pages in the same window.
  - Printing on phones needs work (phase 3).
  - Remote push notifications need a community plugin.
  - Fallback if push or another phone feature turns into a wall: swap only the phone shell for
    Capacitor 8. The site talks to the shell only through `src/lib/native.ts` (three calls), so
    that's a contained change, and the desktop stays on Tauri.
- **App Store guideline 4.2** (minimum functionality) rejects apps that are "just a website". The
  phone apps need real native value before submission (phase 3 below). The desktop apps don't
  have this problem.

## How the shell works

```
app start → bundled start page (src-tauri/shell: Blob, checks the site answers)
          → blob.bojes.org/home   (or the page from an app link)
          → no internet: friendly offline screen, tries again when the connection is back
```

Rules around the site (`src-tauri/src/lib.rs`):

- **Navigation** stays on the site and the app's own pages. Anything else opens in the system browser.
  - The start page counts only at this platform's exact address (`tauri://localhost`, or
    `http://tauri.localhost` on Windows/Android).
  - `blob:` files count only when the site made them.
  - Signed links into the `files` bucket are allowed, because the site previews files in an iframe
    and macOS/Linux apply the rule to frames. That bucket takes no SVG (migration 0016), since an
    SVG could carry a script.
- **Pop-ups** (desktop): only the site's own pages become app windows, and the speaker view keeps
  its opener. Anything else opens in the browser. Phones have no pop-ups.
- **Downloads** go to the Downloads folder under a safe, unused name; the folder opens afterwards.
- **Printing**: macOS's webview ignores `window.print()`, so the bridge asks the app to print there.
  Windows and Linux print on their own.
- **App links**: `org.bojes.blob://auth/confirm?…`, `org.bojes.blob://learn/french`, … open that
  page in the app.
  - Not `blob://`: browsers keep `blob:` URLs to themselves and never hand them to an app.
  - Only known page prefixes are allowed (`LINK_PATHS`); anything else lands on `/home`.
  - On desktop a second start hands its link to the running app (single instance).
  - While the app is still starting, the link waits in the app. The start page asks for it at the
    last moment (`start_target`, a command only the start page may call), so a link's token is
    never visible to the site's scripts. If the start page has just left, the site's first page
    load picks it up.
  - The sign-in confirmation page offers "Open in the app" with the app-link version of its link,
    so email links can end up in the app on any device. The token is only used on the click, and
    the `next` page after it is checked the way a browser reads it (`safeNext`).
- **Window size and position** are remembered.

The site's side (`NativeBridge`, mounted in the root layout, inert in browsers):

- `<html data-app="macos|windows|linux|android|ios">` for app-only styling;
- link clicks to other sites → system browser; "new tab" on phones → same window;
- `window.open`: the same rules, plus a stand-in for the "blank tab first" pattern;
- `window.print` → native print on macOS.

**Permissions** (`src-tauri/capabilities/`):

- `site.json`: blob.bojes.org may call `open_external`, `print_page` and `app_info`, nothing else.
- `start-page.json`: the start page may call `start_target`.
- `site-dev.json`: the site rights for a local site (`localhost`). Only `npm run app` includes it,
  through `tauri.dev.conf.json`; release builds don't.

**Tested on Linux** (the real app under a virtual display, against the live site and a local dev
server):

- **Start-up:**
  - start page → live sign-in page;
  - the offline screen;
  - the release build.
- **What the site may call:**
  - `app_info` works from the site's own origin;
  - `open_external("file:///etc/passwd")` is refused;
  - `start_target` called from the site is refused, as is a plugin command called directly.
- **Links:**
  - an external link, an external "new tab" link, the blank-tab-then-file pattern and an external
    `window.open` all reach the system browser;
  - the site's own `blob:` page opens in the app;
  - a cold start from `org.bojes.blob://show` opens that page;
  - a second start with a link hands it to the running app, which navigates.
- **Automated:** Rust unit tests for the address and link rules (`cargo test`); a type-check for
  Android (`cargo check --target aarch64-linux-android`); CI builds for every desktop platform.

An independent security review of the shell found the issues fixed above: pages from other origins
counting as the app's own, a scheme browsers swallow, an open redirect in `next`, the start link's
token visible to the site, a start-up race on macOS, and desktop-only calls in the phone build.

## Working on it

```bash
npm run app                                     # the desktop app against blob.bojes.org
BLOB_SITE=http://localhost:3000 npm run app     # against `npm run dev` (dev builds only)
BLOB_START=/learn/french npm run app            # start on a page (dev builds only)
npm run app:build                               # installers for this OS (src-tauri/target/release/bundle)
cd src-tauri && cargo test                      # the shell's rules
```

- **Needs:** Rust (stable). On Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev
  libayatana-appindicator3-dev`.
- **Android:** Android Studio (SDK + NDK), then `npm run tauri android init` and
  `npm run tauri android dev`.
- **iOS:** a Mac with Xcode, then `npm run tauri ios init` and `npm run tauri ios dev`.
- Commit `src-tauri/gen/android` and `src-tauri/gen/apple` once they exist, since native settings
  (permissions, entitlements) live there.
- **CI** (`.github/workflows/apps.yml`): every push that touches `src-tauri/` builds the Windows,
  macOS and Linux installers and an Android debug APK, as downloadable artifacts. A tag `app-v0.1.0`
  also makes a draft GitHub release.

The bundle id **`org.bojes.blob`** is permanent once an app is in a store.

## Roadmap

**Phase 1: done.**
- The desktop shell and its rules, deep links and "Open in the app".
- Icons for every platform, the offline screen, and CI builds for Windows, macOS, Linux and Android.

**Phase 2: ready to hand out.**
- Code signing:
  - macOS: Developer ID and notarization (needs the Apple Developer Program, $99/year).
  - Windows: a code-signing certificate or Azure Trusted Signing, otherwise SmartScreen warns.
- **Auto-updates** with `tauri-plugin-updater`: generate a signing key, publish `latest.json` with
  the GitHub releases.
- **Universal Links (iOS) and App Links (Android)** for `/auth/confirm`, `/join`, `/p/…`.
  - Needs `public/.well-known/apple-app-site-association` (Apple team id) and `assetlinks.json`
    (the Android signing certificate's SHA-256).
  - Then add the https entries to `plugins.deep-link.mobile`.
- Phones:
  - safe areas: `viewport-fit=cover` and `env(safe-area-inset-*)` in the app shell layout;
  - Android's back button;
  - file uploads from the camera;
  - commit `gen/android` and `gen/apple`.

**Phase 3: native value (and App Store 4.2).**
- Daily-goal and streak reminders with local notifications (`tauri-plugin-notification`, official,
  all platforms).
- The share sheet for notes and lesson pictures, and haptics on right answers.
- Printing and PDF export on phones.
- Push notifications for shared notes and comments (community plugin, or Capacitor for the phone shell).
- Reading notes offline (cache the last opened pages).

## What only the owner can do

- **Apple Developer Program** ($99/year): team id, signing certificates, App Store Connect entry.
- **Google Play Console** ($25 once): the app entry and the upload key.
- Optional: **Windows code signing**, so installers don't trigger SmartScreen.
- Store listings: screenshots, descriptions (English/German), privacy details (what Blob stores:
  account, notes, learning progress).

## Sources

- Tauri releases and 2.12 announcement: <https://v2.tauri.app/release/tauri/>, <https://v2.tauri.app/blog/>
- Tauri capabilities for remote origins: <https://v2.tauri.app/reference/acl/capability>
- Capacitor 8: <https://ionic.io/blog/announcing-capacitor-8>
- Capacitor `server.url` in production: <https://github.com/ionic-team/capacitor/discussions/5075>
- Electron release timeline: <https://www.electronjs.org/docs/latest/tutorial/electron-timelines>
- Tauri push notifications (community): <https://github.com/Choochmeque/tauri-plugin-notifications>
- App Store guideline 4.2 and web wrappers: <https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper>
