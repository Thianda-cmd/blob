# Calendar, offline mode and native features

How Blob's calendar, the apps' offline mode, notifications, widgets and the desktop
"sign in with your browser" flow fit together. The apps are a shell around the live site
(`docs/native-apps.md`), so almost everything here is site code that also runs in a browser;
the native parts are kept small and say so.

## 1. Calendar (`/calendar`)

**Data (`supabase/migrations/0017_calendar.sql`).**

- `events`: one row per event or recurring series.
  - `starts_at` / `ends_at` (timestamptz, end > start). All-day events store UTC midnights that
    stand for dates: the end is exclusive, so one day is `[d, d+1)`. The UI reads the dates from
    them, so an all-day event never shifts with the time zone.
  - `recurrence` (jsonb or null):
    - `{freq: daily|weekly|monthly|yearly, interval, byDay?: 0..6[], until?: yyyy-mm-dd, count?}`
    - `exdates` holds skipped occurrences (their original start).
    - A single changed occurrence is its own row with `series_id` + `series_start`.
  - `reminders`: minutes before the start, at most 5.
    - For all-day events the start is local midnight, so "on the day at 9:00" is `-540`.
  - Other columns: `subject_id`, `color` (a subject colour key), `kind` (event, lesson, study,
    birthday, break), `location`, `details`, `time_zone` (IANA, where it was made).
  - `deleted_at` is a tombstone, so offline devices learn about deletions. Devices keep their
    copy of a tombstone for 60 days; the nightly job (`/api/cron/files`) deletes the rows 90 days
    after deletion.
  - RLS: own rows only. Realtime: in the `supabase_realtime` publication.
- `profiles` gains:
  - `week_starts_on` (0..6, default Monday)
  - `time_zone`, kept up to date by the client, for server-side jobs
  - `notify`: notification choices, so they follow the user to every device

**What the calendar shows.**

