/* Admin screen for the learner dashboard (/dashboard). Everything the
   dashboard shows (courses, live classes, assignments, announcements,
   resources, jobs, to-dos, alumni and support settings) lives in
   dashboard/data.json; this screen edits it with forms instead of raw JSON. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc, ic = EB.ic;
  var P = "dashboard/data.json";

  /* field: [key, label, type, required, extra]
     types: text, textarea, number, date, time, url, select, lines, image, file, course */
  var LISTS = [
    { key: "courses", label: "Courses", one: "course", title: "name",
      sub: function (c) { return (+c.p || 0) + "% complete · " + (c.tag || "") + (c.mentor ? " · " + c.mentor : ""); },
      fields: [["name", "Course name", "text", true], ["tag", "Category tag", "text"], ["url", "Course page link", "text", false, { ph: "/digital-marketing-course" }], ["p", "Progress (%)", "number", false, { min: 0, max: 100 }],
        ["lessons", "Total lessons", "number", false, { min: 0 }], ["mentor", "Mentor", "text"], ["nextLesson", "Next lesson", "text", false, { ph: "Module 4 · Email automation" }],
        ["modules", "Modules (one per line)", "lines"], ["certificateUrl", "Certificate link (shown at 100%)", "text", false, { ph: "/verify-certificate" }]] },
    { key: "live", label: "Live classes", one: "class", title: "title",
      sub: function (l) { return (l.date || "") + " · " + (l.time || "") + " IST · " + (l.duration || 60) + " min" + (l.mentor ? " · " + l.mentor : ""); }, sort: function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); },
      fields: [["title", "Class title", "text", true], ["date", "Date", "date", true], ["time", "Start time (India time)", "time", true], ["duration", "Duration (minutes)", "number", false, { min: 15 }],
        ["course", "Course", "course"], ["mentor", "Mentor", "text"], ["link", "Join link (Zoom, Google Meet…)", "url"], ["recording", "Recording link (after the class)", "url"]] },
    { key: "assignments", label: "Assignments", one: "assignment", title: "title",
      sub: function (a) { return "Due " + (a.due || "—") + " · " + (a.status || "pending") + (a.score ? " · " + a.score : ""); },
      fields: [["title", "Assignment title", "text", true], ["course", "Course", "course"], ["due", "Due date", "date", true], ["status", "Status", "select", false, { options: [["pending", "Pending"], ["submitted", "Submitted"], ["graded", "Graded"]] }],
        ["score", "Score / grade", "text", false, { ph: "e.g. 92/100" }], ["submitUrl", "Submission link (Google Form, Drive…)", "url"], ["brief", "Brief", "textarea"]] },
    { key: "announcements", label: "Announcements", one: "announcement", title: "title",
      sub: function (a) { return (a.date || "") + " · " + (a.type || "info"); },
      fields: [["title", "Title", "text", true], ["body", "Message", "textarea", true], ["date", "Date", "date"], ["type", "Type", "select", false, { options: [["info", "Update"], ["event", "Event"], ["important", "Important"]] }]] },
    { key: "resources", label: "Resources", one: "resource", title: "title",
      sub: function (r) { return (r.type || "") + " · " + (r.course || ""); },
      fields: [["title", "Title", "text", true], ["type", "Type", "select", false, { options: [["PDF", "PDF"], ["Template", "Template"], ["Guide", "Guide"], ["Article", "Article"], ["Video", "Video"], ["Link", "Link"]] }],
        ["course", "Course", "course"], ["url", "Link or file", "file", true]] },
    { key: "jobs", label: "Jobs", one: "job", title: "role",
      sub: function (j) { return (j.company || "") + " · " + (j.location || "") + " · " + (j.type || ""); },
      fields: [["role", "Role", "text", true], ["company", "Company", "text"], ["location", "Location", "text", false, { ph: "Bhopal · On-site" }],
        ["type", "Type", "select", false, { options: [["Full-time", "Full-time"], ["Part-time", "Part-time"], ["Internship", "Internship"], ["Freelance", "Freelance"], ["Contract", "Contract"]] }],
        ["posted", "Posted on", "date"], ["url", "Apply link", "text", false, { ph: "/hire-from-us or https://…" }]] },
    { key: "tasks", label: "To-dos", one: "to-do", title: "t", sub: function () { return "Weekly to-do for every learner"; }, fields: [["t", "To-do", "text", true]] },
    { key: "alumni", label: "Alumni", one: "alumni story", title: "name", sub: function (a) { return a.role || ""; },
      fields: [["name", "Name", "text", true], ["role", "Placed at / role", "text"], ["image", "Photo", "image"]] }
  ];
  var SETTINGS = [["weeklyGoalHours", "Weekly study goal (hours)", "number"], ["maxPosts", "Blog posts shown", "number"], ["supportPhone", "Support phone", "text", false, { ph: "+91…" }],
    ["supportWhatsapp", "WhatsApp number (digits only, with country code)", "text", false, { ph: "918461958162" }], ["supportEmail", "Support email", "text"], ["supportHours", "Support hours", "text"], ["referralReward", "Referral reward text", "textarea"]];

  EB.routes.learner = function (main, params) {
    var tab = params.get("tab") || "courses", data, dirty = false;
    main.innerHTML = EB.head("Learner dashboard", "Manage what every learner sees on <a href='/dashboard/' target='_blank'>/dashboard</a>.",
      '<span class="u" id="lst"></span><a class="btn" href="/dashboard/" target="_blank">' + ic("ext") + 'Preview</a><button class="btn primary" id="lsv" disabled>Save changes</button>') +
      '<div class="chips" id="ltabs" style="margin-bottom:14px"></div><div id="lbody"><div class="card empty">Loading…</div></div>';

    function setDirty(v) { dirty = v; EB.setDirty(v); $("#lsv").disabled = !v; $("#lst").innerHTML = v ? '<span class="dot"></span>Unsaved changes' : ""; }
    function tabs() {
      var t = LISTS.map(function (l) { return [l.key, l.label + " (" + (data[l.key] || []).length + ")"]; }).concat([["settings", "Support & settings"], ["json", "Advanced (JSON)"]]);
      $("#ltabs").innerHTML = t.map(function (x) { return '<button class="chip' + (x[0] === tab ? " on" : "") + '" data-tab="' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("");
    }
    function courseNames() { return (data.courses || []).map(function (c) { return c.name; }).concat(["All learners"]); }

    function draw() {
      tabs();
      var body = $("#lbody");
      if (tab === "settings") return drawSettings(body);
      if (tab === "json") return drawJson(body);
      var L = LISTS.filter(function (l) { return l.key === tab; })[0] || LISTS[0];
      var items = data[L.key] = data[L.key] || [];
      body.innerHTML = '<div class="card tw"><div class="row" style="padding:14px 16px;border-bottom:1px solid var(--line)"><b>' + esc(L.label) + '</b><span class="u">Drag rows to change the order learners see.</span><div class="spacer"></div>' +
        (L.sort ? '<button class="btn sm" id="lsort">Sort by date</button>' : "") + '<button class="btn sm primary" id="ladd">' + ic("plus") + "Add " + esc(L.one) + "</button></div>" +
        '<table class="tbl"><tbody id="lrows">' + (items.map(function (it, i) {
          return '<tr draggable="true" data-i="' + i + '"><td style="width:28px;color:var(--muted);cursor:grab" aria-hidden="true">⠿</td><td><div class="t">' + esc(it[L.title] || "(untitled)") + '</div><div class="u">' + esc(L.sub(it)) + '</div></td>' +
            '<td class="acts"><button class="btn sm" data-edit="' + i + '">Edit</button> <button class="btn sm" data-dup="' + i + '">Duplicate</button> <button class="btn sm danger" data-del="' + i + '" aria-label="Delete">' + ic("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="3" class="empty">Nothing here yet. Click “Add ' + esc(L.one) + '”.</td></tr>') + "</tbody></table></div>";

      $("#ladd").onclick = function () { edit(L, null); };
      if ($("#lsort")) $("#lsort").onclick = function () { items.sort(L.sort); setDirty(true); draw(); };
      var rows = $("#lrows"), from = null;
      rows.onclick = function (e) {
        var b;
        if ((b = e.target.closest("[data-edit]"))) edit(L, +b.getAttribute("data-edit"));
        else if ((b = e.target.closest("[data-dup]"))) { var c = JSON.parse(JSON.stringify(items[+b.getAttribute("data-dup")])); if ("id" in c || L.key !== "alumni") c.id = newId(L.key); items.splice(+b.getAttribute("data-dup") + 1, 0, c); setDirty(true); draw(); }
        else if ((b = e.target.closest("[data-del]"))) {
          var i = +b.getAttribute("data-del");
          EB.confirm("Delete <b>" + esc(items[i][L.title] || "this item") + "</b>?", "Delete", true).then(function (ok) { if (ok) { items.splice(i, 1); setDirty(true); draw(); } });
        }
      };
      rows.ondragstart = function (e) { var tr = e.target.closest("tr[data-i]"); if (!tr) return; from = +tr.getAttribute("data-i"); tr.style.opacity = ".4"; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(from)); };
      rows.ondragover = function (e) {
        var tr = e.target.closest("tr[data-i]"); if (!tr || from === null) return; e.preventDefault();
        $$("tr", rows).forEach(function (r) { r.style.boxShadow = ""; });
        var r = tr.getBoundingClientRect(); tr.style.boxShadow = e.clientY < r.top + r.height / 2 ? "inset 0 3px 0 #16A34A" : "inset 0 -3px 0 #16A34A";
      };
      rows.ondrop = function (e) {
        var tr = e.target.closest("tr[data-i]"); if (!tr || from === null) return; e.preventDefault();
        var to = +tr.getAttribute("data-i"), r = tr.getBoundingClientRect(), after = e.clientY >= r.top + r.height / 2;
        var it = items.splice(from, 1)[0]; if (from < to) to--; items.splice(after ? to + 1 : to, 0, it);
        from = null; setDirty(true); draw();
      };
      rows.ondragend = function () { from = null; $$("tr", rows).forEach(function (r) { r.style.opacity = ""; r.style.boxShadow = ""; }); };
    }

    function newId(k) { return k.slice(0, 2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

    function fieldHtml(f, v) {
      var k = f[0], label = f[1], type = f[2], req = f[3], x = f[4] || {}, id = "fld-" + k;
      var lab = '<label class="f" for="' + id + '">' + esc(label) + (req ? " *" : "") + "</label>";
      var ph = x.ph ? ' placeholder="' + esc(x.ph) + '"' : "";
      if (type === "textarea") return lab + '<textarea id="' + id + '" data-k="' + k + '" rows="3"' + ph + ">" + esc(v || "") + "</textarea>";
      if (type === "lines") return lab + '<textarea id="' + id + '" data-k="' + k + '" rows="6" placeholder="One per line">' + esc((v || []).join("\n")) + "</textarea>";
      if (type === "select") return lab + '<select id="' + id + '" data-k="' + k + '">' + x.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
      if (type === "course") return lab + '<input type="text" id="' + id + '" data-k="' + k + '" list="dl-courses" value="' + esc(v || "") + '">';
      if (type === "image" || type === "file") return lab + '<div class="row" style="flex-wrap:nowrap"><input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v || "") + '"' + (type === "file" ? ' placeholder="/resources or https://…"' : "") + '>' +
        (type === "image" ? '<button type="button" class="btn sm" data-pick="' + k + '">Choose</button>' : '<label class="btn sm">' + ic("upload") + 'Upload<input type="file" hidden data-up="' + k + '" accept=".pdf,image/*,video/mp4"></label>') + "</div>";
      var t = { number: "number", date: "date", time: "time", url: "url" }[type] || "text";
      return lab + '<input type="' + t + '" id="' + id + '" data-k="' + k + '" value="' + esc(v == null ? "" : v) + '"' + ph + (x.min != null ? ' min="' + x.min + '"' : "") + (x.max != null ? ' max="' + x.max + '"' : "") + ">";
    }
    function readFields(fields, bd, target) {
      fields.forEach(function (f) {
        var el = $('[data-k="' + f[0] + '"]', bd), v = el.value.trim();
        if (f[2] === "lines") v = v.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        else if (f[2] === "number") v = v === "" ? "" : Math.max(f[4] && f[4].min != null ? f[4].min : -Infinity, Math.min(f[4] && f[4].max != null ? f[4].max : Infinity, +v));
        target[f[0]] = v;
      });
      return target;
    }
    function bindPickers(bd) {
      bd.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pick]"); if (!b) return;
        EB.pickMedia().then(function (u) { if (u) $('[data-k="' + b.getAttribute("data-pick") + '"]', bd).value = u; });
      });
      bd.addEventListener("change", function (e) {
        var u = e.target.closest("[data-up]"); if (!u || !u.files[0]) return;
        EB.toast("Uploading…");
        EB.upload(u.files[0], "images/uploads/resources").then(function (r) { $('[data-k="' + u.getAttribute("data-up") + '"]', bd).value = r.url; EB.toast("Uploaded", "ok"); }).catch(EB.fail);
      });
    }

    function edit(L, i) {
      var isNew = i === null, item = isNew ? {} : data[L.key][i];
      var body = '<datalist id="dl-courses">' + courseNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" + L.fields.map(function (f) { return fieldHtml(f, item[f[0]]); }).join("");
      var m = EB.modal({ title: (isNew ? "Add " : "Edit ") + L.one, body: body, actions: [{ label: "Cancel" }, { label: isNew ? "Add" : "Done", primary: true, run: function (close, bd) {
        var missing = L.fields.filter(function (f) { return f[3] && !$('[data-k="' + f[0] + '"]', bd).value.trim(); }).map(function (f) { return f[1]; });
        if (missing.length) throw new Error("Please fill in: " + missing.join(", "));
        var out = readFields(L.fields, bd, isNew ? {} : item);
        if (isNew) { if (L.key !== "alumni") out.id = newId(L.key); if (L.key === "live" && !out.duration) out.duration = 60; if (L.key === "assignments" && !out.status) out.status = "pending"; data[L.key].push(out); }
        setDirty(true); draw();
      } }] });
      bindPickers(m.body);
    }

    function drawSettings(body) {
      var s = data.settings = data.settings || {};
      body.innerHTML = '<div class="card" style="max-width:720px"><h2>Support & settings</h2><p class="hint">Used on the Help & support, Refer & earn and Overview pages of the learner dashboard.</p><div id="sf">' + SETTINGS.map(function (f) { return fieldHtml(f, s[f[0]]); }).join("") + "</div></div>";
      $("#sf").addEventListener("input", function () { readFields(SETTINGS, $("#sf"), s); setDirty(true); });
    }
    function drawJson(body) {
      body.innerHTML = '<div class="card"><p class="hint" style="margin:0 0 10px">The raw data file, for bulk edits. Changes here replace everything above when you click “Apply”.</p><div id="lx"></div><div class="row" style="margin-top:10px"><button class="btn" id="lj">Apply JSON</button></div></div>';
      var ed = EB.code($("#lx"), JSON.stringify(data, null, 2), "json");
      $("#lj").onclick = function () {
        try { data = JSON.parse(ed.get()); } catch (e) { return EB.toast("Not valid JSON: " + e.message, "err"); }
        setDirty(true); EB.toast("Applied. Click “Save changes” to publish.", "ok"); tabs();
      };
    }

    $("#ltabs").onclick = function (e) { var b = e.target.closest("[data-tab]"); if (!b) return; tab = b.getAttribute("data-tab"); draw(); };
    $("#lsv").onclick = function () {
      $("#lsv").disabled = true;
      EB.writeFile(P, JSON.stringify(data, null, 2) + "\n", false, "Admin: edit learner dashboard").then(function () { setDirty(false); EB.toast("Learner dashboard saved", "ok"); })
        .catch(function (e) { $("#lsv").disabled = false; EB.fail(e); });
    };
    return EB.readFile(P).then(function (t) { data = JSON.parse(t); draw(); });
  };
})();
