/* eBuddha admin panel: core helpers, login, layout and most screens.
   editor.js adds the visual page editor, blog.js the blog manager.

   The same screens run online (ebuddha.in/admin: every save is a GitHub
   commit that Vercel deploys) and on this computer (admin/server.js: saves go
   straight to the website folder). EB.mode is "github" or "local". */
(function () {
  "use strict";
  var EB = window.EB = { routes: {}, dirty: false };

  /* ================= helpers ================= */
  var esc = EB.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var $ = EB.$ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = EB.$$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var el = EB.el = function (html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* Every request goes to /api/admin?route=<name>&... */
  EB.url = function (route, params) {
    var q = new URLSearchParams(params || {}); q.set("route", route);
    return "/api/admin?" + q.toString();
  };
  EB.api = function (method, route, params, body, raw) {
    var opt = { method: method, headers: { "x-eb-admin": "1" }, credentials: "same-origin" };
    if (raw) { opt.body = raw.body; opt.headers["x-filename"] = encodeURIComponent(raw.name); }
    else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers["Content-Type"] = "application/json"; }
    return fetch(EB.url(route, params), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && ["login", "status", "password"].indexOf(route) < 0) { EB.authed = false; render(); }
        if (!r.ok) throw new Error(j.error || ("Request failed (" + r.status + ")"));
        return j;
      });
    });
  };
  EB.get = function (route, params) { return EB.api("GET", route, params); };
  EB.post = function (route, body, params) { return EB.api("POST", route, params, body === undefined ? {} : body); };
  EB.readFile = function (p) { return EB.get("file", { path: p }).then(function (r) { return r.content; }); };
  EB.readFileOr = function (p, fallback) { return EB.readFile(p).catch(function () { return fallback; }); };
  /* Saves one file. Online this is one commit (one deploy). */
  EB.writeFile = function (p, content, create, message) {
    return EB.post("file", { content: content, create: !!create, message: message }, { path: p }).then(EB.saved);
  };
  /* Saves several files together: changes [{path, content} | {path, delete: true}]. */
  EB.writeFiles = function (changes, message) { return EB.post("files", { changes: changes, message: message }).then(EB.saved); };
  EB.upload = function (file, dir) {
    return compress(file).then(function (f) {
      if (EB.mode === "github" && f.size > 4 * 1024 * 1024) throw new Error(f.name + " is larger than 4 MB. Compress it (e.g. squoosh.app) and try again.");
      return EB.api("POST", "upload", dir ? { dir: dir } : null, undefined, { body: f, name: f.name }).then(EB.saved);
    });
  };
  /* Large JPEG/PNG photos are resized to at most 2000px and converted to WebP
     before upload (Settings can turn this off). Smaller files, GIF, SVG and WebP
     are uploaded as they are. */
  function compress(file) {
    var on = (EB.pref ? EB.pref("eb-admin-compress") : null) !== "off";
    if (!on || !/^image\/(jpeg|png)$/.test(file.type) || file.size < 300 * 1024 || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(res, "image/webp", 0.82); });
    }).then(function (blob) {
      if (!blob || blob.size > file.size * 0.9) return file;
      EB.toast("Compressed " + file.name + ": " + EB.fmtSize(file.size) + " → " + EB.fmtSize(blob.size), "ok");
      return new File([blob], file.name.replace(/\.(jpe?g|png)$/i, "") + ".webp", { type: "image/webp" });
    }).catch(function () { return file; });
  }

  EB.toast = function (msg, type) {
    var t = el('<div class="toast ' + (type || "") + '"></div>'); t.textContent = msg;
    $("#toasts").appendChild(t); setTimeout(function () { t.remove(); }, type === "err" ? 7000 : 3500);
  };
  EB.fail = function (e) { EB.toast(e && e.message ? e.message : String(e), "err"); };

  /* ---------- "going live" indicator (online only) ---------- */
  var watching = null;
  EB.saved = function (r) {
    if (EB.mode === "github" && r && r.id && /^[a-f0-9]{40}$/.test(r.id)) watchDeploy(r.id);
    return r;
  };
  function liveBadge(state, text) {
    var v = $("#vst"); if (v && state && !EB.dirty) v.textContent = text;
    var b = $("#live"); if (!b) return;
    b.className = "live " + state; b.hidden = !state; $("span", b).textContent = text || "";
  }
  function watchDeploy(id) {
    watching = id; var tries = 0;
    liveBadge("deploying", "Saved · going live…");
    (function poll() {
      if (watching !== id) return;
      setTimeout(function () {
        if (watching !== id) return;
        EB.get("deploy-status", { id: id }).then(function (s) {
          if (s.state === "live") { liveBadge("ok", "Live on the website"); EB.toast("Your changes are live", "ok"); setTimeout(function () { if (watching === id) liveBadge(""); }, 8000); }
          else if (s.state === "failed") { liveBadge("bad", "Publishing failed"); EB.toast("Vercel couldn't publish this change. Open History → Deploys.", "err"); }
          else if (++tries < 60) poll();
          else liveBadge("bad", "Still publishing… check History");
        }).catch(function () { if (++tries < 60) poll(); });
      }, tries ? 6000 : 15000);
    })();
  }

  EB.fmtTime = function (t) {
    if (!t) return "—";
    var d = (Date.now() - t) / 1000;
    if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + " min ago";
    if (d < 86400) return Math.floor(d / 3600) + " h ago"; if (d < 604800) return Math.floor(d / 86400) + " d ago";
    return new Date(t).toLocaleDateString();
  };
  EB.fmtSize = function (n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB"; };
  EB.parse = function (html) { return new DOMParser().parseFromString(html, "text/html"); };
  EB.serialize = function (doc) { return (doc.doctype ? "<!DOCTYPE " + doc.doctype.name + ">" : "") + doc.documentElement.outerHTML; };
  EB.urlFor = function (p) { return "/" + p.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, ""); };
  /* Image address for thumbnails: the live file, or straight from storage if it
     was just uploaded and isn't deployed yet. */
  EB.imgFallback = function (img, p) { img.onerror = function () { img.onerror = null; img.src = EB.url("raw", { path: p.replace(/^\//, "") }); }; };

  /* Modal. actions: [{label, primary, danger, run(close, body) -> promise|false}] */
  EB.modal = function (o) {
    var ov = el('<div class="ov"><div class="mdl' + (o.wide ? " wide" : "") + '" role="dialog" aria-modal="true"><header><h2></h2><button class="x" aria-label="Close">&times;</button></header><div class="bd"></div><footer></footer></div></div>');
    $("h2", ov).textContent = o.title || "";
    var bd = $(".bd", ov);
    if (typeof o.body === "string") bd.innerHTML = o.body; else if (o.body) bd.appendChild(o.body);
    var ft = $("footer", ov);
    function close(v) { ov.remove(); document.removeEventListener("keydown", key); if (o.onClose) o.onClose(v); }
    function key(e) { if (e.key === "Escape") close(); }
    (o.actions || [{ label: "Close" }]).forEach(function (a) {
      var b = el('<button class="btn ' + (a.primary ? "primary" : a.danger ? "danger" : "") + '"></button>'); b.textContent = a.label;
      b.onclick = function () {
        if (!a.run) return close();
        b.disabled = true;
        Promise.resolve().then(function () { return a.run(close, bd); }).then(function (r) { b.disabled = false; if (r !== false) close(r); })
          .catch(function (e) { b.disabled = false; EB.fail(e); });
      };
      ft.appendChild(b);
    });
    if (o.actions && !o.actions.length) ft.hidden = true;
    $(".x", ov).onclick = function () { close(); };
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", key);
    document.body.appendChild(ov);
    var first = $("input,textarea,select", bd); if (first) setTimeout(function () { first.focus(); }, 30);
    return { el: ov, body: bd, close: close };
  };
  EB.confirm = function (msg, ok, danger) {
    return new Promise(function (res) {
      EB.modal({ title: "Please confirm", body: "<p>" + msg + "</p>", onClose: function (v) { res(v === true); },
        actions: [{ label: "Cancel" }, { label: ok || "OK", primary: !danger, danger: !!danger, run: function (close) { close(true); return false; } }] });
    });
  };
  EB.prompt = function (title, label, value) {
    return new Promise(function (res) {
      EB.modal({ title: title, body: '<label class="f">' + esc(label) + '</label><input type="text" id="pv" value="' + esc(value || "") + '">', onClose: function (v) { res(typeof v === "string" ? v : null); },
        actions: [{ label: "Cancel" }, { label: "OK", primary: true, run: function (close, bd) { close($("#pv", bd).value.trim()); return false; } }] });
    });
  };

  /* Code editor: CodeMirror when the CDN loaded, a plain textarea otherwise. */
  EB.code = function (host, value, mode, onSave) {
    var modes = { html: "htmlmixed", htm: "htmlmixed", css: "css", js: "javascript", json: { name: "javascript", json: true }, xml: "xml", svg: "xml" };
    if (window.CodeMirror) {
      var cm = CodeMirror(host, { value: value || "", mode: modes[mode] || null, lineNumbers: true, lineWrapping: true, indentUnit: 2, tabSize: 2,
        extraKeys: { "Ctrl-S": function () { onSave && onSave(); }, "Cmd-S": function () { onSave && onSave(); } } });
      setTimeout(function () { cm.refresh(); }, 20);
      return { get: function () { return cm.getValue(); }, set: function (v) { cm.setValue(v); }, on: function (f) { cm.on("change", f); } };
    }
    var ta = el('<textarea class="code-ta" spellcheck="false"></textarea>'); ta.value = value || ""; host.appendChild(ta);
    ta.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); onSave && onSave(); } });
    return { get: function () { return ta.value; }, set: function (v) { ta.value = v; }, on: function (f) { ta.addEventListener("input", f); } };
  };

  /* ================= icons ================= */
  var I = EB.icons = {
    dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    pages: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    blog: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    media: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    replace: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 17h18"/>',
    seo: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
    redirect: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    learner: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    health: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    collapse: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    key: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
  };
  var ic = EB.ic = function (n) { return '<svg class="ico" viewBox="0 0 24 24">' + (I[n] || "") + "</svg>"; };

  /* ================= routing + layout ================= */
  var NAV = EB.nav = [
    ["Overview"], ["dashboard", "Dashboard", "dash"], ["health", "Site health", "health", "new"],
    ["Content"], ["pages", "Pages", "pages"], ["blog", "Blog posts", "blog"], ["media", "Media library", "media"], ["learner", "Learner dashboard", "learner"],
    ["Grow"], ["marketing", "Marketing tools", "megaphone", "new"], ["seo", "SEO & sitemap", "seo"], ["redirects", "Redirects", "redirect"],
    ["Site-wide"], ["replace", "Find & replace", "replace"], ["layout", "Header & footer", "layout"], ["inject", "Code injection", "code"],
    ["Advanced"], ["files", "All files", "files"], ["history", "History", "history"]
  ];
  EB.routeLabel = function (r) {
    var n = NAV.filter(function (x) { return x[0] === r; })[0];
    return n ? n[1] : { "blog-edit": "Blog posts", code: "All files", settings: "Settings", edit: "Visual editor" }[r] || "Dashboard";
  };

  /* ---------- theme (light / dark / system) + sidebar state ---------- */
  function pref(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  EB.pref = pref;
  function applyTheme() {
    var t = pref("eb-admin-theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var b = $("#themeBtn"); if (b) b.innerHTML = '<svg class="ico" viewBox="0 0 24 24">' + I[dark ? "sun" : "moon"] + "</svg>";
  }
  EB.applyTheme = applyTheme;
  applyTheme();
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ""), i = h.indexOf("?");
    return { route: (i < 0 ? h : h.slice(0, i)) || "dashboard", params: new URLSearchParams(i < 0 ? "" : h.slice(i + 1)) };
  }
  EB.go = function (route, params) { location.hash = "#/" + route + (params ? "?" + new URLSearchParams(params).toString() : ""); };
  EB.setDirty = function (v) { EB.dirty = !!v; };
  window.addEventListener("beforeunload", function (e) { if (EB.dirty) { e.preventDefault(); e.returnValue = ""; } });
  var lastHash = location.hash;
  window.addEventListener("hashchange", function () {
    if (EB.dirty && !confirm("You have unsaved changes. Leave without saving?")) { history.replaceState(null, "", lastHash); return; }
    EB.dirty = false; lastHash = location.hash; render();
  });

  var root;
  function render() {
    root = $("#root");
    if (!EB.authed) return renderAuth();
    var r = parseHash();
    var screen = EB.routes[r.route] || EB.routes.dashboard;
    if (screen.full) { root.innerHTML = ""; return screen(root, r.params); }
    if (!$(".app", root)) buildShell();
    var active = r.route === "blog-edit" ? "blog" : r.route === "code" ? "files" : r.route;
    $$(".side a[data-r]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-r") === active); });
    $("#crumb").innerHTML = esc(EB.routeLabel(active)) + (r.route === "blog-edit" ? " <span>/ " + (r.params.get("slug") ? "Edit post" : "New post") + "</span>" : r.route === "code" ? " <span>/ " + esc(r.params.get("path") || "") + "</span>" : "");
    $(".app").classList.remove("menu-open");
    var main = $("#main");
    main.innerHTML = '<div class="skel" style="height:34px;width:260px;margin-bottom:22px"></div><div class="skel" style="height:140px;margin-bottom:14px"></div><div class="skel" style="height:260px"></div>';
    window.scrollTo(0, 0);
    Promise.resolve().then(function () { return screen(main, r.params); }).catch(function (e) { EB.fail(e); main.innerHTML = '<div class="warn">' + esc(e.message || e) + "</div>"; });
  }

  function svg(n) { return '<svg viewBox="0 0 24 24">' + I[n] + "</svg>"; }
  function buildShell() {
    root.innerHTML = "";
    var nav = NAV.map(function (n) {
      return n.length === 1 ? '<div class="grp">' + n[0] + "</div>" : '<a href="#/' + n[0] + '" data-r="' + n[0] + '" title="' + esc(n[1]) + '">' + svg(n[2]) + '<span class="lbl">' + n[1] + "</span>" + (n[3] ? '<span class="new">NEW</span>' : "") + "</a>";
    }).join("");
    root.appendChild(el('<div class="app' + (pref("eb-admin-side") === "collapsed" ? " collapsed" : "") + '"><nav class="side" aria-label="Admin"><div class="logo"><img src="/ebuddha-logo.svg" alt="eBuddha"><span>Admin</span></div>' + nav +
      '<div class="bottom"><div class="live" id="live" hidden><i></i><span></span></div><a href="#/settings" data-r="settings" title="Settings">' + svg("settings") + '<span class="lbl">Settings</span></a>' +
      '<button class="nav collapse-btn" id="collapse" title="Collapse sidebar">' + svg("collapse") + '<span class="lbl">Collapse</span></button></div></nav>' +
      '<div class="wrap"><header class="topbar"><button class="btn icon ghost burger" id="burger" aria-label="Menu">' + ic("menu") + '</button><div class="crumb" id="crumb"></div>' +
      '<button class="searchbtn" id="searchBtn">' + ic("search") + '<span class="lbl">Search or jump to…</span><kbd>Ctrl K</kbd></button>' +
      '<a class="btn" href="/" target="_blank" title="View website">' + ic("ext") + '<span class="lbl">View site</span></a>' +
      '<button class="btn icon" id="themeBtn" title="Light / dark mode"></button>' +
      '<div class="rel"><button class="avatar" id="meBtn" aria-haspopup="true" aria-label="Account">A</button><div class="menu-pop" id="meMenu" hidden>' +
      '<a href="#/settings">' + ic("settings") + "Settings</a><button id=\"keysBtn\">" + ic("key") + 'Keyboard shortcuts</button><a href="/" target="_blank">' + ic("ext") + "View website</a><hr><button id=\"logout\">" + ic("logout") + "Log out</button></div></div>" +
      '</header><main class="main" id="main"></main></div></div>'));
    applyTheme();
    $("#themeBtn").onclick = function () { pref("eb-admin-theme", document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"); applyTheme(); };
    $("#collapse").onclick = function () { var a = $(".app"); a.classList.toggle("collapsed"); pref("eb-admin-side", a.classList.contains("collapsed") ? "collapsed" : "open"); };
    $("#burger").onclick = function () { $(".app").classList.toggle("menu-open"); };
    $("#searchBtn").onclick = function () { EB.palette(); };
    $("#meBtn").onclick = function (e) { e.stopPropagation(); $("#meMenu").hidden = !$("#meMenu").hidden; };
    document.addEventListener("click", function (e) { var m = $("#meMenu"); if (m && !e.target.closest("#meMenu")) m.hidden = true; if (!e.target.closest(".side") && !e.target.closest("#burger")) { var a = $(".app"); if (a) a.classList.remove("menu-open"); } });
    $("#keysBtn").onclick = function () { EB.shortcuts(); };
    $("#logout").onclick = function (e) { e.preventDefault(); EB.post("logout").then(function () { EB.authed = false; render(); }); };
  }

  /* ---------- command palette (Ctrl+K) ---------- */
  var ACTIONS = [
    ["New blog post", "plus", "#/blog-edit"], ["Edit homepage", "edit", "#/edit?path=index.html"], ["Upload images", "upload", "#/media"],
    ["Run site health check", "health", "#/health"], ["Announcement bar & WhatsApp button", "megaphone", "#/marketing"], ["Find & replace text", "replace", "#/replace"],
    ["Add a redirect", "redirect", "#/redirects"], ["Toggle dark mode", "moon", "theme"], ["Keyboard shortcuts", "key", "keys"], ["Log out", "logout", "logout"]
  ];
  var palData = null;
  EB.palette = function () {
    if ($(".pal")) return;
    var box = el('<div class="pal" role="dialog" aria-label="Search"><div class="box"><div class="in">' + ic("search") + '<input type="text" placeholder="Search pages, posts, screens and actions…" aria-label="Search"><kbd>Esc</kbd></div><div class="list"></div>' +
      '<div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div></div>');
    document.body.appendChild(box);
    var input = $("input", box), list = $(".list", box), items = [], idx = 0;
    function close() { box.remove(); document.removeEventListener("keydown", key, true); }
    function base() {
      var out = [];
      NAV.filter(function (n) { return n.length > 1; }).concat([["settings", "Settings", "settings"]]).forEach(function (n) { out.push({ sec: "Go to", t: n[1], i: n[2], go: "#/" + n[0] }); });
      ACTIONS.forEach(function (a) { out.push({ sec: "Actions", t: a[0], i: a[1], go: a[2] }); });
      if (palData) {
        palData.pages.forEach(function (p) { out.push({ sec: "Pages", t: p.title || p.path, sub: p.url, i: "pages", go: "#/edit?path=" + encodeURIComponent(p.path), qe: p.path }); });
        palData.posts.forEach(function (p) { out.push({ sec: "Blog posts", t: p.title, sub: "/blog/" + p.slug, i: "blog", go: "#/blog-edit?slug=" + encodeURIComponent(p.slug) }); });
      }
      return out;
    }
    function draw() {
      var q = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      items = base().filter(function (x) { var s = (x.t + " " + (x.sub || "") + " " + x.sec).toLowerCase(); return q.every(function (w) { return s.indexOf(w) > -1; }); }).slice(0, 60);
      idx = Math.min(idx, Math.max(0, items.length - 1));
      var sec = "";
      list.innerHTML = items.map(function (x, i) {
        var h = x.sec !== sec ? '<div class="sec">' + esc(x.sec) + "</div>" : ""; sec = x.sec;
        return h + '<div class="it' + (i === idx ? " on" : "") + '" data-i="' + i + '"><span class="ic">' + ic(x.i) + "</span><span>" + esc(x.t) + "</span>" + (x.sub ? "<small>" + esc(x.sub) + "</small>" : "") + "</div>";
      }).join("") || '<div class="empty">No results' + (palData ? "" : " yet — pages are still loading") + "</div>";
      var on = $(".it.on", list); if (on) on.scrollIntoView({ block: "nearest" });
    }
    function run(x) {
      if (!x) return; close();
      if (x.go === "theme") return $("#themeBtn") && $("#themeBtn").click();
      if (x.go === "keys") return EB.shortcuts();
      if (x.go === "logout") return EB.post("logout").then(function () { EB.authed = false; render(); });
      location.hash = x.go;
    }
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); run(items[idx]); }
    }
    document.addEventListener("keydown", key, true);
    input.oninput = function () { idx = 0; draw(); };
    list.onclick = function (e) { var it = e.target.closest("[data-i]"); if (it) run(items[+it.getAttribute("data-i")]); };
    list.onmousemove = function (e) { var it = e.target.closest("[data-i]"); if (it && +it.getAttribute("data-i") !== idx) { idx = +it.getAttribute("data-i"); draw(); } };
    box.addEventListener("mousedown", function (e) { if (e.target === box) close(); });
    draw(); input.focus();
    if (!palData) Promise.all([EB.get("pages"), EB.get("blog")]).then(function (r) { palData = { pages: r[0], posts: r[1] }; if (document.body.contains(box)) draw(); }).catch(function () {});
  };
  EB.shortcuts = function () {
    var k = [["Ctrl K", "Search and jump anywhere"], ["/", "Open search"], ["Ctrl S", "Save (editors)"], ["Ctrl Z", "Undo (visual editor)"], ["Esc", "Close dialogs, stop editing"], ["?", "Show these shortcuts"]];
    EB.modal({ title: "Keyboard shortcuts", body: '<table class="tbl" style="margin-top:8px"><tbody>' + k.map(function (x) { return "<tr><td>" + x[0].split(" ").map(function (s) { return "<kbd>" + s + "</kbd>"; }).join(" ") + "</td><td>" + x[1] + "</td></tr>"; }).join("") + "</tbody></table>" });
  };
  document.addEventListener("keydown", function (e) {
    if (!EB.authed) return;
    var t = e.target, typing = /^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); EB.palette(); }
    else if (!typing && !$(".ov") && !$(".pal") && e.key === "/") { e.preventDefault(); EB.palette(); }
    else if (!typing && !$(".ov") && !$(".pal") && e.key === "?") { e.preventDefault(); EB.shortcuts(); }
  });
  EB.render = render;
  var head = EB.head = function (title, sub, actions) {
    return '<div class="head"><div><h1>' + title + "</h1>" + (sub ? "<p>" + sub + "</p>" : "") + '</div><div class="spacer"></div>' + (actions || "") + "</div>";
  };

  /* ================= auth ================= */
  function renderAuth() {
    if (!EB.configured && !EB.canSetup) {
      root.innerHTML = '<div class="auth"><div class="authbox"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"><h1>Finish setting up the admin</h1>' +
        '<p class="hint">These settings are missing in Vercel: <b>' + esc(EB.missing.join(", ")) + '</b>.</p><ol class="steps">' +
        '<li>Open <b>vercel.com</b> → project <b>website-1</b> → <b>Settings</b> → <b>Environment Variables</b>.</li>' +
        "<li>Add <code>ADMIN_PASSWORD</code> (a long password only you know) and <code>GITHUB_TOKEN</code> (see the setup guide), for the Production environment.</li>" +
        "<li>Go to <b>Deployments</b>, open the menu on the latest one and choose <b>Redeploy</b>.</li></ol></div></div>";
      return;
    }
    var setup = !EB.configured;
    root.innerHTML = '<div class="auth"><form id="af" class="authbox"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"><h1>' + (setup ? "Create admin password" : "Admin login") + '</h1><p class="hint">' +
      (setup ? "First run: choose the password that protects this panel (8+ characters)." : "Enter your admin password.") + '</p>' +
      '<label class="f" for="pw">Password</label><input type="password" id="pw" autocomplete="' + (setup ? "new-password" : "current-password") + '" required>' +
      (setup ? '<label class="f" for="pw2">Repeat password</label><input type="password" id="pw2" autocomplete="new-password" required minlength="8">' : "") +
      '<button class="btn primary">' + (setup ? "Create & continue" : "Log in") + '</button><div class="err" id="er"></div></form></div>';
    setTimeout(function () { $("#pw").focus(); }, 30);
    $("#af").onsubmit = function (e) {
      e.preventDefault();
      var pw = $("#pw").value;
      if (setup && pw !== $("#pw2").value) { $("#er").textContent = "Passwords don't match"; return; }
      $("#er").textContent = "";
      EB.post(setup ? "setup" : "login", { password: pw }).then(function () { EB.authed = true; EB.configured = true; root.innerHTML = ""; render(); })
        .catch(function (err) { $("#er").textContent = err.message; });
    };
  }

  EB.start = function () {
    EB.get("status").then(function (s) {
      EB.authed = s.authed; EB.mode = s.mode; EB.site = s.site; EB.configured = s.configured; EB.missing = s.missing || []; EB.canSetup = s.canSetup;
      render();
    }).catch(function () { document.getElementById("root").innerHTML = "<p style='padding:40px'>The admin panel can't reach its server. If you're on this computer, start it with <code>node admin/server.js</code>.</p>"; });
  };

  /* ================= sitemap (pure helpers) ================= */
  EB.sitemap = {
    file: "sitemap-0.xml",
    base: function (xml) { var m = /<loc>(https?:\/\/[^/<]+)/.exec(xml); return m ? m[1] : "https://www.ebuddha.in"; },
    add: function (xml, url) {
      var full = this.base(xml) + (url === "/" ? "/" : url);
      return xml.indexOf("<loc>" + full + "</loc>") > -1 ? xml : xml.replace("</urlset>", "  <url><loc>" + full + "</loc></url>\n</urlset>");
    },
    remove: function (xml, url) {
      var full = this.base(xml) + url;
      return xml.replace(new RegExp("[ \\t]*<url><loc>" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</loc>[\\s\\S]*?</url>\\n?", "g"), "");
    },
    /* Returns the change to include in a save, or null if nothing changes. */
    change: function (fn) {
      var self = this;
      return EB.readFileOr(self.file, null).then(function (x) { if (x == null) return null; var y = fn(x); return y === x ? null : { path: self.file, content: y }; });
    }
  };

  /* ================= media picker ================= */
  EB.pickMedia = function () {
    return new Promise(function (resolve) {
      var body = el('<div><div class="drop">Drop images here or <label style="color:var(--brand-2);cursor:pointer">browse<input type="file" accept="image/*,video/mp4,application/pdf" multiple hidden></label> to upload</div>' +
        '<input type="search" placeholder="Search images by name or folder…" style="margin-bottom:12px"><div class="media"></div><div class="row" style="justify-content:center;margin-top:12px"><button class="btn sm more" hidden>Load more</button></div></div>');
      var m = EB.modal({ title: "Choose an image", body: body, wide: true, actions: [], onClose: function (v) { resolve(typeof v === "string" ? v : null); } });
      mediaGrid(body, function (url) { m.close(url); });
    });
  };

  /* Upload area + searchable grid. onPick(url, item) */
  function mediaGrid(host, onPick) {
    var grid = $(".media", host), search = $("input[type=search]", host), more = $(".more", host), drop = $(".drop", host), input = $("input[type=file]", host);
    var all = [], shown = 0, list = [];
    function load() { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Loading…</div>'; return EB.get("media").then(function (l) { all = l; filter(); }); }
    function filter() {
      var q = search.value.trim().toLowerCase();
      list = q ? all.filter(function (m) { return m.path.toLowerCase().indexOf(q) > -1; }) : all;
      grid.innerHTML = ""; shown = 0; page();
      if (!list.length) grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No images found</div>';
    }
    function page() {
      list.slice(shown, shown + 90).forEach(function (m) {
        var it = el('<div class="mi" tabindex="0" title="' + esc(m.path) + '"><div class="th"><img loading="lazy" alt=""></div><div class="nm"></div></div>');
        var img = $("img", it); EB.imgFallback(img, m.path); img.src = "/" + m.path;
        $(".nm", it).textContent = m.path.split("/").pop();
        it.onclick = function () { onPick("/" + m.path, m); };
        it.onkeydown = function (e) { if (e.key === "Enter") onPick("/" + m.path, m); };
        grid.appendChild(it);
      });
      shown += 90; more.hidden = shown >= list.length;
    }
    function up(files) {
      var arr = [].slice.call(files || []); if (!arr.length) return;
      EB.toast("Uploading " + arr.length + " file(s)…");
      arr.reduce(function (p, f) { return p.then(function () { return EB.upload(f); }); }, Promise.resolve())
        .then(function () { EB.toast("Uploaded", "ok"); search.value = ""; return load(); }).catch(EB.fail);
    }
    search.oninput = filter; more.onclick = page; input.onchange = function () { up(input.files); input.value = ""; };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = function () { drop.classList.remove("over"); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove("over"); up(e.dataTransfer.files); };
    return load();
  }
  EB.mediaGrid = mediaGrid;

  /* ================= Dashboard ================= */
  var DEPLOY = { live: ["green", "Live"], deploying: ["amber", "Going live…"], waiting: ["amber", "Waiting for Vercel"], failed: ["red", "Failed"], unknown: ["", "Unknown"] };
  EB.deployBadge = function (s) { var d = DEPLOY[s] || DEPLOY.unknown; return '<span class="badge ' + d[0] + '">' + d[1] + "</span>"; };
  /* Site health results are reused for a few minutes (the scan reads every page). */
  EB.health = function (fresh) {
    if (!fresh && EB._health && Date.now() - EB._health.t < 5 * 60e3) return Promise.resolve(EB._health.d);
    return EB.get("health").then(function (d) { EB._health = { t: Date.now(), d: d }; return d; });
  };
  EB.scoreColor = function (s) { return s >= 85 ? "var(--green)" : s >= 60 ? "var(--amber)" : "var(--red)"; };
  function qa(href, icon, title, sub) { return '<a class="qa" href="' + href + '"><span class="ic">' + ic(icon) + "</span><span><b>" + title + '</b><br><span class="u">' + sub + "</span></span></a>"; }
  EB.routes.dashboard = function (main) {
    return EB.get("overview").then(function (o) {
      var x = o.extra || {}, h = new Date().getHours();
      var publish = EB.mode === "github"
        ? (x.last ? '<div class="row" style="margin-top:8px">' + EB.deployBadge(x.deploy && x.deploy.state) + '<span class="u">' + EB.fmtTime(x.last.t) + "</span></div><p class=\"hint\" style=\"margin-top:8px\">" + esc(x.last.message.replace(/^Admin: /, "")) + "</p>" : '<p class="hint">No changes yet.</p>') + '<a class="btn sm" style="margin-top:12px" href="#/history?tab=deploys">Deploy history</a>'
        : (x.unpublished ? '<div class="row" style="margin-top:8px"><span class="badge amber">' + x.unpublished + ' unpublished</span></div><p class="hint" style="margin-top:8px">Changed on this computer only. Upload to GitHub to put them live.</p><a class="btn sm" style="margin-top:12px" href="#/history?tab=changes">See changes</a>'
          : '<div class="row" style="margin-top:8px"><span class="badge green">' + ic("check") + ' Everything published</span></div><p class="hint" style="margin-top:8px">No local changes waiting.</p>');
      main.innerHTML = '<section class="hero"><div style="flex:1;min-width:240px"><h1>' + (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening") + " 👋</h1><p>" +
        (EB.mode === "github" ? "Changes you save go live on ebuddha.in in about a minute." : "You're editing the website folder on this computer.") + ' Press <kbd>Ctrl K</kbd> to jump anywhere.</p></div>' +
        '<a class="btn" href="/" target="_blank">' + ic("ext") + 'View site</a><a class="btn primary" href="#/blog-edit">' + ic("plus") + "New post</a></section>" +
        '<div class="stats">' +
        '<div class="card stat"><div class="ic">' + ic("pages") + '</div><div><div class="v">' + o.pages + '</div><div class="l">Pages</div></div></div>' +
        '<div class="card stat"><div class="ic g">' + ic("blog") + '</div><div><div class="v">' + o.blog + '</div><div class="l">Blog posts</div></div></div>' +
        '<div class="card stat"><div class="ic a">' + ic("media") + '</div><div><div class="v">' + o.media + '</div><div class="l">Images</div></div></div>' +
        '<div class="card stat"><div class="ic v">' + ic("history") + '</div><div><div class="v">' + o.week + '</div><div class="l">Changes this week</div></div></div></div>' +
        '<div class="dgrid"><div class="card" id="dh"><h2>Site health</h2><div class="row" style="margin-top:14px"><div class="skel" style="width:92px;height:92px;border-radius:50%"></div><div style="flex:1"><div class="skel" style="height:14px;margin-bottom:8px"></div><div class="skel" style="height:14px;width:70%"></div></div></div></div>' +
        '<div class="card"><h2>Publishing</h2>' + publish + "</div>" +
        '<div class="card"><h2>Marketing tools</h2><p class="hint">Announcement bar, WhatsApp chat button and lead popup across the whole site.</p><a class="btn sm primary" style="margin-top:12px" href="#/marketing">' + ic("megaphone") + "Open marketing tools</a></div></div>" +
        '<div class="cols"><div class="card"><h2>Quick actions</h2><div class="quick">' +
        qa("#/blog-edit", "plus", "New blog post", "Write and publish") + qa("#/edit?path=index.html", "edit", "Edit homepage", "Drag & drop editor") +
        qa("#/pages", "pages", "Pages", "Quick edit URL, title, SEO") + qa("#/media", "upload", "Media library", "Upload & compress images") +
        qa("#/health", "health", "Site health", "Broken links & images") + qa("#/replace", "replace", "Find & replace", "Change text everywhere") +
        qa("#/layout", "layout", "Header & footer", "Menus on every page") + qa("#/learner", "learner", "Learner dashboard", "Courses, classes, jobs") + "</div></div>" +
        '<div class="card"><h2>Recent activity</h2><ul class="timeline">' +
        (o.recent.length ? o.recent.slice(0, 8).map(function (l) { return "<li>" + esc((l.message || ((l.action || "") + " " + (l.path || ""))).replace(/^Admin: /, "")) + "<span>" + EB.fmtTime(l.t) + (l.author ? " · " + esc(l.author) : "") + "</span></li>"; }).join("") : '<li>No changes yet<span>Edits you make will appear here</span></li>') +
        '</ul><a class="btn sm" style="margin-top:6px" href="#/history">All activity</a></div></div>';
      EB.health().then(function (d) {
        var box = $("#dh"); if (!box) return;
        var c = d.counts;
        box.innerHTML = '<div class="row"><h2>Site health</h2><span class="spacer"></span><a href="#/health" class="u">Details</a></div><div class="row" style="margin-top:14px;flex-wrap:nowrap"><div class="ring" style="--p:' + d.score + ";--c:" + EB.scoreColor(d.score) + '"><b>' + d.score + '</b></div><div class="u" style="line-height:1.9">' +
          '<div><b style="color:var(--ink)">' + c.brokenLinks + "</b> broken links</div><div><b style=\"color:var(--ink)\">" + c.missingImages + "</b> missing images</div><div><b style=\"color:var(--ink)\">" + c.hotlinked + "</b> images from other sites</div><div><b style=\"color:var(--ink)\">" + c.noAlt + "</b> images without alt text</div></div></div>";
      }).catch(function (e) { var box = $("#dh"); if (box) box.innerHTML = "<h2>Site health</h2><p class=\"hint\">" + esc(e.message) + "</p>"; });
    });
  };
  function logItem(l) {
    var text = l.message ? l.message.replace(/^Admin: /, "") : ((l.action || "") + " " + (l.path || ""));
    return "<li><span>" + esc(text) + (l.author ? ' <span class="u">· ' + esc(l.author) + "</span>" : "") + "</span><time>" + EB.fmtTime(l.t) + "</time></li>";
  }
  EB.logItem = logItem;

  /* ================= Pages ================= */
  EB.routes.pages = function (main) {
    var kind = "all", q = "";
    main.innerHTML = head("Pages", "Every page of the website. Edit visually, edit the code, or change SEO settings.", '<button class="btn primary" id="np">' + ic("plus") + "New page</button>") +
      '<div class="row" style="margin-bottom:14px"><div class="chips" id="kc"></div><div class="spacer"></div><input type="search" id="pq" placeholder="Search pages…" style="max-width:260px"></div><div class="card tw"><table class="tbl"><thead><tr><th>Page</th><th>Type</th><th></th></tr></thead><tbody id="pb"><tr><td colspan="3" class="empty">Loading pages…</td></tr></tbody></table></div>';
    var pages = [];
    function draw() {
      var list = pages.filter(function (p) { return (kind === "all" || p.kind === kind) && (!q || (p.title + " " + p.path).toLowerCase().indexOf(q) > -1); });
      $("#pb").innerHTML = list.map(function (p) {
        return '<tr><td><div class="t"><a href="#" data-qe="' + esc(p.path) + '" style="color:inherit">' + esc(p.title || "(no title) " + p.path) + '</a></div><div class="u"><a href="' + esc(p.url) + '" target="_blank">' + esc(p.url) + "</a></div></td>" +
          '<td><span class="badge ' + (p.kind === "course" ? "blue" : p.kind === "blog" ? "green" : "") + '">' + p.kind + "</span> " +
          (p.next ? '<span class="badge amber" title="Built with React. Text, link and image edits work; adding or moving sections does not.">React</span> ' : "") +
          (p.noindex ? '<span class="badge red">noindex</span>' : "") + "</td>" +
          '<td class="acts"><button class="btn sm" data-qe="' + esc(p.path) + '">' + ic("bolt") + 'Quick edit</button> <a class="btn sm primary" href="#/edit?path=' + encodeURIComponent(p.path) + '">Edit</a> <a class="btn sm" href="#/code?path=' + encodeURIComponent(p.path) + '">Code</a> ' +
          '<button class="btn sm" data-ver="' + esc(p.path) + '">History</button> <button class="btn sm" data-dup="' + esc(p.path) + '">Duplicate</button> ' +
          (p.path === "index.html" ? "" : '<button class="btn sm danger" data-del="' + esc(p.path) + '" aria-label="Delete">' + ic("trash") + "</button>") + "</td></tr>";
      }).join("") || '<tr><td colspan="3" class="empty">No pages match</td></tr>';
    }
    function load() { return EB.get("pages").then(function (l) { pages = l; draw(); }); }
    $("#kc").innerHTML = ["all", "page", "course", "blog", "legal"].map(function (k) { return '<button class="chip' + (k === kind ? " on" : "") + '" data-k="' + k + '">' + (k === "all" ? "All" : k[0].toUpperCase() + k.slice(1) + "s") + "</button>"; }).join("");
    $("#kc").onclick = function (e) { var b = e.target.closest("[data-k]"); if (!b) return; kind = b.getAttribute("data-k"); $$("#kc .chip").forEach(function (c) { c.classList.toggle("on", c === b); }); draw(); };
    $("#pq").oninput = function () { q = this.value.trim().toLowerCase(); draw(); };
    $("#pb").onclick = function (e) {
      var b;
      if ((b = e.target.closest("[data-qe]"))) { e.preventDefault(); EB.quickEdit(b.getAttribute("data-qe"), load); }
      else if ((b = e.target.closest("[data-ver]"))) EB.versions(b.getAttribute("data-ver"));
      else if ((b = e.target.closest("[data-dup]"))) newPage(pages, b.getAttribute("data-dup"));
      else if ((b = e.target.closest("[data-del]"))) {
        var p = b.getAttribute("data-del");
        EB.confirm("Delete <b>" + esc(p) + "</b>? You can bring it back from History → Deleted.", "Delete", true).then(function (ok) {
          if (!ok) return;
          var target = /\/index\.html$/.test(p) ? p.replace(/\/index\.html$/, "") : p;
          EB.sitemap.change(function (x) { return EB.sitemap.remove(x, EB.urlFor(p)); }).then(function (sm) {
            return EB.writeFiles([{ path: target, delete: true }].concat(sm ? [sm] : []), "Admin: delete " + target);
          }).then(function () { EB.toast("Page deleted", "ok"); load(); }).catch(EB.fail);
        });
      }
    };
    $("#np").onclick = function () { newPage(pages); };
    return load();
  };

  function newPage(pages, from) {
    var opts = pages.filter(function (p) { return p.kind !== "blog"; }).map(function (p) { return '<option value="' + esc(p.path) + '">' + esc(p.title || p.path) + " (" + esc(p.url) + ")</option>"; }).join("");
    var m = EB.modal({ title: from ? "Duplicate page" : "New page", body:
      '<label class="f">Start from (copy of)</label><select id="nf">' + opts + '</select><p class="hint">Pick the page whose design is closest to what you need, then change its content in the visual editor.</p>' +
      '<label class="f">Page title</label><input type="text" id="nt" placeholder="e.g. Data Analytics Course">' +
      '<label class="f">Page address</label><div class="row" style="flex-wrap:nowrap"><span class="u mono">ebuddha.in/</span><input type="text" id="ns" placeholder="data-analytics-course"></div>' +
      '<label class="check"><input type="checkbox" id="nm" checked>Add to sitemap</label>',
      actions: [{ label: "Cancel" }, { label: "Create & edit", primary: true, run: function (close, bd) {
        var slug = $("#ns", bd).value.trim().toLowerCase().replace(/[^a-z0-9/-]+/g, "-").replace(/^[-/]+|[-/]+$/g, "");
        var title = $("#nt", bd).value.trim();
        if (!slug) throw new Error("Enter a page address");
        if (pages.some(function (p) { return p.url === "/" + slug; })) throw new Error("A page already exists at /" + slug);
        var to = slug + "/index.html", addMap = $("#nm", bd).checked;
        return EB.readFile($("#nf", bd).value).then(function (html) {
          var doc = EB.parse(html);
          if (title) {
            doc.title = title;
            ["meta[property='og:title']", "meta[name='twitter:title']"].forEach(function (s) { var m = doc.querySelector(s); if (m) m.setAttribute("content", title); });
          }
          var c = doc.querySelector("link[rel=canonical]"); if (c) c.setAttribute("href", c.getAttribute("href").replace(/^(https?:\/\/[^/]+).*$/, "$1/" + slug));
          var out = EB.serialize(doc);
          if (/self\.__next_f/.test(html)) out = html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + esc(title || doc.title) + "</title>");
          return (addMap ? EB.sitemap.change(function (x) { return EB.sitemap.add(x, "/" + slug); }) : Promise.resolve(null)).then(function (sm) {
            return EB.writeFiles([{ path: to, content: out }].concat(sm ? [sm] : []), "Admin: create " + to);
          });
        }).then(function () { close(); EB.go("edit", { path: to }); return false; });
      } }] });
    $("#nf", m.body).value = from || "privacy-policy/index.html";
  }

  /* Page settings (URL, title, canonical, SEO, social) open in Quick edit: see tools.js. */

  /* ================= Media ================= */
  EB.routes.media = function (main) {
    main.innerHTML = head("Media library", "Every image on the website. Upload new ones, copy their address, or remove unused ones.") +
      '<div class="card"><div class="drop">Drop files here or <label style="color:var(--brand-2);cursor:pointer">browse<input type="file" accept="image/*,video/mp4,video/webm,application/pdf" multiple hidden></label> · uploads go to <code>/images/uploads/</code>' + (EB.mode === "github" ? " · max 4 MB each" : "") + '</div>' +
      '<input type="search" placeholder="Search by file name or folder…" style="margin-bottom:14px"><div class="media"></div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn sm more" hidden>Load more</button></div></div>';
    return mediaGrid($(".card", main), function (url, item) { mediaDetails(url, item, function () { EB.render(); }); });
  };
  function mediaDetails(url, item, after) {
    var body = el('<div><img class="imgpv" style="max-height:300px" alt=""><label class="f">Address (use this in pages)</label><div class="row" style="flex-wrap:nowrap"><input type="text" readonly><button class="btn sm" type="button">Copy</button></div>' +
      '<p class="hint">' + EB.fmtSize(item.size) + '</p><h3 style="margin-top:16px">Used on</h3><div class="u">Checking…</div></div>');
    var img = $("img", body); EB.imgFallback(img, item.path); img.src = url; $("input", body).value = url;
    $("button", body).onclick = function () { navigator.clipboard.writeText(url).then(function () { EB.toast("Copied", "ok"); }); };
    var name = url.split("/").pop();
    EB.get("search", { q: name }).then(function (r) {
      $(".u", body).innerHTML = r.length ? r.map(function (x) { return '<div class="mono">' + esc(x.path) + "</div>"; }).join("") : "Not used in any page";
    }).catch(function () { $(".u", body).textContent = "—"; });
    EB.modal({ title: name, body: body, actions: [{ label: "Delete", danger: true, run: function () {
      return EB.confirm("Delete <b>" + esc(name) + "</b>? Pages using it will show a broken image.", "Delete", true).then(function (ok) {
        if (!ok) return false;
        return EB.post("delete", { path: item.path }).then(EB.saved).then(function () { EB.toast("Deleted", "ok"); after(); });
      });
    } }, { label: "Close" }] });
  }

  /* ================= Find & replace ================= */
  EB.routes.replace = function (main) {
    main.innerHTML = head("Find & replace", "Change text, links, phone numbers or emails on every page at once.") +
      '<div class="card"><div class="grid2"><div><label class="f">Find</label><input type="text" id="fq" placeholder="e.g. +91 98765 43210"></div><div><label class="f">Replace with</label><input type="text" id="fr"></div></div>' +
      '<div class="row" style="margin-top:6px"><label class="check"><input type="checkbox" id="fc">Match case</label><label class="check"><input type="checkbox" id="fx">Regular expression</label>' +
      '<label class="check" title="The React pages (home, about, alumni…) also keep their text inside JavaScript bundles. Include them so the change sticks on those pages."><input type="checkbox" id="fn" checked>Include React page bundles</label><div class="spacer"></div><button class="btn primary" id="fs">' + ic("replace") + "Search</button></div></div>" +
      '<div class="card tw" id="fres" hidden></div>';
    var results = [];
    function opts() { return { q: $("#fq").value, r: $("#fr").value, cs: $("#fc").checked, regex: $("#fx").checked, next: $("#fn").checked }; }
    function search() {
      var o = opts(); if (o.q.length < 2) return EB.toast("Type at least 2 characters", "err");
      $("#fs").disabled = true; $("#fres").hidden = false; $("#fres").innerHTML = '<div class="empty">Searching every file…</div>';
      EB.get("search", { q: o.q, case: o.cs ? 1 : 0, regex: o.regex ? 1 : 0, next: o.next ? 1 : 0 }).then(function (r) {
        results = r; var box = $("#fres");
        if (!r.length) { box.innerHTML = '<div class="empty">No matches</div>'; return; }
        var total = r.reduce(function (a, x) { return a + x.count; }, 0);
        box.innerHTML = '<div class="row" style="padding:14px 16px;border-bottom:1px solid var(--line)"><b>' + total + " matches in " + r.length + ' files</b><div class="spacer"></div><button class="btn primary" id="fa">Replace in selected</button></div>' +
          '<table class="tbl"><thead><tr><th><input type="checkbox" id="fall" checked aria-label="Select all"></th><th>File</th><th>Matches</th><th>Preview</th></tr></thead><tbody>' +
          r.map(function (x, i) { return '<tr><td><input type="checkbox" data-i="' + i + '" checked></td><td class="mono">' + esc(x.path) + "</td><td>" + x.count + '</td><td class="u">…' + esc(x.sample) + "…</td></tr>"; }).join("") + "</tbody></table>";
        $("#fall").onchange = function () { var v = this.checked; $$("#fres [data-i]").forEach(function (c) { c.checked = v; }); };
        $("#fa").onclick = apply;
      }).catch(EB.fail).then(function () { $("#fs").disabled = false; });
    }
    function apply() {
      var o = opts(), paths = $$("#fres [data-i]").filter(function (c) { return c.checked; }).map(function (c) { return results[+c.getAttribute("data-i")].path; });
      if (!paths.length) return;
      EB.confirm("Replace <b>" + esc(o.q) + "</b> with <b>" + esc(o.r || "(nothing)") + "</b> in " + paths.length + " file(s)?", "Replace").then(function (ok) {
        if (!ok) return;
        o.paths = paths;
        EB.post("replace", o).then(EB.saved).then(function (r) { EB.toast("Replaced " + r.count + " in " + r.files + " files", "ok"); search(); }).catch(EB.fail);
      });
    }
    $("#fs").onclick = search; $("#fq").onkeydown = function (e) { if (e.key === "Enter") search(); };
  };

  /* ================= Header & footer ================= */
  var HDR_RE = /<header\b[^>]*\bid="eb-hd"[^>]*>[\s\S]*?<\/header>/;
  var FTR_RE = /<footer\b[^>]*\bclass="eb-ft[^"]*"[^>]*>[\s\S]*?<\/footer>/;
  EB.routes.layout = function (main) {
    main.innerHTML = head("Header & footer", "The menu bar and footer are copied into each page. Edit them once on a source page, then copy them to the other pages.") +
      '<div class="card"><div class="warn">The React pages (home, about, alumni, contact…) draw their own header and footer, so this updates the other pages. Change React page menus with Find & replace.</div>' +
      '<div class="grid2"><div><label class="f">Source page</label><select id="ls"></select></div><div><label class="f">&nbsp;</label><div class="row"><button class="btn" id="le">' + ic("edit") + 'Edit source visually</button><button class="btn" id="lc">' + ic("code") + "Edit source code</button></div></div></div>" +
      '<h2 style="margin:22px 0 8px">Copy to these pages</h2><div id="lt" class="u">Scanning pages…</div>' +
      '<div class="row" style="margin-top:16px"><button class="btn primary" id="lh">Copy header to selected</button><button class="btn primary" id="lf">Copy footer to selected</button></div></div>';
    var html = {};
    return EB.get("pages").then(function (pages) {
      return Promise.all(pages.map(function (p) { return EB.readFile(p.path).then(function (h) { html[p.path] = h; return { p: p, hdr: HDR_RE.test(h), ftr: FTR_RE.test(h) }; }); }));
    }).then(function (rows) {
      rows = rows.filter(function (r) { return r.hdr || r.ftr; });
      $("#ls").innerHTML = rows.map(function (r) { return '<option value="' + esc(r.p.path) + '"' + (r.p.path === "blog/index.html" ? " selected" : "") + ">" + esc(r.p.title || r.p.path) + "</option>"; }).join("");
      $("#lt").innerHTML = '<div class="tw" style="border:1px solid var(--line);border-radius:10px"><table class="tbl"><thead><tr><th><input type="checkbox" id="lall" checked aria-label="Select all"></th><th>Page</th><th>Header</th><th>Footer</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td><input type="checkbox" value="' + esc(r.p.path) + '" checked></td><td>' + esc(r.p.title || r.p.path) + '<div class="u">' + esc(r.p.path) + "</div></td><td>" + (r.hdr ? "Yes" : "—") + "</td><td>" + (r.ftr ? "Yes" : "—") + "</td></tr>"; }).join("") + "</tbody></table></div>";
      $("#lall").onchange = function () { var v = this.checked; $$("#lt tbody input").forEach(function (c) { c.checked = v; }); };
      $("#le").onclick = function () { EB.go("edit", { path: $("#ls").value }); };
      $("#lc").onclick = function () { EB.go("code", { path: $("#ls").value }); };
      function copy(re, label) {
        var src = $("#ls").value, targets = $$("#lt tbody input").filter(function (c) { return c.checked && c.value !== src; }).map(function (c) { return c.value; });
        EB.readFile(src).then(function (sh) {
          var m = re.exec(sh); if (!m) throw new Error("The source page has no " + label);
          var changes = targets.map(function (t) {
            var h = html[t]; if (!re.test(h)) return null;
            var out = h.replace(re, function () { return m[0]; });
            return out === h ? null : { path: t, content: out };
          }).filter(Boolean);
          if (!changes.length) return EB.toast("Every page already has this " + label);
          return EB.confirm("Copy the " + label + " from <b>" + esc(src) + "</b> to " + changes.length + " page(s)?", "Copy").then(function (ok) {
            if (!ok) return;
            return EB.writeFiles(changes, "Admin: update " + label + " on " + changes.length + " pages").then(function () {
              changes.forEach(function (c) { html[c.path] = c.content; });
              EB.toast(label[0].toUpperCase() + label.slice(1) + " updated on " + changes.length + " page(s)", "ok");
            });
          });
        }).catch(EB.fail);
      }
      $("#lh").onclick = function () { copy(HDR_RE, "header"); };
      $("#lf").onclick = function () { copy(FTR_RE, "footer"); };
    });
  };

  /* ================= SEO & sitemap ================= */
  EB.routes.seo = function (main) {
    main.innerHTML = head("SEO & sitemap", "Check every page's title and description, and manage the sitemap and robots.txt.") +
      '<div class="card tw"><table class="tbl"><thead><tr><th>Page</th><th>Title</th><th>Description</th><th></th></tr></thead><tbody id="sb"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table></div>' +
      '<div class="card short"><div class="row" style="margin-bottom:10px"><h2>sitemap-0.xml</h2><div class="spacer"></div><button class="btn" id="sg">Rebuild from pages</button><button class="btn primary" id="ss">Save sitemap</button></div><div id="sx"></div></div>' +
      '<div class="card short"><div class="row" style="margin-bottom:10px"><h2>robots.txt</h2><div class="spacer"></div><button class="btn primary" id="rs">Save robots.txt</button></div><div id="rx"></div></div>';
    function lenBadge(n, lo, hi) { return '<span class="badge ' + (!n ? "red" : n < lo || n > hi ? "amber" : "green") + '">' + (n ? n + " chars" : "missing") + "</span>"; }
    var pages = [];
    function load() {
      return EB.get("pages").then(function (l) {
        pages = l;
        $("#sb").innerHTML = l.map(function (p) {
          return "<tr><td><div class='t'>" + esc(p.url) + "</div>" + (p.noindex ? '<span class="badge red">noindex</span>' : "") + '</td><td><div class="u" style="max-width:300px">' + esc(p.title) + "</div>" + lenBadge(p.title.length, 30, 60) +
            '</td><td><div class="u" style="max-width:360px">' + esc(p.desc) + "</div>" + lenBadge(p.desc.length, 70, 160) + '</td><td class="acts"><button class="btn sm" data-seo="' + esc(p.path) + '">Edit</button></td></tr>';
        }).join("");
      });
    }
    $("#sb").onclick = function (e) { var b = e.target.closest("[data-seo]"); if (b) EB.seoModal(b.getAttribute("data-seo"), load); };
    var sx, rx;
    EB.readFileOr("sitemap-0.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n').then(function (x) {
      sx = EB.code($("#sx"), x, "xml", function () { $("#ss").click(); });
    });
    EB.readFileOr("robots.txt", "").then(function (x) { rx = EB.code($("#rx"), x, "txt", function () { $("#rs").click(); }); });
    $("#ss").onclick = function () { EB.writeFile("sitemap-0.xml", sx.get()).then(function () { EB.toast("Sitemap saved", "ok"); }).catch(EB.fail); };
    $("#rs").onclick = function () { EB.writeFile("robots.txt", rx.get()).then(function () { EB.toast("robots.txt saved", "ok"); }).catch(EB.fail); };
    $("#sg").onclick = function () {
      var base = EB.sitemap.base(sx.get());
      var urls = pages.filter(function (p) { return !p.noindex && !/^dashboard\//.test(p.path) && !/404/.test(p.path); }).map(function (p) { return "  <url><loc>" + base + (p.url === "/" ? "/" : p.url) + "</loc></url>"; });
      sx.set('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n");
      EB.toast("Rebuilt with " + urls.length + " pages. Review, then Save.");
    };
    return load();
  };

  /* ================= Redirects ================= */
  EB.routes.redirects = function (main) {
    var cfg, raw;
    main.innerHTML = head("Redirects", "Send visitors from old addresses to new ones. Saved in vercel.json.", '<button class="btn" id="ra">' + ic("plus") + 'Add redirect</button><button class="btn primary" id="rv">Save</button>') +
      '<div class="card tw"><table class="tbl"><thead><tr><th>From</th><th>To</th><th>Permanent (301)</th><th></th></tr></thead><tbody id="rb"></tbody></table></div>' +
      '<div class="card"><label class="check"><input type="checkbox" id="cu">Clean URLs (hide .html)</label><label class="check"><input type="checkbox" id="ts">Trailing slash on URLs</label><p class="hint">Use <code>:path*</code> to match everything after a prefix, e.g. <code>/old-blog/:path*</code> → <code>/blog/:path*</code>.</p></div>';
    function add(r) {
      var tr = el('<tr><td><input type="text" class="mono" data-k="source" placeholder="/old-page"></td><td><input type="text" class="mono" data-k="destination" placeholder="/new-page"></td><td><input type="checkbox" data-k="permanent"></td><td class="acts"><button class="btn sm danger" aria-label="Remove">' + ic("trash") + "</button></td></tr>");
      $("[data-k=source]", tr).value = r.source || ""; $("[data-k=destination]", tr).value = r.destination || ""; $("[data-k=permanent]", tr).checked = r.permanent !== false;
      $("button", tr).onclick = function () { tr.remove(); EB.setDirty(true); };
      tr.oninput = function () { EB.setDirty(true); };
      $("#rb").appendChild(tr);
    }
    $("#ra").onclick = function () { add({ permanent: true }); $("#rb tr:last-child input").focus(); };
    $("#rv").onclick = function () {
      cfg.redirects = $$("#rb tr").map(function (tr) { return { source: $("[data-k=source]", tr).value.trim(), destination: $("[data-k=destination]", tr).value.trim(), permanent: $("[data-k=permanent]", tr).checked }; })
        .filter(function (r) { return r.source && r.destination; });
      if (cfg.redirects.some(function (r) { return r.source[0] !== "/"; })) return EB.toast("“From” must start with /", "err");
      cfg.cleanUrls = $("#cu").checked; cfg.trailingSlash = $("#ts").checked;
      EB.post("files", { changes: [{ path: "vercel.json", content: JSON.stringify(cfg, null, 2) + "\n" }], message: "Admin: edit redirects" })
        .then(EB.saved).then(function () { EB.setDirty(false); EB.toast("Redirects saved", "ok"); }).catch(EB.fail);
    };
    return EB.readFileOr("vercel.json", "{}").then(function (t) {
      raw = t; cfg = JSON.parse(t || "{}"); (cfg.redirects || []).forEach(add);
      $("#cu").checked = !!cfg.cleanUrls; $("#ts").checked = !!cfg.trailingSlash;
      $("#cu").onchange = $("#ts").onchange = function () { EB.setDirty(true); };
    });
  };

  /* ================= Code injection ================= */
  EB.routes.inject = function (main) {
    main.innerHTML = head("Code injection", "Add tracking codes, chat widgets or custom CSS to every page at once.", '<button class="btn primary" id="ia">Save & apply to all pages</button>') +
      '<div class="card short"><h2>Inside &lt;head&gt;</h2><p class="hint" style="margin-bottom:10px">For analytics, verification tags, fonts or &lt;style&gt; blocks.</p><div id="ih"></div></div>' +
      '<div class="card short"><h2>End of &lt;body&gt;</h2><p class="hint" style="margin-bottom:10px">For chat widgets and scripts that should load after the page.</p><div id="ib"></div></div>';
    return EB.get("inject").then(function (d) {
      var hh = EB.code($("#ih"), d.head, "html"), bb = EB.code($("#ib"), d.body, "html");
      $("#ia").onclick = function () {
        EB.confirm("Apply this code to every page?", "Apply").then(function (ok) {
          if (!ok) return;
          EB.post("inject", { head: hh.get(), body: bb.get() }).then(EB.saved).then(function (r) { EB.toast("Applied to " + r.pages + " page(s)", "ok"); }).catch(EB.fail);
        });
      };
    });
  };

  /* The learner dashboard screen lives in learner.js. */

  /* ================= Files + code editor ================= */
  var TEXT = /\.(html?|css|m?js|json|xml|txt|md|svg|webmanifest)$|@ver=/i;
  EB.routes.files = function (main, params) {
    var dir = params.get("dir") || "";
    var parts = dir ? dir.split("/") : [];
    main.innerHTML = head("All files", "Browse and edit any file of the website.", '<button class="btn" id="fnf">' + ic("plus") + 'New file</button><label class="btn">' + ic("upload") + 'Upload here<input type="file" multiple hidden id="fu"></label>') +
      '<div class="card" style="margin-bottom:12px"><div class="crumbs"><a data-d="">website</a>' + parts.map(function (p, i) { return " / <a data-d='" + esc(parts.slice(0, i + 1).join("/")) + "'>" + esc(p) + "</a>"; }).join("") + "</div></div>" +
      '<div class="card tw"><table class="tbl fl"><thead><tr><th>Name</th><th>Size</th><th></th></tr></thead><tbody id="ft"><tr><td colspan="3" class="empty">Loading…</td></tr></tbody></table></div>';
    $(".crumbs").onclick = function (e) { var a = e.target.closest("[data-d]"); if (a) EB.go("files", a.getAttribute("data-d") ? { dir: a.getAttribute("data-d") } : null); };
    function load() {
      return EB.get("tree", { dir: dir }).then(function (list) {
        $("#ft").innerHTML = (dir ? '<tr><td><a href="#" data-open="' + esc(parts.slice(0, -1).join("/")) + '">' + ic("folder") + " ..</a></td><td></td><td></td></tr>" : "") + list.map(function (f) {
          var name = f.dir ? '<a href="#" data-open="' + esc(f.path) + '">' + ic("folder") + esc(f.name) + "</a>" :
            TEXT.test(f.name) ? '<a href="#/code?path=' + encodeURIComponent(f.path) + '">' + ic("file") + esc(f.name) + "</a>" : '<a href="/' + esc(f.path) + '" target="_blank">' + ic("file") + esc(f.name) + "</a>";
          return "<tr><td>" + name + '</td><td class="u">' + EB.fmtSize(f.size) + '</td><td class="acts">' +
            (/\.html?$/.test(f.name) ? '<a class="btn sm" href="#/edit?path=' + encodeURIComponent(f.path) + '">Visual edit</a> ' : "") +
            '<button class="btn sm danger" data-del="' + esc(f.path) + '" aria-label="Delete">' + ic("trash") + "</button></td></tr>";
        }).join("");
      });
    }
    $("#ft").onclick = function (e) {
      var a = e.target.closest("[data-open]"); if (a) { e.preventDefault(); var d = a.getAttribute("data-open"); return EB.go("files", d ? { dir: d } : null); }
      var b = e.target.closest("[data-del]"); if (!b) return;
      var p = b.getAttribute("data-del");
      EB.confirm("Delete <b>" + esc(p) + "</b>" + (b.closest("tr").querySelector("[data-open]") ? " and everything inside it" : "") + "?", "Delete", true).then(function (ok) {
        if (ok) EB.post("delete", { path: p }).then(EB.saved).then(load).catch(EB.fail);
      });
    };
    $("#fnf").onclick = function () {
      EB.prompt("New file", "File name (e.g. offer.html, css/custom.css)").then(function (n) {
        if (!n) return; var p = (dir ? dir + "/" : "") + n.replace(/^\/+/, "");
        EB.writeFile(p, /\.html?$/.test(n) ? "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>New page</title>\n</head>\n<body>\n\n</body>\n</html>\n" : "\n", true)
          .then(function () { EB.go("code", { path: p }); }).catch(EB.fail);
      });
    };
    $("#fu").onchange = function () {
      var fs = [].slice.call(this.files);
      fs.reduce(function (p, f) { return p.then(function () { return EB.upload(f, dir || "images"); }); }, Promise.resolve()).then(function () { EB.toast("Uploaded", "ok"); load(); }).catch(EB.fail);
    };
    return load();
  };

  EB.routes.code = function (main, params) {
    var p = params.get("path"), ext = (p.split(".").pop() || "").toLowerCase();
    main.innerHTML = head('<span class="mono" style="font-size:16px">' + esc(p) + "</span>", "Ctrl+S saves. Earlier versions are under History.",
      (/\.html?$/.test(p) ? '<a class="btn" href="#/edit?path=' + encodeURIComponent(p) + '">' + ic("edit") + "Visual editor</a>" : "") +
      '<button class="btn" id="cb">' + ic("history") + 'History</button><a class="btn" target="_blank" href="/' + esc(p) + '">' + ic("ext") + 'Open</a><button class="btn primary" id="cs">Save</button>') + '<div id="ce"></div>';
    return EB.readFile(p).then(function (t) {
      var ed = EB.code($("#ce"), t, ext, save);
      ed.on(function () { EB.setDirty(true); });
      function save() { EB.writeFile(p, ed.get()).then(function () { EB.setDirty(false); EB.toast("Saved", "ok"); }).catch(EB.fail); }
      $("#cs").onclick = save;
      $("#cb").onclick = function () { EB.versions(p, function (c) { ed.set(c); EB.setDirty(true); }); };
    });
  };

  /* Earlier versions of one file. onLoad(content) loads one into an editor. */
  EB.versions = function (p, onLoad) {
    EB.get("history", { path: p }).then(function (list) {
      var body = list.length ? '<ul class="log">' + list.map(function (b, i) {
        return "<li><span>" + new Date(b.t).toLocaleString() + ' <span class="u">' + esc(b.message || "") + (i === 0 && EB.mode === "github" ? " (current)" : "") + '</span></span><time><button class="btn sm" data-v="' + esc(b.id) + '">View</button> ' +
          (i === 0 && EB.mode === "github" ? "" : '<button class="btn sm primary" data-r="' + esc(b.id) + '">Restore</button>') + "</time></li>";
      }).join("") + "</ul>" : '<div class="empty">No earlier versions yet</div>';
      var m = EB.modal({ title: "History of " + p, body: body, wide: true });
      m.body.onclick = function (e) {
        var v = e.target.closest("[data-v]"), r = e.target.closest("[data-r]");
        if (v) EB.get("version", { path: p, id: v.getAttribute("data-v") }).then(function (b) {
          var mm = EB.modal({ title: "Version preview", wide: true, body: '<div class="short" id="vp"></div>', actions: onLoad ? [{ label: "Close" }, { label: "Load into editor", primary: true, run: function () { onLoad(b.content); m.close(); } }] : null });
          EB.code($("#vp", mm.body), b.content, p.split(".").pop());
        }).catch(EB.fail);
        if (r) EB.confirm("Restore this version? The current version stays in the history.", "Restore").then(function (ok) {
          if (ok) EB.post("restore", { path: p, id: r.getAttribute("data-r") }).then(EB.saved).then(function () { EB.toast("Restored", "ok"); m.close(); EB.setDirty(false); EB.render(); }).catch(EB.fail);
        });
      };
    }).catch(EB.fail);
  };

  /* ================= History ================= */
  EB.routes.history = function (main, params) {
    var tabs = EB.mode === "github" ? [["activity", "Activity"], ["deploys", "Deploys"], ["trash", "Deleted"]] : [["activity", "Activity"], ["changes", "Unpublished changes"], ["trash", "Deleted"]];
    var tab = params.get("tab") || "activity";
    main.innerHTML = head("History", EB.mode === "github" ? "Every save is recorded. Open a page's History button to restore an earlier version." : "Every change is recorded and every overwritten file is backed up.") +
      '<div class="chips" style="margin-bottom:14px">' + tabs.map(function (t) { return '<a class="chip' + (t[0] === tab ? " on" : "") + '" href="#/history?tab=' + t[0] + '" style="text-decoration:none;color:inherit">' + t[1] + "</a>"; }).join("") + '</div><div class="card" id="hb"><p class="u">Loading…</p></div>';
    var hb = $("#hb");
    if (tab === "activity") return EB.get("log").then(function (l) { hb.innerHTML = l.length ? '<ul class="log">' + l.map(logItem).join("") + "</ul>" : '<div class="empty">Nothing yet</div>'; });
    if (tab === "deploys") return EB.get("deploys").then(function (l) {
      hb.innerHTML = '<p class="hint" style="margin:0 0 10px">Each save is published by Vercel. “Live” means it is on ebuddha.in.</p><ul class="log">' + l.map(function (d) {
        return "<li><span>" + esc(d.message) + "</span><time>" + EB.deployBadge(d.state) + " " + EB.fmtTime(d.t) + (d.url ? ' <a href="' + esc(d.url) + '" target="_blank">details</a>' : "") + "</time></li>";
      }).join("") + "</ul>";
    });
    if (tab === "changes") return EB.get("changes").then(function (c) {
      var seen = {}, files = c.files.filter(function (l) { if (seen[l.path]) return false; seen[l.path] = 1; return true; });
      hb.innerHTML = '<div class="row" style="margin-bottom:10px"><div><b>' + files.length + " change(s)</b> since " + (c.since ? new Date(c.since).toLocaleString() : "you started") +
        '</div><div class="spacer"></div><button class="btn primary" id="mp">Mark all as published</button></div>' +
        '<p class="hint">These changes are only on this computer. Upload the changed files to GitHub to make them live, then click “Mark all as published”. The online admin at ebuddha.in/admin publishes automatically.</p>' +
        (files.length ? '<ul class="log" style="margin-top:10px">' + files.map(logItem).join("") + "</ul>" : "");
      $("#mp").onclick = function () { EB.post("published").then(function () { EB.toast("Marked as published", "ok"); EB.render(); }); };
    });
    if (tab === "trash") return EB.get("trash").then(function (l) {
      hb.innerHTML = l.length ? '<ul class="log">' + l.map(function (t) { return '<li><span class="mono">' + esc(t.path) + '</span><time>' + EB.fmtTime(t.t) + ' <button class="btn sm" data-u="' + esc(t.id) + '">Restore</button></time></li>'; }).join("") + "</ul>" : '<div class="empty">Nothing has been deleted</div>';
      hb.onclick = function (e) { var b = e.target.closest("[data-u]"); if (b) EB.post("untrash", { id: b.getAttribute("data-u") }).then(EB.saved).then(function () { EB.toast("Restored", "ok"); EB.render(); }).catch(EB.fail); };
    });
  };

  /* ================= Settings ================= */
  EB.routes.settings = function (main) {
    if (EB.mode === "github") {
      main.innerHTML = head("Settings") + '<div class="card" style="max-width:640px"><h2>Change the admin password</h2><ol class="steps">' +
        "<li>Open <b>vercel.com</b> → project <b>website-1</b> → <b>Settings</b> → <b>Environment Variables</b>.</li>" +
        "<li>Edit <code>ADMIN_PASSWORD</code> and save.</li><li>Redeploy the latest deployment. Everyone is logged out and must use the new password.</li></ol></div>" +
        '<div class="card" style="max-width:640px"><h2>Connected to</h2><p class="hint">Saving to GitHub repository <code>' + esc(EB.site) + "</code>. Vercel publishes each save automatically.</p></div>";
      return;
    }
    main.innerHTML = head("Settings") +
      '<div class="card" style="max-width:560px"><h2>Change password</h2><label class="f">Current password</label><input type="password" id="p1" autocomplete="current-password"><label class="f">New password</label><input type="password" id="p2" autocomplete="new-password"><label class="f">Repeat new password</label><input type="password" id="p3" autocomplete="new-password"><div class="row" style="margin-top:14px"><button class="btn primary" id="pc">Update password</button></div></div>' +
      '<div class="card" style="max-width:560px"><h2>About this panel</h2><p class="hint">Editing files in <code>' + esc(EB.site || "") + '</code> on this computer. Backups and the activity log are in <code>admin/data</code>. The online version is at ebuddha.in/admin.</p></div>';
    $("#pc").onclick = function () {
      if ($("#p2").value !== $("#p3").value) return EB.toast("New passwords don't match", "err");
      EB.post("password", { current: $("#p1").value, next: $("#p2").value }).then(function () { EB.toast("Password updated", "ok"); $$("input", main).forEach(function (i) { i.value = ""; }); }).catch(EB.fail);
    };
  };
})();
