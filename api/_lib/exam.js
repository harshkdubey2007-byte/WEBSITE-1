/* Examinations: 8 locked papers, one password per student, 3 hours per attempt.

   Everything lives in a private folder that is NOT part of the website, so a
   paper or a student's work can never be opened by guessing its address:
     <dir>/<slot>/paper.json   title, sections, published
     <dir>/<slot>/paper.pdf    the question paper
     <dir>/<slot>/codes.json   passwords the admin created
     <dir>/<slot>/attempts/<id>/attempt.json and files/

   The clock is the server's. A student's 3 hours start the first time their
   password is used; using it again resumes the same attempt with the same end
   time. Once time is up the paper and uploads are refused, and whatever was
   uploaded is what the admin sees. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Transform, pipeline } = require("stream");
const { httpError } = require("./core");

const SLOTS = 8;
const DURATION_MS = 3 * 60 * 60 * 1000;
const MB = 1024 * 1024;
const KINDS = {
  image: { ext: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"], limit: 25 * MB },
  video: { ext: ["mp4", "mov", "webm", "m4v", "mkv", "3gp"], limit: 500 * MB },
  pdf: { ext: ["pdf"], limit: 25 * MB }
};
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4", mkv: "video/x-matroska", "3gp": "video/3gpp", pdf: "application/pdf" };
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PDF_LIMIT = 50 * MB;

const randomHex = n => crypto.randomBytes(n).toString("hex");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kindOf = ext => Object.keys(KINDS).find(k => KINDS[k].ext.includes(ext));
const extOf = name => (/\.([a-z0-9]{1,5})$/i.exec(name || "") || [, ""])[1].toLowerCase();
const showCode = c => c.slice(0, 4) + "-" + c.slice(4);

function readJSONFile(f, fallback) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return fallback; }
}
function writeJSONFile(f, value) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + "." + randomHex(4) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  fs.renameSync(tmp, f);
}

/* Save a request body to dest without holding it in memory. */
function receive(req, dest, limit, tooBig) {
  if ((+req.headers["content-length"] || 0) > limit) { req.resume(); return Promise.reject(httpError(413, tooBig)); }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  let size = 0;
  const counter = new Transform({ transform(chunk, _, cb) { size += chunk.length; cb(size > limit ? httpError(413, tooBig) : null, chunk); } });
  return new Promise((resolve, reject) => {
    pipeline(req, counter, fs.createWriteStream(tmp), err => {
      if (err) { fs.rmSync(tmp, { force: true }); return reject(err.status ? err : httpError(400, "The upload did not finish. Please try again.")); }
      if (!size) { fs.rmSync(tmp, { force: true }); return reject(httpError(400, "That file is empty")); }
      fs.renameSync(tmp, dest);
      resolve(size);
    });
  });
}

/* Send a file, with Range support so videos can be scrubbed. */
function streamFile(req, res, file, opts) {
  return new Promise(resolve => {
    let st;
    try { st = fs.statSync(file); } catch (e) { res.statusCode = 404; res.end("Not found"); return resolve(); }
    const headers = {
      "Content-Type": opts.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes"
    };
    if (opts.name) headers["Content-Disposition"] = (opts.inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(opts.name);
    let start = 0, end = st.size - 1, status = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); } else start = Math.max(0, st.size - +m[2]);
      if (start > end) { res.writeHead(416, { "Content-Range": "bytes */" + st.size }); res.end(); return resolve(); }
      status = 206; headers["Content-Range"] = "bytes " + start + "-" + end + "/" + st.size;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === "HEAD") { res.end(); return resolve(); }
    const s = fs.createReadStream(file, { start, end });
    s.on("error", () => res.destroy());
    res.on("close", () => { s.destroy(); resolve(); });
    s.pipe(res);
  });
}

