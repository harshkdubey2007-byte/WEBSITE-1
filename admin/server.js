/* Runs the whole website on this computer, including the admin panel and exams:

     node admin/server.js          then open http://localhost:4173
     PORT=5000 node admin/server.js   to use another port

   It follows the parts of vercel.json that matter for browsing (clean URLs, no
   trailing slash, redirects, the custom 404 page). Admin saves change the files
   in this folder and are NOT published; commit and push them to do that. Private
   data stays in .local-data (see local-store.js). The online site does not use
   this file: Vercel runs api/admin.js instead. No npm install is needed. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createHandler } = require("../api/_lib/core");
const localStore = require("./local-store");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;
const adminHandler = createHandler(localStore, { uploadLimit: 50 * 1024 * 1024 });
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm",
  ".pdf": "application/pdf"
};

const redirects = (config.redirects || []).map(r => {
  const names = [];
  const pattern = r.source
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\/:(\w+)\*/g, (_, n) => { names.push(n); return "(?:/(.*))?"; })
    .replace(/\/:(\w+)/g, (_, n) => { names.push(n); return "/([^/]+)"; });
  return { re: new RegExp("^" + pattern + "$"), names, destination: r.destination, status: r.permanent ? 308 : 307 };
});

function findRedirect(pathname) {
  for (const r of redirects) {
    const m = pathname.match(r.re);
    if (!m) continue;
    let dest = r.destination;
    r.names.forEach((n, i) => { dest = dest.replace(new RegExp(":" + n + "\\*?"), m[i + 1] || ""); });
    return { location: dest.replace(/\/+$/, "") || "/", status: r.status };
  }
  return null;
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (e) { return false; }
}

function resolveFile(pathname) {
  const target = path.join(ROOT, pathname);
  const rel = path.relative(ROOT, target);
  /* Nothing outside the site, and nothing in a dot-folder: that covers .git and
     .local-data, which holds the admin password, exam papers and student work. */
  if (rel.split(path.sep).some(s => s === ".." || s.startsWith("."))) return null;
  return [target, target + ".html", path.join(target, "index.html")].find(isFile) || null;
}

function send(res, status, file, method) {
  res.writeHead(status, {
    "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-cache"
  });
  if (method === "HEAD") return res.end();
  fs.createReadStream(file).on("error", () => res.end()).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) {
    res.writeHead(400); return res.end("Bad request");
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    res.writeHead(308, { Location: pathname.replace(/\/+$/, "") + url.search });
    return res.end();
  }

  const redirect = findRedirect(pathname);
  if (redirect) {
    res.writeHead(redirect.status, { Location: redirect.location + url.search });
    return res.end();
  }

  if (pathname === "/api/admin") return adminHandler(req, res);
  if (pathname === "/api/exam") return localStore.exam.studentHandler(req, res);
  if (pathname === "/api/learner") return localStore.learner.studentHandler(req, res);
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    res.writeHead(501, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "This function only runs on Vercel, not on the local server" }));
  }

  const file = resolveFile(pathname);
  if (file) return send(res, 200, file, req.method);

  const notFound = path.join(ROOT, "404.html");
  if (isFile(notFound)) return send(res, 404, notFound, req.method);
  res.writeHead(404); res.end("Not found");
});
/* Node stops a request after 5 minutes by default, which would kill a long video upload. */
server.requestTimeout = 0;
/* Only this computer can connect, so students can't reach it over the network. */
server.listen(PORT, "127.0.0.1", () => {
  console.log("Website:     http://localhost:" + PORT);
  console.log("Admin panel: http://localhost:" + PORT + "/admin");
  console.log("Student panel: http://localhost:" + PORT + "/dashboard");
});
