/* Authors page: student authors who applied from the learner panel
   (data/authors.json, written by api/_lib/learn.js). Same card style as the
   other authors; each gets #student-<id> so the panel can link to it. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var safe = function (u) { return /^https:\/\/www\.(linkedin|instagram)\.com\//.test(u || "") ? u : ""; };
  fetch("/data/authors.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    if (!Array.isArray(list) || !list.length) return;
    var cta = document.querySelector(".au-cta"), at = cta || document.querySelector("footer");
    var html = list.map(function (a) {
      var id = "student-" + String(a.id).replace(/[^a-f0-9]/g, ""), topics = String(a.topics || "").split(/[,·|]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 5);
      return '<section class="au-sec" id="' + id + '" aria-labelledby="' + id + '-h"><div class="au-in"><article class="au-jc">' +
        (a.photo ? '<div class="au-pic"><img src="' + esc(a.photo) + '" alt="' + esc(a.name) + ", " + esc(a.title) + '" width="600" height="600" loading="lazy" decoding="async"></div>' : "") +
        '<div class="au-tx"><span class="au-lb">' + esc(a.title) + '</span><h2 id="' + id + '-h" class="au-nm">' + esc(a.name) + "</h2>" +
        '<p class="au-bio">' + esc(a.bio) + "</p>" + (topics.length ? '<div class="au-tp"><b>Writes about</b>' + topics.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" : "") +
        '<div class="au-posts"><b>Articles</b><p class="au-none">' + (a.status === "approved" ? "New articles by " + esc(String(a.name).split(" ")[0]) + " will appear here." : "Learning at eBuddha Digitech · first article coming soon.") + "</p></div>" +
        (safe(a.linkedin) ? '<a class="au-li" href="' + esc(a.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a> ' : "") +
        (safe(a.instagram) ? '<a class="au-li" style="background:linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)" href="' + esc(a.instagram) + '" target="_blank" rel="noopener">Instagram</a>' : "") +
        '<span class="au-m">eBuddha Digitech student author</span></div></article></div></section>';
    }).join("");
    if (at && at.parentNode) at.insertAdjacentHTML("beforebegin", html);
    if (/^#student-/.test(location.hash)) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }).catch(function () {});
})();