- Events.
- Personal tasks with a due date. A due date without a time (the kind's default time) goes to the
  all-day lane; a task with a time is a small marker at that time. Exams get Blob's accent.
- Project cards assigned to you that have a due date.
- Dragging a task moves its due date, using the tasks' own rules (`dueAt`, `retimeForKind`).
  Tasks can't be resized.

**Views.**

- Desktop:
  - Week view (default), Day, Month and Agenda.
  - The page fills the whole main card, with no max width.
  - A left rail (≥1280 px) holds the mini month, filters and coming exams.
- Phone:
  - Day (default), 3 days, Month and Agenda.
  - A week strip under the header; swipe sideways to change days.
  - A + button for new events. Editors open as bottom sheets.

**Interactions.** Pointer events with pointer capture; dnd-kit isn't used, because the time grid
needs create and resize, not sorting.

- Mouse:
  - Drag on an empty slot to create; a click makes a 1 h event.
  - Drag an event to move it; drag its top or bottom edge to resize.
  - Esc cancels a drag; Alt+drag duplicates.
  - Snapping is 15 min (5 min while Shift is held).
- Touch:
  - Long-press (350 ms) on an empty slot to create, then drag to extend.
  - Long-press an event to lift it and move it; a selected event shows resize handles.
  - Once a drag has started, scrolling is blocked with a non-passive `touchmove` (the same
    method as dnd-kit's TouchSensor).
- Edge scrolling while dragging. On the phone day view, holding at the side moves to the next day.
- Recurring events ask "This event / This and following / All events" after a move, edit or
  delete.
- Undo (toast) for moves, resizes and deletes.
- Keys: T today, ←/→ (or J/K) previous/next, D/W/M/A views, N new, Delete, Ctrl+Z.

## 2. Offline mode (apps)

**Pages.**

- A service worker (`public/sw.js`, registered only inside the apps):
  - Navigations: network first, then the cached page for that address, then `/offline`.
  - `/_next/static`: cache first (content-hashed).
  - Supabase calls are never cached; the data layer below handles them.
- After sign-in it warms the cache in the background:
  - Home, Notes, Calendar, Tasks, Learn and Settings.
  - The 25 most recently changed notes, plus the scripts, styles and fonts each page needs.
- A note that isn't cached opens at `/notes/offline?id=…`, which renders the editor from the
  device's copy of the note (the apps keep a copy of every note, up to 500).
- On sign-out, or when another account signs in, the caches and the local database are wiped.
- iOS needs "app-bound domains" for service workers: `limit_navigations_to_app_bound_domains` plus
  `WKAppBoundDomains` (`localhost`, `bojes.org`, `supabase.co`) in `src-tauri/Info.ios.plist`.
- The start page knows when the site is ready offline (`offline_ready`, stored by the app). With
  no connection it then opens the site anyway, and the service worker answers.

**Data (`src/lib/offline/*`).**

- IndexedDB per user:
  - Tables `events`, `tasks`, `subjects`, `pages` (meta), `notes` (content, `rev`/`doc_version`,
    the last confirmed copy, local changes, unsent steps).
  - An `outbox` of queued writes.
- Stores:
  - One shared store per table (`useSyncExternalStore`): the calendar, the tasks page and Home
    see the same rows.
  - Rows with queued writes keep their local fields until the server confirms them.
  - Realtime and full refreshes merge underneath.
- The outbox:
  - Writes go out in order, one per row at a time.
  - A network failure waits for the connection; it doesn't undo anything.
  - A server refusal undoes that one change, and Blob says so.
  - Inserts use client UUIDs, so replaying them is safe.
- Notes:
  - Unsaved text survives closing the app.
  - Notes edited alone now save only against the `rev` they were edited from. When another
    device changed the note meanwhile, the change is merged (`localChange`); if that isn't
    possible, it is kept as a copy.
  - Shared notes keep their unsent steps on the device and send them through the settle route
    (which rebases on the server) when back online.
- A small "Offline" pill in the top bar says what's happening. Saved-on-device is not shown as an
  error.

## 3. Phones

- A bottom tab bar on phones: Home, Notes, Calendar, Tasks, More (the drawer). Blob's helper sits
  above it.
- `viewport-fit=cover` with safe-area padding on iOS. Android pads natively.
- Notes on touch:
  - A toolbar docked above the keyboard (`visualViewport`): format, insert block, turn into,
    indent and outdent, undo and redo, hide keyboard. It replaces the bubble, which fought the
    native selection menu.
  - The slash and `[[` menus stay above the keyboard.
  - Tapping a link puts the caret there and shows a small "Open" chip.
- Pickers and popovers that matter on the go (due date, subject, calendar editors) open as bottom
  sheets on phones (`ui/Sheet`).

## 4. Notifications (`tauri-plugin-notification`)

Scheduled on the device, so they work offline and need no server or store account. The site
works out what to schedule for the next 14 days, at most 60 (iOS keeps 64), and syncs that with
the system by stable ids whenever the data changes or the app opens.

| What | When | Default |
|---|---|---|
| Event reminders | the event's own reminders (default 10 min before; all-day: 9:00 on the day) | on |
| Homework due tomorrow | 18:00 the day before, if still open | on |
| Exams | 1 week, 2 days and 1 day before (18:00), and 7:00 on the day | on |
| Flashcards to review | 17:00 on days with cards due | on |
| Learning streak | 19:30 if you haven't practised today | on |
| Morning overview | 7:00: today's events and what's due | off |

- Desktop apps show them while the app is open.
- Tapping one opens the right page (calendar day, task, note).
- The choices live in Settings → Notifications (`profiles.notify`).
- Server push for "someone shared a note with you" or "assigned a card" needs Firebase (Android)
  and an Apple Developer key (iOS): see the owner tasks in `docs/native-apps.md`.

## 5. Widgets

The site works out what the widgets show (`src/lib/widget/snapshot.ts`) from the same data on the
device as the reminders:
- the coming week's events, due tasks and exams (up to 24);
- the learning streak and the cards to review today;
- the words in the account's language.

The widgets leave out what has ended themselves, so they stay right while Blob is closed. Tapping
a row opens that day or the tasks (`org.bojes.blob://calendar?date=…`). Signing out empties them.

- **Android:** "Today in Blob" (`gen/android/…/TodayWidget.kt`, RemoteViews).
  - One widget from 2×2 up: header with the date and streak, as many rows as fit, cards at the
    bottom.
  - The site hands the JSON to `window.BlobAndroid.updateWidget(json)`, which keeps it in the
    app's settings and redraws. It also redraws every 30 minutes.
- **iPhone and iPad:** a WidgetKit extension (`src-tauri/ios/BlobWidget`).
  - Home screen: small (what's next), medium and large (the list).
  - Lock screen: the next two things, the streak (round), the next thing (one line).
  - The site calls `set_widget`, and the app writes the JSON into the app group
    `group.org.bojes.blob`.
  - `WidgetBridge.swift` in the app sees the change and reloads the widgets. Their own timeline
    also moves on as things end, and at midnight.
  - `gen/apple` isn't committed. `src-tauri/ios/add-widget.rb` adds the extension, the app group
    and the bridge to the project that `tauri ios init` generates (CI runs it, then
    `xcodegen generate`).
  - On a real device, the app group must be enabled for both bundle ids in the Apple developer
    account.

## 6. Sign in the app with your browser

All apps; meant mainly for the desktop.

1. The app's sign-in page offers "Sign in with your browser".
2. The app makes a PKCE verifier and a random `state` and keeps them in its own storage. It opens
   `/auth/app/approve?challenge=…&state=…&device=…` in the system browser.
3. The browser page (sign-in first if needed) asks "Sign in the Blob app?". It names the account
   and warns to continue only if you started this yourself. The page can't be framed.
4. Continue (a server action, CSRF-protected) stores a one-time code:
   - only its SHA-256 is kept, in `app_sign_ins`;
   - it expires after 2 minutes, works once, and is bound to the user and the challenge.
5. The browser opens `org.bojes.blob://auth/app?code=…&state=…`, and the app shows `/auth/app`.
6. The page checks that `state` is its own, then calls `finishAppSignIn(code, verifier)`.
7. The server uses the code up (also when the verifier is wrong) and compares the challenge. It
   makes a magic-link token for the user (`admin.generateLink`, nothing is emailed) and verifies
   it, so the session cookies land in the app.

A caught link is useless without the verifier, and a link the app didn't ask for is refused
(`state`). The nightly job removes old codes.
