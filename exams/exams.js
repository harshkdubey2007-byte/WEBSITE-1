/* Student examinations page: 8 locked papers, each sat question by question,
   with an optional view-only PDF and section-wise uploads. The server enforces
   the time limit and marks the answers; this page only shows them. */
import { embedMode, esc, dialog, quizRunner, confirmSubmit, quizSummary, quizSolutions } from "/exams/quiz-ui.js";

const API = "/api/exam";
const PDFJS = "/exams/vendor/pdfjs/";
const app = document.getElementById("app");
const $ = (s, r) => (r || document).querySelector(s);
const ICON = {
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
};
const ic = n => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + "</svg>";
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const tokenKey = "eb-exam-token";
/* Inside the learner dashboard (?embed=1) the dashboard supplies the header and links open in the full window. */
const EMBED = embedMode("exams");

async function call(route, opts) {
  opts = opts || {};
  const headers = {};
  if (opts.token) headers["x-exam-token"] = opts.token;
  if (opts.body) headers["Content-Type"] = "application/json";
  const r = await fetch(API + "?route=" + route, { method: opts.body ? "POST" : "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Something went wrong. Please try again."); e.status = r.status; throw e; }
  return j;
}

/* ================= paper list ================= */
function shell(inner) {
  return '<header class="top"><a href="/dashboard"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"></a><span class="spacer"></span><a class="btn sm glow" href="/practice-quizzes">Practice quizzes</a><a class="btn sm" href="/dashboard">Back to dashboard</a></header><main class="wrap">' + inner + "</main>";
}

async function showList(notice) {
  app.innerHTML = shell("<p>Loading papers…</p>");
  let data;
  try { data = await call("papers"); }
  catch (e) { app.innerHTML = shell('<div class="done-card"><h1>Examinations are not available</h1><p>' + esc(e.message) + '</p><div class="acts"><a class="btn primary glow" href="/practice-quizzes">Go to practice quizzes</a></div></div>'); return; }
  const hours = data.hours;
  app.innerHTML = shell(
    '<div class="intro"><h1>Examinations</h1><p>Every paper is locked. Get your password from your mentor. You get ' + hours + " hours from the moment you first enter it, and the paper closes when time ends.</p></div>" +
    (notice ? '<div class="note">' + esc(notice) + "</div>" : "") +
    '<a class="practice-cta glow" href="/practice-quizzes"><span><b>Practice before your exam</b><small>Quizzes for every course module, with no password or time limit.</small></span><span class="btn primary sm">Start practising</span></a>' +
    '<section class="papers" aria-label="Papers">' + data.papers.map(p =>
      '<article class="paper' + (p.available ? "" : " off") + '"><div class="row"><span class="no">Paper ' + p.slot + '</span><span class="lock">' + ic("lock") + "</span></div>" +
      "<h3>" + esc(p.available ? p.title : "Not open yet") + "</h3><p>" + esc(p.available ? p.description : "This paper hasn't been released.") + "</p>" +
      (p.available ? '<div class="meta">' + (p.questions ? p.questions + (p.questions === 1 ? " question · " : " questions · ") : "") + hours + ' hours · one attempt</div><button class="btn primary" data-open="' + p.slot + '">Enter password</button>' : "") + "</article>").join("") + "</section>");
  app.querySelectorAll("[data-open]").forEach(b => {
    const p = data.papers.find(x => x.slot === +b.dataset.open);
    b.onclick = () => askPassword(p, hours);
  });
  /* The student panel links straight to a paper with /exams#paper=3. */
  const wanted = /^#paper=(\d)$/.exec(location.hash);
  if (wanted) {
    history.replaceState(null, "", location.pathname);
    const p = data.papers.find(x => x.slot === +wanted[1] && x.available);
    if (p) askPassword(p, hours);
  }
}

function askPassword(p, hours) {
  const d = dialog("<h2>Paper " + p.slot + ": " + esc(p.title) + '</h2><form><label for="pw">Your password</label><input id="pw" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" required>' +
    '<div class="err" role="alert" hidden></div><div class="note">Your ' + hours + ' hours start as soon as you enter. The timer keeps running even if you close this page.</div>' +
    '<div class="acts"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">Start paper</button></div></form>');
  const input = $("#pw", d.el), err = $(".err", d.el), go = $(".btn.primary", d.el);
  $("[data-x]", d.el).onclick = d.close;
  setTimeout(() => input.focus(), 30);
  $("form", d.el).onsubmit = async e => {
    e.preventDefault();
    err.hidden = true; go.disabled = true;
    try {
      const st = await call("enter", { body: { slot: p.slot, password: input.value } });
      sessionStorage.setItem(tokenKey, st.token);
      d.close();
      enterRoom(st.token, st);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; }
  };
}

