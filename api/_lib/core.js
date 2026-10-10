/* eBuddha admin panel API, shared by the online version (api/admin.js on
   Vercel, files stored in GitHub) and the local version (admin/server.js,
   files on this computer). Both give it a "store" with the same methods:

     read(path) / readBuffer(path)   file contents, or null
     list()                          every file: [{ path, size, mtime? }]
     commit(changes, message)        changes: [{ path, content | null, sha? }]
     history(path) / readAt(path,id) earlier versions of one file
     log() / trash() / untrash(id)   activity and deleted files
     auth: { configured, missing, check(pw), secret, setPassword? }

   Every request is GET or POST /api/admin?route=<name>&... */
"use strict";
const crypto = require("crypto");

const TEXT_EXT = /\.(html?|css|m?js|json|xml|txt|md|svg|webmanifest)$|\.(css|js)@ver=/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)$/i;
const UPLOAD_EXT = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp|mp4|webm|pdf)$/i;
const MIME = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", bmp: "image/bmp", mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", xml: "application/xml", txt: "text/plain" };

function httpError(code, msg) { const e = new Error(msg); e.status = code; return e; }

/* Normalise a site-relative path and refuse anything that climbs out of the site. */
function clean(p) {
  if (typeof p !== "string" || !p.trim()) throw httpError(400, "Missing path");
  const parts = [];
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === ".." || seg.startsWith(".")) throw httpError(400, "That path is not allowed");
    parts.push(seg);
  }
  if (!parts.length) throw httpError(400, "Missing path");
  if (parts[0] === "api" || parts[0] === "admin" || parts[0] === "node_modules") throw httpError(403, "The admin panel's own files can't be edited here");
  return parts.join("/");
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

/* ---------------- HTML helpers ---------------- */
const decode = s => s.replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8211;/g, "–").replace(/&#8217;/g, "’");
const isNextPage = html => html.includes("self.__next_f");
const urlFor = p => "/" + p.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "");
const isPage = p => /\.html?$/i.test(p) && !/@/.test(p) && !/^(_next|admin|api)\//.test(p) && !/(^|\/)wp-(content|includes)\//.test(p) && !/^[^/]*\.[^/]*\//.test(p);

