/* Admin screen for the 8 examination papers: create a paper and upload its
   PDF, create one password per student, and see each student's work. The
   server code is api/_lib/exam.js. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, $$ = EB.$$, esc = EB.esc, ic = EB.ic;
  var KINDS = [["image", "Images & photos"], ["video", "Videos"], ["pdf", "PDFs"]];
  var STATUS = {
    unused: ["", "Not used yet"], active: ["blue", "In exam"], submitted: ["green", "Submitted"], timed_out: ["amber", "Time ended"]
  };
  function statusBadge(s) { var b = STATUS[s] || STATUS.unused; return '<span class="badge ' + b[0] + '" style="text-transform:none">' + b[1] + "</span>"; }
  /* Whether students can see a paper: [state, short label, full explanation]. */
  function visibility(open, hasContent) {
    if (!open) return ["hidden", "Hidden from students", "Students can't see this paper. Tick \"Open to students\" and save to release it."];
    if (!hasContent) return ["waiting", "Waiting for questions", "Students will see this paper once it has questions or a PDF."];
    return ["ok", "Open to students", "Students can see this paper now. They still need a password from the Passwords tab to enter it."];
  }
  function visibilityNote(open, hasContent) {
    var v = visibility(open, hasContent);
    return '<div class="card" role="status" style="border-left:4px solid var(--' + (v[0] === "ok" ? "green" : "amber") + ')"><div class="row" style="flex-wrap:wrap"><span class="badge ' + (v[0] === "ok" ? "green" : "amber") + '" style="text-transform:none">' + v[1] + '</span><span class="hint" style="margin:0">' + esc(v[2]) + "</span></div></div>";
  }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function when(t) { return t ? new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–"; }
  function defaultSections() {
    return [
      { name: "Answer sheet photos", instructions: "Write your answers on paper, then take a clear photo of every page.", accept: ["image"], required: true, maxFiles: 20 },
      { name: "Banners", instructions: "", accept: ["image"], required: false, maxFiles: 20 },
      { name: "Images", instructions: "", accept: ["image"], required: false, maxFiles: 20 },
      { name: "Videos", instructions: "", accept: ["video"], required: false, maxFiles: 10 }
    ];
  }

  /* ================= question editor (exam papers and practice quizzes) ================= */
  var uid = 0;
  /* Reads pasted text like:
       1. What is SEO?
       A) First option
       B) Second option
       Answer: B
       Explanation: optional */
  function parseQuestions(text) {
    var out = [], cur = null;
    function close() {
      if (!cur) return;
      if (cur.options.length < 2 || cur.answer < 0) throw new Error("Couldn't read this question. It needs at least 2 options and an Answer line: " + cur.q.slice(0, 70));
      out.push(cur); cur = null;
    }
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) return;
      if (cur && (m = /^(?:answer|ans|correct(?: answer)?)\s*[:\-]\s*\(?([a-d])\)?/i.exec(line))) { cur.answer = "abcd".indexOf(m[1].toLowerCase()); return; }
      if (cur && (m = /^(?:explanation|explain)\s*[:\-]\s*(.+)$/i.exec(line))) { cur.explain = m[1]; return; }
      if (cur && (m = /^\(?([a-d])[\).:]\s*(.+)$/i.exec(line))) { cur.options["abcd".indexOf(m[1].toLowerCase())] = m[2]; return; }
      close();
      cur = { q: line.replace(/^(?:q(?:uestion)?\s*)?\d+\s*[.):\-]\s*/i, ""), options: [], answer: -1, explain: "" };
    });
    close();
    return out;
  }
  function questionRow(q) {
    var name = "qa" + (++uid), opts = q.options || [];
    return '<div class="card" data-q data-id="' + esc(q.id || "") + '" style="margin-bottom:10px"><div class="row"><b data-no></b><div class="spacer"></div><button type="button" class="btn sm danger" data-xq aria-label="Remove question">' + ic("trash") + "</button></div>" +
      '<label class="f">Question</label><textarea data-t rows="2">' + esc(q.q || "") + "</textarea>" +
      '<label class="f">Options (select the correct one)</label>' + [0, 1, 2, 3].map(function (k) {
        return '<div class="row" style="flex-wrap:nowrap;margin-bottom:6px"><input type="radio" name="' + name + '" data-a="' + k + '" aria-label="Option ' + "ABCD"[k] + ' is correct"' + (q.answer === k ? " checked" : "") + ' style="width:16px;height:16px;flex:none"><b style="width:16px;flex:none">' + "ABCD"[k] + '</b><input type="text" data-o value="' + esc(opts[k] || "") + '" placeholder="Option ' + "ABCD"[k] + (k > 1 ? " (optional)" : "") + '"></div>';
      }).join("") +
      '<label class="f">Explanation (optional, shown with the solution)</label><input type="text" data-e value="' + esc(q.explain || "") + '"></div>';
  }
  /* Returns { get() }, where get() checks every question and throws a readable error. */
  EB.questionEditor = function (host, questions, opts) {
    opts = opts || {};
    var exact = opts.exact;
    host.innerHTML = '<div class="row" style="margin-bottom:10px;flex-wrap:wrap"><span class="u" data-n></span><div class="spacer"></div><button type="button" class="btn sm" data-paste>Paste questions</button><button type="button" class="btn sm" data-add>' + ic("plus") + 'Add question</button></div><div data-list>' + (questions || []).map(questionRow).join("") + "</div>";
    var list = $("[data-list]", host);
    function renumber() {
      var rows = $$("[data-q]", list);
      rows.forEach(function (r, i) { $("[data-no]", r).textContent = "Question " + (i + 1); });
      $("[data-n]", host).textContent = rows.length + (exact ? " of " + exact : "") + " question" + (rows.length === 1 && !exact ? "" : "s") + (exact && rows.length !== exact ? ". Students see this quiz once it has exactly " + exact + "." : "");
    }
    list.onclick = function (e) { var b = e.target.closest("[data-xq]"); if (b) { b.closest("[data-q]").remove(); renumber(); } };
    $("[data-add]", host).onclick = function () { list.insertAdjacentHTML("beforeend", questionRow({})); renumber(); };
    $("[data-paste]", host).onclick = function () {
      EB.modal({ title: "Paste questions", wide: true, body: '<p class="hint">Paste as many as you like, in this format. The questions are added below what is already here.</p><pre class="mono" style="margin:0 0 10px;white-space:pre-wrap">1. What does SEO stand for?\nA) Search Engine Optimization\nB) Social Email Outreach\nC) Site Editing Options\nD) Sales Engine Output\nAnswer: A\nExplanation: optional</pre><textarea id="pq" rows="12"></textarea>',
        actions: [{ label: "Cancel" }, { label: "Add questions", primary: true, run: function (close, bd) {
          var found = parseQuestions($("#pq", bd).value);
          if (!found.length) throw new Error("No questions found. Check the format.");
          list.insertAdjacentHTML("beforeend", found.map(questionRow).join(""));
          renumber();
          EB.toast(found.length + " question" + (found.length === 1 ? "" : "s") + " added", "ok");
        } }] });
    };
    renumber();
    return {
      get: function () {
        return $$("[data-q]", list).map(function (r, i) {
          var label = "Question " + (i + 1) + ": ", q = $("[data-t]", r).value.trim();
          var raw = $$("[data-o]", r).map(function (x) { return x.value.trim(); });
          var a = $$("[data-a]", r).findIndex(function (x) { return x.checked; });
          if (!q) throw new Error(label + "write the question");
          if (raw.filter(Boolean).length < 2) throw new Error(label + "add at least 2 options");
          if (a < 0 || !raw[a]) throw new Error(label + "select the correct option");
          var out = { q: q, options: raw.filter(Boolean), answer: raw.slice(0, a).filter(Boolean).length };
          var id = r.getAttribute("data-id"), ex = $("[data-e]", r).value.trim();
          if (id) out.id = id;
          if (ex) out.explain = ex;
          return out;
        });
      }
    };
  };

  EB.routes.exams = function (main, params) {
    var slot = +params.get("slot");
    return slot >= 1 && slot <= 8 ? detail(main, slot, params.get("tab") || "paper") : list(main);
  };

  /* ================= the 8 papers ================= */
  function list(main) {
    main.innerHTML = EB.head("Examinations", "8 papers. Each is locked until you give a student their password, and each student gets 3 hours from the moment they enter it.") +
      '<div class="card tw"><table class="tbl"><thead><tr><th>Paper</th><th>Status</th><th>Questions</th><th>Passwords</th><th>Students</th><th></th></tr></thead><tbody id="eb"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody></table></div>';
    return EB.get("exam-list").then(function (d) {
      $("#eb").innerHTML = d.slots.map(function (s) {
        var open = "#/exams?slot=" + s.slot;
        var st = !s.exists ? '<span class="badge">Empty</span>' : '<span class="badge ' + (visibility(s.published, s.questions || s.pdf)[0] === "ok" ? "green" : "amber") + '" style="text-transform:none">' + visibility(s.published, s.questions || s.pdf)[1] + "</span>";
        return '<tr><td><div class="t"><a href="' + open + '" style="color:inherit">Paper ' + s.slot + (s.title ? ": " + esc(s.title) : "") + "</a></div></td><td>" + st + "</td><td>" + (s.exists ? s.questions : "–") + "</td>" +
          "<td>" + (s.exists ? s.passwords + (s.unused ? ' <span class="u">(' + s.unused + " unused)</span>" : "") : "–") + "</td>" +
          "<td>" + (s.exists ? s.inProgress + ' in exam · <a href="' + open + '&tab=results">' + s.finished + " finished</a>" : "–") + "</td>" +
          '<td class="acts"><a class="btn sm ' + (s.exists ? "" : "primary") + '" href="' + open + '">' + (s.exists ? "Manage" : "Create paper") + "</a></td></tr>";
      }).join("");
    }).catch(function (e) {
      /* The online admin panel has no private storage yet (see api/exam.js). */
      $("#eb").innerHTML = '<tr><td colspan="6" class="empty">' + (/Unknown request/.test(e.message) ? "Examinations need private file storage, which isn't set up on this server yet." : esc(e.message)) + "</td></tr>";
    });
  }

  /* ================= one paper ================= */
  function detail(main, slot, tab) {
    var tabs = [["paper", "Paper"], ["passwords", "Passwords"], ["results", "Results"]];
    main.innerHTML = EB.head("Paper " + slot, "", '<a class="btn" href="#/exams">All papers</a>') +
      '<div class="chips" style="margin-bottom:14px">' + tabs.map(function (t) { return '<a class="chip' + (t[0] === tab ? " on" : "") + '" href="#/exams?slot=' + slot + "&tab=" + t[0] + '" style="text-decoration:none">' + t[1] + "</a>"; }).join("") + '</div><div id="ex"><p class="u">Loading…</p></div>';
    var box = $("#ex");
    if (tab === "passwords") return passwords(box, slot);
    if (tab === "results") return results(box, slot);
    return paperForm(box, slot);
  }

  /* ---------- create / edit a paper ---------- */
  function sectionRow(s) {
    return '<div class="card" data-s data-id="' + esc(s.id || "") + '" style="margin-bottom:10px"><div class="grid2"><div><label class="f">Section name</label><input type="text" data-n value="' + esc(s.name) + '" placeholder="e.g. Social media banners"></div>' +
      '<div><label class="f">Most files allowed</label><input type="number" data-m min="1" max="50" value="' + esc(s.maxFiles || 20) + '"></div></div>' +
      '<label class="f">Task instructions (optional)</label><textarea data-i rows="2">' + esc(s.instructions || "") + "</textarea>" +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap">' + KINDS.map(function (k) { return '<label class="check" style="margin:0"><input type="checkbox" data-k="' + k[0] + '"' + (s.accept.indexOf(k[0]) > -1 ? " checked" : "") + ">" + k[1] + "</label>"; }).join("") +
      '<label class="check" style="margin:0"><input type="checkbox" data-r' + (s.required ? " checked" : "") + '>Required</label><div class="spacer"></div><button type="button" class="btn sm danger" data-x aria-label="Remove section">' + ic("trash") + "</button></div></div>";
  }
  function paperForm(box, slot) {
    return EB.get("exam-paper", { slot: slot }).then(function (d) {
      var p = d.paper, sections = p ? p.sections : [];
      var hasContent = function () { return !!(p && (p.pdf || (p.questions && p.questions.length))); };
      box.innerHTML = (p ? '<div id="evis">' + visibilityNote(p.published, hasContent()) + "</div>" : "") +
        '<div class="card"><h2>Paper details</h2><label class="f">Title</label><input type="text" id="et" maxlength="120" placeholder="e.g. Digital Marketing Practical" value="' + esc(p ? p.title : "") + '">' +
        '<label class="f">Short description (shown on the locked card)</label><textarea id="ed" rows="2" maxlength="1000">' + esc(p ? p.description : "") + "</textarea>" +
        '<label class="check" style="margin-top:12px"><input type="checkbox" id="eo"' + (!p || p.published ? " checked" : "") + '><b>Open to students</b>&nbsp;(they still need a password)</label>' +
        '<label class="check"><input type="checkbox" id="ers"' + (!p || p.showResult !== false ? " checked" : "") + '>Show students their score when they finish</label>' +
        '<label class="check"><input type="checkbox" id="esl"' + (p && p.showSolutions ? " checked" : "") + '>Also show them the correct answers. Only turn this on once every student has finished, as finished students could share them.</label></div>' +
        '<div class="card"><h2>Questions</h2><p class="hint">Students answer these one at a time, and the website marks them automatically. Students who have already started keep the version they began with.</p><div id="eqe"></div></div>' +
        '<div class="card"><h2>Question paper PDF (optional)</h2><p class="hint">Use this if the paper is a document. Students can only read it on the website, for their 3 hours. It is kept outside the website, so it has no public address.</p><div id="epf"></div></div>' +
        '<div class="card"><div class="row" style="flex-wrap:wrap"><h2 style="margin:0">Upload tasks (optional)</h2><div class="spacer"></div><button class="btn sm" id="ep">Add marketing sections</button><button class="btn sm" id="ea">' + ic("plus") + 'Add section</button></div><p class="hint">Students upload photos, banners and videos into these sections, task by task.</p><div id="es">' + sections.map(sectionRow).join("") + "</div></div>" +
        '<div class="row"><button class="btn primary" id="ev">Save paper</button><div class="spacer"></div>' + (p ? '<button class="btn danger" id="ex0">' + ic("trash") + "Delete paper and results</button>" : "") + "</div>";

      function drawPdf(paper) {
        var pdf = paper && paper.pdf;
        $("#epf", box).innerHTML = (pdf ? '<p style="margin:0 0 10px"><b>' + esc(pdf.name) + '</b> <span class="u">' + fmtSize(pdf.size) + " · uploaded " + when(pdf.at) + '</span> <a class="btn sm" target="_blank" rel="noopener" href="' + EB.url("exam-pdf", { slot: slot }) + '">Preview</a></p>' : "") +
          (paper ? '<label class="btn">' + ic("file") + (pdf ? "Replace PDF" : "Upload PDF") + '<input type="file" id="epi" accept="application/pdf,.pdf" hidden></label>' : '<p class="hint" style="margin:0">Save the paper first, then upload its PDF.</p>');
        var input = $("#epi", box);
        if (input) input.onchange = function () {
          var f = input.files[0]; if (!f) return;
          EB.toast("Uploading PDF…");
          EB.api("POST", "exam-pdf-upload", { slot: slot }, undefined, { body: f, name: f.name }).then(function (r) { p = r.paper; drawPdf(p); $("#evis", box).innerHTML = visibilityNote(p.published, hasContent()); EB.toast("PDF uploaded", "ok"); }).catch(EB.fail);
        };
      }
      drawPdf(p);
      var editor = EB.questionEditor($("#eqe", box), p ? p.questions : []);
      $("#ep", box).onclick = function () { $("#es", box).insertAdjacentHTML("beforeend", defaultSections().map(sectionRow).join("")); };

      $("#es", box).onclick = function (e) { var b = e.target.closest("[data-x]"); if (b) b.closest("[data-s]").remove(); };
      $("#ea", box).onclick = function () { $("#es", box).insertAdjacentHTML("beforeend", sectionRow({ name: "", accept: ["image"], required: false, maxFiles: 20 })); };
      $("#ev", box).onclick = function () {
        var questions;
        try { questions = editor.get(); } catch (e) { EB.fail(e); return; }
        var body = {
          slot: slot, title: $("#et", box).value, description: $("#ed", box).value, published: $("#eo", box).checked,
          questions: questions, showResult: $("#ers", box).checked, showSolutions: $("#esl", box).checked,
          sections: $$("[data-s]", box).map(function (r) {
            return { id: r.getAttribute("data-id"), name: $("[data-n]", r).value, instructions: $("[data-i]", r).value, maxFiles: $("[data-m]", r).value, required: $("[data-r]", r).checked,
              accept: $$("[data-k]", r).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-k"); }) };
          })
        };
        EB.post("exam-save", body).then(function (r) {
          var live = r.paper.published && (r.paper.pdf || r.paper.questions.length);
          EB.toast(live ? "Paper saved. Students can see it now." : "Paper saved, but students can't see it yet.", live ? "ok" : "err");
          return paperForm(box, slot);
        }).catch(EB.fail);
      };
      var del = $("#ex0", box);
      if (del) del.onclick = function () {
        EB.confirm("Delete <b>Paper " + slot + "</b>? This permanently removes the PDF, all passwords and every student's uploaded work for this paper. It can't be undone.", "Delete", true).then(function (ok) {
          if (ok) EB.post("exam-delete", { slot: slot }).then(function () { EB.toast("Paper deleted", "ok"); EB.go("exams"); }).catch(EB.fail);
        });
      };
    }).catch(function (e) { box.innerHTML = '<div class="card"><p class="hint">' + (/Unknown request/.test(e.message) ? "Examinations need private file storage, which isn't set up on this server yet." : esc(e.message)) + "</p></div>"; });
  }

  /* ---------- one password per student ---------- */
  function passwords(box, slot) {
    return EB.get("exam-codes", { slot: slot }).then(function (codes) {
      box.innerHTML = '<div class="card"><h2>Give a student access</h2><p class="hint">Each student gets their own password, usable for one attempt on this paper only. Their 3 hours start when they first enter it. Entering it again resumes the same attempt and does not reset the time.</p>' +
        '<label class="f">Student names (one per line)</label><textarea id="pn" rows="3" placeholder="Priya Sharma&#10;Rahul Verma"></textarea><div class="row" style="margin-top:10px"><button class="btn primary" id="pc">Create passwords</button></div></div>' +
        '<div class="card tw"><table class="tbl"><thead><tr><th>Student</th><th>Password</th><th>Status</th><th></th></tr></thead><tbody>' +
        (codes.length ? codes.map(function (c) {
          return "<tr><td><div class=\"t\">" + esc(c.student) + '</div></td><td><span class="mono">' + esc(c.code) + '</span></td><td>' + statusBadge(c.status) + (c.status === "active" ? ' <span class="u">until ' + when(c.deadline) + "</span>" : "") + "</td>" +
            '<td class="acts"><button class="btn sm" data-c="' + esc(c.code) + '">Copy</button> ' + (c.status === "unused" ? '<button class="btn sm danger" data-d="' + esc(c.code) + '" aria-label="Remove password for ' + esc(c.student) + '">' + ic("trash") + "</button>" : "") + "</td></tr>";
        }).join("") : '<tr><td colspan="4" class="empty">No passwords yet</td></tr>') + "</tbody></table></div>";
      $("#pc", box).onclick = function () {
        var names = $("#pn", box).value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        EB.post("exam-code-new", { slot: slot, students: names }).then(function () { EB.toast("Passwords created", "ok"); return passwords(box, slot); }).catch(EB.fail);
      };
      box.onclick = function (e) {
        var b;
        if ((b = e.target.closest("[data-c]"))) navigator.clipboard.writeText(b.getAttribute("data-c")).then(function () { EB.toast("Password copied", "ok"); }).catch(function () { EB.toast("Copy failed. Select the password instead.", "err"); });
        else if ((b = e.target.closest("[data-d]"))) EB.post("exam-code-del", { slot: slot, code: b.getAttribute("data-d") }).then(function () { return passwords(box, slot); }).catch(EB.fail);
      };
    }).catch(function (e) { box.innerHTML = '<div class="card"><p class="hint">' + esc(e.message) + "</p></div>"; });
  }

  /* ---------- what each student handed in ---------- */
  function fileCard(slot, attemptId, f) {
    var q = { slot: slot, attempt: attemptId, file: f.id }, src = EB.url("exam-file", q), dl = EB.url("exam-file", { slot: slot, attempt: attemptId, file: f.id, download: 1 });
    var browserCanShow = !/\.(heic|heif|mkv|3gp)$/i.test(f.name);
    var view = f.kind === "image" && browserCanShow ? '<a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="' + esc(f.name) + '" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:8px;display:block"></a>'
      : f.kind === "video" && browserCanShow ? '<video src="' + src + '" controls preload="metadata" style="width:100%;height:150px;border-radius:8px;background:#000;display:block"></video>'
      : '<a href="' + src + '" target="_blank" rel="noopener" class="u" style="display:grid;place-items:center;height:150px;border:1px solid var(--line);border-radius:8px">' + ic("file") + "</a>";
    return '<div style="min-width:0">' + view + '<div class="u" style="margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(f.name) + '">' + esc(f.name) + '</div><div class="u">' + fmtSize(f.size) + ' · <a href="' + dl + '">Download</a></div></div>';
  }
  function results(box, slot) {
    return EB.get("exam-results", { slot: slot }).then(function (d) {
      var head = '<div class="row" style="margin-bottom:12px"><span class="u">' + d.attempts.length + " student" + (d.attempts.length === 1 ? "" : "s") + " started this paper</span><div class=\"spacer\"></div>" + (d.hasPdf ? '<a class="btn sm" target="_blank" rel="noopener" href="' + EB.url("exam-pdf", { slot: slot }) + '">View question paper</a> ' : "") + '<button class="btn sm" id="rr">Refresh</button></div>';
      if (!d.attempts.length) box.innerHTML = head + '<div class="card"><p class="empty">No one has started this paper yet.</p></div>';
      else box.innerHTML = head + d.attempts.map(function (a) {
        /* Group by the section name saved with each file, so work stays visible
           even if a section is later renamed or removed from the paper. */
        var groups = [], by = {};
        a.files.forEach(function (f) { var n = f.sectionName || "Other"; if (!by[n]) { by[n] = []; groups.push(n); } by[n].push(f); });
        d.sections.forEach(function (s) { if (s.required && !by[s.name]) { by[s.name] = []; groups.push(s.name); } });
        var sc = a.score || { total: 0 };
        var answers = sc.total ? '<div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="badge blue" style="text-transform:none;font-size:13px;padding:4px 12px">Score ' + sc.correct + "/" + sc.total + " · " + Math.round(sc.correct / sc.total * 100) + '%</span><span class="u">' + sc.wrong + " wrong · " + sc.unanswered + " unanswered</span></div>" +
          '<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600;font-size:13px">View full paper and answers</summary>' + a.questions.map(function (q, i) {
            var c = a.answers[q.id], chosen = c === undefined ? null : c;
            return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>' + (i + 1) + ". " + esc(q.q) + "</b>" + q.options.map(function (o, k) {
              var right = k === q.answer, mine = k === chosen;
              return '<div style="margin-top:4px;font-size:13px' + (right ? ";color:var(--green-ink);font-weight:600" : mine ? ";color:var(--red-ink);font-weight:600" : "") + '">' + "ABCD"[k] + ") " + esc(o) + (right ? " · correct" : "") + (mine ? " · student's answer" : "") + "</div>";
            }).join("") + (chosen === null ? '<div class="u" style="margin-top:4px">Not answered</div>' : "") + "</div>";
          }).join("") + "</details>" : "";
        return '<div class="card"><div class="row" style="flex-wrap:wrap"><h2 style="margin:0">' + esc(a.student) + "</h2>" + statusBadge(a.status) + '<div class="spacer"></div><span class="u">Started ' + when(a.startedAt) + " · " + (a.status === "active" ? "ends " + when(a.deadline) : "finished " + when(a.submittedAt || a.deadline)) + " · " + a.files.length + (a.files.length === 1 ? " file" : " files") + "</span></div>" + answers +
          (groups.length ? groups.map(function (g) {
            return '<h3 style="margin:14px 0 8px;font-size:14px">' + esc(g) + ' <span class="u">(' + by[g].length + ")</span></h3>" + (by[g].length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">' + by[g].map(function (f) { return fileCard(slot, a.id, f); }).join("") + "</div>" : '<p class="hint" style="margin:0">Nothing uploaded in this required section.</p>');
          }).join("") : (sc.total ? "" : '<p class="hint" style="margin-top:10px">Nothing uploaded.</p>')) + "</div>";
      }).join("");
      $("#rr", box).onclick = function () { results(box, slot); };
    }).catch(function (e) { box.innerHTML = '<div class="card"><p class="hint">' + esc(e.message) + "</p></div>"; });
  }
})();
