// Blob's offline helper, registered only inside the Blob apps (src/lib/offline/register.ts).
//
// Pages: from the network first; when there is none, the copy from the last visit (or from the
// background warm-up), else /offline. Next's own files: from the cache first (their names change
// with every release). Data never goes through here: it comes from Supabase, and the app keeps
// its own copy (src/lib/offline). Everything is wiped when someone signs out.

const VERSION = "1";
const PAGES = `blob-pages-${VERSION}`;
const ASSETS = `blob-assets-${VERSION}`;
const META = `blob-meta-${VERSION}`;
const OFFLINE = "/offline";
const MAX_PAGES = 120;
const MAX_ASSETS = 600;
const NETWORK_WAIT = 9000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(new Request(OFFLINE, { credentials: "same-origin" })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("blob-") && ![PAGES, ASSETS, META].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Requests the worker leaves alone: sign-in, server routes, live reloading in development. */
function skip(url) {
  const p = url.pathname;
  return (
    p.startsWith("/api/") ||
    p.startsWith("/auth/") ||
    p.startsWith("/oauth/") ||
    p.startsWith("/admin") ||
    p === "/sw.js" ||
    p.startsWith("/_next/webpack-hmr") ||
    p.startsWith("/__nextjs") ||
    p.startsWith("/sdk/")
  );
}

/** A request for a page's React Server Components data (a navigation inside the site). */
const isRsc = (req, url) => req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || skip(url)) return;
  if (req.mode === "navigate") {
    event.respondWith(page(req, url));
    return;
  }
  // Without a connection this fails, and Next then loads the page in full: that one comes from here.
  if (isRsc(req, url)) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (/\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|css|js)$/.test(url.pathname)) event.respondWith(fresh(req));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

/** A page: the network, then the copy from before, then the offline page. */
async function page(req, url) {
  if (self.navigator.onLine !== false) {
    try {
      const res = await Promise.race([fetch(req), timeout(NETWORK_WAIT)]);
      if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) void keep(url, res.clone());
      return res;
    } catch {
      // No connection: the copy from before.
    }
  }
  const cache = await caches.open(PAGES);
  const hit = (await cache.match(url.href)) || (await cache.match(url.origin + url.pathname, { ignoreSearch: true }));
  if (hit) return hit;
  // A note this device has a copy of opens from that copy.
  const note = /^\/p\/([0-9a-f-]{36})$/i.exec(url.pathname);
  if (note && (await cache.match(url.origin + "/notes/offline", { ignoreSearch: true }))) {
    return Response.redirect(new URL(`/notes/offline?id=${note[1]}`, url.origin).href, 302);
  }
  const offline = await cache.match(OFFLINE);
  if (offline) return offline;
  return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Blob</title><p style='font:16px system-ui;padding:24px'>Offline.</p>", {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "x-blob-offline": "1" },
  });
}

/** Keeps a page for later, with the files it needs and its title (for the offline page's list). */
async function keep(url, res) {
  // A signed-out page (the sign-in form) is never kept in place of the real one.
  if (url.pathname === "/login" || url.pathname === "/signup") return;
  const html = await res.clone().text();
  if (/<meta[^>]+name="blob-no-offline"/.test(html)) return;
  const cache = await caches.open(PAGES);
  await cache.put(url.href, res);
  if (url.search) await cache.put(url.origin + url.pathname, new Response(html, { headers: res.headers }));
  await trim(PAGES, MAX_PAGES);
  await remember(url, html);
  await fetchAssets(html);
}

/** The offline page lists what can be opened: path → title. */
async function remember(url, html) {
  const m = /<title>([^<]*)<\/title>/.exec(html);
  const title = m ? m[1].replace(/\s*·\s*Blob\s*$/, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">") : url.pathname;
  const meta = await caches.open(META);
  const index = (await (await meta.match("/__blob/pages"))?.json().catch(() => null)) || {};
  index[url.pathname] = { title, at: Date.now() };
  await meta.put("/__blob/pages", new Response(JSON.stringify(index), { headers: { "content-type": "application/json" } }));
}

/** The scripts, styles and fonts a page names (also those only named in its React data). */
async function fetchAssets(html) {
  const found = new Set();
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) found.add(m[0]);
  const cache = await caches.open(ASSETS);
  const css = [];
  await Promise.all(
    [...found].map(async (path) => {
      if (await cache.match(path)) return;
      try {
        const res = await fetch(path, { credentials: "same-origin" });
        if (!res.ok) return;
        if (path.endsWith(".css")) css.push(await res.clone().text());
        await cache.put(path, res);
      } catch {
        // Next time.
      }
    }),
  );
  // Fonts named by the styles.
  for (const text of css) {
    for (const m of text.matchAll(/url\((\/_next\/static\/media\/[^)]+)\)/g)) {
      if (await cache.match(m[1])) continue;
      try {
        const res = await fetch(m[1]);
        if (res.ok) await cache.put(m[1], res);
      } catch {
        // Next time.
      }
    }
  }
  await trim(ASSETS, MAX_ASSETS);
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) void cache.put(req, res.clone()).then(() => trim(ASSETS, MAX_ASSETS));
  return res;
}

/** Other files: the network, and the copy when there is none. */
async function fresh(req) {
  const cache = await caches.open(ASSETS);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") void cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    throw e;
  }
}

/** Drops the oldest entries above `max`. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function wipe() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("blob-")).map((k) => caches.delete(k)));
}

/** Loads pages in the background so they open without a connection later. */
async function warm(urls) {
  let done = 0;
  for (const href of urls) {
    try {
      const url = new URL(href, self.location.origin);
      if (url.origin !== self.location.origin || skip(url)) continue;
      const res = await Promise.race([fetch(url.href, { credentials: "same-origin", headers: { "x-blob-warm": "1" } }), timeout(20000)]);
      if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
        await keep(url, res);
        done++;
      }
    } catch {
      // Offline or slow: the next warm-up tries again.
    }
  }
  // The offline page itself (it may have changed with a release).
  try {
    const res = await fetch(OFFLINE, { credentials: "same-origin" });
    if (res.ok) {
      await (await caches.open(PAGES)).put(OFFLINE, res.clone());
      await fetchAssets(await res.text());
    }
  } catch {
    // Next time.
  }
  return done;
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const reply = (value) => event.ports[0]?.postMessage(value);
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(warm(data.urls.slice(0, 60)).then(reply, () => reply(0)));
  } else if (data.type === "wipe") {
    event.waitUntil(wipe().then(() => reply(true)));
  } else if (data.type === "user" && typeof data.id === "string") {
    // Another account signed in on this device: what the last one left behind goes first.
    event.waitUntil(
      (async () => {
        const meta = await caches.open(META);
        const known = await (await meta.match("/__blob/user"))?.text();
        if (known && known !== data.id) await wipe();
        await (await caches.open(META)).put("/__blob/user", new Response(data.id));
        reply(true);
      })(),
    );
  }
});
