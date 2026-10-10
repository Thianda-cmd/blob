// The app's start page: Blob, while the app checks it can reach the site, then the site itself.
// Without internet: a friendly screen that tries again by itself when the connection is back.
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

  function go() {
    if (busy) return;
    busy = true;
    show("loading");
    reachable().then(function (ok) {
      if (!ok) {
        busy = false;
        show("offline");
        return;
      }
      target().then(function (to) {
        location.replace(to);
      });
    });
  }

  document.getElementById("retry").addEventListener("click", go);
  window.addEventListener("online", go);
  go();
})();
