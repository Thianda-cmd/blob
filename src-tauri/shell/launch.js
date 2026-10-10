// The app's start page: Blob, while the app checks it can reach the site, then the site itself.
// Without internet: a friendly screen that tries again by itself when the connection is back.
(function () {
  var app = window.__BLOB_APP__ || {};
  var site = app.site || "https://blob.bojes.org/";
  // A page from a blob:// link (checked by the app), else the home page (sign-in when signed out).
  var target = app.start || new URL("/home", site).href;
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

  function go() {
    if (busy) return;
    busy = true;
    show("loading");
    reachable().then(function (ok) {
      busy = false;
      if (ok) location.replace(target);
      else show("offline");
    });
  }

  document.getElementById("retry").addEventListener("click", go);
  window.addEventListener("online", go);
  go();
})();
