/* Student accounts for the learner panel (/dashboard): login with mobile number
   + PIN, and a profile every student must complete before using the panel.

   Private data lives in a folder that is NOT part of the website:
     <dir>/secret.txt                   signs login cookies
     <dir>/students/<id>/student.json   phone, PIN hash, profile
     <dir>/students/<id>/photo.<ext>    profile photo
   Accounts are created by the admin (enrolled students only); the PIN is shown
   to the admin once and stored only as a hash. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { httpError } = require("./core");

const DAY = 864e5, SESSION_MS = 30 * DAY, PHOTO_LIMIT = 3 * 1024 * 1024;
const PHOTO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PURPOSES = ["Get my first job", "Switch my career", "Grow my business", "Freelancing", "Upskill in my current job", "Other"];
const REQUIRED = ["firstName", "lastName", "whatsapp", "currentAddress", "permanentAddress", "purpose", "linkedin", "instagram"];

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
function writeJSON(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, f);
}
const phone10 = v => { const d = String(v || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(d) ? d : ""; };
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString("hex");
const newPin = () => String(crypto.randomInt(100000, 1000000));
function body(req, limit) {
  return new Promise((ok, no) => {
    const parts = []; let n = 0;
    req.on("data", c => { n += c.length; if (n > limit) { no(httpError(413, "That file is too large")); req.destroy(); } else parts.push(c); });
    req.on("end", () => ok(Buffer.concat(parts))); req.on("error", no);
  });
}
const json = async req => { try { return JSON.parse((await body(req, 64 * 1024)).toString("utf8") || "{}"); } catch (e) { throw e.status ? e : httpError(400, "Bad request"); } };

/* Profile fields: returns { profile, errors } */
function cleanProfile(x, hasPhoto) {
  const t = (k, max) => String(x[k] == null ? "" : x[k]).replace(/\s+/g, " ").trim().slice(0, max);
  const p = {
    firstName: t("firstName", 40), lastName: t("lastName", 40), email: t("email", 80).toLowerCase(),
    whatsapp: phone10(x.whatsapp), currentAddress: t("currentAddress", 300), sameAddress: !!x.sameAddress,
    purpose: PURPOSES.includes(x.purpose) ? x.purpose : "", purposeNote: t("purposeNote", 200), linkedin: "", instagram: ""
  };
  p.permanentAddress = p.sameAddress ? p.currentAddress : t("permanentAddress", 300);
  const li = /linkedin\.com\/in\/([A-Za-z0-9\-_%.]{3,100})/i.exec(t("linkedin", 200));
  if (li) p.linkedin = "https://www.linkedin.com/in/" + li[1].replace(/\/+$/, "") + "/";
  const ig = /(?:instagram\.com\/|^@?)([A-Za-z0-9._]{2,30})\/?(?:\?.*)?$/i.exec(t("instagram", 200));
  if (ig && !/^(p|reel|explore|accounts)$/i.test(ig[1])) p.instagram = "https://www.instagram.com/" + ig[1] + "/";
  const e = {};
  if (!/^[A-Za-zऀ-ॿ .'-]{2,40}$/.test(p.firstName)) e.firstName = "Enter your first name";
  if (!/^[A-Za-zऀ-ॿ .'-]{1,40}$/.test(p.lastName)) e.lastName = "Enter your surname";
  if (!p.whatsapp) e.whatsapp = "Enter a valid 10-digit WhatsApp number";
  if (p.currentAddress.length < 10) e.currentAddress = "Enter your full current address";
  if (p.permanentAddress.length < 10) e.permanentAddress = "Enter your full permanent address";
  if (!p.purpose) e.purpose = "Choose your main purpose";
  if (p.purpose === "Other" && p.purposeNote.length < 3) e.purposeNote = "Tell us your purpose";
  if (!p.linkedin) e.linkedin = "Paste your LinkedIn profile link (linkedin.com/in/…)";
  if (!p.instagram) e.instagram = "Enter your Instagram profile link or @username";
  if (p.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(p.email)) e.email = "Enter a valid email or leave it blank";
  if (!hasPhoto) e.photo = "Upload a clear photo of your face";
  return { profile: p, errors: e };
}

module.exports = function createLearner(dir, opt) {
  opt = opt || {};
  const sdir = path.join(dir, "students");
  fs.mkdirSync(sdir, { recursive: true });
  const secretFile = path.join(dir, "secret.txt");
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString("hex"));
  const SECRET = fs.readFileSync(secretFile, "utf8").trim();
  const sign = s => crypto.createHmac("sha256", SECRET).update(s).digest("hex").slice(0, 40);
  const fileOf = id => path.join(sdir, id, "student.json");
  const read = id => /^[a-f0-9]{16}$/.test(id || "") ? readJSON(fileOf(id), null) : null;
  const write = s => writeJSON(fileOf(s.id), s);
  const all = () => { try { return fs.readdirSync(sdir).map(read).filter(Boolean); } catch (e) { return []; } };
  const byPhone = ph => all().find(s => s.phone === ph);
  const photoOf = s => s && s.photo ? path.join(sdir, s.id, s.photo) : null;
  const name = s => [s.profile && s.profile.firstName, s.profile && s.profile.lastName].filter(Boolean).join(" ") || s.name || "";
  const pub = s => ({ id: s.id, phone: s.phone, name: name(s), course: s.course || "", role: s.role || "student", profile: s.profile || {}, profileDone: !!s.profileDone, hasPhoto: !!s.photo, profileAt: s.profileAt || 0 });
  const fails = new Map();
  const X = require("./learn")({ dir, read, write, all, name, photoOf, site: opt.site, exams: opt.exams });

  function sendPhoto(res, s) {
    const f = photoOf(s);
    if (!f || !fs.existsSync(f)) throw httpError(404, "No photo");
    const ext = path.extname(f).slice(1);
    res.writeHead(200, { "Content-Type": ext === "jpg" ? "image/jpeg" : "image/" + ext, "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(f).pipe(res);
  }

  /* ---------- admin (behind the admin login) ---------- */
  const adminRoutes = Object.assign({}, X.adminRoutes, {
    "learner-list": async () => all().sort((a, b) => b.createdAt - a.createdAt).map(s => Object.assign(pub(s), { createdAt: s.createdAt, lastLogin: s.lastLogin || 0 })),
    "learner-add": async ({ post, readJSON: rj }) => {
      if (!post) throw httpError(405, "Use POST");
      const x = await rj(), ph = phone10(x.phone);
      if (!ph) throw httpError(400, "Enter a valid 10-digit mobile number");
      if (byPhone(ph)) throw httpError(400, "A student with this number already exists");
      const pin = newPin(), salt = crypto.randomBytes(8).toString("hex");
      const s = { id: crypto.randomBytes(8).toString("hex"), phone: ph, name: String(x.name || "").trim().slice(0, 80), course: String(x.course || "").trim().slice(0, 80), role: x.role === "teacher" ? "teacher" : "student", salt, pin: hashPin(pin, salt), createdAt: Date.now(), profile: {}, profileDone: false };
      write(s); return { student: pub(s), pin };
    },
    "learner-pin": async ({ post, readJSON: rj }) => {
      if (!post) throw httpError(405, "Use POST");
      const s = read((await rj()).id); if (!s) throw httpError(404, "Student not found");
      const pin = newPin(); s.salt = crypto.randomBytes(8).toString("hex"); s.pin = hashPin(pin, s.salt); s.session = (s.session || 0) + 1; write(s);
      return { pin };
    },
    "learner-update": async ({ post, readJSON: rj }) => {
      if (!post) throw httpError(405, "Use POST");
      const x = await rj(), s = read(x.id); if (!s) throw httpError(404, "Student not found");
      if (x.course !== undefined) s.course = String(x.course).trim().slice(0, 80);
      if (x.reopenProfile) s.profileDone = false;
      write(s); return pub(s);
    },
    "learner-delete": async ({ post, readJSON: rj }) => {
      if (!post) throw httpError(405, "Use POST");
      const s = read((await rj()).id); if (!s) throw httpError(404, "Student not found");
      fs.rmSync(path.join(sdir, s.id), { recursive: true, force: true }); return { ok: true };
    },
    "learner-photo": async ({ res, q }) => { sendPhoto(res, read(q("id"))); }
  });

  /* ---------- student side: /api/learner ---------- */
  async function studentHandler(req, res) {
    const send = (code, b, extra) => {
      if (res.headersSent) return;
      res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" }, extra || {}));
      res.end(JSON.stringify(b));
    };
    const secure = (req.headers["x-forwarded-proto"] || "").includes("https");
    const cookie = v => ({ "Set-Cookie": "eb_learner=" + v + "; HttpOnly; SameSite=Lax; Path=/" + (secure ? "; Secure" : "") + (v ? "; Max-Age=" + SESSION_MS / 1000 : "; Max-Age=0") });
    try {
      const u = new URL(req.url, "http://x"), route = u.searchParams.get("route") || "", post = req.method === "POST";
      if (post && req.headers["x-eb-learner"] !== "1") return send(403, { error: "Missing header" });
      if (route === "login" && post) {
        const x = await json(req), ph = phone10(x.phone), f = fails.get(ph) || { n: 0, until: 0 };
        if (f.until > Date.now()) throw httpError(429, "Too many wrong tries. Please wait 15 minutes or contact your mentor.");
        const s = ph && byPhone(ph);
        if (!s || !/^\d{6}$/.test(String(x.pin || "")) || !crypto.timingSafeEqual(Buffer.from(hashPin(x.pin, s.salt), "hex"), Buffer.from(s.pin, "hex"))) {
          f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 6e4; f.n = 0; } fails.set(ph, f);
          await new Promise(r => setTimeout(r, 700));
          throw httpError(401, "Wrong mobile number or PIN");
        }
        fails.delete(ph); s.lastLogin = Date.now(); write(s);
        const exp = Date.now() + SESSION_MS, raw = s.id + "." + exp + "." + (s.session || 0);
        return send(200, pub(s), cookie(raw + "." + sign(raw)));
      }
      if (route === "logout") return send(200, { ok: true }, cookie(""));
      if (X.publicRoutes[route]) { if ((route === "job-post") !== post) return send(405, { error: "Wrong method" }); return send(200, await X.publicRoutes[route]({ req, body: () => json(req) })); }
      const tok = (/(?:^|;\s*)eb_learner=([^;]+)/.exec(req.headers.cookie || "") || [])[1] || "";
      const [id, exp, ses, sig] = tok.split(".");
      const s = sig && sig.length === 40 && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(id + "." + exp + "." + ses))) && +exp > Date.now() ? read(id) : null;
      if (!s || String(s.session || 0) !== ses) return send(401, { error: "Please log in" });
      if (route === "me") return send(200, Object.assign(pub(s), { perf: s.profileDone && (s.role || "student") === "student" ? X.perf(s) : null }));
      const R = X.studentRoutes[route] || (s.role === "teacher" && X.teacherRoutes[route]);
      if (R) { if (!s.profileDone && s.role !== "teacher") return send(403, { error: "Complete your profile first" }); return send(200, await R({ s, req, body: () => json(req) })); }
      if (route === "photo" && !post) return sendPhoto(res, s);
      if (route === "photo" && post) {
        const ext = PHOTO_EXT[(req.headers["content-type"] || "").split(";")[0]];
        if (!ext) throw httpError(400, "Upload a JPG, PNG or WebP photo");
        const buf = await body(req, PHOTO_LIMIT);
        if (buf.length < 2000) throw httpError(400, "That photo looks empty");
        const old = photoOf(s); if (old) fs.rmSync(old, { force: true });
        s.photo = "photo-" + Date.now().toString(36) + "." + ext; fs.writeFileSync(path.join(sdir, s.id, s.photo), buf); write(s);
        return send(200, pub(s));
      }
      if (route === "profile" && post) {
        const { profile, errors } = cleanProfile(await json(req), !!s.photo);
        if (Object.keys(errors).length) return send(400, { error: "Please complete the highlighted fields", fields: errors });
        s.profile = profile; s.profileDone = true; s.profileAt = Date.now(); write(s);
        return send(200, pub(s));
      }
      send(404, { error: "Unknown request" });
    } catch (e) {
      if (!e.status) console.error(e);
      send(e.status || 500, { error: e.status ? e.message : "Something went wrong. Please try again." });
    }
  }
  return { adminRoutes, studentHandler, PURPOSES };
};
