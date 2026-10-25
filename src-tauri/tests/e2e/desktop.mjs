// End-to-end checks of the desktop app (the real executable) through tauri-driver.
//
//   tauri-driver &                                   # (Linux: also WebKitWebDriver, from webkit2gtk-driver)
//   node src-tauri/tests/e2e/desktop.mjs --app path/to/blob --out shots/
//
// Signed out it checks the start page, the bridge to the app, public pages, links, history and the
// keys; with --deep-link "<command>" also an app link from outside (the command opens
// org.bojes.blob://show, e.g. `blob org.bojes.blob://show` on Linux); with --open-file "<command>"
// a Blob file opened with the running app ("{file}" in the command is its path, e.g.
// `blob {file}`), which the site can then take. With BLOB_E2E_EMAIL and BLOB_E2E_PASSWORD it also signs in and opens every area of the app,
// writes in a new note, and looks at the narrow (phone-sized) layout. Exits 1 if a check fails.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Session, sleep } from "./webdriver.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const app = arg("app");
const out = arg("out", "e2e-desktop");
const driver = arg("driver", "http://127.0.0.1:4444");
const site = arg("site", "https://blob.bojes.org");
// A command that opens org.bojes.blob://show the way the system would (the running app takes it).
const deepLink = arg("deep-link");
// A command that opens a Blob file with the app the way a double-click would ({file}: its path).
const openFile = arg("open-file");
// Windows: --attach host:port joins the running app through its WebView2 DevTools port, with
// --driver pointing at msedgedriver itself (webview2 launching under msedgedriver is unreliable).
const attach = arg("attach");
const email = process.env.BLOB_E2E_EMAIL;
const password = process.env.BLOB_E2E_PASSWORD;
if (!app) throw new Error("--app path/to/the/app is required");
mkdirSync(out, { recursive: true });

/** Writes a Blob file with one note (in --out), and opens it with the running app. Returns its text. */
function openBlob(name, title, text) {
  const file = resolve(out, name);
  const content = text ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } : null;
  const json = JSON.stringify({ format: "blob", version: 1, exportedAt: new Date().toISOString(), app: "Blob", pages: [{ ref: "e2e", kind: "note", title, icon: null, tags: [], topics: [], content, children: [] }], assets: {} });
  writeFileSync(file, json);
  try {
    execSync(openFile.replaceAll("{file}", `"${file}"`), { timeout: 30000, stdio: "ignore" });
  } catch (e) {
    console.log(`(the open command ended with ${e.status})`);
  }
  return json;
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail: typeof detail === "string" ? detail : JSON.stringify(detail) });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${typeof detail === "string" ? detail : JSON.stringify(detail)})` : ""}`);
};
const note = (name, detail) => {
  results.push({ name, ok: true, info: true, detail: JSON.stringify(detail) });
  console.log(`info ${name}: ${JSON.stringify(detail)}`);
};

let shots = 0;
const shot = async (s, name) => {
  try {
    writeFileSync(join(out, `${String(++shots).padStart(2, "0")}-${name}.png`), await s.screenshot());
  } catch (e) {
    console.log(`(no screenshot ${name}: ${e.message})`);
  }
};

const ERRORS = ["Application error", "Unhandled Runtime Error", "something went squish", "schiefgewabbelt", "Internal Server Error"];
const path = (s) => s.exec("return location.pathname");

