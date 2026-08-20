/* ============================================================
   Calmlyte — shared page behaviour (product + learn pages).
   The homepage keeps its own inline script: it owns the intro
   gate, the mode switcher and the cart, none of which are shared.
   ============================================================ */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- scroll reveals (same threshold/easing as the homepage) ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.14 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- product gallery ----------
     Thumbnails swap the main image. Progressive: with JS off, or on a page with a
     single image, the main image still renders and the thumb strip is simply inert. */
  var main = document.getElementById("pdpMain");
  var thumbs = document.querySelectorAll(".pdp-thumb");
  if (main && thumbs.length > 1) {
    thumbs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var src = btn.getAttribute("data-full");
        var alt = btn.getAttribute("data-alt") || "";
        if (!src || main.getAttribute("src") === src) return;
        main.setAttribute("src", src);
        main.setAttribute("alt", alt);
        thumbs.forEach(function (t) { t.setAttribute("aria-current", t === btn ? "true" : "false"); });
      });
    });
  }
})();
