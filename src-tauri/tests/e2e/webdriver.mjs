// A tiny W3C WebDriver client (Node 20+, no dependencies) for tauri-driver.
// https://www.w3.org/TR/webdriver2/

const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

export class Session {
  constructor(base, id) {
    this.base = base;
    this.id = id;
  }

  /**
   * Starts the app under tauri-driver (which starts WebKitWebDriver or msedgedriver), or with
   * `edge` straight under msedgedriver on Windows (the same capabilities tauri-driver would send).
   */
  static async start(base, application, { edge = false, timeoutMs = 120000 } = {}) {
    const caps = edge
      ? { browserName: "webview2", "ms:edgeChromium": true, "ms:edgeOptions": { binary: application, args: [] } }
      : { "tauri:options": { application } };
    const body = { capabilities: { alwaysMatch: caps } };
    const res = await request(base, "POST", "/session", body, timeoutMs);
    return new Session(base, res.sessionId);
  }

  cmd(method, path, body) {
    return request(this.base, method, `/session/${this.id}${path}`, body);
  }

  end() {
    return this.cmd("DELETE", "").catch(() => {});
  }

  /** Runs a script in the page and returns its value. */
  exec(script, ...args) {
    return this.cmd("POST", "/execute/sync", { script, args });
  }

  /** Runs an async script: it calls `arguments[arguments.length - 1]` with its result. */
  execAsync(script, ...args) {
    return this.cmd("POST", "/execute/async", { script, args });
  }

  go(url) {
    return this.cmd("POST", "/url", { url });
  }

  url() {
    return this.cmd("GET", "/url");
  }

  async find(css) {
    const el = await this.cmd("POST", "/element", { using: "css selector", value: css });
    return el[ELEMENT];
  }

  async findAll(css) {
    const els = await this.cmd("POST", "/elements", { using: "css selector", value: css });
    return els.map((e) => e[ELEMENT]);
  }

  click(el) {
    return this.cmd("POST", `/element/${el}/click`, {});
  }

  type(el, text) {
    return this.cmd("POST", `/element/${el}/value`, { text });
  }

  async screenshot() {
    return Buffer.from(await this.cmd("GET", "/screenshot"), "base64");
  }

  setSize(width, height) {
    return this.cmd("POST", "/window/rect", { width, height });
  }

  windows() {
    return this.cmd("GET", "/window/handles");
  }

  /** Waits until `probe()` gives a value `ok(value)` accepts; returns the last value. */
  async until(probe, ok, timeoutMs = 30000, stepMs = 400) {
    const end = Date.now() + timeoutMs;
    let last;
    while (Date.now() < end) {
      try {
        last = await probe();
        if (ok(last)) return last;
      } catch (e) {
        last = e;
      }
      await sleep(stepMs);
    }
    return last;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(base, method, path, body, timeoutMs = 60000) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.value && json.value.error)) {
    const v = json.value ?? {};
    throw new Error(`${method} ${path}: ${v.error ?? res.status} ${v.message ?? ""}`.trim());
  }
  return json.value;
}
