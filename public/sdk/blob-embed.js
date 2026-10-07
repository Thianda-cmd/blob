// Blob picture embeds: lets each <iframe data-blob-embed> grow with the picture inside it.
// Optional. Without this script the frame keeps the height it was given and scrolls.
(function () {
  if (window.__blobEmbed) return;
  window.__blobEmbed = true;
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.type !== "blob-embed-size" || typeof d.height !== "number" || !isFinite(d.height)) return;
    var frames = document.querySelectorAll("iframe[data-blob-embed]");
    for (var i = 0; i < frames.length; i++) {
      // Only the frame the message came from, and within sane bounds.
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.round(Math.min(Math.max(d.height, 160), 4000)) + "px";
    }
  });
})();
