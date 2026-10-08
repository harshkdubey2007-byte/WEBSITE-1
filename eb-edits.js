/* Re-applies admin panel edits on the Next.js pages (home, about, alumni, ...).
   React re-renders those pages from its JS bundle after load, which would undo
   edits made to the HTML. The admin panel stores each edit in
   <script id="eb-edits-data"> and this script puts them back whenever React
   changes the page. Each edit: s = CSS path, tag, o/n = original/new text used
   to find the element if the path drifts, f = fallback selector, h = inner
   HTML, a = attributes (null removes), k = "title" | "meta" for head tags. */
(function () {
  var data = document.getElementById("eb-edits-data");
  if (!data) return;
  var edits;
  try { edits = JSON.parse(data.textContent) || []; } catch (e) { return; }
  if (!edits.length) return;

  function norm(s) { return (s || "").replace(/\s+/g, " ").trim(); }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function attrsMatch(n, a) { for (var k in a) if (n.getAttribute(k) !== a[k]) return false; return true; }
  function ok(n, e) {
    if (!n || n.tagName !== e.tag) return false;
    if (e.o != null) { var t = norm(n.textContent); return t === e.o || t === e.n; }
    if (e.f) { try { if (n.matches(e.f)) return true; } catch (x) {} return !!e.a && attrsMatch(n, e.a); }
    return true;
  }
  function find(e) {
    var n = q(e.s);
    if (ok(n, e)) return n;
    if (e.o != null && e.o !== "") {
      var list = document.getElementsByTagName(e.tag);
      for (var i = 0; i < list.length; i++) {
        var t = norm(list[i].textContent);
        if (t === e.o || t === e.n) return list[i];
      }
    }
    if (e.f) { n = q(e.f); if (n) return n; }
    return null;
  }
  var busy = false;
  function apply() {
    busy = true;
    for (var i = 0; i < edits.length; i++) {
      var e = edits[i];
      if (e.k === "title") { if (document.title !== e.v) document.title = e.v; continue; }
      if (e.k === "meta" || e.k === "link") {
        /* Head tags: created if React's re-render dropped them. */
        var attr = e.k === "meta" ? "content" : "href", m = q(e.s);
        if (!m && e.v) {
          var pm = /^(meta|link)\[(name|property|rel)="([^"]+)"\]$/.exec(e.s);
          if (pm) { m = document.createElement(pm[1]); m.setAttribute(pm[2], pm[3]); document.head.appendChild(m); }
        }
        if (m && m.getAttribute(attr) !== e.v) m.setAttribute(attr, e.v);
        continue;
      }
      var n = find(e);
      if (!n) continue;
      if (e.h != null && n.innerHTML !== e.h) n.innerHTML = e.h;
      if (e.a) for (var k in e.a) {
        var v = e.a[k];
        if (v === null) { if (n.hasAttribute(k)) n.removeAttribute(k); }
        else if (n.getAttribute(k) !== v) n.setAttribute(k, v);
      }
    }
    busy = false;
  }
  var timer = 0;
  function later() { if (busy) return; clearTimeout(timer); timer = setTimeout(apply, 30); }
  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  window.addEventListener("load", apply);
  if (window.MutationObserver) {
    new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  }
})();
