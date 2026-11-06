/* Admin screen for student accounts: add an enrolled student (mobile number +
   PIN), reset a PIN, see the profile each student completed. Server code:
   api/_lib/learner.js. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, esc = EB.esc;
  function when(t) { return t ? new Date(t).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "–"; }
  function pinBox(name, phone, pin) {
    return '<p>Share this PIN with <b>' + esc(name || phone) + '</b>. It is shown only now; you can reset it any time.</p>' +
      '<div style="font:700 30px/1.2 ui-monospace,monospace;letter-spacing:.2em;text-align:center;padding:16px;border:1px dashed var(--line,#ccd);border-radius:12px;margin:10px 0">' + esc(pin) + '</div>' +
      '<p class="hint">Login: ebuddha.in/dashboard · Mobile: ' + esc(phone) + "</p>";
  }

  var TABS = [["list", "Students & teachers"], ["tasks", "Assignments"], ["review", "Review"], ["jobs", "Jobs"], ["support", "Support"]];
  EB.routes.students = function (main, params) {
    var tab = params && params.get("tab") || "list";
    var chips = '<div class="chips" style="margin-bottom:14px">' + TABS.map(function (t) { return '<a class="chip' + (t[0] === tab ? " on" : "") + '" href="#/students?tab=' + t[0] + '" style="text-decoration:none">' + t[1] + "</a>"; }).join("") + "</div>";
    if (tab !== "list") return EB.studentsTab(main, tab, chips);
    main.innerHTML = EB.head("Students", "Only students you add here can log in to the learner panel, with their mobile number and a 6-digit PIN. They must complete their profile before using the panel.", '<button class="btn primary" id="sAdd">' + EB.ic("plus") + "Add student</button>") + chips +
      '<div class="card tw"><table class="tbl"><thead><tr><th>Student</th><th>Mobile</th><th>Course</th><th>Profile</th><th>Last login</th><th></th></tr></thead><tbody id="sl"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody></table></div>';
    $("#sAdd").onclick = add;
    load();
  }

  var LIST = [];
  function load() {
    EB.get("learner-list").then(function (d) {
      LIST = d;
      $("#sl").innerHTML = d.length ? d.map(function (s) {
        return "<tr><td><div class=\"t\">" + esc(s.name || "New student") + (s.role === "teacher" ? ' <span class="badge blue">Teacher</span>' : "") + "</div></td><td>" + esc(s.phone) + "</td><td>" + esc(s.course || "–") + "</td><td>" +
          (s.profileDone ? '<span class="badge green">Complete</span>' : '<span class="badge amber">Pending</span>') + "</td><td>" + when(s.lastLogin) + "</td>" +
          '<td class="acts"><button class="btn sm" data-v="' + s.id + '"' + (s.profileDone ? "" : " disabled") + '>Profile</button><button class="btn sm" data-p="' + s.id + '">Reset PIN</button><button class="btn sm danger" data-d="' + s.id + '">' + EB.ic("trash") + "</button></td></tr>";
      }).join("") : '<tr><td colspan="6" class="empty">No students yet. Click "Add student".</td></tr>';
    }).catch(function (e) {
      $("#sl").innerHTML = '<tr><td colspan="6" class="empty">' + (/Unknown/.test(e.message) ? "Student accounts need private storage, which isn't set up on this server yet. Use the local admin panel (node admin/server.js)." : esc(e.message)) + "</td></tr>";
    });
  }
  var find = function (id) { return LIST.filter(function (s) { return s.id === id; })[0] || {}; };

  function add() {
    EB.modal({ title: "Add student", body: '<div class="grid2"><div><label class="f">Mobile number</label><input type="tel" id="aPh" placeholder="10-digit mobile" maxlength="14"></div><div><label class="f">Name (optional)</label><input type="text" id="aNm" placeholder="As on admission"></div></div><label class="f" style="margin-top:12px">Course</label><input type="text" id="aCo" placeholder="e.g. Digital Marketing Course"><label class="f" style="margin-top:12px">Account type</label><select id="aRo"><option value="student">Student</option><option value="teacher">Teacher (reviews assignments, modules, authors)</option></select>',
      actions: [{ label: "Cancel" }, { label: "Create & show PIN", primary: true, run: function (close) {
        return EB.post("learner-add", { phone: $("#aPh").value, name: $("#aNm").value, course: $("#aCo").value, role: $("#aRo").value }).then(function (r) {
          close(); load(); EB.modal({ title: "Student added", body: pinBox(r.student.name, r.student.phone, r.pin) });
          return false;
        });
      } }] });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("#sl [data-p], #sl [data-d], #sl [data-v]"); if (!b) return;
    var id = b.getAttribute("data-p") || b.getAttribute("data-d") || b.getAttribute("data-v"), s = find(id);
    if (b.hasAttribute("data-p")) EB.confirm("Create a new PIN for " + esc(s.name || s.phone) + "? The old PIN stops working and they are logged out.", "Reset PIN").then(function (ok) {
      if (ok) EB.post("learner-pin", { id: id }).then(function (r) { EB.modal({ title: "New PIN", body: pinBox(s.name, s.phone, r.pin) }); }).catch(EB.fail);
    });
    else if (b.hasAttribute("data-d")) EB.confirm("Delete " + esc(s.name || s.phone) + "'s account, profile and photo? This cannot be undone.", "Delete", true).then(function (ok) {
      if (ok) EB.post("learner-delete", { id: id }).then(function () { EB.toast("Student deleted"); load(); }).catch(EB.fail);
    });
    else profile(s);
  });

  function profile(s) {
    var p = s.profile || {}, row = function (k, v, link) { return v ? "<tr><th style=\"text-align:left;padding:6px 12px 6px 0;white-space:nowrap\">" + k + "</th><td>" + (link ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + "</a>" : esc(v)) + "</td></tr>" : ""; };
    EB.modal({ title: s.name || "Student", wide: true,
      body: '<div style="display:flex;gap:20px;flex-wrap:wrap"><img src="' + EB.url("learner-photo", { id: s.id }) + '" alt="" style="width:140px;height:140px;object-fit:cover;border-radius:14px;background:#eef"><table style="flex:1;min-width:260px">' +
        row("Mobile", s.phone) + row("WhatsApp", p.whatsapp) + row("Email", p.email) + row("Course", s.course) + row("Purpose", p.purpose + (p.purposeNote ? " · " + p.purposeNote : "")) +
        row("Current address", p.currentAddress) + row("Permanent address", p.permanentAddress) + row("LinkedIn", p.linkedin, 1) + row("Instagram", p.instagram, 1) + row("Completed", when(s.profileAt)) + "</table></div>",
      actions: [{ label: "Ask to update profile", run: function () { return EB.post("learner-update", { id: s.id, reopenProfile: true }).then(function () { EB.toast("They must update their profile at next visit"); load(); }); } }, { label: "Close", primary: true }] });
  }
})();