module.exports = function createExam(dir) {
  const slotOf = v => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > SLOTS) throw httpError(400, "Choose a paper from 1 to " + SLOTS);
    return n;
  };
  const slotDir = s => path.join(dir, String(s));
  const paperFile = s => path.join(slotDir(s), "paper.json");
  const pdfFile = s => path.join(slotDir(s), "paper.pdf");
  const codesFile = s => path.join(slotDir(s), "codes.json");
  const attemptDir = (s, id) => path.join(slotDir(s), "attempts", id);
  const attemptFile = (s, id) => path.join(attemptDir(s, id), "attempt.json");
  const readPaper = s => readJSONFile(paperFile(s), null);
  const readCodes = s => readJSONFile(codesFile(s), []);
  const readAttempt = (s, id) => /^[a-f0-9]{32}$/.test(id || "") ? readJSONFile(attemptFile(s, id), null) : null;
  const saveAttempt = (s, a) => writeJSONFile(attemptFile(s, a.id), a);
  const statusOf = a => a.submittedAt ? "submitted" : Date.now() >= a.deadline ? "timed_out" : "active";

  function listAttempts(s) {
    let ids = [];
    try { ids = fs.readdirSync(path.join(slotDir(s), "attempts")); } catch (e) { return []; }
    return ids.map(id => readAttempt(s, id)).filter(Boolean);
  }

  /* Multiple-choice questions. Blank options are dropped, keeping the marked
     answer pointing at the same option. */
  function cleanQuestions(list) {
    if (!Array.isArray(list)) return [];
    if (list.length > 500) throw httpError(400, "A paper can have at most 500 questions");
    return list.map((x, i) => {
      const label = "Question " + (i + 1) + ": ";
      const q = String(x.q || "").trim().slice(0, 2000);
      if (!q) throw httpError(400, label + "write the question");
      const raw = (Array.isArray(x.options) ? x.options : []).slice(0, 4).map(o => String(o == null ? "" : o).trim().slice(0, 500));
      const options = raw.filter(Boolean);
      if (options.length < 2) throw httpError(400, label + "add at least 2 options");
      if (!raw[x.answer]) throw httpError(400, label + "mark the correct option");
      return {
        id: /^[a-z0-9]{1,16}$/.test(x.id || "") ? x.id : randomHex(5),
        q, options, answer: raw.slice(0, x.answer).filter(Boolean).length,
        explain: String(x.explain || "").trim().slice(0, 1000)
      };
    });
  }

  /* Score an attempt against the copy of the questions it started with, so
     editing a paper later never changes a student's result. */
  function grade(a) {
    const qs = a.questions || [], answers = a.answers || {};
    let correct = 0, wrong = 0;
    const grid = qs.map(q => {
      const c = answers[q.id];
      if (c === undefined || c === null) return "none";
      if (c === q.answer) { correct++; return "correct"; }
      wrong++; return "wrong";
    });
    return { total: qs.length, correct, wrong, unanswered: qs.length - correct - wrong, grid };
  }
  const finishedAt = a => a.submittedAt || a.deadline;
  const timeTaken = a => Math.min(finishedAt(a), a.deadline) - a.startedAt;

  function cleanSections(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 20).map(x => {
      const name = String(x.name || "").trim().slice(0, 80);
      if (!name) throw httpError(400, "Every upload section needs a name");
      const accept = (Array.isArray(x.accept) ? x.accept : []).filter(k => KINDS[k]);
      if (!accept.length) throw httpError(400, "Choose what students can upload in \"" + name + "\"");
      return {
        id: /^[a-z0-9]{1,16}$/.test(x.id || "") ? x.id : randomHex(4),
        name, accept, required: !!x.required,
        instructions: String(x.instructions || "").trim().slice(0, 600),
        maxFiles: Math.min(50, Math.max(1, parseInt(x.maxFiles, 10) || 20))
      };
    });
  }

  /* ================= admin (mounted behind the admin login) ================= */
  const adminRoutes = {
    "exam-list": async () => {
      const out = [];
      for (let s = 1; s <= SLOTS; s++) {
        const p = readPaper(s);
        const attempts = listAttempts(s), codes = readCodes(s);
        out.push({
          slot: s, exists: !!p, title: p ? p.title : "", published: !!(p && p.published), pdf: p ? p.pdf : null,
          questions: p && p.questions ? p.questions.length : 0,
          passwords: codes.length, unused: codes.filter(c => !c.attemptId).length,
          inProgress: attempts.filter(a => statusOf(a) === "active").length,
          finished: attempts.filter(a => statusOf(a) !== "active").length
        });
      }
      return { slots: out, hours: DURATION_MS / 3600000 };
    },
    "exam-paper": async ({ q }) => {
      const s = slotOf(q("slot"));
      return { slot: s, paper: readPaper(s) };
    },
    "exam-save": async ({ post, readJSON }) => {
      if (!post) throw httpError(405, "Use POST");
      const b = await readJSON(), s = slotOf(b.slot), old = readPaper(s);
      const title = String(b.title || "").trim().slice(0, 120);
      if (!title) throw httpError(400, "Give the paper a title");
      /* A paper marked open can be saved before it has content, because a PDF can
         only be uploaded to a saved paper. Students see it once it has some. */
      const pdf = old ? old.pdf : null, questions = cleanQuestions(b.questions);
      const paper = {
        slot: s, title, description: String(b.description || "").trim().slice(0, 1000),
        published: !!b.published, sections: cleanSections(b.sections), pdf, questions,
        showResult: b.showResult !== false, showSolutions: !!b.showSolutions,
        createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now()
      };
      writeJSONFile(paperFile(s), paper);
      return { ok: true, paper };
    },
    "exam-pdf-upload": async ({ req, q, post }) => {
      if (!post) throw httpError(405, "Use POST");
      const s = slotOf(q("slot")), p = readPaper(s);
      if (!p) throw httpError(400, "Save the paper first");
      const name = decodeURIComponent(req.headers["x-filename"] || "paper.pdf").slice(0, 160);
      if (extOf(name) !== "pdf") { req.resume(); throw httpError(400, "The paper must be a PDF file"); }
      const tmp = pdfFile(s) + ".new";
      const size = await receive(req, tmp, PDF_LIMIT, "The PDF must be 50 MB or smaller");
      const fd = fs.openSync(tmp, "r"), head = Buffer.alloc(5);
      fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
      if (head.toString("latin1") !== "%PDF-") { fs.rmSync(tmp, { force: true }); throw httpError(400, "That file is not a real PDF"); }
      fs.renameSync(tmp, pdfFile(s));
      p.pdf = { name, size, at: Date.now() };
      writeJSONFile(paperFile(s), p);
      return { ok: true, paper: p };
    },
    "exam-pdf": async ({ req, res, q }) => {
      const s = slotOf(q("slot")), p = readPaper(s);
      if (!p || !p.pdf) throw httpError(404, "No PDF uploaded yet");
      await streamFile(req, res, pdfFile(s), { type: "application/pdf", name: p.pdf.name, inline: true });
    },
    "exam-delete": async ({ post, readJSON }) => {
      if (!post) throw httpError(405, "Use POST");
      const s = slotOf((await readJSON()).slot);
      fs.rmSync(slotDir(s), { recursive: true, force: true });
      return { ok: true };
    },
    "exam-codes": async ({ q }) => {
      const s = slotOf(q("slot"));
      return readCodes(s).map(c => {
        const a = c.attemptId ? readAttempt(s, c.attemptId) : null;
        return { code: showCode(c.code), student: c.student, createdAt: c.createdAt, status: a ? statusOf(a) : "unused", deadline: a ? a.deadline : null };
      });
    },
    "exam-code-new": async ({ post, readJSON }) => {
      if (!post) throw httpError(405, "Use POST");
      const b = await readJSON(), s = slotOf(b.slot);
      if (!readPaper(s)) throw httpError(400, "Save the paper first");
      const names = (Array.isArray(b.students) ? b.students : []).map(n => String(n).trim().slice(0, 80)).filter(Boolean);
      if (!names.length) throw httpError(400, "Enter a student's name");
      if (names.length > 200) throw httpError(400, "Add up to 200 students at a time");
      const codes = readCodes(s), taken = new Set(codes.map(c => c.code));
      names.forEach(student => {
        let code;
        do { code = Array.from(crypto.randomBytes(8), x => CODE_CHARS[x % CODE_CHARS.length]).join(""); } while (taken.has(code));
        taken.add(code);
        codes.push({ code, student, createdAt: Date.now(), attemptId: null });
      });
      writeJSONFile(codesFile(s), codes);
      return { ok: true };
    },
    "exam-code-del": async ({ post, readJSON }) => {
      if (!post) throw httpError(405, "Use POST");
      const b = await readJSON(), s = slotOf(b.slot), code = String(b.code || "").replace(/-/g, "");
      const codes = readCodes(s), hit = codes.find(c => c.code === code);
      if (!hit) throw httpError(404, "That password was not found");
      if (hit.attemptId) throw httpError(400, "This student has already started, so the password can't be removed");
      writeJSONFile(codesFile(s), codes.filter(c => c !== hit));
      return { ok: true };
    },
    "exam-results": async ({ q }) => {
      const s = slotOf(q("slot")), p = readPaper(s);
      const attempts = listAttempts(s).sort((a, b) => b.startedAt - a.startedAt).map(a => ({
        id: a.id, student: a.student, startedAt: a.startedAt, deadline: a.deadline, submittedAt: a.submittedAt, status: statusOf(a), files: a.files,
        score: grade(a), timeMs: statusOf(a) === "active" ? null : timeTaken(a), questions: a.questions || [], answers: a.answers || {}
      }));
      return { slot: s, title: p ? p.title : "", sections: p ? p.sections : [], hasPdf: !!(p && p.pdf), attempts };
    },
    "exam-file": async ({ req, res, q }) => {
      const s = slotOf(q("slot")), a = readAttempt(s, q("attempt"));
      const f = a && a.files.find(x => x.id === q("file"));
      if (!f) throw httpError(404, "File not found");
      await streamFile(req, res, path.join(attemptDir(s, a.id), "files", f.id + "." + f.ext), { type: MIME[f.ext], name: f.name, inline: q("download") !== "1" });
    }
  };

  /* ================= student ================= */
  const failures = new Map();
  const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  function tooManyTries(ip) {
    const f = failures.get(ip);
    if (f && Date.now() - f.t > 10 * 60 * 1000) { failures.delete(ip); return false; }
    return !!f && f.n >= 10;
  }
  function readBodyJSON(req) {
    return new Promise((resolve, reject) => {
      let n = 0; const parts = [];
      req.on("data", c => { n += c.length; if (n > 64 * 1024) { reject(httpError(413, "Too much data")); req.destroy(); } else parts.push(c); });
      req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(parts).toString("utf8") || "{}")); } catch (e) { reject(httpError(400, "Bad request")); } });
      req.on("error", reject);
    });
  }
  /* The token is only ever sent in a request header, so a paper has no address
     that could be opened, shared or saved from the browser's address bar. */
  function authed(req) {
    const m = /^([1-8])\.([a-f0-9]{32})\.([a-f0-9]{48})$/.exec(req.headers["x-exam-token"] || "");
    const a = m && readAttempt(+m[1], m[2]);
    if (!a || !crypto.timingSafeEqual(Buffer.from(a.secret), Buffer.from(m[3]))) throw httpError(401, "Please enter your password again");
    return { s: +m[1], a };
  }
  function stateOf(s, a) {
    const p = readPaper(s) || {};
    return {
      slot: s, title: p.title || "Paper " + s, description: p.description || "", student: a.student,
      status: statusOf(a), remainingMs: Math.max(0, a.deadline - Date.now()),
      startedAt: a.startedAt, deadline: a.deadline, submittedAt: a.submittedAt, hasPdf: !!p.pdf,
      /* The correct answers and explanations are never part of this. */
      questions: (a.questions || []).map(q => ({ id: q.id, q: q.q, options: q.options })), answers: a.answers || {},
      sections: (p.sections || []).map(x => Object.assign({}, x, { limits: x.accept.reduce((o, k) => { o[k] = KINDS[k].limit; return o; }, {}), extensions: x.accept.reduce((l, k) => l.concat(KINDS[k].ext), []) })),
      files: a.files.map(f => ({ id: f.id, section: f.section, name: f.name, kind: f.kind, size: f.size, at: f.at }))
    };
  }
  const closedMessage = a => statusOf(a) === "submitted" ? "You have already submitted this paper." : "Your 3 hours for this paper have ended.";

  const studentRoutes = {
    papers: async () => {
      const out = [];
      for (let s = 1; s <= SLOTS; s++) {
        const p = readPaper(s);
        const count = p && p.questions ? p.questions.length : 0;
        out.push({ slot: s, title: p ? p.title : "", description: p ? p.description : "", questions: count, available: !!(p && p.published && (p.pdf || count)) });
      }
      return { papers: out, hours: DURATION_MS / 3600000 };
    },
    enter: async ({ req }) => {
      const ip = ipOf(req);
      if (tooManyTries(ip)) throw httpError(429, "Too many wrong passwords. Please wait 10 minutes and try again.");
      const b = await readBodyJSON(req), s = slotOf(b.slot), code = String(b.password || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const p = readPaper(s), codes = readCodes(s), hit = codes.find(c => c.code === code);
      if (!hit) {
        const f = failures.get(ip) || { n: 0, t: Date.now() };
        f.n++; failures.set(ip, f);
        await sleep(500);
        throw httpError(401, "That password is not correct for this paper");
      }
      failures.delete(ip);
      let a = hit.attemptId && readAttempt(s, hit.attemptId);
      /* A finished attempt can still be re-entered: the page then shows the
         result screen, and the paper itself stays refused. */
      if (!a) {
        if (!p || !p.published || !(p.pdf || (p.questions && p.questions.length))) throw httpError(403, "This paper is not open yet");
        const now = Date.now();
        a = { id: randomHex(16), secret: randomHex(24), slot: s, student: hit.student, code, startedAt: now, deadline: now + DURATION_MS, submittedAt: null, files: [], questions: p.questions || [], answers: {} };
        saveAttempt(s, a);
        hit.attemptId = a.id;
        writeJSONFile(codesFile(s), codes);
      }
      return Object.assign({ token: s + "." + a.id + "." + a.secret }, stateOf(s, a));
    },
    state: async ({ req }) => { const { s, a } = authed(req); return stateOf(s, a); },
    pdf: async ({ req, res }) => {
      const { s, a } = authed(req);
      if (statusOf(a) !== "active") throw httpError(403, closedMessage(a));
      await streamFile(req, res, pdfFile(s), {});
    },
    upload: async ({ req, q }) => {
      const { s, a } = authed(req);
      if (statusOf(a) !== "active") { req.resume(); throw httpError(403, closedMessage(a)); }
      const sec = ((readPaper(s) || {}).sections || []).find(x => x.id === q("section"));
      if (!sec) { req.resume(); throw httpError(400, "That section no longer exists"); }
      const name = decodeURIComponent(req.headers["x-filename"] || "file").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160);
      const ext = extOf(name), kind = kindOf(ext);
      if (!kind || !sec.accept.includes(kind)) { req.resume(); throw httpError(400, "\"" + sec.name + "\" does not accept this type of file"); }
      if (a.files.filter(f => f.section === sec.id).length >= sec.maxFiles) { req.resume(); throw httpError(400, "\"" + sec.name + "\" takes at most " + sec.maxFiles + " files"); }
      const id = randomHex(8), dest = path.join(attemptDir(s, a.id), "files", id + "." + ext);
      const size = await receive(req, dest, KINDS[kind].limit, "This file is too large. The limit is " + Math.round(KINDS[kind].limit / MB) + " MB.");
      /* Re-read: other files may have finished while this one was uploading.
         An upload that began before the deadline is kept, so a slow connection
         in the last minute doesn't lose the student's work. */
      const fresh = readAttempt(s, a.id);
      if (fresh.submittedAt) { fs.rmSync(dest, { force: true }); throw httpError(403, closedMessage(fresh)); }
      const file = { id, section: sec.id, sectionName: sec.name, name, ext, kind, size, at: Date.now() };
      fresh.files.push(file);
      saveAttempt(s, fresh);
      return { ok: true, file: { id, section: sec.id, name, kind, size, at: file.at } };
    },
    remove: async ({ req }) => {
      const { s, a } = authed(req);
      if (statusOf(a) !== "active") throw httpError(403, closedMessage(a));
      const id = String((await readBodyJSON(req)).id || ""), f = a.files.find(x => x.id === id);
      if (!f) throw httpError(404, "File not found");
      fs.rmSync(path.join(attemptDir(s, a.id), "files", f.id + "." + f.ext), { force: true });
      a.files = a.files.filter(x => x !== f);
      saveAttempt(s, a);
      return { ok: true };
    },
    /* Every choice is saved as it's made, so when time runs out the answers
       given so far are what gets marked. */
    answer: async ({ req }) => {
      const { s, a } = authed(req);
      if (statusOf(a) !== "active") throw httpError(403, closedMessage(a));
      const b = await readBodyJSON(req), q = (a.questions || []).find(x => x.id === b.id);
      if (!q) throw httpError(400, "That question is not in this paper");
      const fresh = readAttempt(s, a.id);
      if (b.choice === null) delete fresh.answers[q.id];
      else if (Number.isInteger(b.choice) && b.choice >= 0 && b.choice < q.options.length) fresh.answers[q.id] = b.choice;
      else throw httpError(400, "That option is not in this question");
      saveAttempt(s, fresh);
      return { ok: true };
    },
    submit: async ({ req }) => {
      const { s, a } = authed(req);
      if (statusOf(a) !== "active") throw httpError(403, closedMessage(a));
      a.submittedAt = Date.now();
      saveAttempt(s, a);
      return stateOf(s, a);
    },
    /* The score screen. Only after the attempt ends, and only what the admin
       allows, so answers can't reach students who are still sitting the paper. */
    result: async ({ req }) => {
      const { s, a } = authed(req);
      if (statusOf(a) === "active") throw httpError(403, "This paper is still open");
      const p = readPaper(s) || {};
      if (p.showResult === false) return { hidden: true };
      const finished = listAttempts(s).filter(x => statusOf(x) !== "active" && x.questions && x.questions.length);
      const mine = grade(a);
      const better = finished.filter(x => {
        const c = grade(x).correct;
        return x.id !== a.id && (c > mine.correct || (c === mine.correct && timeTaken(x) < timeTaken(a)));
      }).length;
      const out = Object.assign({ title: p.title || "Paper " + s, attemptedAt: a.startedAt, timeMs: timeTaken(a), rank: better + 1, participants: finished.length }, mine);
      if (p.showSolutions) out.solutions = a.questions.map(q => ({ q: q.q, options: q.options, answer: q.answer, explain: q.explain, chosen: a.answers[q.id] === undefined ? null : a.answers[q.id] }));
      return out;
    }
  };
  const POST_ONLY = new Set(["enter", "upload", "remove", "answer", "submit"]);

  async function studentHandler(req, res) {
    const send = (code, body) => {
      if (res.headersSent) return;
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(body));
    };
    try {
      const u = new URL(req.url, "http://x"), route = u.searchParams.get("route") || "";
      if (!Object.prototype.hasOwnProperty.call(studentRoutes, route)) return send(404, { error: "Unknown request" });
      if (POST_ONLY.has(route) !== (req.method === "POST")) return send(405, { error: "Wrong request method" });
      const out = await studentRoutes[route]({ req, res, q: k => u.searchParams.get(k) });
      if (out !== undefined) send(200, out);
    } catch (e) {
      if (!e.status) console.error(e);
      send(e.status || 500, { error: e.status ? e.message : "Something went wrong. Please try again." });
    }
  }

  /* Results of one student across all open papers, matched by the name (or mobile)
     the admin typed when creating that student's password. Used by the learner panel. */
  function summaryFor(keys) {
    keys = keys.map(k => String(k || '').trim().toLowerCase()).filter(Boolean);
    const out = { published: 0, papers: [] };
    for (let s = 1; s <= SLOTS; s++) {
      const p = readPaper(s); if (!p || !p.published) continue;
      out.published++;
      const c = readCodes(s).find(c => c.attemptId && keys.includes(String(c.student || '').trim().toLowerCase()));
      const a = c && readAttempt(s, c.attemptId);
      if (!a || statusOf(a) === 'active') continue;
      const g = grade(a);
      out.papers.push({ slot: s, title: p.title || 'Paper ' + s, total: g.total, correct: g.correct, score: g.total ? Math.round(g.correct / g.total * 100) : null, at: finishedAt(a) });
    }
    return out;
  }
  return { adminRoutes, studentHandler, summaryFor };
};