/* ================= exam room ================= */
const room = { token: null, state: null, endsAt: 0, tick: null, sync: null, pdf: null, zoom: 1, seen: null, uploading: 0, closed: false, answers: {}, saves: Promise.resolve(), saveFailed: false };

/* Deterrents only: nothing in a browser can fully stop a phone camera or a
   screenshot, which is why PDF pages also carry the student's name. */
function guard(e) {
  if (!room.token) return;
  if (e.type === "keydown") {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(k)) e.preventDefault();
  } else if (e.target.closest && e.target.closest(".viewer,.qz")) e.preventDefault();
}
["contextmenu", "dragstart", "copy"].forEach(t => document.addEventListener(t, guard));
document.addEventListener("keydown", guard);

async function enterRoom(token, state) {
  room.token = token; room.state = state; room.closed = false; room.zoom = 1; room.answers = Object.assign({}, state.answers); room.saveFailed = false;
  if (state.status !== "active") return finish(state);
  const hasQ = state.questions.length > 0, hasPdf = state.hasPdf, hasUp = state.sections.length > 0;
  const tabs = [hasQ && ["q", "Questions"], hasPdf && ["paper", "Question paper"], hasUp && ["upload", hasQ ? "Upload tasks" : "Upload answers"]].filter(Boolean);
  /* With questions, each part gets its own tab. Without, the PDF and uploads sit side by side. */
  const layout = tabs.length === 1 ? "one" : hasQ ? "tabbed" : "";
  setClock(state.remainingMs);
  app.innerHTML = '<div class="room"><header class="bar"><div class="ttl"><h1>Paper ' + state.slot + ": " + esc(state.title) + '</h1><div class="who">' + esc(state.student) + "</div></div>" +
    '<div class="clock" id="clock" role="timer" title="Time left">' + ic("clock") + '<span id="left">--:--:--</span></div>' + (hasQ ? "" : '<button class="btn primary" id="submit">Submit paper</button>') + "</header>" +
    '<div class="tabs' + (hasQ && tabs.length > 1 ? " on" : "") + (tabs.length > 1 ? " multi" : "") + '" role="tablist">' + tabs.map((t, i) => '<button role="tab" data-t="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + "</button>").join("") + "</div>" +
    '<div class="split ' + layout + '" id="split" data-tab="' + tabs[0][0] + '">' +
    (hasQ ? '<section data-pane="q" id="qhost" aria-label="Questions"></section>' : "") +
    (hasPdf ? '<section class="viewer" data-pane="paper" aria-label="Question paper"><div class="vtools"><button id="zo" aria-label="Zoom out">−</button><span id="zv">100%</span><button id="zi" aria-label="Zoom in">+</button></div><div class="pages" id="pages"><div class="vmsg">Loading the paper…</div></div></section>' : "") +
    (hasUp ? '<aside class="side" data-pane="upload" aria-label="Upload your work"><h2>Upload your work</h2><p>Upload to each section below. Everything uploaded when time ends goes to your mentor.</p><div id="secs" style="display:contents"></div></aside>' : "") + "</div></div>";
  app.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
    $("#split").dataset.tab = b.dataset.t;
    app.querySelectorAll(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    if (b.dataset.t === "paper") layoutPages();
  });
  if (hasQ) quizRunner($("#qhost"), { questions: state.questions, answers: room.answers, submitLabel: "Submit Paper", onChoose: saveAnswer, onSubmit: askSubmit });
  else $("#submit").onclick = askSubmit;
  if (hasPdf) {
    $("#zi").onclick = () => setZoom(room.zoom + 0.25);
    $("#zo").onclick = () => setZoom(room.zoom - 0.25);
  }
  drawSections();
  clearInterval(room.tick); clearInterval(room.sync);
  room.tick = setInterval(tick, 1000); tick();
  room.sync = setInterval(resync, 60000);
  document.addEventListener("visibilitychange", onVisible);
  if (hasPdf) loadPdf();
}
function onVisible() { if (!document.hidden && room.token) resync(); }
function setClock(ms) { room.endsAt = performance.now() + ms; }
function tick() {
  const ms = room.endsAt - performance.now(), left = $("#left");
  if (!left) return;
  if (ms <= 0) { left.textContent = "00:00:00"; if (!room.closed) { room.closed = true; timeUp(); } return; }
  const t = Math.ceil(ms / 1000), p = n => String(n).padStart(2, "0");
  left.textContent = p(Math.floor(t / 3600)) + ":" + p(Math.floor(t / 60) % 60) + ":" + p(t % 60);
  $("#clock").classList.toggle("low", t <= 600);
}
async function resync() {
  try {
    const st = await call("state", { token: room.token });
    setClock(st.remainingMs);
    if (st.status !== "active") finish(st);
  } catch (e) { if (e.status === 401) leave("Please enter your password again."); }
}

