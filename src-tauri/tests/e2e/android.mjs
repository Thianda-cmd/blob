// Checks of the Android app (the real debug APK) in an emulator, through adb and the web view's
// DevTools (debug builds can be inspected). CI runs it in an Android emulator (apps.yml).
//
//   node src-tauri/tests/e2e/android.mjs --apk app-debug.apk --out shots/
//
// What it looks at: the page sits between the status bar, the navigation bar and the keyboard; no
// pinch zoom; the back button and the edge back swipe walk the page history, then Back leaves the
// app; swipes scroll; app links open their page; links to other sites never open inside the app;
// rotation, dark mode, the print dialog; no crash. Exits 1 if a check fails. Screenshots and results.json go to --out.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const apk = arg("apk");
const out = arg("out", "e2e-android");
const PKG = arg("package", "org.bojes.blob.debug");
const ACTIVITY = "org.bojes.blob.MainActivity";
mkdirSync(out, { recursive: true });

const adb = (...a) => execFileSync("adb", a, { encoding: "utf8", timeout: 180000, maxBuffer: 64 << 20 }).trim();
/** adb, but an error (e.g. nothing found) is just an empty answer. */
const adbQuiet = (...a) => {
  try {
    return adb(...a);
  } catch {
    return "";
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  const d = typeof detail === "string" ? detail : JSON.stringify(detail);
  results.push({ name, ok: !!ok, detail: d });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${d ? ` (${d})` : ""}`);
};
let shots = 0;
const shot = (name) => {
  try {
    writeFileSync(join(out, `${String(++shots).padStart(2, "0")}-${name}.png`), execFileSync("adb", ["exec-out", "screencap", "-p"], { timeout: 60000, maxBuffer: 64 << 20 }));
  } catch (e) {
    console.log(`(no screenshot ${name}: ${e.message})`);
  }
};
const resumed = () => {
  const s = adb("shell", "dumpsys", "activity", "activities");
  const line = s.split("\n").find((l) => /topResumedActivity|mResumedActivity/.test(l)) ?? "";
  return line.trim();
};

/** The app's web view over the DevTools protocol (it changes when the app restarts). */
async function devtools(tries = 60) {
  for (let i = 0; i < tries; i++) {
    // The socket of the app's current process (an old one may still be listed after a restart).
    const pid = adbQuiet("shell", "pidof", PKG);
    const socket = pid && adbQuiet("shell", "grep", "-o", `@webview_devtools_remote_${pid}`, "/proc/net/unix").split("\n")[0];
    if (socket) {
      adb("forward", "--remove-all");
      adb("forward", "tcp:9222", `localabstract:${socket.slice(1)}`);
      try {
        const pages = await (await fetch("http://127.0.0.1:9222/json", { signal: AbortSignal.timeout(5000) })).json();
        const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
        if (page) return await connect(page.webSocketDebuggerUrl);
      } catch {
        // Not ready yet.
      }
    }
    await sleep(2000);
  }
  throw new Error("no debuggable web view");
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let next = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      waiting.get(msg.id).res(msg);
      waiting.delete(msg.id);
    }
  };
  // When the web view goes away (the app closed), every open call fails instead of waiting forever.
  ws.onclose = () => {
    for (const w of waiting.values()) w.rej(new Error("the web view went away"));
    waiting.clear();
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++next;
      if (ws.readyState !== WebSocket.OPEN) return rej(new Error("the web view went away"));
      const timer = setTimeout(() => {
        waiting.delete(id);
        rej(new Error(`${method} got no answer`));
      }, 30000);
      waiting.set(id, { res: (v) => (clearTimeout(timer), res(v)), rej: (e) => (clearTimeout(timer), rej(e)) });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };
  return { send, js, close: () => ws.close() };
}

async function until(probe, ok, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      last = await probe();
      if (ok(last)) return last;
    } catch (e) {
      last = String(e);
    }
    await sleep(700);
  }
  return last;
}

/** Where the web view is on the screen, in pixels: [left, top, right, bottom]. */
function webViewBounds() {
  // uiautomator sometimes can't dump while the screen is still settling ("could not get idle
  // state"): a few tries.
  let xml = "";
  for (let i = 0; i < 4 && !xml.includes("android.webkit.WebView"); i++) {
    adbQuiet("shell", "rm", "-f", "/sdcard/ui.xml");
    adbQuiet("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    xml = adbQuiet("shell", "cat", "/sdcard/ui.xml");
    if (!xml.includes("android.webkit.WebView")) {
      adbQuiet("shell", "am", "broadcast", "-a", "android.intent.action.CLOSE_SYSTEM_DIALOGS");
      execFileSync("sleep", ["1.5"]);
    }
  }
  const m = /class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml) ?? /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"/.exec(xml);
  return m ? m.slice(1, 5).map(Number) : null;
}

const start = () => adb("shell", "am", "start", "-W", "-n", `${PKG}/${ACTIVITY}`);
const path = (dt) => dt.js("location.pathname");

let dt;
try {
  // The emulator's own apps (its launcher) sometimes stall right after boot, and their "isn't
  // responding" dialog would cover the app: no such dialogs during the test.
  adbQuiet("shell", "settings", "put", "global", "hide_error_dialogs", "1");
  adbQuiet("shell", "am", "broadcast", "-a", "android.intent.action.CLOSE_SYSTEM_DIALOGS");
  if (apk) adb("install", "-r", "-g", apk);
  adb("logcat", "-c");
  const [screenW, screenH] = /(\d+)x(\d+)/.exec(adb("shell", "wm", "size")).slice(1).map(Number);
  start();
  dt = await devtools();
  const first = await until(() => path(dt), (p) => p === "/login" || p === "/home", 120000);
  check("start page opens the site", first === "/login" || first === "/home", first);
  await sleep(3000);
  shot("start");

  const info = await dt.js("JSON.stringify({ app: window.__BLOB_APP__, mark: document.documentElement.dataset.app, print: typeof (window.BlobAndroid && window.BlobAndroid.print), viewport: (document.querySelector('meta[name=viewport]') || {}).content, dpr: devicePixelRatio, w: innerWidth, h: innerHeight })");
  const page = JSON.parse(info);
  check("the site knows it's in the Android app", page.app?.platform === "android" && page.mark === "android", page.app);
  check("printing goes to Android's print dialog (BlobAndroid)", page.print === "function", page.print);
  check("no pinch zoom of the whole app (viewport)", /maximum-scale=1/.test(page.viewport ?? ""), page.viewport);

  // The page sits between the bars, not under them.
  const bounds = webViewBounds();
  check("the page starts below the status bar", bounds && bounds[1] > 0, { bounds, screenH });
  check("the page ends above the navigation bar", bounds && bounds[3] < screenH, { bounds, screenH });

  // Pinch: two fingers moving apart don't zoom the app.
  const cx = Math.round(page.w / 2);
  const cy = Math.round(page.h / 2);
  const touch = (type, d) => dt.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
  await touch("touchStart", 20);
  for (const d of [40, 70, 100, 130]) {
    await touch("touchMove", d);
    await sleep(60);
  }
  await touch("touchEnd", 0);
  await sleep(800);
  const scale = await dt.js("visualViewport ? visualViewport.scale : 1");
  check("a pinch doesn't zoom", Math.abs(scale - 1) < 0.01, scale);

  // Taps like a finger: a spot given in page pixels, on the screen.
  const tapAt = (x, y) => adb("shell", "input", "tap", String(Math.round(bounds[0] + x * page.dpr)), String(Math.round(bounds[1] + y * page.dpr)));
  const tapCenter = (r) => tapAt(r.left + r.width / 2, r.top + r.height / 2);
  const rect = async (selector) => JSON.parse(await dt.js(`JSON.stringify(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect())`));

  // The keyboard: tap a field near the bottom of the screen. The page gets shorter above the
  // keyboard and the field moves up into view instead of hiding behind it.
  if (first === "/login" && bounds) {
    await dt.js(`(() => { const i = document.createElement('input'); i.id = 'e2e-field'; i.type = 'text';
      i.style.cssText = 'position:fixed;left:16px;right:16px;bottom:24px;height:48px;z-index:99999;font-size:18px;border:2px solid #7c5cff';
      document.body.appendChild(i); })()`);
    await tapCenter(await rect("#e2e-field"));
    const up = await until(
      async () => JSON.parse(await dt.js("JSON.stringify({ focus: document.activeElement && document.activeElement.id, h: innerHeight, vh: visualViewport.height, bottom: document.getElementById('e2e-field').getBoundingClientRect().bottom })")),
      (v) => v.h < page.h || v.vh < page.h - 1,
      8000,
    );
    const viewUp = webViewBounds();
    check("tapping a field focuses it", up.focus === "e2e-field", up);
    check("the keyboard makes the page shorter instead of covering it", up.h < page.h || up.vh < page.h - 1, { before: page.h, after: up, webView: viewUp });
    check("the focused field stays visible above the keyboard", up.bottom <= Math.min(up.h, up.vh) + 1, up);
    adb("shell", "input", "text", "student");
    await sleep(800);
    check("typing works", (await dt.js("document.getElementById('e2e-field').value")) === "student");
    shot("keyboard");
    // Leaving the field closes the keyboard (Back would leave the app if the keyboard weren't up).
    await dt.js("document.activeElement && document.activeElement.blur(); document.getElementById('e2e-field').remove()");
    const closed = await until(() => dt.js("innerHeight"), (h) => h >= page.h, 10000);
    check("the keyboard closes when the field is left, and the page gets its height back", closed >= page.h, { before: page.h, after: closed });
  }

  // Opens a page by tapping a link, as a person would. (Chromium skips history entries that a
  // page made without a tap, so the back checks need real taps.)
  const tapLink = async (href) => {
    await dt.js(`(() => { const a = document.createElement('a'); a.id = 'e2e-link'; a.href = ${JSON.stringify(href)}; a.textContent = 'Go';
      a.style.cssText = 'position:fixed;left:16px;top:96px;z-index:99999;padding:16px 32px;background:#fff;color:#000;font-size:20px;border:2px solid #7c5cff';
      document.body.appendChild(a); })()`);
    await tapCenter(await rect("#e2e-link"));
    return until(() => path(dt), (p) => p === href, 60000);
  };

  // Navigation, scrolling by swiping, and the back button walking the history.
  const show = await tapLink("/show");
  check("tapping a link opens its page", show === "/show", show);
  await sleep(3000);
  shot("show");
  adb("shell", "input", "swipe", String(Math.round(screenW / 2)), String(Math.round(screenH * 0.75)), String(Math.round(screenW / 2)), String(Math.round(screenH * 0.3)), "350");
  await sleep(1500);
  const scrolled = await dt.js("(document.scrollingElement || document.documentElement).scrollTop");
  check("swiping up scrolls the page", scrolled > 50, scrolled);
  shot("scrolled");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  const back = await until(() => path(dt), (p) => p === first, 20000);
  check("the back button goes back a page", back === first, back);

  // The back gesture: a swipe in from the left edge of the screen (gesture navigation) goes back too.
  await sleep(1500);
  await tapLink("/developers");
  await sleep(2000);
  const mid = String(Math.round(screenH / 2));
  const edgeSwipe = () => adb("shell", "input", "swipe", "2", mid, String(Math.round(screenW * 0.65)), mid, "350");
  edgeSwipe();
  let swiped = await until(() => path(dt), (p) => p === first, 8000);
  if (swiped !== first) {
    // An injected swipe is sometimes not taken as the gesture by the emulator; one more try.
    console.log("info the first edge swipe wasn't taken as Back, swiping again");
    edgeSwipe();
    swiped = await until(() => path(dt), (p) => p === first, 12000);
  }
  check("the back swipe from the screen edge goes back a page", swiped === first, swiped);
  // Back on the first page for the next check, whatever happened above.
  for (let i = 0; i < 3 && (await path(dt).catch(() => first)) !== first; i++) {
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(2000);
  }

  // Back on the first page puts the app in the background (the home screen shows), like any
  // Android app opened from the home screen.
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await sleep(2500);
  check("back on the first page leaves the app", !resumed().includes(PKG), resumed());

  // App links: Android knows the app opens org.bojes.blob://, and a link opens its page both
  // right after Back closed the app (its process still there) and from a cold start.
  dt.close();
  const handlers = adbQuiet("shell", "cmd", "package", "query-activities", "--brief", "-a", "android.intent.action.VIEW", "-d", "org.bojes.blob://show");
  check("Android sends org.bojes.blob:// links to the app", handlers.includes(PKG), handlers.replace(/\s+/g, " ").slice(0, 200));
  const openLink = async (name) => {
    adb("logcat", "-c");
    const started = adbQuiet("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "org.bojes.blob://show", PKG);
    console.log(`info am start (${name}): ${started.replace(/\s+/g, " ")}`);
    let linked;
    try {
      dt = await devtools(30);
      linked = await until(() => path(dt), (p) => p === "/show", 90000);
    } catch (e) {
      linked = e.message;
    }
    writeFileSync(join(out, `logcat-link-${name.replace(/\s+/g, "-")}.txt`), adbQuiet("logcat", "-d", "-t", "3000"));
    check(`an org.bojes.blob:// link opens its page (${name})`, linked === "/show", linked);
    shot(`app-link-${name.replace(/\s+/g, "-")}`);
  };
  await openLink("after Back");
  dt?.close?.();
  adb("shell", "am", "force-stop", PKG);
  await sleep(1500);
  await openLink("cold start");
  await sleep(2000);

  // Links to other sites never open inside the app.
  await dt.js("(() => { const a = document.createElement('a'); a.href = 'https://example.com/'; a.id = 'out'; document.body.appendChild(a); a.click(); })()");
  await sleep(3000);
  const stillHere = await dt.js("location.host").catch(() => "");
  check("a link to another site doesn't open in the app", stillHere && stillHere !== "example.com", stillHere);
  console.log(`info after the outside link: ${resumed()}`);
  shot("outside-link");
  if (!resumed().includes(PKG)) {
    start();
    await sleep(2000);
  }

  // Rotation: the page follows.
  adb("shell", "settings", "put", "system", "accelerometer_rotation", "0");
  adb("shell", "settings", "put", "system", "user_rotation", "1");
  await sleep(3500);
  const land = JSON.parse(await dt.js("JSON.stringify({ w: innerWidth, h: innerHeight })"));
  check("turning the phone sideways lays the page out sideways", land.w > land.h, land);
  shot("landscape");
  adb("shell", "settings", "put", "system", "user_rotation", "0");
  await sleep(2500);

  // Dark mode: the bars take the dark page colour.
  adb("shell", "cmd", "uimode", "night", "yes");
  await sleep(3500);
  shot("dark");
  adb("shell", "cmd", "uimode", "night", "no");
  await sleep(2500);
  dt.close();
  dt = await devtools();

  // Printing opens Android's print dialog.
  await dt.js("window.BlobAndroid && window.BlobAndroid.print()");
  await sleep(4000);
  const printing = resumed();
  check("printing opens the print dialog", /printspooler|print/i.test(printing), printing);
  shot("print");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await sleep(1500);

  // The home screen widget: Android knows it, and the site's data reaches it (kept in its settings).
  const providers = adbQuiet("shell", "dumpsys", "appwidget");
  check("the Today widget is offered on the home screen", providers.includes(`${PKG}/org.bojes.blob.TodayWidget`), providers.slice(0, 200));
  check("the Next up widget is offered on the home screen", providers.includes(`${PKG}/org.bojes.blob.NextWidget`), providers.slice(0, 200));
  const sample = { v: 1, at: Date.now(), locale: "en", items: [{ t: "E2E event", s: Date.now() + 3600e3, e: Date.now() + 7200e3, a: false, c: "#3f78b3", cd: "#3f78b3", k: "event", l: "/calendar" }], streak: 3, practisedToday: false, cards: 2, w: { today: "Today", tomorrow: "Tomorrow", nothing: "-", allDay: "All day", due: "Due", exam: "Exam", next: "Next", streak: "days", cards: "cards", more: "+{n}", open: "Open" } };
  await dt.js(`window.BlobWidget.postMessage(${JSON.stringify(JSON.stringify(sample))})`);
  await sleep(800);
  const kept = adbQuiet("shell", "run-as", PKG, "cat", "shared_prefs/blob_widget.xml");
  check("the widget keeps the site's data", kept.includes("E2E event"), kept.slice(0, 200));

  // Both widgets on the home screen, with a school day in them (light and dark), for the screenshots.
  // Pinning goes through the launcher's own "Add" dialog; if a launcher has none, there are no shots.
  const now = Date.now();
  const at = (min) => now + min * 60e3;
  const day = { v: 1, at: now, locale: "en", streak: 6, practisedToday: false, cards: 12, items: [
    { t: "Biology", s: at(-35), e: at(55), a: false, c: "#5d8a4c", cd: "#5d8a4c", k: "event", l: "/calendar", p: "Bio lab" },
    { t: "Maths", s: at(70), e: at(160), a: false, c: "#3f78b3", cd: "#3f78b3", k: "event", l: "/calendar", p: "R 204" },
    { t: "English essay", s: at(24 * 60), e: at(25 * 60), a: true, c: "#c4653e", cd: "#c4653e", k: "task", l: "/tasks" },
    { t: "Chemistry exam", s: at(48 * 60), e: at(49 * 60), a: true, c: "#3a8c87", cd: "#3a8c87", k: "exam", l: "/calendar" },
  ], w: { ...sample.w, nothing: "Nothing planned. Enjoy it!", streak: "day streak", cards: "cards to review", more: "+{n} more", next: "Next", now: "Now", until: "until {t}", soon: "in {t}" } };
  await dt.js(`window.BlobWidget.postMessage(${JSON.stringify(JSON.stringify(day))})`);
  await sleep(800);
  const pin = async (which) => {
    adbQuiet("shell", "am", "start", "-n", `${PKG}/${ACTIVITY}`, "--es", "pin_widget", which);
    await sleep(2500);
    adbQuiet("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    const ui = adbQuiet("shell", "cat", "/sdcard/ui.xml");
    const node = [...ui.matchAll(/<node [^>]*>/g)].map((m) => m[0]).find((n) => /clickable="true"/.test(n) && /(text|content-desc|resource-id)="[^"]*(add|Add|ADD)[^"]*"/.test(n));
    const bounds = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if (!bounds) return false;
    const [, x1, y1, x2, y2] = bounds.map(Number);
    adb("shell", "input", "tap", String((x1 + x2) >> 1), String((y1 + y2) >> 1));
    await sleep(2000);
    return true;
  };
  const pinned = [await pin("today"), await pin("next")];
  console.log(`widgets pinned: today ${pinned[0]}, next ${pinned[1]}`);
  if (pinned.some(Boolean)) {
    adb("shell", "input", "keyevent", "KEYCODE_HOME");
    await sleep(2500);
    shot("widgets-home");
    adbQuiet("shell", "cmd", "uimode", "night", "yes");
    await sleep(3000);
    shot("widgets-home-dark");
    adbQuiet("shell", "cmd", "uimode", "night", "no");
    await sleep(1500);
    adbQuiet("shell", "am", "start", "-n", `${PKG}/${ACTIVITY}`);
    await sleep(2000);
  }
  await dt.js(`window.BlobWidget.postMessage("")`);

  // No crash along the way.
  const crashes = adb("logcat", "-d", "-s", "AndroidRuntime:E").split("\n").filter((l) => l.includes("FATAL") || l.includes(PKG));
  check("no crash", crashes.length === 0, crashes.slice(0, 5).join(" | "));
} catch (e) {
  check("the run finished", false, e.message);
  shot("crash");
} finally {
  dt?.close?.();
  try {
    writeFileSync(join(out, "logcat.txt"), adb("logcat", "-d", "-t", "4000"));
  } catch {
    // No log.
  }
}

writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
