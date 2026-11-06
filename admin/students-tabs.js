/* Admin › Students tabs: practical assignments (by module), review queue +
   module status + author approvals, posted jobs, support requests.
   Server: api/_lib/learn.js (admin routes learner-*). */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc;
  var when = function (t) { return t ? new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–"; };
  var fail = function (box) { return function (e) { box.innerHTML = '<div class="card empty">' + (/Unknown/.test(e.message) ? "This needs the local admin panel (node admin/server.js) until private storage is set up online." : esc(e.message)) + "</div>"; }; };

  EB.studentsTab = function (main, tab, chips) {
    var T = { tasks: ["Practical assignments", "Add every assignment and choose its module. Students see only their current module's assignments (5 at a time); the rest unlock as modules are completed."],
      review: ["Review", "Mark submissions Completed, Rework or Denied (−2 points until resubmitted and completed). Tick modules as students finish them."],
      jobs: ["Jobs", "Jobs posted from the Hire From Us page go live in the learner panel straight away. Hide or delete anything that doesn't belong."],
      support: ["Support requests", "Requests students send from Help & support."] }[tab];
    main.innerHTML = EB.head(T[0], T[1], tab === "tasks" ? '<button class="btn primary" id="tkSave">Save assignments</button>' : "") + chips + '<div id="sx"><p class="u">Loading…</p></div>';
    ({ tasks: tasks, review: review, jobs: jobs, support: support })[tab]($("#sx"));
  };

  /* ---------- assignments ---------- */
  function tasks(box) {
    EB.get("learner-tasks").then(function (d) {
      var C = d.courses, list = d.tasks;
      function mods(course) { var c = C.filter(function (x) { return x.name === course; })[0] || C[0] || { modules: [] }; return c.modules; }
      function row(t, i) {
        return '<div class="card" data-i="' + i + '" style="margin-bottom:10px"><div class="grid2"><div><label class="f">Assignment ' + (i + 1) + '</label><input type="text" data-k="title" value="' + esc(t.title || "") + '" placeholder="e.g. Google Ads search campaign plan"></div>' +
          '<div class="grid2"><div><label class="f">Course</label><select data-k="course">' + C.map(function (c) { return "<option" + (c.name === t.course ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + '</select></div><div><label class="f">Module</label><select data-k="module">' +
          mods(t.course).map(function (m, j) { return '<option value="' + j + '"' + (+t.module === j ? " selected" : "") + ">" + (j + 1) + ". " + esc(m) + "</option>"; }).join("") + "</select></div></div></div>" +
          '<label class="f" style="margin-top:10px">Brief (what the student must do)</label><textarea data-k="brief" rows="2">' + esc(t.brief || "") + '</textarea><div class="row" style="margin-top:8px"><label class="f" style="margin:0">Points</label><input type="number" data-k="points" min="1" max="100" value="' + (t.points || 10) + '" style="width:80px"><span style="flex:1"></span><button class="btn sm" data-up="' + i + '">↑</button><button class="btn sm danger" data-rm="' + i + '">' + EB.ic("trash") + "</button></div></div>";
      }
      function read() { $$("[data-i]", box).forEach(function (c) { var t = list[+c.getAttribute("data-i")]; $$("[data-k]", c).forEach(function (f) { t[f.getAttribute("data-k")] = f.value; }); }); }
      function draw() { box.innerHTML = (C.length ? "" : '<div class="card empty">Add a course with modules in Learner dashboard first.</div>') + '<p class="hint">' + list.length + " assignments</p>" + list.map(row).join("") + '<button class="btn" id="tkAdd">' + EB.ic("plus") + "Add assignment</button>"; }
      box.onclick = function (e) {
        var b = e.target.closest("[data-rm],[data-up],#tkAdd"); if (!b) return; read();
        if (b.id === "tkAdd") list.push({ title: "", course: (C[0] || {}).name || "", module: 0, points: 10, brief: "" });
        else if (b.hasAttribute("data-rm")) list.splice(+b.getAttribute("data-rm"), 1);
        else { var i = +b.getAttribute("data-up"); if (i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]); }
        draw();
      };
      box.onchange = function (e) { if (e.target.getAttribute("data-k") === "course") { read(); draw(); } };
      $("#tkSave").onclick = function () { read(); EB.post("learner-tasks", { tasks: list }).then(function (r) { EB.toast("Saved " + r.count + " assignments"); }).catch(EB.fail); };
      draw();
    }).catch(fail(box));
  }

  /* ---------- review ---------- */
  function review(box) {
    EB.get("learner-rv-list").then(function (d) {
      box.innerHTML = '<h3 style="margin:4px 0 10px">Waiting for review (' + d.queue.length + ')</h3><div class="card tw"><table class="tbl"><thead><tr><th>Assignment</th><th>Student</th><th>Submitted</th><th></th></tr></thead><tbody>' +
        (d.queue.map(function (x, i) { return '<tr><td><div class="t">' + esc(x.title) + "</div>" + (x.note ? '<div class="u">' + esc(x.note) + "</div>" : "") + "</td><td>" + esc(x.student) + "</td><td>" + when(x.at) + (x.n > 1 ? " · try " + x.n : "") + '</td><td class="acts"><a class="btn sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">Open</a><button class="btn sm primary" data-q="' + i + '">Review</button></td></tr>'; }).join("") || '<tr><td colspan="4" class="empty">Nothing waiting.</td></tr>') + "</tbody></table></div>" +
        '<h3 style="margin:22px 0 10px">Students</h3>' + (d.students.map(function (s) {
          return '<div class="card" style="margin-bottom:10px"><div class="row"><b>' + esc(s.name) + '</b><span class="u">' + esc(s.phone) + " · " + esc(s.course) + '</span><span style="flex:1"></span><span class="badge blue" style="text-transform:none">Overall ' + s.perf.overall + "%</span></div>" +
            '<p class="hint" style="margin:6px 0">Assignments ' + s.perf.assignments.pct + "% · Exams " + s.perf.exams.pct + "% · Modules " + s.perf.modules.pct + "% · Reading " + s.perf.reading.pct + "%" + (s.perf.assignments.penalty ? " · −" + s.perf.assignments.penalty + " pts" : "") + "</p>" +
            '<div style="display:flex;flex-wrap:wrap;gap:6px 16px">' + s.modules.map(function (m, i) { return '<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" data-m="' + s.id + '" data-mi="' + i + '"' + (s.mods.indexOf(i) > -1 ? " checked" : "") + "> " + (i + 1) + ". " + esc(m) + "</label>"; }).join("") + "</div>" +
            (s.author ? '<div class="row" style="margin-top:8px"><span class="badge ' + (s.author.status === "approved" ? "green" : "amber") + '" style="text-transform:none">Author: ' + (s.author.status === "approved" ? "approved" : "waiting") + '</span><span class="u">' + esc(s.author.title) + '</span><button class="btn sm" data-au="' + s.id + '" data-v="' + (s.author.status === "approved" ? 0 : 1) + '">' + (s.author.status === "approved" ? "Remove approval" : "Approve author") + "</button></div>" : "") + "</div>";
        }).join("") || '<div class="card empty">No students yet.</div>');
      box.onclick = function (e) {
        var q = e.target.closest("[data-q]"), a = e.target.closest("[data-au]");
        if (a) return EB.post("learner-rv-author", { sid: a.getAttribute("data-au"), approve: a.getAttribute("data-v") === "1" }).then(function () { EB.toast("Saved"); review(box); }).catch(EB.fail);
        if (!q) return; var x = d.queue[+q.getAttribute("data-q")];
        var go = function (st) { return function (close, bd) { return EB.post("learner-rv-review", { sid: x.sid, task: x.task, status: st, fb: $("#rvF", bd).value }).then(function () { EB.toast("Marked " + st); review(box); }); }; };
        EB.modal({ title: x.title, body: '<p>' + esc(x.student) + ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">open the work</a></p><label class="f">Feedback for the student</label><textarea id="rvF" rows="3"></textarea>',
          actions: [{ label: "Cancel" }, { label: "Denied (−2)", danger: true, run: go("denied") }, { label: "Rework", run: go("rework") }, { label: "Completed", primary: true, run: go("completed") }] });
      };
      box.onchange = function (e) {
        var c = e.target.closest("[data-m]"); if (!c) return;
        EB.post("learner-rv-module", { sid: c.getAttribute("data-m"), idx: +c.getAttribute("data-mi"), done: c.checked }).then(function () { EB.toast(c.checked ? "Module complete" : "Module reopened"); }).catch(function (er) { c.checked = !c.checked; EB.fail(er); });
      };
    }).catch(fail(box));
  }

  /* ---------- jobs ---------- */
  function jobs(box) {
    EB.get("learner-jobs").then(function draw(list) {
      box.innerHTML = '<div class="card tw"><table class="tbl"><thead><tr><th>Role</th><th>Company</th><th>Contact</th><th>Posted</th><th>Status</th><th></th></tr></thead><tbody>' + (list.map(function (j) {
        return '<tr><td><div class="t">' + esc(j.role) + '</div><div class="u">' + esc(j.location) + " · " + esc(j.type) + (j.salary ? " · " + esc(j.salary) : "") + "</div></td><td>" + esc(j.company) + "</td><td>" + esc(j.contact) + '<div class="u">' + esc(j.phone) + " " + esc(j.email || "") + "</div></td><td>" + when(j.at) + '</td><td><span class="badge ' + (j.status === "live" ? "green" : "") + '">' + j.status + '</span></td><td class="acts"><button class="btn sm" data-j="' + j.id + '" data-s="' + (j.status === "live" ? "hidden" : "live") + '">' + (j.status === "live" ? "Hide" : "Show") + '</button><button class="btn sm danger" data-jd="' + j.id + '">' + EB.ic("trash") + "</button></td></tr>";
      }).join("") || '<tr><td colspan="6" class="empty">No jobs posted yet. Companies post from ebuddha.in/hire-from-us#post-job.</td></tr>') + "</tbody></table></div>";
      box.onclick = function (e) {
        var b = e.target.closest("[data-j],[data-jd]"); if (!b) return;
        var body = b.hasAttribute("data-jd") ? { id: b.getAttribute("data-jd"), remove: true } : { id: b.getAttribute("data-j"), status: b.getAttribute("data-s") };
        EB.post("learner-jobs", body).then(draw).catch(EB.fail);
      };
    }).catch(fail(box));
  }

  /* ---------- support ---------- */
  function support(box) {
    EB.get("learner-tickets").then(function draw(list) {
      box.innerHTML = '<div class="card tw"><table class="tbl"><thead><tr><th>Request</th><th>Student</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>' + (list.map(function (t) {
        return '<tr><td><div class="t">' + esc(t.topic) + '</div><div class="u" style="white-space:normal">' + esc(t.message) + "</div>" + (t.reply ? '<div class="u">Reply: ' + esc(t.reply) + "</div>" : "") + "</td><td>" + esc(t.name) + '<div class="u"><a href="https://wa.me/91' + esc(t.phone) + '" target="_blank" rel="noopener">' + esc(t.phone) + "</a></div></td><td>" + when(t.at) + '</td><td><span class="badge ' + (t.status === "open" ? "amber" : "green") + '">' + t.status + '</span></td><td class="acts"><button class="btn sm' + (t.status === "open" ? " primary" : "") + '" data-t="' + t.id + '">' + (t.status === "open" ? "Reply & close" : "Reopen") + "</button></td></tr>";
      }).join("") || '<tr><td colspan="5" class="empty">No requests yet.</td></tr>') + "</tbody></table></div>";
      box.onclick = function (e) {
        var b = e.target.closest("[data-t]"); if (!b) return; var t = list.filter(function (x) { return x.id === b.getAttribute("data-t"); })[0];
        if (t.status !== "open") return EB.post("learner-tickets", { id: t.id, status: "open" }).then(draw).catch(EB.fail);
        EB.modal({ title: t.topic, body: "<p>" + esc(t.message) + '</p><label class="f">Reply (the student sees it in Help & support)</label><textarea id="tkR" rows="3"></textarea>',
          actions: [{ label: "Cancel" }, { label: "Close request", primary: true, run: function (close, bd) { return EB.post("learner-tickets", { id: t.id, status: "closed", reply: $("#tkR", bd).value }).then(draw); } }] });
      };
    }).catch(fail(box));
  }
})();
