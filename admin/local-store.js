/* Store for the admin panel when it runs on this computer (see server.js): reads
   and writes the site's files here instead of committing to GitHub. The admin
   password, backups, activity log, exam papers and student work all live in
   .local-data, which git ignores and the local server refuses to serve. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { httpError } = require("../api/_lib/core");

const ROOT = path.resolve(__dirname, "..");
const LOCAL = path.join(ROOT, ".local-data");
const DATA = path.join(LOCAL, "admin");
const exam = require("../api/_lib/exam")(path.join(LOCAL, "exams"));
const SKIP = new Set([".git", ".local-data", "node_modules"]);
fs.mkdirSync(DATA, { recursive: true });

const abs = p => {
  const f = path.join(ROOT, p);
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) throw httpError(400, "That path is not allowed");
  return f;
};
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const logFile = path.join(DATA, "log.json");
const passFile = path.join(DATA, "password.json");
const secretFile = path.join(DATA, "secret.txt");

function secret() {
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString("hex"));
  return fs.readFileSync(secretFile, "utf8").trim();
}
function walk(dir, rel, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), p, out);
    else if (e.isFile()) { const s = fs.statSync(path.join(dir, e.name)); out.push({ path: p, size: s.size, mtime: s.mtimeMs }); }
  }
  return out;
}
const save = (kind, id, p, buf) => {
  const f = path.join(DATA, kind, id, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
};
const load = (kind, id, p) => {
  try { return fs.readFileSync(path.join(DATA, kind, id, p)); } catch { return null; }
};

module.exports = localStore;
module.exports.exam = exam;

function localStore() {
  const pw = readJson(passFile, null);
  const hash = (p, salt) => crypto.scryptSync(p, salt, 32);
  const log = () => readJson(logFile, []);

  return {
    name: "local",
    label: "this computer (" + ROOT + ")",
    auth: {
      configured: !!pw,
      missing: [],
      secret: "eb-local|" + secret(),
      check: async p => !!pw && crypto.timingSafeEqual(hash(p, Buffer.from(pw.salt, "hex")), Buffer.from(pw.hash, "hex")),
      setPassword: async p => {
        const salt = crypto.randomBytes(16);
        fs.writeFileSync(passFile, JSON.stringify({ salt: salt.toString("hex"), hash: hash(p, salt).toString("hex") }));
      }
    },

    async read(p) { const b = await this.readBuffer(p); return b == null ? null : b.toString("utf8"); },
    async readBuffer(p) { try { return fs.readFileSync(abs(p)); } catch { return null; } },
    async list() { return walk(ROOT, "", []); },

    async commit(changes, message) {
      const id = crypto.randomBytes(20).toString("hex");
      const touched = [];
      for (const c of changes) {
        const f = abs(c.path), before = fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null;
        if (before) save("before", id, c.path, before);
        if (c.content === null) {
          if (fs.existsSync(f)) fs.rmSync(f);
        } else {
          const buf = Buffer.isBuffer(c.content) ? c.content : Buffer.from(String(c.content), "utf8");
          fs.mkdirSync(path.dirname(f), { recursive: true });
          fs.writeFileSync(f, buf);
          save("after", id, c.path, buf);
        }
        touched.push({ path: c.path, deleted: c.content === null });
      }
      const entries = log();
      entries.unshift({ id, t: Date.now(), message, files: touched });
      fs.writeFileSync(logFile, JSON.stringify(entries.slice(0, 500)));
      return { id };
    },

    async history(p) {
      return log().filter(e => e.files.some(f => f.path === p && !f.deleted))
        .map(e => ({ id: e.id, t: e.t, message: e.message.split("\n")[0], author: "Local admin" }));
    },
    async readAt(p, id) {
      if (!/^[a-f0-9]{40}$/.test(id || "")) return null;
      const b = load("after", id, p);
      return b ? b.toString("utf8") : null;
    },
    async log() {
      return log().slice(0, 60).map(e => {
        const msg = e.message.split("\n")[0], m = /^Admin: (\w+) (.+)$/.exec(msg);
        return { t: e.t, id: e.id, message: msg, action: m ? m[1] : "commit", path: m ? m[2] : "", author: "Local admin" };
      });
    },
    async trash() {
      return log().filter(e => /^Admin: delete /.test(e.message)).map(e => {
        const p = e.message.split("\n")[0].replace(/^Admin: delete /, "");
        return { id: e.id + "|" + p, path: p, t: e.t };
      });
    },
    async untrash(id) {
      const [eid, p] = String(id || "").split("|");
      if (!/^[a-f0-9]{40}$/.test(eid) || !p) throw httpError(400, "Unknown trash item");
      const dir = path.join(DATA, "before", eid);
      const restore = [];
      const walkBack = (d, rel) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const r = rel ? rel + "/" + e.name : e.name;
          if (e.isDirectory()) walkBack(path.join(d, e.name), r);
          else if (r === p || r.startsWith(p + "/")) restore.push({ path: r, content: fs.readFileSync(path.join(d, e.name)) });
        }
      };
      walkBack(dir, "");
      if (!restore.length) throw httpError(404, "Nothing to restore");
      return this.commit(restore, "Admin: restore " + p);
    },

    async overview() {
      const last = log()[0];
      return last ? { last: { id: last.id, t: last.t, message: last.message.split("\n")[0] }, deploy: { state: "live" } } : null;
    },

    routes: exam.adminRoutes
  };
}