/** Waits for the page to settle after a navigation, then checks it isn't an error or empty page. */
async function settled(s, name, { wide = true } = {}) {
  await s.until(() => s.exec("return document.readyState"), (r) => r === "complete", 30000);
  await sleep(2500);
  const problem = await s.exec(
    `const t = document.body ? document.body.innerText : "";
     const bad = arguments[0].find((b) => t.includes(b));
     return bad || (t.trim().length < 20 ? "empty page" : null);`,
    ERRORS,
  );
  const overflow = await s.exec("return document.documentElement.scrollWidth - window.innerWidth");
  check(`${name}: shows without errors`, !problem, problem ?? "");
  if (!wide) check(`${name}: no sideways scrolling at this width`, overflow <= 1, `${overflow}px too wide`);
  await shot(s, name.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
}

const s = await Session.start(driver, app, { attach });
try {
  // The start page moves on to the site (signed out: the sign-in page).
  const first = await s.until(() => path(s), (p) => p === "/login" || p === "/home", 90000, 1000);
  check("start page opens the site", first === "/login" || first === "/home", first);
  await settled(s, "first page");

  const info = await s.exec("return window.__BLOB_APP__ || null");
  check("the site knows it's in the app", info && info.platform, info);
  check("html[data-app] marks the platform", (await s.exec("return document.documentElement.dataset.app")) === info?.platform);
  const ipc = await s.execAsync(
    "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('app_info').then((r) => done(r), (e) => done('refused: ' + e));",
  );
  check("the site may ask the app which app it is (app_info)", ipc && ipc.platform === info?.platform, ipc);
  const refused = await s.execAsync(
    "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('start_target').then((r) => done('allowed: ' + r), (e) => done('refused'));",
  );
  check("the site may not call the start page's command", refused === "refused", refused);
  const fileUrl = await s.execAsync(
    "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('open_external', { url: 'file:///etc/hosts' }).then(() => done('allowed'), (e) => done('refused'));",
  );
  check("open_external refuses files", fileUrl === "refused", fileUrl);

  // Starting with the computer (Settings → App): the site switches it on and off, and the system
  // gets (and loses) its entry: an autostart file on Linux, the Run key on Windows.
  const autostart = (enabled) =>
    s.execAsync(
      `const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke(${enabled === undefined ? "'autostart_get'" : `'autostart_set', { enabled: ${enabled} }`}).then((r) => done(r), (e) => done('refused: ' + e));`,
    );
  const entry = () => {
    try {
      if (process.platform === "linux") {
        const dir = join(homedir(), ".config", "autostart");
        return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".desktop") && readFileSync(join(dir, f), "utf8").includes("--autostart"));
      }
      if (process.platform === "win32") return execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"', { encoding: "utf8" }).includes("--autostart");
    } catch {
      return false;
    }
    return null;
  };
  const wasOn = await autostart();
  const on = await autostart(true);
  const onNow = await autostart();
  const entryOn = entry();
  check("the site may switch starting with the computer on (autostart_set)", on === true && onNow === true && entryOn !== false, { wasOn, on, onNow, entryOn });
  const off = await autostart(false);
  const offNow = await autostart();
  const entryOff = entry();
  check("…and off again, entry gone", off === false && offNow === false && !entryOff, { off, offNow, entryOff });
  if (wasOn === true) await autostart(true);

  // Public pages.
  for (const p of ["/show", "/developers", "/"]) {
    await s.go(site + p);
    await settled(s, `public ${p}`);
  }

  // History: back to /developers, forward to /.
  await s.exec("history.back()");
  const back = await s.until(() => path(s), (p) => p === "/developers", 15000);
  check("history back works", back === "/developers", back);

  // Browser keys: back (macOS ⌘[, Linux Alt+←); Windows' webview has its own.
  if (info?.platform === "linux") {
    await s.cmd("POST", "/actions", {
      actions: [{ type: "key", id: "kb", actions: [{ type: "keyDown", value: "\uE00A" }, { type: "keyDown", value: "\uE012" }, { type: "keyUp", value: "\uE012" }, { type: "keyUp", value: "\uE00A" }] }],
    });
    const afterKey = await s.until(() => path(s), (p) => p === "/show", 10000);
    check("Alt+← goes back", afterKey === "/show", afterKey);
  }

  // Links to other sites go to the system browser: the app stays where it is, no new window.
  const windowsBefore = (await s.windows()).length;
  const here = await s.url();
  await s.exec(
    `for (const [id, target, top] of [["e2e-out", "", 10], ["e2e-out-blank", "_blank", 70]]) {
       const a = document.createElement("a"); a.id = id; a.href = "https://example.com/" + id; a.textContent = id;
       if (target) a.target = target;
       a.style.cssText = "position:fixed;left:10px;z-index:99999;padding:8px;background:#fff;top:" + top + "px";
       document.body.appendChild(a);
     }`,
  );
  await s.click(await s.find("#e2e-out"));
  await sleep(1500);
  check("a link to another site stays out of the app", (await s.url()) === here, await s.url());
  await s.exec("document.getElementById('e2e-out').remove()");
  await s.click(await s.find("#e2e-out-blank"));
  await sleep(1500);
  check("a new-tab link to another site doesn't open an app window", (await s.windows()).length === windowsBefore && (await s.url()) === here);
  await s.exec("document.getElementById('e2e-out-blank').remove()");

  // The stand-in for "open a blank tab first, send it somewhere later".
  const standIn = await s.exec("const w = window.open('about:blank', '_blank'); const ok = !!w && typeof w.close === 'function'; w && (w.location.href = 'https://example.com/later'); return ok;");
  await sleep(1000);
  check("window.open('about:blank') gives a working stand-in", standIn === true && (await s.url()) === here);

  // An app link from outside while the app runs: the running app opens the page.
  if (deepLink) {
    try {
      execSync(deepLink, { timeout: 30000, stdio: "ignore" });
    } catch (e) {
      console.log(`(the link command ended with ${e.status})`);
    }
    const linked = await s.until(() => path(s), (p) => p === "/show", 30000);
    check("an org.bojes.blob:// link from outside opens its page in the running app", linked === "/show", linked);
    await shot(s, "app-link");
  }

  // A Blob file opened with the running app (a second start with its path): the app reads it and
  // keeps it for the site, which takes it once (signed out nobody imports it, so the test can).
  if (openFile) {
    const text = openBlob("e2e note.blob", "E2E", "");
    const take = "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('take_opened_files').then((r) => done(r), (e) => done('refused: ' + e));";
    let taken = [];
    for (let i = 0; i < 20 && Array.isArray(taken) && !taken.length; i++) {
      await sleep(1000);
      taken = await s.execAsync(take);
    }
    const got = Array.isArray(taken) ? taken[0] : null;
    check("a Blob file opened with the app reaches the site (take_opened_files)", got && got.name === "e2e note.blob" && got.text === text, Array.isArray(taken) ? taken.map((f) => f.name) : taken);
    const again = await s.execAsync(take);
    check("each opened file is handed over once", Array.isArray(again) && again.length === 0, again);
  }

  if (email && password) {
    // Signed in from an earlier start (the app keeps its session), or sign in now.
    await s.go(site + "/login");
    const form = await s.until(() => s.exec("return document.querySelector('input[type=email]') ? 'form' : location.pathname"), (v) => v === "form" || v === "/home", 30000);
    if (form === "form") {
      await s.type(await s.find("input[type=email]"), email);
      await s.type(await s.find("input[type=password]"), password + "\uE007");
    } else note("already signed in from an earlier start", form);
    const home = await s.until(() => path(s), (p) => p.startsWith("/home") || p.startsWith("/onboarding"), 30000);
    check("signed in inside the app", home.startsWith("/home") || home.startsWith("/onboarding"), home);
    await settled(s, "signed in home");

    for (const p of ["/notes", "/tasks", "/calendar", "/projects", "/learn", "/learn/maths", "/cv", "/blob", "/settings"]) {
      await s.go(site + p);
      await settled(s, `app ${p}`);
    }

    // A new note: typing works in the editor.
    await s.go(site + "/notes");
    await settled(s, "notes again");
    const newNote = (await s.findAll("button")).length;
    const made = await s.exec(
      "const b = [...document.querySelectorAll('button')].find((x) => /^(New note|Neue Notiz)$/.test(x.textContent.trim())); if (b) { b.click(); return true } return false;",
    );
    note("buttons on the notes page", newNote);
    if (made) {
      const editor = await s.until(() => s.exec("return !!document.querySelector('.ProseMirror')"), (v) => v === true, 20000);
      check("a new note opens the editor", editor === true);
      if (editor === true) {
        const pm = await s.find(".ProseMirror");
        await s.click(pm);
        await s.type(pm, "Hello from the Blob app");
        await sleep(800);
        const text = await s.exec("return document.querySelector('.ProseMirror').innerText");
        check("typing in a note works", text.includes("Hello from the Blob app"), text.slice(0, 80));
        await shot(s, "note-typed");
      }
    } else check("the notes page has a New note button", false);

    // Signed in, a Blob file opened with the app comes in as a note, and the note opens.
    if (openFile) {
      openBlob("Opened in the app.blob", "Opened in the app", "This note came from a Blob file.");
      const imported = await s.until(
        () => s.exec("return location.pathname.startsWith('/p/') && document.querySelector('.ProseMirror') ? document.querySelector('.ProseMirror').innerText : ''"),
        (t) => t.includes("This note came from a Blob file."),
        45000,
        1000,
      );
      check("a Blob file opened with the app comes in as a note and opens", imported.includes("This note came from a Blob file."), imported.slice(0, 80));
      await shot(s, "opened-blob-file");
    }

    // The phone-sized layout inside the desktop app.
    await s.setSize(420, 860);
    for (const p of ["/home", "/learn", "/notes"]) {
      await s.go(site + p);
      await settled(s, `narrow ${p}`, { wide: false });
    }
    await s.setSize(1280, 820);
  } else {
    console.log("(signed-in checks skipped: set BLOB_E2E_EMAIL and BLOB_E2E_PASSWORD)");
  }
} catch (e) {
  check("the run finished", false, e.message);
  await shot(s, "crash");
} finally {
  await s.end();
}

writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
