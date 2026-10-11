// The app's start page: Blob, while the app checks it can reach the site, then the site itself.
// Without internet: the site anyway when it keeps offline copies on this device (public/sw.js on
// the site answers then), else a friendly screen that tries again until the connection is back.
(function () {
  var app = window.__BLOB_APP__ || {};
  var site = app.site || "https://blob.bojes.org/";
  var home = new URL("/home", site).href;
  var lang = (navigator.language || "en").toLowerCase().indexOf("de") === 0 ? "de" : "en";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-en]").forEach(function (el) {
    el.textContent = el.getAttribute("data-" + lang);
  });

  var loading = document.getElementById("loading");
  var offline = document.getElementById("offline");
  var busy = false;
  var again = 0;

  function show(state) {
    loading.hidden = state !== "loading";
    offline.hidden = state !== "offline";
  }

  // Any answer from the site counts (no-cors: we don't need to read it).
  function reachable() {
    if (navigator.onLine === false) return Promise.resolve(false);
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);
    return fetch(new URL("/icon.svg", site).href, { mode: "no-cors", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  // Where to go, asked at the last moment: a page from an app link (checked by the app, which may
  // have got it while this page was already up), else the home page (sign-in when signed out).
  function target() {
    var ipc = window.__TAURI_INTERNALS__;
    if (!ipc || typeof ipc.invoke !== "function") return Promise.resolve(home);
    return ipc.invoke("start_target").then(
      function (to) {
        return typeof to === "string" && to.indexOf(site) === 0 ? to : home;
      },
      function () {
        return home;
      },
    );
  }

  // Whether the site said it can start without a connection (its offline copies are on this device).
  function offlineReady() {
    var ipc = window.__TAURI_INTERNALS__;
    if (!ipc || typeof ipc.invoke !== "function") return Promise.resolve(false);
    return ipc.invoke("offline_ready").then(
      function (ready) {
        return ready === true;
      },
      function () {
        return false;
      },
    );
  }

  // While the offline screen shows, it quietly checks again every few seconds: a connection that
  // is just slow to start (a phone waking up, a train) never fires "online".
  function later() {
    clearTimeout(again);
    again = setTimeout(function () {
      if (busy) return;
      reachable().then(function (ok) {
        if (ok) go();
        else later();
      });
    }, 5000);
  }

  function go() {
    if (busy) return;
    busy = true;
    clearTimeout(again);
    show("loading");
    reachable().then(function (ok) {
      if (ok) return leave();
      offlineReady().then(function (ready) {
        if (ready) return leave();
        busy = false;
        show("offline");
        later();
      });
    });
  }

  function leave() {
    target().then(function (to) {
      location.replace(to);
    });
  }

  document.getElementById("retry").addEventListener("click", go);
  window.addEventListener("online", go);
  go();
})();
