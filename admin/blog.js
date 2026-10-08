/* Blog manager: list, write, edit and delete posts.
   A new post is a copy of the newest existing post with every post-specific
   part (head tags, heading, meta line, cover, body, table of contents, author
   box) replaced, so it keeps the blog's design. Saving also updates the cards
   on /blog and the sitemap. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc, ic = EB.ic;

  function slugify(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
  function longDate(iso) { var d = new Date(iso + "T12:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
  function isoDate(s) { var d = new Date(s); if (isNaN(d)) return new Date().toISOString().slice(0, 10); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

  /* ================= list ================= */
  EB.routes.blog = function (main) {
    main.innerHTML = EB.head("Blog posts", "Write, edit and publish articles on /blog.", '<a class="btn" href="/blog" target="_blank">' + ic("ext") + 'View blog</a><a class="btn primary" href="#/blog-edit">' + ic("plus") + "New post</a>") +
      '<div class="card tw"><table class="tbl"><thead><tr><th></th><th>Post</th><th>Published</th><th>On /blog</th><th></th></tr></thead><tbody id="bb"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div>';
    function load() {
      return EB.get("blog").then(function (posts) {
        $("#bb").innerHTML = posts.map(function (p) {
          return '<tr><td style="width:96px"><div style="width:84px;aspect-ratio:16/9;border-radius:6px;background:#F3F4F6 center/cover no-repeat;background-image:url(\'' + esc(p.image) + '\')"></div></td>' +
            '<td><div class="t">' + esc(p.title) + '</div><div class="u">/blog/' + esc(p.slug) + " · " + esc(p.author) + " · " + esc(p.readTime) + "</div></td>" +
            '<td class="u">' + esc(p.date) + "</td><td>" + (p.onIndex ? '<span class="badge green">Listed</span>' : '<span class="badge">Hidden</span>') + "</td>" +
            '<td class="acts"><a class="btn sm primary" href="#/blog-edit?slug=' + encodeURIComponent(p.slug) + '">Edit</a> <a class="btn sm" href="#/edit?path=' + encodeURIComponent(p.path) + '">Visual</a> ' +
            '<a class="btn sm" target="_blank" href="/blog/' + esc(p.slug) + '">View</a> <button class="btn sm danger" data-del="' + esc(p.slug) + '" aria-label="Delete">' + ic("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="5" class="empty">No posts yet</td></tr>';
      });
    }
    $("#bb").onclick = function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var slug = b.getAttribute("data-del");
      EB.confirm("Delete the post <b>/blog/" + esc(slug) + "</b>? It moves to the trash and is removed from the blog page and sitemap.", "Delete", true).then(function (ok) {
        if (!ok) return;
        Promise.all([indexChange(slug, null, false, false), EB.sitemap.change(function (x) { return EB.sitemap.remove(x, "/blog/" + slug); })]).then(function (r) {
          return EB.writeFiles([{ path: "blog/" + slug, delete: true }].concat(r.filter(Boolean)), "Admin: delete blog/" + slug);
        }).then(function () { EB.toast("Post deleted", "ok"); load(); }).catch(EB.fail);
      });
    };
    return load();
  };

  /* ================= editor ================= */
  EB.routes["blog-edit"] = function (main, params) {
    var slug = params.get("slug"), isNew = !slug;
    var posts, html, indexHtml;
    main.innerHTML = EB.head(isNew ? "New blog post" : "Edit post", isNew ? "Fill in the details and write your article. It uses the same design as the other posts." : '<a href="/blog/' + esc(slug) + '" target="_blank">/blog/' + esc(slug) + "</a>",
      (isNew ? "" : '<a class="btn" href="#/edit?path=' + encodeURIComponent("blog/" + slug + "/index.html") + '">' + ic("edit") + "Visual editor</a>") + '<a class="btn" href="#/blog">Cancel</a><button class="btn primary" id="bs">' + (isNew ? "Publish post" : "Save changes") + "</button>") +
      '<div class="cols" style="grid-template-columns:minmax(0,1fr) 320px"><div>' +
      '<div class="card"><label class="f" style="margin-top:0">Title</label><input type="text" id="bt" style="font-size:18px;font-weight:600" placeholder="e.g. 10 SEO Tips for 2027">' +
      '<label class="f">Address</label><div class="row" style="flex-wrap:nowrap"><span class="u mono">/blog/</span><input type="text" id="bsl"' + (isNew ? "" : " disabled") + "></div></div>" +
      '<div class="card"><label class="f" style="margin-top:0">Article</label><div id="brte"></div><p class="hint">Use H2 headings for sections. They become the table of contents automatically.</p></div></div>' +
      '<div><div class="card"><h2>Details</h2>' +
      '<label class="f">Category</label><input type="text" id="bc" list="bcl" placeholder="Digital Marketing"><datalist id="bcl"></datalist>' +
      '<label class="f">Author</label><input type="text" id="ba">' +
      '<label class="f">Author bio <small>optional</small></label><textarea id="bab" rows="3"></textarea>' +
      '<div class="grid2"><div><label class="f">Date</label><input type="date" id="bd"></div><div><label class="f">Read time <small>min</small></label><input type="number" id="br" min="1"></div></div>' +
      '<label class="check"><input type="checkbox" id="bon" checked>Show on the /blog page</label><label class="check"><input type="checkbox" id="bft">Feature in the /blog top banner</label></div>' +
      '<div class="card"><h2>Cover image</h2><div class="cover" style="margin-top:10px"><div class="pv" id="bcv"></div><div><button class="btn sm" id="bcc">' + ic("media") + "Choose</button></div></div>" +
      '<input type="text" id="bci" placeholder="/images/…" style="margin-top:10px"></div>' +
      '<div class="card"><h2>SEO</h2><label class="f">Meta description <small id="bdl"></small></label><textarea id="bde" rows="4" placeholder="1–2 sentences shown on Google"></textarea></div></div></div>';

    var rte = richText($("#brte"));
    $("#bt").oninput = function () { if (isNew && !$("#bsl").dataset.touched) $("#bsl").value = slugify(this.value); EB.setDirty(true); };
    $("#bsl").oninput = function () { this.dataset.touched = "1"; };
    $("#bci").oninput = function () { $("#bcv").style.backgroundImage = "url('" + this.value + "')"; };
    $("#bcc").onclick = function () { EB.pickMedia().then(function (u) { if (u) { $("#bci").value = u; $("#bci").oninput(); EB.setDirty(true); } }); };
    $("#bde").oninput = function () { var n = this.value.length; $("#bdl").textContent = n + " chars" + (n > 160 ? " · too long" : n < 70 ? " · aim for 70–160" : " · good"); };
    rte.onChange(function () { EB.setDirty(true); if (!$("#br").dataset.touched) $("#br").value = readTime(rte.get()); });
    $("#br").oninput = function () { this.dataset.touched = "1"; };
    $$("input,textarea", main).forEach(function (i) { i.addEventListener("input", function () { EB.setDirty(true); }); });

    return Promise.all([EB.get("blog"), EB.readFile("blog/index.html")]).then(function (r) {
      posts = r[0]; indexHtml = r[1];
      var ix = EB.parse(indexHtml), cats = {};
      $$(".blog-meta .category", ix).forEach(function (c) { cats[c.textContent.trim()] = 1; });
      $("#bcl").innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
      if (isNew) {
        if (!posts.length) throw new Error("There must be at least one existing post to copy the design from.");
        $("#bd").value = new Date().toISOString().slice(0, 10);
        $("#ba").value = posts[0].author || "";
        $("#bc").value = Object.keys(cats)[0] || "Digital Marketing";
        $("#br").value = 1;
        return EB.readFile(posts[0].path).then(function (t) { html = t; var d = EB.parse(t); var bio = d.querySelector(".author-dec"); $("#bab").value = bio ? bio.textContent.trim() : ""; $("#bde").oninput(); });
      }
      return EB.readFile("blog/" + slug + "/index.html").then(function (t) {
        html = t; var d = EB.parse(t);
        var text = function (s) { var n = d.querySelector(s); return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; };
        var meta = function (s) { var n = d.querySelector(s); return n ? n.getAttribute("content") || "" : ""; };
        $("#bt").value = text(".category-heading h1") || d.title;
        $("#bsl").value = slug;
        var lis = $$(".post-meta li", d).map(function (l) { return l.textContent.replace(/\s+/g, " ").trim(); });
        $("#ba").value = (lis[0] || "").replace(/^By\s*/, "");
        $("#bd").value = isoDate(lis[1] || meta("meta[property='article:published_time']"));
        $("#br").value = parseInt(lis[2], 10) || readTime((d.querySelector(".blog-description") || {}).innerHTML || ""); $("#br").dataset.touched = "1";
        $("#bc").value = text("div.post-category a");
        $("#bab").value = text(".author-dec");
        var img = d.querySelector(".blog-banner img"); $("#bci").value = img ? img.getAttribute("src") : ""; $("#bci").oninput();
        $("#bde").value = meta("meta[name=description]"); $("#bde").oninput();
        var body = d.querySelector(".blog-description"); rte.set(body ? body.innerHTML.trim() : "");
        $("#bon").checked = ix.querySelector('.letest-arical a[href="/blog/' + slug + '"]') != null;
        $("#bft").checked = ix.querySelector('.banner-right li[data-url="/blog/' + slug + '"]') != null;
        EB.setDirty(false);
      });
    }).then(function () {
      $("#bs").onclick = function () {
        var f = {
          title: $("#bt").value.trim(), slug: isNew ? slugify($("#bsl").value || $("#bt").value) : slug, cat: $("#bc").value.trim() || "Blog",
          author: $("#ba").value.trim() || "eBuddha Digitech", bio: $("#bab").value.trim(), date: $("#bd").value || new Date().toISOString().slice(0, 10),
          rt: Math.max(1, parseInt($("#br").value, 10) || readTime(rte.get())), cover: $("#bci").value.trim(), desc: $("#bde").value.trim(), body: rte.get()
        };
        if (!f.title) return EB.toast("Add a title", "err");
        if (!f.slug) return EB.toast("Add an address", "err");
        if (!f.body.replace(/<[^>]+>/g, "").trim()) return EB.toast("Write the article first", "err");
        if (isNew && posts.some(function (p) { return p.slug === f.slug; })) return EB.toast("A post with that address already exists", "err");
        var btn = $("#bs"), target = "blog/" + f.slug + "/index.html";
        btn.disabled = true;
        Promise.resolve().then(function () {
          var post = { path: target, content: buildPost(html, f, isNew) };
          return Promise.all([indexChange(f.slug, f, $("#bon").checked, $("#bft").checked), isNew ? EB.sitemap.change(function (x) { return EB.sitemap.add(x, "/blog/" + f.slug); }) : null]).then(function (r) {
            return EB.writeFiles([post].concat(r.filter(Boolean)), "Admin: " + (isNew ? "publish" : "edit") + " " + target);
          });
        }).then(function () { EB.setDirty(false); EB.toast(isNew ? "Post published" : "Post saved", "ok"); if (isNew) EB.go("blog-edit", { slug: f.slug }); })
          .catch(EB.fail).then(function () { btn.disabled = false; });
      };
    });
  };

  function readTime(html) { var w = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length; return Math.max(1, Math.ceil(w / 200)); }

  /* ================= build post HTML ================= */
  function buildPost(srcHtml, f, isNew) {
    var d = EB.parse(srcHtml);
    var canon = d.querySelector("link[rel=canonical]");
    var oldUrl = canon ? canon.getAttribute("href") : "";
    var origin = (/^https?:\/\/[^/]+/.exec(oldUrl) || ["https://www.ebuddha.in"])[0];
    var url = origin + "/blog/" + f.slug;
    var coverAbs = /^https?:/.test(f.cover) ? f.cover : f.cover ? origin + f.cover : "";
    var now = new Date().toISOString().replace(/\.\d+Z$/, "+00:00");

    /* Head tags are only updated when the template already has them; the site's
       SEO tags were removed on purpose, so new posts don't add them back. */
    function meta(attr, key, val) {
      var m = d.head.querySelector("meta[" + attr + '="' + key + '"]');
      if (m) m.setAttribute("content", val);
    }
    if (d.querySelector("head title")) d.title = f.title;
    meta("name", "description", f.desc); meta("property", "og:title", f.title); meta("property", "og:description", f.desc);
    meta("property", "og:url", url); meta("name", "author", f.author); meta("name", "twitter:data1", f.author);
    meta("name", "twitter:data2", f.rt + " minutes"); meta("property", "article:modified_time", now);
    if (isNew) meta("property", "article:published_time", f.date + "T09:00:00+00:00");
    if (coverAbs) { meta("property", "og:image", coverAbs); ["og:image:width", "og:image:height"].forEach(function (k) { var m = d.head.querySelector('meta[property="' + k + '"]'); if (m) m.remove(); }); }
    if (canon) canon.setAttribute("href", url);
    if (isNew) $$('link[rel="shortlink"],link[rel="alternate"][type*="json"],link[rel="alternate"][type*="oembed"]', d).forEach(function (l) { l.remove(); });

    var ld = d.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        var txt = ld.textContent; if (isNew && oldUrl) txt = txt.split(oldUrl).join(url);
        var g = JSON.parse(txt);
        (g["@graph"] || [g]).forEach(function (n) {
          var t = [].concat(n["@type"] || []);
          /* A copied post must not inherit the template's FAQ answers or thumbnail. */
          if (isNew && t.indexOf("FAQPage") > -1) { t = t.filter(function (x) { return x !== "FAQPage"; }); n["@type"] = t.length === 1 ? t[0] : t; delete n.mainEntity; }
          if (n.thumbnailUrl && coverAbs) n.thumbnailUrl = coverAbs;
          if (n.headline !== undefined || t.indexOf("Article") > -1 || t.indexOf("BlogPosting") > -1) { n.headline = f.title; n.dateModified = now; if (isNew) n.datePublished = f.date + "T09:00:00+00:00"; if (n.wordCount) n.wordCount = f.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length; if (n.articleSection) n.articleSection = [f.cat]; }
          if (t.indexOf("WebPage") > -1) { n.name = f.title; n.description = f.desc; n.dateModified = now; if (isNew) n.datePublished = f.date + "T09:00:00+00:00"; }
          if (t.indexOf("ImageObject") > -1 && coverAbs && n["@id"] && /primaryimage/.test(n["@id"])) { n.url = n.contentUrl = coverAbs; delete n.width; delete n.height; }
          if (t.indexOf("Person") > -1 && n.name && isNew) n.name = f.author;
          if (t.indexOf("BreadcrumbList") > -1 && n.itemListElement) { var last = n.itemListElement[n.itemListElement.length - 1]; if (last) last.name = f.title; }
        });
        if (isNew && g["@graph"]) g["@graph"] = g["@graph"].filter(function (n) { return [].concat(n["@type"] || []).indexOf("Question") < 0; });
        ld.textContent = JSON.stringify(g);
      } catch (e) { /* leave structured data as it was */ }
    }

    var crumb = d.querySelector(".bradcump ul li:last-child"); if (crumb) crumb.textContent = f.title;
    var crumbCat = d.querySelector(".bradcump li.post-category a"); if (crumbCat) crumbCat.textContent = f.cat;
    var h1 = d.querySelector(".category-heading h1"); if (h1) h1.textContent = f.title;
    var pc = d.querySelector("div.post-category ul"); if (pc) { var a = pc.querySelector("a"); pc.innerHTML = '<li><a href="' + esc(a ? a.getAttribute("href") : "/blog") + '">' + esc(f.cat) + "</a></li>"; }
    var pm = d.querySelector(".post-meta ul");
    if (pm) pm.innerHTML = '\n\t\t\t\t<li>By<a href="/blog"> ' + esc(f.author) + " </a></li>\n                <li>" + esc(longDate(f.date)) + "</li>\n                <li>" + f.rt + " min read</li>\n            ";

    var banner = d.querySelector(".blog-banner");
    if (banner) banner.innerHTML = f.cover ? '\n                    <img src="' + esc(f.cover) + '" class="attachment-full size-full wp-post-image" alt="' + esc(f.title) + '" decoding="async" fetchpriority="high">\n                ' : "";

    var body = d.querySelector(".blog-description");
    var holder = d.createElement("div"); holder.innerHTML = f.body;
    var used = {}, toc = [];
    $$("h2", holder).forEach(function (h) {
      /* Article headings only: styled h2s inside promo boxes (e.g. "Upcoming
         Masterclass") stay out of the table of contents, as on the old blog. */
      var plain = !h.className && !h.getAttribute("style");
      if (!plain && !h.classList.contains("wp-block-heading")) return;
      var id = h.id || slugify(h.textContent) || "section"; var base = id, n = 2;
      while (used[id]) id = base + "-" + n++;
      used[id] = 1; h.id = id; if (!h.className) h.className = "wp-block-heading";
      toc.push('<li>\n                            <button href="#' + id + '">\n                                ' + esc(h.textContent.trim()) + "\n                            </button>\n                        </li>");
    });
    if (body) body.innerHTML = "\n" + holder.innerHTML + "\n";
    $$(".toc-list", d).forEach(function (t) { t.innerHTML = "\n" + toc.join("\n") + "\n"; });
    var tocBox = d.querySelector(".left-toc"); if (tocBox) tocBox.hidden = !toc.length; if (tocBox && toc.length) tocBox.removeAttribute("hidden");

    var ap = d.querySelector(".blog-author-single .author-details p"); if (ap) ap.textContent = f.author;
    var ab = d.querySelector(".author-dec"); if (ab && f.bio) ab.textContent = f.bio;
    var al = d.querySelector(".author-link-post a"); if (al) al.textContent = "View all posts by " + f.author;
    return EB.serialize(d);
  }

  /* ================= /blog index cards ================= */
  /* The change to /blog/index.html for this post, or null if nothing changes. */
  function indexChange(slug, f, show, feature) {
    return EB.readFile("blog/index.html").then(function (t) {
      var d = EB.parse(t), changed = false, href = "/blog/" + slug;
      var row = d.querySelector(".letest-arical .row");
      var card = row && $$(".col-lg-4", row).filter(function (c) { return c.querySelector('a[href="' + href + '"]'); })[0];
      if (row && show && f) {
        var n = EB.el('<div class="col-lg-4 col-md-6"><div class="blog-card"><div class="blog-img-box"><a href="' + href + '"><img src="' + esc(f.cover) + '" class="attachment-full size-full wp-post-image" alt="' + esc(f.title) + '" decoding="async"></a></div>' +
          '<div class="blog-meta"><span class="category">' + esc(f.cat) + '</span><span class="read-time">' + f.rt + ' min read</span></div><h3 class="blog-title"><a href="' + href + '">' + esc(f.title) + '</a></h3><p class="blog-desc">' + esc(f.desc) + "</p></div></div>");
        var imported = d.importNode(n, true);
        if (card) card.replaceWith(imported); else row.insertBefore(imported, row.firstElementChild);
        changed = true;
      } else if (card && !show) { card.remove(); changed = true; }

      var ul = d.querySelector(".banner-right ul");
      var li = ul && ul.querySelector('li[data-url="' + href + '"]');
      if (ul && feature && f) {
        var nl = d.createElement("li");
        nl.setAttribute("data-img", f.cover); nl.setAttribute("data-alt", f.title); nl.setAttribute("data-url", href); nl.textContent = f.title;
        if (li) li.replaceWith(nl); else ul.insertBefore(nl, ul.firstElementChild);
        changed = true;
      } else if (li && !feature) { li.remove(); changed = true; }
      return changed ? { path: "blog/index.html", content: EB.serialize(d) } : null;
    });
  }

  /* ================= rich text editor ================= */
  var ALLOWED = { P: 1, H2: 1, H3: 1, H4: 1, UL: 1, OL: 1, LI: 1, A: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, BLOCKQUOTE: 1, IMG: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1, BR: 1, FIGURE: 1, FIGCAPTION: 1, HR: 1, CODE: 1, PRE: 1 };
  var KEEP = { href: 1, src: 1, alt: 1, target: 1, rel: 1, colspan: 1, rowspan: 1 };
  /* Pasted HTML (Google Docs, Word, other sites) is reduced to clean tags. */
  function sanitize(html) {
    var d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 8) { c.remove(); return; }
        if (c.nodeType !== 1) return;
        walk(c);
        if (/^(SCRIPT|STYLE|META|LINK|TITLE)$/.test(c.tagName)) { c.remove(); return; }
        if (!ALLOWED[c.tagName]) { while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c); c.remove(); return; }
        [].slice.call(c.attributes).forEach(function (a) { if (!KEEP[a.name]) c.removeAttribute(a.name); });
      });
    })(d.body);
    return d.body.innerHTML;
  }
  function richText(host) {
    host.innerHTML = '<div class="rte"><div class="bar">' +
      '<button data-c="formatBlock" data-v="<p>" title="Paragraph">P</button><button data-c="formatBlock" data-v="<h2>" title="Section heading">H2</button><button data-c="formatBlock" data-v="<h3>" title="Sub-heading">H3</button><button data-c="formatBlock" data-v="<h4>">H4</button><i></i>' +
      '<button data-c="bold" title="Bold"><b>B</b></button><button data-c="italic" title="Italic"><i style="width:auto;background:none;margin:0">I</i></button><button data-c="underline" title="Underline"><u>U</u></button><i></i>' +
      '<button data-c="insertUnorderedList" title="Bullet list">• List</button><button data-c="insertOrderedList" title="Numbered list">1. List</button><button data-c="formatBlock" data-v="<blockquote>" title="Quote">“ Quote</button><i></i>' +
      '<button data-x="link" title="Link">Link</button><button data-c="unlink" title="Remove link">Unlink</button><button data-x="img" title="Image">Image</button><button data-x="table" title="Table">Table</button><button data-c="insertHorizontalRule" title="Divider">—</button><i></i>' +
      '<button data-c="removeFormat" title="Clear formatting">Clear</button><button data-x="src" title="Edit HTML">&lt;/&gt; HTML</button></div>' +
      '<div class="ed" contenteditable="true"></div><textarea class="src" hidden spellcheck="false"></textarea></div>';
    var ed = $(".ed", host), src = $(".src", host), bar = $(".bar", host), cbs = [];
    function changed() { cbs.forEach(function (f) { f(); }); }
    function saveRange() { var s = getSelection(); return s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null; }
    function restore(r) { ed.focus(); if (r) { var s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
    bar.addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var c = b.getAttribute("data-c"), x = b.getAttribute("data-x");
      if (c) { if (!src.hidden) return; ed.focus(); document.execCommand(c, false, b.getAttribute("data-v")); changed(); return; }
      var r = saveRange();
      if (x === "link") EB.prompt("Add link", "Link address", "https://").then(function (u) { restore(r); if (u) { document.execCommand("createLink", false, u); changed(); } });
      else if (x === "img") EB.pickMedia().then(function (u) {
        if (!u) return; EB.prompt("Image description", "Alt text (what the image shows)").then(function (alt) {
          restore(r); document.execCommand("insertHTML", false, '<img src="' + esc(u) + '" alt="' + esc(alt || "") + '">'); changed();
        });
      });
      else if (x === "table") { restore(r); document.execCommand("insertHTML", false, "<table><thead><tr><th>Heading</th><th>Heading</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p></p>"); changed(); }
      else if (x === "src") {
        if (src.hidden) { src.value = ed.innerHTML; src.hidden = false; ed.hidden = true; b.classList.add("on"); }
        else { ed.innerHTML = src.value; src.hidden = true; ed.hidden = false; b.classList.remove("on"); changed(); }
      }
    });
    ed.addEventListener("input", changed);
    src.addEventListener("input", changed);
    ed.addEventListener("paste", function (e) {
      var cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      var h = cd.getData("text/html");
      if (h) document.execCommand("insertHTML", false, sanitize(h));
      else document.execCommand("insertText", false, cd.getData("text/plain"));
      changed();
    });
    return {
      get: function () { return src.hidden ? ed.innerHTML : src.value; },
      set: function (h) { ed.innerHTML = h; src.value = h; },
      onChange: function (f) { cbs.push(f); }
    };
  }
  EB.richText = richText;
})();
