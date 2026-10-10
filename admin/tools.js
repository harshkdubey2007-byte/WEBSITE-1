/* Quick edit (page URL, title, canonical, SEO, social), Site health and
   Marketing tools screens, and the Preferences card in Settings. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc, ic = EB.ic;
  var ORIGIN = "https://www.ebuddha.in";

  /* ================= Quick edit ================= */
  EB.quickEdit = function (p, after) {
    return EB.readFile(p).then(function (html) {
      var doc = EB.parse(html), isNext = /self\.__next_f/.test(html);
      function meta(sel) { var m = doc.head.querySelector(sel); return m ? m.getAttribute("content") || "" : ""; }
      var canon = doc.head.querySelector('link[rel="canonical"]');
      var url = EB.urlFor(p), isDir = /\/index\.html$/.test(p);
      var slug = p === "index.html" ? "" : (isDir ? p.replace(/\/index\.html$/, "") : p.replace(/\.html$/, "")).split("/").pop();
      var prefix = "ebuddha.in" + url.replace(/[^/]*$/, "");
      var locked = p === "index.html" || p === "blog/index.html";
      var robots = meta('meta[name="robots"]');
      var body =
        '<div class="row" style="margin:10px 0 2px">' + (isNext ? '<span class="badge amber">React page</span>' : '<span class="badge blue">Page</span>') +
        '<span class="u mono">' + esc(p) + '</span><span class="spacer"></span><a class="btn sm" href="#/edit?path=' + encodeURIComponent(p) + '">' + ic("edit") + 'Visual editor</a><a class="btn sm" href="' + esc(url) + '" target="_blank">' + ic("ext") + "View</a></div>" +
        '<h3 style="margin:18px 0 0">General</h3>' +
        '<label class="f">Page title <small id="qtl"></small></label><input type="text" id="qt" value="' + esc(doc.title) + '" placeholder="Shown in the browser tab and on Google">' +
        '<label class="f">URL</label><div class="row" style="flex-wrap:nowrap;gap:6px"><span class="u mono" style="white-space:nowrap">' + esc(prefix) + '</span><input type="text" id="qs" value="' + esc(slug) + '"' + (locked ? " disabled" : "") + ' placeholder="page-address">' + (isDir || locked ? "" : '<span class="u mono">.html</span>') + "</div>" +
        (locked ? '<p class="hint">The address of this page can\'t be changed.</p>' : '<div id="qmove" hidden><label class="check"><input type="checkbox" id="qr" checked>Redirect the old address to the new one (301)</label><label class="check"><input type="checkbox" id="ql" checked>Update links to this page on other pages</label></div>') +
        '<h3 style="margin:22px 0 0">Search engines</h3>' +
        '<label class="f">Meta description <small id="qdl"></small></label><textarea id="qd" rows="3" placeholder="1–2 sentences shown under the title on Google">' + esc(meta('meta[name="description"]')) + "</textarea>" +
        '<label class="f">Canonical URL <small>the main address of this content</small></label><div class="row" style="flex-wrap:nowrap"><input type="url" id="qc" value="' + esc(canon ? canon.getAttribute("href") : "") + '" placeholder="' + esc(ORIGIN + url) + '"><button type="button" class="btn sm" id="qcs">Use this page</button></div>' +
        '<div class="grid2"><div><label class="f">Visibility on Google</label><select id="qi"><option value="">Show (index)</option><option value="noindex"' + (/noindex/.test(robots) ? " selected" : "") + ">Hide (noindex)</option></select></div>" +
        '<div><label class="f">Keywords <small>optional</small></label><input type="text" id="qk" value="' + esc(meta('meta[name="keywords"]')) + '"></div></div>' +
        '<label class="f">Google preview</label><div id="qg" class="card" style="padding:14px 16px;box-shadow:none"></div>' +
        '<h3 style="margin:22px 0 0">Social sharing</h3><p class="hint">How the link looks on WhatsApp, Facebook, LinkedIn and X.</p>' +
        '<div class="grid2"><div><label class="f">Share title</label><input type="text" id="qot" value="' + esc(meta('meta[property="og:title"]')) + '" placeholder="Defaults to the page title"></div>' +
        '<div><label class="f">Share image</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="qoi" value="' + esc(meta('meta[property="og:image"]')) + '" placeholder="/images/…"><button class="btn sm" id="qop" type="button">Choose</button></div></div></div>' +
        '<label class="f">Share description</label><textarea id="qod" rows="2" placeholder="Defaults to the meta description">' + esc(meta('meta[property="og:description"]')) + "</textarea>" +
        (isNext ? '<p class="hint">React page: these settings are re-applied after the page loads, so they stick.</p>' : "");
      var m = EB.modal({ title: "Quick edit", body: body, wide: false, actions: [{ label: "Cancel" }, { label: "Save changes", primary: true, run: function (close, bd) { return save(bd, close); } }] });
      var bd = m.body;
      function counts() {
        var tl = $("#qt", bd).value.trim().length, dl = $("#qd", bd).value.trim().length;
        $("#qtl", bd).textContent = tl ? tl + " chars" + (tl > 60 ? " · may be cut off on Google (aim 30–60)" : tl < 20 ? " · short" : " · good length") : "empty";
        $("#qdl", bd).textContent = dl ? dl + " chars" + (dl > 160 ? " · may be cut off (aim 70–160)" : dl < 70 ? " · short" : " · good length") : "empty";
        var s = $("#qs", bd).value.trim(), shown = ORIGIN.replace(/^https?:\/\//, "") + (locked || !s ? url : url.replace(/[^/]*$/, "") + s);
        $("#qg", bd).innerHTML = '<div class="u">' + esc(shown) + '</div><div style="color:#1A0DAB;font-size:18px;line-height:1.3;margin:2px 0 4px">' + esc($("#qt", bd).value.trim() || "(no title — Google will make one up)") + '</div><div class="u" style="color:var(--ink-2)">' + esc($("#qd", bd).value.trim() || "(no description — Google will pick text from the page)") + "</div>";
        if (!locked) $("#qmove", bd).hidden = s === slug;
      }
      ["#qt", "#qd", "#qs"].forEach(function (s) { $(s, bd).addEventListener("input", counts); });
      counts();
      $("#qcs", bd).onclick = function () { var s = $("#qs", bd).value.trim(); $("#qc", bd).value = ORIGIN + (locked || !s ? url : url.replace(/[^/]*$/, "") + s); };
      $("#qop", bd).onclick = function () { EB.pickMedia().then(function (u) { if (u) $("#qoi", bd).value = u; }); };

      function save(bd, close) {
        var edits = [], changed = false;
        function setMeta(attr, key, val) {
          var sel = "meta[" + attr + '="' + key + '"]', el = doc.head.querySelector(sel);
          if (!val) { if (el) { el.remove(); changed = true; edits.push({ k: "meta", s: sel, v: "" }); } return; }
          if (!el) { el = doc.createElement("meta"); el.setAttribute(attr, key); doc.head.appendChild(el); }
          if (el.getAttribute("content") === val) return;
          el.setAttribute("content", val); changed = true; edits.push({ k: "meta", s: sel, v: val });
        }
        var t = $("#qt", bd).value.trim(), te = doc.head.querySelector("title");
        if (t !== (te ? te.textContent : "")) {
          if (t) { doc.title = t; edits.push({ k: "title", v: t }); } else if (te) te.remove();
          changed = true;
        }
        setMeta("name", "description", $("#qd", bd).value.trim());
        setMeta("name", "keywords", $("#qk", bd).value.trim());
        setMeta("name", "robots", $("#qi", bd).value ? "noindex, nofollow" : (/noindex/.test(robots) ? "index, follow" : ""));
        setMeta("property", "og:title", $("#qot", bd).value.trim());
        setMeta("property", "og:description", $("#qod", bd).value.trim());
        setMeta("property", "og:image", $("#qoi", bd).value.trim());
        var cv = $("#qc", bd).value.trim(), ce = doc.head.querySelector('link[rel="canonical"]');
        if (cv !== (ce ? ce.getAttribute("href") : "")) {
          if (cv) { if (!ce) { ce = doc.createElement("link"); ce.setAttribute("rel", "canonical"); doc.head.appendChild(ce); } ce.setAttribute("href", cv); edits.push({ k: "link", s: 'link[rel="canonical"]', v: cv }); }
          else if (ce) ce.remove();
          changed = true;
        }
        var newSlug = locked ? slug : $("#qs", bd).value.trim().toLowerCase();
        if (!locked && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(newSlug)) throw new Error("URL: use lowercase letters, numbers and dashes only");
        var step = changed ? EB.post("page-save", { path: p, html: EB.serialize(doc), edits: edits }).then(EB.saved) : Promise.resolve();
        return step.then(function () {
          if (newSlug === slug) return null;
          return EB.post("move", { from: p, slug: newSlug, redirect: $("#qr", bd).checked, updateLinks: $("#ql", bd).checked }).then(EB.saved);
        }).then(function (mv) {
          if (!changed && !mv) { EB.toast("Nothing changed"); return; }
          EB.toast(mv ? "Saved. New address: " + mv.url + (mv.links ? " (" + mv.links + " links updated)" : "") : "Page settings saved", "ok");
          if (mv && /#\/edit\?/.test(location.hash) && location.hash.indexOf(encodeURIComponent(p)) > -1) { close(); EB.go("edit", { path: mv.path }); return false; }
          if (after) after(mv ? mv.path : p);
        });
      }
    }).catch(EB.fail);
  };
  EB.seoModal = EB.quickEdit;

  /* ================= Site health ================= */
  var CATS = [
    ["broken-link", "Broken links", "link", "Links to pages that don't exist."],
    ["missing-image", "Missing images", "media", "Images whose file isn't on the site."],
    ["hotlink", "Images from other sites", "ext", "Images loaded from someone else's server can disappear or change at any time."],
    ["no-alt", "Images without alt text", "media", "Alt text describes images for screen readers and Google."],
    ["large-image", "Large images", "upload", "Files over 500 KB slow pages down, especially on phones."],
    ["no-h1", "Pages without a main heading", "pages", "Each page should have one h1 heading."],
    ["dup-viewport", "Duplicate viewport tags", "code", "Only one viewport tag is needed per page."]
  ];
  EB.routes.health = function (main, params) {
    var cat = params.get("cat") || "broken-link", shown = 150;
    main.innerHTML = EB.head("Site health", "A scan of every page for problems visitors and Google would notice.", '<span class="u" id="hat"></span><button class="btn" id="hre">' + ic("history") + "Scan again</button>") + '<div id="hb"><div class="card"><div class="row"><div class="skel" style="width:92px;height:92px;border-radius:50%"></div><div style="flex:1"><div class="skel" style="height:16px;width:50%;margin-bottom:10px"></div><div class="skel" style="height:14px;width:80%"></div></div></div></div></div>';
    $("#hre").onclick = function () { $("#hre").disabled = true; EB.health(true).then(draw).catch(EB.fail).then(function () { $("#hre").disabled = false; }); };
    function n(d, c) { return c === "hotlink" ? d.counts.hotlinked : d.issues.filter(function (i) { return i.type === c; }).length; }
    function draw(d) {
      $("#hat").textContent = "Scanned " + d.scanned + " pages · " + d.checked.links + " links · " + d.checked.images + " images · " + EB.fmtTime(d.at);
      var hb = $("#hb");
      hb.innerHTML = '<div class="card row" style="gap:22px;margin-bottom:16px"><div class="ring" style="--p:' + d.score + ";--c:" + EB.scoreColor(d.score) + '"><b>' + d.score + '</b></div><div style="flex:1;min-width:220px"><h2>' +
        (d.score >= 85 ? "Your site is in good shape" : d.score >= 60 ? "A few things need attention" : "Several problems need fixing") + '</h2><p class="hint">The score drops for broken links, missing images, images from other websites, missing alt text and large files.</p></div></div>' +
        '<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:16px">' + CATS.map(function (c) {
          var v = n(d, c[0]), cls = !v ? "ok" : /broken|missing|hotlink/.test(c[0]) ? "bad" : "mid";
          return '<button class="hcat' + (c[0] === cat ? " on" : "") + '" data-cat="' + c[0] + '">' + ic(c[2]) + "<span>" + c[1] + '</span><span class="n ' + cls + '">' + v + "</span></button>";
        }).join("") + "</div>" + '<div class="card tw" id="hlist"></div>';
      list(d);
      $$(".hcat", hb).forEach(function (b) { b.onclick = function () { cat = b.getAttribute("data-cat"); shown = 150; $$(".hcat", hb).forEach(function (x) { x.classList.toggle("on", x === b); }); list(d); }; });
    }
    function list(d) {
      var box = $("#hlist"), c = CATS.filter(function (x) { return x[0] === cat; })[0];
      var head = '<div style="padding:16px 18px;border-bottom:1px solid var(--line)"><h2>' + c[1] + '</h2><p class="hint">' + c[3] + "</p></div>";
      if (cat === "hotlink") {
        box.innerHTML = head + (d.hotlinks.length ? '<table class="tbl"><thead><tr><th>Website</th><th>Images</th><th>Pages</th><th>Copies on your site</th><th></th></tr></thead><tbody>' + d.hotlinks.map(function (h) {
          return "<tr><td class=\"mono\">" + esc(h.host) + "</td><td>" + h.count + "</td><td>" + h.pages + "</td><td>" + (h.local ? '<span class="badge green">' + h.local + " available</span>" : '<span class="badge">none</span>') + '</td><td class="acts">' +
            (h.local ? '<button class="btn sm primary" data-fix="' + esc(h.host) + '">Use my copies (' + h.local + ")</button>" : "") + "</td></tr>";
        }).join("") + "</tbody></table>" : '<div class="empty">' + ic("check") + " All images are served from your own site.</div>");
        $$("[data-fix]", box).forEach(function (b) {
          b.onclick = function () {
            var host = b.getAttribute("data-fix");
            EB.confirm("Switch every image loaded from <b>" + esc(host) + "</b> to the copy already in your website folder? Images without a copy are left as they are.", "Use my copies").then(function (ok) {
              if (!ok) return; b.disabled = true;
              EB.post("fix-hotlinks", { host: host }).then(EB.saved).then(function (r) { EB.toast("Updated " + r.replaced + " image links in " + r.files + " files" + (r.kept ? " (" + r.kept + " had no local copy)" : ""), "ok"); return EB.health(true).then(draw); }).catch(EB.fail);
            });
          };
        });
        return;
      }
      var items = d.issues.filter(function (i) { return i.type === cat; });
      box.innerHTML = head + (items.length ? items.slice(0, shown).map(function (i) {
        var act = cat === "large-image" ? '<a class="btn sm" href="/' + esc(i.page) + '" target="_blank">' + ic("ext") + "Open</a>" : '<a class="btn sm" href="#/edit?path=' + encodeURIComponent(i.page) + '">' + ic("edit") + "Fix in editor</a>";
        return '<div class="issue"><span class="sev ' + i.sev + '"></span><div class="what"><b>' + esc(cat === "large-image" ? i.page : i.detail) + "</b><span>" + esc(cat === "large-image" ? i.detail : "on " + i.page) + "</span></div>" + act + "</div>";
      }).join("") + (items.length > shown ? '<div class="row" style="justify-content:center;padding:12px"><button class="btn sm" id="hmore">Show more (' + (items.length - shown) + ")</button></div>" : "")
        : '<div class="empty">' + ic("check") + " No problems found here.</div>");
      var mo = $("#hmore", box); if (mo) mo.onclick = function () { shown += 150; list(d); };
    }
    return EB.health().then(draw);
  };

  /* ================= Marketing tools ================= */
  var DEF = {
    bar: { enabled: false, text: "Admissions open for the next batch. Limited seats!", linkText: "Enquire now", linkUrl: "/contact", bg: "#002CCD", color: "#ffffff", dismissible: true, show: "all", paths: "", start: "", end: "" },
    whatsapp: { enabled: false, number: "", message: "Hi eBuddha, I'd like to know more about your courses.", label: "Chat with us", position: "right", show: "all", paths: "" },
    popup: { enabled: false, title: "Get a free career counselling session", text: "Talk to our experts and find the right course for your goals.", image: "", buttonText: "Book my free session", buttonUrl: "/contact", trigger: "delay", delay: 10, scroll: 50, frequency: "day", show: "all", paths: "", start: "", end: "" }
  };
  function merge(a, b) { var o = {}; Object.keys(a).forEach(function (k) { o[k] = b && b[k] !== undefined ? b[k] : a[k]; }); return o; }
  EB.routes.marketing = function (main) {
    var cfg;
    main.innerHTML = EB.head("Marketing tools", "Show an announcement, a WhatsApp chat button or a lead popup across the whole website.", '<span class="u" id="mst"></span><a class="btn" href="/" target="_blank">' + ic("ext") + 'View site</a><button class="btn primary" id="msv" disabled>Save & publish</button>') + '<div id="mb"></div>';
    function setDirty(v) { EB.setDirty(v); $("#msv").disabled = !v; $("#mst").innerHTML = v ? '<span class="dot"></span>Unsaved changes' : ""; }
    function showOn(k, o) {
      return '<div class="grid2"><div><label class="f">Show on</label><select data-k="' + k + '.show"><option value="all"' + (o.show === "all" ? " selected" : "") + '>Every page</option><option value="only"' + (o.show === "only" ? " selected" : "") + '>Only these pages</option><option value="except"' + (o.show === "except" ? " selected" : "") + ">Every page except</option></select></div>" +
        '<div><label class="f">Pages <small>e.g. /contact, /blog/*</small></label><input type="text" data-k="' + k + '.paths" value="' + esc(o.paths) + '" placeholder="/seo-course, /blog/*"></div></div>';
    }
    function dates(k, o) { return '<div class="grid2"><div><label class="f">Start date <small>optional</small></label><input type="date" data-k="' + k + '.start" value="' + esc(o.start) + '"></div><div><label class="f">End date <small>optional</small></label><input type="date" data-k="' + k + '.end" value="' + esc(o.end) + '"></div></div>'; }
    function sw(k, on) { return '<label class="switch"><input type="checkbox" data-k="' + k + '.enabled"' + (on ? " checked" : "") + "><i></i><span>" + (on ? "On" : "Off") + "</span></label>"; }
    function draw() {
      var b = cfg.bar, w = cfg.whatsapp, p = cfg.popup;
      $("#mb").innerHTML =
        '<div class="card"><div class="tool-h"><span class="ic" style="background:var(--soft);color:var(--soft-ink)">' + ic("megaphone") + '</span><div><h2>Announcement bar</h2><p class="hint" style="margin:0">A strip at the very top of every page for offers, admissions or events.</p></div><span class="spacer"></span>' + sw("bar", b.enabled) + "</div>" +
        '<label class="f">Message</label><input type="text" data-k="bar.text" value="' + esc(b.text) + '">' +
        '<div class="grid2"><div><label class="f">Link text</label><input type="text" data-k="bar.linkText" value="' + esc(b.linkText) + '"></div><div><label class="f">Link goes to</label><input type="text" data-k="bar.linkUrl" value="' + esc(b.linkUrl) + '"></div></div>' +
        '<div class="row" style="margin-top:4px"><div><label class="f">Background</label><input type="color" data-k="bar.bg" value="' + esc(b.bg) + '"></div><div><label class="f">Text colour</label><input type="color" data-k="bar.color" value="' + esc(b.color) + '"></div><label class="check" style="margin-top:34px"><input type="checkbox" data-k="bar.dismissible"' + (b.dismissible !== false ? " checked" : "") + ">Visitors can close it</label></div>" +
        dates("bar", b) + showOn("bar", b) + '<label class="f">Preview</label><div class="prev-bar" style="background:' + esc(b.bg) + ";color:" + esc(b.color) + '">' + esc(b.text) + (b.linkText ? "<a>" + esc(b.linkText) + "</a>" : "") + "</div></div>" +

        '<div class="card"><div class="tool-h"><span class="ic" style="background:#DCFCE7;color:#15803D">' + ic("phone") + '</span><div><h2>WhatsApp chat button</h2><p class="hint" style="margin:0">A floating button that opens a WhatsApp chat with your team.</p></div><span class="spacer"></span>' + sw("whatsapp", w.enabled) + "</div>" +
        '<div class="grid2"><div><label class="f">WhatsApp number <small>with country code</small></label><input type="tel" data-k="whatsapp.number" value="' + esc(w.number) + '" placeholder="918461958162"></div><div><label class="f">Button label <small>leave empty for icon only</small></label><input type="text" data-k="whatsapp.label" value="' + esc(w.label) + '"></div></div>' +
        '<label class="f">Pre-filled message</label><input type="text" data-k="whatsapp.message" value="' + esc(w.message) + '">' +
        '<div class="grid2"><div><label class="f">Position</label><select data-k="whatsapp.position"><option value="right"' + (w.position !== "left" ? " selected" : "") + '>Bottom right</option><option value="left"' + (w.position === "left" ? " selected" : "") + ">Bottom left</option></select></div><div></div></div>" +
        showOn("whatsapp", w) + '<div><span class="prev-wa">' + ic("phone") + esc(w.label || "") + "</span></div></div>" +

        '<div class="card"><div class="tool-h"><span class="ic" style="background:var(--amber-bg);color:var(--amber-ink)">' + ic("bolt") + '</span><div><h2>Lead popup</h2><p class="hint" style="margin:0">A popup that invites visitors to enquire, shown once per visit or day.</p></div><span class="spacer"></span>' + sw("popup", p.enabled) + "</div>" +
        '<label class="f">Headline</label><input type="text" data-k="popup.title" value="' + esc(p.title) + '">' +
        '<label class="f">Text</label><textarea data-k="popup.text" rows="2">' + esc(p.text) + "</textarea>" +
        '<label class="f">Image <small>optional</small></label><div class="row" style="flex-wrap:nowrap"><input type="text" data-k="popup.image" value="' + esc(p.image) + '"><button class="btn sm" id="mpi" type="button">Choose</button></div>' +
        '<div class="grid2"><div><label class="f">Button text</label><input type="text" data-k="popup.buttonText" value="' + esc(p.buttonText) + '"></div><div><label class="f">Button goes to</label><input type="text" data-k="popup.buttonUrl" value="' + esc(p.buttonUrl) + '"></div></div>' +
        '<div class="grid3"><div><label class="f">Show when</label><select data-k="popup.trigger"><option value="delay"' + (p.trigger === "delay" ? " selected" : "") + '>After some seconds</option><option value="scroll"' + (p.trigger === "scroll" ? " selected" : "") + '>After scrolling</option><option value="exit"' + (p.trigger === "exit" ? " selected" : "") + ">When leaving the page</option></select></div>" +
        '<div><label class="f">Seconds / scroll %</label><input type="number" min="0" data-k="popup.' + (p.trigger === "scroll" ? "scroll" : "delay") + '" value="' + esc(p.trigger === "scroll" ? p.scroll : p.delay) + '"' + (p.trigger === "exit" ? " disabled" : "") + "></div>" +
        '<div><label class="f">How often</label><select data-k="popup.frequency"><option value="session"' + (p.frequency === "session" ? " selected" : "") + '>Once per visit</option><option value="day"' + (p.frequency === "day" ? " selected" : "") + '>Once a day</option><option value="once"' + (p.frequency === "once" ? " selected" : "") + ">Only once ever</option></select></div></div>" +
        dates("popup", p) + showOn("popup", p) + '<div class="row" style="margin-top:14px"><button class="btn" id="mpp" type="button">' + ic("ext") + "Preview popup</button></div></div>";
    }
    function read(el) {
      var k = el.getAttribute("data-k").split("."), v = el.type === "checkbox" ? el.checked : el.type === "number" ? +el.value : el.value;
      cfg[k[0]][k[1]] = v;
    }
    $("#mb").addEventListener("input", function (e) { if (!e.target.hasAttribute("data-k")) return; read(e.target); setDirty(true); if (/^(color|text)$/.test(e.target.type) && /^bar\./.test(e.target.getAttribute("data-k"))) refreshBar(); });
    $("#mb").addEventListener("change", function (e) { if (!e.target.hasAttribute("data-k")) return; read(e.target); setDirty(true); if (e.target.tagName === "SELECT" || e.target.type === "checkbox") { var y = window.scrollY; draw(); window.scrollTo(0, y); } });
    function refreshBar() { var pv = $(".prev-bar"), b = cfg.bar; if (!pv) return; pv.style.background = b.bg; pv.style.color = b.color; pv.innerHTML = esc(b.text) + (b.linkText ? "<a>" + esc(b.linkText) + "</a>" : ""); }
    $("#mb").addEventListener("click", function (e) {
      if (e.target.closest("#mpi")) EB.pickMedia().then(function (u) { if (u) { cfg.popup.image = u; setDirty(true); draw(); } });
      if (e.target.closest("#mpp")) {
        var p = cfg.popup;
        EB.modal({ title: "Popup preview", body: '<div style="border-radius:14px;overflow:hidden;border:1px solid var(--line);margin-top:10px;background:#fff;color:#0F172A">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" style="width:100%;max-height:200px;object-fit:cover;display:block">' : "") +
          '<div style="padding:22px"><h2 style="font-size:21px;margin:0 0 8px">' + esc(p.title) + '</h2><p style="color:#475569;margin:0 0 16px">' + esc(p.text) + '</p><div style="background:#002CCD;color:#fff;text-align:center;padding:12px;border-radius:10px;font-weight:600">' + esc(p.buttonText) + "</div></div></div>" });
      }
    });
    $("#msv").onclick = function () {
      if (cfg.whatsapp.enabled && String(cfg.whatsapp.number).replace(/\D/g, "").length < 10) return EB.toast("Enter the full WhatsApp number with country code", "err");
      if (cfg.bar.enabled && !cfg.bar.text.trim()) return EB.toast("Write a message for the announcement bar", "err");
      $("#msv").disabled = true;
      EB.post("site-config", { config: cfg }).then(EB.saved).then(function (r) {
        setDirty(false);
        EB.toast("Saved" + (r.pages ? " and added to " + r.pages + " pages" : "") + (EB.mode === "github" ? ". Live in about a minute." : "."), "ok");
      }).catch(function (e) { $("#msv").disabled = false; EB.fail(e); });
    };
    return Promise.all([EB.get("site-config"), EB.readFileOr("dashboard/data.json", "{}")]).then(function (r) {
      var c = r[0] || {}, learner = {}; try { learner = JSON.parse(r[1]).settings || {}; } catch (e) {}
      cfg = { bar: merge(DEF.bar, c.bar), whatsapp: merge(DEF.whatsapp, c.whatsapp), popup: merge(DEF.popup, c.popup) };
      if (!cfg.whatsapp.number && learner.supportWhatsapp) cfg.whatsapp.number = learner.supportWhatsapp;
      draw();
    });
  };
  EB.icons.phone = '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>';

  /* ================= Settings: preferences ================= */
  var baseSettings = EB.routes.settings;
  EB.routes.settings = function (main) {
    baseSettings(main);
    var theme = EB.pref("eb-admin-theme") || "system", comp = EB.pref("eb-admin-compress") !== "off";
    main.querySelector(".head").insertAdjacentHTML("afterend", '<div class="card" style="max-width:640px"><h2>Preferences</h2><p class="hint">Saved in this browser.</p>' +
      '<label class="f">Appearance</label><div class="chips" id="pth">' + [["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]].map(function (t) { return '<button class="chip' + (t[0] === theme ? " on" : "") + '" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div style="margin-top:18px"><label class="switch"><input type="checkbox" id="pcp"' + (comp ? " checked" : "") + '><i></i><span>Compress large photos when uploading</span></label><p class="hint">JPEG and PNG photos over 300 KB are resized to 2000px and saved as WebP, usually 70–90% smaller.</p></div>' +
      '<div style="margin-top:18px"><button class="btn sm" id="pks">' + ic("key") + "Keyboard shortcuts</button></div></div>");
    $("#pth").onclick = function (e) { var b = e.target.closest("[data-t]"); if (!b) return; EB.pref("eb-admin-theme", b.getAttribute("data-t")); EB.applyTheme(); $$("#pth .chip").forEach(function (c) { c.classList.toggle("on", c === b); }); };
    $("#pcp").onchange = function () { EB.pref("eb-admin-compress", this.checked ? "on" : "off"); EB.toast(this.checked ? "Photos will be compressed" : "Photos will be uploaded as they are"); };
    $("#pks").onclick = EB.shortcuts;
  };
})();
