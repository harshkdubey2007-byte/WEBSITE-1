/* Learner panel features for logged-in students and teachers. Loaded by
   dashboard/index.html only after login (not for visitors). Server side:
   api/_lib/learn.js. Students: performance bars, module-locked practical
   assignments, module progress, live classes + recordings, verified reading,
   jobs, Become an author, support requests. Teachers: review queue, module
   status, author approvals. */
(function () {
  "use strict";
  var L = window.EBL; if (!L) return;
  var V = L.VIEWS, D = L.D, I = L.I, esc = L.esc, $ = L.$, $$ = L.$$, toast = L.toast, ME = L.me(), LD = null;
  document.head.insertAdjacentHTML("beforeend", "<style>" +
    ".pf-h{display:flex;align-items:center;gap:16px;margin-bottom:16px}.pf-h h2{margin:0}.pf-o{margin-left:auto;text-align:center;padding:10px 16px;border-radius:14px;background:linear-gradient(135deg,#002CCD,#2F5BFF);color:#fff}.pf-o b{display:block;font:700 24px Poppins,sans-serif}.pf-o span{font-size:11.5px;opacity:.85}" +
    ".pf-b{display:block;padding:14px;border:1px solid var(--line);border-radius:14px;text-decoration:none;color:inherit;transition:border-color .2s,transform .2s}.pf-b:hover{border-color:var(--brand-2);transform:translateY(-2px)}.pf-b .row{gap:8px;margin-bottom:10px}.pf-b .ic{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--soft);color:var(--brand)}.pf-b .bar{margin-bottom:8px}" +
    ".mod-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}.mod-h h3{margin:0;font-size:15px}.tk{display:flex;gap:14px;align-items:flex-start;padding:14px 18px;border-bottom:1px solid var(--line)}.tk:last-child{border-bottom:0}.tk h4{margin:0 0 3px;font-size:14.5px}.tk p{margin:0;font-size:13px;color:#64748B}.tk.locked{opacity:.55}.tk .act{margin-left:auto;flex:none;text-align:right}.fb{margin-top:8px;padding:8px 10px;border-radius:9px;background:#FFF7ED;font-size:12.5px;color:#9A3412}" +
    ".mdl-ov{position:fixed;inset:0;z-index:95;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px}.mdl-b{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:22px}.mdl-b.wide{max-width:860px}.mdl-b h2{margin:0 0 12px;font:700 19px Poppins,sans-serif}.mdl-f{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}" +
    ".lc{overflow:hidden;padding:0}.lc .th{position:relative;aspect-ratio:16/9;background:#0A1A5C center/cover no-repeat;display:grid;place-items:center;color:#fff}.lc .th .pl{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.92);color:var(--brand);display:grid;place-items:center}.lc .th .dt{position:absolute;left:10px;top:10px;padding:4px 9px;border-radius:8px;background:rgba(0,0,0,.6);font-size:12px;font-weight:600}.lc .bd{padding:14px}.lc h3{margin:0 0 4px;font-size:15px}.sec-t{margin:22px 0 12px;font:600 16px Poppins,sans-serif}button.lc{border:0;text-align:left;cursor:pointer;font:inherit;width:100%}" +
    ".rd{font-size:15.5px;line-height:1.7;color:#1F2937}.rd h1,.rd h2,.rd h3,.rd h4{font-family:Poppins,sans-serif;line-height:1.3;margin:18px 0 8px}.rd img{max-width:100%;height:auto;border-radius:10px}.rd button,.rd .csx-try,.rd .csx-more{display:none!important}.rd-bar{position:sticky;bottom:-22px;background:#fff;padding:12px 0 2px;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px}" +
    ".roy{position:relative;overflow:hidden;border-radius:18px;padding:26px 28px;color:#fff;background:radial-gradient(900px 260px at 90% -30%,rgba(253,189,86,.35),transparent),linear-gradient(120deg,#000825,#001A7A 55%,#002CCD)}.roy h2{margin:0 0 6px;font:700 24px Poppins,sans-serif}.roy p{margin:0 0 14px;opacity:.88}.roy .btn{background:linear-gradient(180deg,#FFD27A,#FDBD56);color:#111827;border-color:#FDBD56}" +
    ".jb{border:1px solid var(--line);border-radius:16px;padding:16px;background:linear-gradient(180deg,#fff,#FBFCFF);display:flex;flex-direction:column;gap:10px}.jb .lg{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font:700 15px Poppins,sans-serif;color:#3B2A05;background:linear-gradient(180deg,#FFE29A,#FDBD56)}.jb h3{margin:0;font-size:15.5px}.jb p{margin:0;font-size:13px;color:#64748B;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.co .g-main>.stack:first-child>.card:first-child{display:none}" +
    ".ms{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}.ms:last-child{border-bottom:0}.ms .n{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;background:#EDF0F6;color:#64748B;flex:none}.ms.done .n{background:var(--green);color:#fff}.ms.cur .n{background:var(--brand);color:#fff}" +
    "@media(max-width:767px){.pf .g-4{grid-template-columns:1fr 1fr}.tk{flex-wrap:wrap}.tk .act{margin-left:0;text-align:left}.pf-h{flex-wrap:wrap}}</style>");

  /* ---------- helpers ---------- */
  function head(t, p, extra) { return '<div class="page-h"><div><h2>' + t + "</h2>" + (p ? "<p>" + p + "</p>" : "") + "</div>" + (extra || "") + "</div>"; }
  function load(force) { if (LD && !force) return Promise.resolve(LD); return L.lapi("learn").then(function (d) { LD = d; ME.perf = d.perf; return d; }); }
  function when(t) { return t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""; }
  function modal(o) {
    var ov = document.createElement("div"); ov.className = "mdl-ov";
    ov.innerHTML = '<div class="mdl-b' + (o.wide ? " wide" : "") + '" role="dialog" aria-modal="true"><h2></h2><div class="mdl-c"></div><div class="mdl-f"></div></div>';
    $("h2", ov).textContent = o.title; $(".mdl-c", ov).innerHTML = o.body;
    function close() { ov.remove(); document.removeEventListener("keydown", key); if (o.onClose) o.onClose(); }
    function key(e) { if (e.key === "Escape") close(); }
    (o.actions || [["Close"]]).forEach(function (a) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a[2] ? " pri" : ""); b.textContent = a[0];
      b.onclick = function () { if (!a[1]) return close(); b.disabled = true; Promise.resolve(a[1](ov)).then(function (r) { if (r !== false) close(); else b.disabled = false; }, function (e) { b.disabled = false; toast(e.message); }); };
      $(".mdl-f", ov).appendChild(b);
    });
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", key); document.body.appendChild(ov); return { el: ov, close: close };
  }
  function fill(sel, v, fn) { var box = $(sel, v); load(true).then(function (d) { box.innerHTML = fn(d); if (fn.after) fn.after(box, d); }, function (e) { box.innerHTML = '<div class="card empty">' + esc(e.message) + "</div>"; }); }

  /* ================= teachers ================= */
  if (ME.role === "teacher") {
    L.ROUTES.splice(0, L.ROUTES.length, ["Teaching"], ["overview", "Review queue", "task"], ["students", "Students", "user"], ["authors", "Author requests", "pen"], ["Account"], ["support", "Help & support", "help"], ["profile", "Profile", "user"]);
    var RV = null;
    var rvLoad = function () { return L.lapi("rv-list").then(function (d) { RV = d; return d; }); };
    V.overview = function () { return head("Review queue", "Check each submission, then mark it Completed, Rework or Denied. Denied takes 2 points off until the student resubmits and you approve it.") + '<div id="rq"><div class="card empty">Loading…</div></div>'; };
    V.overview.after = function (v) {
      rvLoad().then(function (d) {
        $("#rq", v).innerHTML = d.queue.length ? '<div class="card">' + d.queue.map(function (x, i) {
          return '<div class="tk"><div><h4>' + esc(x.title) + '</h4><p>' + esc(x.student) + " · submitted " + when(x.at) + (x.n > 1 ? " · attempt " + x.n : "") + "</p>" + (x.note ? '<p style="margin-top:6px">“' + esc(x.note) + "”</p>" : "") + '</div><div class="act"><a class="btn sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + I("ext") + 'Open work</a> <button class="btn sm pri" data-rv="' + i + '">Review</button></div></div>';
        }).join("") + "</div>" : '<div class="card empty">No submissions waiting. 🎉</div>';
      }, function (e) { $("#rq", v).innerHTML = '<div class="card empty">' + esc(e.message) + "</div>"; });
      $("#rq", v).addEventListener("click", function (e) {
        var b = e.target.closest("[data-rv]"); if (!b) return; var x = RV.queue[+b.getAttribute("data-rv")];
        var go = function (st) { return function (ov) { return L.lapi("rv-review", { sid: x.sid, task: x.task, status: st, fb: $("#rvFb", ov).value }).then(function () { toast("Marked " + st); L.route(); }); }; };
        modal({ title: x.title, body: '<p class="small muted">' + esc(x.student) + ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">open the work</a></p><div class="field"><label class="f" for="rvFb">Feedback for the student</label><textarea id="rvFb" placeholder="What is good, what to fix…"></textarea></div>',
          actions: [["Cancel"], ["Denied (−2)", go("denied")], ["Rework", go("rework")], ["Completed", go("completed"), 1]] });
      });
    };
    V.students = function () { return head("Students", "Tick a module when the student has finished it. Their next module's assignments unlock straight away.") + '<div id="st"><div class="card empty">Loading…</div></div>'; };
    V.students.after = function (v) {
      rvLoad().then(function (d) {
        $("#st", v).innerHTML = d.students.map(function (s) {
          return '<div class="card pad" style="margin-bottom:14px"><div class="row"><b style="font-size:15px">' + esc(s.name) + '</b><span class="small muted">+91 ' + esc(s.phone) + " · " + esc(s.course) + '</span><span class="spacer"></span><span class="chip blue">Overall ' + s.perf.overall + "%</span></div>" +
            '<div class="small muted" style="margin:8px 0">Assignments ' + s.perf.assignments.pct + "% · Exams " + s.perf.exams.pct + "% · Modules " + s.perf.modules.pct + "% · Reading " + s.perf.reading.pct + "%</div>" +
            '<div style="display:flex;flex-wrap:wrap;gap:8px 16px">' + s.modules.map(function (m, i) { return '<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-sm="' + s.id + '" data-i="' + i + '"' + (s.mods.indexOf(i) > -1 ? " checked" : "") + "> " + (i + 1) + ". " + esc(m) + "</label>"; }).join("") + "</div></div>";
        }).join("") || '<div class="card empty">No students yet.</div>';
      });
      $("#st", v).addEventListener("change", function (e) {
        var c = e.target.closest("[data-sm]"); if (!c) return;
        L.lapi("rv-module", { sid: c.getAttribute("data-sm"), idx: +c.getAttribute("data-i"), done: c.checked }).then(function () { toast(c.checked ? "Module marked complete" : "Module reopened"); }, function (er) { toast(er.message); c.checked = !c.checked; });
      });
    };
    V.authors = function () { return head("Author requests", "Approve a student once their module is complete. Approved students can start writing blogs.") + '<div id="au"><div class="card empty">Loading…</div></div>'; };
    V.authors.after = function (v) {
      rvLoad().then(function (d) {
        var list = d.students.filter(function (s) { return s.author; });
        $("#au", v).innerHTML = list.length ? '<div class="card">' + list.map(function (s) {
          var ok = s.author.status === "approved";
          return '<div class="tk"><div><h4>' + esc(s.name) + " · " + esc(s.author.title) + "</h4><p>" + esc(s.author.bio) + '</p><p style="margin-top:4px">Modules done: ' + s.perf.modules.done + "/" + s.perf.modules.total + '</p></div><div class="act"><span class="chip ' + (ok ? "green" : "amber") + '">' + (ok ? "Approved" : "Waiting") + '</span> <button class="btn sm' + (ok ? "" : " pri") + '" data-ap="' + s.id + '" data-v="' + (ok ? 0 : 1) + '">' + (ok ? "Remove approval" : "Approve") + "</button></div></div>";
        }).join("") + "</div>" : '<div class="card empty">No author requests yet.</div>';
      });
      $("#au", v).addEventListener("click", function (e) {
        var b = e.target.closest("[data-ap]"); if (!b) return;
        L.lapi("rv-author", { sid: b.getAttribute("data-ap"), approve: b.getAttribute("data-v") === "1" }).then(function () { toast("Saved"); L.route(); }, function (er) { toast(er.message); });
      });
    };
    return;
  }

  /* ================= students ================= */
  var ri = -1; L.ROUTES.forEach(function (r, i) { if (r[0] === "refer") ri = i; });
  if (ri > -1) L.ROUTES.splice(ri + 1, 0, ["author", "Become an author", "pen"]);

  /* ---------- overview: the 4 performance bars ---------- */
  function perfBlock(p) {
    function bar(ic, t, x, detail, href, col) { return '<a class="pf-b" href="' + href + '"><div class="row"><span class="ic">' + I(ic) + "</span><b>" + t + '</b><span class="spacer"></span><b>' + x.pct + '%</b></div><div class="bar"><i style="width:' + x.pct + "%;background:" + col + '"></i></div><div class="small muted">' + detail + "</div></a>"; }
    return '<div class="card pad pf"><div class="pf-h"><div><h2>Your performance</h2><div class="small muted">Assignments 30% · Exams 30% · Modules 25% · Reading 15%</div></div><div class="pf-o"><b>' + p.overall + "%</b><span>Overall</span></div></div><div class=\"grid g-4\">" +
      bar("task", "Assignments", p.assignments, p.assignments.done + " of " + p.assignments.total + " completed" + (p.assignments.penalty ? ' · <span style="color:var(--red)">−' + p.assignments.penalty + " pts</span>" : ""), "#assignments", "linear-gradient(90deg,#002CCD,#2F5BFF)") +
      bar("lock", "Examinations", p.exams, p.exams.attended + " of " + p.exams.total + " papers" + (p.exams.avg != null ? " · avg " + p.exams.avg + "%" : ""), "/exams", "linear-gradient(90deg,#7C3AED,#A78BFA)") +
      bar("check", "Modules", p.modules, p.modules.done + " of " + p.modules.total + " completed", "#progress", "linear-gradient(90deg,#16A34A,#4ADE80)") +
      bar("book", "Reading", p.reading, p.reading.done + " of " + p.reading.total + " read", "#resources", "linear-gradient(90deg,#F59E0B,#FDBD56)") + "</div></div>";
  }
  var ov = V.overview, ovAfter = V.overview.after;
  V.overview = function () { var h = ov(); return ME.perf ? h.replace("</section>", "</section>" + perfBlock(ME.perf)) : h; };
  if (ovAfter) V.overview.after = ovAfter;

  /* ---------- practical assignments ---------- */
  var CHIP = { open: ["blue", "Open"], rework: ["amber", "Rework needed"], denied: ["red", "Denied · resubmit"], submitted: ["blue", "Under review"], completed: ["green", "Completed"], locked: ["", "Locked"], queued: ["", "Next up"] };
  V.assignments = function () { return head("Practical assignments", "Your current module's assignments are open (up to 5 at a time). Later modules unlock when your mentor marks a module complete.") + '<div id="asB"><div class="card empty">Loading…</div></div>'; };
  function asList(d) {
    if (!d.tasks.length) return '<div class="card empty">Your mentor hasn\'t added assignments yet.</div>';
    var p = d.perf.assignments;
    return '<div class="grid g-3" style="margin-bottom:16px">' + L.kpi("task", "", p.done + "/" + p.total, "Completed") + L.kpi("chart", "g", p.pct + "%", "Assignment score") + L.kpi("alert", "a", p.penalty ? "−" + p.penalty : "0", "Penalty points") + "</div>" +
      d.modules.map(function (m, i) {
        var T = d.tasks.filter(function (t) { return t.module === i; }); if (!T.length) return "";
        var st = m.done ? ["green", "Completed"] : i === d.current ? ["blue", "Current module"] : i > d.current ? ["", "Locked"] : ["amber", "Open"];
        return '<div class="card" style="margin-bottom:16px"><div class="mod-h"><h3>Module ' + (i + 1) + " · " + esc(m.name) + '</h3><span class="chip ' + st[0] + '">' + st[1] + "</span></div>" + T.map(function (t) {
          var c = CHIP[t.state] || CHIP.open, can = t.state === "open" || t.state === "rework" || t.state === "denied";
          var act = can ? '<button class="btn sm pri" data-sub="' + t.id + '">' + (t.sub ? "Resubmit" : "Submit") + "</button>" : t.state === "completed" ? '<b style="color:var(--green)">+' + t.points + " pts</b>" : t.state === "locked" ? I("lock") : "";
          return '<div class="tk' + (t.state === "locked" || t.state === "queued" ? " locked" : "") + '"><div style="min-width:0"><h4>' + esc(t.title) + "</h4>" + (t.brief && t.state !== "locked" ? "<p>" + esc(t.brief) + "</p>" : "") +
            (t.sub && t.sub.fb ? '<div class="fb"><b>Mentor:</b> ' + esc(t.sub.fb) + "</div>" : "") + (t.sub && t.sub.url ? '<p style="margin-top:6px"><a href="' + esc(t.sub.url) + '" target="_blank" rel="noopener">Your submitted work</a></p>' : "") +
            '</div><div class="act"><span class="chip ' + c[0] + '">' + c[1] + "</span><div style=\"margin-top:8px\">" + act + "</div></div></div>";
        }).join("") + "</div>";
      }).join("");
  }
  V.assignments.after = function (v) {
    fill("#asB", v, asList);
    $("#asB", v).addEventListener("click", function (e) {
      var b = e.target.closest("[data-sub]"); if (!b) return; var t = LD.tasks.filter(function (x) { return x.id === b.getAttribute("data-sub"); })[0];
      modal({ title: "Submit: " + t.title, body: '<p class="small muted" style="margin-top:0">' + esc(t.brief) + '</p><div class="field"><label class="f" for="sbU">Link to your work <span class="req">*</span></label><input id="sbU" type="url" placeholder="Google Drive, Docs, Canva, website…"></div><div class="field" style="margin-top:12px"><label class="f" for="sbN">Note for your mentor</label><textarea id="sbN" placeholder="Optional"></textarea></div><p class="small muted">Make sure the link is shared as "Anyone with the link can view".</p>',
        actions: [["Cancel"], ["Submit", function (ov) { return L.lapi("submit", { task: t.id, url: $("#sbU", ov).value, note: $("#sbN", ov).value }).then(function () { toast("Submitted for review"); L.route(); }); }, 1]] });
    });
  };

  /* ---------- module progress (set by the mentor) ---------- */
  V.progress = function () { return head("Module progress", "Your mentor marks each module complete. When a module is done, the next module's assignments open.") + '<div id="mpB"><div class="card empty">Loading…</div></div>'; };
  V.progress.after = function (v) {
    fill("#mpB", v, function (d) {
      var p = d.perf.modules;
      return '<div class="card pad" style="margin-bottom:16px"><div class="row"><b>' + p.done + " of " + p.total + ' modules complete</b><span class="spacer"></span><b>' + p.pct + '%</b></div><div class="bar green" style="margin-top:10px"><i style="width:' + p.pct + '%"></i></div></div><div class="card">' +
        d.modules.map(function (m, i) { var c = m.done ? "done" : i === d.current ? "cur" : ""; return '<div class="ms ' + c + '"><span class="n">' + (m.done ? "✓" : i + 1) + "</span><b style=\"flex:1\">" + esc(m.name) + '</b><span class="chip ' + (m.done ? "green" : c ? "blue" : "") + '">' + (m.done ? "Completed" : c ? "In progress" : "Upcoming") + "</span></div>"; }).join("") + "</div>";
    });
  };

  /* ---------- live classes + recordings ---------- */
  function yt(u) { var m = /(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/.exec(u || ""); return m ? m[1] : ""; }
  function thumb(l) { var id = yt(l.recording); return l.thumb ? "url(" + l.thumb + ")" : id ? "url(https://i.ytimg.com/vi/" + id + "/hqdefault.jpg)" : "linear-gradient(135deg," + L.colorFor(l.title) + ",#000F47)"; }
  V.live = function () {
    var up = L.upcoming().slice(0, 7), rec = L.past().filter(function (l) { return l.recording; });
    var when2 = function (l) { var s = L.classStart(l); return s.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) + " · " + L.fmtTime(s); };
    return head("Live classes", "Upcoming classes and recordings of past sessions. Times are in your local time.") + '<div id="lvB">' +
      '<h3 class="sec-t">Upcoming classes</h3><div class="grid g-3">' + (up.map(function (l) {
        var s = L.classStart(l), live = s <= new Date() && L.classEnd(l) >= new Date();
        return '<div class="card lc"><div class="th" style="background-image:' + thumb(l) + '"><span class="dt">' + s.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + "</span></div><div class=\"bd\"><h3>" + esc(l.title) + '</h3><div class="small muted">' + when2(l) + " · " + (+l.duration || 60) + " min" + (l.mentor ? " · " + esc(l.mentor) : "") + '</div><div style="margin-top:10px">' +
          (live && l.link ? '<a class="btn sm pri" href="' + esc(l.link) + '" target="_blank" rel="noopener">Join now</a>' : '<button class="btn sm" data-ics="' + esc(l.id) + '">' + I("cal") + "Add to calendar</button>") + "</div></div></div>";
      }).join("") || '<div class="card empty" style="grid-column:1/-1">No upcoming classes yet.</div>') + "</div>" +
      '<h3 class="sec-t">Past recordings</h3><div class="grid g-3">' + (rec.map(function (l) {
        return '<button class="card lc" data-yt="' + esc(l.id) + '"><div class="th" style="background-image:' + thumb(l) + '"><span class="pl">' + I("play") + '</span></div><div class="bd"><h3>' + esc(l.title) + '</h3><div class="small muted">' + when2(l) + (l.mentor ? " · " + esc(l.mentor) : "") + "</div></div></button>";
      }).join("") || '<div class="card empty" style="grid-column:1/-1">Recordings appear here after each class.</div>') + "</div></div>";
  };
  V.live.after = function (v) {
    $("#lvB", v).addEventListener("click", function (e) {
      var b = e.target.closest("[data-yt]"); if (!b) return;
      var l = D.live.filter(function (x) { return x.id === b.getAttribute("data-yt"); })[0], id = yt(l.recording);
      if (!id) return window.open(l.recording, "_blank", "noopener");
      modal({ title: l.title, wide: true, body: '<div style="aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1" style="width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="' + esc(l.title) + '"></iframe></div>' });
    });
  };

  /* ---------- resources: verified reading ---------- */
  var ART = null, rTab = "cs";
  function articles() {
    if (ART) return Promise.resolve(ART);
    var P = new DOMParser();
    return Promise.all([fetch("/case-studies").then(function (r) { return r.text(); }), fetch("/blog").then(function (r) { return r.text(); })]).then(function (t) {
      var cs = [].map.call(P.parseFromString(t[0], "text/html").querySelectorAll("article.csx-card[id]"), function (a) {
        var g = function (s) { var e = a.querySelector(s); return e ? e.textContent.replace(/\s+/g, " ").trim() : ""; };
        return { key: "cs:" + a.id, kind: "cs", title: g(".csx-ttl"), sub: g(".csx-brand") + (g(".csx-tag") ? " · " + g(".csx-tag") : ""), el: a };
      });
      var seen = {}, bl = [];
      [].forEach.call(P.parseFromString(t[1], "text/html").querySelectorAll('a[href^="/blog/"]'), function (a) {
        var m = /^\/blog\/([a-z0-9-]+)\/?$/.exec(a.getAttribute("href")); if (!m || /^wp-/.test(m[1]) || seen[m[1]]) return;
        var h = a.querySelector("h2,h3") || a; var title = h.textContent.replace(/\s+/g, " ").trim(); if (!title || title.length < 8) return;
        seen[m[1]] = 1; bl.push({ key: "blog:" + m[1], kind: "blog", slug: m[1], title: title, sub: "Blog" });
      });
      return (ART = { cs: cs, blog: bl });
    });
  }
  V.resources = function () { return '<div id="rsW">' + head("Resources", "Read our case studies and blogs. An article counts when you scroll through it and spend real reading time on it.") + '<div class="tabs" id="rTabs">' + [["cs", "Case studies"], ["blog", "Blogs"], ["files", "Course files"]].map(function (t) { return '<button data-rk="' + t[0] + '" aria-pressed="' + (rTab === t[0]) + '">' + t[1] + "</button>"; }).join("") + '</div><div id="rsB"><div class="card empty">Loading…</div></div></div>'; };
  V.resources.after = function (v) {
    function draw() {
      if (rTab === "files") { $("#rsB", v).innerHTML = '<div class="grid g-2">' + (D.resources.map(function (r) { return '<a class="card res" href="' + esc(r.url) + '" style="text-decoration:none;color:inherit"><div style="flex:1;min-width:0"><b>' + esc(r.title) + '</b><div class="small muted">' + esc(r.type || "") + " · " + esc(r.course || "") + "</div></div>" + I("ext") + "</a>"; }).join("") || '<div class="card empty">No files yet.</div>') + "</div>"; return; }
      Promise.all([articles(), load()]).then(function (r) {
        var list = r[0][rTab], reads = r[1].reads || {}, done = list.filter(function (a) { return reads[a.key]; }).length;
        $("#rsB", v).innerHTML = '<div class="card pad" style="margin-bottom:14px"><div class="row"><b>' + done + " of " + list.length + ' read</b><span class="spacer"></span><span class="small muted">Reading score ' + r[1].perf.reading.pct + '%</span></div><div class="bar" style="margin-top:10px"><i style="width:' + (list.length ? Math.round(done / list.length * 100) : 0) + '%;background:linear-gradient(90deg,#F59E0B,#FDBD56)"></i></div></div><div class="grid g-2">' +
          list.map(function (a, i) { var rd = reads[a.key]; return '<button class="card res" data-rd="' + i + '" style="text-align:left;cursor:pointer;font:inherit;border:1px solid var(--line)"><div style="flex:1;min-width:0"><b>' + esc(a.title) + '</b><div class="small muted">' + esc(a.sub) + '</div></div><span class="chip ' + (rd ? "green" : "") + '">' + (rd ? "Read ✓" : "Read") + "</span></button>"; }).join("") + "</div>";
      }, function (e) { $("#rsB", v).innerHTML = '<div class="card empty">' + esc(e.message) + "</div>"; });
    }
    $("#rsW", v).addEventListener("click", function (e) {
      var t = e.target.closest("[data-rk]"); if (t) { rTab = t.getAttribute("data-rk"); $$("#rTabs button", v).forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); }); return draw(); }
      var b = e.target.closest("[data-rd]"); if (b) reader(ART[rTab][+b.getAttribute("data-rd")], draw);
    });
    draw();
  };
  function reader(a, done) {
    var m = modal({ title: a.title, wide: true, body: '<div class="rd" id="rdB">Loading…</div><div class="rd-bar"><span class="small muted" id="rdS"></span><span class="spacer" style="flex:1"></span><button class="btn pri" id="rdOk" disabled>Mark as read</button></div>', onClose: function () { clearInterval(tick); } });
    var box = $(".mdl-b", m.el), sec = 0, need = 20, scrolled = false, already = !!(LD.reads || {})[a.key], tick;
    (a.kind === "cs" ? Promise.resolve(a.el.innerHTML) : fetch("/blog/" + a.slug).then(function (r) { return r.text(); }).then(function (h) { var d = new DOMParser().parseFromString(h, "text/html"), c = d.querySelector(".blog-content") || d.querySelector("article") || d.body; return c.innerHTML; })).then(function (html) {
      var body = $("#rdB", m.el); body.innerHTML = html; $$("script,style,iframe,form,[class*=share],[class*=Share]", body).forEach(function (x) { x.remove(); }); $$("p,h2,h3,h4,span,div,ul", body).forEach(function (x) { if (/^share this article$/i.test(x.textContent.trim()) || (x.tagName === "UL" && !x.textContent.trim())) x.remove(); });
      var words = (body.textContent || "").split(/\s+/).length; need = Math.max(20, Math.round(words / 200 * 60 * 0.5));
      check();
    });
    function check() { if (box.scrollHeight - box.clientHeight - box.scrollTop < 80) scrolled = true; paint(); }
    function paint() {
      var ok = $("#rdOk", m.el), s = $("#rdS", m.el); if (!ok) return;
      if (already) { ok.disabled = true; ok.textContent = "Read ✓"; s.textContent = "Already counted in your reading score."; return; }
      var left = Math.max(0, need - sec); ok.disabled = !(left === 0 && scrolled);
      s.textContent = left ? "Keep reading… " + left + "s" + (scrolled ? "" : " · scroll to the end") : scrolled ? "Done! Mark it as read." : "Scroll to the end of the article";
    }
    box.addEventListener("scroll", check, { passive: true });
    tick = setInterval(function () { if (document.visibilityState === "visible" && document.hasFocus()) { sec++; paint(); } }, 1000);
    $("#rdOk", m.el).onclick = function () { L.lapi("read", { key: a.key, sec: sec }).then(function () { (LD.reads = LD.reads || {})[a.key] = Date.now(); toast("Added to your reading score"); m.close(); LD = null; done(); }, function (e) { toast(e.message); }); };
  }

  /* ---------- career & jobs (royal) ---------- */
  var oldCareer = V.career, oldCareerAfter = V.career.after, JOBS = null, jType = "All";
  V.career = function () {
    return '<section class="roy"><h2>Career & jobs</h2><p>Openings from our hiring partners and companies that hire eBuddha learners. Apply directly, then tell your mentor.</p><a class="btn" href="/hire-from-us#post-job">Hiring? Post a job</a></section>' +
      '<div class="tabs" id="jT" style="margin-top:18px"></div><div id="jB" class="grid g-2"><div class="card empty" style="grid-column:1/-1">Loading openings…</div></div><div class="co" style="margin-top:18px">' + oldCareer() + "</div>";
  };
  V.career.after = function (v) {
    if (oldCareerAfter) oldCareerAfter(v);
    (JOBS ? Promise.resolve(JOBS) : L.lapi("jobs").catch(function () { return []; })).then(function (api) {
      JOBS = api; var all = api.concat(D.jobs.map(function (j) { return { company: j.company, role: j.role, location: j.location, type: j.type, posted: Date.parse(j.posted) || 0, apply: j.url || "/hire-from-us" }; }));
      function draw() {
        var types = ["All"].concat(all.map(function (j) { return j.type; }).filter(function (t, i, a) { return t && a.indexOf(t) === i; }));
        $("#jT", v).innerHTML = types.map(function (t) { return '<button data-jt="' + esc(t) + '" aria-pressed="' + (t === jType) + '">' + esc(t) + "</button>"; }).join("");
        var list = all.filter(function (j) { return jType === "All" || j.type === jType; });
        $("#jB", v).innerHTML = list.map(function (j) {
          return '<div class="jb"><div class="row" style="flex-wrap:nowrap"><span class="lg">' + esc(L.initials(j.company || j.role)) + '</span><div style="min-width:0"><h3>' + esc(j.role) + '</h3><div class="small muted">' + esc(j.company) + "</div></div></div>" + (j.desc ? "<p>" + esc(j.desc) + "</p>" : "") +
            '<div class="row small muted">' + I("pin") + esc(j.location) + (j.salary ? " · " + esc(j.salary) : "") + '</div><div class="row"><span class="chip blue">' + esc(j.type) + '</span><span class="small muted">' + (j.posted ? "Posted " + when(j.posted) : "") + '</span><span class="spacer"></span><a class="btn sm pri" href="' + esc(j.apply || "/hire-from-us") + '" target="_blank" rel="noopener">Apply</a></div></div>';
        }).join("") || '<div class="card empty" style="grid-column:1/-1">New openings are posted here regularly.</div>';
      }
      $("#jT", v).addEventListener("click", function (e) { var t = e.target.closest("[data-jt]"); if (t) { jType = t.getAttribute("data-jt"); draw(); } });
      draw();
    });
  };

  /* ---------- become an author ---------- */
  V.author = function () { return head("Become an author", "Write for the eBuddha blog. Your author profile appears on our Authors page; your mentor approves you to start writing once your module is complete.") + '<div id="auB"><div class="card empty">Loading…</div></div>'; };
  V.author.after = function (v) {
    fill("#auB", v, function (d) {
      var a = d.author || {}, st = a.status === "approved" ? ["green", "Approved · you can start writing"] : a.status ? ["amber", "Applied · waiting for approval"] : null;
      return (st ? '<div class="card pad row" style="margin-bottom:16px"><span class="chip ' + st[0] + '">' + st[1] + '</span><span class="spacer"></span><a class="btn sm" href="/authors#student-' + esc(ME.id) + '" target="_blank" rel="noopener">View my author profile</a></div>' : "") +
        '<form class="card pad" id="auF"><div class="form"><div class="field full"><label class="f" for="auT">Author title <span class="req">*</span></label><input id="auT" maxlength="80" value="' + esc(a.title || "") + '" placeholder="e.g. eBuddha Learner · SEO & Content"></div>' +
        '<div class="field full"><label class="f" for="auBio">Short bio <span class="req">*</span></label><textarea id="auBio" maxlength="500" placeholder="2–3 lines about you and what you like to write about">' + esc(a.bio || "") + "</textarea></div>" +
        '<div class="field full"><label class="f" for="auTp">Topics you want to write on</label><input id="auTp" maxlength="160" value="' + esc(a.topics || "") + '" placeholder="e.g. SEO, Instagram growth, AI tools"></div></div>' +
        '<p class="small muted">Your profile photo, LinkedIn and Instagram from your profile are shown on the Authors page.</p><button class="btn pri" type="submit">' + (a.status ? "Update author profile" : "Apply to become an author") + "</button></form>";
    });
    $("#auB", v).addEventListener("submit", function (e) {
      if (e.target.id !== "auF") return; e.preventDefault();
      L.lapi("author-apply", { title: $("#auT", v).value, bio: $("#auBio", v).value, topics: $("#auTp", v).value }).then(function () { toast("Author profile saved"); L.route(); }, function (er) { toast(er.message); });
    });
  };

  /* ---------- help & support: requests ---------- */
  var oldSupport = V.support, oldSupportAfter = V.support.after;
  V.support = function () {
    return oldSupport().replace('<div class="card faq"', '<form class="card pad" id="tkF" style="margin-top:18px"><h2 style="font-size:16px;margin:0 0 4px">Send us a request</h2><p class="small muted" style="margin:0 0 14px">We reply on WhatsApp or here within working hours.</p><div class="form"><div class="field"><label class="f" for="tkT">Topic</label><select id="tkT">' +
      ["Classes & schedule", "Assignments", "Examinations", "Fees & payments", "Certificate", "Placement", "Technical problem", "Other"].map(function (t) { return "<option>" + t + "</option>"; }).join("") + '</select></div><div class="field full"><label class="f" for="tkM">Your message</label><textarea id="tkM" placeholder="Tell us what you need help with"></textarea></div></div><button class="btn pri" type="submit" style="margin-top:14px">Send request</button></form><div id="tkL"></div><div class="card faq"');
  };
  V.support.after = function (v) {
    if (oldSupportAfter) oldSupportAfter(v);
    function list() { L.lapi("tickets").then(function (t) { $("#tkL", v).innerHTML = t.length ? '<div class="card" style="margin-top:18px"><div class="card-h"><h2>Your requests</h2></div>' + t.map(function (x) { return '<div class="tk"><div><h4>' + esc(x.topic) + " · " + when(x.at) + "</h4><p>" + esc(x.message) + "</p>" + (x.reply ? '<div class="fb" style="background:#ECFDF5;color:#065F46"><b>eBuddha:</b> ' + esc(x.reply) + "</div>" : "") + '</div><div class="act"><span class="chip ' + (x.status === "open" ? "amber" : "green") + '">' + (x.status === "open" ? "Open" : "Resolved") + "</span></div></div>"; }).join("") + "</div>" : ""; }, function () {}); }
    $("#tkF", v).addEventListener("submit", function (e) {
      e.preventDefault(); L.lapi("ticket", { topic: $("#tkT", v).value, message: $("#tkM", v).value }).then(function () { toast("Request sent. We'll get back to you soon."); $("#tkM", v).value = ""; list(); }, function (er) { toast(er.message); });
    });
    list();
  };
})();
