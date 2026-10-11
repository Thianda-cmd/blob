// Checks of the Android app (the real debug APK) in an emulator, through adb and the web view's
// DevTools (debug builds can be inspected). CI runs it in an Android emulator (apps.yml).
//
//   node src-tauri/tests/e2e/android.mjs --apk app-debug.apk --out shots/
//
// What it looks at: the page sits between the status bar, the navigation bar and the keyboard; no
// pinch zoom; the back button walks the page history and then leaves the app; swipes scroll; app
// links open their page; links to other sites never open inside the app; rotation, dark mode, the
// print dialog; no crash. Exits 1 if a check fails. Screenshots and results.json go to --out.
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

const adb = (...a) => execFileSync("adb", a, { encoding: "utf8", timeout: 180000 }).trim();
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
    writeFileSync(join(out, `${String(++shots).padStart(2, "0")}-${name}.png`), execFileSync("adb", ["exec-out", "screencap", "-p"], { timeout: 60000 }));
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
async function devtools() {
  for (let i = 0; i < 60; i++) {
    const sockets = adb("shell", "cat", "/proc/net/unix")
      .split("\n")
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((n) => n && n.startsWith("@webview_devtools_remote"));
    if (sockets.length) {
      adb("forward", "--remove-all");
      adb("forward", "tcp:9222", `localabstract:${sockets[sockets.length - 1].slice(1)}`);
      try {
        const pages = await (await fetch("http://127.0.0.1:9222/json")).json();
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
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++next;
      waiting.set(id, res);
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
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  const xml = adb("shell", "cat", "/sdcard/ui.xml");
  const m = /class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml) ?? /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*class="android\.webkit\.WebView"/.exec(xml);
  return m ? m.slice(1, 5).map(Number) : null;
}

const start = () => adb("shell", "am", "start", "-W", "-n", `${PKG}/${ACTIVITY}`);
const path = (dt) => dt.js("location.pathname");

let dt;
try {
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

  // The keyboard: tap the email field; the page shrinks above the keyboard and the field stays visible.
  if (first === "/login" && bounds) {
    const r = JSON.parse(await dt.js("JSON.stringify(document.querySelector('input[type=email]').getBoundingClientRect())"));
    const x = Math.round(bounds[0] + (r.left + r.width / 2) * page.dpr);
    const y = Math.round(bounds[1] + (r.top + r.height / 2) * page.dpr);
    adb("shell", "input", "tap", String(x), String(y));
    await sleep(2500);
    const after = JSON.parse(await dt.js("JSON.stringify({ focus: document.activeElement && document.activeElement.type, h: innerHeight, bottom: document.querySelector('input[type=email]').getBoundingClientRect().bottom })"));
    check("tapping the email field focuses it", after.focus === "email", after);
    check("the keyboard pushes the page up instead of covering it", after.h < page.h, { before: page.h, after: after.h });
    check("the focused field stays visible above the keyboard", after.bottom <= after.h, after);
    adb("shell", "input", "text", "student");
    await sleep(800);
    check("typing works", (await dt.js("document.querySelector('input[type=email]').value")) === "student");
    shot("keyboard");
    adb("shell", "input", "keyevent", "KEYCODE_BACK"); // closes the keyboard
    await sleep(1200);
    await dt.js("document.querySelector('input[type=email]').blur()");
  }

  // Navigation, scrolling by swiping, and the back button walking the history.
  await dt.js("location.assign('/show')");
  const show = await until(() => path(dt), (p) => p === "/show", 60000);
  check("going to another page works", show === "/show", show);
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

  // Back on the first page leaves the app, like any Android app.
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await sleep(2500);
  check("back on the first page leaves the app", !resumed().includes(PKG), resumed());

  // An app link opens its page (and starts the app again).
  dt.close();
  adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "org.bojes.blob://show", PKG);
  dt = await devtools();
  const linked = await until(() => path(dt), (p) => p === "/show", 90000);
  check("an org.bojes.blob:// link opens its page", linked === "/show", linked);
  await sleep(2000);
  shot("app-link");

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