async function timeUp() {
  closePaper();
  await new Promise(r => setTimeout(r, 1500)); /* let the server's clock pass the deadline too */
  try { finish(await call("state", { token: room.token })); }
  catch (e) { finish(Object.assign({}, room.state, { status: "timed_out" })); }
}

/* Saved in order, one at a time. A failed save is retried once, then flagged so
   the student knows before they submit. */
function saveAnswer(id, choice) {
  const token = room.token;
  room.saves = room.saves.then(async () => {
    const send = () => call("answer", { token, body: { id, choice } });
    try { await send(); room.saveFailed = false; }
    catch (e) {
      if (e.status === 403 || e.status === 401) return;
      try { await new Promise(r => setTimeout(r, 1500)); await send(); room.saveFailed = false; }
      catch (e2) { room.saveFailed = true; }
    }
  });
}

/* ---------- PDF reader: pages are drawn on canvases, with no file to save ---------- */
async function loadPdf() {
  const box = $("#pages");
  try {
    const r = await fetch(API + "?route=pdf", { headers: { "x-exam-token": room.token }, cache: "no-store" });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "The paper could not be loaded."); }
    const bytes = await r.arrayBuffer();
    const pdfjs = await import(PDFJS + "pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
    room.pdf = await pdfjs.getDocument({ data: bytes, standardFontDataUrl: PDFJS + "standard_fonts/" }).promise;
    box.innerHTML = "";
    room.seen = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) drawPage(x.target); }), { root: box, rootMargin: "600px" });
    room.sizes = [];
    for (let i = 1; i <= room.pdf.numPages; i++) {
      const page = await room.pdf.getPage(i);
      room.sizes[i] = page.getViewport({ scale: 1 });
      const d = document.createElement("div");
      d.className = "pg"; d.dataset.n = i;
      box.appendChild(d);
      room.seen.observe(d);
    }
    layoutPages();
  } catch (e) {
    if (!room.closed) { box.innerHTML = '<div class="vmsg">' + esc(e.message || "The paper could not be loaded.") + '<br><button class="btn sm" id="retry" style="margin-top:12px">Try again</button></div>'; $("#retry").onclick = loadPdf; }
  }
}
const pageWidth = () => Math.max(240, $("#pages").clientWidth - 28) * room.zoom;
function layoutPages() {
  const box = $("#pages");
  if (!box || !room.pdf || !room.sizes || !box.clientWidth) return;
  box.querySelectorAll(".pg").forEach(d => {
    const vp = room.sizes[+d.dataset.n], w = pageWidth();
    d.style.width = w + "px"; d.style.height = w * vp.height / vp.width + "px";
    if (d.dataset.w !== String(w)) { d.dataset.w = w; d.innerHTML = ""; delete d.dataset.drawn; room.seen.unobserve(d); room.seen.observe(d); }
  });
}
async function drawPage(d) {
  if (d.dataset.drawn || !room.pdf || !d.style.width) return;
  d.dataset.drawn = "1";
  const n = +d.dataset.n, page = await room.pdf.getPage(n);
  const base = page.getViewport({ scale: 1 }), width = parseFloat(d.style.width) || base.width;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5), vp = page.getViewport({ scale: width / base.width * dpr });
  const c = document.createElement("canvas");
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  watermark(ctx, c.width, c.height);
  if (!room.pdf || !d.isConnected || d.dataset.drawn !== "1") return;
  d.innerHTML = ""; d.appendChild(c);
}
/* The student's name is drawn into every page, so a photo of it can be traced. */
function watermark(ctx, w, h) {
  const size = Math.max(14, w / 34);
  ctx.save();
  ctx.globalAlpha = 0.09; ctx.fillStyle = "#001A7A"; ctx.font = "600 " + size + "px Inter, sans-serif";
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 6);
  const text = room.state.student + " · eBuddha exam";
  const stepY = size * 7, stepX = ctx.measureText(text).width + size * 3, span = Math.hypot(w, h);
  for (let y = -span / 2; y < span / 2; y += stepY) for (let x = -span / 2; x < span / 2; x += stepX) ctx.fillText(text, x, y);
  ctx.restore();
}
function setZoom(z) {
  room.zoom = Math.min(3, Math.max(0.5, z));
  $("#zv").textContent = Math.round(room.zoom * 100) + "%";
  layoutPages();
}
window.addEventListener("resize", () => { clearTimeout(room.rz); room.rz = setTimeout(layoutPages, 200); });
function closePaper() {
  clearInterval(room.tick); clearInterval(room.sync);
  document.removeEventListener("visibilitychange", onVisible);
  if (room.seen) { room.seen.disconnect(); room.seen = null; }
  if (room.pdf) { room.pdf.destroy(); room.pdf = null; }
  const box = $("#pages"); if (box) box.innerHTML = "";
  const q = $("#qhost"); if (q) q.innerHTML = "";
}

