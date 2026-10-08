/* Site-wide marketing tools set in the admin panel (Marketing tools):
   announcement bar, WhatsApp chat button and lead popup. Settings come from
   /eb-site.json. Everything renders inside shadow roots so the page's own CSS
   can't change it, and it is re-attached if a React page re-renders <body>. */
(function () {
  "use strict";
  if (window.__ebSite) return; window.__ebSite = 1;
  var path = location.pathname.replace(/\/+$/, "") || "/";
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function sess(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { u = String(u || "").trim(); return /^(https?:|\/|#|mailto:|tel:)/i.test(u) ? u : "#"; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  /* Is this tool switched on, inside its dates, and allowed on this page? */
  function live(o) {
    if (!o || !o.enabled) return false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (o.start && new Date(o.start + "T00:00:00") > today) return false;
    if (o.end && new Date(o.end + "T00:00:00") < today) return false;
    var list = String(o.paths || "").split(/[\s,]+/).filter(Boolean).map(function (p) { return p.replace(/\/+$/, "") || "/"; });
    var hit = list.some(function (p) { return p.slice(-1) === "*" ? path.indexOf(p.slice(0, -1)) === 0 : path === p; });
    if (o.show === "only") return hit;
    if (o.show === "except") return !hit;
    return true;
  }
  function host(id, css, html, first) {
    var h = document.getElementById(id);
    if (!h) { h = document.createElement("div"); h.id = id; h.attachShadow({ mode: "open" }); }
    h.shadowRoot.innerHTML = "<style>:host{all:initial}*{box-sizing:border-box;font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif}" + css + "</style>" + html;
    if (first) document.body.insertBefore(h, document.body.firstChild); else document.body.appendChild(h);
    return h;
  }

  var cfg = null, built = {};
  function bar(o) {
    var key = "eb-bar-" + hash((o.text || "") + (o.linkText || ""));
    if (o.dismissible !== false && store(key)) return;
    var h = host("eb-site-bar",
      ".b{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 44px 10px 16px;font-size:14px;line-height:1.4;text-align:center;position:relative;background:" + (o.bg || "#002CCD") + ";color:" + (o.color || "#fff") + "}" +
      ".b a{color:inherit;font-weight:700;text-decoration:underline;white-space:nowrap}.x{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer;opacity:.8}.x:hover{opacity:1;background:rgba(255,255,255,.15)}",
      '<div class="b" role="region" aria-label="Announcement"><span>' + esc(o.text) + "</span>" + (o.linkText && o.linkUrl ? '<a href="' + esc(safeUrl(o.linkUrl)) + '">' + esc(o.linkText) + "</a>" : "") +
      (o.dismissible === false ? "" : '<button class="x" aria-label="Close announcement">&times;</button>') + "</div>", true);
    var x = h.shadowRoot.querySelector(".x");
    if (x) x.onclick = function () { store(key, "1"); h.remove(); built.bar = "closed"; layout(); };
    built.bar = h;
    layout();
  }
  /* The bar is pinned to the top and the page is pushed down by its height.
     Headers positioned at the very top (absolute to the page or fixed to the
     screen; some switch between the two while scrolling) are moved down by the
     same amount, so the bar never covers them. Re-checked on scroll/resize and
     when React re-renders. */
  var shifted = [], baseMargin = null, barH = 0;
  function reset() {
    shifted.forEach(function (el) { el.style.removeProperty("top"); });
    shifted = [];
    document.body.style.removeProperty("margin-top");
  }
  function layout() {
    var h = built.bar && built.bar !== "closed" && document.contains(built.bar) ? built.bar : null;
    if (!h) { reset(); return; }
    h.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483001";
    barH = h.getBoundingClientRect().height;
    if (baseMargin === null) baseMargin = parseFloat(getComputedStyle(document.body).marginTop) || 0;
    document.body.style.setProperty("margin-top", baseMargin + barH + "px", "important");
    shifted = shifted.filter(function (el) { return document.contains(el); });
    shifted.forEach(function (el) { el.style.setProperty("top", barH + "px", "important"); });
    var cands = document.querySelectorAll("body > *, body > * > *, body > * > * > *, header, nav, [class*='header'], [class*='navbar'], [class*='topbar']");
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (shifted.indexOf(el) > -1 || /^eb-site-/.test(el.id || "")) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute" && cs.position !== "sticky") continue;
      if (cs.position === "absolute" && el.offsetParent && el.offsetParent !== document.body && el.offsetParent !== document.documentElement) continue;
      if (!(parseFloat(cs.top) <= 1)) continue;
      var r = el.getBoundingClientRect();
      if (!r.height || r.height > innerHeight / 2) continue;
      el.style.setProperty("top", barH + "px", "important");
      shifted.push(el);
    }
  }
  var raf = 0;
  function relayout() { if (raf || !(built.bar && built.bar !== "closed")) return; raf = requestAnimationFrame(function () { raf = 0; layout(); }); }
  window.addEventListener("resize", relayout);
  window.addEventListener("scroll", relayout, { passive: true });
  function wa(o) {
    var num = String(o.number || "").replace(/\D/g, ""); if (!num) return;
    var url = "https://wa.me/" + num + (o.message ? "?text=" + encodeURIComponent(o.message) : "");
    var side = o.position === "left" ? "left" : "right";
    built.wa = host("eb-site-wa",
      "a{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;display:flex;align-items:center;gap:10px;height:56px;padding:0 18px 0 14px;border-radius:999px;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 8px 24px rgba(37,211,102,.4);transition:transform .15s}" +
      "a:hover{transform:translateY(-2px)}svg{width:28px;height:28px;flex:0 0 auto}a.round{width:56px;padding:0;justify-content:center}@media(max-width:600px){a{bottom:16px;" + side + ":16px}}",
      '<a href="' + esc(url) + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"' + (o.label ? "" : ' class="round"') + '><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 1.9 6.8L3 29l6.7-2.1c1.9 1 4.1 1.6 6.3 1.6 7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-2 0-3.9-.6-5.5-1.6l-.4-.2-4 1.2 1.3-3.9-.3-.4c-1.1-1.7-1.7-3.6-1.7-5.6C5.4 9.9 10.2 5.2 16 5.2s10.6 4.7 10.6 10.6S21.8 26.2 16 26.2zm5.8-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.6-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.3 1.6.2 2.2.1.7-.1 1.9-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.2-.3-.3-.6-.4z"/></svg>' + (o.label ? "<span>" + esc(o.label) + "</span>" : "") + "</a>");
  }
  function popup(o) {
    var key = "eb-pop-" + hash((o.title || "") + (o.text || ""));
    var freq = o.frequency || "session";
    if (freq === "once" && store(key)) return;
    if (freq === "day" && store(key) && Date.now() - +store(key) < 864e5) return;
    if (freq === "session" && sess(key)) return;
    var shown = false;
    function show() {
      if (shown) return; shown = true;
      store(key, String(Date.now())); sess(key, "1");
      var h = host("eb-site-pop",
        ".ov{position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:f .2s ease}@keyframes f{from{opacity:0}}" +
        ".m{position:relative;width:min(440px,100%);background:#fff;color:#0F172A;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:p .22s ease}@keyframes p{from{transform:translateY(10px) scale(.98);opacity:0}}" +
        "img{display:block;width:100%;max-height:220px;object-fit:cover}.c{padding:24px}h2{margin:0 0 8px;font:600 22px/1.25 Poppins,Inter,sans-serif}p{margin:0 0 18px;color:#475569;font-size:15px;line-height:1.6}" +
        ".go{display:block;text-align:center;background:#002CCD;color:#fff;text-decoration:none;font-weight:600;padding:13px;border-radius:11px}.go:hover{background:#0023A8}" +
        ".x{position:absolute;right:10px;top:10px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.9);color:#0F172A;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)}",
        '<div class="ov" role="dialog" aria-modal="true" aria-label="' + esc(o.title || "Offer") + '"><div class="m"><button class="x" aria-label="Close">&times;</button>' + (o.image ? '<img src="' + esc(safeUrl(o.image)) + '" alt="">' : "") +
        '<div class="c"><h2>' + esc(o.title) + "</h2>" + (o.text ? "<p>" + esc(o.text) + "</p>" : "") + (o.buttonText ? '<a class="go" href="' + esc(safeUrl(o.buttonUrl)) + '">' + esc(o.buttonText) + "</a>" : "") + "</div></div></div>");
      var sr = h.shadowRoot;
      function close() { h.remove(); document.removeEventListener("keydown", k); }
      function k(e) { if (e.key === "Escape") close(); }
      sr.querySelector(".x").onclick = close;
      sr.querySelector(".ov").onclick = function (e) { if (e.target === this) close(); };
      document.addEventListener("keydown", k);
    }
    if (o.trigger === "exit") {
      document.addEventListener("mouseout", function (e) { if (!e.relatedTarget && e.clientY < 10) show(); });
      setTimeout(show, 45000);   // phones have no exit intent
    } else if (o.trigger === "scroll") {
      window.addEventListener("scroll", function s() {
        var d = document.documentElement, p = (d.scrollTop + innerHeight) / d.scrollHeight * 100;
        if (p >= (+o.scroll || 50)) { window.removeEventListener("scroll", s); show(); }
      }, { passive: true });
    } else setTimeout(show, (+o.delay || 8) * 1000);
  }

  /* Build once, then put things back if React replaces the page. */
  function build() {
    if (!cfg || !document.body) return;
    if (live(cfg.bar) && built.bar !== "closed") {
      if (!(built.bar && document.contains(built.bar))) bar(cfg.bar);
      else layout();   // picks up headers React re-rendered
    }
    if (live(cfg.whatsapp) && !(built.wa && document.contains(built.wa))) wa(cfg.whatsapp);
  }
  fetch("/eb-site.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    cfg = c; if (!cfg) return;
    build();
    if (live(cfg.popup)) popup(cfg.popup);
    var n = 0, t = setInterval(function () { build(); if (++n > 20) clearInterval(t); }, 1000);
  }).catch(function () {});
})();
