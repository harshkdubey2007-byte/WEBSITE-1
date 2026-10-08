/* Visual page editor with drag and drop.
   The page loads in an iframe with its scripts switched off (see previewHtml
   in api/_lib/core.js), so the DOM matches the file. Click selects,
   double-click edits text. A selected element gets a small toolbar with a
   drag handle; blocks from the "Add" tab and image files from the computer can
   be dragged onto the page; the "Sections" tab reorders whole sections.
   Saving serializes the iframe document back to the file.

   React pages also get a list of edits (see /eb-edits.js) because React would
   otherwise re-render them from its bundle. On those pages only in-place
   changes are allowed: no adding, moving or removing elements. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc, ic = EB.ic;
  var MARK = "data-ebx-";
  var STYLE = "[data-ebx-hover]{outline:2px dashed #2F5BFF!important;outline-offset:1px!important;cursor:pointer!important}" +
    "[data-ebx-sel]{outline:2px solid #2F5BFF!important;outline-offset:1px!important}" +
    "[data-ebx-ce]{outline:2px solid #16A34A!important;outline-offset:2px!important;cursor:text!important}" +
    "[data-ebx-dragging]{opacity:.35!important}" +
    '[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important}html{scroll-behavior:auto!important}' +
    "#ebx-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483647}" +
    "#ebx-tb{position:fixed;display:none;align-items:center;gap:1px;background:#2F5BFF;color:#fff;border-radius:7px;padding:3px;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap}" +
    "#ebx-tb button{all:unset;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px;border-radius:5px;cursor:pointer;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif}" +
    "#ebx-tb button:hover{background:rgba(255,255,255,.22)}#ebx-tb button[disabled]{opacity:.4;cursor:not-allowed}" +
    "#ebx-tb .grab{cursor:grab;background:rgba(255,255,255,.16)}#ebx-tb .grab:active{cursor:grabbing}" +
    "#ebx-tb .tag{padding:0 6px;opacity:.85;font:500 11px ui-monospace,Consolas,monospace}" +
    "#ebx-tb svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    "#ebx-line{position:fixed;display:none;background:#16A34A;border-radius:3px;box-shadow:0 0 0 3px rgba(22,163,74,.25)}" +
    "#ebx-box{position:fixed;display:none;border:2px dashed #16A34A;background:rgba(22,163,74,.08);border-radius:6px}" +
    "#ebx-chip{position:fixed;display:none;background:#111827;color:#fff;padding:7px 10px;border-radius:7px;font:600 12px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.3)}";
  var SVG = {
    grab: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    dup: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>'
  };
  var INLINE = /^(A|SPAN|STRONG|EM|B|I|U|SMALL|LABEL|CODE|SUP|SUB|MARK|ABBR|BR|SVG|PATH)$/;
  var TEXTISH = /^(P|H1|H2|H3|H4|H5|H6|A|SPAN|BUTTON|LABEL|STRONG|EM|B|I|SMALL|SUMMARY|FIGCAPTION|BLOCKQUOTE)$/;
  var VOID = /^(IMG|INPUT|SELECT|TEXTAREA|VIDEO|IFRAME|SVG|HR|BR|PICTURE|SOURCE)$/;
  var SKIP = /^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|BASE)$/;

  function norm(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  function editor(root, params) {
    var path = params.get("path");
    if (!path) return EB.go("pages");
    var url = EB.urlFor(path);
    root.innerHTML = '<div class="ve"><div class="ve-top">' +
      '<a class="btn ghost sm" href="#/pages">← Back</a><span class="nm" title="' + esc(path) + '">' + esc(path) + '</span><span class="badge amber" id="vnx" hidden>React page</span><span class="sep"></span>' +
      '<div class="seg" id="vdev"><button data-w="100%" class="on">Desktop</button><button data-w="820px">Tablet</button><button data-w="390px">Mobile</button></div><span class="sep"></span>' +
      '<button class="btn sm" id="vun" disabled title="Undo (Ctrl+Z)">Undo</button><div class="spacer"></div><span class="u" id="vst"></span>' +
      '<button class="btn sm" id="vseo">SEO</button><a class="btn sm" href="#/code?path=' + encodeURIComponent(path) + '">' + ic("code") + 'Code</a>' +
      '<a class="btn sm" target="_blank" href="' + esc(url) + '">' + ic("ext") + 'Live</a><button class="btn sm primary" id="vsv">Save</button></div>' +
      '<div class="ve-body"><div class="ve-stage"><iframe id="vf" title="Page being edited"></iframe></div><aside class="ve-panel" id="vp">' +
      '<div class="ve-tabs" role="tablist"><button data-tab="edit" class="on">Edit</button><button data-tab="add">Add blocks</button><button data-tab="sections">Sections</button></div><div id="vpb"><p class="u">Loading page…</p></div></aside></div></div>';

    var frame = $("#vf"), panel = $("#vpb");
    var doc, win, isNext = false, sel = null, editEl = null, editStart = "", stack = [], tab = "edit";
    var layer, tb, line, box, chip;
    var drag = null;      // { el } while moving an element on the page
    var justDragged = 0;
    var libDrag = null;   // block being dragged from the "Add" tab
    var navDrag = null;   // index being dragged in the "Sections" tab

    frame.src = EB.url("preview", { path: path });
    frame.onload = function () {
      doc = frame.contentDocument; win = frame.contentWindow;
      if (!doc || !doc.body) { panel.innerHTML = '<div class="warn">Could not open this page.</div>'; return; }
      isNext = [].some.call(doc.scripts, function (s) { return s.textContent.indexOf("self.__next_f") > -1; });
      $("#vnx").hidden = !isNext;
      var st = doc.createElement("style"); st.id = "ebx-admin-style"; st.textContent = STYLE; doc.head.appendChild(st);
      buildLayer(); bind(); drawPanel(); follow();
    };

    /* ---------- state ---------- */
    function setDirty(v) { EB.setDirty(v); $("#vst").innerHTML = v ? '<span class="dot"></span>Unsaved changes' : ""; }
    function snapshot() {
      stack.push(doc.body.innerHTML); if (stack.length > 40) stack.shift();
      $("#vun").disabled = false; setDirty(true);
    }
    function undo() {
      if (!stack.length) return;
      editEl = null;
      doc.body.innerHTML = stack.pop();
      $$("[data-ebx-hover],[data-ebx-sel],[data-ebx-ce],[data-ebx-dragging]", doc).forEach(function (n) { ["hover", "sel", "ce", "dragging"].forEach(function (k) { n.removeAttribute(MARK + k); }); n.removeAttribute("contenteditable"); });
      sel = null; $("#vun").disabled = !stack.length; drawPanel();
    }

    /* Remember how to find this element again on React pages. */
    function remember(n) {
      if (!isNext) return;
      if (!n.hasAttribute(MARK + "o")) n.setAttribute(MARK + "o", norm(n.textContent));
      if (!n.hasAttribute(MARK + "f") && !norm(n.textContent)) {
        var a = n.getAttribute("src") ? "src" : n.getAttribute("href") ? "href" : null;
        if (a) n.setAttribute(MARK + "f", n.tagName.toLowerCase() + "[" + a + '="' + n.getAttribute(a).replace(/["\\]/g, "\\$&") + '"]');
      }
    }
    function markHtml(n) { n.setAttribute(MARK + "dirty", ""); n.setAttribute(MARK + "h", ""); }
    function markAttr(n, k) {
      n.setAttribute(MARK + "dirty", "");
      var list = JSON.parse(n.getAttribute(MARK + "attrs") || "[]");
      if (list.indexOf(k) < 0) list.push(k);
      n.setAttribute(MARK + "attrs", JSON.stringify(list));
    }
    function setAttr(n, k, v, noSnap) {
      if (k === "src" && n.hasAttribute(MARK + "realsrc")) { n.removeAttribute(MARK + "realsrc"); n.onerror = null; }
      if ((v === null && !n.hasAttribute(k)) || n.getAttribute(k) === v) return;
      if (!noSnap) snapshot();
      remember(n);
      if (v === null) n.removeAttribute(k); else n.setAttribute(k, v);
      markAttr(n, k);
    }
    /* A just-uploaded image isn't on the live site yet (online it deploys in a
       minute), so preview it straight from storage; the real address is kept
       in data-ebx-realsrc and written on save. */
    function previewImage(img) {
      img.onerror = function () {
        img.onerror = null;
        var real = img.getAttribute("src"); if (!real || !/^\//.test(real)) return;
        img.setAttribute(MARK + "realsrc", real);
        img.setAttribute("src", EB.url("raw", { path: real.slice(1) }));
      };
    }

    /* ---------- selection + text editing ---------- */
    function inLayer(t) { return t && t.closest && t.closest("#ebx-layer"); }
    function pickable(t) { return t && t.nodeType === 1 && t !== doc.body && t !== doc.documentElement && !inLayer(t); }
    function select(n, keepTab) {
      if (sel) sel.removeAttribute(MARK + "sel");
      sel = pickable(n) ? n : null;
      if (sel) { sel.setAttribute(MARK + "sel", ""); if (!keepTab) tab = "edit"; }
      drawPanel(); placeToolbar();
    }
    function startEdit(n) {
      if (!pickable(n) || VOID.test(n.tagName)) return;
      stopEdit();
      snapshot(); remember(n);
      editEl = n; editStart = n.innerHTML;
      n.setAttribute("contenteditable", "true"); n.setAttribute(MARK + "ce", "");
      if (sel !== n) select(n); else drawPanel();
      placeToolbar();
      n.focus();
    }
    function stopEdit() {
      if (!editEl) return;
      var n = editEl; editEl = null;
      n.removeAttribute("contenteditable"); n.removeAttribute(MARK + "ce");
      if (n.innerHTML !== editStart) markHtml(n);
      else { stack.pop(); $("#vun").disabled = !stack.length; if (!stack.length) setDirty(false); }
      drawPanel(); placeToolbar();
    }

    function bind() {
      doc.addEventListener("mouseover", function (e) {
        var t = e.target; if ((editEl && editEl.contains(t)) || drag || inLayer(t)) return;
        $$("[data-ebx-hover]", doc).forEach(function (n) { n.removeAttribute(MARK + "hover"); });
        if (pickable(t)) t.setAttribute(MARK + "hover", "");
      }, true);
      doc.addEventListener("mouseleave", function () { $$("[data-ebx-hover]", doc).forEach(function (n) { n.removeAttribute(MARK + "hover"); }); }, true);
      doc.addEventListener("click", function (e) {
        var t = e.target;
        if (inLayer(t)) return;
        if (editEl && editEl.contains(t)) { if (t.closest("a")) e.preventDefault(); return; }
        e.preventDefault(); e.stopPropagation();
        if (Date.now() - justDragged < 400) return;
        if (editEl) stopEdit();
        select(t);
      }, true);
      doc.addEventListener("dblclick", function (e) { if (inLayer(e.target)) return; e.preventDefault(); startEdit(e.target); }, true);
      doc.addEventListener("submit", function (e) { e.preventDefault(); }, true);
      doc.addEventListener("paste", function (e) {
        if (!editEl) return;
        e.preventDefault();
        doc.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
      }, true);
      doc.addEventListener("keydown", keys, true);
      /* Blocks from the panel and image files from the computer. */
      doc.addEventListener("dragover", onDragOver, true);
      doc.addEventListener("dragleave", function (e) { if (!e.relatedTarget) hideDrop(); }, true);
      doc.addEventListener("drop", onDrop, true);
      doc.addEventListener("dragstart", function (e) { if (!inLayer(e.target)) e.preventDefault(); }, true);
    }
    function keys(e) {
      var mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (e.key === "Escape") { if (drag) endMove(true); else if (editEl) stopEdit(); else select(null); }
      else if (mod && e.key.toLowerCase() === "z" && !editEl) { e.preventDefault(); undo(); }
      else if ((e.key === "Delete") && sel && !editEl && e.target === doc.body) { e.preventDefault(); removeSel(); }
    }
    document.addEventListener("keydown", parentKeys);
    function parentKeys(e) {
      if (!document.body.contains(frame)) return document.removeEventListener("keydown", parentKeys);
      if ($(".ov")) return;
      var tag = (e.target.tagName || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && tag !== "input" && tag !== "textarea") { e.preventDefault(); undo(); }
    }

    /* ---------- on-page toolbar + drop indicators ---------- */
    function buildLayer() {
      layer = doc.createElement("div"); layer.id = "ebx-layer";
      layer.innerHTML = '<div id="ebx-tb"></div><div id="ebx-line"></div><div id="ebx-box"></div><div id="ebx-chip"></div>';
      doc.documentElement.appendChild(layer);   // outside <body>, so it is never saved or undone
      tb = layer.querySelector("#ebx-tb"); line = layer.querySelector("#ebx-line"); box = layer.querySelector("#ebx-box"); chip = layer.querySelector("#ebx-chip");
      tb.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-t]"); if (!b || b.disabled) return;
        e.preventDefault(); e.stopPropagation();
        var t = b.getAttribute("data-t");
        if (t === "up") select(sel.parentElement); else if (t === "dup") duplicate(); else if (t === "del") removeSel(); else if (t === "edit") startEdit(sel);
      });
      tb.addEventListener("pointerdown", function (e) {
        if (!e.target.closest(".grab") || !sel || isNext) return;
        e.preventDefault();
        startMove(e);
      });
    }
    function label(n) {
      var cls = n.classList && n.classList[0] ? "." + n.classList[0] : "";
      return n.tagName.toLowerCase() + (n.id ? "#" + n.id : cls).slice(0, 24);
    }
    function placeToolbar() {
      if (!tb) return;
      if (!sel || editEl || drag || !doc.contains(sel)) { tb.style.display = "none"; return; }
      var r = sel.getBoundingClientRect();
      if (r.bottom < 0 || r.top > win.innerHeight) { tb.style.display = "none"; return; }
      var html = (isNext ? "" : '<button class="grab" title="Drag to move">' + SVG.grab + "Drag</button>") +
        '<span class="tag">' + esc(label(sel)) + "</span>" +
        (VOID.test(sel.tagName) ? "" : '<button data-t="edit" title="Edit text">' + SVG.edit + "</button>") +
        '<button data-t="up" title="Select the element around this one">' + SVG.up + "</button>" +
        (isNext ? "" : '<button data-t="dup" title="Duplicate">' + SVG.dup + "</button>") +
        '<button data-t="del" title="' + (isNext ? "Hide" : "Delete") + '">' + SVG.del + "</button>";
      if (tb.getAttribute("data-for") !== html) { tb.innerHTML = html; tb.setAttribute("data-for", html); }
      tb.style.display = "flex";
      var top = r.top - 34; if (top < 4) top = Math.min(r.top + 4, win.innerHeight - 34); if (top < 4) top = 4;
      var left = Math.max(4, Math.min(r.left, win.innerWidth - tb.offsetWidth - 4));
      tb.style.top = top + "px"; tb.style.left = left + "px";
    }
    /* Keep the toolbar glued to the selection while the page scrolls or changes. */
    function follow() {
      if (!document.body.contains(frame)) return;
      placeToolbar();
      win.requestAnimationFrame(follow);
    }
    function hideDrop() { if (line) { line.style.display = box.style.display = chip.style.display = "none"; } }
    function showDrop(d, text, x, y) {
      hideDrop();
      if (!d) return;
      var r;
      if (d.pos === "inside") {
        r = d.ref.getBoundingClientRect();
        Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: Math.max(r.height, 24) + "px" });
      } else {
        var ref = d.pos === "end" ? d.last : d.ref;
        if (!ref) return;
        r = ref.getBoundingClientRect();
        var after = d.pos === "after" || d.pos === "end";
        if (d.horiz) Object.assign(line.style, { display: "block", left: (after ? r.right : r.left) - 2 + "px", top: r.top + "px", width: "4px", height: r.height + "px" });
        else Object.assign(line.style, { display: "block", left: r.left + "px", top: (after ? r.bottom : r.top) - 2 + "px", width: r.width + "px", height: "4px" });
      }
      if (text) { chip.textContent = text; Object.assign(chip.style, { display: "block", left: Math.min(x + 14, win.innerWidth - 220) + "px", top: Math.min(y + 14, win.innerHeight - 40) + "px" }); }
    }

    /* ---------- where a drop lands ---------- */
    function visible(n) { return n.nodeType === 1 && !SKIP.test(n.tagName) && n.id !== "ebx-layer" && (n.offsetWidth || n.offsetHeight || n.getClientRects().length); }
    /* The element that holds the page's sections: <main>, or the body, skipping single wrappers. */
    function contentRoot() {
      var r = doc.querySelector("main") || doc.body;
      for (var i = 0; i < 3; i++) {
        var kids = [].filter.call(r.children, visible);
        if (kids.length === 1 && kids[0].children.length > 1 && !/^(HEADER|FOOTER|NAV)$/.test(kids[0].tagName)) r = kids[0]; else break;
      }
      return r;
    }
    function rootKids(r) { return [].filter.call(r.children, function (n) { return visible(n) && !/^(HEADER|FOOTER)$/.test(n.tagName) && !n.classList.contains("eb-hd") && !n.classList.contains("eb-ft"); }); }
    function endDrop() {
      var r = contentRoot(), kids = rootKids(r);
      return { ref: r, pos: "end", last: kids[kids.length - 1] || null, horiz: false };
    }
    function blockish(t) { return t && t.nodeType === 1 && !(INLINE.test(t.tagName) && win.getComputedStyle(t).display.indexOf("inline") === 0); }
    /* A whole page section: it moves between the other sections. */
    function isSection(n) {
      return n.parentElement === contentRoot() || /^(SECTION|ARTICLE)$/.test(n.tagName) || n.classList.contains("ebb-section");
    }
    /* big: sections go between the page's sections; everything else lands
       exactly where the pointer is. */
    function findDrop(x, y, dragging, big) {
      var t = doc.elementFromPoint(x, y);
      if (!t || inLayer(t)) return null;
      if (t === doc.body || t === doc.documentElement) return endDrop();
      if (dragging && (t === dragging || dragging.contains(t))) return null;
      if (big) {
        var root = contentRoot();
        if (!root.contains(t) || t === root) return endDrop();
        while (t.parentElement && t.parentElement !== root) t = t.parentElement;
        if (dragging && t === dragging) return null;
        var rb = t.getBoundingClientRect();
        return { ref: t, pos: y < rb.top + rb.height / 2 ? "before" : "after", horiz: false };
      }
      while (t && t !== doc.body && !blockish(t)) t = t.parentElement;
      if (!t || t === doc.body) return endDrop();
      if (!VOID.test(t.tagName) && !TEXTISH.test(t.tagName) && !t.children.length && !norm(t.textContent) && t.offsetHeight < 400) return { ref: t, pos: "inside" };
      while (t.parentElement && t.parentElement !== doc.body && (TEXTISH.test(t.parentElement.tagName) || t.parentElement.tagName === "PICTURE")) t = t.parentElement;
      if (t.closest("header, nav")) return null;
      var r = t.getBoundingClientRect(), p = t.parentElement;
      var cs = p ? win.getComputedStyle(p) : null;
      var horiz = !!cs && ((/flex/.test(cs.display) && !/column/.test(cs.flexDirection)) || /grid/.test(cs.display)) && r.width < p.getBoundingClientRect().width * 0.8;
      var before = horiz ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
      return { ref: t, pos: before ? "before" : "after", horiz: horiz };
    }
    function place(d, node) {
      if (d.pos === "before") d.ref.before(node);
      else if (d.pos === "after") d.ref.after(node);
      else if (d.pos === "inside") d.ref.appendChild(node);
      else if (d.last) d.last.after(node);
      else d.ref.appendChild(node);
    }
    function autoScroll(y) {
      var h = win.innerHeight;
      if (y < 70) win.scrollBy(0, -Math.ceil((70 - y) / 3));
      else if (y > h - 70) win.scrollBy(0, Math.ceil((y - (h - 70)) / 3));
    }

    /* ---------- move an element by dragging its handle ---------- */
    function startMove(e) {
      stopEdit();
      var el = sel, big = isSection(el);
      drag = { el: el, big: big, x: e.clientX, y: e.clientY, d: null, id: e.pointerId };
      el.setAttribute(MARK + "dragging", "");
      tb.style.display = "none";
      doc.documentElement.style.cursor = "grabbing"; doc.documentElement.style.userSelect = "none";
      doc.addEventListener("pointermove", moveMove, true);
      doc.addEventListener("pointerup", moveUp, true);
      win.addEventListener("blur", cancelMove);
      /* Scroll when the pointer rests near the top or bottom edge. */
      drag.timer = setInterval(function () { if (drag && (drag.y < 70 || drag.y > win.innerHeight - 70)) { autoScroll(drag.y); track({ clientX: drag.x, clientY: drag.y }); } }, 30);
    }
    function track(e) {
      drag.x = e.clientX; drag.y = e.clientY;
      drag.d = findDrop(drag.x, drag.y, drag.el, drag.big);
      showDrop(drag.d, "Moving " + label(drag.el), drag.x, drag.y);
    }
    function moveMove(e) { if (drag) track(e); }
    function moveUp(e) { if (drag) track(e); endMove(false); }
    function cancelMove() { endMove(true); }
    function endMove(cancel) {
      if (!drag) return;
      var d = drag.d, el = drag.el;
      clearInterval(drag.timer);
      doc.removeEventListener("pointermove", moveMove, true);
      doc.removeEventListener("pointerup", moveUp, true);
      win.removeEventListener("blur", cancelMove);
      el.removeAttribute(MARK + "dragging");
      doc.documentElement.style.cursor = ""; doc.documentElement.style.userSelect = "";
      var s = doc.getSelection(); if (s) s.removeAllRanges();
      drag = null; hideDrop();
      justDragged = Date.now();   // the click that ends a drag must not select something else
      if (cancel || !d || d.ref === el || (d.pos === "inside" && el.contains(d.ref))) { placeToolbar(); return; }
      if ((d.pos === "before" && d.ref.previousElementSibling === el) || (d.pos === "after" && d.ref.nextElementSibling === el)) { placeToolbar(); return; }
      snapshot(); place(d, el); select(el); if (tab === "sections") drawPanel();
    }

    /* ---------- drop blocks from the panel and files from the computer ---------- */
    function hasFiles(e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") > -1; }
    function onDragOver(e) {
      if (!libDrag && !hasFiles(e)) return;
      e.preventDefault();
      if (isNext) { e.dataTransfer.dropEffect = "none"; return; }
      e.dataTransfer.dropEffect = "copy";
      autoScroll(e.clientY);
      var over = doc.elementFromPoint(e.clientX, e.clientY);
      if (!libDrag && over && over.tagName === "IMG") { hideDrop(); showDrop({ ref: over, pos: "inside" }, "Drop to replace this image", e.clientX, e.clientY); return; }
      var d = findDrop(e.clientX, e.clientY, null, libDrag ? libDrag.kind === "section" : false);
      showDrop(d, libDrag ? "Add " + libDrag.name : "Add image", e.clientX, e.clientY);
    }
    function onDrop(e) {
      if (!libDrag && !hasFiles(e)) return;
      e.preventDefault(); hideDrop();
      if (isNext) return EB.toast("Adding blocks isn't available on React pages", "err");
      var over = doc.elementFromPoint(e.clientX, e.clientY);
      if (libDrag) {
        var blk = libDrag; libDrag = null;
        var d = findDrop(e.clientX, e.clientY, null, blk.kind === "section");
        if (d) insertBlock(blk, d);
        return;
      }
      var files = [].filter.call(e.dataTransfer.files, function (f) { return /^image\//.test(f.type); });
      if (!files.length) return EB.toast("Only image files can be dropped onto the page", "err");
      if (over && over.tagName === "IMG") {
        EB.toast("Uploading…");
        return EB.upload(files[0]).then(function (r) { select(over); setImg(r.url); EB.toast("Image replaced", "ok"); }).catch(EB.fail);
      }
      var drop = findDrop(e.clientX, e.clientY, null, false);
      if (!drop) return;
      EB.toast("Uploading " + files.length + " image(s)…");
      files.reduce(function (p, f) { return p.then(function (list) { return EB.upload(f).then(function (r) { list.push(r.url); return list; }); }); }, Promise.resolve([]))
        .then(function (urls) {
          snapshot(); ensureBlockCss();
          var last = null;
          urls.forEach(function (u) {
            var fig = doc.createElement("figure"); fig.className = "ebb-img";
            var img = doc.createElement("img"); img.setAttribute("src", u); img.setAttribute("alt", ""); previewImage(img);
            fig.appendChild(img);
            if (last) last.after(fig); else place(drop, fig);
            last = fig;
          });
          select(last.querySelector("img")); EB.toast("Image added. Add alt text on the right.", "ok");
        }).catch(EB.fail);
    }
    function ensureBlockCss() {
      if (doc.querySelector('link[href="/eb-blocks.css"]')) return;
      var l = doc.createElement("link"); l.rel = "stylesheet"; l.href = "/eb-blocks.css"; doc.head.appendChild(l);
    }
    function insertBlock(blk, d) {
      if (isNext) return EB.toast("Adding blocks isn't available on React pages", "err");
      var t = doc.createElement("template"); t.innerHTML = blk.html.trim();
      var node = doc.importNode(t.content.firstElementChild, true);
      snapshot(); ensureBlockCss();
      place(d || afterSelection(blk), node);
      select(node);
      node.scrollIntoView({ block: "nearest" });
      EB.toast(blk.name + " added. Double-click its text to edit.", "ok");
    }
    /* Click-to-add: after the selected element (or its section for section blocks), else at the end. */
    function afterSelection(blk) {
      if (!sel) return endDrop();
      var t = sel;
      if (blk.kind === "section") { var root = contentRoot(); while (t.parentElement && t.parentElement !== root && t.parentElement !== doc.body) t = t.parentElement; }
      else while (t.parentElement && TEXTISH.test(t.parentElement.tagName)) t = t.parentElement;
      return { ref: t, pos: "after" };
    }

    /* ---------- structural actions (static pages only) ---------- */
    function clean(n) { [n].concat($$("*", n)).forEach(function (x) { [].slice.call(x.attributes).forEach(function (a) { if (a.name.indexOf(MARK) === 0) x.removeAttribute(a.name); }); }); return n; }
    function removeSel() {
      if (!sel) return;
      if (isNext) { var s = sel.getAttribute("style") || ""; setAttr(sel, "style", (s ? s.replace(/;?\s*$/, ";") : "") + "display:none"); select(null); return; }
      snapshot(); var n = sel; select(null); n.remove();
      if (tab === "sections") drawPanel();
    }
    function duplicate() { if (isNext) return; snapshot(); var c = clean(sel.cloneNode(true)); sel.after(c); select(c); }
    function move(dir) {
      var sib = dir < 0 ? sel.previousElementSibling : sel.nextElementSibling;
      while (sib && !visible(sib)) sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
      if (!sib) return EB.toast("Already at the " + (dir < 0 ? "top" : "bottom"));
      snapshot(); if (dir < 0) sib.before(sel); else sib.after(sel);
      sel.scrollIntoView({ block: "center" }); drawPanel();
    }

    /* ---------- text formatting ---------- */
    function fmt(cmd, val) {
      if (!editEl) return;
      frame.contentWindow.focus();
      doc.execCommand(cmd, false, val || null);
    }
    function withRange(fn) {
      var s = doc.getSelection(), r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
      fn(function () { frame.contentWindow.focus(); if (r) { s.removeAllRanges(); s.addRange(r); } });
    }

    /* ---------- side panel ---------- */
    $(".ve-tabs").onclick = function (e) { var b = e.target.closest("[data-tab]"); if (!b) return; tab = b.getAttribute("data-tab"); drawPanel(); };
    function drawPanel() {
      if (!doc) return;
      $$(".ve-tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === tab); });
      var h = "";
      if (isNext) h += '<div class="warn"><b>React page.</b> You can change text, links and images. Dragging, adding blocks and reordering sections are turned off here, and “Delete” hides the element.</div>';
      if (tab === "add") return drawAdd(h);
      if (tab === "sections") return drawSections(h);
      if (!sel) {
        panel.innerHTML = h + "<h3>How to edit</h3><p class='u'><b>Click</b> anything to select it.<br><b>Drag</b> the blue handle above it to move it.<br><b>Double-click</b> text to type over it.<br><b>Drop an image file</b> from your computer onto a picture to replace it.</p>" +
          "<p class='u'><b>Esc</b> stops editing · <b>Ctrl+S</b> saves · <b>Ctrl+Z</b> undoes.</p>" +
          "<h3>Add things</h3><p class='u'>Open <b>Add blocks</b> and drag headings, buttons, images or whole sections onto the page.</p>" +
          "<h3>Page</h3><p class='u'>Change the title, description and share image with the <b>SEO</b> button at the top.</p>";
        return;
      }
      var chain = [], n = sel;
      while (n && n !== doc.body && chain.length < 5) { chain.unshift(n); n = n.parentElement; }
      h += '<div class="ve-crumb">' + chain.map(function (c, i) { return '<button data-up="' + (chain.length - 1 - i) + '">' + esc(label(c)) + "</button>"; }).join("") + "</div>";

      h += '<div class="ve-acts">' +
        '<button class="btn" data-a="edit"' + (VOID.test(sel.tagName) ? " disabled" : "") + ">" + ic("edit") + (editEl ? "Stop editing" : "Edit text") + "</button>" +
        '<button class="btn" data-a="parent">Select parent</button>' +
        '<button class="btn" data-a="dup"' + (isNext ? " disabled" : "") + '>Duplicate</button>' +
        '<button class="btn danger" data-a="del">' + ic("trash") + (isNext ? "Hide" : "Delete") + "</button>" +
        '<button class="btn" data-a="up"' + (isNext ? " disabled" : "") + '>Move up</button>' +
        '<button class="btn" data-a="down"' + (isNext ? " disabled" : "") + ">Move down</button></div>";

      if (editEl) {
        h += '<h3>Format text</h3><div class="ve-fmt">' + [["bold", "<b>B</b>"], ["italic", "<i>I</i>"], ["underline", "<u>U</u>"], ["h2", "H2"], ["h3", "H3"], ["p", "P"],
          ["ul", "• List"], ["ol", "1. List"], ["link", "Link"], ["unlink", "Unlink"], ["img", "Image"], ["clear", "Clear"]].map(function (b) { return '<button data-f="' + b[0] + '">' + b[1] + "</button>"; }).join("") + "</div>";
      }

      var a = sel.closest("a");
      if (a) {
        h += "<h3>Link</h3><label class='f' style='margin-top:0'>Goes to</label><input type='text' id='la' value='" + esc(a.getAttribute("href") || "") + "' placeholder='/contact or https://…'>" +
          "<label class='check'><input type='checkbox' id='lt'" + (a.getAttribute("target") === "_blank" ? " checked" : "") + ">Open in a new tab</label>";
      }
      if (sel.tagName === "IMG") {
        var real = sel.getAttribute(MARK + "realsrc") || sel.getAttribute("src") || "";
        h += "<h3>Image</h3><img class='imgpv' id='ip' alt=''><div class='row' style='flex-wrap:nowrap'><input type='text' id='is' value='" + esc(real) + "'></div>" +
          "<div class='row' style='margin-top:6px'><button class='btn sm' id='ich'>" + ic("media") + "Choose</button><label class='btn sm'>" + ic("upload") + "Upload<input type='file' accept='image/*' id='iu' hidden></label></div>" +
          "<p class='hint'>Tip: drag an image file from your computer straight onto the picture.</p>" +
          "<label class='f'>Alt text <small>describes the image for Google & screen readers</small></label><input type='text' id='ia' value='" + esc(sel.getAttribute("alt") || "") + "'>";
      }
      var bg = sel.style && sel.style.backgroundImage;
      if (bg && bg !== "none") {
        var bu = (/url\(["']?([^"')]+)/.exec(bg) || [])[1] || "";
        h += "<h3>Background image</h3><div class='row' style='flex-wrap:nowrap'><input type='text' id='bgu' value='" + esc(bu) + "'><button class='btn sm' id='bgc'>Choose</button></div>";
      }
      if (/^(IFRAME|VIDEO|SOURCE)$/.test(sel.tagName)) {
        h += "<h3>Video / embed</h3><label class='f' style='margin-top:0'>Address <small>paste a YouTube link</small></label><input type='text' id='es' value='" + esc(sel.getAttribute("src") || "") + "' placeholder='https://www.youtube.com/watch?v=…'>";
      }
      if (sel.classList.contains("ebb-section")) {
        var look = sel.classList.contains("ebb-dark") ? "dark" : sel.classList.contains("ebb-soft") ? "soft" : "white";
        h += "<h3>Section background</h3><div class='chips'>" + [["white", "White"], ["soft", "Light grey"], ["dark", "eBuddha blue"]].map(function (o) { return "<button class='chip" + (o[0] === look ? " on" : "") + "' data-look='" + o[0] + "'>" + o[1] + "</button>"; }).join("") + "</div>";
      }
      if (sel.classList.contains("ebb-btn")) {
        h += "<h3>Button style</h3><div class='chips'><button class='chip" + (sel.classList.contains("ebb-outline") ? "" : " on") + "' data-btn='solid'>Filled</button><button class='chip" + (sel.classList.contains("ebb-outline") ? " on" : "") + "' data-btn='outline'>Outline</button></div>";
      }

      h += "<h3>Attributes</h3><div id='at'>" + [].slice.call(sel.attributes).filter(function (x) { return x.name.indexOf(MARK) !== 0 && x.name !== "contenteditable"; }).map(function (x) {
        return "<div class='attr'><span class='k' title='" + esc(x.name) + "'>" + esc(x.name) + "</span><input type='text' data-at='" + esc(x.name) + "' value='" + esc(x.name === "src" && sel.getAttribute(MARK + "realsrc") || x.value) + "'><button data-rm='" + esc(x.name) + "' aria-label='Remove attribute'>&times;</button></div>";
      }).join("") + "</div><div class='attr'><input type='text' id='nk' placeholder='name'><input type='text' id='nv' placeholder='value'><button id='na' aria-label='Add attribute'>+</button></div>";

      h += "<h3>HTML</h3><textarea id='hx' rows='8' class='mono' spellcheck='false'></textarea><div class='row' style='margin-top:6px'><button class='btn sm' id='hi'>Apply inner HTML</button>" +
        (isNext ? "" : "<button class='btn sm' id='ho'>Replace whole element</button>") + "</div>";

      panel.innerHTML = h;
      var hx = $("#hx", panel); hx.value = editEl ? "" : clean(sel.cloneNode(true)).innerHTML; hx.disabled = !!editEl;
      if ($("#ip", panel)) $("#ip", panel).src = sel.getAttribute("src") || "";
    }

    function drawAdd(h) {
      if (isNext) { panel.innerHTML = h; return; }
      var groups = {};
      EB.blocks.forEach(function (b) { (groups[b.group] = groups[b.group] || []).push(b); });
      panel.innerHTML = h + '<p class="u" style="margin:0 0 6px"><b>Drag</b> a block onto the page, or <b>click</b> it to add it ' + (sel ? "after the selected item" : "at the end of the page") + ".</p>" +
        Object.keys(groups).map(function (g) {
          return "<h3>" + esc(g) + '</h3><div class="blks">' + groups[g].map(function (b) {
            return '<button class="blk" draggable="true" data-blk="' + b.id + '" title="' + esc(b.name) + '"><span class="bi">' + esc(b.icon) + "</span>" + esc(b.name) + "</button>";
          }).join("") + "</div>";
        }).join("");
    }

    function drawSections(h) {
      if (isNext) { panel.innerHTML = h; return; }
      var root = contentRoot(), kids = rootKids(root);
      panel.innerHTML = h + '<p class="u" style="margin:0 0 10px">Drag sections to reorder the page. Click one to select it.</p><ol class="navl" id="navl">' + kids.map(function (k, i) {
        var hd = k.querySelector("h1,h2,h3"), name = norm(hd ? hd.textContent : k.textContent).slice(0, 48) || label(k);
        return '<li draggable="true" data-i="' + i + '"' + (k === sel ? ' class="on"' : "") + '><span class="gr" aria-hidden="true">⠿</span><span class="nt"><b>' + esc(name) + '</b><small>' + esc(label(k)) + "</small></span></li>";
      }).join("") + "</ol>" + (kids.length ? "" : '<p class="u">No sections found on this page.</p>');
      panel._kids = kids;
    }

    /* Add tab: drag start / click */
    panel.addEventListener("dragstart", function (e) {
      var b = e.target.closest("[data-blk]");
      if (b) {
        libDrag = EB.blocks.filter(function (x) { return x.id === b.getAttribute("data-blk"); })[0];
        e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", libDrag.name);
        return;
      }
      var li = e.target.closest("#navl li");
      if (li) { navDrag = +li.getAttribute("data-i"); li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "section"); }
    });
    panel.addEventListener("dragend", function () { libDrag = null; navDrag = null; hideDrop(); $$("#navl li", panel).forEach(function (l) { l.classList.remove("dragging", "over-top", "over-bottom"); }); });
    /* Sections tab: reorder by dragging list items */
    panel.addEventListener("dragover", function (e) {
      var li = e.target.closest("#navl li"); if (!li || navDrag === null) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      var r = li.getBoundingClientRect(), top = e.clientY < r.top + r.height / 2;
      $$("#navl li", panel).forEach(function (l) { l.classList.remove("over-top", "over-bottom"); });
      li.classList.add(top ? "over-top" : "over-bottom");
    });
    panel.addEventListener("drop", function (e) {
      var li = e.target.closest("#navl li"); if (!li || navDrag === null) return;
      e.preventDefault();
      var kids = panel._kids, from = kids[navDrag], to = kids[+li.getAttribute("data-i")];
      var r = li.getBoundingClientRect(), top = e.clientY < r.top + r.height / 2;
      navDrag = null;
      if (!from || !to || from === to) return drawPanel();
      snapshot();
      if (top) to.before(from); else to.after(from);
      from.scrollIntoView({ block: "start" });
      sel && sel.removeAttribute(MARK + "sel"); sel = from; sel.setAttribute(MARK + "sel", "");
      drawPanel(); EB.toast("Section moved", "ok");
    });

    panel.addEventListener("mousedown", function (e) { if (e.target.closest("[data-f]")) e.preventDefault(); });
    panel.addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-blk]"))) { insertBlock(EB.blocks.filter(function (x) { return x.id === b.getAttribute("data-blk"); })[0]); return; }
      if ((b = e.target.closest("#navl li"))) { var k = panel._kids[+b.getAttribute("data-i")]; select(k, true); k.scrollIntoView({ block: "start" }); return; }
      if ((b = e.target.closest("[data-look]"))) {
        var look = b.getAttribute("data-look"), c = sel.className.replace(/\s*ebb-(dark|soft)\b/g, "") + (look === "white" ? "" : " ebb-" + look);
        setAttr(sel, "class", c.trim()); drawPanel(); return;
      }
      if ((b = e.target.closest("[data-btn]"))) {
        var bc = sel.className.replace(/\s*ebb-outline\b/g, "") + (b.getAttribute("data-btn") === "outline" ? " ebb-outline" : "");
        setAttr(sel, "class", bc.trim()); drawPanel(); return;
      }
      if ((b = e.target.closest("[data-up]"))) { var n = sel; for (var i = +b.getAttribute("data-up"); i > 0; i--) n = n.parentElement; stopEdit(); select(n); return; }
      if ((b = e.target.closest("[data-a]"))) {
        var a = b.getAttribute("data-a");
        if (a === "edit") { if (editEl) stopEdit(); else startEdit(sel); }
        else { stopEdit(); if (a === "parent") select(sel.parentElement); else if (a === "dup") duplicate(); else if (a === "del") removeSel(); else if (a === "up") move(-1); else if (a === "down") move(1); }
        return;
      }
      if ((b = e.target.closest("[data-f]"))) {
        var f = b.getAttribute("data-f");
        if (f === "h2" || f === "h3" || f === "p") fmt("formatBlock", "<" + f + ">");
        else if (f === "ul") fmt("insertUnorderedList"); else if (f === "ol") fmt("insertOrderedList");
        else if (f === "clear") fmt("removeFormat"); else if (f === "unlink") fmt("unlink");
        else if (f === "link") withRange(function (restore) { EB.prompt("Add link", "Link address", "https://").then(function (u) { restore(); if (u) fmt("createLink", u); }); });
        else if (f === "img") withRange(function (restore) { EB.pickMedia().then(function (u) { restore(); if (u) fmt("insertImage", u); }); });
        else fmt(f);
        return;
      }
      if ((b = e.target.closest("[data-rm]"))) { setAttr(sel, b.getAttribute("data-rm"), null); drawPanel(); return; }
      var id = e.target.id;
      if (id === "na") { var key = $("#nk", panel).value.trim(); if (/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(key)) { setAttr(sel, key, $("#nv", panel).value); drawPanel(); } else EB.toast("Enter a valid attribute name", "err"); }
      else if (id === "ich") EB.pickMedia().then(function (u) { if (u) setImg(u); });
      else if (id === "bgc") EB.pickMedia().then(function (u) { if (u) setBg(u); });
      else if (id === "hi") { snapshot(); remember(sel); sel.innerHTML = $("#hx", panel).value; markHtml(sel); drawPanel(); }
      else if (id === "ho") {
        var t = doc.createElement("template"); t.innerHTML = $("#hx", panel).value.trim();
        var first = t.content.firstElementChild;
        snapshot(); var old = sel; select(null); old.replaceWith(t.content);
        if (first && doc.contains(first)) select(first);
      }
    });
    panel.addEventListener("change", function (e) {
      var t = e.target, a = sel && sel.closest("a");
      if (t.id === "la" && a) setAttr(a, "href", t.value.trim());
      else if (t.id === "lt" && a) { setAttr(a, "target", t.checked ? "_blank" : null); if (t.checked) setAttr(a, "rel", "noopener"); }
      else if (t.id === "is") setImg(t.value.trim());
      else if (t.id === "ia") setAttr(sel, "alt", t.value);
      else if (t.id === "bgu") setBg(t.value.trim());
      else if (t.id === "es") setAttr(sel, "src", youtube(t.value.trim()));
      else if (t.id === "iu" && t.files[0]) EB.upload(t.files[0]).then(function (r) { setImg(r.url); EB.toast("Uploaded", "ok"); }).catch(EB.fail);
      else if (t.hasAttribute("data-at")) setAttr(sel, t.getAttribute("data-at"), t.value);
    });
    /* Turn a normal YouTube link into its embed address. */
    function youtube(u) {
      var m = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/.exec(u);
      return m ? "https://www.youtube-nocookie.com/embed/" + m[1] : u;
    }
    function setImg(u) {
      snapshot();
      setAttr(sel, "src", u, true);
      setAttr(sel, "srcset", null, true); setAttr(sel, "sizes", null, true);
      var pic = sel.parentElement && sel.parentElement.tagName === "PICTURE" ? sel.parentElement : null;
      if (pic) $$("source", pic).forEach(function (s) { setAttr(s, "srcset", u, true); });
      previewImage(sel);
      drawPanel();
    }
    function setBg(u) {
      var s = sel.getAttribute("style") || "", re = /background(-image)?\s*:[^;]*url\([^)]*\)[^;]*/i;
      setAttr(sel, "style", re.test(s) ? s.replace(re, "background-image:url('" + u + "')") : s.replace(/;?\s*$/, ";") + "background-image:url('" + u + "')");
      drawPanel();
    }

    /* ---------- top bar ---------- */
    $("#vdev").onclick = function (e) { var b = e.target.closest("[data-w]"); if (!b) return; frame.style.width = b.getAttribute("data-w"); $$("#vdev button").forEach(function (x) { x.classList.toggle("on", x === b); }); };
    $("#vun").onclick = undo;
    $("#vsv").onclick = save;
    $("#vseo").onclick = function () {
      if (EB.dirty) return EB.toast("Save your changes first, then edit SEO.", "err");
      EB.seoModal(path, function () { frame.contentWindow.location.reload(); });
    };

    /* ---------- save ---------- */
    /* The page as it should be written to disk: scripts switched back on (before
       clean() strips the data-ebx-type that holds their original type), real
       image addresses restored, editor style, layer and markers removed. */
    function serialize() {
      var c = doc.documentElement.cloneNode(true);
      $$("script", c).forEach(function (s) {
        if (s.getAttribute("type") !== "text/ebx-disabled") return;
        var t = s.getAttribute(MARK + "type");
        if (t) s.setAttribute("type", t); else s.removeAttribute("type");
      });
      $$("[" + MARK + "realsrc]", c).forEach(function (n) { n.setAttribute("src", n.getAttribute(MARK + "realsrc")); });
      $$("#ebx-admin-style, #ebx-layer, base[data-ebx-base]", c).forEach(function (n) { n.remove(); });
      c.style.removeProperty("cursor"); c.style.removeProperty("user-select"); if (!c.getAttribute("style")) c.removeAttribute("style");
      clean(c);
      return (doc.doctype ? "<!DOCTYPE " + doc.doctype.name + ">" : "") + c.outerHTML;
    }
    function cssPath(n) {
      var parts = [];
      while (n && n.nodeType === 1 && n.tagName !== "HTML") {
        if (n.id && /^[A-Za-z][\w-]*$/.test(n.id) && doc.querySelectorAll("#" + n.id).length === 1) { parts.unshift("#" + n.id); break; }
        var tag = n.tagName.toLowerCase();
        if (tag === "body") { parts.unshift("body"); break; }
        var i = 1, s = n; while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
        parts.unshift(tag + ":nth-of-type(" + i + ")");
        n = n.parentElement;
      }
      return parts.join(" > ");
    }
    function collectEdits() {
      return $$("[" + MARK + "dirty]", doc).map(function (n) {
        var e = { s: cssPath(n), tag: n.tagName };
        var o = n.getAttribute(MARK + "o"); if (o) { e.o = o; e.n = norm(n.textContent); }
        var f = n.getAttribute(MARK + "f"); if (f) e.f = f;
        if (n.hasAttribute(MARK + "h")) e.h = clean(n.cloneNode(true)).innerHTML;
        var list = JSON.parse(n.getAttribute(MARK + "attrs") || "[]");
        if (list.length) { e.a = {}; list.forEach(function (k) { e.a[k] = k === "src" && n.getAttribute(MARK + "realsrc") || (n.hasAttribute(k) ? n.getAttribute(k) : null); }); }
        return e;
      });
    }
    function save() {
      if (!doc) return;
      stopEdit();
      var btn = $("#vsv"); btn.disabled = true;
      var edits = isNext ? collectEdits() : [];
      EB.post("page-save", { path: path, html: serialize(), edits: edits }).then(EB.saved).then(function () {
        $$("[" + MARK + "dirty]", doc).forEach(function (n) { ["dirty", "h", "attrs", "o", "f"].forEach(function (k) { n.removeAttribute(MARK + k); }); });
        stack = []; $("#vun").disabled = true; setDirty(false); EB.toast("Saved", "ok");
      }).catch(EB.fail).then(function () { btn.disabled = false; });
    }
  }
  editor.full = true;
  EB.routes.edit = editor;
})();