function pageInfo(p, html, meta) {
  const title = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "").replace(/\s+/g, " ").trim();
  const desc = (/<meta\s+name=["']description["']\s+content=["']([^"']*)/i.exec(html) || [])[1] || "";
  let kind = "page";
  if (p.startsWith("blog/")) kind = "blog"; else if (/course/.test(p)) kind = "course"; else if (/privacy|terms|refund/.test(p)) kind = "legal";
  return { path: p, url: urlFor(p), title: decode(title), desc: decode(desc), noindex: /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html), next: isNextPage(html), size: meta.size, mtime: meta.mtime || 0, kind };
}

/* Edit mode: every <script> switched off so the editor sees exactly the HTML in
   the file. The original type is kept in data-ebx-type and put back on save.
   Only each script's opening tag is touched, never its text. A <base> makes
   the page's relative links resolve from its real folder. */
function previewHtml(p, html) {
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (m, attrs, body) => {
    let t = "";
    attrs = attrs.replace(/\s+type\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, (x, v) => { t = v.replace(/^["']|["']$/g, ""); return ""; });
    return "<script" + attrs + ' type="text/ebx-disabled" data-ebx-type="' + t.replace(/"/g, "&quot;") + '">' + body + "</script>";
  });
  const dir = "/" + p.replace(/[^/]*$/, "");
  return html.replace(/<head\b[^>]*>/i, m => m + '<base href="' + dir + '" data-ebx-base="">');
}

/* React (Next.js) pages re-render from their JS bundle and would undo edits, so
   their edits are also stored in the page and re-applied by /eb-edits.js. */
const EDITS_RE = /<script id="eb-edits-data" type="application\/json">([\s\S]*?)<\/script>\s*<script src="\/eb-edits\.js" defer><\/script>\s*/i;
function readEdits(html) { const m = EDITS_RE.exec(html || ""); if (!m) return []; try { return JSON.parse(m[1]); } catch (e) { return []; } }
function mergeEdits(old, add) {
  const key = e => (e.k || "el") + "|" + (e.s || "");
  const map = new Map(old.map(e => [key(e), e]));
  for (const e of add) {
    const prev = map.get(key(e));
    if (prev) { if (prev.o != null) e.o = prev.o; if (prev.f) e.f = prev.f; if (prev.a && e.a) e.a = Object.assign({}, prev.a, e.a); if (prev.h != null && e.h == null) e.h = prev.h; map.delete(key(e)); }
    map.set(key(e), e);
  }
  return [...map.values()];
}
function injectEdits(html, edits) {
  html = html.replace(EDITS_RE, "");
  if (!edits.length) return html;
  const block = '<script id="eb-edits-data" type="application/json">' + JSON.stringify(edits).replace(/</g, "\\u003c") + '</script><script src="/eb-edits.js" defer></script>';
  const i = html.lastIndexOf("</body>");
  return i < 0 ? html + block : html.slice(0, i) + block + html.slice(i);
}

/* Site-wide code injection lives between marker comments in every page. */
const INJ_HEAD = /<!--eb:head-->([\s\S]*?)<!--\/eb:head-->/, INJ_BODY = /<!--eb:body-->([\s\S]*?)<!--\/eb:body-->/;
function applyInjection(html, head, body) {
  html = html.replace(new RegExp(INJ_HEAD.source, "g"), "").replace(new RegExp(INJ_BODY.source, "g"), "");
  if (head) { const i = html.search(/<\/head>/i); if (i >= 0) html = html.slice(0, i) + "<!--eb:head-->" + head + "<!--/eb:head-->" + html.slice(i); }
  if (body) { const i = html.lastIndexOf("</body>"); if (i >= 0) html = html.slice(0, i) + "<!--eb:body-->" + body + "<!--/eb:body-->" + html.slice(i); }
  return html;
}

function makeMatcher(q, cs, regex) {
  const src = regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try { return new RegExp(src, cs ? "g" : "gi"); } catch (e) { throw httpError(400, "Invalid pattern: " + e.message); }
}

/* ---------------- site health ----------------
   Reads every page and reports broken internal links, missing images, images
   without alt text, images loaded from other websites, oversized images, pages
   without an h1 and duplicate viewport tags. Score: 100 minus capped penalties. */
async function health(list, store) {
  const set = new Set(list.map(f => f.path));
  let redirects = [];
  try { redirects = (JSON.parse((await store.read("vercel.json")) || "{}").redirects || []).map(r => r.source); } catch (e) {}
  const redirected = u => redirects.some(s => s.includes(":path*") ? u === s.replace("/:path*", "") || u.startsWith(s.replace(":path*", "")) : s === u);
  const fileFor = u => {
    let p = u.split("#")[0].split("?")[0]; try { p = decodeURIComponent(p); } catch (e) {}
    p = p.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p) return "index.html";
    for (const c of [p, p + "/index.html", p + ".html"]) if (set.has(c)) return c;
    return null;
  };
  const resolve = (base, href) => { try { return new URL(href, "https://site.invalid/" + base).pathname; } catch (e) { return null; } };
  const pages = list.filter(f => isPage(f.path));
  const issues = [], hot = {}, checked = { links: 0, images: 0 };
  const add = (type, sev, page, detail) => issues.push({ type, sev, page, detail });
  await mapLimit(pages, 8, async f => {
    const raw = await store.read(f.path); if (!raw) return;
    const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const seen = new Set();
    for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
      let h = m[1].trim().replace(/&amp;/g, "&");
      if (/^(mailto:|tel:|javascript:|#|data:|whatsapp:|sms:)/i.test(h)) continue;
      h = h.replace(/^https?:\/\/(www\.)?ebuddha\.in/i, "") || "/";
      if (/^(https?:)?\/\//i.test(h)) continue;
      const u = resolve(f.path, h); if (!u || seen.has(u)) continue;
      seen.add(u); checked.links++;
      const plain = u.replace(/@.*$/, "");   // saved-site links carry the query after "@"
      if (!fileFor(u) && !fileFor(plain) && !redirected(u) && !redirected(plain)) add("broken-link", "high", f.path, h);
    }
    if (!/<h1\b/i.test(html)) add("no-h1", "low", f.path, "No main heading (h1)");
    const vp = (raw.match(/<meta\s+name=["']viewport/gi) || []).length;
    if (vp > 1) add("dup-viewport", "low", f.path, vp + " viewport tags");
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const src = ((/\ssrc\s*=\s*["']([^"']+)["']/i.exec(m[0]) || [])[1] || "").replace(/&amp;/g, "&");
      if (!src || /^data:/i.test(src)) continue;
      checked.images++;
      if (!/\salt\s*=/i.test(m[0])) add("no-alt", "low", f.path, src);
      if (/^(https?:)?\/\//i.test(src)) continue;
      const u = resolve(f.path, src);
      if (u && !fileFor(u)) add("missing-image", "high", f.path, src);
    }
    const urls = new Set();
    for (const m of raw.matchAll(/https?:\/\/([a-z0-9.-]+)(\/[^"'\s)\\<>]+?\.(?:png|jpe?g|gif|webp|svg|avif))/gi)) {
      const host = m[1].toLowerCase(); if (/ebuddha\.in$/.test(host) || urls.has(m[0])) continue;
      urls.add(m[0]);
      const h = hot[host] = hot[host] || { host, count: 0, local: 0, pages: new Set() };
      h.count++; h.pages.add(f.path);
      let p = m[2]; try { p = decodeURIComponent(p); } catch (e) {}
      if (set.has(host + p)) h.local++;
    }
  });
  const large = list.filter(f => IMAGE_EXT.test(f.path) && f.size > 500 * 1024 && !/(^|\/)_next\//.test(f.path)).sort((a, b) => b.size - a.size);
  large.slice(0, 200).forEach(f => add("large-image", "mid", f.path, Math.round(f.size / 1024) + " KB"));
  const count = t => issues.filter(i => i.type === t).length;
  const hotlinks = Object.values(hot).map(h => ({ host: h.host, count: h.count, local: h.local, pages: h.pages.size })).sort((a, b) => b.count - a.count);
  const counts = { brokenLinks: count("broken-link"), missingImages: count("missing-image"), noAlt: count("no-alt"), largeImages: large.length, noH1: count("no-h1"), dupViewport: count("dup-viewport"), hotlinked: hotlinks.reduce((s, h) => s + h.count, 0) };
  const pen = (n, each, max) => Math.min(max, n * each);
  const score = Math.max(0, Math.round(100 - pen(counts.brokenLinks, 2, 30) - pen(counts.missingImages, 3, 20) - pen(counts.noAlt, 0.5, 15) - pen(counts.largeImages, 1, 10) - (counts.hotlinked ? 10 : 0) - pen(counts.noH1, 1, 5) - pen(counts.dupViewport, 1, 5)));
  return { score, counts, issues: issues.slice(0, 2000), hotlinks, scanned: pages.length, checked, at: Date.now() };
}

/* ---------------- sessions (signed cookie, no server state) ---------------- */
function sign(secret, v) { return crypto.createHmac("sha256", secret).update(v).digest("hex"); }
function makeToken(secret) { const exp = String(Date.now() + 12 * 3600e3); return exp + "." + sign(secret, exp); }
function validToken(secret, t) {
  const m = /^(\d+)\.([a-f0-9]{64})$/.exec(t || "");
  if (!m || +m[1] < Date.now()) return false;
  const a = Buffer.from(sign(secret, m[1]), "hex"), b = Buffer.from(m[2], "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- request plumbing ---------------- */
/* Over-limit bodies are drained rather than cut off, so the browser receives
   the 413 message instead of a dropped connection. */
function readBody(req, limit) {
  const tooBig = () => httpError(413, "That file is too large (max " + Math.round(limit / 1048576) + " MB)");
  if (+req.headers["content-length"] > limit) { req.resume(); return Promise.reject(tooBig()); }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size <= limit) chunks.push(c); });
    req.on("end", () => size > limit ? reject(tooBig()) : resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJSON(req) {
  const b = await readBody(req, 20 * 1024 * 1024);
  try { return JSON.parse(b.toString("utf8") || "{}"); } catch (e) { throw httpError(400, "Bad JSON"); }
}

/* ================================================================ */
function createHandler(makeStore, opts) {
  opts = opts || {};
  const uploadLimit = opts.uploadLimit || 50 * 1024 * 1024;

  return async function handler(req, res) {
    const u = new URL(req.url, "http://x");
    const route = u.searchParams.get("route") || "";
    const q = k => u.searchParams.get(k);
    const send = (code, body, type) => {
      if (res.headersSent) return;
      res.statusCode = code;
      res.setHeader("Content-Type", type || "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    let store;
    try {
      store = await makeStore();
      const auth = store.auth;
      const secure = (req.headers["x-forwarded-proto"] || "").includes("https");
      const cookie = v => res.setHeader("Set-Cookie", "eb_admin=" + v + "; HttpOnly; SameSite=Strict; Path=/" + (secure ? "; Secure" : "") + (v ? "; Max-Age=43200" : "; Max-Age=0"));
      const token = (/(?:^|;\s*)eb_admin=([^;]+)/.exec(req.headers.cookie || "") || [])[1];
      const authed = auth.configured && validToken(auth.secret, token);
      const post = req.method === "POST";
      if (post && req.headers["x-eb-admin"] !== "1") return send(403, { error: "Missing admin header" });

      /* ---------- open routes ---------- */
      if (route === "status") return send(200, { authed, mode: store.name, site: store.label, configured: auth.configured, missing: auth.missing || [], canSetup: !!auth.setPassword && !auth.configured });
      if (route === "setup" && post) {
        if (!auth.setPassword || auth.configured) throw httpError(400, "A password is already set");
        const { password } = await readJSON(req);
        if (!password || password.length < 8) throw httpError(400, "Use at least 8 characters");
        await auth.setPassword(password); cookie(makeToken(store.auth.secret)); return send(200, { ok: true });
      }
      if (route === "login" && post) {
        if (!auth.configured) throw httpError(503, "The admin password is not set up yet");
        const { password } = await readJSON(req);
        if (!(await auth.check(String(password || "")))) { await new Promise(r => setTimeout(r, 800)); throw httpError(401, "Wrong password"); }
        cookie(makeToken(auth.secret)); return send(200, { ok: true });
      }
      if (route === "logout") { cookie(""); return send(200, { ok: true }); }
      if (!authed) return send(401, { error: "Please log in" });

      /* ---------- shared helpers bound to this store ---------- */
      let files = null;
      const all = async () => files || (files = await store.list());
      const exists = async p => (await all()).some(f => f.path === p);
      const under = async p => (await all()).filter(f => f.path === p || f.path.startsWith(p + "/"));
      const protect = p => { if (["index.html", "blog/index.html", "blog", "_next", "eb-edits.js", "vercel.json"].includes(p) || p.startsWith("_next/")) throw httpError(400, "That item is protected: " + p); };
      const commit = async (changes, message) => { const r = await store.commit(changes, message); files = null; return r; };
      const pages = async () => {
        const list = (await all()).filter(f => isPage(f.path));
        const out = await mapLimit(list, 8, async f => { const h = await store.read(f.path); return h == null ? null : pageInfo(f.path, h, f); });
        return out.filter(Boolean).sort((a, b) => a.path.localeCompare(b.path));
      };
      const blog = async () => {
        const index = (await store.read("blog/index.html")) || "";
        const posts = (await all()).filter(f => /^blog\/[^/]+\/index\.html$/.test(f.path) && !/^blog\/wp-/.test(f.path));
        const out = await mapLimit(posts, 8, async f => {
          const html = await store.read(f.path); if (!html) return null;
          const slug = f.path.split("/")[1];
          const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "";
          const meta = (/<div class="post-meta[^"]*">([\s\S]*?)<\/div>/i.exec(html) || [])[1] || "";
          const lis = [...meta.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
          return {
            slug, path: f.path, title: decode(h1.replace(/<[^>]+>/g, "").trim()), author: (lis[0] || "").replace(/^By\s*/, ""), date: lis[1] || "", readTime: lis[2] || "",
            image: (/<div class="blog-banner">[\s\S]*?<img[^>]*\ssrc="([^"]+)"/i.exec(html) || [])[1] || "",
            desc: decode((/<meta\s+name=["']description["']\s+content=["']([^"']*)/i.exec(html) || [])[1] || ""),
            onIndex: index.includes('href="/blog/' + slug + '"'), mtime: f.mtime || 0
          };
        });
        return out.filter(Boolean).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      };
      const textFiles = async next => (await all()).filter(f => TEXT_EXT.test(f.path) && (next || !f.path.startsWith("_next/")) && !/^(fonts|admin)\//.test(f.path) && !/^fonts\./.test(f.path));

      /* ---------- authenticated routes ---------- */
      switch (route) {
        case "overview": {
          const list = await all();
          const log = await store.log();
          return send(200, {
            pages: list.filter(f => isPage(f.path)).length,
            blog: list.filter(f => /^blog\/[^/]+\/index\.html$/.test(f.path) && !/^blog\/wp-/.test(f.path)).length,
            media: list.filter(f => IMAGE_EXT.test(f.path) && !f.path.startsWith("_next/")).length,
            week: log.filter(l => l.t > Date.now() - 7 * 864e5).length, recent: log.slice(0, 12),
            extra: store.overview ? await store.overview() : null
          });
        }
        case "pages": return send(200, await pages());
        case "blog": return send(200, await blog());
        case "media": {
          /* Newest first. GitHub has no file dates, so uploads (images/uploads/YYYY-MM/) lead, latest month first. */
          const up = p => p.startsWith("images/uploads/");
          return send(200, (await all()).filter(f => IMAGE_EXT.test(f.path) && !f.path.startsWith("_next/"))
            .sort((a, b) => (b.mtime || 0) - (a.mtime || 0) || up(b.path) - up(a.path) || (up(a.path) ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path))));
        }
        case "tree": {
          const dir = (q("dir") || "").replace(/^\/+|\/+$/g, "");
          const pre = dir ? dir + "/" : "", seen = new Map();
          for (const f of await all()) {
            if (!f.path.startsWith(pre)) continue;
            const rest = f.path.slice(pre.length), i = rest.indexOf("/");
            const name = i < 0 ? rest : rest.slice(0, i);
            if (!dir && (name === "api" || name === "admin")) continue;
            const e = seen.get(name) || { name, path: pre + name, dir: i >= 0, size: 0, mtime: 0 };
            e.size += f.size || 0; e.mtime = Math.max(e.mtime, f.mtime || 0); seen.set(name, e);
          }
          return send(200, [...seen.values()].sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name)));
        }
        case "file": {
          const p = clean(q("path"));
          if (post) {
            const { content, create, message } = await readJSON(req);
            if (!TEXT_EXT.test(p)) throw httpError(400, "Only text files can be edited here");
            if (typeof content !== "string") throw httpError(400, "Missing content");
            if (create && await exists(p)) throw httpError(409, "That file already exists");
            return send(200, Object.assign({ ok: true }, await commit([{ path: p, content }], message || "Admin: edit " + p)));
          }
          const c = await store.read(p);
          if (c == null) throw httpError(404, "File not found: " + p);
          return send(200, { path: p, content: c });
        }
        case "files": {
          if (!post) break;
          const { changes, message } = await readJSON(req);
          if (!Array.isArray(changes) || !changes.length) throw httpError(400, "Nothing to save");
          const list = [];
          for (const c of changes) {
            const p = clean(c.path);
            if (c.delete) { protect(p); const hit = await under(p); hit.forEach(f => list.push({ path: f.path, content: null })); continue; }
            if (!TEXT_EXT.test(p)) throw httpError(400, "Only text files can be edited here: " + p);
            if (typeof c.content !== "string") throw httpError(400, "Missing content for " + p);
            list.push({ path: p, content: c.content });
          }
          if (!list.length) throw httpError(400, "Nothing to save");
          return send(200, Object.assign({ ok: true }, await commit(list, message || "Admin: update " + list.map(c => c.path).join(", ").slice(0, 200))));
        }
        case "page-save": {
          if (!post) break;
          const { path, html, edits } = await readJSON(req);
          const p = clean(path);
          if (!/\.html?$/i.test(p)) throw httpError(400, "Not an HTML page");
          if (typeof html !== "string" || html.length < 20) throw httpError(400, "Missing page HTML");
          let out = html;
          if (isNextPage(html)) out = injectEdits(html, mergeEdits(readEdits(await store.read(p)), Array.isArray(edits) ? edits : []));
          return send(200, Object.assign({ ok: true }, await commit([{ path: p, content: out }], "Admin: edit " + p)));
        }
        case "preview": {
          const p = clean(q("path"));
          const h = await store.read(p);
          if (h == null) return send(404, "Page not found", "text/plain");
          return send(200, previewHtml(p, h), MIME.html);
        }
        case "raw": {
          const p = clean(q("path"));
          const b = await store.readBuffer(p);
          if (!b) return send(404, "Not found", "text/plain");
          return send(200, b, MIME[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream");
        }
        case "delete": {
          if (!post) break;
          const p = clean((await readJSON(req)).path);
          protect(p);
          const hit = await under(p);
          if (!hit.length) throw httpError(404, "Not found: " + p);
          return send(200, Object.assign({ ok: true }, await commit(hit.map(f => ({ path: f.path, content: null })), "Admin: delete " + p)));
        }
        case "upload": {
          if (!post) break;
          const name = decodeURIComponent(req.headers["x-filename"] || "").split(/[\\/]/).pop();
          if (!UPLOAD_EXT.test(name)) throw httpError(400, "Allowed: images, mp4, webm, pdf");
          const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
          const d = new Date();
          const dir = clean(q("dir") || "images/uploads/" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
          const base = name.slice(0, -ext.length).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
          let p = dir + "/" + base + ext, n = 1;
          while (await exists(p)) p = dir + "/" + base + "-" + (++n) + ext;
          const buf = await readBody(req, uploadLimit);
          if (!buf.length) throw httpError(400, "Empty file");
          const r = await commit([{ path: p, content: buf }], "Admin: upload " + p);
          return send(200, Object.assign({ ok: true, path: p, url: "/" + p }, r));
        }
        case "search": {
          const s = q("q") || "";
          if (s.length < 2) throw httpError(400, "Type at least 2 characters");
          const re = makeMatcher(s, q("case") === "1", q("regex") === "1"), one = new RegExp(re.source, re.flags.replace("g", ""));
          const hits = await mapLimit(await textFiles(q("next") === "1"), 10, async f => {
            const t = await store.read(f.path); if (!t) return null;
            const m = t.match(re); if (!m) return null;
            const i = t.search(one);
            return { path: f.path, count: m.length, sample: t.slice(Math.max(0, i - 60), i + 100).replace(/\s+/g, " ") };
          });
          return send(200, hits.filter(Boolean));
        }
        case "replace": {
          if (!post) break;
          const { q: s, r, cs, regex, next, paths } = await readJSON(req);
          if (!s || s.length < 2) throw httpError(400, "Type at least 2 characters");
          const re = makeMatcher(s, cs, regex), only = Array.isArray(paths) ? new Set(paths) : null;
          let count = 0;
          const changes = (await mapLimit((await textFiles(next)).filter(f => !only || only.has(f.path)), 10, async f => {
            const t = await store.read(f.path); if (!t) return null;
            const m = t.match(re); if (!m) return null;
            count += m.length; return { path: f.path, content: t.replace(re, regex ? r : () => r) };
          })).filter(Boolean);
          if (!changes.length) return send(200, { files: 0, count: 0 });
          const c = await commit(changes, "Admin: replace \"" + s.slice(0, 60) + "\" in " + changes.length + " files");
          return send(200, Object.assign({ files: changes.length, count }, c));
        }
        case "inject": {
          const list = (await all()).filter(f => isPage(f.path));
          if (!post) {
            for (const f of list) { const h = await store.read(f.path); const a = INJ_HEAD.exec(h || ""), b = INJ_BODY.exec(h || ""); if (a || b) return send(200, { head: a ? a[1] : "", body: b ? b[1] : "" }); }
            return send(200, { head: "", body: "" });
          }
          const { head, body } = await readJSON(req);
          const changes = (await mapLimit(list, 8, async f => { const h = await store.read(f.path); if (!h) return null; const o = applyInjection(h, head, body); return o === h ? null : { path: f.path, content: o }; })).filter(Boolean);
          if (!changes.length) return send(200, { pages: 0 });
          return send(200, Object.assign({ pages: changes.length }, await commit(changes, "Admin: code injection on " + changes.length + " pages")));
        }
        case "health": return send(200, await health(await all(), store));
        case "fix-hotlinks": {
          if (!post) break;
          const host = String((await readJSON(req)).host || "").toLowerCase();
          if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw httpError(400, "Bad host");
          const list = await all(), set = new Set(list.map(f => f.path));
          const re = new RegExp("https?://" + host.replace(/[.]/g, "\\.") + "(/[^\"'\\s)\\\\<>]+)", "g");
          let replaced = 0, kept = 0;
          const files = list.filter(f => /\.(html?|css|js)$/.test(f.path) && !f.path.startsWith(host + "/") && !/^(admin|api)\//.test(f.path));
          const changes = (await mapLimit(files, 10, async f => {
            const t = await store.read(f.path); if (!t || t.indexOf(host) < 0) return null;
            const out = t.replace(re, (m, p) => {
              let c = p.split(/[?#]/)[0]; try { c = decodeURIComponent(c); } catch (e) {}
              if (set.has(host + c)) { replaced++; return "/" + host + p; }
              kept++; return m;
            });
            return out === t ? null : { path: f.path, content: out };
          })).filter(Boolean);
          if (!changes.length) return send(200, { files: 0, replaced: 0, kept });
          return send(200, Object.assign({ files: changes.length, replaced, kept }, await commit(changes, "Admin: use local copies of " + host + " images")));
        }
        case "site-config": {
          const P = "eb-site.json";
          if (!post) { const t = await store.read(P); try { return send(200, t ? JSON.parse(t) : {}); } catch (e) { return send(200, {}); } }
          const { config } = await readJSON(req);
          if (!config || typeof config !== "object" || Array.isArray(config)) throw httpError(400, "Missing settings");
          const changes = [{ path: P, content: JSON.stringify(config, null, 2) + "\n" }];
          const tag = '<!--eb:site--><script src="/eb-site.js" defer></script><!--/eb:site-->';
          const targets = (await all()).filter(f => isPage(f.path) && !f.path.startsWith("dashboard/"));
          (await mapLimit(targets, 8, async f => {
            const h = await store.read(f.path); if (!h || h.includes("<!--eb:site-->")) return null;
            const i = h.lastIndexOf("</body>"); return i < 0 ? null : { path: f.path, content: h.slice(0, i) + tag + h.slice(i) };
          })).forEach(c => { if (c) changes.push(c); });
          return send(200, Object.assign({ ok: true, pages: changes.length - 1 }, await commit(changes, "Admin: update marketing tools")));
        }
        case "move": {
          if (!post) break;
          const b = await readJSON(req), from = clean(b.from), slug = String(b.slug || "").trim().toLowerCase();
          if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) throw httpError(400, "Use lowercase letters, numbers and dashes only");
          if (["index.html", "blog/index.html"].includes(from)) throw httpError(400, "This page's address can't be changed");
          const isDir = /\/index\.html$/.test(from), parent = from.replace(isDir ? /[^/]+\/index\.html$/ : /[^/]+$/, "");
          const oldBase = isDir ? from.replace(/\/index\.html$/, "") : from, newBase = parent + slug + (isDir ? "" : ".html");
          const newPath = isDir ? newBase + "/index.html" : newBase;
          if (newPath === from) throw httpError(400, "That's already the page's address");
          clean(newPath);
          const list = await all();
          if (list.some(f => f.path === newPath || f.path.startsWith(newBase + "/") || f.path === parent + slug + ".html" || f.path === parent + slug + "/index.html")) throw httpError(409, "Another page already uses /" + parent + slug);
          const moving = isDir ? list.filter(f => f.path.startsWith(oldBase + "/")) : list.filter(f => f.path === from);
          const oldUrl = urlFor(from), newUrl = urlFor(newPath), ORIGIN = /https?:\/\/(?:www\.)?ebuddha\.in/.source;
          const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // links to the old address: href="/old…" in markup and \"href\":\"/old…\" in React page data
          const reA = new RegExp("(href=[\"'](?:" + ORIGIN + ")?)" + esc(oldUrl) + "(?=[\"'/#?])", "g");
          const reJ = new RegExp('(\\\\"href\\\\":\\\\")' + esc(oldUrl) + '(?=\\\\"|/|#|\\?)', "g");
          let links = 0;
          const relink = t => b.updateLinks ? t.replace(reA, (m, a) => (links++, a + newUrl)).replace(reJ, (m, a) => (links++, a + newUrl)) : t;
          const changes = [];
          for (const f of moving) {
            const to = f.path === from ? newPath : newBase + f.path.slice(oldBase.length);
            if (f.path === from) {
              const t = relink((await store.read(f.path)).replace(new RegExp("(" + ORIGIN + ")" + esc(oldUrl) + "(?=[\"'/#?])", "g"), "$1" + newUrl));
              changes.push({ path: to, content: t });
            } else changes.push(f.sha ? { path: to, sha: f.sha } : { path: to, content: await store.readBuffer(f.path) });
            changes.push({ path: f.path, content: null });
          }
          if (b.updateLinks) {
            const others = list.filter(f => /\.html?$/i.test(f.path) && !/^(admin|api)\//.test(f.path) && !/(^|\/)_next\//.test(f.path) && !moving.some(m => m.path === f.path));
            (await mapLimit(others, 8, async f => {
              const t = await store.read(f.path); if (!t || t.indexOf(oldUrl) < 0) return null;
              const out = relink(t); return out === t ? null : { path: f.path, content: out };
            })).forEach(c => { if (c) changes.push(c); });
          }
          if (b.redirect !== false) {
            let cfg = {}; try { cfg = JSON.parse((await store.read("vercel.json")) || "{}"); } catch (e) {}
            // the page now lives at newUrl, so no redirect may start there; chains
            // that ended at the old address now end at the new one; no loops
            cfg.redirects = (cfg.redirects || []).filter(r => r.source !== oldUrl && r.source !== newUrl)
              .map(r => r.destination === oldUrl ? Object.assign(r, { destination: newUrl }) : r)
              .filter(r => r.source !== r.destination);
            cfg.redirects.push({ source: oldUrl, destination: newUrl, permanent: true });
            changes.push({ path: "vercel.json", content: JSON.stringify(cfg, null, 2) + "\n" });
          }
          const sm = await store.read("sitemap-0.xml");
          if (sm) { const s2 = sm.replace(new RegExp("(<loc>" + ORIGIN + ")" + esc(oldUrl) + "</loc>", "g"), "$1" + newUrl + "</loc>"); if (s2 !== sm) changes.push({ path: "sitemap-0.xml", content: s2 }); }
          const r = await commit(changes, "Admin: move " + oldUrl + " to " + newUrl);
          return send(200, Object.assign({ ok: true, path: newPath, url: newUrl, links }, r));
        }
        case "history": return send(200, await store.history(clean(q("path"))));
        case "version": {
          const c = await store.readAt(clean(q("path")), q("id"));
          if (c == null) throw httpError(404, "Version not found");
          return send(200, { content: c });
        }
        case "restore": {
          if (!post) break;
          const { path, id } = await readJSON(req);
          const p = clean(path), c = await store.readAt(p, id);
          if (c == null) throw httpError(404, "Version not found");
          return send(200, Object.assign({ ok: true }, await commit([{ path: p, content: c }], "Admin: restore " + p)));
        }
        case "log": return send(200, await store.log());
        case "trash": return send(200, await store.trash());
        case "untrash": {
          if (!post) break;
          const r = await store.untrash((await readJSON(req)).id);
          return send(200, Object.assign({ ok: true }, r));
        }
        default:
          if (store.routes && store.routes[route]) return send(200, await store.routes[route]({ req, q, post, readJSON: () => readJSON(req) }));
      }
      return send(404, { error: "Unknown request: " + route });
    } catch (e) {
      if (!e.status) console.error(e);
      return send(e.status || 500, { error: e.message || "Server error" });
    }
  };
}

module.exports = { createHandler, clean, httpError, mapLimit, TEXT_EXT, IMAGE_EXT };
