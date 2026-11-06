/* Learning features of the learner panel, on top of the accounts in learner.js:
   practical assignments locked by module, admin/teacher review, module status,
   exam results, verified reading, the 4 performance bars, author applications,
   support tickets and job posts.

   Private files (in the learner folder, never served):
     tasks.json    the practical assignments (admin)       jobs.json     posted jobs
     tickets.json  support requests
   Public file written for the website: data/authors.json (+ images/authors/). */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { httpError } = require("./core");

const W = { assignments: 0.3, exams: 0.3, modules: 0.25, reading: 0.15 };
const DENY_PENALTY = 2, OPEN_LIMIT = 5, POINTS = 10;
const STATUSES = ["completed", "rework", "denied"];
const pct = (a, b) => b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0;
const rid = () => crypto.randomBytes(6).toString("hex");
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
function writeJSON(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + "." + rid() + ".tmp"; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, f); }
const url = v => { const u = str(v, 500); return /^https?:\/\/[^\s]+\.[^\s]+/i.test(u) ? u : ""; };

module.exports = function learn(ctx) {
  const { dir, read, write, all, name, photoOf, site, exams } = ctx;
  const F = { tasks: path.join(dir, "tasks.json"), jobs: path.join(dir, "jobs.json"), tickets: path.join(dir, "tickets.json") };
  const tasks = () => readJSON(F.tasks, []);

  /* ---- course + modules come from the public dashboard/data.json ---- */
  const courses = () => (site ? readJSON(path.join(site, "dashboard/data.json"), {}).courses : null) || [];
  const courseOf = s => { const c = courses(); return c.find(x => x.name === s.course) || c[0] || { name: s.course || "", modules: [] }; };
  const modsOf = s => (s.mods || []).filter(i => Number.isInteger(i));
  const current = (s, mods) => { const d = new Set(modsOf(s)); for (let i = 0; i < mods.length; i++) if (!d.has(i)) return i; return mods.length; };

  /* ---- reading targets: the 35 case studies + every blog post ---- */
  let readCache = null;
  function readables() {
    if (readCache && readCache.t > Date.now() - 6e5) return readCache.v;
    const v = new Set();
    try { const h = fs.readFileSync(path.join(site, "case-studies/index.html"), "utf8"); for (const m of h.matchAll(/<article class="csx-card" id="(cs-[a-z0-9-]+)"/g)) v.add("cs:" + m[1]); } catch (e) {}
    try { for (const d of fs.readdirSync(path.join(site, "blog"), { withFileTypes: true })) if (d.isDirectory() && !/^wp-/.test(d.name) && fs.existsSync(path.join(site, "blog", d.name, "index.html"))) v.add("blog:" + d.name); } catch (e) {}
    readCache = { t: Date.now(), v }; return v;
  }

  /* ---- assignment state for one student ---- */
  function taskList(s) {
    const c = courseOf(s), mods = c.modules || [], cur = current(s, mods), subs = s.subs || {};
    let open = 0;
    return tasks().filter(t => !t.course || t.course === c.name).sort((a, b) => a.module - b.module || a.order - b.order).map(t => {
      const sub = subs[t.id] || null; let state;
      if (sub && (sub.status === "completed" || sub.status === "submitted")) state = sub.status;
      else if (t.module > cur) state = "locked";
      else if (open >= OPEN_LIMIT) state = "queued";
      else { open++; state = sub ? sub.status : "open"; }
      return { id: t.id, title: t.title, brief: t.brief || "", module: t.module, moduleName: mods[t.module] || "Module " + (t.module + 1), points: +t.points || POINTS, state, sub };
    });
  }
  function examInfo(s) { return exams ? exams.summaryFor([name(s), s.phone, s.name]) : { published: 0, papers: [] }; }
  function perf(s) {
    const T = taskList(s), mods = courseOf(s).modules || [], ex = examInfo(s), R = readables();
    const total = T.reduce((n, t) => n + t.points, 0);
    const earned = T.reduce((n, t) => n + (t.state === "completed" ? t.points : 0) - (t.sub && t.sub.pen || 0), 0);
    const scored = ex.papers.filter(p => p.score != null), attend = pct(ex.papers.length, ex.published);
    const avg = scored.length ? Math.round(scored.reduce((n, p) => n + p.score, 0) / scored.length) : attend;
    const reads = Object.keys(s.reads || {}).filter(k => R.has(k)).length;
    const bars = {
      assignments: { pct: pct(earned, total), done: T.filter(t => t.state === "completed").length, total: T.length, penalty: T.reduce((n, t) => n + (t.sub && t.sub.pen || 0), 0) },
      exams: { pct: ex.published ? Math.round((attend + avg) / 2) : 0, attended: ex.papers.length, total: ex.published, avg: scored.length ? avg : null },
      modules: { pct: pct(modsOf(s).length, mods.length), done: modsOf(s).length, total: mods.length },
      reading: { pct: pct(reads, R.size), done: reads, total: R.size }
    };
    bars.overall = Math.round(Object.keys(W).reduce((n, k) => n + bars[k].pct * W[k], 0));
    return bars;
  }

  /* ---- review (admin and teachers) ---- */
  const isStudent = s => (s.role || "student") === "student";
  function reviewList() {
    const T = tasks(), title = id => (T.find(t => t.id === id) || {}).title || "Removed task";
    const students = all().filter(isStudent), queue = [];
    const list = students.map(s => {
      Object.entries(s.subs || {}).forEach(([tid, sub]) => { if (sub.status === "submitted") queue.push({ sid: s.id, student: name(s) || s.phone, task: tid, title: title(tid), url: sub.url, note: sub.note, at: sub.at, n: sub.n }); });
      const c = courseOf(s);
      return { id: s.id, name: name(s) || s.name || s.phone, phone: s.phone, course: c.name, modules: c.modules || [], mods: modsOf(s), perf: perf(s), author: s.author || null, hasPhoto: !!s.photo };
    });
    return { queue: queue.sort((a, b) => a.at - b.at), students: list };
  }
  function review(x, by) {
    const s = read(x.sid); if (!s) throw httpError(404, "Student not found");
    const sub = (s.subs || {})[x.task]; if (!sub) throw httpError(404, "Submission not found");
    if (!STATUSES.includes(x.status)) throw httpError(400, "Choose Completed, Rework or Denied");
    sub.status = x.status; sub.fb = str(x.fb, 600); sub.by = by; sub.rvAt = Date.now();
    sub.pen = x.status === "denied" ? DENY_PENALTY : x.status === "completed" ? 0 : sub.pen || 0;
    (sub.log = sub.log || []).push({ s: x.status, by, at: sub.rvAt }); write(s); return { ok: true };
  }
  function setModule(x) {
    const s = read(x.sid); if (!s) throw httpError(404, "Student not found");
    const n = (courseOf(s).modules || []).length, i = parseInt(x.idx, 10);
    if (!(i >= 0 && i < n)) throw httpError(400, "Unknown module");
    const set = new Set(modsOf(s)); x.done ? set.add(i) : set.delete(i); s.mods = [...set].sort((a, b) => a - b); write(s); return { ok: true, mods: s.mods };
  }

  /* ---- authors: public profile on the website's Authors page ---- */
  const AUTH_FILE = site && path.join(site, "data/authors.json");
  function publishAuthor(s) {
    if (!AUTH_FILE) return;
    const list = readJSON(AUTH_FILE, []).filter(a => a.id !== s.id);
    if (s.author) {
      let photo = "";
      const src = photoOf(s);
      if (src && fs.existsSync(src)) { const rel = "images/authors/student-" + s.id + path.extname(src); fs.mkdirSync(path.join(site, "images/authors"), { recursive: true }); fs.copyFileSync(src, path.join(site, rel)); photo = "/" + rel; }
      list.push({ id: s.id, name: name(s), title: s.author.title, bio: s.author.bio, topics: s.author.topics, photo, linkedin: (s.profile || {}).linkedin || "", instagram: (s.profile || {}).instagram || "", status: s.author.status, at: s.author.at });
    }
    writeJSON(AUTH_FILE, list.sort((a, b) => a.at - b.at));
  }
  function authorDecision(x, by) {
    const s = read(x.sid); if (!s || !s.author) throw httpError(404, "Application not found");
    s.author.status = x.approve ? "approved" : "applied"; s.author.by = by; s.author.decidedAt = Date.now(); write(s); publishAuthor(s); return { ok: true };
  }

  /* ---- jobs (posted from the Hire From Us page) ---- */
  const posts = new Map();
  const jobPublic = j => ({ id: j.id, company: j.company, role: j.role, location: j.location, type: j.type, salary: j.salary, desc: j.desc, apply: j.apply, posted: j.at });

  const studentRoutes = {
    learn: ({ s }) => {
      const c = courseOf(s), mods = c.modules || [], done = new Set(modsOf(s));
      return { tasks: taskList(s), modules: mods.map((m, i) => ({ name: m, done: done.has(i) })), current: current(s, mods), perf: perf(s), exams: examInfo(s).papers, reads: s.reads || {}, author: s.author || null };
    },
    submit: async ({ s, body }) => {
      const x = await body(), t = taskList(s).find(t => t.id === x.task);
      if (!t) throw httpError(404, "Assignment not found");
      if (["locked", "queued", "completed", "submitted"].includes(t.state)) throw httpError(400, t.state === "locked" ? "This assignment opens when its module starts" : t.state === "queued" ? "Finish your open assignments first" : "Already " + t.state);
      const link = url(x.url); if (!link) throw httpError(400, "Paste the link to your work (Google Drive, Docs, website…)");
      const old = (s.subs || {})[t.id] || {};
      (s.subs = s.subs || {})[t.id] = { url: link, note: str(x.note, 600), at: Date.now(), status: "submitted", n: (old.n || 0) + 1, pen: old.pen || 0, log: old.log || [] };
      write(s); return { ok: true };
    },
    read: async ({ s, body }) => {
      const x = await body(), k = str(x.key, 120);
      if (!readables().has(k)) throw httpError(400, "Unknown article");
      if (!(+x.sec >= 15)) throw httpError(400, "Please read the article first");
      (s.reads = s.reads || {})[k] = Date.now(); write(s); return { ok: true, reads: Object.keys(s.reads).length };
    },
    "author-apply": async ({ s, body }) => {
      if (!s.profileDone) throw httpError(400, "Complete your profile first");
      const x = await body(), a = { title: str(x.title, 80), bio: str(x.bio, 500), topics: str(x.topics, 160), status: s.author ? s.author.status : "applied", at: s.author ? s.author.at : Date.now() };
      if (a.title.length < 3) throw httpError(400, "Add a short title, e.g. SEO learner at eBuddha");
      if (a.bio.length < 40) throw httpError(400, "Write a short bio (at least 40 characters)");
      s.author = a; write(s); publishAuthor(s); return { ok: true, author: a };
    },
    ticket: async ({ s, body }) => {
      const x = await body(), msg = str(x.message, 1500);
      if (msg.length < 10) throw httpError(400, "Describe your question in a few words");
      const list = readJSON(F.tickets, []);
      if (list.filter(t => t.sid === s.id && t.status === "open").length >= 5) throw httpError(429, "You already have 5 open requests. We'll reply soon.");
      list.unshift({ id: rid(), sid: s.id, name: name(s), phone: s.phone, topic: str(x.topic, 60) || "Other", message: msg, at: Date.now(), status: "open" });
      writeJSON(F.tickets, list.slice(0, 2000)); return { ok: true };
    },
    tickets: ({ s }) => readJSON(F.tickets, []).filter(t => t.sid === s.id).slice(0, 20).map(t => ({ topic: t.topic, message: t.message, at: t.at, status: t.status, reply: t.reply || "" }))
  };
  const teacherRoutes = {
    "rv-list": () => reviewList(),
    "rv-review": async ({ s, body }) => review(await body(), name(s) || "Teacher"),
    "rv-module": async ({ body }) => setModule(await body()),
    "rv-author": async ({ s, body }) => authorDecision(await body(), name(s) || "Teacher")
  };
  const publicRoutes = {
    jobs: () => readJSON(F.jobs, []).filter(j => j.status === "live").slice(0, 60).map(jobPublic),
    "job-post": async ({ req, body }) => {
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0], p = posts.get(ip) || [];
      const recent = p.filter(t => t > Date.now() - 36e5); if (recent.length >= 5) throw httpError(429, "Too many posts. Please try again later.");
      const x = await body(); if (x.website) return { ok: true };
      const j = { id: rid(), company: str(x.company, 80), role: str(x.role, 80), location: str(x.location, 80), type: ["Full-time", "Part-time", "Internship", "Freelance", "Contract"].includes(x.type) ? x.type : "Full-time",
        salary: str(x.salary, 60), desc: str(x.desc, 1500), apply: url(x.apply) || (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(str(x.apply, 120)) ? "mailto:" + str(x.apply, 120) : ""),
        contact: str(x.contact, 80), phone: str(x.phone, 20), email: str(x.email, 120), at: Date.now(), status: "live" };
      const miss = ["company", "role", "location", "desc", "contact"].filter(k => j[k].length < 2);
      if (miss.length || j.desc.length < 30) throw httpError(400, "Please fill company, role, location, your name and a short job description (30+ characters)");
      if (!j.apply) throw httpError(400, "Add an apply link or email");
      if (!/^\+?\d[\d\s-]{8,}$/.test(j.phone)) throw httpError(400, "Add a contact phone number");
      recent.push(Date.now()); posts.set(ip, recent);
      const list = readJSON(F.jobs, []); list.unshift(j); writeJSON(F.jobs, list.slice(0, 500)); return { ok: true };
    }
  };
  const adminRoutes = {
    "learner-tasks": ({ post, readJSON: rj }) => post ? rj().then(x => {
      const list = (Array.isArray(x.tasks) ? x.tasks : []).slice(0, 300).map((t, i) => ({ id: /^[a-f0-9]{12}$/.test(t.id || "") ? t.id : rid(), title: str(t.title, 120), brief: str(t.brief, 1200), module: Math.max(0, parseInt(t.module, 10) || 0), course: str(t.course, 80), points: Math.max(1, Math.min(100, parseInt(t.points, 10) || POINTS)), order: i }));
      if (list.some(t => t.title.length < 3)) throw httpError(400, "Every assignment needs a title");
      writeJSON(F.tasks, list); return { ok: true, count: list.length };
    }) : { tasks: tasks(), courses: courses().map(c => ({ name: c.name, modules: c.modules || [] })) },
    "learner-rv-list": () => reviewList(),
    "learner-rv-review": async ({ readJSON: rj }) => review(await rj(), "Admin"),
    "learner-rv-module": async ({ readJSON: rj }) => setModule(await rj()),
    "learner-rv-author": async ({ readJSON: rj }) => authorDecision(await rj(), "Admin"),
    "learner-jobs": async ({ post, readJSON: rj }) => {
      let list = readJSON(F.jobs, []);
      if (post) { const x = await rj(); list = x.remove ? list.filter(j => j.id !== x.id) : list.map(j => j.id === x.id ? Object.assign(j, { status: x.status === "hidden" ? "hidden" : "live" }) : j); writeJSON(F.jobs, list); }
      return list;
    },
    "learner-tickets": async ({ post, readJSON: rj }) => {
      let list = readJSON(F.tickets, []);
      if (post) { const x = await rj(); list = list.map(t => t.id === x.id ? Object.assign(t, { status: x.status === "open" ? "open" : "closed", reply: str(x.reply, 600) || t.reply || "" }) : t); writeJSON(F.tickets, list); }
      return list;
    }
  };
  return { perf, studentRoutes, teacherRoutes, publicRoutes, adminRoutes };
};