/* ---------- section-wise uploads ---------- */
const ACCEPT = { image: "image/*,.heic,.heif", video: "video/*,.mkv", pdf: "application/pdf,.pdf" };
const KIND_WORD = { image: "Images", video: "Videos", pdf: "PDFs" };
function sectionHTML(s) {
  const files = room.state.files.filter(f => f.section === s.id);
  const limit = s.accept.map(k => KIND_WORD[k] + " up to " + Math.round(s.limits[k] / 1048576) + " MB").join(", ");
  const full = files.length >= s.maxFiles;
  return '<section class="sec" data-sec="' + esc(s.id) + '"><h3>' + esc(s.name) + (s.required ? ' <span class="tag ' + (files.length ? "done" : "req") + '">' + (files.length ? "Done" : "Required") + "</span>" : "") + "</h3>" +
    (s.instructions ? '<p class="ins">' + esc(s.instructions) + "</p>" : "") + '<p class="limit">' + esc(limit) + ". Up to " + s.maxFiles + " files.</p>" +
    (full ? "" : '<div class="pick">' +
      (s.accept.includes("image") ? '<label class="btn sm">' + ic("camera") + 'Take photo<input type="file" accept="image/*" capture="environment" hidden></label>' : "") +
      (s.accept.includes("video") ? '<label class="btn sm">' + ic("video") + 'Record video<input type="file" accept="video/*" capture="environment" hidden></label>' : "") +
      '<label class="btn sm">' + ic("file") + 'Choose files<input type="file" multiple accept="' + s.accept.map(k => ACCEPT[k]).join(",") + '" hidden></label></div>') +
    '<ul class="files">' + files.map(f => '<li><span class="nm" title="' + esc(f.name) + '">' + esc(f.name) + '</span><span class="sz">' + fmtSize(f.size) + '</span><button class="rm" data-rm="' + esc(f.id) + '" aria-label="Remove ' + esc(f.name) + '">Remove</button></li>').join("") + '</ul><ul class="files" data-q></ul></section>';
}
function drawSections() {
  const host = $("#secs");
  if (!host) return;
  /* Uploads in progress live in their section's data-q list; keep them on redraw. */
  const running = {};
  host.querySelectorAll("[data-sec]").forEach(el => { const q = $("[data-q]", el); if (q && q.children.length) running[el.dataset.sec] = Array.from(q.children); });
  host.innerHTML = room.state.sections.map(sectionHTML).join("");
  Object.keys(running).forEach(id => { const q = host.querySelector('[data-sec="' + id + '"] [data-q]'); if (q) running[id].forEach(li => q.appendChild(li)); });
  host.querySelectorAll('input[type="file"]').forEach(i => i.onchange = () => {
    const sec = i.closest("[data-sec]").dataset.sec, files = Array.from(i.files);
    i.value = "";
    files.forEach(f => upload(sec, f));
  });
  host.querySelectorAll("[data-rm]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      await call("remove", { token: room.token, body: { id: b.dataset.rm } });
      room.state.files = room.state.files.filter(f => f.id !== b.dataset.rm);
      drawSections();
    } catch (e) { b.disabled = false; alert(e.message); }
  });
}
/* Some cameras hand over a picture with no file name, and the server needs one
   to tell what type of file it is. */
function cleanName(f) {
  if (f.name) return f.name;
  const ext = (f.type.split("/")[1] || "bin").replace("jpeg", "jpg");
  return "capture-" + Date.now() + "." + ext;
}
let queue = Promise.resolve();
function upload(sectionId, file) {
  const q = $('[data-sec="' + sectionId + '"] [data-q]');
  const li = document.createElement("li");
  li.innerHTML = '<span class="nm">' + esc(file.name || "Capture") + '</span><span class="prog"><i></i></span><span class="sz">Waiting…</span>';
  q.appendChild(li);
  queue = queue.then(() => sendFile(sectionId, file, li));
}
function sendFile(sectionId, file, li) {
  return new Promise(resolve => {
    const bar = () => li.querySelector("i"), label = () => li.querySelector(".sz");
    const x = new XMLHttpRequest();
    room.uploading++;
    x.open("POST", API + "?route=upload&section=" + encodeURIComponent(sectionId));
    x.setRequestHeader("x-exam-token", room.token);
    x.setRequestHeader("x-filename", encodeURIComponent(cleanName(file)));
    x.upload.onprogress = e => { if (e.lengthComputable) { bar().style.width = (e.loaded / e.total * 100) + "%"; label().textContent = Math.round(e.loaded / e.total * 100) + "%"; } };
    const end = () => { room.uploading--; resolve(); };
    const fail = msg => {
      li.innerHTML = '<span class="nm" style="color:var(--red)">' + esc((file.name || "Capture") + ": " + msg) + '</span><button class="rm" aria-label="Dismiss">Dismiss</button>';
      li.querySelector("button").onclick = () => li.remove();
      end();
    };
    x.onerror = () => fail("the connection dropped. Please try again.");
    x.onload = () => {
      let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status !== 200) return fail(j.error || "upload failed.");
      li.remove();
      room.state.files.push(j.file);
      if (room.token && $("#secs")) drawSections();
      end();
    };
    x.send(file);
  });
}

/* ---------- finishing ---------- */
function askSubmit() {
  const st = room.state, notes = [];
  const unanswered = st.questions.filter(q => room.answers[q.id] === undefined).length;
  const empty = st.sections.filter(s => s.required && !st.files.some(f => f.section === s.id));
  if (unanswered) notes.push(unanswered + " question" + (unanswered === 1 ? " is" : "s are") + " unanswered.");
  if (empty.length) notes.push("Required sections still empty: " + empty.map(s => s.name).join(", ") + ".");
  if (room.uploading) notes.push("Files are still uploading. Wait for them to finish, or they will be lost.");
  if (room.saveFailed) notes.push("Your last answer may not have saved. Check your connection.");
  confirmSubmit(notes.map(n => '<div class="note">' + esc(n) + "</div>").join(""), async () => {
    await room.saves;
    finish(await call("submit", { token: room.token, body: {} }));
  });
}
async function finish(st) {
  closePaper();
  room.closed = true;
  const token = room.token;
  room.token = null;
  sessionStorage.removeItem(tokenKey);
  let res = null;
  if (st.questions && st.questions.length) { try { res = await call("result", { token }); } catch (e) { res = null; } }
  const backToPapers = () => showList();
  if (res && !res.hidden) {
    const summary = () => {
      app.innerHTML = '<header class="top"><a href="/dashboard"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"></a></header><div id="sm"></div>';
      const actions = [{ label: "Go to Papers", run: backToPapers }];
      if (res.solutions) actions.push({ label: "View Solution", primary: true, run: () => quizSolutions($("#sm"), res.title, res.solutions, summary) });
      quizSummary($("#sm"), res, actions);
    };
    return summary();
  }
  const n = (st.files || []).length, sent = st.status === "submitted";
  app.innerHTML = shell('<div class="done-card"><span class="lock">' + ic(sent ? "check" : "clock") + "</span><h1>" + (sent ? "Paper submitted" : "Time's up") + "</h1><p>Paper " + st.slot + ": " + esc(st.title) +
    "</p><p>" + (sent ? "Your work has been sent to your mentor." : "This paper has closed. What you did before time ended has gone to your mentor.") + (n ? " Files received: <b>" + n + "</b>." : "") + '</p><div class="acts"><button class="btn primary" id="back">Back to papers</button></div></div>');
  $("#back").onclick = backToPapers;
}
function leave(msg) {
  closePaper();
  room.token = null;
  sessionStorage.removeItem(tokenKey);
  showList(msg);
}

/* ================= start ================= */
const saved = sessionStorage.getItem(tokenKey);
if (saved) call("state", { token: saved }).then(st => enterRoom(saved, st)).catch(() => { sessionStorage.removeItem(tokenKey); showList(); });
else showList();
